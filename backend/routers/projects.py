from fastapi import Cookie, Depends, APIRouter, Response, status, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from database import get_db
import models
from typing import Annotated
from schemas import ProjectBase, ProjectCreate, ProjectResponse
from auth import get_current_user
from ibm_cloud import IBM_CLOUD_API_URL, IBM_CLOUD_RESOURCE_GROUP_ID, ibm_headers
from datetime import datetime
import logging
import requests
import os

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/create", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    proj: ProjectCreate,
    user: Annotated[models.User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    # Project names are unique across the whole IBM account, so check before calling IBM
    existing = db.execute(select(models.Project).where(models.Project.name == proj.name)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="That project name is taken")

    body = {
        "name": proj.name,
        "tags": [user.username],
    }
    if IBM_CLOUD_RESOURCE_GROUP_ID:
        body["resource_group_id"] = IBM_CLOUD_RESOURCE_GROUP_ID

    try:
        response = requests.post(f"{IBM_CLOUD_API_URL}/projects", headers=ibm_headers(), json=body, timeout=30)
    except requests.RequestException:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Could not reach IBM Cloud")

    if response.status_code != status.HTTP_202_ACCEPTED:
        # Pass on IBM's message for problems with the user's input; anything else is our problem, not theirs.
        # Never forward IBM's status code as-is: a 401 from IBM would make the frontend think the user's session expired.
        if response.status_code in (status.HTTP_400_BAD_REQUEST, status.HTTP_409_CONFLICT):
            try:
                message = response.json()["errors"][0]["message"]
            except (ValueError, KeyError, IndexError, TypeError):
                message = "IBM Cloud rejected the project"
            raise HTTPException(status_code=response.status_code, detail=message)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="IBM Cloud could not create the project")

    data = response.json()
    new_project = models.Project(
        user_id=user.id,
        name=proj.name,
        created_at=datetime.fromisoformat(data["created_at"]),
        crn=data["crn"],
        href=data["href"],
        ibm_id=data["id"],
        status=data["status"],
    )
    db.add(new_project)
    db.commit()
    db.refresh(new_project)
    return new_project

@router.get("", response_model=list[ProjectResponse])
def get_projects(
    user: Annotated[models.User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)]
):
    # Without order_by, the database can return rows in any order, so the dashboard list could shuffle
    projects = db.execute(
        select(models.Project)
        .where(models.Project.user_id == user.id)
        .order_by(models.Project.created_at.desc(), models.Project.id.desc())
    ).scalars().all()
    return projects

@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    user: Annotated[models.User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)]
):
    project = db.execute(
        select(models.Project)
        .where(models.Project.id == project_id, models.Project.user_id == user.id)
    ).scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    try:
        response = requests.delete(f"{IBM_CLOUD_API_URL}/projects/{project.ibm_id}", headers=ibm_headers(), timeout=30)
    except requests.RequestException:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Could not reach IBM Cloud")

    # 404 means IBM no longer has it, so it's safe to remove our record too
    if response.status_code not in (status.HTTP_202_ACCEPTED, status.HTTP_404_NOT_FOUND):
        if response.status_code in (status.HTTP_400_BAD_REQUEST, status.HTTP_409_CONFLICT):
            try:
                message = response.json()["errors"][0]["message"]
            except (ValueError, KeyError, IndexError, TypeError):
                message = "IBM Cloud rejected deletion"
            raise HTTPException(status_code=response.status_code, detail=message)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="IBM Cloud could not delete the project")

    db.delete(project)
    db.commit()

@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: int,
    user: Annotated[models.User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    project = db.execute(
        select(models.Project)
        .where(models.Project.id == project_id, models.Project.user_id == user.id)
    ).scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    # Refresh the status from IBM (e.g. "creating" -> "active"). If IBM can't be reached or
    # returns an error, fall back to the saved data instead of failing the page.
    try:
        response = requests.get(
            f"{IBM_CLOUD_API_URL}/projects/{project.ibm_id}",
            headers=ibm_headers(),
            timeout=5,  # short: the user is waiting for the page to load
        )
    except requests.RequestException:
        logger.warning("Could not reach IBM Cloud to refresh project %s", project.id)
        return project

    if response.status_code == status.HTTP_200_OK:
        try:
            new_status = response.json().get("status")
        except ValueError:
            new_status = None
        if isinstance(new_status, str) and new_status and new_status != project.status:
            project.status = new_status
            db.commit()
            db.refresh(project)
    elif response.status_code == status.HTTP_404_NOT_FOUND:
        # Gone from IBM (e.g. deleted in the IBM console). Keep our row so the user can see
        # what happened; the delete route already treats an IBM 404 as success.
        if project.status != "not_found":
            project.status = "not_found"
            db.commit()
            db.refresh(project)
    else:
        logger.warning("IBM Cloud returned %s when refreshing project %s", response.status_code, project.id)

    return project
    
