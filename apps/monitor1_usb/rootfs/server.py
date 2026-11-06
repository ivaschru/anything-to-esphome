#!/usr/bin/env python3
"""Ingress-only, read-only Monitor 1 USB companion.

Only generated fixed reads can reach ADB. No generic shell, push, activation,
TCP daemon listener on the LAN or Home Assistant API access exists here.
Browser USB uses the same source contract in the offline frontend bundle.
"""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import hmac
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import threading
import time
import uuid

HERE = Path(__file__).resolve().parent
SERIAL = re.compile(r"[A-Za-z0-9][A-Za-z0-9_-]{0,127}")
USER = re.compile(r"[a-f0-9]{32}")
CONTRACT = json.loads((HERE / "contract.json").read_text())


class Refusal(Exception):
    """Fixed public category only; never wrap ADB output or raw exceptions."""


class UsbReads:
    def __init__(self, executable="adb", run=subprocess.run):
        self.executable, self.run = executable, run

    def command(self, arguments, deadline):
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise Refusal("usb_read_timeout")
        try:
            # Isolate the adb server/key directory from Supervisor credentials
            # and the integration's environment. The server listens only on
            # localhost; no -a/-H/tcpip/reverse/forward operation is exposed.
            result = self.run([self.executable, *arguments], capture_output=True,
                timeout=min(10, remaining), check=False,
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

    def inspect(self, serial):
        deadline = time.monotonic() + 60
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


class Companion:
    def __init__(self, usb=None):
        self.usb = usb or UsbReads()
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
        return value

    def inspect(self, user, nonce, serial):
        value = self.session(user, nonce)
        if not isinstance(serial, str) or not SERIAL.fullmatch(serial):
            raise Refusal("usb_selection_invalid")
        with self.lock:
            if serial in value[2]:
                raise Refusal("usb_selection_consumed")
            value[2].add(serial)  # Before first USB read, even on timeout/disconnect.
        if not self.device_lock.acquire(blocking=False):
            raise Refusal("usb_busy")
        try:
            return self.usb.inspect(serial)
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
            self.reply(404, {"error_code": "usb_not_found"})
        except Refusal as error:
            self.reply(403, {"error_code": str(error)})
        except Exception:
            self.reply(400, {"error_code": "usb_operation_failed"})

    def do_POST(self):
        try:
            user = self.owner()
            if self.path != "/inspect":
                return self.reply(404, {"error_code": "usb_not_found"})
            if self.headers.get("Content-Type") != "application/json" or self.headers.get("Transfer-Encoding"):
                raise Refusal("usb_request_invalid")
            size = self.headers.get("Content-Length", "")
            if not size.isdigit() or not 0 < int(size) <= 256:
                raise Refusal("usb_request_invalid")
            data = json.loads(self.rfile.read(int(size)))
            if not isinstance(data, dict) or set(data) != {"serial"}:
                raise Refusal("usb_request_invalid")
            result = self.server.companion.inspect(user, self.headers.get("X-Qingping-Nonce"), data["serial"])
            self.reply(200, result)
        except Refusal as error:
            self.reply(403, {"error_code": str(error)})
        except Exception:
            self.reply(400, {"error_code": "usb_operation_failed"})


class Server(ThreadingHTTPServer):
    def handle_error(self, request, client_address):
        pass  # A dropped ingress connection must not dump request exceptions.


def main():
    os.umask(0o077)
    directory = Path("/data/adb")
    directory.mkdir(mode=0o700, exist_ok=True)
    if (directory.resolve() != directory or not directory.is_dir() or
            directory.stat().st_uid != os.getuid() or directory.stat().st_mode & 0o777 != 0o700):
        raise SystemExit("Private companion ADB directory is required")
    server = Server(("0.0.0.0", 8099), Handler)
    server.daemon_threads = True
    server.companion = Companion()
    server.serve_forever()


if __name__ == "__main__":
    main()
