from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from database import get_db
from ml.predictor import train_and_predict
from models import Prediction, PredictionOutcome

router = APIRouter(prefix="/predictions", tags=["predictions"])


def _window_stats(db: Session, days: int, symbol: str = None) -> dict:
    cutoff = date.today() - timedelta(days=days)
    q = db.query(PredictionOutcome).filter(PredictionOutcome.prediction_date >= cutoff)
    if symbol:
        q = q.filter(PredictionOutcome.symbol == symbol)
    rows = q.all()

    directional = [r for r in rows if r.hit is not None]
    with_prob = [r for r in rows if r.prob_up is not None and r.actual_direction in ("UP", "DOWN")]
    ups = [r for r in rows if r.actual_direction == "UP"]

    hit_rate = round(sum(1 for r in directional if r.hit) / len(directional), 4) if directional else None
    brier = (
        round(sum((float(r.prob_up) - (1.0 if r.actual_direction == "UP" else 0.0)) ** 2
                  for r in with_prob) / len(with_prob), 4)
        if with_prob else None
    )
    baseline = round(len(ups) / len(rows), 4) if rows else None

    return {
        "window_days": days,
        "n_scored": len(rows),
        "n_directional": len(directional),
        "n_neutral": len(rows) - len(directional),
        "hit_rate": hit_rate,
        "brier": brier,
        "always_up_hit_rate": baseline,
    }


# NOTE: /stats must be declared before /{symbol} or it would be captured as a symbol.
@router.get("/stats")
def prediction_stats(db: Session = Depends(get_db)):
    """Rolling live hit-rate of published predictions vs the always-up baseline.
    Educational only — not trading advice."""
    symbols = [s[0] for s in db.query(PredictionOutcome.symbol).distinct().all()]
    per_symbol = {}
    for s in sorted(symbols):
        per_symbol[s] = {
            "30d": _window_stats(db, 30, s),
            "90d": _window_stats(db, 90, s),
        }
    return {
        "status": "success",
        "overall": {"30d": _window_stats(db, 30), "90d": _window_stats(db, 90)},
        "per_symbol": per_symbol,
        "disclaimer": "Educational project — not trading advice.",
    }


@router.get("/{symbol}")
def get_prediction(symbol: str, db: Session = Depends(get_db)):
    """Latest stored prediction for a symbol"""
    symbol = symbol.upper()
    pred = (
        db.query(Prediction)
        .filter(Prediction.symbol == symbol)
        .order_by(desc(Prediction.prediction_date))
        .first()
    )
    if pred is None:
        return {"status": "not_found", "symbol": symbol, "message": "No prediction available"}
    return {
        "status": "success",
        "symbol": symbol,
        "prediction_date": pred.prediction_date.isoformat(),
        "signal": pred.signal,
        "confidence": float(pred.confidence) if pred.confidence is not None else None,
        "prob_up": float(pred.prob_up) if pred.prob_up is not None else None,
        "signal_5d": pred.signal_5d,
        "prob_up_5d": float(pred.prob_up_5d) if pred.prob_up_5d is not None else None,
        "volatility_forecast": float(pred.volatility_forecast) if pred.volatility_forecast is not None else None,
        "disclaimer": "Educational project — not trading advice.",
    }


@router.post("/{symbol}/refresh")
def refresh_prediction(symbol: str, db: Session = Depends(get_db)):
    """Ensure deep history, then predict with the cached global model
    (trains once only if no artifact exists yet)."""
    from ml.predictor import _ensure_history

    symbol = symbol.upper()
    try:
        _ensure_history(db, symbol)
        for idx in ("NIFTY50", "INDIAVIX"):
            _ensure_history(db, idx)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Backfill failed: {str(e)}")

    result = train_and_predict(symbol, db=db)
    if result["status"] == "error":
        raise HTTPException(status_code=500, detail=result["message"])
    return result
