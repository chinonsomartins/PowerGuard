from dotenv import load_dotenv

load_dotenv()

from app.schemas.business import BusinessProfile
from app.services.firestore import get_store

store = get_store()
profile = BusinessProfile(
    name="Store Check",
    type="Other",
    location="",
    power_sources=["grid"],
    operating_hours_per_day=8,
    operating_days_per_month=20,
)

try:
    store.put_business("check-uid-a", profile)
    assert store.get_business("check-uid-a").name == "Store Check"
    assert store.get_business("check-uid-b") is None
    print("Write, read and isolation OK")
finally:
    store._business_ref("check-uid-a").delete()
    print("Test data removed")