"""Bounded loopback API relay for one live, owner-bound browser USB channel.

This is unwired transport plumbing, not a writer/adoption endpoint. The caller
must supply its live registry capability; a JSON device/host/port report can
never construct it. Only the channel's fixed device API stream is used. Noise
handshakes and private keys belong to the existing native API client in Core;
the browser carries opaque ciphertext and receives no key through this relay.
"""
import asyncio
import time


class RelayRefusal(Exception):
    """No channel/packet/exception content may be logged or returned."""


class BrowserApiRelay:
    def __init__(self, channel):
        self.channel = channel
        self.server = None
        self.port = None
        self.started = False
        self.closed = False
        self.failed = False
        self.active = None
        self.tasks = set()
        # Exact owned pumps are tracked for the private original-guardian
        # adapter. This is not a task/transport adoption hook: ordinary relay
        # behavior and all budgets remain unchanged.
        self.pumps = set()
        self.opens = 0
        self.bytes = 0
        self.deadline = None
        self.timer = None

    async def start(self):
        if self.started or self.closed:
            raise RelayRefusal
        self.started = True
        self.deadline = time.monotonic() + 240
        # The kernel chooses and owns the actual loopback listener; there is
        # no release/rebind race, host option, forwarded port or global ADB.
        self.server = await asyncio.start_server(self._accept, '127.0.0.1', 0, limit=65536)
        self.port = self.server.sockets[0].getsockname()[1]
        self.timer = asyncio.create_task(self._expire())
        return self.port

    async def _expire(self):
        try:
            await asyncio.sleep(max(0, self.deadline - time.monotonic()))
            await self.close()
        except asyncio.CancelledError:
            pass

    def _accept(self, reader, writer):
        if self.closed or self.failed or self.active is not None or self.opens >= 16 or time.monotonic() >= self.deadline:
            writer.close()
            return
        # Reserve synchronously, before open_api awaits. A second TCP client
        # cannot race into the same selected USB socket or receive its bytes.
        self.active = writer
        self.opens += 1
        task = asyncio.create_task(self._serve(reader, writer))
        self.tasks.add(task)
        task.add_done_callback(self.tasks.discard)

    async def _serve(self, reader, writer):
        remote, pumps = None, []
        try:
            async with asyncio.timeout(max(.001, self.deadline - time.monotonic())):
                # Opening is one issue. A lost ACK sets failed and retires the
                # entire channel; no local reconnect can repeat that request.
                remote = await self.channel.open_api()
                async def upstream():
                    while data := await reader.read(65536):
                        self._charge(data)
                        await remote.write(data)
                async def downstream():
                    while True:
                        data = await remote.read(65536)
                        if not isinstance(data, bytes) or len(data) > 65536:
                            raise RelayRefusal
                        if not data:
                            return
                        self._charge(data)
                        writer.write(data)
                        await writer.drain()
                pumps = [asyncio.create_task(upstream()), asyncio.create_task(downstream())]
                self.pumps.update(pumps)
                done, _ = await asyncio.wait(pumps, return_when=asyncio.FIRST_COMPLETED)
                for task in done:
                    task.result()
        except BaseException:
            self.failed = True
        finally:
            for task in pumps:
                if not task.done():
                    task.cancel()  # Only these owned host byte-pump tasks.
            await asyncio.gather(*pumps, return_exceptions=True)
            self.pumps.difference_update(pumps)
            if remote is not None:
                try:
                    await asyncio.wait_for(remote.close(), 2)
                except BaseException:
                    self.failed = True
            # The remote stream's positively acknowledged close must precede
            # releasing active. Failure allows no new API socket or write.
            writer.close()
            try:
                await asyncio.wait_for(writer.wait_closed(), 2)
            except BaseException:
                self.failed = True
            if self.failed:
                try:
                    await asyncio.wait_for(self.channel.close(), 2)
                except BaseException:
                    pass
            if self.active is writer:
                self.active = None

    def _charge(self, data):
        if not isinstance(data, bytes) or not 0 < len(data) <= 65536:
            raise RelayRefusal
        self.bytes += len(data)
        if self.bytes > 8 * 1024**2:
            raise RelayRefusal

    async def close(self):
        if self.closed:
            return
        self.closed = True
        if self.timer is not None and self.timer is not asyncio.current_task():
            self.timer.cancel()
        if self.server is not None:
            self.server.close()
        if self.active is not None:
            self.active.close()
        # Python 3.14 Server.wait_closed also waits for accepted transports.
        # Close the owned active connection FIRST, otherwise an idle read can
        # hold API cleanup until its timeout and turn a normal close into loss.
        if self.server is not None:
            await self.server.wait_closed()
        # Closing the channel cancels its own USB/stream IO only; no monitor
        # process, boot flag or device state is signalled or retried here.
        try:
            await asyncio.wait_for(self.channel.close(), 2)
        except BaseException:
            self.failed = True
        if self.tasks:
            try:
                await asyncio.wait_for(asyncio.gather(*self.tasks, return_exceptions=True), 5)
            except BaseException:
                self.failed = True
