from fastapi.testclient import TestClient

from app.auth.firebase_auth import get_current_uid
from app.main import app

client = TestClient(app)


def test_me_requires_a_token():
    assert client.get("/api/v1/me").status_code == 401


def test_me_returns_uid_when_authenticated():
    app.dependency_overrides[get_current_uid] = lambda: "test-uid"
    try:
        response = client.get("/api/v1/me")
        assert response.status_code == 200
        assert response.json() == {"uid": "test-uid"}
    finally:
        app.dependency_overrides.clear()