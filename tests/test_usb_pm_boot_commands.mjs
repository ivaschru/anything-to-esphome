/** Pure canonical byte parity, including co2 types and exact uint64 births. */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {pmNextBootCommand} from '../custom_components/qingping_esphome/frontend/usb-pm-boot-commands.mjs';
import {PmBootCommandStream,pmBootStreamService} from '../custom_components/qingping_esphome/frontend/usb-pm-boot-stream.mjs';
import {fixedStdinService,FixedStdinLifecycle} from '../custom_components/qingping_esphome/frontend/usb-fixed-stdin.mjs';
import {fixedStdinFixture} from './fixtures/usb_fixed_stdin_socket.mjs';
const loaded=spawnSync('python3',['tests/fixtures/monitor1_browser_pm_commands.py'],{encoding:'utf8',maxBuffer:8*1024**2,timeout:15000});
assert.equal(loaded.status,0,loaded.stderr);const vectors=JSON.parse(loaded.stdout);
assert.equal(vectors.length,16);
for(const v of vectors) {
 const text=await pmNextBootCommand(v.context,v.scope,v.nonce,v.phase);assert.equal(text,v.expected);
 assert(text.length<=65536);if(v.phase==='arm')assert(text.length>32768);
 const syntax=spawnSync('/bin/sh',['-n'],{input:text,encoding:'utf8'});assert.equal(syntax.status,0,syntax.stderr);
 assert(!/\b(?:reboot|kill|insmod|modprobe|launch\.sh start)\b/.test(text));
}
const [arm,done]=vectors;
for(const change of [v=>v.scope.pm_disabled=1,v=>v.scope.target.boot_id=v.context.arming.context.meta.target.boot_id,
 v=>v.scope.processes.child[2]=2**53,v=>v.scope.processes.child[2]=String(2n**64n),
 v=>v.scope.processes.child[1]=1,v=>v.nonce='0'.repeat(32),v=>v.phase='rollback',v=>v.scope.root_identity[0]+=1]) {
 const v=structuredClone(arm);change(v);await assert.rejects(pmNextBootCommand(v.context,v.scope,v.nonce,v.phase));
}
for(const options of [{},{writeLoss:true},{badOutput:true},{socketCloseLoss:true},{noRemoteClose:true}]) {
 const active={},f=fixedStdinFixture(PmBootCommandStream,pmBootStreamService,active);
 const probe=await f.stream.probe();assert.equal(probe.probe_body_bytes,65536);assert.equal(f.records[0].body.length,65536);Object.assign(active,options);
 if(Object.keys(options).length) {
  if(options.noRemoteClose) {
   const pending=f.stream.execute(arm.context,arm.scope,arm.nonce,arm.phase),rejected=assert.rejects(pending);
   await new Promise(resolve=>setTimeout(resolve,10));
   await f.stream.close().catch(()=>{});await rejected;
  } else await assert.rejects(f.stream.execute(arm.context,arm.scope,arm.nonce,arm.phase));
  assert.equal(f.retired,1);continue;
 }
 await f.stream.execute(arm.context,arm.scope,arm.nonce,arm.phase);
 await f.stream.execute(done.context,done.scope,done.nonce,done.phase);
 assert.equal(f.records[1].body,arm.expected.replace(/\n$/,''));assert(f.records[1].chunks.length>8);
 await assert.rejects(f.stream.execute(arm.context,arm.scope,arm.nonce,arm.phase));assert.equal(f.retired,1);
}
const framing={size:65536,sha256:'a'.repeat(64),marker:'__CGS1_FIXED_OK_'+'b'.repeat(32)+'__'};
assert.throws(()=>fixedStdinService(framing));assert(pmBootStreamService(framing).length<512);
assert.throws(()=>pmBootStreamService({...framing,size:65537}));
// An old wrapper keeps its own 32KiB ceiling even though PM has a larger
// trusted module constant. No large OPEN is issued by this failed execution.
class OldBounded extends FixedStdinLifecycle {
 constructor(backend){super(backend,()=> 'x'.repeat(32769));}
}
const old=fixedStdinFixture(OldBounded,fixedStdinService);await old.stream.probe();
await assert.rejects(old.stream.execute({}));assert.equal(old.records.length,1);assert.equal(old.retired,1);
console.log('16 canonical PM arm/AFTER bodies, syntax/refusals and sealed 64KiB stream PASS; no device writer');
