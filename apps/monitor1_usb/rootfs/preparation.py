"""Private GUI job preparation; no device, compiler, shell or install action.

An uploaded capture is untrusted data. Hashes establish only the nine copied
file bodies; its claimed MAC/CO2/boot never replaces the later live USB checks.
Only bundled generated pins can be supplied as `contract` by the companion.
"""
import base64
import hashlib
import hmac
import io
import json
import os
from pathlib import Path
import re
import secrets
import stat
import tarfile

MAX_ARCHIVE = 16 * 1024 * 1024
PREFIX = "qingping-cgs1-capture"
USER = re.compile(r"[a-f0-9]{32}")


class PreparationError(Exception):
    """Fixed public code only: no archive contents, paths or secret values."""


def unique_json(raw):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise PreparationError("usb_capture_unverified")
            result[key] = value
        return result
    return json.loads(raw, object_pairs_hook=unique)


def validated_capture(data, contract):
    if not isinstance(data, bytes) or not 1024 <= len(data) <= MAX_ARCHIVE:
        raise PreparationError("usb_capture_unverified")
    files = {item["path"]: item for item in contract["files"]}
    if len(files) != 9:
        raise PreparationError("usb_capture_unverified")
    allowed = {PREFIX + "/" + path.lstrip("/"): item for path, item in files.items()}
    directories = {PREFIX}
    for name in allowed:
        directories.update(str(parent) for parent in Path(name).parents if str(parent) != ".")
    members, bodies, end = set(), {}, 0
    try:
        # Uncompressed bounded USTAR only. Never extractall: input member
        # names, owners, links and permissions can never choose host writes.
        with tarfile.open(fileobj=io.BytesIO(data), mode="r:") as archive:
            for item in archive:
                name = item.name.rstrip("/")
                if (len(members) >= 32 or name in members or item.pax_headers or archive.pax_headers or
                        item.linkname or item.uid != 0 or item.gid != 0 or
                        data[item.offset + 257:item.offset + 263] != b"ustar\0"):
                    raise PreparationError("usb_capture_unverified")
                members.add(name)
                end = item.offset_data + (item.size + 511) // 512 * 512
                if item.isdir():
                    if name not in directories or item.mode != 0o700 or item.size != 0:
                        raise PreparationError("usb_capture_unverified")
                    continue
                if not item.isreg() or item.mode != 0o600:
                    raise PreparationError("usb_capture_unverified")
                if name == PREFIX + "/result.json":
                    if not 0 < item.size <= 16384:
                        raise PreparationError("usb_capture_unverified")
                elif name not in allowed or item.size != allowed[name]["size"]:
                    raise PreparationError("usb_capture_unverified")
                stream = archive.extractfile(item)
                if stream is None:
                    raise PreparationError("usb_capture_unverified")
                body = stream.read(item.size + 1)
                if len(body) != item.size:
                    raise PreparationError("usb_capture_unverified")
                if name in allowed and hashlib.sha256(body).hexdigest() != allowed[name]["sha256"]:
                    raise PreparationError("usb_capture_unverified")
                bodies[name] = body
    except PreparationError:
        raise
    except Exception:
        raise PreparationError("usb_capture_unverified") from None
    if set(bodies) != set(allowed) | {PREFIX + "/result.json"}:
        raise PreparationError("usb_capture_unverified")
    if len(data) % 512 or len(data) - end < 1024 or any(data[end:]):
        raise PreparationError("usb_capture_unverified")
    try:
        report = unique_json(bodies[PREFIX + "/result.json"])
        common = {"schema_version", "stage", "hardware_contacted", "device_writes", "installation_ready", "installed",
                  "usb_serial", "wlan_mac", "co2_type", "boot_id", "stock_version", "files", "limitations"}
        browser = report.get("stage") == "read_only_browser_capture_complete"
        if (set(report) != common | ({"transport"} if browser else {"usb_transport"}) or
                report["stage"] != ("read_only_browser_capture_complete" if browser else "read_only_capture_complete") or
                type(report["schema_version"]) is not int or report["schema_version"] != 1 or
                report["hardware_contacted"] is not True or type(report["device_writes"]) is not int or report["device_writes"] != 0 or
                report["installed"] is not False or report["installation_ready"] is not False or
                report["stock_version"] != "4.1.8_0287" or type(report["co2_type"]) is not int or report["co2_type"] not in (2, 3) or
                not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,127}", report["usb_serial"]) or
                not re.fullmatch(r"[0-9a-f]{2}(?::[0-9a-f]{2}){5}", report["wlan_mac"]) or
                int(report["wlan_mac"][:2], 16) & 1 or report["wlan_mac"] == "00:00:00:00:00:00" or
                not re.fullmatch(r"[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}", report["boot_id"]) or
                (browser and report["transport"] != "browser_usb") or
                (not browser and not re.fullmatch(r"usb:[A-Za-z0-9._:-]{1,128}", report["usb_transport"])) or
                not isinstance(report["limitations"], list) or not 1 <= len(report["limitations"]) <= 4 or
                any(not isinstance(value, str) or len(value) > 250 for value in report["limitations"])):
            raise PreparationError("usb_capture_unverified")
        expected = {path: {"sha256": item["sha256"], "size": item["size"]} for path, item in files.items()}
        if report["files"] != expected:
            raise PreparationError("usb_capture_unverified")
    except PreparationError:
        raise
    except Exception:
        raise PreparationError("usb_capture_unverified") from None
    return report, {name[len(PREFIX) + 1:]: body for name, body in bodies.items()}


