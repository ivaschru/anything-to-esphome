"""Pure first-bridge trial policy; no process, signal, API or device IO.

The first trial must leave BOTH persistent opt-outs set and use a one-shot
device-side guardian, never the retrying boot launcher or a host-only timer.
The guardian must own/reap its exact child, arm child parent-death SIGTERM and
set that child's oom_score_adj=1000 and no_new_privs before exec. This module
defines admission and outcomes, not proof that such a guardian or physical
trial already exists.
"""
from dataclasses import dataclass
import math
import re

import disabled_commit_policy as disabled

TRIAL_MS = 60000
TERM_GRACE_MS = 5000
KILL_GRACE_MS = 5000
MIN_START_RAM = 32 * 1024 * 1024
MIN_RUNNING_RAM = 8 * 1024 * 1024
MAX_LOG_BYTES = 65536
MIN_SAMPLE_GAP_MS = 10000
MAX_SAMPLE_AGE_MS = 20000


@dataclass(frozen=True)
class Conditions:
    disabled: disabled.Snapshot
    bridge_sha256: str
    full_release_store_absent: object
    wifi_store_absent: object
    persistent_preferences_absent: object
    boot_launcher_lock_absent: object
    api_ota_listeners_free: object
    private_ram_job: object
    tmpfs_verified: object
    ram_available_bytes: object
    unexpected_own_process_present: object
    log_bytes: object


@dataclass(frozen=True)
class Child:
    pid: int
    start: int
    executable_sha256: str
    uid: int
    guardian_pid: int
    guardian_start: int
    guardian_sha256: str
    guardian_uid: int
    held_unreaped_child: object
    parent_death_term_armed: object
    oom_score_adj: object
    no_new_privs_armed: object


@dataclass(frozen=True)
class Observation:
    conditions: Conditions
    child: Child
    reaped: object
    wait_status: object = None  # Raw waitpid status, available only after this guardian reaps its child.


@dataclass(frozen=True)
class ApiSample:
    noise_authenticated: object
    api_mac: str
    node_name: str
    generations: tuple  # One independent wire-update generation per CO2/T/RH/tVOC.
    values: tuple
    stock_response_age_s: object


@dataclass(frozen=True)
class Action:
    kind: str
    pid: int = 0
    start: int = 0


