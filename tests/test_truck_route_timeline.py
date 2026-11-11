import unittest
from datetime import datetime, timezone
from truck_route_timeline import route_timeline
from valhalla_truck_routes import normalize_result as valhalla_normalize, RouteRequest
from here_truck_routes import parse_route_payload

DEPART = "2026-11-11T08:00:00Z"
SECTIONS = [{"distanceKm": 30, "durationMinutes": 30}, {"distanceKm": 40, "durationMinutes": 45}]

class TimelineTests(unittest.TestCase):
    def test_arrivals_are_from_provider_summaries(self):
        data = route_timeline(SECTIONS, DEPART, expected_minutes=75, expected_km=70)
        self.assertEqual(data["status"], "ETA_TIMELINE_ESTIMATED")
        self.assertEqual(data["segments"][0]["estimatedArrivalEndUtc"], "2026-11-11T08:30:00Z")
        self.assertEqual(data["segments"][1]["estimatedArrivalStartUtc"], "2026-11-11T08:30:00Z")
        self.assertEqual(data["estimatedArrivalUtc"], "2026-11-11T09:15:00Z")
        self.assertIsNone(data["safeToDrive"])
        self.assertFalse(data["alternativeRouteApproved"])

    def test_missing_and_mismatched_segments_are_not_inferred(self):
        self.assertEqual(route_timeline(SECTIONS, None)["status"], "UNAVAILABLE_NO_VALID_DEPARTURE")
        self.assertEqual(route_timeline(SECTIONS, "2026-11-11T08:00:00")["status"], "UNAVAILABLE_NO_VALID_DEPARTURE")
        self.assertEqual(route_timeline([{"distanceKm":30}], DEPART)["status"], "UNAVAILABLE_MISSING_SEGMENT_ETA")
        self.assertEqual(route_timeline(SECTIONS, DEPART, expected_minutes=180)["status"], "UNAVAILABLE_SEGMENT_TOTAL_MISMATCH")
        self.assertEqual(route_timeline(SECTIONS, DEPART, expected_km=190)["status"], "UNAVAILABLE_SEGMENT_TOTAL_MISMATCH")
        self.assertEqual(route_timeline([{"distanceKm":0,"durationMinutes":0}], DEPART)["status"], "UNAVAILABLE_MISSING_SEGMENT_ETA")

    def test_valhalla_per_leg_data_and_backward_compatibility(self):
        response = {"trip":{"summary":{"length":70,"time":4500},"legs":[
          {"shape":"safePoly1","summary":{"length":30,"time":1800}},
          {"shape":"safePoly2","summary":{"length":40,"time":2700}}]}}
        valid = valhalla_normalize(response, datetime.fromisoformat("2026-11-11T08:00:00+00:00"))
        self.assertEqual(valid["timeline"]["status"], "ETA_TIMELINE_ESTIMATED")
        self.assertEqual(valid["sections"][1]["durationMinutes"],45)
        self.assertIsNone(valid["safeToDrive"])
        self.assertEqual(valhalla_normalize(response)["timeline"]["status"],"UNAVAILABLE_NO_VALID_DEPARTURE")
        missing = {"trip":{"summary":{"length":70,"time":4500},"legs":[{"shape":"safePoly1"}]}}
        self.assertEqual(valhalla_normalize(missing, datetime.now(timezone.utc))["timeline"]["status"],"UNAVAILABLE_MISSING_SEGMENT_ETA")

    def test_valhalla_naive_time_rejected(self):
        data = {"origin":{"lat":21.54,"lon":39.17},"destination":{"lat":21.39,"lon":39.85},
            "vehicle":{"gross_weight_tons":18,"height_meters":4,"width_meters":2.5,"length_meters":14,
                       "axle_load_tons":8,"axle_count":5},"departure_time_utc":"2026-11-11T08:00:00"}
        with self.assertRaises(ValueError):
            RouteRequest(**data)

    def test_here_timeline_preserves_source_sections(self):
        response = {"routes":[{"sections":[
            {"polyline":"abc","summary":{"length":30000,"duration":1800},"notices":[]},
            {"polyline":"xyz","summary":{"length":40000,"duration":2700},"notices":[]}]}]}
        parsed = parse_route_payload(response, datetime(2026,11,11,8,0,tzinfo=timezone.utc))
        self.assertEqual(parsed["timeline"]["status"],"ETA_TIMELINE_ESTIMATED")
        self.assertEqual(parsed["timeline"]["segments"][1]["estimatedArrivalEndUtc"],"2026-11-11T09:15:00Z")
        self.assertFalse(parsed["alternativeRouteApproved"])
        self.assertIsNone(parsed["safeToDrive"])

if __name__ == "__main__":
    unittest.main()
