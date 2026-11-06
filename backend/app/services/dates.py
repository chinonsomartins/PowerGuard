from datetime import date

from fastapi import HTTPException


def month_bounds(month: str):
    """'2026-10' -> ('2026-10-01', '2026-11-01'); the end is exclusive."""
    year, mon = int(month[:4]), int(month[5:7])
    if not (1 <= mon <= 12 and 2000 <= year <= 2100):
        raise HTTPException(422, "month must look like 2026-10")
    start = date(year, mon, 1)
    end = date(year + 1, 1, 1) if mon == 12 else date(year, mon + 1, 1)
    return start.isoformat(), end.isoformat()