# RainGuard stage 2: Verified route geometry and segment ETA foundations

## Added

- `truck_route_timeline.py` takes **actual provider-returned** segment distances and travel durations, plus an offset-aware UTC departure, and calculates estimated entrance/exit timestamps for each segment.
- Protected `HERE` and `Valhalla` server adapters now return a `timeline` property alongside their existing routing responses. Existing consumers receive unchanged top-level route fields.
- Missing segment summaries, missing UTC departure time, and material discrepancies between the route total and segment total all cause the timeline to report **unavailable**, never invent times by evenly splitting the route.
- Every result keeps `safeToDrive: null`, `alternativeRouteApproved: false`, and `rainExposureStatus: NOT_ASSESSED`.

## What is not yet active

The public Vercel UI must **not** call the secured routes with a secret. Both route adapters require server-side access tokens; no complete nationwide Saudi road graph, private routing service, weather-to-road-segment spatial join, closure verification, or working alternative routes have been established. The consumer-facing webpage therefore remains an explicitly labeled simulation and city selector.

## Deployment requirements

1. Provision and run a private Valhalla server with legally obtained Saudi OSM tiles and truck costing configured, or use an authorized HERE account. This is separate infrastructure, not simply a change to Render.
2. Configure trusted server-to-server authentication and **rate limits, usage audit, IP/network restrictions, and request quotas** before production requests. Never put `RAINGUARD_ROUTE_ACCESS_TOKEN` in browser HTML or a public Vercel environment variable.
3. Validate the provider's route summaries on representative roads and height/weight restrictions before using the estimated segment arrivals.
4. Implement a distinct trusted backend orchestration service that joins the segment route geometry and timestamps to weather forecast hours, authenticated closure feeds and independently validated wadi/flood evidence.
5. Conduct historical tests and review before issuing any operator or driver warning. A working route does not mean a road is open or flood-safe.

The current engineering milestone is **segment ETA extraction, not a deployed real truck router**.

References: [Valhalla truck costing](https://valhalla.github.io/valhalla/api/route/api-reference/), [HERE Routing v8](https://www.here.com/docs/bundle/routing-api-developer-guide-v8/page/topics/transport-modes/truck.html).
