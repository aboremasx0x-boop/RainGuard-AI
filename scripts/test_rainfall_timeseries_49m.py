
import csv
import json
import subprocess
import sys
import tempfile
from pathlib import Path

SCRIPT = Path(
    "scripts/verify_rainfall_timeseries_49l.py"
).resolve()

FIELDS = [
    "station_id",
    "timestamp_utc",
    "rainfall_mm",
    "observation_interval_minutes",
    "rainfall_measurement_type",
    "rainfall_unit",
]

def observation(hour, **changes):
    row = {
        "station_id": "SYNTHETIC_STATION",
        "timestamp_utc": f"2022-11-24T{hour:02d}:00:00Z",
        "rainfall_mm": "5.0",
        "observation_interval_minutes": "60",
        "rainfall_measurement_type": "INTERVAL_TOTAL",
        "rainfall_unit": "mm",
    }
    row.update(changes)
    return row

def run_case(name, rows, expected_status, expected_metrics=None):
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        source = (
            root /
            "data/official_stations/rainfall_observations.csv"
        )
        source.parent.mkdir(parents=True, exist_ok=True)

        with source.open(
            "w", encoding="utf-8", newline=""
        ) as file:
            writer = csv.DictWriter(file, fieldnames=FIELDS)
            writer.writeheader()
            writer.writerows(rows)

        process = subprocess.run(
            [sys.executable, str(SCRIPT)],
            cwd=root,
            capture_output=True,
            text=True,
            check=False,
        )

        report_path = (
            root /
            "historical_validation/"
            "rainfall_timeseries_49l_summary.json"
        )

        if not report_path.exists():
            return {
                "case": name,
                "passed": False,
                "reason": "Report not generated",
                "stderr": process.stderr,
            }

        report = json.loads(
            report_path.read_text(encoding="utf-8")
        )

        station = report.get("stations", {}).get(
            "SYNTHETIC_STATION", {}
        )

        expected_metrics = expected_metrics or {}

        metrics_ok = all(
            station.get(key) == value
            for key, value in expected_metrics.items()
        )

        expected_exit = (
            1 if expected_status == "FAIL" else 0
        )

        passed = (
            report.get("technical_status") == expected_status
            and process.returncode == expected_exit
            and metrics_ok
            and report.get("scientific_status")
            == "HOLD_UNTIL_INDEPENDENT_EVIDENCE"
        )

        return {
            "case": name,
            "passed": passed,
            "expected_status": expected_status,
            "actual_status": report.get("technical_status"),
            "expected_metrics": expected_metrics,
            "actual_metrics": station,
            "errors": report.get("errors", []),
            "warnings": report.get("warnings", []),
        }

def main():
    regular = [
        observation(8),
        observation(9),
        observation(10),
    ]

    missing_hour = [
        observation(8),
        observation(10),
    ]

    duplicate = [
        observation(8),
        observation(8),
        observation(9),
    ]

    irregular = [
        observation(8),
        observation(9, observation_interval_minutes="30"),
        observation(10),
    ]

    invalid_unit = [
        observation(8, rainfall_unit="inches")
    ]

    unsupported_type = [
        observation(
            8,
            rainfall_measurement_type="CUMULATIVE"
        )
    ]

    cases = [
        (
            "regular_hourly",
            regular,
            "PASS",
            {
                "duplicates": 0,
                "missing_intervals": 0,
                "irregular_intervals": 0,
            },
        ),
        (
            "missing_hour",
            missing_hour,
            "QUALITY_WARNINGS",
            {"missing_intervals": 1},
        ),
        (
            "duplicate_timestamp",
            duplicate,
            "QUALITY_WARNINGS",
            {"duplicates": 1},
        ),
        (
            "irregular_interval",
            irregular,
            "QUALITY_WARNINGS",
            {"irregular_intervals": 2},
        ),
        (
            "invalid_unit",
            invalid_unit,
            "FAIL",
            {},
        ),
        (
            "unsupported_measurement_type",
            unsupported_type,
            "FAIL",
            {},
        ),
    ]

    results = [
        run_case(name, rows, status, metrics)
        for name, rows, status, metrics in cases
    ]

    passed = sum(
        result["passed"] for result in results
    )

    summary = {
        "stage": "FORECAST-1J6G49M",
        "test_data": "SYNTHETIC_ONLY",
        "tests_total": len(results),
        "tests_passed": passed,
        "technical_status": (
            "PASS" if passed == len(results) else "FAIL"
        ),
        "scientific_status": (
            "HOLD_UNTIL_INDEPENDENT_EVIDENCE"
        ),
        "results": results,
    }

    output = Path(
        "historical_validation/"
        "rainfall_timeseries_49m_tests.json"
    )

    output.parent.mkdir(
        parents=True, exist_ok=True
    )

    output.write_text(
        json.dumps(summary, indent=2),
        encoding="utf-8",
    )

    print(json.dumps(summary, indent=2))

    if summary["technical_status"] != "PASS":
        raise SystemExit(1)

if __name__ == "__main__":
    main()
