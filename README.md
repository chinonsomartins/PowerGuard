# PowerGuard

Power-cost decision support for Nigerian small businesses. Record generator, grid and inverter expenses, see cost per operating hour, estimate battery runtime as a range, and compare generator vs inverter for an outage. Every number comes from tested calculation functions and is shown with its assumptions.

## What works
- Sign up and sign in (email and Google) with Firebase Authentication
- Business setup and settings stored in Firestore under each user
- Expense tracking and generator sessions, saved per user
- Dashboard with totals, breakdown, trends and generator cost per hour
- Battery runtime estimate (low / base / high range) and generator vs inverter comparison
- Per-user data isolation (verified Firebase tokens on every API call)
- Automated tests for the API and the calculations

## Not built yet
- Gemini receipt extraction (schemas and confirmation flow are defined; the extraction endpoint is next)
- Editing and deleting expenses and sessions
- Cloud deployment (demo runs locally)

## Tech stack
Python, FastAPI, Pydantic, Firebase Authentication, Cloud Firestore, vanilla HTML/CSS/JavaScript.

## Run it locally
1. Backend: `cd backend`, create a virtual environment, `pip install -r requirements.txt`, copy `.env.example` to `.env` and fill in your Firebase project ID and service-account path, then `python -m uvicorn app.main:app --reload --port 8000 --env-file .env`
2. Frontend: open `frontend/HTML/index.html` with VS Code Live Server on port 5500 (use `localhost` or `127.0.0.1` consistently)
3. Tests: `cd backend` and `python -m pytest -q`

## Notes on the numbers
Battery runtime and cost comparisons are estimates with stated assumptions, not guarantees. Starting values (efficiency, depth of discharge) are marked as assumptions in the code.

## Team
Chinonso Martins (lead, backend), Victory Ezedialor (frontend), Collinz (coordination, pitch), Obed Nelson (research, calculations)