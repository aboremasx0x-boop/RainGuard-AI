#!/usr/bin/env python3
"""42C: conservative historical-rainfall quality gate; no calibration."""
import csv, json, pathlib, sys
BASE = pathlib.Path('historical_rainfall')
OUT = pathlib.Path('historical_validation')
OUT.mkdir(exist_ok=True)

def read(path):
    with path.open(encoding='utf-8-sig', newline='') as f:
        return list(csv.DictReader(f))

hourly = read(BASE/'hourly_rainfall.csv')
windows = read(BASE/'rainfall_windows.csv')
evidence_path = pathlib.Path('data/calibration/event_evidence_register.csv')
evidence = {x['event_id']:x for x in read(evidence_path)} if evidence_path.exists() else {}
result=[]
for w in windows:
    ev=w['event_id']; rows=[r for r in hourly if r['event_id']==ev]
    vals=[]
    for r in rows:
        try: vals.append(float(r['precipitation_mm']))
        except (ValueError,TypeError): pass
    e=evidence.get(ev,{})
    source_names=sorted(set(r.get('source','') for r in rows))
    provenance_confirmed=e.get('model_provenance_verified','').lower()=='true'
    site_confirmed=e.get('site_location_verified','').lower()=='true'
    onset_confirmed=e.get('event_onset_verified','').lower()=='true'
    flood_confirmed=e.get('flood_observation_verified','').lower()=='true'
    gauge_confirmed=e.get('independent_gauge_verified','').lower()=='true'
    complete=len(vals)==len(rows) and bool(rows)
    ready=all([complete,provenance_confirmed,site_confirmed,onset_confirmed,flood_confirmed,gauge_confirmed])
    result.append({'event_id':ev,'hourly_rows':len(rows),'numeric_rows':len(vals),
                   'source_label':' | '.join(source_names),'data_complete':complete,
                   'model_provenance_verified':provenance_confirmed,
                   'site_location_verified':site_confirmed,'event_onset_verified':onset_confirmed,
                   'flood_observation_verified':flood_confirmed,
                   'independent_gauge_verified':gauge_confirmed,
                   'calibration_eligible':ready})
with (OUT/'validation_status.csv').open('w',newline='',encoding='utf-8-sig') as f:
    writer=csv.DictWriter(f,fieldnames=list(result[0]) if result else ['event_id'])
    writer.writeheader();writer.writerows(result)
print(json.dumps({'events':len(result),'calibration_eligible':sum(x['calibration_eligible'] for x in result),'status':'HOLD_UNTIL_INDEPENDENT_EVIDENCE'},ensure_ascii=False))
# Successful diagnostic execution does not imply calibration eligibility.
