"""Private stdio adapter for the shared USB engines, not an HTTP server.

Only HA's authenticated parent owns these pipes. Requests still carry the real
HA user and the companion's owner-bound page nonce; no Supervisor identity is
invented. The finite route table deliberately accepts no executable, host,
filesystem path or environment. Device writes keep the original durable
consumed intents. Closing/reopening a page never restarts an actor request.
"""
import fcntl
import json
import os
from pathlib import Path
import re
import sys

from preparation import PreparationError, USER, private_directory, unique_json
from server import Companion, Refusal

MAX_REQUEST = 24 * 1024**2
MAX_RESPONSE = 64 * 1024**2
PROFILE_MIME = "application/vnd.qingping.private-profile+json"
COMPUTER_MIME = "application/vnd.qingping.private-computer-bundle+tar"


class Actor:
    def __init__(self, companion, *, setup=None, usb_ready=None, prepared=None, tools_ready=None):
        self.companion = companion
        self.setup, self.usb_ready = setup, usb_ready
        self.prepared, self.tools_ready = prepared, tools_ready

    def dispatch(self, request):
        """One exact operation, with authentication before any device IO."""
        if (not isinstance(request, dict) or set(request) != {"user", "nonce", "operation", "data"}
                or not isinstance(request["user"], str) or not USER.fullmatch(request["user"])):
            raise Refusal("usb_unauthorized")
        user, nonce, operation, data = (request[k] for k in ("user", "nonce", "operation", "data"))
        if operation == "page" and nonce is None and data is None:
            return {"nonce": self.companion.page(user)}, "application/json"
        self.companion.session(user, nonce)
        if not isinstance(operation, str):
            raise Refusal("usb_request_invalid")
        if operation == "tools-status" and data is None and self.tools_ready is not None:
            try:
                self.tools_ready()
                state = "tools_ready"
            except (Refusal, PreparationError, OSError):
                state = "tools_required"
            return {"state": state, "hardware_contacted": False}, "application/json"
        if operation == "tools" and data == {} and self.setup is not None:
            return self.setup(), "application/json"
        if operation in ("devices", "jobs") and data is None:
            if operation == "devices" and self.usb_ready is not None:
                self.usb_ready()
            value = {"devices": self.companion.discover(user, nonce)} if operation == "devices" else self.companion.jobs(user, nonce)
            return value, "application/json"
        match = re.fullmatch(r"jobs/([a-f0-9]{32})(?:/(build|plan|install-review|install|full-trial))?", operation)
        if match and data is None:
            method = {None: "status", "build": "build_status", "plan": "plan_status",
                      "install-review": "install_review", "install": "install_status", "full-trial": "full_trial_status"}[match[2]]
            return getattr(self.companion, method)(user, nonce, match[1]), "application/json"
        if not isinstance(data, dict):
            raise Refusal("usb_request_invalid")
        if operation in ("inspect", "capture") and set(data) == {"serial"}:
            if self.usb_ready is not None:
                self.usb_ready()
            if operation == "inspect":
                return self.companion.inspect(user, nonce, data["serial"]), "application/json"
            return self.companion.capture(user, nonce, data["serial"], lambda body: body), "application/x-tar"
        if operation == "prepare":
            if self.tools_ready is not None:
                self.tools_ready()
            if "serial" in data and self.usb_ready is not None:
                self.usb_ready()
            return self.companion.prepare(user, nonce, lambda: data,
                self.prepared or (lambda value: value)), "application/json"
        if operation in ("build", "plan") and set(data) == {"job_id"}:
            return getattr(self.companion, operation)(user, nonce, data["job_id"]), "application/json"
        if operation in ("install", "full-trial"):
            if set(data) != {"job_id", "expected_plan_sha256", "experimental_reviewed"}:
                raise Refusal("usb_request_invalid")
            if self.usb_ready is not None:
                self.usb_ready()
            return self.companion.install(user, nonce, lambda: data, lambda value: value,
                                          full=operation == "full-trial"), "application/json"
        if operation in ("observe", "full-review"):
            if self.usb_ready is not None:
                self.usb_ready()
            return self.companion.observe(user, nonce, lambda: data, lambda value: value,
                                          full=operation == "full-review"), "application/json"
        if operation in ("export-profile", "export-originals", "export-computer"):
            mime = {"export-profile": PROFILE_MIME, "export-originals": "application/x-tar",
                    "export-computer": COMPUTER_MIME}[operation]
            return self.companion.export(user, nonce, lambda: data, lambda value: value,
                profile=operation == "export-profile", computer=operation == "export-computer"), mime
        raise Refusal("usb_request_invalid")


def serve(actor, source, destination):
    """Bounded length frames keep exports opaque, outside ordinary JSON status.

    There is one writer and one request in flight. A broken pipe is terminal;
    neither side repeats a request whose result may already have been applied.
    No traceback or arbitrary exception text is ever put on the pipe or stderr.
    """
    while True:
        header = source.readline(32)
        if not header:
            return
        if not re.fullmatch(rb"[1-9][0-9]{0,8}\n", header) or int(header) > MAX_REQUEST:
            return
        size = int(header)
        raw = source.read(size)
        if len(raw) != size:
            return
        try:
            value, mime = actor.dispatch(unique_json(raw))
            body = json.dumps(value, separators=(",", ":")).encode() if mime == "application/json" else value
            if not isinstance(body, bytes) or not 0 < len(body) <= MAX_RESPONSE:
                raise Refusal("usb_operation_failed")
            response = {"ok": True, "mime": mime, "length": len(body)}
        except (Refusal, PreparationError) as error:
            code = str(error)
            # Existing engines expose finite public categories. Never turn a
            # filesystem/subprocess exception into a caller-visible message.
            if not re.fullmatch(r"usb_[a-z_]{1,64}", code):
                code = "usb_operation_failed"
            body = json.dumps({"error_code": code}).encode()
            response = {"ok": False, "mime": "application/json", "length": len(body)}
        except Exception:
            body = b'{"error_code":"usb_operation_failed"}'
            response = {"ok": False, "mime": "application/json", "length": len(body)}
        destination.write(json.dumps(response, separators=(",", ":")).encode() + b"\n")
        destination.write(body)
        destination.flush()


def main():
    os.umask(0o077)
    root = private_directory(Path.cwd())
    if os.environ.get("QINGPING_MONITOR1_CORE_ROOT") != str(root):
        raise SystemExit(1)
    # A previous actor doing a bounded operation owns this kernel lock, even
    # across a Core unload. No PID file, socket or old job grants adoption.
    lock = os.open(root / "actor.lock", os.O_WRONLY | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    from core_tools import CoreTools
    tools = CoreTools(root)
    try:
        companion = Companion(usb=tools.usb(), job_root=private_directory(root / "jobs"))
        serve(Actor(companion, setup=tools.prepare, usb_ready=tools.start_usb,
                    tools_ready=tools.admitted, prepared=tools.bind_job), sys.stdin.buffer, sys.stdout.buffer)
    finally:
        tools.close()
        os.close(lock)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        # Pipes are private but stderr may be collected by HA; no raw errors.
        raise SystemExit(1) from None
