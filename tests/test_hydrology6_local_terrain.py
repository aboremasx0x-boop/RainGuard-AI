import copy
import csv
import io
import struct
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from analyze_hydrology6_local_terrain import build_report,as_csv,window_samples
from build_hydrology3_evidence_register import build_register
from build_hydrology2_review_sites import make_report
from scan_route_hydrorivers_local import route_points,river_features
from test_route_hydrorivers_local import route,tile


class TerrainWindowTests(unittest.TestCase):
    def setUp(self):
        hydro=make_report(route_points(route()),river_features(tile([
            [[39.4,21.6],[39.4,21.4]],
        ])))
        self.reg=build_register(hydro)
        self.site=self.reg["sites"][0]

    def tile(self,dir,position="N21E039.hgt",void=False,near_edge=False):
        p=Path(dir)/position
        n=1201
        with p.open("wb") as f:
            f.truncate(2*n*n)
            if 21<=self.site["latitude"]<22 and 39<=self.site["longitude"]<40:
                row=round((22-self.site["latitude"])*1200)
                col=round((self.site["longitude"]-39)*1200)
                for dy in range(-2,3):
                    for dx in range(-2,3):
                        val=100+dy*5+dx if not void else -32768
                        f.seek(2*((row+dy)*n+col+dx))
                        f.write(struct.pack(">h",val))
        return p

    def test_complete_window_and_statistics(self):
        with tempfile.TemporaryDirectory() as d:
            r=build_report(self.reg,self.tile(d))
            self.assertEqual(r["siteCount"],1)
            self.assertEqual(r["completeWindowCount"],1)
            s=r["sites"][0]
            self.assertEqual(s["centerTerrainMeters"],100)
            self.assertEqual(s["minTerrainMeters"],88)
            self.assertEqual(s["maxTerrainMeters"],112)
            self.assertEqual(s["medianTerrainMeters"],100)
            self.assertEqual(s["maxMinusMinMeters"],24)
            self.assertEqual(s["centerMinusMedianMeters"],0)
            self.assertEqual(s["validWindowCellCount"],25)
            self.assertIsNone(s["roadSurfaceElevationMeters"])
            self.assertIsNone(r["safeToDrive"])
            self.assertEqual(r["verifiedRoadSurfaceElevationCount"],0)
            self.assertEqual(len(list(csv.DictReader(io.StringIO(as_csv(r))))),1)

    def test_void_window_rejected_without_interpolation(self):
        with tempfile.TemporaryDirectory() as d:
            r=build_report(self.reg,self.tile(d,void=True))
            self.assertEqual(r["completeWindowCount"],0)
            self.assertEqual(r["sites"][0]["sampleStatus"],"CENTER_VOID")
            self.assertIsNone(r["sites"][0]["medianTerrainMeters"])
            self.assertIsNone(r["safeToDrive"])

    def test_partial_void_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            p=self.tile(d)
            n=1201
            row=round((22-self.site["latitude"])*1200)
            col=round((self.site["longitude"]-39)*1200)
            with p.open("r+b") as f:
                f.seek(2*((row-1)*n+col))
                f.write(struct.pack(">h",-32768))
            r=build_report(self.reg,p)
            self.assertEqual(r["completeWindowCount"],0)
            self.assertEqual(r["sites"][0]["sampleStatus"],"INCOMPLETE_WINDOW_NODATA")
            self.assertIsNone(r["sites"][0]["maxMinusMinMeters"])

    def test_missing_tile_location_not_zero_height(self):
        with tempfile.TemporaryDirectory() as d:
            r=build_report(self.reg,self.tile(d,position="N20E039.hgt"))
            self.assertEqual(r["sites"][0]["sampleStatus"],"OUTSIDE_TILE")
            self.assertIsNone(r["sites"][0]["centerTerrainMeters"])

    def test_invalid_radius_and_unverified_register_enforcement(self):
        with tempfile.TemporaryDirectory() as d:
            p=self.tile(d)
            with self.assertRaises(ValueError):window_samples(p,self.reg["sites"],radius=50)
            reg=copy.deepcopy(self.reg)
            reg["safeToDrive"]=True
            with self.assertRaises(ValueError):build_report(reg,p)

if __name__=="__main__":unittest.main()
