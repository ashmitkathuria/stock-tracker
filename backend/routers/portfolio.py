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


@router.get("/risk")
def get_risk(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Portfolio risk score (0-100) from the value-weighted stdev of holdings'
    daily returns over the last ~90 days of stored prices, plus a
    concentration reading (largest holding's share of portfolio value).
    """
    import math
    import statistics

    holdings = db.query(Portfolio).filter(Portfolio.user_id == user.id).all()
    if not holdings:
        return {"status": "success", "risk_score": 0, "volatility_pct": 0.0,
                "concentration_pct": 0.0, "message": "No holdings"}

    cutoff = dt.date.today() - dt.timedelta(days=90)
    values, vols = {}, {}
    for h in holdings:
        last = _latest_close(db, h.symbol)
        if last is None:
            continue
        values[h.symbol] = float(h.quantity) * last

        closes = [float(r.close) for r in (
            db.query(StockPrice)
            .filter(StockPrice.symbol == h.symbol, StockPrice.date >= cutoff)
            .order_by(StockPrice.date)
            .all()
        )]
        if len(closes) >= 3:
            rets = [(b - a) / a for a, b in zip(closes, closes[1:]) if a]
            if len(rets) >= 2:
                vols[h.symbol] = statistics.stdev(rets)

    total_value = sum(values.values())
    if total_value <= 0:
        return {"status": "success", "risk_score": 0, "volatility_pct": 0.0,
                "concentration_pct": 0.0, "message": "No priced holdings"}

    concentration_pct = max(values.values()) / total_value * 100

    weighted_vol = sum(
        (values[s] / total_value) * vols[s] for s in vols if s in values
    ) if vols else 0.0
    annualized_vol_pct = weighted_vol * math.sqrt(252) * 100

    # Map annualized volatility to 0-100 (40%+ annualized => max score),
    # with a concentration kicker so a one-stock portfolio reads riskier.
    score = min(100.0, annualized_vol_pct * 2.5)
    score = min(100.0, score + max(0.0, concentration_pct - 50) * 0.4)

    return {
        "status": "success",
        "risk_score": round(score),
        "volatility_pct": round(annualized_vol_pct, 1),
        "concentration_pct": round(concentration_pct, 1),
        "holdings_measured": len(vols),
    }


@router.get("/history")
def get_portfolio_history(
    days: int = 90,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Reconstruct daily portfolio value for the last `days` days from the
    user's trade history and stored closing prices. For each day, holdings
    are the cumulative BUY-SELL quantities up to that day; each symbol is
    valued at its most recent close on or before that day.
    """
    days = max(7, min(days, 365))
    start = dt.date.today() - dt.timedelta(days=days)

    trades = (
        db.query(Trade)
        .filter(Trade.user_id == user.id)
        .order_by(Trade.trade_date)
        .all()
    )
    if not trades:
        return {"status": "success", "history": []}

    symbols = sorted({t.symbol for t in trades})

    # Preload prices per symbol: ordered (date, close) from a bit before start.
    price_map = {}
    for sym in symbols:
        rows = (
            db.query(StockPrice.date, StockPrice.close)
            .filter(StockPrice.symbol == sym,
                    StockPrice.date >= start - dt.timedelta(days=30))
            .order_by(StockPrice.date)
            .all()
        )
        price_map[sym] = [(r.date, float(r.close)) for r in rows]

    def close_on_or_before(sym, day):
        best = None
        for d, c in price_map.get(sym, []):
            if d <= day:
                best = c
            else:
                break
        return best

    history = []
    ti = 0
    qty = {s: 0.0 for s in symbols}
    # Apply trades before the window first.
    while ti < len(trades) and trades[ti].trade_date.date() < start:
        t = trades[ti]
        qty[t.symbol] += float(t.quantity) if t.trade_type == "BUY" else -float(t.quantity)
        ti += 1

    day = start
    today = dt.date.today()
    while day <= today:
        while ti < len(trades) and trades[ti].trade_date.date() <= day:
            t = trades[ti]
            qty[t.symbol] += float(t.quantity) if t.trade_type == "BUY" else -float(t.quantity)
            ti += 1
        value = 0.0
        priced = False
        for s in symbols:
            if qty[s] > 0:
                c = close_on_or_before(s, day)
                if c is not None:
                    value += qty[s] * c
                    priced = True
        if priced:
            history.append({"date": day.isoformat(), "value": round(value, 2)})
        day += dt.timedelta(days=1)

    return {"status": "success", "history": history}
