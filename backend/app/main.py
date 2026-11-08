import os

from fastapi import FastAPI

from fastapi.middleware.cors import CORSMiddleware

from app.routers import business, expenses,generator, dashboard, calc,Setting, me

app = FastAPI(title="PowerGuard API")

EXTRA_ORIGINS = [o.strip() for o in os.environ.get("EXTRA_ORIGINS", "").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
        allow_origins=["http://127.0.0.1:5500", "http://localhost:5500", *EXTRA_ORIGINS],
    allow_methods=["*"],
    allow_headers=["*"]
)

app.include_router(business.router)

app.include_router(me.router)

app.include_router(expenses.router)

app.include_router(calc.router)

app.include_router(generator.router)

app.include_router(dashboard.router)

app.include_router(Setting.router)

@app.get("/health")
def health():
    return {"status": "ok"}