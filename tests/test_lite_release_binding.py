"""Prevent UI/display/exporter counters from diverging when a profile advances."""
import importlib.util
from pathlib import Path
import sys
import unittest
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
spec=importlib.util.spec_from_file_location('lite_builder',ROOT/'tools/build_lite.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class ReleaseBindingTests(unittest.TestCase):
    def test_future_release_changes_only_normal_staged_identity(self):
        path=ROOT/'ports/lite/components/cgdn1_ui/cgdn1_ui.h';before=path.read_text()
        after=m.bind_ui_release(before,{'version':'future-eight','public_version':8})
        self.assertIn('UI_VERSION = "future-eight";',after)
        self.assertIn('PUBLIC_VERSION = 8;',after)
        self.assertEqual(after.count('PUBLIC_VERSION = 0;'),before.count('PUBLIC_VERSION = 0;'))
        self.assertEqual(path.read_text(),before)
        self.assertIn('2026.11.04-ui27-weak17',after)
    def test_changed_or_ambiguous_branch_refuses_before_compile(self):
        source=(ROOT/'ports/lite/components/cgdn1_ui/cgdn1_ui.h').read_text()
        for value in ('unrecognized',source+source):
            with self.assertRaises(ValueError):m.bind_ui_release(value,{'version':'future','public_version':8})
if __name__=='__main__':unittest.main()
