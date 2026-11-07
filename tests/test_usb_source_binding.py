"""Source-pin upgrades preserve jobs; every payload still belongs to one source.

All jobs, programs, captures and keys here are temporary synthetic fixtures.
No compiler, downloaded source, ADB or device engine is executed by this suite.
"""
import hashlib
import io
import json
import os
from pathlib import Path
import tarfile
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

import test_usb_computer as computer

worker = computer.plans.worker
plans = computer.plans.plans
package = computer.package
desktop = computer.desktop
CURRENT = "53d97b9609e8e0fcdfc5d003101f620098dbc734"
PREVIOUS = "0de9c99e57192742b82616cf82c0fdad71c562c5"
HISTORICAL = "e09440f9fa36da2aaad16212734879bb6304f6d2"


class SourceBindingTests(unittest.TestCase):
    def fixture(self, source=CURRENT):
        # Emulate bytes produced by a previous companion, then let the new
        # implementation read them. Only the isolated producer's constant is
        # changed; no production code rewrites an old intent or result.
        with patch.object(worker, "SOURCE_COMMIT", source):
            fixture = computer.ComputerExportTests(methodName="runTest")
            fixture.setUp()
        self.addCleanup(fixture.doCleanups)
        return fixture

    def load_export(self, fixture):
        raw = fixture.export()
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        with tarfile.open(fileobj=io.BytesIO(raw)) as archive:
            previous = os.umask(0o077)
            try:
                archive.extractall(temporary.name, filter="data")
            finally:
                os.umask(previous)
        root = Path(temporary.name).resolve() / package.PREFIX
        return root, desktop.load_bundle(root)[2]

    def test_only_three_reviewed_sources_and_new_build_default(self):
        self.assertEqual(worker.SOURCE_COMMIT, CURRENT)
        self.assertEqual(worker.REVIEWED_SOURCE_COMMITS, frozenset((CURRENT, PREVIOUS, HISTORICAL)))
        # The standalone entry cannot import another bundle file before body
        # verification. Its deliberately duplicated fixed list must agree.
        self.assertEqual(desktop.REVIEWED_SOURCE_COMMITS, worker.REVIEWED_SOURCE_COMMITS)

    def test_previous_default_export_keeps_its_source_and_lacks_new_trial_capability(self):
        from full_ui_installation import TRIAL_SOURCE_COMMITS
        fixture = self.fixture(PREVIOUS)
        _, manifest = self.load_export(fixture)
        self.assertEqual(manifest["source_commit"], PREVIOUS)
        self.assertNotIn(PREVIOUS, TRIAL_SOURCE_COMMITS)
        self.assertEqual(desktop.TRIAL_SOURCE_COMMITS, TRIAL_SOURCE_COMMITS)
        self.assertEqual(TRIAL_SOURCE_COMMITS, frozenset((CURRENT,)))

    def test_historical_completed_job_status_and_export_preserve_original_bytes(self):
        fixture = self.fixture(HISTORICAL)
        pins = {p.relative_to(fixture.root): hashlib.sha256(p.read_bytes()).hexdigest()
                for p in fixture.root.rglob("*") if p.is_file()}
        with patch.object(worker, "SOURCE_COMMIT", CURRENT), patch.object(worker.subprocess, "Popen") as spawn:
            restarted = worker.Builds(fixture.root.parent, fixture.fixture.fixture.fixture.contract)
            self.assertEqual(restarted.status(fixture.fixture.owner, fixture.fixture.id)["state"], "built_not_installed")
            _, manifest = self.load_export(fixture)
            self.assertEqual(manifest["source_commit"], HISTORICAL)
            spawn.assert_not_called()
        self.assertEqual(pins, {p.relative_to(fixture.root): hashlib.sha256(p.read_bytes()).hexdigest()
                               for p in fixture.root.rglob("*") if p.is_file()})

    def test_current_completed_job_export_retains_current_source(self):
        fixture = self.fixture()
        with patch.object(worker, "SOURCE_COMMIT", CURRENT):
            _, manifest = self.load_export(fixture)
        self.assertEqual(manifest["source_commit"], CURRENT)

    def test_historical_completed_plan_is_readable_without_replanning(self):
        with patch.object(worker, "SOURCE_COMMIT", HISTORICAL):
            fixture = computer.plans.PlanTests(methodName="runTest")
            fixture.setUp()
            fixture.prepare()
        self.addCleanup(fixture.doCleanups)
        before = (fixture.directory / "install-plan/plan.json").read_bytes()
        with patch.object(worker, "SOURCE_COMMIT", CURRENT), patch.object(worker.subprocess, "Popen") as spawn:
            self.assertEqual(fixture.manager.status(fixture.owner, fixture.id)["state"], "plan_prepared")
            with self.assertRaisesRegex(Exception, "usb_plan_consumed"):
                fixture.prepare()
            spawn.assert_not_called()
        self.assertEqual((fixture.directory / "install-plan/plan.json").read_bytes(), before)

    def test_another_reviewed_source_cannot_replace_the_bound_report(self):
        fixture = self.fixture()
        path = fixture.root / "candidate/result.json"
        report = json.loads(path.read_text())
        report["source_commit"] = HISTORICAL
        path.write_text(json.dumps(report))  # Fault only this temporary fixture.
        with patch.object(worker, "SOURCE_COMMIT", CURRENT), patch.object(worker.subprocess, "Popen") as spawn:
            for read in (lambda: fixture.fixture.fixture.manager.status(fixture.fixture.owner, fixture.fixture.id),
                         lambda: plans.source_closure(fixture.root), fixture.export):
                with self.subTest(read=read):
                    with self.assertRaises(Exception):
                        read()
            spawn.assert_not_called()
        self.assertFalse((fixture.root / "plan-intent.json").exists())

    def test_another_reviewed_source_cannot_replace_plan_basis(self):
        fixture = self.fixture().fixture
        fixture.prepare()
        path = fixture.directory / "install-plan/plan.json"
        body = json.loads(path.read_text())
        body["basis"]["source_commit"] = HISTORICAL
        path.write_text(json.dumps(body))
        # Check the join itself, independent of the additional frozen-plan
        # hash fence in ordinary status. Membership is not source equality.
        with self.assertRaisesRegex(Exception, "usb_plan_unverified"):
            plans.verify_plan(fixture.directory)

    def test_desktop_manifest_and_report_must_have_the_same_reviewed_source(self):
        fixture = self.fixture()
        with patch.object(worker, "SOURCE_COMMIT", CURRENT):
            root, manifest = self.load_export(fixture)
        manifest["source_commit"] = HISTORICAL
        (root / "bundle.json").write_text(json.dumps(manifest))
        with self.assertRaisesRegex(ValueError, "matching public source"):
            desktop.load_bundle(root)

    def test_unknown_or_malformed_sources_never_authorize_status_or_export(self):
        fixture = self.fixture()
        path = fixture.root / "build-intent.json"
        original = json.loads(path.read_text())
        with patch.object(worker.subprocess, "Popen") as spawn:
            for value in ("main", "0" * 40, "f" * 40, None, [], {}):
                with self.subTest(source=value):
                    path.write_text(json.dumps({**original, "source_commit": value}))
                    with self.assertRaisesRegex(Exception, "usb_build_unverified"):
                        fixture.export()
            spawn.assert_not_called()

    def test_historical_incomplete_job_stays_consumed_and_blocks_new_build(self):
        fixture = computer.plans.builds.BuildTests(methodName="runTest")
        fixture.setUp()
        self.addCleanup(fixture.doCleanups)
        with patch.object(worker, "SOURCE_COMMIT", HISTORICAL):
            fixture.intent()
        next_job = fixture.fixture.prepare()
        restarted = worker.Builds(fixture.fixture.parent, fixture.fixture.contract)
        with patch.object(worker, "SOURCE_COMMIT", CURRENT), patch.object(worker.subprocess, "Popen") as spawn:
            self.assertEqual(restarted.status(fixture.fixture.owner, fixture.job_id)["state"], "build_unverified")
            with self.assertRaisesRegex(Exception, "usb_build_consumed"):
                restarted.start(fixture.fixture.owner, fixture.job_id)
            with self.assertRaisesRegex(Exception, "usb_build_busy"):
                restarted.start(fixture.fixture.owner, next_job["job_id"])
            spawn.assert_not_called()

    def test_historical_terminal_failure_keeps_history_and_new_worker_uses_current(self):
        fixture = computer.plans.builds.BuildTests(methodName="runTest")
        fixture.setUp()
        self.addCleanup(fixture.doCleanups)
        with patch.object(worker, "SOURCE_COMMIT", HISTORICAL):
            fixture.intent()
            fixture.synthetic_build(corrupt=True)
        old_intent = (fixture.directory / "build-intent.json").read_bytes()
        next_job = fixture.fixture.prepare()
        restarted = worker.Builds(fixture.fixture.parent, fixture.fixture.contract)
        with patch.object(worker.shutil, "disk_usage", return_value=SimpleNamespace(free=worker.MIN_FREE)), \
                patch.object(worker.subprocess, "Popen", return_value=SimpleNamespace(poll=lambda: None)) as spawn:
            self.assertEqual(restarted.status(fixture.fixture.owner, fixture.job_id)["state"], "build_failed")
            restarted.start(fixture.fixture.owner, next_job["job_id"])
            spawn.assert_called_once()
        intent = json.loads((fixture.fixture.parent / next_job["job_id"] / "build-intent.json").read_text())
        self.assertEqual(intent["source_commit"], CURRENT)
        self.assertEqual((fixture.directory / "build-intent.json").read_bytes(), old_intent)

    def test_reviewed_history_does_not_allow_a_new_worker_to_execute_old_intent(self):
        fixture = computer.plans.builds.BuildTests(methodName="runTest")
        fixture.setUp()
        self.addCleanup(fixture.doCleanups)
        with patch.object(worker, "SOURCE_COMMIT", HISTORICAL):
            fixture.intent()
        runner = Mock()
        with patch.object(worker, "SOURCE_COMMIT", CURRENT):
            with self.assertRaisesRegex(Exception, "usb_build_unverified"):
                worker.build(fixture.directory, fixture.fixture.contract, runner)
        runner.assert_not_called()
        self.assertFalse((fixture.directory / "source").exists())


if __name__ == "__main__":
    unittest.main()
