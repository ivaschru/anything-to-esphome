"""Add a physically verified Monitor 1 through HA's ordinary ESPHome flow.

The private payload is carried only on the Core/worker pipe. No endpoint can
select an address, port or encryption key. A new encrypted LAN read must agree
with the USB boot, image pair and native session before the native HA flow is
allowed. Conflict/recovery never flashes, rekeys or overwrites a device.
"""
import asyncio
import base64
import ipaddress
import json
import re

MIME = "application/vnd.qingping.internal-ha-enrollment+json"


class EnrollmentRefusal(Exception):
    """Only a fixed category may cross the HTTP boundary."""


def payload(raw, job_id):
    if not isinstance(raw, bytes) or not 0 < len(raw) <= 4096:
        raise EnrollmentRefusal
    def pairs(items):
        value = {}
        for key, item in items:
            if key in value:
                raise EnrollmentRefusal
            value[key] = item
        return value
    try:
        data = json.loads(raw, object_pairs_hook=pairs)
        fields = {"job_id", "intent_sha256", "host", "boot_id", "native_job", "node_name", "api_mac", "noise_psk", "native_sha256", "guardian_sha256"}
        if not isinstance(data, dict) or set(data) != fields or data["job_id"] != job_id or any(not isinstance(v, str) for v in data.values()):
            raise ValueError
        if (not re.fullmatch(r"[a-f0-9]{32}", job_id) or
                any(not re.fullmatch(r"[a-f0-9]{64}", data[k]) for k in ("intent_sha256", "native_sha256", "guardian_sha256")) or
                not re.fullmatch(r"[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}", data["boot_id"]) or
                not re.fullmatch(r"[a-f0-9]{16}", data["native_job"]) or data["native_job"] == "0" * 16 or
                not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,62}", data["node_name"]) or
                not re.fullmatch(r"[a-f0-9]{2}(?::[a-f0-9]{2}){5}", data["api_mac"])):
            raise ValueError
        key = base64.b64decode(data["noise_psk"], validate=True)
        address = ipaddress.IPv4Address(data["host"])
        if (len(key) != 32 or base64.b64encode(key).decode() != data["noise_psk"] or
                not address.is_private or address.is_loopback or address.is_link_local or address.is_unspecified or address.is_multicast):
            raise ValueError
        return data
    except Exception:
        raise EnrollmentRefusal from None


def service_json(raw):
    """Actual SDK response bytes, bounded strict UTF-8 and unique JSON keys.

    This is the LAN/native-flow verifier's 64KiB read contract, separate from
    the worker's smaller Full UI parser. Never accept UTF-16 auto-detection,
    a scalar, duplicate identity fields or replacement-decoded bytes as proof.
    """
    try:
        if isinstance(raw, bytes):
            if not 0 < len(raw) <= 65536: raise ValueError
            raw = raw.decode('utf-8', errors='strict')
        if not isinstance(raw, str) or not 0 < len(raw.encode('utf-8')) <= 65536: raise ValueError
        def pairs(items):
            result = {}
            for key, item in items:
                if key in result: raise ValueError
                result[key] = item
            return result
        value = json.loads(raw, object_pairs_hook=pairs)
        if not isinstance(value, dict): raise ValueError
        return value
    except Exception:
        raise EnrollmentRefusal from None


def normalized(mac):
    return str(mac).lower().replace(":", "").replace("-", "")


def existing(hass, data):
    """Inspect entries, never edit them or infer identity from an IP alone."""
    matches = []
    for entry in hass.config_entries.async_entries("esphome"):
        if (normalized(entry.unique_id) == normalized(data["api_mac"]) or
                entry.data.get("device_name") == data["node_name"] or entry.data.get("host") == data["host"]):
            matches.append(entry)
    if not matches:
        return None
    if len(matches) == 1:
        entry = matches[0]
        if (normalized(entry.unique_id) == normalized(data["api_mac"]) and entry.data.get("device_name") == data["node_name"] and
                entry.data.get("host") == data["host"] and entry.data.get("port", 6053) == 6053 and
                entry.data.get("noise_psk") == data["noise_psk"] and not entry.data.get("password")):
            return "already_configured", entry.entry_id
    return "conflict", None


