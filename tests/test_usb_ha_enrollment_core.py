"""Actual supported HA SDK flow contracts; no HA instance, network or USB."""
import asyncio
import base64
import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace
import sys
import unittest
from unittest.mock import AsyncMock, Mock, patch

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('monitor1_enrollment_contract',ROOT/'custom_components/qingping_esphome/monitor1_enrollment.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
DATA={'job_id':'c'*32,'intent_sha256':'d'*64,'host':'192.168.1.25','boot_id':'22222222-2222-2222-2222-222222222222',
      'native_job':'e'*16,'node_name':'fixture','api_mac':'02:00:00:00:00:01','noise_psk':base64.b64encode(bytes(range(32))).decode(),
      'native_sha256':'a'*64,'guardian_sha256':'b'*64}


def entry(**changes):
    values={'host':DATA['host'],'port':6053,'noise_psk':DATA['noise_psk'],'device_name':DATA['node_name'],'password':''}
    return SimpleNamespace(unique_id=DATA['api_mac'],entry_id='ENTRY_1',data={**values,**changes})


class PayloadTests(unittest.TestCase):
    def test_key_and_exact_internal_fields_checked_without_public_projection(self):
        self.assertEqual(module.payload(json.dumps(DATA).encode(),DATA['job_id']),DATA)
        for change in ({'host':'127.0.0.1'},{'host':'192.168.1.25;reboot'},{'noise_psk':'x'},{'port':6054},{'native_job':'0'*16}):
            with self.assertRaises(module.EnrollmentRefusal):module.payload(json.dumps({**DATA,**change}).encode(),DATA['job_id'])
        with self.assertRaises(module.EnrollmentRefusal):module.payload(b'{"host":"a","host":"b"}',DATA['job_id'])


class NativeAdapterTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.entries=[]
        self.flow=SimpleNamespace(async_init=AsyncMock(),async_configure=AsyncMock(),async_progress=Mock(return_value=[]),async_abort=Mock())
        self.hass=SimpleNamespace(config_entries=SimpleNamespace(async_entries=lambda domain:self.entries,flow=self.flow))
        self.verify=AsyncMock()

    async def test_encryption_step_only_and_entry_readback_is_required(self):
        self.flow.async_init.return_value={'type':'form','step_id':'encryption_key','flow_id':'OWN_FLOW','errors':{}}
        async def configure(identity,data):
            self.assertEqual(identity,'OWN_FLOW');self.assertEqual(data,{'noise_psk':DATA['noise_psk']})
            result=entry();self.entries.append(result)
            return {'type':'create_entry','result':result}
        self.flow.async_configure.side_effect=configure
        self.assertEqual(await module.enroll(self.hass,DATA,verifier=self.verify),('created','ENTRY_1'))
        self.flow.async_init.assert_awaited_once_with('esphome',context={'source':'user'},data={'host':DATA['host'],'port':6053})
        self.verify.assert_awaited_once_with(DATA)

    async def test_existing_exact_entry_is_read_only_conflicts_never_overwritten(self):
        self.entries.append(entry())
        self.assertEqual(await module.enroll(self.hass,DATA,verifier=self.verify),('already_configured','ENTRY_1'))
        self.flow.async_init.assert_not_awaited()
        self.entries[0]=entry(noise_psk='foreign')
        self.assertEqual(await module.enroll(self.hass,DATA,verifier=self.verify),('conflict',None))
        self.flow.async_init.assert_not_awaited()

    async def test_unknown_forms_are_not_submitted_and_only_owned_form_is_retired(self):
        for step in ('name_conflict','migrate','overwrite','authenticate','user'):
            self.flow.async_init.return_value={'type':'form','step_id':step,'flow_id':'OWN_FLOW'}
            self.flow.async_progress.return_value=[{'flow_id':'FOREIGN_FLOW'},{'flow_id':'OWN_FLOW'}]
            self.assertEqual(await module.enroll(self.hass,DATA,verifier=self.verify),('manual_flow_required',None))
        self.flow.async_configure.assert_not_awaited()
        self.assertTrue(all(c.args==('OWN_FLOW',) for c in self.flow.async_abort.call_args_list))

    async def test_failed_lan_read_never_starts_a_native_flow(self):
        self.verify.side_effect=TimeoutError('synthetic private error')
        with self.assertRaises(TimeoutError):await module.enroll(self.hass,DATA,verifier=self.verify)
        self.flow.async_init.assert_not_awaited()

    async def test_read_only_lan_session_requires_exact_identity_pair_and_fresh_guardians(self):
        statuses=[]
        for n in (1,2):
            statuses.append({'nonce':DATA['native_job'],'boot_id':DATA['boot_id'],'native_sha256':DATA['native_sha256'],
                'guardian_sha256':DATA['guardian_sha256'],'connected_guardians':True,'panel_ready':True,'core_sensors_ready':True,
                'native_state':1,'guardian_generations':[n,n]})
        client=SimpleNamespace(connect=AsyncMock(),disconnect=AsyncMock(),device_info=AsyncMock(return_value=SimpleNamespace(name=DATA['node_name'],mac_address=DATA['api_mac'])),
            list_entities_services=AsyncMock(return_value=([],[SimpleNamespace(name='full_native_status')])),execute_service=AsyncMock())
        client.execute_service.side_effect=[SimpleNamespace(success=True,response_data=json.dumps(s)) for s in statuses]
        factory=Mock(return_value=client)
        await module.verify_lan(DATA,factory=factory,sleep=AsyncMock())
        self.assertEqual(factory.call_args.args,(DATA['host'],6053,''));client.disconnect.assert_awaited_once()
        client.execute_service.side_effect=[SimpleNamespace(success=True,response_data=json.dumps(statuses[0]))]*2
        with self.assertRaises(module.EnrollmentRefusal):await module.verify_lan(DATA,factory=factory,sleep=AsyncMock())
        self.assertEqual(client.disconnect.await_count,2)


@unittest.skipUnless(importlib.util.find_spec('homeassistant'), 'requires real Home Assistant SDK')
class RealNativeStepsTests(unittest.IsolatedAsyncioTestCase):
    async def test_real_esphome_user_and_key_steps_produce_native_config_entry_data(self):
        # Drive the real SDK handler, replacing only network/storage edges.
        # This verifies supported source/step names and the resulting native
        # data; it does not claim the simulated registry commit is a live HA.
        from homeassistant.components.esphome.config_flow import EsphomeFlowHandler, ERROR_REQUIRES_ENCRYPTION_KEY, ERROR_INVALID_ENCRYPTION_KEY
        handler=EsphomeFlowHandler();handler.context={'source':'user'};handler.flow_id='OWN_FLOW'
        handler.hass=SimpleNamespace()
        async def candidates():
            if False:yield ''
        async def fetch():
            if handler._noise_psk==DATA['noise_psk']:
                handler._device_info=SimpleNamespace(uses_password=False,zwave_proxy_feature_flags=0)
                handler._device_name=DATA['node_name'];handler._name='Fixture'
                return None
            return ERROR_REQUIRES_ENCRYPTION_KEY if handler._noise_psk is None else ERROR_INVALID_ENCRYPTION_KEY
        handler.fetch_device_info=fetch
        handler._async_encryption_key_candidates=candidates
        handler._async_repair_stored_key=AsyncMock()
        handler._async_current_entries=Mock(return_value=[])
        class Manager:
            async def async_init(self,domain,context,data):
                return await handler.async_step_user(data)
            async def async_configure(self,identity,data):
                native=await handler.async_step_encryption_key(data)
                self.native=native
                result=entry(); entries.append(result)
                return {**native,'result':result}
            def async_progress(self):return []
        manager=Manager();entries=[]
        hass=SimpleNamespace(config_entries=SimpleNamespace(flow=manager,async_entries=lambda domain:entries))
        self.assertEqual(await module.enroll(hass,DATA,verifier=AsyncMock()),('created','ENTRY_1'))
        self.assertEqual(manager.native['data'],{'host':DATA['host'],'port':6053,'password':'','noise_psk':DATA['noise_psk'],'device_name':DATA['node_name']})
