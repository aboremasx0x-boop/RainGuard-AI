import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from valhalla_timing_diagnostics import timing_diagnostic
from test_valhalla_public_geojson_export import encode
from export_public_valhalla_route_geojson import extract_geojson

class DiagnosticsTests(unittest.TestCase):
    def setUp(self):
        self.latlon=[(21.5433,39.1728),(21.52,39.33),(21.49,39.5),
                     (21.43,39.69),(21.3891,39.8579)]
        self.coords=[[lon,lat] for lat,lon in self.latlon]
        self.base=[{"shape":encode(self.latlon),"maneuvers":[
            {"begin_shape_index":0,"end_shape_index":2,"time":1800},
            {"begin_shape_index":2,"end_shape_index":4,"time":2316}]}]

    def review(self,legs=None,time=4116):
        if legs is None:legs=self.base
        return timing_diagnostic(legs,[self.coords],time)

    def test_valid_is_not_certified_driving(self):
        d=self.review()
        self.assertEqual(d["status"],"PROVIDER_ESTIMATED_ANCHORS")
        self.assertEqual(d["reason"],"OK_PROVIDER_ESTIMATE_NOT_OBSERVED")
        self.assertEqual(d["maneuverCount"],2)
        route=extract_geojson({"trip":{"summary":{"length":91.8,"time":4116},
                                      "legs":self.base}})
        self.assertEqual(route["features"][0]["properties"]["maneuverTimingDiagnostic"]["reason"],
                         "OK_PROVIDER_ESTIMATE_NOT_OBSERVED")
        self.assertIsNone(route["safeToDrive"])

    def test_maneuvers_missing(self):
        self.assertEqual(self.review([{"shape":"irrelevant"}])["reason"],"MISSING_MANEUVER_ARRAY")

    def test_invalid_or_out_of_order_indices(self):
        mismatch=[{"maneuvers":[{"begin_shape_index":0,"end_shape_index":2,"time":1800},
                                {"begin_shape_index":3,"end_shape_index":4,"time":2316}]}]
        self.assertEqual(self.review(mismatch)["reason"],"NONCONTIGUOUS_MANEUVER_INDEX")
        invalid=[{"maneuvers":[{"begin_shape_index":0,"end_shape_index":999,"time":4116}]}]
        self.assertEqual(self.review(invalid)["reason"],"MANEUVER_INDEX_OUT_OF_RANGE")

    def test_total_mismatch_and_missing_midpoint(self):
        self.assertEqual(self.review(time=1000)["reason"],"MANEUVER_TIMES_DISAGREE_WITH_TOTAL")
        end_only=[{"maneuvers":[{"begin_shape_index":0,"end_shape_index":4,"time":4116}]}]
        self.assertEqual(self.review(end_only)["reason"],"NO_INTERIOR_MANEUVER_BOUNDARY")

    def test_nearest_boundary_far_from_midpoint(self):
        long_coords=[[39.1728,21.5433],[39.2,21.54],[39.3,21.52],
                     [39.65,21.42],[39.8579,21.3891]]
        early=[{"maneuvers":[{"begin_shape_index":0,"end_shape_index":1,"time":100},
                            {"begin_shape_index":1,"end_shape_index":4,"time":4016}]}]
        d=timing_diagnostic(early,[long_coords],4116)
        self.assertEqual(d["reason"],"NO_TIMED_BOUNDARY_WITHIN_MIDPOINT_WINDOW")
        self.assertGreater(d["closestBoundaryOffsetFromHalfPct"],25)

    def test_invalid_time(self):
        self.assertEqual(self.review(time=0)["reason"],"INVALID_TOTAL_TIME")

if __name__=="__main__":unittest.main()
