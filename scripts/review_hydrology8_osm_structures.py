"""Hydrology-8: offline OSM bridge/culvert CANDIDATE matching, not verification.

Stage A: create bounded Overpass QL for the ten local research locations.
Stage B: import an explicitly user-saved Overpass JSON result offline.
No automated external calls; no verified crossing, capacity or road safety.
"""
from __future__ import annotations
import argparse
import csv
import io
import json
import math
from pathlib import Path
from audit_hydrology4_acc_readiness import read_json, inspect_register
from build_hydrology7_unified_evidence import STATUS as H7_STATUS, index_sites

INPUT_LIMIT=6_000_000
QUERY_RADIUS=250
MATCH_RADIUS=200
MAX_ELEMENTS=12000
RESULT_STATUS="OSM_STRUCTURE_CANDIDATES_REQUIRE_INDEPENDENT_VERIFICATION"


def sites_from_report(report):
    records=index_sites(report,"RAINGUARD_HYDROLOGY7_UNIFIED_EVIDENCE",H7_STATUS)
    if (report.get("riskRanking","INVALID") is not None
        or report.get("verifiedFloodRiskAssessmentCount")!=0
        or report.get("independentlyVerifiedRoadCrossingCount")!=0
        or report.get("independentlyVerifiedBridgeCulvertCount")!=0):
        raise ValueError("UNSAFE_OR_APPROVED_BASELINE")
    for site in records.values():
        if (site.get("actualWadiCrossing")!="NOT_CONFIRMED"
            or site.get("bridgeCulvertEvidence")!="NOT_VERIFIED"
            or site.get("hydrologicFloodRisk")!="NOT_EVALUATED"
            or site.get("safeToDrive","INVALID") is not None):
            raise ValueError("INVALID_RESEARCH_SITE")
    return records


def query_for_sites(sites):
    """Overpass QL, one modest request to be run manually in Overpass Turbo."""
    pieces=[]
    for site in sites.values():
        lat,lon=site["latitude"],site["longitude"]
        # Keep each area tight; match source geometries offline after download.
        for expr in ('way["highway"]["bridge"]','way["waterway"]["tunnel"="culvert"]',
                     'way["man_made"="bridge"]','node["man_made"="bridge"]',
                     'way["waterway"]["culvert"]','node["waterway"]["culvert"]'):
            pieces.append(f"  {expr}(around:{QUERY_RADIUS},{lat:.7f},{lon:.7f});")
    return "[out:json][timeout:40];\n(\n"+"\n".join(pieces)+"\n);\nout geom;\n"


def tags_kind(tags):
    if not isinstance(tags,dict):return None
    if tags.get("highway") and tags.get("bridge") not in (None,"no","false","0",""):
        return "MAPPED_ROAD_BRIDGE"
    if tags.get("waterway") and tags.get("tunnel")=="culvert":
        return "MAPPED_WATERWAY_CULVERT"
    if tags.get("man_made")=="bridge":
        return "MAPPED_BRIDGE_OUTLINE_OR_POINT"
    if tags.get("waterway") and tags.get("culvert") not in (None,"no","false","0",""):
        return "MAPPED_WATERWAY_CULVERT_TAG"
    return None


def feature_points(element):
    if element.get("type")=="node":
        p=[element.get("lon"),element.get("lat")]
        return [p] if all(type(v) in (float,int) and math.isfinite(v) for v in p) else []
    if element.get("type")=="way" and isinstance(element.get("geometry"),list):
        points=[]
        for obj in element["geometry"]:
            if not isinstance(obj,dict):return []
            p=[obj.get("lon"),obj.get("lat")]
            if any(type(v) not in (float,int) or not math.isfinite(v) for v in p):return []
            points.append(p)
        return points
    return []


def distance_to_feature(lon,lat,points):
    """Local equirectangular shortest distance to vertex/segments in meters."""
    latitude_scale=111195.0
    longitude_scale=latitude_scale*math.cos(math.radians(lat))
    xy=[((p[0]-lon)*longitude_scale,(p[1]-lat)*latitude_scale) for p in points]
    best=math.inf
    if len(xy)==1:return math.hypot(*xy[0])
    for (ax,ay),(bx,by) in zip(xy,xy[1:]):
        dx,dy=bx-ax,by-ay
        d2=dx*dx+dy*dy
        t=max(0.0,min(1.0,-(ax*dx+ay*dy)/d2)) if d2 else 0.0
        best=min(best,math.hypot(ax+t*dx,ay+t*dy))
    return best


