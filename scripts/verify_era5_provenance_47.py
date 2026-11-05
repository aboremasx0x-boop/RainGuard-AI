
#!/usr/bin/env python3
"""RainGuard 47: ERA5 diagnostic verification; no calibration."""
import csv
import datetime as dt
import hashlib
import json
import math
import pathlib
import urllib.parse
import urllib.request

OUT = pathlib.Path("historical_validation")
OUT.mkdir(parents=True, exist_ok=True)

EVENTS = [
    ("JEDDAH_2009", "2009-11-25", 21.5433, 39.1728),
    ("JEDDAH_2011", "2011-01-26", 21.5433, 39.1728),
    ("JEDDAH_2022", "2022-11-24", 21.5433, 39.1728),
]

URL = "https://archive-api.open-meteo.com/v1/archive"
LOCAL_CSV = pathlib.Path("historical_rainfall/hourly_rainfall.csv")

def as_float(value):
    try:
        number = float(value)
        return number if math.isfinite(number) else None
    except (TypeError, ValueError):
        return None

stored = {}
if LOCAL_CSV.exists():
    with LOCAL_CSV.open(encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            key = (row.get("event_id"), row.get("timestamp_local"))
            stored[key] = as_float(row.get("precipitation_mm"))

records = []

for event_id, date, lat, lon in EVENTS:
    day = dt.date.fromisoformat(date)
    params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": str(day - dt.timedelta(days=4)),
        "end_date": str(day + dt.timedelta(days=1)),
        "hourly": "precipitation",
        "timezone": "Asia/Riyadh",
        "models": "era5",
    }
    url = URL + "?" + urllib.parse.urlencode(params)

    record = {
        "event_id": event_id,
        "reference_date": date,
        "requested_model": "era5",
        "requested_latitude": lat,
        "requested_longitude": lon,
        "returned_latitude": "",
        "returned_longitude": "",
        "returned_elevation_m": "",
        "returned_timezone": "",
        "returned_utc_offset_seconds": "",
        "returned_hourly_units": "",
        "returned_hourly_count": 0,
        "numeric_hourly_count": 0,
        "stored_comparable_count": 0,
        "stored_mismatch_count": 0,
        "max_abs_difference_mm": "",
        "response_sha256": "",
        "api_request_url": url,
        "api_request_success": False,
        "model_identity_independently_verified": False,
        "grid_cell_independently_verified": False,
        "calibration_eligible": False,
        "error": "",
    }

    try:
        request = urllib.request.Request(
            url, headers={"User-Agent": "RainGuardAI-Research/47"}
        )
        with urllib.request.urlopen(request, timeout=90) as response:
            raw = response.read()

        payload = json.loads(raw)
        hourly = payload.get("hourly") or {}
        times = hourly.get("time") or []
        values = hourly.get("precipitation") or []

        if not times or len(times) != len(values):
            raise ValueError("Missing or mismatched hourly arrays")

        record.update({
            "returned_latitude": payload.get("latitude", ""),
            "returned_longitude": payload.get("longitude", ""),
            "returned_elevation_m": payload.get("elevation", ""),
            "returned_timezone": payload.get("timezone", ""),
            "returned_utc_offset_seconds": payload.get(
                "utc_offset_seconds", ""
            ),
            "returned_hourly_units": json.dumps(
                payload.get("hourly_units", {}),
                ensure_ascii=False
            ),
            "returned_hourly_count": len(times),
            "numeric_hourly_count": sum(
                as_float(v) is not None for v in values
            ),
            "response_sha256": hashlib.sha256(raw).hexdigest(),
            "api_request_success": True,
        })

        differences = []
        for timestamp, value in zip(times, values):
            key = (event_id, timestamp)
            new_value = as_float(value)
            old_value = stored.get(key)

            if old_value is not None and new_value is not None:
                differences.append(abs(old_value - new_value))

        record["stored_comparable_count"] = len(differences)
        record["stored_mismatch_count"] = sum(
            difference > 1e-6 for difference in differences
        )
        record["max_abs_difference_mm"] = (
            max(differences) if differences else ""
        )

    except Exception as exc:
        record["error"] = str(exc)

    records.append(record)

output = OUT / "era5_provenance_47.csv"

with output.open("w", encoding="utf-8-sig", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=list(records[0]))
    writer.writeheader()
    writer.writerows(records)

summary = {
    "events": len(records),
    "api_requests_successful": sum(
        r["api_request_success"] for r in records
    ),
    "events_with_144_numeric_hours": sum(
        r["numeric_hourly_count"] == 144 for r in records
    ),
    "model_identity_independently_verified": 0,
    "grid_cell_independently_verified": 0,
    "calibration_eligible": 0,
    "status": "HOLD_UNTIL_INDEPENDENT_EVIDENCE",
    "note": "API metadata are diagnostic, not independent validation.",
}

(OUT / "era5_provenance_47_summary.json").write_text(
    json.dumps(summary, ensure_ascii=False, indent=2),
    encoding="utf-8"
)

print(json.dumps(summary, ensure_ascii=False))

if any(not r["api_request_success"] for r in records):
    raise SystemExit(
        "Open-Meteo request failed; inspect era5_provenance_47.csv"
    )
