from fastapi import APIRouter, Depends, HTTPException

from app.auth.firebase_auth import get_current_uid
from app.schemas.business import BusinessProfile
from app.services.firestore import get_store

router = APIRouter(prefix="/api/v1", tags=["business"])


@router.put("/business", response_model=BusinessProfile)
def save_business(
    profile: BusinessProfile,
    uid: str = Depends(get_current_uid),
    store=Depends(get_store),
):
    return store.put_business(uid, profile)


@router.get("/business", response_model=BusinessProfile)
def read_business(
    uid: str = Depends(get_current_uid),
    store=Depends(get_store),
):
    profile = store.get_business(uid)
    if profile is None:
        raise HTTPException(status_code=404, detail="Business profile not set")
    return profile