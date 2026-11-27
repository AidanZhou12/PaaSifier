FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Installed as root, so the app user can't modify its own dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Unprivileged user to run the server
RUN useradd --uid 1000 --no-create-home --shell /usr/sbin/nologin appuser

# Code stays owned by root: appuser can read it but not change it
COPY . .

USER appuser

EXPOSE 8000
# Production server (no auto-reload). Listens on $PORT when the platform sets it
# (IBM Code Engine does), otherwise 8000. `exec` lets the server receive stop signals directly.
# compose.yaml overrides this with `alembic upgrade head && fastapi dev ...` for local development.
# Migrations aren't run here: run `alembic upgrade head` with this image as a separate step.
CMD ["sh", "-c", "exec fastapi run main.py --host 0.0.0.0 --port ${PORT:-8000}"]
