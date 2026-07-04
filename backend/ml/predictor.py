"""
Cross-sectional next-day / 5-day price-direction model.

One global gradient-boosted classifier is trained across all symbols pooled
(symbol-agnostic features from ml/features.py). Probabilities are calibrated
with isotonic regression on a held-out tail window, and the published signal
is NEUTRAL whenever the calibrated prob_up sits inside [0.45, 0.55].

The model artifact is cached on disk (gitignored) and retrained weekly by
the scheduler; API startup and the daily job never train unless the artifact
is missing entirely. Educational only — not trading advice.
"""
import json
import logging
import os
import pickle
from datetime import datetime, timedelta
from decimal import Decimal
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, brier_score_loss, log_loss
from sklearn.preprocessing import StandardScaler
from sqlalchemy.orm import Session

from database import SessionLocal
from ml.features import FEATURE_COLUMNS, build_features
from models import News, Prediction, StockPrice

logger = logging.getLogger(__name__)

MIN_HISTORY_ROWS = 100
MIN_TRAIN_ROWS = 500          # pooled rows needed before we trust a global model
MAX_TRAIN_ROWS = 150_000      # subsample bound to keep Railway training in minutes
NEUTRAL_BAND = (0.45, 0.55)
CALIBRATION_TAIL_DAYS = 180   # held-out tail used to fit isotonic calibration
INDEX_SYMBOLS = ("NIFTY50", "INDIAVIX")

ARTIFACT_PATH = Path(os.getenv("ML_ARTIFACT_PATH", Path(__file__).parent / "model_artifact.pkl"))
EVAL_REPORT_PATH = Path(__file__).parent / "eval_report.json"

# "auto" tries lightgbm and falls back to sklearn's HistGradientBoosting
ML_BACKEND = os.getenv("ML_BACKEND", "auto").lower()

# Feature subset matching the old per-symbol LogisticRegression baseline
OLD_LR_FEATURES = ["ret_1", "ret_5", "ret_10", "vol_10", "vol_20", "volume_z_20", "sma_10_50"]


def _make_estimator():
    """Gradient-boosted classifier behind a config flag, sized for a small container."""
    if ML_BACKEND in ("auto", "lightgbm"):
        try:
            from lightgbm import LGBMClassifier
            return LGBMClassifier(
                n_estimators=300, learning_rate=0.05, num_leaves=31,
                min_child_samples=50, subsample=0.8, colsample_bytree=0.8,
                n_jobs=1, verbosity=-1, random_state=42,
            ), "lightgbm"
        except Exception:
            # lightgbm can fail with ImportError or OSError (missing libomp);
            # in auto mode fall through to the no-extra-deps sklearn backend
            if ML_BACKEND == "lightgbm":
                raise
    from sklearn.ensemble import HistGradientBoostingClassifier
    return HistGradientBoostingClassifier(
        max_iter=300, learning_rate=0.05, max_leaf_nodes=31,
        min_samples_leaf=50, random_state=42,
    ), "sklearn"


# ---------------------------------------------------------------------------
# data loading
# ---------------------------------------------------------------------------

def _prices_frame(db: Session, symbol: str) -> pd.DataFrame:
    rows = (
        db.query(StockPrice.date, StockPrice.open, StockPrice.high,
                 StockPrice.low, StockPrice.close, StockPrice.volume)
        .filter(StockPrice.symbol == symbol)
        .order_by(StockPrice.date)
        .all()
    )
    return pd.DataFrame(rows, columns=["date", "open", "high", "low", "close", "volume"])


def _news_frame(db: Session, symbol: str) -> pd.DataFrame:
    rows = (
        db.query(News.published_at, News.sentiment_score)
        .filter(News.symbol == symbol)
        .all()
    )
    df = pd.DataFrame(rows, columns=["published_at", "sentiment_score"])
    if not df.empty:
        df["sentiment_score"] = df["sentiment_score"].astype(float)
    return df


def _symbol_features(db: Session, symbol: str, market: pd.DataFrame, vix: pd.DataFrame) -> pd.DataFrame:
    prices = _prices_frame(db, symbol)
    if len(prices) < MIN_HISTORY_ROWS:
        return pd.DataFrame()
    return build_features(prices, market=market, vix=vix, news=_news_frame(db, symbol))


def _context_frames(db: Session):
    return _prices_frame(db, "NIFTY50"), _prices_frame(db, "INDIAVIX")


def _training_symbols(db: Session):
    rows = db.query(StockPrice.symbol).distinct().all()
    return [r[0] for r in rows if r[0] not in INDEX_SYMBOLS]


