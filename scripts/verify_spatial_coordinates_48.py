
#!/usr/bin/env python3
"""RainGuard 48B: Verify ERA5 reference/returned coordinates.
Diagnostic only. No flood-site verification or calibration.
"""

import csv
import json
import math
from pathlib import Path

SOURCE = Path(
    "data/calibration/"
    "rainguard_46_spatiotemporal_evidence_register.csv"
)
OUT = Path("historical_validation")
OUT.mkdir(parents=True, exist_ok=True)

EXPECTED = {"JEDDAH_2009", "JEDDAH_2011", "JEDDAH_2022"}
EARTH_RADIUS_KM = 6371.0088


def haversine(lat1, lon1, lat2, lon2):
    """Great-circle distance in kilometres."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = (
        math.sin(dp / 2) ** 2
        + math.cos(p1) * math.cos(p2)
        * math.sin(dl / 2) ** 2
    )
    return 2 * EARTH_RADIUS_KM * math.asin(
        math.sqrt(min(1.0, max(0.0, a)))
    )


def coordinate(value, minimum, maximum):
    number = float(value)
    if not math.isfinite(number) or not minimum <= number <= maximum:
        raise ValueError("Invalid coordinate")
    return number


if not SOURCE.exists():
    raise SystemExit(f"Missing required file: {SOURCE}")

with SOURCE.open(encoding="utf-8-sig", newline="") as file:
    reader = csv.DictReader(file)
    required = {
        "event_id",
        "era5_reference_lat",
        "era5_reference_lon",
        "era5_returned_lat",
        "era5_returned_lon",
        "era5_grid_cell_verified",
        "spatial_match_verified",
        "hourly_match_verified",
    }
    if not required.issubset(set(reader.fieldnames or [])):
        raise SystemExit(
            f"Missing columns: {sorted(required - set(reader.fieldnames or []))}"
        )
    rows = list(reader)

results = []
seen = set()

for row in rows:
    event_id = row["event_id"].strip()
    errors = []

    if event_id in seen:
        errors.append("DUPLICATE_EVENT_ID")
    seen.add(event_id)

    if event_id not in EXPECTED:
        errors.append("UNEXPECTED_EVENT_ID")

    distance = ""

    try:
        lat1 = coordinate(row["era5_reference_lat"], -90, 90)
        lon1 = coordinate(row["era5_reference_lon"], -180, 180)
        lat2 = coordinate(row["era5_returned_lat"], -90, 90)
        lon2 = coordinate(row["era5_returned_lon"], -180, 180)

        distance = round(haversine(lat1, lon1, lat2, lon2), 3)
    except (ValueError, TypeError, KeyError):
        errors.append("INVALID_OR_MISSING_COORDINATES")

    flags = [
        "era5_grid_cell_verified",
        "spatial_match_verified",
        "hourly_match_verified",
    ]

    for flag in flags:
        if str(row.get(flag, "")).strip().upper() != "NO":
            errors.append(f"UNEXPECTED_FLAG_{flag}")

    results.append({
        "event_id": event_id,
        "reference_lat": row.get("era5_reference_lat", ""),
        "reference_lon": row.get("era5_reference_lon", ""),
        "returned_lat": row.get("era5_returned_lat", ""),
        "returned_lon": row.get("era5_returned_lon", ""),
        "reference_to_returned_km": distance,
        "coordinate_check": "PASS" if not errors else "FAIL",
        "issues": " | ".join(errors),
        "flood_site_verified": False,
        "calibration_eligible": False,
        "review_status": "HOLD_UNTIL_INDEPENDENT_EVIDENCE",
    })

missing_events = sorted(EXPECTED - seen)

output = OUT / "spatial_coordinates_48.csv"

with output.open("w", encoding="utf-8-sig", newline="") as file:
    writer = csv.DictWriter(file, fieldnames=list(results[0]))
    writer.writeheader()
    writer.writerows(results)

passed = (
    len(results) == len(EXPECTED)
    and not missing_events
    and all(r["coordinate_check"] == "PASS" for r in results)
)

summary = {
    "events": len(results),
    "coordinate_checks_passed": sum(
        r["coordinate_check"] == "PASS" for r in results
    ),
    "missing_events": missing_events,
    "technical_status": "PASS" if passed else "FAIL",
    "calibration_eligible": 0,
    "status": "HOLD_UNTIL_INDEPENDENT_EVIDENCE",
    "output": str(output),
}

(OUT / "spatial_coordinates_48_summary.json").write_text(
    json.dumps(summary, ensure_ascii=False, indent=2),
    encoding="utf-8",
)

print(json.dumps(summary, ensure_ascii=False))

if not passed:
    raise SystemExit(1)
