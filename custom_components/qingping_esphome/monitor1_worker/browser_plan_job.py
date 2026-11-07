"""Fixed SDK child: detached browser payload preparation, with no device IO."""
import sys
from pathlib import Path

from preparation import USER, PreparationError, owned_intent, read_private, unique_json
from build_worker import child_job_directory, sync_directory
from install_plan import source_closure
from browser_plan import checked_intent, producer_digest
from browser_payload import prepare


def run(directory):
    directory, original, _ = owned_intent(directory.parent, directory.name,
        unique_json(read_private(directory / 'intent.json'))['owner'])
    if original['transport'] != 'browser_usb':
        raise PreparationError('usb_browser_plan_transport_required')
    intent, _ = checked_intent(directory, original['owner'], directory.name)
    if intent['producer_sha256'] != producer_digest():
        raise PreparationError('usb_browser_plan_unverified')
    source = source_closure(directory)
    # Fresh SDK process only. Frozen canonical source is independently hashed;
    # its read-only candidate/bootstrap auditors cannot mutate a USB device.
    sys.path.insert(0, str(source))
    import prepare_install as canonical
    output = canonical.pm.private_output(directory / 'browser-plan')
    prepare(canonical, directory / 'capture', directory / 'candidate', directory / 'browser-bootstrap',
            directory / 'profile.json', output, intent['producer_sha256'])
    sync_directory(output)


if __name__ == '__main__':
    if len(sys.argv) != 3 or sys.argv[1] != '--job' or not USER.fullmatch(sys.argv[2]):
        raise SystemExit(2)
    try:
        run(child_job_directory(sys.argv[2]))
    except Exception:
        raise SystemExit(1) from None
