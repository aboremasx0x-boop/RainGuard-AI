import unittest
from truck_segment_weather_exposure import assess_segment, assess_route_exposure

SEGMENT = {
    "sectionIndex": 0, "estimatedArrivalStartUtc": "2026-11-11T09:00:00Z",
    "estimatedArrivalEndUtc": "2026-11-11T09:45:00Z",
    "verifiedMidpoint": {"lat": 21.5, "lon": 39.2}, "routeGeometryVerified": True,
}
NOW = "2026-11-11T08:00:00Z"

def forecast(**kwargs):
    record = {"provider": "weatherapi", "issuedAtUtc": "2026-11-11T07:00:00Z",
        "fetchedAtUtc": "2026-11-11T07:30:00Z",
        "validFromUtc": "2026-11-11T09:00:00Z", "validToUtc": "2026-11-11T10:00:00Z",
        "lat": 21.5, "lon": 39.2, "rainProbabilityPct": 80,
        "rainMmPerHour": 2.0}
    return {**record, **kwargs}

class RouteWeatherTests(unittest.TestCase):
    def test_verified_hourly_interval_is_exposure_not_flood_risk(self):
        x = assess_segment(SEGMENT, [forecast()], NOW)
        self.assertEqual(x["status"], "POTENTIAL_RAIN_EXPOSURE")
        self.assertEqual(x["rainProbabilityPct"], 80)
        self.assertIsNone(x["safeToDrive"])
        self.assertFalse(x["alternativeRouteApproved"])
        self.assertEqual(x["floodRisk"], "NOT_EVALUATED")

    def test_verified_dry_forecast_never_says_safe(self):
        x = assess_segment(SEGMENT, [forecast(rainProbabilityPct=0, rainMmPerHour=0)], NOW)
        self.assertEqual(x["status"], "RAIN_FORECAST_PRESENT_SAFETY_UNKNOWN")
        self.assertIsNone(x["safeToDrive"])

    def test_unsupported_without_verified_route_midpoint(self):
        x = assess_segment({**SEGMENT, "routeGeometryVerified": False}, [forecast()], NOW)
        self.assertEqual(x["status"], "INSUFFICIENT_ROUTE_EVIDENCE")
        self.assertIsNone(x["rainProbabilityPct"])

    def test_reject_stale_future_nonlocal_and_incomplete(self):
        failures = [
            forecast(fetchedAtUtc="2026-11-11T04:00:00Z"),
            forecast(fetchedAtUtc="2026-11-11T08:10:00Z"),
            forecast(lat=24.7, lon=46.6),
            forecast(validToUtc="2026-11-11T09:15:00Z"),
            forecast(rainProbabilityPct=None),
            forecast(provider="made-up"),
            forecast(issuedAtUtc="2026-11-11T08:30:00Z"),
        ]
        for example in failures:
            with self.subTest(example=example):
                x=assess_segment(SEGMENT, [example], NOW)
                self.assertEqual(x["status"], "INSUFFICIENT_FORECAST_EVIDENCE")
                self.assertIsNone(x["rainProbabilityPct"])

    def test_hourly_continuity_required_for_route_occupancy(self):
        route={**SEGMENT,"estimatedArrivalEndUtc":"2026-11-11T10:45:00Z"}
        r0=forecast()
        r1=forecast(validFromUtc="2026-11-11T10:00:00Z",validToUtc="2026-11-11T11:00:00Z",rainProbabilityPct=40)
        x=assess_segment(route,[r0,r1],NOW)
        self.assertEqual(x["status"],"POTENTIAL_RAIN_EXPOSURE")
        gap=assess_segment(route,[r0,forecast(**{"validFromUtc":"2026-11-11T10:15:00Z",
                  "validToUtc":"2026-11-11T11:15:00Z"})],NOW)
        self.assertEqual(gap["status"],"INSUFFICIENT_FORECAST_EVIDENCE")

    def test_no_routing_provider_or_source_fails_closed(self):
        x = assess_route_exposure({"status":"UNAVAILABLE_NO_VALID_DEPARTURE"}, {}, NOW)
        self.assertEqual(x["status"],"INSUFFICIENT_ROUTE_EVIDENCE")
        self.assertFalse(x["operationalWarningApproved"])
        timeline={"status":"ETA_TIMELINE_ESTIMATED","segments":[SEGMENT]}
        x=assess_route_exposure(timeline, {}, NOW)
        self.assertEqual(x["status"],"INCOMPLETE_EXPOSURE_EVIDENCE")
        self.assertIsNone(x["safeToDrive"])

    def test_route_provider_matching_and_no_fabricated_safety(self):
        timeline={"status":"ETA_TIMELINE_ESTIMATED","segments":[SEGMENT]}
        x=assess_route_exposure(timeline, {"0":[forecast()]}, NOW)
        self.assertEqual(x["status"],"POTENTIAL_RAIN_EXPOSURE")
        self.assertFalse(x["operationalWarningApproved"])
        self.assertEqual(x["segmentResults"][0]["forecastProviders"][0]["provider"],"weatherapi")

if __name__ == "__main__":
    unittest.main()
