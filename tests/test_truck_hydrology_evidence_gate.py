import unittest
from truck_hydrology_evidence_gate import review_route_evidence

NOW="2026-11-11T09:00:00Z"
TYPES=["verified_dem","wadi_network","culvert_inventory","flood_model_validation","official_road_closure"]

def record(kind, section=0, **extras):
    return {"sectionIndex":section,"evidenceType":kind,
        "verifiedAtUtc":"2026-11-11T07:00:00Z","validUntilUtc":"2026-11-12T07:00:00Z",
        "evidenceId":"test-"+kind,"sourceReference":"synthetic-test-only",
        "sourceAuthenticityVerified":True, "spatialMatchVerified":True,
        "temporalMatchVerified":True,"independentReviewCompleted":True,**extras}

class Tests(unittest.TestCase):
    def test_missing_layers_are_unknown_not_safe(self):
        data=review_route_evidence([0,1],[record("verified_dem")],NOW)
        self.assertEqual(data["status"],"INCOMPLETE_EVIDENCE")
        self.assertEqual(data["roadClosureStatus"],"UNKNOWN")
        self.assertIsNone(data["safeToDrive"])
        self.assertFalse(data["alternativeRouteApproved"])
        self.assertFalse(data["operationalWarningApproved"])
        self.assertEqual(len(data["segmentEvidence"][1]["missingEvidenceTypes"]),5)

    def test_unreviewed_stale_or_out_of_scope_rejected(self):
        rows=[
           record("verified_dem",independentReviewCompleted=False),
           record("wadi_network",validUntilUtc="2026-11-10T00:00:00Z"),
           record("culvert_inventory",spatialMatchVerified=False),
           record("flood_model_validation",sourceReference=""),
           record("official_road_closure",verifiedAtUtc="2026-11-12T09:00:00Z"),
           record("unsupported"),
        ]
        result=review_route_evidence([0],rows,NOW)
        self.assertEqual(result["segmentEvidence"][0]["rejectedEvidenceRecords"],6)
        self.assertEqual(result["segmentEvidence"][0]["verifiedEvidenceTypes"],[])

    def test_complete_evidence_still_needs_human_review(self):
        result=review_route_evidence([0],[record(t) for t in TYPES],NOW)
        self.assertEqual(result["status"],"EVIDENCE_COMPLETE_REQUIRES_HUMAN_REVIEW")
        self.assertEqual(result["segmentEvidence"][0]["reviewStatus"],"REVIEW_POSSIBLE_NOT_APPROVED")
        self.assertEqual(result["hydrologicFloodRisk"],"NOT_VALIDATED")
        self.assertIsNone(result["safeToDrive"])
        self.assertFalse(result["operationalWarningApproved"])

    def test_invalid_input(self):
        self.assertEqual(review_route_evidence([0,0],[],NOW)["status"],"INVALID_ROUTE_OR_TIME")
        self.assertEqual(review_route_evidence([0],[],"bad")["status"],"INVALID_ROUTE_OR_TIME")

if __name__=="__main__":
    unittest.main()
