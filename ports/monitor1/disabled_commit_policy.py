"""Pure initial-install vendor CAS policy; no transport or filesystem writes.

Both opt-outs stay set throughout this transaction. A future adapter must
collect the live observations, consume/fsync its own intent before issue(),
copy the fixed source to a private same-filesystem temporary, recheck CAS and
atomically rename it. This policy is deliberately not an executable installer
or activation grant. Keeping policy separate permits exhaustive interrupted-
transaction tests without executing production-path scripts on a host.
"""
from dataclasses import dataclass
import hashlib
import re

import bootstrap_patches as bootstrap
import preflight_adb as preflight

START = "/data/etc/init.d/start.sh"
WATCHDOG = "/data/bin/watchdog.sh"
EMPTY_SHA = hashlib.sha256(b"").hexdigest()
FACTORY = {START: bootstrap.START_FACTORY, WATCHDOG: bootstrap.WATCHDOG_FACTORY}
PATCHED = {START: bootstrap.START_INSTALLED, WATCHDOG: bootstrap.WATCHDOG_INSTALLED}
SOURCES = {"stock-start.sh.original": bootstrap.START_FACTORY,
           "stock-watchdog.sh.original": bootstrap.WATCHDOG_FACTORY,
           "start.sh.candidate": bootstrap.START_INSTALLED,
           "watchdog.sh.candidate": bootstrap.WATCHDOG_INSTALLED,
           **bootstrap.ASSET_PINS}


@dataclass(frozen=True)
class Snapshot:
    """Values that must come from a fresh fixed-path read-only adapter.

    None of these fields may be inferred from an old stage receipt. In
    particular False for own_code_running/pm_helper_loaded is an observed
    absence, not a default for failed/unavailable process inspection.
    """
    target: tuple  # WLAN MAC, CO2 type, firmware, USB serial, USB transport.
    boot_id: str
    root_identity: tuple  # device/inode; binds the actual staged directory.
    install_marker: str  # exact plan-id + SHA from the staged install.intent.
    root_mode: int
    root_uid: int
    disabled_flags: tuple  # two (SHA, size, mode, uid, link count, is_symlink).
    source_hashes: tuple  # immutable staged original/candidate/launcher hashes.
    vendor_hashes: tuple  # all nine fixed recovery files, with two allowed variants.
    stock_process: tuple  # PID, start tick, executable SHA, UID.
    watchdog_process: tuple  # PID, start tick, UID; argv must be verified on-device.
    own_code_running: object
    pm_helper_loaded: object
    data_available_bytes: int
    same_filesystem: object


@dataclass(frozen=True)
class Operation:
    source: str
    target: str
    expected_before: str
    expected_after: str


