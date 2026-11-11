# RainGuard — Spatial weather sampling along a demo route (research only)

**What is new:** After the user selects a local valid Valhalla GeoJSON route in `frontend/truck-route-file-viewer.html`, they may explicitly press **طلب توقعات المطر لثلاث نقاط فقط**. No background polling or automatic route requests.

The browser derives *three geographic sample points* from the loaded route's decoded geometry: start, midpoint along great-circle segment lengths, and end. It sends at most three sequential requests to the existing RainGuard weather proxy at `https://rainguard-ai.onrender.com/api/weather/weatherapi`, using those sample coordinates. The proxy can return WeatherAPI hourly forecasts if configured; absent/unreachable/stale/invalid data are shown as unavailable, never zero.

**This is not an ETA-matched road weather exposure model.** The Valhalla demo returns an aggregate trip ETA, but not verified occupancy windows per subdivided road section. Weather valid times are displayed only as upcoming weather at the spatial points; no arrival time or safety decision is inferred. Intermediate sample positions are representative points on provider-estimated geometry; they are NOT independently field-validated road/weather locations.

**Restrictions:** Only one user-triggered batch of three calls per click; no public Valhalla call from browser; no private routing tokens, personal location, background alerts, hydro model, or official closures. Repeated clicks are deliberate new batches; do not automate polling. WeatherAPI query quotas and Render connectivity may prevent results.

Safety invariants: `safeToDrive=null`, `alternativeRouteApproved=false`, `operationalWarningApproved=false`, `floodRisk=NOT_EVALUATED`. Official road closures remain `NOT_VERIFIED`.

For genuine segment-time exposure, we still need independently verified per-leg travel times, secured road geometry, authenticated weather issue-time archives, and independently reviewed hydrology and official closure feeds. Do not infer timings by splitting the trip time equally.
