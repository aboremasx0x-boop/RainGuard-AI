import json
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from scan_route_hydrorivers_local import (
    route_points,river_features,scan,sq_segment_distance,checked_point,
)

def route():
    return {"type":"FeatureCollection","reportType":"RESEARCH_ONLY_PUBLIC_DEMO_GEOMETRY",
        "safeToDrive":None,"alternativeRouteApproved":False,
        "features":[{"type":"Feature","geometry":{"type":"LineString",
         "coordinates":[[39.1728,21.5433],[39.4,21.5],[39.8579,21.3891]]}}]}

def tile(geometries):
    return {"type":"FeatureCollection","features":[
        {"type":"Feature","properties":{"HYRIV_ID":i+1},
         "geometry":{"type":"LineString","coordinates":points}}
        for i,points in enumerate(geometries)]}

class Tests(unittest.TestCase):
    def test_intersecting_line_is_proximity_only_never_crossing(self):
        pts=route_points(route())
        rivers=river_features(tile([
            [[39.4,21.6],[39.4,21.4]],
            [[39.7,22.1],[39.8,22.2]],
        ]))
        result=scan(pts,rivers)
        self.assertEqual(result["nearbyRiverCount"],1)
        self.assertEqual(result["nearbyRivers"][0]["approximateProximityMeters"],0)
        self.assertFalse(result["officialRoadCrossingConfirmed"])
        self.assertIsNone(result["safeToDrive"])
        self.assertFalse(result["alternativeRouteApproved"])
        self.assertEqual(result["hydrologicFloodRisk"],"NOT_EVALUATED")

    def test_no_rivers_is_not_safe(self):
        result=scan(route_points(route()),river_features(tile([])))
        self.assertEqual(result["nearbyRiverCount"],0)
        self.assertEqual(result["dataCompleteness"],"SINGLE_TILE_RESEARCH_COVERAGE_ONLY")
        self.assertIsNone(result["safeToDrive"])

    def test_parallel_segments_near(self):
        a,b=(0,0),(10,0)
        self.assertAlmostEqual(sq_segment_distance(a,b,(2,10),(8,10)),100)
        self.assertAlmostEqual(sq_segment_distance(a,b,(5,-2),(5,2)),0)

    def test_invalid_or_wrong_coordinate_rejected(self):
        p=route()
        p["safeToDrive"]=True
        with self.assertRaises(ValueError):route_points(p)
        p["safeToDrive"]=None
        p["features"][0]["geometry"]["coordinates"][0]=[200,90]
        with self.assertRaises(ValueError):route_points(p)
        with self.assertRaises(ValueError):river_features(tile([[[39.2,21.5],[99,99]]]))
        with self.assertRaises(ValueError):checked_point([39.2,float("nan")])

    def test_tile_enforces_features_and_identifier(self):
        bad=tile([[[39.2,21.4],[39.3,21.4]]])
        bad["features"][0]["properties"]={}
        with self.assertRaises(ValueError):river_features(bad)
        with self.assertRaises(ValueError):scan(route_points(route()),[],threshold=10000)

if __name__=="__main__":unittest.main()
