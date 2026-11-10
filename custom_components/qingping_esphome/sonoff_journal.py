"""Value-free worker completion proof shared by HA and the isolated child.

A free flock alone proves neither success nor that a conversion is replayable.
Only the original worker can leave a matching terminal receipt after its engine
returns and its ephemeral credentials are removed. Missing/crashed legacy jobs
stay uncertain. No PID, command, key, log or account material enters this file.
"""
from __future__ import annotations

import fcntl
import json
import os
from pathlib import Path
import stat
import time


def _open(path, flags):
    descriptor = os.open(path, flags | os.O_NOFOLLOW, 0o600)
    metadata = os.fstat(descriptor)
    if (not stat.S_ISREG(metadata.st_mode) or metadata.st_nlink != 1
            or metadata.st_mode & 0o077 or metadata.st_uid != os.getuid()):
        os.close(descriptor)
        raise ValueError("Invalid private worker journal")
    return descriptor


def acquire(job):
    """Hold this original worker's lock until all terminal bookkeeping ends."""
    # Existence is permanent consumption, including a crash before receipt.
    # A released lock never permits launching this job a second time.
    descriptor = _open(Path(job) / "worker.lock", os.O_RDWR | os.O_CREAT | os.O_EXCL)
    try:
        fcntl.flock(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BaseException:
        os.close(descriptor)
        raise
    return descriptor


def inherited(job, descriptor):
    """Validate an actually inherited kernel capability, never reopen a lease.

    A descriptor number serialized in request.json is not authority after a
    restart: it must still refer to this exact private consumed lock inode.
    Only Runtime.launch passes that original descriptor through exec.
    """
    if type(descriptor) is not int or descriptor < 3:
        raise ValueError("Original worker lease unavailable")
    current = os.fstat(descriptor)
    named = (Path(job) / "worker.lock").lstat()
    if (not stat.S_ISREG(current.st_mode) or current.st_mode & 0o077
            or current.st_uid != os.getuid() or current.st_nlink != 1
            or not stat.S_ISREG(named.st_mode)
            or (current.st_dev, current.st_ino) != (named.st_dev, named.st_ino)):
        raise ValueError("Original worker lease changed")
    return descriptor


def finish(job, request, result):
    """Create one durable receipt; never turn an exception/signal into success."""
    if request.get("format") != "anything-sonoff-job-v2":
        return  # An old request has no trusted receipt binding.
    value = {"format": "anything-sonoff-terminal-v1", "nonce": request["receipt_nonce"],
             "mac": request["mac"], "result": int(result), "finished_at": time.time()}
    path = Path(job) / "terminal.json"
    descriptor = _open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL)
    with os.fdopen(descriptor, "w") as stream:
        json.dump(value, stream, sort_keys=True)
        stream.flush()
        os.fsync(stream.fileno())
    directory = os.open(path.parent, os.O_RDONLY)
    try:
        os.fsync(directory)
    finally:
        os.close(directory)


def settlement(job, nonce, mac):
    """Return active/settled/unknown without adopting a process or restarting IO.

    A terminal file observed while its original lock is still held is not yet
    settled. Interrupted/partial/mismatched files remain unknown, never empty.
    The nonce comes only from the private, consumed HA record, not the browser.
    """
    try:
        descriptor = _open(Path(job) / "worker.lock", os.O_RDWR)
    except (OSError, ValueError):
        return "unknown"
    try:
        try:
            fcntl.flock(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return "active"
        try:
            receipt = _open(Path(job) / "terminal.json", os.O_RDONLY)
            with os.fdopen(receipt, "r") as stream:
                if os.fstat(stream.fileno()).st_size > 2048:
                    return "unknown"
                value = json.load(stream)
            if (isinstance(nonce, str) and len(nonce) == 32
                    and value.get("format") == "anything-sonoff-terminal-v1"
                    and value.get("nonce") == nonce and value.get("mac") == mac
                    and type(value.get("result")) is int
                    and type(value.get("finished_at")) in (int, float)
                    and 0 < value["finished_at"] <= time.time() + 5):
                return "settled"
        except (OSError, ValueError, TypeError, AttributeError):
            pass
        return "unknown"
    finally:
        os.close(descriptor)
