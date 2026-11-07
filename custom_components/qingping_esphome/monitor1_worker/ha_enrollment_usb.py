"""Read the current physical monitor address/session, without device writes."""
import asyncio
import re
import time

from ha_enrollment import checked_proof
from full_ui_trial import native_sample, rpc, services_named


def ipv4(text):
    # Old BusyBox prints inet addr:X, newer variants print inet X. Refuse a
    # missing/ambiguous IPv4 rather than asking HA to connect to a guessed peer.
    if not isinstance(text, str) or len(text) > 8192 or not text.startswith("wlan0"):
        raise ValueError("usb_enrollment_unverified")
    found = re.findall(r"\binet (?:addr:)?([0-9.]+)(?=\s)", text)
    if len(found) != 1:
        raise ValueError("usb_enrollment_unverified")
    checked_proof({"intent_sha256": "a" * 64, "host": found[0],
        "boot_id": "00000000-0000-0000-0000-000000000001", "native_job": "a" * 16}, "a" * 64)
    return found[0]


async def inspect(adb, plan, profile, canonical, digest, *, factory=None, sleep=asyncio.sleep):
    if factory is None:
        from aioesphomeapi import APIClient
        factory = APIClient
    target, client = plan["target"], None
    acknowledged, closed, cleanup = False, True, "not_created"
    expected = {k: plan["files"][k] for k in ("native-program", "guardian-program")}
    try:
        adb.deadline = time.monotonic() + 120
        if adb.serial != target["usb_serial"] or adb.usb() != target["usb_transport"]:
            raise ValueError
        boot = canonical.review.preflight.identity(adb, target["wlan_mac"], target["co2_type"])
        host = ipv4(adb.read("LC_ALL=C /bin/busybox ifconfig wlan0"))
        port = canonical.reserve_port()
        cleanup = "ambiguous_forward_preserved"
        canonical.install_forward(adb, port)
        acknowledged = True
        client = factory("127.0.0.1", port, password=None, noise_psk=profile["api_encryption_key"], client_info="Qingping HA enrollment read")
        closed = False
        await asyncio.wait_for(client.connect(login=True, log_errors=False), 12)
        info = await asyncio.wait_for(client.device_info(), 10)
        if info.name != profile["node_name"] or info.mac_address.lower() != profile["api_mac"]:
            raise ValueError
        _, listed = await asyncio.wait_for(client.list_entities_services(), 10)
        services = services_named(listed, ("full_native_status",))
        prior, nonce = None, None
        for _ in range(2):
            body = await rpc(client, services, "full_native_status", {})
            current = body.get("nonce")
            if (not isinstance(current, str) or not re.fullmatch(r"[a-f0-9]{16}", current) or current == "0" * 16 or
                    (nonce is not None and nonce != current) or not native_sample(body, expected, boot, current)):
                raise ValueError
            generations = body["guardian_generations"]
            if prior is not None and not all(now > old for now, old in zip(generations, prior)):
                raise ValueError
            nonce, prior = current, generations
            await sleep(.75)
        if (canonical.review.preflight.identity(adb, target["wlan_mac"], target["co2_type"]) != boot or
                adb.usb() != target["usb_transport"] or ipv4(adb.read("LC_ALL=C /bin/busybox ifconfig wlan0")) != host):
            raise ValueError
        proof = {"intent_sha256": digest, "host": host, "boot_id": boot, "native_job": nonce}
    finally:
        # API and exact acknowledged forward are retired independently. No
        # positive proof escapes if either cleanup cannot be established.
        if client is not None:
            try:
                await asyncio.wait_for(client.disconnect(), 10)
                closed = True
            except Exception:
                pass
        adb.deadline = None
        if acknowledged:
            try:
                cleanup = canonical.remove_forward(adb, port)
            except Exception:
                cleanup = "unverified"
    if not closed or cleanup not in ("removed", "absent"):
        raise ValueError("usb_enrollment_unverified")
    return checked_proof(proof, digest)
