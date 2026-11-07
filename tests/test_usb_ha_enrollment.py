"""One-use HA handoff and read-only USB identity; synthetic jobs only."""
import asyncio
import hashlib
import json
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, Mock, patch
import test_usb_full_ui_activation_installation as fixtures

HERE = Path(__file__).resolve().parents[1] / 'apps/monitor1_usb/rootfs'
with patch.object(sys, 'path', [str(HERE), *sys.path]):
    import ha_enrollment as handoff
    import ha_enrollment_usb as usb
    import usb_install_job as child


class HandoffTests(unittest.TestCase):
    def setUp(self):
        self.prior = fixtures.AuthorityTests(methodName='runTest');self.prior.setUp()
        self.addCleanup(self.prior.doCleanups);self.prior.start()
        self.owner,self.id,self.directory,self.digest = self.prior.owner,self.prior.id,self.prior.directory,self.prior.digest
        self.manager = handoff.HaEnrollments(self.prior.prior.fixture.app)

    def runner(self, command, cwd, env, log, deadline):
        self.assertEqual(command[-3:], ['--job', self.id, '--enrollment'])
        self.assertNotIn('api_encryption_key', str(command)+str(env))
        raw = handoff.checked_intent(cwd,self.owner,self.id)
        handoff.write_new(cwd / handoff.PROOF, json.dumps({'intent_sha256':hashlib.sha256(raw).hexdigest(),
            'host':'192.168.1.25','boot_id':'22222222-2222-2222-2222-222222222222','native_job':'e'*16}).encode())

    def start(self, runner=None):
        return self.manager.prepare(self.owner,self.id,self.digest,True,runner or self.runner)

    def test_bound_intent_precedes_child_key_stays_out_of_status_and_replay_refused(self):
        self.assertTrue(self.manager.status(self.owner,self.id)['enrollment_available'])
        private = json.loads(self.start())
        self.assertEqual(private['host'],'192.168.1.25');self.assertIn('noise_psk',private)
        public = self.manager.status(self.owner,self.id)
        self.assertEqual(public['state'],'unverified');self.assertNotIn('noise_psk',json.dumps(public))
        with self.assertRaisesRegex(Exception,'usb_enrollment_consumed'):self.start()
        result = self.manager.record(self.owner,self.id,private['intent_sha256'],'created','ENTRY_1')
        self.assertEqual(result['entry_id'],'ENTRY_1');self.assertFalse(result['installation_ready'])
        with self.assertRaises(Exception):self.manager.record(self.owner,self.id,private['intent_sha256'],'created','ENTRY_1')

    def test_wrong_plan_owner_review_and_failed_child_preserve_consumption(self):
        for owner,digest,review in [(self.owner,'0'*64,True),(self.owner,self.digest,False),('b'*32,self.digest,True)]:
            with self.assertRaises(Exception):self.manager.prepare(owner,self.id,digest,review,self.runner)
        self.assertFalse((self.directory/handoff.INTENT).exists())
        with self.assertRaises(Exception):self.start(lambda *args: (_ for _ in ()).throw(TimeoutError()))
        self.assertEqual(self.manager.status(self.owner,self.id)['state'],'unverified')
        with self.assertRaisesRegex(Exception,'usb_enrollment_consumed'):self.start()

    def test_changed_original_activation_or_private_profile_invalidates_handoff(self):
        self.start()
        path=self.directory/'profile.json';path.write_bytes(path.read_bytes()+b'\n')
        with self.assertRaises(Exception):self.manager.package(self.owner,self.id)
        path=self.directory/handoff.ACTIVATION_RESULT;path.write_bytes(path.read_bytes()+b'\n')
        with self.assertRaises(Exception):self.manager.status(self.owner,self.id)

    def test_fixed_child_validates_payload_profile_and_writes_only_bound_observation(self):
        def run(command,cwd,env,log,deadline):
            plan=handoff.build_report(cwd/'install-plan/plan.json')
            canonical=SimpleNamespace(TrialAdb=Mock(return_value='synthetic'),candidate=SimpleNamespace(
                read_profile=Mock(return_value=(plan['api_identity'],plan['basis']['profile_sha256']))))
            raw=handoff.checked_intent(cwd,self.owner,self.id)
            proof={'intent_sha256':hashlib.sha256(raw).hexdigest(),'host':'192.168.1.25',
                'boot_id':'22222222-2222-2222-2222-222222222222','native_job':'e'*16}
            operation=AsyncMock(return_value=proof)
            with patch.dict(sys.modules,{'trial_initial_bridge_adb':canonical}),patch.object(usb,'inspect',operation),patch.object(child,'adb_executable',return_value='synthetic'):
                child.enrollment_job(cwd)
                operation.assert_awaited_once_with('synthetic',plan,plan['api_identity'],canonical,proof['intent_sha256'])
        self.assertEqual(json.loads(self.start(run))['native_job'],'e'*16)


class UsbTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.boot='22222222-2222-2222-2222-222222222222'
        self.profile={'node_name':'fixture','api_mac':'02:00:00:00:00:01','api_encryption_key':'synthetic'}
        self.plan={'target':{'usb_serial':'fixture','usb_transport':'usb:fixture','wlan_mac':'02:00:00:00:00:02','co2_type':3},
                   'files':{k:{'size':100,'sha256':'a'*64} for k in ('native-program','guardian-program')}}
        self.adb=SimpleNamespace(serial='fixture',usb=Mock(return_value='usb:fixture'),read=Mock(return_value='wlan0 Link encap:Ethernet\n inet addr:192.168.1.25 Bcast:192.168.1.255\n'),deadline=None)
        self.canonical=SimpleNamespace(reserve_port=Mock(return_value=16053),install_forward=Mock(),remove_forward=Mock(return_value='removed'),
            review=SimpleNamespace(preflight=SimpleNamespace(identity=Mock(return_value=self.boot))))
        self.client=SimpleNamespace(connect=AsyncMock(),disconnect=AsyncMock(),device_info=AsyncMock(return_value=SimpleNamespace(name='fixture',mac_address=self.profile['api_mac'])),
            list_entities_services=AsyncMock(return_value=([],[SimpleNamespace(name='full_native_status')])),execute_service=AsyncMock())
        self.factory=Mock(return_value=self.client)
        self.responses=[]
        for n in (1,2):
            body={'nonce':'e'*16,'boot_id':self.boot,'native_sha256':'a'*64,'guardian_sha256':'a'*64,
                'connected_guardians':True,'panel_ready':True,'core_sensors_ready':True,'native_state':1,'guardian_generations':[n,n]}
            self.responses.append(SimpleNamespace(success=True,response_data=json.dumps(body)))
        self.client.execute_service.side_effect=self.responses

    async def inspect(self):
        return await usb.inspect(self.adb,self.plan,self.profile,self.canonical,'d'*64,factory=self.factory,sleep=AsyncMock())

    async def test_fresh_physical_scope_and_generations_retire_api_and_own_forward(self):
        proof=await self.inspect();self.assertEqual(proof['host'],'192.168.1.25')
        self.assertEqual([c.args[0] for c in self.adb.read.call_args_list],['LC_ALL=C /bin/busybox ifconfig wlan0']*2)
        self.client.disconnect.assert_awaited_once();self.canonical.remove_forward.assert_called_once_with(self.adb,16053)
        self.assertIsNone(self.adb.deadline)

    async def test_wrong_identity_stale_status_changed_ip_and_cleanup_refuse(self):
        self.responses[1]=self.responses[0];self.client.execute_service.side_effect=self.responses
        with self.assertRaises(Exception):await self.inspect()
        self.client.disconnect.assert_awaited_once();self.canonical.remove_forward.assert_called_once()
        self.canonical.remove_forward.side_effect=TimeoutError()
        with self.assertRaises(Exception):await self.inspect()

    async def test_lost_forward_ack_is_never_removed_or_adopted(self):
        self.canonical.install_forward.side_effect=TimeoutError()
        with self.assertRaises(Exception):await self.inspect()
        self.factory.assert_not_called();self.canonical.remove_forward.assert_not_called()

    def test_ipv4_is_unique_unicast_not_fallback_or_injected_command(self):
        for text in ['eth0 inet addr:192.168.1.25\n','wlan0 inet addr:127.0.0.1\n','wlan0 inet addr:0.0.0.0\n',
                     'wlan0 inet addr:192.168.1.25\n inet addr:192.168.1.26\n','wlan0 inet addr:192.168.1.25;reboot\n']:
            with self.assertRaises(Exception):usb.ipv4(text)
