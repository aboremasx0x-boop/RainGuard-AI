import importlib.util
from pathlib import Path
import unittest

SPEC=importlib.util.spec_from_file_location("h20",Path(__file__).parents[1]/"scripts"/"build_hydrology20_spatial_attachment.py")
h20=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(h20)

def fixture():
    sites=["RG-HYDRO-REVIEW-001","RG-HYDRO-REVIEW-002"]
    rows=[]
    for i,s in enumerate(sites):
        rows.append({"siteId":s,"recordId":s+"-NO_OSM_MATCH","latitude":21.1+i*0.1,"longitude":39.1+i*0.1,"osmElement":"","osmUrl":"","siteInspectionStatus":"NOT_PERFORMED","independentEvidenceAuthentication":"NOT_PERFORMED","safeToDrive":None,"floodRisk":"NOT_EVALUATED"})
    return {"reportType":"RAINGUARD_HYDROLOGY10_FIELD_REVIEW_PACKAGE","status":"FIELD_REVIEW_PACKAGE_ONLY_NOT_INSPECTED",
      "safeToDrive":None,"alternativeRouteApproved":False,"operationalWarningApproved":False,
      "hydrologicFloodRisk":"NOT_EVALUATED","verifiedBridgeCulvertCount":0,"completedFieldVisitCount":0,
      "independentReviewCount":0,"inspectionWorksheetCount":2,"siteCount":2,"sourceCandidateMatchCount":0,"worksheets":rows}

class Tests(unittest.TestCase):
 def test_valid_unmatched_research_sites(self):
    rows=h20.derive(fixture())
    self.assertEqual(len(rows),2)
    self.assertTrue(all(s["noOsmMatch"] for s in rows))
 def test_reject_duplicate(self):
    x=fixture();x["worksheets"][1]=x["worksheets"][0].copy()
    with self.assertRaises(ValueError):h20.derive(x)
 def test_reject_invented_approval(self):
    x=fixture();x["safeToDrive"]=True
    with self.assertRaises(ValueError):h20.derive(x)
 def test_reject_conflicting_site_position(self):
    x=fixture();r=x["worksheets"][0].copy();r["recordId"]=r["siteId"]+"-way-123";r["osmElement"]="way/123";r["osmUrl"]="https://www.openstreetmap.org/way/123";r["latitude"]=21.9
    x["worksheets"].append(r);x["inspectionWorksheetCount"]=3;x["sourceCandidateMatchCount"]=1
    with self.assertRaises(ValueError):h20.derive(x)
 def test_reject_mismatched_source_count(self):
    x=fixture();x["sourceCandidateMatchCount"]=1
    with self.assertRaises(ValueError):h20.derive(x)
 def test_reject_wrong_osm(self):
    x=fixture();x["worksheets"][0]["osmUrl"]="https://unsafe.example/way/123"
    with self.assertRaises(ValueError):h20.derive(x)
 def test_reject_wrong_coordinates(self):
    x=fixture();x["worksheets"][0]["latitude"]=float("nan")
    with self.assertRaises(ValueError):h20.derive(x)

if __name__=="__main__":unittest.main()
