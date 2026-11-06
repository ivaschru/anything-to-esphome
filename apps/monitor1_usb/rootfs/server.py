#!/usr/bin/env python3
"""Ingress-only, read-only Monitor 1 USB companion.

Only generated fixed reads/pulls can reach ADB. No generic shell, push, activation,
TCP daemon listener on the LAN or Home Assistant API access exists here.
Browser USB uses the same source contract in the offline frontend bundle.
"""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import base64
import hmac
import hashlib
import io
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import stat
import tarfile
import tempfile
import threading
import time
import uuid

from preparation import PreparationError, MAX_ARCHIVE, prepare_job, job_status, available_jobs
from build_worker import Builds

HERE = Path(__file__).resolve().parent
SERIAL = re.compile(r"[A-Za-z0-9][A-Za-z0-9_-]{0,127}")
USER = re.compile(r"[a-f0-9]{32}")
CONTRACT = json.loads((HERE / "contract.json").read_text())


class Refusal(Exception):
    """Fixed public category only; never wrap ADB output or raw exceptions."""


class UsbReads:
    def __init__(self, executable="adb", run=subprocess.run, capture_root=Path("/data/adb")):
        self.executable, self.run = executable, run
        self.capture_root = capture_root

    def command(self, arguments, deadline, read_timeout=10):
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise Refusal("usb_read_timeout")
        try:
            # Isolate the adb server/key directory from Supervisor credentials
            # and the integration's environment. The server listens only on
            # localhost; no -a/-H/tcpip/reverse/forward operation is exposed.
            result = self.run([self.executable, *arguments], capture_output=True,
                timeout=min(read_timeout, remaining), check=False,
                env={"PATH": "/usr/local/bin:/usr/bin:/bin", "HOME": "/data/adb",
                     "ADB_SERVER_SOCKET": "tcp:localhost:5037"})
        except Exception:
            raise Refusal("usb_operation_failed") from None
        if result.returncode or len(result.stdout) > 65536:
            raise Refusal("usb_operation_failed")
        return result.stdout

    def devices(self):
        reply = self.command(["devices", "-l"], time.monotonic() + 10).decode("ascii")
        lines = reply.splitlines()
        if not lines or lines[0] != "List of devices attached" or len(lines) > 33:
            raise Refusal("usb_inventory_invalid")
        result = []
        for line in lines[1:]:
            if not line.strip():
                continue
            fields = line.split()
            if len(fields) >= 3 and fields[1] == "device" and SERIAL.fullmatch(fields[0]) and any(
                    re.fullmatch(r"usb:[A-Za-z0-9._:-]+", field) for field in fields[2:]):
                if fields[0] in result:
                    raise Refusal("usb_inventory_invalid")
                result.append(fields[0])
        return result

    def transport(self, serial, deadline):
        if not isinstance(serial, str) or not SERIAL.fullmatch(serial):
            raise Refusal("usb_selection_invalid")
        state = self.command(["-s", serial, "get-state"], deadline)
        path = self.command(["-s", serial, "get-devpath"], deadline)
        if state.strip() != b"device" or not re.fullmatch(rb"usb:[A-Za-z0-9._:-]+", path.strip()):
            raise Refusal("usb_transport_changed")
        return path.strip()

    def read(self, serial, command, deadline):
        # command comes only from CONTRACT below, never from an HTTP field.
        marker = "__CGS1_COMPANION_OK_" + uuid.uuid4().hex + "__"
        script = "set -e\n" + command + "\nprintf '\\n" + marker + "\\n'\n"
        raw = self.command(["-s", serial, "shell", script], deadline)
        suffix = ("\n" + marker + "\n").encode()
        data = raw.replace(b"\r\n", b"\n")
        if len(data) > 4096 or not data.endswith(suffix) or any(byte > 127 or byte == 0 for byte in data):
            raise Refusal("usb_read_incomplete")
        return data[:-len(suffix)].decode("ascii").strip()

    def inspect(self, serial, deadline=None):
        deadline = time.monotonic() + 60 if deadline is None else deadline
        transport = self.transport(serial, deadline)
        identity = {step["name"]: self.read(serial, step["command"], deadline) for step in CONTRACT["identity"]}
        if (identity["uid"] != "0" or identity["arch"] != "armv7l" or
                identity["version"] != "CLEARGRASS_VERSION=4.1.8_0287" or identity["co2_type"] not in ("2", "3")):
            raise Refusal("usb_profile_unsupported")
        mac = identity["wlan_mac"]
        if (not re.fullmatch(r"[0-9a-f]{2}(?::[0-9a-f]{2}){5}", mac) or
                int(mac[:2], 16) & 1 or mac == "00:00:00:00:00:00" or
                not re.fullmatch(r"[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}", identity["boot_id"])):
            raise Refusal("usb_identity_invalid")
        for file in CONTRACT["files"]:
            if self.read(serial, file["command"], deadline) != file["expected"]:
                raise Refusal("usb_stock_unverified")
        self.read(serial, CONTRACT["absent_install"], deadline)
        if (self.read(serial, "cat /proc/sys/kernel/random/boot_id", deadline) != identity["boot_id"] or
                self.read(serial, "cat /sys/class/net/wlan0/address", deadline) != mac or
                self.transport(serial, deadline) != transport):
            raise Refusal("usb_transport_changed")
        return {"model": "CGS1", "stock_version": "4.1.8_0287", "co2_type": int(identity["co2_type"]),
                "wlan_mac": mac, "boot_id": identity["boot_id"], "transport": "ha_usb",
                "source_checked": True, "installation_ready": False}

    def capture(self, serial):
        """Copy only the nine generated fixed files; no recursive pull/INI.

        The directory is private and temporary. Copies are bounded and hashed
        locally, then all source/identity checks run again before any archive
        can leave the request. A failed capture never returns partial bytes.
        """
        deadline = time.monotonic() + 240
        transport = self.transport(serial, deadline)
        before = self.inspect(serial, deadline)
        root = self.capture_root
        metadata = root.lstat()
        if (root.resolve() != root or not stat.S_ISDIR(metadata.st_mode) or
                metadata.st_uid != os.getuid() or stat.S_IMODE(metadata.st_mode) != 0o700):
            raise Refusal("usb_capture_unverified")
        contents = {}
        total = sum(file["size"] for file in CONTRACT["files"])
        if len(CONTRACT["files"]) != 9 or not 0 < total <= 32 * 1024 * 1024:
            raise Refusal("usb_capture_unverified")
        with tempfile.TemporaryDirectory(prefix="capture-", dir=root) as temporary:
            for file in CONTRACT["files"]:
                source = file["path"]  # Generated constants, never HTTP paths.
                destination = Path(temporary) / source.lstrip("/")
                destination.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
                fd = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
                os.close(fd)
                self.command(["-s", serial, "pull", source, str(destination)], deadline, read_timeout=30)
                destination.chmod(0o600, follow_symlinks=False)
                fd = os.open(destination, os.O_RDONLY | os.O_NOFOLLOW)
                with os.fdopen(fd, "rb") as stream:
                    metadata = os.fstat(stream.fileno())
                    if (not stat.S_ISREG(metadata.st_mode) or metadata.st_nlink != 1 or
                            metadata.st_size != file["size"]):
                        raise Refusal("usb_capture_unverified")
                    data = stream.read(file["size"] + 1)
                if len(data) != file["size"] or hashlib.sha256(data).hexdigest() != file["sha256"]:
                    raise Refusal("usb_capture_unverified")
                contents[source.lstrip("/")] = data
            after = self.inspect(serial, deadline)
            if before != after or self.transport(serial, deadline) != transport:
                raise Refusal("usb_transport_changed")
        report = {"schema_version": 1, "stage": "read_only_capture_complete", "hardware_contacted": True,
                  "device_writes": 0, "installation_ready": False, "installed": False,
                  "usb_serial": serial, "usb_transport": transport.decode("ascii"),
                  "wlan_mac": before["wlan_mac"], "co2_type": before["co2_type"],
                  "boot_id": before["boot_id"], "stock_version": before["stock_version"],
                  "files": {file["path"]: {"sha256": file["sha256"], "size": file["size"]}
                            for file in CONTRACT["files"]},
                  "limitations": ["Fixed recovery/build file set, not a full NAND or user-data backup",
                                  "No installation, activation, stock fallback or boot test performed"]}
        contents["result.json"] = (json.dumps(report, indent=2) + "\n").encode()
        output = io.BytesIO()
        # Fixed private USTAR entries, no symlinks, executable bits, owner
        # names or caller-selected members. Never publish these vendor bytes.
        with tarfile.open(fileobj=output, mode="w", format=tarfile.USTAR_FORMAT) as archive:
            directories = {"qingping-cgs1-capture"}
            for name in contents:
                parent = Path("qingping-cgs1-capture") / name
                directories.update(str(value) for value in parent.parents if str(value) != ".")
            for name in sorted(directories):
                info = tarfile.TarInfo(name + "/")
                info.type, info.mode = tarfile.DIRTYPE, 0o700
                archive.addfile(info)
            for name, data in contents.items():
                info = tarfile.TarInfo("qingping-cgs1-capture/" + name)
                info.mode, info.size = 0o600, len(data)
                archive.addfile(info, io.BytesIO(data))
        return output.getvalue()


