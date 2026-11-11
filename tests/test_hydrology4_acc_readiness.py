import copy
import csv
import io
import json
import struct
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from audit_hydrology4_acc_readiness import build_audit, as_csv, metadata_info
from build_hydrology3_evidence_register import build_register
from build_hydrology2_review_sites import make_report
from scan_route_hydrorivers_local import route_points,river_features
from test_route_hydrorivers_local import route,tile


class ACCAuditTests(unittest.TestCase):
    def setUp(self):
        hydro=make_report(route_points(route()),river_features(tile([[[39.4,21.6],[39.4,21.4]]])))
        self.reg=build_register(hydro)
        self.meta={
          "dataset":"HydroSHEDS v1.1 Flow Accumulation (ACC)","crs":"EPSG:4326",
          "dtype":"uint32","byteOrder":"little-endian","layout":"row-major",
          "syntheticData":False,"width":3,"height":3,
          "left":39.3,"top":21.6,"pixelWidth":0.1,"pixelHeight":0.1,
          "nodata":4294967295,"resolutionArcSeconds":15,
        }

    def test_reads_one_cell_not_dem_elevation(self):
        with tempfile.TemporaryDirectory() as tmp:
            file=Path(tmp)/"acc.u32"
            file.write_bytes(struct.pack("<9I",1,2,3,4,5,6,7,8,9))
            report=build_audit(self.reg,self.meta,file)
            self.assertEqual(report["siteCount"],1)
            self.assertEqual(report["accGridAvailableSiteCount"],1)
            self.assertEqual(report["demElevationVerifiedCount"],0)
            self.assertFalse(report["accIsDemElevation"])
            self.assertIsNone(report["sites"][0]["roadElevationMeters"])
            self.assertIsNone(report["safeToDrive"])
            self.assertFalse(report["alternativeRouteApproved"])
            rows=list(csv.DictReader(io.StringIO(as_csv(report))))
            self.assertEqual(len(rows),1)

    def test_missing_binary_fails_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            report=build_audit(self.reg,self.meta,Path(tmp)/"missing.u32")
            self.assertEqual(report["accGridAvailableSiteCount"],0)
            self.assertEqual(report["sites"][0]["gridStatus"],"ACC_BINARY_MISSING_OR_SIZE_MISMATCH")
            self.assertIsNone(report["safeToDrive"])

    def test_nodata_is_not_zero_or_safe(self):
        with tempfile.TemporaryDirectory() as tmp:
            file=Path(tmp)/"acc.u32"
            file.write_bytes(struct.pack("<9I",*([4294967295]*9)))
            report=build_audit(self.reg,self.meta,file)
            self.assertEqual(report["sites"][0]["gridStatus"],"ACC_NODATA")
            self.assertIsNone(report["sites"][0]["accumulatedUpstreamCellCount"])
            self.assertIsNone(report["safeToDrive"])

    def test_false_elevation_metadata_rejected(self):
        bad=copy.deepcopy(self.meta)
        bad["dataset"]="HydroSHEDS DEM elevation"
        with self.assertRaises(ValueError):metadata_info(bad)
        bad=copy.deepcopy(self.meta)
        bad["syntheticData"]=True
        with self.assertRaises(ValueError):metadata_info(bad)

    def test_preapproved_site_or_report_rejected(self):
        bad=copy.deepcopy(self.reg)
        bad["sites"][0]["safeToDrive"]=True
        with tempfile.TemporaryDirectory() as tmp:
            file=Path(tmp)/"missing.u32"
            with self.assertRaises(ValueError):build_audit(bad,self.meta,file)
        bad=copy.deepcopy(self.reg)
        bad["independentlyVerifiedEvidenceCount"]=5
        with tempfile.TemporaryDirectory() as tmp:
            file=Path(tmp)/"missing.u32"
            with self.assertRaises(ValueError):build_audit(bad,self.meta,file)


if __name__=="__main__":unittest.main()
