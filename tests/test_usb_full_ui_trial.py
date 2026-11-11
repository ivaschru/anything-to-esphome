"""Execute the real trial coordinator with synthetic SDK peers only.

These fixtures exercise sequencing, lost replies and owned connection cleanup.
No real API connection, USB, firmware, private profile or hardware is used.
"""
import asyncio
import copy
import hashlib
import json
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parents[1] / "apps/monitor1_usb/rootfs"
with patch.object(sys, "path", [str(HERE), *sys.path]):
    import full_ui_trial as trial


class Peer:
    def __init__(self):
        self.images = {"native-program": b"synthetic native" * 90, "guardian-program": b"synthetic guardian"}
        self.expected = {k: {"size": len(v), "sha256": hashlib.sha256(v).hexdigest()} for k, v in self.images.items()}
        self.profile = {"node_name": "fixture", "api_mac": "02:00:00:00:00:01", "api_encryption_key": "synthetic-only"}
        self.boot = "11111111-1111-1111-1111-111111111111"
        self.job, self.bridge, self.now = "a" * 16, "b" * 64, 0
        self.calls, self.clients = [], []
        self.launched, self.pending, self.repaired, self.lost_launch = False, 0, False, False
        self.missing, self.corrupt, self.disconnect_error = None, None, False
        self.observations, self.warming, self.wrong_native, self.stale = 0, False, False, False
        self.saved, self.lost_save, self.wrong_receipt = False, False, False
        self.rows = [{"kind": k, **v, "offset": 0, "verified": False} for k, v in self.expected.items()]

    def status(self):
        body = {"ok": True, "job": self.job if not self.saved and any(n == "full_runtime_begin" for n, _ in self.calls) else "",
                "phase": 7 if self.launched and self.observations >= 3 else 0,
                "hard_runtime_ms": trial.TRIAL_MS if self.launched else 0,
                "core_release_autostart_supported": True, "hardware_trial_active": False,
                "core_boot_enabled": False, "materialized": True, "upload_duplicates_released": True,
                "native_acquired": self.launched, "coordinator_error": "", "artifacts": copy.deepcopy(self.rows),
                "core_display_repair_completed": self.repaired}
        if self.saved:
            body["staged_release_save"] = {"job": "d" * 16 if self.wrong_receipt else self.job,
                                           "pair_saved": True, "uploads_released": True}
        return body

    def factory(self, host, port, **kwargs):
        assert host == "127.0.0.1" and port == 16053
        assert kwargs["noise_psk"] == "synthetic-only"
        mode = "native" if self.launched and self.observations < 3 else "bridge"
        peer = self

        class Client:
            closed = False

            async def connect(self, **kwargs):
                pass

            async def disconnect(self):
                self.closed = True
                if peer.disconnect_error:
                    raise RuntimeError("synthetic private error must not escape")

            async def device_info(self):
                return SimpleNamespace(name="fixture", mac_address="02:00:00:00:00:01")

            async def list_entities_services(self):
                names = ("full_native_status",) if mode == "native" else trial.SERVICES
                return [], [SimpleNamespace(name=n) for n in names if n != peer.missing]

            async def execute_service(self, service, data, **kwargs):
                name = service.name
                peer.calls.append((name, copy.deepcopy(data)))
                ok = True
                if name == "full_runtime_inspect_start":
                    body = {"ok": True, "read_only": True, "process_signals_exposed": False,
                            "network_mutations_exposed": False, "boot_id": peer.boot, "bridge_sha256": peer.bridge}
                elif name == "full_native_status":
                    peer.observations += 1
                    generation = 1 if peer.stale else peer.observations
                    body = {"nonce": "c" * 16 if peer.wrong_native else peer.job, "boot_id": peer.boot,
                            "native_sha256": peer.expected["native-program"]["sha256"],
                            "guardian_sha256": peer.expected["guardian-program"]["sha256"],
                            "connected_guardians": True, "panel_ready": True,
                            "core_sensors_ready": not (peer.warming and peer.observations == 1),
                            "native_state": 1, "guardian_generations": [generation, generation]}
                else:
                    if name == "full_runtime_chunk":
                        row = next(v for v in peer.rows if v["kind"] == data["kind"])
                        assert row["offset"] == data["offset"]
                        payload = bytes.fromhex(data["hex_data"])
                        assert payload == peer.images[data["kind"]][data["offset"]:data["offset"] + len(payload)]
                        row["offset"] += len(payload)
                    if name == "full_runtime_seal":
                        next(v for v in peer.rows if v["kind"] == data["kind"])["verified"] = True
                    if name == trial.SAVE_SERVICE:
                        assert data == {"job": peer.job, "expected_boot": peer.boot, "expected_bridge": peer.bridge}
                        assert all(row["verified"] for row in peer.rows)
                        peer.saved = True
                        for row in peer.rows:
                            row.update(offset=0, verified=False)
                        if peer.lost_save:
                            raise TimeoutError("synthetic lost save reply")
                    if name == "full_runtime_launch_trial":
                        peer.launched = True
                        if peer.lost_launch:
                            raise TimeoutError("synthetic lost launch reply")
                    body = peer.status()
                    if name == "full_runtime_prepare" and peer.pending and not peer.repaired:
                        body.update(ok=False, error="core_display_repair_pending")
                        ok = False
                        peer.pending -= 1
                        peer.repaired = not peer.pending
                    if peer.corrupt and name == peer.corrupt:
                        body["artifacts"][0]["offset"] += 1
                return SimpleNamespace(success=ok, response_data=json.dumps(body))

        client = Client()
        self.clients.append(client)
        return client

    async def sleep(self, duration):
        self.now += duration

    def run(self):
        return asyncio.run(trial.run(16053, self.profile, self.expected, self.bridge, self.boot, self.job,
            self.images, factory=self.factory, clock=lambda: self.now, sleep=self.sleep))

    def save_update(self):
        async def run():
            client = self.factory("127.0.0.1", 16053, noise_psk=self.profile["api_encryption_key"])
            _, services = await client.list_entities_services()
            await trial.save_update_pair(client, [*services, SimpleNamespace(name=trial.SAVE_SERVICE)],
                self.expected, self.bridge, self.boot, self.job, self.images)
        asyncio.run(run())


