# Truck route risk demo (simulation only)

Stand-alone file: `frontend/truck-routes-prototype.html`. The demo is **not linked** from the public national command UI and is not an actual truck route planner.

It models **illustrative** sections in a Jeddah–Makkah corridor with fabricated 20, 45 and 70-minute times. The forecast records in `syntheticDemo()` are also fabricated; no road geometries, traffic routing, GPS, floodwater depth, bridge clearance, closures, rescue dispatch, or live weather API are used.

The engine `frontend/js/truck_route_risk_prototype_v1.js` supports ETA-aligned hourly inputs and can return:
- `INSUFFICIENT_DATA`: a required observation, reliable time window, latest fetch time, route geometry or verified hydrology/closure data is missing
- `POTENTIAL_WEATHER_EXPOSURE`: potential rainfall exposure only when full input-verification flags are provided
- `REQUIRES_OFFICIAL_CONFIRMATION`: the evidence is apparently complete but the engine **never** issues a safe-to-travel verdict

`safeToDrive` is **always null**, and `alternativeRouteApproved` is **always false**. Verification flags on inputs are trust claims supplied by the caller, not proof. An actual operational engine would need authoritative road/closure feeds, approved truck navigation/ETA, spatially grounded rainfall forecasts and independently validated hydrological risk estimates, plus real review of the flags.

No live deployment, validated alternative routing or public-safety warning is claimed.
