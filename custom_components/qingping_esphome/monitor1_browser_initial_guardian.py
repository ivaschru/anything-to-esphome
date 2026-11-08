"""Private original-task RAM -> bounded guardian -> stopped journal join.

No HTTP/UI initiator imports this coordinator. It retains the exact live Core
task, operation reservation, actor process and consumed journal lease from RAM.
SDK artifact checks bracket the one start issue and terminal record read. The
selected peer independently repeats fresh device guards and owns raw cleanup.
Reported START/CHILD/END alone are context, never process adoption or proof of
health/return. Completion additionally joins original Noise, return and both
close acknowledgements through the independent actor verifier.
The unchanged device guardian owns its child and the fixed 60/5/5 stop timer.
"""
import copy
import time

from .monitor1_browser_channel import guardian_record
from .monitor1_browser_stage import document
from .monitor1_browser_initial_ram import PreparedBrowserRam, proof, same, actor_live, producer
from .monitor1_browser_initial_review import context
from .monitor1_browser_relay import RelayRefusal
from .monitor1_browser_process_observation import BINDING, validate_observation, scope_basis, validate_scope, validate_return, SCOPE_WINDOW


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
    __slots__ = ('_ram', '_started', '_issued_at', '_finished', '_closed', '_busy', '_observations', '_api_used', '_api_context', '_api_relay', '_noise_used', '_wire_observation', '_ended', '_end_observed_at', '_return_used', '_return_observation', '_return_close_used', '_closed_transport')

    def __init__(self, ram, started, issued_at):
        self._ram, self._started, self._issued_at = ram, copy.deepcopy(started), issued_at
        self._finished = self._closed = False
        self._busy, self._observations = False, 0
        self._api_used = False
        self._api_context = self._api_relay = None
        self._noise_used = False
        self._wire_observation = None
        self._ended = self._end_observed_at = self._return_observation = None
        self._return_used = self._return_close_used = False
        self._closed_transport = None

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
            received_at = time.monotonic()  # Before SDK hashing; never accept a browser timestamp.
            self.live()
            packet = await _checked(self._ram)
            records(value, packet, self._started)
            self.live()
            self._ended, self._end_observed_at = copy.deepcopy(value), received_at
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

    async def observe_return(self):
        """Join original authenticated wire, actual END and fixed return scope.

        Records alone do not qualify a stop. Require the original same-task
        Noise result, independent API-close ACK, exact child/reap and a wire
        message no older than twenty seconds when Core received END. A host
        minimum of sixty seconds excludes an immediate reported END fixture;
        none of these clocks can extend the independent device stop timer.
        This still cannot release the journal or claim USB/channel closure.
        """
        from .monitor1_browser_initial_noise import InitialWireObservation
        self.live()
        wire = self._wire_observation
        if (not self._finished or self._ended is None or self._end_observed_at is None or self._busy or
                self._return_used or self._observations >= 32 or type(wire) is not InitialWireObservation or
                wire._running is not self or wire._samples < 2 or
                wire._close_proof != {'api_closed': True, 'transport_closed': False, 'context_only': True} or
                self._ram.capability.opened or self._ram.capability.opening or self._ram.capability.pending):
            raise RelayRefusal
        self._return_used, self._busy = True, True
        self._observations += 1
        began = time.monotonic()
        try:
            age = self._end_observed_at - wire._last_sample_at
            if (not 0 <= age <= 20 or self._end_observed_at - self._issued_at < 60 or
                    self._ended['end']['child'] != wire.reported['child']):
                raise RelayRefusal
            value = await self._ram.capability.observe_initial_guardian_return()
            self.live()
            packet, ram = self._ram.packet, self._ram.proof
            validate_return(value, {k: packet[k] for k in BINDING}, self._started,
                            ram['uploaded']['guardian_file_identity'], ram['uploaded']['ram_root_identity'], scope_basis(packet))
            self.live()
            if time.monotonic() - began > SCOPE_WINDOW:
                raise RelayRefusal
            self._return_observation = copy.deepcopy(value)
            return copy.deepcopy(value)  # Not terminal journal or actual close proof.
        except BaseException:
            await self.close()
            raise RelayRefusal from None
        finally:
            self._busy = False

    async def close_return_transport(self):
        """Await actual selected USB close AND the independent channel ACK.

        Keep the original actor/reservation after closure, but do not call
        ram.live() then: its deliberate live-USB prerequisite no longer holds.
        Only a newly created original in-memory closed continuation can carry
        these checked results to the private actor terminal verifier.
        """
        self.live()
        if self._return_observation is None or self._return_close_used or self._busy:
            raise RelayRefusal
        self._return_close_used, self._busy = True, True
        try:
            value = await self._ram.capability.close_initial_guardian_return()
            self.live()
            if (value['observation'] != self._return_observation or value['transport_closed'] is not True or
                    value['context_only'] is not True):
                raise RelayRefusal
            await self._ram.capability.close()  # Independent peer channel-close ACK.
            self._closed = True
            result = ClosedBrowserGuardian(self, value)
            self._closed_transport = result
            result.live()
            return result  # No journal write, release, boot or installation readiness.
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


