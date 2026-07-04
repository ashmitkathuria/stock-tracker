from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models import SectorPerformance

router = APIRouter(prefix="/sectors", tags=["sectors"])


@router.get("")
def get_sectors(db: Session = Depends(get_db)):
    """Latest stored performance for every sector"""
    latest = db.query(func.max(SectorPerformance.date)).scalar()
    if latest is None:
        return {"status": "not_found", "sectors": [], "message": "No sector data yet"}
    rows = (
        db.query(SectorPerformance)
        .filter(SectorPerformance.date == latest)
        .order_by(SectorPerformance.sector)
        .all()
    )
    return {
        "status": "success",
        "date": latest.isoformat(),
        "sectors": [{
            "sector": r.sector,
            "return_pct": float(r.return_pct) if r.return_pct is not None else None,
            "index_value": float(r.index_value) if r.index_value is not None else None,
        } for r in rows],
    }
