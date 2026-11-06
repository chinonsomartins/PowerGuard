from datetime import date, datetime, timedelta, timezone
from typing import List, Optional

from app.schemas.business import BusinessProfile
from app.schemas.dashboard import (
    ActivityItem, Breakdown, BusinessInfo, DashboardResponse, DashboardSummary,
    Insights, Metric, Trend, TrendSeries, UserInfo,
)
from app.schemas.expense import Expense
from app.schemas.generator import GeneratorSession

LAGOS = timezone(timedelta(hours=1))  # Nigeria has no daylight saving
RANGE_DAYS = {"7d": 7, "30d": 30, "90d": 90}
SOURCE_LABELS = {
    "grid": "Grid electricity",
    "generator_fuel": "Generator fuel",
    "inverter_battery": "Inverter/battery",
    "other": "Other",
}


def today_lagos() -> date:
    return datetime.now(LAGOS).date()


def _month_start(d: date, shift: int) -> date:
    index = d.year * 12 + (d.month - 1) + shift
    return date(index // 12, index % 12 + 1, 1)


def window_start(today: date, range_days: int) -> date:
    """Earliest date any dashboard figure needs (previous period, 6 weeks, 6 months)."""
    end = today + timedelta(days=1)
    return min(
        end - timedelta(days=2 * range_days),
        end - timedelta(days=42),
        _month_start(today, -5),
    )


def _sum(expenses: List[Expense], start: date, end: date, source: Optional[str] = None) -> float:
    return sum(
        e.amount_ngn for e in expenses
        if start <= e.date < end and (source is None or e.source == source)
    )


def _change(current: float, previous: float) -> Optional[float]:
    if previous <= 0:
        return None
    return round((current - previous) / previous * 100, 1)


def _metric(expenses, start, end, prev_start, source=None) -> Metric:
    current = _sum(expenses, start, end, source)
    previous = _sum(expenses, prev_start, start, source)
    return Metric(amount=round(current, 2), change_percent=_change(current, previous))


def _series(expenses, buckets) -> TrendSeries:
    return TrendSeries(
        labels=[label for label, _, _ in buckets],
        total=[round(_sum(expenses, s, e), 2) for _, s, e in buckets],
        grid=[round(_sum(expenses, s, e, "grid"), 2) for _, s, e in buckets],
        generator=[round(_sum(expenses, s, e, "generator_fuel"), 2) for _, s, e in buckets],
    )


def build_dashboard(
    profile: Optional[BusinessProfile],
    expenses: List[Expense],
    sessions: List[GeneratorSession],
    today: date,
    range_days: int,
) -> DashboardResponse:
    end = today + timedelta(days=1)
    start = end - timedelta(days=range_days)
    prev_start = start - timedelta(days=range_days)

    total = _metric(expenses, start, end, prev_start)
    fuel = _metric(expenses, start, end, prev_start, "generator_fuel")
    grid = _metric(expenses, start, end, prev_start, "grid")

    # Approximation: the profile gives operating hours per month, scaled to the window.
    cost_per_hour = share = None
    if profile is not None and total.amount > 0:
        hours = profile.operating_hours_per_day * profile.operating_days_per_month * range_days / 30
        cost_per_hour = round(total.amount / hours, 2)
        if profile.monthly_revenue_ngn:
            share = round(total.amount / (profile.monthly_revenue_ngn * range_days / 30) * 100, 1)

    in_window = [s for s in sessions if start <= s.date < end]
    latest = max(sessions, key=lambda s: (s.date, s.created_at), default=None)

    weekly = [
        ((today - timedelta(days=i)).strftime("%b %d"),
         today - timedelta(days=i), today - timedelta(days=i - 1))
        for i in range(6, -1, -1)
    ]
    monthly = []
    for i in range(5, -1, -1):
        b_end = end - timedelta(days=7 * i)
        b_start = b_end - timedelta(days=7)
        monthly.append((b_start.strftime("%b %d"), b_start, b_end))
    yearly = []
    for k in range(5, -1, -1):
        m_start = _month_start(today, -k)
        yearly.append((m_start.strftime("%b"), m_start, _month_start(today, -k + 1)))

    events = [
        (e.created_at, f"{SOURCE_LABELS[e.source]} expense added (₦{e.amount_ngn:,.0f})")
        for e in expenses
    ] + [
        (s.created_at, f"Generator session recorded ({s.duration_hours:g} hrs)")
        for s in sessions
    ]
    events.sort(key=lambda item: item[0], reverse=True)

    return DashboardResponse(
        user=UserInfo(full_name="", business_name=profile.name) if profile else None,
        business=BusinessInfo(power_sources=profile.power_sources if profile else []),
        summary=DashboardSummary(
            total_expenses=total,
            generator_fuel=fuel,
            grid_electricity=grid,
            battery_runtime_hours=None,  # needs a stored battery profile (later task)
            cost_per_operating_hour=cost_per_hour,
            power_share_of_revenue_pct=share,
            generator_hours=round(sum(s.duration_hours for s in in_window), 2),
            generator_sessions=len(in_window),
        ),
        trend=Trend(
            weekly=_series(expenses, weekly),
            monthly=_series(expenses, monthly),
            yearly=_series(expenses, yearly),
        ),
        breakdown=Breakdown(grid=grid.amount, generator=fuel.amount),
        activity=[ActivityItem(timestamp=t.isoformat(), message=m) for t, m in events[:3]],
        insights=Insights(
            generator_cost_per_hour=latest.cost_per_hour_ngn if latest else None,
            battery_runtime_hours=None,
            battery_load_watts=None,
            best_option=None,  # needs the comparison endpoint (later task)
        ),
    )