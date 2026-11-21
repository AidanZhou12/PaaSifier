import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import projects, users

load_dotenv()

app = FastAPI()

# Comma-separated list of frontend URLs allowed to call the API,
# e.g. CORS_ORIGINS=https://app.example.com,https://www.example.com
# Defaults to the local Vite dev server.
origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(projects.router,prefix="/projects", tags=["projects"])