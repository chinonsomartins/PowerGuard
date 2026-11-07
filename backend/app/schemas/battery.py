from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class BatteryEstimateRequest(BaseModel):
    unit_voltage_v: float = Field(gt=0, le=48)
    unit_capacity_ah: float = Field(gt=0, le=2000)
    n_series: int = Field(ge=1, le=16)
    n_parallel: int = Field(ge=1, le=16)
    load_w: float = Field(gt=0, le=100000)
    standby_w: float = Field(default=0, ge=0, le=5000)

    chemistry: Optional[str] = Field(default=None, max_length=40)
    usable_dod_percent: Optional[float] = Field(default=None, gt=0, le=100)
    capacity_health_percent: Optional[float] = Field(default=None, gt=0, le=100)
    inverter_efficiency_percent: Optional[float] = Field(default=None, gt=0, le=100)


class RuntimeRange(BaseModel):
    low: float
    base: float
    high: float


class BatteryEstimateResponse(BaseModel):
    bank_voltage_v: float
    bank_capacity_ah: float
    nominal_wh: float
    runtime_hours: RuntimeRange
    assumptions: List[str]
    basis: Literal["estimated"] = "estimated"