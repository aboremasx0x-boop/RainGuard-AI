"""Hydrology-20: local spatial attachment derived from existing H10 research package.
No network, no invented coordinates, no roads/authority inference, no operational decisions.
"""
from __future__ import annotations
import argparse
import csv
import json
import math
import re
from pathlib import Path

SITE = re.compile(r"RG-HYDRO-REVIEW-[0-9]{3}\Z")
RECORD = re.compile(r"RG-HYDRO-REVIEW-[0-9]{3}-(?:way-[0-9]+|node-[0-9]+|NO_OSM_MATCH)\Z")
STATUS = "RESEARCH_COORDINATES_NOT_FIELD_VERIFIED"

def derive(data):
    if not isinstance(data,dict) or data.get("reportType")!="RAINGUARD_HYDROLOGY10_FIELD_REVIEW_PACKAGE" or data.get("status")!="FIELD_REVIEW_PACKAGE_ONLY_NOT_INSPECTED":
        raise ValueError("WRONG_SOURCE_HYDROLOGY10_PACKAGE")
    for key,value in [("safeToDrive",None),("alternativeRouteApproved",False),
                      ("operationalWarningApproved",False),("hydrologicFloodRisk","NOT_EVALUATED"),
                      ("verifiedBridgeCulvertCount",0),("completedFieldVisitCount",0),
                      ("independentReviewCount",0)]:
        if key not in data or type(data[key]) is not type(value) or data[key]!=value:
            raise ValueError("UNTRUSTED_SOURCE_STATUS_"+key)
    ws=data.get("worksheets")
    if not isinstance(ws,list) or not ws or len(ws)>1000 or len(ws)!=data.get("inspectionWorksheetCount"):
        raise ValueError("INVALID_WORKSHEET_COUNT")
    if not isinstance(data.get("siteCount"),int) or not 1<=data["siteCount"]<=300:
        raise ValueError("INVALID_SITE_COUNT")
    sites={}
    seen=set()
    for row in ws:
        if not isinstance(row,dict):raise ValueError("INVALID_ROW")
        sid,rid=row.get("siteId"),row.get("recordId")
        if not isinstance(sid,str) or not SITE.fullmatch(sid) or not isinstance(rid,str) or not RECORD.fullmatch(rid) or not rid.startswith(sid+"-") or rid in seen:
            raise ValueError("INVALID_OR_DUPLICATE_IDENTIFIERS")
        seen.add(rid)
        lat,lon=row.get("latitude"),row.get("longitude")
        if any(type(x) not in (int,float) or not math.isfinite(x) for x in (lat,lon)) or not(20<=lat<=22.5 and 38<=lon<=40.5):
            raise ValueError("INVALID_RESEARCH_COORDINATES")
        if row.get("siteInspectionStatus")!="NOT_PERFORMED" or row.get("independentEvidenceAuthentication")!="NOT_PERFORMED" or row.get("safeToDrive","MISSING") is not None or row.get("floodRisk")!="NOT_EVALUATED":
            raise ValueError("UNVERIFIED_STATUS_REQUIRED")
        osmel=row.get("osmElement")
        expected="NO_OSM_MATCH" if not osmel else osmel.replace("/","-")
        if not isinstance(osmel,str) or rid!=sid+"-"+expected:
            raise ValueError("INVALID_OSM_RECORD_ID")
        if osmel and (not re.fullmatch(r"(?:way|node)/[1-9][0-9]*",osmel) or row.get("osmUrl")!="https://www.openstreetmap.org/"+osmel):
            raise ValueError("INVALID_OSM_LINK")
        if not osmel and row.get("osmUrl") not in ("",None):raise ValueError("INVALID_UNMATCHED_LINK")
        if sid not in sites:
            sites[sid]={"siteId":sid,"latitude":lat,"longitude":lon,"recordIds":[],"osmCandidateCount":0,"noOsmMatch":False}
        s=sites[sid]
        if (lat,lon)!=(s["latitude"],s["longitude"]):raise ValueError("CONFLICTING_SITE_COORDINATES")
        s["recordIds"].append(rid)
        s["osmCandidateCount"]+=bool(osmel)
        s["noOsmMatch"]|=not bool(osmel)
    if len(sites)!=data["siteCount"]:raise ValueError("SITE_COUNT_MISMATCH")
    if data.get("sourceCandidateMatchCount")!=sum(s["osmCandidateCount"] for s in sites.values()):
        raise ValueError("CANDIDATE_COUNT_MISMATCH")
    if any(s["noOsmMatch"] and s["osmCandidateCount"] for s in sites.values()):
        raise ValueError("INCONSISTENT_MATCH_STATUS")
    return [sites[k] for k in sorted(sites)]

def export(source,dest):
    if source.stat().st_size>3_000_000:raise ValueError("SOURCE_TOO_LARGE")
    sites=derive(json.loads(source.read_text(encoding="utf-8-sig")))
    if dest.exists():raise ValueError("OUTPUT_EXISTS_USE_NEW_NAME")
    with dest.open("x",newline="",encoding="utf-8-sig") as f:
        writer=csv.writer(f)
        writer.writerow(["siteId","latitude","longitude","researchWorksheetCount","osmCandidateCount",
                        "osmMatchStatus","coordinateStatus","fieldVerification","agencyOwner","roadName"])
        for s in sites:
            writer.writerow([s["siteId"],s["latitude"],s["longitude"],len(s["recordIds"]),
                             s["osmCandidateCount"],"NO_OSM_MATCH_UNVERIFIED" if s["noOsmMatch"] else "OSM_CANDIDATES_UNVERIFIED",
                             STATUS,"NOT_PERFORMED","NOT_IDENTIFIED","NOT_IDENTIFIED"])
    return len(sites),len({rid for s in sites for rid in s["recordIds"]})

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--source",type=Path,default=Path("jeddah_makkah_hydrology10_review_package.json"))
    p.add_argument("--output",type=Path,default=Path("rainguard_hydrology20_spatial_attachment.csv"))
    args=p.parse_args()
    count,records=export(args.source,args.output)
    print(json.dumps({"sites":count,"records":records,"status":STATUS,"output":str(args.output)},ensure_ascii=False))
if __name__=="__main__":main()
