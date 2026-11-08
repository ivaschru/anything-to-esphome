"""Private Core + real finite registry/channel; synthetic actor/USB only.

The separate journal suite tests the actual actor lease and private packet.
This suite joins its contract to real asynchronous request delivery and exact
close ordering. No shell, ADB process, HA mutation or device is executed.
"""
import asyncio
import base64
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock

import test_usb_browser_review as fixtures

ROOT = fixtures.ROOT
spec = importlib.util.spec_from_file_location('qingping_browser_contract.monitor1_browser_stage', ROOT / 'monitor1_browser_stage.py')
transfer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(transfer)
Refusal = fixtures.Refusal


class TransferTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.registry = fixtures.registry_module.BrowserRegistry()
        self.addCleanup(self.registry.stop)
        self.owner, self.nonce = 'a' * 32, 'b' * 64
        self.evidence = {'kind': 'browser_webusb', 'channel': '22222222-2222-2222-2222-222222222222',
            'serial': 'synthetic-usb', 'wlan_mac': '02:00:00:00:00:01', 'boot_id': '33333333-3333-3333-3333-333333333333',
            'co2_type': 2, 'stock_version': '4.1.8_0287', 'native_get_devpath': False}
        self.id = self.registry.open(self.owner, self.nonce, {'evidence': self.evidence})['channel_id']
        self.cap = self.registry.capability(self.owner, self.nonce, self.id)
        self.data = {'job_id': 'c' * 32, 'channel_id': self.id, 'expected_plan_sha256': 'd' * 64, 'experimental_reviewed': True}
        self.target = {'kind': 'browser_webusb', 'usb_serial': self.evidence['serial'], **{k: self.evidence[k] for k in ('wlan_mac','boot_id','co2_type','stock_version')}}
        self.context = {'schema_version': 1, 'job_id': self.data['job_id'], 'plan_id': 'e' * 32,
            'plan_sha256': self.data['expected_plan_sha256'], 'source_commit': transfer.SOURCE,
            'target': self.target, 'requested_data_free_bytes': 24 * 1024**2, 'stage_state': 'not_started'}
        self.bodies = {role: ('synthetic-private-not-firmware-' + role).encode() * (3000 if i == 0 else 1) for i, role in enumerate(transfer.ROLES)}
        self.files = {role: {'size': len(body), 'sha256': hashlib.sha256(body).hexdigest()} for role, body in self.bodies.items()}
        contract = json.loads((ROOT / 'monitor1_worker/contract.json').read_bytes())
        self.stock = {v['path']: {'size': v['size'], 'sha256': v['sha256']} for v in contract['files']}
        self.desc = {'plan_id': self.context['plan_id'], 'plan_sha256': self.context['plan_sha256'], 'intent_sha256': 'f' * 64, 'files': self.files}
        self.packet = {'schema_version': 1, 'job_id': self.data['job_id'], 'target': self.target,
            'requested_data_free_bytes': self.context['requested_data_free_bytes'], 'descriptor': self.desc, 'stock_files': self.stock,
            'payloads': {role: base64.b64encode(body).decode() for role, body in self.bodies.items()}}
        marker = (self.desc['plan_id'] + ' ' + self.desc['plan_sha256'] + ' ' + self.desc['intent_sha256'] + '\n').encode()
        self.proof = {'plan_id': self.desc['plan_id'], 'plan_sha256': self.desc['plan_sha256'], 'intent_sha256': self.desc['intent_sha256'],
            'target': self.target, 'files': self.files, 'stock_files': self.stock, 'root_mode_uid': '700 0', 'stage_metadata_mode_uid': '700 0',
            'optouts_empty_regular': True, 'transport_closed': True, 'vendor_files_changed': False, 'program_started': False,
            'after_effects_sha256': hashlib.sha256(marker).hexdigest()}
        self.public = {'job_id': self.data['job_id'], 'state': 'staged_disabled_verified', 'replay_allowed': False,
            'installed': False, 'installation_ready': False, 'device_write_attempted': True, 'live_recheck_required': True}
        self.operations, self.events, self.received, self.close_acks = [], [], {}, 0
        self.service = SimpleNamespace(browser_registry=self.registry, exchange=AsyncMock(side_effect=self.exchange))

    async def exchange(self, owner, nonce, operation, data):
        self.assertEqual((owner,nonce),(self.owner,self.nonce))
        self.operations.append(operation)
        if operation == 'internal-browser-stage-context':
            self.assertEqual(data, {k:self.data[k] for k in ('job_id','expected_plan_sha256')})
            return True,'application/json',json.dumps(self.context).encode()
        if operation == 'internal-browser-stage-prepare':
            self.assertEqual(self.events,['stage-admission'])
            self.assertEqual(data['scope']['channel_id'],self.id)
            self.assertEqual(data['scope']['channel_nonce'],self.evidence['channel'])
            self.assertEqual(data['scope']['target'],self.target)
            return True,transfer.MIME,json.dumps(self.packet).encode()
        self.assertEqual(operation,'internal-browser-stage-record')
        self.assertEqual(self.close_acks,1,'Independent channel close ACK precedes recording')
        self.assertTrue(self.cap.closed);self.assertFalse(self.cap.failed)
        self.assertEqual(data,{'job_id':self.data['job_id'],'intent_sha256':self.desc['intent_sha256'],
            'proof':{**self.proof,'channel_id':self.id,'channel_nonce':self.evidence['channel']}})
        return True,'application/json',json.dumps(self.public).encode()

    async def pump(self, fail=None, change_proof=None):
        while True:
            request = await self.cap.poll()
            if request is None: continue
            op,data=request['operation'],request['data'];self.events.append(op)
            if op=='stage-admission':
                self.assertIsNone(data)
                value={'evidence':self.evidence,'filesystem':{'magic':'ef53','available_blocks':10000,'block_bytes':4096}}
            elif op=='stage-prepare':
                self.assertEqual(data['stock_files'],self.stock)
                self.assertEqual(set(data['packet']),set(self.packet)-{'payloads','stock_files'})
                value={'state':'disabled_root_created'}
            elif op=='stage-file-begin':
                role=data['role'];self.assertNotIn(role,self.received);self.received[role]=bytearray()
                value={'role':role,'offset':0}
            elif op=='stage-chunk':
                role=data['role'];self.assertEqual(data['offset'],len(self.received[role]))
                body=base64.b64decode(data['body'],validate=True);self.assertLessEqual(len(body),65536)
                self.received[role].extend(body);value={'role':role,'offset':len(self.received[role])}
            elif op=='stage-file-finish':
                role=data['role'];self.assertEqual(bytes(self.received[role]),self.bodies[role])
                value={'role':role,'state':'remote_file_verified'}
            elif op=='stage-complete':
                self.assertIsNone(data);self.assertEqual(set(self.received),set(transfer.ROLES))
                value={**self.proof,**(change_proof or {})}
            else:
                self.assertEqual(op,'channel-close','No API, generic shell or arbitrary operation')
                self.assertIsNone(data);self.close_acks+=1;value=None
            self.cap.answer({'id':request['id'],'ok':op!=fail,'data':value})
            if op==fail or op=='channel-close':return

    async def run_transfer(self, fail=None, change_proof=None):
        pump=asyncio.create_task(self.pump(fail,change_proof))
        try:
            return await asyncio.wait_for(transfer.stage(self.service,self.owner,self.nonce,self.data),2)
        finally:
            pump.cancel()
            await asyncio.gather(pump,return_exceptions=True)

    async def test_private_packet_through_real_channel_records_only_after_all_fixed_files_and_close(self):
        result=await self.run_transfer()
        self.assertEqual(result,self.public)
        self.assertEqual(self.operations,['internal-browser-stage-context','internal-browser-stage-prepare','internal-browser-stage-record'])
        self.assertEqual(self.events.count('stage-prepare'),1)
        self.assertEqual(self.events.count('stage-file-begin'),9)
        self.assertGreater(self.events.count('stage-chunk'),9)
        self.assertEqual(self.events[-2:],['stage-complete','channel-close'])
        self.assertNotIn('payload',json.dumps(result));self.assertNotIn('synthetic-private',json.dumps(result))

    async def test_lost_root_or_chunk_or_close_ack_never_records_or_replays(self):
        # Each subcase requires a new selected handle, not renewal of an old intent.
        for fail in ('stage-prepare','stage-chunk','channel-close'):
            if self.operations:
                self.registry.stop();await self.asyncSetUp()
            with self.subTest(fail=fail),self.assertRaises(Refusal):
                await self.run_transfer(fail=fail)
            self.assertEqual(self.operations.count('internal-browser-stage-prepare'),1)
            self.assertNotIn('internal-browser-stage-record',self.operations)
            self.assertLessEqual(self.events.count('stage-prepare'),1)
            self.assertTrue(self.cap.closed)

    async def test_wrong_complete_proof_is_preserved_unverified_despite_positive_cleanup(self):
        with self.assertRaises(Refusal):
            await self.run_transfer(change_proof={'after_effects_sha256':'0'*64})
        self.assertEqual(self.close_acks,1)
        self.assertNotIn('internal-browser-stage-record',self.operations)

    async def test_hash_of_every_payload_precedes_first_write_frame(self):
        role=transfer.ROLES[-1]
        self.packet['payloads'][role]=base64.b64encode(b'x'*self.files[role]['size']).decode()
        with self.assertRaises(Refusal):await self.run_transfer()
        self.assertEqual(self.events,['stage-admission','channel-close'])
        self.assertNotIn('internal-browser-stage-record',self.operations)

    async def test_unreviewed_or_foreign_request_never_contacts_private_actor(self):
        for change in ({'experimental_reviewed':False},{'channel_id':'9'*32},{'path':'/data/other'}):
            with self.subTest(change=change),self.assertRaises(Refusal):
                await transfer.stage(self.service,self.owner,self.nonce,{**self.data,**change})
        self.service.exchange.assert_not_awaited()
        self.assertTrue(self.cap.queue.empty())

    def test_packet_format_digest_budget_and_source_pins_are_strict(self):
        for change in ('bool-schema','last-hash','source','extra','base64','plan'):
            value=copy.deepcopy(self.packet)
            if change=='bool-schema':value['schema_version']=True
            elif change=='last-hash':value['descriptor']['files'][transfer.ROLES[-1]]['sha256']='0'*64
            elif change=='source':value['stock_files']['/data/bin/SnowApp']['sha256']='0'*64
            elif change=='extra':value['command']='arbitrary'
            elif change=='base64':value['payloads'][transfer.ROLES[0]]='!'*len(value['payloads'][transfer.ROLES[0]])
            else:value['descriptor']['plan_id']='0'*32
            with self.subTest(change=change),self.assertRaises(Refusal):
                transfer.packet((True,transfer.MIME,json.dumps(value).encode()),self.context)


if __name__=='__main__':unittest.main()
