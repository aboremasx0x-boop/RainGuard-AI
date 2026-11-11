#!/usr/bin/env python3
"""Independent, issue-time-aware verification for hourly rainfall forecasts.

Input: joined forecast/observation pairs explicitly reviewed by an analyst.
This tool does NOT turn ERA5 reanalysis into independent gauge truth.
No source accuracy/ranking is emitted without adequate verified samples.
"""
import argparse
import csv
import json
import math
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

PROVIDERS = {"open_meteo", "visual_crossing", "weatherapi"}
REQUIRED = (
    "forecast_id", "source", "city", "issued_at_utc", "valid_at_utc",
    "forecast_lat", "forecast_lon", "rain_probability_pct",
    "forecast_rain_mm", "station_id", "station_lat", "station_lon",
    "observation_at_utc", "observed_rain_mm", "observation_source",
    "observation_independent_verified", "station_coordinates_verified",
    "original_record_verified",
)
MIN_SAMPLES = 30
MIN_RAIN = 5
MIN_DRY = 5
MAX_DISTANCE_KM = 10.0
MAX_TIME_DIFFERENCE_MINUTES = 30
RAIN_THRESHOLD_MM = 0.1


def parse_time(value):
    if not value or not value.strip():
        raise ValueError("MISSING_TIME")
    date = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if date.tzinfo is None:
        raise ValueError("TIMEZONE_REQUIRED")
    return date.astimezone(timezone.utc)


def numeric(value, low=None, high=None):
    if value is None or not str(value).strip():
        raise ValueError("MISSING_NUMBER")
    result = float(value)
    if not math.isfinite(result) or low is not None and result < low or high is not None and result > high:
        raise ValueError("INVALID_NUMBER")
    return result


def km_distance(lat1, lon1, lat2, lon2):
    a1, a2 = math.radians(lat1), math.radians(lat2)
    dlat, dlon = a2-a1, math.radians(lon2-lon1)
    h = math.sin(dlat/2)**2 + math.cos(a1)*math.cos(a2)*math.sin(dlon/2)**2
    return 6371.0 * 2 * math.asin(math.sqrt(min(1, h)))


def validate(row):
    if row["source"].strip() not in PROVIDERS:
        raise ValueError("UNSUPPORTED_SOURCE")
    if any(row[f].strip().upper() != "YES" for f in (
        "observation_independent_verified", "station_coordinates_verified", "original_record_verified"
    )):
        raise ValueError("INDEPENDENT_STATION_EVIDENCE_NOT_VERIFIED")
    observation_source = row["observation_source"].strip().lower()
    if not observation_source or any(term in observation_source for term in ("era5", "reanalysis", "open-meteo", "forecast")):
        raise ValueError("MODEL_DATA_NOT_INDEPENDENT_GAUGE")
    if not row["station_id"].strip() or not row["forecast_id"].strip() or not row["city"].strip():
        raise ValueError("MISSING_ID_OR_CITY")
    issued, valid, observed = (parse_time(row[x]) for x in ("issued_at_utc", "valid_at_utc", "observation_at_utc"))
    lead = (valid-issued).total_seconds()/3600
    if lead < 1 or lead > 72:
        raise ValueError("FORECAST_LEAD_OUT_OF_RANGE")
    if abs((observed-valid).total_seconds()) > MAX_TIME_DIFFERENCE_MINUTES * 60:
        raise ValueError("OBSERVATION_TIME_MISMATCH")
    lat, lon, slat, slon = (
        numeric(row["forecast_lat"], -90, 90), numeric(row["forecast_lon"], -180, 180),
        numeric(row["station_lat"], -90, 90), numeric(row["station_lon"], -180, 180)
    )
    if km_distance(lat, lon, slat, slon) > MAX_DISTANCE_KM:
        raise ValueError("STATION_SPATIAL_MISMATCH")
    probability = numeric(row["rain_probability_pct"], 0, 100)
    forecast_mm = numeric(row["forecast_rain_mm"], 0)
    observed_mm = numeric(row["observed_rain_mm"], 0)
    return {
        "source": row["source"].strip(), "city": row["city"].strip(),
        "forecast_id": row["forecast_id"].strip(), "station_id": row["station_id"].strip(),
        "issued": issued, "valid": valid,
        "lead_hours": lead, "probability": probability/100,
        "forecast_mm": forecast_mm, "observed_mm": observed_mm,
    }


