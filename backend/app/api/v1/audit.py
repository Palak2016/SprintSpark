from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.tenancy import require_project_access
from app.models.user import User
from app.models.project import Project
from app.models.audit import AuditEvent
from app.schemas.audit import AuditEventOut

router = APIRouter(tags=["Audit Trail"])


@router.get("/projects/{project_id}/audit-trail", response_model=List[AuditEventOut])
def get_project_audit_trail(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    require_project_access(current_user, project)

    events = db.query(AuditEvent).filter(
        AuditEvent.project_id == project_id
    ).order_by(AuditEvent.created_at.desc()).all()

    return [AuditEventOut.model_validate(e) for e in events]
