# Hydrology-12 — local evidence-entry drafts (research only)

This is a browser-only **editable evidence draft form**, separate from the read-only Hydrology-11 dashboard. It is not an engineering sign-off system, is not authenticated and does not connect to official road-closure data.

## Usage on Windows

```powershell
cd C:\Users\Najeeb\RainGuard-AI-fixed
git pull origin main
Start-Process .\frontend\hydrology12-evidence-drafts.html
```

Choose your **original** `jeddah_makkah_hydrology10_review_package.json` file (not a previously edited draft), select one of the inspection records, enter observations and references, and use **Download JSON** or **Download CSV** to save drafts on your PC. Switching to a new site retains previously entered data in the current page's memory. **The page does not write to the old file, keep data in localStorage, upload images, or preserve draft edits across refreshes.** For persistence save an export before closing the browser. Draft imports are deliberately not supported yet.

Collect only metadata references to inspection photographs (not photograph bytes), visit date, observing organization, survey IDs, apparent crossing type, rough culvert opening dimensions and count, road agency inventory or official notice reference. Every entry remains **unverified**; there is no field authorizing safety or flood classification. Strict validation rejects invalid dates, widths, counts, suspicious giant entries and unknown record IDs. CSV export escapes untrusted text to reduce Excel formula injection risk.

## Safeguards

- All records: `fieldVerification=NOT_AUTHENTICATED`, `independentReview=NOT_PERFORMED`, `safeToDrive=null`, `floodRisk=NOT_EVALUATED`, `roadWadiCrossingVerified=false`, `bridgeCulvertApproved=false`.
- JSON and CSV saved locally via browser download only. No server, payment, API key, background network or geolocation required.
- Do not collect photographs while standing in an active roadway or wadi, during rain/flooding, or without authorized permission. Sensitive photos and personnel details should not be uploaded to the public GitHub repository.
- The status `enteredDraftCount` means **some draft fields have content**, not that fieldwork was independently completed or that a surveyed structure exists.
- The original Hydrology-10 and Hydrology-11 research packages remain unchanged, never automatically approved. Independent official/engineering verification must occur in a separate authenticated workflow before any operational road risk or safety claims.

Run Node tests locally: `node --test tests/hydrology12_evidence_drafts.test.cjs`.

References: [OpenStreetMap contributor attribution](https://www.openstreetmap.org/copyright); [HydroSHEDS](https://www.hydrosheds.org/).
