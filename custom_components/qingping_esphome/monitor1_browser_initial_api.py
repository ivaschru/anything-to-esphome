"""Core-only original-trial Noise context; no browser/API connection is opened.

The future authenticated observer must use this original in-memory context,
the original channel's loopback relay and complete live scope. Merely reading
the private key does not admit a socket, establish a sample, prove image-FD
admission or release the consumed journal. No HTTP initiator uses this module.
"""
import base64
import re

from .monitor1_browser_relay import RelayRefusal
from .monitor1_browser_stage import document
from .monitor1_browser_initial_ram import BINDING, same

MIME = 'application/vnd.qingping.internal-browser-initial-api+json'


class InitialApiContext:
    """Non-serializable continuation with a deliberately redacted repr.

    Identity is safe metadata for the fixed RAM preference-file check. The
    key remains internal to Core; it is never a property, status field,
    browser frame or argument for an SDK/subprocess. This does not promise
    secure erasure of Python strings when the reference is retired.
    """
    __slots__ = ('_running', '_node_name', '_api_mac', '_noise_psk')

    def __init__(self, running, value):
        self._running = running
        self._node_name, self._api_mac = value['node_name'], value['api_mac']
        self._noise_psk = value['noise_psk']

    def __repr__(self):
        return '<InitialApiContext private>'

    def live(self):
        self._running.live()
        if self._noise_psk is None or self._running._finished:
            raise RelayRefusal

    @property
    def identity(self):
        self.live()
        return {'node_name': self._node_name, 'api_mac': self._api_mac}

    def close(self):
        self._noise_psk = None


def _payload(result, packet):
    value = document(result, mime=MIME, limit=4096)
    if (set(value) != {'kind', *BINDING, 'node_name', 'api_mac', 'noise_psk'} or
            value['kind'] != 'browser_initial_api_context' or
            not same({k: value[k] for k in BINDING}, {k: packet[k] for k in BINDING}) or
            not same({k: value[k] for k in ('node_name', 'api_mac')}, packet['context']['api_identity']) or
            any(not isinstance(value[k], str) for k in ('node_name', 'api_mac', 'noise_psk')) or
            not re.fullmatch(r'[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?', value['node_name']) or
            not re.fullmatch(r'[a-f0-9]{2}(?::[a-f0-9]{2}){5}', value['api_mac']) or
            value['api_mac'] == '00:00:00:00:00:00' or int(value['api_mac'][:2], 16) & 1):
        raise RelayRefusal
    try:
        raw = base64.b64decode(value['noise_psk'], validate=True)
        if len(raw) != 32 or base64.b64encode(raw).decode() != value['noise_psk']:
            raise ValueError
    except Exception:
        raise RelayRefusal from None
    return value


async def read_initial_api_context(running):
    """One private read in the same shielded Core task/reservation/actor.

    Consume before the pipe request, so a lost answer is not replayed. A new
    object, worker, task, page/channel or returned JSON cannot acquire this
    continuation. The actor separately requires its original retained lease
    and all consumed packet pins. Failure retires only the original channel;
    it never signals a reported PID or marks the trial complete.
    """
    from .monitor1_browser_initial_guardian import RunningBrowserGuardian
    if type(running) is not RunningBrowserGuardian:
        raise RelayRefusal
    running.live()
    if running._finished or running._busy or running._api_used:
        raise RelayRefusal
    running._api_used, running._busy = True, True
    try:
        ram = running._ram
        request = {k: ram.packet[k] for k in BINDING}
        value = _payload(await ram._service.exchange(ram.owner, ram.nonce,
            'internal-browser-initial-trial-api', request), ram.packet)
        running.live()
        return InitialApiContext(running, value)
    except BaseException:
        await running.close()
        raise RelayRefusal from None
    finally:
        running._busy = False
