import asyncio
from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from core.database import get_pg_db
from core.session import get_or_create_user_uuid
from models.models import UserProfile, WeatherSnapshot, DisasterWarningRecord
from services.weather_service import get_aggregated_weather
from services.alert_service import get_all_active_alerts

router = APIRouter()

@router.get("/current")
async def get_current_weather(
    request: Request, response: Response, 
    lat: float = 30.3165, lon: float = 78.0322, location: str = "Dehradun", 
    pg_db: AsyncSession = Depends(get_pg_db)
):
    user_uuid = get_or_create_user_uuid(request, response)
    
    weather_data, alerts = await asyncio.gather(
        get_aggregated_weather(lat, lon, location),
        get_all_active_alerts(location, lat, lon)
    )
    weather_data["alerts"] = alerts

    # PostgreSQL Persistence
    res = await pg_db.execute(select(UserProfile).where(UserProfile.id == user_uuid))
    profile = res.scalars().first()
    if not profile:
        profile = UserProfile(id=user_uuid, last_location=location, last_latitude=lat, last_longitude=lon)
        pg_db.add(profile)
    else:
        profile.last_location, profile.last_latitude, profile.last_longitude = location, lat, lon

    snapshot = WeatherSnapshot(
        user_id=user_uuid, location_name=location, temperature=weather_data.get("temperature", 0.0),
        feels_like=weather_data.get("feels_like", 0.0), humidity=weather_data.get("humidity", 0),
        wind_speed=weather_data.get("wind_speed", 0.0), pressure=weather_data.get("pressure", 1013),
        uv_index=weather_data.get("uv_index", 1.0), aqi=weather_data.get("aqi", 50), condition=weather_data.get("condition", "Clear")
    )
    pg_db.add(snapshot)

    for alert in alerts:
        pg_db.add(DisasterWarningRecord(
            user_id=user_uuid, location_name=location, title=alert.get("title", ""),
            description=alert.get("description", ""), severity=alert.get("severity", "Moderate"), source=alert.get("source", "IMD")
        ))
    
    await pg_db.commit()
    return {"status": "success", "data": weather_data}