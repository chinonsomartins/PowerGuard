from fastapi import APIRouter, Depends

from app.auth.firebase_auth import get_current_uid

router = APIRouter(prefix="/api/v1", tags=["me"])


@router.get("/me")
def me(uid: str = Depends(get_current_uid)):
    return {"uid": uid}