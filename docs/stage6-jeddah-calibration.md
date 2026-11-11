# RainGuard AI — Stage 6: Jeddah historical calibration evidence

## Implemented
`scripts/stage6_historical_calibration_readiness.py` scans four existing historical evidence sets and generates an explicit per-event readiness report for 25 November 2009, 26 January 2011 and 24 November 2022. Source context already present in the repository documents historical flooding, but the existing `historical_rainfall/hourly_rainfall.csv` consists of **Open-Meteo ERA5 reanalysis**, not actual pre-event archived forecasts or independent station hourly series.

The scan checks whether:
- A flood event has a documented independent published source.
- The independent station archive includes timestamps, georeferenced original data, verified station identification, provenance and review flags.
- Event site vs. station/ERA5 grid cells have been independently matched in location and time.
- An **original forecast issued before the flood** exists, validated with provenance and immutable issue time.

Important: a file called `issued_forecast_archives/JEDDAH_2009.csv` is never proof that pre-event forecasts are authentic or calibrated. This program marks `archived_issued_forecasts_verified=false` even if such a file exists; a separate original-source archival provenance review is required before this state may change.

**Current findings:** all three events have documented historical flooding; no independent, spatially and hourly matched original station timeseries is verified in the current evidence registers; no original weather forecasts issued *before* these events have been verified. Therefore historic predictive skill is unmeasurable from this repository, and automatic source-weight tuning is prohibited.

## Run
```bash
python scripts/stage6_historical_calibration_readiness.py \
  --output historical_validation/stage6_calibration_readiness.json
```

## Proposed actual science workflow (not yet completed)
1. Secure original NCM station observations with station IDs, location coordinates, UTC measurement intervals and official provenance. Historical daily-maximum studies cannot be substituted for hourly station records.
2. Secure actual **issue-time forecast archives**, not weather reanalysis queries run today for 2009/2011/2022. Cross-check exact issued timestamps and valid timestamps.
3. Align each original forecast's target hour to a nearby independently verified rain gauge; preserve forecast initialization metadata and lead hours. Do not infer forecast accuracy from observed event amounts.
4. Keep flood *event reporting* distinct from meteorological *forecast verification* and road inundation *hazard validation*; they answer different questions.
5. Pre-register training/calibration years and **later, independent holdout** periods and sites. Avoid leakage from overlapping issue cycles, repeated events, and spatially correlated stations.
6. Calculate independently verified Brier score, amount MAE, probability of detection, false alarm ratio, reliability and uncertainty *only* after sufficient wet/dry event pairs and held-out validation.
7. Do not automatically alter model weights or advise trucks to travel until a multidisciplinary operational review, validated hydrology, official closures, security review and a controlled pilot.

These checks are scientific readiness gates, **not evidence that RainGuard predicted the historical floods**.

Related code: `scripts/verify_provider_forecasts.py`, `scripts/verify_historical_events.py`.
Sources: [WMO Forecast Verification](https://community.wmo.int/en/forecast-verification); [WMO Early Warnings for All](https://wmo.int/activities/early-warnings-all).
