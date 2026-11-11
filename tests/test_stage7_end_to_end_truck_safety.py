"""RainGuard stage 7: cross-gate non-operational safety invariants.

This is a synthetic integration test, NOT a pilot on Saudi roads.
"""
import unittest

from truck_route_timeline import route_timeline
from truck_segment_weather_exposure import assess_route_exposure
from truck_hydrology_evidence_gate import review_route_evidence
from truck_official_alerts_gate import review_official_notices

NOW="2026-11-11T08:00:00Z"
WHEN="2026-11-11T09:00:00Z"

def hourly(**overrides):
    return {"provider":"weatherapi", "issuedAtUtc":"2026-11-11T07:00:00Z",
        "fetchedAtUtc":"2026-11-11T07:45:00Z",
        "validFromUtc":"2026-11-11T09:00:00Z",
        "validToUtc":"2026-11-11T10:00:00Z",
        "lat":21.5, "lon":39.2, "rainProbabilityPct":76,
        "rainMmPerHour":2, **overrides}

class EndToEndSafetyTests(unittest.TestCase):
    def test_missing_real_routing_and_official_data_fails_closed(self):
        timeline=route_timeline([{"durationMinutes":30,"distanceKm":22}],WHEN,30,22)
        self.assertEqual(timeline["status"],"ETA_TIMELINE_ESTIMATED")
        self.assertEqual(timeline["segments"][0]["weatherExposureStatus"],"NOT_ASSESSED")
        exposure=assess_route_exposure(timeline,{"0":[hourly()]},NOW)
        self.assertEqual(exposure["status"],"INCOMPLETE_EXPOSURE_EVIDENCE")
        hydro=review_route_evidence([0],[],NOW)
        official=review_official_notices([0],[],{},NOW)
        for result in (timeline,exposure,hydro,official):
            self.assertIsNone(result["safeToDrive"])
            self.assertFalse(result["alternativeRouteApproved"])
        self.assertFalse(exposure["operationalWarningApproved"])
        self.assertFalse(official["operationalWarningApproved"])
        self.assertEqual(hydro["hydrologicFloodRisk"],"NOT_VALIDATED")
        self.assertEqual(official["roadClosureStatus"],"UNKNOWN")

    def test_verified_synthetic_location_and_rain_does_not_authorize_road(self):
        timeline=route_timeline([{"durationMinutes":30,"distanceKm":22}],WHEN,30,22)
        segment=dict(timeline["segments"][0],verifiedMidpoint={"lat":21.5,"lon":39.2},
                     routeGeometryVerified=True)
        timeline["segments"]=[segment]
        exposure=assess_route_exposure(timeline,{"0":[hourly()]},NOW)
        self.assertEqual(exposure["status"],"POTENTIAL_RAIN_EXPOSURE")
        self.assertFalse(exposure["operationalWarningApproved"])
        self.assertEqual(exposure["floodRisk"],"NOT_EVALUATED")
        self.assertIsNone(exposure["safeToDrive"])

    def test_even_mocked_official_closure_never_grants_route_approval(self):
        authorities={"test-road":{"identityVerified":True,"allowedKinds":["ROAD_CLOSURE"]}}
        mock={"recordId":"fixture-1","authorityId":"test-road","kind":"ROAD_CLOSURE",
              "issuedAtUtc":"2026-11-11T07:00:00Z","validFromUtc":"2026-11-11T07:30:00Z",
              "validUntilUtc":"2026-11-11T12:00:00Z","sectionIndices":[0],
              "sourceReference":"synthetic-fixture","ingestionAuthenticated":True,
              "originalRecordVerified":True,"spatialMatchVerified":True,
              "independentReviewCompleted":True}
        result=review_official_notices([0],[mock],authorities,NOW)
        self.assertEqual(result["roadClosureStatus"],"OFFICIAL_CLOSURE_REPORTED_REVIEW_REQUIRED")
        self.assertFalse(result["officialFeedsConnected"])
        self.assertTrue(result["requiresHumanReview"])
        self.assertFalse(result["operationalWarningApproved"])
        self.assertIsNone(result["safeToDrive"])

if __name__=="__main__":
    unittest.main()
