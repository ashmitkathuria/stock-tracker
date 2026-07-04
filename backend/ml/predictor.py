"""
Per-symbol next-day price-direction prediction.

Trains a logistic regression on features derived from stored daily closes
in stock_prices and upserts the result into the predictions table.
"""
import logging
from datetime import datetime
from decimal import Decimal

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score
from sklearn.preprocessing import StandardScaler
from sqlalchemy.orm import Session

from database import SessionLocal
from models import Prediction, StockPrice

logger = logging.getLogger(__name__)

MIN_HISTORY_ROWS = 100

FEATURES = ["ret_1", "ret_5", "ret_10", "vol_10", "vol_20", "volume_change", "sma_ratio"]


def _load_history(db: Session, symbol: str) -> pd.DataFrame:
    rows = (
        db.query(StockPrice.date, StockPrice.close, StockPrice.volume)
        .filter(StockPrice.symbol == symbol)
        .order_by(StockPrice.date)
        .all()
    )
    return pd.DataFrame(
        {
            "date": [r.date for r in rows],
            "close": [float(r.close) for r in rows],
            "volume": [float(r.volume) if r.volume is not None else np.nan for r in rows],
        }
    )


def _build_features(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["ret_1"] = out["close"].pct_change(1)
    out["ret_5"] = out["close"].pct_change(5)
    out["ret_10"] = out["close"].pct_change(10)
    out["vol_10"] = out["ret_1"].rolling(10).std()
    out["vol_20"] = out["ret_1"].rolling(20).std()
    out["volume_change"] = out["volume"].pct_change(1).replace([np.inf, -np.inf], np.nan)
    out["sma_ratio"] = out["close"].rolling(10).mean() / out["close"].rolling(50).mean()
    out["target"] = (out["close"].shift(-1) > out["close"]).astype(int)
    return out


def train_and_predict(symbol: str, db: Session = None) -> dict:
    """
    Train on stored history and upsert today's UP/DOWN prediction.

    Returns dict with status: success / skipped / error.
    """
    owns_session = db is None
    if owns_session:
        db = SessionLocal()

    try:
        history = _load_history(db, symbol)
        if len(history) < MIN_HISTORY_ROWS:
            logger.info(f"[ML] {symbol}: only {len(history)} rows of history (<{MIN_HISTORY_ROWS}), skipping")
            return {"status": "skipped", "symbol": symbol,
                    "message": f"Insufficient history ({len(history)} rows, need {MIN_HISTORY_ROWS})"}

        df = _build_features(history)
        # Last row has no next-day target; keep it aside as the live sample.
        live = df.iloc[[-1]][FEATURES].dropna()
        train_df = df.iloc[:-1].dropna(subset=FEATURES + ["target"])

        if len(train_df) < MIN_HISTORY_ROWS - 50 or live.empty:
            return {"status": "skipped", "symbol": symbol, "message": "Insufficient usable feature rows"}

        # Time-ordered split: train on the first 80%, evaluate on the last 20%
        split = int(len(train_df) * 0.8)
        X_train, y_train = train_df[FEATURES].iloc[:split], train_df["target"].iloc[:split]
        X_test, y_test = train_df[FEATURES].iloc[split:], train_df["target"].iloc[split:]

        scaler = StandardScaler()
        model = LogisticRegression(max_iter=1000)
        model.fit(scaler.fit_transform(X_train), y_train)

        test_accuracy = None
        if len(X_test) > 0:
            test_accuracy = float(accuracy_score(y_test, model.predict(scaler.transform(X_test))))

        prob_up = float(model.predict_proba(scaler.transform(live))[0][1])
        signal = "UP" if prob_up >= 0.5 else "DOWN"
        confidence = max(prob_up, 1 - prob_up)
        volatility = float(df["vol_20"].iloc[-1]) if not np.isnan(df["vol_20"].iloc[-1]) else None

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
            "volatility_forecast": Decimal(str(round(volatility, 4))) if volatility is not None else None,
        }
        if existing:
            for k, v in values.items():
                setattr(existing, k, v)
        else:
            db.add(Prediction(symbol=symbol, prediction_date=today, **values))
        db.commit()

        logger.info(f"[ML] {symbol}: {signal} (prob_up={prob_up:.2f}, test_acc={test_accuracy})")
        return {
            "status": "success",
            "symbol": symbol,
            "prediction_date": today.isoformat(),
            "signal": signal,
            "confidence": round(confidence, 2),
            "prob_up": round(prob_up, 2),
            "volatility_forecast": round(volatility, 4) if volatility is not None else None,
            "test_accuracy": round(test_accuracy, 3) if test_accuracy is not None else None,
            "train_rows": len(train_df),
        }

    except Exception as e:
        db.rollback()
        logger.error(f"[ML] Error predicting {symbol}: {str(e)}")
        return {"status": "error", "symbol": symbol, "message": str(e)}

    finally:
        if owns_session:
            db.close()
