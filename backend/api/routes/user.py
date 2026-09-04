from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from core.database import get_pg_db, get_mongo_db
from core.session import get_or_create_user_uuid
from models.models import UserProfile

router = APIRouter()

@router.get("/bootstrap")
async def bootstrap_user(request: Request, response: Response, pg_db: AsyncSession = Depends(get_pg_db), mongo_db = Depends(get_mongo_db)):
    user_uuid = get_or_create_user_uuid(request, response)
    
    result = await pg_db.execute(select(UserProfile).where(UserProfile.id == user_uuid))
    user_profile = result.scalars().first()
    
    saved_location = None
    if user_profile and user_profile.last_location:
        saved_location = {"name": user_profile.last_location, "lat": user_profile.last_latitude, "lon": user_profile.last_longitude}
        
    chat_history = []
    if mongo_db is not None:
        cursor = mongo_db["chat_history"].find({"user_id": user_uuid}).sort("created_at", 1)
        async for doc in cursor:
            chat_history.append({"query": doc.get("query"), "response": doc.get("response"), "mode": doc.get("mode", "detailed")})
            
    return {"status": "success", "user_id": user_uuid, "saved_location": saved_location, "chat_history": chat_history}