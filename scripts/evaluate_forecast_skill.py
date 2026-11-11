"""RainGuard research-only forecast skill gate.

Use independent hourly gauge observations and archived forecasts captured BEFORE
the event, never today's forecasts compared with old rainfall or annual maxima.
No score is published until provenance, space/time alignment, and sample thresholds
pass. This does not validate flood warnings or road safety.
"""
from __future__ import annotations

import argparse
import csv
import json
import math
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path


def parse_utc(value: str) -> datetime:
    if not value:
        raise ValueError("MISSING_TIMESTAMP")
    date = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if date.tzinfo is None:
        raise ValueError("NAIVE_TIMESTAMP")
    return date.astimezone(timezone.utc)


def number(value: str, minimum: float, maximum: float) -> float:
    if value is None or str(value).strip() == "":
        raise ValueError("MISSING_NUMBER")
    result = float(value)
    if not math.isfinite(result) or not minimum <= result <= maximum:
        raise ValueError("INVALID_NUMBER")
    return result


def yes(value: str) -> bool:
    return str(value).strip().upper() in {"YES", "TRUE", "1"}


def distance_km(lat1, lon1, lat2, lon2):
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = phi2 - phi1
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 6371.0 * 2 * math.atan2(math.sqrt(a), math.sqrt(max(0.0, 1 - a)))


def evaluate(forecasts, observations, minimum_samples=30, max_distance_km=5.0):
    indexed = defaultdict(list)
    for observation in observations:
        indexed[observation.get("observation_id", "")].append(observation)

    accepted = defaultdict(list)
    rejected = defaultdict(int)
    seen = set()
    providers = set()
    for row in forecasts:
        provider = (row.get("provider") or "").strip()
        if not provider:
            rejected["MISSING_PROVIDER"] += 1
            continue
        providers.add(provider)
        try:
            observation_id = row.get("observation_id", "")
            if len(indexed.get(observation_id, [])) != 1:
                raise ValueError("UNIQUE_OBSERVATION_REQUIRED")
            obs = indexed[observation_id][0]
            if not all(yes(obs.get(field, "")) for field in (
                "original_record_verified", "coordinates_verified",
                "interval_verified", "independent_observation"
            )):
                raise ValueError("UNVERIFIED_OBSERVATION")
            if not obs.get("source_url", "").startswith("https://"):
                raise ValueError("MISSING_SOURCE_URL")
            if (row.get("city", "").strip().casefold() != obs.get("city", "").strip().casefold()):
                raise ValueError("CITY_MISMATCH")

            issue = parse_utc(row["issued_at_utc"])
            start = parse_utc(row["valid_start_utc"])
            end = parse_utc(row["valid_end_utc"])
            observed_start = parse_utc(obs["start_utc"])
            observed_end = parse_utc(obs["end_utc"])
            if not issue < start:
                raise ValueError("FORECAST_NOT_ISSUED_BEFORE_EVENT")
            if start != observed_start or end != observed_end:
                raise ValueError("TIME_WINDOW_MISMATCH")
            hours = number(row.get("horizon_hours"), 1, 240)
            if abs((end - start).total_seconds() / 3600 - hours) > 0.001:
                raise ValueError("HORIZON_MISMATCH")

            flat = number(row["latitude"], -90, 90)
            flon = number(row["longitude"], -180, 180)
            olat = number(obs["latitude"], -90, 90)
            olon = number(obs["longitude"], -180, 180)
            if distance_km(flat, flon, olat, olon) > max_distance_km:
                raise ValueError("SPATIAL_MISMATCH")
            actual = number(obs["observed_rain_mm"], 0, 10000)
            prediction = number(row["predicted_rain_mm"], 0, 10000)
            probability = number(row["predicted_probability_pct"], 0, 100) / 100
            key = (provider, observation_id, start, end)
            if key in seen:
                raise ValueError("DUPLICATE_FORECAST")
            seen.add(key)
            accepted[provider].append((prediction, actual, probability))
        except (ValueError, KeyError, TypeError, OverflowError) as exc:
            rejected[str(exc) if str(exc) else "INVALID_ROW"] += 1

    results = {}
    for provider in sorted(providers):
        records = accepted[provider]
        n = len(records)
        result = {"status": "INSUFFICIENT_VERIFIED_SAMPLES",
                  "verified_samples": n, "required_samples": minimum_samples}
        if n >= minimum_samples:
            errors = [predicted - observed for predicted, observed, _ in records]
            threshold = 0.1  # event rain >= 0.1 mm over matched interval
            brier = sum((p - float(observed >= threshold)) ** 2 for _, observed, p in records) / n
            hits = sum(p >= 0.5 and observed >= threshold for _, observed, p in records)
            misses = sum(p < 0.5 and observed >= threshold for _, observed, p in records)
            false_alarms = sum(p >= 0.5 and observed < threshold for _, observed, p in records)
            result.update({
                "status": "VERIFIED_SAMPLE_METRICS",
                "rainfall_mae_mm": round(sum(abs(x) for x in errors) / n, 4),
                "rainfall_bias_mm": round(sum(errors) / n, 4),
                "probability_brier_score": round(brier, 4),
                "probability_of_detection": round(hits / (hits + misses), 4) if hits + misses else None,
                "false_alarm_ratio": round(false_alarms / (hits + false_alarms), 4) if hits + false_alarms else None,
            })
        results[provider] = result

    return {
        "assessment": "RESEARCH_ONLY_NOT_A_FLOOD_WARNING",
        "comparison_basis": "independently verified site-and-interval-aligned gauges",
        "no_provider_rank_without_validation": True,
        "providers": results,
        "rejected_records": dict(sorted(rejected.items())),
    }


def read_csv(path):
    with open(path, newline="", encoding="utf-8-sig") as stream:
        return list(csv.DictReader(stream))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--forecasts", required=True)
    parser.add_argument("--observations", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--min-samples", type=int, default=30)
    args = parser.parse_args()
    if args.min_samples < 2:
        parser.error("--min-samples must be at least 2")
    result = evaluate(read_csv(args.forecasts), read_csv(args.observations),
                      minimum_samples=args.min_samples)
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    Path(args.output).write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
