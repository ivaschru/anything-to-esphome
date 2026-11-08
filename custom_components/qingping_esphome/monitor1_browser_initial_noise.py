"""Private authenticated wire observer on the ORIGINAL guardian USB relay.

No HTTP/UI initiator, LAN scanner, key-bearing SDK input, process adoption or
terminal journal writer is provided. The device retains its independent stop
timer. A positive result is a private in-memory observation, not installation
readiness or evidence that the later stop/stock-return/USB-close succeeded.
"""
import asyncio
import copy
import math
import time

from .monitor1_browser_initial_api import InitialApiContext
from .monitor1_browser_initial_relay import InitialGuardianApiRelay
from .monitor1_browser_relay import RelayRefusal

FIELDS = ('co2', 'temperature', 'humidity', 'tvoc_stock_estimate')
REQUIRED = (*FIELDS, 'stock_response_age')
_now = time.monotonic
_wait = asyncio.sleep


class _WireSamples:
    """Only new physical SensorState messages count as wire generations.

    Re-reading a cached mapping never advances a generation. Reject duplicate
    metadata keys/object IDs, subdevice display feeds, missing_state, NaN and
    service sentinels. Equal numeric readings CAN be independent wire updates;
    they need new callbacks for every physical field and at least ten seconds
    between accepted vectors, just as in the frozen native observer.
    """
    def __init__(self, entities):
        self.names = {}
        for entity in entities:
            if type(entity).__name__ != 'SensorInfo':
                continue
            key, name = entity.key, entity.object_id
            if type(key) is not int or not 0 < key < 2**32 or key in self.names:
                raise RelayRefusal
            self.names[key] = name
            if name in REQUIRED and getattr(entity, 'device_id', 0) != 0:
                raise RelayRefusal
        if any(list(self.names.values()).count(name) != 1 for name in REQUIRED):
            raise RelayRefusal
        self.states, self.received_at = {}, {}
        self.counts = {name: 0 for name in FIELDS}
        self.previous = None
        self.samples, self.last_accepted_at, self.last_vector_at = 0, 0.0, 0.0

    def received(self, state):
        if type(state).__name__ != 'SensorState' or getattr(state, 'device_id', 0) != 0:
            return
        name = self.names.get(state.key)
        if name not in REQUIRED:
            return
        self.states[name] = float('nan') if getattr(state, 'missing_state', False) else state.state
        self.received_at[name] = _now()
        if name in self.counts:
            self.counts[name] += 1

    def accept(self, now):
        values = [self.states.get(name) for name in FIELDS]
        age = self.states.get('stock_response_age')
        finite = lambda value: type(value) in (int, float) and math.isfinite(value) and value != 99999
        counts = tuple(self.counts.values())
        if (not all(finite(value) for value in values) or not finite(age) or not 0 <= age < 30 or
                not values[0] > 0 or not 0 <= values[2] <= 100 or not values[3] >= 0 or
                any(name not in self.received_at or not 0 <= now - self.received_at[name] <= 20 for name in REQUIRED) or
                not all(counts) or self.previous is not None and
                (now - self.last_vector_at < 10 or not all(a > b for a, b in zip(counts, self.previous)))):
            return False
        self.samples += 1
        self.previous, self.last_vector_at = counts, now
        # Timestamp the actual oldest contributing wire message, not the later
        # scope check/cached read. A future terminal join must test its age anew.
        self.last_accepted_at = min(self.received_at[name] for name in REQUIRED)
        return True


class InitialWireObservation:
    """Private same-operation evidence; serialized copies cannot continue it."""
    __slots__ = ('_running', '_samples', '_last_sample_at', '_close_proof')

    def __init__(self, running, samples, last_sample_at, close_proof):
        self._running, self._samples = running, samples
        self._last_sample_at, self._close_proof = last_sample_at, copy.deepcopy(close_proof)

    def __repr__(self):
        return '<InitialWireObservation context only>'

    @property
    def reported(self):
        self._running._ram.live()
        if self._running._wire_observation is not self:
            raise RelayRefusal
        return {'kind': 'browser_initial_wire_observation', 'samples': self._samples,
                'child': copy.deepcopy(self._running.reported_start['child']['stamp']),
                **self._close_proof}


