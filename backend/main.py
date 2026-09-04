import re
from fastapi import FastAPI, Depends, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from motor.motor_asyncio import AsyncIOMotorClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import datetime, timezone
import asyncio
import traceback
from typing import List, Dict

# Core imports
from core.schemas import ChatPayload
from core.gemini import get_fast_response, get_detailed_response
from core.weather import get_aggregated_weather
from core.alerts import get_all_active_alerts, active_webhooks
from core.session import get_or_create_user_uuid

# Database & Models
from core.database import postgres_engine, Base, mongodb, get_mongo_db, get_pg_db
from core.models import UserProfile, WeatherSnapshot, DisasterWarningRecord
from core.config import MONGODB_URL, MONGODB_NAME


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Initialize PostgreSQL tables
    async with postgres_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    # 2. Initialize MongoDB client
    mongodb.client = AsyncIOMotorClient(MONGODB_URL)
    mongodb.db = mongodb.client[MONGODB_NAME]
    print("Database connections initialized (PostgreSQL + MongoDB).")

    yield

    await postgres_engine.dispose()
    mongodb.client.close()
    print("Database connections closed.")


app = FastAPI(title="WeatherGPT Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?:\/\/.*$", # Dynamically allows all incoming IPs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================
# 1. Bootstrap: Pre-load User State on Visit
# ==========================================
@app.get("/api/user/bootstrap")
async def bootstrap_user(
    request: Request,
    response: Response,
    pg_db: AsyncSession = Depends(get_pg_db),
    mongo_db = Depends(get_mongo_db)
):
    """
    Called when the user loads the app. Pre-loads saved location,
    telemetry, and full MongoDB chat history using the cookie.
    """
    user_uuid = get_or_create_user_uuid(request, response)

    # 1. Fetch user from PostgreSQL
    result = await pg_db.execute(select(UserProfile).where(UserProfile.id == user_uuid))
    user_profile = result.scalars().first()

    saved_location = None
    if user_profile and user_profile.last_location:
        saved_location = {
            "name": user_profile.last_location,
            "lat": user_profile.last_latitude,
            "lon": user_profile.last_longitude
        }

    # 2. Fetch Chat History from MongoDB
    chat_history = []
    if mongo_db is not None:
        cursor = mongo_db["chat_history"].find({"user_id": user_uuid}).sort("created_at", 1)
        async for doc in cursor:
            chat_history.append({
                "query": doc.get("query"),
                "response": doc.get("response"),
                "mode": doc.get("mode", "detailed")
            })

    return {
        "status": "success",
        "user_id": user_uuid,
        "saved_location": saved_location,
        "chat_history": chat_history
    }


# ==========================================
# 2. Weather & Warning Aggregation + Postgres
# ==========================================
@app.get("/api/weather/current")
async def get_current_weather(
    request: Request,
    response: Response,
    lat: float = 30.3165,
    lon: float = 78.0322,
    location: str = "Dehradun",
    pg_db: AsyncSession = Depends(get_pg_db)
):
    user_uuid = get_or_create_user_uuid(request, response)

    # Concurrently aggregate weather and warnings
    weather_data, alerts = await asyncio.gather(
        get_aggregated_weather(lat, lon, location),
        get_all_active_alerts(location, lat, lon)
    )
    weather_data["alerts"] = alerts

    # --- PostgreSQL Persistence ---
    # 1. Upsert User Profile
    res = await pg_db.execute(select(UserProfile).where(UserProfile.id == user_uuid))
    profile = res.scalars().first()
    if not profile:
        profile = UserProfile(id=user_uuid, last_location=location, last_latitude=lat, last_longitude=lon)
        pg_db.add(profile)
    else:
        profile.last_location = location
        profile.last_latitude = lat
        profile.last_longitude = lon

    # 2. Log Weather Snapshot
    snapshot = WeatherSnapshot(
        user_id=user_uuid,
        location_name=location,
        temperature=weather_data.get("temperature", 0.0),
        feels_like=weather_data.get("feels_like", 0.0),
        humidity=weather_data.get("humidity", 0),
        wind_speed=weather_data.get("wind_speed", 0.0),
        pressure=weather_data.get("pressure", 1013),
        uv_index=weather_data.get("uv_index", 1.0),
        aqi=weather_data.get("aqi", 50),
        condition=weather_data.get("condition", "Clear")
    )
    pg_db.add(snapshot)

    # 3. Log Active Alerts
    for alert in alerts:
        alert_record = DisasterWarningRecord(
            user_id=user_uuid,
            location_name=location,
            title=alert.get("title", ""),
            description=alert.get("description", ""),
            severity=alert.get("severity", "Moderate"),
            source=alert.get("source", "IMD/NDMA")
        )
        pg_db.add(alert_record)

    await pg_db.commit()
    return {"status": "success", "data": weather_data}


# ==========================================
# 3. Chat Endpoint + MongoDB Persistence
# ==========================================
@app.post("/api/chat")
async def chat_endpoint(payload: ChatPayload):
    try:
        if payload.mode == "fast":
            ai_response = await get_fast_response(
                query=payload.query,
                lat=payload.latitude,
                lon=payload.longitude,
                location_name=payload.location_name
            )
        else:
            ai_response = await get_detailed_response(payload.query)
        return {"response": ai_response}

    except Exception as e:
        traceback.print_exc() # Prints the exact red error trace to Docker logs
        raise HTTPException(status_code=500, detail="Failed to generate AI response.")


# ==========================================
# 4. History Management (MongoDB-backed)
# ==========================================
@app.get("/api/chat/history")
async def get_history(
    request: Request,
    response: Response,
    mongo_db = Depends(get_mongo_db)
):
    user_uuid = get_or_create_user_uuid(request, response)
    history = []
    
    if mongo_db is not None:
        cursor = mongo_db["chat_history"].find({"user_id": user_uuid}).sort("created_at", 1)
        async for doc in cursor:
            history.append({
                "query": doc.get("query"),
                "response": doc.get("response"),
                "mode": doc.get("mode", "detailed")
            })
            
    return {"status": "success", "history": history}


@app.delete("/api/chat/history")
async def clear_history(
    request: Request,
    response: Response,
    mongo_db = Depends(get_mongo_db)
):
    user_uuid = get_or_create_user_uuid(request, response)
    if mongo_db is not None:
        await mongo_db["chat_history"].delete_many({"user_id": user_uuid})
    return {"status": "success", "message": "User chat history cleared"}

# ==========================================
# Database Connection Test Endpoint
# ==========================================
@app.get("/api/health/db")
async def check_db_health(
    pg_db: AsyncSession = Depends(get_pg_db),
    mongo_db = Depends(get_mongo_db)
):
    """
    Test endpoint verifying both DB connections are active.
    """
    return {
        "postgres_connected": pg_db.is_active,
        "mongodb_connected": mongo_db is not None
    }