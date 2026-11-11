# Valhalla maneuver-time research extension — not certified road forecasting

## Fix for the real Jeddah–Makkah diagnostic (37.29% away from halfway)

The November 11 pilot returned **16 maneuvers and 14 timed interior boundaries**.
The maneuver sum (4113.87s) agreed with the trip summary (4113.9s), but the
closest timed maneuver boundary was 37.29 percentage points of the route
length away from geometric halfway. The old rule rejected all timing merely
because no maneuver lay within 25 percentage points of midpoint.

**New behavior:** select an *actual* timed maneuver boundary closest to
halfway even when distant, and record its actual distance fraction from
route start in `alongRouteFraction`. It is labelled **timed maneuver
checkpoint — not necessarily the route midpoint**. The route's geometric
halfway point still has **no known ETA**. We do not interpolate elapsed
time from the total or from nearby maneuver durations.

The diagnostic status can now report
`PROVIDER_ESTIMATED_ANCHORS` with reason
`OK_SPARSE_MANEUVER_CHECKPOINT_NOT_MIDPOINT`. Valid maneuver times
are still only **provider estimates**, not field-observed driving
durations. Other missing, invalid, discontinuous, or inconsistent
maneuver information continues to fail closed.

To test the patched exporter in a *separate* filename without
overwriting your previous evidence:

```powershell
cd C:\Users\Najeeb\RainGuard-AI-fixed
git pull origin main
py .\scripts\export_public_valhalla_route_geojson.py --output jeddah_makkah_sparse_checkpoint.geojson
```

Request the community demo only once, respect rate limits, and do not
use its results for operational truck routing.

## Diagnostic improvement for NOT_AVAILABLE

The exported GeoJSON now includes a sanitized `maneuverTimingDiagnostic`
object, and the export command prints the same structural verdict.
It reveals *why* a maneuver ETA was rejected, without logging raw
third-party response JSON, credentials or all road coordinates.

Possible reasons: `MISSING_MANEUVER_ARRAY`,
`MANEUVER_INDEX_OUT_OF_RANGE`, `NONCONTIGUOUS_MANEUVER_INDEX`,
`MANEUVER_TIMES_DISAGREE_WITH_TOTAL`,
`NO_INTERIOR_MANEUVER_BOUNDARY`,
`OK_SPARSE_MANEUVER_CHECKPOINT_NOT_MIDPOINT` for a sparse but valid
maneuver checkpoint, or `OK_PROVIDER_ESTIMATE_NOT_OBSERVED`.

Run **once** from Windows PowerShell, with a filename that does not exist:

```powershell
cd C:\Users\Najeeb\RainGuard-AI-fixed
git pull origin main
py .\scripts\export_public_valhalla_route_geojson.py --output jeddah_makkah_timing_diagnostic.geojson
$r = Get-Content .\jeddah_makkah_timing_diagnostic.geojson -Raw | ConvertFrom-Json
$r.features[0].properties.maneuverTimingDiagnostic | Format-List
```

Do not repeat the request if the community service denies it or rate-limits.
The existing GeoJSON with `NOT_AVAILABLE` cannot identify the original
failure because it did not preserve the raw maneuver data. It remains
suitable for spatial-only weather analysis. The original safety guard
continues to reject unverified intermediate ETAs.


Valhalla's [route API](https://valhalla.github.io/valhalla/api/route/api-reference/) defines `directions_type=maneuvers`, with each maneuver's estimated travel `time` (seconds), plus `begin_shape_index` and `end_shape_index`. This update uses these **provider-reported maneuver durations**, rather than dividing total journey time equally between road segments.

## One-off test on Windows

```powershell
cd C:\Users\Najeeb\RainGuard-AI-fixed
git pull origin main
py .\scripts\export_public_valhalla_route_geojson.py --output jeddah_makkah_route_timed.geojson
Start-Process .\frontend\truck-route-file-viewer.html
```

In the local page, select `jeddah_makkah_route_timed.geojson`, optionally select an *expected departure local time* using the date-time input, and click **طلب توقعات المطر لثلاث نقاط فقط**.

The exporter still makes **one fair-use community-demo request**. It requests maneuver times and uses *exact maneuver boundary positions* at start, the actual timed maneuver boundary closest to geometric halfway (which may be far away), and destination. The total maneuver seconds must reconcile with the provider's trip summary. Missing/invalid/noncontiguous/unbalanced maneuver data causes `maneuverTimingStatus: NOT_AVAILABLE`; it NEVER invents intermediate travel time.

If the timings are available and a valid future local departure time is specified, the UI calculates approximate provider-estimated arrival times at the three maneuver points. It selects a WeatherAPI forecast hour only if that hour's validity interval contains the estimated arrival. The forecast is **not proof of actual truck arrival**; weather issuance provenance, rain observation, route legal suitability, official road closures and hydrological flood hazards are not established.

The old `jeddah_makkah_route_demo.geojson` will keep displaying its road geometry but does not include the new maneuver timing. Re-export with a **different filename** (the exporter intentionally refuses to overwrite previous evidence).

The browser makes three coordinate-specific requests only after explicit click, using the existing RainGuard WeatherAPI proxy. It does not send departure time to the server or send navigation tokens to the browser, and it does not access the public Valhalla demo. The local page should be served from `http://127.0.0.1:3000` to meet existing API CORS allowlists:
```powershell
py -m http.server 3000 --bind 127.0.0.1
```

No route is **approved**, regardless of ETA/weather match: `safeToDrive: null`, `alternativeRouteApproved: false`, `operationalWarningApproved: false`. Provider maneuver ETA is a model estimate (no real live traffic, independently validated road geometry or measured timestamps).
