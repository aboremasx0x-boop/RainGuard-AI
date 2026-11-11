# Hydrology-7 — unified Jeddah–Makkah research evidence, not flood-risk scoring

This stage **joins already generated local results**, never contacts a paid or external service, and does **not** calculate flood probability, approve alternative roads, identify an actual culvert, or declare any road safe. It rejects inconsistent site IDs, coordinates, river IDs, source/status fields, claimed safety decisions, inconsistent DEM summaries and falsified evidence approval.

Inputs are **four JSON files**, derived from the same ten candidate road–river proximity review locations:
- Hydrology-2: approximate HydroRIVERS line proximity (not field-verified crossings)
- Hydrology-3: five-category unverified evidence checklist (bridges and culverts, DEM/survey, wadi, floods, official road closures)
- Hydrology-4: HydroSHEDS ACC upstream contributing-cell count (NOT elevation or flood probability)
- Hydrology-6: local 5×5 SRTM height neighborhood (NOT surveyed road or bridge height)

Hydrology-5 raw DEM center height is already represented as `centerTerrainMeters` in Hydrology-6. The original `N21E039.hgt` stays on the user's PC, never uploaded.

## Run on Windows PowerShell

```powershell
cd C:\Users\Najeeb\RainGuard-AI-fixed
git pull origin main
py .\scripts\build_hydrology7_unified_evidence.py --hydrology2 .\jeddah_makkah_hydro_review.json --hydrology3 .\jeddah_makkah_hydrology3_register.json --hydrology4 .\jeddah_makkah_hydrology4_acc_audit.json --hydrology6 .\jeddah_makkah_hydrology6_terrain_windows.json
```

Produces:
- `jeddah_makkah_hydrology7_unified_evidence.json`
- `jeddah_makkah_hydrology7_unified_evidence.csv`

To inspect:

```powershell
$r = Get-Content .\jeddah_makkah_hydrology7_unified_evidence.json -Raw | ConvertFrom-Json
$r | Format-List status,siteCount,accContextPresentSiteCount,completeTerrainWindowSiteCount,verifiedFloodRiskAssessmentCount,safeToDrive
$r.sites | Format-Table siteId,accUpstreamContributingCellCount,accGridStatus,srtmWindowStatus
Start-Process .\jeddah_makkah_hydrology7_unified_evidence.csv
```

**Expected for the user's prior full datasets:** 10 sites, ACC context 10/10, complete SRTM terrain windows 10/10. This must be confirmed by running on the user's PC; it has not been performed remotely on the user's private local files.

## Research and safety limitations

- A geometric line-to-line distance of zero does not prove a road–wadi crossing.
- ACC is measured in contributing **grid cells**, never meters.
- SRTM samples are approximate historical terrain values, not bridge deck elevation or surveyed road elevation, and their vertical datum, accuracy and provenance remain unverified for operations.
- No risk rank, color-coded hazard classification or inferred flood depth is produced.
- Bridge/culvert inventory, historical observations, spatial reviews and official road closures remain **unknown/missing** even when all available rasters contain values.
- `riskRanking=null`, `safeToDrive=null`, `alternativeRouteApproved=false`, `operationalWarningApproved=false`, `verifiedFloodRiskAssessmentCount=0` always.

Data sources: [HydroSHEDS](https://www.hydrosheds.org/) and [NASA SRTM](https://www.earthdata.nasa.gov/data/instruments/srtm). This summary only references those sources; it does not validate downloaded files or downstream use licensing.
