/** Actual pinned Tango SYNC-v1 with a synthetic RAM guardian; no hardware. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {BrowserInitialGuardianSink} from '../custom_components/qingping_esphome/frontend/usb-initial-guardian-file.mjs';
import {syncV1Daemon} from './fixtures/usb_sync_v1_daemon.mjs';
const args=process.argv.slice(2);
if(args.length && !(args.length===2 && args[0]==='--dependencies'))throw Error('Only an explicit dependency directory is accepted');
const dependencyRoot=path.resolve(args.length?args[1]:'tools/monitor1-usb');
const manifest=JSON.parse(await readFile(path.join(dependencyRoot,'node_modules/@yume-chan/adb/package.json'),'utf8'));
assert.equal(manifest.version,'2.6.2');
const {AdbSyncSocket,adbSyncPushV1}=await import(pathToFileURL(path.join(dependencyRoot,'node_modules/@yume-chan/adb/esm/index.js')));
const body=new TextEncoder().encode('synthetic RAM guardian; not firmware\n'.repeat(5000));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const descriptor={schema_version:1,job_id:'a'.repeat(32),plan_sha256:'b'.repeat(64),intent_sha256:'c'.repeat(64),
 channel_id:'d'.repeat(32),channel_nonce:'11111111-1111-1111-1111-111111111111',nonce:'e'.repeat(32),
 ram_job_id:'f'.repeat(32),guardian_job_id:'1'.repeat(32),guardian:{size:body.length,sha256:sha(body)}};
for(const fail of [false,true]) {
 let opens=0,closed=0;const daemon=syncV1Daemon(AdbSyncSocket,{fail});
 const sink=new BrowserInitialGuardianSink({openSync:async()=>{opens++;return daemon.socket;},pushV1:adbSyncPushV1,
  closeTransport:async()=>{closed++;}},descriptor);
 await sink.begin();for(let offset=0;offset<body.length;offset+=65536)await sink.append(offset,body.slice(offset,offset+65536));
 if(fail)await assert.rejects(sink.finish(),error=>error.code==='usb_browser_scope_unverified' && !error.message);
 else {
  const result=await sink.finish();assert.equal(result.wire_acknowledged,true);
  assert(!Object.hasOwn(result,'remote_file_verified'));assert(!Object.hasOwn(result,'image_fd_admitted'));
  assert.equal(closed,0,'Transport remains for independent readback, never another SEND');
 }
 assert.equal(opens,1);assert.equal(daemon.packets[0].operation,'SEND');
 assert.equal(new TextDecoder().decode(daemon.packets[0].body),
  '/tmp/qingping-initial-guardian-'+descriptor.guardian_job_id+'/program,'+String(0o100600));
 const chunks=daemon.packets.filter(v=>v.operation==='DATA').map(v=>v.body);
 assert(chunks.every(v=>v.length<=65536));assert.deepEqual(Buffer.concat(chunks.map(v=>Buffer.from(v))),Buffer.from(body));
 assert.equal(daemon.packets.at(-1).operation,'DONE');assert.equal(daemon.closed,1);
 await sink.close();await assert.rejects(sink.finish());assert.equal(opens,1);assert.equal(closed,1);
}
console.log('Actual Tango 2.6.2 initial guardian: one fixed tmpfs SEND 0600, bounded DATA, DONE/OKAY, redacted FAIL and no retry passed; no filesystem/device/execution');
