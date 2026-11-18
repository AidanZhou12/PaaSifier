from fastapi import fastapi

app = FastAPI()

app.include_router(users.router, prefix="/users", tags=["users"])