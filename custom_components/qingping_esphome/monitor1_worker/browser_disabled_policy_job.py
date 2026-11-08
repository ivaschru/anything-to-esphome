"""Fixed read-only SDK child: exact input/source, pure policy, one JSON result."""
import hashlib
import importlib.util
import json
from pathlib import Path
import sys

from preparation import read_private, unique_json
from build_worker import Builds, child_job_directory
from browser_plan import BrowserPlans
from browser_stage import BrowserStages
from browser_disabled_policy import MAX_INPUT, checked_input, encoded


def evaluate(policy, meta, scope, channel_id, channel_nonce):
    """Only constructor semantics; no issue/ack, command or write is performed."""
    binding = policy.WebUsbBinding(channel_id, channel_nonce)
    target = meta['target']
    identity = (target['wlan_mac'], target['co2_type'], target['stock_version'], target['usb_serial'], binding)
    observed = policy.Snapshot(target=identity, boot_id=target['boot_id'], root_identity=tuple(scope['root_identity']),
        install_marker=scope['install_marker'], root_mode=scope['root_mode'], root_uid=scope['root_uid'],
        disabled_flags=tuple(tuple(v) for v in scope['disabled_flags']), source_hashes=tuple(tuple(v) for v in scope['source_hashes']),
        vendor_hashes=tuple(tuple(v) for v in scope['vendor_hashes']), stock_process=tuple(scope['stock_process']),
        watchdog_process=tuple(scope['watchdog_process']), own_code_running=scope['own_code_running'],
        pm_helper_loaded=scope['pm_helper_loaded'], data_available_bytes=scope['data_available_bytes'], same_filesystem=scope['same_filesystem'])
    try:
        action = policy.BrowserVendorTransaction(meta['descriptor']['plan_id'], meta['descriptor']['plan_sha256'], identity,
            target['boot_id'], 'commit_disabled', observed)
        return action.state == 'ready' and len(action.operations) == 2
    except ValueError:
        return False  # Known partial scripts require an independent decision, never automatic repair.


def main():
    if len(sys.argv) != 3 or sys.argv[1] != '--job':
        raise ValueError
    directory = child_job_directory(sys.argv[2])
    raw = sys.stdin.buffer.read(MAX_INPUT + 1)
    if len(raw) > MAX_INPUT:
        raise ValueError
    value = unique_json(raw)
    fields = {'schema_version', 'job_id', 'plan_sha256', 'channel_id', 'channel_nonce', 'scope'}
    if (not isinstance(value, dict) or set(value) != fields or type(value['schema_version']) is not int or value['schema_version'] != 1 or
            value['job_id'] != directory.name or encoded(value) != raw):
        raise ValueError
    owner = unique_json(read_private(directory / 'intent.json'))['owner']
    contract = unique_json(Path(__file__).with_name('contract.json').read_bytes())
    stages = BrowserStages(BrowserPlans(Builds(directory.parent, contract)))
    _, source, context, checked = checked_input(stages, owner, directory.name, value['plan_sha256'],
        value['channel_id'], value['channel_nonce'], value['scope'])
    if checked != raw:
        raise ValueError
    # Fresh SDK process only: canonical modules come from the verified source
    # closure, not the Core interpreter/module cache or a caller-supplied path.
    sys.path.insert(0, str(source))
    helper = Path(__file__).with_name('browser_disabled_commit_policy.py')
    spec = importlib.util.spec_from_file_location('qingping_private_browser_policy', helper)
    policy = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = policy
    spec.loader.exec_module(policy)
    admitted = evaluate(policy, context['meta'], value['scope'], value['channel_id'], value['channel_nonce'])
    result = {'schema_version': 1, 'job_id': directory.name, 'plan_sha256': value['plan_sha256'],
        'observation_sha256': hashlib.sha256(raw).hexdigest(), 'source_commit': context['source_commit'],
        'sdk_policy_checked': True, 'commit_admissible_for_review': admitted,
        'state': 'factory_commit_admissible_for_review' if admitted else 'known_scope_not_admissible',
        'device_writes': 0, 'writer_enabled': False, 'installation_ready': False, 'live_recheck_required': True}
    sys.stdout.buffer.write(encoded(result));sys.stdout.buffer.flush()


if __name__ == '__main__':
    try:
        main()
    except Exception:
        sys.stdout.buffer.write(b'{"error":"usb_browser_scope_unverified"}\n')
        raise SystemExit(1) from None
