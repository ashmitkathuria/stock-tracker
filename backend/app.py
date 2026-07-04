import logging
import os
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from config import settings
from database import init_db, verify_db_connection
from scheduler import start_scheduler, stop_scheduler
from routers import admin, auth, health, news, portfolio, predictions, sectors, stocks, watchlist

# Configure logging
logging.basicConfig(
    level=settings.log_level,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Stock Market Tracker API",
    description="AI-powered stock analysis and predictions",
    version="0.1.0"
)

# CORS middleware
# Set FRONTEND_URL in production (e.g. https://your-app.vercel.app) to
# whitelist the deployed frontend without a code change.
allowed_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
]
if os.getenv("FRONTEND_URL"):
    allowed_origins.append(os.getenv("FRONTEND_URL").rstrip("/"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handlers
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )

# Startup and shutdown events
@app.on_event("startup")
async def startup_event():
    logger.info("Starting Stock Market Tracker API...")

    # Initialize database
    try:
        init_db()
        logger.info("Database initialized")
    except Exception as e:
        logger.error(f"Database initialization failed: {str(e)}")
        raise

    # Verify database connection
    if not verify_db_connection():
        logger.error("Database connection verification failed")
        raise Exception("Cannot connect to database")

    # Start scheduler
    start_scheduler()

    logger.info("Startup complete")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Shutting down Stock Market Tracker API...")
    stop_scheduler()
    logger.info("Shutdown complete")

# Include routers
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(watchlist.router)
app.include_router(portfolio.router)
app.include_router(stocks.router)
app.include_router(predictions.router)
app.include_router(news.router)
app.include_router(sectors.router)
app.include_router(admin.router)

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Stock Market Tracker API",
        "version": "0.1.0",
        "docs": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=settings.api_port,
        reload=(settings.environment == "development")
    )
