"""One ephemeral, owner/page-bound API-only browser capability.

Reported WebUSB evidence is context, not native USB, plan or writer authority.
There is no public operation that asks Core to create a command or open an API
socket. Browser polls deliver only requests already created by private code.
"""
import asyncio
import hmac
import re
import secrets
import time

from .monitor1_browser_channel import BrowserChannel
from .monitor1_browser_relay import RelayRefusal


class BrowserRegistry:
    def __init__(self):
        self.current = None
        self.used = set()
        self.timer = None
        self.stopped = False

    def open(self, owner, nonce, data):
        if self.stopped or not isinstance(data, dict) or set(data) not in ({"evidence"}, {"evidence", "purpose"}):
            raise RelayRefusal
        # A fixed resource class is chosen when registering a NEW selection.
        # It cannot renew an old capability or grant a writer. Ordinary reads
        # keep their original ceilings; Full UI needs the two-image RPC budget.
        purpose = data.get("purpose", "standard")
        if purpose not in ("standard", "full-ui") or "purpose" in data and purpose != "full-ui":
            raise RelayRefusal
        lifetime = 900 if purpose == "full-ui" else 240
        evidence = data["evidence"]
        fields = {"kind", "channel", "serial", "wlan_mac", "boot_id", "co2_type", "stock_version", "native_get_devpath"}
        if (not isinstance(evidence, dict) or set(evidence) != fields or evidence["kind"] != "browser_webusb" or
                evidence["native_get_devpath"] is not False or evidence["stock_version"] != "4.1.8_0287" or
                type(evidence["co2_type"]) is not int or evidence["co2_type"] not in (2, 3) or
                any(not isinstance(evidence[k], str) for k in ("channel", "serial", "wlan_mac", "boot_id")) or
                not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,127}", evidence["serial"]) or
                any(not re.fullmatch(r"[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}", evidence[k]) for k in ("channel", "boot_id")) or
                not re.fullmatch(r"[a-f0-9]{2}(?::[a-f0-9]{2}){5}", evidence["wlan_mac"]) or
                evidence["wlan_mac"] == "00:00:00:00:00:00" or int(evidence["wlan_mac"][:2], 16) & 1 or
                evidence["channel"] in self.used or len(self.used) >= 32):
            raise RelayRefusal
        if self.current is not None and not self.current["capability"].closed:
            raise RelayRefusal
        if self.timer is not None:
            self.timer.cancel()
        identity = secrets.token_hex(16)
        self.used.add(evidence["channel"])
        self.current = {"id": identity, "owner": owner, "nonce": nonce, "deadline": time.monotonic() + lifetime, "purpose": purpose,
                        "reported_evidence": dict(evidence), "capability": BrowserChannel(purpose=purpose)}
        self.timer = asyncio.create_task(self._expire(identity, lifetime))
        return {"channel_id": identity, "state": "registered", "writer_enabled": False}

    async def _expire(self, identity, lifetime):
        try:
            await asyncio.sleep(lifetime)
            if self.current is not None and self.current["id"] == identity:
                self.current["capability"]._retire()
        except asyncio.CancelledError:
            pass

    def capability(self, owner, nonce, identity):
        current = self.current
        if (self.stopped or not isinstance(identity, str) or not re.fullmatch(r"[a-f0-9]{32}", identity) or
                current is None or current["id"] != identity or not hmac.compare_digest(current["owner"], owner) or
                not hmac.compare_digest(current["nonce"], nonce) or time.monotonic() >= current["deadline"]):
            raise RelayRefusal
        # Private callers must still join a real plan/consumed intent. These
        # reported fields do not prove the identity of an attached monitor.
        return current["capability"]

    async def check_plan(self, owner, nonce, identity, target):
        """Fresh fixed read on the original handle, without writer admission.

        The plan target must come from Core's checked private worker context,
        never directly from the browser request. Both before and after IO,
        retain this exact registry object and its original deadline.
        """
        capability = self.capability(owner, nonce, identity)
        current = self.current
        reported = current["reported_evidence"]
        expected = {"kind": "browser_webusb", **{key: reported[source] for key, source in
            (("usb_serial", "serial"), ("wlan_mac", "wlan_mac"), ("boot_id", "boot_id"),
             ("co2_type", "co2_type"), ("stock_version", "stock_version"))}}
        if (not isinstance(target, dict) or target != expected or type(target.get("co2_type")) is not int):
            raise RelayRefusal
        try:
            observed = await capability.check_scope()
            if (self.current is not current or self.capability(owner, nonce, identity) is not capability or
                    capability.closed or not isinstance(observed, dict) or observed != reported or
                    type(observed.get("co2_type")) is not int or observed.get("native_get_devpath") is not False):
                raise RelayRefusal
            return True
        except BaseException:
            capability._retire()
            raise RelayRefusal from None

    async def stage_admission(self, owner, nonce, identity, target, requested_free):
        """Fixed fresh read for a future writer, not public JSON authority.

        target and requested_free must come from the private rehashed plan.
        This read neither creates a root nor consumes a writer. Its current
        filesystem observation reserves no space and cannot be replayed later.
        """
        capability = self.capability(owner, nonce, identity)
        current = self.current
        evidence = current['reported_evidence']
        expected = {'kind': 'browser_webusb', 'usb_serial': evidence['serial'], **{key: evidence[key] for key in
            ('wlan_mac', 'boot_id', 'co2_type', 'stock_version')}}
        if (not isinstance(target, dict) or target != expected or type(target.get('co2_type')) is not int or
                type(requested_free) is not int or not 0 < requested_free <= 256 * 1024**2):
            raise RelayRefusal
        try:
            observed = await capability.check_stage_scope()
            if (self.current is not current or self.capability(owner, nonce, identity) is not capability or capability.closed or
                    not isinstance(observed, dict) or set(observed) != {'evidence', 'filesystem'} or
                    observed['evidence'] != evidence or not isinstance(observed['evidence'], dict) or
                    type(observed['evidence'].get('co2_type')) is not int or observed['evidence'].get('native_get_devpath') is not False):
                raise RelayRefusal
            fs = observed['filesystem']
            if (not isinstance(fs, dict) or set(fs) != {'magic', 'available_blocks', 'block_bytes'} or fs['magic'] != 'ef53' or
                    type(fs['available_blocks']) is not int or not 0 <= fs['available_blocks'] < 2**53 or
                    type(fs['block_bytes']) is not int or not 512 <= fs['block_bytes'] <= 65536 or
                    not requested_free <= fs['available_blocks'] * fs['block_bytes'] < 2**53):
                raise RelayRefusal
            return {'channel_id': identity, 'channel_nonce': evidence['channel'], 'target': expected, 'filesystem': dict(fs)}
        except BaseException:
            capability._retire()
            raise RelayRefusal from None

    async def disabled_scope(self, owner, nonce, identity, meta):
        """Fresh fixed collector on this exact handle; still no writer grant.

        Metadata must come from the terminal owned stage context, never an
        HTTP-supplied path, target or plan body. Keep the original deadline
        and current object on both sides of the browser IO.
        """
        capability = self.capability(owner, nonce, identity)
        current = self.current
        evidence = current['reported_evidence']
        target = {'kind': 'browser_webusb', 'usb_serial': evidence['serial'], **{key: evidence[key] for key in
            ('wlan_mac', 'boot_id', 'co2_type', 'stock_version')}}
        if (not isinstance(meta, dict) or meta.get('target') != target or
                not isinstance(meta.get('target'), dict) or type(meta['target'].get('co2_type')) is not int):
            raise RelayRefusal
        try:
            observed = await capability.check_disabled_scope(meta)
            if (self.current is not current or self.capability(owner, nonce, identity) is not capability or
                    capability.closed or capability.failed):
                raise RelayRefusal
            return observed
        except BaseException:
            capability._retire()
            raise RelayRefusal from None

    async def initial_trial_preparation(self, owner, nonce, identity, meta):
        """Pre-trial read only, on the same owner/page/target/deadline.

        No RAM path, duration, command or image capability comes from the
        request. This does not allocate a trial or renew an expired handle.
        """
        capability = self.capability(owner, nonce, identity)
        current = self.current
        evidence = current['reported_evidence']
        target = {'kind': 'browser_webusb', 'usb_serial': evidence['serial'], **{key: evidence[key] for key in
            ('wlan_mac', 'boot_id', 'co2_type', 'stock_version')}}
        if (not isinstance(meta, dict) or meta.get('target') != target or
                not isinstance(meta.get('target'), dict) or type(meta['target'].get('co2_type')) is not int):
            raise RelayRefusal
        try:
            observed = await capability.check_initial_trial_preparation(meta)
            if (self.current is not current or self.capability(owner, nonce, identity) is not capability or
                    capability.closed or capability.failed):
                raise RelayRefusal
            return observed
        except BaseException:
            capability._retire()
            raise RelayRefusal from None

    async def bridge_boot_preparation(self, owner, nonce, identity, meta, marker):
        """Read original stopped scope using only this current selected handle."""
        capability, current = self.capability(owner, nonce, identity), self.current
        evidence = current['reported_evidence']
        target = {'kind': 'browser_webusb', 'usb_serial': evidence['serial'], **{key: evidence[key] for key in
            ('wlan_mac', 'boot_id', 'co2_type', 'stock_version')}}
        if (not isinstance(meta, dict) or meta.get('target') != target or
                not isinstance(meta.get('target'), dict) or type(meta['target'].get('co2_type')) is not int):
            raise RelayRefusal
        try:
            observed = await capability.check_bridge_boot_preparation(meta, marker)
            if (self.current is not current or self.capability(owner, nonce, identity) is not capability or
                    capability.closed or capability.failed):
                raise RelayRefusal
            return observed
        except BaseException:
            capability._retire()
            raise RelayRefusal from None

    async def dispatch(self, owner, nonce, operation, data):
        if operation == "open":
            return self.open(owner, nonce, data)
        expected = {"channel_id", "frame"} if operation == "answer" else {"channel_id"}
        if not isinstance(data, dict) or set(data) != expected:
            raise RelayRefusal
        capability = self.capability(owner, nonce, data["channel_id"])
        if operation == "poll":
            return {"request": await capability.poll()}
        if operation == "answer":
            capability.answer(data["frame"])
            return {"state": "accepted"}
        if operation == "close":
            if not capability.closed:
                capability._retire()
            return {"state": "retired"}
        raise RelayRefusal

    def stop(self):
        self.stopped = True
        if self.timer is not None:
            self.timer.cancel()
        if self.current is not None:
            self.current["capability"]._retire()
