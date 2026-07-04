"""
Live accuracy tracking: score stored predictions against realized next-day
direction once the following day's close is available.
"""
import logging
from datetime import date, timedelta

from sqlalchemy import desc
from sqlalchemy.orm import Session

from database import SessionLocal
from models import Prediction, PredictionOutcome, StockPrice

logger = logging.getLogger(__name__)

LOOKBACK_DAYS = 14  # how far back to look for unscored predictions


def _close_on(db: Session, symbol: str, day: date):
    row = (
        db.query(StockPrice.close)
        .filter(StockPrice.symbol == symbol, StockPrice.date <= day)
        .order_by(desc(StockPrice.date))
        .first()
    )
    return float(row.close) if row else None


def _next_close_after(db: Session, symbol: str, day: date):
    row = (
        db.query(StockPrice.date, StockPrice.close)
        .filter(StockPrice.symbol == symbol, StockPrice.date > day)
        .order_by(StockPrice.date)
        .first()
    )
    return (row.date, float(row.close)) if row else (None, None)


def score_pending_outcomes(db: Session = None) -> dict:
    """
    For every recent prediction without an outcome row, compare the close on
    the prediction date to the first close after it. NEUTRAL predictions get
    an outcome row with hit=None (tracked but excluded from hit rate).
    """
    owns_session = db is None
    if owns_session:
        db = SessionLocal()

    scored = skipped = 0
    try:
        cutoff = date.today() - timedelta(days=LOOKBACK_DAYS)
        pending = (
            db.query(Prediction)
            .outerjoin(PredictionOutcome,
                       (PredictionOutcome.symbol == Prediction.symbol) &
                       (PredictionOutcome.prediction_date == Prediction.prediction_date))
            .filter(Prediction.prediction_date >= cutoff,
                    Prediction.prediction_date < date.today(),
                    PredictionOutcome.id.is_(None))
            .all()
        )

        for pred in pending:
            try:
                base_close = _close_on(db, pred.symbol, pred.prediction_date)
                next_day, next_close = _next_close_after(db, pred.symbol, pred.prediction_date)
                if base_close is None or next_close is None:
                    skipped += 1
                    continue

                actual = "UP" if next_close > base_close else "DOWN"
                hit = None if pred.signal == "NEUTRAL" else (pred.signal == actual)
                db.add(PredictionOutcome(
                    symbol=pred.symbol,
                    prediction_date=pred.prediction_date,
                    signal=pred.signal,
                    prob_up=pred.prob_up,
                    actual_direction=actual,
                    hit=hit,
                ))
                db.commit()
                scored += 1
            except Exception as e:
                db.rollback()
                logger.error(f"[OUTCOMES] Error scoring {pred.symbol}@{pred.prediction_date}: {str(e)}")

        logger.info(f"[OUTCOMES] Scored {scored}, waiting-on-data {skipped}")
        return {"status": "success", "scored": scored, "pending_data": skipped}

    finally:
        if owns_session:
            db.close()
