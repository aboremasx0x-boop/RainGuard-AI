# RainGuard Stage 3 — temporal and spatial rainfall exposure gate

## Implemented
An **offline Python evaluation primitive** `truck_segment_weather_exposure.py` joins the verified **ETA occupancy interval** of a single truck road segment to independently retrieved **hourly** weather provider records. It requires an explicitly validated `verifiedMidpoint` for each route section and `routeGeometryVerified=true`.

The stage 2 HERE and Valhalla adapters presently return encoded lines and ETA summaries but do **not** claim the verified representative segment coordinates needed by stage 3. Thus **their output alone is not sufficient**: the stage 3 algorithm explicitly returns `INSUFFICIENT_ROUTE_EVIDENCE`. No public UI promises live hazardous road segments or approved alternatives.

## Hourly contract (example fields, not live measurements)

```json
{
 "provider":"weatherapi",
 "issuedAtUtc":"2026-11-11T07:00:00Z",
 "fetchedAtUtc":"2026-11-11T07:30:00Z",
 "validFromUtc":"2026-11-11T09:00:00Z",
 "validToUtc":"2026-11-11T10:00:00Z",
 "lat":21.5,"lon":39.2,
 "rainProbabilityPct":80,
 "rainMmPerHour":2.0
}
```

Use 1-hour **original provider records**, not the 6/12/24/48/72h aggregate fusion cards. No estimates for absent hourly rows. Forecast issue/fetch must precede assessment time; fetch age up to 2h; coordinate distance ≤10 km; route segment must have fully covered interval; valid horizon ≤72h. Values are preliminary information-screening thresholds, **not calibrated flash flood hazard thresholds**.

Thresholds for `POTENTIAL_RAIN_EXPOSURE`: precipitation probability ≥65% or forecast hourly rain ≥10 mm/h. Even zero forecast returns `RAIN_FORECAST_PRESENT_SAFETY_UNKNOWN`, never `SAFE`. The weather exposure result has `safeToDrive=null`, `alternativeRouteApproved=false`, `floodRisk=NOT_EVALUATED`, `operationalWarningApproved=false`.

## Remaining work
1. Run an independently hosted, secured truck-routing provider and validate actual road segment geometry/entrances/exits, lengths, source timestamps and restrictions on Saudi roads.
2. Decode returned HERE/Valhalla route geometries, *validate actual representative points* and record spatial coverage. Do not set the flag automatically from an unreviewed polyline.
3. Add a trusted server-side hourly collection gateway for providers with provenance, rate limits and auth. The existing WeatherAPI proxy is not a road exposure endpoint.
4. Hydrology and wadis: spatial joins to validated DEM/catchments/culverts and independent historical events.
5. Official sources: signed/authorized road closures, traffic notices, NCM alerts, audit trail and manual override.
6. Scientific validation and calibration with independently observed rain, floods and road closures. Do not interpret model agreement as verified forecast skill.
7. End-to-end controlled pilot, privacy, security review, regulatory approvals before public road alerts.

No operational warning or rerouting decision is implemented in this stage.
