"""Hydrology-10: prepare local human inspection worksheets for unverified OSM candidates.

No field observations are created, no review is approved, and no road-safety
or flood-risk judgement can be inferred from this research package.
"""
from __future__ import annotations
import argparse
import csv
import io
import json
import math
from pathlib import Path
from audit_hydrology4_acc_readiness import read_json
from audit_hydrology9_osm_geometry import STATUS as H9_STATUS

MAX_SIZE=3_000_000
MAX_SITES=300
MAX_CANDIDATES=1500
REVIEW_STATUS="FIELD_REVIEW_PACKAGE_ONLY_NOT_INSPECTED"

FIELDS=(
    "recordId","siteId","osmElement","osmUrl","latitude","longitude",
    "mappedFeatureType","distanceToResearchRouteMeters",
    "distanceToCandidateHydroRiverMeters","geometryContext",
    "actualStructureTypeObserved","actualRoadWadiCrossingObserved",
    "fieldVisitDateUtc","inspectorOrganization","inspectorName",
    "photoReference","photoTakenAtUtc","locationSurveyReference",
    "culvertOpeningWidthMeters","culvertOpeningHeightMeters","culvertCount",
    "bridgeDeckSurveyReference","roadAuthorityInventoryReference",
    "officialClosureRecordReference","independentReviewReference","reviewNotes",
)

def check_source(h9):
    if not isinstance(h9,dict) or h9.get("reportType")!="RAINGUARD_HYDROLOGY9_OSM_GEOMETRY_REVIEW" or h9.get("status")!=H9_STATUS:
        raise ValueError("INVALID_HYDROLOGY9_SOURCE")
    required={"safeToDrive":None,"alternativeRouteApproved":False,
              "operationalWarningApproved":False,"riskRanking":None,
              "verifiedPhysicalCrossingCount":0,"verifiedBridgeCulvertCount":0,
              "verifiedCulvertCapacityCount":0,"officialRoadClosureEvidenceCount":0,
              "hydrologicFloodRisk":"NOT_EVALUATED"}
    for key,val in required.items():
        if key not in h9 or type(h9[key]) is not type(val) or h9[key]!=val:
            raise ValueError("UNSUPPORTED_APPROVAL_OR_STATUS_"+key)
    sites=h9.get("sites")
    candidates=h9.get("candidates")
    if (not isinstance(sites,list) or not 1<=len(sites)<=MAX_SITES or
        not isinstance(candidates,list) or len(candidates)>MAX_CANDIDATES or
        type(h9.get("siteCount")) is not int or len(sites)!=h9["siteCount"] or
        type(h9.get("sourceCandidateMatchCount")) is not int or len(candidates)!=h9["sourceCandidateMatchCount"]):
        raise ValueError("INVALID_REVIEW_COUNTS")
    known={}
    for s in sites:
        if not isinstance(s,dict) or not isinstance(s.get("siteId"),str) or s["siteId"] in known:
            raise ValueError("INVALID_SITE_ID")
        lat,lon=s.get("latitude"),s.get("longitude")
        if any(type(v) not in (int,float) or not math.isfinite(v) for v in (lat,lon)) or not 20<=lat<=22.5 or not 38<=lon<=40.5:
            raise ValueError("INVALID_SITE_COORDINATES")
        if s.get("fieldReviewCompleted") is not False or s.get("operationalHazardAssessed") is not False or s.get("safeToDrive","MISSING") is not None:
            raise ValueError("UNEXPECTED_SITE_REVIEW_APPROVAL")
        known[s["siteId"]]=s
    seen=set()
    for c in candidates:
        if not isinstance(c,dict) or c.get("siteId") not in known:
            raise ValueError("INVALID_CANDIDATE_SITE")
        key=c.get("osmElement")
        if not isinstance(key,str) or not key.startswith(("way/","node/")) or not key.split("/",1)[1].isdigit():
            raise ValueError("INVALID_OSM_REF")
        pair=(c["siteId"],key)
        if pair in seen:raise ValueError("DUPLICATE_CANDIDATE_MATCH")
        seen.add(pair)
        if c.get("osmUrl")!=f"https://www.openstreetmap.org/{key}":
            raise ValueError("UNTRUSTED_OSM_URL")
        if c.get("sourceReview")!="OSM_COMMUNITY_MAP_UNVERIFIED" or c.get("physicalRoadWadiCrossing")!="NOT_VERIFIED" or c.get("floodRisk")!="NOT_EVALUATED" or c.get("safeToDrive","MISSING") is not None:
            raise ValueError("UNEXPECTED_CANDIDATE_APPROVAL")
        if c.get("mappedFeatureType") not in ("MAPPED_ROAD_BRIDGE","MAPPED_WATERWAY_CULVERT","MAPPED_BRIDGE_OUTLINE_OR_POINT","MAPPED_WATERWAY_CULVERT_TAG"):
            raise ValueError("INVALID_MAP_FEATURE_TYPE")
        for dist_field in ("distanceToResearchRouteMeters","distanceToCandidateHydroRiverMeters"):
            dist=c.get(dist_field)
            if type(dist) not in (int,float) or not math.isfinite(dist) or dist<0 or dist>100000:
                raise ValueError("INVALID_GEOMETRY_DISTANCE")
    for sid,s in known.items():
        if s.get("geometryCandidateCount")!=sum(c["siteId"]==sid for c in candidates):
            raise ValueError("SITE_MATCH_COUNT_INCONSISTENT")
    return known,candidates


