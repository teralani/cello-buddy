from datetime import datetime
from pydantic import BaseModel, field_validator


class UsersBase(BaseModel):
    name: str
    email: str
    high_score: float
    password_hash: str
    created_at: datetime
    updated_at: datetime


class UserLogin(BaseModel):
    email: str
    password_hash: str