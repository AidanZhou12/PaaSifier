from fastapi import Cookie, Depends, APIRouter, Response, status, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from database import get_db
import models
from typing import Annotated
from schemas import ProjectBase, ProjectCreate, ProjectResponse
from auth import get_current_user
from ibm_cloud import IBM_CLOUD_API_URL, ibm_headers
import requests

router = APIRouter()
