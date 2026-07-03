import os
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Database
    database_url: str = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/stock_tracker")

    # API Keys
    newsapi_key: Optional[str] = os.getenv("NEWSAPI_KEY")
    alpha_vantage_key: Optional[str] = os.getenv("ALPHA_VANTAGE_KEY")

    # Security
    jwt_secret: str = os.getenv("JWT_SECRET", "dev-secret-change-in-production")

    # Application
    environment: str = os.getenv("ENVIRONMENT", "development")
    log_level: str = os.getenv("LOG_LEVEL", "INFO")
    # Railway/Heroku-style platforms inject PORT; fall back to API_PORT locally
    api_port: int = int(os.getenv("PORT", os.getenv("API_PORT", "8000")))

    # Scheduler
    enable_scheduler: bool = os.getenv("ENABLE_SCHEDULER", "true").lower() == "true"
    fetch_stocks_hour: int = int(os.getenv("FETCH_STOCKS_HOUR", "16"))
    fetch_stocks_minute: int = int(os.getenv("FETCH_STOCKS_MINUTE", "0"))
    fetch_stocks_timezone: str = os.getenv("FETCH_STOCKS_TIMEZONE", "Asia/Kolkata")

    class Config:
        env_file = ".env"
        case_sensitive = False

settings = Settings()
