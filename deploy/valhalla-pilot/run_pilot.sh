#!/usr/bin/env bash
# RainGuard AI local-only Valhalla Jeddah-Makkah pilot.
# The only remote download is Geofabrik through the fixed prepare_extract.py URL.
set -Eeuo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
MODE="${1:-check}"
case "$MODE" in check|build|test|stop) ;; *) echo "Usage: bash run_pilot.sh [check|build|test|stop]" >&2; exit 2;; esac
if ! command -v python3 >/dev/null; then echo "ERROR: python3 required" >&2; exit 3; fi
if [[ "$MODE" == check ]]; then
  python3 prepare_extract.py --dry-run
  for command in docker osmium; do
    if command -v "$command" >/dev/null; then echo "OK: $command available"; else echo "MISSING: $command"; fi
  done
  if command -v docker >/dev/null && docker compose version >/dev/null 2>&1; then echo "OK: docker compose available"; else echo "MISSING: docker compose"; fi
  if [[ -s custom_files/jeddah-makkah-pilot.osm.pbf ]]; then echo "OK: pilot PBF exists"; else echo "PENDING: pilot PBF not prepared"; fi
  echo "CHECK ONLY: no network requests, no containers started"
  exit 0
fi
if [[ "$MODE" == stop ]]; then
  docker compose down
  exit 0
fi
if [[ "$MODE" == test ]]; then
  python3 smoke_test.py
  exit 0
fi
if ! command -v osmium >/dev/null; then
  echo "ERROR: Install osmium CLI in WSL/Linux: sudo apt install osmium-tool" >&2; exit 4
fi
if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
  echo "ERROR: Docker Engine / Docker Desktop with compose is required" >&2; exit 5
fi
if ! docker info >/dev/null 2>&1; then
  echo "ERROR: Docker is not running or user lacks permissions" >&2; exit 6
fi
echo "STEP 1: Download fixed Geofabrik extract (if absent), generate local Jeddah-Makkah PBF"
python3 prepare_extract.py --download
if [[ ! -s custom_files/jeddah-makkah-pilot.osm.pbf ]]; then
  echo "ERROR: pilot PBF missing or empty" >&2; exit 7
fi
echo "STEP 2: Start Valhalla on LOCALHOST ONLY (127.0.0.1:8002)"
docker compose up -d
echo "STEP 3: Checking route once; tile-building may still be underway."
python3 smoke_test.py
echo "If route is unavailable, inspect: docker compose logs --tail=80 valhalla"
echo "When ready, run: bash run_pilot.sh test"
echo "Stop using: bash run_pilot.sh stop"
