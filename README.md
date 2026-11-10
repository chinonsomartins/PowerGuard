# PowerGuard

Power-cost decision support for Nigerian small businesses. Record generator, grid and inverter expenses, see your cost per operating hour, estimate battery runtime as a range, and compare generator against inverter for a power outage. Every number comes from tested calculation functions and is shown with its assumptions.

Built by a four-person team for a hackathon, where it placed 5th.

## Features

- Sign up and sign in with email and password or Google (Firebase Authentication)
- Business setup and an editable business profile (name, category, location, operating hours and days, power sources), stored per user
- Expense tracking by source (grid, generator fuel, inverter/battery, other)
- Generator sessions with fuel cost and cost per hour
- Dashboard: totals, split by power source, spending trends, generator cost per hour, battery runtime and the cheaper option for your saved outage
- Battery runtime estimator with a low / base / high range and visible assumptions
- Outage comparison of generator against inverter; it lists the inputs that are missing instead of guessing a number
- Each user sees only their own data; the API verifies a Firebase token on every request
- Responsive layout with a bottom navigation bar on phones
- Automated tests for the API and the calculations

## Status

**Working:** everything in the feature list above runs locally against a real Firebase project.

**Hosted version (in progress):** the pages are deployed on Vercel at https://powerguard-frontend.vercel.app and the API runs on Render's free tier. The free API sleeps when idle, so the first request can take up to a minute. The local setup below is the most reliable way to run the project.

**Not built yet**
- Gemini receipt extraction. The request and confirmation schemas and the plausibility checks exist, but the extraction endpoint does not.
- Editing and deleting expenses and generator sessions through the API
- Changing a password from the Settings page (the form only validates input)
- Notification switches on the Settings page are saved in the browser only

## How it works

```
Browser (HTML, CSS, JavaScript, Firebase Auth)
   |  HTTPS, Authorization: Bearer <Firebase ID token>
   v
FastAPI service  ->  verifies the token  ->  reads the user id from the token
   |-- routers:   business, expenses, generator, dashboard, calc, settings
   |-- calc/:     plain Python functions for cost and battery calculations
   v
Cloud Firestore  (rules deny all direct client access; only the API reads and writes)
```

The language model is not used for calculations. All figures come from deterministic functions with tests.

## Project structure

```
PowerGuard/
|-- backend/
|   |-- app/
|   |   |-- auth/        Firebase token verification
|   |   |-- calc/        battery, generator and comparison calculations
|   |   |-- routers/     API endpoints
|   |   |-- schemas/     request and response models (Pydantic)
|   |   `-- services/    Firestore store and dashboard aggregation
|   |-- scripts/         checks against a real Firestore project
|   `-- tests/           automated tests
|-- frontend/
|   |-- HTML/  CSS/  JS/  ICONS/
|   `-- firebase-config.js   public Firebase web configuration
|-- docs/                API contract, formulas and notes
`-- README.md
```

## Data model

```
businesses/{uid}                         business profile
businesses/{uid}/expenses/{id}
businesses/{uid}/generator_sessions/{id}
businesses/{uid}/settings/battery_profile
businesses/{uid}/settings/compare_inputs
```
Every record sits under the signed-in user's id, taken from the verified token and never from the request body.

## API

All routes except `/health` require `Authorization: Bearer <Firebase ID token>`. Interactive documentation is at `/docs` when the API is running.

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness check |
| GET | `/api/v1/me` | The verified user id |
| GET, PUT | `/api/v1/business` | Read or save the business profile |
| POST, GET | `/api/v1/expenses` | Create or list expenses (filters: `month`, `source`, `limit`) |
| POST, GET | `/api/v1/generator-sessions` | Create or list generator sessions |
| GET | `/api/v1/dashboard?range=7d\|30d\|90d` | Dashboard summary |
| POST | `/api/v1/calc/battery-estimate` | Battery runtime range and assumptions |
| POST | `/api/v1/calc/compare` | Generator against inverter for an outage |
| GET, PUT | `/api/v1/battery-profile` | Saved battery details |
| GET, PUT | `/api/v1/compare-inputs` | Saved comparison inputs |

## Run it locally

You need Python 3.11 or newer, VS Code with the Live Server extension, and a Firebase project.

### 1. Create a Firebase project
The repository contains the public web configuration of the team's project but no secrets. To run your own copy:
1. Create a project in the Firebase console.
2. **Authentication:** enable Email/Password and Google.
3. **Firestore Database:** create a database in production mode and keep the rules at `allow read, write: if false;`.
4. **Project settings, General:** register a web app, then copy its configuration into `frontend/firebase-config.js`.
5. **Project settings, Service accounts:** generate a private key and save the JSON **outside the repository**. Never commit it.

### 2. Start the API
```
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1          # macOS or Linux: source .venv/bin/activate
python -m pip install -r requirements.txt
copy .env.example .env                # macOS or Linux: cp .env.example .env
```
Edit `.env`:
```
FIREBASE_PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=C:/path/to/your-service-account.json
```
Then:
```
python -m uvicorn app.main:app --reload --port 8000 --env-file .env
```
Check that `http://127.0.0.1:8000/docs` opens.

### 3. Start the frontend
Open `frontend/HTML/index.html` with Live Server. It must run on port 5500, because the API's CORS list allows `localhost:5500` and `127.0.0.1:5500`. Use one of the two hostnames consistently, since Firebase keeps a separate sign-in session for each.

### 4. Use it
Create an account. In Business Setup choose **all three power sources** (grid, generator, inverter/battery); the Battery and Compare pages stay switched off without the battery source.

### Run the tests
```
cd backend
python -m pytest -q
```
The tests use a fake store and a fake login, so they need no Firebase access.

### Common problems
| Problem | Fix |
|---|---|
| Login works but the profile check fails with 401 | Sync your computer's clock; token verification allows only a few seconds of drift |
| Google sign-in shows `auth/unauthorized-domain` | Open the app on `localhost`, or add the domain under Authentication, Settings, Authorized domains |
| "Failed to fetch" | The API is not running on port 8000, or the page is not on port 5500 |
| 500 from the API | Check `.env` and that uvicorn was started with `--env-file .env` |

## How the numbers work

- Battery energy (Wh) = bank voltage x bank capacity (Ah)
- Usable energy = nominal energy x capacity health x depth of discharge x inverter efficiency
- Runtime (hours) = usable energy / (load + standby draw)
- The range comes from three scenarios (low, base, high). Their default depth of discharge, efficiency and load bands are **starting assumptions** shown in the app, to be replaced by manufacturer data where available.
- Generator outage cost = litres per hour x fuel price x outage hours
- Inverter outage cost = energy used (kWh) / round-trip efficiency x your electricity price. The efficiency default is an assumption, and battery wear is not included.

## Limits and honesty

- Runtime and cost figures are estimates with stated assumptions, not guarantees.
- The comparison is advisory; it never gives a safety instruction.
- When an input is missing, the app says which one instead of inventing a value.

## Contributing

Branch per task, open a pull request, and have it reviewed before merging into `main`. Never commit `.env` files, service-account keys or tokens.

## Team

- Chinonso Martins: team lead, backend, authentication, database, deployment
- Ezedialor Victory: frontend
- Collinz: coordination and pitch
- Obed Nelson: research and calculations