"""Regression tests for the RainGuard V30 preview CORS allowlist.

These tests deliberately import no application dependencies or network services.
Run: python -m unittest discover -s tests -p 'test_v30_preview_cors.py'
"""
import ast
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAIN = ROOT / "main.py"


class TestPreviewCORS(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        tree = ast.parse(MAIN.read_text(encoding="utf-8"))
        cls.origins = None
        cls.regex = None
        for node in tree.body:
            if isinstance(node, ast.Assign) and any(
                isinstance(t, ast.Name) and t.id == "ALLOWED_ORIGINS" for t in node.targets
            ):
                cls.origins = ast.literal_eval(node.value)
            if isinstance(node, ast.Expr) and isinstance(node.value, ast.Call):
                call = node.value
                if isinstance(call.func, ast.Attribute) and call.func.attr == "add_middleware":
                    if any(
                        isinstance(arg, ast.Name) and arg.id == "CORSMiddleware"
                        for arg in call.args
                    ):
                        for kw in call.keywords:
                            if kw.arg == "allow_origin_regex":
                                cls.regex = ast.literal_eval(kw.value)

    def allowed(self, origin):
        return origin in self.origins or bool(re.fullmatch(self.regex, origin))

    def test_configuration_exists(self):
        self.assertIsInstance(self.origins, list)
        self.assertIsInstance(self.regex, str)

    def test_official_and_preview_origins(self):
        self.assertTrue(self.allowed("https://rain-guard-ai.vercel.app"))
        self.assertTrue(self.allowed(
            "https://rain-guard-irn2xabxn-aboremasx0x-boops-projects.vercel.app"
        ))
        self.assertTrue(self.allowed(
            "https://rain-guard-feature-123-aboremasx0x-boops-projects.vercel.app"
        ))

    def test_reject_untrusted_origins(self):
        for origin in (
            "https://evil.example.com",
            "https://rain-guard-test-other-account.vercel.app",
            "https://rain-guard-ai.vercel.app.evil.example.com",
            "http://rain-guard-test-aboremasx0x-boops-projects.vercel.app",
            "https://rain-guard-test-aboremasx0x-boops-projects.vercel.app.evil.com",
            "null",
        ):
            with self.subTest(origin=origin):
                self.assertFalse(self.allowed(origin))


if __name__ == "__main__":
    unittest.main()
