
import csv
import json
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

SOURCE = Path("data/official_stations/rainfall_observations.csv")
OUTPUT = Path(
    "historical_validation/rainfall_timeseries_49l_summary.json"
)

REQUIRED = {
    "station_id",
    "timestamp_utc",
    "rainfall_mm",
    "observation_interval_minutes",
    "rainfall_measurement_type",
    "rainfall_unit",
}

def parse_utc(value):
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if dt.tzinfo is None or dt.utcoffset() != timedelta(0):
        raise ValueError("Timestamp must be UTC")
    return dt.astimezone(timezone.utc)

def main():
    errors = []
    warnings = []
    stations = defaultdict(list)
    records = 0

    if not SOURCE.exists():
        result = {
            "stage": "FORECAST-1J6G49L",
            "technical_status": "WAITING_FOR_OFFICIAL_DATA",
            "records": 0,
            "scientific_status": "HOLD_UNTIL_INDEPENDENT_EVIDENCE",
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
                        if not station:
                            raise ValueError("Missing station ID")

                        dt = parse_utc(row["timestamp_utc"].strip())
                        rain = float(row["rainfall_mm"])
                        interval = int(
                            row["observation_interval_minutes"]
                        )
                        kind = row["rainfall_measurement_type"].strip()
                        unit = row["rainfall_unit"].strip()

                        if rain < 0:
                            raise ValueError("Negative rainfall")

                        if interval <= 0:
                            raise ValueError("Invalid interval")

                        if kind != "INTERVAL_TOTAL":
                            raise ValueError(
                                "Only INTERVAL_TOTAL is supported"
                            )

                        if unit != "mm":
                            raise ValueError("Rainfall unit must be mm")

                        stations[station].append((dt, interval))
                        records += 1

                    except (ValueError, TypeError, AttributeError) as exc:
                        errors.append(f"Row {index}: {exc}")

        station_results = {}

        for station, values in stations.items():
            values.sort(key=lambda x: x[0])
            duplicates = 0
            missing_intervals = 0
            irregular_intervals = 0

            seen = set()

            for dt, interval in values:
                if dt in seen:
                    duplicates += 1
                seen.add(dt)

            for previous, current in zip(values, values[1:]):
                prev_time, prev_interval = previous
                curr_time, curr_interval = current

                if curr_interval != prev_interval:
                    irregular_intervals += 1
                    continue

                delta_minutes = (
                    curr_time - prev_time
                ).total_seconds() / 60

                if delta_minutes > prev_interval:
                    gap = delta_minutes / prev_interval - 1
                    if gap.is_integer():
                        missing_intervals += int(gap)
                    else:
                        irregular_intervals += 1
                elif 0 < delta_minutes < prev_interval:
                    irregular_intervals += 1

            station_results[station] = {
                "records": len(values),
                "duplicates": duplicates,
                "missing_intervals": missing_intervals,
                "irregular_intervals": irregular_intervals,
            }

            if duplicates or missing_intervals or irregular_intervals:
                warnings.append(
                    f"{station}: temporal quality issues detected"
                )

        result = {
            "stage": "FORECAST-1J6G49L",
            "technical_status": (
                "FAIL" if errors else
                "QUALITY_WARNINGS" if warnings else
                "PASS" if records else "NO_RECORDS"
            ),
            "records": records,
            "station_count": len(stations),
            "stations": station_results,
            "errors": errors,
            "warnings": warnings,
            "scientific_status": "HOLD_UNTIL_INDEPENDENT_EVIDENCE",
        }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(
        json.dumps(result, indent=2),
        encoding="utf-8",
    )

    print(json.dumps(result, indent=2))

    if errors:
        raise SystemExit(1)

if __name__ == "__main__":
    main()
