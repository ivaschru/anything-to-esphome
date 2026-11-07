"""Authenticated HA adapter for the packaged Monitor 1 stdio worker.

The worker has no HTTP listener or HA credentials. Only this integration's
admin view supplies the actual user ID. One in-flight pipe transaction owns
the upload/export budget; cancellation never causes a resend or a fresh actor
to adopt ambiguous durable work. All filesystem/process IO is off HA's loop.
"""
import asyncio
from contextlib import asynccontextmanager
import json
import os
from pathlib import Path
import re
import stat
import sys

from aiohttp import web
from homeassistant.components.http import HomeAssistantView

DOMAIN = "qingping_esphome"
MAX_INPUT = 24 * 1024**2
MAX_OUTPUT = 64 * 1024**2
MIMES = {"application/json", "application/x-tar",
         "application/vnd.qingping.private-profile+json",
         "application/vnd.qingping.private-computer-bundle+tar"}


class CoreRefusal(Exception):
    """Finite public category; never include worker errors or private paths."""


def private_root(path):
    """Create only this integration's fixed data root, preserving old app data."""
    path = Path(path)
    for directory in (path, path / "jobs", path / "adb", path / "toolsets"):
        directory.mkdir(mode=0o700, exist_ok=True)
        info = directory.lstat()
        if (directory.resolve() != directory or not stat.S_ISDIR(info.st_mode)
                or info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) != 0o700):
            raise CoreRefusal("usb_core_storage_unverified")
    return path


class Monitor1:
    def __init__(self, hass):
        self.hass = hass
        self.root = Path(hass.config.path(".storage", "qingping_esphome_monitor1"))
        self.process = None
        self.lock = asyncio.Lock()
        self.pending = None
        self.closing = False
        self.failed = False

    @asynccontextmanager
    async def reserve(self):
        # Refuse rather than queue large bodies or anonymous parallel requests.
        # Checking/acquiring an unlocked asyncio lock has no suspension gap.
        if self.closing or self.failed:
            raise CoreRefusal("usb_core_unverified")
        if self.lock.locked():
            raise CoreRefusal("usb_busy")
        async with self.lock:
            yield

    async def start(self):
        if self.process is not None:
            if self.process.returncode is not None:
                self.failed = True
                raise CoreRefusal("usb_core_unverified")
            return
        root = await self.hass.async_add_executor_job(private_root, self.root)
        script = Path(__file__).parent / "monitor1_worker/core_actor.py"
        # No inherited tokens, PYTHONPATH, dynamic libraries or shell command.
        # This is stdlib-only control code; per-job SDKs remain in their venvs.
        self.process = await asyncio.create_subprocess_exec(sys.executable, "-s", str(script),
            cwd=str(root), env={"PATH": "/usr/local/bin:/usr/bin:/bin", "HOME": str(root),
                "PYTHONNOUSERSITE": "1", "PYTHONUNBUFFERED": "1",
                "QINGPING_MONITOR1_CORE_ROOT": str(root)},
            stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL, limit=2048)

    async def exchange(self, user, nonce, operation, data):
        await self.start()
        request = json.dumps({"user": user, "nonce": nonce, "operation": operation,
                              "data": data}, separators=(",", ":")).encode()
        if not 0 < len(request) <= MAX_INPUT:
            raise CoreRefusal("usb_request_invalid")
        process = self.process
        try:
            process.stdin.write(str(len(request)).encode() + b"\n" + request)
            await process.stdin.drain()
            header = await process.stdout.readline()
            if len(header) > 1024:
                raise ValueError
            frame = json.loads(header)
            if (set(frame) != {"ok", "mime", "length"} or type(frame["ok"]) is not bool
                    or frame["mime"] not in MIMES or type(frame["length"]) is not int
                    or not 0 < frame["length"] <= MAX_OUTPUT
                    or (frame["mime"] == "application/json" and frame["length"] > 256 * 1024)):
                raise ValueError
            body = await process.stdout.readexactly(frame["length"])
            return frame["ok"], frame["mime"], body
        except Exception:
            # Lost ACK/invalid frame makes this service read-unverified. Never
            # restart a worker or repeat the request to recover its response.
            self.failed = True
            raise CoreRefusal("usb_core_unverified") from None

    async def call(self, user, nonce, operation, data):
        # Retain the reservation and drain the original result if a browser
        # disconnects. Without shielding, a cancelled read could let the next
        # request consume a previous writer's response as its own.
        task = asyncio.create_task(self.exchange(user, nonce, operation, data))
        self.pending = task
        try:
            return await asyncio.shield(task)
        except asyncio.CancelledError:
            try:
                await asyncio.shield(task)
            except Exception:
                pass
            raise
        finally:
            self.pending = None

    async def stop(self):
        self.closing = True
        # EOF is observed after the current bounded engine operation. Do not
        # kill it mid-write on unload, discard receipts or signal device PIDs.
        # The actor's flock prevents a new instance adopting that live worker.
        if self.process is not None and self.process.stdin is not None:
            self.process.stdin.close()


class Monitor1View(HomeAssistantView):
    url = "/api/qingping_esphome/monitor1/{operation:.*}"
    name = "api:qingping_esphome:monitor1"
    requires_auth = True

    async def post(self, request, operation):
        user = request.get("hass_user")
        headers = {"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"}
        if user is None or not user.is_admin:
            return web.json_response({"error_code": "usb_unauthorized"}, status=403, headers=headers)
        manager = request.app["hass"].data.get(DOMAIN)
        service = getattr(manager, "monitor1", None)
        if service is None:
            return web.json_response({"error_code": "usb_core_unavailable"}, status=503, headers=headers)
        try:
            if (not re.fullmatch(r"[a-z][a-z0-9/-]{0,100}", operation)
                    or request.content_type != "application/json" or request.headers.get("Transfer-Encoding")
                    or request.content_length is None or not 0 < request.content_length <= MAX_INPUT):
                raise CoreRefusal("usb_request_invalid")
            async with service.reserve():
                async with asyncio.timeout(90):
                    raw = await request.content.readexactly(request.content_length)
                data = json.loads(raw)
                nonce = request.headers.get("X-Qingping-Nonce")
                if operation == "page":
                    if data is not None or nonce is not None:
                        raise CoreRefusal("usb_request_invalid")
                elif not isinstance(nonce, str) or not re.fullmatch(r"[a-f0-9]{64}", nonce):
                    raise CoreRefusal("usb_unauthorized")
                ok, mime, body = await service.call(user.id, nonce, operation, data)
            if mime != "application/json":
                filename = {"application/x-tar": "qingping-cgs1-capture.tar",
                    "application/vnd.qingping.private-profile+json": "qingping-cgs1-private-profile.json",
                    "application/vnd.qingping.private-computer-bundle+tar": "qingping-cgs1-computer.tar"}[mime]
                headers["Content-Disposition"] = f'attachment; filename="{filename}"'
            headers["Content-Type"] = mime
            return web.Response(body=body, status=200 if ok else 403, headers=headers)
        except CoreRefusal as error:
            return web.json_response({"error_code": str(error)}, status=403, headers=headers)
        except Exception:
            return web.json_response({"error_code": "usb_operation_failed"}, status=400, headers=headers)
