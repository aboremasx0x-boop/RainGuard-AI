# RainGuard AI — isolated Vercel Backend PREVIEW (NOT DEPLOYED)

**Do not merge into main or deploy into the existing rain-guard-ai Production project.**

## Why an isolated project?
The current Vercel frontend uses a catch-all rewrite to `/index.html` and lists static files from the repository. Connecting the full historical `main.py` would expose endpoints such as GET-based database verification. Instead, this bundle exposes only three read-only APIs:
- `GET /health` and `GET /api/health`: liveness (not weather accuracy).
- `GET /rain-alert`: actual RainGuard Open-Meteo forecasting code, weather-source failure handling, research-only warnings; no database writes in preview mode.
- `GET /api/truck-routes/capabilities`: capability flags; no route calculation.

The standalone app disables Swagger and OpenAPI, and does not mount the legacy app's routes. Only the explicitly registered endpoints are available; `POST`, other `GET`, and internal route APIs cannot be accessed. Routing endpoints, auto verification, historic records, probes and diagnostics stay unavailable.

## Windows ELI5 — prepare and validate locally

In `C:\Users\Najeeb\RainGuard-AI-fixed`:
```powershell
git fetch origin
git switch feat/vercel-backend-readonly-preview-20261113
py -3.11 scripts/build_vercel_backend_preview.py
.\.venv\Scripts\python.exe -m pip install -r .\dist\vercel-backend-preview\requirements.txt
.\.venv\Scripts\python.exe -m unittest discover -s tests -p test_vercel_backend_preview.py -v
```

The **builder does not deploy**. Output: `dist/vercel-backend-preview`, a separate folder containing only an allowlist of Python files, `index.py`, pinned-Python indicator, minimal config and requirements. No `.env`, front end, CI files, datasets, or Git credentials are copied. Do not commit output or put production API keys inside the bundle.

For an actual local server smoke test (before any Vercel deployment):
```powershell
cd .\dist\vercel-backend-preview
..\..\.venv\Scripts\python.exe -m uvicorn index:app --host 127.0.0.1 --port 8001
```
From a second PowerShell window:
```powershell
Invoke-RestMethod http://127.0.0.1:8001/health
Invoke-RestMethod "http://127.0.0.1:8001/rain-alert?lat=21.5433&lon=39.1728&name=Jeddah"
```

### Data protection
The entrypoint sets `RAINGUARD_VERCEL_READONLY=1` **before** importing `main.py`. In that mode:
- the SQLite initialization call in `main.py` is skipped;
- all calls to `save_prediction_history` refuse persistent writes;
- no Supabase environment variables are necessary for this preview;
- cache and learning metadata in process memory are ephemeral and **not persistent**;
- any real future persistence must use an explicitly approved external database with a separate security review;
- fallback must not invent hourly/daily weather forecasts when only current observations exist.
- road safety and flood engineering validation remain **not approved**.

### When Vercel quota is restored — future deployment, not part of this change
1. Create a **separate Vercel project**, not the production RainGuard frontend.
2. Deploy the generated `dist/vercel-backend-preview` folder using a separate Vercel CLI project link or isolated project repository. Do not connect the existing Vercel project's root to the backend. Do not select "Deploy to Production" in the current frontend project.
3. Verify `/health` returns JSON, `/rain-alert` returns a valid provider-based forecast or an explicit unavailable state, and blocked endpoints return 404/405.
4. Inspect Functions and logs and confirm no SQLite file, Supabase mutation or secret exposure.
5. Only after independent staging integration tests, decide whether to connect the frontend; keep operational route warnings off.

Vercel official references:
- https://vercel.com/docs/frameworks/backend/fastapi
- https://vercel.com/kb/guide/ship-a-fastapi-app-on-vercel
- https://vercel.com/kb/guide/is-sqlite-supported-in-vercel

**No Vercel deployment is performed by GitHub Actions in this branch.** GitHub-linked Vercel may attempt an automatic Preview build for a branch; ensure Auto Deploy for this branch is disabled in the Vercel project if strict no-deploy is required. Do not merge while quota is exhausted and production API remains unverified.
