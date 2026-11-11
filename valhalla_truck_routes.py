"""Open-source Valhalla truck-routing backend (OFF by default).
Only trusted backend requests; no public free routing proxy, no false flood safety.
Run your own Valhalla instance populated with licensed OSM Saudi tiles.
"""
from __future__ import annotations
import hmac
import ipaddress
import math
import os
from urllib.parse import urlparse
from typing import Optional

import httpx
from fastapi import APIRouter, Header
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/truck-routes", tags=["Open-source truck routing"])
MAX_BODY_BYTES = 3_000_000


class Location(BaseModel):
    lat: float = Field(ge=16, le=33)
    lon: float = Field(ge=34, le=56)


class Vehicle(BaseModel):
    gross_weight_tons: float = Field(ge=1, le=120)
    height_meters: float = Field(ge=1, le=7)
    width_meters: float = Field(ge=1, le=5)
    length_meters: float = Field(ge=2, le=40)
    axle_load_tons: float = Field(ge=1, le=30)
    axle_count: int = Field(ge=2, le=12)
    hazmat: bool = False


class RouteRequest(BaseModel):
    origin: Location
    destination: Location
    vehicle: Vehicle


def backend_url() -> Optional[str]:
    """Avoid SSRF: do not accept any caller-supplied URL; localhost/private self-host only."""
    value = os.getenv("VALHALLA_TRUCK_BACKEND_URL", "").strip()
    if not value:
        return None
    url = urlparse(value)
    if url.scheme not in ("http", "https") or not url.hostname or url.username or url.password:
        return None
    if url.path not in ("", "/") or url.query or url.fragment:
        return None
    try:
        ip = ipaddress.ip_address(url.hostname)
    except ValueError:
        # Static internal DNS (not a user-supplied host) permitted for
        # private service discovery; public DNS hostnames are not permitted.
        if not url.hostname.endswith(".internal"):
            return None
    else:
        if not (ip.is_private or ip.is_loopback) or ip.is_link_local or ip.is_multicast or ip.is_unspecified:
            return None
    return value.rstrip("/") + "/route"


def build_payload(request: RouteRequest) -> dict:
    v = request.vehicle
    return {
        "locations": [
            {"lat": request.origin.lat, "lon": request.origin.lon},
            {"lat": request.destination.lat, "lon": request.destination.lon},
        ],
        "costing": "truck",
        "costing_options": {
            "truck": {
                "weight": v.gross_weight_tons,
                "height": v.height_meters,
                "width": v.width_meters,
                "length": v.length_meters,
                "axle_load": v.axle_load_tons,
                "axle_count": v.axle_count,
                "hazmat": v.hazmat,
                "hgv_no_access_penalty": 43200,
                "exclude_unpaved": True,
            }
        },
        "units": "kilometers",
        "directions_type": "none",
        "shape_format": "polyline6"
    }


def normalize_result(payload: object) -> dict:
    if not isinstance(payload, dict):
        raise ValueError("INVALID_PROVIDER_PAYLOAD")
    trip = payload.get("trip")
    if not isinstance(trip, dict):
        raise ValueError("MISSING_TRIP")
    summary = trip.get("summary") or {}
    legs = trip.get("legs") or []
    if not isinstance(legs, list) or not 1 <= len(legs) <= 30:
        raise ValueError("MISSING_LEGS")
    length = summary.get("length")
    seconds = summary.get("time")
    if isinstance(length, bool) or not isinstance(length, (int, float)) or not math.isfinite(length) or length < 0:
        raise ValueError("INVALID_DISTANCE")
    if isinstance(seconds, bool) or not isinstance(seconds, (int, float)) or not math.isfinite(seconds) or seconds < 0:
        raise ValueError("INVALID_ETA")
    sections = []
    for leg in legs:
        if not isinstance(leg, dict) or not isinstance(leg.get("shape"), str) or not 0 < len(leg["shape"]) < 150000:
            raise ValueError("INVALID_ROUTE_SHAPE")
        sections.append({"encodedPolyline6": leg["shape"], "geometryStatus": "PROVIDER_ESTIMATE"})
    return {
        "provider": "Self-hosted Valhalla / OpenStreetMap",
        "costing": "truck",
        "distanceKm": round(length, 2),
        "estimatedTravelMinutes": round(seconds / 60, 1),
        "sections": sections,
        "routeStatus": "ROUTE_COMPUTED_SAFETY_UNVERIFIED",
        "restrictionsCoverage": "UNKNOWN_OSM_COMPLETENESS",
        "roadClosures": "NOT_VERIFIED",
        "floodHazard": "NOT_EVALUATED",
        "safeToDrive": None,
        "alternativeRouteApproved": False,
        "warning": "مسار تقريبي من بيانات OpenStreetMap؛ قيود الشاحنات قد تكون ناقصة ولا توجد موافقة على القيادة أو تأكيد لسلامة الطريق.",
    }


@router.post("/valhalla")
async def route_truck(
    request: RouteRequest,
    x_rainguard_route_token: Optional[str] = Header(default=None)
):
    endpoint = backend_url()
    token = os.getenv("RAINGUARD_ROUTE_ACCESS_TOKEN", "")
    enabled = os.getenv("VALHALLA_TRUCK_ROUTING_ENABLED", "false").lower() == "true"
    if not enabled or not endpoint or not token:
        return JSONResponse(status_code=503, content={"success": False, "error": "VALHALLA_NOT_CONFIGURED"})
    if not x_rainguard_route_token or not hmac.compare_digest(x_rainguard_route_token, token):
        return JSONResponse(status_code=403, content={"success": False, "error": "ACCESS_DENIED"})
    try:
        async with httpx.AsyncClient(timeout=25, follow_redirects=False, trust_env=False) as client:
            response = await client.post(endpoint, json=build_payload(request))
        if response.status_code != 200 or len(response.content) > MAX_BODY_BYTES:
            raise ValueError("ROUTING_UPSTREAM_FAILURE")
        result = normalize_result(response.json())
        return {"success": True, **result}
    except (httpx.HTTPError, ValueError, KeyError, TypeError, OverflowError):
        return JSONResponse(status_code=502, content={"success": False, "error": "ROUTE_PROVIDER_UNAVAILABLE"})
