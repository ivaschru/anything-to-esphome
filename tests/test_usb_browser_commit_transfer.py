"""Private Core -> real registry/actor/journal, synthetic USB/SDK boundary.

Actual private fsync/flock and finite async frames run. The source/SDK fixture
is explicit and no byte reaches a monitor; reported scope/close evidence here
must never be called physical qualification.
"""
import asyncio
import copy
import importlib.util
import json
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, Mock, patch

import test_usb_browser_commit as journals
import test_usb_browser_disabled_review as readers

sys.modules.setdefault('qingping_browser_contract.monitor1_browser_disabled_review',readers.review)
spec=importlib.util.spec_from_file_location('qingping_browser_contract.monitor1_browser_commit',readers.fixtures.ROOT/'monitor1_browser_commit.py')
transfer=importlib.util.module_from_spec(spec);spec.loader.exec_module(transfer)
Refusal=readers.Refusal


class CommitTransferTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.j=journals.CommitTests(methodName='runTest');self.j.setUp();self.addCleanup(self.j.doCleanups)
        j=self.j
        self.registry=readers.fixtures.fixtures.registry_module.BrowserRegistry();self.addCleanup(self.registry.stop)
        app=journals.fixtures.plans.core_actor.Companion(j.f.fixture.fixture.fixture.fixture.capture.usb,j.directory.parent)
        app.browser_stages=j.stages;self.owner=j.owner;self.nonce=app.page(self.owner)
        self.usb=Mock(side_effect=AssertionError('Browser path must never initialize native ADB'))
        self.actor=journals.fixtures.plans.core_actor.Actor(app,usb_ready=self.usb)
        target=j.meta['target']
        evidence={'kind':'browser_webusb','channel':j.channel_nonce,'serial':target['usb_serial'],
                  **{k:target[k] for k in ('wlan_mac','boot_id','co2_type','stock_version')},'native_get_devpath':False}
        self.id=self.registry.open(self.owner,self.nonce,{'evidence':evidence})['channel_id']
        self.cap=self.registry.capability(self.owner,self.nonce,self.id)
        j.channel=self.id;j.scope['channel_id']=self.id
        raw=journals.policy_input(j.id,j.sha,j.channel,j.channel_nonce,j.observed)
        j.assessment['observation_sha256']=journals.hashlib.sha256(raw).hexdigest()
        context=patch.object(j.stages,'disabled_context',return_value=j.context)
        context.start();self.addCleanup(context.stop)
        self.data={'job_id':j.id,'expected_plan_sha256':j.sha,'channel_id':self.id,'experimental_reviewed':True}
        self.service=SimpleNamespace(browser_registry=self.registry,exchange=AsyncMock(side_effect=self.exchange))
        self.events=[];self.operations=[];self.packet=None;self.lost_packet=False;self.bad_packet=False
        self.mutate_scope=False;self.close_acks=0

    async def exchange(self,owner,nonce,operation,data):
        self.assertEqual((owner,nonce),(self.owner,self.nonce));self.operations.append(operation)
        if operation=='internal-browser-commit-record':
            self.assertTrue(self.cap.closed);self.assertFalse(self.cap.failed);self.assertEqual(self.close_acks,1)
            self.assertEqual(self.events[-1],'channel-close')
        value,mime=self.actor.dispatch({'user':owner,'nonce':nonce,'operation':operation,'data':data})
        if operation=='internal-browser-commit-prepare':
            self.assertEqual(self.events,['commit-stream-check','disabled-scope'])
            self.assertEqual(data['scope'],self.j.scope);self.assertIsNotNone(self.j.stages.lease_fd)
            self.packet=copy.deepcopy(value)
            if self.lost_packet:raise RuntimeError('synthetic lost private packet')
            if self.bad_packet:value={**value,'producer_sha256':{}}
        return True,mime,json.dumps(value).encode()

    async def pump(self,fail=None,expire=None):
        while True:
            request=await self.cap.poll()
            if request is None:continue
            op,data=request['operation'],request['data'];label=op+(':'+data['phase'] if op=='commit-step' else '')
            self.events.append(label)
            if op=='commit-stream-check':
                self.assertIsNone(data)
                value={'kind':'browser_fixed_stdin_probe','service':'exec:/bin/sh','ready':True,'device_files_changed':False,'writer_enabled':False}
            elif op=='disabled-scope':
                self.assertEqual(data,{'meta':self.j.meta});value=self.j.observed
            elif op=='commit-prepare':
                self.assertEqual(data,{'packet':self.packet});value={'state':'commit_scope_rechecked','writer_enabled':False}
            elif op=='commit-step':
                phase=data['phase'];index=['claim','watchdog','start'].index(phase)
                observed=self.j.proof(self.packet)['observations'][index]
                if self.mutate_scope and phase=='watchdog':observed['root_identity']=[1,3]
                value={'phase':phase,'completed':True,'scope':observed}
            elif op=='commit-complete':value=self.j.proof(self.packet)
            elif op=='channel-close':self.close_acks+=1;value=None
            else:self.fail('No API/SYNC/generic shell frames in commit composition')
            if label==expire:self.registry.current['deadline']=0
            self.cap.answer({'id':request['id'],'ok':label!=fail,'data':value})
            if op=='channel-close' or label==fail:return

    async def run_commit(self,fail=None,expire=None):
        pump=asyncio.create_task(self.pump(fail,expire))
        try:return await asyncio.wait_for(transfer.commit(self.service,self.owner,self.nonce,self.data),3)
        finally:pump.cancel();await asyncio.gather(pump,return_exceptions=True)

    async def test_fixed_probe_fresh_scope_consumed_packet_each_readback_and_both_closes_precede_record(self):
        value=await self.run_commit()
        self.assertEqual(value['state'],'committed_disabled_verified')
        self.assertFalse(value['installed'] or value['activated'] or value['writer_enabled'] or value['replay_allowed'])
        self.assertEqual(self.events,['commit-stream-check','disabled-scope','commit-prepare','commit-step:claim',
          'commit-step:watchdog','commit-step:start','commit-complete','channel-close'])
        self.assertEqual(self.operations,['internal-browser-disabled-context','internal-browser-commit-prepare','internal-browser-commit-record'])
        self.assertIsNone(self.j.stages.lease_fd);self.usb.assert_not_called()
        self.assertNotIn(self.j.channel_nonce,json.dumps(value));self.assertNotIn('producer_sha256',value)
        self.assertEqual((self.j.directory/'profile.json').read_bytes(),self.j.before)

    async def test_unsupported_probe_stops_before_new_intent_without_a_fallback(self):
        with self.assertRaises(Refusal):await self.run_commit(fail='commit-stream-check')
        self.assertFalse((self.j.directory/journals.commits.INTENT).exists())
        self.assertEqual(self.operations,['internal-browser-disabled-context']);self.assertEqual(self.events,['commit-stream-check'])

    async def test_lost_packet_is_not_redelivered_and_retains_actual_writer_lease(self):
        self.lost_packet=True
        with self.assertRaises(Refusal):await self.run_commit()
        self.assertEqual(self.events,['commit-stream-check','disabled-scope','channel-close'])
        self.assertEqual(self.j.manager.status(self.owner,self.j.id)['state'],'browser_commit_unverified')
        self.assertIsNotNone(self.j.stages.lease_fd)
        with self.assertRaises(Refusal):await transfer.commit(self.service,self.owner,self.nonce,self.data)
        self.assertEqual(self.operations.count('internal-browser-commit-prepare'),1)

    async def test_wrong_packet_producer_never_issues_a_command_or_claim(self):
        self.bad_packet=True
        with self.assertRaises(Refusal):await self.run_commit()
        self.assertNotIn('commit-prepare',self.events);self.assertIsNotNone(self.j.stages.lease_fd)
        self.assertNotIn('internal-browser-commit-record',self.operations)

    async def test_lost_write_ack_never_rolls_back_retries_or_releases_lease(self):
        with self.assertRaises(Refusal):await self.run_commit(fail='commit-step:watchdog')
        self.assertEqual(self.events.count('commit-step:watchdog'),1);self.assertNotIn('commit-step:start',self.events)
        self.assertIsNotNone(self.j.stages.lease_fd);self.assertNotIn('internal-browser-commit-record',self.operations)

    async def test_wrong_independent_scope_stops_before_following_rename(self):
        self.mutate_scope=True
        with self.assertRaises(Refusal):await self.run_commit()
        self.assertNotIn('commit-step:start',self.events);self.assertNotIn('internal-browser-commit-record',self.operations)
        self.assertIsNotNone(self.j.stages.lease_fd)

    async def test_separate_channel_close_ack_loss_cannot_record_terminal_device_proof(self):
        with self.assertRaises(Refusal):await self.run_commit(fail='channel-close')
        self.assertIn('commit-complete',self.events);self.assertEqual(self.close_acks,1)
        self.assertNotIn('internal-browser-commit-record',self.operations);self.assertIsNotNone(self.j.stages.lease_fd)

    async def test_original_deadline_expiry_never_renews_channel_or_records_partial_work(self):
        with self.assertRaises(Refusal):await self.run_commit(expire='commit-step:claim')
        self.assertNotIn('commit-step:watchdog',self.events);self.assertNotIn('internal-browser-commit-record',self.operations)
        self.assertIsNotNone(self.j.stages.lease_fd)

    async def test_foreign_owner_or_extra_command_refuses_before_actor_or_usb(self):
        with self.assertRaises(Refusal):await transfer.commit(self.service,'b'*32,self.nonce,self.data)
        with self.assertRaises(Refusal):await transfer.commit(self.service,self.owner,self.nonce,{**self.data,'command':'not admitted'})
        self.service.exchange.assert_not_awaited();self.usb.assert_not_called();self.assertTrue(self.cap.queue.empty())


if __name__=='__main__':unittest.main()
