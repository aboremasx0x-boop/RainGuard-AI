"""Opt-in authenticated HERE truck routing adapter for RainGuard AI.

Research/prototype backend integration. It provides transport route geometry and
ETA, NOT verified real-time road open/closed states or flood safety clearance.
Never turn this endpoint on publicly without independent auth/rate controls.
"""
from __future__ import annotations

import hmac
import math
import os
from datetime import datetime, timezone
from typing import Optional

import httpx
from truck_route_timeline import route_timeline
from fastapi import APIRouter, Header
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator

router = APIRouter(prefix="/api/truck-routes", tags=["Truck routing - protected prototype"])
HERE_ENDPOINT = "https://router.hereapi.com/v8/routes"


class Location(BaseModel):
    lat: float = Field(ge=16, le=33)
    lon: float = Field(ge=34, le=56)


class Vehicle(BaseModel):
    # Must specify heavy-goods-vehicle properties; no default imaginary size.
    gross_weight_tons: float = Field(ge=1, le=120)
    height_meters: float = Field(ge=1, le=7)
    width_meters: float = Field(ge=1, le=5)
    length_meters: float = Field(ge=2, le=40)


class RouteRequest(BaseModel):
    origin: Location
    destination: Location
    departure_time_utc: datetime
    vehicle: Vehicle

    @field_validator("departure_time_utc")
    @classmethod
    def timezone_required(cls, value):
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("departure_time_utc must include UTC offset")
        return value.astimezone(timezone.utc)


def route_parameters(request: RouteRequest, key: str) -> dict:
    def centimeters(value: float) -> int:
        return round(value * 100)
    return {
        "apiKey": key,
        "transportMode": "truck",
        "routingMode": "fast",
        "origin": f"{request.origin.lat:.6f},{request.origin.lon:.6f}",
        "destination": f"{request.destination.lat:.6f},{request.destination.lon:.6f}",
        "departureTime": request.departure_time_utc.isoformat().replace("+00:00", "Z"),
        "return": "polyline,summary",
        "spans": "notices",
        "vehicle[grossWeight]": round(request.vehicle.gross_weight_tons * 1000),
        "vehicle[height]": centimeters(request.vehicle.height_meters),
        "vehicle[width]": centimeters(request.vehicle.width_meters),
        "vehicle[length]": centimeters(request.vehicle.length_meters),
    }


def parse_route_payload(payload: object, departure_time_utc: Optional[datetime] = None):
    """Whitelisted output; no upstream URL, API key, tracking data, or PII."""
    if not isinstance(payload, dict) or not isinstance(payload.get("routes"), list):
        raise ValueError("INVALID_ROUTE_RESPONSE")
    if not payload["routes"]:
        raise ValueError("NO_ROUTE_AVAILABLE")
    candidate = payload["routes"][0]
    sections = candidate.get("sections", [])
    if not isinstance(sections, list) or not sections or len(sections) > 30:
        raise ValueError("ROUTE_SECTIONS_MISSING")
    distance = duration = 0
    sanitized = []
    critical = False
    for section in sections:
        if not isinstance(section, dict):
            raise ValueError("INVALID_ROUTE_SECTION")
        summary = section.get("summary", {})
        meters = summary.get("length")
        seconds = summary.get("duration")
        if not isinstance(meters, (int, float)) or not math.isfinite(meters) or meters < 0:
            raise ValueError("INVALID_ROUTE_DISTANCE")
        if not isinstance(seconds, (int, float)) or not math.isfinite(seconds) or seconds < 0:
            raise ValueError("INVALID_ROUTE_DURATION")
        polyline = section.get("polyline")
        if not isinstance(polyline, str) or not polyline or len(polyline) > 150000:
            raise ValueError("MISSING_ROUTE_GEOMETRY")
        notices = section.get("notices", [])
        if not isinstance(notices, list):
            raise ValueError("INVALID_ROUTE_NOTICES")
        if any(isinstance(n, dict) and n.get("severity") == "critical" for n in notices):
            critical = True
        distance += meters
        duration += seconds
        sanitized.append({
            "encodedPolyline": polyline,
            "distanceKm": round(meters / 1000, 2),
            "durationMinutes": round(seconds / 60, 1),
            "hasCriticalRestrictions": any(isinstance(n, dict) and n.get("severity") == "critical" for n in notices),
        })
    return {
        "provider": "HERE Routing v8",
        "transportMode": "truck",
        "routeGeometryStatus": "PROVIDER_RETURNED",
        "distanceKm": round(distance / 1000, 2),
        "estimatedTravelMinutes": round(duration / 60, 1),
        "sections": sanitized,
        "timeline": route_timeline(sanitized, departure_time_utc, duration / 60, distance / 1000),
        "criticalVehicleRestrictions": critical,
        "roadClosureVerification": "NOT_VERIFIED_INDEPENDENTLY",
        "hydrologyVerification": "NOT_VERIFIED",
        "safeToDrive": None,
        "alternativeRouteApproved": False,
        "routingStatus": "PROVIDER_RESTRICTION_REVIEW_REQUIRED" if critical else "ROUTING_AVAILABLE_SAFETY_UNVERIFIED",
        "warning": "مسار شاحنات محسوب من مزود خارجي؛ لا يؤكد فتح الطريق أو سلامته من السيول أو صلاحية جميع قيود الشاحنة.",
    }


async def fetch_route(request: RouteRequest, api_key: str):
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get(HERE_ENDPOINT, params=route_parameters(request, api_key))
        if response.status_code != 200:
            raise ValueError("HERE_ROUTING_UPSTREAM_ERROR")
        return parse_route_payload(response.json(), request.departure_time_utc)


@router.post("/here")
async def calculate_truck_route(
    request: RouteRequest,
    x_rainguard_route_token: Optional[str] = Header(default=None),
):
    api_key = os.getenv("HERE_ROUTING_API_KEY", "")
    access_token = os.getenv("RAINGUARD_ROUTE_ACCESS_TOKEN", "")
    enabled = os.getenv("HERE_TRUCK_ROUTING_ENABLED", "").strip().lower() == "true"
    if not enabled or not api_key or not access_token:
        return JSONResponse(status_code=503, content={"success": False, "error": "TRUCK_ROUTING_NOT_CONFIGURED"})
    # Host must supply protected server-side credentials. Do not embed this token
    # in a Vercel HTML bundle. Never log user tokens or upstream URLs.
    if not x_rainguard_route_token or not hmac.compare_digest(x_rainguard_route_token, access_token):
        return JSONResponse(status_code=403, content={"success": False, "error": "ACCESS_DENIED"})
    try:
        route = await fetch_route(request, api_key)
        return {"success": True, **route}
    except (ValueError, httpx.HTTPError, TypeError, KeyError):
        return JSONResponse(status_code=502, content={"success": False, "error": "ROUTE_PROVIDER_UNAVAILABLE"})
