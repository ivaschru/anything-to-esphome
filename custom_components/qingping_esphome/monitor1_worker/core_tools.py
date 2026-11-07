"""Pinned native tools in HA storage, with a creator-owned USB server.

APK fetch/verify/extract runs as a child, never apk add or package scripts.
The Core process's interpreter, libraries, environment and package database
stay untouched. Public package filenames and hashes were measured in the
official Core image on both native architectures; changed repositories fail
closed instead of selecting a newer dependency set. No binaries are bundled
or redistributed by HACS. Existing app data is never opened or migrated.
"""
import hashlib
import json
import os
from pathlib import Path
import platform
import shlex
import shutil
import socket
import stat
import subprocess
import tempfile
import time

from preparation import PreparationError, private_directory, read_private, write_new
from server import UsbReads, Refusal

HERE = Path(__file__).resolve().parent
MANIFEST = (HERE / "core-tools.json").read_bytes()
TOOLSET = hashlib.sha256(MANIFEST).hexdigest()


def invoke(arguments, env, *, timeout=120, deadline=None):
    # Output can include private host paths. Keep it off both protocol/stdout
    # and HA logs; the caller receives one finite failure category only.
    if deadline is not None:
        timeout = min(timeout, deadline-time.monotonic())
        if timeout <= 0:
            raise Refusal("usb_core_tools_failed")
    result = subprocess.run(arguments, env=env, stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=timeout, check=False)
    if result.returncode:
        raise Refusal("usb_core_tools_failed")


def prefix_environment(prefix, home):
    libraries = {prefix / "lib", prefix / "usr/lib"}
    perl = {prefix / p for p in ("usr/lib/perl5/core_perl", "usr/share/perl5/core_perl",
                                "usr/lib/perl5/vendor_perl", "usr/share/perl5/vendor_perl")}
    for path in prefix.glob("usr/lib/perl5/**/libperl.so*"):
        if path.resolve().is_relative_to(prefix):
            libraries.add(path.parent)
    for name in ("Config.pm", "strict.pm"):
        for path in prefix.glob("usr/**/" + name):
            if path.resolve().is_relative_to(prefix):
                perl.add(path.parent)
    if len(libraries) > 16 or len(perl) > 16:
        raise Refusal("usb_core_tools_failed")
    return {"PATH": "/usr/local/bin:/usr/bin:/bin", "HOME": str(home),
            "LD_LIBRARY_PATH": os.pathsep.join(map(str, sorted(libraries))),
            "PERL5LIB": os.pathsep.join(map(str, sorted(perl))),
            "ANDROID_USER_HOME": str(home), "ADB_MDNS_AUTO_CONNECT": "0"}


def tool_wrapper(executable, env):
    # All values are internally constructed private paths; quote anyway so
    # a legitimate HA config directory with spaces never becomes shell code.
    values = "\n".join("export " + key + "=" + shlex.quote(env[key]) for key in
                       ("LD_LIBRARY_PATH", "PERL5LIB"))
    return ("#!/bin/sh\nset -eu\n" + values + "\nexec " + shlex.quote(str(executable)) + ' "$@"\n').encode()