class FullUiTrialTests(unittest.TestCase):
    def test_update_save_uses_read_only_receipt_after_lost_reply(self):
        peer = Peer(); peer.lost_save = True
        peer.save_update()
        actions = [name for name, _ in peer.calls]
        self.assertEqual(actions.count(trial.SAVE_SERVICE), 1)
        self.assertEqual(actions[actions.index(trial.SAVE_SERVICE) + 1:], ["full_runtime_status"])
        self.assertFalse(any("launch" in action or "boot_mode" in action for action in actions))

        peer = Peer(); peer.lost_save = True; peer.wrong_receipt = True
        with self.assertRaisesRegex(trial.FullUiTrialError, "monitor1_update_pair_save_unverified"):
            peer.save_update()
        self.assertEqual(sum(name == trial.SAVE_SERVICE for name, _ in peer.calls), 1)

    def test_actual_coordinator_uploads_exact_pair_once_and_observes_return(self):
        peer = Peer()
        result = peer.run()
        self.assertEqual(result["state"], "full_ui_trial_returned_observed")
        self.assertTrue(result["stock_return_observed"])
        self.assertEqual(result["native_observations"], 2)
        self.assertEqual(sum(n == "full_runtime_launch_trial" for n, _ in peer.calls), 1)
        self.assertFalse(result["installed"] or result["boot_enabled"] or result["replay_allowed"])
        self.assertTrue(all(c.closed for c in peer.clients))

    def test_lost_launch_reply_only_reconnects_to_observe_same_trial(self):
        peer = Peer(); peer.lost_launch = True
        result = peer.run()
        self.assertEqual(result["state"], "full_ui_trial_returned_observed")
        self.assertFalse(result["launch_acknowledged"])
        self.assertEqual(sum(n == "full_runtime_launch_trial" for n, _ in peer.calls), 1)
        after = [n for n, _ in peer.calls][[n for n, _ in peer.calls].index("full_runtime_launch_trial") + 1:]
        self.assertTrue(all(n.endswith("_status") for n in after))

    def test_missing_old_bridge_action_or_changed_bytes_fail_before_writes(self):
        peer = Peer(); peer.missing = "full_runtime_launch_trial"
        with self.assertRaisesRegex(trial.FullUiTrialError, "usb_full_ui_trial_rebuild_required"):
            peer.run()
        self.assertEqual(peer.calls, [])
        peer = Peer(); peer.images["native-program"] += b"changed"
        with self.assertRaises(trial.FullUiTrialError):
            peer.run()
        self.assertEqual(peer.clients, [])

    def test_wrong_chunk_ack_stops_without_prepare_launch_or_replay(self):
        peer = Peer(); peer.corrupt = "full_runtime_chunk"
        with self.assertRaises(trial.FullUiTrialError):
            peer.run()
        self.assertEqual(sum(n == "full_runtime_chunk" for n, _ in peer.calls), 1)
        self.assertFalse(any(n in ("full_runtime_prepare", "full_runtime_launch_trial") for n, _ in peer.calls))
        self.assertTrue(all(c.closed for c in peer.clients))

    def test_only_explicit_pending_prepare_has_bounded_known_state_continuation(self):
        peer = Peer(); peer.pending = 3
        self.assertEqual(peer.run()["state"], "full_ui_trial_returned_observed")
        self.assertEqual(sum(n == "full_runtime_prepare" for n, _ in peer.calls), 4)

    def test_warmup_waits_but_foreign_or_stale_native_never_becomes_success(self):
        peer = Peer(); peer.warming = True
        self.assertEqual(peer.run()["state"], "full_ui_trial_returned_observed")
        for field in ("wrong_native", "stale"):
            peer = Peer(); setattr(peer, field, True)
            result = peer.run()
            self.assertEqual(result["state"], "full_ui_trial_unverified")
            self.assertTrue(result["stock_return_observed"])

    def test_failed_owned_disconnect_never_returns_success_or_raw_error(self):
        peer = Peer(); peer.disconnect_error = True
        with self.assertRaisesRegex(trial.FullUiTrialError, "^usb_full_ui_trial_close_unverified$"):
            peer.run()


if __name__ == "__main__":
    unittest.main()