def load_training_frame(db: Session, lazy_backfill: bool = False) -> pd.DataFrame:
    """Pooled feature matrix across all stored symbols."""
    market, vix = _context_frames(db)
    frames = []
    for symbol in _training_symbols(db):
        try:
            if lazy_backfill:
                _ensure_history(db, symbol)
            f = _symbol_features(db, symbol, market, vix)
            if not f.empty:
                f = f.assign(symbol=symbol)
                frames.append(f)
        except Exception as e:
            logger.error(f"[ML] Feature build failed for {symbol}: {str(e)}")
    if not frames:
        return pd.DataFrame()
    return pd.concat(frames).sort_index()


def _ensure_history(db: Session, symbol: str, min_rows: int = 500):
    """Lazily deep-backfill any symbol with under ~2 years of stored history."""
    from fetchers.stock_fetcher import backfill_history
    count = db.query(StockPrice.id).filter(StockPrice.symbol == symbol).count()
    if count < min_rows:
        logger.info(f"[ML] {symbol} has {count} rows; deep-backfilling 10y")
        backfill_history(symbol, period="10y", db=db)


# ---------------------------------------------------------------------------
# walk-forward evaluation
# ---------------------------------------------------------------------------

def walk_forward_eval(pooled: pd.DataFrame, target_col: str = "target_1d",
                      min_train_years: int = 3, test_months: int = 6,
                      max_folds: int = 8) -> dict:
    """
    Expanding-window evaluation of the global model vs the always-up baseline
    and the old per-fold LogisticRegression, on pooled data ordered by date.
    """
    data = pooled.dropna(subset=FEATURE_COLUMNS + [target_col])
    if data.empty:
        return {"error": "no usable rows"}
    dates = data.index
    start, end = dates.min(), dates.max()
    first_test = start + pd.DateOffset(years=min_train_years)
    folds = []
    test_start = first_test

    while test_start < end and len(folds) < max_folds:
        test_end = test_start + pd.DateOffset(months=test_months)
        train = data[dates < test_start]
        test = data[(dates >= test_start) & (dates < test_end)]
        test_start = test_end
        if len(train) < MIN_TRAIN_ROWS or len(test) < 100:
            continue

        X_tr, y_tr = train[FEATURE_COLUMNS], train[target_col].astype(int)
        X_te, y_te = test[FEATURE_COLUMNS], test[target_col].astype(int)

        est, backend = _make_estimator()
        est.fit(X_tr, y_tr)
        p = est.predict_proba(X_te)[:, 1]

        # old-model baseline: LogisticRegression on the legacy feature set
        lr_cols = [c for c in OLD_LR_FEATURES if c in X_tr.columns]
        scaler = StandardScaler().fit(X_tr[lr_cols])
        lr = LogisticRegression(max_iter=1000).fit(scaler.transform(X_tr[lr_cols]), y_tr)
        p_lr = lr.predict_proba(scaler.transform(X_te[lr_cols]))[:, 1]

        # always-up baseline: constant probability = train base rate
        base_p = float(y_tr.mean())
        p_up = np.full(len(y_te), base_p)

        folds.append({
            "train_end": str(train.index.max().date()),
            "test_start": str(test.index.min().date()),
            "test_end": str(test.index.max().date()),
            "n_train": int(len(train)),
            "n_test": int(len(test)),
            "model": {
                "accuracy": round(float(accuracy_score(y_te, (p >= 0.5).astype(int))), 4),
                "brier": round(float(brier_score_loss(y_te, p)), 4),
                "log_loss": round(float(log_loss(y_te, p, labels=[0, 1])), 4),
            },
            "old_logreg": {
                "accuracy": round(float(accuracy_score(y_te, (p_lr >= 0.5).astype(int))), 4),
                "brier": round(float(brier_score_loss(y_te, p_lr)), 4),
                "log_loss": round(float(log_loss(y_te, p_lr, labels=[0, 1])), 4),
            },
            "always_up": {
                "accuracy": round(float(y_te.mean()), 4),
                "brier": round(float(brier_score_loss(y_te, p_up)), 4),
                "log_loss": round(float(log_loss(y_te, p_up, labels=[0, 1])), 4),
            },
        })

    def _avg(key, metric):
        vals = [f[key][metric] for f in folds]
        return round(float(np.mean(vals)), 4) if vals else None

    report = {
        "generated_at": datetime.utcnow().isoformat(),
        "target": target_col,
        "backend": _make_estimator()[1],
        "n_folds": len(folds),
        "folds": folds,
        "mean": {
            key: {m: _avg(key, m) for m in ("accuracy", "brier", "log_loss")}
            for key in ("model", "old_logreg", "always_up")
        },
    }
    return report


