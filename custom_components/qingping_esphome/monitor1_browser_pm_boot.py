"""Original read/Noise operation -> distinct consumed PM next-boot intent.

No public initiating HTTP route. The PM writer never loads the helper in this
boot, signals stock, reboots, replays unknown bytes or adopts an old receipt.
"""
import base64
import hashlib
import re
import time
from pathlib import Path

from .monitor1_browser_boot_observer import _Observation, context, _wire, MIME
from .monitor1_browser_stage import document
from .monitor1_browser_initial_ram import same
from .monitor1_browser_relay import RelayRefusal
from .monitor1_worker.browser_pm_boot_observation import validate_scope, validate_wire

# Importing the Root journal itself would also import its standalone worker
# dependencies inside HA. Keep only public producer names here; policy and
# fixed source copies are packaged explicitly below, never executed as tools.
PRODUCERS = ('browser_pm_boot_journal.py', 'browser_pm_boot_observation.py', 'pm-next-boot-contract.json',
             'pm_extension_guard.py', 'browser_boot_context.py')
ROOT = Path(__file__).parent / 'monitor1_worker'


def packet(result, o, observation):
    value = document(result, limit=65536)
    fields = {'schema_version', 'job_id', 'plan_sha256', 'channel_id', 'channel_nonce', 'nonce', 'context',
              'native_pair', 'observation', 'producer_sha256', 'intent_sha256'}
    producers = {n: hashlib.sha256((ROOT / n).read_bytes()).hexdigest() for n in PRODUCERS}
    if (set(value) != fields or type(value['schema_version']) is not int or value['schema_version'] != 1 or
            value['job_id'] != o.checked['job_id'] or value['plan_sha256'] != o.checked['plan_sha256'] or
            value['channel_id'] != o.data['channel_id'] or value['channel_nonce'] != o.current['reported_evidence']['channel'] or
            not same(value['context'], o.checked) or not same(value['observation'], observation) or
            value['producer_sha256'] != producers or not isinstance(value['intent_sha256'], str) or
            not re.fullmatch('[a-f0-9]{64}', value['intent_sha256']) or not isinstance(value['nonce'], str) or
            not re.fullmatch('[a-f0-9]{32}', value['nonce']) or value['nonce'] == '0' * 32 or
            value['nonce'] in (o.checked['arming']['nonce'], o.checked['arming']['context']['meta']['commit_nonce']) or
            not isinstance(value['native_pair'], dict) or set(value['native_pair']) != {'native-program', 'guardian-program'}): raise RelayRefusal
    for pin in value['native_pair'].values():
        if (not isinstance(pin, dict) or set(pin) != {'size', 'sha256'} or type(pin['size']) is not int or not 0 < pin['size'] <= 16 * 1024**2 or
                not isinstance(pin['sha256'], str) or not re.fullmatch('[a-f0-9]{64}', pin['sha256'])): raise RelayRefusal
    return value


def terminal(value, prepared, closed):
    bindings = ('job_id', 'plan_sha256', 'channel_id', 'channel_nonce', 'nonce', 'intent_sha256')
    fields = {'schema_version', *bindings, 'commands_acknowledged', 'after_effects_read_acknowledged',
              'target', 'current_boot_preserved', 'transport_closed', 'channel_closed', 'pm_next_boot_armed'}
    if (not isinstance(value, dict) or set(value) != fields or type(value['schema_version']) is not int or value['schema_version'] != 1 or
            any(value[k] != prepared[k] for k in bindings) or value['commands_acknowledged'] != ['arm', 'complete'] or
            any(value[k] is not True for k in ('after_effects_read_acknowledged', 'current_boot_preserved', 'transport_closed', 'pm_next_boot_armed')) or
            value['channel_closed'] is not closed or not same(value['target'], prepared['observation']['scope']['target'])): raise RelayRefusal


