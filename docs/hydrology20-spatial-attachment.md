# Hydrology-20 — Spatial attachment for official evidence requests

Hydrology-10's **local original** `jeddah_makkah_hydrology10_review_package.json` has one research coordinate per site, repeated across its candidate worksheets. Hydrology-19 alone does **not** contain site coordinates, so never invent them from site identifiers.

## Windows steps (/eli5)

Open PowerShell in your existing RainGuard project:

```powershell
cd C:\Users\Najeeb\RainGuard-AI-fixed
git pull origin main
py .\scripts\build_hydrology20_spatial_attachment.py
```

The generated file is `rainguard_hydrology20_spatial_attachment.csv` in the project folder. Open it with Excel and confirm it has **10 site rows**. Attach a reviewed version to a correspondence **only after** identifying official roadway ownership and checking which locations can be disclosed.

- If the source JSON is in Downloads instead of the project folder, use:
```powershell
py .\scripts\build_hydrology20_spatial_attachment.py --source "$HOME\Downloads\jeddah_makkah_hydrology10_review_package.json"
```
- To rerun without overwriting an old file:
```powershell
py .\scripts\build_hydrology20_spatial_attachment.py --output .\rainguard_hydrology20_spatial_attachment_v2.csv
```

## Meaning

The generated latitude/longitude are **research route-side positions**, not validated locations of physical road-wadi crossings, culverts or bridges.
- `agencyOwner=NOT_IDENTIFIED` and `roadName=NOT_IDENTIFIED` deliberately remain unresolved.
- `NO_OSM_MATCH_UNVERIFIED` means OSM did not match a geometry candidate in this research snapshot; it does **not** mean the physical structure is absent.
- `fieldVerification=NOT_PERFORMED`.
- No official road closure, culvert capacity, hydraulic risk, safe driving or route approval is inferred.
- The script never accesses the network and never uploads file contents.
- Keep location/survey detail in a controlled folder and seek official authorization before publishing infrastructure information.

Run regression checks:
```powershell
py -m unittest discover -s tests -p test_hydrology20_spatial_attachment.py
```
