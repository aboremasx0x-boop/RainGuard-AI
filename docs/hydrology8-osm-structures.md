# Hydrology-8 — free community-map structure candidate review

The project has **no independently authenticated bridge/culvert inventory for the ten Jeddah–Makkah research sites**. This stage prepares a conservative **manual OSM Overpass candidate search** using `bridge=*`, `man_made=bridge`, `waterway=*` + `tunnel=culvert` and `culvert=*`. These community tags do not confirm an actual road–wadi crossing or the capacity, clearance or integrity of a structure.

## 1. Update project and create a safe bounded query (PowerShell)

```powershell
cd C:\Users\Najeeb\RainGuard-AI-fixed
git pull origin main
py .\scripts\review_hydrology8_osm_structures.py --hydrology7 .\jeddah_makkah_hydrology7_unified_evidence.json
```

Creates `jeddah_makkah_hydrology8_overpass_query.ql`. This is only a text query. It **does not perform network requests automatically**.

## 2. Manually get a small OSM result (optional)

Open [Overpass Turbo](https://overpass-turbo.eu/) and paste the full contents of the generated `.ql` file into the query editor. Click Run **once**, allowing for the community service's fair-use/rate limits. Export the raw Overpass API JSON as `jeddah_makkah_osm_structures.json` to the local project folder. Do not use the map GeoJSON export because this tool expects the Overpass raw JSON `elements` array with geometry. If service is busy, stop; do not automatically retry or overwhelm its public infrastructure.

Source: [OSM bridge tagging](https://wiki.openstreetmap.org/wiki/Key:bridge), [OSM bridge outlines](https://wiki.openstreetmap.org/wiki/Tag:man_made%3Dbridge), [OSM waterway](https://wiki.openstreetmap.org/wiki/Key:waterway).

## 3. Audit candidate proximity locally

```powershell
py .\scripts\review_hydrology8_osm_structures.py --hydrology7 .\jeddah_makkah_hydrology7_unified_evidence.json --osm .\jeddah_makkah_osm_structures.json --prefix .\jeddah_makkah_hydrology8_checked
$r = Get-Content .\jeddah_makkah_hydrology8_checked_candidates.json -Raw | ConvertFrom-Json
$r | Format-List status,siteCount,matchedSiteCount,totalCandidateMatches,independentlyVerifiedBridgeCulvertCount,safeToDrive
$r.sites | Format-Table siteId,mappedStructureCandidateCount,structureEvidenceStatus
Start-Process .\jeddah_makkah_hydrology8_checked_sites.csv
```

The 250-m radius around each site limits query scope. The offline audit uses 200-m road-site-to-tagged-geometry proximity and deduplicates Overpass features. Results are NOT an exhaustive inventory. The script does not claim the mapped bridge crosses the wadi or is on the same carriageway, and a blank result **does not prove no structure exists**.

The stage always sets `independentlyVerifiedBridgeCulvertCount=0`, `riskRanking=null`, `safeToDrive=null`, `alternativeRouteApproved=false`, `operationalWarningApproved=false` and `hydrologicFloodRisk=NOT_EVALUATED`.

All exports and queries stay local unless the user manually submits the small coordinate-scoped query to public Overpass Turbo. Do not upload private raw evidence, account credentials, or individually identifying data. Respect [OSM copyright/ODbL attribution](https://www.openstreetmap.org/copyright). To get operational coverage, obtain road authority/maintenance infrastructure inventory and review with authorized personnel; **do not use OSM for safety clearance**.
