"""One private source build, never a USB writer or a general command runner.

The HTTP process consumes a durable build intent before spawning this worker.
The worker owns the global flock and each subprocess group it creates. A lost
response, page reload or app restart can read status, never restart the build.
This worker never exports its private inputs/logs/programs. Separate explicit
owner downloads can export recovery files or a bounded computer installer.
"""
import fcntl
import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import stat
import subprocess
import sys
import time

from preparation import (PreparationError, USER, job_status, owned_intent,
                         private_directory, read_private, unique_json, write_new)

# Reviewed public builder, including the bounded initial guardian. This is an
# immutable commit, not main/HEAD from a download or a browser-supplied source.
SOURCE_COMMIT = "e09440f9fa36da2aaad16212734879bb6304f6d2"
SOURCE_URL = "https://github.com/ivaschru/qingping-esphome.git"
MIN_FREE = 6 * 1024**3
STOP_FREE = 512 * 1024**2
BUILD_SECONDS = 7200
PHASES = {"source", "sdk", "compile", "complete", "failed", "unverified"}


def sync_directory(path):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def private_hash(path, maximum=16 * 1024**2):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(fd, "rb") as stream:
        info = os.fstat(stream.fileno())
        if (not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_uid != os.getuid() or
                stat.S_IMODE(info.st_mode) != 0o600 or not 0 < info.st_size <= maximum):
            raise PreparationError("usb_build_unverified")
        digest = hashlib.sha256()
        for chunk in iter(lambda: stream.read(65536), b""):
            digest.update(chunk)
        return {"size": info.st_size, "sha256": digest.hexdigest()}


def checked_inputs(parent, job_id, owner, contract):
    if job_status(parent, job_id, owner)["stage"] != "profile_prepared":
        raise PreparationError("usb_preparation_unverified")
    directory, _, _ = owned_intent(parent, job_id, owner)
    job = unique_json(read_private(directory / "job.json"))
    private_directory(directory / "capture")
    # Recheck all original bodies, not just the library that the linker uses.
    # Fixed contract paths are never taken from HTTP or uploaded result.json.
    for item in contract["files"]:
        relative = Path(item["path"].lstrip("/"))
        parent_path = directory / "capture"
        for component in relative.parts[:-1]:
            parent_path = private_directory(parent_path / component)
        if private_hash(directory / "capture" / relative) != {"size": item["size"], "sha256": item["sha256"]}:
            raise PreparationError("usb_build_unverified")
    return directory, job


def frame(job_id, state, phase):
    return {"job_id": job_id, "state": state, "phase": phase,
            "hardware_contacted": False, "installed": False, "installation_ready": False}


