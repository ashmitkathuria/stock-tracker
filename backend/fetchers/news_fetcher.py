"""
Fetch recent headlines per symbol from NewsAPI, score sentiment with VADER,
and store them deduplicated by URL.
"""
import logging
from datetime import datetime
from decimal import Decimal

import requests
from sqlalchemy.orm import Session
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

from config import settings
from database import SessionLocal
from models import News

logger = logging.getLogger(__name__)

NEWSAPI_URL = "https://newsapi.org/v2/everything"

_analyzer = SentimentIntensityAnalyzer()


def _parse_published(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        return None


def fetch_news_for_symbol(symbol: str, db: Session = None, page_size: int = 20) -> dict:
    """
    Fetch and store recent headlines for one symbol.

    Returns dict with status and number of new articles stored.
    """
    if not settings.newsapi_key:
        return {"status": "error", "symbol": symbol, "message": "NEWSAPI_KEY not configured"}

    owns_session = db is None
    if owns_session:
        db = SessionLocal()

    try:
        resp = requests.get(
            NEWSAPI_URL,
            params={
                "q": f'"{symbol}" AND (NSE OR stock OR shares)',
                "language": "en",
                "sortBy": "publishedAt",
                "pageSize": page_size,
                "apiKey": settings.newsapi_key,
            },
            timeout=15,
        )
        resp.raise_for_status()
        payload = resp.json()
        articles = payload.get("articles", [])

        stored = 0
        for art in articles:
            url = art.get("url")
            headline = (art.get("title") or "").strip()
            published_at = _parse_published(art.get("publishedAt"))
            if not url or not headline or published_at is None:
                continue
            if db.query(News.id).filter(News.url == url).first():
                continue
            score = _analyzer.polarity_scores(headline)["compound"]
            db.add(News(
                symbol=symbol,
                headline=headline[:255],
                url=url,
                source=(art.get("source") or {}).get("name"),
                sentiment_score=Decimal(str(round(score, 2))),
                published_at=published_at,
            ))
            stored += 1

        db.commit()
        logger.info(f"[NEWS] {symbol}: {stored} new articles stored ({len(articles)} fetched)")
        return {"status": "success", "symbol": symbol, "fetched": len(articles), "stored": stored}

    except Exception as e:
        db.rollback()
        logger.error(f"[NEWS] Error fetching news for {symbol}: {str(e)}")
        return {"status": "error", "symbol": symbol, "message": str(e)}

    finally:
        if owns_session:
            db.close()
