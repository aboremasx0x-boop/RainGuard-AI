
import csv
import json
import subprocess
import sys
import tempfile
from pathlib import Path

ENGINE = Path(__file__).resolve().with_name(
    "verify_temporal_alignment_49q.py"
)

OFFICIAL_FIELDS = [
    "station_id",
    "timestamp_utc",
    "observation_interval_minutes",
    "rainfall_measurement_type",
    "rainfall_unit",
]

ERA5_FIELDS = [
    "station_id",
    "timestamp_utc",
    "observation_interval_minutes",
]

def official(hour, minute=0, interval=60, **changes):
    row = {
        "station_id": "SYNTHETIC_STATION",
        "timestamp_utc":
            f"2022-11-24T{hour:02d}:{minute:02d}:00Z",
        "observation_interval_minutes": str(interval),
        "rainfall_measurement_type": "INTERVAL_TOTAL",
        "rainfall_unit": "mm",
    }
    row.update(changes)
    return row

def era5(hour, minute=0, interval=60, **changes):
    row = {
        "station_id": "SYNTHETIC_STATION",
        "timestamp_utc":
            f"2022-11-24T{hour:02d}:{minute:02d}:00Z",
        "observation_interval_minutes": str(interval),
    }
    row.update(changes)
    return row

def write_csv(path, fields, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open(
        "w", encoding="utf-8", newline=""
    ) as file:
        writer = csv.DictWriter(file, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)

def run_case(name, observations, reanalysis,
             expected_status, expected_matches,
             expected_gaps=None):
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        folder = root / "data/official_stations"

        write_csv(
            folder / "rainfall_observations.csv",
            OFFICIAL_FIELDS,
            observations,
        )
        write_csv(
            folder / "era5_comparison.csv",
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

        path = root / (
            "historical_validation/"
            "temporal_alignment_49q.json"
        )

        if not path.exists():
            return {
                "test": name,
                "passed": False,
                "reason": "Report missing",
                "stderr": process.stderr,
            }

        report = json.loads(
            path.read_text(encoding="utf-8")
        )

        status = report.get("technical_status")
        matches = report.get("matched_intervals")
        gaps = report.get("official_gap_count")

        passed = (
            status == expected_status
            and matches == expected_matches
            and (
                expected_gaps is None
                or gaps == expected_gaps
            )
            and process.returncode == (
                1 if expected_status == "FAIL" else 0
            )
            and report.get("calibration_eligible") == 0
            and report.get("scientific_status")
            == "HOLD_UNTIL_INDEPENDENT_EVIDENCE"
        )

        return {
            "test": name,
            "passed": passed,
            "expected_status": expected_status,
            "actual_status": status,
            "expected_matches": expected_matches,
            "actual_matches": matches,
            "expected_gaps": expected_gaps,
            "actual_gaps": gaps,
            "errors": report.get("errors", []),
        }

def main():
    cases = [
        (
            "complete_hourly_alignment",
            [official(8), official(9), official(10)],
            [era5(8), era5(9), era5(10)],
            "PASS", 3, 0,
        ),
        (
            "missing_official_hour",
            [official(8), official(10)],
            [era5(8), era5(9), era5(10)],
            "QUALITY_WARNINGS", 2, 1,
        ),
        (
            "different_aggregation_interval",
            [official(8)],
            [era5(8, interval=30)],
            "NO_MATCHES", 0, 0,
        ),
        (
            "duplicate_official_interval",
            [official(8), official(8)],
            [era5(8)],
            "FAIL", 0, None,
        ),
        (
            "overlapping_official_intervals",
            [
                official(8),
                official(8, minute=30),
            ],
            [era5(8)],
            "FAIL", 0, None,
        ),
        (
            "invalid_official_unit",
            [official(8, rainfall_unit="inches")],
            [era5(8)],
            "FAIL", 0, None,
        ),
        (
            "partial_temporal_alignment",
            [official(8), official(9)],
            [era5(8)],
            "QUALITY_WARNINGS", 1, 0,
        ),
    ]

    results = [run_case(*case) for case in cases]
    passed = sum(item["passed"] for item in results)

    summary = {
        "stage": "FORECAST-1J6G49Q",
        "data_type": "SYNTHETIC_ONLY",
        "total_tests": len(results),
        "passed_tests": passed,
        "failed_tests": len(results) - passed,
        "technical_status": (
            "PASS" if passed == len(results) else "FAIL"
        ),
        "calibration_eligible": 0,
        "scientific_status":
            "HOLD_UNTIL_INDEPENDENT_EVIDENCE",
        "results": results,
    }

    output = Path(
        "historical_validation/"
        "temporal_alignment_49q_tests.json"
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
