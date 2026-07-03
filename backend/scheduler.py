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

        scheduler.start()
        logger.info(f"[SCHEDULER] Started. Next run at {settings.fetch_stocks_hour}:{settings.fetch_stocks_minute:02d} {settings.fetch_stocks_timezone}")

    except Exception as e:
        logger.error(f"[SCHEDULER] Error starting scheduler: {str(e)}")

def stop_scheduler():
    """Stop the background scheduler"""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("[SCHEDULER] Stopped")
