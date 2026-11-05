
import csv
import json
import math
import subprocess
import sys
import tempfile
from pathlib import Path

ENGINE = Path(__file__).resolve().with_name(
    "match_official_era5_49n.py"
)

OFFICIAL_FIELDS = [
    "station_id", "latitude", "longitude",
    "timestamp_utc", "rainfall_mm",
    "observation_interval_minutes",
    "rainfall_measurement_type", "rainfall_unit",
    "source_agency", "source_reference",
]

ERA5_FIELDS = [
    "station_id", "era5_latitude", "era5_longitude",
    "timestamp_utc", "era5_rainfall_mm",
    "observation_interval_minutes",
]

def official(**changes):
    row = {
        "station_id": "TEST_STATION",
        "latitude": "21.5433",
        "longitude": "39.1728",
        "timestamp_utc": "2022-11-24T08:00:00Z",
        "rainfall_mm": "10",
        "observation_interval_minutes": "60",
        "rainfall_measurement_type": "INTERVAL_TOTAL",
        "rainfall_unit": "mm",
        "source_agency": "SYNTHETIC_TEST",
        "source_reference": "NOT_REAL_DATA",
    }
    row.update(changes)
    return row

def era5(**changes):
    row = {
        "station_id": "TEST_STATION",
        "era5_latitude": "21.5000",
        "era5_longitude": "39.2500",
        "timestamp_utc": "2022-11-24T08:00:00Z",
        "era5_rainfall_mm": "12",
        "observation_interval_minutes": "60",
    }
    row.update(changes)
    return row

def write_csv(path, fields, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)

def run_case(name, observations, reanalysis,
             expected_status, expected_matches,
             expected_mae=None):
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)

        write_csv(
            root / "data/official_stations/rainfall_observations.csv",
            OFFICIAL_FIELDS,
            observations,
        )
        write_csv(
            root / "data/official_stations/era5_comparison.csv",
            ERA5_FIELDS,
            reanalysis,
        )

        process = subprocess.run(
            [sys.executable, str(ENGINE)],
            cwd=root,
            capture_output=True,
            text=True,
            check=False,
        )

        report_path = (
            root /
            "historical_validation/official_era5_49n_summary.json"
        )

        if not report_path.exists():
            return {
                "name": name,
                "passed": False,
                "reason": "Report not generated",
                "stderr": process.stderr,
            }

        report = json.loads(
            report_path.read_text(encoding="utf-8")
        )

        status_ok = (
            report.get("technical_status") == expected_status
        )

        count_ok = (
            report.get("matched_records") == expected_matches
        )

        scientific_ok = (
            report.get("calibration_eligible") == 0
            and report.get("scientific_status")
            == "HOLD_UNTIL_INDEPENDENT_EVIDENCE"
        )

        exit_ok = process.returncode == (
            1 if expected_status == "FAIL" else 0
        )

        metrics_ok = True

        if expected_mae is not None:
            stats = report.get("stations", {}).get(
                "TEST_STATION", {}
            )

            metrics_ok = all([
                math.isclose(
                    stats.get("mae_mm", -999),
                    expected_mae,
                    abs_tol=1e-6,
                ),
                math.isclose(
                    stats.get("rmse_mm", -999),
                    expected_mae,
                    abs_tol=1e-6,
                ),
                math.isclose(
                    stats.get("bias_mm", -999),
                    expected_mae,
                    abs_tol=1e-6,
                ),
            ])

        return {
            "name": name,
            "passed": all([
                status_ok,
                count_ok,
                scientific_ok,
                exit_ok,
                metrics_ok,
            ]),
            "expected_status": expected_status,
            "actual_status": report.get("technical_status"),
            "expected_matches": expected_matches,
            "actual_matches": report.get("matched_records"),
            "metrics_ok": metrics_ok,
            "errors": report.get("errors", []),
        }

def main():
    cases = [
        (
            "valid_temporal_spatial_match",
            [official()],
            [era5()],
            "PASS", 1, 2.0,
        ),
        (
            "different_timestamp",
            [official()],
            [era5(timestamp_utc="2022-11-24T09:00:00Z")],
            "NO_MATCHES", 0, None,
        ),
        (
            "distance_exceeds_limit",
            [official()],
            [era5(
                era5_latitude="22.0000",
                era5_longitude="40.0000"
            )],
            "NO_MATCHES", 0, None,
        ),
        (
            "duplicate_era5",
            [official()],
            [era5(), era5()],
            "FAIL", 0, None,
        ),
        (
            "different_interval",
            [official()],
            [era5(observation_interval_minutes="30")],
            "NO_MATCHES", 0, None,
        ),
        (
            "invalid_observation_unit",
            [official(rainfall_unit="inches")],
            [era5()],
            "FAIL", 0, None,
        ),
    ]

    results = [
        run_case(*case) for case in cases
    ]

    passed = sum(
        result["passed"] for result in results
    )

    summary = {
        "stage": "FORECAST-1J6G49O",
        "data_type": "SYNTHETIC_ONLY",
        "total_tests": len(results),
        "passed_tests": passed,
        "failed_tests": len(results) - passed,
        "technical_status": (
            "PASS" if passed == len(results) else "FAIL"
        ),
        "scientific_status":
            "HOLD_UNTIL_INDEPENDENT_EVIDENCE",
        "results": results,
    }

    output = Path(
        "historical_validation/official_era5_49o_tests.json"
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(summary, indent=2),
        encoding="utf-8",
    )

    print(json.dumps(summary, indent=2))

    if passed != len(results):
        raise SystemExit(1)

if __name__ == "__main__":
    main()
