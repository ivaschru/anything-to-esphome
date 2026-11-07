"""Explicit owner-only downloads, never ordinary status or public assets.

The profile contains the individual Noise key. Serve its original verified
bytes only as an attachment after the authenticated owner's explicit action.
The stored original-file export remains available after USB installation,
when the factory-only live capture correctly refuses an existing own root.
"""
import hashlib
import io
import os
from pathlib import Path
import stat
import tarfile

from preparation import (MAX_ARCHIVE, PREFIX, PreparationError, job_status,
                         owned_intent, private_directory, read_private, validated_capture)


def profile_export(parent, owner, job_id):
    if job_status(parent, job_id, owner)["stage"] != "profile_prepared":
        raise PreparationError("usb_private_export_unverified")
    directory, _, _ = owned_intent(parent, job_id, owner)
    # job_status checks the immutable intent/completion/profile hash. Do not
    # parse/print/re-serialize the secret into another DTO or a normal log.
    return read_private(directory / "profile.json")


def capture_export(parent, owner, job_id, contract):
    profile_export(parent, owner, job_id)
    directory, _, _ = owned_intent(parent, job_id, owner)
    capture = private_directory(directory / "capture")
    if len(contract["files"]) != 9 or sum(item["size"] for item in contract["files"]) > MAX_ARCHIVE:
        raise PreparationError("usb_private_export_unverified")
    contents = {}
    for item in contract["files"]:
        relative = Path(item["path"].lstrip("/"))  # Bundled constants only.
        source_parent = capture
        for part in relative.parts[:-1]:
            source_parent = private_directory(source_parent / part)
        fd = os.open(capture / relative, os.O_RDONLY | os.O_NOFOLLOW)
        with os.fdopen(fd, "rb") as stream:
            info = os.fstat(stream.fileno())
            if (not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_nlink != 1 or
                    stat.S_IMODE(info.st_mode) != 0o600 or info.st_size != item["size"]):
                raise PreparationError("usb_private_export_unverified")
            body = stream.read(item["size"] + 1)
        if len(body) != item["size"] or hashlib.sha256(body).hexdigest() != item["sha256"]:
            raise PreparationError("usb_private_export_unverified")
        contents[str(relative)] = body
    contents["result.json"] = read_private(capture / "result.json")
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode="w", format=tarfile.USTAR_FORMAT) as archive:
        for name, body in contents.items():
            member = tarfile.TarInfo(PREFIX + "/" + name)
            member.mode, member.size = 0o600, len(body)
            archive.addfile(member, io.BytesIO(body))
    data = output.getvalue()
    # Preserve the original native/browser identity report without inventing
    # a new live USB/boot claim. Export checks every copied body again.
    validated_capture(data, contract)
    return data
