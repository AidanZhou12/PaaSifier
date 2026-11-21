from fastapi import Cookie, Depends, APIRouter, Response, status, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from database import get_db
import models
from typing import Annotated
from schemas import ProjectBase, ProjectCreate, ProjectResponse
from ibm-cloud-core-sdk import IAMTokenManager
import os

router = APIRouter()

authenticator = IAMTokenManager(os.getenv("IBM_CLOUD_API_KEY"))
access_token = authenticator.TokenManager.get_token()
headers = {
    'Authoriation': f'Bearer {access_token}',
    'Content-Type': 'application/json'
}