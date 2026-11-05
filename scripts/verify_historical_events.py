#!/usr/bin/env python3
"""RainGuard 46C: conservative evidence gate. Diagnostics only; no calibration."""
import csv
import json
import math
from pathlib import Path

BASE = Path('historical_rainfall')
OUT = Path('historical_validation')
OUT.mkdir(parents=True, exist_ok=True)
REGISTER = Path('data/calibration/event_evidence_register.csv')
INDEPENDENT = Path('data/calibration/rainguard_43_independent_event_evidence.csv')
SPATIOTEMPORAL = Path('data/calibration/rainguard_46_spatiotemporal_evidence_register.csv')


def read(path):
    if not path.is_file():
        raise FileNotFoundError(f'Required file missing: {path}')
    with path.open(encoding='utf-8-sig', newline='') as stream:
        return list(csv.DictReader(stream))


def index_unique(rows, label):
    indexed = {}
    for row in rows:
        event_id = row.get('event_id', '').strip()
        if not event_id or event_id in indexed:
            raise ValueError(f'Missing or duplicate event_id in {label}: {event_id!r}')
        indexed[event_id] = row
    return indexed


def yes(value):
    return str(value).strip().lower() in ('yes', 'true')


def numeric(value):
    try:
        return math.isfinite(float(value))
    except (ValueError, TypeError):
        return False


def present(row, *keys):
    return all(str(row.get(key, '')).strip() for key in keys)


hourly = read(BASE / 'hourly_rainfall.csv')
windows = read(BASE / 'rainfall_windows.csv')
register = index_unique(read(REGISTER), str(REGISTER)) if REGISTER.exists() else {}
independent = index_unique(read(INDEPENDENT), str(INDEPENDENT))
spatiotemporal = index_unique(read(SPATIOTEMPORAL), str(SPATIOTEMPORAL))
window_ids = index_unique(windows, 'rainfall_windows.csv')
if set(window_ids) != set(independent) or set(window_ids) != set(spatiotemporal):
    raise ValueError('Event IDs differ between rainfall windows, 43 evidence and 46 evidence')

results = []
for event_id, window in window_ids.items():
    rows = [r for r in hourly if r.get('event_id') == event_id]
    e = register.get(event_id, {})
    doc = independent[event_id]
    geo = spatiotemporal[event_id]
    complete = len(rows) == 144 and all(numeric(r.get('precipitation_mm')) for r in rows)
    documented = yes(doc.get('flood_documented')) and present(doc, 'source_url')

    checks = {
        'model_provenance_verified': yes(e.get('model_provenance_verified')),
        'era5_grid_cell_verified': yes(geo.get('era5_grid_cell_verified')),
        'site_location_verified': yes(e.get('site_location_verified')) and yes(geo.get('site_location_verified')) and present(geo, 'flood_site_name', 'flood_site_lat', 'flood_site_lon', 'flood_site_source_url'),
        'event_onset_verified': yes(e.get('event_onset_verified')) and yes(geo.get('event_onset_verified')) and present(geo, 'event_onset_local', 'event_onset_source_url'),
        'flood_observation_verified': yes(e.get('flood_observation_verified')),
        'independent_gauge_verified': yes(e.get('independent_gauge_verified')) and yes(geo.get('independent_gauge_verified')) and present(geo, 'gauge_station_name', 'gauge_lat', 'gauge_lon', 'gauge_location_source_url', 'gauge_rainfall_mm', 'gauge_measurement_start_local', 'gauge_measurement_end_local', 'gauge_observation_source_url'),
        'spatial_match_verified': yes(doc.get('spatial_match_verified')) and yes(geo.get('spatial_match_verified')),
        'hourly_match_verified': yes(doc.get('hourly_match_verified')) and yes(geo.get('hourly_match_verified')),
    }
    # Flags are claims in CSV, not independent verification of cited evidence.
    # Passing the automated gate only permits human review, never auto-calibration.
    missing = [name for name, passed in {'data_complete': complete, 'flood_documented': documented, **checks}.items() if not passed]
    eligible = not missing
    results.append({
        'event_id': event_id,
        'hourly_rows': len(rows),
        'numeric_rows': sum(numeric(r.get('precipitation_mm')) for r in rows),
        'source_label': ' | '.join(sorted({r.get('source', '') for r in rows})),
        'data_complete': complete,
        'flood_documented': documented,
        **checks,
        'missing_requirements': ' | '.join(missing),
        'calibration_eligible': eligible,
        'review_status': 'ELIGIBLE_FOR_MANUAL_REVIEW' if eligible else 'HOLD_UNTIL_INDEPENDENT_EVIDENCE',
    })

output = OUT / 'validation_status.csv'
with output.open('w', newline='', encoding='utf-8-sig') as stream:
    writer = csv.DictWriter(stream, fieldnames=list(results[0]) if results else ['event_id'])
    writer.writeheader()
    writer.writerows(results)

summary = {
    'events': len(results),
    'documented_events': sum(r['flood_documented'] for r in results),
    'calibration_eligible': sum(r['calibration_eligible'] for r in results),
    'status': 'READY_FOR_MANUAL_REVIEW' if results and all(r['calibration_eligible'] for r in results) else 'HOLD_UNTIL_INDEPENDENT_EVIDENCE',
    'output': str(output),
}
(OUT / 'validation_summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(summary, ensure_ascii=False))
