# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

PaaSifier is a small platform-as-a-service: a user gives a container image reference and gets back a link to it running on **IBM Cloud Code Engine**. Users own **projects** (each maps 1:1 to a Code Engine project) and projects contain **applications** (each maps to a Code Engine app). Our Postgres database stores a copy of what IBM has; IBM is the source of truth for status and URLs.

- `backend/`: FastAPI + SQLAlchemy 2.x + Alembic + Postgres (psycopg 3)
- `client/`: React 19 + TypeScript + Vite + React Router (`react-router` package)
- `compose.yaml`: runs `db` (postgres:18), `backend` (port 8000), and `client` (port 5173) together

## Commands

Run everything (applies migrations on backend startup, live-reloads both apps via bind mounts):
```
docker compose up            # add --build after changing requirements.txt, package.json, or a Dockerfile
docker compose logs -f backend
docker compose down          # keeps data; `down -v` wipes the database volume
```

Frontend (in `client/`):
```
npx tsc -b       # type-check (also runs as part of `npm run build`)
npm run lint     # oxlint; react/rules-of-hooks is an error
npm run build
```
`tsconfig` has `noUnusedLocals`/`noUnusedParameters` and `verbatimModuleSyntax` on: unused imports are errors, and type-only imports must use `import { type X }`.

Backend (in `backend/`, using `backend/.venv`):
```
.venv/bin/alembic revision --autogenerate -m "message"
.venv/bin/alembic upgrade head
```
Alembic reads `DATABASE_URL` from the environment (`alembic/env.py`), not from `alembic.ini`. To autogenerate without a running Postgres, point it at a throwaway SQLite file: `DATABASE_URL=sqlite:///$(mktemp -d)/m.db .venv/bin/alembic upgrade head && ... revision --autogenerate ...`. Autogenerate picks up *every* model change at once, so check the generated file for unrelated changes (or write the migration by hand with `op.batch_alter_table`).

There is no test suite. Ad-hoc backend checks use FastAPI's `TestClient` against a temporary SQLite database, with `requests` calls to IBM patched out (`unittest.mock.patch.object(routers.projects.requests, ...)` and `patch.object(routers.projects, "ibm_headers", ...)`) so no real Code Engine resources are created. Set `COOKIE_SECURE=false` for these, since the test client uses plain HTTP. Run them from `backend/` so `load_dotenv()` finds `backend/.env`.

## Configuration

`backend/.env` (git-ignored, loaded by compose via `env_file` and by `load_dotenv()` in code): `DATABASE_URL`, `JWT_SECRET`, `IBM_CLOUD_API_KEY`, `IBM_CLOUD_API_URL` (Code Engine v2 base URL, e.g. `https://api.us-south.codeengine.cloud.ibm.com/v2`), `IBM_CLOUD_RESOURCE_GROUP_ID` (optional). Optional: `CORS_ORIGINS` (comma-separated, defaults to `http://localhost:5173`), `COOKIE_SECURE` (defaults true).

Inside Docker, compose overrides `DATABASE_URL` to use host `db`. `client/.env` has `VITE_API_URL=http://localhost:8000`; it must stay `localhost` (not `127.0.0.1` or `backend`), because the browser calls the API and the refresh cookie is `SameSite=Strict`.

## Backend architecture

