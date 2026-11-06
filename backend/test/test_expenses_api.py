import pytest
from fastapi.testclient import TestClient

from app.auth.firebase_auth import get_current_uid
from app.main import app
from app.services.firestore import get_store
from test.fakes import FakeStore

FUEL = {
    "date": "2026-10-12", "amount_ngn": 45000, "source": "generator_fuel",
    "note": "30 L petrol", "litres": 30, "fuel_type": "petrol", "unit_price_ngn_per_l": 1500,
}


@pytest.fixture
def api():
    store = FakeStore()
    current = {"uid": "user-a"}
    app.dependency_overrides[get_current_uid] = lambda: current["uid"]
    app.dependency_overrides[get_store] = lambda: store
    yield TestClient(app), current, store
    app.dependency_overrides.clear()


def test_create_expense_is_saved_for_the_caller(api):
    client, _, store = api
    response = client.post("/api/v1/expenses", json=FUEL)
    assert response.status_code == 201
    body = response.json()
    assert body["amount_ngn"] == 45000 and body["provenance"] == "manual" and body["id"]
    assert len(store.expenses["user-a"]) == 1 and "user-b" not in store.expenses


def test_endpoints_require_a_token():
    app.dependency_overrides[get_store] = lambda: FakeStore()
    try:
        client = TestClient(app)
        assert client.post("/api/v1/expenses", json=FUEL).status_code == 401
        assert client.get("/api/v1/expenses").status_code == 401
    finally:
        app.dependency_overrides.clear()


@pytest.mark.parametrize("change", [
    {"amount_ngn": -5},
    {"amount_ngn": 0},
    {"source": "solar"},
    {"provenance": "ai_extracted_confirmed"},
    {"source": "grid"},  # fuel fields are not allowed on a grid expense
])
def test_invalid_expenses_are_rejected(api, change):
    client, _, _ = api
    assert client.post("/api/v1/expenses", json={**FUEL, **change}).status_code == 422


def test_list_filters_by_month_and_source(api):
    client, _, _ = api
    client.post("/api/v1/expenses", json=FUEL)
    client.post("/api/v1/expenses", json={"date": "2026-10-20", "amount_ngn": 60000, "source": "grid"})
    client.post("/api/v1/expenses", json={"date": "2026-09-30", "amount_ngn": 5000, "source": "grid"})
    assert len(client.get("/api/v1/expenses").json()) == 3
    assert len(client.get("/api/v1/expenses", params={"month": "2026-10"}).json()) == 2
    only_grid = client.get("/api/v1/expenses", params={"month": "2026-10", "source": "grid"}).json()
    assert [e["amount_ngn"] for e in only_grid] == [60000]
    assert client.get("/api/v1/expenses", params={"month": "2026-13"}).status_code == 422


def test_users_only_see_their_own_expenses(api):
    client, current, _ = api
    client.post("/api/v1/expenses", json=FUEL)
    current["uid"] = "user-b"
    assert client.get("/api/v1/expenses").json() == []