def evaluate(rows):
    rejected = defaultdict(int)
    groups = defaultdict(list)
    seen = set()
    for row in rows:
        try:
            record = validate(row)
            # Do not allow repeated same issued forecast to inflate accuracy.
            key = (record["source"], record["forecast_id"], record["station_id"], record["valid"])
            if key in seen:
                raise ValueError("DUPLICATE_FORECAST_STATION_TIME")
            seen.add(key)
            groups[(record["source"], record["city"])].append(record)
        except (ValueError, KeyError, OverflowError) as exc:
            rejected[str(exc)] += 1
    results = []
    for (source, city), group in sorted(groups.items()):
        rainy = sum(r["observed_mm"] >= RAIN_THRESHOLD_MM for r in group)
        dry = len(group)-rainy
        qualified = len(group) >= MIN_SAMPLES and rainy >= MIN_RAIN and dry >= MIN_DRY
        item = {"source": source, "city": city, "verified_samples": len(group),
                "rain_samples": rainy, "dry_samples": dry,
                "status": "VERIFIED_SAMPLE_METRICS" if qualified else "INSUFFICIENT_INDEPENDENT_SAMPLES",
                "accuracy_claim_allowed": qualified, "metrics": None}
        if qualified:
            brier = sum((r["probability"]-int(r["observed_mm"]>=RAIN_THRESHOLD_MM))**2 for r in group)/len(group)
            mae = sum(abs(r["forecast_mm"]-r["observed_mm"]) for r in group)/len(group)
            hits = sum(r["probability"]>=0.5 and r["observed_mm"]>=RAIN_THRESHOLD_MM for r in group)
            missed = sum(r["probability"]<0.5 and r["observed_mm"]>=RAIN_THRESHOLD_MM for r in group)
            false = sum(r["probability"]>=0.5 and r["observed_mm"]<RAIN_THRESHOLD_MM for r in group)
            item["metrics"] = {"brier_score": round(brier, 4), "rain_mm_mae": round(mae, 3),
                "probability_of_detection": round(hits/(hits+missed), 4) if hits+missed else None,
                "false_alarm_ratio": round(false/(hits+false), 4) if hits+false else None,
                "decision_threshold_probability": 0.5, "rain_event_threshold_mm": RAIN_THRESHOLD_MM}
        results.append(item)
    return {"status": "VERIFICATION_METRICS_AVAILABLE" if any(x["accuracy_claim_allowed"] for x in results)
            else "PENDING_INDEPENDENT_FORECAST_OBSERVATION_PAIRS",
            "independent_samples_only": True,
            "source_ranking_authorized": False,
            "operational_warning_approved": False,
            "minimum_samples_per_source_city": MIN_SAMPLES,
            "minimum_wet_and_dry_samples": MIN_RAIN,
            "accepted": sum(x["verified_samples"] for x in results),
            "rejected": dict(sorted(rejected.items())), "results": results,
            "note": "Metrics are diagnostics, not a flood or road-safety approval; weights remain unchanged."}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pairs", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    with args.pairs.open(encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        if not reader.fieldnames or any(field not in reader.fieldnames for field in REQUIRED):
            parser.error("Missing required columns: "+", ".join(REQUIRED))
        outcome = evaluate(reader)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(outcome, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    print(json.dumps({"status": outcome["status"], "accepted": outcome["accepted"],
                      "rejected": outcome["rejected"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
