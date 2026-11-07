"""Ephemeral request/answer framing for an authenticated browser USB peer.

The admin adapter joins actual user/page ownership. The browser
can answer only an outstanding server-created request. It cannot choose a
command, host, port, key, file or writer. The fixed scope-check reuses only original-file/identity reads. There are no install/launch operations
in this protocol. A dropped request/answer retires the channel, never retries.
"""
import asyncio
import base64
import secrets

from .monitor1_browser_relay import RelayRefusal

OPS = {"api-open", "api-read", "api-write", "api-close", "channel-close", "scope-check"}
MAX_BYTES = 65536


class BrowserChannel:
    def __init__(self):
        self.queue = asyncio.Queue(maxsize=2)
        self.pending = {}
        self.abandoned_reads = set()
        self.retired_reads = set()
        self.closed = False
        self.failed = False
        self.polling = False
        self.opened = False
        self.opening = False

    def _retire(self):
        self.closed = True
        self.failed = True
        for identity, (future, _) in self.pending.items():
            if not future.done():
                if identity in self.abandoned_reads:
                    future.set_result(None)
                else:
                    future.set_exception(RelayRefusal())
        self.pending.clear()

    async def _request(self, operation, data=None):
        if self.closed or operation not in OPS or len(self.pending) >= 2:
            raise RelayRefusal
        identity = secrets.token_hex(16)
        future = asyncio.get_running_loop().create_future()
        self.pending[identity] = (future, False)
        try:
            self.queue.put_nowait({"id": identity, "operation": operation, "data": data})
            async with asyncio.timeout(90 if operation == "scope-check" else 20):
                result = await asyncio.shield(future)
            return result
        except asyncio.CancelledError:
            if operation == "api-read":
                # A host byte pump may stop on ordinary TCP EOF. Keep its
                # pure read pending until API-close ACK retires the browser
                # reader; cancelling this wait cannot replay a writer.
                self.abandoned_reads.add(identity)
                future.add_done_callback(lambda done: None if done.cancelled() else done.exception())
                raise
            # The shield's outer future is already cancelled. Retire this
            # inner wait as cancelled before failing the rest of the channel;
            # Python 3.14 otherwise reports an unhandled shield exception.
            if not future.done():
                future.cancel()
            self._retire()
            if future.done() and not future.cancelled():
                future.exception()
            raise RelayRefusal from None
        except BaseException:
            if not future.done():
                future.cancel()
            self._retire()
            # Retiring may also fail the simultaneous opposite byte pump.
            # Consume our own failed future, without exposing packet content.
            if future.done() and not future.cancelled():
                future.exception()
            raise RelayRefusal from None
        finally:
            if identity not in self.abandoned_reads:
                self.pending.pop(identity, None)

    async def poll(self):
        """Transport delivery once, not a writer or retry/status endpoint."""
        if self.closed or self.polling:
            raise RelayRefusal
        self.polling = True
        try:
            try:
                async with asyncio.timeout(15):
                    request = await self.queue.get()
            except TimeoutError:
                return None
            identity = request["id"]
            if identity not in self.pending or self.pending[identity][1]:
                self._retire()
                raise RelayRefusal
            future, _ = self.pending[identity]
            self.pending[identity] = (future, True)  # Consumed before delivery.
            return request
        finally:
            self.polling = False

    def answer(self, body):
        if isinstance(body, dict) and set(body) == {"id", "ok", "data"} and isinstance(body["id"], str) and body["id"] in self.retired_reads:
            # One late answer for an ACK-retired pure read is harmless. It
            # cannot satisfy another request or reopen an API/USB connection.
            self.retired_reads.remove(body["id"])
            return
        if (self.closed or not isinstance(body, dict) or set(body) != {"id", "ok", "data"} or
                not isinstance(body["id"], str) or body["id"] not in self.pending or type(body["ok"]) is not bool):
            self._retire()
            raise RelayRefusal
        future, delivered = self.pending[body["id"]]
        if not delivered or future.done() or body["ok"] is not True:
            self._retire()
            raise RelayRefusal
        # Result data is validated by its particular stream operation below.
        # A forged/oversized response can only retire this ephemeral channel.
        future.set_result(body["data"])
        if body["id"] in self.abandoned_reads:
            self.abandoned_reads.remove(body["id"])
            self.pending.pop(body["id"], None)

    def _retire_reads_after_close_ack(self):
        for identity in list(self.abandoned_reads):
            future, _ = self.pending.pop(identity)
            if not future.done():
                future.set_result(None)
            self.retired_reads.add(identity)
        self.abandoned_reads.clear()
        if len(self.retired_reads) > 16:
            self._retire()
            raise RelayRefusal

    async def check_scope(self):
        """Only the peer's fixed original-file/identity reader, never a shell.

        Return data is still reported transport evidence. The caller must
        compare it with this channel and its separately verified owned plan.
        A cached successful report can never renew a write/launch intent.
        """
        if self.opened or self.opening or self.pending:
            raise RelayRefusal
        return await self._request("scope-check")

    async def open_api(self):
        if self.opened or self.opening:
            raise RelayRefusal
        self.opening = True
        try:
            if await self._request("api-open") is not None:
                self._retire()
                raise RelayRefusal
            self.opened = True
            return BrowserStream(self)
        finally:
            self.opening = False

    async def close(self):
        if self.closed:
            if self.failed:
                raise RelayRefusal
            return
        try:
            if await self._request("channel-close") is not None:
                raise RelayRefusal
            self._retire_reads_after_close_ack()
            self.closed = True
        except BaseException:
            self._retire()
            raise RelayRefusal from None


class BrowserStream:
    def __init__(self, channel):
        self.channel = channel
        self.closed = False
        self.reading = False
        self.writing = False

    async def read(self, maximum):
        if self.closed or self.reading or type(maximum) is not int or not 1 <= maximum <= MAX_BYTES:
            raise RelayRefusal
        self.reading = True
        try:
            value = await self.channel._request("api-read", {"max_bytes": maximum})
            if not isinstance(value, str) or len(value) > 4 * ((maximum + 2) // 3):
                raise ValueError
            body = base64.b64decode(value, validate=True)
            if len(body) > maximum or base64.b64encode(body).decode() != value:
                raise ValueError
            return body
        except asyncio.CancelledError:
            raise
        except BaseException:
            self.channel._retire()
            raise RelayRefusal from None
        finally:
            self.reading = False

    async def write(self, body):
        if self.closed or self.writing or not isinstance(body, bytes) or not 1 <= len(body) <= MAX_BYTES:
            raise RelayRefusal
        self.writing = True
        try:
            if await self.channel._request("api-write", base64.b64encode(body).decode()) is not None:
                raise ValueError
        except BaseException:
            self.channel._retire()
            raise RelayRefusal from None
        finally:
            self.writing = False

    async def close(self):
        if self.closed:
            return
        if self.reading or self.writing:
            # Caller must retire/cancel its owned pumps before closing their
            # stream. Never claim a close ACK with another request in flight.
            self.channel._retire()
            raise RelayRefusal
        self.closed = True
        try:
            if await self.channel._request("api-close") is not None:
                raise ValueError
            self.channel._retire_reads_after_close_ack()
            self.channel.opened = False
        except BaseException:
            self.channel._retire()
            raise RelayRefusal from None
