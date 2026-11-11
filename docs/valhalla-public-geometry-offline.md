# RainGuard: viewing one real Valhalla demo geometry, offline

This feature improves the successful one-off Jeddah–Makkah demo: it exports the actual route line returned by the community Valhalla API and visualizes it using **a local GeoJSON file**. It never fabricates a straight road line from two city-center markers.

## On Windows PowerShell (from RainGuard-AI-fixed)

```powershell
git pull origin main
py .\scripts\export_public_valhalla_route_geojson.py --dry-run
py .\scripts\export_public_valhalla_route_geojson.py
```

The third command makes **one** public demo request and writes
`jeddah_makkah_route_demo.geojson` if the upstream response contains valid
Valhalla encoded polyline6 geometry. It does NOT overwrite an existing file.
If the demo fails, is rate-limited, or returns no geometry, it will NOT
fabricate or save a route. Don't run repeated requests or put this in a
scheduler; observe the provider's fair-use policy.

Open `frontend/truck-route-file-viewer.html` in the browser (double-click
is sufficient) and use the local file picker to select the generated
GeoJSON file. The page draws a schematic vector line from verified
**file coordinates**, shows the demo's distance and travel time, and never
uploads the file, fetches a map tile, calls an API, or requires a token.
It explicitly separates this read-only view from the simulated weather
and official-closure readiness modules in the main RainGuard dashboard.

The route test assumes a **fictional 18-ton, 4-meter-high truck** between
approximate Jeddah/Makkah city centers. It is not a recommended real
route. OpenStreetMap restrictions may be incomplete; no closure,
hydrological flood status, official warnings, truck vehicle permits,
live traffic, or road-safety clearance has been obtained. `safeToDrive`
remains `null`.

The only approved production path is a properly authenticated
self-hosted/authorized routing service with vetted provider geometry,
sufficient rate limits and independent regulatory/meteorological review.
Never wire the FOSSGIS community demo directly into the public RainGuard
API as a production backend.

Sources: https://valhalla.github.io/valhalla/api/route/api-reference/
and https://www.openstreetmap.org/copyright.
