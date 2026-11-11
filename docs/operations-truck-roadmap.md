# RainGuard AI — Operations UI + Smart Safe Routes roadmap (2026-11-11)

## Implemented in this slice

- A responsive operational landing section inside the existing V30 page; existing phase bar, map, data collection, verification and reports remain in place.
- Direct access from V30 to `frontend/truck-routes-prototype.html` and a return link.
- A prototype-only 30/60/120 minute simulation window for the *existing fabricated* 20/45/70-minute sections.
- Clear indicators that selecting cities in all 13 regions **does not calculate an actual road route**, truck restriction compliance, ETA, flood depth, safe-road status, or approved alternative.

## Next development gates

| Gate | Feature | Evidence needed before claiming operational readiness |
| --- | --- | --- |
| 1 | Command-center redesign and mobile usability | Visual checks of RTL/LTR, screens, existing V30 buttons and map |
| 2 | Nationwide truck-route geometry and segment ETAs | Private hosted truck routing (Valhalla/HERE), verified Saudi road coverage and vehicle restrictions; separate verified alternatives |
| 3 | ETA-matched rainfall forecasts per road segment | Route geolocation, hour-by-hour provider data, source freshness and missing-data handling |
| 4 | Hydrological/terrain/wadi assessment | Spatially aligned DEM, culvert/drainage evidence and independent flood-event validation |
| 5 | Official alerts, closures and escalation | Authorized NCM and roads data feeds, audit and operator override |
| 6 | Historical scientific calibration | Independently timestamped station observations, holdout evaluation and error/uncertainty metrics |
| 7 | End-to-end trials, cybersecurity and launch review | Controlled pilot, penetration testing, resilience drills, accessibility and authorized stakeholder review |

## Important differentiation

Forecast **rain exposure** is not the same as **road flood risk**. An algorithm can show *possible weather exposure after an hour* only after all relevant forecast and routing data are reliable; it must not claim a highway or alternate route is safe merely because rainfall is low, road closures are not reported, or a weather provider responds successfully.

The already present `here_truck_routes.py` and `valhalla_truck_routes.py` are adapters, not evidence that a routing provider is active or licensed. See `docs/free-valhalla-truck-routing.md`, `docs/secure-truck-routing-here.md`, and `docs/independent-forecast-verification.md`.

Next engineering implementation should add a **secured truck-route preview gateway** with quotas, trusted routing service integration, georeferenced segment data and a route exposure *information-only* result. Do not inject routing keys into public HTML.
