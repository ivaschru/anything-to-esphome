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

# New builds use this exact reviewed revision, independently cross-built for
# S8 and SCD40. It is never a ref/URL/source supplied by HTTP. Historical jobs
# keep their own immutable source: moving this default must not relabel their
# reports, plans, program pins, keys or consumed execution history.
SOURCE_COMMIT = "0de9c99e57192742b82616cf82c0fdad71c562c5"
# Keep this explicit rather than deriving history from the moving default:
# a later pin change must add a reviewed producer, not silently remove one.
REVIEWED_SOURCE_COMMITS = frozenset(("0de9c99e57192742b82616cf82c0fdad71c562c5",
                                     "e09440f9fa36da2aaad16212734879bb6304f6d2"))
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


def bound_build_intent(directory):
    """Verify one job's source binding, not permission to start a worker.

    Callers still establish their normal owner/ingress authority first. The
    old source is readable for existing jobs only; build() separately requires
    the current default and never adopts/restarts a historical process.
    """
    intent = unique_json(read_private(directory / "build-intent.json"))
    original = unique_json(read_private(directory / "intent.json"))
    source, owner = intent.get("source_commit"), original.get("owner")
    if (not isinstance(source, str) or source not in REVIEWED_SOURCE_COMMITS or
            not isinstance(owner, str) or not USER.fullmatch(owner) or
            type(intent.get("schema_version")) is not int or
            intent != {"schema_version": 1, "job_id": directory.name, "owner": owner,
                       "source_commit": source, "profile_sha256": private_hash(directory / "profile.json")["sha256"]}):
        raise PreparationError("usb_build_unverified")
    return intent


def frame(job_id, state, phase):
    return {"job_id": job_id, "state": state, "phase": phase,
            "hardware_contacted": False, "installed": False, "installation_ready": False}


class Builds:
    def __init__(self, parent, contract):
        self.parent, self.contract = Path(parent), contract
        self.children = {}

    def start(self, owner, job_id):
        directory, job = checked_inputs(self.parent, job_id, owner, self.contract)
        bootstrap_env = {"PATH": "/usr/local/bin:/usr/bin:/bin", "HOME": "/data/build-home",
                         "PYTHONUNBUFFERED": "1"}
        if os.environ.get("QINGPING_MONITOR1_CORE_ROOT") is not None:
            bootstrap_env = {**environment(directory / "build-home"), "PYTHONUNBUFFERED": "1"}
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
                cwd=str(directory),
                env=bootstrap_env)
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
        bound_build_intent(directory)
        if "build-complete.json" in names:
            result = unique_json(read_private(directory / "build-complete.json"))
            if (set(result) != {"intent_sha256", "state", "artifacts"} or
                    result["intent_sha256"] != hashlib.sha256(read_private(directory / "build-intent.json")).hexdigest()):
                raise PreparationError("usb_build_unverified")
            if result["state"] == "built_not_installed":
                # A valid artifact hash is not enough: do not join a report
                # from another reviewed revision to this job's old receipt.
                verified_candidate_report(directory)
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
    result = {"PATH": "/usr/local/bin:/usr/bin:/bin", "HOME": str(home),
            "XDG_CACHE_HOME": str(home / ".cache"),
            "PIP_DISABLE_PIP_VERSION_CHECK": "1", "PIP_NO_INPUT": "1",
            "CMAKE_BUILD_PARALLEL_LEVEL": "1", "ESPHOME_DEFAULT_COMPILE_PROCESS_LIMIT": "1",
            "GIT_TERMINAL_PROMPT": "0"}
    root = core_root(Path(home).parent)
    if root is not None:
        # Only the embedded Core actor sets this context for its own children;
        # no HTTP data chooses a path, executable, environment or remote host.
        # Native tools are already admitted separately by that actor. Never
        # pass the Core/Supervisor environment through to pip/build tools.
        tools = core_toolset(Path(home).parent, root)
        result.update(PATH=str(tools / "bin") + ":" + result["PATH"],
                      QINGPING_MONITOR1_CORE_ROOT=str(root),
                      ANDROID_USER_HOME=str(root / "adb"))
        port = os.environ.get("QINGPING_MONITOR1_ADB_PORT")
        if port is not None:
            if not port.isascii() or not port.isdecimal() or not 1024 <= int(port) <= 65535:
                raise PreparationError("usb_operation_failed")
            result.update(QINGPING_MONITOR1_ADB_PORT=port,
                          ADB_SERVER_SOCKET="tcp:127.0.0.1:" + port)
    return result