async def arm(service, owner, nonce, data):
    fields = {'job_id', 'expected_plan_sha256', 'channel_id', 'experimental_reviewed'}
    if (not isinstance(data, dict) or set(data) != fields or data['experimental_reviewed'] is not True or
            any(not isinstance(data[k], str) for k in fields - {'experimental_reviewed'}) or
            not re.fullmatch('[a-f0-9]{32}', data['job_id']) or not re.fullmatch('[a-f0-9]{32}', data['channel_id']) or
            not re.fullmatch('[a-f0-9]{64}', data['expected_plan_sha256']) or service.browser_registry is None): raise RelayRefusal
    args = {k: data[k] for k in fields - {'experimental_reviewed'}}
    o = _Observation(service, owner, nonce, args)  # Strict original task/actor before any IO or cleanup.
    request = {k: data[k] for k in ('job_id', 'expected_plan_sha256')}
    try:
        o.live(); o.checked = context(await service.exchange(owner, nonce, 'internal-browser-boot-observer-context', request), args); o.live()
        evidence = o.current['reported_evidence']; old = o.checked['arming']['context']['meta']['target']
        o.target = {'kind': 'browser_webusb', 'usb_serial': evidence['serial'], **{k: evidence[k] for k in ('wlan_mac', 'boot_id', 'co2_type', 'stock_version')}}
        if not same({**o.target, 'boot_id': old['boot_id']}, old) or o.target['boot_id'] == old['boot_id']: raise RelayRefusal
        await o.scope()
        binding = {'job_id': data['job_id'], 'plan_sha256': data['expected_plan_sha256'],
                   'arming_intent_sha256': o.checked['arming']['intent_sha256'], 'arming_proof_sha256': o.checked['arming_proof_sha256']}
        value = document(await service.exchange(owner, nonce, 'internal-browser-boot-observer-api', binding), mime=MIME, limit=4096); o.live()
        if (set(value) != {'kind', *binding, 'node_name', 'api_mac', 'noise_psk'} or value['kind'] != 'browser_bridge_boot_api_context' or
                any(value[k] != v for k, v in binding.items()) or not same({k: value[k] for k in ('node_name', 'api_mac')}, o.checked['api_identity']) or
                not isinstance(value['noise_psk'], str)): raise RelayRefusal
        raw = base64.b64decode(value['noise_psk'], validate=True)
        if len(raw) != 32 or base64.b64encode(raw).decode() != value['noise_psk']: raise RelayRefusal
        o.psk = value.pop('noise_psk'); wire = await _wire(o); sample_at = time.monotonic() - wire['last_sample_age_at_final_scope_s']
        o.live()
        # Budget is not renewed by observation, probe, ACK or metadata. Refuse
        # BEFORE the durable PM intent if the original operation lacks room.
        if min(o.deadline, o.current['deadline']) - time.monotonic() < 65: raise RelayRefusal
        await o.cap.probe_pm_boot_stream(); o.live(); await o.scope()
        if min(o.deadline, o.current['deadline']) - time.monotonic() < 65: raise RelayRefusal
        observation = {'scope': o.first, 'wire': {'samples': wire['samples'], 'last_sample_age_at_prepare_s': time.monotonic() - sample_at,
                       'identity': o.checked['api_identity'], 'api_closed': True, 'final_scope_checked': True}}
        validate_scope(observation['scope'], o.checked); validate_wire(observation['wire'], o.checked)
        prepared = packet(await service.exchange(owner, nonce, 'internal-browser-pm-boot-prepare', {**request, 'experimental_reviewed': True,
            'scope': {'channel_id': data['channel_id'], 'channel_nonce': evidence['channel'], 'observation': observation}}), o, observation)
        o.live(); await o.cap.begin_pm_boot(prepared); o.live()
        for phase in ('arm', 'complete'): await o.cap.pm_boot_step(phase); o.live()
        proof = await o.cap.finish_pm_boot(); o.live(); terminal(proof, prepared, False)
        await o.cap.close(); o.live(closed=True); proof = {**proof, 'channel_closed': True}; terminal(proof, prepared, True)
        result = document(await service.exchange(owner, nonce, 'internal-browser-pm-boot-record',
                          {'job_id': data['job_id'], 'intent_sha256': prepared['intent_sha256'], 'proof': proof})); o.live(closed=True)
        expected = {'job_id', 'state', 'replay_allowed', 'installed', 'activated', 'installation_ready', 'writer_enabled', 'live_recheck_required', 'pm_next_boot_armed'}
        if (set(result) != expected or result['job_id'] != data['job_id'] or result['state'] != 'browser_pm_next_boot_armed_waiting_reboot' or
                any(result[k] is not False for k in ('replay_allowed', 'installed', 'activated', 'installation_ready', 'writer_enabled')) or
                result['live_recheck_required'] is not True or result['pm_next_boot_armed'] is not True): raise RelayRefusal
        return result
    except BaseException:
        o.psk = None
        try: await o.cap.close()
        except BaseException: pass
        raise RelayRefusal from None
