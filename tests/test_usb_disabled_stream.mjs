/** Fixed raw stdin/owned lifetime fixtures; never run a shell or touch USB. */
import assert from 'node:assert/strict';
import {fixedStdinFixture} from './fixtures/usb_fixed_stdin_socket.mjs';
import {spawnSync} from 'node:child_process';
import {DisabledCommandStream,disabledStreamService} from '../custom_components/qingping_esphome/frontend/usb-disabled-stream.mjs';
const loaded=spawnSync('python3',['tests/fixtures/monitor1_browser_commands.py'],{encoding:'utf8',env:{PATH:process.env.PATH},maxBuffer:1024*1024,timeout:15000});
assert.equal(loaded.status,0,loaded.stderr);const vectors=JSON.parse(loaded.stdout).slice(0,3);
const fixture=options=>fixedStdinFixture(DisabledCommandStream,disabledStreamService,options);

{
 const f=fixture();
 const probe=await f.stream.probe();assert.equal(probe.ready,true);assert.equal(probe.writer_enabled,false);assert.equal(probe.device_files_changed,false);
 for(const v of vectors) {
  assert.deepEqual(await f.stream.execute(v.meta,v.scope,v.nonce,v.phase),{phase:v.phase,completed:true});
  assert(f.records.at(-1).body.startsWith(v.expected));
 }
 assert.equal(f.records.length,4);assert(f.records.every(r=>r.closed===1));assert.equal(f.retired,0);
 assert(f.records[2].body.length>4096,'Long guarded body actually traverses stdin');
 assert(f.records[2].chunks.length>2);
 await Promise.all([f.stream.close(),f.stream.close()]);assert.equal(f.retired,1);
 await assert.rejects(f.stream.execute(vectors[2].meta,vectors[2].scope,vectors[2].nonce,'start'));
 assert.equal(f.records.length,4,'Consumed phases cannot reopen a stream');
}
for(const options of [{unsupported:true},{service:'tcp:6053'},{oversized:true},{nul:true},{socketCloseLoss:true}]) {
 const f=fixture(options);
 await assert.rejects(f.stream.probe(),error=>error.code==='usb_browser_scope_unverified' && !error.message);
 await assert.rejects(f.stream.probe());assert.equal(f.retired,1);assert.equal(f.records.length,1,'No fallback or repeated OPEN');
 if(options.service)assert.equal(f.records[0].chunks.length,0,'Never send body to a different service');
}
{
 const f=fixture({transportCloseLoss:true});await f.stream.probe();
 await assert.rejects(f.stream.close());await assert.rejects(f.stream.close());assert.equal(f.retired,1);
 await assert.rejects(f.stream.probe());assert.equal(f.records.length,1);
}
{
 const f=fixture({stopOnSocketClose:true});await assert.rejects(f.stream.probe());
 assert.equal(f.retired,1);assert.equal(f.records.length,1,'Closure during final cleanup cannot become a ready probe');
}
for(const options of [{writeLoss:true},{badOutput:true}]) {
 const f=fixture(options);await f.stream.probe();const v=vectors[0];
 await assert.rejects(f.stream.execute(v.meta,v.scope,v.nonce,v.phase));
 await assert.rejects(f.stream.execute(v.meta,v.scope,v.nonce,v.phase));
 assert.equal(f.retired,1);assert.equal(f.records.length,2,'Lost body/ACK is never replayed');
}
{
 const f=fixture();await f.stream.probe();const v=vectors[0];
 await assert.rejects(f.stream.execute(v.meta,v.scope,v.nonce,'start'));
 await assert.rejects(f.stream.execute(v.meta,v.scope,v.nonce,v.phase));assert.equal(f.records.length,1);
}
{
 const f=fixture({delayOpen:true});const pending=f.stream.probe();
 await f.opened;await f.stream.close();await assert.rejects(pending);
 f.releaseOpen();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.records.length,1);assert.equal(f.records[0].chunks.length,0);assert.equal(f.records[0].closed,1,'Late open is closed, never adopted');
}
{
 const original=globalThis.setTimeout;
 globalThis.setTimeout=(callback,ms,...args)=>original(callback,Math.min(ms,10),...args);
 try {
  for(const options of [{noResponse:true},{noRemoteClose:true}]) {
   const f=fixture(options);await assert.rejects(f.stream.probe());assert.equal(f.retired,1);assert.equal(f.records.length,1);
  }
 } finally {globalThis.setTimeout=original;}
}
console.log('Fixed stdin chunks, exact completion/remote close, retirement, no fallback/replay/late adoption passed; no device IO');
