# Secure nationwide heavy-truck routing provider (HERE v8, optional)

Architecture: `here_truck_routes.py` (FastAPI) is a **disabled-by-default** backend adapter. The standalone city selector remains an offline prototype and DOES NOT yet query or draw real road lines.

Provider: [HERE Routing v8](https://docs.here.com/routing/docs/routing-v8-intro), [truck mode](https://docs.here.com/routing/docs/routing-v8-transport-modes-overview), [vehicle properties](https://docs.here.com/routing/docs/routing-v8-vehicle-properties), [critical notices](https://docs.here.com/routing/docs/routing-v8-notice).

## Secure activation (do NOT activate without access controls)
Set these variables **server-side only**, not in public JavaScript or GitHub:
- `HERE_ROUTING_API_KEY`: credential from HERE platform, not present by default
- `RAINGUARD_ROUTE_ACCESS_TOKEN`: long unique random server-to-server access token
- `HERE_TRUCK_ROUTING_ENABLED=true`: explicit deployment toggle; defaults off

Endpoint: `POST /api/truck-routes/here` with `X-RainGuard-Route-Token` header. Do **not** put the access token in browser JavaScript, URL query strings or public frontend environment variables. Use only from trusted backends or through a future authenticated, metered server-to-server proxy. Existing access-token protection is not a complete production authorization, abuse-prevention or quota-control system. Add durable rate limits, user permission checks, cost alerts and auditing BEFORE enabling for broad usage.

Example sanitized request body (illustrative, not an approval to travel):
```json
{
  "origin": {"lat": 21.5433, "lon": 39.1728},
  "destination": {"lat": 24.7136, "lon": 46.6753},
  "departure_time_utc": "2026-11-12T08:00:00Z",
  "vehicle": {
    "gross_weight_tons": 18,
    "height_meters": 4,
    "width_meters": 2.5,
    "length_meters": 14
  }
}
```

The adapter requests HERE transportMode=truck, summary and encoded polyline for actual road geometry, including gross vehicle weight (kg), height/width/length (cm). HERE route **summary is transport routing information, not flood clearance**. Sections with `critical` restriction notices are explicitly marked. Even where no critical notice is received, the adapter returns `safeToDrive: null` and `alternativeRouteApproved: false`.

**Coverage**: Saudi coordinate bounding box validation (approximate; not official polygon). The prior 13-region selector offers approximate city-center coordinates and **not** actual trip start/end address snapping. Real routing needs validated address/road entrance points, truck profile details, restrictions, official closure feeds, and separate hydrological exposure assessment by ETA.

**Next integration**: Use a separately authenticated backend to request HERE routes, decode its flexible polyline with the [official decoder](https://github.com/heremaps/flexible-polyline), evaluate each route section time interval and location with independent precipitation/flash flood evidence, and render **caution-only** explanations in the user dashboard after authorization and operational testing.

No API key was registered or verified in production during this change. No live nationwide route is asserted.
