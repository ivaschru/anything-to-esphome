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
    @unittest.skipUnless(sys.platform.startswith("linux"),
                         "Actual production plan includes Linux filesystem/IPC headers; Linux CI executes this codec")
    def test_full_ui_trial_plan_cannot_remove_or_extend_its_fixed_device_limit(self):
        self.run_cpp("test_full_runtime_limit_plan.cpp", crypto=True)

    @unittest.skipUnless(sys.platform.startswith("linux"), "Production guardian uses Linux IPC; compile only in Linux CI")
    def test_production_guardian_compiles_with_the_trial_limit_join(self):
        # Compile the actual entry point, but never execute a production
        # guardian on a host or pretend its successful compile is device QA.
        self.run_cpp("supervisor_guardian_main.cpp", crypto=True, compile_only=True)

    def test_ui_locale_preserves_choice_and_printf_argument_contracts(self):
        self.run_cpp("test_ui_language.cpp")

    def test_visible_backlight_never_uses_the_observed_black_pwm_range(self):
        self.run_cpp("test_backlight_policy.cpp")

    @unittest.skipUnless(
        sys.platform.startswith("linux") and hasattr(os, "geteuid") and os.geteuid() == 0,
        "Real Linux root executable parser/owned-child fixture; CI runs its explicit root step",
    )
    def test_initial_bridge_executable_requires_exact_frame_and_independent_reap(self):
        self.run_cpp("test_initial_bridge_cli.cpp", crypto=True)

    def run_cpp(self, name, *, crypto=False, own_uid=False, compile_only=False):
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
            if compile_only:
                return
            result = subprocess.run(
                # C++ fixtures create relative private Store directories here.
                # A hosted runner need not expose the old container's /work;
                # production ownership/mode checks remain fully active.
                [str(binary)], cwd=temp, capture_output=True, text=True, timeout=30,
            )
            self.assertEqual(result.returncode, 0, result.stderr)

    def test_kernel_power_parser(self):
        self.run_cpp("test_power_supply.cpp")

    @unittest.skipUnless(
        sys.platform.startswith("linux") and hasattr(os, "geteuid") and os.geteuid() == 0,
        "Real Linux root child-only OOM/PDEATHSIG fixture; CI runs its explicit root step",
    )
    def test_initial_trial_owns_only_its_forked_child(self):
        self.run_cpp("test_initial_trial_child.cpp")

    @unittest.skipUnless(
        sys.platform.startswith("linux") and hasattr(os, "geteuid") and os.geteuid() == 0,
        "Real Linux root fd/xattr/tmpfs admission fixture; CI runs its explicit root step",
    )
    def test_initial_trial_image_and_ram_admission_is_read_only(self):
        self.run_cpp("test_initial_trial_admission.cpp", crypto=True)

    @unittest.skipUnless(
        sys.platform.startswith("linux") and hasattr(os, "geteuid") and os.geteuid() == 0,
        "Real Linux root one-shot intent filesystem fixture; CI runs its explicit root step",
    )
    def test_initial_trial_intent_is_exclusive_durable_and_not_reusable(self):
        self.run_cpp("test_initial_trial_intent.cpp", crypto=True)

    @unittest.skipUnless(
        sys.platform.startswith("linux") and hasattr(os, "geteuid") and os.geteuid() == 0,
        "Real Linux root child-only fd exec/environment fixture; CI runs its explicit root step",
    )
    def test_initial_trial_entry_uses_ram_and_discards_inherited_environment_and_fds(self):
        self.run_cpp("test_initial_trial_exec.cpp", crypto=True)

    @unittest.skipUnless(
        sys.platform.startswith("linux") and hasattr(os, "geteuid") and os.geteuid() == 0,
        "Real Linux root actual self-exec image fixture; CI runs its explicit root step",
    )
    def test_initial_guardian_self_requires_actual_kernel_process_and_pinned_named_image(self):
        self.run_cpp("test_initial_trial_self.cpp", crypto=True)

    @unittest.skipUnless(
        sys.platform.startswith("linux") and hasattr(os, "geteuid") and os.geteuid() == 0,
        "Real Linux root fixed-name read-only filesystem scope fixture; CI runs its explicit root step",
    )
    def test_initial_trial_filesystem_scope_binds_named_root_flags_markers_and_payload(self):
        self.run_cpp("test_initial_trial_filesystem.cpp", crypto=True)

    def test_initial_trial_resource_parsers_reject_cache_credit_and_occupied_ports(self):
        self.run_cpp("test_initial_trial_resources.cpp")

    def test_initial_device_identity_parsers_keep_co2_and_boot_scope_exact(self):
        self.run_cpp("test_initial_trial_device.cpp")

    def test_initial_stock_process_maps_and_exact_watchdog_parsers(self):
        self.run_cpp("test_initial_trial_stock.cpp")

    @unittest.skipUnless(
        sys.platform.startswith("linux") and hasattr(os, "geteuid") and os.geteuid() == 0,
        "Real Linux root read-only stock-session fd fixture; CI runs its explicit root step",
    )
    def test_initial_stock_session_requires_actual_exe_inodes_and_complete_proc_reads(self):
        self.run_cpp("test_initial_trial_stock_linux.cpp", crypto=True)

    @unittest.skipUnless(
        sys.platform.startswith("linux") and hasattr(os, "geteuid") and os.geteuid() == 0,
        "Real Linux root named RAM/boot-lock fixture; CI runs its explicit root step",
    )
    def test_initial_named_ram_requires_exact_empty_job_and_positive_boot_lock_absence(self):
        self.run_cpp("test_initial_trial_ram_scope.cpp", crypto=True)

    @unittest.skipUnless(
        sys.platform.startswith("linux") and hasattr(os, "geteuid") and os.geteuid() == 0,
        "Real Linux root complete pre-start join fixture; CI runs its explicit root step",
    )
    def test_initial_prestart_scope_joins_named_fds_device_stock_resources_and_creator_intent(self):
        self.run_cpp("test_initial_trial_scope.cpp", crypto=True)

    @unittest.skipUnless(
        sys.platform.startswith("linux") and hasattr(os, "geteuid") and os.geteuid() == 0,
        "Real Linux root read-only identity fd fixture; CI runs its explicit root step",
    )
    def test_initial_device_identity_requires_unchanged_fixed_files_and_mounts(self):
        self.run_cpp("test_initial_trial_device_linux.cpp", crypto=True)

    @unittest.skipUnless(
        sys.platform.startswith("linux") and hasattr(os, "geteuid") and os.geteuid() == 0,
        "Real Linux root read-only resource fd fixture; CI runs its explicit root step",
    )
    def test_initial_trial_resources_require_complete_fresh_memory_and_both_tcp_tables(self):
        self.run_cpp("test_initial_trial_resources_linux.cpp")

    @unittest.skipUnless(
        sys.platform.startswith("linux") and hasattr(os, "geteuid") and os.geteuid() == 0,
        "Real Linux root read-only fixed vendor fd fixture; CI runs its explicit root step",
    )
    def test_initial_trial_vendor_files_require_fixed_hashes_and_unchanged_named_inodes(self):
        self.run_cpp("test_initial_trial_vendor.cpp", crypto=True)

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

    @unittest.skipUnless(
        sys.platform.startswith("linux") and hasattr(os, "geteuid") and os.geteuid() == 0,
        "Real Linux root-owned Store fixture; CI runs an explicit root step",
    )
    def test_staged_release_preserves_the_active_pair_and_mode(self):
        self.run_cpp("test_full_release_staged_save.cpp", crypto=True)

    @unittest.skipUnless(hasattr(os, "getuid"), "POSIX filesystem fixture")
    def test_cleanup_preserves_working_pair_and_unknown_files(self):
        self.run_cpp("test_storage_release_prune.cpp", crypto=True, own_uid=True)
