"""Build an isolated Vercel FastAPI read-only preview bundle (NO DEPLOYMENT).

Usage:
  py -3.11 scripts/build_vercel_backend_preview.py  # builder can run with 3.11
  py -3.11 scripts/build_vercel_backend_preview.py --output C:/temp/rainguard-api-preview
The builder copies an explicit allowlist of backend sources only; it never
copies frontend, GitHub workflows, .env, data files, or credentials.
"""
from __future__ import annotations
import argparse
import ast
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCES = (
    "main.py",
    "land_cover_api.py",
    "here_truck_routes.py",
    "valhalla_truck_routes.py",
    "truck_route_timeline.py",
    "adaptive_learning.py",
)
ENTRY = ROOT / "deploy" / "vercel-backend-preview" / "index.py"
DEFAULT_OUT = ROOT / "dist" / "vercel-backend-preview"

def build(output: Path = DEFAULT_OUT) -> dict:
    output = output.resolve()
    root = ROOT.resolve()
    if output == root or output == root.parent:
        raise ValueError("Refusing to replace project root")
    if output.exists() and any(output.iterdir()):
        raise FileExistsError(
            "Target bundle directory is not empty; choose a fresh --output path"
        )
    # Syntax check before copying; avoid generating a bundle with broken code.
    for src in SOURCES:
        ast.parse((ROOT / src).read_text(encoding="utf-8"), filename=src)
    ast.parse(ENTRY.read_text(encoding="utf-8"), filename=str(ENTRY))
    output.mkdir(parents=True, exist_ok=True)
    for src in SOURCES:
        # Do not leave main.py at the bundle root: Vercel may auto-detect\n        # it as a second, unrestricted FastAPI entrypoint.\n        target = "legacy_rainguard.py" if src == "main.py" else src\n        shutil.copyfile(ROOT / src, output / target)
    shutil.copyfile(ENTRY, output / "index.py")
    # Vercel 2026 supports 3.12+, so pin the deployed runtime to 3.12.\n    # Separate lightweight dependency set for this function.
    # rasterio is required by the imported land-cover module; only these
    # server dependencies are permitted in the isolated bundle.
    (output / "requirements.txt").write_text(
        "fastapi>=0.115,<1\nhttpx>=0.27,<1\nsupabase>=2,<3\n"
        "rasterio>=1.4,<2\nuvicorn>=0.30,<1\n", encoding="utf-8"
    )
    (output / ".python-version").write_text("3.12\n", encoding="utf-8")
    # No catch-all SPA rewrite; the FastAPI app is the single backend entrypoint.
    (output / "vercel.json").write_text(
        json.dumps({"$schema":"https://openapi.vercel.sh/vercel.json"},indent=2)+"\n",
        encoding="utf-8",
    )
    (output / "README-DO-NOT-DEPLOY-YET.txt").write_text(
        "STAGING ONLY. DO NOT link to existing rain-guard-ai Production project.\n"
        "Use a separate Vercel project, test /health and /rain-alert, and keep\n"
        "unverified rainfall/flood indicators out of operational decisions.\n"
        "No Supabase secrets or routing keys are required in the preview.\n",
        encoding="utf-8",
    )
    paths=sorted(p.name for p in output.iterdir())
    return {"output":str(output),"files":paths,"deployed":False,
            "readOnly":True,"storage":"NO_LOCAL_PERSISTENCE"}

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output",type=Path,default=DEFAULT_OUT)
    args=parser.parse_args()
    print(json.dumps(build(args.output),ensure_ascii=False,indent=2))

if __name__=="__main__":
    main()
