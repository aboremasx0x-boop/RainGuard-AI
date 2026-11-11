# Local Valhalla pilot — جدة ↔ مكة (no payment card)

Purpose: prepare a local, development-only routing graph from OpenStreetMap for a limited Jeddah–Makkah pilot. No live routing graph has been built or deployed by this commit.

Sources:
- https://github.com/valhalla/valhalla/blob/master/docker/README.md — official scripted container image
- https://download.geofabrik.de/asia/gcc-states.html — GCC states extract
- https://valhalla.github.io/valhalla/api/route/api-reference/ — truck costing
- https://www.openstreetmap.org/copyright — attribution and ODbL license

## Requirements
- Windows with Docker Desktop and WSL2, or Linux with Docker Engine.
- Osmium command-line tool on Linux or WSL2: sudo apt update && sudo apt install osmium-tool
- Internet to download the container and GCC OSM input, plus sufficient local RAM and disk for the graph build.

## Simplified launch without any paid routing subscription

Existing RainGuard pilot assets are in this folder. The new launch scripts
make local preparation and testing easier. These scripts do NOT activate any
server in Render/Vercel, and nothing is downloaded until you explicitly run
`Build`.

**Windows 10/11 with Docker Desktop + Ubuntu WSL2:**

```powershell
cd deploy/valhalla-pilot
powershell -ExecutionPolicy Bypass -File .\run_pilot.ps1 -Mode Check
powershell -ExecutionPolicy Bypass -File .\run_pilot.ps1 -Mode Build
powershell -ExecutionPolicy Bypass -File .\run_pilot.ps1 -Mode Test
```

If Ubuntu was installed with a different WSL name, use `-Distro <name>`.
Inside Ubuntu first install the free extraction tool using
`sudo apt update && sudo apt install osmium-tool`. Start Docker Desktop
with WSL integration enabled before Build.

**Linux / WSL2 directly:**

```bash
cd deploy/valhalla-pilot
bash run_pilot.sh check
bash run_pilot.sh build
bash run_pilot.sh test
bash run_pilot.sh stop
```

The first build may need a large GCC OSM download and local tile processing.
If Build reports `NOT READY`, read `docker compose logs --tail=80 valhalla`
and re-run Test after graph building completes. **Only a successful Test**
confirms an actual local sample route calculation; a working container or
successful download alone does not.

No credit-card account or paid routing API is required. Local disk, memory,
download traffic, internet and electricity still have costs. Extract and
container image licenses and attributions must be respected.

**Connecting the existing local API to local Valhalla:** Run the RainGuard
FastAPI backend *on the same trusted computer*, configure its private
`VALHALLA_TRUCK_BACKEND_URL=http://127.0.0.1:8002`,
`VALHALLA_TRUCK_ROUTING_ENABLED=true`, and a strong
`RAINGUARD_ROUTE_ACCESS_TOKEN` known **only to trusted server-to-server
callers**. The protected `POST /api/truck-routes/valhalla` cannot be called
from the public Vercel page with a browser secret. Render cannot access
your computer's loopback address. Do not open port 8002 to the internet
or turn this local pilot into a public router.

## Steps (run inside WSL2 or Linux)
1. cd deploy/valhalla-pilot
2. python3 prepare_extract.py --dry-run
3. python3 prepare_extract.py --download
4. docker compose up -d
5. docker compose logs -f valhalla (wait for routing tiles to build; this is a synchronous local task)
6. python3 smoke_test.py
7. docker compose down

The initial dataset is a **bounding-box pilot only**, with extent 38.65,20.65,40.45,22.25 (lon/lat). Extraction strategy complete_ways preserves whole crossing roads. GCC PBF includes neighboring countries; this pilot is not nationwide. To extend later, use and license-attribution-check a suitable country graph and verify real heavy-goods restrictions in all 13 Saudi regions.

## Safety and security
- Docker binds 127.0.0.1:8002 only; do not expose this testing server to the public internet.
- The FastAPI Valhalla adapter is disabled until it has a trusted private routing server, server-to-server authentication and traffic controls.
- A Render process cannot access your Windows computer using 127.0.0.1. Do not configure Render backend to use a local laptop address.
- The smoke test estimates a truck route, and does not verify road opening, official restrictions, closures, rain flood hazard, or authorization to drive. safeToDrive remains null.
- OpenStreetMap truck tags can be missing; provider route results are not road-safety validation.

## Status
- [x] Region and city selectors covering 13 Saudi regions
- [x] Protected, optional Valhalla truck adapter in RainGuard backend
- [x] Pilot graph preparation and smoke test scripts
- [ ] Local Docker routing graph built and tested with real GCC OSM data
- [ ] Route rules, ETA, hydrology, closure data and official restrictions validated
- [ ] Nationwide rollout under capacity and authorization controls