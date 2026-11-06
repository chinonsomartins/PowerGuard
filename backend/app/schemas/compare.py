from typing import Optional

from pydantic import BaseModel, Field, model_validator


class OutageCompareRequest(BaseModel):
    outage_hours: float = Field(gt=0, le=72)
    load_w: float = Field(gt=0, le=100000)
    standby_w: float = Field(default=0, ge=0, le=5000)
    generator_litres_per_hour: Optional[float] = Field(default=None, gt=0, le=50)
    fuel_price_ngn_per_l: Optional[float] = Field(default=None, gt=0, le=5000)
    grid_tariff_ngn_per_kwh: Optional[float] = Field(default=None, ge=0, le=5000)
    unit_voltage_v: Optional[float] = Field(default=None, gt=0, le=48)
    unit_capacity_ah: Optional[float] = Field(default=None, gt=0, le=2000)
    n_series: Optional[int] = Field(default=None, ge=1, le=16)
    n_parallel: Optional[int] = Field(default=None, ge=1, le=16)

    @model_validator(mode="after")
    def battery_fields_all_or_none(self):
        given = [v is not None for v in (self.unit_voltage_v, self.unit_capacity_ah, self.n_series, self.n_parallel)]
        if any(given) and not all(given):
            raise ValueError("Provide all four battery fields (unit_voltage_v, unit_capacity_ah, n_series, n_parallel) or none")
        return self