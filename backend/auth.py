import hashlib
import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated

import jwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select, update
from sqlalchemy.orm import Session

import models
from database import get_db

load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    raise ValueError("JWT_SECRET environment variable is not set")

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15

REFRESH_TOKEN_EXPIRE_DAYS = 7
# How long an already-used refresh token is still accepted, so two tabs refreshing
# at the same moment don't look like token theft
REFRESH_TOKEN_REUSE_GRACE_SECONDS = 10
REFRESH_COOKIE_NAME = "refresh_token"
# Only sent to /users/... routes (refresh and logout), not to every API call
REFRESH_COOKIE_PATH = "/users"
# SameSite=None lets the browser send the refresh cookie when the frontend and API are on different
# sites (e.g. separate IBM Code Engine domains). Browsers only accept SameSite=None cookies that are
# also Secure, so keep COOKIE_SECURE on for any browser use (http://localhost counts as secure in
# Chrome and Firefox). COOKIE_SECURE=false is only for test clients that use plain HTTP.
COOKIE_SAMESITE = "none"
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "true").lower() != "false"

# auto_error=False so a missing header returns our own 401 instead of FastAPI's default
bearer_scheme = HTTPBearer(auto_error=False)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _unauthorized(detail: str = "Not authenticated") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


# ---------- Access tokens (JWT) ----------

def create_access_token(user_id: int) -> str:
    now = _now()
    payload = {
        "sub": str(user_id),  # the JWT spec requires "sub" to be a string
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> models.User:
    if credentials is None:
        raise _unauthorized()
    try:
        # Checks the signature and the "exp" claim; raises if either is invalid
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = int(payload["sub"])
    except (jwt.InvalidTokenError, KeyError, ValueError):
        raise _unauthorized()

    user = db.get(models.User, user_id)
    if user is None:
        raise _unauthorized()
    return user


# ---------- Refresh tokens (random, stored hashed, rotated on every use) ----------

def _issue_refresh_token(db: Session, user_id: int, family_id: str, expires_at: datetime) -> str:
    token = secrets.token_urlsafe(48)
    db.add(models.RefreshToken(
        user_id=user_id,
        token_hash=_hash_token(token),
        family_id=family_id,
        created_at=_now(),
        expires_at=expires_at,
    ))
    return token


def start_refresh_family(db: Session, user_id: int) -> str:
    """Called on login/signup. Returns a new raw refresh token; caller must commit."""
    return _issue_refresh_token(
        db, user_id, str(uuid.uuid4()), _now() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    )


def _revoke_family(db: Session, family_id: str) -> None:
    db.execute(
        update(models.RefreshToken)
        .where(models.RefreshToken.family_id == family_id, models.RefreshToken.revoked_at.is_(None))
        .values(revoked_at=_now())
    )


def rotate_refresh_token(db: Session, token: str | None) -> tuple[models.User, str]:
    """Swaps a refresh token for a new one. Returns (user, new raw refresh token) or raises 401."""
    if not token:
        raise _unauthorized()

    # with_for_update locks the row so two simultaneous requests can't both rotate it
    record = db.execute(
        select(models.RefreshToken)
        .where(models.RefreshToken.token_hash == _hash_token(token))
        .with_for_update()
    ).scalar_one_or_none()

    now = _now()
    if record is None or record.revoked_at is not None or _as_utc(record.expires_at) <= now:
        raise _unauthorized()

    if record.used_at is not None:
        if now - _as_utc(record.used_at) > timedelta(seconds=REFRESH_TOKEN_REUSE_GRACE_SECONDS):
            # An old token was replayed: assume it was stolen and end this login everywhere
            _revoke_family(db, record.family_id)
            db.commit()
            raise _unauthorized("Session expired, please log in again")
        # Within the grace period (e.g. another tab refreshed a moment ago): allow it
    else:
        record.used_at = now

    new_token = _issue_refresh_token(db, record.user_id, record.family_id, _as_utc(record.expires_at))
    user = db.get(models.User, record.user_id)
    if user is None:
        raise _unauthorized()
    db.commit()
    return user, new_token


def revoke_refresh_token(db: Session, token: str | None) -> None:
    """Called on logout. Ends every token from the same login."""
    if not token:
        return
    record = db.execute(
        select(models.RefreshToken).where(models.RefreshToken.token_hash == _hash_token(token))
    ).scalar_one_or_none()
    if record is not None:
        _revoke_family(db, record.family_id)
        db.commit()


# ---------- Cookie helpers ----------

def set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=token,
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
    )


def clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=REFRESH_COOKIE_NAME,
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
    )
