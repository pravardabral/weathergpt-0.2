import httpx
from core.config import OPENWEATHER_API_KEY
import asyncio
from typing import Dict, Any

async def fetch_open_meteo(lat: float, lon: float, client: httpx.AsyncClient) -> Dict[str, Any]:
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": ["temperature_2m", "relative_humidity_2m", "apparent_temperature", "wind_speed_10m", "surface_pressure"],
        "daily": ["temperature_2m_max", "temperature_2m_min", "uv_index_max"],
        "timezone": "auto"
    }
    try:
        res = await client.get(url, params=params, timeout=5.0)
        if res.status_code == 200:
            data = res.json()
            curr = data.get("current", {})
            daily = data.get("daily", {})
            return {
                "source": "Open-Meteo",
                "temp": curr.get("temperature_2m"),
                "humidity": curr.get("relative_humidity_2m"),
                "feels_like": curr.get("apparent_temperature"),
                "wind_speed": curr.get("wind_speed_10m"),
                "pressure": curr.get("surface_pressure"),
                "temp_max": daily.get("temperature_2m_max", [None])[0],
                "temp_min": daily.get("temperature_2m_min", [None])[0],
                "uv": daily.get("uv_index_max", [None])[0]
            }
    except Exception:
        pass
    return {}

async def fetch_openweather(lat: float, lon: float, client: httpx.AsyncClient) -> Dict[str, Any]:
    if not OPENWEATHER_API_KEY:
        return {}
    url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={OPENWEATHER_API_KEY}&units=metric"
    try:
        res = await client.get(url, timeout=5.0)
        if res.status_code == 200:
            data = res.json()
            main = data.get("main", {})
            return {
                "source": "OpenWeatherMap",
                "temp": main.get("temp"),
                "humidity": main.get("humidity"),
                "feels_like": main.get("feels_like"),
                "wind_speed": data.get("wind", {}).get("speed"),
                "pressure": main.get("pressure"),
                "temp_max": main.get("temp_max"),
                "temp_min": main.get("temp_min")
            }
    except Exception:
        pass
    return {}

async def fetch_aqi(lat: float, lon: float, client: httpx.AsyncClient) -> int:
    """Fetches real-time AQI from Open-Meteo Air Quality API"""
    url = "https://air-quality-api.open-meteo.com/v1/air-quality"
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": ["us_aqi"],
        "timezone": "auto"
    }
    try:
        res = await client.get(url, params=params, timeout=5.0)
        if res.status_code == 200:
            return res.json().get("current", {}).get("us_aqi", 52)
    except Exception:
        pass
    return 52 # Fallback AQI

async def get_aggregated_weather(lat: float, lon: float, location_name: str = "Unknown") -> Dict[str, Any]:
    async with httpx.AsyncClient() as client:
        # Gather Weather + AQI concurrently
        om_data, owm_data, live_aqi = await asyncio.gather(
            fetch_open_meteo(lat, lon, client),
            fetch_openweather(lat, lon, client),
            fetch_aqi(lat, lon, client),
            return_exceptions=True
        )

    valid_sources = [s for s in [om_data, owm_data] if isinstance(s, dict) and s]
    
    if not valid_sources:
        return {"location": location_name, "temperature": 26.0, "feels_like": 31.0, "humidity": 85, "wind_speed": 4.9, "pressure": 1008, "uv_index": 1, "temp_max": 31.0, "temp_min": 23.0, "condition": "Cloudy", "aqi": 52, "sources_aggregated": 0}

    avg_temp = round(sum(s["temp"] for s in valid_sources if s.get("temp") is not None) / len(valid_sources), 1)
    avg_humidity = round(sum(s["humidity"] for s in valid_sources if s.get("humidity") is not None) / len(valid_sources))
    avg_feels_like = round(sum(s["feels_like"] for s in valid_sources if s.get("feels_like") is not None) / len(valid_sources), 1)
    avg_wind = round(sum(s["wind_speed"] for s in valid_sources if s.get("wind_speed") is not None) / len(valid_sources), 1)
    avg_pressure = round(sum(s["pressure"] for s in valid_sources if s.get("pressure") is not None) / len(valid_sources))

    # Ensure live_aqi is an integer, fallback if API failed
    aqi_value = live_aqi if isinstance(live_aqi, int) else 52

    return {
        "location": location_name,
        "temperature": avg_temp,
        "feels_like": avg_feels_like,
        "humidity": avg_humidity,
        "wind_speed": avg_wind,
        "pressure": avg_pressure,
        "uv_index": valid_sources[0].get("uv", 1),
        "temp_max": valid_sources[0].get("temp_max", avg_temp + 4),
        "temp_min": valid_sources[0].get("temp_min", avg_temp - 3),
        "condition": "Partly Cloudy",
        "aqi": aqi_value,
        "sources_aggregated": len(valid_sources)
    }