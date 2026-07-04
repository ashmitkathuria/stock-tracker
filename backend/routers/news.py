from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc
from sqlalchemy.orm import Session

from database import get_db
from models import News

router = APIRouter(prefix="/news", tags=["news"])


@router.get("/{symbol}")
def get_news(symbol: str, limit: int = Query(20, ge=1, le=100), db: Session = Depends(get_db)):
    """Latest stored headlines for a symbol, newest first"""
    symbol = symbol.upper()
    rows = (
        db.query(News)
        .filter(News.symbol == symbol)
        .order_by(desc(News.published_at))
        .limit(limit)
        .all()
    )
    return {
        "status": "success",
        "symbol": symbol,
        "count": len(rows),
        "articles": [{
            "headline": n.headline,
            "url": n.url,
            "source": n.source,
            "sentiment_score": float(n.sentiment_score) if n.sentiment_score is not None else None,
            "published_at": n.published_at.isoformat() if n.published_at else None,
        } for n in rows],
    }
