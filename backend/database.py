import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv(override=True)

# --- CLOUD CONFIGURATION (DISABLED TEMPORARILY) ---
# SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")
# engine = create_engine(SQLALCHEMY_DATABASE_URL)

# --- LOCAL SQLITE CONFIGURATION (ACTIVE) ---
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

# SQLite requires this specific argument to work with FastAPI's threading
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()