class FirstBridgeTrial:
    def __init__(self, plan_id, plan_sha, target, boot_id, bridge_sha, guardian_sha,
                 api_mac, node_name, initial):
        if (not isinstance(initial, Conditions) or not isinstance(initial.disabled, disabled.Snapshot) or
                not isinstance(target, tuple) or len(target) != 5 or
                not all(isinstance(value, str) and re.fullmatch(r"[0-9a-f]{64}", value)
                    for value in (bridge_sha, guardian_sha)) or
                not isinstance(api_mac, str) or not re.fullmatch(r"[0-9a-f]{2}(?::[0-9a-f]{2}){5}", api_mac) or
                int(api_mac[:2], 16) & 3 != 2 or api_mac == target[0] or
                not isinstance(node_name, str) or not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", node_name)):
            raise ValueError("Exact bridge/guardian digests and separate API identity are required")
        # Reuse the complete disabled-scope validation without issuing any of
        # its rollback operations. Both scripts must already be patched, while
        # both opt-outs remain set; this is not a second initial installation.
        disabled.DisabledVendorTransaction(plan_id, plan_sha, target, boot_id,
                                            "rollback_disabled", initial.disabled)
        if any(dict(initial.disabled.vendor_hashes)[path] != sha for path, sha in disabled.PATCHED.items()):
            raise ValueError("Both exact patched boot scripts must be committed but disabled")
        self.bridge_sha, self.guardian_sha = bridge_sha, guardian_sha
        self.api_mac, self.node_name = api_mac, node_name
        self._stock_pid = initial.disabled.stock_process[0]
        self._watchdog_pid = initial.disabled.watchdog_process[0]
        self._baseline = self._scope(initial.disabled)
        self._validate_conditions(initial, starting=True)
        self.state, self.reason = "ready", ""
        self._start_ms = self._last_ms = self._term_ms = self._kill_ms = None
        self._child = None
        self._generations = None
        self._last_sample_ms = None
        self._samples = 0
        self._forced = False

    @staticmethod
    def _scope(snapshot):
        # During a trial the one verified child is expected to exist. All
        # persistent flags, source/vendor files and stock/watchdog identities
        # remain fixed; free capacity may fluctuate but has separate floors.
        return (snapshot.target, snapshot.boot_id, snapshot.root_identity, snapshot.install_marker,
                snapshot.root_mode, snapshot.root_uid, snapshot.disabled_flags,
                snapshot.source_hashes, snapshot.vendor_hashes, snapshot.stock_process,
                snapshot.watchdog_process, snapshot.pm_helper_loaded, snapshot.same_filesystem)

    def _validate_conditions(self, value, starting=False):
        if (not isinstance(value, Conditions) or not isinstance(value.disabled, disabled.Snapshot) or
                self._scope(value.disabled) != self._baseline or value.bridge_sha256 != self.bridge_sha or
                any(flag is not True for flag in (value.full_release_store_absent, value.wifi_store_absent,
                         value.persistent_preferences_absent, value.boot_launcher_lock_absent,
                         value.private_ram_job, value.tmpfs_verified)) or
                value.unexpected_own_process_present is not False or
                type(value.ram_available_bytes) is not int or
                value.ram_available_bytes < (MIN_START_RAM if starting else MIN_RUNNING_RAM) or
                type(value.log_bytes) is not int or not 0 <= value.log_bytes <= MAX_LOG_BYTES or
                type(value.disabled.data_available_bytes) is not int or
                value.disabled.data_available_bytes < 8 * 1024 * 1024 or
                type(value.disabled.own_code_running) is not bool or
                (starting and (value.api_ota_listeners_free is not True or value.disabled.own_code_running is not False))):
            raise ValueError("Fresh private RAM/idle/headless scope is incomplete or changed")

    def _clock(self, now):
        if type(now) is not int or now < 0 or (self._last_ms is not None and now < self._last_ms):
            self.state, self.reason = "reconciliation_required", "monotonic clock is unverified"
            return False
        self._last_ms = now
        return True

    def _owned(self, child):
        if not isinstance(child, Child):
            return False
        identities = (child.pid, child.start, child.guardian_pid, child.guardian_start)
        return (all(type(value) is int and value > 1 for value in identities) and
                child.pid not in (child.guardian_pid, self._stock_pid, self._watchdog_pid) and
                child.guardian_pid not in (self._stock_pid, self._watchdog_pid) and
                type(child.uid) is int and child.uid == 0 and type(child.guardian_uid) is int and child.guardian_uid == 0 and
                child.executable_sha256 == self.bridge_sha and child.guardian_sha256 == self.guardian_sha and
                child.held_unreaped_child is True and child.parent_death_term_armed is True and
                child.no_new_privs_armed is True and
                type(child.oom_score_adj) is int and child.oom_score_adj == 1000)

    @staticmethod
    def _identity(child):
        return (child.pid, child.start, child.executable_sha256, child.uid,
                child.guardian_pid, child.guardian_start, child.guardian_sha256, child.guardian_uid)

    def issue_start(self, now, conditions):
        # A real adapter must consume/fsync its own immutable trial intent
        # BEFORE this issue. This pure object never persists or grants one.
        if self.state != "ready" or not self._clock(now):
            return None
        try:
            self._validate_conditions(conditions, starting=True)
        except ValueError as error:
            self.state, self.reason = "reconciliation_required", str(error)
            return None
        self.state, self._start_ms = "start_issued_once", now
        return Action("start_one_shot_guardian")

    def started(self, now, observation):
        if self.state != "start_issued_once" or not self._clock(now):
            return False
        try:
            if not isinstance(observation, Observation):
                raise ValueError("A complete guardian observation is required")
            self._validate_conditions(observation.conditions)
        except ValueError as error:
            self.state, self.reason = "reconciliation_required", str(error)
            return False
        if (now - self._start_ms >= TRIAL_MS or observation.reaped is not False or observation.wait_status is not None or
                observation.conditions.disabled.own_code_running is not True or
                not self._owned(observation.child)):
            self.state, self.reason = "reconciliation_required", "exact owned kernel child is unverified"
            return False
        self._child = self._identity(observation.child)
        self.state = "running"
        return True

    def api_sample(self, now, sample):
        if self.state != "running" or not self._clock(now) or now - self._start_ms >= TRIAL_MS:
            return False
        def valid_number(value):
            # A malformed collector can supply an integer too large for a
            # float conversion. Reject it as missing proof, not an exception
            # that could interrupt the caller's independent deadline loop.
            try:
                return type(value) in (int, float) and math.isfinite(value)
            except OverflowError:
                return False
        if (not isinstance(sample, ApiSample) or sample.noise_authenticated is not True or
                sample.api_mac != self.api_mac or sample.node_name != self.node_name or
                not isinstance(sample.generations, tuple) or len(sample.generations) != 4 or
                any(type(value) is not int or value <= 0 for value in sample.generations) or
                (self._generations is not None and any(new <= old for new, old in zip(sample.generations, self._generations))) or
                (self._last_sample_ms is not None and now - self._last_sample_ms < MIN_SAMPLE_GAP_MS) or
                not isinstance(sample.values, tuple) or len(sample.values) != 4 or
                not all(valid_number(value) for value in sample.values) or
                any(value == 99999 for value in sample.values) or
                sample.values[0] <= 0 or not 0 <= sample.values[2] <= 100 or sample.values[3] < 0 or
                not valid_number(sample.stock_response_age_s) or not 0 <= sample.stock_response_age_s < 30):
            return False
        self._generations = sample.generations
        self._last_sample_ms = now
        self._samples += 1
        return True

    def tick(self, now, observation):
        if self.state not in ("running", "term_issued_once", "kill_issued_once") or not self._clock(now):
            return None
        if not isinstance(observation, Observation):
            self.state, self.reason = "reconciliation_required", "complete child observation is missing"
            return None
        child = observation.child
        if not isinstance(child, Child) or self._identity(child) != self._child:
            self.state, self.reason = "reconciliation_required", "never signal an adopted/replaced PID"
            return None
        try:
            self._validate_conditions(observation.conditions)
        except ValueError:
            # Record failure, but never widen signal scope: only the exact
            # child held by its guardian can still be stopped below.
            self.reason = "headless/stock scope changed"
        if observation.reaped is True:
            self.state = ("trial_verified_stopped" if self.state == "term_issued_once" and
                          self._samples >= 2 and not self.reason and not self._forced and
                          type(observation.wait_status) is int and observation.wait_status in (0, 15) and
                          observation.conditions.disabled.own_code_running is False else "trial_failed_stopped")
            return None
        if observation.reaped is not False or observation.wait_status is not None or not self._owned(child):
            self.state, self.reason = "reconciliation_required", "ownership/reaping/child protection is unverified"
            return None
        if self.state == "running" and (now - self._start_ms >= TRIAL_MS or self.reason):
            # Two quick successes at the beginning are not liveness at the
            # end of the trial. The adapter must keep observing wire updates;
            # cached values or one late API reconnection cannot qualify it.
            if (self._samples < 2 or self._last_sample_ms is None or
                    now - self._last_sample_ms > MAX_SAMPLE_AGE_MS) and not self.reason:
                self.reason = "fresh authenticated API proof incomplete"
            self.state, self._term_ms = "term_issued_once", now
            return Action("terminate_exact_owned_child", child.pid, child.start)
        if self.state == "term_issued_once" and now - self._term_ms >= TERM_GRACE_MS:
            self.state, self._kill_ms, self._forced = "kill_issued_once", now, True
            return Action("kill_exact_owned_child", child.pid, child.start)
        if self.state == "kill_issued_once" and now - self._kill_ms >= KILL_GRACE_MS:
            self.state, self.reason = "reconciliation_required", "owned child did not reap; never resend a signal"
        return None
