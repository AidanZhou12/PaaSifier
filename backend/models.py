from sqlalchemy import CheckConstraint, Column, String, ForeignKey, Table
from sqlalchemy.orm import relationship, Mapped, mapped_column
from database import Base

class User(Base):
    __tablename__ = "user"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String(100), nullable=False)