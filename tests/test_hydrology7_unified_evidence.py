import copy
import csv
import io
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from build_hydrology7_unified_evidence import unify,to_csv,STATUS
from build_hydrology3_evidence_register import build_register
from build_hydrology2_review_sites import make_report
from scan_route_hydrorivers_local import route_points,river_features
from test_route_hydrorivers_local import route,tile


def examples():
    hydro2=make_report(route_points(route()),river_features(tile([
        [[39.4,21.6],[39.4,21.4]],
        [[39.7,21.45],[39.7,21.35]],
    ])))
    hydro3=build_register(hydro2)
    acc_sites=[]
    dem_sites=[]
    for index,site in enumerate(hydro3["sites"]):
        common={key:site[key] for key in ("siteId","latitude","longitude")}
        acc_sites.append({**common,"gridStatus":"ACC_CELL_PRESENT_UNVERIFIED",
          "accumulatedUpstreamCellCount":100+index,
          "roadElevationMeters":None,"culvertEvidence":"MISSING",
          "bridgeEvidence":"MISSING","floodRisk":"NOT_EVALUATED"})
        dem_sites.append({**common,"sampleStatus":"WINDOW_SAMPLES_PRESENT_UNVERIFIED",
          "centerTerrainMeters":100,"minTerrainMeters":90,"maxTerrainMeters":110,
          "medianTerrainMeters":101,"maxMinusMinMeters":20,"centerMinusMedianMeters":-1,
          "roadSurfaceElevationMeters":None,"roadCrossingVerified":False,
          "bridgeOrCulvertStatus":"UNKNOWN","floodRisk":"NOT_EVALUATED"})
    hydro4={
        "reportType":"RAINGUARD_HYDROLOGY4_ACC_READINESS_ONLY",
        "status":"FLOW_ACCUMULATION_CONTEXT_ONLY_NOT_ELEVATION",
        "safeToDrive":None,"alternativeRouteApproved":False,"operationalWarningApproved":False,
        "accIsDemElevation":False,"demElevationVerifiedCount":0,"bridgeCulvertVerifiedCount":0,
        "siteCount":len(acc_sites),"sites":acc_sites,
    }
    hydro6={
        "reportType":"RAINGUARD_HYDROLOGY6_LOCAL_TERRAIN_WINDOWS",
        "status":"LOCAL_DEM_NEIGHBORHOOD_DESCRIPTIVES_UNVERIFIED",
        "safeToDrive":None,"alternativeRouteApproved":False,"operationalWarningApproved":False,
        "validatedDEMProvenanceCount":0,"verifiedRoadSurfaceElevationCount":0,
        "bridgeCulvertVerifiedCount":0,"sourceTile":"N21E039.hgt",
        "siteCount":len(dem_sites),"sites":dem_sites,
    }
    return [hydro2,hydro3,hydro4,hydro6]


class UnifiedTests(unittest.TestCase):
    def test_valid_merge_preserves_all_sources_without_ranking(self):
        report=unify(*examples())
        self.assertEqual(report["status"],STATUS)
        self.assertEqual(report["siteCount"],2)
        self.assertEqual(report["accContextPresentSiteCount"],2)
        self.assertEqual(report["completeTerrainWindowSiteCount"],2)
        self.assertEqual(report["verifiedFloodRiskAssessmentCount"],0)
        self.assertIsNone(report["riskRanking"])
        self.assertIsNone(report["safeToDrive"])
        self.assertFalse(report["alternativeRouteApproved"])
        site=report["sites"][0]
        self.assertEqual(site["accUpstreamContributingCellCount"],100)
        self.assertEqual(site["srtmTerrainNeighborhood"]["maxMinusMinMeters"],20)
        self.assertEqual(len(site["missingEvidenceCategories"]),5)
        self.assertEqual(site["actualWadiCrossing"],"NOT_CONFIRMED")
        self.assertEqual(site["independentEvidenceReview"],"NOT_PERFORMED")
        lines=list(csv.DictReader(io.StringIO(to_csv(report))))
        self.assertEqual(len(lines),2)
        self.assertEqual(lines[0]["hydrologicFloodRisk"],"NOT_EVALUATED")

    def test_mismatched_sites_and_coordinates_fail_closed(self):
        samples=examples()
        samples[2]["sites"].pop()
        samples[2]["siteCount"]-=1
        with self.assertRaisesRegex(ValueError,"MISMATCHED_SITE_IDS"):
            unify(*samples)
        samples=examples()
        samples[3]["sites"][0]["latitude"]+=0.01
        with self.assertRaisesRegex(ValueError,"MISMATCHED_COORDINATES"):
            unify(*samples)

    def test_unsafe_or_falsified_approvals_rejected(self):
        for i,field,value in ((2,"safeToDrive",True),
                              (3,"alternativeRouteApproved",True),
                              (1,"independentlyVerifiedEvidenceCount",5)):
            reports=examples()
            reports[i][field]=value
            with self.assertRaises(ValueError):unify(*reports)
        reports=examples()
        reports[1]["sites"][0]["evidenceChecklist"][0]["independentReviewStatus"]="APPROVED"
        with self.assertRaises(ValueError):unify(*reports)

    def test_zero_and_missing_acc_distinct_from_safety(self):
        reports=examples()
        reports[2]["sites"][0]["accumulatedUpstreamCellCount"]=0
        reports[2]["sites"][1]["accumulatedUpstreamCellCount"]=None
        reports[2]["sites"][1]["gridStatus"]="ACC_NODATA"
        report=unify(*reports)
        self.assertEqual(report["accContextPresentSiteCount"],1)
        self.assertEqual(report["sites"][0]["accUpstreamContributingCellCount"],0)
        self.assertIsNone(report["sites"][1]["accUpstreamContributingCellCount"])
        self.assertIsNone(report["safeToDrive"])

    def test_void_dem_never_used_as_complete(self):
        reports=examples()
        site=reports[3]["sites"][0]
        site.update({"sampleStatus":"CENTER_VOID","centerTerrainMeters":None,
          "minTerrainMeters":None,"maxTerrainMeters":None,"medianTerrainMeters":None,
          "maxMinusMinMeters":None,"centerMinusMedianMeters":None})
        report=unify(*reports)
        self.assertEqual(report["completeTerrainWindowSiteCount"],1)
        self.assertIsNone(report["sites"][0]["srtmTerrainNeighborhood"]["centerTerrainMeters"])
        self.assertIsNone(report["safeToDrive"])
        reports[3]["sites"][0]["maxMinusMinMeters"]=40
        with self.assertRaises(ValueError):unify(*reports)

    def test_missing_review_and_wrong_river_ids_rejected(self):
        reports=examples()
        reports[1]["sites"][0]["evidenceChecklist"][0]["status"]="VERIFIED"
        with self.assertRaises(ValueError):unify(*reports)
        reports=examples()
        reports[1]["sites"][0]["riverIds"]=[9999999]
        with self.assertRaises(ValueError):unify(*reports)


if __name__=="__main__":unittest.main()
