from datetime import datetime, timezone
from functools import lru_cache
from typing import List, Optional

from firebase_admin import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

from app.auth.firebase_auth import ensure_firebase_app
from app.schemas.business import BusinessProfile
from app.schemas.expense import Expense, ExpenseCreate
from app.schemas.generator import GeneratorSession, GeneratorSessionCreate


class FirestoreStore:
    """All data lives under businesses/{uid}; uid always comes from the verified token."""

    def __init__(self) -> None:
        ensure_firebase_app()
        self._db = firestore.client()

    def _business_ref(self, uid: str):
        return self._db.collection("businesses").document(uid)

    def _dated(self, collection, start: Optional[str], end: Optional[str], limit: int):
        # Dates are stored as YYYY-MM-DD strings, so a range on "date" needs no extra index.
        query = collection.order_by("date", direction=firestore.Query.DESCENDING)
        if start:
            query = query.where(filter=FieldFilter("date", ">=", start))
        if end:
            query = query.where(filter=FieldFilter("date", "<", end))
        return query.limit(limit).stream()

    # ---- business profile ----
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

    # ---- expenses ----
    def add_expense(self, uid: str, data: ExpenseCreate) -> Expense:
        ref = self._business_ref(uid).collection("expenses").document()
        created_at = datetime.now(timezone.utc)
        ref.set({**data.model_dump(mode="json"), "created_at": created_at})
        return Expense(id=ref.id, created_at=created_at, **data.model_dump())

    def list_expenses(
        self, uid: str, start: Optional[str] = None, end: Optional[str] = None, limit: int = 500
    ) -> List[Expense]:
        collection = self._business_ref(uid).collection("expenses")
        return [Expense(id=d.id, **d.to_dict()) for d in self._dated(collection, start, end, limit)]

    # ---- generator sessions ----
    def add_generator_session(
        self, uid: str, data: GeneratorSessionCreate, computed: dict
    ) -> GeneratorSession:
        ref = self._business_ref(uid).collection("generator_sessions").document()
        created_at = datetime.now(timezone.utc)
        record = {**computed, "provenance": "manual"}
        ref.set({**data.model_dump(mode="json"), **record, "created_at": created_at})
        return GeneratorSession(id=ref.id, created_at=created_at, **data.model_dump(), **record)

    def list_generator_sessions(
        self, uid: str, start: Optional[str] = None, end: Optional[str] = None, limit: int = 500
    ) -> List[GeneratorSession]:
        collection = self._business_ref(uid).collection("generator_sessions")
        return [
            GeneratorSession(id=d.id, **d.to_dict())
            for d in self._dated(collection, start, end, limit)
        ]

        # ---- saved page inputs (battery profile, compare inputs) ----
    def get_setting(self, uid: str, name: str) -> Optional[dict]:
        snapshot = self._business_ref(uid).collection("settings").document(name).get()
        return snapshot.to_dict() if snapshot.exists else None

    def put_setting(self, uid: str, name: str, data: dict) -> dict:
        self._business_ref(uid).collection("settings").document(name).set(
            {**data, "updated_at": firestore.SERVER_TIMESTAMP}
        )
        return data

@lru_cache(maxsize=1)
def get_store() -> FirestoreStore:
    return FirestoreStore()