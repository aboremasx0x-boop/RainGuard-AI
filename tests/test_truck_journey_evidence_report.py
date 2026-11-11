import unittest
from truck_journey_evidence_report import build_journey_report

DEPART="2026-11-11T09:00:00Z"
ASOF="2026-11-11T08:00:00Z"

def payload():
    return {
        "assessmentTimeUtc":ASOF,
        "route":{"departureTimeUtc":DEPART,"sections":[
            {"distanceKm":20,"durationMinutes":30},
            {"distanceKm":35,"durationMinutes":40}],
            "expectedKm":55,"expectedMinutes":70},
        "validatedSegmentPoints":{},
        "hourlyForecastsBySection":{},
        "hydrologyEvidence":[],
        "officialNotices":[],
        "authorityRegistry":{},
    }

def forecast():
    return {"provider":"weatherapi","issuedAtUtc":"2026-11-11T07:00:00Z",
        "fetchedAtUtc":"2026-11-11T07:50:00Z",
        "validFromUtc":"2026-11-11T09:00:00Z","validToUtc":"2026-11-11T10:00:00Z",
        "lat":21.5,"lon":39.2,"rainProbabilityPct":75,"rainMmPerHour":3}

class ReportTests(unittest.TestCase):
    def test_no_source_does_not_declare_route_safe(self):
        report=build_journey_report(payload())
        self.assertEqual(len(report["segmentReports"]),2)
        self.assertEqual(report["segmentsMissingEvidence"],2)
        self.assertEqual(report["roadClosureStatus"],"UNKNOWN")
        self.assertFalse(report["officialFeedsConnected"])
        self.assertFalse(report["operationalWarningApproved"])
        self.assertIsNone(report["safeToDrive"])
        self.assertFalse(report["alternativeRouteApproved"])
        for row in report["segmentReports"]:
            self.assertIsNone(row["rainProbabilityPct"])
            self.assertIn("INDEPENDENTLY_VERIFIED_SEGMENT_GEOMETRY",row["missingRequirements"])
            self.assertIn("AUTHORITATIVE_NOTICE_COVERAGE",row["missingRequirements"])

    def test_well_matched_hourly_weather_still_not_safe(self):
        p=payload()
        p["validatedSegmentPoints"]={"0":{"midpoint":{"lat":21.5,"lon":39.2},
                                          "independentlyVerified":True}}
        p["hourlyForecastsBySection"]={"0":[forecast()]}
        report=build_journey_report(p)
        self.assertEqual(report["segmentsWithPotentialRainExposure"],1)
        self.assertEqual(report["segmentReports"][0]["rainProbabilityPct"],75)
        self.assertIsNone(report["safeToDrive"])
        self.assertEqual(report["hydrologicFloodRisk"],"NOT_VALIDATED")
        self.assertFalse(report["operationalWarningApproved"])
        self.assertEqual(report["segmentReports"][1]["weatherExposureStatus"],"INSUFFICIENT_ROUTE_EVIDENCE")

    def test_route_totals_mismatch_prevents_fabricated_timeline(self):
        p=payload()
        p["route"]["expectedMinutes"]=200
        report=build_journey_report(p)
        self.assertEqual(report["timelineStatus"],"UNAVAILABLE_SEGMENT_TOTAL_MISMATCH")
        self.assertEqual(report["segmentReports"],[])
        self.assertEqual(report["missingRequirements"],["VALID_PROVIDER_SECTION_ETAS"])

    def test_malformed_or_missing_data(self):
        for case in (None,{},{"route":{}}, {"route":{"departureTimeUtc":DEPART},"assessmentTimeUtc":ASOF,"hourlyForecastsBySection":[] }):
            with self.subTest(case=case),self.assertRaises(ValueError):
                build_journey_report(case)

    def test_official_notice_cannot_approve_route(self):
        p=payload()
        p["authorityRegistry"]={"test-road":{"identityVerified":True,"allowedKinds":["ROAD_CLOSURE"]}}
        p["officialNotices"]=[{
            "recordId":"fixture-1","authorityId":"test-road","kind":"ROAD_CLOSURE",
            "issuedAtUtc":"2026-11-11T07:00:00Z",
            "validFromUtc":"2026-11-11T07:30:00Z","validUntilUtc":"2026-11-11T12:00:00Z",
            "sectionIndices":[0],"sourceReference":"synthetic-fixture",
            "ingestionAuthenticated":True,"originalRecordVerified":True,
            "spatialMatchVerified":True,"independentReviewCompleted":True
        }]
        report=build_journey_report(p)
        self.assertEqual(report["officialRecordsAccepted"],1)
        self.assertTrue(report["segmentReports"][0]["reportedOfficialClosure"])
        self.assertFalse(report["officialFeedsConnected"])
        self.assertIsNone(report["safeToDrive"])
        self.assertFalse(report["alternativeRouteApproved"])

if __name__=="__main__":
    unittest.main()
