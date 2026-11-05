
import csv
import json
from pathlib import Path
from datetime import datetime, timezone

SOURCE = Path("data/official_stations/rainfall_observations.csv")
OUTPUT = Path(
    "historical_validation/official_rainfall_49j_summary.json"
)

REQUIRED = {
    "station_id",
    "latitude",
    "longitude",
    "timestamp_utc",
    "rainfall_mm",
    "source_agency",
    "source_reference"
}

def main():
    errors = []
    valid = 0
    stations = set()
    timestamps = set()

    if not SOURCE.exists():
        result = {
            "stage": "FORECAST-1J6G49J",
            "technical_status": "WAITING_FOR_OFFICIAL_DATA",
            "valid_records": 0,
            "scientific_status": "HOLD_UNTIL_INDEPENDENT_EVIDENCE"
        }
    else:
        with SOURCE.open(encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(
                line for line in f if line.strip()
            )
            missing = REQUIRED - set(reader.fieldnames or [])

            if missing:
                errors.append(f"Missing columns: {sorted(missing)}")
            else:
                for index, row in enumerate(reader, start=2):
                    try:
                        station = row["station_id"].strip()
                        agency = row["source_agency"].strip()
                        reference = row["source_reference"].strip()

                        lat = float(row["latitude"])
                        lon = float(row["longitude"])
                        rain = float(row["rainfall_mm"])

                        if not station or not agency or not reference:
                            raise ValueError("Missing source information")

                        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
                            raise ValueError("Invalid coordinates")

                        if rain < 0:
                            raise ValueError("Negative rainfall")

                        timestamp = datetime.fromisoformat(
                            row["timestamp_utc"].replace("Z", "+00:00")
                        )

                        if (
                            timestamp.tzinfo is None
                            or timestamp.utcoffset().total_seconds() != 0
                        ):
                            raise ValueError("Timestamp must be UTC")

                        key = (station, timestamp.isoformat())

                        if key in timestamps:
                            raise ValueError("Duplicate station timestamp")

                        timestamps.add(key)
                        stations.add(station)
                        valid += 1

                    except (ValueError, TypeError, AttributeError) as exc:
                        errors.append(f"Row {index}: {exc}")

        result = {
            "stage": "FORECAST-1J6G49J",
            "technical_status": "FAIL" if errors else (
                "PASS" if valid else "NO_RECORDS"
            ),
            "valid_records": valid,
            "station_count": len(stations),
            "errors": errors,
            "scientific_status": "HOLD_UNTIL_INDEPENDENT_EVIDENCE"
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
