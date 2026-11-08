import os
import json

from typing import Optional

import firebase_admin

from firebase_admin import credentials
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth as firebase_auth

_bearer = HTTPBearer(auto_error=False)


def ensure_firebase_app() -> None:
    if firebase_admin._apps:
        return
    options = {"projectId": os.environ["FIREBASE_PROJECT_ID"]}
    raw = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
    if raw:
        firebase_admin.initialize_app(credentials.Certificate(json.loads(raw)), options)
    else:
        firebase_admin.initialize_app(options=options)


def get_current_uid(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> str:
    """Return the uid from a verified Firebase ID token.
    The uid is never taken from the request body or URL."""
    if creds is None:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    ensure_firebase_app()

    try:
        decoded = firebase_auth.verify_id_token(creds.credentials, clock_skew_seconds=10)
    except Exception as exc:
        print("TOKEN VERIFY FAILED:", type(exc).__name__, "-", exc)
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return decoded["uid"]