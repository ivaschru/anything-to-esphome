"""Browser transport identity with unchanged pure disabled-CAS semantics."""
from dataclasses import replace
import importlib.util
import inspect
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

import test_monitor1_disabled_commit as native

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('qingping_browser_disabled_policy', ROOT / 'apps/monitor1_usb/rootfs/browser_disabled_commit_policy.py')
browser = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = browser
spec.loader.exec_module(browser)
BINDING = browser.WebUsbBinding('a' * 32, '22222222-2222-2222-2222-222222222222')
TARGET = (*native.TARGET[:4], BINDING)


def transaction(observed, direction='commit_disabled'):
    return browser.BrowserVendorTransaction(native.PLAN_ID, native.PLAN_SHA, TARGET, native.BOOT, direction, observed)


class BrowserSemanticTests(native.DisabledCommitTests):
    """Run the existing interruption/CAS cases with the distinct target type."""
    def setUp(self):
        for name,value in (('TARGET', TARGET), ('transaction', transaction)):
            fixture = patch.object(native,name,value)
            fixture.start();self.addCleanup(fixture.stop)


class BrowserBindingTests(unittest.TestCase):
    def test_explicit_binding_is_not_native_usb_or_a_serialized_object(self):
        observed = replace(native.snapshot(),target=TARGET)
        self.assertEqual(transaction(observed).state,'ready')
        with self.assertRaises(ValueError):
            native.policy.DisabledVendorTransaction(native.PLAN_ID,native.PLAN_SHA,TARGET,native.BOOT,'commit_disabled',observed)
        for binding in ('usb:fake','browser:fake',{'channel_id':BINDING.channel_id,'channel_nonce':BINDING.channel_nonce},None):
            target=(*TARGET[:4],binding)
            with self.subTest(binding=binding),self.assertRaises(ValueError):
                browser.BrowserVendorTransaction(native.PLAN_ID,native.PLAN_SHA,target,native.BOOT,'commit_disabled',replace(observed,target=target))

    def test_channel_replacement_refuses_an_outstanding_operation_without_replay(self):
        observed=replace(native.snapshot(),target=TARGET);action=transaction(observed)
        issued=action.issue(observed);after=native.applied(observed,issued)
        changed=(*TARGET[:4],browser.WebUsbBinding('b'*32,BINDING.channel_nonce))
        self.assertIsNone(action.acknowledge(replace(after,target=changed)))
        self.assertEqual(action.state,'reconciliation_required')
        self.assertIsNone(action.issue(observed))

    def test_binding_fields_are_finite_and_immutable(self):
        for identity,nonce in [('bad',BINDING.channel_nonce),(BINDING.channel_id,'bad'),(None,BINDING.channel_nonce)]:
            with self.assertRaises(ValueError):browser.WebUsbBinding(identity,nonce)
        with self.assertRaises(Exception):BINDING.channel_id='b'*32

    def test_nontransport_validation_is_verbatim_frozen_canonical_logic(self):
        native_text=inspect.getsource(native.policy.DisabledVendorTransaction._validate)
        browser_text=inspect.getsource(browser.BrowserVendorTransaction._validate)
        marker='        if (len(observed.root_identity) != 2'
        self.assertEqual(native_text[native_text.index(marker):],browser_text[browser_text.index(marker):])


if __name__=='__main__':unittest.main()
