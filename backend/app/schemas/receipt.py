from datetime import date as Date, timedelta
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field

FuelType = Literal["petrol", "diesel"]
Confidence = Literal["high", "medium", "low"]


class ReceiptCandidates(BaseModel):
    """What the model thinks the receipt says. Every field may be missing."""
    date: Optional[Date] = None
    fuel_type: Optional[FuelType] = None
    litres: Optional[float] = None
    unit_price_ngn_per_l: Optional[float] = None
    total_ngn: Optional[float] = None
    vendor: Optional[str] = Field(default=None, max_length=120)


class ReceiptExtractionResult(BaseModel):
    """Returned by POST /receipts/extract. Never saved until the user confirms."""
    candidates: ReceiptCandidates
    field_confidence: Dict[str, Confidence] = Field(default_factory=dict)
    flags: List[str] = Field(default_factory=list)
    model_id: str = ""
    provenance: Literal["ai_extracted_unconfirmed"] = "ai_extracted_unconfirmed"


class ReceiptConfirm(BaseModel):
    """Sent after the user reviews and edits the candidates."""
    date: Date
    total_ngn: float = Field(gt=0, le=100_000_000)
    fuel_type: FuelType
    litres: float = Field(gt=0, le=1000)
    unit_price_ngn_per_l: float = Field(gt=0, le=5000)
    vendor: str = Field(default="", max_length=120)
    edited_fields: List[str] = Field(default_factory=list)
    model_id: str = Field(default="", max_length=80)


def plausibility_flags(c: ReceiptCandidates, today: Optional[Date] = None) -> List[str]:
    """Checks on extracted values; flags ask the user to look, they never auto-correct."""
    today = today or Date.today()
    flags: List[str] = []
    if c.date is not None and (c.date > today or c.date < today - timedelta(days=366)):
        flags.append("date_out_of_range")
    if c.litres is not None and not 0.5 <= c.litres <= 1000:
        flags.append("litres_out_of_range")
    if c.unit_price_ngn_per_l is not None and not 100 <= c.unit_price_ngn_per_l <= 5000:
        flags.append("unit_price_out_of_range")  # starting range, review against current prices
    if None not in (c.litres, c.unit_price_ngn_per_l, c.total_ngn) and c.total_ngn:
        if abs(c.litres * c.unit_price_ngn_per_l - c.total_ngn) / c.total_ngn > 0.05:
            flags.append("total_mismatch_gt_5pct")
    for name in ("date", "litres", "unit_price_ngn_per_l", "total_ngn"):
        if getattr(c, name) is None:
            flags.append(f"missing_{name}")
    return flags