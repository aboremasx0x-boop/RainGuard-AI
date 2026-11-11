import os
import unittest
from datetime import datetime, timezone
from unittest.mock import patch

from fastapi.testclient import TestClient
from here_truck_routes import (
    Location, Vehicle, RouteRequest, router, route_parameters,
    parse_route_payload,
)
from fastapi import FastAPI

app = FastAPI()
app.include_router(router)
client = TestClient(app)


def request():
    return {
        "origin": {"lat": 21.5433, "lon": 39.1728},
        "destination": {"lat": 24.7136, "lon": 46.6753},
        "departure_time_utc": "2026-11-12T08:00:00Z",
        "vehicle": {
            "gross_weight_tons": 18,
            "height_meters": 4,
            "width_meters": 2.5,
            "length_meters": 14,
        },
    }


class RoutingSafetyTests(unittest.TestCase):
    def test_unconfigured_returns_503_no_upstream(self):
        with patch.dict(os.environ, {"HERE_TRUCK_ROUTING_ENABLED": "false",
                                     "HERE_ROUTING_API_KEY": "test",
                                     "RAINGUARD_ROUTE_ACCESS_TOKEN": "private"}):
            response = client.post("/api/truck-routes/here", json=request())
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["error"], "TRUCK_ROUTING_NOT_CONFIGURED")

    def test_auth_required_before_upstream(self):
        with patch.dict(os.environ, {"HERE_TRUCK_ROUTING_ENABLED": "true",
                                     "HERE_ROUTING_API_KEY": "secret-key",
                                     "RAINGUARD_ROUTE_ACCESS_TOKEN": "private"}):
            response = client.post("/api/truck-routes/here", json=request())
        self.assertEqual(response.status_code, 403)
        self.assertNotIn("secret-key", str(response.json()))

    def test_truck_dimensions_units(self):
        data = request()
        params = route_parameters(RouteRequest(**data), "secret")
        self.assertEqual(params["transportMode"], "truck")
        self.assertEqual(params["vehicle[grossWeight]"], 18000)
        self.assertEqual(params["vehicle[height]"], 400)
        self.assertEqual(params["vehicle[width]"], 250)
        self.assertEqual(params["vehicle[length]"], 1400)
        self.assertEqual(params["apiKey"], "secret")

    def test_provider_response_is_not_safe_to_drive(self):
        source = {"routes": [{"sections": [
            {"summary": {"length": 12000, "duration": 1000},
             "polyline": "BFoz5xJ67i1B1B7PzIhaxL7Y", "notices": []},
            {"summary": {"length": 2500, "duration": 600},
             "polyline": "BFoz5xJ67i1B1B7PzIhaxL7Y", "notices":
                 [{"severity": "critical", "code": "violatedVehicleRestriction"}]},
        ]}]}
        result = parse_route_payload(source)
        self.assertEqual(result["distanceKm"], 14.5)
        self.assertEqual(result["estimatedTravelMinutes"], 26.7)
        self.assertIsNone(result["safeToDrive"])
        self.assertFalse(result["alternativeRouteApproved"])
        self.assertTrue(result["criticalVehicleRestrictions"])
        self.assertEqual(result["routingStatus"], "PROVIDER_RESTRICTION_REVIEW_REQUIRED")
        self.assertEqual(len(result["sections"]), 2)

    def test_bad_geometry_rejected(self):
        with self.assertRaisesRegex(ValueError, "MISSING_ROUTE_GEOMETRY"):
            parse_route_payload({"routes": [{"sections": [{"summary": {
                "length": 5, "duration": 5
            }}]}]})

    def test_out_of_saudi_bbox_rejected(self):
        item = request()
        item["origin"]["lat"] = 50
        response = client.post("/api/truck-routes/here", json=item)
        self.assertEqual(response.status_code, 422)

    def test_no_valid_route_never_becomes_default(self):
        with self.assertRaisesRegex(ValueError, "NO_ROUTE_AVAILABLE"):
            parse_route_payload({"routes": []})


if __name__ == "__main__":
    unittest.main()