class Companion:
    def __init__(self, usb=None, job_root=Path("/data/jobs")):
        self.usb = usb or UsbReads()
        self.job_root = job_root
        self.builds = Builds(job_root, CONTRACT)
        self.sessions, self.lock, self.device_lock = {}, threading.Lock(), threading.Lock()

    def page(self, user):
        now = time.monotonic()
        with self.lock:
            self.sessions = {key: value for key, value in self.sessions.items() if now - value[1] < 1800}
            if len(self.sessions) >= 32:
                raise Refusal("usb_session_limit")
            nonce = secrets.token_hex(32)
            self.sessions[nonce] = [user, now, set()]
            return nonce

    def session(self, user, nonce):
        if not isinstance(nonce, str) or not re.fullmatch(r"[a-f0-9]{64}", nonce):
            raise Refusal("usb_unauthorized")
        with self.lock:
            value = self.sessions.get(nonce)
            if value is None or not hmac.compare_digest(value[0], user) or time.monotonic() - value[1] >= 1800:
                raise Refusal("usb_unauthorized")
            # Authenticated status polling keeps a long build page usable.
            # An idle/expired page still needs a new nonce from native ingress;
            # neither a worker nor an unauthenticated request can renew it.
            value[1] = time.monotonic()
        return value

    def selected(self, user, nonce, serial, operation):
        value = self.session(user, nonce)
        if not isinstance(serial, str) or not SERIAL.fullmatch(serial):
            raise Refusal("usb_selection_invalid")
        with self.lock:
            key = operation + ":" + serial
            if key in value[2]:
                raise Refusal("usb_selection_consumed")
            value[2].add(key)  # Before first USB read, even on timeout/disconnect.

    def inspect(self, user, nonce, serial):
        self.selected(user, nonce, serial, "inspect")
        if not self.device_lock.acquire(blocking=False):
            raise Refusal("usb_busy")
        try:
            return self.usb.inspect(serial)
        finally:
            self.device_lock.release()

    def capture(self, user, nonce, serial, deliver):
        self.selected(user, nonce, serial, "capture")
        if not self.device_lock.acquire(blocking=False):
            raise Refusal("usb_busy")
        try:
            # Keep the global lease until the response finishes too. A slow
            # ingress client cannot retain many simultaneous binary archives.
            return deliver(self.usb.capture(serial))
        finally:
            self.device_lock.release()

    def discover(self, user, nonce):
        value = self.session(user, nonce)
        if not self.device_lock.acquire(blocking=False):
            raise Refusal("usb_busy")
        try:
            devices = self.usb.devices()
            # A new explicit discovery permits another read-only selection,
            # never a replay of a writer/trial. Keep it distinct from those
            # permanent filesystem receipts in the installation engine.
            with self.lock:
                value[2].clear()
            return devices
        finally:
            self.device_lock.release()

    def prepare(self, user, nonce, read_input, deliver):
        self.session(user, nonce)
        if not self.device_lock.acquire(blocking=False):
            raise Refusal("usb_busy")
        try:
            # Authenticate and reserve the global budget BEFORE reading the
            # bounded upload. No parallel large request bodies/captures build
            # up behind a slow client; a disconnect releases the lease.
            data = read_input()
            common = {"request_id", "friendly_name"}
            if not isinstance(data, dict) or set(data) not in (common | {"serial"}, common | {"capture"}):
                raise Refusal("usb_request_invalid")
            request_id = data["request_id"]
            if not isinstance(request_id, str) or not USER.fullmatch(request_id):
                raise Refusal("usb_request_invalid")
            # A consumed request is not resumed/re-executed, including a
            # private partial job. GET /jobs/id is the only reconciliation.
            path = self.job_root / request_id
            if path.exists() or path.is_symlink():
                raise PreparationError("usb_preparation_unverified")
            if "serial" in data:
                self.selected(user, nonce, data["serial"], "prepare:" + request_id)
                archive = self.usb.capture(data["serial"])
            else:
                encoded = data["capture"]
                if not isinstance(encoded, str) or not 0 < len(encoded) <= 4 * ((MAX_ARCHIVE + 2) // 3):
                    raise Refusal("usb_request_invalid")
                try:
                    archive = base64.b64decode(encoded, validate=True)
                except Exception:
                    raise Refusal("usb_request_invalid") from None
            return deliver(prepare_job(archive, self.job_root, user, data["friendly_name"], CONTRACT, request_id))
        finally:
            self.device_lock.release()

    def status(self, user, nonce, job_id):
        self.session(user, nonce)
        return job_status(self.job_root, job_id, user)

    def jobs(self, user, nonce):
        self.session(user, nonce)
        return available_jobs(self.job_root, user)

    def build(self, user, nonce, job_id):
        self.session(user, nonce)
        return self.builds.start(user, job_id)

    def build_status(self, user, nonce, job_id):
        self.session(user, nonce)
        return self.builds.status(user, job_id)


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *args):
        pass  # No URLs, ingress/session headers, identities or raw exceptions.

    def owner(self):
        # Trust neither forwarded-for nor an asserted user ID from any other
        # peer. Standard HA ingress with panel_admin=true provides admin entry.
        user = self.headers.get("X-Remote-User-Id", "")
        if self.client_address[0] != "172.30.32.2" or not USER.fullmatch(user):
            raise Refusal("usb_unauthorized")
        return user

    def reply(self, status, data, content_type="application/json"):
        if content_type == "application/json":
            data = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        if content_type == "application/x-tar":
            self.send_header("Content-Disposition", 'attachment; filename="qingping-cgs1-capture.tar"')
        self.send_header("Content-Security-Policy",
                         "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        try:
            user = self.owner()
            if self.path == "/":
                nonce = self.server.companion.page(user)
                data = (HERE / "static/index.html").read_text().replace("__PAGE_NONCE__", nonce).encode()
                return self.reply(200, data, "text/html; charset=utf-8")
            assets = {"app.mjs": "text/javascript", "style.css": "text/css",
                      "usb-probe-bundle.mjs": "text/javascript", "usb-probe-NOTICES.txt": "text/plain"}
            name = self.path.removeprefix("/")
            if name in assets:
                return self.reply(200, (HERE / "static" / name).read_bytes(), assets[name])
            if self.path == "/devices":
                devices = self.server.companion.discover(user, self.headers.get("X-Qingping-Nonce"))
                return self.reply(200, {"devices": devices})
            if self.path == "/jobs":
                return self.reply(200, self.server.companion.jobs(user, self.headers.get("X-Qingping-Nonce")))
            match = re.fullmatch(r"/jobs/([a-f0-9]{32})", self.path)
            if match:
                return self.reply(200, self.server.companion.status(user, self.headers.get("X-Qingping-Nonce"), match[1]))
            match = re.fullmatch(r"/jobs/([a-f0-9]{32})/build", self.path)
            if match:
                return self.reply(200, self.server.companion.build_status(user, self.headers.get("X-Qingping-Nonce"), match[1]))
            self.reply(404, {"error_code": "usb_not_found"})
        except (Refusal, PreparationError) as error:
            self.reply(403, {"error_code": str(error)})
        except Exception:
            self.reply(400, {"error_code": "usb_operation_failed"})

    def do_POST(self):
        try:
            user = self.owner()
            if self.path not in ("/inspect", "/capture", "/prepare", "/build"):
                return self.reply(404, {"error_code": "usb_not_found"})
            if self.headers.get("Content-Type") != "application/json" or self.headers.get("Transfer-Encoding"):
                raise Refusal("usb_request_invalid")
            size = self.headers.get("Content-Length", "")
            limit = 24 * 1024 * 1024 if self.path == "/prepare" else 256
            if not size.isdigit() or not 0 < int(size) <= limit:
                raise Refusal("usb_request_invalid")
            if self.path == "/prepare":
                return self.server.companion.prepare(user, self.headers.get("X-Qingping-Nonce"),
                    lambda: self.json_body(int(size)), lambda result: self.reply(200, result))
            if self.path == "/build":
                self.server.companion.session(user, self.headers.get("X-Qingping-Nonce"))
                data = self.json_body(int(size))
                if not isinstance(data, dict) or set(data) != {"job_id"}:
                    raise Refusal("usb_request_invalid")
                return self.reply(200, self.server.companion.build(user, self.headers.get("X-Qingping-Nonce"), data["job_id"]))
            data = json.loads(self.rfile.read(int(size)))
            if not isinstance(data, dict) or set(data) != {"serial"}:
                raise Refusal("usb_request_invalid")
            if self.path == "/capture":
                return self.server.companion.capture(user, self.headers.get("X-Qingping-Nonce"), data["serial"],
                    lambda archive: self.reply(200, archive, "application/x-tar"))
            result = self.server.companion.inspect(user, self.headers.get("X-Qingping-Nonce"), data["serial"])
            self.reply(200, result)
        except (Refusal, PreparationError) as error:
            self.reply(403, {"error_code": str(error)})
        except Exception:
            self.reply(400, {"error_code": "usb_operation_failed"})

    def json_body(self, size):
        deadline, body = time.monotonic() + 90, bytearray()
        while len(body) < size:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise Refusal("usb_request_timeout")
            if getattr(self, "connection", None) is not None:
                self.connection.settimeout(remaining)
            chunk = self.rfile.read1(min(65536, size - len(body)))
            if not chunk:
                raise Refusal("usb_request_invalid")
            body.extend(chunk)
        from preparation import unique_json
        return unique_json(bytes(body))


class Server(ThreadingHTTPServer):
    def handle_error(self, request, client_address):
        pass  # A dropped ingress connection must not dump request exceptions.


def main():
    os.umask(0o077)
    for directory in (Path("/data/adb"), Path("/data/jobs")):
        directory.mkdir(mode=0o700, exist_ok=True)
        if (directory.resolve() != directory or not directory.is_dir() or
                directory.stat().st_uid != os.getuid() or directory.stat().st_mode & 0o777 != 0o700):
            raise SystemExit("Private companion data directories are required")
    server = Server(("0.0.0.0", 8099), Handler)
    server.daemon_threads = True
    server.companion = Companion()
    server.serve_forever()


if __name__ == "__main__":
    main()
