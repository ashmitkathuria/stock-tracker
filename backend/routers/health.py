from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session
from database import get_db, verify_db_connection

router = APIRouter(prefix="/health", tags=["health"])

@router.get("")
async def health_check():
    """Basic health check"""
    return {
        "status": "healthy",
        "service": "stock-tracker-api",
        "version": "0.1.0"
    }

@router.get("/db")
async def database_health(db: Session = Depends(get_db)):
    """Check database connection"""
    try:
        db.execute(text("SELECT 1"))
        return {
            "status": "healthy",
            "database": "connected"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(e)
        }
