from datetime import datetime
from sqlalchemy import CheckConstraint, Column, DateTime, String, ForeignKey, Table, UniqueConstraint
from sqlalchemy.orm import relationship, Mapped, mapped_column
from database import Base

class User(Base):
    __tablename__ = "user"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String(100), nullable=False)

class RefreshToken(Base):
    __tablename__ = "refresh_token"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)
    # SHA-256 hex digest of the token; the raw token is only ever stored in the user's cookie
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    # Every token issued from one login shares a family, so reuse detection can revoke them all
    family_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    # Copied from the first token in the family, so a login lasts 7 days total no matter how often it rotates
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

class Project(Base):
    __tablename__ = "project"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)
    # IBM Code Engine allows project names up to 128 characters
    name: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    # IBM CRNs are ~115 characters, so 100 is too short
    crn: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    href: Mapped[str] = mapped_column(String(2048), nullable=False, unique=True)
    ibm_id: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False)

class Application(Base):
    __tablename__ = "application"
    # Code Engine app names only need to be unique within their project
    __table_args__ = (UniqueConstraint("project_id", "name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    # Which project the app belongs to; ownership is checked through the project's user_id.
    # CASCADE removes the app rows when their project is deleted (IBM deletes the apps with the project too).
    project_id: Mapped[int] = mapped_column(ForeignKey("project.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(63), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    href: Mapped[str] = mapped_column(String(2048), nullable=False, unique=True)
    ibm_id: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    image_reference: Mapped[str] = mapped_column(String(256), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    # The app's public URL. Can be empty while IBM is still deploying it.
    endpoint: Mapped[str | None] = mapped_column(String(2048))
    min_instances: Mapped[int] = mapped_column(default=0)
    max_instances: Mapped[int] = mapped_column(default=10)
