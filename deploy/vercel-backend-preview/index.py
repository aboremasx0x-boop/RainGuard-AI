"""Vercel read-only API preview: explicit allowlist, not the full legacy router.

Build with: python scripts/build_vercel_backend_preview.py
The builder copies this entrypoint into an isolated bundle alongside legacy_rainguard.py.
"""
import os

# MUST be set before importing the legacy module to avoid local SQLite
# initialization and prediction-history writes. Enforced in main.py as well.
os.environ["RAINGUARD_VERCEL_READONLY"] = "1"

from fastapi import FastAPI, Query
import legacy_rainguard as legacy

app = FastAPI(
    title="RainGuard AI Read-only Preview",
    version="0.1.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

@app.get("/health")
@app.get("/api/health")
def health():
    # Liveness only: does NOT attest to provider health or operational accuracy.
    return {
        "status": "ok",
        "service": "RainGuard AI read-only preview",
        "mode": "PREVIEW_NOT_OPERATIONAL",
        "storage": "NO_LOCAL_PERSISTENCE",
        "forecastValidated": False,
        "officialWarningsConnected": False,
        "operationalWarningsApproved": False,
        "safeToDrive": None,
    }

@app.get("/api/truck-routes/capabilities")
def capabilities():
    # Feature flags only; no protected route calculation endpoints are exposed.
    result = legacy.truck_route_capabilities()
    result["truckRouting"]["hereServerConfigured"] = False
    result["truckRouting"]["valhallaServerConfigured"] = False
    result["truckRouting"]["publicRouteCalculationAvailable"] = False
    result["officialRoadClosuresConnected"] = False
    result["officialNCMWarningsConnected"] = False
    result["hydrologyValidatedForRouting"] = False
    result["alternativeRouteApproved"] = False
    result["operationalWarningApproved"] = False
    result["safeToDrive"] = None
    return result

@app.get("/rain-alert")
async def rain_alert(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    name: str = Query("Unknown Location", max_length=80),
    hours: int = Query(12, ge=1, le=72),
):
    # Calls the real current RainGuard rain-alert engine, but prevents any
    # persistence via RAINGUARD_VERCEL_READONLY and exposes no other endpoints.
    result = await legacy.rain_alert(lat=lat, lon=lon, name=name, hours=hours)
    # Legacy returns JSONResponse. Add a disclosure via response headers only;
    # don't modify the legacy JSON response and break clients.
    result.headers["X-RainGuard-Mode"] = "research-preview-no-operational-use"
    result.headers["Cache-Control"] = "no-store"
    return result
