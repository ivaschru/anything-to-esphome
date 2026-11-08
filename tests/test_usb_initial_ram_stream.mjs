/** Finite sealed creation transport; body is buffered/hashed, NEVER executed. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {InitialRamCommandStream,initialRamStreamService} from '../custom_components/qingping_esphome/frontend/usb-initial-ram-stream.mjs';
import {fixedStdinFixture} from './fixtures/usb_fixed_stdin_socket.mjs';
const vectors=JSON.parse(execFileSync(process.env.PYTHON||'python3',['tests/fixtures/monitor1_browser_initial_ram.py'],{encoding:'utf8',maxBuffer:1024*1024}));
const fixture=options=>fixedStdinFixture(InitialRamCommandStream,initialRamStreamService,options);
for(const v of vectors) {
 const f=fixture();await f.stream.probe();
 const ack=await f.stream.create(v.packet,v.preparation);
 assert.deepEqual(ack,{kind:'browser_initial_ram_command_ack',completed:true,remote_verified:false,image_fd_admitted:false});
 assert.equal(f.records.length,2);assert.equal(f.records[1].body,v.expected.create);
 assert.ok(f.records[1].chunks.length>2);assert.equal(f.stream.ready(),false);
 await assert.rejects(f.stream.create(v.packet,v.preparation));assert.equal(f.records.length,2);
 assert.equal(f.retired,1);await f.stream.close();assert.equal(f.retired,1);
}
{
 const f=fixture();await assert.rejects(f.stream.create(vectors[0].packet,vectors[0].preparation));
 assert.equal(f.records.length,0);assert.equal(f.retired,1,'No unprobed execution/fallback');
}
for(const options of [{writeLoss:true},{badOutput:true},{transportCloseLoss:true}]) {
 const f=fixture(options),v=vectors[0];await f.stream.probe();
 if(options.transportCloseLoss)await f.stream.create(v.packet,v.preparation);
 else await assert.rejects(f.stream.create(v.packet,v.preparation));
 await assert.rejects(f.stream.create(v.packet,v.preparation));
 assert.equal(f.records.length,2);assert.equal(f.retired,1);
 if(options.transportCloseLoss)await assert.rejects(f.stream.close());
}
{
 const f=fixture(),v=vectors[0];await f.stream.probe();
 const bad=structuredClone(v.packet);bad.ram_job_id='../../bad';
 await assert.rejects(f.stream.create(bad,v.preparation));assert.equal(f.records.length,1,'Refuse before creation OPEN');
 await assert.rejects(f.stream.create(v.packet,v.preparation));assert.equal(f.records.length,1);assert.equal(f.retired,1);
}
{
 const f=fixture({delayOpen:true});const pending=f.stream.probe();
 await f.opened;await f.stream.close();await assert.rejects(pending);
 f.releaseOpen();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.records[0].chunks.length,0);assert.equal(f.records[0].closed,1);
}
for(const options of [{unsupported:true},{service:'tcp:6053'},{nul:true},{socketCloseLoss:true}]) {
 const f=fixture(options);await assert.rejects(f.stream.probe());await assert.rejects(f.stream.probe());
 assert.equal(f.records.length,1);assert.equal(f.retired,1);
}
console.log('Typed initial RAM stdin: exact sealed body, probe gate, one creation, failure/late-open retirement and no replay passed; no execution, device verification or hardware');
