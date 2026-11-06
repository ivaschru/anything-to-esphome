#!/usr/bin/env python3
"""Prepare the exact reviewed CGS1 startup patches locally; never install them.

Vendor scripts remain private inputs. Only our short startup fragment and the
single watchdog launch-line replacement are distributed. Both complete output
digests must match StockInspection, so similar-looking or newer vendor scripts
cannot quietly become installation candidates. This module has no transport,
upload, signal, activation or arbitrary-patch interface.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess

import build_pm_helper as pm

HERE = Path(__file__).resolve().parent
START_FACTORY = "c38d532b44f02922aa850c247f0ddd227265c7873a35a20e9ac71ac21b9627e6"
START_INSTALLED = "f104f873dd3ce4544d5f3e3f90a4056bffc811bcaae037e347306e1084e7f1d1"
WATCHDOG_FACTORY = "07b61bb67ff58a97e0f92de5b8bf0a94ca106e27ba3afa50f322817b8896dad7"
WATCHDOG_INSTALLED = "1d74ef0946734e1ddf9e76301012f9ed66d7b38d9d7a0239a5d0e80acabf2cce"
HOOK_SHA = "42ffeb1329a9185431ba2f7006d0e64ac87214967ab6e0c30f276bb63665314e"
ASSET_PINS = {
    "launch.sh": "0e3b041b629cf24f1be8327df858913bd7f6f37164013b52cb1d9ef232ad4117",
    "SnowApp-with-PM": "c1a1700e5172e7a9f415b947ad9b3e852e2d3ec2ca770315894a3b9e7866530a",
    "startup-hook.sh": HOOK_SHA,
}
WATCHDOG_OLD = b"\t\t/data/bin/SnowApp -platform EGLFS  &\n"
WATCHDOG_NEW = b"\t\t/data/.esphome-cgs1/SnowApp-with-PM -platform EGLFS  &\n"


def sha(data):
    return hashlib.sha256(data).hexdigest()


def read_regular(path, maximum=65536):
    """Read a bounded file without following the final symlink or racing stat.

    Capture uses private directories. O_NOFOLLOW/fstat additionally reject a
    swapped leaf, FIFO/device, hard link or concurrent change before its bytes
    can be accepted as recovery material. Callers never log input contents.
    """
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(fd, "rb") as stream:
        before = os.fstat(stream.fileno())
        if (not stat.S_ISREG(before.st_mode) or before.st_nlink != 1 or
                not 0 < before.st_size <= maximum):
            raise ValueError("Expected one bounded regular input file")
        data = stream.read(maximum + 1)
        after = os.fstat(stream.fileno())
    identity = lambda s: (s.st_dev, s.st_ino, s.st_size, s.st_mtime_ns, s.st_ctime_ns)
    if len(data) != before.st_size or identity(before) != identity(after):
        raise ValueError("Input changed while being read")
    return data


def patch_bytes(start, watchdog, hook):
    """Reproduce only the two already reviewed complete script fingerprints."""
    if (sha(start) != START_FACTORY or sha(watchdog) != WATCHDOG_FACTORY or
            sha(hook) != HOOK_SHA or watchdog.count(WATCHDOG_OLD) != 1):
        raise ValueError("Stock scripts or startup fragment differ from the reviewed source")
    patched_start = start + hook
    patched_watchdog = watchdog.replace(WATCHDOG_OLD, WATCHDOG_NEW, 1)
    if (sha(patched_start) != START_INSTALLED or
            sha(patched_watchdog) != WATCHDOG_INSTALLED):
        raise ValueError("Patched scripts differ from the installed runtime fingerprints")
    return patched_start, patched_watchdog


def prepare(start_path, watchdog_path, output_path):
    """Preserve originals plus generated candidates in one fresh private tree.

    Shell parsing is syntax-only (-n). In particular none of these scripts is
    executed on a developer host. The manifest deliberately cannot authorize a
    device write: no target identity, transport, CAS or activation is included.
    """
    start, watchdog = read_regular(start_path), read_regular(watchdog_path)
    assets = {name: read_regular(HERE / "bootstrap" / name) for name in ASSET_PINS}
    if any(sha(data) != ASSET_PINS[name] for name, data in assets.items()):
        raise ValueError("Bootstrap source no longer matches the runtime gates")
    new_start, new_watchdog = patch_bytes(start, watchdog, assets["startup-hook.sh"])
    output = pm.private_output(output_path)
    data = {"stock-start.sh.original": start, "stock-watchdog.sh.original": watchdog,
            "start.sh.candidate": new_start, "watchdog.sh.candidate": new_watchdog,
            **assets}
    # File mode is explicit even when invoked by a caller with a permissive
    # umask. Preserve failed syntax evidence; never overwrite or delete it.
    for name, value in data.items():
        fd = os.open(output / name, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "wb") as stream:
            stream.write(value)
        subprocess.run(["/bin/sh", "-n", str(output / name)], check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=5)
    report = {"schema_version": 1, "stage": "patches_prepared_not_installed",
              "hardware_contacted": False, "installation_ready": False,
              "installed": False, "stock_version": "4.1.8_0287",
              "files": {name: {"sha256": sha(value), "size": len(value)}
                        for name, value in data.items()}}
    fd = os.open(output / "result.json", os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w") as stream:
        json.dump(report, stream, indent=2)
        stream.write("\n")
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--stock-start", type=Path, required=True)
    parser.add_argument("--stock-watchdog", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    report = prepare(args.stock_start, args.stock_watchdog, args.output)
    print(json.dumps({key: report[key] for key in
                      ("stage", "hardware_contacted", "installation_ready", "installed")}))


if __name__ == "__main__":
    main()
