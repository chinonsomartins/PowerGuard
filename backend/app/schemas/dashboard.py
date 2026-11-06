from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """The dashboard JSON is camelCase because Dashbroad.js was built that way."""
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class Metric(CamelModel):
    amount: float = 0
    change_percent: Optional[float] = None


class DashboardSummary(CamelModel):
    total_expenses: Metric
    generator_fuel: Metric
    grid_electricity: Metric
    battery_runtime_hours: Optional[float] = None
    # Additive fields: the current dashboard ignores them until a card is added.
    cost_per_operating_hour: Optional[float] = None
    power_share_of_revenue_pct: Optional[float] = None


class TrendSeries(CamelModel):
    labels: List[str] = Field(default_factory=list)
    total: List[float] = Field(default_factory=list)
    grid: List[float] = Field(default_factory=list)
    generator: List[float] = Field(default_factory=list)


class Trend(CamelModel):
    weekly: TrendSeries
    monthly: TrendSeries
    yearly: TrendSeries


class Breakdown(CamelModel):
    grid: float = 0
    generator: float = 0


class ActivityItem(CamelModel):
    timestamp: str  # ISO 8601, e.g. 2026-10-26T10:45:00
    message: str


class BestOption(CamelModel):
    name: str
    label: str


class Insights(CamelModel):
    generator_cost_per_hour: Optional[float] = None
    battery_runtime_hours: Optional[float] = None
    battery_load_watts: Optional[float] = None
    best_option: Optional[BestOption] = None


class BusinessInfo(CamelModel):
    power_sources: List[Literal["grid", "generator", "battery"]] = Field(default_factory=list)


class UserInfo(CamelModel):
    full_name: str = ""
    business_name: str = ""


class DashboardResponse(CamelModel):
    user: Optional[UserInfo] = None
    business: BusinessInfo
    summary: DashboardSummary
    trend: Trend
    breakdown: Breakdown
    activity: List[ActivityItem] = Field(default_factory=list)
    insights: Insights