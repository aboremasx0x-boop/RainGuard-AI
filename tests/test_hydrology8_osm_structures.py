import copy
import csv
import io
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from review_hydrology8_osm_structures import audit,query_for_sites,site_csv,sites_from_report,distance_to_feature

def base():
    rows=[]
    for n,(lat,lon) in enumerate(((21.5,39.4),(21.45,39.5)),1):
        rows.append({"siteId":f"RG-HYDRO-REVIEW-{n:03d}",
           "latitude":lat,"longitude":lon,"actualWadiCrossing":"NOT_CONFIRMED",
           "bridgeCulvertEvidence":"NOT_VERIFIED","hydrologicFloodRisk":"NOT_EVALUATED",
           "safeToDrive":None})
    return {"reportType":"RAINGUARD_HYDROLOGY7_UNIFIED_EVIDENCE",
      "status":"UNIFIED_RESEARCH_EVIDENCE_NOT_OPERATIONALLY_VALIDATED",
      "siteCount":2,"verifiedFloodRiskAssessmentCount":0,
      "independentlyVerifiedRoadCrossingCount":0,"independentlyVerifiedBridgeCulvertCount":0,
      "safeToDrive":None,"alternativeRouteApproved":False,"operationalWarningApproved":False,
      "riskRanking":None,"sites":rows}

def osm_data():
    return {"elements":[
      {"type":"way","id":123,"tags":{"highway":"primary","bridge":"yes"},
       "geometry":[{"lat":21.499,"lon":39.399},{"lat":21.501,"lon":39.401}]},
      {"type":"way","id":124,"tags":{"waterway":"stream","tunnel":"culvert"},
       "geometry":[{"lat":21.5001,"lon":39.3998},{"lat":21.4999,"lon":39.4002}]},
      {"type":"way","id":125,"tags":{"highway":"primary","bridge":"no"},
       "geometry":[{"lat":21.5,"lon":39.4},{"lat":21.5,"lon":39.401}]},
    ]}

class Hydrology8Tests(unittest.TestCase):
    def test_generates_bounded_query_not_api_request(self):
        q=query_for_sites(sites_from_report(base()))
        self.assertIn("around:250,21.5000000,39.4000000",q)
        self.assertIn('way["waterway"]["tunnel"="culvert"]',q)
        self.assertIn("out geom;",q)
        self.assertNotIn("http",q)

    def test_matching_does_not_verify_actual_crossing(self):
        r=audit(base(),osm_data())
        self.assertEqual(r["siteCount"],2)
        self.assertEqual(r["matchedSiteCount"],1)
        self.assertEqual(r["totalCandidateMatches"],2)
        self.assertEqual(r["sites"][1]["structureEvidenceStatus"],"NO_MAPPED_CANDIDATE_IN_SUPPLIED_SNAPSHOT")
        self.assertEqual(r["independentlyVerifiedBridgeCulvertCount"],0)
        self.assertIsNone(r["riskRanking"])
        self.assertIsNone(r["safeToDrive"])
        self.assertFalse(r["alternativeRouteApproved"])
        self.assertEqual(r["candidates"][0]["sourceVerification"],"COMMUNITY_MAP_UNVERIFIED")
        self.assertFalse(r["candidates"][0]["verifiedPhysicalCrossing"])
        self.assertEqual(len(list(csv.DictReader(io.StringIO(site_csv(r))))),2)

    def test_degenerate_geometry_uses_segment_distance(self):
        self.assertAlmostEqual(distance_to_feature(39.4,21.5,[[39.4,21.5],[39.4,21.5]]),0)
        self.assertLess(distance_to_feature(39.4,21.5,[[39.399,21.5],[39.401,21.5]]),1)

    def test_untrusted_statuses_fail_closed(self):
        for field,value in (("safeToDrive",True),("riskRanking",[]),
                            ("independentlyVerifiedBridgeCulvertCount",1)):
            b=base()
            b[field]=value
            with self.assertRaises(ValueError):audit(b,osm_data())
        b=base()
        b["sites"][0]["actualWadiCrossing"]="CONFIRMED"
        with self.assertRaises(ValueError):audit(b,osm_data())

    def test_malformed_and_duplicate_elements(self):
        o=osm_data()
        o["elements"].append(copy.deepcopy(o["elements"][0]))
        self.assertEqual(audit(base(),o)["totalCandidateMatches"],2)
        o={"elements":[{"type":"relation","id":1}]}
        with self.assertRaises(ValueError):audit(base(),o)

    def test_untrusted_and_missing_geometry_do_not_become_evidence(self):
        o={"elements":[
          {"type":"way","id":100,"tags":{"highway":"primary","bridge":"yes"}},
          {"type":"way","id":101,"tags":{"waterway":"stream","tunnel":"no"},
           "geometry":[{"lat":21.5,"lon":39.4}]},
        ]}
        r=audit(base(),o)
        self.assertEqual(r["totalCandidateMatches"],0)
        self.assertEqual(r["independentlyVerifiedBridgeCulvertCount"],0)

if __name__=="__main__":unittest.main()
