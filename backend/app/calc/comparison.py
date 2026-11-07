from app.calc.battery import bank_energy_wh, runtime_range

ROUND_TRIP_EFFICIENCY = 0.80  # speculative starting value, shown to the user as an assumption


def compare_outage(outage_hours, load_w, standby_w=0.0, generator_litres_per_hour=None,
                   fuel_price_ngn_per_l=None, nominal_wh=None, grid_tariff_ngn_per_kwh=None,
                   round_trip_efficiency=ROUND_TRIP_EFFICIENCY):
    gen_missing = [n for n, v in (("generator_litres_per_hour", generator_litres_per_hour),
                                  ("fuel_price_ngn_per_l", fuel_price_ngn_per_l)) if v is None]
    generator = {"name": "generator", "missing_inputs": gen_missing, "cost_ngn": None}
    if not gen_missing:
        generator["cost_ngn"] = round(generator_litres_per_hour * fuel_price_ngn_per_l * outage_hours, 2)

    inverter = {"name": "inverter", "missing_inputs": [], "cost_ngn": None,
                "runtime_hours": None, "covers_outage": None}
    if nominal_wh is None:
        inverter["missing_inputs"].append("battery_bank")
    else:
        rng = {k: round(v, 2) for k, v in runtime_range(nominal_wh, load_w, standby_w).items()}
        inverter["runtime_hours"] = rng
        inverter["covers_outage"] = ("yes" if outage_hours <= rng["low"]
                                     else "no" if outage_hours > rng["high"] else "uncertain")
    if grid_tariff_ngn_per_kwh is None:
        inverter["missing_inputs"].append("grid_tariff_ngn_per_kwh")
    else:
        kwh = (load_w + standby_w) / 1000 * outage_hours
        inverter["cost_ngn"] = round(kwh / round_trip_efficiency * grid_tariff_ngn_per_kwh, 2)

    assumptions = [
        f"Inverter energy is recharged from the grid at your tariff with {round_trip_efficiency:.0%} round-trip efficiency.",
        "Battery wear and replacement cost are not included.",
        "Runtime is an estimate; real runtime depends on battery age, temperature and load.",
        "This comparison is advisory, not a safety instruction.",
    ]
    return {"outage_hours": outage_hours, "scenarios": [generator, inverter], "assumptions": assumptions}

def compare_from_request(req):
    """Runs compare_outage from an OutageCompareRequest-shaped object."""
    nominal = None
    if req.unit_voltage_v is not None:
        nominal = bank_energy_wh(req.unit_voltage_v, req.unit_capacity_ah, req.n_series, req.n_parallel)
    return compare_outage(
        outage_hours=req.outage_hours, load_w=req.load_w, standby_w=req.standby_w,
        generator_litres_per_hour=req.generator_litres_per_hour,
        fuel_price_ngn_per_l=req.fuel_price_ngn_per_l, nominal_wh=nominal,
        grid_tariff_ngn_per_kwh=req.grid_tariff_ngn_per_kwh,
    )