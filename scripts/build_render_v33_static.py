#!/usr/bin/env python3
"""Build an isolated, frontend-only Render Static Site for RainGuard V33.

NEVER publish the repository root: it contains backend code and server assets.
"""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "frontend"
DEST = ROOT / "render-public"
ALLOWED = {".html", ".css", ".js", ".mjs", ".json", ".geojson", ".svg", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".ico", ".avif", ".wasm", ".webmanifest", ".txt"}
EXCLUDE_PARTS = {"node_modules", ".git", "__pycache__", ".venv", "venv", "dist", "tests", "test", "secrets", "private"}
EXCLUDE_NAMES = {".env", ".env.local", ".env.production", "credentials.json", "secrets.json", "service-account.json"}
MAX_BYTES = 25 * 1024 * 1024

def main():
    if DEST.exists():
        shutil.rmtree(DEST)
    DEST.mkdir()
    landing = ROOT / "index.html"
    if not landing.is_file() or "ذكاء الأمطار والسيول في واجهة واحدة" not in landing.read_text(encoding="utf-8"):
        raise RuntimeError("V33 landing page not found; refusing to publish wrong branch.")
    shutil.copyfile(landing, DEST / "index.html")
    count = 1
    for file in SOURCE.rglob("*"):
        if not file.is_file() or file.is_symlink():
            continue
        rel = file.relative_to(SOURCE)
        if any(p.lower() in EXCLUDE_PARTS or p.startswith(".") for p in rel.parts):
            continue
        if file.name.lower() in EXCLUDE_NAMES or file.suffix.lower() not in ALLOWED:
            continue
        if file.stat().st_size > MAX_BYTES:
            raise RuntimeError(f"Unexpected oversized frontend asset: {rel}")
        target = DEST / "frontend" / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(file, target)
        count += 1
    for needed in [
        "frontend/national-ai-os-v30.html",
        "frontend/truck-routes-prototype.html",
        "frontend/js/rain_forecast_ui_v32.js",
        "frontend/js/national_truck_geography_v1.js",
        "frontend/css/rainguard-v33-interface.css",
        "frontend/js/rainguard-v33-interface.js",
    ]:
        if not (DEST / needed).is_file():
            raise RuntimeError(f"Missing critical frontend asset: {needed}")
    assert not any(DEST.rglob("*.py")), "Python backend must not be published"
    print(f"RENDER_V33_STATIC_READY: {count} public frontend files; output={DEST}")

if __name__ == "__main__":
    main()
