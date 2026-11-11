"""Research-only ETA timeline from a *real* routing provider's segment summaries.

No weather/hydrology/flood safety decision is performed. Missing per-segment ETA
must not be interpolated from route-level totals. Caller must supply a valid UTC
departure time, otherwise the timeline is explicitly unavailable.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
import math


def _number(value):
    if isinstance(value, bool) or not isinstance(value, (float, int)) or not math.isfinite(value) or value < 0:
        return None
    return float(value)


def route_timeline(sections, departure_time_utc=None, expected_minutes=None, expected_km=None):
    result = {
        "status": "UNAVAILABLE_NO_VALID_DEPARTURE",
        "segments": [],
        "rainExposureStatus": "NOT_ASSESSED",
        "roadSafetyStatus": "NOT_VERIFIED",
        "safeToDrive": None,
        "alternativeRouteApproved": False,
    }
    if departure_time_utc is None:
        return result
    try:
        when = departure_time_utc if isinstance(departure_time_utc, datetime) else datetime.fromisoformat(str(departure_time_utc).replace("Z", "+00:00"))
    except (ValueError, TypeError, OverflowError):
        return result
    if when.tzinfo is None or when.utcoffset() is None:
        return result
    when = when.astimezone(timezone.utc)
    if not isinstance(sections, list) or not 1 <= len(sections) <= 30:
        return {**result, "status": "UNAVAILABLE_INVALID_SECTIONS"}
    minutes = km = 0.0
    timelines = []
    for idx, section in enumerate(sections):
        if not isinstance(section, dict):
            return {**result, "status": "UNAVAILABLE_MISSING_SEGMENT_ETA"}
        segment_minutes = _number(section.get("durationMinutes"))
        segment_km = _number(section.get("distanceKm"))
        if segment_minutes is None or segment_km is None or segment_minutes <= 0:
            return {**result, "status": "UNAVAILABLE_MISSING_SEGMENT_ETA"}
        start = when + timedelta(minutes=minutes)
        minutes += segment_minutes
        km += segment_km
        end = when + timedelta(minutes=minutes)
        timelines.append({
            "sectionIndex": idx,
            "distanceKm": round(segment_km, 2),
            "estimatedTravelMinutes": round(segment_minutes, 1),
            "estimatedArrivalStartUtc": start.isoformat().replace("+00:00", "Z"),
            "estimatedArrivalEndUtc": end.isoformat().replace("+00:00", "Z"),
            "weatherExposureStatus": "NOT_ASSESSED",
            "closureVerification": "NOT_VERIFIED",
        })
    if expected_minutes is not None and (_number(expected_minutes) is None or abs(minutes - expected_minutes) > max(2.0, expected_minutes * 0.03)):
        return {**result, "status": "UNAVAILABLE_SEGMENT_TOTAL_MISMATCH"}
    if expected_km is not None and (_number(expected_km) is None or abs(km - expected_km) > max(1.0, expected_km * 0.03)):
        return {**result, "status": "UNAVAILABLE_SEGMENT_TOTAL_MISMATCH"}
    return {**result, "status": "ETA_TIMELINE_ESTIMATED",
            "departureUtc": when.isoformat().replace("+00:00", "Z"),
            "estimatedArrivalUtc": (when + timedelta(minutes=minutes)).isoformat().replace("+00:00", "Z"),
            "segments": timelines,
            "warning": "تقديرات وصول من مزود الطرق فقط؛ لا تتضمن تقييم المطر أو السيول أو إغلاقات الطرق."}
