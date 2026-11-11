"""Prepare a Jeddah-Makkah development-only PBF from Geofabrik GCC extract.

Needs osmium CLI in PATH. Does not download during CI or when --dry-run.
Run on a developer machine with enough free disk and reliable internet.
"""
from __future__ import annotations
import argparse
import shutil
import subprocess
import urllib.request
from pathlib import Path

GCC_URL = "https://download.geofabrik.de/asia/gcc-states-latest.osm.pbf"
BBOX = "38.65,20.65,40.45,22.25"
ROOT = Path(__file__).resolve().parent
DOWNLOAD = ROOT / "downloads" / "gcc-states-latest.osm.pbf"
OUTPUT = ROOT / "custom_files" / "jeddah-makkah-pilot.osm.pbf"


def build_command(osmium_exe: str, source: Path, destination: Path):
    return [
        osmium_exe, "extract", "--strategy", "complete_ways",
        "--bbox", BBOX, "--overwrite", "--output", str(destination), str(source)
    ]


def prepare(download: bool = False, dry_run: bool = False) -> dict:
    if dry_run:
        return {
            "source": GCC_URL, "extract": BBOX, "destination": str(OUTPUT),
            "requires": "osmium CLI + Docker on local computer",
            "downloaded": False, "tiles_built": False
        }

    osmium_exe = shutil.which("osmium")
    if not osmium_exe:
        raise RuntimeError("OSMIUM_CLI_NOT_INSTALLED: install osmium tool before running extraction")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    DOWNLOAD.parent.mkdir(parents=True, exist_ok=True)
    if download and not DOWNLOAD.is_file():
        # Only a fixed, documented upstream URL. Never accept arbitrary URLs.
        urllib.request.urlretrieve(GCC_URL, DOWNLOAD)
    if not DOWNLOAD.is_file():
        raise RuntimeError("GCC_PBF_NOT_FOUND: download " + GCC_URL + " to " + str(DOWNLOAD))
    subprocess.run(build_command(osmium_exe, DOWNLOAD, OUTPUT), check=True)
    if not OUTPUT.is_file() or OUTPUT.stat().st_size == 0:
        raise RuntimeError("EXTRACT_EMPTY")
    return {"destination": str(OUTPUT), "extract": BBOX,
            "source_bytes": DOWNLOAD.stat().st_size, "pilot_bytes": OUTPUT.stat().st_size}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--download", action="store_true", help="download GCC extract if missing")
    parser.add_argument("--dry-run", action="store_true", help="print steps; do not download or build")
    args = parser.parse_args()
    import json
    print(json.dumps(prepare(args.download, args.dry_run), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
