from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from motor.motor_asyncio import AsyncIOMotorClient
from core.config import POSTGRES_URL, MONGODB_URL

# ==========================================
# 1. PostgreSQL Setup (SQLAlchemy + asyncpg)
# ==========================================
# Create the async engine
postgres_engine = create_async_engine(POSTGRES_URL, echo=False)

# Create a configured "Session" class
AsyncSessionLocal = async_sessionmaker(
    bind=postgres_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Declarative base for mapping our Python classes to SQL tables
Base = declarative_base()

# Dependency to yield PostgreSQL sessions for endpoints
async def get_pg_db():
    async with AsyncSessionLocal() as session:
        yield session


# ==========================================
# 2. MongoDB Setup (Motor)
# ==========================================
class MongoDBManager:
    client: AsyncIOMotorClient = None
    db = None

# Initialize an instance to hold the connection globally
mongodb = MongoDBManager()

def get_mongo_db():
    """Dependency to yield the MongoDB instance for endpoints"""
    return mongodb.db