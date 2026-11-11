import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "deploy" / "valhalla-pilot"

def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

prepare = load("prepare_valhalla_extract", ROOT / "prepare_extract.py")
smoke = load("smoke_valhalla_pilot", ROOT / "smoke_test.py")

class PilotTests(unittest.TestCase):
    def test_dry_run_no_download(self):
        r = prepare.prepare(download=False, dry_run=True)
        self.assertFalse(r["downloaded"])
        self.assertFalse(r["tiles_built"])
        self.assertEqual(r["extract"], "38.65,20.65,40.45,22.25")

    def test_extract_command(self):
        args = prepare.build_command("osmium", Path("/tmp/source.osm.pbf"), Path("/tmp/pilot.osm.pbf"))
        self.assertEqual(args[1], "extract")
        self.assertEqual(args[args.index("--strategy")+1], "complete_ways")
        self.assertEqual(args[args.index("--bbox")+1], prepare.BBOX)

    def test_only_local_route(self):
        self.assertEqual(smoke.DEMO["costing"], "truck")
        self.assertEqual(smoke.DEMO["costing_options"]["truck"]["weight"], 18)
        with self.assertRaisesRegex(ValueError, "LOCALHOST_ONLY"):
            smoke.run("https://public.example/route")

    def test_route_not_certified(self):
        result = smoke.inspect({"trip": {"summary": {"length": 62.1, "time": 3600}}})
        self.assertTrue(result["success"])
        self.assertIsNone(result["safeToDrive"])
        self.assertEqual(result["roadClosures"], "NOT_VERIFIED")
        self.assertEqual(result["hydrology"], "NOT_VERIFIED")
        self.assertIsNone(smoke.inspect({"error": "no route"})["safeToDrive"])

    def test_compose_localhost_only(self):
        yml = (ROOT / "compose.yaml").read_text(encoding="utf-8")
        self.assertIn("127.0.0.1:8002:8002", yml)
        self.assertIn("ghcr.io/valhalla/valhalla-scripted:latest", yml)
        self.assertIn("./custom_files:/custom_files", yml)
        self.assertNotIn("tile_urls:", yml)
        ignore = (ROOT / ".gitignore").read_text()
        self.assertIn("custom_files/", ignore)
        self.assertIn("downloads/", ignore)

if __name__ == "__main__":
    unittest.main()
