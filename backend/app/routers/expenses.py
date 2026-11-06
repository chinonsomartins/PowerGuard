from typing import List, Optional

from fastapi import APIRouter, Depends, Query

from app.auth.firebase_auth import get_current_uid
from app.schemas.expense import Expense, ExpenseCreate, ExpenseSource
from app.services.dates import month_bounds
from app.services.firestore import get_store

router = APIRouter(prefix="/api/v1", tags=["expenses"])


@router.post("/expenses", response_model=Expense, status_code=201)
def create_expense(
    data: ExpenseCreate,
    uid: str = Depends(get_current_uid),
    store=Depends(get_store),
):
    # Task 1: validated by ExpenseCreate, saved under the verified uid.
    return store.add_expense(uid, data)


@router.get("/expenses", response_model=List[Expense])
def list_expenses(
    month: Optional[str] = Query(default=None, pattern=r"^\d{4}-\d{2}$"),
    source: Optional[ExpenseSource] = None,
    limit: int = Query(default=100, ge=1, le=500),
    uid: str = Depends(get_current_uid),
    store=Depends(get_store),
):
    # Task 2: only the caller's records; filters are month and source.
    start, end = month_bounds(month) if month else (None, None)
    items = store.list_expenses(uid, start=start, end=end, limit=500)
    if source:
        items = [e for e in items if e.source == source]
    return items[:limit]