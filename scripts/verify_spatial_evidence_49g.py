
import csv
import json
from pathlib import Path

SOURCE = Path("data/calibration/rainguard_49f_spatial_evidence.csv")
OUTPUT = Path("historical_validation/spatial_evidence_49g_summary.json")

REQUIRED = {
    "event_id", "feature_type", "feature_name",
    "source_doi", "source_figure",
    "latitude", "longitude",
    "coordinates_verified",
    "event_specific_rainfall_verified",
    "calibration_eligible"
}

def main():
    errors = []
    rows = []

    if not SOURCE.exists():
        errors.append("Source CSV not found")
    else:
        with SOURCE.open(encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(line for line in f if line.strip())
            missing = REQUIRED - set(reader.fieldnames or [])
            if missing:
                errors.append(f"Missing columns: {sorted(missing)}")
            else:
                rows = list(reader)

    for i, row in enumerate(rows, start=2):
        if not row["event_id"] or not row["feature_name"]:
            errors.append(f"Row {i}: missing event or feature")

        if row["feature_type"] not in {"RAIN_GAUGE", "AFFECTED_WADI"}:
            errors.append(f"Row {i}: invalid feature type")

        for field in (
            "coordinates_verified",
            "event_specific_rainfall_verified",
            "calibration_eligible"
        ):
            if row[field] not in {"YES", "NO"}:
                errors.append(f"Row {i}: invalid {field}")

        lat = row["latitude"].strip()
        lon = row["longitude"].strip()

        if bool(lat) != bool(lon):
            errors.append(f"Row {i}: incomplete coordinates")

        if lat and lon:
            try:
                if not (-90 <= float(lat) <= 90):
                    errors.append(f"Row {i}: invalid latitude")
                if not (-180 <= float(lon) <= 180):
                    errors.append(f"Row {i}: invalid longitude")
            except ValueError:
                errors.append(f"Row {i}: nonnumeric coordinates")

        if row["coordinates_verified"] == "YES" and not (lat and lon):
            errors.append(f"Row {i}: verified without coordinates")

        if row["calibration_eligible"] != "NO":
            errors.append(f"Row {i}: calibration must remain on HOLD")

    if not rows:
        errors.append("No evidence records")

    result = {
        "stage": "FORECAST-1J6G49G",
        "technical_status": "PASS" if not errors else "FAIL",
        "records": len(rows),
        "coordinate_verified_records": sum(
            r["coordinates_verified"] == "YES" for r in rows
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
