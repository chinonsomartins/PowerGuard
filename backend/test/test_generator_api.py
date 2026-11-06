import pytest
from fastapi.testclient import TestClient

from app.auth.firebase_auth import get_current_uid
from app.calc.generator import session_cost
from app.main import app
from app.services.firestore import get_store
from test.fakes import FakeStore


@pytest.fixture
def api():
    store = FakeStore()
    current = {"uid": "user-a"}
    app.dependency_overrides[get_current_uid] = lambda: current["uid"]
    app.dependency_overrides[get_store] = lambda: store
    yield TestClient(app), current
    app.dependency_overrides.clear()


def test_cost_measured_litres():
    r = session_cost(4, 1500, litres_consumed=6)
    assert r == {"basis": "measured", "fuel_cost_ngn": 9000, "cost_per_hour_ngn": 2250}


def test_cost_estimated_from_rate():
    r = session_cost(4, 1500, litres_per_hour_assumed=1.5)
    assert r["basis"] == "estimated" and r["fuel_cost_ngn"] == 9000 and r["cost_per_hour_ngn"] == 2250


def test_measured_wins_when_both_given():
    assert session_cost(2, 1000, litres_consumed=3, litres_per_hour_assumed=9)["fuel_cost_ngn"] == 3000


def test_cost_needs_a_basis_and_a_duration():
    with pytest.raises(ValueError):
        session_cost(4, 1500)
    with pytest.raises(ValueError):
        session_cost(0, 1500, litres_consumed=1)


def test_create_measured_session(api):
    client, _ = api
    r = client.post("/api/v1/generator-sessions", json={
        "date": "2026-11-02", "duration_hours": 4, "litres_consumed": 6, "fuel_price_ngn_per_l": 1500})
    assert r.status_code == 201
    body = r.json()
    assert body["basis"] == "measured" and body["fuel_cost_ngn"] == 9000
    assert body["cost_per_hour_ngn"] == 2250 and body["provenance"] == "manual"


def test_create_estimated_session(api):
    client, _ = api
    r = client.post("/api/v1/generator-sessions", json={
        "date": "2026-11-03", "duration_hours": 2.5, "litres_per_hour_assumed": 1.2, "fuel_price_ngn_per_l": 1500})
    assert r.status_code == 201 and r.json()["basis"] == "estimated"
    assert r.json()["fuel_cost_ngn"] == 4500  # 1.2 x 2.5 x 1500


@pytest.mark.parametrize("payload", [
    {"date": "2026-11-02", "duration_hours": 4, "fuel_price_ngn_per_l": 1500},                      # no basis
    {"date": "2026-11-02", "duration_hours": 0, "litres_consumed": 6, "fuel_price_ngn_per_l": 1500},  # zero runtime
    {"date": "2026-11-02", "duration_hours": 30, "litres_consumed": 6, "fuel_price_ngn_per_l": 1500}, # over 24 h
    {"date": "2026-11-02", "duration_hours": 4, "litres_consumed": -1, "fuel_price_ngn_per_l": 1500},
    {"date": "2026-11-02", "duration_hours": 2, "litres_consumed": 500, "fuel_price_ngn_per_l": 1500}, # 250 L/h
])
def test_invalid_sessions_rejected(api, payload):
    client, _ = api
    assert client.post("/api/v1/generator-sessions", json=payload).status_code == 422


def test_sessions_are_isolated_per_user(api):
    client, current = api
    client.post("/api/v1/generator-sessions", json={
        "date": "2026-11-02", "duration_hours": 4, "litres_consumed": 6, "fuel_price_ngn_per_l": 1500})
    assert len(client.get("/api/v1/generator-sessions").json()) == 1
    current["uid"] = "user-b"
    assert client.get("/api/v1/generator-sessions").json() == []