from fastapi import Cookie, Depends, APIRouter, Response, status, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from database import get_db
import models
from typing import Annotated
from schemas import UserBase, UserCreate, UserLogin, UserResponse, TokenResponse
from auth import (
    REFRESH_COOKIE_NAME,
    clear_refresh_cookie,
    create_access_token,
    get_current_user,
    revoke_refresh_token,
    rotate_refresh_token,
    set_refresh_cookie,
    start_refresh_family,
)
import hashlib
import hmac

router = APIRouter()


def _login_response(db: Session, response: Response, user: models.User) -> TokenResponse:
    """Starts a new login: refresh token goes in an httpOnly cookie, access token in the JSON."""
    refresh_token = start_refresh_family(db, user.id)
    db.commit()
    set_refresh_cookie(response, refresh_token)
    return TokenResponse(access_token=create_access_token(user.id), user=UserResponse.model_validate(user))


@router.post("/create", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def create_user(user: UserCreate, response: Response, db: Annotated[Session, Depends(get_db)]):
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
    return _login_response(db, response, new_user)

@router.post("/login", response_model=TokenResponse)
def login(creds: UserLogin, response: Response, db: Annotated[Session, Depends(get_db)]):
    account = db.execute(select(models.User).where(models.User.username == creds.username)).scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="That username does not exist")
    data = creds.password.encode("utf-8")
    hash_result = hashlib.sha256(data).hexdigest()
    if hmac.compare_digest(account.password_hash, hash_result):
        return _login_response(db, response, account)
    else:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid password")


@router.get("/me", response_model=UserResponse)
def read_current_user(user: Annotated[models.User, Depends(get_current_user)]):
    return user


@router.post("/refresh", response_model=TokenResponse)
def refresh(
    response: Response,
    db: Annotated[Session, Depends(get_db)],
    refresh_token: Annotated[str | None, Cookie(alias=REFRESH_COOKIE_NAME)] = None,
):
    try:
        user, new_refresh_token = rotate_refresh_token(db, refresh_token)
    except HTTPException as exc:
        # Clear a dead cookie so the browser stops sending it. FastAPI doesn't copy headers from
        # the injected response onto an error response, so they're added to the exception instead.
        cleanup = Response()
        clear_refresh_cookie(cleanup)
        exc.headers = {**(exc.headers or {}), "set-cookie": cleanup.headers["set-cookie"]}
        raise
    set_refresh_cookie(response, new_refresh_token)
    return TokenResponse(access_token=create_access_token(user.id), user=UserResponse.model_validate(user))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response,
    db: Annotated[Session, Depends(get_db)],
    refresh_token: Annotated[str | None, Cookie(alias=REFRESH_COOKIE_NAME)] = None,
):
    revoke_refresh_token(db, refresh_token)
    clear_refresh_cookie(response)
