# Hydrology-10 — field-review forms for ten Jeddah–Makkah locations

This is an **offline, zero-cost preparation tool**, not an inspection, approval, or flood-risk model. It reads the Hydrology-9 research JSON and produces a blank **candidate-by-candidate field worksheet** plus a per-site summary. In the previous local run there were ten sites and 17 OSM geometry candidate matches at six sites. Sites with no OSM candidates still receive their own inspection row: absence from a community map does NOT establish absence of a bridge or culvert.

## Run on Windows PowerShell

```powershell
cd C:\Users\Najeeb\RainGuard-AI-fixed
git pull origin main
py .\scripts\build_hydrology10_field_review.py --hydrology9 .\jeddah_makkah_hydrology9_geometry_review.json
```

Outputs:
- `jeddah_makkah_hydrology10_review_package.json`
- `jeddah_makkah_hydrology10_field_worksheet.csv`
- `jeddah_makkah_hydrology10_site_summary.csv`

```powershell
$r = Get-Content .\jeddah_makkah_hydrology10_review_package.json -Raw | ConvertFrom-Json
$r | Format-List status,siteCount,sourceCandidateMatchCount,inspectionWorksheetCount,completedFieldVisitCount,safeToDrive
Start-Process .\jeddah_makkah_hydrology10_field_worksheet.csv
```

The worksheet includes OSM link and mapped bridge/culvert tag, road/river-line geometric distances, and **blank** columns for: observed structure type and physical crossing, visit time, inspected-by organization, photograph references, surveyed position, number and dimensions of culvert openings, bridge deck survey, authority asset inventory record, official closure reference, independent review and notes.

For the prior 17 matches across six of ten sites, expect **21 worksheet rows** (17 candidate records + four unmatched sites). This number must be confirmed by your local run. It is a **number of evidence-collection rows**, not a count of unique physical assets.

## Field safety and data protection

- Do not inspect roads, wadis or culverts during rain or flash-flood conditions, or trespass on active carriageways or restricted infrastructure. Field visits require proper authorization and traffic/occupational safety controls.
- The source data and preliminary forms are **NOT independently verified**. Even completed user-entered fields must undergo an authorized and independent authenticity and engineering review. Filling CSV cannot turn evidence into an approved operational safety decision.
- Images are not uploaded or generated; only references are kept locally. Avoid personal data in public reports and never commit private photos, identity information or nonpublic road-infrastructure details to GitHub.
- `safeToDrive=null`, `alternativeRouteApproved=false`, `operationalWarningApproved=false`, `hydrologicFloodRisk=NOT_EVALUATED`, `verifiedBridgeCulvertCount=0` remain unchanged.

References: [OpenStreetMap copyright and attribution](https://www.openstreetmap.org/copyright) and [OpenStreetMap bridge tagging](https://wiki.openstreetmap.org/wiki/Key:bridge).
