import importlib.util
import io
import json
import unittest
from pathlib import Path

P = Path(__file__).resolve().parents[1]/"deploy"/"valhalla-pilot"/"test_protected_api.py"
spec=importlib.util.spec_from_file_location("protected_smoke",P)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class Dummy:
    status=200
    def __init__(self,data):
        self.data=json.dumps(data).encode("utf-8")
    def __enter__(self):
        return self
    def __exit__(self,*_):
        pass
    def read(self,limit):
        return self.data[:limit]


class Tests(unittest.TestCase):
    def test_valid_mock_route_still_not_road_safe(self):
        payload={"success":True,"routeStatus":"ROUTE_COMPUTED_SAFETY_UNVERIFIED",
            "safeToDrive":None,"alternativeRouteApproved":False,
            "roadClosures":"NOT_VERIFIED","floodHazard":"NOT_EVALUATED",
            "distanceKm":65.7,"estimatedTravelMinutes":66,
            "sections":[{"encodedPolyline6":"mock"}]}
        out=mod.request_route("x"*25,opener=lambda request,timeout:Dummy(payload))
        self.assertTrue(out["success"])
        self.assertEqual(out["status"],"LOCAL_PROVIDER_ROUTE_COMPUTED_NOT_SAFE_TO_DRIVE")
        self.assertIsNone(out["safeToDrive"])
        self.assertFalse(out["alternativeRouteApproved"])
        self.assertNotIn("encodedPolyline6",out)

    def test_weak_token_blocks_request(self):
        out=mod.request_route("short",opener=lambda *_args,**_kwargs: self.fail("must not call"))
        self.assertFalse(out["success"])
        self.assertEqual(out["reason"],"MISSING_STRONG_SERVER_TOKEN")

    def test_unverified_safety_flag_blocks_success(self):
        base={"success":True,"routeStatus":"ROUTE_COMPUTED_SAFETY_UNVERIFIED",
              "safeToDrive":True,"alternativeRouteApproved":False,
              "roadClosures":"NOT_VERIFIED","floodHazard":"NOT_EVALUATED",
              "distanceKm":65,"estimatedTravelMinutes":60,"sections":[{}]}
        for unsafe in [base,{**base,"safeToDrive":None,"alternativeRouteApproved":True},
                       {**base,"safeToDrive":None,"roadClosures":"CLEAR"}]:
            with self.subTest(unsafe=unsafe):
                out=mod.request_route("x"*25,opener=lambda request,timeout:Dummy(unsafe))
                self.assertFalse(out["success"])

    def test_bad_distance_time_and_missing_sections(self):
        good={"success":True,"routeStatus":"ROUTE_COMPUTED_SAFETY_UNVERIFIED",
              "safeToDrive":None,"alternativeRouteApproved":False,
              "roadClosures":"NOT_VERIFIED","floodHazard":"NOT_EVALUATED",
              "distanceKm":65,"estimatedTravelMinutes":60,"sections":[{}]}
        for bad in [{**good,"estimatedTravelMinutes":0},
                    {**good,"distanceKm":float("nan")},
                    {**good,"sections":[]}]:
            with self.subTest(bad=bad):
                self.assertFalse(mod.inspect(bad)["success"])

    def test_only_loopback_endpoint_and_fixed_request(self):
        self.assertEqual(mod.HOST,"http://127.0.0.1:8000")
        self.assertEqual(mod.PATH,"/api/truck-routes/valhalla")
        self.assertEqual(mod.DEMO["vehicle"]["gross_weight_tons"],18)
        self.assertEqual(mod.DEMO["destination"]["lat"],21.3891)


if __name__=="__main__":
    unittest.main()
