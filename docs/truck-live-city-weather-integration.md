# RainGuard AI — Partial live connection of truck command view

## Added in this change
1. The **public read-only** `GET /api/truck-routes/capabilities` backend endpoint reports whether WeatherAPI, HERE and self-hosted Valhalla credentials/configuration exist, without exposing credentials, private service URLs or any operational authorization. A configured flag is **not** an actual provider connectivity/health check.
2. The truck journey command webpage adds a separate **live city-level forecast panel** using existing `GET /api/weather/weatherapi?lat=...&lon=...` on the Render backend. User selects among preconfigured Jeddah, Makkah, Riyadh and Dammam city-center coordinates.
3. It shows only time-stamped upcoming hourly probability and precipitation for the city if weather data pass structural and freshness checks. It will not turn absent, expired or invalid hourly values into zero rain. Failure is shown as unavailable.
4. The existing three road segments and all road evidence remain conspicuously **synthetic**. A city-center forecast is NOT matched to the route geometry, ETA, wadi or closure.

## Explicit exclusions
- **No browser access to HERE/Valhalla token or routing endpoints.** Server-to-server authentication and private routing infrastructure must be configured separately.
- **No official NCM/road closure feed is connected by this patch.** The public status API does not claim otherwise.
- **No live GPS, real truck path, route alternative, or flood-safe direction is generated.**
- **No claim of Render or Vercel deployment** until actual platform deployment checks pass.

## Validation / next steps
- Deploy API changes to Render after code review; ensure `WEATHERAPI_API_KEY` is configured server-side.
- Deploy frontend after Vercel build limits allow it. Test city panel for Jeddah and Makkah, including an outage, stale data and source timestamps.
- Confirm private Valhalla/HERE routing works independently under quotas/auth; then build a new *trusted* API that uses independently checked actual road segment geometry and ETA and applies existing evidence gates. Do not call protected endpoints from the public static page.
- Before operational warnings: obtain authenticated official NCM warnings, roads authority closure and hydrological evidence; conduct independent field and scientific validation.

Source forecast documentation: https://www.weatherapi.com/docs/forecast-api/
