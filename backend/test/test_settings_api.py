import pytest
from fastapi.testclient import TestClient

from app.auth.firebase_auth import get_current_uid
from app.main import app
from app.services.firestore import get_store
from test.fakes import FakeStore

BATTERY = {"unit_voltage_v": 12, "unit_capacity_ah": 200, "n_series": 2, "n_parallel": 1, "load_w": 600, "standby_w": 0}
COMPARE = {**BATTERY, "outage_hours": 4, "generator_litres_per_hour": 1.5,
           "fuel_price_ngn_per_l": 1500, "grid_tariff_ngn_per_kwh": 200}
COMPARE.pop("standby_w")


@pytest.fixture
def api():
    store = FakeStore()
    current = {"uid": "user-a"}
    app.dependency_overrides[get_current_uid] = lambda: current["uid"]
    app.dependency_overrides[get_store] = lambda: store
    yield TestClient(app), current
    app.dependency_overrides.clear()


def test_battery_profile_is_saved_and_read_back(api):
    client, _ = api
    assert client.get("/api/v1/battery-profile").status_code == 404
    assert client.put("/api/v1/battery-profile", json=BATTERY).status_code == 200
    assert client.get("/api/v1/battery-profile").json()["load_w"] == 600


def test_compare_inputs_are_saved_and_read_back(api):
    client, _ = api
    assert client.put("/api/v1/compare-inputs", json=COMPARE).status_code == 200
    assert client.get("/api/v1/compare-inputs").json()["outage_hours"] == 4


def test_saved_inputs_are_private_to_each_user(api):
    client, current = api
    client.put("/api/v1/battery-profile", json=BATTERY)
    current["uid"] = "user-b"
    assert client.get("/api/v1/battery-profile").status_code == 404


def test_invalid_saved_inputs_are_rejected(api):
    client, _ = api
    assert client.put("/api/v1/battery-profile", json={**BATTERY, "load_w": -5}).status_code == 422
    assert client.put("/api/v1/compare-inputs", json={**COMPARE, "outage_hours": 0}).status_code == 422


def test_dashboard_uses_saved_battery_and_compare_inputs(api):
    client, _ = api
    empty = client.get("/api/v1/dashboard").json()
    assert empty["summary"]["batteryRuntimeHours"] is None and empty["insights"]["bestOption"] is None
    client.put("/api/v1/battery-profile", json=BATTERY)
    client.put("/api/v1/compare-inputs", json=COMPARE)
    body = client.get("/api/v1/dashboard").json()
    assert body["summary"]["batteryRuntimeHours"] == 3.6
    assert body["insights"]["batteryLoadWatts"] == 600
    assert body["insights"]["bestOption"]["name"] == "Inverter"   # 600 vs 9,000 naira

def test_dashboard_uses_the_users_own_battery_percentages(api):
    client, _ = api
    client.put("/api/v1/battery-profile", json={
        "unit_voltage_v": 24, "unit_capacity_ah": 200, "n_series": 1, "n_parallel": 1,
        "load_w": 400, "usable_dod_percent": 80, "capacity_health_percent": 100,
        "inverter_efficiency_percent": 90})
    body = client.get("/api/v1/dashboard").json()
    assert body["summary"]["batteryRuntimeHours"] == 8.6   # 24 x 200 x 0.8 x 0.9 / 400 = 8.64  