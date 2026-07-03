import os
import sys
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging early
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def main():
    """Main entry point"""
    logger.info("Starting Stock Market Tracker Backend...")

    # Import after env loaded
    from database import init_db, verify_db_connection
    import uvicorn

    # Initialize database
    try:
        logger.info("Initializing database...")
        init_db()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize database: {str(e)}")
        sys.exit(1)

    # Verify connection
    if not verify_db_connection():
        logger.error("Cannot connect to database")
        sys.exit(1)

    # Start API server (the app's startup event starts the scheduler;
    # reload mode needs the import-string form, not the app object)
    logger.info("Starting API server...")
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=int(os.getenv("API_PORT", "8000")),
        reload=(os.getenv("ENVIRONMENT", "development") == "development")
    )

if __name__ == "__main__":
    main()
