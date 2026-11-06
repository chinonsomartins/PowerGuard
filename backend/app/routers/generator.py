from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.auth.firebase_auth import get_current_uid
from app.calc.generator import session_cost
from app.schemas.generator import GeneratorSession, GeneratorSessionCreate
from app.services.dates import month_bounds
from app.services.firestore import get_store

router = APIRouter(prefix="/api/v1", tags=["generator"])

# Speculative upper limit; review against real generator sizes.
MAX_LITRES_PER_HOUR = 50


@router.post("/generator-sessions", response_model=GeneratorSession, status_code=201)
def create_session(
    data: GeneratorSessionCreate,
    uid: str = Depends(get_current_uid),
    store=Depends(get_store),
):
    if data.litres_consumed is not None:
        if data.litres_consumed / data.duration_hours > MAX_LITRES_PER_HOUR:
            raise HTTPException(
                422,
                f"litres_consumed implies more than {MAX_LITRES_PER_HOUR} L per hour; check litres and duration",
            )
    computed = session_cost(
        data.duration_hours,
        data.fuel_price_ngn_per_l,
        data.litres_consumed,
        data.litres_per_hour_assumed,
    )
    return store.add_generator_session(uid, data, computed)


@router.get("/generator-sessions", response_model=List[GeneratorSession])
def list_sessions(
    month: Optional[str] = Query(default=None, pattern=r"^\d{4}-\d{2}$"),
    limit: int = Query(default=100, ge=1, le=500),
    uid: str = Depends(get_current_uid),
    store=Depends(get_store),
):
    start, end = month_bounds(month) if month else (None, None)
    return store.list_generator_sessions(uid, start=start, end=end, limit=limit)