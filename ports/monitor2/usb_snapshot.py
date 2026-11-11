#!/usr/bin/env python3
"""Read a small CGS2 hardware inventory over an already authorized USB ADB link."""
import argparse
import json
import os
import re
import selectors
import subprocess
import time
import uuid


# Bus aliases and addresses come from the published CGS2 tree. Read Linux
# device names and driver links only. An absent binding remains an observation.
SENSORS = {
    "co2": "1-0062", "voc": "1-0059", "temperature_humidity": "1-0044",
    "light": "1-0045", "pressure": "1-0077", "pm": "3-0012", "touch": "2-0038",
}
MAX_REPLY = 8192
COMMAND_TIMEOUT = 15
BOOT_ID = re.compile(r"[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}")
KERNEL_RELEASE = re.compile(r"[A-Za-z0-9._+\-]{1,128}")
DRIVER_NAME = re.compile(r"[A-Za-z0-9_.+\-]{1,64}")
STOCK_RELEASE = re.compile(r"[0-9]{1,3}(?:\.[0-9]{1,3}){2}_[0-9]{1,8}")
SHA256 = re.compile(r"[0-9a-f]{64}")
SAMPLE_RELEASE = "4.5.6_0156"
SAMPLE_APP = "268ff9f101f4956c1016bf0e28ab2ca8c71f6b7d1521286cb169312add8421ec"
SAMPLE_LIMIT = 256
# The analyzed stock application reads these exact attributes. The probe
# never opens the neighboring reinit/recalibration or PM control attributes.
SAMPLE_PATHS = {
    "co2": "1-0062/co2_scd40_read",
    "temperature_humidity": "1-0044/temperature_shtv4_read",
    "pm": "3-0012/pm_9500_read",
}
SAMPLE_KEYS = {
    "co2": {"co2_ppm", "temperature", "humidity"},
    "temperature_humidity": {"temperature", "humidity"},
    "pm": {"pm1", "pm25", "pm10"},
}


class SnapshotError(Exception):
    """A fixed failure message suitable for the inventory CLI."""


def adb_read(arguments):
    """Bound replies and elapsed time even if the USB peer sends excess data."""
    deadline = time.monotonic() + COMMAND_TIMEOUT
    with subprocess.Popen(arguments, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                          stderr=subprocess.DEVNULL) as child:
        try:
            result = bytearray()
            with selectors.DefaultSelector() as events:
                events.register(child.stdout, selectors.EVENT_READ)
                while True:
                    remaining = deadline - time.monotonic()
                    if remaining <= 0 or not events.select(remaining):
                        raise SnapshotError("ADB inventory read timed out")
                    chunk = os.read(child.stdout.fileno(), MAX_REPLY + 1 - len(result))
                    if not chunk:
                        break
                    result.extend(chunk)
                    if len(result) > MAX_REPLY:
                        raise SnapshotError("ADB inventory reply exceeds the size limit")
            remaining = max(0.01, deadline - time.monotonic())
            if child.wait(timeout=remaining):
                raise SnapshotError("ADB inventory read failed")
            return bytes(result)
        finally:
            # This is the local adb client process only. The read never sends
            # signals, writes or service commands to the monitor.
            if child.poll() is None:
                child.kill()


def usb_path(run, base):
    if run([*base, "get-state"]).strip() != b"device":
        raise SnapshotError("Select an authorized USB device")
    path = run([*base, "get-devpath"]).strip()
    if not re.fullmatch(rb"usb:[A-Za-z0-9._:\-]+", path):
        raise SnapshotError("The selected ADB transport is not USB")
    return path


def shell_probe(marker, *, samples=False):
    # The original OTA script installs these two files at fixed paths. Read
    # only the version assignment, and fingerprint the app on disk without
    # copying it or asking the stock app to execute anything.
    script = ["set -e", "cat /proc/sys/kernel/random/boot_id",
              "tr '\\000' ' ' < /proc/device-tree/compatible; printf '\\n'",
              "uname -r", "uname -m",
              "app=/qingping/bin/QingSnow2App",
              "signature=$(stat -Lc '%s:%d:%i:%Y:%Z' \"$app\" 2>/dev/null) || signature=",
              "od -An -v -tx1 -N20 \"$app\" | tr -d ' \\n'; printf '\\n'",
              "version=-",
              "if test -r /qingping/etc/os-release; then "
              "version=$(head -c 256 /qingping/etc/os-release | sed -n 's/^CLEARGRASS_VERSION=//p'); fi",
              "printf '%s\\n' \"${version:--}\"",
              # Avoid hashing large or non-regular files. Old systems may
              # lack an applet. Keep that observation separate from the ABI.
              "size=${signature%%:*}",
              "fingerprint=-",
              "if test -n \"$size\" && test -f \"$app\" && "
              "test \"$size\" -gt 0 && test \"$size\" -le 16777216 && "
              "digest=$(sha256sum < \"$app\" 2>/dev/null); then "
              "test \"$signature\" = \"$(stat -Lc '%s:%d:%i:%Y:%Z' \"$app\")\"; "
              "fingerprint=${digest%% *}; fi",
              "printf '%s\\n' \"$fingerprint\""]
    for address in SENSORS.values():
        path = f"/sys/bus/i2c/devices/{address}"
        script.extend([
            f"if test -r {path}/name; then cat {path}/name; else printf '%s\\n' -; fi",
            f"if test -L {path}/driver; then basename \"$(readlink {path}/driver)\"; else printf '%s\\n' -; fi",
        ])
    if samples:
        # Read at most once per sensor and only for the exact stock app and
        # version verified above. Sysfs reads may initiate a measurement, so
        # they are opt-in and do not run during the ordinary inventory.
        script.append(f'if test "$version" = {SAMPLE_RELEASE} && test "$fingerprint" = {SAMPLE_APP}; then')
        for relative in SAMPLE_PATHS.values():
            file = f"/sys/bus/i2c/devices/{relative}"
            script.append(f"if test -r {file}; then head -c {SAMPLE_LIMIT + 1} {file} | tr '\\r\\n' '  '; "
                          "printf '\\n'; else printf '%s\\n' -; fi")
        script.extend(["else", "printf '%s\\n' - - -", "fi"])
    script.extend(["cat /proc/sys/kernel/random/boot_id", f"printf '%s\\n' {marker}"])
    return "\n".join(script)


