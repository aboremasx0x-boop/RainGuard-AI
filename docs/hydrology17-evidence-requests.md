# Hydrology-17 — Local evidence-request planner

Input: `rainguard_hydrology16_followup_register.json` generated from Hydrology-16. This file contains unverified metadata, not measurements or authenticated evidence.

## Windows /eli5

```powershell
cd C:\Users\Najeeb\RainGuard-AI-fixed
git pull origin main
Start-Process .\frontend\hydrology17-evidence-requests.html
```

1. Choose the Hydrology-16 JSON file in Downloads.
2. Inspect the 10 site-level follow-up groups (for the current research snapshot).
3. Pick a site to view a **draft, unsent** request text.
4. Use Copy only if you intend to prepare a request externally; the site does not send anything.
5. Download `rainguard_hydrology17_evidence_request_plan.json` to keep the follow-up plan locally.

## Scope and safety

- No change to risk models, live weather, route guidance, bridge/culvert approval, or road closure feed.
- `safeToDrive=null`, `routeApproved=false`, `floodRisk=NOT_EVALUATED`.
- No official recipient is inferred and no request is sent.
- No real photos, names, private observations, or evidence attachments are uploaded.
- Avoid publishing sensitive field notes or potentially identifiable infrastructure documents on public GitHub.
- `NO_OSM_MATCH` never means that no physical structure exists.
- The suggested recipient role is a placeholder only, not a verified organization assignment.

## Tests
```powershell
node --test tests\hydrology17_evidence_requests.test.cjs
```