class ClosedBrowserGuardian:
    """Original task/actor continuation after both positively checked closes."""
    __slots__ = ('_running', '_transport', '_record_used')

    def __init__(self, running, transport):
        self._running, self._transport = running, copy.deepcopy(transport)
        self._record_used = False

    def __repr__(self):
        return '<ClosedBrowserGuardian context only>'

    def live(self):
        running, ram = self._running, self._running._ram
        actor_live(ram._service, ram._actor, ram._operation)
        if (running._closed_transport is not self or running._closed is not True or
                ram.registry.current is not ram.current or
                ram.registry.capability(ram.owner, ram.nonce, ram.channel_id) is not ram.capability or
                ram.capability.closed is not True or ram.capability.failed or
                ram._packet['producer_sha256'] != producer()):
            raise RelayRefusal

    @property
    def reported(self):
        self.live()
        return {'kind': 'browser_initial_closed_transport', 'api_closed': True,
                'transport_closed': True, 'channel_closed': True, 'context_only': True}


    async def record(self):
        """One private actor write from this ORIGINAL closed continuation.

        A serialized report, another task/actor or status reconciliation cannot
        obtain this call. Consume before pipe IO. If the answer is lost, only
        read historical actor status; never resend the record/launch/packet.
        """
        self.live()
        if self._record_used:
            raise RelayRefusal
        self._record_used = True
        running, ram = self._running, self._running._ram
        packet, wire = ram.packet, running._wire_observation
        proof = {
            'binding': {k: packet[k] for k in BINDING},
            'ram_root_identity': ram.proof['uploaded']['ram_root_identity'],
            'records': copy.deepcopy(running._ended),
            'wire': {'samples': wire._samples, 'identity': packet['context']['api_identity'],
                     'last_sample_age_at_reap_s': running._end_observed_at - wire._last_sample_at},
            'returned': copy.deepcopy(running._return_observation),
            'transport': copy.deepcopy(self._transport), 'channel_closed': True,
            'core_elapsed_at_end_ms': int((running._end_observed_at - running._issued_at) * 1000)}
        try:
            value = document(await ram._service.exchange(ram.owner, ram.nonce,
                'internal-browser-initial-trial-record', {'job_id': packet['job_id'],
                 'intent_sha256': packet['intent_sha256'], 'proof': proof}), mime='application/json', limit=16384)
            self.live()
            fields = {'job_id', 'state', 'replay_allowed', 'installed', 'installation_ready', 'writer_enabled',
                      'activated', 'device_write_attempted', 'launch_attempted', 'live_recheck_required'}
            if (not isinstance(value, dict) or set(value) != fields or value['job_id'] != packet['job_id'] or
                    value['state'] != 'browser_initial_trial_stopped_observed' or
                    any(value[k] is not False for k in ('replay_allowed', 'installed', 'installation_ready', 'writer_enabled', 'activated')) or
                    any(value[k] is not True for k in ('device_write_attempted', 'launch_attempted', 'live_recheck_required'))):
                raise RelayRefusal
            return value  # Historical stopped observation, never activation or device qualification.
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


async def run_guardian_trial(ram):
    """Run the bounded private trial in its ORIGINAL reserved Core operation.

    The caller already owns the consumed RAM handoff; accepting service/job/JSON
    selectors here would incorrectly turn detached history into launch authority.
    Await each existing continuation inline, rather than spawning a replacement
    task that could inherit neither the reservation nor the actor's live grant.
    The independent device guardian still owns its fixed stop/reap timer. This
    coordinator neither sleeps to fake END nor signals/adopts a reported PID.

    A failure retires only the original channel. All consumed history remains;
    no phase, terminal record or device command is automatically repeated. An
    acknowledged record returns historical stopped state, never activation,
    next-boot arming or public installation readiness. There is no HTTP/UI
    initiator for this private composition.
    """
    if type(ram) is not PreparedBrowserRam:
        raise RelayRefusal
    running = None
    try:
        # Import lazily to preserve the existing API/relay/guardian dependency
        # direction. The key remains on the actor/Core pipe, never in USB frames.
        from .monitor1_browser_initial_api import read_initial_api_context
        from .monitor1_browser_initial_noise import observe_initial_noise
        running = await start_guardian(ram)
        context = await read_initial_api_context(running)
        await observe_initial_noise(context)
        await running.finish_records()
        await running.observe_return()
        closed = await running.close_return_transport()
        return await closed.record()
    except BaseException:
        try:
            if running is None:
                await ram.close()
            else:
                await running.close()
        except BaseException:
            pass  # A cleanup failure cannot authorize record/retry or mask uncertainty.
        raise RelayRefusal from None
