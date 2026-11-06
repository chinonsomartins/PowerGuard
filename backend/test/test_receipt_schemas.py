from datetime import date

import pytest
from pydantic import ValidationError

from app.schemas.receipt import ReceiptCandidates, ReceiptConfirm, plausibility_flags

TODAY = date(2026, 11, 6)


def test_clean_receipt_has_no_flags():
    c = ReceiptCandidates(date=date(2026, 11, 5), fuel_type="petrol", litres=30,
                          unit_price_ngn_per_l=1500, total_ngn=45000)
    assert plausibility_flags(c, TODAY) == []


def test_mismatched_total_is_flagged():
    c = ReceiptCandidates(date=date(2026, 11, 5), litres=30, unit_price_ngn_per_l=1500, total_ngn=54000)
    assert "total_mismatch_gt_5pct" in plausibility_flags(c, TODAY)


def test_future_date_and_missing_fields_are_flagged():
    flags = plausibility_flags(ReceiptCandidates(date=date(2027, 1, 1), litres=30), TODAY)
    assert "date_out_of_range" in flags and "missing_total_ngn" in flags


def test_empty_extraction_is_valid_but_fully_flagged():
    assert len(plausibility_flags(ReceiptCandidates(), TODAY)) == 4


@pytest.mark.parametrize("change", [
    {"litres": 0}, {"litres": -3}, {"total_ngn": -1}, {"fuel_type": "kerosene"}, {"unit_price_ngn_per_l": 99999},
])
def test_confirm_rejects_bad_values(change):
    good = dict(date="2026-11-05", total_ngn=45000, fuel_type="petrol", litres=30, unit_price_ngn_per_l=1500)
    with pytest.raises(ValidationError):
        ReceiptConfirm(**{**good, **change})