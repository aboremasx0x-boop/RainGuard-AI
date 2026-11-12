import copy
import csv
import io
import sys
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from build_hydrology10_field_review import build_package,worksheet_csv,site_csv,check_source
from test_hydrology9_osm_geometry import fixture
from audit_hydrology9_osm_geometry import build_report

class FieldReviewTests(unittest.TestCase):
    def setUp(self):
        self.h9=build_report(*fixture())

    def test_blank_templates_no_approval(self):
        pkg=build_package(self.h9)
        self.assertEqual(pkg["siteCount"],2)
        self.assertEqual(pkg["sourceCandidateMatchCount"],self.h9["sourceCandidateMatchCount"])
        self.assertEqual(pkg["inspectionWorksheetCount"],pkg["sourceCandidateMatchCount"]+1)
        self.assertEqual(pkg["completedFieldVisitCount"],0)
        self.assertEqual(pkg["independentReviewCount"],0)
        self.assertEqual(pkg["verifiedBridgeCulvertCount"],0)
        self.assertIsNone(pkg["safeToDrive"])
        self.assertFalse(pkg["alternativeRouteApproved"])
        self.assertFalse(pkg["operationalWarningApproved"])
        self.assertTrue(all(x["siteInspectionStatus"]=="NOT_PERFORMED" for x in pkg["worksheets"]))
        self.assertTrue(all(x["photoReference"]=="" for x in pkg["worksheets"]))
        self.assertEqual(len(list(csv.DictReader(io.StringIO(worksheet_csv(pkg))))),pkg["inspectionWorksheetCount"])
        self.assertEqual(len(list(csv.DictReader(io.StringIO(site_csv(pkg))))),2)

    def test_no_osm_matches_still_reviewed(self):
        h9=copy.deepcopy(self.h9)
        h9["candidates"]=[]
        h9["sourceCandidateMatchCount"]=0
        for site in h9["sites"]:
            site["geometryCandidateCount"]=0
        pkg=build_package(h9)
        self.assertEqual(pkg["inspectionWorksheetCount"],2)
        self.assertTrue(all(w["osmElement"]=="" for w in pkg["worksheets"]))
        self.assertTrue(all(w["mappedFeatureType"]=="NO_OSM_MATCH_IN_SNAPSHOT" for w in pkg["worksheets"]))
        self.assertIsNone(pkg["safeToDrive"])

    def test_cannot_self_approve_source_report(self):
        for field,value in (("safeToDrive",True),("alternativeRouteApproved",True),
                            ("verifiedPhysicalCrossingCount",2),("hydrologicFloodRisk","LOW")):
            h9=copy.deepcopy(self.h9)
            h9[field]=value
            with self.assertRaises(ValueError):build_package(h9)

    def test_reject_mismatched_candidates_and_url(self):
        h9=copy.deepcopy(self.h9)
        h9["candidates"][0]["osmUrl"]="https://evil.example/way/1234"
        with self.assertRaises(ValueError):build_package(h9)
        h9=copy.deepcopy(self.h9)
        h9["sites"][0]["geometryCandidateCount"]+=1
        with self.assertRaises(ValueError):build_package(h9)
        h9=copy.deepcopy(self.h9)
        h9["candidates"].append(copy.deepcopy(h9["candidates"][0]))
        h9["sourceCandidateMatchCount"]+=1
        with self.assertRaises(ValueError):build_package(h9)

    def test_reject_false_site_inspection(self):
        h9=copy.deepcopy(self.h9)
        h9["sites"][0]["fieldReviewCompleted"]=True
        with self.assertRaises(ValueError):check_source(h9)

if __name__=="__main__":
    unittest.main()
