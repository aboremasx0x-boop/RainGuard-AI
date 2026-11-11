# WeatherAPI.com (optional RainGuard data source)

This integration is **disabled at the provider level until a private key is configured**. The official NCM/Anwaa adapter remains in the repository but is disabled in the V30 source collector and forecast fusion until a permitted official API connection is configured. Official NCM warnings are not replaced by forecasts from WeatherAPI.com.

## Configure on Render (backend only)
Set environment variable `WEATHERAPI_API_KEY` with a valid WeatherAPI.com API key in the **RainGuard backend** Render service, then redeploy the backend. Never put this key in HTML, a JS bundle, public Vercel variables, GitHub, query strings rendered in the UI, or logs.

Backend proxy: `GET /api/weather/weatherapi?lat=21.5433&lon=39.1728`. If the key is missing the response is HTTP 503 and `WEATHERAPI_API_KEY_NOT_CONFIGURED`. Upstream failures are reported as unavailable, not as 0 mm.

The adapter `frontend/js/weatherapi_adapter_v32.js` uses the same backend as the existing Visual Crossing adapter (default `https://rainguard-ai.onrender.com`). Check this host against the active deployed backend before publishing.

Expected rollout check: request coordinates for Jeddah (21.5433, 39.1728), Riyadh (24.7136, 46.6753), Dammam (26.4207, 50.0888); confirm hourly timestamps, probability, mm and source freshness. Free tiers can restrict forecast days, resulting in partial 48/72-hour windows. Do not substitute missing samples with zero rainfall.

WeatherAPI hourly forecast documentation: https://www.weatherapi.com/docs/forecast-api/

Note: Forecast provider probabilities and hourly rain amounts are **not** validated flood warnings or road safety certificates. Keep official NCM alerts and road closure notices separate.
