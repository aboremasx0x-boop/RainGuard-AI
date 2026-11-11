import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from evaluate_forecast_skill import evaluate

START = datetime(2026, 11, 12, tzinfo=timezone.utc)

def iso(value):
    return value.isoformat().replace("+00:00", "Z")

def fixture(n=32):
    forecasts, observations = [], []
    for i in range(n):
        start = START + timedelta(days=i)
        end = start + timedelta(hours=1)
        obsid = f"JED-{i}"
        observed = 1.0 if i % 2 else 0.0
        observations.append({
            "observation_id": obsid, "city": "Jeddah", "latitude": "21.5433",
            "longitude": "39.1728", "start_utc": iso(start),
            "end_utc": iso(end), "observed_rain_mm": str(observed),
            "source_url": "https://example.org/station/verified-record",
            "original_record_verified": "YES",
            "coordinates_verified": "YES", "interval_verified": "YES",
            "independent_observation": "YES"
        })
        for provider in ("Open-Meteo", "WeatherAPI"):
            forecasts.append({
                "provider": provider, "city": "Jeddah", "latitude": "21.5433",
                "longitude": "39.1728", "observation_id": obsid,
                "issued_at_utc": iso(start - timedelta(hours=6)),
                "valid_start_utc": iso(start), "valid_end_utc": iso(end),
                "horizon_hours": "1", "predicted_rain_mm": str(observed),
                "predicted_probability_pct": "90" if observed else "10"
            })
    return forecasts, observations

class VerificationGateTests(unittest.TestCase):
    def test_verified_metrics_only_with_sufficient_evidence(self):
        forecasts, observations = fixture()
        result = evaluate(forecasts, observations)
        self.assertEqual(result["providers"]["WeatherAPI"]["status"], "VERIFIED_SAMPLE_METRICS")
        self.assertEqual(result["providers"]["WeatherAPI"]["rainfall_mae_mm"], 0)
        self.assertEqual(result["providers"]["Open-Meteo"]["probability_brier_score"], 0.01)

    def test_unverified_station_rejected(self):
        forecasts, observations = fixture()
        for observation in observations:
            observation["coordinates_verified"] = "NO"
        result = evaluate(forecasts, observations)
        self.assertEqual(result["providers"]["WeatherAPI"]["status"], "INSUFFICIENT_VERIFIED_SAMPLES")
        self.assertNotIn("rainfall_mae_mm", result["providers"]["WeatherAPI"])
        self.assertEqual(result["rejected_records"]["UNVERIFIED_OBSERVATION"], len(forecasts))

    def test_future_forecast_or_mismatched_time_rejected(self):
        forecasts, observations = fixture()
        for row in forecasts:
            row["issued_at_utc"] = row["valid_end_utc"]
        result = evaluate(forecasts, observations)
        self.assertEqual(result["rejected_records"]["FORECAST_NOT_ISSUED_BEFORE_EVENT"], len(forecasts))

    def test_spatial_mismatch_rejected(self):
        forecasts, observations = fixture()
        for row in forecasts:
            row["latitude"] = "24.7136"
        result = evaluate(forecasts, observations)
        self.assertEqual(result["rejected_records"]["SPATIAL_MISMATCH"], len(forecasts))

    def test_no_observations_no_fake_accuracy(self):
        forecasts, _ = fixture()
        result = evaluate(forecasts, [])
        self.assertEqual(result["providers"]["WeatherAPI"]["status"], "INSUFFICIENT_VERIFIED_SAMPLES")
        self.assertFalse("probability_brier_score" in result["providers"]["WeatherAPI"])

if __name__ == "__main__":
    unittest.main()