async def _idle(relay):
    """A reconnect needs the previous actual socket-close ACK, not TCP EOF."""
    async with asyncio.timeout(3):
        while relay.relay.active is not None or relay.relay.tasks or relay.relay.pumps:
            relay._live()
            if relay.relay.failed:
                raise RelayRefusal
            await asyncio.sleep(.01)
    relay._live()
    if relay.relay.failed or relay.cap.opened or relay.cap.opening or relay.cap.pending:
        raise RelayRefusal


async def _disconnect(client):
    try:
        # A read-only observer needs no protocol command during teardown.
        # Close only this owned client transport, then let _idle/relay.close
        # independently await the browser's actual API-close ACK. Avoid the
        # SDK's graceful-disconnect logger, which can emit raw exception text
        # after a peer/identity failure even with connect(log_errors=False).
        client.force_disconnect()
        await asyncio.sleep(0)
    except BaseException:
        raise RelayRefusal from None


async def observe_initial_noise(context):
    """Read authenticated physical generations, then independently close API.

    The native 30s connect/50s observation limits remain ceilings. Reserve the
    final five seconds for client disconnect and acknowledged API cleanup, so
    no cleanup result renews the relay's original 50s permission. Complete
    fixed scope still runs beside a single pending opaque API read every two
    seconds. No guardian finish/USB close/journal completion occurs here.
    """
    if type(context) is not InitialApiContext:
        raise RelayRefusal
    context.live()
    running = context._running
    if running._noise_used:
        raise RelayRefusal
    running._noise_used = True  # One attempt, before listener or client IO.
    relay, client, result = None, None, None
    try:
        from aioesphomeapi import APIClient
        identity = context.identity
        relay = InitialGuardianApiRelay(context)
        port = await relay.start()
        connect_until = min(running.issued_at + 30, relay.deadline - 5)
        for _ in range(16):
            context.live()
            relay._live()
            left = connect_until - _now()
            if left <= 0:
                break
            client = APIClient('127.0.0.1', port, password=None, noise_psk=context._noise_psk,
                               expected_name=identity['node_name'], provide_time=False,
                               client_info='Qingping initial USB observation')
            try:
                # Unlike native ADB forwarding, this selected browser OPEN
                # first repeats a complete fixed scope (up to 5s), then its
                # bounded socket open and Noise handshake. A 2s outer timeout
                # can cancel valid prerequisite work before a socket exists.
                # Keep the original issued_at+30 connect and +50 observation
                # ceilings; this does not renew any capability/device timer.
                await asyncio.wait_for(client.connect(login=True, log_errors=False), min(12, left))
                context.live()
                relay._live()
                break
            except Exception:
                await _disconnect(client)
                client = None
                await _idle(relay)  # Ambiguous open/close cannot retry.
                if _now() + 1 >= connect_until:
                    break
                await _wait(1)
        if client is None:
            raise RelayRefusal
        stop_at = relay.deadline - 5
        info = await asyncio.wait_for(client.device_info(), min(5, max(.001, stop_at - _now())))
        if info.name != identity['node_name'] or info.mac_address.lower() != identity['api_mac']:
            raise RelayRefusal
        entities, _ = await asyncio.wait_for(client.list_entities_services(), min(5, max(.001, stop_at - _now())))
        samples = _WireSamples(entities)
        client.subscribe_states(samples.received)
        while _now() < stop_at:
            context.live()
            relay._live()
            async with asyncio.timeout(max(.001, stop_at - _now())):
                await running.observe_scope()
            context.live()
            now = _now()
            if now >= stop_at:
                break
            samples.accept(now)
            await _wait(min(2, max(0, stop_at - now)))
        if samples.samples < 2 or not 0 <= _now() - samples.last_accepted_at <= 20:
            raise RelayRefusal
        await _disconnect(client)
        client = None
        await _idle(relay)
        closed = await relay.close()
        context.live()
        result = InitialWireObservation(running, samples.samples, samples.last_accepted_at, closed)
        running._wire_observation = result
        return result  # Still no stop/stock-return/USB-close/terminal proof.
    except BaseException:
        if client is not None:
            try:
                await _disconnect(client)
            except BaseException:
                pass  # Cleanup failure must not skip original channel retirement.
            finally:
                client = None
        if relay is not None:
            await relay._retire()
        raise RelayRefusal from None
    finally:
        if client is not None:
            try:
                await _disconnect(client)
            except BaseException:
                pass
        if relay is not None:
            try:
                await relay.close()
            except BaseException:
                if result is not None:
                    result = None
                    running._wire_observation = None
                    context.close()
                    raise RelayRefusal from None
        context.close()  # Drop Core's reference; do not claim secure erasure.
