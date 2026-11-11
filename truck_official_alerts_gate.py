"""RainGuard stage 5: OFFLINE official-alert/road-closure evidence registry.

This module performs provenance, time, location and review-readiness checks.
It does not connect to NCM or road authorities, send public warnings, approve
travel, or treat missing records as evidence that a road is open.

An authority registry is supplied by a trusted administrator. An untrusted
feed's self-declared 'official=true' is never accepted as proof of authenticity.
"""
from __future__ import annotations

from datetime import datetime, timezone
from hashlib import sha256
import json

ALERT_KINDS = {"WEATHER_WARNING", "ROAD_CLOSURE", "ROAD_REOPENING", "FLOOD_OBSERVATION"}
MAX_RECORDS = 500


def _utc(value):
    try:
        timestamp = value if isinstance(value, datetime) else datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return timestamp.astimezone(timezone.utc) if timestamp.tzinfo and timestamp.utcoffset() is not None else None
    except (TypeError, ValueError, OverflowError):
        return None


def _is_identifier(value):
    return isinstance(value, str) and 0 < len(value.strip()) <= 160


def _reject(code, record_id=None):
    return {"recordId": record_id, "reason": code}


def review_official_notices(segment_indices, records, authority_registry, as_of_utc):
    """Review only. Registry is a trusted input, not loaded from source payloads."""
    result = {
        "status": "PENDING_AUTHORIZED_ALERT_SOURCES",
        "officialFeedsConnected": False,
        "recordsAccepted": 0,
        "rejectedRecords": [],
        "segmentReviews": [],
        "roadClosureStatus": "UNKNOWN",
        "hydrologicFloodRisk": "NOT_VALIDATED",
        "safeToDrive": None,
        "alternativeRouteApproved": False,
        "operationalWarningApproved": False,
        "requiresHumanReview": True,
    }
    now = _utc(as_of_utc)
    if now is None or not isinstance(segment_indices, list) or not 1 <= len(segment_indices) <= 30:
        return {**result, "status": "INVALID_INPUT"}
    if any(type(idx) is not int or idx < 0 or idx >= 30 for idx in segment_indices) or len(set(segment_indices)) != len(segment_indices):
        return {**result, "status": "INVALID_INPUT"}
    if not isinstance(records, list) or len(records) > MAX_RECORDS or not isinstance(authority_registry, dict):
        return {**result, "status": "INVALID_INPUT"}

    review = {idx: {"sectionIndex": idx, "noticeIds": [], "unverifiedClosurePresent": False,
                    "officialClosureReported": False, "officialReopeningReported": False,
                    "weatherWarningReported": False, "sourceCoverage": "UNKNOWN"} for idx in segment_indices}
    seen = set()
    accepted = []
    rejected = []
    for record in records:
        identifier = record.get("recordId") if isinstance(record, dict) else None
        if not isinstance(record, dict) or not _is_identifier(identifier):
            rejected.append(_reject("INVALID_RECORD_ID"))
            continue
        if identifier in seen:
            rejected.append(_reject("DUPLICATE_NOTICE_ID", identifier))
            continue
        seen.add(identifier)
        authority = record.get("authorityId")
        kind = record.get("kind")
        if not _is_identifier(authority) or kind not in ALERT_KINDS:
            rejected.append(_reject("UNKNOWN_AUTHORITY_OR_NOTICE_KIND", identifier))
            continue
        # Trusted, out-of-band source registry with explicit allowed categories.
        trusted = authority_registry.get(authority)
        if not isinstance(trusted, dict) or trusted.get("identityVerified") is not True or kind not in trusted.get("allowedKinds", []):
            rejected.append(_reject("AUTHORITY_NOT_VERIFIED", identifier))
            continue
        # These attestations must come from a trusted ingestion pipeline; the
        # module does not itself validate signatures or authenticate feeds.
        if not all(record.get(key) is True for key in (
            "ingestionAuthenticated", "originalRecordVerified",
            "spatialMatchVerified", "independentReviewCompleted"
        )):
            rejected.append(_reject("SOURCE_OR_LOCATION_NOT_VERIFIED", identifier))
            continue
        issued, start, end = (_utc(record.get(key)) for key in ("issuedAtUtc", "validFromUtc", "validUntilUtc"))
        if None in (issued, start, end) or issued > now or start > now or end < now or not issued <= end:
            rejected.append(_reject("FUTURE_EXPIRED_OR_INVALID_NOTICE", identifier))
            continue
        indices = record.get("sectionIndices")
        if not isinstance(indices, list) or not indices or any(type(i) is not int or i not in review for i in indices):
            rejected.append(_reject("SEGMENT_SCOPE_NOT_VERIFIED", identifier))
            continue
        if kind == "ROAD_REOPENING" and not _is_identifier(record.get("supersedesRecordId")):
            rejected.append(_reject("REOPENING_WITHOUT_CLOSURE_REFERENCE", identifier))
            continue
        if not _is_identifier(record.get("sourceReference")):
            rejected.append(_reject("MISSING_AUDIT_SOURCE_REFERENCE", identifier))
            continue
        accepted.append({"recordId": identifier, "authorityId": authority, "kind": kind,
                         "sectionIndices": sorted(set(indices)), "issuedAtUtc": issued.isoformat(),
                         "supersedesRecordId": record.get("supersedesRecordId")})
        for idx in set(indices):
            review[idx]["noticeIds"].append(identifier)
            if kind == "ROAD_CLOSURE":
                review[idx]["officialClosureReported"] = True
            elif kind == "ROAD_REOPENING":
                review[idx]["officialReopeningReported"] = True
            elif kind == "WEATHER_WARNING":
                review[idx]["weatherWarningReported"] = True
    # Reopening is advisory evidence ONLY; other active closures may exist,
    # and the absence of closures cannot be interpreted as road opening.
    for entry in review.values():
        entry["noticeIds"].sort()
        entry["sourceCoverage"] = "PARTIAL_NOTICE_RECORDS" if entry["noticeIds"] else "NO_VERIFIED_NOTICE_COVERAGE"
        entry["status"] = "OFFICIAL_CLOSURE_REPORTED_REVIEW_REQUIRED" if entry["officialClosureReported"] else (
            "OFFICIAL_WEATHER_NOTICE_REVIEW_REQUIRED" if entry["weatherWarningReported"] else
            "UNKNOWN_ROAD_STATE")
    result["segmentReviews"] = list(review.values())
    result["recordsAccepted"] = len(accepted)
    result["rejectedRecords"] = rejected
    result["status"] = "VERIFIED_RECORDS_REQUIRE_HUMAN_REVIEW" if accepted else "PENDING_AUTHORIZED_ALERT_SOURCES"
    result["roadClosureStatus"] = "OFFICIAL_CLOSURE_REPORTED_REVIEW_REQUIRED" if any(
        r["officialClosureReported"] for r in review.values()) else "UNKNOWN"
    # Diagnostic provenance checksum is not a signature or trustworthy audit log.
    result["diagnosticAuditDigest"] = sha256(
        json.dumps(accepted, sort_keys=True, ensure_ascii=False).encode("utf-8")
    ).hexdigest()
    return result
