from fastapi import Cookie, Depends, APIRouter, Response, status, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from database import get_db
import models
from typing import Annotated
from schemas import ProjectBase, ProjectCreate, ProjectResponse, ApplicationBase, ApplicationCreate, ApplicationResponse
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

def refresh_project_status(project: models.Project, db: Session) -> None:
    """Update project.status from IBM (e.g. "creating" -> "active") and save it if it changed.

    If IBM can't be reached or returns an error, the saved status is left as it is,
    so callers can carry on with the data they have.
    """
    try:
        response = requests.get(
            f"{IBM_CLOUD_API_URL}/projects/{project.ibm_id}",
            headers=ibm_headers(),
            timeout=5,  # short: a user is waiting on this
        )
    except requests.RequestException:
        logger.warning("Could not reach IBM Cloud to refresh project %s", project.id)
        return

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

    refresh_project_status(project, db)
    return project

@router.post("/{project_id}/apps", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED)
def create_application(
    project_id: int,
    app: ApplicationCreate,
    user: Annotated[models.User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    # The project must exist and belong to the logged-in user
    project = db.execute(
        select(models.Project)
        .where(models.Project.id == project_id, models.Project.user_id == user.id)
    ).scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    # IBM only accepts apps in active projects. The saved status may be out of date
    # (it's only refreshed when the project page loads), so ask IBM before refusing.
    if project.status != "active":
        refresh_project_status(project, db)
    if project.status != "active":
        if project.status == "creating":
            detail = "This project is still being created. Try again in a moment."
        elif project.status == "not_found":
            detail = "This project no longer exists in IBM Cloud"
        else:
            detail = f"Applications can't be created while the project is {project.status}"
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)

    # App names are unique within a project, so check before calling IBM
    existing = db.execute(
        select(models.Application)
        .where(models.Application.project_id == project.id, models.Application.name == app.name)
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An application with that name already exists in this project")

    body = {
        "name": app.name,
        "image_reference": app.image_reference,
        "scale_min_instances": app.min_instances,
        "scale_max_instances": app.max_instances,
    }

    try:
        response = requests.post(
            f"{IBM_CLOUD_API_URL}/projects/{project.ibm_id}/apps",
            headers=ibm_headers(),
            json=body,
            timeout=30,
        )
    except requests.RequestException:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Could not reach IBM Cloud")

    if response.status_code not in (status.HTTP_201_CREATED, status.HTTP_202_ACCEPTED):
        # Pass on IBM's message for problems with the user's input (e.g. an invalid name or image);
        # never forward other IBM codes as-is, since a 401 would look like the user's session expired
        if response.status_code in (status.HTTP_400_BAD_REQUEST, status.HTTP_409_CONFLICT):
            try:
                message = response.json()["errors"][0]["message"]
            except (ValueError, KeyError, IndexError, TypeError):
                message = "IBM Cloud rejected the application"
            raise HTTPException(status_code=response.status_code, detail=message)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="IBM Cloud could not create the application")

    data = response.json()
    new_app = models.Application(
        project_id=project.id,
        name=app.name,
        created_at=datetime.fromisoformat(data["created_at"]),
        href=data["href"],
        ibm_id=data["id"],
        image_reference=app.image_reference,
        status=data["status"],
        endpoint=data.get("endpoint"),
        min_instances=app.min_instances,
        max_instances=app.max_instances,
    )
    db.add(new_app)
    db.commit()
    db.refresh(new_app)
    return new_app

@router.get("/{project_id}/apps", response_model=list[ApplicationResponse])
def get_applications(
    project_id: int,
    user: Annotated[models.User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    # Same 404 for a project that doesn't exist and one that belongs to someone else
    project = db.execute(
        select(models.Project)
        .where(models.Project.id == project_id, models.Project.user_id == user.id)
    ).scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    # Newest first, like the project list; id breaks ties between apps created at the same moment
    applications = db.execute(
        select(models.Application)
        .where(models.Application.project_id == project.id)
        .order_by(models.Application.created_at.desc(), models.Application.id.desc())
    ).scalars().all()
    return applications
