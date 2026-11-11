# Hydrology-5 — offline real DEM terrain sampling (Jeddah–Makkah)

## Dataset and caution

Use NASA/USGS **SRTM 1-arc-second Global, version 3** or another *documented SRTM-compatible HGT*. Obtain the **N21E039.hgt** tile covering the ten 21°N, 39°E Jeddah–Makkah review sites. Download via the official [NASA Earthdata Search](https://search.earthdata.nasa.gov/search?q=SRTMGL1) or [USGS EarthExplorer](https://earthexplorer.usgs.gov/) using the applicable free access/account conditions. Download the proper tile, verify its provenance, then extract .hgt from the .zip if necessary. Do not rename a TIFF or an unrelated file to .hgt.

The script never downloads or publishes DEM imagery, and does not need rasterio, GDAL, Docker, billing, or an API key. It reads **big-endian signed-int16** HGT with 1201x1201 or 3601x3601 samples and maps coordinates to the nearest pixel. It identifies void cells (-32768) and out-of-tile positions.

The repository's **HydroSHEDS ACC is NOT a DEM**, and the 2,368/2,373 upstream-cell counts previously observed must not be mislabelled as metres.

## Steps / Windows PowerShell

```powershell
cd C:\Users\Najeeb\RainGuard-AI-fixed
git pull origin main
New-Item -ItemType Directory -Force .\local-dem | Out-Null
```

Place a legitimately sourced **N21E039.hgt** in `C:\Users\Najeeb\RainGuard-AI-fixed\local-dem\`.

```powershell
py .\scripts\sample_hydrology5_srtm_hgt.py --register .\jeddah_makkah_hydrology3_register.json --hgt .\local-dem\N21E039.hgt
$r = Get-Content .\jeddah_makkah_hydrology5_terrain_samples.json -Raw | ConvertFrom-Json
$r | Format-List status,siteCount,sampledTerrainCellCount,verifiedRoadSurfaceElevationCount,sourceAuthenticity,safeToDrive
$r.sites | Format-Table siteId,sampleStatus,sampledTerrainElevationMeters,roadSurfaceElevationMeters
```

Also produces `jeddah_makkah_hydrology5_terrain_samples.csv`.

If you have not obtained the DEM, the tool **cannot fabricate heights**, and should exit with a clear missing-file message.

**Scientific limitations:** SRTM is a historical terrain/surface dataset with a geodetic datum and vertical reference that must be checked from official product metadata. A raster value may capture natural ground or man-made features depending on the source, and does not verify bridge deck elevation, culvert capacity, official closures or inundation. Raster resolution and measurement uncertainty matter. Even all ten valid samples do NOT imply ten surveyed road heights.

All output retains `verifiedRoadSurfaceElevationCount=0`, `sourceAuthenticity=USER_PROVIDED_FILE_UNVERIFIED`, `hydrologicFloodRisk=NOT_EVALUATED`, `safeToDrive=null`, and `alternativeRouteApproved=false`. Independent source and field review is required before operational flood modelling.

References: [NASA SRTM Quick Guide](https://www.earthdata.nasa.gov/s3fs-public/2025-05/SRTM_Quick_Guide.pdf) and [NASA Earthdata Search](https://search.earthdata.nasa.gov/). A separate free Copernicus GLO-30 **DSM in COG GeoTIFF** format is available via the [AWS open-data registry](https://registry.opendata.aws/copernicus-dem/), but is **not supported by this HGT parser**.
