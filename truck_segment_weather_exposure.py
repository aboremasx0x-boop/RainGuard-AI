"""Research-only road segment hourly precipitation exposure matching.

Requires georeferenced route segments and provider forecast intervals overlapping
the entire estimated occupancy interval. It does NOT calculate flood hazard,
approve roads, synthesize hourlies from multi-hour forecast aggregate, or issue
road traffic warnings. Observations and road closures are separate evidence.
"""
from __future__ import annotations

from datetime import datetime, timezone
import math

MAX_FORECAST_AGE_HOURS = 2.0
MAX_SPATIAL_DISTANCE_KM = 10.0
MAX_HORIZON_HOURS = 72.0
RAIN_EXPOSURE_PROBABILITY = 65.0
RAIN_EXPOSURE_MM_PER_HOUR = 10.0


def utc(value):
    try:
        result = value if isinstance(value, datetime) else datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if result.tzinfo is None or result.utcoffset() is None:
            return None
        return result.astimezone(timezone.utc)
    except (ValueError, OverflowError, TypeError):
        return None


def num(value, low, high):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        return None
    return float(value) if low <= value <= high else None


def distance_km(a, b):
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dphi = p2 - p1
    dl = math.radians(b[1] - a[1])
    h = math.sin(dphi/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 12742.0 * math.asin(math.sqrt(min(1.0, h)))


def unavailable(status, reasons, section_index=None):
    return {"sectionIndex": section_index, "status": status, "reasons": reasons,
            "rainProbabilityPct": None, "peakRainMmPerHour": None,
            "forecastProviders": [], "safeToDrive": None,
            "alternativeRouteApproved": False, "floodRisk": "NOT_EVALUATED"}


def assess_segment(segment, forecast_records, as_of_utc):
    index = segment.get("sectionIndex") if isinstance(segment, dict) else None
    if not isinstance(segment, dict):
        return unavailable("INSUFFICIENT_ROUTE_EVIDENCE", ["INVALID_SEGMENT"], index)
    start = utc(segment.get("estimatedArrivalStartUtc"))
    end = utc(segment.get("estimatedArrivalEndUtc"))
    as_of = utc(as_of_utc)
    if start is None or end is None or as_of is None or not start < end or start < as_of:
        return unavailable("INSUFFICIENT_ROUTE_EVIDENCE", ["INVALID_ETA_TIMELINE"], index)
    if (end - as_of).total_seconds() > MAX_HORIZON_HOURS * 3600:
        return unavailable("INSUFFICIENT_FORECAST_EVIDENCE", ["ETA_OUTSIDE_72H_WINDOW"], index)
    midpoint = segment.get("verifiedMidpoint")
    if not isinstance(midpoint, dict) or segment.get("routeGeometryVerified") is not True:
        return unavailable("INSUFFICIENT_ROUTE_EVIDENCE", ["SEGMENT_COORDINATES_NOT_VERIFIED"], index)
    lat = num(midpoint.get("lat"), -90, 90)
    lon = num(midpoint.get("lon"), -180, 180)
    if lat is None or lon is None:
        return unavailable("INSUFFICIENT_ROUTE_EVIDENCE", ["INVALID_SEGMENT_COORDINATES"], index)
    if not isinstance(forecast_records, list) or not forecast_records:
        return unavailable("INSUFFICIENT_FORECAST_EVIDENCE", ["NO_HOURLY_FORECASTS"], index)
    # A conservative minimum: one forecast coordinate may not represent a long
    # section; reviewer-supplied representative midpoint is required.
    valid = {}
    for record in forecast_records:
        if not isinstance(record, dict):
            continue
        provider = record.get("provider")
        if provider not in ("open_meteo", "visual_crossing", "weatherapi"):
            continue
        fetched = utc(record.get("fetchedAtUtc"))
        issued = utc(record.get("issuedAtUtc"))
        fs = utc(record.get("validFromUtc"))
        fe = utc(record.get("validToUtc"))
        if None in (fetched, issued, fs, fe) or not fs < fe or (fe - fs).total_seconds() > 3600:
            continue
        if fetched > as_of or issued > as_of or fetched < issued:
            continue
        if (as_of - fetched).total_seconds() > MAX_FORECAST_AGE_HOURS * 3600:
            continue
        flat = num(record.get("lat"), -90, 90)
        flon = num(record.get("lon"), -180, 180)
        prob = num(record.get("rainProbabilityPct"), 0, 100)
        mm = num(record.get("rainMmPerHour"), 0, 1000)
        if None in (flat, flon, prob, mm) or distance_km((lat, lon), (flat, flon)) > MAX_SPATIAL_DISTANCE_KM:
            continue
        valid.setdefault(provider, []).append((fs, fe, prob, mm))
    providers = []
    signals = []
    for provider, rows in sorted(valid.items()):
        # Ignore overlapping duplicate rows instead of double-counting.
        rows.sort(key=lambda row: (row[0], row[1]))
        cursor = start
        values = []
        for fs, fe, prob, mm in rows:
            if fe <= cursor or fs > cursor:
                continue
            values.append((prob, mm))
            cursor = min(end, fe)
            if cursor >= end:
                break
        if cursor < end:
            continue
        p = max(x[0] for x in values)
        mm = max(x[1] for x in values)
        providers.append({"provider": provider, "maxRainProbabilityPct": round(p, 1),
                          "peakRainMmPerHour": round(mm, 2)})
        signals.append((p, mm))
    if not providers:
        return unavailable("INSUFFICIENT_FORECAST_EVIDENCE", ["NO_COMPLETE_SPATIOTEMPORAL_COVERAGE"], index)
    highest_prob = max(x[0] for x in signals)
    peak_mm = max(x[1] for x in signals)
    # This describes potential *rain exposure*, NOT flood depth / road safety.
    exposure = "POTENTIAL_RAIN_EXPOSURE" if (
        highest_prob >= RAIN_EXPOSURE_PROBABILITY or peak_mm >= RAIN_EXPOSURE_MM_PER_HOUR
    ) else "RAIN_FORECAST_PRESENT_SAFETY_UNKNOWN"
    return {"sectionIndex": index, "status": exposure,
            "reasons": ["CLOSURES_AND_HYDROLOGY_NOT_VERIFIED"],
            "rainProbabilityPct": round(highest_prob, 1), "peakRainMmPerHour": round(peak_mm, 2),
            "forecastProviders": providers, "safeToDrive": None,
            "alternativeRouteApproved": False, "floodRisk": "NOT_EVALUATED"}


def assess_route_exposure(timeline, forecasts_by_section, as_of_utc):
    result = {"status": "INSUFFICIENT_ROUTE_EVIDENCE", "segmentResults": [],
              "safeToDrive": None, "alternativeRouteApproved": False,
              "floodRisk": "NOT_EVALUATED", "operationalWarningApproved": False}
    if not isinstance(timeline, dict) or timeline.get("status") != "ETA_TIMELINE_ESTIMATED":
        return result
    sections = timeline.get("segments")
    if not isinstance(sections, list) or not 1 <= len(sections) <= 30:
        return result
    if not isinstance(forecasts_by_section, dict):
        forecasts_by_section = {}
    segments = [assess_segment(s, forecasts_by_section.get(str(s.get("sectionIndex")), []), as_of_utc)
                for s in sections]
    incomplete = any(s["status"].startswith("INSUFFICIENT") for s in segments)
    exposed = any(s["status"] == "POTENTIAL_RAIN_EXPOSURE" for s in segments)
    return {**result, "segmentResults": segments,
            "status": "INCOMPLETE_EXPOSURE_EVIDENCE" if incomplete else
                      "POTENTIAL_RAIN_EXPOSURE" if exposed else "RAIN_FORECAST_PRESENT_SAFETY_UNKNOWN",
            "warning": "معلومات تعرض محتمل للمطر فقط؛ لا تثبت فتح الطريق أو سلامته من السيول."}
