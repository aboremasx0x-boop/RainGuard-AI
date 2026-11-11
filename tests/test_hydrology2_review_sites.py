import csv
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from build_hydrology2_review_sites import (
    closest_pair, project_onto_route, cluster_sites, make_report,
    to_geojson, to_csv,
)
from scan_route_hydrorivers_local import route_points, river_features
from test_route_hydrorivers_local import route, tile


class ReviewSitesTests(unittest.TestCase):
    def setUp(self):
        self.road = route_points(route())

    def test_intersection_has_actual_coordinates_but_not_verified_crossing(self):
        rivers=river_features(tile([[[39.4,21.6],[39.4,21.4]]]))
        report=make_report(self.road,rivers)
        self.assertEqual(report["candidateRiverFeatures"],1)
        self.assertEqual(report["reviewSiteCount"],1)
        witness=report["witnesses"][0]
        self.assertAlmostEqual(witness["roadLongitude"],39.4,5)
        self.assertLess(witness["approximateProximityMeters"],0.1)
        site=report["sites"][0]
        self.assertEqual(site["crossingStatus"],"NOT_CONFIRMED")
        self.assertEqual(site["culvertStatus"],"UNKNOWN")
        self.assertFalse(report["officialRoadCrossingConfirmed"])
        self.assertIsNone(report["safeToDrive"])
        self.assertFalse(report["alternativeRouteApproved"])
        self.assertFalse(report["operationalWarningApproved"])

    def test_segment_distance_is_symmetric_and_fraction_is_on_road(self):
        d,s,t=closest_pair((0,0),(10,0),(5,-3),(5,3))
        self.assertAlmostEqual(d,0,8)
        self.assertAlmostEqual(s,0.5,8)
        self.assertAlmostEqual(t,0.5,8)
        d,s,t=closest_pair((0,0),(10,0),(3,8),(8,8))
        self.assertAlmostEqual(d,64,8)
        self.assertGreaterEqual(s,0)
        self.assertLessEqual(s,1)

    def test_two_nearby_river_features_are_grouped_without_losing_ids(self):
        witnesses=[
            {"riverId":11,"roadLongitude":39.4000,"roadLatitude":21.5000,
             "routeSegmentIndex":1,"routeSegmentFraction":0.1,"approximateProximityMeters":0},
            {"riverId":12,"roadLongitude":39.4004,"roadLatitude":21.5000,
             "routeSegmentIndex":1,"routeSegmentFraction":0.2,"approximateProximityMeters":15},
            {"riverId":13,"roadLongitude":39.4300,"roadLatitude":21.5000,
             "routeSegmentIndex":1,"routeSegmentFraction":0.3,"approximateProximityMeters":30}
        ]
        sites=cluster_sites(witnesses,self.road)
        self.assertEqual(len(sites),2)
        self.assertEqual(sites[0]["riverIds"],[11,12])
        self.assertEqual(sites[1]["riverIds"],[13])

    def test_empty_data_never_means_safe(self):
        report=make_report(self.road,river_features(tile([])))
        self.assertEqual(report["candidateRiverFeatures"],0)
        self.assertEqual(report["reviewSiteCount"],0)
        self.assertIsNone(report["safeToDrive"])
        self.assertEqual(report["coverage"],"ONE_RESEARCH_TILE_ONLY_NOT_COMPLETE")

    def test_geojson_and_csv_keep_provenance_and_coordinates(self):
        report=make_report(self.road,river_features(tile([
            [[39.4,21.6],[39.4,21.4]],
        ])))
        geo=to_geojson(report)
        self.assertEqual(geo["type"],"FeatureCollection")
        self.assertEqual(geo["reportType"],"RAINGUARD_HYDROLOGY2_REVIEW_SITES_ONLY")
        self.assertEqual(geo["features"][0]["geometry"]["type"],"Point")
        self.assertEqual(geo["features"][0]["geometry"]["coordinates"],
                         [report["sites"][0]["longitude"],report["sites"][0]["latitude"]])
        self.assertEqual(geo["safeToDrive"],None)
        records=list(csv.DictReader(io.StringIO(to_csv(report))))
        self.assertEqual(len(records),1)
        self.assertEqual(records[0]["siteId"],report["sites"][0]["siteId"])
        self.assertEqual(records[0]["crossingStatus"],"NOT_CONFIRMED")

    def test_reject_duplicate_river_ids_and_thresholds(self):
        rivers=river_features(tile([[[39.4,21.6],[39.4,21.4]]]))
        with self.assertRaises(ValueError):project_onto_route(self.road,rivers+rivers)
        with self.assertRaises(ValueError):project_onto_route(self.road,rivers,threshold=1000)
        with self.assertRaises(ValueError):cluster_sites([],self.road,group_meters=1000)


if __name__=="__main__":
    unittest.main()
