from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text
from sqlalchemy.sql import func

from app.db.base import Base


def _utcnow():
    return datetime.now(timezone.utc)


# Plan constants
PLAN_FREE = "free"
PLAN_TRIAL = "trial"
PLAN_UNLIMITED = "unlimited"

FREE_SEARCH_QUOTA = 10
TRIAL_SEARCH_QUOTA = 25
TRIAL_DURATION_DAYS = 7
UNLIMITED_DURATION_DAYS = 90


class UserStatus(Base):
    __tablename__ = "user_status"

    clerk_user_id = Column(String, primary_key=True)
    email_cached = Column(String, nullable=True)

    is_restricted = Column(Boolean, nullable=False, default=False, server_default="false")
    restricted_at = Column(DateTime(timezone=True), nullable=True)
    restricted_reason = Column(Text, nullable=True)
    restricted_by = Column(String, nullable=True)

    first_seen_at = Column(DateTime(timezone=True), default=_utcnow, server_default=func.now())
    last_seen_at = Column(DateTime(timezone=True), default=_utcnow, server_default=func.now())

    # Plan / quota fields
    plan = Column(String, nullable=False, default=PLAN_FREE, server_default=PLAN_FREE)
    plan_started_at = Column(DateTime(timezone=True), nullable=True)
    plan_expires_at = Column(DateTime(timezone=True), nullable=True)
    plan_granted_by = Column(String, nullable=True)
    plan_searches_used = Column(Integer, nullable=False, default=0, server_default="0")
    free_searches_used = Column(Integer, nullable=False, default=0, server_default="0")
