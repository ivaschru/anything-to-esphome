"""Real async registry/frames joined to synthetic private terminal-stage data."""
import asyncio
import copy
import hashlib
import importlib.util
import json
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock

import test_usb_browser_stage_transfer as fixtures

sys.modules.setdefault('qingping_browser_contract.monitor1_browser_stage', fixtures.transfer)
observation_name='qingping_browser_contract.monitor1_worker.browser_disabled_observation'
observation_spec=importlib.util.spec_from_file_location(observation_name,fixtures.ROOT / 'monitor1_worker/browser_disabled_observation.py')
observation=importlib.util.module_from_spec(observation_spec)
sys.modules[observation_name]=observation
observation_spec.loader.exec_module(observation)

spec = importlib.util.spec_from_file_location('qingping_browser_contract.monitor1_browser_disabled_review', fixtures.ROOT / 'monitor1_browser_disabled_review.py')
review = importlib.util.module_from_spec(spec)
spec.loader.exec_module(review)
Refusal = fixtures.Refusal


class DisabledReviewTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.fixture=fixtures.TransferTests(methodName='runTest')
        await self.fixture.asyncSetUp();self.addCleanup(self.fixture.doCleanups)
        f=self.fixture
        self.reader=json.loads((fixtures.ROOT / 'monitor1_worker/disabled-contract.json').read_bytes())
        files=copy.deepcopy(f.files)
        for role,digest in self.reader['sources'].items():files[role]['sha256']=digest
        self.meta={'schema_version':1,'job_id':f.data['job_id'],'target':f.target,
            'descriptor':{**f.desc,'files':files},'commit_nonce':None}
        self.context={'schema_version':1,'job_id':f.data['job_id'],'plan_sha256':f.data['expected_plan_sha256'],
            'source_commit':review.SOURCE,'stage_state':'staged_disabled_verified','meta':self.meta,
            'reader_source_sha256':self.reader['source_sha256'],'sdk_policy_checked':False,'writer_enabled':False}
        self.data={key:f.data[key] for key in ('job_id','expected_plan_sha256','channel_id')}
        self.service=SimpleNamespace(browser_registry=f.registry,exchange=AsyncMock(side_effect=self.exchange))
        flag=[hashlib.sha256(b'').hexdigest(),0,0o600,0,1,False]
        self.scope={'kind':'browser_disabled_scope','target':f.target,'plan_id':f.desc['plan_id'],'plan_sha256':f.desc['plan_sha256'],
            'stage_intent_sha256':f.desc['intent_sha256'],'root_identity':[1,2],'install_marker':f.desc['plan_id']+' '+f.desc['plan_sha256'],
            'root_mode':0o700,'root_uid':0,'disabled_flags':[flag,flag],
            'source_hashes':[[k,v] for k,v in sorted(self.reader['sources'].items())],
            'vendor_hashes':[[k,v['sha256']] for k,v in sorted(f.stock.items())],
            'stock_process':[50,100,f.stock['/data/bin/SnowApp']['sha256'],0],'watchdog_process':[51,110,0],
            'own_code_running':False,'pm_helper_loaded':False,'data_available_bytes':32000000,'same_filesystem':True,
            'staged_files':files,'commit_nonce':None}
        self.events=[]

    async def exchange(self, owner, nonce, operation, data):
        self.assertEqual((owner, nonce), (self.fixture.owner, self.fixture.nonce))
        if operation == 'internal-browser-disabled-context':
            self.assertEqual(data, {'job_id': self.data['job_id'], 'expected_plan_sha256': self.data['expected_plan_sha256']})
            value = self.context
        else:
            self.assertEqual(operation, 'internal-browser-disabled-assess')
            self.assertEqual(data, {**self.data, 'channel_nonce': self.fixture.evidence['channel'], 'scope': self.scope})
            self.assertEqual(self.events, ['disabled-scope'])
            self.assertFalse(self.fixture.cap.closed)
            raw = observation.policy_input(self.data['job_id'], self.data['expected_plan_sha256'], self.data['channel_id'],
                self.fixture.evidence['channel'], self.scope)
            value = {'schema_version': 1, 'job_id': self.data['job_id'], 'plan_sha256': self.data['expected_plan_sha256'],
                'source_commit': review.SOURCE, 'observation_sha256': hashlib.sha256(raw).hexdigest(),
                'sdk_policy_checked': True, 'commit_admissible_for_review': True, 'state': 'factory_commit_admissible_for_review',
                'writer_enabled': False, 'installation_ready': False, 'live_recheck_required': True, 'device_writes': 0}
        return True, 'application/json', json.dumps(value).encode()

    async def pump(self, fail=None, expiry=False):
        f=self.fixture
        while True:
            request=await f.cap.poll()
            if request is None:continue
            op=request['operation'];self.events.append(op)
            self.assertIn(op,('disabled-scope','channel-close'),'No writer/API/launch frame')
            if op=='disabled-scope':self.assertEqual(request['data'],{'meta':self.meta})
            if expiry and op=='disabled-scope':
                f.registry.current['deadline']=0
            f.cap.answer({'id':request['id'],'ok':op!=fail,'data':self.scope if op=='disabled-scope' else None})
            if op==fail or op=='channel-close' or expiry:return

    async def run_review(self, fail=None, expiry=False):
        pump=asyncio.create_task(self.pump(fail,expiry))
        try:return await asyncio.wait_for(review.review(self.service,self.fixture.owner,self.fixture.nonce,self.data),2)
        finally:
            pump.cancel();await asyncio.gather(pump,return_exceptions=True)

    async def test_owned_terminal_context_fresh_scope_and_close_return_only_redacted_nonwriter_state(self):
        result=await self.run_review()
        self.assertEqual(result['state'],'browser_disabled_policy_assessed')
        self.assertEqual(result['device_writes'],0)
        self.assertTrue(result['sdk_policy_checked'] and result['commit_admissible_for_review'] and result['live_recheck_required'])
        self.assertFalse(result['writer_enabled'] or result['installation_ready'] or result['native_get_devpath'])
        self.assertEqual(self.events,['disabled-scope','channel-close'])
        self.assertEqual([v.args[2] for v in self.service.exchange.await_args_list],
            ['internal-browser-disabled-context','internal-browser-disabled-assess'])
        self.assertNotIn(self.fixture.target['wlan_mac'],json.dumps(result));self.assertNotIn('stock_process',result)

    async def test_foreign_owner_target_or_request_refuses_without_scope_read(self):
        f=self.fixture
        with self.assertRaises(Refusal):await review.review(self.service,'b'*32,f.nonce,self.data)
        with self.assertRaises(Refusal):await review.review(self.service,f.owner,f.nonce,{**self.data,'command':'reboot'})
        self.service.exchange.assert_not_awaited();self.assertTrue(f.cap.queue.empty())
        self.context['meta']['target']={**f.target,'boot_id':'44444444-4444-4444-4444-444444444444'}
        with self.assertRaises(Refusal):await self.run_review()
        self.assertEqual(self.events,['channel-close'])

    async def test_close_ack_loss_does_not_make_a_successful_observation_verified(self):
        with self.assertRaises(Refusal):await self.run_review(fail='channel-close')
        self.assertTrue(self.fixture.cap.failed)
        self.assertEqual(self.events.count('disabled-scope'),1)

    async def test_expiry_during_read_does_not_renew_the_original_channel(self):
        with self.assertRaises(Refusal):await self.run_review(expiry=True)
        self.assertTrue(self.fixture.cap.failed)
        self.assertEqual(self.events,['disabled-scope'])

    async def test_wrong_child_hash_or_channel_expiry_during_analysis_refuses_and_closes_once(self):
        original = self.exchange
        async def bad_result(owner, nonce, op, data):
            result = await original(owner, nonce, op, data)
            if op == 'internal-browser-disabled-assess':
                value = json.loads(result[2]);value['observation_sha256'] = '0' * 64
                return True, 'application/json', json.dumps(value).encode()
            return result
        self.service.exchange.side_effect = bad_result
        with self.assertRaises(Refusal):await self.run_review()
        self.assertEqual(self.events, ['disabled-scope', 'channel-close'])
        self.assertEqual(self.service.exchange.await_count, 2, 'No analysis retry on a lost/wrong reply')

    async def test_expiry_during_sdk_analysis_never_renews_or_adopts_capability(self):
        original = self.exchange
        async def expire(owner, nonce, op, data):
            result = await original(owner, nonce, op, data)
            if op == 'internal-browser-disabled-assess':self.fixture.registry.current['deadline'] = 0
            return result
        self.service.exchange.side_effect = expire
        with self.assertRaises(Refusal):await self.run_review()
        self.assertEqual(self.events, ['disabled-scope', 'channel-close'])

    def test_unknown_or_incomplete_observations_never_mean_absent_running_code(self):
        cases=[{'own_code_running':None},{'pm_helper_loaded':0},{'root_identity':[True,2]},
            {'data_available_bytes':1},{'stock_process':[50,100,'0'*64,0]},
            {'watchdog_process':[50,110,0]},{'same_filesystem':1},{'usb_transport':'usb:invented'},
            {'vendor_hashes':self.scope['vendor_hashes'][:-1]},{'root_mode':True}]
        for delta in cases:
            with self.subTest(delta=delta),self.assertRaises(Refusal):review.validate_scope({**self.scope,**delta},self.meta,self.reader)
        for delta in ({'sdk_policy_checked':True},{'stage_state':'browser_stage_unverified'},
                      {'writer_enabled':True},{'reader_source_sha256':{}}):
            value={**self.context,**delta}
            with self.subTest(delta=delta),self.assertRaises(Refusal):review.context((True,'application/json',json.dumps(value).encode()),self.data)


if __name__=='__main__':unittest.main()
