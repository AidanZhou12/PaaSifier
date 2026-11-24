"""Allow 128 character project names

Revision ID: cbbc81fbf1da
Revises: cb37c7ee7554
Create Date: 2026-11-23 11:52:56.327335

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cbbc81fbf1da'
down_revision: Union[str, Sequence[str], None] = 'cb37c7ee7554'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # batch_alter_table emits a plain ALTER TABLE on Postgres, and also works on SQLite
    with op.batch_alter_table("project") as batch_op:
        batch_op.alter_column(
            "name",
            existing_type=sa.String(length=50),
            type_=sa.String(length=128),
            existing_nullable=False,
        )


def downgrade() -> None:
    """Downgrade schema."""
    # Fails on Postgres if any project name is longer than 50 characters
    with op.batch_alter_table("project") as batch_op:
        batch_op.alter_column(
            "name",
            existing_type=sa.String(length=128),
            type_=sa.String(length=50),
            existing_nullable=False,
        )
