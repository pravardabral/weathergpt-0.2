from fastapi import APIRouter, Depends, Request, Response, HTTPException
from models.schemas import ChatPayload
from services.ai_service import get_fast_response, get_detailed_response
from core.database import get_mongo_db
from core.session import get_or_create_user_uuid
from core.logger import logger

router = APIRouter()

@router.post("")
async def chat_endpoint(payload: ChatPayload):
    try:
        if payload.mode == "fast":
            ai_response = await get_fast_response(
                query=payload.query, lat=payload.latitude, lon=payload.longitude, location_name=payload.location_name
            )
        else:
            ai_response = await get_detailed_response(
                query=payload.query, lat=payload.latitude, lon=payload.longitude, location_name=payload.location_name
            )
        return {"response": ai_response}
    except Exception as e:
        logger.exception("AI Generation Failed")
        raise HTTPException(status_code=500, detail="Failed to generate AI response.")

@router.get("/history")
async def get_history(request: Request, response: Response, mongo_db = Depends(get_mongo_db)):
    user_uuid = get_or_create_user_uuid(request, response)
    history = []
    if mongo_db is not None:
        cursor = mongo_db["chat_history"].find({"user_id": user_uuid}).sort("created_at", 1)
        async for doc in cursor:
            history.append({"query": doc.get("query"), "response": doc.get("response"), "mode": doc.get("mode", "detailed")})
    return {"status": "success", "history": history}

@router.delete("/history")
async def clear_history(request: Request, response: Response, mongo_db = Depends(get_mongo_db)):
    user_uuid = get_or_create_user_uuid(request, response)
    if mongo_db is not None:
        await mongo_db["chat_history"].delete_many({"user_id": user_uuid})
    return {"status": "success", "message": "User chat history cleared"}