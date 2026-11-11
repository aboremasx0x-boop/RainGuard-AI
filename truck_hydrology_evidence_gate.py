"""Conservative evidence register gate for road / wadi / hydrology analysis.

A verified map layer is not a validated flood-depth prediction. The gate
reports evidence coverage and gaps ONLY, with no safe-road status, numeric
flood probability, traffic redirection or automatically issued alert.
"""
from datetime import datetime, timezone
import math

SOURCE_TYPES = {"verified_dem", "wadi_network", "culvert_inventory",
                "flood_model_validation", "official_road_closure"}
REQUIRED_FOR_REVIEW = {"verified_dem", "wadi_network", "culvert_inventory",
                       "flood_model_validation", "official_road_closure"}


def parse_time(value):
    try:
        t = value if isinstance(value, datetime) else datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return t.astimezone(timezone.utc) if t.tzinfo and t.utcoffset() is not None else None
    except (TypeError, ValueError, OverflowError):
        return None


def review_route_evidence(segment_indices, records, as_of_utc):
    base = {
        "status": "INCOMPLETE_EVIDENCE",
        "segmentEvidence": [],
        "hydrologicFloodRisk": "NOT_VALIDATED",
        "roadClosureStatus": "UNKNOWN",
        "safeToDrive": None, "alternativeRouteApproved": False,
        "operationalWarningApproved": False,
    }
    now = parse_time(as_of_utc)
    if not isinstance(segment_indices, list) or not 1 <= len(segment_indices) <= 30 or now is None:
        return {**base, "status": "INVALID_ROUTE_OR_TIME"}
    if not all(isinstance(i, int) and not isinstance(i, bool) and 0 <= i < 30 for i in segment_indices) or len(segment_indices) != len(set(segment_indices)):
        return {**base, "status": "INVALID_ROUTE_OR_TIME"}
    if not isinstance(records, list):
        records = []
    output = []
    for index in segment_indices:
        verified = {}
        rejected = 0
        for record in records:
            if not isinstance(record, dict) or record.get("sectionIndex") != index:
                continue
            kind = record.get("evidenceType")
            if kind not in SOURCE_TYPES:
                rejected += 1
                continue
            issued, valid_until = parse_time(record.get("verifiedAtUtc")), parse_time(record.get("validUntilUtc"))
            if not issued or not valid_until or issued > now or valid_until < now or valid_until < issued:
                rejected += 1
                continue
            if not all(record.get(flag) is True for flag in (
                "sourceAuthenticityVerified", "spatialMatchVerified", "temporalMatchVerified", "independentReviewCompleted")):
                rejected += 1
                continue
            if not isinstance(record.get("evidenceId"), str) or not record["evidenceId"].strip():
                rejected += 1
                continue
            if not isinstance(record.get("sourceReference"), str) or not record["sourceReference"].strip():
                rejected += 1
                continue
            verified.setdefault(kind, set()).add(record["evidenceId"])
        missing = sorted(REQUIRED_FOR_REVIEW - set(verified))
        output.append({"sectionIndex": index, "verifiedEvidenceTypes": sorted(verified),
                       "missingEvidenceTypes": missing, "rejectedEvidenceRecords": rejected,
                       "reviewStatus": "REVIEW_POSSIBLE_NOT_APPROVED" if not missing else "EVIDENCE_GAPS"})
    complete = bool(output) and all(not x["missingEvidenceTypes"] for x in output)
    return {**base, "segmentEvidence": output,
            "status": "EVIDENCE_COMPLETE_REQUIRES_HUMAN_REVIEW" if complete else "INCOMPLETE_EVIDENCE",
            "note": "توثيق الأدلة لا يثبت سلامة الطرق؛ يلزم تحقق هيدرولوجي رسمي ومراجعة تشغيلية مستقلة."}
