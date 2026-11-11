import csv
import io
import json
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from build_hydrology3_evidence_register import (
    build_register, review_csv, blank_evidence_csv, CATEGORIES,
    validated_sites, evidence_submissions,
)
from build_hydrology2_review_sites import make_report
from scan_route_hydrorivers_local import route_points,river_features
from test_route_hydrorivers_local import route,tile

class RegisterTests(unittest.TestCase):
    def setUp(self):
        self.hydro=make_report(route_points(route()),river_features(tile([
            [[39.4,21.6],[39.4,21.4]],[[39.7,21.5],[39.7,21.35]]
        ])))
        self.site=self.hydro["sites"][0]["siteId"]

    def test_missing_evidence_has_no_approved_sites(self):
        result=build_register(self.hydro)
        self.assertEqual(result["siteCount"],2)
        self.assertEqual(result["independentlyVerifiedEvidenceCount"],0)
        self.assertIsNone(result["safeToDrive"])
        self.assertFalse(result["alternativeRouteApproved"])
        self.assertFalse(result["operationalWarningApproved"])
        for item in result["sites"]:
            self.assertEqual(len(item["missingEvidenceCategories"]),len(CATEGORIES))
            self.assertEqual(item["reviewStatus"],"HUMAN_REVIEW_REQUIRED")
            self.assertEqual(item["wadiCrossingStatus"],"NOT_CONFIRMED")
            self.assertEqual(item["officialRoadClosureStatus"],"UNKNOWN")

    def test_submissions_do_not_become_verified(self):
        items=[{"siteId":self.site,"category":x,"sourceReference":"claimed-doc-"+x,
                "sourceOrganization":"user-supplied","observedAtUtc":"",
                "submittedBy":"reviewer","notes":"not verified"} for x in CATEGORIES]
        result=build_register(self.hydro,items)
        self.assertEqual(result["submittedReferenceCount"],5)
        self.assertEqual(result["independentlyVerifiedEvidenceCount"],0)
        self.assertEqual(result["sites"][0]["missingEvidenceCategories"],[])
        self.assertEqual(result["sites"][0]["reviewStatus"],"HUMAN_REVIEW_REQUIRED")
        self.assertTrue(all(x["status"]=="SUBMITTED_UNVERIFIED" for x in result["sites"][0]["evidenceChecklist"]))
        self.assertTrue(all(x["independentReviewStatus"]=="NOT_PERFORMED" for x in result["sites"][0]["evidenceChecklist"]))
        self.assertIsNone(result["sites"][0]["safeToDrive"])

    def test_conflicting_status_injection_rejected(self):
        good={"siteId":self.site,"category":CATEGORIES[0],
              "sourceReference":"source","sourceOrganization":"agency",
              "observedAtUtc":"","submittedBy":"","notes":""}
        with self.assertRaises(ValueError):
            build_register(self.hydro,[{**good,"independentReviewCompleted":True}])
        with self.assertRaises(ValueError):
            build_register(self.hydro,[{**good,"category":"official_road_open"}])
        with self.assertRaises(ValueError):
            build_register(self.hydro,[{**good,"siteId":"UNKNOWN"}])

    def test_reject_site_approval_and_wrong_document(self):
        bad=json.loads(json.dumps(self.hydro))
        bad["sites"][0]["verification"]="VERIFIED"
        with self.assertRaises(ValueError):validated_sites(bad)
        bad=json.loads(json.dumps(self.hydro))
        bad["officialRoadCrossingConfirmed"]=True
        with self.assertRaises(ValueError):validated_sites(bad)
        bad=json.loads(json.dumps(self.hydro))
        bad["sites"].append(bad["sites"][0])
        bad["reviewSiteCount"]+=1
        with self.assertRaises(ValueError):validated_sites(bad)

    def test_csv_rows_and_template(self):
        report=build_register(self.hydro)
        rows=list(csv.DictReader(io.StringIO(review_csv(report))))
        self.assertEqual(len(rows),2*len(CATEGORIES))
        self.assertTrue(all(r["evidenceStatus"]=="MISSING_EVIDENCE" for r in rows))
        templates=list(csv.DictReader(io.StringIO(blank_evidence_csv(report))))
        self.assertEqual(len(templates),len(rows))
        self.assertEqual(templates[0]["sourceReference"],"")

if __name__=="__main__":unittest.main()
