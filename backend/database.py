import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import NullPool
from config import settings

logger = logging.getLogger(__name__)

# Create engine
engine = create_engine(
    settings.database_url,
    poolclass=NullPool,  # Better for serverless
    echo=False,
)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()

def get_db():
    """Dependency injection for database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Additive-only migrations for tables that create_all won't alter.
# Each statement runs in its own transaction and failures are non-fatal
# (e.g. column already exists on sqlite, which lacks IF NOT EXISTS).
_MIGRATIONS = [
    "ALTER TABLE predictions ALTER COLUMN signal TYPE VARCHAR(10)",  # NEUTRAL needs >5 chars (Postgres only)
    "ALTER TABLE predictions ADD COLUMN IF NOT EXISTS signal_5d VARCHAR(10)",
    "ALTER TABLE predictions ADD COLUMN IF NOT EXISTS prob_up_5d NUMERIC(3, 2)",
]

def _run_migrations():
    for stmt in _MIGRATIONS:
        try:
            with engine.begin() as connection:
                connection.execute(text(stmt))
        except Exception as e:
            logger.debug(f"Migration skipped ({stmt}): {str(e)}")

def init_db():
    """Initialize database - create all tables"""
    try:
        logger.info("Creating database tables...")
        Base.metadata.create_all(bind=engine)
        _run_migrations()
        logger.info("Database initialization complete")
    except Exception as e:
        logger.error(f"Error initializing database: {str(e)}")
        raise

def verify_db_connection():
    """Verify database connection is working"""
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        logger.info("Database connection verified")
        return True
    except Exception as e:
        logger.error(f"Database connection failed: {str(e)}")
        return False