# ---------------------------------------------------------------------------
# training / artifact
# ---------------------------------------------------------------------------

def _fit_head(data: pd.DataFrame, target_col: str):
    """Fit one horizon head + isotonic calibrator on a time-ordered split."""
    usable = data.dropna(subset=FEATURE_COLUMNS + [target_col])
    if len(usable) > MAX_TRAIN_ROWS:
        usable = usable.iloc[-MAX_TRAIN_ROWS:]
    if len(usable) < MIN_TRAIN_ROWS:
        return None

    calib_start = usable.index.max() - pd.Timedelta(days=CALIBRATION_TAIL_DAYS)
    train = usable[usable.index < calib_start]
    calib = usable[usable.index >= calib_start]
    if len(train) < MIN_TRAIN_ROWS or len(calib) < 100:
        # not enough for a calibration split — train on everything, no calibration
        train, calib = usable, None

    est, backend = _make_estimator()
    est.fit(train[FEATURE_COLUMNS], train[target_col].astype(int))

    iso = None
    if calib is not None:
        p_calib = est.predict_proba(calib[FEATURE_COLUMNS])[:, 1]
        iso = IsotonicRegression(y_min=0.01, y_max=0.99, out_of_bounds="clip")
        iso.fit(p_calib, calib[target_col].astype(int))

    return {"estimator": est, "calibrator": iso, "backend": backend,
            "n_train": len(train), "n_calib": len(calib) if calib is not None else 0}


def train_global_model(db: Session = None, save: bool = True, lazy_backfill: bool = True) -> dict:
    """Train both horizon heads on pooled data and cache the artifact."""
    owns_session = db is None
    if owns_session:
        db = SessionLocal()
    try:
        started = datetime.utcnow()
        pooled = load_training_frame(db, lazy_backfill=lazy_backfill)
        if pooled.empty:
            return {"status": "error", "message": "No training data"}

        head_1d = _fit_head(pooled, "target_1d")
        head_5d = _fit_head(pooled, "target_5d")
        if head_1d is None:
            return {"status": "error", "message": "Insufficient pooled rows for training"}

        bundle = {
            "trained_at": started.isoformat(),
            "backend": head_1d["backend"],
            "feature_columns": FEATURE_COLUMNS,
            "head_1d": head_1d,
            "head_5d": head_5d,
            "n_symbols": pooled["symbol"].nunique(),
            "n_rows": int(len(pooled)),
        }
        if save:
            ARTIFACT_PATH.parent.mkdir(parents=True, exist_ok=True)
            with open(ARTIFACT_PATH, "wb") as fh:
                pickle.dump(bundle, fh)
        elapsed = (datetime.utcnow() - started).total_seconds()
        logger.info(f"[ML] Trained global model ({bundle['backend']}) on {bundle['n_rows']} rows / "
                    f"{bundle['n_symbols']} symbols in {elapsed:.1f}s")
        return {"status": "success", "backend": bundle["backend"], "n_rows": bundle["n_rows"],
                "n_symbols": bundle["n_symbols"], "seconds": round(elapsed, 1), "bundle": bundle}
    except Exception as e:
        logger.error(f"[ML] Training failed: {str(e)}")
        return {"status": "error", "message": str(e)}
    finally:
        if owns_session:
            db.close()


_model_cache = {"bundle": None, "loaded_at": None}


def get_model(db: Session = None, allow_train: bool = True):
    """Load the cached artifact; train once (bounded) only if it's missing."""
    if _model_cache["bundle"] is not None:
        return _model_cache["bundle"]
    if ARTIFACT_PATH.exists():
        try:
            with open(ARTIFACT_PATH, "rb") as fh:
                _model_cache["bundle"] = pickle.load(fh)
            _model_cache["loaded_at"] = datetime.utcnow()
            return _model_cache["bundle"]
        except Exception as e:
            logger.error(f"[ML] Failed to load artifact: {str(e)}")
    if not allow_train:
        return None
    result = train_global_model(db)
    if result.get("status") == "success":
        _model_cache["bundle"] = result["bundle"]
        return result["bundle"]
    return None


def invalidate_model_cache():
    _model_cache["bundle"] = None


# ---------------------------------------------------------------------------
# inference
# ---------------------------------------------------------------------------

