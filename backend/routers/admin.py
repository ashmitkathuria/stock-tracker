from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from fetchers.stock_fetcher import backfill_history
from models import User, Watchlist
from security import get_current_user

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/backfill")
def backfill_all(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Deep-backfill 10y of history for all watchlist symbols plus the
    NIFTY50 and INDIAVIX context series. JWT-protected; one-off admin use."""
    symbols = [s[0] for s in db.query(Watchlist.symbol).distinct().all()]
    symbols += ["NIFTY50", "INDIAVIX"]

    results = []
    for symbol in symbols:
        try:
            r = backfill_history(symbol, period="10y", db=db)
            results.append({k: r.get(k) for k in ("symbol", "status", "inserted", "updated", "message")})
        except Exception as e:
            results.append({"symbol": symbol, "status": "error", "message": str(e)})

    ok = sum(1 for r in results if r["status"] == "success")
    return {"status": "success", "symbols": len(symbols), "succeeded": ok, "results": results}
