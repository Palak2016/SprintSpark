from datetime import datetime, timezone, date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_manager
from app.models.user import User, UserRole
from app.models.leave import LeaveRequest, LeaveStatus
from app.models.task import Task, TaskStatus
from app.models.audit import AuditEvent
from app.models.notification import Notification
from app.schemas.leave import LeaveRequestCreate, LeaveReviewRequest, LeaveRequestOut

router = APIRouter(tags=["Leave Management & Availability"])


@router.get("/leave-requests", response_model=List[LeaveRequestOut])
def list_leave_requests(
    user_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(LeaveRequest)
    # Non-managers only see their own leave requests
    if current_user.role not in [UserRole.MANAGER.value, UserRole.ADMIN.value]:
        query = query.filter(LeaveRequest.user_id == current_user.id)
    elif user_id:
        query = query.filter(LeaveRequest.user_id == user_id)

    if status_filter:
        query = query.filter(LeaveRequest.status == status_filter)

    leaves = query.order_by(LeaveRequest.start_date.desc()).all()
    return [LeaveRequestOut.model_validate(l) for l in leaves]


@router.post("/leave-requests", response_model=LeaveRequestOut, status_code=status.HTTP_201_CREATED)
def submit_leave_request(
    data: LeaveRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if data.end_date < data.start_date:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="End date cannot be prior to start date")

    leave = LeaveRequest(
        user_id=current_user.id,
        start_date=data.start_date,
        end_date=data.end_date,
        reason=data.reason,
        status=LeaveStatus.PENDING.value
    )
    db.add(leave)
    db.commit()
    db.refresh(leave)

    # Notify managers
    managers = db.query(User).filter(User.role.in_([UserRole.MANAGER.value, UserRole.ADMIN.value])).all()
    for mgr in managers:
        notif = Notification(
            user_id=mgr.id,
            title=f"Leave Request from {current_user.full_name}",
            message=f"{current_user.full_name} requested leave from {leave.start_date} to {leave.end_date}.",
            link="/manager/leave"
        )
        db.add(notif)
    db.commit()

    return LeaveRequestOut.model_validate(leave)


@router.put("/leave-requests/{leave_id}/review", response_model=LeaveRequestOut)
def review_leave_request(
    leave_id: int,
    data: LeaveReviewRequest,
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db)
):
    leave = db.query(LeaveRequest).filter(LeaveRequest.id == leave_id).first()
    if not leave:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave request not found")

    leave.status = data.status
    leave.reviewed_by = current_user.id
    leave.reviewed_at = datetime.now(timezone.utc)
    leave.decision_notes = data.decision_notes

    # Find affected active tasks for this user
    affected_tasks = db.query(Task).filter(
        Task.assignee_id == leave.user_id,
        Task.status != TaskStatus.COMPLETED.value,
        Task.due_date >= leave.start_date,
        Task.start_date <= leave.end_date
    ).all()

    # Notify requester
    notif = Notification(
        user_id=leave.user_id,
        title=f"Leave Request {data.status}",
        message=f"Your leave request for {leave.start_date} to {leave.end_date} has been {data.status.lower()} by {current_user.full_name}." + 
                (f" Notes: {data.decision_notes}" if data.decision_notes else ""),
        link="/employee/leave"
    )
    db.add(notif)

    # If approved and tasks are affected, write audit event for primary project
    if data.status == LeaveStatus.APPROVED.value and affected_tasks:
        for t in affected_tasks:
            audit = AuditEvent(
                project_id=t.project_id,
                actor_id=current_user.id,
                event_type="LEAVE_APPROVED_IMPACT",
                description=f"Approved leave for {leave.user.full_name} impacts Task '{t.title}' ({t.start_date} to {t.due_date}).",
                metadata_json={
                    "leave_id": leave.id,
                    "task_id": t.id,
                    "assignee_id": leave.user_id
                }
            )
            db.add(audit)

    db.commit()
    db.refresh(leave)
    return LeaveRequestOut.model_validate(leave)


@router.get("/team-availability")
def get_team_availability(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Calculates team workload, active allocations, and approved absences."""
    users = db.query(User).all()
    today = date.today()

    availability_list = []
    for u in users:
        # Active tasks
        active_tasks = db.query(Task).filter(
            Task.assignee_id == u.id,
            Task.status != TaskStatus.COMPLETED.value
        ).all()

        total_rem_hours = sum(t.estimated_hours * (1.0 - t.progress_pct / 100.0) for t in active_tasks)

        # Approved leaves
        approved_leaves = db.query(LeaveRequest).filter(
            LeaveRequest.user_id == u.id,
            LeaveRequest.status == LeaveStatus.APPROVED.value,
            LeaveRequest.end_date >= today
        ).all()

        # Check if currently on leave today
        on_leave_today = any(l.start_date <= today <= l.end_date for l in approved_leaves)

        availability_list.append({
            "user": {
                "id": u.id,
                "full_name": u.full_name,
                "email": u.email,
                "role": u.role,
                "avatar_url": u.avatar_url
            },
            "active_task_count": len(active_tasks),
            "total_remaining_hours": round(total_rem_hours, 1),
            "capacity_status": "OVERLOADED" if total_rem_hours > 45 else ("OPTIMAL" if total_rem_hours > 15 else "AVAILABLE"),
            "is_on_leave_today": on_leave_today,
            "upcoming_leaves": [
                {
                    "id": l.id,
                    "start_date": str(l.start_date),
                    "end_date": str(l.end_date),
                    "reason": l.reason
                } for l in approved_leaves
            ]
        })

    return availability_list
