SCENARIOS = {
    # Starting assumptions (speculative): replace with manufacturer data where available.
    "low":  {"usable_dod": 0.40, "inverter_efficiency": 0.85, "health": 1.0, "load_factor": 1.15},
    "base": {"usable_dod": 0.50, "inverter_efficiency": 0.90, "health": 1.0, "load_factor": 1.00},
    "high": {"usable_dod": 0.50, "inverter_efficiency": 0.92, "health": 1.0, "load_factor": 0.90},
}


def bank_energy_wh(unit_voltage_v, unit_capacity_ah, n_series, n_parallel):
    return (unit_voltage_v * n_series) * (unit_capacity_ah * n_parallel)


def runtime_hours(nominal_wh, load_w, usable_dod, inverter_efficiency, health=1.0, standby_w=0.0):
    total_w = load_w + standby_w
    if total_w <= 0:
        raise ValueError("total load must be above 0")
    return nominal_wh * health * usable_dod * inverter_efficiency / total_w


def runtime_range(nominal_wh, load_w, standby_w=0.0):
    return {
        name: runtime_hours(nominal_wh, load_w * p["load_factor"], p["usable_dod"],
                            p["inverter_efficiency"], p["health"], standby_w)
        for name, p in SCENARIOS.items()
    }