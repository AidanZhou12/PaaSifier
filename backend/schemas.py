from __future__ import annotations
from pydantic import BaseModel, ConfigDict

class UserBase(BaseModel):
    username: str

class UserCreate(UserBase):
    password_hash: str

class UserResponse(UserBase):
    id: int
    password_hash: str
