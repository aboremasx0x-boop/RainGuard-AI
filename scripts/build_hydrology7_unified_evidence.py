"""Hydrology-7: unify local evidence without ranking flood risk or road safety.

Consumes previously generated Hydrology-2, 3, 4 and 6 research exports.
Inputs are untrusted; this module refuses missing/duplicate/mismatched sites,
positions, contradictory status labels and claims of road safety.
Offline only, no paid service, no external dependencies.
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import math
import re
from pathlib import Path

from audit_hydrology4_acc_readiness import read_json
from build_hydrology3_evidence_register import CATEGORIES

MAX_INPUT_BYTES = 3_000_000
STATUS = "UNIFIED_RESEARCH_EVIDENCE_NOT_OPERATIONALLY_VALIDATED"
SITE_RE = re.compile(r"RG-HYDRO-REVIEW-[0-9]{3}\Z")


def require(value, expected, field):
    if value != expected or type(value) is not type(expected):
        raise ValueError("UNEXPECTED_" + field)
    return value


def safe_float(v, field, low=None, high=None, nullable=False):
    if v is None and nullable:
        return None
    if type(v) not in (int, float) or not math.isfinite(v):
        raise ValueError("INVALID_" + field)
    if (low is not None and v < low) or (high is not None and v > high):
        raise ValueError("OUT_OF_RANGE_" + field)
    return v


def index_sites(doc, expected_type, expected_status):
    if not isinstance(doc, dict):
        raise ValueError("INVALID_REPORT")
    require(doc.get("reportType"), expected_type, "REPORT_TYPE")
    require(doc.get("status"), expected_status, "REPORT_STATUS")
    require(doc.get("safeToDrive", "ABSENT"), None, "SAFETY")
    require(doc.get("alternativeRouteApproved"), False, "ALTERNATIVE")
    require(doc.get("operationalWarningApproved"), False, "WARNING")
    values = doc.get("sites")
    if not isinstance(values, list) or not 1 <= len(values) <= 300 or len(values) != doc.get("siteCount", doc.get("reviewSiteCount")):
        raise ValueError("INVALID_SITE_COUNT")
    out = {}
    for item in values:
        if not isinstance(item, dict) or not isinstance(item.get("siteId"), str) or not SITE_RE.fullmatch(item["siteId"]) or item["siteId"] in out:
            raise ValueError("DUPLICATE_OR_INVALID_SITE")
        safe_float(item.get("latitude"), "LAT", 20, 22.5)
        safe_float(item.get("longitude"), "LON", 38, 40.5)
        out[item["siteId"]] = item
    return out


def matching(base, other, source):
    if base.keys() != other.keys():
        raise ValueError("MISMATCHED_SITE_IDS_" + source)
    for sid, site in base.items():
        b = other[sid]
        if abs(b["latitude"] - site["latitude"]) > 0.000001 or abs(b["longitude"] - site["longitude"]) > 0.000001:
            raise ValueError("MISMATCHED_COORDINATES_" + source)


def unify(hydro2, hydro3, hydro4, hydro6):
    a = index_sites(hydro2, "RAINGUARD_HYDROLOGY2_REVIEW_SITES_ONLY",
                    "RESEARCH_REVIEW_LOCATIONS_NOT_VERIFIED")
    b = index_sites(hydro3, "RAINGUARD_HYDROLOGY3_UNVERIFIED_EVIDENCE_REGISTER",
                    "REVIEW_REGISTER_ONLY_NO_SAFETY_DECISION")
    c = index_sites(hydro4, "RAINGUARD_HYDROLOGY4_ACC_READINESS_ONLY",
                    "FLOW_ACCUMULATION_CONTEXT_ONLY_NOT_ELEVATION")
    d = index_sites(hydro6, "RAINGUARD_HYDROLOGY6_LOCAL_TERRAIN_WINDOWS",
                    "LOCAL_DEM_NEIGHBORHOOD_DESCRIPTIVES_UNVERIFIED")
    for name, other in (("HYDROLOGY3", b), ("HYDROLOGY4", c), ("HYDROLOGY6", d)):
        matching(a, other, name)

    require(hydro2.get("coverage"), "ONE_RESEARCH_TILE_ONLY_NOT_COMPLETE", "RIVER_COVERAGE")
    require(hydro2.get("officialRoadCrossingConfirmed"), False, "CROSSING")
    require(hydro3.get("independentlyVerifiedEvidenceCount"), 0, "INDEPENDENT_EVIDENCE")
    require(hydro4.get("accIsDemElevation"), False, "ACC_AS_DEM")
    require(hydro4.get("demElevationVerifiedCount"), 0, "DEM_VERIFICATION")
    require(hydro4.get("bridgeCulvertVerifiedCount"), 0, "CULVERT_VERIFICATION")
    require(hydro6.get("validatedDEMProvenanceCount"), 0, "DEM_PROVENANCE")
    require(hydro6.get("verifiedRoadSurfaceElevationCount"), 0, "ROAD_ELEVATION")
    require(hydro6.get("bridgeCulvertVerifiedCount"), 0, "BRIDGE_VERIFICATION")
    require(hydro6.get("sourceTile"), "N21E039.hgt", "HGT_TILE")
    if hydro3.get("sourceTile") != hydro2.get("tile") or hydro2.get("tile") != "N20_E038.geojson":
        raise ValueError("MISMATCHED_RIVER_TILE")
    if hydro4.get("siteCount") != len(a) or hydro6.get("siteCount") != len(a):
        raise ValueError("MISMATCHED_REPORT_COUNT")

    rows = []
    for sid, site in a.items():
        record, acc, dem = b[sid], c[sid], d[sid]
        require(site.get("verification"), "NOT_FIELD_VERIFIED", "FIELD_VERIFICATION")
        require(site.get("crossingStatus"), "NOT_CONFIRMED", "CROSSING_STATUS")
        require(record.get("reviewStatus"), "HUMAN_REVIEW_REQUIRED", "REVIEW")
        require(record.get("safeToDrive", "ABSENT"), None, "SITE_SAFETY")
        require(acc.get("floodRisk"), "NOT_EVALUATED", "ACC_FLOOD_RISK")
        require(dem.get("floodRisk"), "NOT_EVALUATED", "DEM_FLOOD_RISK")
        require(acc.get("roadElevationMeters", "ABSENT"), None, "ACC_ROAD_ELEVATION")
        require(dem.get("roadSurfaceElevationMeters", "ABSENT"), None, "DEM_ROAD_ELEVATION")
        require(dem.get("roadCrossingVerified"), False, "DEM_CROSSING")
        require(acc.get("culvertEvidence"), "MISSING", "CULVERT_EVIDENCE")
        require(acc.get("bridgeEvidence"), "MISSING", "BRIDGE_EVIDENCE")
        require(dem.get("bridgeOrCulvertStatus"), "UNKNOWN", "DEM_CULVERT")

        ids = site.get("riverIds")
        if not isinstance(ids, list) or not ids or any(type(i) is not int or i <= 0 for i in ids):
            raise ValueError("INVALID_RIVER_IDS")
        if sorted(set(ids)) != sorted(record.get("riverIds", [])):
            raise ValueError("MISMATCHED_RIVER_IDS")
        proximity = safe_float(site.get("nearestRiverDistanceMeters"), "PROXIMITY", 0, 500)
        if record.get("nearestRiverDistanceMeters") != proximity:
            raise ValueError("MISMATCHED_PROXIMITY")

        checklist = record.get("evidenceChecklist")
        if not isinstance(checklist, list) or len(checklist) != len(CATEGORIES):
            raise ValueError("INVALID_EVIDENCE_CHECKLIST")
        seen = set()
        missing = []
        unverified = []
        for evidence in checklist:
            if not isinstance(evidence, dict):
                raise ValueError("INVALID_EVIDENCE")
            name = evidence.get("category")
            if name not in CATEGORIES or name in seen or evidence.get("independentReviewStatus") != "NOT_PERFORMED":
                raise ValueError("INVALID_EVIDENCE_REVIEW")
            seen.add(name)
            status = evidence.get("status")
            if status not in ("MISSING_EVIDENCE", "SUBMITTED_UNVERIFIED"):
                raise ValueError("SELF_ASSERTED_EVIDENCE_APPROVAL")
            if status == "MISSING_EVIDENCE":
                missing.append(name)
            else:
                unverified.append(name)
        if set(missing) != set(record.get("missingEvidenceCategories", [])):
            raise ValueError("MISMATCHED_MISSING_EVIDENCE")

        grid_status = acc.get("gridStatus")
        if grid_status not in ("ACC_CELL_PRESENT_UNVERIFIED", "ACC_NODATA",
                               "ACC_GRID_OUTSIDE_COVERAGE", "ACC_BINARY_MISSING_OR_SIZE_MISMATCH"):
            raise ValueError("INVALID_ACC_STATUS")
        acc_count = acc.get("accumulatedUpstreamCellCount")
        if grid_status == "ACC_CELL_PRESENT_UNVERIFIED":
            if type(acc_count) is not int or not 0 <= acc_count <= 4294967295:
                raise ValueError("INVALID_ACC_COUNT")
        elif acc_count is not None:
            raise ValueError("UNEXPECTED_ACC_COUNT")
        dem_status = dem.get("sampleStatus")
        if dem_status not in ("WINDOW_SAMPLES_PRESENT_UNVERIFIED", "CENTER_VOID",
                              "INCOMPLETE_WINDOW_NODATA", "INCOMPLETE_WINDOW_TILE_EDGE",
                              "OUTSIDE_TILE"):
            raise ValueError("INVALID_DEM_STATUS")
        terrain_fields = ("centerTerrainMeters", "minTerrainMeters", "maxTerrainMeters",
                          "medianTerrainMeters", "maxMinusMinMeters", "centerMinusMedianMeters")
        terrain = {name:dem.get(name) for name in terrain_fields}
        if dem_status == "WINDOW_SAMPLES_PRESENT_UNVERIFIED":
            for name in terrain_fields:
                safe_float(terrain[name], name, -32767, 32767)
            if not (terrain["minTerrainMeters"] <= terrain["medianTerrainMeters"] <= terrain["maxTerrainMeters"]
                    and terrain["minTerrainMeters"] <= terrain["centerTerrainMeters"] <= terrain["maxTerrainMeters"]):
                raise ValueError("INCONSISTENT_TERRAIN")
            if terrain["maxMinusMinMeters"] != terrain["maxTerrainMeters"] - terrain["minTerrainMeters"]:
                raise ValueError("INCONSISTENT_TERRAIN_RANGE")
            if terrain["centerMinusMedianMeters"] != terrain["centerTerrainMeters"] - terrain["medianTerrainMeters"]:
                raise ValueError("INCONSISTENT_TERRAIN_MEDIAN")
        else:
            # Allow center-only value for incomplete (void-containing) neighborhood,
            # but never expose an unverified full-neighborhood statistic.
            if any(terrain[k] is not None for k in terrain_fields[1:]):
                raise ValueError("INVALID_PARTIAL_TERRAIN")
            if terrain["centerTerrainMeters"] is not None and dem_status != "INCOMPLETE_WINDOW_NODATA":
                raise ValueError("UNEXPECTED_CENTER_TERRAIN")
        rows.append({
            "siteId":sid,
            "latitude":site["latitude"], "longitude":site["longitude"],
            "hydroRiversIds":sorted(ids),
            "approximateRiverLineProximityMeters":proximity,
            "riverLineAssessment":"GEOMETRIC_PROXIMITY_ONLY",
            "accGridStatus":grid_status,
            "accUpstreamContributingCellCount":acc_count,
            "accIsElevation":False,
            "srtmWindowStatus":dem_status,
            "srtmTerrainNeighborhood":terrain,
            "srtmTerrainIsVerifiedRoadSurface":False,
            "missingEvidenceCategories":missing,
            "submittedButUnverifiedCategories":unverified,
            "independentEvidenceReview":"NOT_PERFORMED",
            "bridgeCulvertEvidence":"NOT_VERIFIED",
            "officialClosureStatus":"UNKNOWN",
            "actualWadiCrossing":"NOT_CONFIRMED",
            "hydrologicFloodRisk":"NOT_EVALUATED",
            "safeToDrive":None,
        })
    return {
        "reportType":"RAINGUARD_HYDROLOGY7_UNIFIED_EVIDENCE",
        "status":STATUS,
        "siteCount":len(rows),
        "accContextPresentSiteCount":sum(r["accGridStatus"]=="ACC_CELL_PRESENT_UNVERIFIED" for r in rows),
        "completeTerrainWindowSiteCount":sum(r["srtmWindowStatus"]=="WINDOW_SAMPLES_PRESENT_UNVERIFIED" for r in rows),
        "verifiedFloodRiskAssessmentCount":0,
        "independentlyVerifiedRoadCrossingCount":0,
        "independentlyVerifiedBridgeCulvertCount":0,
        "evidenceReviewCompletionCount":0,
        "riskRanking":None,
        "sources":{
            "riverLines":"HydroRIVERS N20_E038 research tile",
            "acc":"HydroSHEDS ACC upstream-cell accumulation",
            "terrain":"Local user-provided SRTM N21E039.hgt neighborhood",
            "review":"Hydrology-3 unverified evidence checklist",
        },
        "safeToDrive":None,
        "alternativeRouteApproved":False,
        "operationalWarningApproved":False,
        "hydrologicFloodRisk":"NOT_EVALUATED",
        "officialRoadClosureStatus":"UNKNOWN",
        "sites":rows,
        "limitations":"Combining geographic evidence does not validate any crossing, bridge, culvert, road surface, flood depth, road closure, ranking or safe driving decision. All sources remain research-only pending independent verification.",
    }


def to_csv(report):
    output=io.StringIO()
    writer=csv.writer(output,lineterminator="\n")
    keys=("siteId","latitude","longitude","hydroRiversIds","approximateRiverLineProximityMeters",
          "accGridStatus","accUpstreamContributingCellCount","srtmWindowStatus",
          "centerTerrainMeters","minTerrainMeters","maxTerrainMeters",
          "medianTerrainMeters","maxMinusMinMeters","centerMinusMedianMeters",
          "missingEvidenceCategories","submittedButUnverifiedCategories",
          "bridgeCulvertEvidence","officialClosureStatus","hydrologicFloodRisk")
    writer.writerow(keys)
    for row in report["sites"]:
        stats=row["srtmTerrainNeighborhood"]
        writer.writerow([
            ";".join(map(str,row["hydroRiversIds"])) if key=="hydroRiversIds" else
            ";".join(row[key]) if key in ("missingEvidenceCategories","submittedButUnverifiedCategories") else
            stats[key] if key in stats else row.get(key)
            for key in keys
        ])
    return output.getvalue()


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--hydrology2",type=Path,required=True)
    parser.add_argument("--hydrology3",type=Path,required=True)
    parser.add_argument("--hydrology4",type=Path,required=True)
    parser.add_argument("--hydrology6",type=Path,required=True)
    parser.add_argument("--prefix",type=Path,default=Path("jeddah_makkah_hydrology7"))
    args=parser.parse_args()
    paths=[Path(str(args.prefix)+s) for s in ("_unified_evidence.json","_unified_evidence.csv")]
    if any(p.exists() for p in paths):
        parser.error("Existing evidence report will not be overwritten. Use a new --prefix")
    try:
        report=unify(*(read_json(p,MAX_INPUT_BYTES) for p in
            (args.hydrology2,args.hydrology3,args.hydrology4,args.hydrology6)))
        contents=[json.dumps(report,ensure_ascii=False,indent=2)+"\n",to_csv(report)]
    except (ValueError,TypeError,OSError,UnicodeError,json.JSONDecodeError) as exc:
        parser.error(str(exc))
    written=[]
    try:
        for path,content in zip(paths,contents):
            path.write_text(content,encoding="utf-8-sig" if path.suffix==".csv" else "utf-8")
            written.append(path)
    except OSError:
        for p in written:p.unlink(missing_ok=True)
        raise
    print(json.dumps({
        "status":report["status"],
        "siteCount":report["siteCount"],
        "accContextPresentSiteCount":report["accContextPresentSiteCount"],
        "completeTerrainWindowSiteCount":report["completeTerrainWindowSiteCount"],
        "verifiedFloodRiskAssessmentCount":0,
        "safeToDrive":None,
        "outputs":[str(p) for p in paths],
    },ensure_ascii=False))


if __name__=="__main__":
    main()
