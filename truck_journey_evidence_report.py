"""Non-operational journey evidence report across RainGuard truck safety gates.

Consumes trusted server-side records (not browser-supplied verification flags).
Produces an evidence/readiness report only. No traffic instruction or flood
safety claim can be emitted by this module.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from truck_route_timeline import route_timeline
from truck_segment_weather_exposure import assess_route_exposure
from truck_hydrology_evidence_gate import review_route_evidence
from truck_official_alerts_gate import review_official_notices

MAX_JSON_BYTES = 500_000


def build_journey_report(payload):
    if not isinstance(payload, dict):
        raise ValueError("INVALID_REPORT_PAYLOAD")
    route = payload.get("route")
    if not isinstance(route, dict):
        raise ValueError("MISSING_ROUTE")
    sections = route.get("sections")
    departure = route.get("departureTimeUtc")
    if not isinstance(departure, str):
        raise ValueError("MISSING_UTC_DEPARTURE")
    assessment = payload.get("assessmentTimeUtc")
    if not isinstance(assessment, str):
        raise ValueError("MISSING_ASSESSMENT_TIME")
    forecast_map = payload.get("hourlyForecastsBySection", {})
    if not isinstance(forecast_map, dict):
        raise ValueError("INVALID_FORECAST_MAP")
    hydrology_records = payload.get("hydrologyEvidence", [])
    notice_records = payload.get("officialNotices", [])
    authority_registry = payload.get("authorityRegistry", {})
    if not isinstance(hydrology_records, list) or not isinstance(notice_records, list) or not isinstance(authority_registry, dict):
        raise ValueError("INVALID_EVIDENCE_INPUTS")

    # Never interpret requested endpoints as an actual verified road segment.
    timeline = route_timeline(sections, departure,
                              route.get("expectedMinutes"), route.get("expectedKm"))
    output = {
        "type": "RESEARCH_ONLY_JOURNEY_EVIDENCE_REPORT",
        "status": "INCOMPLETE_EVIDENCE",
        "timelineStatus": timeline["status"],
        "segmentReports": [],
        "officialFeedsConnected": False,
        "humanReviewRequired": True,
        "hydrologicFloodRisk": "NOT_VALIDATED",
        "roadClosureStatus": "UNKNOWN",
        "safeToDrive": None,
        "alternativeRouteApproved": False,
        "operationalWarningApproved": False,
        "disclaimer": "تقرير فحص أدلة فقط؛ ليس قرار مرور أو إعلانًا عن سلامة الطريق أو إنذارًا رسميًا.",
    }
    if timeline["status"] != "ETA_TIMELINE_ESTIMATED":
        output["missingRequirements"] = ["VALID_PROVIDER_SECTION_ETAS"]
        return output
    # A verified segment point must come from a separately reviewed geospatial
    # record, never inferred from an encoded polyline or a city center.
    points = payload.get("validatedSegmentPoints", {})
    if not isinstance(points, dict):
        raise ValueError("INVALID_SEGMENT_POINT_MAP")
    enhanced = []
    for segment in timeline["segments"]:
        index = str(segment["sectionIndex"])
        point = points.get(index)
        extra = {}
        if isinstance(point, dict):
            # Only trusted ingestion can set this; the boolean is not proof.
            extra = {"verifiedMidpoint": point.get("midpoint"),
                     "routeGeometryVerified": point.get("independentlyVerified") is True}
        enhanced.append({**segment, **extra})
    timeline["segments"] = enhanced
    indices = [entry["sectionIndex"] for entry in enhanced]
    weather = assess_route_exposure(timeline, forecast_map, assessment)
    hydro = review_route_evidence(indices, hydrology_records, assessment)
    official = review_official_notices(indices, notice_records, authority_registry, assessment)
    output["weatherExposureStatus"] = weather["status"]
    output["hydrologyEvidenceStatus"] = hydro["status"]
    output["officialNoticeStatus"] = official["status"]
    output["roadClosureStatus"] = official["roadClosureStatus"]
    output["officialRecordsAccepted"] = official["recordsAccepted"]
    output["officialRecordsRejected"] = len(official["rejectedRecords"])
    output["unverifiedDataMustNotImplySafety"] = True
    exposure_by_idx = {r["sectionIndex"]:r for r in weather.get("segmentResults",[])}
    hydrology_by_idx = {r["sectionIndex"]:r for r in hydro.get("segmentEvidence",[])}
    alerts_by_idx = {r["sectionIndex"]:r for r in official.get("segmentReviews",[])}
    for entry in enhanced:
        index=entry["sectionIndex"]
        exposure=exposure_by_idx.get(index, {})
        hy=hydrology_by_idx.get(index, {})
        notices=alerts_by_idx.get(index, {})
        gaps=[]
        if not entry.get("routeGeometryVerified") or not isinstance(entry.get("verifiedMidpoint"),dict):
            gaps.append("INDEPENDENTLY_VERIFIED_SEGMENT_GEOMETRY")
        if exposure.get("status","").startswith("INSUFFICIENT"):
            gaps.append("MATCHED_HOURLY_RAIN_FORECAST")
        if hy.get("missingEvidenceTypes"):
            gaps.extend("HYDROLOGY_"+x.upper() for x in hy["missingEvidenceTypes"])
        if not notices.get("noticeIds"):
            gaps.append("AUTHORITATIVE_NOTICE_COVERAGE")
        # A notice about rain is NOT a confirmed road closure. Closure
        # reports are review candidates, not instructions to drivers.
        output["segmentReports"].append({
            "sectionIndex":index,
            "estimatedArrivalStartUtc":entry["estimatedArrivalStartUtc"],
            "estimatedArrivalEndUtc":entry["estimatedArrivalEndUtc"],
            "estimatedTravelMinutes":entry["estimatedTravelMinutes"],
            "distanceKm":entry["distanceKm"],
            "weatherExposureStatus":exposure.get("status","NOT_ASSESSED"),
            "rainProbabilityPct":exposure.get("rainProbabilityPct"),
            "peakRainMmPerHour":exposure.get("peakRainMmPerHour"),
            "hydrologyReviewStatus":hy.get("reviewStatus","NOT_REVIEWED"),
            "officialNoticeReviewStatus":notices.get("status","UNKNOWN_ROAD_STATE"),
            "reportedOfficialClosure":notices.get("officialClosureReported",False),
            "missingRequirements":sorted(set(gaps)),
            "safeToDrive":None,
            "alternativeRouteApproved":False,
        })
    output["status"] = "REVIEW_ONLY_EVIDENCE_PARTIAL" if output["segmentReports"] else "INCOMPLETE_EVIDENCE"
    output["segmentsWithPotentialRainExposure"] = sum(
        entry["weatherExposureStatus"]=="POTENTIAL_RAIN_EXPOSURE" for entry in output["segmentReports"]
    )
    output["segmentsMissingEvidence"] = sum(
        bool(entry["missingRequirements"]) for entry in output["segmentReports"]
    )
    return output


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input",type=Path,required=True)
    parser.add_argument("--output",type=Path,required=True)
    args=parser.parse_args()
    if args.input.stat().st_size > MAX_JSON_BYTES:
        parser.error("Input too large")
    payload=json.loads(args.input.read_text(encoding="utf-8"))
    report=build_journey_report(payload)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"status":report["status"],"segments":len(report["segmentReports"]),
                      "operationalWarningApproved":False},ensure_ascii=False))


if __name__=="__main__":
    main()
