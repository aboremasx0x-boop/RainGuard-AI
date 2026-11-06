
import csv
import json
import math
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

OFFICIAL = Path(
    "data/official_stations/rainfall_observations.csv"
)
ERA5 = Path(
    "data/official_stations/era5_comparison.csv"
)
OUTPUT = Path(
    "historical_validation/temporal_alignment_49q.json"
)

HOLD = "HOLD_UNTIL_INDEPENDENT_EVIDENCE"

def utc_time(value):
    dt = datetime.fromisoformat(
        value.strip().replace("Z", "+00:00")
    )
    if dt.tzinfo is None or dt.utcoffset() != timedelta(0):
        raise ValueError("Timestamp must be UTC")
    return dt.astimezone(timezone.utc)

def positive_interval(value):
    number = float(value)
    if not math.isfinite(number):
        raise ValueError("Non-finite interval")
    if number <= 0 or not number.is_integer():
        raise ValueError("Invalid interval minutes")
    return int(number)

def read_rows(path, required):
    with path.open(
        encoding="utf-8-sig", newline=""
    ) as file:
        reader = csv.DictReader(file)
        missing = required - set(reader.fieldnames or [])
        if missing:
            raise ValueError(
                f"{path}: missing columns {sorted(missing)}"
            )
        return list(reader)

def build_intervals(rows, source):
    intervals = {}
    by_station = defaultdict(list)

    for row in rows:
        station = row["station_id"].strip()
        if not station:
            raise ValueError(f"{source}: empty station ID")

        end = utc_time(row["timestamp_utc"])
        minutes = positive_interval(
            row["observation_interval_minutes"]
        )
        start = end - timedelta(minutes=minutes)

        key = (station, start, end)

        if key in intervals:
            raise ValueError(
                f"{source}: duplicate interval for {station}"
            )

        if source == "OFFICIAL":
            if row["rainfall_measurement_type"].strip() != "INTERVAL_TOTAL":
                raise ValueError("Unsupported official measurement type")
            if row["rainfall_unit"].strip() != "mm":
                raise ValueError("Unsupported official rainfall unit")

        intervals[key] = {
            "station_id": station,
            "start": start,
            "end": end,
            "minutes": minutes,
        }
        by_station[station].append((start, end))

    for station, periods in by_station.items():
        periods.sort()
        for previous, current in zip(periods, periods[1:]):
            if current[0] < previous[1]:
                raise ValueError(
                    f"{source}: overlapping intervals for {station}"
                )

    return intervals, by_station

def gap_count(by_station):
    gaps = 0
    for periods in by_station.values():
        for previous, current in zip(periods, periods[1:]):
            if current[0] > previous[1]:
                gaps += 1
    return gaps

def main():
    result = {
        "stage": "FORECAST-1J6G49Q",
        "technical_status": "WAITING_FOR_COMPARISON_DATA",
        "official_intervals": 0,
        "era5_intervals": 0,
        "matched_intervals": 0,
        "official_match_percentage": None,
        "official_gap_count": 0,
        "era5_gap_count": 0,
        "interval_distribution_minutes": {},
        "errors": [],
        "calibration_eligible": 0,
        "scientific_status": HOLD,
    }

    if OFFICIAL.exists() and ERA5.exists():
        try:
            official_rows = read_rows(
                OFFICIAL,
                {
                    "station_id", "timestamp_utc",
                    "observation_interval_minutes",
                    "rainfall_measurement_type",
                    "rainfall_unit",
                },
            )

            era5_rows = read_rows(
                ERA5,
                {
                    "station_id", "timestamp_utc",
                    "observation_interval_minutes",
                },
            )

            official, official_stations = build_intervals(
                official_rows, "OFFICIAL"
            )
            era5, era5_stations = build_intervals(
                era5_rows, "ERA5"
            )

            matched = set(official) & set(era5)
            counts = Counter(
                item["minutes"] for item in official.values()
            )

            result.update({
                "official_intervals": len(official),
                "era5_intervals": len(era5),
                "matched_intervals": len(matched),
                "official_match_percentage": (
                    round(100 * len(matched) / len(official), 2)
                    if official else None
                ),
                "official_gap_count": gap_count(
                    official_stations
                ),
                "era5_gap_count": gap_count(
                    era5_stations
                ),
                "interval_distribution_minutes": {
                    str(k): v for k, v in sorted(counts.items())
                },
            })

            if not official or not era5:
                result["technical_status"] = "NO_DATA"
            elif not matched:
                result["technical_status"] = "NO_MATCHES"
            elif (
                len(matched) < len(official)
                or result["official_gap_count"] > 0
                or result["era5_gap_count"] > 0
            ):
                result["technical_status"] = "QUALITY_WARNINGS"
            else:
                result["technical_status"] = "PASS"

        except (
            ValueError, TypeError, KeyError,
            OverflowError, csv.Error
        ) as exc:
            result["technical_status"] = "FAIL"
            result["errors"].append(str(exc))

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(
        json.dumps(result, indent=2),
        encoding="utf-8",
    )

    print(json.dumps(result, indent=2))

    if result["technical_status"] == "FAIL":
        raise SystemExit(1)

if __name__ == "__main__":
    main()
