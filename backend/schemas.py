from __future__ import annotations
from pydantic import BaseModel, ConfigDict, Field

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
    # Matches the length of Project.name in models.py
    name: str = Field(min_length=1, max_length=50)

# The owner comes from the logged-in user's token, never from the request body
class ProjectCreate(ProjectBase):
    pass

class ProjectResponse(ProjectBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    crn: str
    href: str
    ibm_id: str
    status: str
