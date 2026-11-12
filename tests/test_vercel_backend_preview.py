"""Offline build and isolated API smoke tests; never call external weather services."""
from __future__ import annotations
import importlib
import json
import os
import pathlib
import sys
import tempfile
import unittest
from unittest.mock import patch
import datetime

ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"scripts"))
from build_vercel_backend_preview import build

class PreviewBundleTests(unittest.TestCase):
 def test_bundle_isolated_and_no_secrets(self):
    with tempfile.TemporaryDirectory() as t:
        out=pathlib.Path(t)/"api"
        data=build(out)
        self.assertFalse(data["deployed"])
        self.assertEqual(set(data["files"]),{
            "main.py","land_cover_api.py","here_truck_routes.py","valhalla_truck_routes.py",
            "truck_route_timeline.py","adaptive_learning.py","index.py",
            ".python-version","requirements.txt","vercel.json",
            "README-DO-NOT-DEPLOY-YET.txt"
        })
        self.assertEqual(json.loads((out/"vercel.json").read_text())["$schema"],
                         "https://openapi.vercel.sh/vercel.json")
        self.assertNotIn("rewrites",(out/"vercel.json").read_text())
        self.assertNotIn(".env",data["files"])
        self.assertNotIn("frontend",data["files"])
        self.assertNotIn("rainguard_predictions.db",data["files"])
        with self.assertRaises(FileExistsError):
            build(out)

 def test_read_only_runtime_with_mocked_weather(self):
    with tempfile.TemporaryDirectory() as t:
        output=pathlib.Path(t)/"api"
        build(output)
        # Import the exact isolated entrypoint (not the repository's main.py).
        original_modules={name:sys.modules.get(name) for name in [
            "index","main","land_cover_api","here_truck_routes",
            "valhalla_truck_routes","truck_route_timeline","adaptive_learning"
        ]}
        sys.path.insert(0,str(output))
        try:
            for name in original_modules:sys.modules.pop(name,None)
            import index
            from fastapi.testclient import TestClient
            client=TestClient(index.app)
            health=client.get("/health")
            self.assertEqual(health.status_code,200)
            self.assertEqual(health.json()["storage"],"NO_LOCAL_PERSISTENCE")
            self.assertEqual(client.get("/api/health").status_code,200)
            self.assertEqual(client.post("/verify-prediction",json={}).status_code,405)
            self.assertEqual(client.get("/verify-prediction?prediction_id=1&actual_rain=0").status_code,404)
            self.assertEqual(client.post("/api/truck-routes/here",json={}).status_code,405)
            self.assertEqual(client.get("/docs").status_code,404)
            self.assertEqual(client.get("/rain-alert?lat=400&lon=40").status_code,422)
            self.assertEqual(client.get("/rain-alert?lat=21.5&lon=39.1&hours=0").status_code,422)
            caps=client.get("/api/truck-routes/capabilities").json()
            self.assertFalse(caps["truckRouting"]["publicRouteCalculationAvailable"])
            self.assertFalse(caps["officialRoadClosuresConnected"])
            self.assertIsNone(caps["safeToDrive"])
            self.assertEqual(os.environ["RAINGUARD_VERCEL_READONLY"],"1")
            class FakeSupabase:
                def table(self,*args,**kwargs):
                    raise AssertionError("Unexpected Supabase write")
            index.legacy.supabase=FakeSupabase()
            self.assertFalse(index.legacy.save_prediction_history(
                "Jeddah",21.5,39.1,50,50,50,0,"MOCK"
            ))
            self.assertFalse((output/"rainguard_predictions.db").exists())
            now=(datetime.datetime.utcnow()+datetime.timedelta(hours=3)).replace(minute=0,second=0,microsecond=0)
            times=[(now+datetime.timedelta(hours=h)).strftime("%Y-%m-%dT%H:%M") for h in range(18)]
            hourly={"time":times}
            for key,value in [
                ("temperature_2m",26),("relative_humidity_2m",68),("dew_point_2m",19),
                ("precipitation_probability",30),("precipitation",0),
                ("cloud_cover",20),("pressure_msl",1014),("wind_speed_10m",4)]:
                hourly[key]=[value]*18
            day=times[0][:10]
            daily={"time":[day],"temperature_2m_max":[32],"temperature_2m_min":[23],
                   "precipitation_probability_max":[35],"precipitation_sum":[0.4],
                   "rain_sum":[0.4],"wind_speed_10m_max":[10]}
            async def fake_primary(*args,**kwargs):
                return {"ok":True,"data":{"utc_offset_seconds":10800,
                    "hourly":hourly,"daily":daily}}
            async def fake_secondary(*args,**kwargs):
                return {"available":False,"reason":"not configured"}
            with patch.object(index.legacy,"fetch_open_meteo",fake_primary), \\
                 patch.object(index.legacy,"fetch_openweather",fake_secondary):
                result=client.get("/rain-alert?lat=21.5433&lon=39.1728&name=Jeddah")
            self.assertEqual(result.status_code,200)
            self.assertFalse(result.json()["error"])
            self.assertEqual(result.json()["source"],"Open-Meteo")
            self.assertFalse(result.json()["operationalWarningApproved"])
            self.assertIsNone(result.json()["safeToDrive"])
            self.assertEqual(result.headers["X-RainGuard-Mode"],
                             "research-preview-no-operational-use")
            self.assertFalse((output/"rainguard_predictions.db").exists())
        finally:
            sys.path.remove(str(output))
            for name,prior in original_modules.items():
                sys.modules.pop(name,None)
                if prior is not None:sys.modules[name]=prior

if __name__=="__main__":
 unittest.main()
