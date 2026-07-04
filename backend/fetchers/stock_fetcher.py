import logging
import yfinance as yf
from datetime import datetime, timedelta
from decimal import Decimal
from sqlalchemy.orm import Session
from models import StockPrice
from database import SessionLocal

logger = logging.getLogger(__name__)

def fetch_stock_price(symbol: str, exchange: str = "NSE", db: Session = None) -> dict:
    """
    Fetch latest stock price from yfinance and store in database.

    Args:
        symbol: Stock symbol (e.g., "RELIANCE", "INFY")
        exchange: Exchange code (NSE, BSE)
        db: Database session

    Returns:
        dict with status, data, and error message if any
    """
    # Only close the session on exit if we created it here; callers that pass
    # a session (scheduler, batch fetch) reuse it across symbols.
    owns_session = db is None
    if owns_session:
        db = SessionLocal()

    try:
        # Add exchange suffix for yfinance
        yf_symbol = f"{symbol}.{'BO' if exchange == 'BSE' else 'NS'}"

        logger.info(f"Fetching price for {symbol} ({exchange})")

        # Download 1 day of data (flat columns — yfinance defaults to a
        # MultiIndex keyed by ticker, which breaks scalar access below)
        data = yf.download(yf_symbol, period="1d", progress=False, multi_level_index=False)

        if data.empty:
            logger.warning(f"No data found for {yf_symbol}")
            return {
                "status": "error",
                "message": f"No data found for {symbol}",
                "symbol": symbol
            }

        # Extract latest day
        latest = data.iloc[-1]
        today = datetime.now().date()

        # Check if already exists
        existing = db.query(StockPrice).filter(
            StockPrice.symbol == symbol,
            StockPrice.date == today
        ).first()

        if existing:
            # Update existing record
            existing.open = Decimal(str(latest['Open']))
            existing.high = Decimal(str(latest['High']))
            existing.low = Decimal(str(latest['Low']))
            existing.close = Decimal(str(latest['Close']))
            existing.volume = int(latest['Volume'])
            db.commit()
            logger.info(f"Updated price for {symbol}: {latest['Close']}")
        else:
            # Create new record
            stock_price = StockPrice(
                symbol=symbol,
                date=today,
                open=Decimal(str(latest['Open'])),
                high=Decimal(str(latest['High'])),
                low=Decimal(str(latest['Low'])),
                close=Decimal(str(latest['Close'])),
                volume=int(latest['Volume'])
            )
            db.add(stock_price)
            db.commit()
            logger.info(f"Inserted price for {symbol}: {latest['Close']}")

        return {
            "status": "success",
            "symbol": symbol,
            "price": float(latest['Close']),
            "date": today.isoformat(),
            "volume": int(latest['Volume'])
        }

    except Exception as e:
        db.rollback()
        logger.error(f"Error fetching {symbol}: {str(e)}")
        return {
            "status": "error",
            "symbol": symbol,
            "message": str(e)
        }

    finally:
        if owns_session:
            db.close()

def fetch_historical_data(symbol: str, exchange: str = "NSE", days: int = 365) -> dict:
    """
    Fetch historical data for a stock (for backtesting/analysis).

    Args:
        symbol: Stock symbol
        exchange: Exchange code
        days: Number of days to fetch

    Returns:
        dict with status and data
    """
    try:
        yf_symbol = f"{symbol}.{'BO' if exchange == 'BSE' else 'NS'}"

        logger.info(f"Fetching {days} days of history for {symbol}")

        data = yf.download(yf_symbol, period=f"{days}d", progress=False, multi_level_index=False)

        if data.empty:
            return {"status": "error", "message": f"No historical data for {symbol}"}

        # Convert to dict format
        history = []
        for date, row in data.iterrows():
            history.append({
                "date": date.strftime("%Y-%m-%d"),
                "open": float(row['Open']),
                "high": float(row['High']),
                "low": float(row['Low']),
                "close": float(row['Close']),
                "volume": int(row['Volume'])
            })

        return {
            "status": "success",
            "symbol": symbol,
            "data_points": len(history),
            "data": history
        }

    except Exception as e:
        logger.error(f"Error fetching historical data for {symbol}: {str(e)}")
        return {
            "status": "error",
            "symbol": symbol,
            "message": str(e)
        }

