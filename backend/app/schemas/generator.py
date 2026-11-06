from datetime import date as Date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator


class GeneratorSessionCreate(BaseModel):
    date: Date
    duration_hours: float = Field(gt=0, le=24)
    litres_consumed: Optional[float] = Field(default=None, gt=0, le=1000)
    litres_per_hour_assumed: Optional[float] = Field(default=None, gt=0, le=50)
    fuel_price_ngn_per_l: float = Field(gt=0, le=5000)
    note: str = Field(default="", max_length=300)
    linked_expense_id: Optional[str] = None

    @model_validator(mode="after")
    def need_a_consumption_basis(self):
        if self.litres_consumed is None and self.litres_per_hour_assumed is None:
            raise ValueError(
                "Provide litres_consumed (measured) or litres_per_hour_assumed (estimated)"
            )
        return self


class GeneratorSession(GeneratorSessionCreate):
    id: str
    basis: Literal["measured", "estimated"]
    fuel_cost_ngn: float
    cost_per_hour_ngn: float
    provenance: Literal["manual", "sample_demo", "simulated"]
    created_at: datetime