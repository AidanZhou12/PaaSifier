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
import os

router = APIRouter()

@router.post("/create", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(proj: ProjectCreate, db: Annotated[Session, Depends(get_db)]):
    creator = db.execute(select(models.User).where(models.User.id == proj.user_id)).scalar_one_or_none()
    if not creator:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No such user")
    body = {
        name: proj.name,
        resource_group_id: os.getenv(IBM_CLOUD_RESOURCE_GROUP_ID),
        tags: proj.username
    }
    response = requests.post(IBM_CLOUD_API_URL + "/projects", headers=ibm_headers, body=body)
    if response.status_code = 202:
        data = response.json()
        with SessionLocal() as session:
            new_project = models.Project(
                user_id=proj.user_id,
                name=proj.name,
                created_at=data["created_at"],
                crn=data["crn"],
                href=data["href"],
                ibm_id=data["id"],
                status=data["status"]
            )
            session.add(new_project)
            session.commit()
           return new_project
    else:
        raise HTTPException(status_code=response.status_code)
