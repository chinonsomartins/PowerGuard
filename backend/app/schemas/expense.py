from datetime import date as Date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator

ExpenseSource = Literal["grid", "generator_fuel", "inverter_battery", "other"]
FuelType = Literal["petrol", "diesel"]


class ExpenseCreate(BaseModel):
    date: Date
    amount_ngn: float = Field(gt=0, le=100_000_000)
    source: ExpenseSource
    note: str = Field(default="", max_length=300)
    litres: Optional[float] = Field(default=None, gt=0, le=1000)
    fuel_type: Optional[FuelType] = None
    unit_price_ngn_per_l: Optional[float] = Field(default=None, gt=0, le=5000)
    # Clients may only create manual or demo records. "ai_extracted_confirmed"
    # is set by the receipt-confirm endpoint, never by the client.
    provenance: Literal["manual", "sample_demo"] = "manual"

    @model_validator(mode="after")
    def fuel_fields_only_for_fuel(self):
        has_fuel_fields = any(
            value is not None
            for value in (self.litres, self.fuel_type, self.unit_price_ngn_per_l)
        )
        if has_fuel_fields and self.source != "generator_fuel":
            raise ValueError(
                "litres, fuel_type and unit_price_ngn_per_l are only allowed when source is generator_fuel"
            )
        return self


class Expense(ExpenseCreate):
    id: str
    provenance: Literal["manual", "ai_extracted_confirmed", "sample_demo", "simulated"]
    created_at: datetime