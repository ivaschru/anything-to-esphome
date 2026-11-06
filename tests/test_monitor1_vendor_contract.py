"""Keep independently implemented host/device vendor pins coupled.

No vendor binary is read: the contract joins the public fixed capture table
and exact bootstrap patch digests to the future device reader's constants.
Actual fd/hash/replacement semantics are exercised by the Linux/root fixture.
"""
import importlib
from pathlib import Path
import re
import sys
import unittest

PORT = Path(__file__).resolve().parents[1] / "ports/monitor1"
sys.path.insert(0, str(PORT))
try:
    preflight = importlib.import_module("preflight_adb")
    bootstrap = importlib.import_module("bootstrap_patches")
finally:
    sys.path.pop(0)


class Monitor1VendorContractTests(unittest.TestCase):
    def test_device_pins_match_all_nine_committed_disabled_host_files(self):
        text = (PORT / "initial_trial_vendor.h").read_text()
        # Check the bounded constant blocks only. Matching counts and paths
        # makes a reordered/deleted/extra entry fail instead of silently zip-
        # truncating the source table. This is a cross-tool byte contract.
        paths_block = text.split("PATHS={", 1)[1].split("};", 1)[0]
        pins_block = text.split("PINS={{", 1)[1].split("}};", 1)[0]
        paths = re.findall(r'"([^"\n]+)"', paths_block)
        pins = re.findall(r'\{([0-9]+),"([0-9a-f]{64})"\}', pins_block)
        self.assertEqual(paths, [path.lstrip("/") for path in preflight.FILES])
        expected = []
        for path, (sha, size) in preflight.FILES.items():
            if path == "/data/bin/watchdog.sh":
                sha = bootstrap.WATCHDOG_INSTALLED
                size += len(bootstrap.WATCHDOG_NEW) - len(bootstrap.WATCHDOG_OLD)
            elif path == "/data/etc/init.d/start.sh":
                sha = bootstrap.START_INSTALLED
                size += 298
            expected.append((str(size), sha))
        self.assertEqual(pins, expected)
