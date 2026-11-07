import uuid
from datetime import datetime, timezone

from app.schemas.expense import Expense
from app.schemas.generator import GeneratorSession


class FakeStore:
    """In-memory stand-in for FirestoreStore, with the same method signatures."""

    def __init__(self):
        self.profiles, self.expenses, self.sessions, self.Setting = {}, {}, {}, {}

    def get_business(self, uid):
        return self.profiles.get(uid)

    def put_business(self, uid, profile):
        self.profiles[uid] = profile
        return profile

    def get_setting(self, uid, name):
        return self.Setting.get((uid, name))

    def put_setting(self, uid, name, data):
        self.Setting[(uid, name)] = data
        return data

    @staticmethod
    def _in_range(item, start, end):
        d = item.date.isoformat()
        return (start is None or d >= start) and (end is None or d < end)

    def add_expense(self, uid, data):
        item = Expense(id=uuid.uuid4().hex[:12], created_at=datetime.now(timezone.utc), **data.model_dump())
        self.expenses.setdefault(uid, []).append(item)
        return item

    def list_expenses(self, uid, start=None, end=None, limit=500):
        items = [e for e in self.expenses.get(uid, []) if self._in_range(e, start, end)]
        return sorted(items, key=lambda e: e.date, reverse=True)[:limit]

    def add_generator_session(self, uid, data, computed):
        item = GeneratorSession(
            id=uuid.uuid4().hex[:12], created_at=datetime.now(timezone.utc),
            provenance="manual", **data.model_dump(), **computed,
        )
        self.sessions.setdefault(uid, []).append(item)
        return item

    def list_generator_sessions(self, uid, start=None, end=None, limit=500):
        items = [s for s in self.sessions.get(uid, []) if self._in_range(s, start, end)]
        return sorted(items, key=lambda s: s.date, reverse=True)[:limit]