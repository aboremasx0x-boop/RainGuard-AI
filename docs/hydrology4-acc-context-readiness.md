# RainGuard Hydrology-4 — actual dataset readiness (ACC is NOT DEM)

The repository includes a **HydroSHEDS v1.1 flow-accumulation grid**: `frontend/data/hydrology/saudi_hydrosheds_acc_15s.u32` (uint32 little-endian, approximately 86 MB), and its metadata. It is **NOT a digital elevation model**. Its values represent contributing-grid-cell counts, not road altitude, drainage capacity, predicted stream levels, flood depth or flood probability.

No verified culvert inventory, bridge surveys or surveyed road elevation files were found in the current project tree. Merely finding an ACC raster does not complete Hydrology-3's missing evidence checklists.

## Execute on your Windows PC

```powershell
cd C:\Users\Najeeb\RainGuard-AI-fixed
git pull origin main
py .\scripts\audit_hydrology4_acc_readiness.py --register .\jeddah_makkah_hydrology3_register.json
```

The script reads the local ACC grid at each candidate location using **4-byte random access**—no full 86MB read into RAM, no server request and no payment. It checks source metadata identity, file dimensions, nodata, geographic coverage and the ten review locations. It does not alter the prior files.

Produces `jeddah_makkah_hydrology4_acc_audit.json` and `jeddah_makkah_hydrology4_acc_sites.csv`.

```powershell
$r = Get-Content .\jeddah_makkah_hydrology4_acc_audit.json -Raw | ConvertFrom-Json
$r | Format-List status,siteCount,accGridAvailableSiteCount,demElevationVerifiedCount,bridgeCulvertVerifiedCount,safeToDrive
$r.sites | Format-Table siteId,gridStatus,accumulatedUpstreamCellCount,roadElevationMeters,culvertEvidence
```

If binary ACC is missing or is wrong-sized, each site is `ACC_BINARY_MISSING_OR_SIZE_MISMATCH`; absence is not equivalent to zero surface runoff.

Even if all ten sampled cells are present, the status is `FLOW_ACCUMULATION_CONTEXT_ONLY_NOT_ELEVATION`, `demElevationVerifiedCount=0`, `bridgeCulvertVerifiedCount=0`, `hydrologicFloodRisk=NOT_EVALUATED` and `safeToDrive=null`.

**Next**: separately obtain source-authorized DEM with documented vertical datum and resolution, official inventory of culverts/bridges, and independent field or survey verification before creating flood-depth or road hazard models.

Source: [HydroSHEDS](https://www.hydrosheds.org/) and the in-repository metadata at `data/hydrology/saudi_hydrosheds_acc_15s.meta.json`.
