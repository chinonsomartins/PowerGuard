def session_cost(
    duration_hours: float,
    fuel_price_ngn_per_l: float,
    litres_consumed: float | None = None,
    litres_per_hour_assumed: float | None = None,
) -> dict:
    """Cost of one generator session. Measured litres win over an assumed rate."""
    if duration_hours <= 0:
        raise ValueError("duration_hours must be above 0")
    if litres_consumed is not None:
        litres, basis = litres_consumed, "measured"
    elif litres_per_hour_assumed is not None:
        litres, basis = litres_per_hour_assumed * duration_hours, "estimated"
    else:
        raise ValueError("Provide litres_consumed or litres_per_hour_assumed")
    cost = litres * fuel_price_ngn_per_l
    return {
        "basis": basis,
        "fuel_cost_ngn": round(cost, 2),
        "cost_per_hour_ngn": round(cost / duration_hours, 2),
    }