from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import desc
from sqlalchemy.orm import Session

from database import get_db
from models import StockPrice, User, Watchlist
from security import get_current_user

router = APIRouter(prefix="/watchlist", tags=["watchlist"])


class WatchlistAdd(BaseModel):
    symbol: str = Field(min_length=1, max_length=10)
    alert_price_up: Optional[float] = None
    alert_price_down: Optional[float] = None
    notes: Optional[str] = None


def _latest_price(db: Session, symbol: str):
    row = (
        db.query(StockPrice)
        .filter(StockPrice.symbol == symbol)
        .order_by(desc(StockPrice.date))
        .first()
    )
    return row


@router.get("")
def list_watchlist(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    items = db.query(Watchlist).filter(Watchlist.user_id == user.id).all()
    out = []
    for it in items:
        price = _latest_price(db, it.symbol)
        out.append({
            "id": it.id,
            "symbol": it.symbol,
            "added_date": it.added_date.isoformat() if it.added_date else None,
            "alert_price_up": float(it.alert_price_up) if it.alert_price_up else None,
            "alert_price_down": float(it.alert_price_down) if it.alert_price_down else None,
            "notes": it.notes,
            "last_price": float(price.close) if price else None,
            "last_price_date": price.date.isoformat() if price else None,
        })
    return {"status": "success", "watchlist": out}


@router.post("", status_code=201)
def add_to_watchlist(body: WatchlistAdd, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    symbol = body.symbol.upper()
    if db.query(Watchlist).filter(Watchlist.user_id == user.id, Watchlist.symbol == symbol).first():
        raise HTTPException(status_code=409, detail=f"{symbol} already in watchlist")
    item = Watchlist(
        user_id=user.id,
        symbol=symbol,
        alert_price_up=body.alert_price_up,
        alert_price_down=body.alert_price_down,
        notes=body.notes,
    )
    db.add(item)
    db.commit()
    return {"status": "success", "symbol": symbol}


@router.delete("/{symbol}")
def remove_from_watchlist(symbol: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(Watchlist).filter(Watchlist.user_id == user.id, Watchlist.symbol == symbol.upper()).first()
    if item is None:
        raise HTTPException(status_code=404, detail="Not in watchlist")
    db.delete(item)
    db.commit()
    return {"status": "success", "symbol": symbol.upper()}
