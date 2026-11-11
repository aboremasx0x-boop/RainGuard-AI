# RainGuard Hydrology-2: local review-site coordinates (not confirmed crossings)

After the prior HydroRIVERS pilot found 10 *line features* within 200 m
of the experimental Jeddah–Makkah route, Hydrology-2 exports precise
**road-side geometry witness coordinates** for each candidate, then groups
nearby positions (100-m radius from each group's first member) into
human-review sites. Different nearby river IDs are preserved and never
silently discarded. A group may contain more than one river feature; the
number of sites is therefore not necessarily ten. There is no implication
that ten features equal ten physical crossings.

Uses only the checked-in N20_E038 HydroRIVERS research tile and the
locally exported Valhalla route geometry. No browser access to a
hydrology API or paid service, no OpenStreetMap data downloads, no
public routing requests.

## Run from Windows PowerShell

```powershell
cd C:\Users\Najeeb\RainGuard-AI-fixed
git pull origin main
py .\scripts\build_hydrology2_review_sites.py --route .\jeddah_makkah_checkpoint.geojson
```

Produces, unless the names already exist:
- `jeddah_makkah_hydro_review.json`: full research metadata, individual
  river-line witnesses and grouped review-site candidates.
- `jeddah_makkah_hydro_review.csv`: table of grouped sites and their
  river IDs for manual assessment.
- `jeddah_makkah_hydro_review.geojson`: point features with IDs, route
  segment positions and review status.

To inspect the grouped sites:

```powershell
$r = Get-Content .\jeddah_makkah_hydro_review.json -Raw | ConvertFrom-Json
$r | Format-List status,candidateRiverFeatures,reviewSiteCount,coverage,safeToDrive
$r.sites | Format-Table siteId,latitude,longitude,nearestRiverDistanceMeters,riverFeatureCount
```

Serve the viewer, if not already running:

```powershell
py -m http.server 3000 --bind 127.0.0.1
```

Open `http://127.0.0.1:3000/frontend/truck-route-file-viewer.html`.
Select your **same** `jeddah_makkah_checkpoint.geojson` route first.
Under **Hydrology-2 — مواقع المراجعة قرب المجاري المائية**, select
`jeddah_makkah_hydro_review.geojson`. The route viewer will overlay
local violet markers at the *road-side witness positions*. It rejects
files whose route endpoints/point count or marker positions disagree
with the selected route. Both files stay in your browser; they are
not uploaded.

## Data limitations

The proximity calculation uses planar approximations at the route's
mean latitude on generalized map lines. Even a computed distance of
zero means **geometric line intersection/proximity only**, not a
surveyed ground-level stream/road crossing. Bridges, underpasses,
culverts, berms, DEM elevations, rainfall intensity and official
closure status have not been verified. Nearest mapped line is
not necessarily the nearest or most dangerous actual drainage.

Distinct river features may be combined into review locations within
100m for human field/satellite follow-up. The chosen position is the
road-side witness of the member with the smallest calculated
distance; it is **not** a surveyed crossing coordinate. The scanner
retains only the closest witness per river-line feature; additional
approaches along the same river cannot yet be enumerated. It is
limited to a single research tile, not complete Saudi wadi inventory.

No danger classification, official alert, approved detour, safe
driving decision or recommended vehicle route is produced.
`safeToDrive=null`, `alternativeRouteApproved=false`,
`operationalWarningApproved=false` and
`officialRoadCrossingConfirmed=false`.

Data provenance: [HydroSHEDS HydroRIVERS](https://www.hydrosheds.org/products/hydrorivers)
and [OpenStreetMap](https://www.openstreetmap.org/copyright).
Confirm licensing terms before redistribution.
