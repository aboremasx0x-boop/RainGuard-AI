
import csv
import json
import math
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

OFFICIAL = Path("data/official_stations/rainfall_observations.csv")
ERA5 = Path("data/official_stations/era5_comparison.csv")
OUTPUT = Path("historical_validation/official_era5_49n_summary.json")

MAX_DISTANCE_KM = 15.0

OFFICIAL_FIELDS = {
    "station_id", "latitude", "longitude",
    "timestamp_utc", "rainfall_mm",
    "observation_interval_minutes",
    "rainfall_measurement_type", "rainfall_unit",
    "source_agency", "source_reference",
}

ERA5_FIELDS = {
    "station_id", "era5_latitude", "era5_longitude",
    "timestamp_utc", "era5_rainfall_mm",
    "observation_interval_minutes",
}

def number(value, name):
    result = float(value)
    if not math.isfinite(result):
        raise ValueError(f"{name}: non-finite number")
    return result

def parse_utc(value):
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if dt.tzinfo is None or dt.utcoffset() != timedelta(0):
        raise ValueError("Timestamp must be UTC")
    return dt.astimezone(timezone.utc)

def distance_km(lat1, lon1, lat2, lon2):
    radius = 6371.0088
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = (
        math.sin(dp / 2) ** 2
        + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    )
    return 2 * radius * math.asin(min(1, math.sqrt(a)))

def read_csv(path, required):
    with path.open(encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        missing = required - set(reader.fieldnames or [])
        if missing:
            raise ValueError(
                f"{path}: missing columns {sorted(missing)}"
            )
        return list(reader)

def validate_coords(lat, lon):
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise ValueError("Invalid coordinates")

def main():
    errors = []
    matches = []
    station_stats = {}

    if not OFFICIAL.exists() or not ERA5.exists():
        result = {
            "stage": "FORECAST-1J6G49P",
            "technical_status": "WAITING_FOR_COMPARISON_DATA",
            "matched_records": 0,
            "calibration_eligible": 0,
            "scientific_status": "HOLD_UNTIL_INDEPENDENT_EVIDENCE",
        }
    else:
        try:
            observations = read_csv(OFFICIAL, OFFICIAL_FIELDS)
            reanalysis = read_csv(ERA5, ERA5_FIELDS)

            era5_index = {}
            official_keys = set()

            for row in reanalysis:
                station = row["station_id"].strip()
                timestamp = parse_utc(row["timestamp_utc"].strip())
                interval = int(row["observation_interval_minutes"])
                rain = number(row["era5_rainfall_mm"], "ERA5 rainfall")
                lat = number(row["era5_latitude"], "ERA5 latitude")
                lon = number(row["era5_longitude"], "ERA5 longitude")

                if not station or interval <= 0 or rain < 0:
                    raise ValueError("Invalid ERA5 record")
                validate_coords(lat, lon)

                key = (station, timestamp, interval)
                if key in era5_index:
                    raise ValueError("Duplicate ERA5 record")

                era5_index[key] = (rain, lat, lon)

            for row in observations:
                station = row["station_id"].strip()
                timestamp = parse_utc(row["timestamp_utc"].strip())
                interval = int(row["observation_interval_minutes"])
                rain = number(row["rainfall_mm"], "Official rainfall")
                lat = number(row["latitude"], "Official latitude")
                lon = number(row["longitude"], "Official longitude")

                if not station or interval <= 0 or rain < 0:
                    raise ValueError("Invalid official observation")
                validate_coords(lat, lon)

                if row["rainfall_measurement_type"].strip() != "INTERVAL_TOTAL":
                    raise ValueError("Unsupported measurement type")
                if row["rainfall_unit"].strip() != "mm":
                    raise ValueError("Unsupported rainfall unit")
                if not row["source_agency"].strip():
                    raise ValueError("Missing source agency")
                if not row["source_reference"].strip():
                    raise ValueError("Missing source reference")

                key = (station, timestamp, interval)

                if key in official_keys:
                    raise ValueError("Duplicate official observation")

                official_keys.add(key)

                if key not in era5_index:
                    continue

                era_rain, era_lat, era_lon = era5_index[key]
                distance = distance_km(lat, lon, era_lat, era_lon)

                if distance > MAX_DISTANCE_KM:
                    continue

                matches.append({
                    "station_id": station,
                    "observed_mm": rain,
                    "era5_mm": era_rain,
                    "difference_mm": era_rain - rain,
                    "distance_km": distance,
                })

            grouped = defaultdict(list)

            for match in matches:
                grouped[match["station_id"]].append(match)

            for station, values in grouped.items():
                differences = [
                    value["difference_mm"] for value in values
                ]
                n = len(differences)

                station_stats[station] = {
                    "matched_records": n,
                    "mae_mm": sum(abs(x) for x in differences) / n,
                    "rmse_mm": math.sqrt(
                        sum(x * x for x in differences) / n
                    ),
                    "bias_mm": sum(differences) / n,
                    "max_distance_km": max(
                        value["distance_km"] for value in values
                    ),
                }

        except (ValueError, TypeError, KeyError, OverflowError) as exc:
            errors.append(str(exc))

        # Never publish partial metrics after a validation error.
        if errors:
            matches = []
            station_stats = {}

        result = {
            "stage": "FORECAST-1J6G49P",
            "technical_status": (
                "FAIL" if errors else
                "PASS" if matches else "NO_MATCHES"
            ),
            "matched_records": len(matches),
            "station_count": len(station_stats),
            "stations": station_stats,
            "errors": errors,
            "max_distance_km": MAX_DISTANCE_KM,
            "calibration_eligible": 0,
            "scientific_status": "HOLD_UNTIL_INDEPENDENT_EVIDENCE",
        }

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
