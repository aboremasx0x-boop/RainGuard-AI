import copy
import struct
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from analyze_hydrology6_dem_neighborhood import build_report, as_csv, neighborhood
from build_hydrology3_evidence_register import build_register
from build_hydrology2_review_sites import make_report
from scan_route_hydrorivers_local import route_points, river_features
from test_route_hydrorivers_local import route,tile


class NeighborhoodTests(unittest.TestCase):
    def setUp(self):
        h=make_report(route_points(route()),river_features(tile([[[39.4,21.6],[39.4,21.4]]])))
        self.reg=build_register(h)
        self.site=self.reg["sites"][0]

    def make_tile(self,folder,radius=2,center=100,void=None):
        path=Path(folder)/"N21E039.hgt"
        n=1201
        with path.open("wb") as f:
            f.truncate(n*n*2)
            lat,lon=self.site["latitude"],self.site["longitude"]
            row=round((22-lat)*(n-1))
            col=round((lon-39)*(n-1))
            for dr in range(-radius,radius+1):
                for dc in range(-radius,radius+1):
                    val=center+dc*10-dr*5
                    if (dr,dc)==void:val=-32768
                    f.seek(2*((row+dr)*n+col+dc))
                    f.write(struct.pack(">h",val))
        return path

    def test_gradient_and_relief_are_descriptive_only(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=self.make_tile(tmp)
            report=build_report(self.reg,path)
            s=report["sites"][0]
            self.assertEqual(report["completeWindowCount"],1)
            self.assertEqual(s["windowStatus"],"COMPLETE_TERRAIN_WINDOW_UNVERIFIED")
            self.assertEqual(s["centerTerrainElevationMeters"],100)
            self.assertEqual(s["windowMinTerrainMeters"],70)
            self.assertEqual(s["windowMaxTerrainMeters"],130)
            self.assertEqual(s["localTerrainReliefMeters"],60)
            self.assertEqual(s["centerAboveWindowMinimumMeters"],30)
            self.assertGreater(s["centerSlopeDegreesApprox"],0)
            self.assertIsNone(s["roadSurfaceElevationMeters"])
            self.assertFalse(report["verticalDatumVerified"])
            self.assertEqual(report["verifiedBridgeCulvertCount"],0)
            self.assertIsNone(report["safeToDrive"])
            self.assertFalse(report["alternativeRouteApproved"])
            self.assertIn("windowStatus",as_csv(report))

    def test_void_cell_refuses_spurious_statistics(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=self.make_tile(tmp,void=(1,1))
            report=build_report(self.reg,path)
            item=report["sites"][0]
            self.assertEqual(item["windowStatus"],"PARTIAL_WINDOW_VOID_VALUES")
            self.assertIsNone(item["localTerrainReliefMeters"])
            self.assertIsNone(item["centerSlopeDegreesApprox"])
            self.assertEqual(item["voidCellCount"],1)

    def test_center_void_fails_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=self.make_tile(tmp,void=(0,0))
            item=build_report(self.reg,path)["sites"][0]
            self.assertEqual(item["windowStatus"],"CENTER_VOID_NO_ELEVATION")
            self.assertIsNone(item["centerTerrainElevationMeters"])
            self.assertIsNone(item["centerAboveWindowMinimumMeters"])

    def test_tile_edge_fails_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=self.make_tile(tmp)
            register=copy.deepcopy(self.reg)
            register["sites"][0]["latitude"]=21.99999
            item=build_report(register,path)["sites"][0]
            self.assertEqual(item["windowStatus"],"INCOMPLETE_WINDOW_AT_TILE_EDGE")
            self.assertIsNone(item["windowMinTerrainMeters"])

    def test_reject_invalid_radius_or_unsafe_register(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=self.make_tile(tmp)
            for radius in (0,6,1.2):
                with self.assertRaises(ValueError):build_report(self.reg,path,radius)
            wrong=copy.deepcopy(self.reg)
            wrong["sites"][0]["safeToDrive"]=True
            with self.assertRaises(ValueError):build_report(wrong,path)


if __name__=="__main__":
    unittest.main()
