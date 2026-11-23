from __future__ import annotations
import re

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
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

class ApplicationBase(BaseModel):
    name: str = Field(min_length=1, max_length=63)

class ApplicationCreate(ApplicationBase):
    image_reference: str = Field(min_length=1, max_length=256)
    min_instances: int = Field(default=0, ge=0)
    max_instances: int = Field(default=10, ge=0)

    # Runs after each field has passed its own checks, so both values are known to be >= 0 here
    @model_validator(mode="after")
    def check_instance_range(self) -> "ApplicationCreate":
        # max_instances of 0 is always allowed (including with min_instances 0), so only compare when it's set
        if self.max_instances != 0 and self.max_instances < self.min_instances:
            raise PydanticCustomError("instance_range", "max_instances can't be less than min_instances")
        return self

# Inherits from ApplicationBase, not ApplicationCreate, so the request checks above
# (defaults, ge=0, the instance range) don't run on data coming back from the database
class ApplicationResponse(ApplicationBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    image_reference: str
    min_instances: int
    max_instances: int
    href: str
    ibm_id: str
    status: str
    endpoint: str
