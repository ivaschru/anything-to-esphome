"""Private fixed Sonoff-OTA runtime, kept outside the MIT HA implementation.

Only the pinned public archive may be extracted. No caller chooses an archive,
program, command, interpreter, filesystem path or environment. Every job owns
a fresh source/captures tree. Credentials travel through one private 0600
request file, not argv/environment/stdout. Ambiguous jobs are never relaunched.
"""
from __future__ import annotations

import asyncio
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import stat
import sys
import tarfile

from homeassistant.helpers.aiohttp_client import async_get_clientsession
from .sonoff_policy import SonoffError

COMMIT = "37962db36b154269076afd223c11f11e2d1eb770"
ARCHIVE_URL = "https://codeload.github.com/adamsthws/Sonoff-OTA/tar.gz/" + COMMIT
ARCHIVE_SHA256 = "59ed480122b222486ec9e867292e7223dd172f65d6d541e67963d8d3cf794dbb"
MAX_ARCHIVE = 32 * 1024 * 1024
MAX_EXTRACTED = 128 * 1024 * 1024
ROOT = Path(__file__).parent


def private_write(path, data):
    """Exclusive file + directory fsync; never expose a half-written intent."""
    path = Path(path)
    temporary = path.with_name(path.name + ".new")
    descriptor = os.open(temporary, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(descriptor, "wb") as stream:
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temporary, path)
    directory = os.open(path.parent, os.O_RDONLY)
    try:
        os.fsync(directory)
    finally:
        os.close(directory)


def extract_archive(data, destination):
    """Refuse links/devices/path traversal/oversized members before extraction."""
    if len(data) > MAX_ARCHIVE or hashlib.sha256(data).hexdigest() != ARCHIVE_SHA256:
        raise SonoffError("sonoff_runtime_failed")
    destination = Path(destination)
    if destination.exists():
        raise SonoffError("sonoff_busy")
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as archive:
        members = archive.getmembers()
        if len(members) > 5000 or sum(m.size for m in members) > MAX_EXTRACTED:
            raise SonoffError("sonoff_runtime_failed")
        # GitHub renamed the pinned upstream repository to firmware-liberator.
        # The original codeload URL still returns the same SHA-pinned bytes,
        # whose tar root uses that new name. Admit only these two exact roots;
        # never infer an arbitrary archive prefix or relax path/link checks.
        prefixes = {name + COMMIT for name in ("Sonoff-OTA-", "firmware-liberator-")}
        entries = []
        for member in members:
            path = PurePosixPath(member.name)
            if (not path.parts or path.parts[0] not in prefixes or ".." in path.parts
                    or path.is_absolute() or not (member.isfile() or member.isdir())
                    or member.size > 32 * 1024 * 1024):
                raise SonoffError("sonoff_runtime_failed")
            if len(path.parts) > 1:
                entries.append((member, destination.joinpath(*path.parts[1:])))
        destination.mkdir(mode=0o700)
        for member, path in entries:
            if member.isdir():
                path.mkdir(mode=0o700, parents=True, exist_ok=True)
                continue
            path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
            with archive.extractfile(member) as incoming:
                descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
                with os.fdopen(descriptor, "wb") as outgoing:
                    outgoing.write(incoming.read())


class Runtime:
    def __init__(self, hass, root):
        self.hass, self.root = hass, Path(root)

    async def prepare(self, job_id):
        archive_path = self.root / "engine.tar.gz"
        self.root.mkdir(mode=0o700, parents=True, exist_ok=True)
        if archive_path.exists():
            data = await self.hass.async_add_executor_job(archive_path.read_bytes)
            if hashlib.sha256(data).hexdigest() != ARCHIVE_SHA256:
                raise SonoffError("sonoff_runtime_failed")
        else:
            async with asyncio.timeout(120):
                async with async_get_clientsession(self.hass).get(ARCHIVE_URL, allow_redirects=False) as response:
                    if response.status != 200:
                        raise SonoffError("sonoff_runtime_failed")
                    body = bytearray()
                    async for part in response.content.iter_chunked(65536):
                        body.extend(part)
                        if len(body) > MAX_ARCHIVE:
                            raise SonoffError("sonoff_runtime_failed")
                    data = bytes(body)
            if hashlib.sha256(data).hexdigest() != ARCHIVE_SHA256:
                raise SonoffError("sonoff_runtime_failed")
            await self.hass.async_add_executor_job(private_write, archive_path, data)
        job = self.root / job_id
        job.mkdir(mode=0o700)
        await self.hass.async_add_executor_job(extract_archive, data, job / "upstream")
        return job

    async def launch(self, job, request):
        await self.hass.async_add_executor_job(private_write, job / "request.json",
                                              json.dumps(request).encode())
        # The request has already been admitted and durably consumed by the
        # caller. This is the sole spawn; no exception path retries it.
        environment = {"PATH": os.environ.get("PATH", "/usr/bin:/bin"),
                       "HOME": str(job), "PYTHONUNBUFFERED": "1",
                       "PYTHONPATH": str(ROOT / "sonoff_worker") + os.pathsep + str(job / "upstream")}
        log = (job / "private-engine.log").open("xb")
        os.chmod(log.name, 0o600)
        try:
            process = await asyncio.create_subprocess_exec(
                sys.executable, str(ROOT / "sonoff_worker/runner.py"),
                cwd=job / "upstream", env=environment, stdin=asyncio.subprocess.DEVNULL,
                stdout=log, stderr=log, start_new_session=True)
        finally:
            log.close()
        return process


def progress(job):
    """Read finite counters, never forward the raw upstream state/log/body."""
    for path in (Path(job) / "upstream/captures").glob("plugs/*/runs/*/autoflash-state.json"):
        try:
            if path.is_symlink() or path.stat().st_size > 1048576:
                continue
            value = json.loads(path.read_text())
            steps = value.get("steps", {})
            states = [v.get("status") for v in steps.values() if isinstance(v, dict)]
            return {"completed": sum(v == "done" for v in states), "total": max(11, len(states))}
        except (ValueError, OSError, TypeError, AttributeError):
            continue
    return {"completed": 0, "total": 11}
