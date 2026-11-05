
import csv
import json
from pathlib import Path
from datetime import datetime

SOURCE = Path(
    "data/calibration/rainguard_49h_station_verification.csv"
)
OUTPUT = Path(
    "historical_validation/station_evidence_49i_summary.json"
)

REQUIRED = {
    "event_id", "station_id", "station_name",
    "station_operator", "latitude", "longitude",
    "coordinate_source", "coordinates_verified",
    "observation_date", "observation_start_utc",
    "observation_end_utc", "observed_rainfall_mm",
    "observation_interval", "observation_source",
    "original_record_verified",
    "era5_spatial_match_verified",
    "era5_temporal_match_verified",
    "calibration_eligible", "verification_status"
}

FLAGS = [
    "coordinates_verified",
    "original_record_verified",
    "era5_spatial_match_verified",
    "era5_temporal_match_verified",
    "calibration_eligible"
]

def main():
    errors = []
    rows = []

    if not SOURCE.exists():
        errors.append("Source file missing")
    else:
        with SOURCE.open(encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(
                line for line in f if line.strip()
            )
            missing = REQUIRED - set(reader.fieldnames or [])
            if missing:
                errors.append(f"Missing columns: {sorted(missing)}")
            else:
                rows = list(reader)

    for index, row in enumerate(rows, start=2):
        if not row["event_id"] or not row["station_id"]:
            errors.append(f"Row {index}: missing identifiers")

        for flag in FLAGS:
            if row[flag] not in {"YES", "NO"}:
                errors.append(f"Row {index}: invalid {flag}")

        lat = row["latitude"].strip()
        lon = row["longitude"].strip()

        if bool(lat) != bool(lon):
            errors.append(f"Row {index}: incomplete coordinates")

        if lat and lon:
            try:
                if not -90 <= float(lat) <= 90:
                    errors.append(f"Row {index}: invalid latitude")
                if not -180 <= float(lon) <= 180:
                    errors.append(f"Row {index}: invalid longitude")
            except ValueError:
                errors.append(f"Row {index}: invalid coordinates")

        if row["coordinates_verified"] == "YES":
            if not (lat and lon and row["coordinate_source"]):
                errors.append(
                    f"Row {index}: coordinate evidence missing"
                )

        if row["original_record_verified"] == "YES":
            required_observation = [
                "observation_start_utc",
                "observation_end_utc",
                "observed_rainfall_mm",
                "observation_interval",
                "observation_source"
            ]
            if any(not row[x].strip() for x in required_observation):
                errors.append(
                    f"Row {index}: observation evidence missing"
                )

        if row["calibration_eligible"] == "YES":
            if not all(row[x] == "YES" for x in FLAGS[:-1]):
                errors.append(
                    f"Row {index}: calibration prerequisites missing"
                )
            else:
                errors.append(
                    f"Row {index}: independent approval required"
                )

    if not rows:
        errors.append("No station records")

    result = {
        "stage": "FORECAST-1J6G49I",
        "technical_status": "PASS" if not errors else "FAIL",
        "station_event_records": len(rows),
        "coordinates_verified": sum(
            r["coordinates_verified"] == "YES" for r in rows
        ),
        "original_records_verified": sum(
            r["original_record_verified"] == "YES" for r in rows
        ),
        "calibration_eligible": 0,
        "scientific_status": "HOLD_UNTIL_INDEPENDENT_EVIDENCE",
        "errors": errors
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(
        json.dumps(result, indent=2),
        encoding="utf-8"
    )

    print(json.dumps(result, indent=2))

    if errors:
        raise SystemExit(1)

if __name__ == "__main__":
    main()
