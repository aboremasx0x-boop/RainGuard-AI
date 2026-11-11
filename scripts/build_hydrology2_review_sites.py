"""Hydrology-2: local review coordinates, clustering and CSV/GeoJSON exports.

Reports approximate nearest map-line positions ONLY: not confirmed
bridges, culverts, crossings, measured flood risks or safe truck routes.
Zero network requests and no paid APIs.
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import math
from pathlib import Path

from scan_route_hydrorivers_local import (
    DEFAULT_THRESHOLD_METERS, EXPECTED_TILE, load_json, meters_xy,
    river_features, route_points,
)

GROUP_WITHIN_METERS = 100.0


def dot(a, b):
    return a[0] * b[0] + a[1] * b[1]


def subtract(a, b):
    return a[0] - b[0], a[1] - b[1]


def closest_pair(a, b, c, d):
    """Exact closest coordinates on two planar finite segments, including intersections."""
    u, v, w = subtract(b, a), subtract(d, c), subtract(c, a)
    cross = lambda p, q: p[0] * q[1] - p[1] * q[0]
    denom = cross(u, v)
    if abs(denom) > 1e-12:
        t = cross(w, v) / denom
        s = cross(w, u) / denom
        if 0 <= t <= 1 and 0 <= s <= 1:
            return 0.0, t, s

    def project(point, start, end):
        direction = subtract(end, start)
        denom = dot(direction, direction)
        t = max(0.0, min(1.0, dot(subtract(point, start), direction) / denom)) if denom > 0 else 0.0
        closest = (start[0] + t * direction[0], start[1] + t * direction[1])
        diff = subtract(point, closest)
        return dot(diff, diff), t

    candidates = [
        (*project(a, c, d), 0.0, "road"),  # road A vs river
        (*project(b, c, d), 1.0, "road"),  # road B vs river
        (*project(c, a, b), 0.0, "river"), # river C vs road
        (*project(d, a, b), 1.0, "river"), # river D vs road
    ]
    distances = []
    for dist, segment_fraction, endpoint_fraction, kind in candidates:
        if kind == "road":
            distances.append((dist, endpoint_fraction, segment_fraction))
        else:
            distances.append((dist, segment_fraction, endpoint_fraction))
    return min(distances)


def project_onto_route(route, rivers, threshold=DEFAULT_THRESHOLD_METERS):
    """One closest road-side witness for each HydroRIVERS feature."""
    if type(threshold) not in (int, float) or not math.isfinite(threshold) or not 0 < threshold <= 500:
        raise ValueError("INVALID_THRESHOLD")
    if not isinstance(route, list) or len(route) < 2:
        raise ValueError("INVALID_ROUTE")
    reference_lat = sum(point[1] for point in route) / len(route)
    road_xy = [meters_xy(point, reference_lat) for point in route]
    bounds = [
        (min(a[0], b[0]), min(a[1], b[1]), max(a[0], b[0]), max(a[1], b[1]))
        for a, b in zip(road_xy, road_xy[1:])
    ]
    found = []
    seen_ids = set()
    for river_id, water_points in rivers:
        if river_id in seen_ids:
            raise ValueError("DUPLICATE_RIVER_IDENTIFIER")
        seen_ids.add(river_id)
        water_xy = [meters_xy(p, reference_lat) for p in water_points]
        best = (threshold * threshold, None)
        for c, d in zip(water_xy, water_xy[1:]):
            xmin, ymin, xmax, ymax = (
                min(c[0], d[0]) - threshold, min(c[1], d[1]) - threshold,
                max(c[0], d[0]) + threshold, max(c[1], d[1]) + threshold,
            )
            for road_idx, ((a, b), bb) in enumerate(zip(zip(road_xy, road_xy[1:]), bounds)):
                if bb[2] < xmin or bb[0] > xmax or bb[3] < ymin or bb[1] > ymax:
                    continue
                ds, fraction, _ = closest_pair(a, b, c, d)
                if ds <= best[0] and (best[1] is None or ds < best[0]):
                    lon = route[road_idx][0] + fraction * (route[road_idx + 1][0] - route[road_idx][0])
                    lat = route[road_idx][1] + fraction * (route[road_idx + 1][1] - route[road_idx][1])
                    best = (ds, {
                        "riverId": river_id,
                        "routeSegmentIndex": road_idx,
                        "routeSegmentFraction": round(fraction, 8),
                        "roadLongitude": round(lon, 7),
                        "roadLatitude": round(lat, 7),
                        "approximateProximityMeters": round(math.sqrt(max(0.0, ds)), 1),
                    })
        if best[1] is not None:
            found.append(best[1])
    return sorted(found, key=lambda x:(x["routeSegmentIndex"], x["routeSegmentFraction"], x["riverId"]))


def cluster_sites(witnesses, route, group_meters=GROUP_WITHIN_METERS):
    """Merge proximate ROAD-SIDE positions while preserving river identifiers."""
    if type(group_meters) not in (int,float) or not 0 < group_meters <= 250:
        raise ValueError("INVALID_GROUP_DISTANCE")
    reference_lat = sum(p[1] for p in route) / len(route)
    groups = []
    for witness in witnesses:
        xy = meters_xy((witness["roadLongitude"], witness["roadLatitude"]), reference_lat)
        group = next((g for g in groups if
                      math.dist(xy, g["members"][0]["xy"]) <= group_meters), None)
        member = {"record": witness, "xy": xy}
        if group is None:
            groups.append({"members":[member]})
        else:
            group["members"].append(member)
    sites = []
    for i, group in enumerate(groups, 1):
        members = sorted((m["record"] for m in group["members"]),
                         key=lambda x:(x["approximateProximityMeters"],x["riverId"]))
        representative = members[0]
        sites.append({
            "siteId": f"RG-HYDRO-REVIEW-{i:03d}",
            "longitude": representative["roadLongitude"],
            "latitude": representative["roadLatitude"],
            "routeSegmentIndex": representative["routeSegmentIndex"],
            "routeSegmentFraction": representative["routeSegmentFraction"],
            "nearestRiverDistanceMeters": representative["approximateProximityMeters"],
            "riverIds": sorted({m["riverId"] for m in members}),
            "riverFeatureCount": len(members),
            "verification":"NOT_FIELD_VERIFIED",
            "crossingStatus":"NOT_CONFIRMED",
            "culvertStatus":"UNKNOWN",
            "bridgeStatus":"UNKNOWN",
            "floodRisk":"NOT_EVALUATED",
            "roadClosure":"UNKNOWN",
        })
    return sites


def make_report(route, rivers, threshold=DEFAULT_THRESHOLD_METERS):
    witnesses = project_onto_route(route, rivers, threshold)
    sites = cluster_sites(witnesses, route)
    return {
        "reportType":"RAINGUARD_HYDROLOGY2_REVIEW_SITES_ONLY",
        "status":"RESEARCH_REVIEW_LOCATIONS_NOT_VERIFIED",
        "sourceDataset":"HydroRIVERS v1.0, checked-in N20_E038 tile",
        "tile":EXPECTED_TILE,
        "thresholdMeters":threshold,
        "clusterRadiusMeters":GROUP_WITHIN_METERS,
        "routePointCount":len(route),
        "routeStart":[round(c, 6) for c in route[0]],
        "routeEnd":[round(c, 6) for c in route[-1]],
        "sourceRiverFeatureCount":len(rivers),
        "candidateRiverFeatures":len(witnesses),
        "reviewSiteCount":len(sites),
        "sites":sites,
        "witnesses":witnesses,
        "coverage":"ONE_RESEARCH_TILE_ONLY_NOT_COMPLETE",
        "safeToDrive":None,
        "alternativeRouteApproved":False,
        "operationalWarningApproved":False,
        "officialRoadCrossingConfirmed":False,
        "hydrologicFloodRisk":"NOT_EVALUATED",
        "note":"Road-line / river-line coincidence is not evidence of a physical road crossing or flood hazard. Road elevation, culvert inventory, accuracy and closures are unverified.",
    }


def to_geojson(report):
    features = [{
        "type":"Feature",
        "properties":{k:v for k,v in site.items() if k not in ("longitude","latitude")},
        "geometry":{"type":"Point","coordinates":[site["longitude"],site["latitude"]]},
    } for site in report["sites"]]
    return {k:v for k,v in report.items() if k not in ("sites","witnesses")} | {
        "type":"FeatureCollection","features":features,
    }


def to_csv(report):
    output = io.StringIO()
    writer = csv.writer(output, lineterminator="\n")
    writer.writerow(["siteId","longitude","latitude","routeSegmentIndex",
                     "routeSegmentFraction","nearestRiverDistanceMeters",
                     "riverIds","riverFeatureCount","verification",
                     "crossingStatus","culvertStatus","bridgeStatus","floodRisk"])
    for site in report["sites"]:
        writer.writerow([site["siteId"],site["longitude"],site["latitude"],
            site["routeSegmentIndex"],site["routeSegmentFraction"],
            site["nearestRiverDistanceMeters"],
            ";".join(str(r) for r in site["riverIds"]),site["riverFeatureCount"],
            site["verification"],site["crossingStatus"],site["culvertStatus"],
            site["bridgeStatus"],site["floodRisk"]])
    return output.getvalue()


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--route",type=Path,required=True)
    parser.add_argument("--tile",type=Path,default=Path("frontend/data/hydrology/tiles")/EXPECTED_TILE)
    parser.add_argument("--prefix",type=Path,default=Path("jeddah_makkah_hydro_review"))
    args=parser.parse_args()
    if args.tile.name != EXPECTED_TILE:
        parser.error("Only checked-in Jeddah-Makkah HydroRIVERS research tile supported")
    outputs=[Path(str(args.prefix)+ext) for ext in (".json",".csv",".geojson")]
    if any(p.exists() for p in outputs):
        parser.error("At least one output exists; choose a new --prefix to preserve evidence")
    try:
        route = route_points(load_json(args.route))
        rivers = river_features(load_json(args.tile))
        report = make_report(route, rivers)
    except (ValueError, TypeError, OverflowError, OSError, UnicodeError, json.JSONDecodeError) as exc:
        parser.error(str(exc))
    contents=[
        json.dumps(report,ensure_ascii=False,indent=2)+"\n",
        to_csv(report),
        json.dumps(to_geojson(report),ensure_ascii=False,indent=2)+"\n",
    ]
    # Prevent partial reports on ordinary write failures.
    written=[]
    try:
        for path, content in zip(outputs, contents):
            path.write_text(content,encoding="utf-8")
            written.append(path)
    except OSError:
        for path in written:
            path.unlink(missing_ok=True)
        raise
    print(json.dumps({"status":report["status"],"candidateRiverFeatures":report["candidateRiverFeatures"],
      "reviewSiteCount":report["reviewSiteCount"],"files":[str(p) for p in outputs],
      "safeToDrive":None},ensure_ascii=False))


if __name__=="__main__":
    main()