def stock_sample(sensor, line):
    """Return finite raw numeric fields and never the PM serial or source text."""
    if line.strip() == "-":
        return {"state": "unavailable"}
    if not 0 < len(line) <= SAMPLE_LIMIT:
        return {"state": "unrecognized"}
    fields = {}
    serial_seen = False
    for field in line.split(","):
        key, delimiter, value = field.strip().partition("=")
        if sensor == "pm" and key == "sn" and delimiter and not serial_seen:
            # Presence is enough. The stock PM record can include a unique
            # sensor serial. It must never enter the structured USB report.
            serial_seen = True
            continue
        if not delimiter or key not in SAMPLE_KEYS[sensor] or key in fields:
            return {"state": "unrecognized"}
        value = value.strip()
        if not re.fullmatch(r"-?[0-9]{1,6}(?:\.[0-9]{1,3})?", value):
            return {"state": "unrecognized"}
        fields[key] = float(value) if "." in value else int(value)
    if set(fields) != SAMPLE_KEYS[sensor]:
        return {"state": "unrecognized"}
    return {"state": "observed", "raw": fields}


def parse_reply(data, marker, *, samples=False):
    fields = data.decode("ascii").splitlines()
    sample_count = len(SAMPLE_PATHS) if samples else 0
    if len(fields) != 9 + 2 * len(SENSORS) + sample_count or fields[-1] != marker:
        raise SnapshotError("CGS2 inventory did not finish")
    boot, compatible, release, machine, elf, stock, digest = fields[:7]
    if not BOOT_ID.fullmatch(boot) or boot != fields[-2]:
        raise SnapshotError("The monitor rebooted during the read")
    if "rockchip,px30" not in compatible.split():
        raise SnapshotError("The selected monitor lacks the observed CGS2 PX30 signature")
    if not KERNEL_RELEASE.fullmatch(release) or machine not in {"aarch64", "armv7l", "armv8l"}:
        raise SnapshotError("Unknown kernel architecture")
    header = bytes.fromhex(elf)
    if len(header) != 20 or header[:4] != b"\x7fELF" or header[5:7] != b"\x01\x01":
        raise SnapshotError("Unknown stock application ELF header")
    elf_kind = {(1, 40): "arm32", (2, 183): "aarch64"}.get((header[4], int.from_bytes(header[18:20], "little")))
    if elf_kind is None:
        raise SnapshotError("Unknown stock application ABI")
    if stock != "-" and not STOCK_RELEASE.fullmatch(stock):
        raise SnapshotError("Unexpected stock version format")
    if digest != "-" and not SHA256.fullmatch(digest):
        raise SnapshotError("Unexpected stock application fingerprint")
    sensors = {}
    for index, (sensor, address) in enumerate(SENSORS.items()):
        name, driver = fields[7 + 2 * index:9 + 2 * index]
        if not all(value == "-" or DRIVER_NAME.fullmatch(value) for value in (name, driver)):
            raise SnapshotError("Unexpected I2C driver metadata")
        sensors[sensor] = {"address": address, "device": None if name == "-" else name,
                           "driver": None if driver == "-" else driver}
    # Boot ID, ADB serial and transport address are used for the read itself
    # and intentionally excluded from the resulting hardware inventory.
    result = {"soc": "rockchip,px30", "kernel_release": release, "kernel_machine": machine,
              "stock_app_elf": elf_kind, "stock_release": None if stock == "-" else stock,
              "stock_app_sha256": None if digest == "-" else digest, "i2c": sensors}
    if samples:
        if stock != SAMPLE_RELEASE or digest != SAMPLE_APP or elf_kind != "aarch64":
            raise SnapshotError("Sensor samples require the exact analyzed stock CGS2 application")
        result["stock_samples"] = {
            name: stock_sample(name, line) for name, line in zip(SAMPLE_PATHS, fields[-2 - sample_count:-2])
        }
    return result


def inventory(serial, run=adb_read, *, samples=False):
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,127}", serial):
        raise SnapshotError("Specify one explicit USB ADB serial")
    base = ["adb", "-s", serial]
    path = usb_path(run, base)
    marker = "CGS2_SNAPSHOT_DONE_" + uuid.uuid4().hex
    result = parse_reply(run([*base, "shell", "-T", shell_probe(marker, samples=samples)]), marker, samples=samples)
    if usb_path(run, base) != path:
        raise SnapshotError("The USB transport changed during the read")
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--serial", required=True, help="Explicit serial from adb devices -l")
    parser.add_argument("--samples", action="store_true", help="Read one stock sample per sensor on the verified 4.5.6 build")
    args = parser.parse_args()
    try:
        print(json.dumps(inventory(args.serial, samples=args.samples), indent=2))
    except SnapshotError as error:
        parser.exit(1, f"{error}\n")
    except (OSError, subprocess.TimeoutExpired, ValueError):
        # Avoid leaking malformed peer output or a host pathname via errors.
        parser.exit(1, "The CGS2 USB inventory could not be read\n")


if __name__ == "__main__":
    main()
