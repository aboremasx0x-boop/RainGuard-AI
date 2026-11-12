# Hydrology-18 — administrative request/response tracker (offline)

This stage reads the Hydrology-17 JSON request plan and creates a **local administrative event log**. It does not authenticate anything, send requests, or approve routes.

## Windows steps

```powershell
cd C:\Users\Najeeb\RainGuard-AI-fixed
git pull origin main
Start-Process .\frontend\hydrology18-response-tracker.html
```

1. Select `rainguard_hydrology17_evidence_request_plan.json` from Downloads.
2. To make a local note: select site, choose event type, enter occurrence date, and add an optional note.
3. When recording an **assertion** that a request was sent or a response arrived, a document/reference number is mandatory. The UI does **not** check that this happened. Statuses are `SENT_CLAIM_LOGGED_UNVERIFIED` and `RESPONSE_CLAIM_LOGGED_UNVERIFIED`.
4. Download `rainguard_hydrology18_response_log.json` to save progress.
5. On later visits load the **same** Hydrology-17 plan first, then use "استعادة سجل" to reload your saved Hydrology-18 file.

## Limitations

- No uploads, calls to authorities, notifications, storage service, or background monitoring.
- No official receipt, inspection, independent validation or hydrologic modeling is provided.
- Road safety is always null, routing approval false, flood risk NOT_EVALUATED.
- No names, contacts, or private photos are necessary. Store local documents privately.
- The tool cannot verify sender identity, document authenticity, or date of communication.
- For the current snapshot, 10 sites, 21 records, zero requests sent and zero independently verified.
- If the input file is modified, validation may reject it.

## Automated tests
```powershell
node --test tests\hydrology18_response_log.test.cjs
```
