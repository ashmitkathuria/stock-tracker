"""
Compute 1-day returns for NSE sector indices via yfinance and store them
in sector_performance (upsert on sector + date).
"""
import logging
from decimal import Decimal

import yfinance as yf
from sqlalchemy.orm import Session

from database import SessionLocal
from models import SectorPerformance

logger = logging.getLogger(__name__)

SECTOR_INDICES = {
    "IT": "^CNXIT",
    "Bank": "^NSEBANK",
    "Pharma": "^CNXPHARMA",
    "Auto": "^CNXAUTO",
    "Energy": "^CNXENERGY",
    "Metal": "^CNXMETAL",
    "FMCG": "^CNXFMCG",
    "Infra": "^CNXINFRA",
}


def fetch_sector_performance(db: Session = None) -> dict:
    """
    Fetch each sector index, compute the latest 1-day return, and upsert.

    Per-sector failures are caught and reported; one bad index never
    aborts the rest.
    """
    owns_session = db is None
    if owns_session:
        db = SessionLocal()

    results = {"success": [], "failed": []}
    try:
        for sector, ticker in SECTOR_INDICES.items():
            try:
                data = yf.download(ticker, period="5d", progress=False, multi_level_index=False)
                if data.empty or len(data) < 2:
                    results["failed"].append({"sector": sector, "message": "Insufficient data"})
                    continue

                prev_close = float(data['Close'].iloc[-2])
                last_close = float(data['Close'].iloc[-1])
                day = data.index[-1].date()
                return_pct = (last_close - prev_close) / prev_close * 100

                values = {
                    "return_pct": Decimal(str(round(return_pct, 3))),
                    "index_value": Decimal(str(round(last_close, 2))),
                }
                existing = db.query(SectorPerformance).filter(
                    SectorPerformance.sector == sector,
                    SectorPerformance.date == day,
                ).first()
                if existing:
                    for k, v in values.items():
                        setattr(existing, k, v)
                else:
                    db.add(SectorPerformance(sector=sector, date=day, **values))
                db.commit()
                results["success"].append({"sector": sector, "date": day.isoformat(),
                                           "return_pct": round(return_pct, 3)})
            except Exception as e:
                db.rollback()
                logger.error(f"[SECTORS] Error fetching {sector} ({ticker}): {str(e)}")
                results["failed"].append({"sector": sector, "message": str(e)})

        logger.info(f"[SECTORS] Updated {len(results['success'])} sectors, {len(results['failed'])} failed")
        return {"status": "success", **results}

    finally:
        if owns_session:
            db.close()
