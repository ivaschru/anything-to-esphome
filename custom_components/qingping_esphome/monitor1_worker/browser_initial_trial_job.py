"""Fixed private SDK artifact auditor. No USB, writer or guardian execution."""
import importlib
from pathlib import Path
import sys

from preparation import read_private, unique_json
from build_worker import Builds, child_job_directory
from browser_plan import BrowserPlans
from browser_stage import BrowserStages
from browser_initial_trial import MAX_INPUT, artifact_result, checked, encoded


def inspect_artifact(canonical, directory, plan, expected):
    """Reuse only the frozen adapter's transport-independent ELF auditor.

    guardian_artifact checks the actual candidate result, private file and
    canonical ARM/ABI parser. It does not call the native plan loader or ADB.
    This is still not the guardian's on-device no-capability/image-FD reader.
    """
    path, spec = canonical.guardian_artifact(plan, directory / 'candidate')
    if path != directory / 'candidate/initial-trial-guardian-program' or spec != expected:
        raise ValueError


def main():
    if len(sys.argv) != 3 or sys.argv[1] != '--job':
        raise ValueError
    directory = child_job_directory(sys.argv[2])
    raw = sys.stdin.buffer.read(MAX_INPUT + 1)
    if len(raw) > MAX_INPUT:
        raise ValueError
    value = unique_json(raw)
    if not isinstance(value, dict) or value.get('job_id') != directory.name or encoded(value) != raw:
        raise ValueError
    owner = unique_json(read_private(directory / 'intent.json'))['owner']
    contract = unique_json(Path(__file__).with_name('contract.json').read_bytes())
    stages = BrowserStages(BrowserPlans(Builds(directory.parent, contract)))
    _, source, plan, context, expected = checked(stages, owner, directory.name, value['plan_sha256'])
    if expected != raw:
        raise ValueError
    # All imported public modules were rehashed above against the frozen
    # source closure and generated required fingerprints. No import from an
    # unverified caller path and no invocation of trial()/frame()/Adb follows.
    sys.path.insert(0, str(source))
    canonical = importlib.import_module('trial_initial_bridge_adb')
    inspect_artifact(canonical, directory, plan, context['guardian'])
    sys.stdout.buffer.write(encoded(artifact_result(raw)));sys.stdout.buffer.flush()


if __name__ == '__main__':
    try:
        main()
    except Exception:
        sys.stdout.buffer.write(b'{"error":"usb_browser_scope_unverified"}\n')
        raise SystemExit(1) from None