async def verify_lan(data, *, factory=None, sleep=asyncio.sleep):
    """Read one USB-derived peer, no scanner or service mutation.

    Two increasing guardian generations prove that a cached status is not the
    current native session. This temporary connection is always closed before
    ESPHome's own flow opens its independent connection.
    """
    if factory is None:
        from aioesphomeapi import APIClient
        factory = APIClient
    client = factory(data["host"], 6053, "", noise_psk=data["noise_psk"], provide_time=False, expected_name=data["node_name"], client_info="Qingping HA enrollment verification")
    try:
        await asyncio.wait_for(client.connect(login=True, log_errors=False), 12)
        info = await asyncio.wait_for(client.device_info(), 10)
        if info.name != data["node_name"] or normalized(info.mac_address) != normalized(data["api_mac"]):
            raise EnrollmentRefusal
        _, services = await asyncio.wait_for(client.list_entities_services(), 10)
        found = [s for s in services if s.name == "full_native_status"]
        if len(found) != 1:
            raise EnrollmentRefusal
        prior = None
        for _ in range(2):
            result = await asyncio.wait_for(client.execute_service(found[0], {}, return_response=True, timeout=15), 16)
            if result is None or result.success is not True:
                raise EnrollmentRefusal
            body = service_json(result.response_data)
            generations = body.get("guardian_generations")
            if (body.get("boot_id") != data["boot_id"] or body.get("nonce") != data["native_job"] or
                    body.get("native_sha256") != data["native_sha256"] or body.get("guardian_sha256") != data["guardian_sha256"] or
                    any(body.get(k) is not True for k in ("connected_guardians", "panel_ready", "core_sensors_ready")) or
                    type(body.get("native_state")) is not int or body["native_state"] != 1 or
                    not isinstance(generations, list) or len(generations) != 2 or any(type(n) is not int or n <= 0 for n in generations) or
                    (prior is not None and not all(n > old for n, old in zip(generations, prior)))):
                raise EnrollmentRefusal
            prior = generations
            await sleep(.75)
    finally:
        # A failed disconnect is not a successful read. The caller records an
        # unverified enrollment and will not initiate a flow in that case.
        await asyncio.wait_for(client.disconnect(), 10)


async def enroll(hass, data, *, verifier=verify_lan):
    await verifier(data)
    if result := existing(hass, data):
        return result
    flow_id = None
    try:
        # This is HA's supported user flow, not an invented import/discovery
        # source or direct ConfigEntry construction. Only its encryption-key
        # step is submitted; migration, overwrite and password forms stop.
        flow = await hass.config_entries.flow.async_init("esphome", context={"source": "user"}, data={"host": data["host"], "port": 6053})
        if flow.get("type") == "form":
            flow_id = flow.get("flow_id")
            if flow.get("step_id") != "encryption_key" or flow.get("errors"):
                return "manual_flow_required", None
            # A concurrent matching entry may have appeared while native HA
            # was probing. Do not submit a key to repair/replace that entry.
            if result := existing(hass, data):
                return result
            flow = await hass.config_entries.flow.async_configure(flow_id, {"noise_psk": data["noise_psk"]})
        if flow.get("type") == "create_entry":
            current = existing(hass, data)
            entry = flow.get("result")
            if current and current[0] == "already_configured" and entry is not None and current[1] == entry.entry_id:
                return "created", entry.entry_id
            return "unverified", None
        if flow.get("type") == "abort":
            # Native HA may resolve a same-MAC race itself, including updating
            # its address/key. Never undo its decision or start another flow;
            # claim only an exact allowlisted entry readback, otherwise stop.
            return existing(hass, data) or ("manual_flow_required", None)
        return "manual_flow_required", None
    finally:
        if flow_id is not None:
            # Retire only our own still-pending form. Never abort another
            # person's discovery/reauth flow or log its potentially secret data.
            if any(f["flow_id"] == flow_id for f in hass.config_entries.flow.async_progress()):
                hass.config_entries.flow.async_abort(flow_id)
