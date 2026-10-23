
from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.projects import router as projects_router
from app.api.v1.tasks import router as tasks_router
from app.api.v1.work_logs import router as work_logs_router
from app.api.v1.leave import router as leave_router
from app.api.v1.risk import router as risk_router
from app.api.v1.recovery import router as recovery_router
from app.api.v1.audit import router as audit_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.focus_guardian import router as focus_guardian_router
from app.api.v1.analytics import router as analytics_router
from app.api.v1.companies import router as companies_router

api_v1_router = APIRouter(prefix="/api/v1")

api_v1_router.include_router(auth_router)
api_v1_router.include_router(projects_router)
api_v1_router.include_router(tasks_router)
api_v1_router.include_router(work_logs_router)
api_v1_router.include_router(leave_router)
api_v1_router.include_router(risk_router)
api_v1_router.include_router(recovery_router)
api_v1_router.include_router(audit_router)
api_v1_router.include_router(notifications_router)
api_v1_router.include_router(focus_guardian_router)
api_v1_router.include_router(analytics_router)
api_v1_router.include_router(companies_router)
