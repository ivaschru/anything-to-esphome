"""Read-only API prerequisites, synthetic responses and no device/HA calls."""
import asyncio
import json
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, patch

HERE = Path(__file__).resolve().parents[1] / "apps/monitor1_usb/rootfs"
with patch.object(sys, "path", [str(HERE), *sys.path]):
    import full_ui_review as reviewer


class FullUiReviewTests(unittest.TestCase):
    def setUp(self):
        self.profile = {"api_encryption_key": "synthetic-only-never-used-on-wire", "api_mac": "02:00:00:00:00:01", "node_name": "fixture"}
        self.expected = {"native-program": {"size": 100, "sha256": "a" * 64}, "guardian-program": {"size": 200, "sha256": "b" * 64}}
        self.boot, self.bridge = "1" * 8 + "-" + "1" * 4 + "-" + "1" * 4 + "-" + "1" * 4 + "-" + "1" * 12, "c" * 64
        self.status = {"job": "", "phase": 0, "hardware_trial_active": False, "core_boot_enabled": False,
                       "core_release_autostart_supported": True,
                       "artifacts": [{"kind": name, **pin} for name, pin in self.expected.items()]}
        self.capture = {"ok": True, "read_only": True, "process_signals_exposed": False, "network_mutations_exposed": False,
                        "boot_id": self.boot, "bridge_sha256": self.bridge}
        self.services = [SimpleNamespace(name=name) for name in ("full_runtime_status", "full_runtime_inspect_start", "full_runtime_launch")]
        self.client = SimpleNamespace(connect=AsyncMock(), disconnect=AsyncMock(), device_info=AsyncMock(
            return_value=SimpleNamespace(name="fixture", mac_address="02:00:00:00:00:01")),
            list_entities_services=AsyncMock(return_value=([], self.services)))
        async def execute(service, data, **kwargs):
            self.assertIn(service.name, ("full_runtime_status", "full_runtime_inspect_start"))
            self.assertEqual(data, {})
            return SimpleNamespace(success=True, response_data=json.dumps(self.status if service.name.endswith("_status") else self.capture).encode())
        self.client.execute_service = AsyncMock(side_effect=execute)

    def run_review(self):
        return asyncio.run(reviewer.review(16053, self.profile, self.expected, self.bridge, self.boot, lambda *a, **k: self.client))

    def test_positive_is_only_read_observation_and_uses_no_mutating_action(self):
        result = self.run_review()
        self.assertEqual(result["state"], "full_ui_preflight_observed")
        self.assertFalse(result["installation_ready"] or result["installed"] or result["launch_authorized"])
        self.assertEqual(result["device_writes"], 0)
        self.client.disconnect.assert_awaited_once()

    def test_precise_pm_prerequisite_is_separate_from_unknown_refusal(self):
        self.capture.update(ok=False, stock_error="pm_helper_not_in_verified_state")
        self.assertEqual(self.run_review()["state"], "pm_extension_required")
        self.capture["stock_error"] = "unexpected_stock_wrapper"
        self.assertEqual(self.run_review()["state"], "pm_extension_scope_required")
        self.capture["stock_error"] = "untrusted private output must not escape"
        result = self.run_review()
        self.assertEqual(result["state"], "full_ui_unverified")
        self.assertNotIn("untrusted", json.dumps(result))

    def test_wrong_identity_or_compiled_pair_fails_before_board_capture(self):
        self.status["artifacts"][0]["sha256"] = "d" * 64
        with self.assertRaises(reviewer.FullUiReviewError):
            self.run_review()
        self.assertEqual(self.client.execute_service.await_count, 1)
        self.client.disconnect.assert_awaited_once()

    def test_existing_session_or_changed_boot_never_grants_a_launch(self):
        self.status["job"] = "d" * 16
        with self.assertRaises(reviewer.FullUiReviewError):
            self.run_review()
        self.status["job"] = ""
        self.capture["boot_id"] = "2" * 8 + self.boot[8:]
        with self.assertRaises(reviewer.FullUiReviewError):
            self.run_review()

    def test_duplicates_and_ambiguous_disconnect_cannot_return_positive(self):
        with self.assertRaises(reviewer.FullUiReviewError):
            reviewer.unique_json('{"ok":true,"ok":false}')
        self.client.disconnect.side_effect = RuntimeError("synthetic private error")
        with self.assertRaisesRegex(reviewer.FullUiReviewError, "^usb_full_ui_close_unverified$"):
            self.run_review()


if __name__ == "__main__":
    unittest.main()


class WireJsonTests(unittest.TestCase):
    def test_bounded_actual_wire_bytes_are_utf8_and_unique(self):
        self.assertEqual(reviewer.unique_json('{"ok": true, "label": "Русский"}'.encode()), {'ok': True, 'label': 'Русский'})
        for raw in (b'', b'\xff', b'{"ok":true,"ok":false}', b'x' * 32769, b'[]'):
            with self.subTest(raw_type=type(raw).__name__), self.assertRaises(Exception): reviewer.unique_json(raw)