def _calibrated_prob(head, X) -> float:
    p = float(head["estimator"].predict_proba(X)[:, 1][0])
    if head.get("calibrator") is not None:
        p = float(head["calibrator"].predict([p])[0])
    return min(max(p, 0.01), 0.99)


def _signal_from_prob(prob_up: float) -> str:
    lo, hi = NEUTRAL_BAND
    if lo <= prob_up <= hi:
        return "NEUTRAL"
    return "UP" if prob_up > hi else "DOWN"


def train_and_predict(symbol: str, db: Session = None) -> dict:
    """
    Predict next-day and 5-day direction for one symbol using the cached
    global model, and upsert into predictions. (Name kept for compatibility
    with the scheduler and router; training only happens if no artifact
    exists yet.)
    """
    owns_session = db is None
    if owns_session:
        db = SessionLocal()
    try:
        history_count = db.query(StockPrice.id).filter(StockPrice.symbol == symbol).count()
        if history_count < MIN_HISTORY_ROWS:
            logger.info(f"[ML] {symbol}: only {history_count} rows of history, skipping")
            return {"status": "skipped", "symbol": symbol,
                    "message": f"Insufficient history ({history_count} rows, need {MIN_HISTORY_ROWS})"}

        bundle = get_model(db)
        if bundle is None:
            return {"status": "error", "symbol": symbol, "message": "No trained model available"}

        market, vix = _context_frames(db)
        f = _symbol_features(db, symbol, market, vix)
        if f.empty:
            return {"status": "skipped", "symbol": symbol, "message": "Insufficient usable feature rows"}
        live = f.iloc[[-1]][FEATURE_COLUMNS]
        if live.isna().sum().sum() > len(FEATURE_COLUMNS) // 2:
            return {"status": "skipped", "symbol": symbol, "message": "Too many missing features"}

        prob_up = _calibrated_prob(bundle["head_1d"], live)
        signal = _signal_from_prob(prob_up)
        confidence = max(prob_up, 1 - prob_up)

        prob_up_5d = signal_5d = None
        if bundle.get("head_5d") is not None:
            prob_up_5d = _calibrated_prob(bundle["head_5d"], live)
            signal_5d = _signal_from_prob(prob_up_5d)

        vol20 = f["vol_20"].iloc[-1]
        volatility = float(vol20) if not np.isnan(vol20) else None

        today = datetime.now().date()
        existing = (
            db.query(Prediction)
            .filter(Prediction.symbol == symbol, Prediction.prediction_date == today)
            .first()
        )
        values = {
            "signal": signal,
            "confidence": Decimal(str(round(confidence, 2))),
            "prob_up": Decimal(str(round(prob_up, 2))),
            "signal_5d": signal_5d,
            "prob_up_5d": Decimal(str(round(prob_up_5d, 2))) if prob_up_5d is not None else None,
            "volatility_forecast": Decimal(str(round(volatility, 4))) if volatility is not None else None,
        }
        if existing:
            for k, v in values.items():
                setattr(existing, k, v)
        else:
            db.add(Prediction(symbol=symbol, prediction_date=today, **values))
        db.commit()

        logger.info(f"[ML] {symbol}: {signal} (prob_up={prob_up:.2f}, 5d={signal_5d})")
        return {
            "status": "success",
            "symbol": symbol,
            "prediction_date": today.isoformat(),
            "signal": signal,
            "confidence": round(confidence, 2),
            "prob_up": round(prob_up, 2),
            "signal_5d": signal_5d,
            "prob_up_5d": round(prob_up_5d, 2) if prob_up_5d is not None else None,
            "volatility_forecast": round(volatility, 4) if volatility is not None else None,
            "model_backend": bundle["backend"],
            "model_trained_at": bundle["trained_at"],
        }

    except Exception as e:
        db.rollback()
        logger.error(f"[ML] Error predicting {symbol}: {str(e)}")
        return {"status": "error", "symbol": symbol, "message": str(e)}

    finally:
        if owns_session:
            db.close()


def run_walk_forward_and_save_report(db: Session = None) -> dict:
    """Run the walk-forward eval on stored data and persist ml/eval_report.json."""
    owns_session = db is None
    if owns_session:
        db = SessionLocal()
    try:
        pooled = load_training_frame(db, lazy_backfill=False)
        if pooled.empty:
            return {"error": "no data"}
        report = walk_forward_eval(pooled)
        with open(EVAL_REPORT_PATH, "w") as fh:
            json.dump(report, fh, indent=2)
        logger.info(f"[ML] Walk-forward eval: {json.dumps(report.get('mean', {}))}")
        return report
    finally:
        if owns_session:
            db.close()
