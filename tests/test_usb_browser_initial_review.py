"""Real async original registry/finite frames; synthetic guardian/device data."""
import asyncio
import copy
import importlib.util
import json
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock

import test_usb_browser_disabled_review as fixtures

sys.modules.setdefault('qingping_browser_contract.monitor1_browser_disabled_review', fixtures.review)
spec = importlib.util.spec_from_file_location('qingping_browser_contract.monitor1_browser_initial_review',
    fixtures.fixtures.ROOT / 'monitor1_browser_initial_review.py')
review = importlib.util.module_from_spec(spec);spec.loader.exec_module(review)
Refusal = fixtures.Refusal


class InitialReviewTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.f = fixtures.DisabledReviewTests(methodName='runTest')
        await self.f.asyncSetUp();self.addCleanup(self.f.doCleanups)
        f = self.f
        self.meta = copy.deepcopy(f.meta);self.meta['commit_nonce'] = 'a' * 32
        self.scope = copy.deepcopy(f.scope);self.scope['commit_nonce'] = self.meta['commit_nonce']
        for pair in self.scope['vendor_hashes']:
            if pair[0] in f.reader['patched']:pair[1] = f.reader['patched'][pair[0]]['sha256']
        self.context = {'schema_version':1, 'job_id':f.data['job_id'], 'plan_sha256':f.data['expected_plan_sha256'],
            'source_commit':review.SOURCE, 'commit_intent_sha256':'1'*64, 'commit_proof_sha256':'2'*64,
            'candidate_sha256':'3'*64, 'guardian':{'size':1000,'sha256':'4'*64}, 'meta':self.meta,
            'committed_scope':copy.deepcopy(self.scope), 'context_only':True, 'guardian_artifact_checked':True,
            'image_fd_admitted':False, 'hardware_contacted':False, 'device_writes':0, 'writer_enabled':False,
            'installation_ready':False, 'live_recheck_required':True}
        self.preparation = {'kind':'browser_initial_trial_preparation','scope':self.scope,'ram_available_bytes':64*1024**2,
            'memory_basis':'MemFree_lower_bound','persistent_stores_absent':True,'ram_processes_absent':True,
            'api_ota_listeners_free':True,'ram_scope_checked':False,'image_fd_admitted':False,
            'execution_authority':False,'device_writes':0}
        self.events=[];self.context_reads=0
        self.service=SimpleNamespace(browser_registry=f.fixture.registry,exchange=AsyncMock(side_effect=self.exchange))

    async def exchange(self, owner, nonce, operation, data):
        f=self.f
        self.assertEqual((owner,nonce),(f.fixture.owner,f.fixture.nonce))
        self.assertEqual(operation,'internal-browser-initial-trial-context')
        self.assertEqual(data,{k:f.data[k] for k in ('job_id','expected_plan_sha256')})
        self.assertFalse(f.fixture.cap.closed)
        self.context_reads+=1
        return True,'application/json',json.dumps(self.context).encode()

    async def pump(self, fail=None, expiry=False):
        f=self.f.fixture
        while True:
            request=await f.cap.poll()
            if request is None:continue
            operation=request['operation'];self.events.append(operation)
            self.assertIn(operation,('initial-trial-preparation','channel-close'),'No RAM/write/API/launch frame')
            if operation=='initial-trial-preparation':
                self.assertEqual(request['data'],{'meta':self.meta})
                if expiry:f.registry.current['deadline']=0
            f.cap.answer({'id':request['id'],'ok':operation!=fail,
                'data':self.preparation if operation=='initial-trial-preparation' else None})
            if operation=='channel-close' or operation==fail or expiry:return

    async def run_review(self,fail=None,expiry=False):
        pump=asyncio.create_task(self.pump(fail,expiry));f=self.f.fixture
        try:return await asyncio.wait_for(review.review(self.service,f.owner,f.nonce,self.f.data),2)
        finally:pump.cancel();await asyncio.gather(pump,return_exceptions=True)

    async def test_actual_frames_join_same_commit_sdk_before_after_and_independent_close_without_writer(self):
        self.scope['data_available_bytes']-=4096  # Capacity alone may vary.
        result=await self.run_review()
        self.assertEqual(self.events,['initial-trial-preparation','channel-close']);self.assertEqual(self.context_reads,2)
        self.assertEqual(result['state'],'browser_initial_trial_preparation_observed')
        self.assertTrue(result['guardian_artifact_checked'] and result['hardware_contacted'] and result['live_recheck_required'])
        for name in ('ram_scope_checked','image_fd_admitted','execution_authority','installed','installation_ready','writer_enabled'):
            self.assertIs(result[name],False)
        self.assertEqual(result['device_writes'],0)
        self.assertNotIn(self.meta['commit_nonce'],json.dumps(result));self.assertNotIn('scope',result)
        self.assertNotIn(self.meta['target']['wlan_mac'],json.dumps(result))

    async def test_foreign_owner_or_extra_request_refuses_before_context_or_scope(self):
        f=self.f.fixture
        with self.assertRaises(Refusal):await review.review(self.service,'b'*32,f.nonce,self.f.data)
        with self.assertRaises(Refusal):await review.review(self.service,f.owner,f.nonce,{**self.f.data,'duration':600})
        self.service.exchange.assert_not_awaited();self.assertTrue(f.cap.queue.empty())

    async def test_recreated_root_or_changed_stock_birth_cannot_adopt_terminal_commit(self):
        self.scope['root_identity']=[1,3]
        with self.assertRaises(Refusal):await self.run_review()
        self.assertEqual(self.context_reads,1);self.assertEqual(self.events,['initial-trial-preparation','channel-close'])

    async def test_changed_guardian_proof_between_sdk_reads_refuses_and_never_retries(self):
        original=self.exchange
        async def changed(owner,nonce,op,data):
            if self.context_reads:self.context['commit_proof_sha256']='5'*64
            return await original(owner,nonce,op,data)
        self.service.exchange.side_effect=changed
        with self.assertRaises(Refusal):await self.run_review()
        self.assertEqual(self.context_reads,2);self.assertEqual(self.events,['initial-trial-preparation','channel-close'])

    async def test_missing_close_ack_does_not_complete_a_resource_review(self):
        with self.assertRaises(Refusal):await self.run_review(fail='channel-close')
        self.assertTrue(self.f.fixture.cap.failed)
        self.assertEqual(self.events.count('initial-trial-preparation'),1)

    async def test_original_deadline_expiring_during_collector_is_never_renewed(self):
        with self.assertRaises(Refusal):await self.run_review(expiry=True)
        self.assertTrue(self.f.fixture.cap.failed);self.assertEqual(self.context_reads,1)
        self.assertEqual(self.events,['initial-trial-preparation'])

    async def test_original_deadline_expiring_during_sdk_result_refuses_before_scope(self):
        original=self.exchange
        async def expired(owner,nonce,op,data):
            result=await original(owner,nonce,op,data);self.f.fixture.registry.current['deadline']=0
            return result
        self.service.exchange.side_effect=expired
        with self.assertRaises(Refusal):await self.run_review()
        self.assertEqual(self.events,['channel-close']);self.assertEqual(self.context_reads,1)

    def test_unknown_or_partial_flags_memory_scope_and_fd_truthiness_are_refused(self):
        cases=[{'persistent_stores_absent':None},{'ram_processes_absent':1},{'api_ota_listeners_free':False},
            {'ram_available_bytes':True},{'ram_available_bytes':32*1024**2-1},{'memory_basis':'MemAvailable'},
            {'ram_scope_checked':True},{'image_fd_admitted':0},{'execution_authority':True},{'device_writes':False},
            {'command':'not admitted'}]
        for delta in cases:
            with self.subTest(delta=delta),self.assertRaises(Refusal):
                review.validate_preparation({**self.preparation,**delta},self.meta,self.f.reader)
        factory=copy.deepcopy(self.scope);factory['vendor_hashes']=self.f.scope['vendor_hashes']
        with self.assertRaises(Refusal):review.validate_preparation({**self.preparation,'scope':factory},self.meta,self.f.reader)

    def test_context_needs_exact_sdk_artifact_and_original_committed_scope(self):
        data=self.f.data
        for delta in ({'guardian_artifact_checked':1},{'image_fd_admitted':True},{'device_writes':False},
                      {'commit_proof_sha256':'bad'},{'committed_scope':{}},{'writer_enabled':True}):
            with self.subTest(delta=delta),self.assertRaises(Refusal):
                review.context((True,'application/json',json.dumps({**self.context,**delta}).encode()),data)


if __name__=='__main__':unittest.main()
