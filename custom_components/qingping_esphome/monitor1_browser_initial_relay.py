"""Original guardian's opaque loopback relay, with no HTTP initiator.

Only the context returned by the original private actor read can construct
this continuation. The browser receives ciphertext, never a Noise key. API
teardown preserves that same USB handle for the later END/return observation;
it cannot claim actual USB closure, journal completion or installation.
"""
import asyncio
import time

from .monitor1_browser_initial_api import InitialApiContext
from .monitor1_browser_initial_ram import producer
from .monitor1_browser_relay import BrowserApiRelay, RelayRefusal


class InitialGuardianApiRelay:
    """One in-memory relay per original running attempt, never JSON-adopted."""

    def __init__(self, context):
        if type(context) is not InitialApiContext:
            raise RelayRefusal
        context.live()  # Original Core operation, not a newly scheduled task.
        running = context._running
        if running._busy or running._api_relay is not None:
            raise RelayRefusal
        self.context = context
        self.running, self.ram = running, running._ram
        self.cap = self.ram.capability
        # Capture once; neither reconnect nor a scope read can replenish the
        # native observer's 50s window or original registry lifetime. The
        # independent device-owned 60/5/5 stop loop is untouched.
        self.deadline = min(running.issued_at + 50, self.ram.current['deadline'])
        if time.monotonic() >= self.deadline:
            raise RelayRefusal
        self.started = self.closing = False
        self._cleanup = None
        self.relay = BrowserApiRelay(_GuardianChannel(self))
        running._api_relay = self  # Consume before any listener or API IO.

    def _live(self, *, io=False):
        """Delegate only to this listener's actual serve/byte-pump tasks.

        PreparedBrowserRam.live() stays strictly original-task-only. Helpers
        cannot use it to exchange actor messages or acquire a new reservation.
        Here we only recheck retained objects and producers around opaque IO;
        membership in the relay's OWN task sets is necessary but insufficient.
        """
        ram, running, service = self.ram, self.running, self.ram._service
        task, operation = asyncio.current_task(), ram._operation
        owned = io and (task in self.relay.tasks or task in self.relay.pumps)
        lock = getattr(service, 'lock', None)
        if (task is not operation and not owned or operation is None or operation.done() or
                getattr(service, 'pending', None) is not operation or
                getattr(service, 'closing', True) is not False or getattr(service, 'failed', True) is not False or
                getattr(lock, 'locked', lambda: False)() is not True or
                ram._actor is None or getattr(service, 'process', None) is not ram._actor or
                getattr(ram._actor, 'returncode', 0) is not None or
                ram.registry.current is not ram.current or
                ram.registry.capability(ram.owner, ram.nonce, ram.channel_id) is not self.cap or
                ram.capability is not self.cap or self.cap.closed or self.cap.failed or
                running._closed or running._finished or running._api_context is not self.context or
                running._api_relay is not self or self.context._noise_psk is None or
                ram._packet['producer_sha256'] != producer() or time.monotonic() >= self.deadline):
            raise RelayRefusal

    async def start(self):
        self.context.live()
        self._live()
        if self.started or self.closing:
            raise RelayRefusal
        self.started = True
        try:
            # Core independently validates the complete scope; NativeChannel
            # repeats it again before every fixed tcp:6053 open.
            await self.running.observe_scope()
            self._live()
            port = await self.relay.start()
            # No await between start's return and pinning the shorter deadline:
            # its newly scheduled timer has not yet read the old 240s value.
            self.relay.deadline = self.deadline
            self._live()
            return port  # Private Core loopback port, never a browser selector.
        except BaseException:
            await self._retire()
            raise RelayRefusal from None

    async def _retire(self):
        try:
            await self.cap.close()
        except BaseException:
            self.cap._retire()

    async def _close_owned(self):
        """Cleanup is safe after expiry; it does not yield continuation proof."""
        self.closing = True
        await self.relay.close()
        # Base close is idempotent but another timer caller can still be in its
        # cleanup await. Explicitly join the actual serve tasks, whose finally
        # blocks await API-close ACK, rather than trusting a closed boolean.
        tasks = set(self.relay.tasks) | set(self.relay.pumps)
        if tasks:
            try:
                await asyncio.wait_for(asyncio.gather(*tasks, return_exceptions=True), 5)
            except BaseException:
                self.relay.failed = True
        if (self.relay.failed or self.relay.active is not None or self.relay.tasks or self.relay.pumps or
                self.cap.failed or self.cap.closed or self.cap.opened or self.cap.opening):
            await self._retire()
            raise RelayRefusal

    async def close(self):
        # Never cancel shared cleanup on a lost caller. Every positive caller
        # must still be the ORIGINAL operation after actual API-close ACK.
        if self._cleanup is None:
            self._cleanup = asyncio.create_task(self._close_owned())
        try:
            await asyncio.shield(self._cleanup)
            self.context.live()
            self._live()
            if not self.started:
                raise RelayRefusal
            return {'api_closed': True, 'transport_closed': False, 'context_only': True}
        except BaseException:
            # A foreign caller cannot obtain a positive proof. Retiring this
            # original transport is cleanup only and cannot release its lease.
            await self._retire()
            raise RelayRefusal from None


class _GuardianChannel:
    """Private adapter: normal API cleanup is distinct from USB cleanup."""

    def __init__(self, owner):
        self.owner = owner

    async def open_api(self):
        owner = self.owner
        owner._live(io=True)
        if owner.closing:
            raise RelayRefusal
        remote = await owner.cap.open_initial_guardian_api()
        try:
            owner._live(io=True)
            return _GuardianStream(owner, remote)
        except BaseException:
            # A late socket cannot survive actor/channel/deadline replacement.
            await owner._retire()
            raise RelayRefusal from None

    async def close(self):
        # BrowserApiRelay invokes this on both clean teardown and failure.
        # Only its private adapter preserves USB after normal API closure.
        # The serve task still awaits that socket's own close ACK separately.
        if self.owner.relay.failed:
            await self.owner._retire()


class _GuardianStream:
    def __init__(self, owner, remote):
        self.owner, self.remote = owner, remote

    async def read(self, size):
        self.owner._live(io=True)
        data = await self.remote.read(size)
        self.owner._live(io=True)
        return data

    async def write(self, data):
        self.owner._live(io=True)
        await self.remote.write(data)
        self.owner._live(io=True)

    async def close(self):
        # Cleanup may run in wait_for's own task after its parent is cancelled.
        # It grants no read/write or proof and never chooses another stream.
        await self.remote.close()
