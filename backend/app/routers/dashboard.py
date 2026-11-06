from datetime import timedelta

from fastapi import APIRouter, Depends, Query

from app.auth.firebase_auth import get_current_uid
from app.schemas.dashboard import DashboardResponse
from app.services.dashboard import RANGE_DAYS, build_dashboard, today_lagos, window_start
from app.services.firestore import get_store

router = APIRouter(prefix="/api/v1", tags=["dashboard"])


@router.get("/dashboard", response_model=DashboardResponse)
def dashboard(
    range_: str = Query(default="30d", alias="range", pattern="^(7d|30d|90d)$"),
    uid: str = Depends(get_current_uid),
    store=Depends(get_store),
):
    days = RANGE_DAYS[range_]
    today = today_lagos()
    start = window_start(today, days).isoformat()
    end = (today + timedelta(days=1)).isoformat()
    return build_dashboard(
        profile=store.get_business(uid),
        expenses=store.list_expenses(uid, start=start, end=end, limit=2000),
        sessions=store.list_generator_sessions(uid, start=start, end=end, limit=1000),
        today=today,
        range_days=days,
    )