"""Exercise portable Monitor 1 production logic without a monitor or SDK.

All filesystem effects belong to temporary test directories. Explicit fake
device constants satisfy the public profile schema only; no test connects to
a monitor, starts a guardian, changes networking or loads a private profile.
"""
from pathlib import Path
import os
import shlex
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
PORT = ROOT / "ports/monitor1"


class Monitor1Tests(unittest.TestCase):
    def run_cpp(self, name, *, crypto=False, own_uid=False):
        compiler = shutil.which("c++")
        if compiler is None:
            raise RuntimeError("Monitor 1 tests require a C++17 compiler")
        flags = []
        if crypto:
            pkg_config = shutil.which("pkg-config")
            if pkg_config:
                result = subprocess.run(
                    [pkg_config, "--cflags", "--libs", "libcrypto"],
                    capture_output=True, text=True, check=True,
                )
                flags = shlex.split(result.stdout)
            else:
                flags = ["-lcrypto"]
        with tempfile.TemporaryDirectory(prefix="qingping-monitor1-") as temp:
            binary = Path(temp) / "test"
            profile = [
                '-DCGS1_EXPECTED_WLAN_MAC="02:00:00:00:00:01"',
                '-DCGS1_ESPHOME_NODE_NAME="qingping-fixture"',
                '-DCGS1_EXPECTED_PM_HELPER_SHA="' + "0" * 64 + '"',
            ]
            if own_uid:
                profile.append(f"-DCGS1_TEST_UID={os.getuid()}")
            compiled = subprocess.run([
                compiler, "-std=c++17", "-O1", "-Wall", "-Wextra",
                "-Wno-deprecated-declarations", *profile,
                "-I", str(PORT), str(PORT / name), *flags,
                "-o", str(binary),
            ], capture_output=True, text=True)
            self.assertEqual(compiled.returncode, 0, compiled.stderr)
            result = subprocess.run(
                [str(binary)], capture_output=True, text=True, timeout=30,
            )
            self.assertEqual(result.returncode, 0, result.stderr)

    def test_kernel_power_parser(self):
        self.run_cpp("test_power_supply.cpp")

    @unittest.skipUnless(
        sys.platform.startswith("linux") and hasattr(os, "geteuid") and os.geteuid() == 0,
        "Real Linux root-owned Store fixture; CI runs an explicit root step",
    )
    def test_native_wifi_request_preserves_other_networks(self):
        self.run_cpp("test_native_wifi_plan.cpp", crypto=True)

    @unittest.skipUnless(sys.platform.startswith("linux"), "Real Linux supervisor IPC headers")
    def test_saved_wifi_boot_can_defer_to_manual_editor(self):
        self.run_cpp("test_wifi_boot_flow.cpp", crypto=True)

    @unittest.skipUnless(sys.platform.startswith("linux"), "Real Linux filesystem/stat contract")
    def test_unassociated_rollback_never_selects_an_old_network(self):
        self.run_cpp("test_wifi_unassociated_recovery.cpp", crypto=True)

    def test_full_boot_keeps_one_attempt_and_startup_window(self):
        self.run_cpp("test_full_boot_flow.cpp")

    @unittest.skipUnless(hasattr(os, "getuid"), "POSIX filesystem fixture")
    def test_cleanup_preserves_working_pair_and_unknown_files(self):
        self.run_cpp("test_storage_release_prune.cpp", crypto=True, own_uid=True)
