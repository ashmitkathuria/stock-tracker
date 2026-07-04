import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from pytz import timezone
from datetime import datetime
from config import settings
from fetchers.stock_fetcher import fetch_stock_price
from database import SessionLocal

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler()

def scheduled_fetch_prices():
    """Scheduled job to fetch stock prices daily"""
    db = None
    try:
        logger.info(f"[SCHEDULER] Starting daily price fetch at {datetime.now()}")

        # Get all stocks in watchlist
        db = SessionLocal()
        from models import Watchlist

        stocks = db.query(Watchlist.symbol).distinct().all()
        stock_list = [s[0] for s in stocks]

        if not stock_list:
            logger.info("[SCHEDULER] No stocks in watchlist, skipping")
            return

        logger.info(f"[SCHEDULER] Fetching prices for {len(stock_list)} stocks: {stock_list}")

        for symbol in stock_list:
            try:
                result = fetch_stock_price(symbol, "NSE", db)
                logger.info(f"[SCHEDULER] {symbol}: {result['status']}")
            except Exception as e:
                logger.error(f"[SCHEDULER] Error fetching {symbol}: {str(e)}")

        logger.info("[SCHEDULER] Daily price fetch completed")

    except Exception as e:
        logger.error(f"[SCHEDULER] Error in scheduled_fetch_prices: {str(e)}")

    finally:
        if db is not None:
            db.close()

def _watchlist_symbols(db):
    from models import Watchlist
    return [s[0] for s in db.query(Watchlist.symbol).distinct().all()]

def scheduled_refresh_predictions():
    """Daily job: inference-only prediction refresh per watchlist symbol
    (deep-backfills lazily for thin symbols; trains only if no artifact)"""
    db = None
    try:
        logger.info(f"[SCHEDULER] Starting prediction refresh at {datetime.now()}")
        db = SessionLocal()
        from ml.predictor import _ensure_history, train_and_predict

        symbols = _watchlist_symbols(db)
        if not symbols:
            logger.info("[SCHEDULER] No stocks in watchlist, skipping predictions")
            return

        for idx in ("NIFTY50", "INDIAVIX"):
            try:
                _ensure_history(db, idx)
            except Exception as e:
                logger.error(f"[SCHEDULER] Error backfilling index {idx}: {str(e)}")

        for symbol in symbols:
            try:
                _ensure_history(db, symbol)
                result = train_and_predict(symbol, db=db)
                logger.info(f"[SCHEDULER] Prediction {symbol}: {result['status']}")
            except Exception as e:
                logger.error(f"[SCHEDULER] Error predicting {symbol}: {str(e)}")

        logger.info("[SCHEDULER] Prediction refresh completed")
    except Exception as e:
        logger.error(f"[SCHEDULER] Error in scheduled_refresh_predictions: {str(e)}")
    finally:
        if db is not None:
            db.close()

def scheduled_score_outcomes():
    """Daily job: score yesterday's predictions against realized direction"""
    try:
        logger.info(f"[SCHEDULER] Starting outcome scoring at {datetime.now()}")
        from ml.outcomes import score_pending_outcomes
        result = score_pending_outcomes()
        logger.info(f"[SCHEDULER] Outcomes: {result}")
    except Exception as e:
        logger.error(f"[SCHEDULER] Error in scheduled_score_outcomes: {str(e)}")

def scheduled_weekly_training():
    """Weekly job: retrain the global model and refresh the disk artifact"""
    try:
        logger.info(f"[SCHEDULER] Starting weekly model training at {datetime.now()}")
        from ml.predictor import invalidate_model_cache, train_global_model
        result = train_global_model()
        if result.get("status") == "success":
            invalidate_model_cache()
            logger.info(f"[SCHEDULER] Weekly training done: {result['n_rows']} rows, "
                        f"{result['seconds']}s, backend={result['backend']}")
        else:
            logger.error(f"[SCHEDULER] Weekly training failed: {result.get('message')}")
    except Exception as e:
        logger.error(f"[SCHEDULER] Error in scheduled_weekly_training: {str(e)}")

