import asyncio
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from motor.motor_asyncio import AsyncIOMotorClient

from core.database import postgres_engine, Base, mongodb
from core.config import MONGODB_URL, MONGODB_NAME
from core.logger import logger
from api.routes import chat, weather, user, health

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing Database Connections...")
    
    retries = 5
    for i in range(retries):
        try:
            async with postgres_engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            logger.info("PostgreSQL connected successfully.")
            break
        except Exception as e:
            if i == retries - 1:
                logger.error("Failed to connect to PostgreSQL after multiple retries.")
                raise e
            logger.warning(f"Database not ready yet, retrying in 3 seconds... ({i+1}/{retries})")
            await asyncio.sleep(3)
            
    mongodb.client = AsyncIOMotorClient(MONGODB_URL)
    mongodb.db = mongodb.client[MONGODB_NAME]
    logger.info("MongoDB Initialized.")
    
    yield
    
    await postgres_engine.dispose()
    mongodb.client.close()
    logger.info("Database connections securely closed.")

app = FastAPI(title="WeatherGPT Backend", lifespan=lifespan)

# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled Exception on {request.url.path}: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred. Our engineers have been notified."},
    )

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?:\/\/.*$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers
app.include_router(user.router, prefix="/api/user", tags=["User"])
app.include_router(weather.router, prefix="/api/weather", tags=["Weather"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])
app.include_router(health.router, prefix="/api/health", tags=["System"])