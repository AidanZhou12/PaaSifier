from fastapi import Depends, APIRouter, status, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from database import get_db
import models
from typing import Annotated
from schemas import UserBase, UserCreate, UserResponse
import hashlib
import hmac

router = APIRouter()

@router.post("/create", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(user: UserCreate, db: Annotated[Session, Depends(get_db)]):
    account = db.execute(select(models.User).where(models.User.username == user.username)).scalar_one_or_none()
    if account:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="That username is taken")
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

@router.post("/login", response_model=UserResponse)
def login(creds: UserCreate, db: Annotated[Session, Depends(get_db)]):
    account = db.execute(select(models.User).where(models.User.username == creds.username)).scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="That username does not exist")
    data = creds.password.encode("utf-8")
    hash_result = hashlib.sha256(data).hexdigest()
    if hmac.compare_digest(account.password_hash, hash_result):
        return account
    else:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid password")