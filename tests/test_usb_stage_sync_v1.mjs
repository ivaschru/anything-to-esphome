/** Exercise the exact pinned Tango SYNC-v1 encoder against an in-memory daemon.
 * No USB transport, shell/ADB process, production path or actual ELF executes.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {BrowserStageFileSink,STAGE_ROLES} from '../custom_components/qingping_esphome/frontend/usb-stage-files.mjs';
import {syncV1Daemon} from './fixtures/usb_sync_v1_daemon.mjs';
const args=process.argv.slice(2);
if(args.length && !(args.length===2 && args[0]==='--dependencies'))throw Error('Only an explicit dependency directory is accepted');
const dependencyRoot=path.resolve(args.length ? args[1] : 'tools/monitor1-usb');
const manifest=JSON.parse(await readFile(path.join(dependencyRoot,'node_modules/@yume-chan/adb/package.json'),'utf8'));
assert.equal(manifest.version,'2.6.2');
const {AdbSyncSocket,adbSyncPushV1}=await import(pathToFileURL(path.join(dependencyRoot,'node_modules/@yume-chan/adb/esm/index.js')));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const contents=Object.fromEntries(STAGE_ROLES.map(([role],index)=>[role,
  new TextEncoder().encode(index===0 ? 'synthetic-not-firmware'.repeat(7000) : 'synthetic-'+role)]));
const descriptor={plan_id:'a'.repeat(32),plan_sha256:'b'.repeat(64),intent_sha256:'c'.repeat(64),
 files:Object.fromEntries(STAGE_ROLES.map(([role])=>[role,{size:contents[role].length,sha256:sha(contents[role])}]))};
function daemon(fail=false) {
 return syncV1Daemon(AdbSyncSocket,{fail});
}
{
 const daemons=[];let transportClosed=0;
 const sink=new BrowserStageFileSink({openSync:async()=>{const d=daemon();daemons.push(d);return d.socket;},
  pushV1:adbSyncPushV1,closeTransport:async()=>{transportClosed++;}},descriptor);
 try {
  for(const [role,leaf] of STAGE_ROLES) {
   const bytes=contents[role];await sink.begin(role);
   for(let offset=0;offset<bytes.length;offset+=65536)await sink.append(role,offset,bytes.slice(offset,offset+65536));
   assert.equal((await sink.finish(role)).wire_acknowledged,true);
   const d=daemons.at(-1);assert.equal(d.closed,1);
   assert.equal(d.packets[0].operation,'SEND');
   assert.equal(new TextDecoder().decode(d.packets[0].body),'/data/.esphome-cgs1/'+leaf+','+String(0o100600));
   const chunks=d.packets.filter(p=>p.operation==='DATA').map(p=>p.body);
   assert(chunks.every(chunk=>chunk.length<=65536));
   assert.deepEqual(Buffer.concat(chunks.map(chunk=>Buffer.from(chunk))),Buffer.from(bytes));
   assert.equal(d.packets.at(-1).operation,'DONE');
  }
  assert.equal(daemons.length,9);
 } finally {await sink.close();}
 assert.equal(transportClosed,1);
}
{
 let opens=0,closed=0;
 const sink=new BrowserStageFileSink({openSync:async()=>{opens++;return daemon(true).socket;},pushV1:adbSyncPushV1,
  closeTransport:async()=>{closed++;}},descriptor);
 const role=STAGE_ROLES[0][0];await sink.begin(role);
 const bytes=contents[role];for(let offset=0;offset<bytes.length;offset+=65536)await sink.append(role,offset,bytes.slice(offset,offset+65536));
 await assert.rejects(sink.finish(role),error=>error.code==='usb_browser_stage_unverified' && !error.message);
 await assert.rejects(sink.begin(role));assert.equal(opens,1);assert.equal(closed,1);
}
console.log('Actual Tango 2.6.2 SYNC-v1: SEND private fixed paths/modes, bounded DATA, DONE/OKAY and redacted FAIL no-retry passed');
