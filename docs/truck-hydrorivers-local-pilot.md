# RainGuard Research: Jeddah–Makkah local HydroRIVERS proximity pilot

The project already contains the preprocessed HydroRIVERS tile
`frontend/data/hydrology/tiles/N20_E038.geojson` (manifest lists 636 lines).
This pilot compares the **user-exported, Valhalla-computed route geometry**
to river-network line features locally using a ~200-meter proximity
screen. It avoids a new network request, Docker, Ubuntu, API tokens or
a hosted live hydrology service.

## Windows PowerShell instructions

From `C:\Users\Najeeb\RainGuard-AI-fixed`:

```powershell
git pull origin main
py .\scripts\scan_route_hydrorivers_local.py --route .\jeddah_makkah_checkpoint.geojson
Get-Content .\jeddah_makkah_hydrorivers_screen.json -Raw | ConvertFrom-Json | Format-List status,tileRiverFeatureCount,nearbyRiverCount,dataCompleteness,hydrologicFloodRisk,safeToDrive
```

To inspect the nearby river IDs (if any):

```powershell
$r = Get-Content .\jeddah_makkah_hydrorivers_screen.json -Raw | ConvertFrom-Json
$r.nearbyRivers | Format-Table riverId,approximateProximityMeters
```

The tool will not overwrite an existing report; use `--output` with a
different filename on the next research run. The tile and route are
read entirely from disk and not uploaded.

**Do not interpret a proximity value of 0 as a confirmed wadi crossing.**
The route and HydroRIVERS may have map-generalization and positional
errors, may represent different levels of roads/bridges/culverts, and
do not provide floodwater heights or live weather/runoff. A distance
over 200m or zero nearby features likewise does NOT mean a route is
safe or devoid of crossings. Data is only one HydroRIVERS tile, not a
validated, up-to-date comprehensive Saudi wadi inventory. A local
approximate projected-line distance is not a surveyed clearance.

The script's invariant outputs are:
`officialRoadCrossingConfirmed=false`,
`hydrologicFloodRisk=NOT_EVALUATED`,
`roadClosureStatus=UNKNOWN`, `safeToDrive=null`,
`alternativeRouteApproved=false`,
`operationalWarningApproved=false`.

**Next research prerequisites:** independently verified wadi/culvert
intersections, bridge elevations, surveyed coordinates, DEM and
catchment processing, event-based inundation observations, official
closures and validation before any automated safety or detour advice.
The stage-4 evidence completeness gate remains separately required.

Source dataset: [HydroSHEDS HydroRIVERS](https://www.hydrosheds.org/products/hydrorivers)
and [OpenStreetMap copyright](https://www.openstreetmap.org/copyright).
Review redistribution requirements before public publication.
