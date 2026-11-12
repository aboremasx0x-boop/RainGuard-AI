# Hydrology-19 — Offline readiness and missing-evidence audit

Hydrology-19 combines the original Hydrology-17 site-level request plan with its matching Hydrology-18 administrative log. It reports evidence gaps, not verified conditions.

## Windows /eli5

From your existing RainGuard-AI-fixed project directory:

```powershell
cd C:\Users\Najeeb\RainGuard-AI-fixed
git pull origin main
Start-Process .\frontend\hydrology19-readiness.html
```

1. Choose `rainguard_hydrology17_evidence_request_plan.json` in the first picker.
2. Choose `rainguard_hydrology18_response_log.json` in the second picker.
3. Press **فحص الجاهزية**.
4. Check the resulting site-by-site gaps, and download `rainguard_hydrology19_readiness_gaps.json` to store locally.

## Interpretation and limitations

- A send/response entry is a user-entered administrative **claim**, not independently verified communication.
- Hydrology-18 `events: []` means no administrative entries have been recorded. It does not prove no outside contact occurred.
- Each site remains **BLOCKED_PENDING_EXTERNAL_VERIFICATION** until a separate, formally governed engineering evidence workflow exists.
- Never interpret an OpenStreetMap mismatch as proof that no structure exists.
- No hydrologic model, flood depth estimate, road safety judgment, official closure verification, or alternate truck route approval is performed.
- No file is uploaded by this page. Keep private documents and photos off public GitHub.

## Regression check

```powershell
node --test tests\hydrology19_readiness_audit.test.cjs
```
