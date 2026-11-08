/** Actual selected NativeChannel/peer/session; fixed emulated reads/SYNC only. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {BrowserChannelPeer} from '../custom_components/qingping_esphome/frontend/usb-channel-peer.mjs';
import {createNativeChannel} from '../custom_components/qingping_esphome/frontend/usb-probe-bundle.mjs';
import {initialRamCommands} from '../custom_components/qingping_esphome/frontend/usb-initial-ram-commands.mjs';
import {disabledTransport} from './fixtures/usb_disabled_transport.mjs';
const original=JSON.parse(execFileSync(process.env.PYTHON||'python3',['tests/fixtures/monitor1_browser_initial_ram.py'],{encoding:'utf8',maxBuffer:1024*1024}))[0];
const empty='e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const hash=body=>createHash('sha256').update(body).digest('hex');
async function selected(options={},Native=undefined) {
 const packet=structuredClone(original.packet),body=new Uint8Array(131089).fill(27);
 packet.context.guardian={size:body.length,sha256:hash(body)};
 let commands,created=0,uploaded=false,syncOpens=0,syncClosed=0;
 const fixture=disabledTransport({committed:true,unsupported:options.unsupported,
  rawCommand:text=>{assert.equal(text,commands.create);created++;},
  customRead:command=>{
   if(command===commands?.inspect_roots) {
    const inode=uploaded && options.rootReplacement?103:100;
    return `7 ${inode} 700 0\n1021994 16384 4096\n7 101 700 0\n1021994 16384 4096`;
   }
   if(command===commands?.inspect_guardian) {
    const pin=uploaded?(options.badRemoteHash?'0'.repeat(64):hash(body)):empty;
    const inode=uploaded && options.fileReplacement?104:102;
    return `${uploaded?body.length:0} 600 0 1 7 ${inode}\n${pin}  /tmp/qingping-initial-guardian-${packet.guardian_job_id}/program`;
   }
  },
  syncSocket:()=>{syncOpens++;return {close:async()=>{syncClosed++;}};},
  pushV1:async request=>{
   assert.equal(request.filename,`/tmp/qingping-initial-guardian-${packet.guardian_job_id}/program`);
   assert.equal(request.permission,0o600);const chunks=[];for await(const v of request.file)chunks.push(v);
   assert.deepEqual(Buffer.concat(chunks),Buffer.from(body));if(options.syncError)throw Error('synthetic partial SYNC');uploaded=true;
  },
 },Native);
 const opening=fixture.link.selectForReview();assert.equal(fixture.picked,1);await opening;
 packet.channel_nonce=fixture.link.evidence().channel;
 commands=initialRamCommands(packet,packet.preparation);
 const peer=new BrowserChannelPeer(fixture.link);let id=0;
 return {fixture,packet,body,peer,call:(operation,data=null)=>peer.dispatch({id:(++id).toString(16).padStart(32,'0'),operation,data}),
  get created(){return created;},get syncOpens(){return syncOpens;},get syncClosed(){return syncClosed;}};
}
async function send(f) {
 for(let offset=0;offset<f.body.length;offset+=65536) {
  const chunk=f.body.slice(offset,offset+65536);
  const answer=await f.call('ram-chunk',{offset,body:Buffer.from(chunk).toString('base64')});
  assert.equal(answer.ok,true);assert.equal(answer.data.offset,offset+chunk.length);
 }
}
for(const Native of [undefined,createNativeChannel().constructor]) {
 const f=await selected({},Native);
 assert.equal((await f.call('ram-stream-check')).data.ready,true);assert.equal(f.created,0);
 assert.equal((await f.call('initial-trial-preparation',{meta:f.packet.context.meta})).ok,true,'Fresh read stays available between probe and consumed intent');
 const ready=await f.call('ram-prepare',{packet:f.packet});assert.equal(ready.ok,true);assert.equal(ready.data.state,'ram_precreated');
 assert.equal(f.created,1);assert.equal(f.syncOpens,0);
 await send(f);const final=await f.call('ram-complete');assert.equal(final.ok,true);
 assert.equal(final.data.kind,'browser_initial_ram_ready');assert.equal(final.data.uploaded.guardian_sha256,hash(f.body));
 assert.equal(final.data.guardian_started,false);assert.equal(final.data.transport_closed,false);assert.equal(final.data.image_fd_admitted,false);
 assert.equal(f.fixture.closed,0);assert.equal(f.created,1);assert.equal(f.syncOpens,1);assert.equal(f.syncClosed,1);
 assert.equal(f.fixture.effects,3,'RAM stage never rewrites vendor scripts');
 assert.equal((await f.call('channel-close')).ok,true);assert.equal(f.fixture.closed,1);
 await assert.rejects(f.call('ram-complete'));assert.equal(f.created,1);
}
for(const options of [{badRemoteHash:true},{rootReplacement:true},{fileReplacement:true},{syncError:true}]) {
 const f=await selected(options);assert.equal((await f.call('ram-stream-check')).ok,true);
 assert.equal((await f.call('ram-prepare',{packet:f.packet})).ok,true);await send(f);
 assert.equal((await f.call('ram-complete')).ok,false);assert.equal(f.fixture.closed,1);
 assert.equal(f.created,1);assert.equal(f.syncOpens,1);await assert.rejects(f.call('ram-complete'));
}
{
 const f=await selected({unsupported:true});assert.equal((await f.call('ram-stream-check')).ok,false);
 assert.equal(f.created,0);assert.equal(f.syncOpens,0);assert.equal(f.fixture.closed,1);
}
for(const bad of ['nonce','target','extra']) {
 const f=await selected();await f.call('ram-stream-check');const packet=structuredClone(f.packet);
 if(bad==='nonce')packet.channel_nonce='00000000-0000-0000-0000-000000000000';
 if(bad==='target')packet.context.meta.target.wlan_mac='02:00:00:00:00:02';
 if(bad==='extra')packet.command='not admitted';
 assert.equal((await f.call('ram-prepare',{packet})).ok,false);assert.equal(f.created,0);assert.equal(f.fixture.closed,1);
}
{
 const f=await selected();assert.equal((await f.call('ram-prepare',{packet:f.packet})).ok,false);assert.equal(f.created,0);assert.equal(f.fixture.closed,1);
}
for(const operation of ['api-open','commit-stream-check','ram-stream-check','initial-trial-preparation']) {
 const f=await selected();await f.call('ram-stream-check');await f.call('ram-prepare',{packet:f.packet});
 assert.equal((await f.call(operation)).ok,false);assert.equal(f.fixture.closed,1);assert.equal(f.created,1);assert.equal(f.syncOpens,0);
}
console.log('Actual selected peer RAM: original nonce/target, fixed probe/create/chunks/SYNC/readback, raw-source + delivered bundle, close/no replay passed; no Core intent grant, launch or hardware');
