from fastapi import APIRouter, HTTPException

from app.auth.firebase_auth import get_current_uid

from app.schemas.business import BusinessProfile

router = APIRouter(prefix="/api/v1", tags=["business"])

# TEMPORARY: in-memory storage and a fixed user.
# Replaced by Firestore and the verified Firebase uid in the next steps.
_profiles: dict[str, BusinessProfile] = {}


@router.put("/business", response_model=BusinessProfile)
def save_business(profile: BusinessProfile, uid: str = Depends(get_current_uid)):
    _profiles[uid] = profile
    return profile


@router.get("/business", response_model=BusinessProfile)
def read_business():
    profile = _profiles.get(TEMP_UID)
    if profile is None:
        raise HTTPException(status_code=404, detail="Business profile not set")
    return profile