class CoreTools:
    def __init__(self, root):
        self.root = private_directory(root)
        self.directory = root / "toolsets" / TOOLSET
        self.child, self.port = None, None
        self.usb_reader = None

    def admitted(self):
        """A partial download/extract is never a ready toolset."""
        private_directory(self.root / "toolsets")
        private_directory(self.directory)
        expected = {"schema_version": 1, "manifest_sha256": TOOLSET,
                    "machine": platform.machine()}
        marker = json.loads(read_private(self.directory / "complete.json"))
        if marker != expected:
            raise Refusal("usb_core_tools_failed")
        private_directory(self.directory / "bin")
        env = prefix_environment(self.directory / "prefix", self.root / "adb")
        for name in ("adb", "perl", "make"):
            wrapper = self.directory / "bin" / name
            info = wrapper.lstat()
            body = tool_wrapper(self.directory / "prefix/usr/bin" / name, env)
            if (not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_uid != os.getuid()
                    or stat.S_IMODE(info.st_mode) != 0o700 or wrapper.resolve() != wrapper
                    or wrapper.read_bytes() != body):
                raise Refusal("usb_core_tools_failed")
        return self.directory

    def prepare(self):
        if platform.system() != "Linux":
            raise Refusal("usb_core_unsupported")
        release = platform.freedesktop_os_release()
        manifest = json.loads(MANIFEST)
        machine = platform.machine()
        if (release.get("ID") != "alpine" or not release.get("VERSION_ID", "").startswith(manifest["alpine"] + ".")
                or machine not in manifest["architectures"]):
            raise Refusal("usb_core_unsupported")
        if self.directory.exists() or self.directory.is_symlink():
            self.admitted()
            return {"state": "tools_ready", "hardware_contacted": False}
        apk = shutil.which("apk", path="/sbin:/usr/sbin:/usr/bin:/usr/local/bin")
        if apk is None or shutil.disk_usage(self.root).free < 6 * 1024**3:
            raise Refusal("usb_core_tools_failed")
        deadline = time.monotonic() + 600
        def execute(arguments, env, **options):
            return invoke(arguments, env, deadline=deadline, **options)
        parent = private_directory(self.root / "toolsets")
        pins = manifest["architectures"][machine]
        env = {"PATH": "/usr/local/bin:/usr/bin:/bin", "HOME": str(self.root / "adb")}
        with tempfile.TemporaryDirectory(prefix=".prepare-", dir=parent) as scratch:
            scratch = Path(scratch)
            packages, staged = scratch / "packages", scratch / "staged"
            packages.mkdir(mode=0o700)
            staged.mkdir(mode=0o700)
            prefix = staged / "prefix"
            prefix.mkdir(mode=0o700)
            repositories = scratch / "repositories"
            repositories.write_text("\n".join("https://dl-cdn.alpinelinux.org/alpine/v3.24/" + part
                                              for part in ("main", "community")) + "\n")
            # One fixed official upstream, exact primary versions and the
            # entire measured dependency closure. No caller URL or selection.
            execute([apk, "--no-cache", "--repositories-file", str(repositories), "fetch", "--recursive",
                    "--pkgname-spec", "${name}-${version}.apk", "--output", str(packages),
                    *pins["requested"]], env, timeout=300)
            actual = sorted(packages.iterdir())
            if (len(actual) != len(pins["packages"]) or
                    sum(p.stat().st_size for p in actual) > 256 * 1024**2):
                raise Refusal("usb_core_tools_failed")
            expected = {p["name"]: p["sha256"] for p in pins["packages"]}
            if {p.name for p in actual} != set(expected):
                raise Refusal("usb_core_tools_failed")
            for package in actual:
                info = package.lstat()
                if (not stat.S_ISREG(info.st_mode) or info.st_size > 64 * 1024**2 or
                        hashlib.sha256(package.read_bytes()).hexdigest() != expected[package.name]):
                    raise Refusal("usb_core_tools_failed")
                execute([apk, "--no-network", "verify", str(package)], env)
            for package in actual:
                execute([apk, "--no-network", "extract", "--no-chown", "--destination", str(prefix), str(package)], env)
            # Check relocated tools before atomically publishing the prefix.
            native_env = prefix_environment(prefix, self.root / "adb")
            execute([str(prefix / "usr/bin/adb"), "version"], native_env)
            execute([str(prefix / "usr/bin/perl"), "-MCwd", "-MFile::Spec", "-MDigest::SHA", "-e", "exit 0"], native_env)
            makefile = scratch / "probe.mk"
            makefile.write_text("all:\n\t@true\n")
            execute([str(prefix / "usr/bin/make"), "-f", str(makefile)], native_env)
            (staged / "bin").mkdir(mode=0o700)
            # Wrappers contain final paths, never their temporary staging path.
            final_env = prefix_environment(prefix, self.root / "adb")
            for key in ("LD_LIBRARY_PATH", "PERL5LIB"):
                final_env[key] = final_env[key].replace(str(staged), str(self.directory))
            for name in ("adb", "perl", "make"):
                path = staged / "bin" / name
                write_new(path, tool_wrapper(self.directory / "prefix/usr/bin" / name, final_env))
                path.chmod(0o700)
            write_new(staged / "complete.json", json.dumps({"schema_version": 1,
                "manifest_sha256": TOOLSET, "machine": machine}).encode())
            os.rename(staged, self.directory)  # Actor's exclusive kernel lock prevents a second publisher.
        self.admitted()
        return {"state": "tools_ready", "hardware_contacted": False}

    def bind_job(self, summary):
        """Bind each new profile to its immutable prefix before build admission.

        A crash after profile creation leaves an unbound job, readable but
        never automatically rebound/rekeyed. Historical jobs retain their own
        prefix, independent of future integration/toolset upgrades.
        """
        self.admitted()
        directory = private_directory(self.root / "jobs" / summary["job_id"])
        profile = hashlib.sha256(read_private(directory / "profile.json")).hexdigest()
        write_new(directory / "core-context.json", json.dumps({"schema_version": 1,
            "job_id": summary["job_id"], "profile_sha256": profile, "toolset_sha256": TOOLSET}).encode())
        return summary

    def usb(self):
        # Constructing/opening the page never starts ADB or touches USB.
        self.usb_reader = UsbReads(executable=str(self.directory / "bin/adb"),
                                   capture_root=self.root / "adb", environment={})
        return self.usb_reader

    def owns_listener(self):
        """Confirm the live creator child owns the exact loopback listener.

        The ephemeral port allocation has a small bind race. Never infer
        ownership from a successful TCP connection or adb reply: join the
        actual child's socket fd inode to procfs before giving clients access.
        """
        if self.child is None or self.child.poll() is not None:
            return False
        inodes = set()
        for fd in (Path("/proc") / str(self.child.pid) / "fd").iterdir():
            try:
                value = os.readlink(fd)
            except FileNotFoundError:
                continue
            if value.startswith("socket:["):
                inodes.add(value[8:-1])
        address = f"0100007F:{self.port:04X}"
        lines = Path("/proc/net/tcp").read_text().splitlines()[1:]
        return any(len(parts := line.split()) >= 10 and parts[1] == address
                   and parts[3] == "0A" and parts[9] in inodes for line in lines)

    def start_usb(self):
        self.admitted()
        if self.child is None:
            with socket.socket() as reservation:
                reservation.bind(("127.0.0.1", 0))
                self.port = reservation.getsockname()[1]
            env = prefix_environment(self.directory / "prefix", self.root / "adb")
            self.child = subprocess.Popen([str(self.directory / "prefix/usr/bin/adb"),
                "-L", f"tcp:127.0.0.1:{self.port}", "server", "nodaemon"], env=env,
                stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            deadline = time.monotonic() + 10
            while time.monotonic() < deadline and self.child.poll() is None:
                if self.owns_listener():
                    break
                time.sleep(0.05)
        if not self.owns_listener():
            raise Refusal("usb_operation_failed")
        # AOSP treats explicit 127.0.0.1 as a remote server specification:
        # unlike localhost it refuses autospawn if the creator's server dies.
        # No -a, shared5037, LAN ADB or persisted PID/socket adoption exists.
        os.environ["QINGPING_MONITOR1_ADB_PORT"] = str(self.port)
        self.usb_reader.environment = {"PATH": "/usr/local/bin:/usr/bin:/bin",
            "HOME": str(self.root / "adb"), "ANDROID_USER_HOME": str(self.root / "adb"),
            "ADB_MDNS_AUTO_CONNECT": "0", "ADB_SERVER_SOCKET": f"tcp:127.0.0.1:{self.port}"}

    def close(self):
        # Only this actual unreaped Popen child is signalled. No kill-server
        # command can accidentally retire another integration's ADB daemon.
        if self.child is not None:
            if self.child.poll() is None:
                self.child.terminate()
                try:
                    self.child.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    self.child.kill()
                    self.child.wait(timeout=5)
