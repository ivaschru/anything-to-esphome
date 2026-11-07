"""Execute the permanent coordinator against synthetic SDK peers only.

The real four-action sequence, capacity admission and lost-response handling
run here. No device, USB, filesystem write through an API, or HA is contacted.
"""
import asyncio
import copy
import json
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch
from test_usb_full_ui_trial import Peer

HERE = Path(__file__).resolve().parents[1] / "apps/monitor1_usb/rootfs"
with patch.object(sys, "path", [str(HERE), *sys.path]):
    import full_ui_activation as activation

WRITES = ("full_runtime_install_core_release", "full_runtime_set_core_boot_mode",
          "full_runtime_new_session", "full_runtime_start_installed_core")


class ActivationPeer(Peer):
    def __init__(self):
        super().__init__()
        self.stored, self.enabled, self.reset, self.started = False, False, False, False
        self.boot_job, self.bridge_reads, self.lost, self.wrong_pair = "e" * 16, 0, None, False
        self.disk = {"ok": False, "error": "private_release_store_required", "read_only": True,
                     "block_bytes": 4096, "blocks_available": 100000, "inodes_free": 100,
                     "bridge": {"regular_owned_image": True, "hash_verified": True, "bytes": 100, "sha256": self.bridge}}

    def frame(self):
        rows = [{"kind": k, **pin, "offset": 0 if self.reset else pin["size"], "verified": not self.reset}
                for k, pin in self.expected.items()]
        if self.wrong_pair:
            rows[0]["sha256"] = "f" * 64
        return {"job": self.boot_job if self.started else ("" if self.reset else self.job),
                "phase": 0 if self.reset else 7, "hard_runtime_ms": 0 if self.reset else 60000,
                "native_acquired": not self.reset, "hardware_trial_active": False,
                "core_boot_enabled": self.enabled, "core_boot_job": self.boot_job if self.started else "",
                "core_release_autostart_supported": True, "materialized": not self.reset,
                "upload_duplicates_released": not self.reset, "coordinator_error": "", "artifacts": rows,
                "last_session_reset_job": self.job}

    def factory(self, *args, **kwargs):
        client = super().factory(*args, **kwargs)
        native = self.started and self.bridge_reads >= 2

        async def services():
            names = ("full_native_status",) if native else activation.SERVICES
            return [], [SimpleNamespace(name=n) for n in names]

        async def execute(service, data, **kwargs):
            name = service.name
            self.calls.append((name, copy.deepcopy(data)))
            if name == "full_runtime_status":
                if self.started:
                    self.bridge_reads += 1
                body = self.frame()
            elif name == "storage_audit":
                body = self.disk
            elif name == "full_runtime_install_core_release":
                assert data == {"job": self.job}
                self.stored = True
                body = {"ok": True, "vendor_boot_files_changed": False, "enabled": False, "error": ""}
            elif name == "full_runtime_set_core_boot_mode":
                assert data == {"enabled": True}
                self.enabled = True
                body = {"ok": True, "enabled": True, "error": ""}
            elif name == "full_runtime_new_session":
                assert data == {"previous_job": self.job}
                self.reset = True
                body = {"ok": True, "previous_job": self.job, "already_reset": False,
                        "programs_and_evidence_preserved": True, "hardware_or_network_mutations": False}
            elif name == "full_runtime_start_installed_core":
                assert data == {}
                self.started = True
                body = {"ok": True}
            else:
                assert name == "full_native_status"
                self.observations += 1
                body = {"nonce": "f" * 16 if self.wrong_native else self.boot_job, "boot_id": self.boot,
                        "native_sha256": self.expected["native-program"]["sha256"],
                        "guardian_sha256": self.expected["guardian-program"]["sha256"],
                        "native_state": 1, "connected_guardians": True, "panel_ready": True,
                        "core_sensors_ready": not (self.warming and self.observations == 1),
                        "guardian_generations": [self.observations, self.observations]}
            if self.lost == name:
                raise TimeoutError("synthetic private response must not escape")
            return SimpleNamespace(success=True, response_data=json.dumps(body))
        client.list_entities_services, client.execute_service = services, execute
        return client

    def run(self):
        return asyncio.run(activation.run(16053, self.profile, self.expected, {"size": 100, "sha256": self.bridge},
            self.boot, self.job, factory=self.factory, clock=lambda: self.now, sleep=self.sleep))

    def writes(self):
        return [name for name, _ in self.calls if name in WRITES]


class ActivationTests(unittest.TestCase):
    def test_exact_four_steps_then_fresh_native_observation_without_a_reboot(self):
        peer = ActivationPeer()
        result = peer.run()
        self.assertEqual(peer.writes(), list(WRITES))
        self.assertEqual(result["state"], "full_ui_active_observed")
        self.assertEqual(result["native_job"], peer.boot_job)
        self.assertEqual(result["native_observations"], 2)
        self.assertTrue(result["store_installed"] and result["boot_enabled"])
        self.assertFalse(result["installed"] or result["installation_ready"] or result["replay_allowed"])
        self.assertTrue(all(client.closed for client in peer.clients))

    def test_capacity_or_unknown_pair_refuses_before_any_write(self):
        for change in ("space", "identity", "inventory", "boolean"):
            peer = ActivationPeer()
            if change == "space": peer.disk["blocks_available"] = 1
            if change == "identity": peer.wrong_pair = True
            if change == "inventory": peer.disk["error"] = "unknown inventory failure"
            if change == "boolean": peer.disk["blocks_available"] = True
            result = peer.run()
            self.assertNotEqual(result["state"], "full_ui_active_observed")
            self.assertEqual(peer.writes(), [])
            self.assertTrue(all(client.closed for client in peer.clients))

    def test_lost_enable_ack_is_unknown_and_never_continues_to_start(self):
        peer = ActivationPeer(); peer.lost = "full_runtime_set_core_boot_mode"
        result = peer.run()
        self.assertEqual(peer.writes(), list(WRITES[:2]))
        self.assertEqual(result["state"], "full_ui_activation_unverified")
        self.assertIsNone(result["boot_enabled"])
        self.assertTrue(result["store_installed"])

    def test_lost_start_ack_reads_the_same_boot_job_and_never_reissues_start(self):
        peer = ActivationPeer(); peer.lost = "full_runtime_start_installed_core"
        result = peer.run()
        self.assertEqual(result["state"], "full_ui_active_observed")
        self.assertFalse(result["start_acknowledged"])
        self.assertEqual(peer.writes(), list(WRITES))
        after = [name for name, _ in peer.calls][[name for name, _ in peer.calls].index(WRITES[-1]) + 1:]
        self.assertTrue(all(name.endswith("_status") for name in after))

    def test_warmup_can_settle_but_another_nonce_never_qualifies(self):
        peer = ActivationPeer(); peer.warming = True
        self.assertEqual(peer.run()["state"], "full_ui_active_observed")
        peer = ActivationPeer(); peer.wrong_native = True
        self.assertEqual(peer.run()["state"], "full_ui_activation_unverified")
        self.assertEqual(peer.writes(), list(WRITES))

    def test_cleanup_failure_overrides_early_refusal_and_a_started_result(self):
        for space in (True, False):
            peer = ActivationPeer(); peer.disconnect_error = True
            if space: peer.disk["blocks_available"] = 1
            self.assertEqual(peer.run()["state"], "full_ui_activation_close_unverified")


if __name__ == "__main__":
    unittest.main()