class DisabledVendorTransaction:
    """One forward commit OR one guarded rollback, never activation or retry.

    Acknowledgement means a new independent whole-scope snapshot showing
    exactly the issued file transition. A successful host command/ADB ACK is
    not enough. Losing that result seals the transaction for reconciliation;
    calling issue again cannot resend the last replacement.
    """
    def __init__(self, plan_id, plan_sha256, target, boot_id, direction, initial):
        if direction not in ("commit_disabled", "rollback_disabled"):
            raise ValueError("Only a disabled commit or disabled rollback is defined")
        self.target, self.boot_id, self.direction = tuple(target), boot_id, direction
        if (not isinstance(plan_id, str) or not re.fullmatch(r"[0-9a-f]{32}", plan_id) or
                not isinstance(plan_sha256, str) or not re.fullmatch(r"[0-9a-f]{64}", plan_sha256)):
            raise ValueError("One exact original staging plan identity is required")
        self._marker = plan_id + " " + plan_sha256
        self.state, self.reason = "preparing", ""
        self._issued = None
        self._index = 0
        self._validate(initial)
        self._scope = self._stable_scope(initial)
        self._vendors = dict(initial.vendor_hashes)
        # A partial prior commit is never automatically completed. Rollback is
        # a separate deliberate transaction, admissible only for the exact
        # known factory/patched pair, with all independent opt-outs preserved.
        current = {path: self._vendors[path] for path in FACTORY}
        if direction == "commit_disabled":
            if current != FACTORY:
                raise ValueError("Commit requires both original factory scripts; reconcile partial/previous work")
            order = (WATCHDOG, START)
            source = {WATCHDOG: "watchdog.sh.candidate", START: "start.sh.candidate"}
            desired = PATCHED
        else:
            if current == FACTORY:
                raise ValueError("Factory scripts already intact; no rollback write is needed")
            # Remove the bridge hook first. Either intermediate combination is
            # safe only because both programs remain disabled and unused.
            order = (START, WATCHDOG)
            source = {START: "stock-start.sh.original", WATCHDOG: "stock-watchdog.sh.original"}
            desired = FACTORY
        self.operations = tuple(Operation(source[path], path, current[path], desired[path])
                                for path in order if current[path] != desired[path])
        self.state = "ready"

    def _validate(self, observed):
        if not isinstance(observed, Snapshot) or len(self.target) != 5:
            raise ValueError("A complete fixed-scope observation is required")
        if (any(not isinstance(getattr(observed, name), tuple) for name in
                ("target", "root_identity", "disabled_flags", "source_hashes", "vendor_hashes",
                 "stock_process", "watchdog_process")) or
                not all(isinstance(value, str) for value in (self.target[2], self.target[3], self.target[4], self.boot_id))):
            raise ValueError("Observation fields are missing or have an unexpected type")
        preflight.expected_target(self.target[0], self.target[1])
        if (self.target[2] != "4.1.8_0287" or observed.target != self.target or
                observed.install_marker != self._marker or
                not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,127}", self.target[3]) or
                not re.fullmatch(r"usb:[A-Za-z0-9._:-]+", self.target[4]) or
                observed.boot_id != self.boot_id or
                not re.fullmatch(r"[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}", self.boot_id)):
            raise ValueError("Exact target/variant/USB/boot is required")
        if (len(observed.root_identity) != 2 or
                any(type(value) is not int or value <= 0 for value in observed.root_identity) or
                type(observed.root_mode) is not int or observed.root_mode != 0o700 or
                type(observed.root_uid) is not int or observed.root_uid != 0 or
                observed.same_filesystem is not True):
            raise ValueError("Private root identity and same-filesystem rename are unverified")
        expected_flag = (EMPTY_SHA, 0, 0o600, 0, 1, False)
        if (observed.disabled_flags != (expected_flag, expected_flag) or
                any(not isinstance(flag, tuple) or
                    any(type(value) is not int for value in flag[1:5]) or type(flag[-1]) is not bool
                    for flag in observed.disabled_flags)):
            raise ValueError("Both exact private empty regular opt-outs must remain present")
        if (observed.own_code_running is not False or observed.pm_helper_loaded is not False or
                type(observed.data_available_bytes) is not int or
                observed.data_available_bytes < 8 * 1024 * 1024):
            raise ValueError("Observed idle/disabled state and data headroom are required")
        if (len(observed.stock_process) != 4 or len(observed.watchdog_process) != 3 or
                any(type(value) is not int or value <= 1 for value in
                    (*observed.stock_process[:2], *observed.watchdog_process[:2])) or
                observed.stock_process[2:] != (preflight.FILES["/data/bin/SnowApp"][0], 0) or
                type(observed.stock_process[-1]) is not int or
                type(observed.watchdog_process[-1]) is not int or observed.watchdog_process[-1] != 0 or
                observed.stock_process[0] == observed.watchdog_process[0]):
            raise ValueError("Unique live root-owned stock/watchdog process identities are required")
        try:
            sources = dict(observed.source_hashes)
            vendors = dict(observed.vendor_hashes)
        except (TypeError, ValueError):
            raise ValueError("Observation hash entries are malformed") from None
        if sources != SOURCES or len(observed.source_hashes) != len(SOURCES):
            raise ValueError("Staged recovery/bootstrap source hashes changed or are incomplete")
        if set(vendors) != set(preflight.FILES) or len(observed.vendor_hashes) != len(preflight.FILES):
            raise ValueError("Complete vendor closure is required")
        for path, digest in vendors.items():
            allowed = {FACTORY[path], PATCHED[path]} if path in FACTORY else {preflight.FILES[path][0]}
            if digest not in allowed:
                raise ValueError("Unknown vendor change; no overwrite or rollback is permitted")

    @staticmethod
    def _stable_scope(observed):
        # Free capacity can fluctuate; admission still enforces its minimum.
        # Script digests are tracked separately through exact expected deltas.
        # Everything identifying the target, staged source and live stock
        # session must remain unchanged between issue and acknowledgement.
        return (observed.target, observed.boot_id, observed.root_identity, observed.install_marker,
                observed.root_mode, observed.root_uid, observed.disabled_flags,
                observed.source_hashes, observed.stock_process, observed.watchdog_process,
                observed.own_code_running, observed.pm_helper_loaded, observed.same_filesystem)

    def _refuse(self, reason):
        self.state, self.reason = "reconciliation_required", reason
        return None

    def issue(self, observed):
        if self.state in ("committed_disabled", "rolled_back_disabled"):
            self.reason = "transaction is already terminal; no additional write"
            return None
        if self.state != "ready" or self._issued is not None:
            return self._refuse("operation already issued or transaction is terminal; never resend")
        try:
            self._validate(observed)
        except ValueError as error:
            return self._refuse(str(error))
        if self._stable_scope(observed) != self._scope or dict(observed.vendor_hashes) != self._vendors:
            return self._refuse("live scope/CAS changed before issue")
        self._issued = self.operations[self._index]
        self.state = "issued_waiting_for_independent_readback"
        return self._issued

    def acknowledge(self, observed):
        if self.state != "issued_waiting_for_independent_readback" or self._issued is None:
            return self._refuse("no single outstanding operation to acknowledge")
        expected = dict(self._vendors)
        expected[self._issued.target] = self._issued.expected_after
        try:
            self._validate(observed)
        except ValueError as error:
            return self._refuse(str(error))
        if self._stable_scope(observed) != self._scope or dict(observed.vendor_hashes) != expected:
            return self._refuse("readback did not prove exactly the issued transition")
        self._vendors = expected
        self._issued = None
        self._index += 1
        if self._index == len(self.operations):
            self.state = "committed_disabled" if self.direction == "commit_disabled" else "rolled_back_disabled"
        else:
            self.state = "ready"
        return self.state

    def ambiguous_result(self):
        return self._refuse("missing/ambiguous write result; read-only reconciliation, no retry")
