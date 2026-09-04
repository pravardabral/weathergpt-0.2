import httpx
from google import genai
from google.genai import types
from core.config import GEMINI_API_KEY
from services.weather_service import get_aggregated_weather

# Initialize client using the key from config
client = genai.Client(api_key=GEMINI_API_KEY)

# 1. Fetch real-time deterministic weather data
async def fetch_telemetry(lat: float, lon: float) -> str:
    url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,precipitation,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto"
    async with httpx.AsyncClient() as httpx_client:
        res = await httpx_client.get(url)
        return res.text

# 2. Inject telemetry into Gemini's context
from typing import Optional

async def get_fast_response(
    query: str, 
    lat: Optional[float] = None, 
    lon: Optional[float] = None, 
    location_name: Optional[str] = "your area"
) -> str:
    
    # Fallback to direct AI response if coordinates are unavailable
    if lat is None or lon is None:
        response = await client.aio.models.generate_content(
            model="gemini-3.5-flash-lite",
            contents=query
        )
        return response.text

    telemetry_data = await fetch_telemetry(lat, lon)
    
    # Combine the system instruction and user query into one robust payload
    combined_prompt = f"""
    You are WeatherGPT. The user is in {location_name}.
    Answer the user's query concisely based strictly on this live telemetry data:
    {telemetry_data}
    
    User Query: {query}
    If the user asks a simple question about current conditions (e.g., "What is the weather?", "Is it raining?"), respond EXCLUSIVELY with this JSON format wrapped in a ```json block:
    {
    "type": "weather_card",
    "location": "City Name",
    "temp": 28,
    "condition": "Brief description",
    "uv": 6,
    "aqi": 45
    }
    Do not add conversational text outside the JSON block.
    """
    
    # Send as standard contents to bypass system_instruction restrictions
    response = await client.aio.models.generate_content(
        model="gemini-3.5-flash-lite",
        contents=combined_prompt,
        config=types.GenerateContentConfig(temperature=0.3)
    )
    
    return response.text

async def get_detailed_response(query: str, lat: float, lon: float, location_name: str) -> str:
    """Handles the Detailed mode by fetching live API telemetry first."""
    # 1. Quick extraction
    extraction_prompt = f"Extract ONLY the city or location name from this query. If no location is mentioned, output exactly 'CURRENT'. Query: '{query}'"
    extraction = await client.aio.models.generate_content(
        model="gemini-3.5-flash-lite",
        contents=extraction_prompt
    )
    extracted_loc = extraction.text.strip()
    
    target_lat, target_lon, target_loc = lat, lon, location_name
    
    # 2. Geocode if a new city was found
    if extracted_loc.upper() != "CURRENT" and extracted_loc.lower() not in location_name.lower():
        async with httpx.AsyncClient() as http_client:
            res = await http_client.get(
                f"https://nominatim.openstreetmap.org/search?q={extracted_loc}&format=json&limit=1",
                headers={"User-Agent": "WeatherGPT/1.0"}
            )
            if res.status_code == 200 and res.json():
                target_lat = float(res.json()[0]["lat"])
                target_lon = float(res.json()[0]["lon"])
                target_loc = extracted_loc.title()
                
    # 3. Fetch telemetry & synthesize with the heavier Flash model
    weather_data = await get_aggregated_weather(target_lat, target_lon, target_loc)
    prompt = f"""
    You are WeatherGPT. Answer the user's query intelligently. 
    Here is the real-time weather telemetry for {target_loc}: {weather_data}.
    
    User Query: {query}
    
    Format your response cleanly using markdown (bullet points, bold text).
    """
    
    response = await client.aio.models.generate_content(
        model="gemini-3.5-flash",
        contents=prompt
    )
    return response.text