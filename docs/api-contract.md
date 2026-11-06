# PowerGuard API contract (v1)

Status: draft for review by the frontend developer. Change rules: a contract change is a pull request that updates this file and the schema together, reviewed by the lead and the frontend developer.

## Conventions
- Base path: `/api/v1`. Local address: `http://127.0.0.1:8000`.
- Auth: `Authorization: Bearer <Firebase ID token>`. Not enforced yet; it will be required on every endpoint except `/health`. The user's identity always comes from the token, never from the body.
- Request and response bodies are JSON in **snake_case**, except `GET /dashboard`, which is **camelCase** because the dashboard page was built that way.
- Dates: `YYYY-MM-DD`. Months: `YYYY-MM`. Timestamps: ISO 8601.
- Money: Naira as a number, rounded to 2 decimal places.
- Errors: `{"detail": "..."}`. Invalid input returns `422` with a list under `detail` naming each bad field. `404` not found, `409` profile not set, `501` calculation not available yet.
- Enums: `source` is `grid | generator_fuel | inverter_battery | other`. `provenance` is `manual | ai_extracted_confirmed | sample_demo | simulated`; clients may only send `manual` or `sample_demo`.

## Endpoint status
| Method | Path | Status |
|---|---|---|
| GET | /health | Implemented |
| GET, PUT | /business | Implemented (in-memory) |
| POST, GET | /expenses | Planned |
| DELETE | /expenses/{id} | Planned |
| GET | /dashboard?range=7d\|30d\|90d | Planned |
| POST | /calc/battery-estimate | Planned |
| POST, GET | /generator-sessions | Planned (Priority 3) |

## Create an expense: POST /expenses
Request:
```json
{
  "date": "2026-10-12",
  "amount_ngn": 45000,
  "source": "generator_fuel",
  "note": "30 L petrol",
  "litres": 30,
  "fuel_type": "petrol",
  "unit_price_ngn_per_l": 1500
}
```
Required: `date`, `amount_ngn` (above 0), `source`. `note` is optional. `litres`, `fuel_type`, `unit_price_ngn_per_l` are optional and allowed only when `source` is `generator_fuel`. `provenance` defaults to `manual`.

Response `201`:
```json
{
  "id": "a1b2c3d4e5f6",
  "date": "2026-10-12",
  "amount_ngn": 45000,
  "source": "generator_fuel",
  "note": "30 L petrol",
  "litres": 30,
  "fuel_type": "petrol",
  "unit_price_ngn_per_l": 1500,
  "provenance": "manual",
  "created_at": "2026-10-12T09:00:00Z"
}
```

## List expenses: GET /expenses?month=2026-10
Response `200`: an array of the objects above, newest date first. `month` is optional.

## Dashboard summary: GET /dashboard?range=30d
camelCase. A new user receives zeros, empty arrays and nulls, which the page shows as "No data yet".
```json
{
  "user": {"fullName": "Chinonso Martins", "businessName": "Demo Salon"},
  "business": {"powerSources": ["grid", "generator", "battery"]},
  "summary": {
    "totalExpenses": {"amount": 85000, "changePercent": 12},
    "generatorFuel": {"amount": 35000, "changePercent": 8},
    "gridElectricity": {"amount": 50000, "changePercent": 5},
    "batteryRuntimeHours": 3.6,
    "costPerOperatingHour": 600,
    "powerShareOfRevenuePct": 15.0
  },
  "trend": {
    "weekly": {
      "labels": ["Oct 20", "Oct 21"],
      "total": [41000, 53000],
      "grid": [14000, 20000],
      "generator": [27000, 33000]
    },
    "monthly": {"labels": [], "total": [], "grid": [], "generator": []},
    "yearly": {"labels": [], "total": [], "grid": [], "generator": []}
  },
  "breakdown": {"grid": 50000, "generator": 35000},
  "activity": [
    {"timestamp": "2026-10-26T10:45:00", "message": "Fuel purchase recorded (N45,000)"}
  ],
  "insights": {
    "generatorCostPerHour": 2250,
    "batteryRuntimeHours": 3.6,
    "batteryLoadWatts": 600,
    "bestOption": {"name": "Inverter", "label": "More Economical"}
  }
}
```
Notes: `changePercent`, `batteryRuntimeHours`, `generatorCostPerHour`, `bestOption`, `user` may be `null`. The `monthly` and `yearly` series have the same shape as `weekly`. `costPerOperatingHour` and `powerShareOfRevenuePct` are new; the page ignores them until a card is added. `bestOption` is an advisory comparison, never a command, and is `null` when data is missing.

## Battery estimate: POST /calc/battery-estimate
Request:
```json
{
  "unit_voltage_v": 12,
  "unit_capacity_ah": 200,
  "n_series": 2,
  "n_parallel": 1,
  "load_w": 600,
  "standby_w": 0
}
```
Response `200`:
```json
{
  "bank_voltage_v": 24,
  "bank_capacity_ah": 200,
  "nominal_wh": 4800,
  "runtime_hours": {"low": 2.37, "base": 3.6, "high": 4.09},
  "assumptions": [
    "low: depth of discharge 0.4, inverter efficiency 0.85, load x1.15",
    "base: depth of discharge 0.5, inverter efficiency 0.9, load x1.0",
    "high: depth of discharge 0.5, inverter efficiency 0.92, load x0.9",
    "Estimate only. Real runtime depends on battery age, temperature and load."
  ],
  "basis": "estimated"
}
```
Always show the range and the assumptions, never a single number presented as a guarantee.

## Generator sessions (Priority 3)
Request: POST /generator-sessions
```json
{
  "date": "2026-10-12",
  "duration_hours": 4,
  "litres_consumed": 6,
  "fuel_price_ngn_per_l": 1500,
  "note": "Evening outage"
}
```
Send `litres_consumed` (measured) or `litres_per_hour_assumed` (estimated); at least one is required, and measured wins if both are sent.

Response `201`:
```json
{
  "id": "s1t2u3v4w5x6",
  "date": "2026-10-12",
  "duration_hours": 4,
  "litres_consumed": 6,
  "litres_per_hour_assumed": null,
  "fuel_price_ngn_per_l": 1500,
  "note": "Evening outage",
  "linked_expense_id": null,
  "basis": "measured",
  "fuel_cost_ngn": 9000,
  "cost_per_hour_ngn": 2250,
  "provenance": "manual",
  "created_at": "2026-10-12T20:00:00Z"
}
```

## Business profile (implemented)
`PUT /business` and `GET /business` use the fields in `backend/app/schemas/business.py`: `name`, `type`, `location`, `power_sources`, `operating_hours_per_day`, `operating_days_per_month`, and the optional `grid_tariff_ngn_per_kwh`, `monthly_revenue_ngn`, `total_load_w`, `generator_litres_per_hour`.