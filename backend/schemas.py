from __future__ import annotations
import re

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic_core import PydanticCustomError

USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9]+$")

class UserBase(BaseModel):
    username: str

# Signup only. Usernames are used as IBM Code Engine tags, so they're limited to letters and numbers
# (IBM also allows _ - . :) and 50 characters (the database column; IBM allows 128).
class UserCreate(UserBase):
    username: str = Field(min_length=1, max_length=50)
    password: str

    @field_validator("username")
    @classmethod
    def username_letters_and_numbers(cls, value: str) -> str:
        if not USERNAME_PATTERN.fullmatch(value):
            # PydanticCustomError keeps the message exactly as written (ValueError would add "Value error, ")
            raise PydanticCustomError("username_chars", "Username can only contain letters and numbers")
        return value

# Login is deliberately not restricted, so accounts created before the rule existed can still log in
class UserLogin(UserBase):
    password: str

class UserResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: int


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class ProjectBase(BaseModel):
    # Matches Project.name in models.py and IBM Code Engine's 128-character limit
    name: str = Field(min_length=1, max_length=128)

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
