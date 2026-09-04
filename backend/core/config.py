import os
from dotenv import load_dotenv

# Load environment variables from the .env file into the system environment
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY", "")
ACCUWEATHER_API_KEY=os.getenv("ACCUWEATHER_API_KEY", "")

POSTGRES_URL = os.getenv("POSTGRES_URL", "postgresql+asyncpg://postgres:password@localhost:5432/weathergpt")
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
MONGODB_NAME = os.getenv("MONGODB_NAME", "weathergpt_mongo")