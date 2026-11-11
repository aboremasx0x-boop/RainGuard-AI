import copy
import csv
import io
import sys
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from audit_hydrology9_osm_geometry import build_report,minimum_distance_meters,to_csv,indexed_h8
from review_hydrology8_osm_structures import audit as audit8
from test_hydrology7_unified_evidence import examples
from build_hydrology7_unified_evidence import unify
from test_route_hydrorivers_local import route,tile


def fixture():
    h7=unify(*examples())
    site=h7["sites"][0]
    lon,lat=site["longitude"],site["latitude"]
    osm={"elements":[
        {"type":"way","id":1234,"tags":{"highway":"primary","bridge":"yes"},
         "geometry":[{"lon":lon-0.001,"lat":lat},{"lon":lon+0.001,"lat":lat}]},
        {"type":"way","id":2001,"tags":{"waterway":"stream","tunnel":"culvert"},
         "geometry":[{"lon":lon,"lat":lat-0.0005},{"lon":lon,"lat":lat+0.0005}]},
    ]}
    h8=audit8(h7,osm)
    rivers=tile([[[39.4,21.6],[39.4,21.4]],[[39.7,21.45],[39.7,21.35]]])
    return h7,h8,osm,route(),rivers


class GeometryAuditTests(unittest.TestCase):
    def test_candidate_geometry_context_still_not_crossing(self):
        report=build_report(*fixture())
        self.assertEqual(report["siteCount"],2)
        self.assertGreater(report["sourceCandidateMatchCount"],0)
        self.assertEqual(report["verifiedBridgeCulvertCount"],0)
        self.assertEqual(report["verifiedPhysicalCrossingCount"],0)
        self.assertIsNone(report["riskRanking"])
        self.assertIsNone(report["safeToDrive"])
        self.assertFalse(report["alternativeRouteApproved"])
        for c in report["candidates"]:
            self.assertEqual(c["physicalRoadWadiCrossing"],"NOT_VERIFIED")
            self.assertEqual(c["culvertCapacityEvidence"],"MISSING")
            self.assertIsInstance(c["distanceToResearchRouteMeters"],float)
            self.assertIsInstance(c["distanceToCandidateHydroRiverMeters"],float)
        self.assertEqual(len(list(csv.DictReader(io.StringIO(to_csv(report))))),report["sourceCandidateMatchCount"])

    def test_crossing_lines_do_not_become_certified(self):
        a=[[39.39,21.5],[39.41,21.5]]
        b=[[39.4,21.49],[39.4,21.51]]
        self.assertEqual(minimum_distance_meters(a,b,21.5),0.0)

    def test_wrong_or_missing_source_geometry_rejected(self):
        data=list(fixture())
        data[2]={"elements":[]}
        with self.assertRaisesRegex(ValueError,"SNAPSHOT_NOT_MATCHING"):build_report(*data)
        data=list(fixture())
        data[2]["elements"][0]["tags"]={"bridge":"no","highway":"primary"}
        with self.assertRaises(ValueError):build_report(*data)

    def test_adversarial_approval_rejected(self):
        data=list(fixture())
        data[1]["candidates"][0]["verifiedPhysicalCrossing"]=True
        with self.assertRaises(ValueError):build_report(*data)
        data=list(fixture())
        data[1]["sites"][0]["safeToDrive"]=True
        with self.assertRaises(ValueError):build_report(*data)

    def test_wrong_river_identifiers_rejected(self):
        data=list(fixture())
        data[4]=tile([[[39.8,21.6],[39.8,21.4]]])
        with self.assertRaisesRegex(ValueError,"HYDRORIVERS_ID_NOT_IN_TILE"):build_report(*data)

    def test_duplicate_candidates_rejected(self):
        data=list(fixture())
        data[1]["candidates"].append(copy.deepcopy(data[1]["candidates"][0]))
        data[1]["totalCandidateMatches"]+=1
        with self.assertRaisesRegex(ValueError,"DUPLICATE_MATCH"):build_report(*data)


if __name__=="__main__":unittest.main()
