#!/usr/bin/env python3
"""Synthetic-only tests: do not count invented samples as real verification."""
import importlib.util
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

spec = importlib.util.spec_from_file_location("forecast_metrics", Path("scripts/verify_provider_forecasts.py"))
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

BASE = datetime(2026, 1, 1, tzinfo=timezone.utc)

def sample(i, source="weatherapi", rainfall=None):
    valid = BASE + timedelta(hours=i+1)
    wet = i % 2 == 0
    mm = (1.5 if wet else 0.0) if rainfall is None else rainfall
    return {
        "forecast_id": f"f{i}", "source": source, "city": "Jeddah",
        "issued_at_utc": (valid-timedelta(hours=6)).isoformat(),
        "valid_at_utc": valid.isoformat(),
        "forecast_lat": "21.5433", "forecast_lon": "39.1728",
        "rain_probability_pct": "80" if wet else "20",
        "forecast_rain_mm": str(mm), "station_id": "VERIFIED_TEST_STATION",
        "station_lat": "21.5433", "station_lon": "39.1728",
        "observation_at_utc": valid.isoformat(), "observed_rain_mm": str(mm),
        "observation_source": "synthetic gauge test fixture",
        "observation_independent_verified": "YES",
        "station_coordinates_verified": "YES", "original_record_verified": "YES",
    }

class GateTest(unittest.TestCase):
    def test_no_data_and_historical_era5_cannot_claim_accuracy(self):
        self.assertEqual(mod.evaluate([])["status"], "PENDING_INDEPENDENT_FORECAST_OBSERVATION_PAIRS")
        row = sample(0)
        row["observation_source"] = "Open-Meteo ERA5 reanalysis"
        report = mod.evaluate([row])
        self.assertEqual(report["accepted"], 0)
        self.assertEqual(report["rejected"]["MODEL_DATA_NOT_INDEPENDENT_GAUGE"], 1)
        self.assertFalse(report["operational_warning_approved"])

    def test_unverified_and_misaligned_rejected(self):
        rows=[]
        for j, field, value in [
            (0,"observation_independent_verified","NO"),
            (1,"station_lon","46.6753"),
            (2,"observation_at_utc",(BASE+timedelta(days=2)).isoformat()),
            (3,"rain_probability_pct",""),
            (4,"valid_at_utc",BASE.isoformat()),
            (5,"source","anwaa"),
            (6,"station_coordinates_verified","NO")]:
            row=sample(j)
            row[field]=value
            rows.append(row)
        r=mod.evaluate(rows)
        self.assertEqual(r["accepted"],0)
        self.assertEqual(sum(r["rejected"].values()),len(rows))

    def test_low_sample_gate_and_duplicate(self):
        data=[sample(i) for i in range(8)]
        data.append(dict(data[0]))
        r=mod.evaluate(data)
        self.assertEqual(r["accepted"], 8)
        self.assertEqual(r["results"][0]["metrics"], None)
        self.assertFalse(r["results"][0]["accuracy_claim_allowed"])
        self.assertEqual(r["rejected"]["DUPLICATE_FORECAST_STATION_TIME"],1)

    def test_verified_synthetic_metrics_only(self):
        r=mod.evaluate([sample(i) for i in range(32)])
        self.assertEqual(r["status"],"VERIFICATION_METRICS_AVAILABLE")
        self.assertEqual(r["results"][0]["verified_samples"],32)
        self.assertEqual(r["results"][0]["metrics"]["rain_mm_mae"],0)
        self.assertAlmostEqual(r["results"][0]["metrics"]["brier_score"],0.04)
        self.assertEqual(r["results"][0]["metrics"]["probability_of_detection"],1.0)
        self.assertEqual(r["results"][0]["metrics"]["false_alarm_ratio"],0.0)
        self.assertFalse(r["source_ranking_authorized"])

    def test_all_dry_does_not_pass(self):
        rows=[sample(i,rainfall=0) for i in range(36)]
        r=mod.evaluate(rows)
        self.assertEqual(r["results"][0]["status"],"INSUFFICIENT_INDEPENDENT_SAMPLES")

if __name__=="__main__":
    unittest.main()