def audit(report,osm):
    sites=sites_from_report(report)
    if not isinstance(osm,dict) or not isinstance(osm.get("elements"),list):
        raise ValueError("INVALID_OVERPASS_EXPORT")
    elements=osm["elements"]
    if len(elements)>MAX_ELEMENTS:raise ValueError("OVERPASS_EXPORT_TOO_LARGE")
    seen=set()
    candidates=[]
    for element in elements:
        if not isinstance(element,dict):raise ValueError("INVALID_OSM_ELEMENT")
        typ,id_=element.get("type"),element.get("id")
        if typ not in ("way","node") or type(id_) is not int or id_<=0:
            raise ValueError("UNSUPPORTED_OSM_ELEMENT")
        key=f"{typ}/{id_}"
        if key in seen:continue
        seen.add(key)
        tags=element.get("tags",{})
        kind=tags_kind(tags)
        if kind is None:continue
        points=feature_points(element)
        if not points:continue
        for site in sites.values():
            dist=distance_to_feature(site["longitude"],site["latitude"],points)
            if dist<=MATCH_RADIUS:
                candidates.append({
                    "siteId":site["siteId"],
                    "osmElement":key,
                    "osmUrl":f"https://www.openstreetmap.org/{typ}/{id_}",
                    "mappedFeatureType":kind,
                    "approximateDistanceMeters":round(dist,1),
                    "tags":{"bridge":tags.get("bridge"),"highway":tags.get("highway"),
                            "waterway":tags.get("waterway"),"tunnel":tags.get("tunnel"),
                            "culvert":tags.get("culvert"),"man_made":tags.get("man_made")},
                    "sourceVerification":"COMMUNITY_MAP_UNVERIFIED",
                    "verifiedPhysicalCrossing":False,
                    "verifiedBridgeOrCulvert":False,
                })
    candidates.sort(key=lambda r:(r["siteId"],r["approximateDistanceMeters"],r["osmElement"]))
    rows=[]
    for site in sites.values():
        hits=[c for c in candidates if c["siteId"]==site["siteId"]]
        rows.append({
            "siteId":site["siteId"],"latitude":site["latitude"],"longitude":site["longitude"],
            "mappedStructureCandidateCount":len(hits),
            "mappedOSMElementIds":[x["osmElement"] for x in hits],
            "mapCoverage":"USER_PROVIDED_OSM_QUERY_SNAPSHOT_NOT_COMPLETE",
            "structureEvidenceStatus":"UNVERIFIED_MAP_CANDIDATES" if hits else "NO_MAPPED_CANDIDATE_IN_SUPPLIED_SNAPSHOT",
            "fieldReviewStatus":"NOT_PERFORMED",
            "verifiedRoadWadiCrossing":False,
            "verifiedCulvertCapacity":False,
            "officialRoadClosureStatus":"UNKNOWN",
            "floodRisk":"NOT_EVALUATED",
            "safeToDrive":None,
        })
    return {
        "reportType":"RAINGUARD_HYDROLOGY8_OSM_STRUCTURE_REVIEW",
        "status":RESULT_STATUS,
        "siteCount":len(rows),
        "matchedSiteCount":sum(x["mappedStructureCandidateCount"]>0 for x in rows),
        "totalCandidateMatches":len(candidates),
        "independentlyVerifiedBridgeCulvertCount":0,
        "roadWadiCrossingConfirmedCount":0,
        "officialRoadClosureEvidenceCount":0,
        "hydrologicFloodRisk":"NOT_EVALUATED",
        "riskRanking":None,
        "safeToDrive":None,
        "alternativeRouteApproved":False,
        "operationalWarningApproved":False,
        "source":"Locally imported OpenStreetMap Overpass snapshot; no authentication, no completeness guarantee",
        "sites":rows,"candidates":candidates,
        "limitations":"OSM labels are community mapped and may represent bridges over non-water features or culverts unrelated to the road. Absence of tags is NOT proof of absence of structures. Proximity does NOT prove a crossing or capacity. No live warning or driving decision.",
    }


def site_csv(report):
    buf=io.StringIO()
    writer=csv.writer(buf,lineterminator="\n")
    keys=["siteId","latitude","longitude","mappedStructureCandidateCount",
          "mappedOSMElementIds","structureEvidenceStatus","fieldReviewStatus",
          "verifiedRoadWadiCrossing","verifiedCulvertCapacity","floodRisk"]
    writer.writerow(keys)
    for item in report["sites"]:
        writer.writerow([";".join(item[k]) if k=="mappedOSMElementIds" else item[k] for k in keys])
    return buf.getvalue()


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--hydrology7",type=Path,required=True)
    parser.add_argument("--osm",type=Path,help="Optional manually downloaded Overpass JSON; never auto-fetched")
    parser.add_argument("--prefix",type=Path,default=Path("jeddah_makkah_hydrology8"))
    args=parser.parse_args()
    paths=[Path(str(args.prefix)+s) for s in (("_candidates.json","_sites.csv") if args.osm else ("_overpass_query.ql",))]
    if any(path.exists() for path in paths):
        parser.error("Output exists; select a new --prefix to preserve research records")
    try:
        baseline=read_json(args.hydrology7,INPUT_LIMIT)
        sites=sites_from_report(baseline)
        if args.osm:
            report=audit(baseline,read_json(args.osm,INPUT_LIMIT))
            contents=[json.dumps(report,ensure_ascii=False,indent=2)+"\n",site_csv(report)]
            summary={"status":report["status"],"siteCount":report["siteCount"],
                     "matchedSiteCount":report["matchedSiteCount"],
                     "totalCandidateMatches":report["totalCandidateMatches"],
                     "independentlyVerifiedBridgeCulvertCount":0,
                     "safeToDrive":None}
        else:
            contents=[query_for_sites(sites)]
            summary={"status":"OVERPASS_QUERY_GENERATED_NOT_EXECUTED",
                     "siteCount":len(sites),"independentlyVerifiedBridgeCulvertCount":0,
                     "safeToDrive":None}
    except (OSError,UnicodeError,ValueError,TypeError,json.JSONDecodeError) as exc:
        parser.error(str(exc))
    written=[]
    try:
        for path,body in zip(paths,contents):
            path.write_text(body,encoding="utf-8-sig" if path.suffix==".csv" else "utf-8")
            written.append(path)
    except OSError:
        for path in written:path.unlink(missing_ok=True)
        raise
    summary["outputs"]=[str(p) for p in paths]
    print(json.dumps(summary,ensure_ascii=False))


if __name__=="__main__":main()
