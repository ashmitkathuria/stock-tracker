from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey, Numeric, Date, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    preferences = Column(Text, default='{"theme": "light", "notifications": true}')

    # Relationships
    watchlist = relationship("Watchlist", back_populates="user", cascade="all, delete-orphan")
    portfolio = relationship("Portfolio", back_populates="user", cascade="all, delete-orphan")
    trades = relationship("Trade", back_populates="user", cascade="all, delete-orphan")

class Watchlist(Base):
    __tablename__ = "watchlist"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    symbol = Column(String(10), nullable=False, index=True)
    added_date = Column(DateTime, server_default=func.now())
    alert_price_up = Column(Numeric(10, 2))
    alert_price_down = Column(Numeric(10, 2))
    notes = Column(Text)

    __table_args__ = (
        UniqueConstraint("user_id", "symbol", name="uq_user_symbol"),
        Index("idx_user_symbol", "user_id", "symbol"),
    )

    # Relationships
    user = relationship("User", back_populates="watchlist")

class Portfolio(Base):
    __tablename__ = "portfolio"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    symbol = Column(String(10), nullable=False, index=True)
    quantity = Column(Numeric(10, 4), nullable=False)
    avg_cost = Column(Numeric(10, 2), nullable=False)
    purchase_date = Column(DateTime, nullable=False)
    notes = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="portfolio")

class Trade(Base):
    __tablename__ = "trades"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    symbol = Column(String(10), nullable=False, index=True)
    quantity = Column(Numeric(10, 4), nullable=False)
    price = Column(Numeric(10, 2), nullable=False)
    trade_type = Column(String(4), nullable=False)  # BUY or SELL
    trade_date = Column(DateTime, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="trades")

class StockPrice(Base):
    __tablename__ = "stock_prices"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(10), nullable=False, index=True)
    date = Column(Date, nullable=False)
    open = Column(Numeric(10, 2))
    high = Column(Numeric(10, 2))
    low = Column(Numeric(10, 2))
    close = Column(Numeric(10, 2), nullable=False)
    volume = Column(Integer)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("symbol", "date", name="uq_symbol_date"),
        Index("idx_symbol_date", "symbol", "date"),
    )

class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(10), nullable=False, index=True)
    prediction_date = Column(Date, nullable=False)
    signal = Column(String(5), nullable=False)  # UP or DOWN
    confidence = Column(Numeric(3, 2))
    prob_up = Column(Numeric(3, 2))
    volatility_forecast = Column(Numeric(5, 4))
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("symbol", "prediction_date", name="uq_symbol_pred_date"),
        Index("idx_symbol_pred_date", "symbol", "prediction_date"),
    )

class News(Base):
    __tablename__ = "news"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(10), nullable=False, index=True)
    headline = Column(String(255), nullable=False)
    url = Column(Text, nullable=False, unique=True)
    source = Column(String(100))
    sentiment_score = Column(Numeric(3, 2))  # -1 to 1
    published_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        # Index names are database-global in Postgres; "idx_symbol_date" is
        # already taken by stock_prices, so this one gets its own name.
        Index("idx_news_symbol_published", "symbol", "published_at"),
    )

class GSecYield(Base):
    __tablename__ = "gsec_yields"

    id = Column(Integer, primary_key=True, index=True)
    maturity = Column(String(10), nullable=False)  # 1Y, 5Y, 10Y
    yield_pct = Column(Numeric(5, 3), nullable=False)
    date = Column(Date, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("maturity", "date", name="uq_maturity_date"),
        Index("idx_maturity_date", "maturity", "date"),
    )

class SectorPerformance(Base):
    __tablename__ = "sector_performance"

    id = Column(Integer, primary_key=True, index=True)
    sector = Column(String(50), nullable=False, index=True)
    date = Column(Date, nullable=False)
    return_pct = Column(Numeric(5, 3))
    index_value = Column(Numeric(10, 2))
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("sector", "date", name="uq_sector_date"),
        Index("idx_sector_date", "sector", "date"),
    )

class IPO(Base):
    __tablename__ = "ipos"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String(255), nullable=False)
    symbol = Column(String(10), index=True)
    sector = Column(String(50))
    issue_size_cr = Column(Numeric(10, 2))
    price_band_min = Column(Numeric(10, 2))
    price_band_max = Column(Numeric(10, 2))
    open_date = Column(Date)
    close_date = Column(Date)
    listing_date = Column(Date)
    subscription_ratio = Column(Numeric(10, 2))
    notes = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