- `main.py` mounts `routers/users.py` at `/users` and `routers/projects.py` at `/projects`. Application routes live in `projects.py` under `/projects/{project_id}/apps[/{app_name}]`.
- **Auth (`auth.py`)**: short-lived JWT access tokens (15 min, HS256, `sub` = user id) sent as `Authorization: Bearer`, plus rotating refresh tokens. Refresh tokens are random strings stored hashed in the `refresh_token` table, grouped by `family_id`, sent as an `httpOnly` cookie scoped to `Path=/users`. Reusing a refresh token outside a 10-second grace window revokes the whole family. `/users/refresh` rotates; `/users/logout` revokes. Rotated tokens inherit the family's original 7-day expiry.
- **Every protected route** takes `user: Annotated[models.User, Depends(get_current_user)]` and must scope queries by ownership: projects by `Project.user_id == user.id`, applications by first loading the owned project. Return 404 (not 403) for other users' resources. Never accept an owner/user id from the request body.
- **IBM calls (`ibm_cloud.py`)**: `ibm_headers()` must be called per request (it calls `IAMTokenManager.get_token()`, which caches and renews the IAM token); never store the token or headers at module level. Routes that call IBM are sync `def` (blocking `requests`).
- **IBM call conventions used throughout `projects.py`**: call IBM *before* writing to our DB on create, and *before* deleting from our DB on delete; treat an IBM 404 on delete as already deleted; pass IBM 400/409 messages through (`response.json()["errors"][0]["message"]`); map every other IBM status, timeout, or connection error to **502**. Never forward IBM's status code as-is: an IBM 401 would make the frontend think the user's session expired.
- **Status refresh**: `refresh_project_status` (always called by `GET /projects/{id}`), `refresh_application_status` (single app), and `refresh_application_statuses` (one paginated list call per project) update `status`/`endpoint` from IBM, and on any IBM failure keep the saved data and log a warning. The app routes only refresh while an app is in `APP_DEPLOYING_STATUSES` (`deploying`, `pending`). App statuses are `ready`, `deploying`, `pending`, `failed`, `warning`; a project IBM no longer has is marked `not_found`. Creating an app requires the project to be `active` (refreshed from IBM first if the saved status isn't).
- **Schemas (`schemas.py`)**: request-validation rules (username letters/numbers only, since usernames become IBM tags; app names must match Code Engine's `^[a-z]([-a-z0-9]*[a-z0-9])?$`, max 63; project names max 128; instance counts `ge=0`, with `max_instances` 0 meaning no limit and otherwise not below `min_instances`) live on the *Create* schemas. Response schemas inherit from the *Base* schemas so these checks don't run on data read from the database. Use `PydanticCustomError` for validator messages so they aren't prefixed with "Value error, ". Keep `String(n)` column lengths in `models.py` in sync with schema `max_length`.
- Passwords are hashed with plain SHA-256; the owner has chosen to keep this for now.

## Frontend architecture

- `src/api/users.ts` exports `request<T>(method, path, body, fallbackError, retryOnUnauthorized = true)`, which every API function uses. It keeps the access token **in memory only** (not localStorage), sends `credentials: 'include'`, and on a 401 calls `/users/refresh` once and retries. Concurrent refreshes share one in-flight promise (required, because refresh tokens are single-use). It turns errors into `ApiError` (with `.status`), reading FastAPI's `detail` whether it's a string or a 422 validation list.
- `src/api/projects.ts` has the project/application API functions plus the shared `isDeploying()` and `APP_POLL_INTERVAL_MS`, used by both pages that poll.
- Routes (`App.tsx`): `/dashboard`, `/project/:id`, `/project/:id/create` (new app form), `/project/:id/apps/:appName`. Pages get everything from the URL and fetch their own data (no navigation `state`), so deep links and reloads work.
- Page pattern (see `project.tsx`, `application.tsx`): every hook comes before the `if (!user) return null` early return (a conditional hook previously blanked the page). Fetch results are stored tagged with the id/key they were for, and `project`/`error` are derived during render. Effects use an `ignore`/`stopped` flag in cleanup so a stale response can't overwrite newer data. Polling while apps are deploying uses chained `setTimeout` (not `setInterval`) so requests never overlap, and stops once nothing is deploying.
- App links are shown only for allowed statuses, and only if the endpoint matches `^https?://`.
- Styles are plain CSS in `src/pages/pages.css`. `.navbar:has(> button) + h1` styles only an `<h1>` directly after the navbar, so wrapping or inserting elements there changes the heading's layout.
