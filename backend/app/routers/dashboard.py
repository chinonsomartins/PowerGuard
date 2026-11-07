from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.auth.firebase_auth import get_current_uid
from app.calc.battery import bank_energy_wh, runtime_hours, runtime_range
from app.calc.comparison import compare_from_request
from app.schemas.battery import BatteryEstimateRequest
from app.schemas.compare import OutageCompareRequest
from app.schemas.dashboard import BestOption, DashboardResponse
from app.services.dashboard import RANGE_DAYS, build_dashboard, today_lagos, window_start
from app.services.firestore import get_store

router = APIRouter(prefix="/api/v1", tags=["dashboard"])


def _best_option(store, uid: str) -> Optional[BestOption]:
    """Cheaper of generator and inverter for the saved outage, only when both costs are known."""
    saved = store.get_setting(uid, "compare_inputs")
    if not saved:
        return None
    result = compare_from_request(OutageCompareRequest(**saved))
    generator, inverter = result["scenarios"]
    if generator["cost_ngn"] is None or inverter["cost_ngn"] is None:
        return None
    if inverter["covers_outage"] == "no":
        return None  # the battery would not last the outage, so no inverter claim
    name = "Inverter" if inverter["cost_ngn"] < generator["cost_ngn"] else "Generator"
    return BestOption(name=name, label=f"Lower estimated cost, {result['outage_hours']:g}-hour outage")


@router.get("/dashboard", response_model=DashboardResponse)
def dashboard(
    range_: str = Query(default="30d", alias="range", pattern="^(7d|30d|90d)$"),
    uid: str = Depends(get_current_uid),
    store=Depends(get_store),
):
    days = RANGE_DAYS[range_]
    today = today_lagos()
    start = window_start(today, days).isoformat()
    end = (today + timedelta(days=1)).isoformat()
    result = build_dashboard(
        profile=store.get_business(uid),
        expenses=store.list_expenses(uid, start=start, end=end, limit=2000),
        sessions=store.list_generator_sessions(uid, start=start, end=end, limit=1000),
        today=today,
        range_days=days,
    )

    saved_battery = store.get_setting(uid, "battery_profile")
    if saved_battery:
        battery = BatteryEstimateRequest(**saved_battery)
        nominal = bank_energy_wh(
            battery.unit_voltage_v, battery.unit_capacity_ah, battery.n_series, battery.n_parallel
        )
        if battery.usable_dod_percent and battery.inverter_efficiency_percent:
            base = runtime_hours(
                nominal,
                battery.load_w,
                battery.usable_dod_percent / 100,
                battery.inverter_efficiency_percent / 100,
                (battery.capacity_health_percent or 100) / 100,
                battery.standby_w,
            )
        else:
            base = runtime_range(nominal, battery.load_w, battery.standby_w)["base"]
        base_hours = round(base, 1)
        result.summary.battery_runtime_hours = base_hours
        result.insights.battery_runtime_hours = base_hours
        result.insights.battery_load_watts = battery.load_w

    result.insights.best_option = _best_option(store, uid)
    return result