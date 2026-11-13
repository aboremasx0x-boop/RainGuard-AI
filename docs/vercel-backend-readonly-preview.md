# RainGuard AI — isolated Vercel Backend PREVIEW (NOT DEPLOYED)

**Do not merge into main or deploy into the existing rain-guard-ai Production project.**

## Why an isolated project?
The current Vercel frontend uses a catch-all rewrite to `/index.html` and lists static files from the repository. Connecting the full historical `main.py` would expose endpoints such as GET-based database verification. Instead, this bundle exposes only three read-only APIs:
- `GET /health` and `GET /api/health`: liveness (not weather accuracy).
- `GET /rain-alert`: actual RainGuard Open-Meteo forecasting code, weather-source failure handling, research-only warnings; no database writes in preview mode.
- `GET /api/truck-routes/capabilities`: capability flags; no route calculation.

The generated bundle pins Python **3.12** (a supported Vercel runtime) and renames the original `main.py` to `legacy_rainguard.py` so the unrestricted legacy FastAPI app is not accidentally autodetected as a second entrypoint. The only deployable `index.py` imports it as a module and exposes the allowlist.\n\nThe standalone app disables Swagger and OpenAPI, and does not mount the legacy app's routes. Only the explicitly registered endpoints are available; `POST`, other `GET`, and internal route APIs cannot be accessed. Routing endpoints, auto verification, historic records, probes and diagnostics stay unavailable.

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

### Vercel staging launch checklist — NOT executed here

**Do not publish this app in the existing frontend project, and never deploy or merge this draft branch automatically.** Production Vercel builds from this branch are explicitly ignored by the branch-only `vercel.json`. A future separate-project deployment must use the **generated isolated folder** rather than the repository root.

Once account quota has recovered, install Vercel CLI from the official source, log in, then use a separate project link in the bundle directory. The following block includes the **explicit deployment command**, but do not execute that final command until you intend to create a staging deployment:

```powershell
# From the repository root. Choose a fresh output directory for each build.
py -3.11 scripts/build_vercel_backend_preview.py --output .\dist\vercel-backend-preview-staging
cd .\dist\vercel-backend-preview-staging
# First command is for reviewing the CLI; it does NOT deploy.
vercel --version
# Next: links/create a NEW project interactively. Name it rainguard-api-preview.
# Do NOT link the current rain-guard-ai production project.
vercel link
# Only after inspecting .vercel/project.json to confirm new project and correct scope:
# vercel deploy
```

Use the **Preview** environment only (never `--prod`). Enable Vercel Deployment Protection/Authentication if supported by the plan before sharing the URL; otherwise do not expose the URL publicly. No production Supabase, NCM, HERE, Valhalla, or Weather API secrets should be added to this staging project. Avoid uploading any research datasets.

After a successful staging deployment, check the generated URL, replacing `YOUR-STAGING-URL` with the real returned deployment host:

```powershell
# Ensure these are JSON, not index.html.
Invoke-RestMethod "https://YOUR-STAGING-URL/health"
Invoke-RestMethod "https://YOUR-STAGING-URL/api/health"
Invoke-RestMethod "https://YOUR-STAGING-URL/rain-alert?lat=21.5433&lon=39.1728&name=Jeddah"
# Forbidden route should produce HTTP 404:
try { Invoke-WebRequest "https://YOUR-STAGING-URL/verify-prediction?prediction_id=1&actual_rain=0" -ErrorAction Stop } catch { $_.Exception.Response.StatusCode.value__ }
```

Verify that Resources show exactly one Python Function, `/health` is JSON, `/rain-alert` is either a provider forecast or a clear unavailable response, no unintended endpoints exist, and no SQLite/persistent Supabase access occurs. Check function logs for import or package errors (especially rasterio Linux wheels and Vercel resource quotas). Deployment success alone does not prove working weather API calls.

**Rollback:** Do not integrate the API with the frontend or enable operational warnings. If any test fails, do not promote to Production; disable or delete the new staging project.

Vercel official references:
- https://vercel.com/docs/frameworks/backend/fastapi
- https://vercel.com/kb/guide/ship-a-fastapi-app-on-vercel
- https://vercel.com/kb/guide/is-sqlite-supported-in-vercel

**No Vercel deployment is performed by GitHub Actions in this branch.** A branch-only `ignoreCommand` asks Vercel to skip builds from the draft branch; verify project settings as well. The existing Production project must not be reconfigured. Do not merge while quota is exhausted and production API remains unverified.
