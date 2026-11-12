# Hydrology-16 — independent evidence follow-up (local research only)

This stage consumes the **Hydrology-14 TSV** export, NOT the Hydrology-15 Excel workbook. The dashboard is a local, read-only view and does not upload inputs.

## Windows steps

From the existing project folder:

```powershell
cd C:\Users\Najeeb\RainGuard-AI-fixed
git pull origin main
Start-Process .\frontend\hydrology16-review-tracker.html
```

1. From Hydrology-14, keep the previously downloaded `rainguard_hydrology14_completeness.tsv`.
2. Open the Hydrology-16 page and select that TSV file from Downloads.
3. Review all rows or filter by NO_INPUT, MISSING_FIELDS, or FIELDS_PRESENT_UNVERIFIED.
4. Optionally download `rainguard_hydrology16_followup_register.json` with only structural IDs, missing-field labels, and unverified follow-up queue.
5. Do not upload private investigation documents or personal details to public GitHub.

## Non-negotiable limitations

- The TSV report contains **field-presence metadata, not authenticated evidence**.
- All rows remain `AWAITING_INDEPENDENT_EVIDENCE`, `verified=false`.
- The generated register has `safeToDrive=null`, `routeApproved=false`, and `floodRisk=NOT_EVALUATED`.
- Follow-up group suggestions are administrative, **not official agency assignments or risk ranking**.
- This stage does not integrate live weather, road closures, or truck-routing decisions.
- The separate Hydrology-15 Excel spreadsheet is for human review only and is not silently imported or treated as authoritative.

## Tests

```powershell
node --test tests\hydrology16_review_tracker.test.cjs
```
