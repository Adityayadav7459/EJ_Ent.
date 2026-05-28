from pydantic import BaseModel, EmailStr
from datetime import datetime
from uuid import UUID # Added the strict UUID type analyzer

# --- PHASE 1 & 2: USER SHIELDS ---
class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str


# --- PHASE 3: CORE DATA RECORD SHIELDS ---
class RecordCreate(BaseModel):
    title: str
    description: str | None = None
    # Shield C: For verifying incoming data meant to EDIT an existing row
class RecordUpdate(BaseModel):
    title: str
    description: str | None = None

class RecordResponse(BaseModel):
    id: int
    title: str
    description: str | None
    user_id: UUID # Updated from str to UUID to match the database perfectly!
    created_at: datetime

    class Config:
        from_attributes = True