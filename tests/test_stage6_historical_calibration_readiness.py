import importlib.util
import tempfile
import unittest
from pathlib import Path

spec=importlib.util.spec_from_file_location("readiness", Path("scripts/stage6_historical_calibration_readiness.py"))
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ReadinessTests(unittest.TestCase):
    def test_all_three_historical_events_remain_unverified(self):
        report=module.review(Path("."))
        self.assertEqual(report["historical_events"],3)
        self.assertFalse(report["source_weights_update_authorized"])
        self.assertFalse(report["operational_road_warning_approved"])
        self.assertFalse(report["historical_forecast_skill_available"])
        events={e["event_id"]:e for e in report["events"]}
        self.assertEqual(set(events),set(module.EVENTS))
        for key,event in events.items():
            with self.subTest(event=key):
                self.assertTrue(event["event_documented"])
                self.assertFalse(event["calibration_approved"])
                self.assertFalse(event["independent_station_timeseries_verified"])
                self.assertFalse(event["spatial_hourly_match_verified"])
                self.assertFalse(event["archived_issued_forecasts_verified"])
                self.assertTrue(event["era5_reference_only_not_forecast"])
                self.assertIn("ORIGINAL_PRE_EVENT_ISSUED_FORECAST_ARCHIVE",event["missing_requirements"])
                self.assertIn("VERIFIED_INDEPENDENT_GAUGE_TIMESERIES",event["missing_requirements"])

    def test_unverified_candidate_archive_does_not_authorize_skill(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            (root/"data/calibration/issued_forecast_archives").mkdir(parents=True)
            (root/"historical_rainfall").mkdir()
            source=Path("data/calibration")
            for name in ("rainguard_49h_station_verification.csv",
                         "rainguard_43_independent_event_evidence.csv",
                         "rainguard_46_spatiotemporal_evidence_register.csv"):
                (root/"data/calibration"/name).write_bytes((source/name).read_bytes())
            for name in ("hourly_rainfall.csv", "rainfall_windows.csv"):
                (root/"historical_rainfall"/name).write_bytes((Path("historical_rainfall")/name).read_bytes())
            (root/"data/calibration/issued_forecast_archives/JEDDAH_2009.csv").write_text(
                "issued_at_utc,valid_at_utc\n2009-11-25,2009-11-26\n")
            report=module.review(root)
            item=next(i for i in report["events"] if i["event_id"]=="JEDDAH_2009")
            self.assertTrue(item["issued_archive_candidate_file_present"])
            self.assertFalse(item["archived_issued_forecasts_verified"])
            self.assertFalse(item["calibration_approved"])

    def test_no_automatic_truth_from_daily_station_maximum(self):
        report=module.review(Path("."))
        self.assertEqual(report["status"],"HOLD_UNTIL_INDEPENDENT_FORECAST_AND_GAUGE_EVIDENCE")
        self.assertTrue(all(e["forecast_skill_status"]=="UNMEASURABLE_MISSING_INDEPENDENT_PAIRED_ARCHIVES"
                            for e in report["events"]))

if __name__=="__main__":
    unittest.main()
