from fastapi import APIRouter, Depends, HTTPException

from app.auth.firebase_auth import get_current_uid
from app.schemas.battery import BatteryEstimateRequest
from app.schemas.compare import OutageCompareRequest
from app.services.firestore import get_store

router = APIRouter(prefix="/api/v1", tags=["saved inputs"])


@router.put("/battery-profile", response_model=BatteryEstimateRequest)
def save_battery_profile(
    profile: BatteryEstimateRequest,
    uid: str = Depends(get_current_uid),
    store=Depends(get_store),
):
    store.put_setting(uid, "battery_profile", profile.model_dump())
    return profile


@router.get("/battery-profile", response_model=BatteryEstimateRequest)
def read_battery_profile(uid: str = Depends(get_current_uid), store=Depends(get_store)):
    data = store.get_setting(uid, "battery_profile")
    if data is None:
        raise HTTPException(404, "Battery profile not set")
    return BatteryEstimateRequest(**data)


@router.put("/compare-inputs", response_model=OutageCompareRequest)
def save_compare_inputs(
    inputs: OutageCompareRequest,
    uid: str = Depends(get_current_uid),
    store=Depends(get_store),
):
    store.put_setting(uid, "compare_inputs", inputs.model_dump())
    return inputs


@router.get("/compare-inputs", response_model=OutageCompareRequest)
def read_compare_inputs(uid: str = Depends(get_current_uid), store=Depends(get_store)):
    data = store.get_setting(uid, "compare_inputs")
    if data is None:
        raise HTTPException(404, "Compare inputs not set")
    return OutageCompareRequest(**data)