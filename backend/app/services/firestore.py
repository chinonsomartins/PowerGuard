from functools import lru_cache
from typing import Optional

from firebase_admin import firestore

from app.auth.firebase_auth import ensure_firebase_app
from app.schemas.business import BusinessProfile


class FirestoreStore:
    """All data lives under businesses/{uid}.
    The uid always comes from the verified token, never from the request."""

    def __init__(self) -> None:
        ensure_firebase_app()
        self._db = firestore.client()

    def _business_ref(self, uid: str):
        return self._db.collection("businesses").document(uid)

    def get_business(self, uid: str) -> Optional[BusinessProfile]:
        snapshot = self._business_ref(uid).get()
        if not snapshot.exists:
            return None
        return BusinessProfile(**snapshot.to_dict())

    def put_business(self, uid: str, profile: BusinessProfile) -> BusinessProfile:
        self._business_ref(uid).set(
            {**profile.model_dump(), "updated_at": firestore.SERVER_TIMESTAMP}
        )
        return profile


@lru_cache(maxsize=1)
def get_store() -> FirestoreStore:
    return FirestoreStore()