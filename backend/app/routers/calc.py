from fastapi import APIRouter, Depends

from app.auth.firebase_auth import get_current_uid
from app.calc import battery
from app.calc.comparison import compare_outage
from app.schemas.battery import BatteryEstimateRequest, BatteryEstimateResponse, RuntimeRange
from app.schemas.compare import OutageCompareRequest

router = APIRouter(prefix="/api/v1/calc", tags=["calc"])


@router.post("/battery-estimate", response_model=BatteryEstimateResponse)
def battery_estimate(req: BatteryEstimateRequest, uid: str = Depends(get_current_uid)):
    nominal = battery.bank_energy_wh(req.unit_voltage_v, req.unit_capacity_ah, req.n_series, req.n_parallel)
    rng = battery.runtime_range(nominal, req.load_w, req.standby_w)
    assumptions = [
        f"{name}: depth of discharge {p['usable_dod']}, inverter efficiency {p['inverter_efficiency']}, load x{p['load_factor']}"
        for name, p in battery.SCENARIOS.items()
    ]
    assumptions.append("Estimate only. Real runtime depends on battery age, temperature and load.")
    return BatteryEstimateResponse(
        bank_voltage_v=req.unit_voltage_v * req.n_series,
        bank_capacity_ah=req.unit_capacity_ah * req.n_parallel,
        nominal_wh=round(nominal, 2),
        runtime_hours=RuntimeRange(**{k: round(v, 2) for k, v in rng.items()}),
        assumptions=assumptions,
    )


@router.post("/compare")
def compare(req: OutageCompareRequest, uid: str = Depends(get_current_uid)):
    nominal = None
    if req.unit_voltage_v is not None:
        nominal = battery.bank_energy_wh(req.unit_voltage_v, req.unit_capacity_ah, req.n_series, req.n_parallel)
    return compare_outage(
        outage_hours=req.outage_hours, load_w=req.load_w, standby_w=req.standby_w,
        generator_litres_per_hour=req.generator_litres_per_hour,
        fuel_price_ngn_per_l=req.fuel_price_ngn_per_l, nominal_wh=nominal,
        grid_tariff_ngn_per_kwh=req.grid_tariff_ngn_per_kwh,
    )