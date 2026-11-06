"""First bridge admission, ownership and deadline failures; never start a process.

The kernel-child and API observations below are explicit simulated inputs.
These tests qualify only the pure policy; no physical trial or working
device-side guardian is inferred from them.
"""
from dataclasses import replace
import importlib
from pathlib import Path
import sys
import unittest

from test_monitor1_disabled_commit import BOOT, PLAN_ID, PLAN_SHA, TARGET, snapshot

PORT = Path(__file__).resolve().parents[1] / "ports/monitor1"
sys.path.insert(0, str(PORT))
try:
    policy = importlib.import_module("initial_bridge_trial_policy")
finally:
    sys.path.pop(0)

BRIDGE, GUARDIAN = "a" * 64, "b" * 64
API_MAC, NODE = "02:00:00:00:00:02", "fixture-monitor"


def conditions():
    return policy.Conditions(snapshot(policy.disabled.PATCHED), BRIDGE,
                             True, True, True, True, True, True, True,
                             policy.MIN_START_RAM, False, 0)


def trial(initial=None, **kwargs):
    return policy.FirstBridgeTrial(PLAN_ID, PLAN_SHA, TARGET, BOOT, BRIDGE, GUARDIAN,
                                   kwargs.get("api_mac", API_MAC), kwargs.get("node_name", NODE),
                                   initial or conditions())


def child():
    return policy.Child(70, 200, BRIDGE, 0, 69, 190, GUARDIAN, 0, True, True, 1000)


def observed(*, reaped=False, status=None, changed=None, process=None):
    value = changed or conditions()
    value = replace(value, disabled=replace(value.disabled, own_code_running=not reaped))
    return policy.Observation(value, process or child(), reaped, status)


def sample(generation=1, **kwargs):
    value = policy.ApiSample(True, API_MAC, NODE, (generation,) * 4,
                             (650, 23.5, 40, 0.145), 1)
    return replace(value, **kwargs)


def running():
    value = trial()
    assert value.issue_start(0, conditions()).kind == "start_one_shot_guardian"
    assert value.started(100, observed())
    return value


