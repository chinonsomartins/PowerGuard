import pytest
from fastapi.testclient import TestClient

from app.auth.firebase_auth import get_current_uid
from app.calc import battery
from app.calc.comparison import compare_outage
from app.main import app

BANK = {"unit_voltage_v": 12, "unit_capacity_ah": 200, "n_series": 2, "n_parallel": 1}


def test_t4_runtime_and_t5_range():
    nominal = battery.bank_energy_wh(12, 200, 2, 1)
    assert nominal == 4800
    assert battery.runtime_hours(nominal, 600, 0.5, 0.9) == pytest.approx(3.6)
    r = battery.runtime_range(nominal, 600)
    assert r["low"] == pytest.approx(2.365, abs=0.005) and r["high"] == pytest.approx(4.089, abs=0.005)
    assert r["low"] <= r["base"] <= r["high"]


def test_parallel_bank_has_the_same_energy():
    assert battery.bank_energy_wh(12, 200, 1, 2) == 4800


def test_comparison_values():
    gen, inv = compare_outage(4, 600, generator_litres_per_hour=1.5, fuel_price_ngn_per_l=1500,
                              nominal_wh=4800, grid_tariff_ngn_per_kwh=200)["scenarios"]
    assert gen["cost_ngn"] == 9000      # 1.5 L/h x 1500 x 4 h
    assert inv["cost_ngn"] == 600       # 2.4 kWh / 0.8 x 200
    assert inv["covers_outage"] == "uncertain"
    assert compare_outage(2, 600, nominal_wh=4800)["scenarios"][1]["covers_outage"] == "yes"
    assert compare_outage(6, 600, nominal_wh=4800)["scenarios"][1]["covers_outage"] == "no"


def test_t7_missing_inputs_never_become_numbers():
    gen, inv = compare_outage(4, 600, nominal_wh=4800)["scenarios"]
    assert inv["cost_ngn"] is None and "grid_tariff_ngn_per_kwh" in inv["missing_inputs"]
    assert gen["cost_ngn"] is None and len(gen["missing_inputs"]) == 2


@pytest.fixture
def api():
    app.dependency_overrides[get_current_uid] = lambda: "user-a"
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_battery_endpoint(api):
    r = api.post("/api/v1/calc/battery-estimate", json={**BANK, "load_w": 600})
    assert r.status_code == 200
    body = r.json()
    assert body["nominal_wh"] == 4800 and body["runtime_hours"]["base"] == 3.6


def test_compare_endpoint_and_validation(api):
    ok = api.post("/api/v1/calc/compare", json={"outage_hours": 4, "load_w": 600, **BANK,
                  "generator_litres_per_hour": 1.5, "fuel_price_ngn_per_l": 1500, "grid_tariff_ngn_per_kwh": 200})
    assert ok.status_code == 200 and ok.json()["scenarios"][0]["cost_ngn"] == 9000
    assert api.post("/api/v1/calc/compare", json={"outage_hours": 4, "load_w": 600, "unit_voltage_v": 12}).status_code == 422
    assert api.post("/api/v1/calc/compare", json={"outage_hours": 0, "load_w": 600}).status_code == 422