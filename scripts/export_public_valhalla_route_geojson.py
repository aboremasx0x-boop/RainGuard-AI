"""Export one public Valhalla demonstration truck route to OFFLINE GeoJSON.

No browser routing, keys, tracking, repeat polling, or public road-safety claims.
Only fixed public city-center sample points. Run manually and observe fair use.
"""
from __future__ import annotations
import argparse
import json
import math
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, build_opener

from test_public_valhalla_demo import ENDPOINT, CLIENT_ID, BODY, NoRedirect

MAX_RESPONSE_BYTES = 1_000_000
MAX_POINTS = 60_000

def decode_polyline6(encoded):
    """Decode Google's encoded polyline at 1e-6 precision; reject malformed shapes."""
    if not isinstance(encoded, str) or not 2 <= len(encoded) <= 500_000:
        raise ValueError("INVALID_SHAPE")
    coords = []
    lat = lon = idx = 0
    while idx < len(encoded):
        nums = []
        for _ in range(2):
            shift = value = 0
            while True:
                if idx >= len(encoded) or shift > 35:
                    raise ValueError("MALFORMED_POLYLINE6")
                b = ord(encoded[idx]) - 63
                idx += 1
                if not 0 <= b <= 63:
                    raise ValueError("MALFORMED_POLYLINE6")
                value |= (b & 31) << shift
                shift += 5
                if b < 32:
                    break
            nums.append((value >> 1) ^ (-(value & 1)))
        lat += nums[0]
        lon += nums[1]
        y, x = lat / 1e6, lon / 1e6
        if not math.isfinite(y) or not math.isfinite(x) or not (16 <= y <= 33 and 34 <= x <= 56):
            raise ValueError("OUTSIDE_SAUDI_TEST_BOUNDS")
        coords.append([round(x, 6), round(y, 6)])
        if len(coords) > MAX_POINTS:
            raise ValueError("TOO_MANY_POINTS")
    if len(coords) < 2:
        raise ValueError("INSUFFICIENT_GEOMETRY_POINTS")
    return coords


def validate_geojson(data):
    if not isinstance(data, dict) or data.get("type") != "FeatureCollection":
        raise ValueError("INVALID_COLLECTION")
    if data.get("safeToDrive", "invalid") is not None or data.get("alternativeRouteApproved") is not False:
        raise ValueError("UNSAFE_APPROVAL_FIELDS")
    features = data.get("features")
    if not isinstance(features, list) or len(features) != 1:
        raise ValueError("INVALID_FEATURES")
    feature = features[0]
    if feature.get("geometry", {}).get("type") != "LineString":
        raise ValueError("NOT_A_ROUTE_LINE")
    coords = feature["geometry"].get("coordinates")
    if not isinstance(coords, list) or not 2 <= len(coords) <= MAX_POINTS:
        raise ValueError("INVALID_COORDINATES")
    for point in coords:
        if not isinstance(point, list) or len(point) != 2:
            raise ValueError("INVALID_COORDINATES")
        lon, lat = point
        if any(type(x) not in (int,float) or not math.isfinite(x) for x in point):
            raise ValueError("INVALID_COORDINATES")
        if not (16 <= lat <= 33 and 34 <= lon <= 56):
            raise ValueError("OUTSIDE_SAUDI_TEST_BOUNDS")
    return True


def extract_geojson(payload):
    if not isinstance(payload, dict):
        raise ValueError("INVALID_RESPONSE")
    trip = payload.get("trip")
    if not isinstance(trip, dict):
        raise ValueError("NO_ROUTE")
    summary, legs = trip.get("summary"), trip.get("legs")
    if not isinstance(summary, dict) or not isinstance(legs, list) or not 1 <= len(legs) <= 30:
        raise ValueError("INCOMPLETE_ROUTE")
    length, seconds = summary.get("length"), summary.get("time")
    if any(type(x) not in (int,float) or not math.isfinite(x) or x <= 0 for x in (length,seconds)):
        raise ValueError("INVALID_ROUTE_TOTALS")
    all_points = []
    for leg in legs:
        if not isinstance(leg, dict):
            raise ValueError("INVALID_LEG")
        points = decode_polyline6(leg.get("shape"))
        if all_points and all_points[-1] == points[0]:
            points = points[1:]
        all_points.extend(points)
        if len(all_points) > MAX_POINTS:
            raise ValueError("TOO_MANY_POINTS")
    result = {
        "type":"FeatureCollection", "reportType":"RESEARCH_ONLY_PUBLIC_DEMO_GEOMETRY",
        "provider":"FOSSGIS Valhalla community demo",
        "safeToDrive":None, "alternativeRouteApproved":False,
        "operationalWarningApproved":False,
        "roadClosures":"NOT_VERIFIED", "hydrology":"NOT_VERIFIED",
        "notes":"Road geometry is from a community demo; legal truck restrictions, floods, closures and road opening are NOT verified.",
        "features":[{"type":"Feature", "properties":{
            "route":"Jeddah–Makkah (approximate centers; demonstration)",
            "distanceKm":round(length,2), "estimatedTravelMinutes":round(seconds/60,1),
            "vehicleWeightTons":18,"vehicleHeightMeters":4,
            "safety":"UNKNOWN"},
            "geometry":{"type":"LineString","coordinates":all_points}}]
    }
    validate_geojson(result)
    return result


def request_once(opener=None):
    if opener is None:
        opener = build_opener(NoRedirect()).open
    request = Request(
        ENDPOINT, data=json.dumps(BODY,separators=(",",":")).encode("utf-8"),
        headers={"Content-Type":"application/json","Accept":"application/json",
                 "X-Client-Id":CLIENT_ID,"User-Agent":"RainGuard-AI-research-test/1.0"},
        method="POST",
    )
    with opener(request, timeout=15) as response:
        if response.status != 200:
            raise ValueError("PUBLIC_DEMO_NOT_AVAILABLE")
        raw = response.read(MAX_RESPONSE_BYTES+1)
        if len(raw) > MAX_RESPONSE_BYTES:
            raise ValueError("RESPONSE_TOO_LARGE")
        return extract_geojson(json.loads(raw))


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output",type=Path,default=Path("jeddah_makkah_route_demo.geojson"))
    parser.add_argument("--dry-run",action="store_true")
    args=parser.parse_args()
    if args.dry_run:
        print(json.dumps({"mode":"NO_NETWORK","endpoint":ENDPOINT,
            "output":str(args.output),"publicDemoOnly":True,"safeToDrive":None},ensure_ascii=False))
        return
    try:
        route=request_once()
    except (HTTPError,URLError,TimeoutError,ValueError,TypeError,OSError) as exc:
        # No underlying HTTP error body, headers, or token is printed.
        print(json.dumps({"success":False,"reason":"DEMO_UNAVAILABLE_OR_INVALID_GEOMETRY",
                          "safeToDrive":None,"alternativeRouteApproved":False},ensure_ascii=False))
        raise SystemExit(1) from None
    if args.output.exists():
        parser.error("Output file exists; choose a new filename to preserve old evidence")
    args.output.write_text(json.dumps(route,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"success":True,"output":str(args.output),
        "distanceKm":route["features"][0]["properties"]["distanceKm"],
        "estimatedTravelMinutes":route["features"][0]["properties"]["estimatedTravelMinutes"],
        "points":len(route["features"][0]["geometry"]["coordinates"]),
        "safeToDrive":None},ensure_ascii=False))


if __name__=="__main__":
    main()
