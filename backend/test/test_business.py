import pytest
from fastapi.testclient import TestClient

from app.auth.firebase_auth import get_current_uid
from app.main import app
from app.schemas.business import BusinessProfile
from app.services.firestore import get_store

PROFILE = {
    "name": "Demo Salon",
    "type": "Salon / Barbing",
    "location": "Awka",
    "power_sources": ["grid", "generator"],
    "operating_hours_per_day": 10,
    "operating_days_per_month": 26,
}


class MemoryStore:
    def __init__(self):
        self._data = {}

    def get_business(self, uid):
        return self._data.get(uid)

    def put_business(self, uid, profile: BusinessProfile):
        self._data[uid] = profile
        return profile


@pytest.fixture
def api():
    store = MemoryStore()
    current = {"uid": "user-a"}
    app.dependency_overrides[get_current_uid] = lambda: current["uid"]
    app.dependency_overrides[get_store] = lambda: store
    yield TestClient(app), current
    app.dependency_overrides.clear()


def test_save_then_read(api):
    client, _ = api
    assert client.put("/api/v1/business", json=PROFILE).status_code == 200
    response = client.get("/api/v1/business")
    assert response.status_code == 200
    assert response.json()["name"] == "Demo Salon"


def test_no_profile_returns_404(api):
    client, _ = api
    assert client.get("/api/v1/business").status_code == 404


def test_users_cannot_see_each_others_profile(api):
    client, current = api
    client.put("/api/v1/business", json=PROFILE)
    current["uid"] = "user-b"
    assert client.get("/api/v1/business").status_code == 404


def test_invalid_hours_rejected(api):
    client, _ = api
    bad = {**PROFILE, "operating_hours_per_day": 30}
    assert client.put("/api/v1/business", json=bad).status_code == 422