#!/usr/bin/env python3
"""Read-only USB/ADB source capture for the initial CGS1 installer.

This is not an installer: it has no push, shell upload, boot activation,
reboot, radio or GPIO operation. It captures only nine fixed recovery/build
files after exact root/USB/WLAN/stock/CO2 admission. Private Wi-Fi/MiIO files
are not copied; the stock INI is filtered on-device to its one CO2 type field.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import uuid

import bootstrap_patches as patches
import build_pm_helper as pm

# These are the independently backed-up 4.1.8_0287 recovery components, not a
# model-name heuristic. Both tested S8/SCD40 units used these exact bytes.
# A different revision is evidence to review, never an invitation to patch it.
FILES = {
    "/data/bin/SnowApp": ("a39016531620a874668ee322f0e976f48e47943742c54c8a7291b9e830c91abb", 4925568),
    "/data/bin/watchdog.sh": (patches.WATCHDOG_FACTORY, 1701),
    "/data/etc/init.d/start.sh": (patches.START_FACTORY, 1639),
    "/etc/init.d/S12_launcher_init": ("533cac6f65b3ccf8d3404216c688877ad03a8b03af64edaade9bd6dc3aad1c35", 497),
    "/etc/init.d/S50_px3se_init": ("d818606f68bc1428ef96c5257df751a843cc9a6770dc25a2487a940c6bcb2492", 480),
    "/lib/ld-2.23.so": ("6da48efda9ff440998747a66131e8ebdc6a57a15bb19dcfd7895a031368dd50a", 155376),
    "/lib/libc-2.23.so": ("6479e377cd35c6e90e9aba990ac5137b195ca765544ad0c561f7f5945ea7133e", 1209932),
    "/usr/lib/libstdc++.so.6.0.20": ("93cc1352b59a0d3a39a8f9d311332f84115e3c5ee71afd846302b942071675c4", 658792),
    "/usr/lib/libQt5Core.so.5.9.4": ("b43e1cc628e625a422cfcf98aad38c9542b98cea28196ac4fd14931fd5ccf88d", 5427824),
}
CO2_READ = r"""awk '
BEGIN { section=0; count=0 }
/^[ \t]*\[/ { section=($0 ~ /^[ \t]*\[sensors\][ \t]*\r?$/) }
section && /^[ \t]*co2_type[ \t]*=/ {
    value=$0; sub(/^[^=]*=[ \t]*/, "", value); sub(/[ \t\r]*$/, "", value)
    print value; count++
}
END { if (count != 1) exit 1 }
' /data/etc/setting.ini"""


def expected_target(mac, co2):
    if (not isinstance(mac, str) or not re.fullmatch(r"[0-9a-f]{2}(?::[0-9a-f]{2}){5}", mac) or
            int(mac[:2], 16) & 1 or mac == "00:00:00:00:00:00" or
            type(co2) is not int or co2 not in (2, 3)):
        raise ValueError("Specify an exact lowercase WLAN MAC and CO2 type 2 or 3")


def completed_shell(stdout, marker):
    """Old adbd's host exit code alone does not prove remote shell completion.

    Require our unpredictable final marker after set -e. Normalize CRLF only,
    retaining any other unexpected bytes so partial, echoed or noisy replies
    fail the strict caller parser. The marker is transport evidence, no secret.
    """
    data = stdout.replace(b"\r\n", b"\n")
    suffix = b"\n" + marker.encode() + b"\n"
    if not data.endswith(suffix):
        raise ValueError("ADB remote read did not reach its completion marker")
    return data[:-len(suffix)].decode("ascii").strip()


class Adb:
    def __init__(self, executable, serial):
        # A generic Rockchip serial is insufficient identity, but selecting one
        # explicit USB serial still prevents adb choosing a different device.
        # TCP selectors and adb -e/-d shortcuts are deliberately unavailable.
        if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,127}", serial):
            raise ValueError("Specify one explicit USB ADB serial")
        self.base = [str(executable), "-s", serial]
        self.serial = serial

    def command(self, arguments, timeout=30):
        result = subprocess.run([*self.base, *arguments], stdout=subprocess.PIPE,
                                stderr=subprocess.DEVNULL, timeout=timeout)
        if result.returncode:
            raise ValueError("ADB read failed; no device write was attempted")
        return result.stdout

    def usb(self):
        state = self.command(["get-state"]).strip()
        path = self.command(["get-devpath"]).strip()
        if state != b"device" or not re.fullmatch(rb"usb:[A-Za-z0-9._:-]+", path):
            raise ValueError("An authorized USB ADB transport is required")
        return path.decode("ascii")

    def read(self, command):
        marker = "__CGS1_READ_OK_" + uuid.uuid4().hex + "__"
        # command is chosen only by the fixed routines in this module. No MAC,
        # serial, filename returned by the target or CLI shell payload is ever
        # interpolated into it. The old daemon supports ordinary shell/SYNC.
        script = "set -e\n" + command + "\nprintf '\\n" + marker + "\\n'\n"
        return completed_shell(self.command(["shell", script]), marker)

    def pull(self, source, destination):
        if source not in FILES:
            raise ValueError("Source is outside the fixed recovery file set")
        # Individual SYNC pull works with the tested old daemon. exec-out and
        # recursive modern SYNC pulls do not; never create an archive on NAND.
        self.command(["pull", source, str(destination)], timeout=90)


