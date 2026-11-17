"""Fail real browser lifecycle tests if host package reads return to the loop."""
from functools import wraps
from pathlib import Path
import sys
import threading
from unittest.mock import patch


def off_loop_package_reads(test):
    """Inspect actual Path IO, excluding the emulated out-of-process actor.

    Existing synthetic actors execute inline in fixtures. Their filesystem IO
    is not a HA host call in production. Limit the assertion to the integration
    browser validators, while letting their complete real lifecycle test run.
    """
    @wraps(test)
    async def checked(self, *args, **kwargs):
        loop_thread = threading.get_ident()
        original = Path.read_bytes
        reads = []
        def read(path):
            source = Path(sys._getframe(1).f_code.co_filename)
            if source.name.startswith('monitor1_browser_'):
                self.assertNotEqual(threading.get_ident(), loop_thread, 'Package read on HA event loop: ' + source.name)
                reads.append(source.name)
            return original(path)
        with patch.object(Path, 'read_bytes', read):
            result = await test(self, *args, **kwargs)
        self.assertTrue(reads, 'Test did not exercise a host package read')
        return result
    return checked