def build_package(h9):
    sites,candidates=check_source(h9)
    records=[]
    for site in sites.values():
        matches=[x for x in candidates if x["siteId"]==site["siteId"]]
        # An unmatched site also receives a worksheet: OSM absence is NOT proof of no structure.
        for idx,candidate in enumerate(matches or [None],1):
            c=candidate or {}
            record={
                "recordId":f'{site["siteId"]}-'+(c.get("osmElement","NO_OSM_MATCH").replace("/","-")),
                "siteId":site["siteId"],
                "osmElement":c.get("osmElement",""),
                "osmUrl":c.get("osmUrl",""),
                "latitude":site["latitude"],"longitude":site["longitude"],
                "mappedFeatureType":c.get("mappedFeatureType","NO_OSM_MATCH_IN_SNAPSHOT"),
                "distanceToResearchRouteMeters":c.get("distanceToResearchRouteMeters"),
                "distanceToCandidateHydroRiverMeters":c.get("distanceToCandidateHydroRiverMeters"),
                "geometryContext":c.get("geometryContext","NO_MATCH_UNVERIFIED"),
                "actualStructureTypeObserved":"",
                "actualRoadWadiCrossingObserved":"",
                "fieldVisitDateUtc":"","inspectorOrganization":"","inspectorName":"",
                "photoReference":"","photoTakenAtUtc":"","locationSurveyReference":"",
                "culvertOpeningWidthMeters":"","culvertOpeningHeightMeters":"",
                "culvertCount":"","bridgeDeckSurveyReference":"",
                "roadAuthorityInventoryReference":"",
                "officialClosureRecordReference":"",
                "independentReviewReference":"","reviewNotes":"",
                "siteInspectionStatus":"NOT_PERFORMED",
                "independentEvidenceAuthentication":"NOT_PERFORMED",
                "safeToDrive":None,"floodRisk":"NOT_EVALUATED",
            }
            records.append(record)
    return {
        "reportType":"RAINGUARD_HYDROLOGY10_FIELD_REVIEW_PACKAGE",
        "status":REVIEW_STATUS,
        "siteCount":len(sites),
        "sourceCandidateMatchCount":len(candidates),
        "inspectionWorksheetCount":len(records),
        "verifiedBridgeCulvertCount":0,
        "verifiedPhysicalCrossingCount":0,
        "completedFieldVisitCount":0,
        "independentReviewCount":0,
        "safeToDrive":None,"alternativeRouteApproved":False,
        "operationalWarningApproved":False,"hydrologicFloodRisk":"NOT_EVALUATED",
        "worksheets":records,
        "sourceAttribution":"OpenStreetMap contributors; community mapping, not a certified asset inventory",
        "limitations":"These are blank data-collection worksheets. User-entered photos, dimensions and official references would still require authentication and independent review. Never infer safe driving, flood risk, culvert capacity, or official closures.",
    }


def worksheet_csv(pkg):
    dest=io.StringIO()
    writer=csv.writer(dest,lineterminator="\n")
    writer.writerow(FIELDS)
    for item in pkg["worksheets"]:
        writer.writerow([item.get(k,"") for k in FIELDS])
    return dest.getvalue()


def site_csv(pkg):
    dest=io.StringIO()
    writer=csv.writer(dest,lineterminator="\n")
    columns=("siteId","latitude","longitude","osmCandidateMatchCount",
             "fieldReviewCompleted","bridgeCulvertVerified","officialRoadClosureVerified")
    writer.writerow(columns)
    by_site={}
    for item in pkg["worksheets"]:
        by_site.setdefault(item["siteId"],[]).append(item)
    for sid,items in by_site.items():
        writer.writerow((sid,items[0]["latitude"],items[0]["longitude"],
                         sum(bool(x["osmElement"]) for x in items),False,False,False))
    return dest.getvalue()


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--hydrology9",type=Path,required=True)
    p.add_argument("--prefix",type=Path,default=Path("jeddah_makkah_hydrology10"))
    args=p.parse_args()
    outputs=[Path(str(args.prefix)+suffix) for suffix in ("_review_package.json","_field_worksheet.csv","_site_summary.csv")]
    if any(out.exists() for out in outputs):
        p.error("OUTPUT_EXISTS_USE_NEW_PREFIX")
    try:
        pkg=build_package(read_json(args.hydrology9,MAX_SIZE))
        content=[json.dumps(pkg,ensure_ascii=False,indent=2)+"\n",worksheet_csv(pkg),site_csv(pkg)]
    except (OSError,ValueError,TypeError,UnicodeError,json.JSONDecodeError) as exc:
        p.error(str(exc))
    written=[]
    try:
        for path,body in zip(outputs,content):
            path.write_text(body,encoding="utf-8-sig" if path.suffix==".csv" else "utf-8")
            written.append(path)
    except OSError:
        for path in written:path.unlink(missing_ok=True)
        raise
    print(json.dumps({"status":pkg["status"],"siteCount":pkg["siteCount"],
                      "sourceCandidateMatchCount":pkg["sourceCandidateMatchCount"],
                      "inspectionWorksheetCount":pkg["inspectionWorksheetCount"],
                      "completedFieldVisitCount":0,"safeToDrive":None,
                      "outputs":[str(o) for o in outputs]},ensure_ascii=False))

if __name__=="__main__":
    main()
