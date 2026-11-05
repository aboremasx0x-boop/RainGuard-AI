
import csv
import json
import subprocess
import sys
import tempfile
from pathlib import Path

SCRIPT = Path("scripts/import_official_rainfall_49j.py").resolve()

FIELDS = [
    "station_id",
    "latitude",
    "longitude",
    "timestamp_utc",
    "rainfall_mm",
    "source_agency",
    "source_reference",
]

BASE = {
    "station_id": "TEST_STATION",
    "latitude": "21.5",
    "longitude": "39.2",
    "timestamp_utc": "2022-11-24T08:00:00Z",
    "rainfall_mm": "12.5",
    "source_agency": "SYNTHETIC_TEST_ONLY",
    "source_reference": "TEST_49K_NOT_REAL",
}

def run_case(name, records, expected_status, expected_valid):
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source = root / "data/official_stations/rainfall_observations.csv"
        source.parent.mkdir(parents=True, exist_ok=True)

        with source.open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=FIELDS)
            writer.writeheader()
            writer.writerows(records)

        process = subprocess.run(
            [sys.executable, str(SCRIPT)],
            cwd=root,
            capture_output=True,
            text=True,
            check=False,
        )

        report_path = (
            root /
            "historical_validation/official_rainfall_49j_summary.json"
        )

        if not report_path.exists():
            return {
                "case": name,
                "passed": False,
                "reason": "Report missing",
                "stderr": process.stderr,
            }

        report = json.loads(report_path.read_text(encoding="utf-8"))

        expected_exit = 0 if expected_status == "PASS" else 1

        passed = (
            report.get("technical_status") == expected_status
            and report.get("valid_records") == expected_valid
            and process.returncode == expected_exit
            and report.get("scientific_status")
            == "HOLD_UNTIL_INDEPENDENT_EVIDENCE"
        )

        return {
            "case": name,
            "passed": passed,
            "expected_status": expected_status,
            "actual_status": report.get("technical_status"),
            "expected_valid_records": expected_valid,
            "actual_valid_records": report.get("valid_records"),
            "errors": report.get("errors", []),
        }

def main():
    negative = {**BASE, "rainfall_mm": "-5"}
    invalid_coordinates = {**BASE, "latitude": "95"}
    invalid_time = {
        **BASE,
        "timestamp_utc": "2022-11-24T08:00:00",
    }

    cases = [
        ("valid_record", [BASE], "PASS", 1),
        ("negative_rainfall", [negative], "FAIL", 0),
        ("invalid_coordinates", [invalid_coordinates], "FAIL", 0),
        ("invalid_utc", [invalid_time], "FAIL", 0),
        ("duplicate_record", [BASE, BASE], "FAIL", 1),
    ]

    results = [
        run_case(name, records, status, count)
        for name, records, status, count in cases
    ]

    summary = {
        "stage": "FORECAST-1J6G49K",
        "test_data": "SYNTHETIC_ONLY",
        "tests_total": len(results),
        "tests_passed": sum(r["passed"] for r in results),
        "technical_status": (
            "PASS" if all(r["passed"] for r in results) else "FAIL"
        ),
        "scientific_status": "HOLD_UNTIL_INDEPENDENT_EVIDENCE",
        "results": results,
    }

    output = Path(
        "historical_validation/official_rainfall_49k_tests.json"
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(summary, indent=2),
        encoding="utf-8",
    )

    print(json.dumps(summary, indent=2))

    if summary["technical_status"] != "PASS":
        raise SystemExit(1)

if __name__ == "__main__":
    main()
