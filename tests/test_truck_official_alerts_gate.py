import unittest
from truck_official_alerts_gate import review_official_notices

NOW = "2026-11-11T12:00:00Z"
REGISTRY = {
    "test-road-authority": {"identityVerified": True, "allowedKinds": ["ROAD_CLOSURE", "ROAD_REOPENING"]},
    "test-weather-authority": {"identityVerified": True, "allowedKinds": ["WEATHER_WARNING"]},
}

def notice(kind="ROAD_CLOSURE", **changes):
    return {"recordId": "test-123", "authorityId": "test-road-authority",
            "kind": kind, "issuedAtUtc": "2026-11-11T09:00:00Z",
            "validFromUtc": "2026-11-11T09:00:00Z", "validUntilUtc": "2026-11-11T14:00:00Z",
            "sectionIndices": [0], "sourceReference": "synthetic-fixture",
            "ingestionAuthenticated": True, "originalRecordVerified": True,
            "spatialMatchVerified": True, "independentReviewCompleted": True, **changes}


class TestOfficialNoticeGate(unittest.TestCase):
    def test_no_alerts_never_means_open_or_safe(self):
        x=review_official_notices([0,1], [], REGISTRY, NOW)
        self.assertEqual(x["status"], "PENDING_AUTHORIZED_ALERT_SOURCES")
        self.assertEqual(x["roadClosureStatus"], "UNKNOWN")
        self.assertFalse(x["officialFeedsConnected"])
        self.assertIsNone(x["safeToDrive"])
        self.assertFalse(x["operationalWarningApproved"])

    def test_official_closure_still_requires_review(self):
        x=review_official_notices([0,1], [notice()], REGISTRY, NOW)
        self.assertEqual(x["status"], "VERIFIED_RECORDS_REQUIRE_HUMAN_REVIEW")
        self.assertEqual(x["roadClosureStatus"], "OFFICIAL_CLOSURE_REPORTED_REVIEW_REQUIRED")
        self.assertEqual(x["segmentReviews"][1]["status"], "UNKNOWN_ROAD_STATE")
        self.assertTrue(x["requiresHumanReview"])
        self.assertIsNone(x["safeToDrive"])
        self.assertFalse(x["alternativeRouteApproved"])

    def test_self_claimed_official_and_untrusted_sources_fail(self):
        x=review_official_notices([0], [notice(authorityId="unlisted", official=True)], REGISTRY, NOW)
        self.assertEqual(x["recordsAccepted"],0)
        self.assertEqual(x["rejectedRecords"][0]["reason"],"AUTHORITY_NOT_VERIFIED")
        x=review_official_notices([0], [notice(ingestionAuthenticated=False)], REGISTRY, NOW)
        self.assertEqual(x["recordsAccepted"],0)

    def test_expiry_future_wrong_scope_and_duplicates(self):
        cases=[
          notice(validUntilUtc="2026-11-11T11:00:00Z"),
          notice(issuedAtUtc="2026-11-11T13:00:00Z"),
          notice(sectionIndices=[17]),
          notice(sourceReference=""),
        ]
        x=review_official_notices([0], cases, REGISTRY, NOW)
        self.assertEqual(x["recordsAccepted"],0)
        self.assertEqual(len(x["rejectedRecords"]),4)
        self.assertEqual(x["roadClosureStatus"],"UNKNOWN")

    def test_reopening_does_not_grant_open_status(self):
        reopen=notice(kind="ROAD_REOPENING",supersedesRecordId="older-closure")
        x=review_official_notices([0], [reopen], REGISTRY, NOW)
        self.assertEqual(x["recordsAccepted"],1)
        self.assertEqual(x["roadClosureStatus"],"UNKNOWN")
        self.assertEqual(x["segmentReviews"][0]["status"],"UNKNOWN_ROAD_STATE")
        self.assertIsNone(x["safeToDrive"])

    def test_weather_warning_not_road_closure(self):
        w=notice(kind="WEATHER_WARNING",authorityId="test-weather-authority")
        x=review_official_notices([0],[w],REGISTRY,NOW)
        self.assertEqual(x["segmentReviews"][0]["status"],"OFFICIAL_WEATHER_NOTICE_REVIEW_REQUIRED")
        self.assertEqual(x["roadClosureStatus"],"UNKNOWN")
        self.assertFalse(x["operationalWarningApproved"])

    def test_malformed_notice_kind_fails_gracefully(self):
        result=review_official_notices([0],[notice(kind=["ROAD_CLOSURE"])],REGISTRY,NOW)
        self.assertEqual(result["recordsAccepted"],0)
        self.assertEqual(result["rejectedRecords"][0]["reason"],"UNKNOWN_AUTHORITY_OR_NOTICE_KIND")

    def test_registry_is_required_and_invalid_input_fails(self):
        self.assertEqual(review_official_notices([0],[notice()],{},NOW)["recordsAccepted"],0)
        self.assertEqual(review_official_notices([0,0],[],REGISTRY,NOW)["status"],"INVALID_INPUT")

if __name__=="__main__":
    unittest.main()
