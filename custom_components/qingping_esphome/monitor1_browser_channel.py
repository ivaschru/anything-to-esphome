"""Ephemeral request/answer framing for an authenticated browser USB peer.

The admin adapter joins actual user/page ownership. The browser
can answer only an outstanding server-created request. It cannot choose a
command, host, port, key, file or writer. The fixed scope-check reuses only original-file/identity reads. Private Core code
may additionally issue the finite disabled-root stage sequence after consuming
its writer intent. First-trial RAM frames likewise require the private
consumed actor journal and original live capability; they grant no image-FD or
launch authority. No public request creates those frames or launches code. A dropped request/answer retires the channel, never retries.
"""
import asyncio
import base64
import copy
import re
import secrets

from .monitor1_browser_relay import RelayRefusal

OPS = {"api-open", "api-read", "api-write", "api-close", "channel-close", "scope-check", "stage-admission",
       "stage-prepare", "stage-file-begin", "stage-chunk", "stage-file-finish", "stage-complete", "disabled-scope", "initial-trial-preparation", "commit-stream-check", "commit-prepare", "commit-step", "commit-complete", "ram-stream-check", "ram-prepare", "ram-chunk", "ram-complete", "guardian-start", "guardian-finish"}
MAX_BYTES = 65536


def guardian_record(value, kind, nonce):
    """Strict reported context only; never process adoption/stop proof.

    Keep uint64 birth ticks as decimal strings, including values above
    JavaScript's exact integer range. A later Core verifier must still
    independently join actual processes, authenticated wire and stock.
    """
    if kind not in ('start', 'child', 'end') or not isinstance(nonce, str) or not re.fullmatch('[a-f0-9]{32}', nonce):
        raise RelayRefusal
    fields = {'kind', 'nonce', 'stamp'} if kind in ('start', 'child') else {
        'kind', 'nonce', 'guardian', 'child', 'elapsed_ms', 'reaped', 'protection_ack', 'term_sent', 'forced', 'wait_status'}
    if (not isinstance(value, dict) or set(value) != fields or value['kind'] != kind or value['nonce'] != nonce):
        raise RelayRefusal

    def stamp(pair):
        return (isinstance(pair, list) and len(pair) == 2 and type(pair[0]) is int and 2 <= pair[0] <= 2147483647 and
                isinstance(pair[1], str) and re.fullmatch('[1-9][0-9]{0,19}', pair[1]) and 1 <= int(pair[1]) < 2**64)

    if kind in ('start', 'child'):
        if not stamp(value['stamp']):
            raise RelayRefusal
    elif (not stamp(value['guardian']) or not stamp(value['child']) or value['guardian'][0] == value['child'][0] or
          type(value['elapsed_ms']) is not int or not 60000 <= value['elapsed_ms'] <= 71000 or
          any(value[k] is not True for k in ('reaped', 'protection_ack', 'term_sent')) or value['forced'] is not False or
          type(value['wait_status']) is not int or value['wait_status'] not in (0, 15)):
        raise RelayRefusal


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
        self.staging = False
        self.committing = False
        self.commit_probe = False
        self.ram_probe = False
        self.ramming = False
        self.ram_prepared = False
        self.ram_finished = False
        self.ram_offset = 0
        self.ram_verified = False
        self.trial_nonce = None
        self.guardian_used = False
        self.guardian_ready = None
        self.guardian_finished = False

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
            async with asyncio.timeout(90 if operation in ("scope-check", "stage-admission", "stage-prepare", "stage-file-finish", "stage-complete", "disabled-scope", "initial-trial-preparation", "commit-prepare", "commit-step", "commit-complete", "ram-prepare", "ram-complete", "guardian-start", "guardian-finish") else 20):
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
        if self.ram_probe or self.ramming or self.commit_probe or self.committing or self.staging or self.opened or self.opening or self.pending:
            raise RelayRefusal
        return await self._request("scope-check")

    async def check_stage_scope(self):
        if self.ram_probe or self.ramming or self.commit_probe or self.committing or self.staging or self.opened or self.opening or self.pending:
            raise RelayRefusal
        return await self._request("stage-admission")

    async def check_disabled_scope(self, meta):
        """Fixed read-only collector, callable only by future private Core code.

        Its metadata must come from the owned verified stage journal. Returned
        scope remains evidence, never a commit/rollback intent or native USB.
        """
        if self.ram_probe or self.ramming or self.committing or self.staging or self.opened or self.opening or self.pending:
            raise RelayRefusal
        return await self._request("disabled-scope", {"meta": meta})

    async def check_initial_trial_preparation(self, meta):
        """Fixed read only; no RAM job, trial intent or image-FD authority."""
        if self.ramming or self.commit_probe or self.committing or self.staging or self.opened or self.opening or self.pending:
            raise RelayRefusal
        return await self._request("initial-trial-preparation", {"meta": meta})

    async def begin_stage(self, packet, stock_files):
        """Private Core entry after its retained lease/consumed plan intent.

        Fixed metadata only, no payload body/path/command is accepted by this
        frame. The selected peer independently admits factory scope and makes
        both opt-outs before its sole ordered nine-file sequence.
        """
        if self.ram_probe or self.ramming or self.commit_probe or self.committing or self.staging or self.opened or self.opening or self.pending:
            raise RelayRefusal
        self.staging = True
        if await self._request("stage-prepare", {"packet": packet, "stock_files": stock_files}) != {"state": "disabled_root_created"}:
            self._retire()
            raise RelayRefusal

    async def stage_begin_file(self, role):
        if not self.staging or self.pending:
            raise RelayRefusal
        result = await self._request("stage-file-begin", {"role": role})
        if (not isinstance(result, dict) or set(result) != {"role", "offset"} or result["role"] != role or
                type(result["offset"]) is not int or result["offset"] != 0):
            self._retire()
            raise RelayRefusal

    async def stage_chunk(self, role, offset, body):
        if (not self.staging or self.pending or not isinstance(body, bytes) or
                not 0 < len(body) <= MAX_BYTES or type(offset) is not int or offset < 0):
            raise RelayRefusal
        result = await self._request("stage-chunk", {"role": role, "offset": offset, "body": base64.b64encode(body).decode()})
        if (not isinstance(result, dict) or set(result) != {"role", "offset"} or result["role"] != role or
                type(result["offset"]) is not int or result["offset"] != offset + len(body)):
            self._retire()
            raise RelayRefusal

    async def stage_finish_file(self, role):
        if not self.staging or self.pending:
            raise RelayRefusal
        if await self._request("stage-file-finish", {"role": role}) != {"role": role, "state": "remote_file_verified"}:
            self._retire()
            raise RelayRefusal

    async def finish_stage(self):
        if not self.staging or self.pending:
            raise RelayRefusal
        # The private coordinator checks all exact proof fields against its
        # independently rehashed packet before recording a terminal outcome.
        return await self._request("stage-complete")

    async def probe_commit_stream(self):
        if self.ram_probe or self.ramming or self.commit_probe or self.committing or self.staging or self.opened or self.opening or self.pending:
            raise RelayRefusal
        self.commit_probe = True  # Consume even a lost read-only probe ACK.
        expected = {'kind': 'browser_fixed_stdin_probe', 'service': 'exec:/bin/sh', 'ready': True,
                    'device_files_changed': False, 'writer_enabled': False}
        value = await self._request('commit-stream-check')
        if (not isinstance(value, dict) or value != expected or value['ready'] is not True or
                value['device_files_changed'] is not False or value['writer_enabled'] is not False):
            self._retire()
            raise RelayRefusal

    async def begin_commit(self, packet):
        if self.ram_probe or self.ramming or not self.commit_probe or self.committing or self.staging or self.opened or self.opening or self.pending:
            raise RelayRefusal
        self.committing = True  # Before any possibly lost delivery/ACK.
        value = await self._request('commit-prepare', {'packet': packet})
        if value != {'state': 'commit_scope_rechecked', 'writer_enabled': False} or value.get('writer_enabled') is not False:
            self._retire()
            raise RelayRefusal

    async def commit_step(self, phase):
        if not self.committing or self.pending or phase not in ('claim', 'watchdog', 'start'):
            raise RelayRefusal
        value = await self._request('commit-step', {'phase': phase})
        if (not isinstance(value, dict) or set(value) != {'phase', 'completed', 'scope'} or
                value['phase'] != phase or value['completed'] is not True or not isinstance(value['scope'], dict)):
            self._retire()
            raise RelayRefusal
        return value['scope']

    async def finish_commit(self):
        if not self.committing or self.pending:
            raise RelayRefusal
        return await self._request('commit-complete')

    async def probe_initial_ram_stream(self):
        """Harmless fixed exec probe before the separate actor consumes intent."""
        if self.ram_probe or self.ramming or self.commit_probe or self.committing or self.staging or self.opened or self.opening or self.pending:
            raise RelayRefusal
        self.ram_probe = True
        expected = {'kind': 'browser_fixed_stdin_probe', 'service': 'exec:/bin/sh', 'ready': True,
                    'device_files_changed': False, 'writer_enabled': False}
        value = await self._request('ram-stream-check')
        if (not isinstance(value, dict) or value != expected or value['ready'] is not True or
                value['device_files_changed'] is not False or value['writer_enabled'] is not False):
            self._retire()
            raise RelayRefusal

    async def begin_initial_ram(self, packet):
        """Private only: caller already retains original consumed trial/lease.

        This transport does not verify an actor journal or supply permission.
        Finite metadata frames cannot select paths, commands or another handle.
        """
        if not self.ram_probe or self.ramming or self.commit_probe or self.committing or self.staging or self.opened or self.opening or self.pending:
            raise RelayRefusal
        self.ramming = True  # Consume before possibly lost RAM creation delivery.
        value = await self._request('ram-prepare', {'packet': packet})
        if (not isinstance(value, dict) or set(value) != {'state', 'precreated', 'writer_enabled', 'image_fd_admitted'} or
                value['state'] != 'ram_precreated' or not isinstance(value['precreated'], dict) or
                value['writer_enabled'] is not False or value['image_fd_admitted'] is not False):
            self._retire()
            raise RelayRefusal
        self.ram_prepared = True
        self.trial_nonce = packet.get('nonce') if isinstance(packet, dict) else None
        return value['precreated']

    async def initial_ram_chunk(self, offset, body):
        if (not self.ram_prepared or self.ram_finished or self.pending or type(offset) is not int or offset != self.ram_offset or
                not isinstance(body, bytes) or not 0 < len(body) <= MAX_BYTES):
            raise RelayRefusal
        value = await self._request('ram-chunk', {'offset': offset, 'body': base64.b64encode(body).decode()})
        if (not isinstance(value, dict) or set(value) != {'offset'} or type(value['offset']) is not int or value['offset'] != offset + len(body)):
            self._retire()
            raise RelayRefusal
        self.ram_offset += len(body)

    async def finish_initial_ram(self):
        if not self.ram_prepared or self.ram_finished or self.pending:
            raise RelayRefusal
        self.ram_finished = True  # Never resend an uncertain final SYNC/readback.
        value = await self._request('ram-complete')
        expected = {'kind', 'precreated', 'uploaded', 'preparation', 'transport_closed', 'guardian_started',
                    'image_fd_admitted', 'execution_authority', 'context_only'}
        if (not isinstance(value, dict) or set(value) != expected or value['kind'] != 'browser_initial_ram_ready' or
                any(not isinstance(value[k], dict) for k in ('precreated', 'uploaded', 'preparation')) or
                any(value[k] is not False for k in ('transport_closed', 'guardian_started', 'image_fd_admitted', 'execution_authority')) or
                value['context_only'] is not True):
            self._retire()
            raise RelayRefusal
        # The private coordinator must independently validate all exact pins;
        # this context does not admit an image FD, release the actor's lease or
        # create a terminal trial record. Keep the original transport alive.
        self.ram_verified = True
        return value

    def _guardian_record(self, value, kind):
        guardian_record(value, kind, self.trial_nonce)

    async def start_initial_guardian(self):
        """Private finite continuation; no packet/path/command enters a frame.

        Only the original consumed RAM capability may call this. The selected
        peer retains its own actual RAM proof and repeats fresh reads. The
        future Core coordinator must also retain its task/actor/kernel lease;
        this channel method itself grants none of that authority.
        """
        if (not self.ram_verified or self.guardian_used or self.pending or not isinstance(self.trial_nonce, str) or
                not re.fullmatch('[a-f0-9]{32}', self.trial_nonce)):
            raise RelayRefusal
        self.guardian_used = True  # Before any potentially lost launch delivery.
        value = await self._request('guardian-start')
        try:
            if (not isinstance(value, dict) or set(value) != {'kind', 'start', 'child', 'records_only'} or
                    value['kind'] != 'browser_initial_guardian_started_record' or value['records_only'] is not True):
                raise RelayRefusal
            self._guardian_record(value['start'], 'start')
            self._guardian_record(value['child'], 'child')
            if value['start']['stamp'][0] == value['child']['stamp'][0]:
                raise RelayRefusal
        except RelayRefusal:
            self._retire()
            raise
        self.guardian_ready = copy.deepcopy(value)
        return value

    async def finish_initial_guardian(self):
        if self.guardian_ready is None or self.guardian_finished or self.pending:
            raise RelayRefusal
        self.guardian_finished = True  # A lost END/close is never permission to replay.
        value = await self._request('guardian-finish')
        try:
            if (not isinstance(value, dict) or set(value) != {'kind', 'start', 'child', 'end', 'raw_closed', 'transport_closed', 'records_only'} or
                    value['kind'] != 'browser_initial_guardian_records' or value['raw_closed'] is not True or
                    value['transport_closed'] is not False or value['records_only'] is not True or
                    value['start'] != self.guardian_ready['start'] or value['child'] != self.guardian_ready['child']):
                raise RelayRefusal
            self._guardian_record(value['start'], 'start')
            self._guardian_record(value['child'], 'child')
            self._guardian_record(value['end'], 'end')
            if value['end']['guardian'] != value['start']['stamp'] or value['end']['child'] != value['child']['stamp']:
                raise RelayRefusal
        except RelayRefusal:
            self._retire()
            raise
        return value  # No terminal journal write, lease release or installed status.

    async def open_api(self):
        if self.ram_probe or self.ramming or self.commit_probe or self.committing or self.staging or self.opened or self.opening:
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
