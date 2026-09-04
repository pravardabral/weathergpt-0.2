from pydantic import BaseModel
from typing import Optional

class ChatPayload(BaseModel):
    query: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_name: Optional[str] = "your area"
    language: Optional[str] = "en"
    mode: Optional[str] = "detailed"