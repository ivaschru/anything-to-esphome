"""Validate a synthetic actual JavaScript DTO with the pure Core validator.

Only this test's fixed modules are imported. No Core/HA startup, SDK, path from
input, private profile, USB or device code is used; JSON grants no capability.
"""
import importlib.util
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2] / 'custom_components/qingping_esphome'
for name in ('monitor1_browser_relay', 'monitor1_browser_process_observation'):
    spec = importlib.util.spec_from_file_location('qingping_scope_contract.' + name, ROOT / (name + '.py'))
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
checker = module
value = json.loads(sys.stdin.buffer.read(1024 * 1024))
assert set(value) == {'packet', 'ram', 'started', 'observed'}
packet, ram, started = value['packet'], value['ram'], value['started']
checker.validate_scope(value['observed'], {k: packet[k] for k in checker.BINDING}, started,
    ram['uploaded']['guardian_file_identity'], ram['uploaded']['ram_root_identity'], checker.scope_basis(packet))
print(json.dumps({'context_checked': True, 'execution_authority': False}))
