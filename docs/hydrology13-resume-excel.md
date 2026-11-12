# Hydrology-13: resume locally saved evidence drafts and direct Excel-compatible output

RainGuard Hydrology-13 extends the existing offline `frontend/hydrology12-evidence-drafts.html` page; it does **not** connect to live roadway/safety data.

## Windows steps

```powershell
cd C:\Users\Najeeb\RainGuard-AI-fixed
git pull origin main
Start-Process .\frontend\hydrology12-evidence-drafts.html
```

1. First choose the **original** `jeddah_makkah_hydrology10_review_package.json` file in the first picker. This establishes the canonical site IDs and OSM candidates.
2. To resume an existing draft, use the second file picker and choose your previous **`rainguard_hydrology12_evidence_draft_*.json`** file. You cannot resume from the Excel `.xlsx` or `.csv` review copy, because they are presentation formats without immutable source checks. If you exported only CSV, you can still view the data in Excel, but you must re-enter the notes locally before exporting your new JSON snapshot.
3. The editor restores valid evidence entries only after checking source site/candidate identifiers, geometry, counts, field types, and unapproved status. The script rejects modified records, inserted unknown fields, altered safety statuses or mismatched review packages. Rejected drafts do **not** replace current entries.
4. Continue editing records as before. Use **Export JSON** every time you wish to preserve resumable progress.
5. Use **Export Excel table (TSV)** to save `rainguard_hydrology13_excel_*.tsv`. The tab-delimited file is encoded in **UTF-16LE with BOM**, which supports Arabic text and is generally recognized by Windows Excel without locale-dependent comma/semicolon splitting. Open using Excel; if Excel does not separate columns automatically, choose Data → From Text/CSV → Tab as delimiter. Save the opened worksheet as `.xlsx` for normal use.

**Note:** the prior `.csv` export is still available for compatibility, but the new `.tsv` is the recommended format for Excel. The application does not produce a native `.xlsx` file; Excel can save one. It does not read edits made inside Excel back into the review workflow.

## Safety and privacy

- All 21 review records stay research-only, unauthenticated and unapproved; successful reload or a filled field is **not** independent verification.
- No photo bytes are uploaded. Only local text references are stored in browser memory until an explicit file download; there is no API call, database, localStorage, third-party embed or official alert integration.
- Any previously exported files must be stored privately; do not upload investigation notes, people names, private infrastructure photographs or sensitive material to public GitHub.
- Formula-like text in Excel exports is prefixed with a quote to reduce spreadsheet formula injection risk.
- `safeToDrive=null`, `alternativeRouteApproved=false`, `operationalWarningApproved=false`, `hydrologicFloodRisk=NOT_EVALUATED` are enforced.

### Run automated checks

```powershell
node --test tests\hydrology13_resume_drafts.test.cjs
node --test tests\hydrology12_evidence_drafts.test.cjs
```

See [Microsoft: import data from a CSV file](https://support.microsoft.com/en-us/office/import-data-from-a-csv-file-c6e9ccad-50d4-4b27-9f0c-9bfa7b2c9889) for details about delimiters and importing external text files.
