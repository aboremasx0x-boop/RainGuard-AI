"""ONE REQUEST to public FOSSGIS Valhalla demo (research only).

Never used by production backend. Public demo is fair-use / rate-limited,
not a free hosted nationwide routing backend. No credentials sent.
Reference: https://valhalla.github.io/valhalla/start/introduction/
"""
from __future__ import annotations
import argparse
import json
import math
from urllib.error import HTTPError, URLError
from urllib.request import HTTPRedirectHandler, Request, build_opener

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

ENDPOINT = "https://valhalla1.openstreetmap.de/route"
CLIENT_ID = "RainGuard-AI-research-test"
BODY = {
    "locations": [
        {"lat": 21.5433, "lon": 39.1728},
        {"lat": 21.3891, "lon": 39.8579},
    ],
    "costing": "truck",
    "costing_options": {"truck": {
        "weight": 18, "height": 4, "width": 2.5, "length": 14,
        "axle_load": 8, "axle_count": 5, "exclude_unpaved": True,
    }},
    "units": "kilometers", "directions_type": "none",
}


def inspect(data):
    base = {
        "success": False,
        "status": "UNVERIFIED_DEMO_ROUTING",
        "safeToDrive": None,
        "alternativeRouteApproved": False,
        "roadClosures": "NOT_VERIFIED",
        "floodHazard": "NOT_EVALUATED",
    }
    if not isinstance(data, dict):
        return {**base, "reason": "INVALID_RESPONSE"}
    trip = data.get("trip")
    if not isinstance(trip, dict):
        # The server error code is never converted to a successful route.
        return {**base, "reason": "DEMO_ROUTE_NOT_RETURNED"}
    summary = trip.get("summary")
    if not isinstance(summary, dict):
        return {**base, "reason": "MISSING_ROUTE_SUMMARY"}
    distance, seconds = summary.get("length"), summary.get("time")
    if any(type(value) not in (float, int) or not math.isfinite(value) or value <= 0
           for value in (distance, seconds)):
        return {**base, "reason": "INVALID_DISTANCE_OR_DURATION"}
    legs = trip.get("legs")
    if not isinstance(legs, list) or not 1 <= len(legs) <= 30:
        return {**base, "reason": "MISSING_ROUTE_LEGS"}
    return {
        **base, "success": True,
        "status": "PUBLIC_DEMO_ROUTE_COMPUTED_SAFETY_UNVERIFIED",
        "provider": "FOSSGIS Valhalla demo",
        "estimatedDistanceKm": round(distance, 2),
        "estimatedTravelMinutes": round(seconds / 60, 1),
        "providerLegCount": len(legs),
        "note": "OSM truck restriction coverage is unverified; no official road closures or flood warnings.",
    }


def run(opener=None):
    # One bounded POST only. Never redirect request data to other hosts.
    request = Request(
        ENDPOINT,
        data=json.dumps(BODY, separators=(",", ":")).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-Client-Id": CLIENT_ID,
            "User-Agent": "RainGuard-AI-research-test/1.0",
        },
        method="POST",
    )
    if opener is None:
        opener = build_opener(NoRedirect()).open
    try:
        with opener(request, timeout=15) as response:
            if response.status != 200:
                return {"success": False, "status": "DEMO_UNAVAILABLE", "httpStatus": response.status,
                        "safeToDrive": None, "alternativeRouteApproved": False}
            raw = response.read(1_000_001)
            if len(raw) > 1_000_000:
                return {"success": False, "status": "DEMO_RESPONSE_TOO_LARGE",
                        "safeToDrive": None, "alternativeRouteApproved": False}
            return inspect(json.loads(raw))
    except HTTPError as e:
        return {"success": False, "status": "DEMO_HTTP_ERROR",
                "httpStatus": e.code, "safeToDrive": None, "alternativeRouteApproved": False}
    except (URLError, TimeoutError, ValueError, TypeError, OSError):
        return {"success": False, "status": "DEMO_UNREACHABLE",
                "safeToDrive": None, "alternativeRouteApproved": False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Print safe request metadata only; no network call")
    args = parser.parse_args()
    if args.dry_run:
        result = {"mode": "DRY_RUN_NO_NETWORK", "endpoint": ENDPOINT,
                  "costing": BODY["costing"], "source": "Jeddah", "destination": "Makkah",
                  "publicDemoOnly": True, "safeToDrive": None}
    else:
        result = run()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if not args.dry_run and not result["success"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
