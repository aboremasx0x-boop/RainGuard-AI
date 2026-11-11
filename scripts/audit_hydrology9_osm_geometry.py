"""Hydrology-9: offline geometry context and source-review list for OSM candidates.

Computes proximity to public research route and only the HydroRIVERS IDs
already identified at each site. It does NOT authenticate maps, prove a
physical crossing, measure culvert capacity, or issue routing/flood warnings.
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import math
from pathlib import Path

from audit_hydrology4_acc_readiness import read_json
from review_hydrology8_osm_structures import (
    INPUT_LIMIT, RESULT_STATUS as HYDRO8_STATUS,
    feature_points, tags_kind, sites_from_report,
)
from scan_route_hydrorivers_local import (
    route_points, river_features, meters_xy, sq_segment_distance, load_json,
)

STATUS = "OSM_GEOMETRY_CONTEXT_REVIEW_ONLY_UNVERIFIED"
MAX_CANDIDATES = 1500
MAX_OSM_ELEMENTS = 12000
NEARBY_METERS = 200


def indexed_h8(h8, sites):
    if not isinstance(h8,dict) or h8.get("reportType")!="RAINGUARD_HYDROLOGY8_OSM_STRUCTURE_REVIEW" or h8.get("status")!=HYDRO8_STATUS:
        raise ValueError("INVALID_HYDROLOGY8_REPORT")
    if (h8.get("safeToDrive","INVALID") is not None
        or h8.get("alternativeRouteApproved") is not False
        or h8.get("operationalWarningApproved") is not False
        or h8.get("independentlyVerifiedBridgeCulvertCount") != 0
        or h8.get("roadWadiCrossingConfirmedCount") != 0
        or h8.get("riskRanking","INVALID") is not None):
        raise ValueError("UNSAFE_HYDROLOGY8_REPORT")
    rows=h8.get("sites")
    candidates=h8.get("candidates")
    if (not isinstance(rows,list) or len(rows)!=len(sites)
        or not isinstance(candidates,list) or len(candidates)>MAX_CANDIDATES
        or len(candidates)!=h8.get("totalCandidateMatches")):
        raise ValueError("INVALID_HYDROLOGY8_COUNTS")
    lookup={}
    for row in rows:
        if not isinstance(row,dict) or row.get("siteId") not in sites or row["siteId"] in lookup:
            raise ValueError("MISMATCHED_HYDROLOGY8_SITE")
        base=sites[row["siteId"]]
        if abs(row.get("latitude",math.inf)-base["latitude"])>0.000001 or abs(row.get("longitude",math.inf)-base["longitude"])>0.000001:
            raise ValueError("MISMATCHED_HYDROLOGY8_COORDINATES")
        if row.get("verifiedRoadWadiCrossing") is not False or row.get("verifiedCulvertCapacity") is not False or row.get("safeToDrive","INVALID") is not None:
            raise ValueError("UNSAFE_HYDROLOGY8_SITE")
        lookup[row["siteId"]]=row
    if set(lookup)!=set(sites):
        raise ValueError("MISSING_HYDROLOGY8_SITE")
    seen=set()
    for candidate in candidates:
        if not isinstance(candidate,dict) or candidate.get("siteId") not in sites:
            raise ValueError("INVALID_CANDIDATE")
        identifier=candidate.get("osmElement")
        if (not isinstance(identifier,str) or not identifier.startswith(("way/","node/"))
            or not identifier.split("/",1)[1].isdigit()):
            raise ValueError("INVALID_OSM_ID")
        key=(candidate["siteId"],identifier)
        if key in seen:raise ValueError("DUPLICATE_MATCH")
        seen.add(key)
        if (candidate.get("sourceVerification")!="COMMUNITY_MAP_UNVERIFIED"
            or candidate.get("verifiedPhysicalCrossing") is not False
            or candidate.get("verifiedBridgeOrCulvert") is not False):
            raise ValueError("CLAIMED_VERIFIED_OSM_CANDIDATE")
        if not isinstance(candidate.get("approximateDistanceMeters"),(int,float)) or not math.isfinite(candidate["approximateDistanceMeters"]) or not 0<=candidate["approximateDistanceMeters"]<=NEARBY_METERS:
            raise ValueError("INVALID_CANDIDATE_DISTANCE")
    for sid,row in lookup.items():
        expected={c["osmElement"] for c in candidates if c["siteId"]==sid}
        if row.get("mappedStructureCandidateCount")!=len(expected) or set(row.get("mappedOSMElementIds",[]))!=expected:
            raise ValueError("INCONSISTENT_CANDIDATE_SUMMARY")
    return candidates


def geometry_records(osm,keys):
    if not isinstance(osm,dict) or not isinstance(osm.get("elements"),list) or len(osm["elements"])>MAX_OSM_ELEMENTS:
        raise ValueError("INVALID_RAW_OVERPASS")
    found={}
    for e in osm["elements"]:
        if not isinstance(e,dict) or e.get("type") not in ("node","way") or type(e.get("id")) is not int or e["id"]<=0:
            raise ValueError("INVALID_RAW_OSM_ELEMENT")
        key=f'{e["type"]}/{e["id"]}'
        if key not in keys:continue
        points=feature_points(e)
        kind=tags_kind(e.get("tags",{}))
        if not points or kind is None:
            raise ValueError("MISSING_MATCHED_OSM_GEOMETRY")
        if len(points)>5000:raise ValueError("OVERSIZE_OSM_GEOMETRY")
        if any(not (38<=p[0]<=40.5 and 20<=p[1]<=22.5) for p in points):
            raise ValueError("OUTSIDE_PILOT_GEOMETRY")
        if key in found:continue
        found[key]=(kind,points)
    if set(found)!=keys:raise ValueError("OSM_SNAPSHOT_NOT_MATCHING_HYDROLOGY8")
    return found


def minimum_distance_meters(a,b,ref_lat):
    """Planar segment-to-segment nearest distance; approximate, not certified topology."""
    if not a or not b:
        return None
    pa=[meters_xy(tuple(p),ref_lat) for p in a]
    pb=[meters_xy(tuple(p),ref_lat) for p in b]
    seg_a=list(zip(pa,pa[1:])) if len(pa)>1 else [(pa[0],pa[0])]
    seg_b=list(zip(pb,pb[1:])) if len(pb)>1 else [(pb[0],pb[0])]
    d=math.inf
    for x,y in seg_a:
        for u,v in seg_b:
            d=min(d,sq_segment_distance(x,y,u,v))
            if d==0:return 0.0
    return round(math.sqrt(d),1)


def build_report(h7,h8,osm,route_data,rivers_data):
    sites=sites_from_report(h7)
    candidates=indexed_h8(h8,sites)
    geometries=geometry_records(osm,{c["osmElement"] for c in candidates})
    route=route_points(route_data)
    rivers=dict(river_features(rivers_data))
    if len(rivers)!=len(river_features(rivers_data)):
        raise ValueError("DUPLICATE_HYDRORIVERS_ID")
    if not all(set(s["hydroRiversIds"])<=set(rivers) for s in sites.values()):
        raise ValueError("HYDRORIVERS_ID_NOT_IN_TILE")
    rows=[]
    for c in candidates:
        site=sites[c["siteId"]]
        kind,points=geometries[c["osmElement"]]
        if kind!=c.get("mappedFeatureType"):
            raise ValueError("OSM_TAG_KIND_CHANGED_SINCE_STAGE8")
        distance_route=minimum_distance_meters(points,route,site["latitude"])
        river_distance=min(
            minimum_distance_meters(points,rivers[rid],site["latitude"])
            for rid in site["hydroRiversIds"]
        )
        rows.append({
            "siteId":c["siteId"],"osmElement":c["osmElement"],
            "osmUrl":f'https://www.openstreetmap.org/{c["osmElement"]}',
            "mappedFeatureType":kind,
            "distanceToResearchRouteMeters":distance_route,
            "distanceToCandidateHydroRiverMeters":river_distance,
            "geometryContext":"MAP_LINES_OVERLAP_APPROXIMATELY" if distance_route<=1 and river_distance<=1
                              else "MAP_LINES_NEARBY" if distance_route<=NEARBY_METERS and river_distance<=NEARBY_METERS
                              else "NO_CLOSE_THREE_WAY_CONTEXT",
            "physicalRoadWadiCrossing":"NOT_VERIFIED",
            "culvertCapacityEvidence":"MISSING",
            "bridgeDeckElevationEvidence":"MISSING",
            "sourceReview":"OSM_COMMUNITY_MAP_UNVERIFIED",
            "officialRoadClosure":"UNKNOWN",
            "floodRisk":"NOT_EVALUATED",
            "safeToDrive":None,
        })
    rows.sort(key=lambda x:(x["siteId"],x["osmElement"]))
    per_site=[]
    for site in sites.values():
        items=[r for r in rows if r["siteId"]==site["siteId"]]
        per_site.append({
            "siteId":site["siteId"],"latitude":site["latitude"],"longitude":site["longitude"],
            "geometryCandidateCount":len(items),
            "geometryReviewStatus":"GEOMETRY_CONTEXT_FOUND_NOT_VERIFIED" if items else "NO_OSM_GEOMETRY_IN_SUPPLIED_SNAPSHOT",
            "requiredIndependentChecks":[
                "Confirm physical structure and actual road/wadi crossing",
                "Obtain road authority bridge and culvert survey and capacities",
                "Verify bridge deck and ground elevation datum",
                "Review historical floods and official closure records",
            ],
            "fieldReviewCompleted":False,
            "operationalHazardAssessed":False,
            "safeToDrive":None,
        })
    return {
        "reportType":"RAINGUARD_HYDROLOGY9_OSM_GEOMETRY_REVIEW",
        "status":STATUS,
        "siteCount":len(per_site),
        "sourceCandidateMatchCount":len(rows),
        "verifiedPhysicalCrossingCount":0,
        "verifiedBridgeCulvertCount":0,
        "verifiedCulvertCapacityCount":0,
        "officialRoadClosureEvidenceCount":0,
        "hydrologicFloodRisk":"NOT_EVALUATED",
        "riskRanking":None,"safeToDrive":None,
        "alternativeRouteApproved":False,"operationalWarningApproved":False,
        "candidates":rows,"sites":per_site,
        "limitations":"Approximate map-line distance is not topological proof of physical crossing. Neither overlapping lines nor OSM tags establish road clearance, culvert capacity, inundation risk, closure or safe driving.",
    }


def to_csv(report):
    out=io.StringIO()
    keys=["siteId","osmElement","osmUrl","mappedFeatureType",
          "distanceToResearchRouteMeters","distanceToCandidateHydroRiverMeters",
          "geometryContext","physicalRoadWadiCrossing","culvertCapacityEvidence",
          "bridgeDeckElevationEvidence","sourceReview","floodRisk"]
    w=csv.writer(out,lineterminator="\n")
    w.writerow(keys)
    for c in report["candidates"]:
        w.writerow([c[k] for k in keys])
    return out.getvalue()


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--hydrology7",type=Path,required=True)
    ap.add_argument("--hydrology8",type=Path,required=True)
    ap.add_argument("--osm",type=Path,required=True)
    ap.add_argument("--route",type=Path,required=True)
    ap.add_argument("--tile",type=Path,default=Path("frontend/data/hydrology/tiles/N20_E038.geojson"))
    ap.add_argument("--prefix",type=Path,default=Path("jeddah_makkah_hydrology9"))
    args=ap.parse_args()
    if args.tile.name!="N20_E038.geojson":
        ap.error("UNSUPPORTED_HYDRORIVERS_TILE")
    paths=[Path(str(args.prefix)+suffix) for suffix in ("_geometry_review.json","_candidate_checks.csv")]
    if any(p.exists() for p in paths):
        ap.error("OUTPUT_EXISTS_USE_FRESH_PREFIX")
    try:
        report=build_report(
            read_json(args.hydrology7,INPUT_LIMIT),
            read_json(args.hydrology8,INPUT_LIMIT),
            read_json(args.osm,INPUT_LIMIT),
            load_json(args.route),load_json(args.tile))
    except (OSError,ValueError,TypeError,UnicodeError,json.JSONDecodeError) as exc:
        ap.error(str(exc))
    contents=[json.dumps(report,ensure_ascii=False,indent=2)+"\n",to_csv(report)]
    written=[]
    try:
        for p,body in zip(paths,contents):
            p.write_text(body,encoding="utf-8-sig" if p.suffix==".csv" else "utf-8")
            written.append(p)
    except OSError:
        for p in written:p.unlink(missing_ok=True)
        raise
    print(json.dumps({
        "status":report["status"],"siteCount":report["siteCount"],
        "sourceCandidateMatchCount":report["sourceCandidateMatchCount"],
        "verifiedBridgeCulvertCount":0,"safeToDrive":None,
        "outputs":[str(p) for p in paths],
    },ensure_ascii=False))


if __name__=="__main__":main()
