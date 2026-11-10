"""Run the actual child adapter against finite engine/account stand-ins."""
import base64
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import types
import unittest
from unittest.mock import Mock, patch

from test_sonoff import ROOT, device, fixture, image, values


class SonoffWorkerTests(unittest.TestCase):
    def test_terminal_wait_observes_original_children_without_terminating_them(self):
        path = ROOT / "custom_components/qingping_esphome/sonoff_worker/runner.py"
        spec = importlib.util.spec_from_file_location("sonoff_worker_lifetime", path)
        runner = importlib.util.module_from_spec(spec); spec.loader.exec_module(runner)
        child = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(30)"])
        try:
            with patch.object(runner.time, "monotonic", side_effect=[0, 6]):
                self.assertFalse(runner.children_settled([child]))
            self.assertIsNone(child.poll(), "An uncertain original child is observed, never killed by recovery")
        finally:
            child.terminate(); child.wait(timeout=5)
        self.assertTrue(runner.children_settled([child], frozenset(runner.threading.enumerate())))

    def test_final_producer_is_repeatable_but_cannot_change_private_profile(self):
        path = ROOT / "custom_components/qingping_esphome/sonoff_worker/runner.py"
        spec = importlib.util.spec_from_file_location("sonoff_worker_fixture", path)
        runner = importlib.util.module_from_spec(spec); spec.loader.exec_module(runner)
        with tempfile.TemporaryDirectory() as temporary:
            job = Path(temporary); upstream = job / "upstream"; upstream.mkdir()
            component = job / "component"; (component / "firmware").mkdir(parents=True)
            shutil.copyfile(ROOT / "custom_components/qingping_esphome/sonoff_image.py", component / "sonoff_image.py")
            shutil.copyfile(ROOT / "custom_components/qingping_esphome/sonoff_journal.py", component / "sonoff_journal.py")
            binary = fixture(); (component / "firmware/sonoff-s60tpf-template.bin").write_bytes(binary)
            (component / "firmware/sonoff-s60tpf-template.json").write_text(json.dumps({"sha256": hashlib.sha256(binary).hexdigest()}))
            private = {key: value.decode() for key, value in values().items() if key != "noise_psk"}
            private["noise_psk"] = base64.b64encode(values()["noise_psk"]).decode()
            request = {"format": "anything-sonoff-job-v2", "receipt_nonce": "a" * 32,
                       "device_id": "1000abcdef", "mac": "AA:BB:CC:11:22:33", "host": "192.168.1.33",
                       "lan_host": "192.168.1.2", "auth": {"at": "fixture-session-token"}, "region": "eu", "values": private}
            (job / "request.json").write_text(json.dumps(request))
            esphome = types.ModuleType("tools.autoflash.esphome")
            esphome.check_app = Mock(side_effect=lambda result, _: image.layout(result))
            output = types.SimpleNamespace(private=Mock())
            engine = types.ModuleType("tools.autoflash_cli")
            def run_once():
                self.assertNotIn("fixture-session-token", " ".join(sys.argv))
                self.assertNotIn(private["noise_psk"], " ".join(sys.argv))
                self.assertEqual(sys.argv[1:5], ["run", "--new", "--unattended", "--firmware"])
                self.assertIn(private["noise_psk"], (job / "answers.env").read_text())
                first = esphome.image_for("owned-wifi", "owned-password")
                self.assertEqual(first, esphome.image_for("owned-wifi", "owned-password"))
                with self.assertRaises(ValueError): esphome.image_for("changed-wifi", "owned-password")
                with self.assertRaises(ValueError): esphome.image_for("owned-wifi", "owned-password", own=Path("caller.bin"))
                self.assertEqual((job / "profile.json").stat().st_mode & 0o777, 0o600)
                return 0
            engine.main = Mock(side_effect=run_once)
            tools = types.ModuleType("tools"); tools.autoflash_cli = engine; tools.__path__ = []
            autoflash = types.ModuleType("tools.autoflash"); autoflash.credentials = types.SimpleNamespace(); autoflash.esphome = esphome; autoflash.output = output
            account = types.ModuleType("tools.get_device_key"); account.get_devices = Mock(return_value=[device()])
            modules = {"tools": tools, "tools.autoflash": autoflash, "tools.autoflash_cli": engine, "tools.get_device_key": account}
            previous, mask = Path.cwd(), os.umask(0o077)
            try:
                os.chdir(upstream)
                with patch.dict(sys.modules, modules), patch.object(runner, "COMPONENT", component), patch.object(sys, "argv", []):
                    self.assertEqual(runner.main(), 0)
                engine.main.assert_called_once()
                self.assertGreaterEqual(esphome.check_app.call_count, 2)
                self.assertFalse((job / "request.json").exists())
                self.assertFalse((job / "answers.env").exists())
                self.assertTrue((job / "profile.json").exists())
                receipt = json.loads((job / "terminal.json").read_text())
                self.assertEqual(receipt["result"], 0)
                self.assertEqual(receipt["nonce"], request["receipt_nonce"])
                self.assertNotIn("fixture-session-token", json.dumps(receipt))
            finally:
                os.chdir(previous); os.umask(mask)


if __name__ == "__main__": unittest.main()
