from fastapi import FastAPI

from fastapi.middleware.cors import CORSMiddleware

from app.routers import business, me

app = FastAPI(title="PowerGuard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5500", "http://localhost:5500"],
    allow_methods=["*"],
    allow_headers=["*"]
)

app.include_router(business.router)

app.include_router(me.router)

@app.get("/health")
def health():
    return {"status": "ok"}