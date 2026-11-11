import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from valhalla_maneuver_timing import build_time_anchors
from export_public_valhalla_route_geojson import extract_geojson
from test_valhalla_public_geojson_export import encode

class TestManeuverTiming(unittest.TestCase):
    def setUp(self):
        self.points=[[21.5433,39.1728],[21.51,39.31],[21.49,39.5],[21.44,39.68],[21.3891,39.8579]]
        self.coords=[[lon,lat] for lat,lon in self.points]
        self.legs=[{"shape":encode(self.points),"maneuvers":[
            {"begin_shape_index":0,"end_shape_index":2,"time":1800},
            {"begin_shape_index":2,"end_shape_index":4,"time":2316}]}]

    def test_preserves_provider_timing(self):
        anchors=build_time_anchors(self.legs,[self.coords],4116)
        self.assertIsNotNone(anchors)
        self.assertEqual([a["pointIndex"] for a in anchors],[0,2,4])
        self.assertEqual([a["elapsedSeconds"] for a in anchors],[0,1800,4116])
        self.assertTrue(all(a["arrivalTimeUtc"] is None for a in anchors))
        payload={"trip":{"summary":{"length":91.8,"time":4116},"legs":self.legs}}
        route=extract_geojson(payload)
        props=route["features"][0]["properties"]
        self.assertEqual(props["maneuverTimingStatus"],"PROVIDER_ESTIMATED_ANCHORS")
        self.assertEqual(len(props["maneuverTimeAnchors"]),3)
        self.assertIsNone(route["safeToDrive"])

    def test_missing_maneuvers_and_bad_indices_hold(self):
        for legs in ([{"shape":"mock"}],[{"maneuvers":[]}],
                     [{"maneuvers":[{"begin_shape_index":0,"end_shape_index":7,"time":4116}]}],
                     [{"maneuvers":[{"begin_shape_index":0,"end_shape_index":2,"time":1800},
                                    {"begin_shape_index":3,"end_shape_index":4,"time":2316}]}],
                     [{"maneuvers":[{"begin_shape_index":0,"end_shape_index":4,"time":2100}]}]):
            with self.subTest(legs=legs):
                self.assertIsNone(build_time_anchors(legs,[self.coords],4116))

    def test_no_manufactured_midpoint(self):
        legs=[{"maneuvers":[{"begin_shape_index":0,"end_shape_index":4,"time":4116}]}]
        self.assertIsNone(build_time_anchors(legs,[self.coords],4116))

if __name__=="__main__":
    unittest.main()
