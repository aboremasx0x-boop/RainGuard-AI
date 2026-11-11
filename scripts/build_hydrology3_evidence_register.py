"""RainGuard Hydrology-3 local evidence-review register.

This tool does NOT verify submitted references or make flood/safe road decisions.
Submission labels remain unverified until a separate, independently authorized
inspection workflow is built. No external network requests.
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import math
import re
from pathlib import Path

CATEGORIES = (
    "bridge_culvert_inventory",
    "dem_road_and_terrain_elevation",
    "wadi_network_spatial_review",
    "historical_flood_observation",
    "official_road_closure_records",
)
MAX_SITES = 300
MAX_RECORDS = 3000
MAX_SIZE = 2_500_000
SITE_ID_PATTERN = re.compile(r"RG-HYDRO-REVIEW-[0-9]{3}\Z")
EVIDENCE_FIELDS = ("siteId","category","sourceReference","sourceOrganization",
                   "observedAtUtc","submittedBy","notes")


def load(path: Path):
    if not path.is_file() or path.stat().st_size > MAX_SIZE:
        raise ValueError("MISSING_OR_OVERSIZE_INPUT")
    return json.loads(path.read_text(encoding="utf-8"))


def safe_site(site):
    if not isinstance(site,dict) or not isinstance(site.get("siteId"),str) or not SITE_ID_PATTERN.fullmatch(site["siteId"]):
        raise ValueError("INVALID_SITE_IDENTIFIER")
    lat,lon=site.get("latitude"),site.get("longitude")
    if (type(lat) not in (int,float) or type(lon) not in (int,float)
        or not math.isfinite(lat) or not math.isfinite(lon)
        or not 20<=lat<=22.5 or not 38<=lon<=40.5
        or site.get("verification")!="NOT_FIELD_VERIFIED"
        or site.get("crossingStatus")!="NOT_CONFIRMED"
        or site.get("culvertStatus")!="UNKNOWN"
        or site.get("floodRisk")!="NOT_EVALUATED"):
        raise ValueError("INVALID_OR_PREAPPROVED_SITE")
    river_ids=site.get("riverIds")
    if not isinstance(river_ids,list) or not river_ids or not all(type(x) is int and x>0 for x in river_ids):
        raise ValueError("MISSING_RIVER_IDS")
    return {
        "siteId":site["siteId"],"latitude":lat,"longitude":lon,
        "riverIds":sorted(set(river_ids)),
        "nearestRiverDistanceMeters":site.get("nearestRiverDistanceMeters"),
    }


def validated_sites(document):
    if (not isinstance(document,dict)
        or document.get("reportType")!="RAINGUARD_HYDROLOGY2_REVIEW_SITES_ONLY"
        or document.get("status")!="RESEARCH_REVIEW_LOCATIONS_NOT_VERIFIED"
        or document.get("safeToDrive","INVALID") is not None
        or document.get("officialRoadCrossingConfirmed") is not False
        or document.get("coverage")!="ONE_RESEARCH_TILE_ONLY_NOT_COMPLETE"
        or document.get("tile")!="N20_E038.geojson"):
        raise ValueError("INVALID_HYDROLOGY2_SOURCE")
    sites=document.get("sites")
    if not isinstance(sites,list) or not 1<=len(sites)<=MAX_SITES or len(sites)!=document.get("reviewSiteCount"):
        raise ValueError("INVALID_SITE_COUNT")
    results=[safe_site(site) for site in sites]
    if len({site["siteId"] for site in results})!=len(results):
        raise ValueError("DUPLICATE_SITE_ID")
    return results


def evidence_submissions(data, known_sites):
    """Validate provenance fields syntactically; DO NOT authenticate their contents."""
    if data is None:
        return []
    if not isinstance(data,list) or len(data)>MAX_RECORDS:
        raise ValueError("INVALID_EVIDENCE_LIST")
    results=[]
    for index,item in enumerate(data):
        if not isinstance(item,dict) or item.get("siteId") not in known_sites or item.get("category") not in CATEGORIES:
            raise ValueError(f"INVALID_EVIDENCE_CATEGORY_OR_SITE_{index}")
        if any(key not in EVIDENCE_FIELDS for key in item):
            raise ValueError("UNSUPPORTED_EVIDENCE_FIELD")
        record={key:item.get(key,"") for key in EVIDENCE_FIELDS}
        if any(not isinstance(v,str) or len(v)>1000 for v in record.values()):
            raise ValueError("INVALID_EVIDENCE_TEXT")
        # A source reference is only a claim until separately inspected.
        record["submissionStatus"]="SUBMITTED_UNVERIFIED" if record["sourceReference"].strip() else "EMPTY_NOT_SUBMITTED"
        results.append(record)
    return results


def build_register(hydro2, submissions=None):
    sites=validated_sites(hydro2)
    evidence=evidence_submissions(submissions,{s["siteId"] for s in sites})
    register=[]
    for site in sites:
        categories=[]
        for category in CATEGORIES:
            matching=[r for r in evidence if r["siteId"]==site["siteId"] and r["category"]==category
                      and r["submissionStatus"]=="SUBMITTED_UNVERIFIED"]
            categories.append({
                "category":category,
                "status":"SUBMITTED_UNVERIFIED" if matching else "MISSING_EVIDENCE",
                "submissionCount":len(matching),
                "independentReviewStatus":"NOT_PERFORMED",
                "sourceReferences":[r["sourceReference"] for r in matching],
            })
        register.append({
            **site,
            "evidenceChecklist":categories,
            "missingEvidenceCategories":[c["category"] for c in categories if c["status"]=="MISSING_EVIDENCE"],
            "reviewStatus":"HUMAN_REVIEW_REQUIRED",
            "bridgeOrCulvertStatus":"UNKNOWN",
            "demElevationStatus":"NOT_EVALUATED",
            "wadiCrossingStatus":"NOT_CONFIRMED",
            "historicalFloodStatus":"UNKNOWN",
            "officialRoadClosureStatus":"UNKNOWN",
            "floodRisk":"NOT_EVALUATED",
            "safeToDrive":None,
        })
    return {
        "reportType":"RAINGUARD_HYDROLOGY3_UNVERIFIED_EVIDENCE_REGISTER",
        "status":"REVIEW_REGISTER_ONLY_NO_SAFETY_DECISION",
        "source":"Hydrology-2 local research candidate review sites",
        "sourceTile":"N20_E038.geojson",
        "siteCount":len(register),
        "categoriesRequired":list(CATEGORIES),
        "submittedReferenceCount":sum(1 for r in evidence if r["submissionStatus"]=="SUBMITTED_UNVERIFIED"),
        "independentlyVerifiedEvidenceCount":0,
        "sites":register,
        "safeToDrive":None,
        "alternativeRouteApproved":False,
        "operationalWarningApproved":False,
        "roadClosureStatus":"UNKNOWN",
        "hydrologicFloodRisk":"NOT_EVALUATED",
        "note":"Self-submitted source references are not authenticated. Independent field, geospatial and official-source verification remains necessary.",
    }


def review_csv(report):
    buffer=io.StringIO()
    writer=csv.writer(buffer,lineterminator="\n")
    writer.writerow(["siteId","latitude","longitude","riverIds","evidenceCategory","evidenceStatus",
                     "independentReviewStatus","referenceCount","reviewStatus"])
    for site in report["sites"]:
        for entry in site["evidenceChecklist"]:
            writer.writerow([site["siteId"],site["latitude"],site["longitude"],
                ";".join(map(str,site["riverIds"])),entry["category"],entry["status"],
                entry["independentReviewStatus"],entry["submissionCount"],site["reviewStatus"]])
    return buffer.getvalue()


def blank_evidence_csv(report):
    buffer=io.StringIO()
    writer=csv.writer(buffer,lineterminator="\n")
    writer.writerow(EVIDENCE_FIELDS)
    for site in report["sites"]:
        for category in CATEGORIES:
            writer.writerow([site["siteId"],category,"","","","",""])
    return buffer.getvalue()


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--hydrology2",type=Path,required=True)
    parser.add_argument("--submissions",type=Path,help="Optional JSON array of claimed references, never auto-verified")
    parser.add_argument("--prefix",type=Path,default=Path("jeddah_makkah_hydrology3"))
    args=parser.parse_args()
    outputs=[Path(str(args.prefix)+s) for s in ("_register.json","_checklist.csv","_evidence_template.csv")]
    if any(p.exists() for p in outputs):
        parser.error("Output already exists; use another --prefix; do not overwrite review history")
    try:
        report=build_register(load(args.hydrology2),load(args.submissions) if args.submissions else None)
        contents=[json.dumps(report,ensure_ascii=False,indent=2)+"\n",
                  review_csv(report),blank_evidence_csv(report)]
    except (OSError,ValueError,TypeError,UnicodeError,json.JSONDecodeError) as exc:
        parser.error(str(exc))
    written=[]
    try:
        for path,body in zip(outputs,contents):
            path.write_text(body,encoding="utf-8-sig" if path.suffix==".csv" else "utf-8")
            written.append(path)
    except OSError:
        for path in written:path.unlink(missing_ok=True)
        raise
    print(json.dumps({"status":report["status"],"siteCount":report["siteCount"],
         "checklistRows":len(report["sites"])*len(CATEGORIES),
         "independentlyVerifiedEvidenceCount":0,
         "outputs":[str(path) for path in outputs],
         "safeToDrive":None},ensure_ascii=False))


if __name__=="__main__":
    main()
