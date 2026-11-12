"""No-network regression tests of the production rain scoring and provenance functions."""
import ast
import datetime
import pathlib
import unittest
from unittest.mock import patch

SOURCE=pathlib.Path(__file__).resolve().parents[1]/"main.py"
text=SOURCE.read_text(encoding="utf-8")
tree=ast.parse(text,filename=str(SOURCE))
names={
    "classify","calculate_daily_score","calculate_rain_score","build_open_meteo_next_hours",
    "build_open_meteo_daily_forecast","build_hybrid_recovery_result",
    "build_current_from_openweather","build_open_meteo_result","calculate_flood_risk_score",
}
defs=[node for node in tree.body if isinstance(node,(ast.FunctionDef,ast.AsyncFunctionDef)) and node.name in names]
assert {d.name for d in defs}==names
ns={"datetime":datetime.datetime,"timedelta":datetime.timedelta,
    "now_utc":lambda: datetime.datetime(2026,11,13,9,10),
    "safe_number":lambda x,d=0: float(d if x is None or x=="" else x),
    "clamp":lambda x,a=0,b=100: max(a,min(b,x)),
    "adaptive_thresholds_v2":lambda: {"thresholds":{"watch":30,"medium":50,"high":70,"danger":80}},
    "apply_adaptive_rain_score":lambda **kw: {
        "rain_score":kw["base_score"],"adaptive_score":kw["base_score"],"adaptive_learning":{"ok":False,"samples":0}},
    "adaptive_learning_v1":lambda: {"ok":False,"samples":0},
    "verify_with_openweather":lambda score,ow:{"verified":False,"confidence_score":score},
    "get_load_balancer_status":lambda: {},
    "store_prediction_from_result":lambda *a,**kw:None,
}
exec(compile(ast.Module(body=defs,type_ignores=[]),str(SOURCE),"exec"),ns)

def meteo():
    times=[f"2026-11-13T{h:02d}:00" for h in range(24)]
    hourly={"time":times}
    for key in ("temperature_2m","relative_humidity_2m","dew_point_2m",
                "precipitation_probability","precipitation","cloud_cover","pressure_msl","wind_speed_10m"):
        hourly[key]=[0.0]*24
    hourly["relative_humidity_2m"]=[70.0]*24
    hourly["pressure_msl"]=[1015.0]*24
    hourly["temperature_2m"]=[25.0]*24
    daily={"time":["2026-11-13"],"temperature_2m_max":[33],"temperature_2m_min":[22],
           "precipitation_probability_max":[99],"precipitation_sum":[3.9],
           "rain_sum":[1.8],"wind_speed_10m_max":[12]}
    return {"utc_offset_seconds":10800,"hourly":hourly,"daily":daily}

class IntegrityTests(unittest.TestCase):
    def test_syntax_and_no_named_official_high_warning(self):
        self.assertEqual(ns["classify"](84)["level"],"مؤشر احتمال مطر مرتفع (بحثي)")
        self.assertNotIn("أمطار قوية",ns["classify"](84)["advice"])
    def test_daily_probability_not_equal_rain_intensity(self):
        s=ns["calculate_daily_score"]({"rain_probability_max":99,"precipitation_sum":3.9})
        self.assertEqual(s,84)
        d=ns["build_open_meteo_daily_forecast"](meteo())[0]
        self.assertFalse(d["rainIntensityVerified"])
        self.assertFalse(d["officialWarning"])
        self.assertIn("RESEARCH_INDEX",d["dailyScoreMeaning"])
    def test_provider_hourly_window_starts_from_current_local_hour(self):
        r=ns["build_open_meteo_next_hours"](meteo(),12)
        self.assertEqual(r[0]["time"],"2026-11-13T12:00")
        self.assertEqual(len(r),12)
        self.assertEqual(r[-1]["time"],"2026-11-13T23:00")
    def test_missing_provider_offset_fails_closed(self):
        d=meteo();del d["utc_offset_seconds"]
        self.assertEqual(ns["build_open_meteo_next_hours"](d),[])
    def test_no_synthetic_forecasts_in_current_only_fallback(self):
        obs={"available":True,"confirmation_score":71,"temperature":28,"humidity":65,
             "rain_1h":0.2,"cloud_cover":70,"pressure":1009,"wind_speed":4}
        d=ns["build_hybrid_recovery_result"](21.5,39.2,"Jeddah",obs,"PRIMARY_DOWN",12)
        self.assertEqual(d["next_hours"],[])
        self.assertEqual(d["daily_forecast"],[])
        self.assertIsNone(d["floodRiskScore"])
        self.assertIsNone(d["current"]["rain_probability"])
        self.assertFalse(d["verification"]["verified"])
        self.assertIsNone(d["verification"]["confidence_score"])
        self.assertFalse(d["source_details"]["syntheticForecast"])
    def test_window_flood_proxy_not_misrepresented_as_hourly(self):
        d=ns["build_open_meteo_result"](21.5,39.2,"Jeddah",meteo(),
           {"available":False,"reason":"missing key"},12)
        self.assertFalse(d["error"])
        self.assertIsNone(d["verification"]["confidence_score"])
        self.assertFalse(d["verification"]["verified"])
        self.assertEqual(d["source"],"Open-Meteo")
        self.assertFalse(d["floodRiskValidated"])
        self.assertFalse(d["operationalWarningApproved"])
        self.assertIsNone(d["safeToDrive"])
        self.assertTrue(all(h["flood_score"] is None for h in d["next_hours"]))
        self.assertTrue(all(h["window_flood_proxy"]==d["floodRiskScore"] for h in d["next_hours"]))
    def test_second_source_comparison_is_not_accuracy_certification(self):
        d=ns["build_open_meteo_result"](21.5,39.2,"Jeddah",meteo(),{"available":True},12)
        self.assertIn("OpenWeatherMap",d["source"])
        self.assertFalse(d["verification"]["accuracyVerified"])
        self.assertIsNone(d["verification"]["confidence_score"])
    def test_legacy_default_score_calculation_still_stable(self):
        self.assertEqual(ns["calculate_daily_score"]({"rain_probability_max":99,"precipitation_sum":3.9}),84)
        self.assertEqual(ns["calculate_daily_score"]({"rain_probability_max":0,"precipitation_sum":0}),0)

if __name__=="__main__":unittest.main()