def core_root(directory):
    """Resolve only the actor's private root and exact job relationship.

    This is child-process configuration, never a public request parameter.
    A malformed inherited context refuses instead of falling back to /data
    or the default ADB server. Historical app/desktop processes have no Core
    context and retain their original behavior.
    """
    value = os.environ.get("QINGPING_MONITOR1_CORE_ROOT")
    if value is None:
        return None
    root = private_directory(Path(value))
    directory = Path(directory)
    if directory.parent != root / "jobs" or not USER.fullmatch(directory.name):
        raise PreparationError("usb_job_unavailable")
    private_directory(directory.parent)
    private_directory(directory)
    return root


def core_toolset(directory, root):
    """Use this profile's immutable prefix, never a moving default tool path.

    A prepared profile without its completed Core binding remains readable,
    but cannot start a build/install after a lost response or partial setup.
    This file is created only by the private actor, not uploaded via HTTP.
    """
    binding = unique_json(read_private(directory / "core-context.json"))
    toolset = binding.get("toolset_sha256")
    if (not isinstance(toolset, str) or len(toolset) != 64 or
            any(c not in "0123456789abcdef" for c in toolset) or
            binding != {"schema_version": 1, "job_id": directory.name,
                        "profile_sha256": private_hash(directory / "profile.json")["sha256"],
                        "toolset_sha256": toolset}):
        raise PreparationError("usb_job_unavailable")
    private_directory(root / "toolsets")
    tools = private_directory(root / "toolsets" / toolset)
    private_directory(tools / "bin")
    marker = unique_json(read_private(tools / "complete.json"))
    if marker.get("schema_version") != 1 or marker.get("manifest_sha256") != toolset:
        raise PreparationError("usb_operation_failed")
    return tools


def adb_executable(directory):
    root = core_root(directory)
    if root is None:
        return Path("/usr/bin/adb")
    path = core_toolset(directory, root) / "bin/adb"
    info = path.lstat()
    if (not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_nlink != 1 or
            stat.S_IMODE(info.st_mode) != 0o700 or path.resolve() != path):
        raise PreparationError("usb_operation_failed")
    return path


def adb_environment(directory):
    result = environment(Path(directory) / "build-home")
    if core_root(directory) is None:
        result.update(HOME="/data/adb", ADB_SERVER_SOCKET="tcp:localhost:5037")
    elif "QINGPING_MONITOR1_ADB_PORT" not in result:
        # Core starts its own foreground server before admitting a USB action.
        # A missing server context must never autostart/adopt the shared 5037.
        raise PreparationError("usb_operation_failed")
    return result


def child_job_directory(job_id):
    """Bind the child to the creator-selected private job, not a /data alias.

    The parent already authenticates the owner, validates the job and consumes
    its intent before Popen. It chooses cwd itself; an HTTP field never chooses
    a host path. The child still verifies its original profile/source/intent
    before any work. This supports HA-owned storage without mounting it over
    /data or moving historical app jobs. A wrong, public or symlinked cwd is a
    refusal, never permission to search another directory or retry a job.
    """
    if not isinstance(job_id, str) or not USER.fullmatch(job_id):
        raise PreparationError("usb_job_unavailable")
    directory = Path.cwd()
    if directory.name != job_id:
        raise PreparationError("usb_job_unavailable")
    private_directory(directory.parent)
    return private_directory(directory)


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


def verified_candidate_report(directory):
    """Join the completed candidate to its original source and private profile."""
    intent = bound_build_intent(directory)
    report = build_report(directory / "candidate/result.json")
    if (report.get("complete_build") is not True or report.get("installed") is not False or
            report.get("installation_ready") is not False or report.get("hardware_contacted") is not False or
            report.get("source_commit") != intent["source_commit"] or
            report.get("profile_sha256") != intent["profile_sha256"]):
        raise PreparationError("usb_build_unverified")
    return report


def build(directory, contract, runner=run_owned):
    directory = private_directory(Path(directory))
    intent_raw = read_private(directory / "build-intent.json")
    intent = bound_build_intent(directory)
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
            report = verified_candidate_report(directory)
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
        build(child_job_directory(sys.argv[2]), contract)
    finally:
        os.close(lock_fd)


if __name__ == "__main__":
    main()
