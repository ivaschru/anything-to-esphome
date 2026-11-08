"""Real private journal/fsync/flock and synthetic scope/SDK only; no device.

The source/SDK admission boundary is explicitly replaced, since these fixture
payloads are not firmware. Its real source/mode/fingerprint checks are covered
separately. Never execute generated shell, an interpreter fixture or a device.
"""
import copy
import fcntl
import hashlib
import json
import os
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

import test_usb_browser_stage as fixtures
with patch.object(sys, 'path', [str(fixtures.plans.HERE), *sys.path]):
    import browser_commit as commits
    from browser_disabled_observation import validate_scope, policy_input


class CommitTests(unittest.TestCase):
    def setUp(self):
        self.f=fixtures.StageTests(methodName='runTest');self.f.setUp();self.addCleanup(self.f.doCleanups)
        packet=json.loads(self.f.prepare())
        self.f.manager.record(self.f.owner,self.f.id,packet['descriptor']['intent_sha256'],self.f.proof(packet))
        self.stages,self.owner,self.id,self.directory=self.f.manager,self.f.owner,self.f.id,self.f.directory
        self.sha=self.f.plan['plan_sha256'];self.channel,self.channel_nonce=self.f.scope['channel_id'],self.f.scope['channel_nonce']
        self.manager=commits.BrowserCommits(self.stages)
        self.reader=json.loads((fixtures.plans.HERE/'disabled-contract.json').read_bytes())
        files=copy.deepcopy(packet['descriptor']['files'])
        for role,digest in self.reader['sources'].items():files[role]['sha256']=digest
        self.meta={'schema_version':1,'job_id':self.id,'target':packet['target'],
                   'descriptor':{**packet['descriptor'],'files':files},'commit_nonce':None}
        self.context={'schema_version':1,'job_id':self.id,'plan_sha256':self.sha,'source_commit':self.f.raw_plan['basis']['source_commit'],
                      'meta':self.meta,'stage_state':'staged_disabled_verified','reader_source_sha256':self.reader['source_sha256'],
                      'sdk_policy_checked':False,'writer_enabled':False}
        pins=json.loads((fixtures.plans.HERE/'contract.json').read_bytes())['files']
        flag=[hashlib.sha256(b'').hexdigest(),0,0o600,0,1,False]
        self.observed={'kind':'browser_disabled_scope','target':self.meta['target'],'plan_id':packet['descriptor']['plan_id'],
          'plan_sha256':self.sha,'stage_intent_sha256':packet['descriptor']['intent_sha256'],'root_identity':[1,2],
          'install_marker':packet['descriptor']['plan_id']+' '+self.sha,'root_mode':0o700,'root_uid':0,'disabled_flags':[flag,flag],
          'source_hashes':sorted([k,v] for k,v in self.reader['sources'].items()),
          'vendor_hashes':sorted([p['path'],p['sha256']] for p in pins),'stock_process':[50,100,pins[0]['sha256'],0],
          'watchdog_process':[51,110,0],'own_code_running':False,'pm_helper_loaded':False,'data_available_bytes':32000000,
          'same_filesystem':True,'staged_files':files,'commit_nonce':None}
        self.scope={'channel_id':self.channel,'channel_nonce':self.channel_nonce,'observation':self.observed}
        self.base_patch=patch.object(commits.BrowserCommits,'_base',side_effect=self.base)
        self.base_patch.start();self.addCleanup(self.base_patch.stop)
        self.assessment={'schema_version':1,'job_id':self.id,'plan_sha256':self.sha,'source_commit':self.context['source_commit'],
          'observation_sha256':hashlib.sha256(policy_input(self.id,self.sha,self.channel,self.channel_nonce,self.observed)).hexdigest(),
          'sdk_policy_checked':True,'commit_admissible_for_review':True,'state':'factory_commit_admissible_for_review',
          'device_writes':0,'writer_enabled':False,'installation_ready':False,'live_recheck_required':True}
        assessor=patch.object(self.stages,'assess_disabled',return_value=self.assessment)
        self.assessor=assessor.start();self.addCleanup(assessor.stop)
        self.before=(self.directory/'profile.json').read_bytes()

    def base(self,owner,job,sha,channel,nonce,scope):
        if (owner,job,sha,channel,nonce)!=(self.owner,self.id,self.sha,self.channel,self.channel_nonce):commits.invalid()
        validate_scope(scope,self.meta,self.reader)
        return self.directory,copy.deepcopy(self.context),policy_input(job,sha,channel,nonce,scope)

    def prepare(self,scope=None,reviewed=True):
        return self.manager.prepare(self.owner,self.id,self.sha,self.scope if scope is None else scope,reviewed)

    def proof(self,packet):
        observations=[]
        for index in range(3):
            observed=copy.deepcopy(self.observed);observed['commit_nonce']=packet['nonce']
            for pair in observed['vendor_hashes']:
                if index>=1 and pair[0]=='/data/bin/watchdog.sh' or index==2 and pair[0]=='/data/etc/init.d/start.sh':
                    pair[1]=self.reader['patched'][pair[0]]['sha256']
            observations.append(observed)
        return {'schema_version':1,'job_id':self.id,'plan_sha256':self.sha,'intent_sha256':packet['intent_sha256'],
          'channel_id':self.channel,'channel_nonce':self.channel_nonce,'nonce':packet['nonce'],
          'commands_acknowledged':['claim','watchdog','start'],'observations':observations,
          'transport_closed':True,'program_started':False,'boot_flags_changed':False}

    def test_consumed_packet_and_real_flock_require_all_three_independent_scopes_then_closed_transport(self):
        original=commits.BrowserCommits._packet
        def before_packet(value,digest,context):
            self.assertTrue((self.directory/commits.INTENT).is_file())
            self.assertEqual((self.directory/commits.INTENT).stat().st_mode&0o777,0o600)
            return original(value,digest,context)
        with patch.object(commits.BrowserCommits,'_packet',side_effect=before_packet):packet=self.prepare()
        fd=os.open(self.directory.parent.parent/'native-install.lock',os.O_RDWR|os.O_NOFOLLOW)
        try:
            with self.assertRaises(BlockingIOError):fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
            result=self.manager.status(self.owner,self.id)
            self.assertEqual(result['state'],'browser_commit_unverified');self.assertIsNone(result['device_write_attempted'])
            result=self.manager.record(self.owner,self.id,packet['intent_sha256'],self.proof(packet))
            self.assertEqual(result['state'],'committed_disabled_verified')
            self.assertFalse(result['installed'] or result['activated'] or result['writer_enabled'] or result['replay_allowed'])
            fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
            self.assertIsNone(self.stages.lease_fd)
        finally:os.close(fd)
        self.assertEqual((self.directory/'profile.json').read_bytes(),self.before)
        self.stages.fence_all()  # Only another job, never replay this commit.
        with self.assertRaises(Exception):self.prepare()
        with self.assertRaises(Exception):self.manager.record(self.owner,self.id,packet['intent_sha256'],self.proof(packet))

    def test_lost_packet_keeps_consumed_history_and_kernel_lease_without_another_assessment(self):
        with patch.object(commits.BrowserCommits,'_packet',side_effect=RuntimeError('lost private packet')):
            with self.assertRaises(RuntimeError):self.prepare()
        self.assertEqual(self.manager.status(self.owner,self.id)['state'],'browser_commit_unverified')
        self.assertIsNotNone(self.stages.lease_fd)
        with self.assertRaises(Exception):self.prepare()
        self.assertEqual(self.assessor.call_count,1)
        self.stages.close()  # Simulated owner-process exit, never device action.
        native=SimpleNamespace(plans=SimpleNamespace(builds=self.f.fixture.manager.builds))
        with self.assertRaisesRegex(Exception,'usb_browser_stage_previous_unverified'):
            fixtures.stage.fence_browser_stage(native,self.directory,self.owner)
        with self.assertRaisesRegex(Exception,'usb_browser_stage_previous_unverified'):self.stages.fence_all()

    def test_missing_ack_partial_order_or_changed_scope_never_releases_lease_or_creates_completion(self):
        packet=self.prepare();original=self.proof(packet)
        cases=[{'transport_closed':False},{'commands_acknowledged':['claim','start']},{'program_started':None},
               {'boot_flags_changed':True},{'channel_nonce':'00000000-0000-0000-0000-000000000000'},
               {'intent_sha256':'0'*64},{'observations':original['observations'][:2]}]
        for index,key,value in [(0,'root_identity',[1,3]),(1,'stock_process',[50,101,self.observed['stock_process'][2],0]),
                                (2,'disabled_flags',[]),(2,'data_available_bytes',1),(1,'commit_nonce',None)]:
            observed=copy.deepcopy(original['observations']);observed[index][key]=value;cases.append({'observations':observed})
        swapped=copy.deepcopy(original['observations']);swapped[0],swapped[2]=swapped[2],swapped[0];cases.append({'observations':swapped})
        for delta in cases:
            with self.subTest(delta=delta),self.assertRaises(Exception):
                self.manager.record(self.owner,self.id,packet['intent_sha256'],{**original,**delta})
            self.assertFalse((self.directory/commits.COMPLETE).exists());self.assertIsNotNone(self.stages.lease_fd)

    def test_fresh_actor_cannot_adopt_consumed_packet_or_lease_and_status_is_redacted(self):
        packet=self.prepare();self.stages.close()
        fresh=fixtures.stage.BrowserStages(self.f.fixture.manager)
        manager=commits.BrowserCommits(fresh)
        with self.assertRaises(Exception):manager.record(self.owner,self.id,packet['intent_sha256'],self.proof(packet))
        with self.assertRaises(Exception):manager.prepare(self.owner,self.id,self.sha,self.scope,True)
        value=manager.status(self.owner,self.id)
        self.assertNotIn(packet['nonce'],json.dumps(value));self.assertNotIn(self.channel_nonce,json.dumps(value))
        self.assertNotIn('initial_scope',value);self.assertIsNone(fresh.lease_fd)

    def test_bad_review_scope_or_sdk_answer_refuses_before_consuming_and_releases_owned_lock(self):
        with self.assertRaises(Exception):self.prepare(reviewed=False)
        for scope in ({**self.scope,'command':'not admitted'}, {**self.scope,'channel_id':'bad'},
                      {**self.scope,'observation':{**self.observed,'pm_helper_loaded':None}}):
            with self.subTest(scope=scope),self.assertRaises(Exception):self.prepare(scope=scope)
        self.assessment['commit_admissible_for_review']=False;self.assessment['state']='known_scope_not_admissible'
        with self.assertRaises(Exception):self.prepare()
        self.assertFalse((self.directory/commits.INTENT).exists());self.assertIsNone(self.stages.lease_fd)

    def test_orphan_completion_or_changed_producer_is_not_empty_history(self):
        fixtures.stage.write_new(self.directory/commits.COMPLETE,b'{}')
        with self.assertRaises(Exception):self.manager.status(self.owner,self.id)
        with self.assertRaises(Exception):self.prepare()
        self.assertFalse((self.directory/commits.INTENT).exists())

    def test_changed_producer_or_foreign_owner_cannot_read_or_renew_consumed_history(self):
        self.prepare()
        with patch.object(commits,'producer',return_value={'changed':'0'*64}):
            with self.assertRaises(Exception):self.manager.status(self.owner,self.id)
            with self.assertRaises(Exception):self.stages.fence_all()
        with self.assertRaises(Exception):self.manager.status('b'*32,self.id)
        self.assertIsNotNone(self.stages.lease_fd)
        self.assertFalse((self.directory/commits.COMPLETE).exists())

    def test_private_actor_dispatch_never_initializes_native_adb_or_exposes_a_generic_command(self):
        app=fixtures.plans.core_actor.Companion(self.f.fixture.fixture.fixture.fixture.capture.usb,self.directory.parent)
        app.browser_stages=self.stages;nonce=app.page(self.owner);usb=Mock()
        actor=fixtures.plans.core_actor.Actor(app,usb_ready=usb)
        def call(operation,data):return actor.dispatch({'user':self.owner,'nonce':nonce,'operation':operation,'data':data})
        packet,mime=call('internal-browser-commit-prepare',{'job_id':self.id,'expected_plan_sha256':self.sha,
                          'scope':self.scope,'experimental_reviewed':True})
        self.assertEqual(mime,'application/json');self.assertNotIn('command',packet);self.assertNotIn('payloads',packet)
        result,_=call('internal-browser-commit-record',{'job_id':self.id,'intent_sha256':packet['intent_sha256'],'proof':self.proof(packet)})
        self.assertEqual(result['state'],'committed_disabled_verified')
        status,_=call('internal-browser-commit-status',{'job_id':self.id});self.assertEqual(status,result)
        usb.assert_not_called()
        with self.assertRaises(Exception):call('internal-browser-commit-prepare',{'job_id':self.id,'command':'not admitted'})


if __name__=='__main__':unittest.main()
