# RainGuard: Independent forecast accuracy verification (research only)

## Current status
The existing Jeddah 2009, 2011, and 2022 station-evidence registers explicitly identify missing station coordinates, official hourly observations, and spatial/temporal match verification. Historical daily maxima are **not** matched hourly forecast-observation pairs. Therefore no numerical provider-accuracy ranking or learned fusion weights may be published from those registers.

The new evaluator in `scripts/evaluate_forecast_skill.py` is an offline tool. It never calls live WeatherAPI, never edits production weights, and never treats source connectivity or cross-provider agreement as forecasting accuracy.

## Input requirements
Two UTF-8 CSVs, with a unique observation ID at each station and verified period.

Forecast CSV: `provider,city,latitude,longitude,observation_id,issued_at_utc,valid_start_utc,valid_end_utc,horizon_hours,predicted_rain_mm,predicted_probability_pct`

Observations CSV: `observation_id,city,latitude,longitude,start_utc,end_utc,observed_rain_mm,source_url,original_record_verified,coordinates_verified,interval_verified,independent_observation`

The `source_url` must be an HTTPS reference to the original independent gauge record, and the four verification fields must be `YES` after manual review. The script checks uniqueness, exact time-window match, a maximum 5 km geographic distance, issued-before-event timestamps, and numeric completeness. These are **necessary but not sufficient** verification criteria: the script cannot verify the truth of entered YES values or the contents of a URL. Source-provenance verification must happen outside the script. Do not mark synthetic data or ERA5 reanalysis as independent station observations.

## Execute
```bash
python scripts/evaluate_forecast_skill.py --forecasts forecast_archive.csv --observations verified_gauges.csv --output results/forecast_skill.json
python -m unittest discover -s tests -p 'test_forecast_skill_gate.py'
```

Minimum default **30** independently paired samples per provider, but this is merely a preliminary data-sufficiency gate; not statistically robust proof for national flood-warning operation. The output reports Brier score (lower is better), rainfall MAE, bias, probability of detection, and false-alarm ratio only when the sample gate is met.

No field deployment of flood risk alerts or truck routing should be approved based only on these scores. Such uses require additional event-wise holdout, uncertainty assessment, hydrological validation, road closure feeds and regulator/authority review.

Current indicator in V30 is explicitly labeled *experimental source-coherence indicator*, not measured forecast accuracy. No fusion weights were recalibrated.