class FirstBridgeTrialTests(unittest.TestCase):
    def test_admission_needs_exact_disabled_headless_scope_and_actual_ram(self):
        initial = conditions()
        changes = [{name: flag} for name in (
            "full_release_store_absent", "wifi_store_absent", "persistent_preferences_absent",
            "boot_launcher_lock_absent", "api_ota_listeners_free", "private_ram_job", "tmpfs_verified")
            for flag in (False, None, 1)]
        changes += [{"ram_available_bytes": value} for value in (None, True, policy.MIN_START_RAM - 1)]
        changes += [{"unexpected_own_process_present": None}, {"unexpected_own_process_present": True},
                    {"log_bytes": -1}, {"log_bytes": policy.MAX_LOG_BYTES + 1},
                    {"bridge_sha256": "c" * 64}]
        for change in changes:
            with self.subTest(change=change), self.assertRaises(ValueError):
                trial(replace(initial, **change))
        for value in (snapshot(), snapshot({policy.disabled.START: policy.disabled.PATCHED[policy.disabled.START]})):
            with self.subTest(vendor=value.vendor_hashes), self.assertRaises(ValueError):
                trial(replace(initial, disabled=value))
        for mac in (TARGET[0], "00:00:00:00:00:02", "03:00:00:00:00:02", "bad"):
            with self.subTest(mac=mac), self.assertRaises(ValueError):
                trial(api_mac=mac)

    def test_start_is_one_shot_and_failed_cas_seals_the_intent(self):
        value = trial()
        changed = replace(conditions(), disabled=replace(conditions().disabled, boot_id=BOOT[:-1] + "2"))
        self.assertIsNone(value.issue_start(0, changed))
        self.assertEqual(value.state, "reconciliation_required")
        self.assertIsNone(value.issue_start(1, conditions()))
        value = running()
        self.assertIsNone(value.issue_start(50000, conditions()))
        self.assertEqual(value.tick(60000, observed()).kind, "terminate_exact_owned_child")

    def test_kernel_child_parent_death_and_oom_protection_are_mandatory(self):
        bad = [replace(child(), **change) for change in (
            {"pid": 50}, {"pid": 51}, {"guardian_pid": 50}, {"guardian_pid": 51},
            {"pid": 69}, {"start": 0}, {"guardian_start": True}, {"uid": 1},
            {"guardian_uid": 1}, {"held_unreaped_child": False}, {"held_unreaped_child": None},
            {"parent_death_term_armed": False}, {"oom_score_adj": 0}, {"oom_score_adj": True},
            {"executable_sha256": "c" * 64}, {"guardian_sha256": "c" * 64})]
        for process in bad:
            with self.subTest(process=process):
                value = trial()
                value.issue_start(0, conditions())
                self.assertFalse(value.started(100, observed(process=process)))
                self.assertEqual(value.state, "reconciliation_required")
                self.assertIsNone(value.tick(60000, observed(process=process)))
        value = trial()
        value.issue_start(0, conditions())
        self.assertFalse(value.started(60000, observed()))  # A delayed ACK cannot restart the timer.

    def test_replaced_pid_or_lost_ownership_is_never_signalled(self):
        for process in (replace(child(), start=201), replace(child(), guardian_start=191),
                        replace(child(), held_unreaped_child=False), replace(child(), pid=50)):
            with self.subTest(process=process):
                value = running()
                self.assertIsNone(value.tick(60000, observed(process=process)))
                self.assertEqual(value.state, "reconciliation_required")
                self.assertIsNone(value.tick(70000, observed()))

    def test_api_proof_is_authenticated_correct_identity_finite_and_independent(self):
        cases = [sample(noise_authenticated=False), sample(api_mac=TARGET[0]), sample(node_name="other"),
                 sample(generations=(1, 1, 1, 0)), sample(generations=(True,) * 4),
                 sample(values=(float("nan"), 20, 40, 0.1)), sample(values=(650, 20, float("inf"), 0.1)),
                 sample(values=(99999, 20, 40, 0.1)), sample(values=(0, 20, 40, 0.1)),
                 sample(values=(650, 20, 101, 0.1)), sample(values=(650, 20, 40, -1)),
                 sample(values=(10 ** 1000, 20, 40, 0.1)),
                 sample(stock_response_age_s=30), sample(stock_response_age_s=None)]
        for invalid in cases:
            with self.subTest(invalid=invalid):
                value = running()
                self.assertFalse(value.api_sample(1000, invalid))
        value = running()
        self.assertTrue(value.api_sample(1000, sample()))
        self.assertFalse(value.api_sample(1001, sample(2)))
        self.assertFalse(value.api_sample(12000, sample()))
        self.assertFalse(value.api_sample(12000, sample(generations=(2, 2, 1, 2))))
        self.assertTrue(value.api_sample(12000, sample(2)))

    def test_bounded_success_needs_recent_wire_updates_and_exact_child_reap(self):
        value = running()
        self.assertTrue(value.api_sample(40000, sample()))
        self.assertTrue(value.api_sample(50000, sample(2)))
        self.assertIsNone(value.tick(59999, observed()))
        action = value.tick(60000, observed())
        self.assertEqual((action.kind, action.pid, action.start), ("terminate_exact_owned_child", 70, 200))
        self.assertIsNone(value.tick(60001, observed()))
        self.assertIsNone(value.tick(61000, observed(reaped=True, status=15)))
        self.assertEqual(value.state, "trial_verified_stopped")
        self.assertIsNone(value.tick(80000, observed()))
        self.assertIsNone(value.issue_start(80001, conditions()))

    def test_stale_or_missing_samples_crash_and_early_exit_never_qualify(self):
        for case in ("stale", "missing", "crash", "early", "unknown_exit"):
            with self.subTest(case=case):
                value = running()
                if case == "stale":
                    value.api_sample(1000, sample())
                    value.api_sample(11000, sample(2))
                elif case != "missing":
                    value.api_sample(40000, sample())
                    value.api_sample(50000, sample(2))
                if case != "early":
                    value.tick(60000, observed())
                value.tick(61000 if case != "early" else 51000,
                           observed(reaped=True, status=11 if case == "crash" else None if case == "unknown_exit" else 0))
                self.assertEqual(value.state, "trial_failed_stopped")

    def test_deadline_escalates_once_and_forced_stop_is_not_success(self):
        value = running()
        self.assertEqual(value.tick(60000, observed()).kind, "terminate_exact_owned_child")
        self.assertIsNone(value.tick(64999, observed()))
        self.assertEqual(value.tick(65000, observed()).kind, "kill_exact_owned_child")
        self.assertIsNone(value.tick(65001, observed()))
        value.tick(66000, observed(reaped=True, status=9))
        self.assertEqual(value.state, "trial_failed_stopped")
        value = running()
        value.tick(60000, observed())
        value.tick(65000, observed())
        self.assertIsNone(value.tick(70000, observed()))
        self.assertEqual(value.state, "reconciliation_required")
        self.assertIsNone(value.tick(71000, observed()))

    def test_scope_failure_can_only_stop_the_verified_child_and_cannot_qualify(self):
        initial = conditions()
        changed_conditions = [replace(initial, **change) for change in (
            {"ram_available_bytes": policy.MIN_RUNNING_RAM - 1}, {"log_bytes": policy.MAX_LOG_BYTES + 1},
            {"full_release_store_absent": False}, {"wifi_store_absent": False},
            {"persistent_preferences_absent": False}, {"unexpected_own_process_present": None})]
        changed_conditions += [replace(initial, disabled=replace(initial.disabled, **change)) for change in (
            {"disabled_flags": ()}, {"root_identity": (1, 3)}, {"pm_helper_loaded": True},
            {"stock_process": (50, 101, initial.disabled.stock_process[2], 0)},
            {"watchdog_process": (51, 111, 0)}, {"data_available_bytes": 1})]
        for changed in changed_conditions:
            with self.subTest(changed=changed):
                value = running()
                action = value.tick(1000, observed(changed=changed))
                self.assertEqual((action.kind, action.pid), ("terminate_exact_owned_child", 70))
                value.tick(2000, observed(reaped=True, status=0))
                self.assertEqual(value.state, "trial_failed_stopped")

    def test_clock_regression_unknown_observation_or_unknown_running_state_fail_closed(self):
        for now in (99, -1, None, True):
            with self.subTest(now=now):
                value = running()
                self.assertIsNone(value.tick(now, observed()))
                self.assertEqual(value.state, "reconciliation_required")
        value = running()
        self.assertIsNone(value.tick(1000, None))
        self.assertEqual(value.state, "reconciliation_required")
        value = trial()
        value.issue_start(0, conditions())
        self.assertFalse(value.started(100, None))
        self.assertEqual(value.state, "reconciliation_required")
        value = running()
        obs = observed()
        obs = replace(obs, conditions=replace(obs.conditions, disabled=replace(obs.conditions.disabled, own_code_running=None)))
        self.assertEqual(value.tick(1000, obs).kind, "terminate_exact_owned_child")


if __name__ == "__main__":
    unittest.main()
