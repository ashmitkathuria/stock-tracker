import datetime as dt
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import desc
from sqlalchemy.orm import Session

from database import get_db
from models import Portfolio, StockPrice, Trade, User
from security import get_current_user

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


class HoldingAdd(BaseModel):
    symbol: str = Field(min_length=1, max_length=10)
    quantity: float = Field(gt=0)
    avg_cost: float = Field(gt=0)
    purchase_date: Optional[dt.datetime] = None
    notes: Optional[str] = None


def _latest_close(db: Session, symbol: str):
    row = (
        db.query(StockPrice)
        .filter(StockPrice.symbol == symbol)
        .order_by(desc(StockPrice.date))
        .first()
    )
    return float(row.close) if row else None


@router.get("")
def get_portfolio(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    holdings = db.query(Portfolio).filter(Portfolio.user_id == user.id).all()
    out, total_value, total_cost = [], 0.0, 0.0
    for h in holdings:
        qty, cost = float(h.quantity), float(h.avg_cost)
        last = _latest_close(db, h.symbol)
        value = qty * last if last is not None else None
        invested = qty * cost
        total_cost += invested
        if value is not None:
            total_value += value
        out.append({
            "id": h.id,
            "symbol": h.symbol,
            "quantity": qty,
            "avg_cost": cost,
            "invested": invested,
            "last_price": last,
            "current_value": value,
            "gain_loss": (value - invested) if value is not None else None,
            "purchase_date": h.purchase_date.isoformat() if h.purchase_date else None,
            "notes": h.notes,
        })
    return {
        "status": "success",
        "holdings": out,
        "total_cost": total_cost,
        "total_value": total_value,
        "gain_loss": total_value - total_cost,
    }


@router.post("", status_code=201)
def add_holding(body: HoldingAdd, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    symbol = body.symbol.upper()
    existing = db.query(Portfolio).filter(Portfolio.user_id == user.id, Portfolio.symbol == symbol).first()
    purchase_date = body.purchase_date or dt.datetime.utcnow()
    if existing:
        # merge: weighted average cost
        old_qty, old_cost = float(existing.quantity), float(existing.avg_cost)
        new_qty = old_qty + body.quantity
        existing.avg_cost = (old_qty * old_cost + body.quantity * body.avg_cost) / new_qty
        existing.quantity = new_qty
    else:
        db.add(Portfolio(
            user_id=user.id, symbol=symbol, quantity=body.quantity,
            avg_cost=body.avg_cost, purchase_date=purchase_date, notes=body.notes,
        ))
    db.add(Trade(
        user_id=user.id, symbol=symbol, quantity=body.quantity,
        price=body.avg_cost, trade_type="BUY", trade_date=purchase_date,
    ))
    db.commit()
    return {"status": "success", "symbol": symbol}


class SellRequest(BaseModel):
    quantity: float = Field(gt=0)
    price: float = Field(gt=0)


@router.post("/{symbol}/sell")
def sell_holding(symbol: str, body: SellRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    symbol = symbol.upper()
    h = db.query(Portfolio).filter(Portfolio.user_id == user.id, Portfolio.symbol == symbol).first()
    if h is None:
        raise HTTPException(status_code=404, detail="Holding not found")
    qty = float(h.quantity)
    if body.quantity > qty:
        raise HTTPException(status_code=400, detail=f"Cannot sell {body.quantity}; only {qty} held")
    remaining = qty - body.quantity
    if remaining == 0:
        db.delete(h)
    else:
        h.quantity = remaining
    db.add(Trade(
        user_id=user.id, symbol=symbol, quantity=body.quantity,
        price=body.price, trade_type="SELL", trade_date=dt.datetime.utcnow(),
    ))
    db.commit()
    return {"status": "success", "symbol": symbol, "remaining_quantity": remaining}


@router.get("/trades")
def get_trades(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    trades = (
        db.query(Trade)
        .filter(Trade.user_id == user.id)
        .order_by(desc(Trade.trade_date))
        .limit(200)
        .all()
    )
    return {"status": "success", "trades": [{
        "id": t.id, "symbol": t.symbol, "quantity": float(t.quantity),
        "price": float(t.price), "trade_type": t.trade_type,
        "trade_date": t.trade_date.isoformat() if t.trade_date else None,
    } for t in trades]}