def identity(adb, mac, co2):
    if (adb.read("id -u") != "0" or
            adb.read("cat /sys/class/net/wlan0/address") != mac or
            adb.read("cat /data/etc/os-release") != "CLEARGRASS_VERSION=4.1.8_0287" or
            adb.read("uname -m") != "armv7l"):
        raise ValueError("Root, physical WLAN, firmware or CPU differs from the selected target")
    # Only this scalar leaves the device, not the credential-bearing INI.
    if adb.read(CO2_READ) != str(co2):
        raise ValueError("Stock CO2 type differs from the selected S8/SCD40 profile")
    boot = adb.read("cat /proc/sys/kernel/random/boot_id")
    if not re.fullmatch(r"[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}", boot):
        raise ValueError("Device boot identity is unavailable")
    return boot


def inventory(adb):
    result = {}
    for path, (expected_hash, expected_size) in FILES.items():
        # These paths are module constants. Reject symlinks and require the
        # exact file size before SYNC, then hash again after the complete copy.
        observed = adb.read("test ! -L " + path + "\ntest -f " + path +
                            "\nstat -c '%s %h' " + path + "\nsha256sum " + path).splitlines()
        if (len(observed) != 2 or observed[0] != f"{expected_size} 1" or
                observed[1].split() != [expected_hash, path]):
            raise ValueError("Recovery file differs from the exact reviewed stock source")
        result[path] = {"sha256": expected_hash, "size": expected_size}
    return result


def capture(adb, mac, co2, output_path):
    expected_target(mac, co2)
    transport = adb.usb()
    boot = identity(adb, mac, co2)
    # This is an INITIAL-install capture, never an upgrade or cleanup command.
    # Existing private installs must use their separate exact release flow.
    adb.read("test ! -e /data/.esphome-cgs1\ntest ! -L /data/.esphome-cgs1")
    before = inventory(adb)
    output = pm.private_output(output_path)
    for source, spec in before.items():
        destination = output / source.lstrip("/")
        destination.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        # Precreate the private leaf so even an old client cannot leave an
        # executable/world-readable vendor binary in the developer checkout.
        fd = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        os.close(fd)
        adb.pull(source, destination)
        metadata = destination.lstat()
        if (not stat.S_ISREG(metadata.st_mode) or metadata.st_nlink != 1 or
                metadata.st_size != spec["size"]):
            raise ValueError("ADB copy is not the expected regular recovery file")
        destination.chmod(0o600)
        if hashlib.sha256(patches.read_regular(destination, 8 * 1024 * 1024)).hexdigest() != spec["sha256"]:
            raise ValueError("ADB copy digest differs; private partial capture retained")
    if (inventory(adb) != before or identity(adb, mac, co2) != boot or adb.usb() != transport):
        raise ValueError("USB target, boot or recovery files changed during capture")
    report = {"schema_version": 1, "stage": "read_only_capture_complete",
              "hardware_contacted": True, "device_writes": 0, "installation_ready": False,
              "installed": False, "usb_serial": adb.serial, "usb_transport": transport,
              "wlan_mac": mac, "co2_type": co2, "boot_id": boot,
              "stock_version": "4.1.8_0287", "files": before,
              "limitations": ["Fixed recovery/build file set, not a full NAND or user-data backup",
                              "No installation, activation, stock fallback or boot test performed"]}
    fd = os.open(output / "result.json", os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w") as stream:
        json.dump(report, stream, indent=2)
        stream.write("\n")
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--adb", type=Path, default=Path("adb"))
    parser.add_argument("--serial", required=True)
    parser.add_argument("--expected-wlan-mac", required=True)
    parser.add_argument("--co2-type", type=int, choices=(2, 3), required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    report = capture(Adb(args.adb, args.serial), args.expected_wlan_mac, args.co2_type, args.output)
    # Identities, file paths and private vendor bytes remain in the 0700 output.
    print(json.dumps({key: report[key] for key in
                      ("stage", "device_writes", "installation_ready", "installed")}))


if __name__ == "__main__":
    main()
