# Hydrology-11: local-only field evidence dashboard

This feature adds a small Arabic HTML dashboard at `frontend/hydrology11-local-review.html`. It reads the **Hydrology-10 JSON package from your computer's file picker**, validates the research-only status and displays summary counts, OSM candidate links and uninspected sites. You can filter by site or distinguish OSM matches from unmatched sites. It is intentionally **read-only**: no editing files, no saving sensitive evidence, no remote requests, no backend endpoint or operational decisions.

## Windows instructions

```powershell
cd C:\Users\Najeeb\RainGuard-AI-fixed
git pull origin main
Start-Process .\frontend\hydrology11-local-review.html
```

If preferred, open under your existing local port 3000 server:

`http://127.0.0.1:3000/frontend/hydrology11-local-review.html`

Use the **Choose file** control and select:

`C:\Users\Najeeb\RainGuard-AI-fixed\jeddah_makkah_hydrology10_review_package.json`

The dashboard should show ten sites, 17 OSM matches, 21 inspection worksheets, and **zero confirmed site inspections** for the user's previously demonstrated data (verify locally). There are four unmatched sites; they must NOT be interpreted as lacking bridges or culverts.

### Safety and privacy

- Rejects reports claiming operational validation, inspection completion, safe driving or approved detours. All on-screen data is a **research snapshot**.
- Avoids `innerHTML` for user-supplied values. Displays text using `textContent`; only validated exact OpenStreetMap URLs can become links.
- Does not send file contents to the web or add API requests. Does not expose user data in public deployment until the user explicitly selects a local file.
- Limits accepted JSON files to 3 MiB. It shows candidate links but does not automatically open OpenStreetMap.
- An unverified/empty field is not independently reviewed or automatically accepted. For official engineering assessment, obtain authorized field-survey and road authority infrastructure records.
- Keeps `safeToDrive=null` and `hydrologicFloodRisk=NOT_EVALUATED`; it never assigns a road danger ranking.

Data attribution: [OpenStreetMap contributors](https://www.openstreetmap.org/copyright); research terrain from [NASA SRTM](https://www.earthdata.nasa.gov/data/instruments/srtm).

Run Node.js regression tests locally: `node --test tests/hydrology11_local_review.test.cjs`.
