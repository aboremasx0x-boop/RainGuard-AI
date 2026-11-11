"""Local-only protected RainGuard API -> Valhalla truck routing integration smoke test.

Requires two processes on the SAME trusted computer:
(1) local Valhalla at 127.0.0.1:8002; (2) RainGuard FastAPI at 127.0.0.1:8000.
Never exposes auth tokens or route APIs publicly. No road safety verdict.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import urllib.error
import urllib.request

HOST = "http://127.0.0.1:8000"
PATH = "/api/truck-routes/valhalla"
DEMO = {
    "origin": {"lat": 21.5433, "lon": 39.1728},
    "destination": {"lat": 21.3891, "lon": 39.8579},
    "vehicle": {
        "gross_weight_tons": 18,
        "height_meters": 4,
        "width_meters": 2.5,
        "length_meters": 14,
        "axle_load_tons": 8,
        "axle_count": 5,
        "hazmat": False,
    },
    "departure_time_utc": "2026-11-11T09:00:00Z",
}


def inspect(response):
    """Whitelist output, prevent false-positive results and token leakage."""
    failure = {
        "success": False, "status": "NOT_VERIFIED",
        "safeToDrive": None, "alternativeRouteApproved": False,
    }
    if not isinstance(response, dict) or response.get("success") is not True:
        return {**failure, "reason": "PROTECTED_API_FAILED"}
    if response.get("routeStatus") != "ROUTE_COMPUTED_SAFETY_UNVERIFIED":
        return {**failure, "reason": "INVALID_ROUTE_STATUS"}
    if response.get("safeToDrive") is not None or response.get("alternativeRouteApproved") is not False:
        return {**failure, "reason": "UNSAFE_ROUTE_CLAIM"}
    if response.get("roadClosures") != "NOT_VERIFIED" or response.get("floodHazard") != "NOT_EVALUATED":
        return {**failure, "reason": "UNEXPECTED_SAFETY_DATA"}
    distance = response.get("distanceKm")
    minutes = response.get("estimatedTravelMinutes")
    if any(isinstance(value, bool) or not isinstance(value, (int, float)) or
           not math.isfinite(value) or value <= 0 for value in (distance, minutes)):
        return {**failure, "reason": "MISSING_REAL_ROUTE_SUMMARY"}
    sections = response.get("sections")
    if not isinstance(sections, list) or not 1 <= len(sections) <= 30:
        return {**failure, "reason": "INVALID_ROUTE_SECTIONS"}
    return {
        "success": True, "status": "LOCAL_PROVIDER_ROUTE_COMPUTED_NOT_SAFE_TO_DRIVE",
        "estimatedDistanceKm": distance,
        "estimatedTravelMinutes": minutes,
        "providerSectionCount": len(sections),
        "safeToDrive": None, "alternativeRouteApproved": False,
        "warning": "مسار من خادم محلي لا يثبت سلامة الطريق أو قيود الشاحنات أو عدم وجود سيول.",
    }


def request_route(token, opener=None):
    if not isinstance(token, str) or len(token.strip()) < 20:
        return {"success": False, "status": "NOT_VERIFIED",
                "reason": "MISSING_STRONG_SERVER_TOKEN", "safeToDrive": None,
                "alternativeRouteApproved": False}
    request = urllib.request.Request(
        HOST + PATH,
        data=json.dumps(DEMO).encode("utf-8"),
        headers={"Content-Type": "application/json",
                 "Accept": "application/json",
                 "X-RainGuard-Route-Token": token},
        method="POST",
    )
    if opener is None:
        opener = urllib.request.urlopen
    try:
        with opener(request, timeout=30) as response:
            if getattr(response, "status", 0) != 200:
                return inspect(None)
            # Limit untrusted route-provider payload size (3 MB).
            data = response.read(3_000_001)
            if len(data) > 3_000_000:
                return inspect(None)
            return inspect(json.loads(data))
    except (urllib.error.URLError, TimeoutError, ValueError, TypeError, OSError):
        return {"success": False, "status": "NOT_VERIFIED",
                "reason": "LOCAL_API_UNAVAILABLE_OR_NOT_AUTHENTICATED",
                "safeToDrive": None, "alternativeRouteApproved": False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true",
                        help="Offline prerequisites summary; does not request any route")
    args = parser.parse_args()
    if args.check:
        print(json.dumps({
            "mode": "CHECK_ONLY",
            "routeAPI": HOST + PATH,
            "tokenPresent": bool(os.environ.get("RAINGUARD_ROUTE_ACCESS_TOKEN")),
            "note": "Requires local FastAPI and self-hosted Valhalla; no requests performed.",
        }, ensure_ascii=False, indent=2))
        return
    result = request_route(os.environ.get("RAINGUARD_ROUTE_ACCESS_TOKEN", ""))
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if not result["success"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
