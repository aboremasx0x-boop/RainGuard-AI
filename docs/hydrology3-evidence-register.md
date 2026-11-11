# Hydrology-3 — Jeddah–Makkah evidence review register

The earlier Hydrology-2 experiment identified **10 road-side review candidate sites** from HydroRIVERS. These are NOT confirmed drainage crossings, culvert locations or flood-hazard observations.

This stage builds an **offline, non-operational evidence review register** for the candidates. It has five independently reviewable categories:
1. Bridge/culvert inventory
2. DEM road and terrain elevation
3. Wadi network spatial review
4. Historical flood observation
5. Official road closure records

All five categories start with `MISSING_EVIDENCE`. The script DOES NOT fetch DEMs, confirm bridges, contact official agencies or create hydrological risk estimates. Missing evidence is **unknown, not clear/safe**.

## Run on Windows (PowerShell)

```powershell
cd C:\Users\Najeeb\RainGuard-AI-fixed
git pull origin main
py .\scripts\build_hydrology3_evidence_register.py --hydrology2 .\jeddah_makkah_hydro_review.json
```

Expected outputs:
- `jeddah_makkah_hydrology3_register.json`: per-site structured checklist with review status
- `jeddah_makkah_hydrology3_checklist.csv`: one row per site and category (for ten sites, 50 rows)
- `jeddah_makkah_hydrology3_evidence_template.csv`: blank evidence collection form, with coordinates and site IDs linked through the checklist

Review results:

```powershell
$r = Get-Content .\jeddah_makkah_hydrology3_register.json -Raw | ConvertFrom-Json
$r | Format-List status,siteCount,independentlyVerifiedEvidenceCount,safeToDrive
$r.sites | Select-Object siteId,latitude,longitude,reviewStatus | Format-Table
Start-Process .\jeddah_makkah_hydrology3_checklist.csv
```

For a future batch of submitted references, an optional **JSON** list of records (not CSV) can be supplied with `--submissions submissions.json`, using fields:
`siteId`, `category`, `sourceReference`, `sourceOrganization`, `observedAtUtc`, `submittedBy`, `notes`.

These are **untrusted human claims**, not authenticated information. Even if a source reference is provided for all five categories, results remain `SUBMITTED_UNVERIFIED` and `HUMAN_REVIEW_REQUIRED`; `independentlyVerifiedEvidenceCount=0`. No auto-upgrading status through self-asserted JSON booleans.

To preserve previous research exports, existing output filenames cannot be overwritten; choose a new `--prefix`.

## Required for a real hydrology/road review

An authorized independent reviewer must inspect and attest source authenticity, exact road/culvert geometry and elevations (including DEM accuracy), historical water-level observations, and official closure validity before any safety decision. Actual road crossing and flood risk are **not yet evaluated**.

Invariants: `safeToDrive=null`, `alternativeRouteApproved=false`, `operationalWarningApproved=false`, `hydrologicFloodRisk=NOT_EVALUATED`, `roadClosureStatus=UNKNOWN`.

This is a records management and evidence-gap template, **not a forecast of flood risk and not a truck routing service**.
