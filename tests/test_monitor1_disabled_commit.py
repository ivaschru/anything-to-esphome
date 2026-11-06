"""Interrupted disabled vendor transactions; no scripts or device are run."""
from dataclasses import replace
import importlib
from pathlib import Path
import sys
import unittest

PORT = Path(__file__).resolve().parents[1] / "ports/monitor1"
sys.path.insert(0, str(PORT))
try:
    policy = importlib.import_module("disabled_commit_policy")
finally:
    sys.path.pop(0)

PLAN_ID, PLAN_SHA = "1" * 32, "2" * 64
BOOT = "00000000-0000-4000-8000-000000000001"
TARGET = ("02:00:00:00:00:01", 3, "4.1.8_0287", "fixtureUSB", "usb:fixture")


def snapshot(changes=None):
    vendors = {name: spec[0] for name, spec in policy.preflight.FILES.items()}
    vendors.update(changes or {})
    flag = (policy.EMPTY_SHA, 0, 0o600, 0, 1, False)
    return policy.Snapshot(target=TARGET, boot_id=BOOT, root_identity=(1, 2),
                           install_marker=PLAN_ID + " " + PLAN_SHA, root_mode=0o700, root_uid=0,
                           disabled_flags=(flag, flag), source_hashes=tuple(sorted(policy.SOURCES.items())),
                           vendor_hashes=tuple(sorted(vendors.items())),
                           stock_process=(50, 100, policy.preflight.FILES["/data/bin/SnowApp"][0], 0),
                           watchdog_process=(51, 110, 0), own_code_running=False,
                           pm_helper_loaded=False, data_available_bytes=32 * 1024 * 1024,
                           same_filesystem=True)


def transaction(initial, direction="commit_disabled"):
    return policy.DisabledVendorTransaction(PLAN_ID, PLAN_SHA, TARGET, BOOT, direction, initial)


def applied(observed, operation):
    vendors = dict(observed.vendor_hashes)
    assert vendors[operation.target] == operation.expected_before
    vendors[operation.target] = operation.expected_after
    return replace(observed, vendor_hashes=tuple(sorted(vendors.items())))


class DisabledCommitTests(unittest.TestCase):
    def test_forward_commit_needs_two_independent_readbacks_and_stays_disabled(self):
        observed = snapshot()
        action = transaction(observed)
        for target in (policy.WATCHDOG, policy.START):
            operation = action.issue(observed)
            self.assertEqual(operation.target, target)
            self.assertEqual(operation.expected_before, policy.FACTORY[target])
            self.assertEqual(operation.expected_after, policy.PATCHED[target])
            self.assertEqual(action.state, "issued_waiting_for_independent_readback")
            observed = applied(observed, operation)
            action.acknowledge(observed)
        self.assertEqual(action.state, "committed_disabled")
        self.assertEqual(observed.disabled_flags, snapshot().disabled_flags)
        self.assertIsNone(action.issue(observed))
        self.assertEqual(action.state, "committed_disabled")

    def test_each_partial_commit_state_has_only_exact_separate_rollback(self):
        for start_patched in (False, True):
            for watchdog_patched in (False, True):
                changes = {path: policy.PATCHED[path] for path, enabled in
                           ((policy.START, start_patched), (policy.WATCHDOG, watchdog_patched)) if enabled}
                observed = snapshot(changes)
                with self.subTest(start=start_patched, watchdog=watchdog_patched):
                    if not changes:
                        with self.assertRaises(ValueError):
                            transaction(observed, "rollback_disabled")
                        continue
                    with self.assertRaises(ValueError):
                        transaction(observed)  # Never finish an interrupted forward write automatically.
                    rollback = transaction(observed, "rollback_disabled")
                    expected_paths = [path for path in (policy.START, policy.WATCHDOG) if path in changes]
                    self.assertEqual([op.target for op in rollback.operations], expected_paths)
                    for path in expected_paths:
                        op = rollback.issue(observed)
                        self.assertEqual(op.source, "stock-start.sh.original" if path == policy.START else "stock-watchdog.sh.original")
                        observed = applied(observed, op)
                        rollback.acknowledge(observed)
                    self.assertEqual(rollback.state, "rolled_back_disabled")
                    self.assertEqual(dict(observed.vendor_hashes), dict(snapshot().vendor_hashes))

    def test_lost_ack_or_repeated_issue_never_reemits_a_write(self):
        for failure in ("timeout", "duplicate_issue"):
            with self.subTest(failure=failure):
                before = snapshot()
                action = transaction(before)
                operation = action.issue(before)
                after = applied(before, operation)
                if failure == "timeout":
                    action.ambiguous_result()
                else:
                    self.assertIsNone(action.issue(before))
                self.assertEqual(action.state, "reconciliation_required")
                self.assertIsNone(action.acknowledge(after))
                self.assertIsNone(action.issue(after))
                self.assertEqual(action.state, "reconciliation_required")

    def test_ack_is_not_a_host_success_flag_and_rejects_missing_or_extra_changes(self):
        for result in (snapshot(), snapshot(policy.PATCHED)):
            with self.subTest(result=result.vendor_hashes):
                action = transaction(snapshot())
                action.issue(snapshot())
                self.assertIsNone(action.acknowledge(result))
                self.assertEqual(action.state, "reconciliation_required")

    def test_live_scope_source_and_process_changes_refuse_before_issue(self):
        initial = snapshot()
        cases = [replace(initial, boot_id=BOOT[:-1] + "2"),
                 replace(initial, root_identity=(1, 3)),
                 replace(initial, install_marker=PLAN_ID + " " + "3" * 64),
                 replace(initial, target=(TARGET[0], 2, *TARGET[2:])),
                 replace(initial, stock_process=(50, 101, initial.stock_process[2], 0)),
                 replace(initial, watchdog_process=(52, 111, 0)),
                 replace(initial, own_code_running=True),
                 replace(initial, own_code_running=None),
                 replace(initial, pm_helper_loaded=None),
                 replace(initial, same_filesystem=False),
                 replace(initial, root_mode=0o777),
                 replace(initial, data_available_bytes=1),
                 replace(initial, disabled_flags=()),
                 replace(initial, source_hashes=()),
                 replace(initial, vendor_hashes=tuple(sorted({**dict(initial.vendor_hashes), policy.START: "0" * 64}.items())))]
        for changed in cases:
            with self.subTest(changed=changed):
                action = transaction(initial)
                self.assertIsNone(action.issue(changed))
                self.assertEqual(action.state, "reconciliation_required")

    def test_wrong_plan_unknown_vendor_or_incomplete_proof_is_never_admitted(self):
        for changed in (replace(snapshot(), root_uid=False),
                        replace(snapshot(), stock_process=None),
                        replace(snapshot(), source_hashes=(("bad",),)),
                        replace(snapshot(), vendor_hashes=()),
                        snapshot({policy.WATCHDOG: "0" * 64})):
            with self.subTest(changed=changed), self.assertRaises(ValueError):
                transaction(changed, "rollback_disabled")
        with self.assertRaises(ValueError):
            policy.DisabledVendorTransaction("bad", PLAN_SHA, TARGET, BOOT, "commit_disabled", snapshot())
        with self.assertRaises(ValueError):
            transaction(snapshot(), "activate")
