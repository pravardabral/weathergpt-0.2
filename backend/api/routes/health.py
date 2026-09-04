from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_pg_db, get_mongo_db

router = APIRouter()

@router.get("/db")
async def check_db_health(pg_db: AsyncSession = Depends(get_pg_db), mongo_db = Depends(get_mongo_db)):
    return {"postgres_connected": pg_db.is_active, "mongodb_connected": mongo_db is not None}