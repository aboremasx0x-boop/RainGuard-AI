import copy
import struct
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from sample_hydrology5_srtm_hgt import audit,hgt_info,sample_hgt,to_csv
from build_hydrology3_evidence_register import build_register
from build_hydrology2_review_sites import make_report
from scan_route_hydrorivers_local import route_points,river_features
from test_route_hydrorivers_local import route,tile


class TerrainTests(unittest.TestCase):
    def setUp(self):
        h=make_report(route_points(route()),river_features(tile([[[39.4,21.6],[39.4,21.4]]])))
        self.register=build_register(h)

    def make_hgt(self,dir,name="N21E039.hgt",value=250):
        p=Path(dir)/name
        # Fast sparse file with one real test cell in the correct big-endian position.
        n=1201
        with p.open("wb") as f:
            f.truncate(n*n*2)
            for site in self.register["sites"]:
                lat,lon=site["latitude"],site["longitude"]
                if 21<=lat<22 and 39<=lon<40:
                    row=round((22-lat)*(n-1))
                    col=round((lon-39)*(n-1))
                    f.seek(2*(row*n+col))
                    f.write(struct.pack(">h",value))
        return p

    def test_valid_hgt_reads_terrain_never_road_elevation(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=self.make_hgt(tmp)
            n,lat,lon=hgt_info(p)
            self.assertEqual((n,lat,lon),(1201,21,39))
            report=audit(self.register,p)
            self.assertEqual(report["sampledTerrainCellCount"],1)
            self.assertEqual(report["sites"][0]["sampledTerrainElevationMeters"],250)
            self.assertIsNone(report["sites"][0]["roadSurfaceElevationMeters"])
            self.assertEqual(report["verifiedRoadSurfaceElevationCount"],0)
            self.assertEqual(report["sourceAuthenticity"],"USER_PROVIDED_FILE_UNVERIFIED")
            self.assertIsNone(report["safeToDrive"])
            self.assertFalse(report["alternativeRouteApproved"])
            self.assertIn("siteId",to_csv(report))

    def test_void_never_converted_to_zero(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=self.make_hgt(tmp,value=-32768)
            report=audit(self.register,p)
            self.assertEqual(report["sampledTerrainCellCount"],0)
            self.assertEqual(report["sites"][0]["sampleStatus"],"VOID_NO_ELEVATION")
            self.assertIsNone(report["sites"][0]["sampledTerrainElevationMeters"])

    def test_outside_tile_is_missing(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=self.make_hgt(tmp,name="N20E039.hgt")
            report=audit(self.register,p)
            self.assertEqual(report["sampledTerrainCellCount"],0)
            self.assertEqual(report["sites"][0]["sampleStatus"],"OUTSIDE_TILE")
            self.assertIsNone(report["safeToDrive"])

    def test_wrong_size_or_name_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/"N21E039.hgt"
            p.write_bytes(b"not an HGT")
            with self.assertRaises(ValueError):hgt_info(p)
            fake=Path(tmp)/"unknown_dem.hgt"
            with fake.open("wb") as f:f.truncate(1201*1201*2)
            with self.assertRaises(ValueError):hgt_info(fake)

    def test_preapproved_register_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=self.make_hgt(tmp)
            bad=copy.deepcopy(self.register)
            bad["sites"][0]["safeToDrive"]=True
            with self.assertRaises(ValueError):audit(bad,p)


if __name__=="__main__":unittest.main()