def scheduled_fetch_news():
    """Daily job: fetch and score news per watchlist symbol"""
    db = None
    try:
        logger.info(f"[SCHEDULER] Starting news fetch at {datetime.now()}")
        db = SessionLocal()
        from fetchers.news_fetcher import fetch_news_for_symbol

        symbols = _watchlist_symbols(db)
        if not symbols:
            logger.info("[SCHEDULER] No stocks in watchlist, skipping news")
            return

        for symbol in symbols:
            try:
                result = fetch_news_for_symbol(symbol, db=db)
                logger.info(f"[SCHEDULER] News {symbol}: {result['status']}")
            except Exception as e:
                logger.error(f"[SCHEDULER] Error fetching news for {symbol}: {str(e)}")

        logger.info("[SCHEDULER] News fetch completed")
    except Exception as e:
        logger.error(f"[SCHEDULER] Error in scheduled_fetch_news: {str(e)}")
    finally:
        if db is not None:
            db.close()

def scheduled_fetch_sectors():
    """Daily job: refresh sector index performance"""
    try:
        logger.info(f"[SCHEDULER] Starting sector fetch at {datetime.now()}")
        from fetchers.sector_fetcher import fetch_sector_performance
        result = fetch_sector_performance()
        logger.info(f"[SCHEDULER] Sectors: {len(result.get('success', []))} ok, {len(result.get('failed', []))} failed")
    except Exception as e:
        logger.error(f"[SCHEDULER] Error in scheduled_fetch_sectors: {str(e)}")

def start_scheduler():
    """Start the background scheduler"""
    if not settings.enable_scheduler:
        logger.info("Scheduler disabled via settings")
        return

    if scheduler.running:
        logger.info("Scheduler already running")
        return

    try:
        # Add daily price fetch job
        tz = timezone(settings.fetch_stocks_timezone)

        scheduler.add_job(
            scheduled_fetch_prices,
            trigger=CronTrigger(
                hour=settings.fetch_stocks_hour,
                minute=settings.fetch_stocks_minute,
                timezone=tz
            ),
            id="daily_price_fetch",
            name="Daily Stock Price Fetcher",
            replace_existing=True,
            misfire_grace_time=300  # 5 minutes grace
        )

        # Outcome scoring at 16:05 IST (right after prices land)
        scheduler.add_job(
            scheduled_score_outcomes,
            trigger=CronTrigger(hour=16, minute=5, timezone=tz),
            id="daily_outcome_scoring",
            name="Daily Prediction Outcome Scorer",
            replace_existing=True,
            misfire_grace_time=300
        )

        # Weekly global model retrain, Sunday 10:00 IST (market closed)
        scheduler.add_job(
            scheduled_weekly_training,
            trigger=CronTrigger(day_of_week="sun", hour=10, minute=0, timezone=tz),
            id="weekly_model_training",
            name="Weekly ML Model Training",
            replace_existing=True,
            misfire_grace_time=3600
        )

        # Sector performance at 16:15 IST
        scheduler.add_job(
            scheduled_fetch_sectors,
            trigger=CronTrigger(hour=16, minute=15, timezone=tz),
            id="daily_sector_fetch",
            name="Daily Sector Performance Fetcher",
            replace_existing=True,
            misfire_grace_time=300
        )

        # ML predictions at 16:30 IST (after prices have landed)
        scheduler.add_job(
            scheduled_refresh_predictions,
            trigger=CronTrigger(hour=16, minute=30, timezone=tz),
            id="daily_prediction_refresh",
            name="Daily ML Prediction Refresher",
            replace_existing=True,
            misfire_grace_time=300
        )

        # News + sentiment at 17:00 IST
        scheduler.add_job(
            scheduled_fetch_news,
            trigger=CronTrigger(hour=17, minute=0, timezone=tz),
            id="daily_news_fetch",
            name="Daily News Fetcher",
            replace_existing=True,
            misfire_grace_time=300
        )

        scheduler.start()
        logger.info(f"[SCHEDULER] Started with 6 jobs: prices {settings.fetch_stocks_hour}:{settings.fetch_stocks_minute:02d}, outcomes 16:05, sectors 16:15, predictions 16:30, news 17:00, weekly training Sun 10:00 ({settings.fetch_stocks_timezone})")

    except Exception as e:
        logger.error(f"[SCHEDULER] Error starting scheduler: {str(e)}")

def stop_scheduler():
    """Stop the background scheduler"""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("[SCHEDULER] Stopped")
