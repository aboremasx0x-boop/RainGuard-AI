# One-off public Valhalla demo: Jeddah → Makkah truck route

This is a **one-time, manual, fair-use research probe**, not a routing service in RainGuard.

**Public demo host:** `https://valhalla1.openstreetmap.de/route`, hosted by FOSSGIS e.V. The upstream docs say the demo has a fair-use/rate-limiting policy and request client identification for public end-user apps. See [Valhalla official docs](https://valhalla.github.io/valhalla/start/introduction/).

## How to run on Windows without WSL, Docker or paid HERE API
1. Install Windows Python 3 with `py --version` available (or use existing Python).
2. Download/clone the RainGuard repository with GitHub.
3. Open PowerShell **from the repository root**:
```powershell
py scripts/test_public_valhalla_demo.py --dry-run
py scripts/test_public_valhalla_demo.py
```
Run once, not in a polling loop or periodic job. The test sends one POST to a **fixed HTTPS demo host**, with `X-Client-Id: RainGuard-AI-research-test`. It has a 15-second timeout and rejects redirects. It sends public, approximate city-center test coordinates and an illustrative truck (18t, 4m high) only; no personal GPS or RainGuard credentials.

## What is and is not proven
If the demo responds successfully with a valid route, the script prints the server-computed **distance, travel minutes and leg count**, and the safety state remains null/unverified.

It does **not** prove this is a legal or safe heavy-goods road or that OSM height/weight/axle restrictions are complete; flooding, closures, speed limits, regulatory transport requirements and roadwork are not independently assessed.

If you get `DEMO_HTTP_ERROR` (including HTTP 429 fair-use limit), `DEMO_UNREACHABLE`, or `DEMO_ROUTE_NOT_RETURNED`, report that accurately. **Never fabricate ETA/distance**. Never change the protected production adapter to use this public demo host or insert an unauthenticated public routing endpoint in Vercel/Render.

The GitHub CI tests the parsing and failure states using **mocked responses**. It intentionally does not call the public demo to avoid consuming community resources.
