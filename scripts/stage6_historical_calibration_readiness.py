#!/usr/bin/env python3
"""RainGuard stage 6: conservative Jeddah historic calibration readiness.

A historical flood report, daily station maximum, or ERA5 reanalysis is NOT
an archived issued weather forecast. This gate checks artifact provenance
and leaves historical forecast skill UNMEASURABLE until real issue-time
forecast archives and independent, hourly gauge records are confirmed.
"""
import argparse
import csv
import json
from pathlib import Path

EVENTS = {"JEDDAH_2009": "2009-11-25", "JEDDAH_2011": "2011-01-26", "JEDDAH_2022": "2022-11-24"}
REQUIRED_GAUGE = (
    "station_id", "latitude", "longitude", "observation_start_utc",
    "observation_end_utc", "observed_rainfall_mm", "observation_interval",
    "observation_source",
)
FLAG_FIELDS = ("coordinates_verified", "original_record_verified", "calibration_eligible")


def yes(x):
    return str(x).strip().upper() in ("YES", "TRUE")


def csv_rows(path):
    with path.open(encoding="utf-8-sig", newline="") as stream:
        return list(csv.DictReader(stream))


def review(root):
    sources = root / "data" / "calibration"
    stations = csv_rows(sources / "rainguard_49h_station_verification.csv")
    events = csv_rows(sources / "rainguard_43_independent_event_evidence.csv")
    spatial = csv_rows(sources / "rainguard_46_spatiotemporal_evidence_register.csv")
    windows = csv_rows(root / "historical_rainfall" / "rainfall_windows.csv")
    hourly = csv_rows(root / "historical_rainfall" / "hourly_rainfall.csv")
    indexed_events = {x.get("event_id"): x for x in events}
    indexed_spatial = {x.get("event_id"): x for x in spatial}
    indexed_windows = {x.get("event_id"): x for x in windows}
    reports = []
    for event_id, date in EVENTS.items():
        gauge = [s for s in stations if s.get("event_id") == event_id]
        event = indexed_events.get(event_id, {})
        location = indexed_spatial.get(event_id, {})
        window = indexed_windows.get(event_id, {})
        historical = [r for r in hourly if r.get("event_id") == event_id]
        documented = yes(event.get("flood_documented")) and bool(event.get("source_url"))
        independent_gauge = any(
            all(str(s.get(k, "")).strip() for k in REQUIRED_GAUGE)
            and all(yes(s.get(k)) for k in FLAG_FIELDS)
            and "era5" not in str(s.get("observation_source", "")).lower()
            and "reanalysis" not in str(s.get("observation_source", "")).lower()
            for s in gauge
        )
        location_match = yes(location.get("spatial_match_verified")) and yes(location.get("hourly_match_verified"))
        model_archive = root / "data" / "calibration" / "issued_forecast_archives" / (event_id + ".csv")
        # Even if an archive file appears, it must undergo per-record validation
        # against immutable source issue times. File presence is never proof.
        issued_archive = False
        observed_event = len(historical) > 0
        era5_only = bool(historical) and all("era5" in str(r.get("source", "")).lower() for r in historical)
        missing = []
        if not documented:
            missing.append("DOCUMENTED_EVENT")
        if not independent_gauge:
            missing.append("VERIFIED_INDEPENDENT_GAUGE_TIMESERIES")
        if not location_match:
            missing.append("VERIFIED_STATION_EVENT_SPATIAL_HOURLY_MATCH")
        if not issued_archive:
            missing.append("ORIGINAL_PRE_EVENT_ISSUED_FORECAST_ARCHIVE")
        reports.append({
            "event_id": event_id, "event_date": date,
            "event_documented": documented,
            "station_records": len(gauge),
            "independent_station_timeseries_verified": independent_gauge,
            "spatial_hourly_match_verified": location_match,
            "archived_issued_forecasts_verified": issued_archive,
            "issued_archive_candidate_file_present": model_archive.exists(),
            "era5_reference_rows": len(historical) if era5_only else 0,
            "era5_reference_only_not_forecast": era5_only,
            "historical_rain_window_source": window.get("source") if window else None,
            "forecast_skill_status": "UNMEASURABLE_MISSING_INDEPENDENT_PAIRED_ARCHIVES",
            "calibration_approved": False,
            "missing_requirements": missing,
        })
    return {
        "stage": "SIX_HISTORIC_EVIDENCE_READINESS",
        "status": "HOLD_UNTIL_INDEPENDENT_FORECAST_AND_GAUGE_EVIDENCE",
        "historical_events": len(reports),
        "historical_forecast_skill_available": False,
        "source_weights_update_authorized": False,
        "operational_road_warning_approved": False,
        "provenance_warning": "Historical ERA5 after-the-fact reanalysis and event newspaper reports cannot establish previously issued forecast skill.",
        "events": reports,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path("."))
    parser.add_argument("--output", type=Path, default=Path("historical_validation/stage6_calibration_readiness.json"))
    args = parser.parse_args()
    outcome = review(args.root)
    output = args.output
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(outcome, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"status": outcome["status"], "events": len(outcome["events"]),
                      "calibration_approved": False}, ensure_ascii=False))


if __name__ == "__main__":
    main()
