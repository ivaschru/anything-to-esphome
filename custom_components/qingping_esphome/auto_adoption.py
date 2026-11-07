"""Automatically adopt capability-enabled devices already connected to this HA.

No LAN scan, second API connection, setup setter, key rotation or OTA occurs.
HA owns the authenticated ESPHome connection; we only request the fixed read
action and decode its sealed response using that entry's existing Noise key.
Private profiles stay in the installer's atomic Store. Existing pending/sent
history is never overwritten, and unload cancels only this module's task.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
import secrets
import time

from aioesphomeapi import SupportsResponseType, UserServiceArgType
from homeassistant.helpers.event import async_track_time_interval

from .device_profile import ACTION, ProfileError, decode_profile, noise_key_bytes
from .firmware_update import pending
from .image import mac_normalize, private_ipv4


class AutoAdoption:
    def __init__(self, manager):
        self.manager, self.hass = manager, manager.hass
        self.task = None
        self.cancel_interval = None
        self.closed = False
        self.lock = asyncio.Lock()
        self.attempts = {}
        self.cursor = 0

    def start(self):
        # ESPHome can finish loading after our integration. A periodic cache
        # inventory also handles reconnects/new entries without private HA
        # dispatcher APIs or assuming bootstrap order. Only capable entries
        # cause network reads; successful profiles are cached for ten minutes.
        self.cancel_interval = async_track_time_interval(self.hass, self._schedule, timedelta(minutes=1))
        self._schedule(None)

    def _schedule(self, _now):
        if not self.closed and (self.task is None or self.task.done()):
            self.task = asyncio.create_task(self.scan(), name="qingping-auto-profile")

    async def stop(self):
        self.closed = True
        if self.cancel_interval: self.cancel_interval(); self.cancel_interval = None
        if self.task:
            self.task.cancel()
            await asyncio.gather(self.task, return_exceptions=True)
            self.task = None

    def candidates(self):
        rows, seen, ambiguous = [], set(), set()
        for entry in self.hass.config_entries.async_entries("esphome"):
            try:
                runtime = getattr(entry, "runtime_data", None)
                if not runtime or not runtime.available or not runtime.device_info: continue
                mac = mac_normalize(entry.unique_id)
                if mac in seen: ambiguous.add(mac)
                seen.add(mac)
                key = entry.data.get("noise_psk")
                noise_key_bytes(key)
                if entry.data.get("port", 6053) != 6053: continue
                peer = private_ipv4(runtime.client.connected_address)
                if mac_normalize(runtime.device_info.mac_address) != mac: continue
                actions = [s for s in runtime.services.values() if s.name == ACTION]
                if (len(actions) != 1 or actions[0].supports_response != SupportsResponseType.ONLY
                        or len(actions[0].args) != 1 or actions[0].args[0].name != "challenge"
                        or actions[0].args[0].type != UserServiceArgType.STRING): continue
                rows.append((mac, entry, runtime, key, peer, actions[0]))
            except (ValueError, TypeError, AttributeError):
                # No hostname/model guess, plaintext fallback or private SDK
                # exception logging for a malformed/unavailable HA entry.
                continue
        return [row for row in rows if row[0] not in ambiguous]

    async def scan(self):
        if self.closed or self.lock.locked() or self.manager.updates.lock.locked(): return
        async with self.lock:
            rows = sorted(self.candidates(), key=lambda row: row[1].entry_id)
            # A busy or malicious endpoint cannot monopolise startup/the HA
            # loop. Rotate through a bounded batch; no catch-up burst/retry.
            if not rows: return
            offset = self.cursor % len(rows)
            rows = rows[offset:] + rows[:offset]
            self.cursor = offset + min(len(rows), 16)
            for row in rows[:16]:
                if self.closed or self.manager.updates.lock.locked(): return
                binding = (row[3], row[4], row[2].device_info.compilation_time)
                last = self.attempts.get(row[1].entry_id)
                if last and last[0] == binding and time.monotonic() < last[1]: continue
                self.attempts[row[1].entry_id] = (binding, time.monotonic() + 60)
                if await self._read(row, force=False):
                    self.attempts[row[1].entry_id] = (binding, time.monotonic() + 600)

    async def refresh(self, mac):
        """Refresh device-owned credentials immediately before an auto OTA.

        A periodic cache may predate a local Wi-Fi change. Never overwrite
        current device settings with that stale copy. This remains a fixed
        read action; the independent install/USB/intent guards still apply.
        """
        async with self.lock:
            rows = [row for row in self.candidates() if row[0] == mac]
            return len(rows) == 1 and await self._read(rows[0], force=True)

    async def _read(self, row, *, force):
        mac, entry, runtime, key, peer, action = row
        record = self.manager.records.get(mac)
        if record and (pending(record) or record.get("outcome") not in {"native_verified", "auto_adopted"}): return False
        challenge = secrets.token_hex(16)
        try:
            fresh = await asyncio.wait_for(runtime.client.device_info(), 5)
            if mac_normalize(fresh.mac_address) != mac or fresh.name != runtime.device_info.name: return False
            response = await runtime.client.execute_service(action, {"challenge": challenge}, return_response=True, timeout=8)
            if not response or not response.success: return False
            # The validated public catalog can admit future compatible Lite
            # releases without another integration upgrade. Built-in versions
            # still work when the catalog is temporarily offline. Never infer
            # a public release from an arbitrary/private UI version string.
            catalog = getattr(self.manager, "firmware_catalog", None)
            release = (getattr(catalog, "data", None) or {}).get("lite")
            versions = ({**dict(release.adoption_versions), release.version: release.revision}
                        if release and release.supports_install(self.manager.updates.integration_version)
                        else {})
            profile = decode_profile(response.response_data, key, mac, fresh.name, challenge,
                                     public_versions=versions)
            # Awaited IO can cross unload, rekey, reconnect or entry deletion.
            # Recheck the exact HA binding and don't import stale data or race
            # a consumed install intent. We never disconnect HA's client.
            if (self.closed or self.hass.config_entries.async_get_entry(entry.entry_id) is not entry
                    or getattr(entry, "runtime_data", None) is not runtime or not runtime.available
                    or entry.data.get("noise_psk") != key or mac_normalize(entry.unique_id) != mac
                    or private_ipv4(runtime.client.connected_address) != peer
                    or mac_normalize(runtime.device_info.mac_address) != mac
                    or runtime.device_info.name != profile.name
                    or not force and self.manager.updates.lock.locked()): return False
            current = self.manager.records.get(mac)
            if current is not record or current and pending(current): return False
            imported = {**(record or {}), "schema_version": 3, "profile": "lite", "hardware": "0001",
                        "source_stock_version": "4.5.8", "origin": "device_profile_v1",
                        "name": profile.name, "peer": peer, "noise_key": key,
                        "ota_password": profile.values["ota_password"],
                        "personalization": profile.values, "firmware_version": profile.version,
                        "firmware_revision": profile.revision, "build": fresh.compilation_time,
                        "outcome": "native_verified" if record and record.get("outcome") == "native_verified" else "auto_adopted",
                        "source_entry_id": entry.entry_id}
            if record and record.get("firmware_version") != profile.version:
                # Another HA may have updated the same monitor. An observed
                # version is not evidence that our earlier personalised image
                # hash describes its current bytes. Retain old evidence once,
                # but don't relabel it as the newly discovered image.
                old = {k: record[k] for k in ("firmware_version", "firmware_revision", "image_sha256", "template_sha256") if k in record}
                history = list(record.get("prior_firmware_evidence", []))
                if old and old not in history: history.append(old)
                imported["prior_firmware_evidence"] = history
                imported.pop("image_sha256", None); imported.pop("template_sha256", None)
            if imported == record: return True
            imported["profile_read_at"] = datetime.now(timezone.utc).isoformat()
            self.manager.records[mac] = imported
            try:
                await self.manager.save_records()
            except Exception:
                # In-memory readiness must not outlive an uncommitted Store.
                if record is None: self.manager.records.pop(mac, None)
                else: self.manager.records[mac] = record
                return False
            return True
        except asyncio.CancelledError:
            raise
        except Exception:
            return False  # No secrets/response/SDK exception in logs or state.
