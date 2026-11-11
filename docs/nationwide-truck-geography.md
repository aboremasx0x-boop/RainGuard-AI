# Nationwide Truck Geographic Locations — Prototype

The selection prototype now covers **all 13 Saudi administrative regions**, using a starter list of principal cities per region. It supports same-region and cross-region city pairs, departure time, and optional truck weight and height.

**Critical limitation:** the city markers are approximate city-center points, not official geocoding, addresses, road entrances or validated transport waypoints. The user interface does **not** draw a road line or calculate truck ETA, distance, highway restrictions, flooded segments, safe routes or alternative routing. It never announces a route as safe.

The prototype page is `frontend/truck-routes-prototype.html` and the registry is `frontend/js/national_truck_geography_v1.js`. This standalone page is not linked from the operational V30 national dashboard. Existing simulation remains separately labeled and intentionally fictional.

## What is required for nationwide operational routing

1. A legally licensed routing provider or validated national road graph with **heavy-goods-vehicle restrictions** (height, weight, dangerous cargo, axle configuration, permits), including provider coverage and caching.
2. Reliable route geometries and per-segment ETAs (time-dependent, traffic-aware if available).
3. Authoritative current closures and traffic constraints; no "road open" inference from absence of closure data.
4. Time-and-location-matched weather forecasts, hydrological valley and culvert modeling, radar and evidence freshness.
5. Independent event validation, uncertainty thresholds, monitoring, and an authoritative escalation/override policy before any operational warning.
6. Use administrative boundaries from the Saudi General Authority for Survey and Geospatial Information when implementing actual region polygons. Do not interpret the OpenStreetMap demo tiles as the official Saudi map.

Regions are grounded in: https://my.gov.sa/en/content/govmechanism and https://ncar.gov.sa/regions-coding. Official Saudi map: https://www.geosa.gov.sa/ar/About/Pages/OfficialSaudiMap.aspx

The city centers are approximate labels for exploring region scope and require geocoding validation before production use.
