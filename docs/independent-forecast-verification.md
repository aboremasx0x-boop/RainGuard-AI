# RainGuard AI — Independent forecast verification (stage V30)

**Current status: PENDING_INDEPENDENT_FORECAST_OBSERVATION_PAIRS.**

The existing `historical_rainfall/hourly_rainfall.csv` contains **Open-Meteo ERA5 reanalysis, not independent station measurements**. The station register `data/calibration/rainguard_49h_station_verification.csv` records missing georeferenced, original, timestamped gauge observations. Neither resource can demonstrate actual accuracy of the three live forecast services or authorize changing provider weights.

## Verification design

1. **Archive forecasts when first issued**, before the valid hour, with immutable forecast ID, provider, city, exact forecast issue UTC, target valid UTC, forecast coordinates, probability and hourly precipitation. A retrospective weather query is not a forecast issued before the event.
2. **Acquire independent gauge observations** with original station identification, verified coordinates, timestamps in UTC, original source, units and independent provenance. Exclude reanalysis, model output, unverified press summaries or forecasts from the observation side.
3. Have a qualified reviewer join forecast and observation for the **same target hour** (maximum 30 min offset), **within 10 km**, with issue time at least one hour before valid time and at most 72 hours earlier. Prefer tighter spatial pairing and gauges appropriate to local topography.
4. Populate a **copy**, never the template, of `data/calibration/independent_forecast_observation_pairs_TEMPLATE.csv`, marking three verification fields YES only after source-level review.
5. Run:
```bash
python scripts/verify_provider_forecasts.py \
  --pairs /path/to/independent_pairs.csv \
  --output /path/to/verification_report.json
```
6. Review per-provider/per-city sample eligibility. A minimum of **30 independently verified matched hourly pairs**, with at least **5 wet and 5 dry** hours per city/provider, is a provisional **reporting gate**, **not a scientific validation sufficiency criterion**. Dependence among overlapping forecast windows and spatial correlation require additional investigation before inference.
7. Metrics: **Brier score** (lower is better for rain occurrence probability), rainfall amount **MAE**, **probability of detection**, and **false alarm ratio** at a documented rain event threshold (0.1 mm/hour) and a 50% probability decision cutoff. Keep continuous scores and categorical scores separately. Further verification should include reliability diagrams, uncertainty, temporal cross-validation, and spatial holdouts.

## Safety and non-claims

- Never equate HTTP request success or agreement across weather services with forecast accuracy.
- A model's 72-hour window probability may not be the same event as a one-hour gauge measurement. **Only align one-hour issuance/validity pairs in this evaluator.**
- This tool **does not automatically select a best provider or update fusion weights**. Output always sets `source_ranking_authorized=false` and `operational_warning_approved=false`.
- Historical Jeddah floods in 2009, 2011 and 2022 remain documented events but lack the required station evidence for forecast verification in the current repository.
- Road and truck warnings need verified drainage, flood/runoff, road closures and official alerts in addition to rain forecasts.

References: WMO Forecast Verification guidelines https://community.wmo.int/en/forecast-verification ; WMO Early Warnings for All https://wmo.int/activities/early-warnings-all
