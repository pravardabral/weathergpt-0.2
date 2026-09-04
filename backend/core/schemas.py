from pydantic import BaseModel

class ChatRequest(BaseModel):
    query: str
    latitude: float
    longitude: float
    location_name: str
    language: str = "en"
    mode: str = "detailed"