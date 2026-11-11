# Hydrology-9 — inspect geometry context of OSM bridge/culvert candidates (research only)

Inputs are your already saved local files:
- `jeddah_makkah_hydrology7_unified_evidence.json`: baseline site IDs, locations, river IDs.
- `jeddah_makkah_hydrology8_checked_candidates.json`: 17 matches from user-run OSM/Overpass export at six of ten sites (some may be repeated OSM elements across sites).
- `jeddah_makkah_osm_structures.json`: original **raw** Overpass JSON with `out geom;` (NOT GeoJSON).
- `jeddah_makkah_checkpoint.geojson`: earlier public demonstration research route.
- `frontend/data/hydrology/tiles/N20_E038.geojson`: research HydroRIVERS tile.

The offline script checks candidate identities and tags still match the raw OSM snapshot and measures approximate shortest distance between each OSM candidate's mapped geometry and (1) the demo route line and (2) only the HydroRIVERS IDs associated with the site. Distances are local planar approximations for identifying **review priorities**, not a proof of an actual physical waterway crossing. In particular, a bridge over another road does not prove the presence of a culvert; an OSM tag may be absent, obsolete or incorrect.

## Run Windows PowerShell

```powershell
cd C:\Users\Najeeb\RainGuard-AI-fixed
git pull origin main
py .\scripts\audit_hydrology9_osm_geometry.py --hydrology7 .\jeddah_makkah_hydrology7_unified_evidence.json --hydrology8 .\jeddah_makkah_hydrology8_checked_candidates.json --osm .\jeddah_makkah_osm_structures.json --route .\jeddah_makkah_checkpoint.geojson
```

Produces `jeddah_makkah_hydrology9_geometry_review.json` and `jeddah_makkah_hydrology9_candidate_checks.csv`. If a report already exists, supply a fresh `--prefix` to avoid overwriting evidence.

```powershell
$r = Get-Content .\jeddah_makkah_hydrology9_geometry_review.json -Raw | ConvertFrom-Json
$r | Format-List status,siteCount,sourceCandidateMatchCount,verifiedPhysicalCrossingCount,verifiedBridgeCulvertCount,safeToDrive
$r.candidates | Format-Table siteId,osmElement,mappedFeatureType,distanceToResearchRouteMeters,distanceToCandidateHydroRiverMeters,geometryContext
Start-Process .\jeddah_makkah_hydrology9_candidate_checks.csv
```

This report includes linkable OSM element references, map-tag kinds, geometric context labels and the remaining checklist for independent bridge/culvert and official closure verification. It does not download external data or change any RainGuard APIs. No credential, payment or Docker is required.

**Critical safeguards:** physical crossing `NOT_VERIFIED`; bridge/culvert counts independently verified `0`; flood risk `NOT_EVALUATED`; safe to drive `null`; alternative routes `false`; operational warnings `false`. No geometry overlap, absence of candidate, ACC value or DEM level is proof of vehicle safety, road inundation, or crossing existence.

Sources: [OSM bridge mapping](https://wiki.openstreetmap.org/wiki/Key:bridge), [Overpass Turbo](https://overpass-turbo.eu/), [HydroSHEDS](https://www.hydrosheds.org/). OSM data should preserve contributor attribution under its terms.
