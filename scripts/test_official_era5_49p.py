
import csv
import json
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
        "station_id": "TEST",
        "latitude": "21.5433",
        "longitude": "39.1728",
        "timestamp_utc": "2022-11-24T08:00:00Z",
        "rainfall_mm": "10",
        "observation_interval_minutes": "60",
        "rainfall_measurement_type": "INTERVAL_TOTAL",
        "rainfall_unit": "mm",
        "source_agency": "SYNTHETIC",
        "source_reference": "TEST_ONLY",
    }
    row.update(changes)
    return row

def era5(**changes):
    row = {
        "station_id": "TEST",
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
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)

def run_test(name, observations, reanalysis, expected):
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)
        data = root / "data/official_stations"

        write_csv(
            data / "rainfall_observations.csv",
            OFFICIAL_FIELDS, observations
        )
        write_csv(
            data / "era5_comparison.csv",
            ERA5_FIELDS, reanalysis
        )

        process = subprocess.run(
            [sys.executable, str(ENGINE)],
            cwd=root,
            capture_output=True,
            text=True,
        )

        path = root / (
            "historical_validation/"
            "official_era5_49n_summary.json"
        )

        if not path.exists():
            return {
                "test": name,
                "passed": False,
                "error": process.stderr,
            }

        report = json.loads(path.read_text(encoding="utf-8"))
        status = report.get("technical_status")

        safe_failure = (
            status != "FAIL"
            or (
                report.get("matched_records") == 0
                and not report.get("stations")
            )
        )

        passed = (
            status == expected
            and safe_failure
            and process.returncode == (
                1 if expected == "FAIL" else 0
            )
            and report.get("calibration_eligible") == 0
            and report.get("scientific_status")
            == "HOLD_UNTIL_INDEPENDENT_EVIDENCE"
        )

        return {
            "test": name,
            "expected": expected,
            "actual": status,
            "passed": passed,
            "errors": report.get("errors", []),
        }

def main():
    tests = [
        (
            "valid_record",
            [official()],
            [era5()],
            "PASS",
        ),
        (
            "duplicate_official",
            [official(), official()],
            [era5()],
            "FAIL",
        ),
        (
            "official_nan",
            [official(rainfall_mm="NaN")],
            [era5()],
            "FAIL",
        ),
        (
            "era5_infinity",
            [official()],
            [era5(era5_rainfall_mm="Infinity")],
            "FAIL",
        ),
        (
            "missing_source",
            [official(source_reference="")],
            [era5()],
            "FAIL",
        ),
        (
            "partial_metrics_protection",
            [
                official(),
                official(
                    timestamp_utc="2022-11-24T09:00:00Z",
                    rainfall_mm="NaN"
                ),
            ],
            [
                era5(),
                era5(
                    timestamp_utc="2022-11-24T09:00:00Z"
                ),
            ],
            "FAIL",
        ),
    ]

    results = [run_test(*test) for test in tests]
    passed = sum(r["passed"] for r in results)

    summary = {
        "stage": "FORECAST-1J6G49P",
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
        "historical_validation/official_era5_49p_tests.json"
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