class Builds:
    def __init__(self, parent, contract):
        self.parent, self.contract = Path(parent), contract
        self.children = {}

    def start(self, owner, job_id):
        directory, job = checked_inputs(self.parent, job_id, owner, self.contract)
        if "build-intent.json" in os.listdir(directory):
            raise PreparationError("usb_build_consumed")
        # A worker/controller crash can outlive its HTTP process and release
        # a flock before every compiler descendant is gone. Incomplete durable
        # history therefore also blocks new jobs, even after an app restart.
        # Only a terminal, verified receipt permits reuse of the global slot.
        for other in private_directory(self.parent).iterdir():
            private_directory(other)
            if "build-intent.json" not in os.listdir(other):
                continue
            try:
                prior = unique_json(read_private(other / "intent.json"))
                state = self.status(prior["owner"], other.name)["state"]
            except Exception:
                raise PreparationError("usb_build_unverified") from None
            if state not in ("built_not_installed", "build_failed"):
                raise PreparationError("usb_build_busy")
        if shutil.disk_usage(self.parent).free < MIN_FREE:
            raise PreparationError("usb_build_space")
        lock_path = self.parent.parent / "build.lock"
        fd = os.open(lock_path, os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
        try:
            info = os.fstat(fd)
            if (not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_nlink != 1 or
                    stat.S_IMODE(info.st_mode) != 0o600):
                raise PreparationError("usb_build_unverified")
            try:
                fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                raise PreparationError("usb_build_busy") from None
            intent = {"schema_version": 1, "job_id": job_id, "owner": owner,
                      "source_commit": SOURCE_COMMIT, "profile_sha256": job["profile_sha256"]}
            # O_EXCL and fsync precede Popen. A fork/exec failure still consumes
            # the request; status never treats missing completion as a retry.
            write_new(directory / "build-intent.json", (json.dumps(intent) + "\n").encode())
            sync_directory(directory)
            command = [sys.executable, str(Path(__file__).resolve()), "--job", job_id, "--lock-fd", str(fd)]
            child = subprocess.Popen(command, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL, start_new_session=True, pass_fds=(fd,),
                env={"PATH": "/usr/local/bin:/usr/bin:/bin", "HOME": "/data/build-home",
                     "PYTHONUNBUFFERED": "1"})
            self.children[job_id] = child
            return frame(job_id, "building", "source")
        finally:
            os.close(fd)  # The successful child retains this same flock.

    def status(self, owner, job_id):
        job_status(self.parent, job_id, owner)  # Profile completion/hash stays current.
        directory, _, _ = owned_intent(self.parent, job_id, owner)
        names = os.listdir(directory)
        if "build-intent.json" not in names:
            return frame(job_id, "not_started", "unverified")
        intent = unique_json(read_private(directory / "build-intent.json"))
        if (intent != {"schema_version": 1, "job_id": job_id, "owner": owner, "source_commit": SOURCE_COMMIT,
                       "profile_sha256": unique_json(read_private(directory / "job.json"))["profile_sha256"]}):
            raise PreparationError("usb_build_unverified")
        if "build-complete.json" in names:
            result = unique_json(read_private(directory / "build-complete.json"))
            if (set(result) != {"intent_sha256", "state", "artifacts"} or
                    result["intent_sha256"] != hashlib.sha256(read_private(directory / "build-intent.json")).hexdigest()):
                raise PreparationError("usb_build_unverified")
            if result["state"] == "built_not_installed":
                expected = {"native-program", "guardian-program", "bridge-program", "initial-trial-guardian-program"}
                if set(result["artifacts"]) != expected:
                    raise PreparationError("usb_build_unverified")
                for name, pin in result["artifacts"].items():
                    if private_hash(directory / "candidate" / name) != pin:
                        raise PreparationError("usb_build_unverified")
                return frame(job_id, "built_not_installed", "complete")
            if result["state"] == "build_failed" and result["artifacts"] == {}:
                return frame(job_id, "build_failed", "failed")
            raise PreparationError("usb_build_unverified")
        child = self.children.get(job_id)
        if child is None or child.poll() is not None:
            # No adoption from a serialized PID after restart. A still-running
            # old worker may finish its own job; reads can observe that later.
            return frame(job_id, "build_unverified", "unverified")
        phase = "source"
        if "build-phase.json" in names:
            phase = unique_json(read_private(directory / "build-phase.json")).get("phase")
            if phase not in PHASES:
                raise PreparationError("usb_build_unverified")
        return frame(job_id, "building", phase)


def environment(home):
    # Neither Supervisor credentials nor HTTP/ADB session data reach Git/pip
    # or compiler children. No user URL, executable or shell text is accepted.
    return {"PATH": "/usr/local/bin:/usr/bin:/bin", "HOME": str(home),
            "XDG_CACHE_HOME": str(home / ".cache"),
            "PIP_DISABLE_PIP_VERSION_CHECK": "1", "PIP_NO_INPUT": "1",
            "CMAKE_BUILD_PARALLEL_LEVEL": "1", "ESPHOME_DEFAULT_COMPILE_PROCESS_LIMIT": "1",
            "GIT_TERMINAL_PROMPT": "0"}


def run_owned(command, cwd, env, log, deadline):
    """Bound one creator-owned process group, including its compiler children."""
    child = subprocess.Popen(command, cwd=cwd, env=env, stdin=subprocess.DEVNULL,
                             stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
    try:
        # Keep the leader unreaped until group retirement. Its reserved PID
        # cannot be reused as an unrelated process-group ID between observation
        # and killpg. This worker runs only on the companion's Linux host.
        while os.waitid(os.P_PID, child.pid, os.WEXITED | os.WNOHANG | os.WNOWAIT) is None:
            if time.monotonic() >= deadline or shutil.disk_usage(cwd).free < STOP_FREE:
                raise PreparationError("usb_build_unverified")
            time.sleep(0.5)
        status = os.waitid(os.P_PID, child.pid, os.WEXITED | os.WNOHANG | os.WNOWAIT)
        if status.si_code != os.CLD_EXITED or status.si_status != 0:
            raise PreparationError("usb_build_unverified")
    finally:
        # Group ID is from this actual Popen, never a disk/HTTP/PID claim.
        # Retire descendants even if the controller exited leaving a compiler.
        try:
            os.killpg(child.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        child.wait()


def build_report(path):
    # The canonical report includes the full public source hash closure and
    # is larger than ordinary job metadata. Keep a separate bounded read.
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(fd, "rb") as stream:
        info = os.fstat(stream.fileno())
        if (not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_uid != os.getuid() or
                stat.S_IMODE(info.st_mode) != 0o600 or not 0 < info.st_size <= 512 * 1024):
            raise PreparationError("usb_build_unverified")
        raw = stream.read(512 * 1024 + 1)
        if len(raw) != info.st_size:
            raise PreparationError("usb_build_unverified")
        return unique_json(raw)


def build(directory, contract, runner=run_owned):
    directory = private_directory(Path(directory))
    intent_raw = read_private(directory / "build-intent.json")
    intent = unique_json(intent_raw)
    checked_inputs(directory.parent, directory.name, intent["owner"], contract)
    if intent["source_commit"] != SOURCE_COMMIT or intent["job_id"] != directory.name:
        raise PreparationError("usb_build_unverified")
    profile_hash = private_hash(directory / "profile.json")["sha256"]
    if profile_hash != intent["profile_sha256"]:
        raise PreparationError("usb_build_unverified")
    home = directory / "build-home"
    home.mkdir(mode=0o700)
    (home / ".cache").mkdir(mode=0o700)
    env, deadline = environment(home), time.monotonic() + BUILD_SECONDS
    result = {"intent_sha256": hashlib.sha256(intent_raw).hexdigest(), "state": "build_failed", "artifacts": {}}

    def phase(value):
        temporary = directory / "build-phase.next"
        write_new(temporary, (json.dumps({"phase": value}) + "\n").encode())
        os.replace(temporary, directory / "build-phase.json")
        sync_directory(directory)

    try:
        with (directory / "worker.log").open("xb") as log:
            phase("source")
            source = directory / "source"
            source.mkdir(mode=0o700)
            commands = [["git", "init", "--quiet", str(source)],
                        ["git", "-C", str(source), "fetch", "--quiet", "--depth=1", SOURCE_URL, SOURCE_COMMIT],
                        ["git", "-C", str(source), "checkout", "--quiet", "--detach", SOURCE_COMMIT]]
            for command in commands:
                runner(command, directory, env, log, deadline)
            here = source / "ports/monitor1"
            # Outer SDK is installed from this same pinned source. The
            # canonical controller creates its own fresh inner SDK as usual.
            phase("sdk")
            runner([sys.executable, "-m", "venv", str(here / ".venv")], source, env, log, deadline)
            python = here / ".venv/bin/python"
            runner([str(python), "-m", "pip", "install", "--no-input", "--disable-pip-version-check",
                    "-q", "-r", str(here / "requirements.txt")], source, env, log, deadline)
            (here / "build").mkdir(mode=0o700, exist_ok=True)
            phase("compile")
            runner([str(python), str(here / "build_candidate.py"), "--source-ref", SOURCE_COMMIT,
                    "--profile", str(directory / "profile.json"), "--qt-core",
                    str(directory / "capture/usr/lib/libQt5Core.so.5.9.4"),
                    "--output", str(directory / "candidate")], source, env, log, deadline)
            report = build_report(directory / "candidate/result.json")
            if (report.get("complete_build") is not True or report.get("installed") is not False or
                    report.get("installation_ready") is not False or report.get("hardware_contacted") is not False or
                    report.get("source_commit") != SOURCE_COMMIT or report.get("profile_sha256") != profile_hash):
                raise PreparationError("usb_build_unverified")
            pins = {**report["artifacts"], "initial-trial-guardian-program": report["initial_trial_guardian"]}
            if set(pins) != {"native-program", "guardian-program", "bridge-program", "initial-trial-guardian-program"}:
                raise PreparationError("usb_build_unverified")
            for name, pin in pins.items():
                if private_hash(directory / "candidate" / name) != pin:
                    raise PreparationError("usb_build_unverified")
            result.update(state="built_not_installed", artifacts=pins)
            phase("complete")
    except Exception:
        # Raw compiler errors remain only in the private job, never HTTP/logs
        # of the app. Failure is terminal for this consumed build intent.
        pass
    finally:
        write_new(directory / "build-complete.json", (json.dumps(result) + "\n").encode())
        sync_directory(directory)


def main():
    if (len(sys.argv) != 5 or sys.argv[1] != "--job" or not USER.fullmatch(sys.argv[2]) or
            sys.argv[3] != "--lock-fd" or not sys.argv[4].isdigit()):
        raise SystemExit(2)
    os.umask(0o077)
    os.nice(10)
    # One logical CPU bounds Zig's own threads as well as make/ESPHome -j1.
    available = os.sched_getaffinity(0)
    os.sched_setaffinity(0, {min(available)})
    lock_fd = int(sys.argv[4])
    fcntl.flock(lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    with (Path(__file__).parent / "contract.json").open() as stream:
        contract = json.load(stream)
    try:
        build(Path("/data/jobs") / sys.argv[2], contract)
    finally:
        os.close(lock_fd)


if __name__ == "__main__":
    main()
