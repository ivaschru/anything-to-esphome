"""Real consumed journal/private FD/flock; synthetic candidate/SDK only.

No transport, RAM allocation, program execution or device proof is supplied.
The incomplete terminal lifecycle intentionally cannot release a consumed
trial's fence or produce a success/installed result.
"""
import base64
import copy
import fcntl
import hashlib
import json
import os
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

import test_usb_browser_initial_trial as fixtures

with patch.object(sys,'path',[str(fixtures.HERE),*sys.path]):
    import browser_initial_journal as journal
    import browser_initial_observation as observation
    import computer_package as computer


class JournalTests(unittest.TestCase):
    def setUp(self):
        self.f=fixtures.TrialContextTests(methodName='runTest');self.f.setUp();self.addCleanup(self.f.doCleanups)
        self.directory,self.stages=self.f.directory,self.f.stages
        self.owner,self.job,self.sha=self.f.f.owner,self.f.f.id,self.f.f.sha
        self.manager=journal.BrowserInitialTrials(self.stages)
        value=self.f.read()
        self.preparation={'kind':'browser_initial_trial_preparation','scope':copy.deepcopy(value['committed_scope']),
            'ram_available_bytes':64*1024**2,'memory_basis':'MemFree_lower_bound','persistent_stores_absent':True,
            'ram_processes_absent':True,'api_ota_listeners_free':True,'ram_scope_checked':False,
            'image_fd_admitted':False,'execution_authority':False,'device_writes':0}
        self.scope={'channel_id':self.f.f.channel,'channel_nonce':self.f.f.channel_nonce,'observation':self.preparation}
        self.context_patch=patch.object(journal,'context',side_effect=lambda stages,owner,job,sha: self.f.read())
        self.context_patch.start();self.addCleanup(self.context_patch.stop)

    def prepare(self,scope=None,reviewed=True):
        return self.manager.prepare(self.owner,self.job,self.sha,self.scope if scope is None else scope,reviewed)

    def test_one_private_guardian_packet_follows_fsync_and_retains_writer_lock_without_terminal_claim(self):
        original=journal.private_bytes
        def consumed(path,pin):
            marker=self.directory/journal.INTENT
            self.assertTrue(marker.is_file());self.assertEqual(marker.stat().st_mode&0o777,0o600)
            self.assertIsNotNone(self.stages.lease_fd)
            return original(path,pin)
        with patch.object(journal,'private_bytes',side_effect=consumed):raw=self.prepare()
        packet=json.loads(raw)
        self.assertEqual(base64.b64decode(packet['guardian_body']),self.f.guardian.read_bytes())
        self.assertEqual(packet['context']['guardian']['sha256'],hashlib.sha256(self.f.guardian.read_bytes()).hexdigest())
        self.assertEqual(packet['intent_sha256'],hashlib.sha256((self.directory/journal.INTENT).read_bytes()).hexdigest())
        self.assertEqual(len({packet[k] for k in ('nonce','ram_job_id','guardian_job_id')}),3)
        self.assertNotIn('usb_transport',packet['context']['meta']['target'])
        self.assertFalse(packet['context']['image_fd_admitted'] or packet['preparation']['ram_scope_checked'])
        self.assertEqual(set(packet['producer_sha256']),set(journal.PRODUCERS))
        fd=os.open(self.directory.parent.parent/'native-install.lock',os.O_RDWR|os.O_NOFOLLOW)
        try:
            with self.assertRaises(BlockingIOError):fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
        finally:os.close(fd)
        calls=len(self.f.calls)
        result=self.manager.status(self.owner,self.job)
        self.assertEqual(result['state'],'browser_initial_trial_unverified')
        self.assertIsNone(result['device_write_attempted']);self.assertIsNone(result['launch_attempted'])
        self.assertFalse(result['replay_allowed'] or result['installed'] or result['activated'] or result['writer_enabled'])
        self.assertNotIn(packet['nonce'],json.dumps(result));self.assertNotIn('guardian_body',result)
        self.assertEqual(len(self.f.calls),calls,'Status never starts another SDK')
        with self.assertRaises(Exception): self.manager.record(self.owner,self.job,packet['intent_sha256'],{})
        self.assertFalse((self.directory/journal.COMPLETE).exists(),'A consumed packet alone is no terminal proof')
        with self.assertRaises(Exception):self.prepare()

    def test_lost_packet_preserves_consumption_and_all_native_browser_fences_across_restart(self):
        with patch.object(journal.BrowserInitialTrials,'_packet',side_effect=RuntimeError('synthetic lost packet')):
            with self.assertRaises(RuntimeError):self.prepare()
        self.assertIsNotNone(self.stages.lease_fd)
        with self.assertRaises(Exception):self.prepare()
        self.stages.close()  # This actor's actual host FD only; no device signal.
        with self.assertRaisesRegex(Exception,'usb_browser_stage_previous_unverified'):self.stages.fence_all()
        native=SimpleNamespace(plans=SimpleNamespace(builds=self.f.f.f.fixture.manager.builds))
        with self.assertRaisesRegex(Exception,'usb_browser_stage_previous_unverified'):
            fixtures.commits.fixtures.stage.fence_browser_stage(native,self.directory,self.owner)
        fresh=fixtures.commits.fixtures.stage.BrowserStages(self.stages.plans)
        other=journal.BrowserInitialTrials(fresh)
        self.assertEqual(other.status(self.owner,self.job)['state'],'browser_initial_trial_unverified')
        with self.assertRaises(Exception):other.prepare(self.owner,self.job,self.sha,self.scope,True)
        self.assertIsNone(fresh.lease_fd,'A new actor cannot adopt the old lease or issue a packet')

    def test_bad_review_channel_scope_or_resources_refuse_before_consumption(self):
        with self.assertRaises(Exception):self.prepare(reviewed=False)
        for scope in ({**self.scope,'command':'not admitted'}, {**self.scope,'channel_id':'bad'},
                      {**self.scope,'channel_nonce':'bad'}):
            with self.subTest(scope=scope),self.assertRaises(Exception):self.prepare(scope)
        for delta in ({'image_fd_admitted':True},{'ram_scope_checked':True},{'ram_available_bytes':1},
                      {'ram_processes_absent':None},{'api_ota_listeners_free':1},{'device_writes':False}):
            scope={**self.scope,'observation':{**self.preparation,**delta}}
            with self.subTest(delta=delta),self.assertRaises(Exception):self.prepare(scope)
            self.assertIsNone(self.stages.lease_fd)
        self.assertFalse((self.directory/journal.INTENT).exists())

    def test_recreated_root_or_wrong_committed_scope_refuses_even_with_same_files(self):
        scope=copy.deepcopy(self.scope);scope['observation']['scope']['root_identity']=[1,3]
        with self.assertRaises(Exception):self.prepare(scope)
        self.assertFalse((self.directory/journal.INTENT).exists());self.assertIsNone(self.stages.lease_fd)

    def test_body_or_sdk_read_failure_after_consumption_keeps_unknown_history_and_lock(self):
        with patch.object(journal,'private_bytes',side_effect=OSError('synthetic read failure')):
            with self.assertRaises(OSError):self.prepare()
        self.assertTrue((self.directory/journal.INTENT).exists());self.assertIsNotNone(self.stages.lease_fd)
        self.assertEqual(self.manager.status(self.owner,self.job)['state'],'browser_initial_trial_unverified')

    def test_unknown_or_orphan_completion_and_changed_producer_never_mean_completed(self):
        fixtures.commits.fixtures.stage.write_new(self.directory/journal.COMPLETE,b'{}')
        with self.assertRaises(Exception):self.manager.status(self.owner,self.job)
        with self.assertRaises(Exception):self.prepare()
        with self.assertRaisesRegex(Exception,'usb_browser_stage_previous_unverified'):self.stages.fence_all()
        self.assertFalse((self.directory/journal.INTENT).exists())

    def test_changed_producer_or_foreign_owner_cannot_read_or_renew_consumed_packet(self):
        self.prepare()
        with patch.object(journal,'producer',return_value={'changed':'0'*64}):
            with self.assertRaises(Exception):self.manager.status(self.owner,self.job)
        with self.assertRaises(Exception):self.manager.status('b'*32,self.job)
        self.assertIsNotNone(self.stages.lease_fd)

    def test_artifact_drift_after_packet_read_is_consumed_without_retry_or_completion(self):
        original=journal.private_bytes
        def changed(path,pin):
            body=original(path,pin);path.write_bytes(body+b'changed');return body
        with patch.object(journal,'private_bytes',side_effect=changed):
            with self.assertRaises(Exception):self.prepare()
        self.assertTrue((self.directory/journal.INTENT).is_file());self.assertIsNotNone(self.stages.lease_fd)
        self.assertFalse((self.directory/journal.COMPLETE).exists())
        with self.assertRaises(Exception):self.prepare()

    def test_package_producer_drift_before_delivery_keeps_consumption_and_does_not_return_a_packet(self):
        pins=journal.producer()
        with patch.object(journal,'producer',side_effect=[pins,{'changed':'0'*64}]),patch.object(journal.BrowserInitialTrials,'_packet') as packet:
            with self.assertRaises(Exception):self.prepare()
        packet.assert_not_called();self.assertIsNotNone(self.stages.lease_fd)
        self.assertTrue((self.directory/journal.INTENT).exists())
        self.assertEqual(self.manager.status(self.owner,self.job)['state'],'browser_initial_trial_unverified')

    def test_orphan_trial_history_blocks_controller_export_before_any_build_or_sdk_read(self):
        root=self.directory/'export-fixture';root.mkdir(mode=0o700)
        builds=SimpleNamespace(parent=root.parent,status=Mock())
        with patch.object(computer,'owned_intent',return_value=(root,{},b'')):
            for name in (journal.INTENT,journal.COMPLETE):
                marker=root/name;fixtures.commits.fixtures.stage.write_new(marker,b'{}')
                with self.subTest(name=name),self.assertRaisesRegex(Exception,'usb_computer_after_install'):
                    computer.package_export(builds,self.owner,self.job)
                marker.unlink()  # This test's own isolated orphan only.
        builds.status.assert_not_called()

    def test_broken_nonce_source_refuses_without_unbounded_loop_or_consumed_intent(self):
        with patch.object(journal.secrets,'token_hex',return_value='a'*32):
            with self.assertRaises(Exception):self.prepare()
        self.assertFalse((self.directory/journal.INTENT).exists());self.assertIsNone(self.stages.lease_fd)

    def test_private_actor_delivery_uses_internal_mime_without_adb_or_generic_execution(self):
        app=fixtures.commits.fixtures.plans.core_actor.Companion(self.f.f.f.fixture.fixture.fixture.fixture.capture.usb,self.directory.parent)
        app.browser_stages=self.stages;nonce=app.page(self.owner);usb=Mock()
        actor=fixtures.commits.fixtures.plans.core_actor.Actor(app,usb_ready=usb)
        request={'user':self.owner,'nonce':nonce,'operation':'internal-browser-initial-trial-prepare',
            'data':{'job_id':self.job,'expected_plan_sha256':self.sha,'scope':self.scope,'experimental_reviewed':True}}
        raw,mime=actor.dispatch(request)
        self.assertEqual(mime,journal.MIME);self.assertIn('guardian_body',json.loads(raw));usb.assert_not_called()
        request.update(operation='internal-browser-initial-trial-status',data={'job_id':self.job})
        result,mime=actor.dispatch(request);self.assertEqual(mime,'application/json')
        self.assertEqual(result['state'],'browser_initial_trial_unverified');usb.assert_not_called()
        request.update(operation='internal-browser-initial-trial-record',data={'job_id':self.job,'proof':{}})
        with self.assertRaises(Exception):actor.dispatch(request)

    def test_shared_memory_floor_matches_generated_canonical_threshold(self):
        contract=json.loads((fixtures.HERE/'initial-trial-contract.json').read_bytes())
        self.assertEqual(observation.MIN_START_RAM,contract['minimum_start_ram'])


if __name__=='__main__':unittest.main()
