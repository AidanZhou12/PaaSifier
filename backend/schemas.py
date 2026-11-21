from __future__ import annotations
from pydantic import BaseModel, ConfigDict

class UserBase(BaseModel):
    username: str

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: int


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class ProjectBase(BaseModel):
    user_id: int
    name: str

class ProjectCreate(ProjectBase):
    username: str

class ProjectResponse(ProjectCreate):
    id: int
