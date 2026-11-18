from fastapi import Depends, APIRouter, status, HTTPException
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import selectinload
from database import get_db
import models
from typing import Annotated
from schemas import UserBase, UserCreate, UserResponse
import hashlib

router = APIRouter()

@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(user: UserCreate, db: Annotated[Session, Depends(get_db)]):
    account = db.execute(select(models.User).where(models.User.username == username)).scalar_one_or_none()
    if account:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="That username is taken")
    else:
        data = user.password.encode("utf-8")
        hash_result = hashlib.sha256(data).hexdigest()
        new_user = models.User(
            username=user.username,
            password_hash=hash_result
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return new_user