"""Public synthetic journal packet/proof for host JS composition, not a device."""
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from test_usb_browser_bridge_boot_journal import BootJournalTests

case = BootJournalTests(methodName='runTest')
case.setUp()
try:
    packet = case.prepare()
    print(json.dumps({'packet': packet, 'proof': case.proof(packet)}))
finally:
    case.doCleanups()  # Only this synthetic fixture's own host kernel lease.