def private_directory(path):
    path = Path(path)
    metadata = path.lstat()
    if (path.resolve() != path or not stat.S_ISDIR(metadata.st_mode) or
            metadata.st_uid != os.getuid() or stat.S_IMODE(metadata.st_mode) != 0o700):
        raise PreparationError("usb_job_unavailable")
    return path


def write_new(path, body):
    # O_EXCL/no-follow applies to every private leaf. Incomplete jobs are
    # preserved, never overwritten or promoted after a failed preparation.
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, "wb") as stream:
        stream.write(body)
        stream.flush()
        os.fsync(stream.fileno())


def read_private(path):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(fd, "rb") as stream:
        metadata = os.fstat(stream.fileno())
        if (not stat.S_ISREG(metadata.st_mode) or metadata.st_nlink != 1 or metadata.st_uid != os.getuid() or
                stat.S_IMODE(metadata.st_mode) != 0o600 or not 0 < metadata.st_size <= 16384):
            raise PreparationError("usb_job_unavailable")
        return stream.read(16385)


def validate_name(friendly_name):
    if (not isinstance(friendly_name, str) or not friendly_name or len(friendly_name.encode()) > 120 or
            not friendly_name.isprintable() or "/" in friendly_name):
        raise PreparationError("usb_profile_name_invalid")


def profile_for(report, friendly_name, contract):
    validate_name(friendly_name)
    wlan = bytes.fromhex(report["wlan_mac"].replace(":", ""))
    api = bytearray(hashlib.sha256(b"qingping-cgs1-api-v1\0" + wlan).digest()[:6])
    api[0] = (api[0] | 2) & 254  # Stable separate locally-administered unicast.
    if bytes(api) == wlan:
        api[-1] ^= 1
    qt = next(item for item in contract["files"] if item["path"] == "/usr/lib/libQt5Core.so.5.9.4")
    return {"model": "CGS1", "stock_version": "4.1.8_0287", "co2_type": report["co2_type"],
            "wlan_mac": report["wlan_mac"], "api_mac": ":".join(f"{value:02x}" for value in api),
            "node_name": "qingping-" + wlan.hex(), "friendly_name": friendly_name,
            "api_encryption_key": base64.b64encode(secrets.token_bytes(32)).decode("ascii"),
            "qt_core_sha256": qt["sha256"]}


def prepare_job(data, parent, owner, friendly_name, contract, request_id=None):
    if not isinstance(owner, str) or not USER.fullmatch(owner):
        raise PreparationError("usb_unauthorized")
    report, bodies = validated_capture(data, contract)
    validate_name(friendly_name)
    parent = private_directory(parent)
    # Bound retained private captures. No implicit pruning of earlier jobs,
    # profiles, recovery data or consumed operation history is permitted.
    if len(list(parent.iterdir())) >= 8:
        raise PreparationError("usb_job_limit")
    job_id = secrets.token_hex(16) if request_id is None else request_id
    if not isinstance(job_id, str) or not USER.fullmatch(job_id):
        raise PreparationError("usb_request_invalid")
    directory = parent / job_id
    try:
        directory.mkdir(mode=0o700)
    except FileExistsError:
        raise PreparationError("usb_preparation_unverified") from None
    intent = {"schema_version": 1, "job_id": job_id, "owner": owner, "stage": "preparation_unverified",
              "transport": "browser_usb" if report["stage"] == "read_only_browser_capture_complete" else "ha_usb",
              "capture_sha256": hashlib.sha256(data).hexdigest(),
              "node_name": "qingping-" + report["wlan_mac"].replace(":", ""), "friendly_name": friendly_name,
              "co2_type": report["co2_type"], "model": "CGS1", "live_recheck_required": True,
              "installed": False, "installation_ready": False}
    intent_raw = (json.dumps(intent, indent=2) + "\n").encode()
    write_new(directory / "intent.json", intent_raw)
    for path in (directory, parent):
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
        try:
            os.fsync(fd)
        finally:
            os.close(fd)
    # The persistent directory/owner intent consumes this request before key generation.
    # Lost ACK/repeated POST cannot generate a replacement key or complete an
    # interrupted job; the owner can only read that exact request's status.
    profile = profile_for(report, friendly_name, contract)
    capture = directory / "capture"
    capture.mkdir(mode=0o700)
    for name, body in bodies.items():
        path = capture / name  # Only our validated fixed relative map.
        # pathlib parents=True applies mode only to the last directory.
        # Create/check every fixed ancestor explicitly rather than relying on
        # the embedding process's umask for private intermediate directories.
        parent_path = capture
        for component in Path(name).parts[:-1]:
            parent_path = parent_path / component
            parent_path.mkdir(mode=0o700, exist_ok=True)
            private_directory(parent_path)
        write_new(path, body)
    raw = (json.dumps(profile, ensure_ascii=True, indent=2) + "\n").encode()
    write_new(directory / "profile.json", raw)
    # Complete every newly created nested directory before writing the final
    # job marker. Syncing only the top capture directory can lose descendants
    # after power loss despite successfully fsync'ed file contents.
    for path in sorted([capture, *[item for item in capture.rglob("*") if item.is_dir()]],
                       key=lambda item: len(item.parts), reverse=True):
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
        try:
            os.fsync(fd)
        finally:
            os.close(fd)
    job = {**intent, "stage": "profile_prepared", "profile_sha256": hashlib.sha256(raw).hexdigest(),
           "intent_sha256": hashlib.sha256(intent_raw).hexdigest()}
    # This completion record is last. It contains no Noise key and grants no
    # launch/write authority; the builder will recheck this profile and source.
    write_new(directory / "job.json", (json.dumps(job, indent=2) + "\n").encode())
    for path in (capture, directory, parent):
        fd = os.open(path, os.O_RDONLY)
        try:
            os.fsync(fd)
        finally:
            os.close(fd)
    return public_job(job)


