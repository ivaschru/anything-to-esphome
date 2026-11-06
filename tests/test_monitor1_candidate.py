"""Candidate input and include-boundary checks; no compiler or device required."""
import base64
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

PORT = Path(__file__).resolve().parents[1] / "ports/monitor1"
spec = importlib.util.spec_from_file_location("cgs1_candidate_builder", PORT / "build_candidate.py")
candidate = importlib.util.module_from_spec(spec)
# The script imports its sibling helper. Scope that import path to this load,
# rather than changing the test process's package/environment configuration.
with patch.object(sys, "path", [str(PORT), *sys.path]):
    spec.loader.exec_module(candidate)


def profile():
    # Explicit non-operational test values; never a public firmware asset.
    return {"model": "CGS1", "stock_version": "4.1.8_0287", "co2_type": 3,
            "wlan_mac": "02:00:00:00:00:01", "api_mac": "02:00:00:00:00:02",
            "node_name": "qingping-build-fixture", "friendly_name": "Qingping fixture",
            "api_encryption_key": base64.b64encode(bytes([1]) * 32).decode(),
            "qt_core_sha256": "1" * 64}


class CandidateTests(unittest.TestCase):
    def write_profile(self, root, values, mode=0o600):
        path = root / "profile.json"
        path.write_text(json.dumps(values))
        path.chmod(mode)
        return path

    def test_explicit_s8_and_scd40_profiles_preserve_the_captured_key(self):
        with tempfile.TemporaryDirectory() as temp:
            for co2_type in (2, 3):
                values = profile(); values["co2_type"] = co2_type
                path = self.write_profile(Path(temp), values)
                loaded, digest = candidate.read_profile(path)
                self.assertEqual(loaded, values)
                self.assertEqual(digest, candidate.pm.digest(path))

    def test_unknown_hardware_and_extra_fields_are_not_admitted(self):
        cases = (("model", "CGS2"), ("stock_version", "4.2.1"),
                 ("co2_type", 1), ("co2_type", True), ("extra", "ignored"))
        with tempfile.TemporaryDirectory() as temp:
            for name, value in cases:
                with self.subTest(name=name, value=value):
                    values = profile(); values[name] = value
                    path = self.write_profile(Path(temp), values)
                    with self.assertRaises(ValueError): candidate.read_profile(path)

    def test_profile_must_remain_private_and_regular(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            path = self.write_profile(root, profile(), mode=0o644)
            before = path.read_bytes()
            with self.assertRaises(ValueError): candidate.read_profile(path)
            self.assertEqual(path.read_bytes(), before)
            path.chmod(0o600)
            link = root / "link"; link.symlink_to(path)
            with self.assertRaises(ValueError): candidate.read_profile(link)

    def test_identities_and_keys_cannot_fall_back_to_defaults(self):
        cases = (("wlan_mac", "01:00:00:00:00:01"), ("wlan_mac", "00:00:00:00:00:00"),
                 ("api_mac", "00:00:00:00:00:02"), ("api_mac", "02:00:00:00:00:01"),
                 ("node_name", "-bad"), ("node_name", "a" * 64),
                 ("friendly_name", "line\nbreak"), ("api_encryption_key", "invalid"),
                 ("api_encryption_key", base64.b64encode(bytes(32)).decode()))
        with tempfile.TemporaryDirectory() as temp:
            for name, value in cases:
                with self.subTest(name=name):
                    values = profile(); values[name] = value
                    with self.assertRaises(ValueError):
                        candidate.read_profile(self.write_profile(Path(temp), values))

    def test_include_closure_copies_only_reachable_dependencies(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "base.yaml").write_text("packages:\n  shared: !include child.yaml\nesphome:\n  includes:\n    - a.h\n")
            (root / "child.yaml").write_text("esphome:\n  includes:\n    - b.h\n")
            (root / "a.h").write_text('#include "b.h"\n')
            (root / "b.h").write_text('#include "c.h"\n')
            (root / "c.h").write_text('#include "a.h"\n')
            (root / "unused.h").write_text("Do not include an unrelated runtime")
            component = root / "components/example"; component.mkdir(parents=True)
            (component / "example.h").write_text('#include "d.h"\n')
            (root / "d.h").write_text("#pragma once\n")
            self.assertEqual(candidate.header_closure(root, "base.yaml", ("example",)), ["c.h", "d.h"])

    def test_include_closure_cannot_escape_the_snapshot(self):
        with tempfile.TemporaryDirectory() as temp:
            outer = Path(temp); root = outer / "source"; root.mkdir()
            (root / "base.yaml").write_text("esphome:\n  includes:\n    - a.h\n")
            (root / "a.h").write_text('#include "../outside.h"\n')
            (outer / "outside.h").write_text("#pragma once\n")
            with self.assertRaises(ValueError): candidate.header_closure(root, "base.yaml", ())

    def test_yaml_include_cannot_read_outside_the_snapshot(self):
        with tempfile.TemporaryDirectory() as temp:
            outer = Path(temp); root = outer / "source"; root.mkdir()
            (root / "base.yaml").write_text("packages:\n  bad: !include ../outside.yaml\n")
            (outer / "outside.yaml").write_text("not a build input")
            with self.assertRaises(ValueError): candidate.header_closure(root, "base.yaml", ())
