from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc
from sqlalchemy.orm import Session

from database import get_db
from fetchers.stock_fetcher import backfill_history
from ml.predictor import train_and_predict
from models import Prediction

router = APIRouter(prefix="/predictions", tags=["predictions"])


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
        "volatility_forecast": float(pred.volatility_forecast) if pred.volatility_forecast is not None else None,
    }


@router.post("/{symbol}/refresh")
def refresh_prediction(symbol: str, db: Session = Depends(get_db)):
    """Backfill history, retrain, and store a fresh prediction"""
    symbol = symbol.upper()
    backfill = backfill_history(symbol, "NSE", days=400, db=db)
    if backfill["status"] == "error":
        raise HTTPException(status_code=400, detail=backfill["message"])
    result = train_and_predict(symbol, db=db)
    if result["status"] == "error":
        raise HTTPException(status_code=500, detail=result["message"])
    return {**result, "backfill": {k: backfill[k] for k in ("inserted", "updated")}}