def public_job(job):
    return {**{key: job[key] for key in ("job_id", "stage", "model", "co2_type", "transport", "node_name", "friendly_name")},
            "live_recheck_required": True, "installed": False, "installation_ready": False}


def owned_intent(parent, job_id, owner):
    if not isinstance(job_id, str) or not USER.fullmatch(job_id) or not isinstance(owner, str) or not USER.fullmatch(owner):
        raise PreparationError("usb_job_unavailable")
    directory = private_directory(private_directory(parent) / job_id)
    raw = read_private(directory / "intent.json")
    intent = unique_json(raw)
    fields = {"schema_version", "job_id", "owner", "stage", "transport", "capture_sha256", "node_name",
              "friendly_name", "co2_type", "model", "live_recheck_required", "installed", "installation_ready"}
    if (set(intent) != fields or intent["job_id"] != job_id or not isinstance(intent["owner"], str) or
            not hmac.compare_digest(intent["owner"], owner) or intent["stage"] != "preparation_unverified" or
            type(intent["schema_version"]) is not int or intent["schema_version"] != 1 or intent["model"] != "CGS1" or
            type(intent["co2_type"]) is not int or intent["co2_type"] not in (2, 3) or
            intent["transport"] not in ("ha_usb", "browser_usb") or intent["live_recheck_required"] is not True or
            intent["installed"] is not False or intent["installation_ready"] is not False or
            not re.fullmatch(r"qingping-[0-9a-f]{12}", intent["node_name"]) or
            not re.fullmatch(r"[0-9a-f]{64}", intent["capture_sha256"])):
        raise PreparationError("usb_job_unavailable")
    validate_name(intent["friendly_name"])
    return directory, intent, raw


def job_status(parent, job_id, owner):
    try:
        directory, intent, raw = owned_intent(parent, job_id, owner)
        # Positive successful listing distinguishes a missing completion
        # record from failed IO. An incomplete job is readable, never resumed.
        if "job.json" not in os.listdir(directory):
            return public_job(intent)
        job = unique_json(read_private(directory / "job.json"))
        if (job["job_id"] != job_id or not isinstance(job["owner"], str) or
                not hmac.compare_digest(job["owner"], owner) or job["stage"] != "profile_prepared" or
                job["schema_version"] != 1 or job["model"] != "CGS1" or
                type(job["co2_type"]) is not int or job["co2_type"] not in (2, 3) or
                job["transport"] not in ("ha_usb", "browser_usb") or job["live_recheck_required"] is not True or
                job["installed"] is not False or job["installation_ready"] is not False or
                any(job[key] != value for key, value in intent.items() if key != "stage") or
                job["intent_sha256"] != hashlib.sha256(raw).hexdigest() or
                hashlib.sha256(read_private(directory / "profile.json")).hexdigest() != job["profile_sha256"]):
            raise PreparationError("usb_job_unavailable")
        return public_job(job)
    except Exception:
        # Wrong owner, missing/partial files and malformed records all have
        # the same public result; no job existence or private paths leak.
        raise PreparationError("usb_job_unavailable") from None


def available_jobs(parent, owner):
    if not isinstance(owner, str) or not USER.fullmatch(owner):
        raise PreparationError("usb_unauthorized")
    parent = private_directory(parent)
    entries = list(parent.iterdir())
    if len(entries) > 32:
        raise PreparationError("usb_job_unavailable")
    result = []
    for path in sorted(entries):
        if not USER.fullmatch(path.name):
            continue
        try:
            result.append(job_status(parent, path.name, owner))
        except PreparationError:
            # Only readable, positively owner-bound records are listed.
            # Hidden/malformed records are preserved, never treated as safe
            # cleanup candidates or a reason to create/rekey a replacement.
            continue
    return {"jobs": result}
