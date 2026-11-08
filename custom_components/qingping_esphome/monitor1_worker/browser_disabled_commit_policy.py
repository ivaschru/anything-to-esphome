"""Pure browser-specific disabled vendor policy; no device/host writes.

The admitted private SDK supplies the unchanged frozen canonical module. Only
its operation ordering, one-outstanding issue/readback and no-replay state
machine are inherited. Browser identity has a separate structural validator:
there is no synthetic `usb:` value and native loaders remain unchanged.
The rest of the content/session validator is copied verbatim from source53;
its parity test deliberately fails if either reviewed closure drifts.
A policy snapshot is evidence to compare, never a live handle or writer grant.
"""
from dataclasses import dataclass
import re

import disabled_commit_policy as canonical


@dataclass(frozen=True)
class WebUsbBinding:
    """Private original Core channel binding, never native get-devpath.

    The future adapter must obtain both fields from its original owner/page
    registry and recheck the actual selected handle before every issue/read.
    JSON with these fields cannot register, reopen or adopt a USB connection.
    """
    channel_id: str
    channel_nonce: str

    def __post_init__(self):
        if (not isinstance(self.channel_id, str) or not re.fullmatch('[a-f0-9]{32}', self.channel_id) or
                not isinstance(self.channel_nonce, str) or
                not re.fullmatch(r'[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}', self.channel_nonce)):
            raise ValueError('Exact private WebUSB channel binding required')


class BrowserVendorTransaction(canonical.DisabledVendorTransaction):
    """Same disabled CAS state machine, explicit WebUSB transport authority.

    The fifth target component is a frozen WebUsbBinding object. Passing it
    to the native policy refuses; neither this class nor its snapshot grants
    stage/commit intent, remote script execution, activation or automatic rollback.
    All source/flag/process/root/CAS semantics remain the frozen native ones.
    """
    def _validate(self, observed):
        if not isinstance(observed, canonical.Snapshot) or len(self.target) != 5:
            raise ValueError('Complete fixed browser scope required')
        if (any(not isinstance(getattr(observed, name), tuple) for name in
                ('target', 'root_identity', 'disabled_flags', 'source_hashes', 'vendor_hashes',
                 'stock_process', 'watchdog_process')) or
                not all(isinstance(value, str) for value in (self.target[2], self.target[3], self.boot_id))):
            raise ValueError('Malformed browser observation fields')
        canonical.preflight.expected_target(self.target[0], self.target[1])
        if (self.target[2] != '4.1.8_0287' or observed.target != self.target or
                observed.install_marker != self._marker or not isinstance(self.target[4], WebUsbBinding) or
                not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,127}', self.target[3]) or
                observed.boot_id != self.boot_id or
                not re.fullmatch(r'[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}', self.boot_id)):
            raise ValueError('Exact original WebUSB target/channel/boot required')
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


# Explicit aliases keep the verbatim semantic block below auditable against
# the admitted canonical SDK; none exports a command or transport callback.
Snapshot = canonical.Snapshot
EMPTY_SHA = canonical.EMPTY_SHA
SOURCES = canonical.SOURCES
FACTORY = canonical.FACTORY
PATCHED = canonical.PATCHED
preflight = canonical.preflight
