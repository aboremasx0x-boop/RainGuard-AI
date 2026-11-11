# Hydrology-6: 5 × 5 local terrain window at Jeddah–Makkah candidate sites

This offline research script samples a **5 × 5 pixel window** around each of the ten previously identified **unverified** road–river proximity review sites. It uses your locally downloaded `N21E039.hgt` SRTM tile: there is **no online data access, Docker, GIS installation, or paid API**.

The script computes nearest-center terrain height, the neighborhood minimum, maximum, median, height range and the center-to-median difference. These numbers are **descriptive raster statistics, not flood risk, depression mapping, road grade, drainage capacity or bridge-level elevations**. The window radius of two cells corresponds to a few tens of metres in each direction at SRTM 1 arcsecond resolution; actual geographic distance varies with latitude. It skips any missing center or neighborhood cell without filling values and refuses out-of-tile or edge windows.

## Run on Windows / PowerShell

```powershell
cd C:\Users\Najeeb\RainGuard-AI-fixed
git pull origin main
py .\scripts\analyze_hydrology6_local_terrain.py --register .\jeddah_makkah_hydrology3_register.json --hgt .\local-dem\N21E039.hgt
```

Outputs:
- `jeddah_makkah_hydrology6_terrain_windows.json`
- `jeddah_makkah_hydrology6_terrain_windows.csv`

```powershell
$r = Get-Content .\jeddah_makkah_hydrology6_terrain_windows.json -Raw | ConvertFrom-Json
$r | Format-List status,siteCount,completeWindowCount,incompleteWindowCount,verifiedRoadSurfaceElevationCount,safeToDrive
$r.sites | Format-Table siteId,sampleStatus,centerTerrainMeters,minTerrainMeters,maxTerrainMeters,centerMinusMedianMeters
```

This tool **does not** compare ACC with DEM to assign flood-risk scores. HydroSHEDS ACC is a contributing-cell count, not elevation. If additional drainage or culvert surveys are provided later, they must be independently checked for quality, CRS, spatial alignment, horizontal and vertical datum, road surface and bridge deck verification before modelling any road inundation.

**Fixed safeguards:** no verified road elevations, no verified culvert/bridge data, `safeToDrive=null`, `alternativeRouteApproved=false`, `operationalWarningApproved=false`, `hydrologicFloodRisk=NOT_EVALUATED`. Existing output files are not overwritten.

Source: [NASA SRTM](https://www.earthdata.nasa.gov/data/instruments/srtm).
