from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime, timezone
from database import Base

# --- EXISTING USER TABLE ---
class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    tier = Column(String, default="FREE")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationship Link: Tells SQLAlchemy that a user can own multiple records
    # "back_populates" coordinates changes automatically between both blueprints
    records = relationship("Record", back_populates="owner", cascade="all, delete-orphan")
    connected_accounts = relationship("ConnectedAccount", back_populates="owner", cascade="all, delete-orphan")
    scheduled_posts = relationship("ScheduledPost", back_populates="owner", cascade="all, delete-orphan")


# --- NEW: CORE DATA RECORDS TABLE ---
class Record(Base):
    __tablename__ = "records"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String, nullable=False, index=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    # The Foreign Key (The Luggage Tag): Connects this row directly to a user's UUID
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Relationship Link: Connects the individual record back to its specific User object
    owner = relationship("User", back_populates="records")


class ConnectedAccount(Base):
    __tablename__ = "connected_accounts"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    platform = Column(String, nullable=False) # e.g., "youtube"
    access_token = Column(String, nullable=False)
    refresh_token = Column(String, nullable=True) # Sometimes these are null, so we allow it
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    # The Foreign Key: Connects this account directly to a specific user's UUID
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Relationship Links
    owner = relationship("User", back_populates="connected_accounts")
    scheduled_posts = relationship("ScheduledPost", back_populates="account", cascade="all, delete-orphan")

class ScheduledPost(Base):
    __tablename__ = "scheduled_posts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    video_url = Column(String, nullable=False)  # This will be your Cloudflare R2 link
    caption = Column(Text, nullable=True)
    publish_time = Column(DateTime, nullable=False)
    is_published = Column(Boolean, default=False)  # Will flip to True once Celery posts it
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # The Foreign Keys: Connects the post to a User AND a specific Connected Account
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    account_id = Column(Integer, ForeignKey("connected_accounts.id", ondelete="CASCADE"), nullable=False)

    # Relationship Links
    owner = relationship("User", back_populates="scheduled_posts")
    account = relationship("ConnectedAccount", back_populates="scheduled_posts")