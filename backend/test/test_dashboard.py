from datetime import date, datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.auth.firebase_auth import get_current_uid
from app.main import app
from app.schemas.business import BusinessProfile
from app.schemas.expense import Expense
from app.schemas.generator import GeneratorSession
from app.services.dashboard import build_dashboard
from app.services.firestore import get_store
from test.fakes import FakeStore

TODAY = date(2026, 11, 6)
PROFILE = BusinessProfile(
    name="Demo Salon", type="Salon / Barbing", location="Awka",
    power_sources=["grid", "generator"],
    operating_hours_per_day=10, operating_days_per_month=26,
    monthly_revenue_ngn=1_300_000,
)


def exp(id_, day, amount, source):
    return Expense(
        id=id_, date=day, amount_ngn=amount, source=source, note="", provenance="manual",
        created_at=datetime(day.year, day.month, day.day, 9, tzinfo=timezone.utc),
    )


EXPENSES = [
    exp("1", date(2026, 11, 5), 20000, "grid"),
    exp("2", date(2026, 11, 4), 30000, "generator_fuel"),
    exp("3", date(2026, 10, 28), 10000, "grid"),  # falls in the previous 7-day period
]


def test_totals_breakdown_and_change_for_7_days():
    r = build_dashboard(PROFILE, EXPENSES, [], TODAY, 7)
    assert r.summary.total_expenses.amount == 50000
    assert r.summary.generator_fuel.amount == 30000
    assert r.summary.grid_electricity.amount == 20000
    assert r.breakdown.grid == 20000 and r.breakdown.generator == 30000
    assert r.summary.total_expenses.change_percent == 400.0   # (50000-10000)/10000
    assert r.summary.grid_electricity.change_percent == 100.0  # (20000-10000)/10000
    assert r.summary.generator_fuel.change_percent is None     # nothing in the previous period


def test_trend_series():
    r = build_dashboard(PROFILE, EXPENSES, [], TODAY, 7)
    weekly = r.trend.weekly
    assert len(weekly.labels) == 7 and weekly.labels[0] == "Oct 31" and weekly.labels[-1] == "Nov 06"
    assert weekly.total[-2] == 20000 and weekly.total[-3] == 30000
    assert sum(weekly.total) == 50000
    yearly = r.trend.yearly
    assert yearly.labels[-1] == "Nov" and yearly.total[-1] == 50000 and yearly.total[-2] == 10000


def test_cost_per_operating_hour_and_revenue_share():
    r = build_dashboard(PROFILE, [exp("1", date(2026, 11, 1), 78000, "grid")], [], TODAY, 30)
    assert r.summary.cost_per_operating_hour == 300.0   # 78000 / (10 h x 26 d)
    assert r.summary.power_share_of_revenue_pct == 6.0  # 78000 / 1,300,000


def test_generator_summary_and_latest_session_cost():
    session = GeneratorSession(
        id="s1", date=date(2026, 11, 5), duration_hours=4, litres_consumed=6,
        fuel_price_ngn_per_l=1500, basis="measured", fuel_cost_ngn=9000,
        cost_per_hour_ngn=2250, provenance="manual",
        created_at=datetime(2026, 11, 5, 20, tzinfo=timezone.utc),
    )
    r = build_dashboard(PROFILE, [], [session], TODAY, 30)
    assert r.summary.generator_hours == 4 and r.summary.generator_sessions == 1
    assert r.insights.generator_cost_per_hour == 2250
    assert r.activity[0].message == "Generator session recorded (4 hrs)"


def test_user_with_no_records_gets_zeros_and_nulls():
    r = build_dashboard(None, [], [], TODAY, 30)
    assert r.summary.total_expenses.amount == 0 and r.summary.total_expenses.change_percent is None
    assert r.summary.cost_per_operating_hour is None
    assert r.activity == [] and r.business.power_sources == [] and r.user is None
    assert all(v == 0 for v in r.trend.weekly.total) and len(r.trend.weekly.labels) == 7


@pytest.fixture
def api():
    app.dependency_overrides[get_current_uid] = lambda: "user-a"
    app.dependency_overrides[get_store] = lambda: FakeStore()
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_endpoint_returns_the_camel_case_shape_for_an_empty_user(api):
    r = api.get("/api/v1/dashboard")
    assert r.status_code == 200
    body = r.json()
    assert body["summary"]["totalExpenses"]["amount"] == 0
    assert "generatorHours" in body["summary"] and "bestOption" in body["insights"]


def test_endpoint_rejects_an_unknown_range(api):
    assert api.get("/api/v1/dashboard", params={"range": "1y"}).status_code == 422