# Market-context index series stored in stock_prices under friendly symbols
INDEX_TICKERS = {
    "NIFTY50": "^NSEI",
    "INDIAVIX": "^INDIAVIX",
}

def _to_yf_symbol(symbol: str, exchange: str = "NSE") -> str:
    if symbol in INDEX_TICKERS:
        return INDEX_TICKERS[symbol]
    return f"{symbol}.{'BO' if exchange == 'BSE' else 'NS'}"

def backfill_history(symbol: str, exchange: str = "NSE", days: int = None,
                     period: str = "10y", db: Session = None, chunk_size: int = 500) -> dict:
    """
    Backfill daily OHLCV history into stock_prices, upserting on (symbol, date).

    Args:
        symbol: Stock symbol (or NIFTY50 / INDIAVIX index aliases)
        exchange: Exchange code
        days: Calendar days of history (overrides period when given)
        period: yfinance period string, default 10 years
        db: Database session (reused if provided)
        chunk_size: rows per commit to keep transactions small

    Returns:
        dict with status and counts of inserted/updated rows
    """
    owns_session = db is None
    if owns_session:
        db = SessionLocal()

    try:
        yf_symbol = _to_yf_symbol(symbol, exchange)
        yf_period = f"{days}d" if days else period
        logger.info(f"Backfilling {yf_period} of history for {symbol}")

        data = yf.download(yf_symbol, period=yf_period, progress=False, multi_level_index=False)

        if data.empty:
            return {"status": "error", "symbol": symbol, "message": f"No historical data for {symbol}"}

        dates = [d.date() for d in data.index]
        existing_dates = {
            row.date for row in db.query(StockPrice.date).filter(
                StockPrice.symbol == symbol,
                StockPrice.date >= min(dates),
                StockPrice.date <= max(dates),
            ).all()
        }

        inserted = updated = pending = 0
        for date, row in data.iterrows():
            day = date.date()
            close = row['Close']
            if close != close:  # NaN row (holiday padding etc.)
                continue
            values = {
                "open": Decimal(str(round(float(row['Open']), 2))),
                "high": Decimal(str(round(float(row['High']), 2))),
                "low": Decimal(str(round(float(row['Low']), 2))),
                "close": Decimal(str(round(float(close), 2))),
                "volume": int(row['Volume']) if row['Volume'] == row['Volume'] else None,
            }
            if day in existing_dates:
                db.query(StockPrice).filter(
                    StockPrice.symbol == symbol, StockPrice.date == day
                ).update(values)
                updated += 1
            else:
                db.add(StockPrice(symbol=symbol, date=day, **values))
                inserted += 1
            pending += 1
            if pending >= chunk_size:
                db.commit()
                pending = 0

        db.commit()
        logger.info(f"Backfill {symbol}: {inserted} inserted, {updated} updated")
        return {"status": "success", "symbol": symbol, "inserted": inserted, "updated": updated}

    except Exception as e:
        db.rollback()
        logger.error(f"Error backfilling {symbol}: {str(e)}")
        return {"status": "error", "symbol": symbol, "message": str(e)}

    finally:
        if owns_session:
            db.close()

def fetch_multiple_stocks(symbols: list, exchange: str = "NSE") -> dict:
    """
    Fetch prices for multiple stocks.

    Args:
        symbols: List of stock symbols
        exchange: Exchange code

    Returns:
        dict with results for each symbol
    """
    db = SessionLocal()
    try:
        results = {
            "success": [],
            "failed": []
        }

        for symbol in symbols:
            result = fetch_stock_price(symbol, exchange, db)
            if result["status"] == "success":
                results["success"].append(result)
            else:
                results["failed"].append(result)

        return results
    finally:
        db.close()
