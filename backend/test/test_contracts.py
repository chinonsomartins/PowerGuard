import pytest
from pydantic import ValidationError

from app.schemas.battery import BatteryEstimateResponse
from app.schemas.dashboard import DashboardResponse
from app.schemas.expense import ExpenseCreate
from app.schemas.generator import GeneratorSessionCreate


def test_expense_valid_fuel_expense():
    e = ExpenseCreate(
        date="2026-10-12", amount_ngn=45000, source="generator_fuel",
        litres=30, fuel_type="petrol", unit_price_ngn_per_l=1500,
    )
    assert e.provenance == "manual"


def test_expense_rejects_negative_amount():
    with pytest.raises(ValidationError):
        ExpenseCreate(date="2026-10-12", amount_ngn=-5, source="grid")


def test_expense_rejects_unknown_source():
    with pytest.raises(ValidationError):
        ExpenseCreate(date="2026-10-12", amount_ngn=100, source="solar")


def test_expense_rejects_client_set_ai_provenance():
    with pytest.raises(ValidationError):
        ExpenseCreate(date="2026-10-12", amount_ngn=100, source="grid",
                      provenance="ai_extracted_confirmed")


def test_fuel_fields_rejected_on_grid_expense():
    with pytest.raises(ValidationError):
        ExpenseCreate(date="2026-10-12", amount_ngn=100, source="grid", litres=5)


def test_generator_session_needs_consumption_basis():
    with pytest.raises(ValidationError):
        GeneratorSessionCreate(date="2026-10-12", duration_hours=4, fuel_price_ngn_per_l=1500)


def test_generator_session_accepts_measured_litres():
    s = GeneratorSessionCreate(date="2026-10-12", duration_hours=4,
                               litres_consumed=6, fuel_price_ngn_per_l=1500)
    assert s.litres_consumed == 6


def test_battery_response_shape():
    r = BatteryEstimateResponse(
        bank_voltage_v=24, bank_capacity_ah=200, nominal_wh=4800,
        runtime_hours={"low": 2.37, "base": 3.6, "high": 4.09},
        assumptions=["Estimate only"],
    )
    assert r.runtime_hours.low <= r.runtime_hours.base <= r.runtime_hours.high


def test_dashboard_matches_frontend_shape():
    empty = {"labels": [], "total": [], "grid": [], "generator": []}
    payload = {
        "user": None,
        "business": {"powerSources": ["grid", "generator"]},
        "summary": {
            "totalExpenses": {"amount": 0, "changePercent": None},
            "generatorFuel": {"amount": 0, "changePercent": None},
            "gridElectricity": {"amount": 0, "changePercent": None},
            "batteryRuntimeHours": None,
        },
        "trend": {"weekly": empty, "monthly": empty, "yearly": empty},
        "breakdown": {"grid": 0, "generator": 0},
        "activity": [],
        "insights": {"generatorCostPerHour": None, "batteryRuntimeHours": None,
                     "batteryLoadWatts": None, "bestOption": None},
    }
    out = DashboardResponse.model_validate(payload).model_dump(by_alias=True)
    assert "totalExpenses" in out["summary"]
    assert "changePercent" in out["summary"]["generatorFuel"]
    assert out["business"]["powerSources"] == ["grid", "generator"]