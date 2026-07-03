from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from database import get_db
from models import StockPrice, Prediction
from fetchers.stock_fetcher import fetch_stock_price, fetch_historical_data
from datetime import datetime, timedelta

router = APIRouter(prefix="/stocks", tags=["stocks"])

@router.get("/{symbol}/price")
async def get_stock_price(symbol: str, db: Session = Depends(get_db)):
    """Get latest price for a stock"""
    try:
        # Get latest price from database
        price = db.query(StockPrice).filter(
            StockPrice.symbol == symbol.upper()
        ).order_by(desc(StockPrice.date)).first()

        if not price:
            return {
                "status": "not_found",
                "symbol": symbol.upper(),
                "message": "No price data available"
            }

        return {
            "status": "success",
            "symbol": symbol.upper(),
            "price": float(price.close),
            "open": float(price.open) if price.open else None,
            "high": float(price.high) if price.high else None,
            "low": float(price.low) if price.low else None,
            "volume": price.volume,
            "date": price.date.isoformat()
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{symbol}/fetch")
async def fetch_stock_price_manual(symbol: str, db: Session = Depends(get_db)):
    """Manually fetch latest price for a stock"""
    try:
        result = fetch_stock_price(symbol.upper(), "NSE", db)
        if result["status"] == "error":
            raise HTTPException(status_code=400, detail=result["message"])
        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{symbol}/history")
async def get_stock_history(
    symbol: str,
    days: int = Query(365, ge=1, le=3650),
    db: Session = Depends(get_db)
):
    """Get historical prices for a stock"""
    try:
        symbol = symbol.upper()
        cutoff_date = datetime.now().date() - timedelta(days=days)

        prices = db.query(StockPrice).filter(
            StockPrice.symbol == symbol,
            StockPrice.date >= cutoff_date
        ).order_by(StockPrice.date).all()

        if not prices:
            return {
                "status": "not_found",
                "symbol": symbol,
                "message": "No historical data available"
            }

        data = [
            {
                "date": p.date.isoformat(),
                "open": float(p.open) if p.open else None,
                "high": float(p.high) if p.high else None,
                "low": float(p.low) if p.low else None,
                "close": float(p.close),
                "volume": p.volume
            }
            for p in prices
        ]

        return {
            "status": "success",
            "symbol": symbol,
            "data_points": len(data),
            "data": data
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
