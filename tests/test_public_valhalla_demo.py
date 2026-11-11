import importlib.util
import io
import json
import unittest
from pathlib import Path

p = Path(__file__).resolve().parents[1] / "scripts" / "test_public_valhalla_demo.py"
spec = importlib.util.spec_from_file_location("demo_probe", p)
probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)

class MockResponse:
    status = 200
    def __init__(self, data):
        self.data = json.dumps(data).encode("utf-8")
    def __enter__(self): return self
    def __exit__(self, *args): pass
    def read(self, limit): return self.data[:limit]

class Tests(unittest.TestCase):
    def test_request_is_single_fixed_post_and_has_client_id(self):
        counter = []
        def fake(request, timeout):
            counter.append(request)
            self.assertEqual(timeout, 15)
            self.assertEqual(request.full_url, probe.ENDPOINT)
            self.assertEqual(request.get_method(), "POST")
            self.assertEqual(request.get_header("X-client-id"), probe.CLIENT_ID)
            body = json.loads(request.data)
            self.assertEqual(body["costing"], "truck")
            self.assertEqual(body["costing_options"]["truck"]["weight"], 18)
            return MockResponse({"trip": {"summary": {"length": 88.3, "time": 3600},
                                          "legs": [{}]}})
        out = probe.run(opener=fake)
        self.assertEqual(len(counter), 1)
        self.assertEqual(out["status"], "PUBLIC_DEMO_ROUTE_COMPUTED_SAFETY_UNVERIFIED")
        self.assertEqual(out["estimatedDistanceKm"], 88.3)
        self.assertEqual(out["estimatedTravelMinutes"], 60)
        self.assertIsNone(out["safeToDrive"])
        self.assertFalse(out["alternativeRouteApproved"])

    def test_fails_closed_without_valid_route(self):
        for data in ({}, {"trip": {"summary": {"length": 85, "time": 1200}}},
                     {"trip": {"summary": {"length": 0, "time": 1200}, "legs":[{}]}},
                     {"trip": {"summary": {"length": "85", "time": 1200}, "legs":[{}]}}):
            with self.subTest(data=data):
                out = probe.inspect(data)
                self.assertFalse(out["success"])
                self.assertIsNone(out["safeToDrive"])

    def test_http_error_and_unreachable(self):
        from urllib.error import HTTPError, URLError
        def forbidden(_request, timeout):
            raise HTTPError(probe.ENDPOINT, 429, "Too many", {}, None)
        def unreachable(_request, timeout):
            raise URLError("network unavailable")
        self.assertEqual(probe.run(forbidden)["httpStatus"], 429)
        self.assertEqual(probe.run(unreachable)["status"], "DEMO_UNREACHABLE")

if __name__ == "__main__": unittest.main()
