"""Private original-task RAM -> guardian transport join, without completion.

No HTTP/UI initiator imports this coordinator. It retains the exact live Core
task, operation reservation, actor process and consumed journal lease from RAM.
SDK artifact checks bracket the one start issue and terminal record read. The
selected peer independently repeats fresh device guards and owns raw cleanup.
Reported START/CHILD/END are still context, never process adoption, independent
authenticated health, device stop/stock-return proof or a journal completion.
The unchanged device guardian owns its child and the fixed 60/5/5 stop timer.
"""
import copy
import time

from .monitor1_browser_channel import guardian_record
from .monitor1_browser_initial_ram import PreparedBrowserRam, proof, same
from .monitor1_browser_initial_review import context
from .monitor1_browser_relay import RelayRefusal
from .monitor1_browser_process_observation import BINDING, validate_observation, scope_basis, validate_scope, SCOPE_WINDOW


async def _checked(ram):
    """Rehash the same private SDK/plan/commit/guardian, never read a key."""
    ram.live()
    packet = ram.packet
    request = {'job_id': packet['job_id'], 'expected_plan_sha256': packet['plan_sha256']}
    value, reader = context(await ram._service.exchange(ram.owner, ram.nonce,
        'internal-browser-initial-trial-context', request), request)
    ram.live()  # A replacement actor/task or expired capability cannot inherit the answer.
    if not same(value, packet['context']):
        raise RelayRefusal
    observed = ram.proof
    proof(observed, packet, observed['precreated'], reader)
    return packet


def records(value, packet, started=None):
    """Validate reported bytes again against the ORIGINAL consumed binding.

    The channel parser validates its protocol; this join independently pins
    that result to the retained actor packet and excludes the original stock
    processes. A stamp remains read context: it never grants a signal or fork.
    """
    fields = {'kind', 'start', 'child', 'records_only'}
    kind = 'browser_initial_guardian_started_record'
    if started is not None:
        fields |= {'end', 'raw_closed', 'transport_closed'}
        kind = 'browser_initial_guardian_records'
    if (not isinstance(value, dict) or set(value) != fields or value['kind'] != kind or value['records_only'] is not True):
        raise RelayRefusal
    nonce = packet['nonce']
    guardian_record(value['start'], 'start', nonce)
    guardian_record(value['child'], 'child', nonce)
    guardian, child = value['start']['stamp'], value['child']['stamp']
    scope = packet['context']['committed_scope']
    forbidden = {scope['stock_process'][0], scope['watchdog_process'][0]}
    if guardian[0] == child[0] or guardian[0] in forbidden or child[0] in forbidden:
        raise RelayRefusal
    if started is not None:
        guardian_record(value['end'], 'end', nonce)
        if (value['raw_closed'] is not True or value['transport_closed'] is not False or
                not same(value['start'], started['start']) or not same(value['child'], started['child']) or
                value['end']['guardian'] != guardian or value['end']['child'] != child):
            raise RelayRefusal


class RunningBrowserGuardian:
    """In-memory continuation only; JSON cannot recreate this task/actor join."""
    __slots__ = ('_ram', '_started', '_issued_at', '_finished', '_closed', '_busy', '_observations', '_api_used', '_api_context', '_api_relay', '_noise_used', '_wire_observation')

    def __init__(self, ram, started, issued_at):
        self._ram, self._started, self._issued_at = ram, copy.deepcopy(started), issued_at
        self._finished = self._closed = False
        self._busy, self._observations = False, 0
        self._api_used = False
        self._api_context = self._api_relay = None
        self._noise_used = False
        self._wire_observation = None

    def live(self):
        if self._closed:
            raise RelayRefusal
        self._ram.live()

    @property
    def reported_start(self):
        return copy.deepcopy(self._started)

    @property
    def issued_at(self):
        # Conservative local observation origin, never a device timer override
        # or a timestamp serialized for later task/worker adoption.
        return self._issued_at

    async def finish_records(self):
        self.live()
        if self._finished or self._busy:
            raise RelayRefusal
        self._finished = True  # Consume before a possibly lost END/close answer.
        try:
            value = await self._ram.capability.finish_initial_guardian()
            self.live()
            packet = await _checked(self._ram)
            records(value, packet, self._started)
            self.live()
            return copy.deepcopy(value)  # Still records_only; no lease/journal/status write.
        except BaseException:
            await self.close()
            raise RelayRefusal from None

    async def observe_processes(self):
        """Join the fixed partial read to this SAME task/actor/RAM binding.

        No cached observer packet can acquire a handle or extend its deadline.
        Keep SDK verification around start/end, rather than adding heavyweight
        artifact hashing to every read. live() still checks current producers,
        actor, reservation, owner/page and original capability before/after IO.
        """
        self.live()
        if self._finished or self._busy or self._observations >= 32:
            raise RelayRefusal
        self._busy = True
        self._observations += 1
        try:
            value = await self._ram.capability.observe_initial_guardian_processes()
            self.live()
            packet, ram = self._ram.packet, self._ram.proof
            binding = {k: packet[k] for k in BINDING}
            validate_observation(value, binding, self._started, packet['context']['committed_scope']['root_identity'][0],
                                 ram['uploaded']['guardian_file_identity'])
            self.live()
            return copy.deepcopy(value)
        except BaseException:
            await self.close()
            raise RelayRefusal from None
        finally:
            self._busy = False

    async def observe_scope(self):
        """Join complete fixed scope to the same original running continuation.

        Core measures its own read window; reported JSON cannot extend it.
        This checks context only and does not open the separate API relay or
        qualify authenticated samples, device FD admission or terminal proof.
        """
        self.live()
        if self._finished or self._busy or self._observations >= 32:
            raise RelayRefusal
        self._busy, self._observations = True, self._observations + 1
        began = time.monotonic()
        try:
            value = await self._ram.capability.observe_initial_guardian_scope()
            self.live()
            packet, ram = self._ram.packet, self._ram.proof
            validate_scope(value, {k: packet[k] for k in BINDING}, self._started,
                           ram['uploaded']['guardian_file_identity'], ram['uploaded']['ram_root_identity'], scope_basis(packet))
            self.live()
            if time.monotonic() - began > SCOPE_WINDOW:
                raise RelayRefusal
            return copy.deepcopy(value)
        except BaseException:
            await self.close()
            raise RelayRefusal from None
        finally:
            self._busy = False

    async def close(self):
        self._closed = True
        try:
            await self._ram.close()  # Only the original channel, never a reported device PID.
        except BaseException:
            raise RelayRefusal from None


async def start_guardian(ram):
    """Continue exactly one already-consumed live RAM handoff, with no selector.

    No service/owner/job/path/packet parameter can substitute another attempt.
    The eventual public workflow must also supply its independent observer;
    this internal source composition alone never enables an install control.
    """
    if type(ram) is not PreparedBrowserRam:
        raise RelayRefusal
    ram.claim_guardian()  # Before SDK or browser IO, even when later admission refuses.
    try:
        packet = await _checked(ram)
        issued_at = time.monotonic()
        started = await ram.capability.start_initial_guardian()
        ram.live()
        records(started, packet)
        if not same(await _checked(ram), packet):
            raise RelayRefusal
        ram.live()
        return RunningBrowserGuardian(ram, started, issued_at)
    except BaseException:
        try:
            await ram.close()
        except BaseException:
            pass
        raise RelayRefusal from None
