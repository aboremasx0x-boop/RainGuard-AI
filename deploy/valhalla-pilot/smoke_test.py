"""Local-only Valhalla truck routing smoke test. NEVER certifies road safety."""
import argparse
import json
import urllib.error
import urllib.request

DEFAULT_URL = "http://127.0.0.1:8002/route"
DEMO = {
    "locations": [{"lat": 21.5433, "lon": 39.1728}, {"lat": 21.3891, "lon": 39.8579}],
    "costing": "truck",
    "costing_options": {"truck": {"weight": 18, "height": 4, "width": 2.5,
                                  "length": 14, "axle_load": 8, "axle_count": 5,
                                  "exclude_unpaved": True}},
    "units": "kilometers",
    "directions_type": "none",
    "shape_format": "polyline6",
}


def inspect(payload):
    trip = payload.get("trip") if isinstance(payload, dict) else None
    if not isinstance(trip, dict):
        return {"success": False, "reason": "NO_ROUTE", "safeToDrive": None}
    s = trip.get("summary") or {}
    if not isinstance(s.get("length"), (int, float)) or not isinstance(s.get("time"), (int, float)):
        return {"success": False, "reason": "ROUTE_SUMMARY_MISSING", "safeToDrive": None}
    return {"success": True, "provider": "LOCAL_VALHALLA_TRUCK",
            "estimatedDistanceKm": s["length"],
            "estimatedTravelMinutes": round(s["time"] / 60, 1),
            "safety": "NOT_VERIFIED", "safeToDrive": None,
            "roadClosures": "NOT_VERIFIED", "hydrology": "NOT_VERIFIED",
            "warning": "هذا اختبار شبكة طرق محلية؛ لا يؤكد فتح الطريق أو سلامته من السيول."}


def run(url=DEFAULT_URL):
    # No remote/public service calls allowed by this script.
    if url != DEFAULT_URL:
        raise ValueError("LOCALHOST_ONLY")
    request = urllib.request.Request(
        url, data=json.dumps(DEMO).encode("utf-8"),
        headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return inspect(json.load(response))
    except (urllib.error.URLError, TimeoutError) as exc:
        return {"success": False, "reason": "LOCAL_VALHALLA_UNAVAILABLE", "safeToDrive": None}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default=DEFAULT_URL)
    args = parser.parse_args()
    print(json.dumps(run(args.url), ensure_ascii=False, indent=2))
