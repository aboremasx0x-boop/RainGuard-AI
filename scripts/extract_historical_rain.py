#!/usr/bin/env python3
"""RainGuard 42B: historical gridded rainfall near reference city points, NOT event-site observations."""
import csv, json, urllib.parse, urllib.request, datetime, pathlib, time
OUT=pathlib.Path('historical_rainfall'); OUT.mkdir(exist_ok=True)
EVENTS=[('JEDDAH_2009','2009-11-25',21.5433,39.1728),('JEDDAH_2011','2011-01-26',21.5433,39.1728),('JEDDAH_2022','2022-11-24',21.5433,39.1728)]
HOURLY=['precipitation']
rows=[]; summaries=[]; errors=[]
for event,date,lat,lon in EVENTS:
    day=datetime.date.fromisoformat(date)
    params={'latitude':lat,'longitude':lon,'start_date':str(day-datetime.timedelta(days=4)),'end_date':str(day+datetime.timedelta(days=1)),'hourly':','.join(HOURLY),'timezone':'Asia/Riyadh','models':'era5_land'}
    url='https://archive-api.open-meteo.com/v1/archive?'+urllib.parse.urlencode(params)
    try:
        with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'RainGuardAI-Research/42B'}),timeout=90) as resp: data=json.load(resp)
        times=data.get('hourly',{}).get('time',[]); vals=data.get('hourly',{}).get('precipitation',[])
        if not times or len(times)!=len(vals): raise ValueError('missing/mismatched hourly precipitation')
        series=[]
        for t,v in zip(times,vals):
            dt=datetime.datetime.fromisoformat(t)
            value=float(v) if v is not None else None
            rows.append({'event_id':event,'reference_date':date,'reference_lat':lat,'reference_lon':lon,'timestamp_local':t,'precipitation_mm':value,'source':'Open-Meteo ERA5-Land','site_verified':False})
            series.append((dt,value))
        # Windows END at end of event reference day (not verified event onset).
        end=datetime.datetime.combine(day+datetime.timedelta(days=1),datetime.time.min)
        result={'event_id':event,'reference_date':date,'location_type':'CITY_REFERENCE_NOT_EVENT_SITE','source':'Open-Meteo ERA5-Land','event_onset_verified':False,'calibration_eligible':False}
        for hours in (6,12,24,48,72):
            segment=[v for t,v in series if end-datetime.timedelta(hours=hours)<=t<end]
            result[f'rain_{hours}h_mm']=round(sum(segment),3) if len(segment)==hours and all(v is not None for v in segment) else ''
        summaries.append(result)
    except Exception as exc:
        errors.append({'event_id':event,'error':str(exc),'request_url':url})
    time.sleep(1)
def write(name,fields,records):
    with (OUT/name).open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(records)
write('hourly_rainfall.csv',['event_id','reference_date','reference_lat','reference_lon','timestamp_local','precipitation_mm','source','site_verified'],rows)
write('rainfall_windows.csv',['event_id','reference_date','location_type','source','event_onset_verified','calibration_eligible']+[f'rain_{h}h_mm' for h in (6,12,24,48,72)],summaries)
write('extraction_errors.csv',['event_id','error','request_url'],errors)
print(f'events_success={len(summaries)} events_failed={len(errors)} hourly_rows={len(rows)}')
if errors: raise SystemExit(1)
