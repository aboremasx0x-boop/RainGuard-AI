
#!/usr/bin/env python3
"""43A: Historical rainfall and independent evidence gate. No calibration."""
import csv
import json
import pathlib

BASE = pathlib.Path("historical_rainfall")
OUT = pathlib.Path("historical_validation")
OUT.mkdir(parents=True, exist_ok=True)

REGISTER = pathlib.Path("data/calibration/event_evidence_register.csv")
INDEPENDENT = pathlib.Path(
    "data/calibration/rainguard_43_independent_event_evidence.csv"
)

def read(path):
    if not path.exists():
        raise FileNotFoundError(f"Required file missing: {path}")
    with path.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))

def verified(value):
    return str(value).strip().lower() == "true"

hourly = read(BASE / "hourly_rainfall.csv")
windows = read(BASE / "rainfall_windows.csv")
register = {r["event_id"]: r for r in read(REGISTER)}
independent = {r["event_id"]: r for r in read(INDEPENDENT)}

result = []

for w in windows:
    event_id = w["event_id"]
    rows = [r for r in hourly if r["event_id"] == event_id]
    vals = []

    for r in rows:
        try:
            vals.append(float(r["precipitation_mm"]))
        except (ValueError, TypeError):
            pass

    e = register.get(event_id, {})
    doc = independent.get(event_id, {})

    checks = {
        "model_provenance_verified": verified(
            e.get("model_provenance_verified")
        ),
        "site_location_verified": verified(
            e.get("site_location_verified")
        ),
        "event_onset_verified": verified(
            e.get("event_onset_verified")
        ),
        "flood_observation_verified": verified(
            e.get("flood_observation_verified")
        ),
        "independent_gauge_verified": verified(
            e.get("independent_gauge_verified")
        ),
    }

    complete = bool(rows) and len(vals) == len(rows)
    documented = (
        doc.get("flood_documented", "").strip().upper() == "YES"
        and bool(doc.get("source_url", "").strip())
    )

    spatial_match = (
        doc.get("spatial_match_verified", "").strip().upper() == "YES"
    )
    hourly_match = (
        doc.get("hourly_match_verified", "").strip().upper() == "YES"
    )

    # Documentary evidence alone does not establish gauge verification.
    ready = all([
        complete,
        documented,
        spatial_match,
        hourly_match,
        *checks.values(),
    ])

    result.append({
        "event_id": event_id,
        "hourly_rows": len(rows),
        "numeric_rows": len(vals),
        "data_complete": complete,
        "source_label": " | ".join(sorted({
            r.get("source", "") for r in rows
        })),
        "independent_source": doc.get("source_name", ""),
        "independent_source_url": doc.get("source_url", ""),
        "flood_documented": documented,
        "spatial_match_verified": spatial_match,
        "hourly_match_verified": hourly_match,
        **checks,
        "calibration_eligible": ready,
        "review_status": (
            "ELIGIBLE_FOR_REVIEW" if ready
            else "HOLD_UNTIL_INDEPENDENT_EVIDENCE"
        ),
    })

output = OUT / "validation_status.csv"

with output.open("w", newline="", encoding="utf-8-sig") as f:
    writer = csv.DictWriter(f, fieldnames=list(result[0]))
    writer.writeheader()
    writer.writerows(result)

summary = {
    "events": len(result),
    "documented_events": sum(r["flood_documented"] for r in result),
    "calibration_eligible": sum(r["calibration_eligible"] for r in result),
    "status": (
        "READY_FOR_MANUAL_REVIEW"
        if result and all(r["calibration_eligible"] for r in result)
        else "HOLD_UNTIL_INDEPENDENT_EVIDENCE"
    ),
    "output": str(output),
}

(OUT / "validation_summary.json").write_text(
    json.dumps(summary, ensure_ascii=False, indent=2),
    encoding="utf-8"
)

print(json.dumps(summary, ensure_ascii=False))
