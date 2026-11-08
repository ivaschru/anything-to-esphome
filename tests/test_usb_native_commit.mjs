/** Real peer/selected NativeChannel/session/stream, emulated daemon only. */
import assert from 'node:assert/strict';
import {BrowserChannelPeer} from '../custom_components/qingping_esphome/frontend/usb-channel-peer.mjs';
import {createNativeChannel} from '../custom_components/qingping_esphome/frontend/usb-probe-bundle.mjs';
import {disabledTransport} from './fixtures/usb_disabled_transport.mjs';
const phases=['claim','watchdog','start'];
async function selected(options={}) {
 const f=disabledTransport(options),peer=new BrowserChannelPeer(f.link);let id=0;
 const opening=f.link.selectForReview();assert.equal(f.picked,1,'Original picker click precedes network work');await opening;
 return {...f,fixture:f,peer,call:(operation,data=null)=>peer.dispatch({id:(++id).toString(16).padStart(32,'0'),operation,data})};
}
{
 const f=await selected();assert.equal((await f.call('commit-stream-check')).data.ready,true);
 const packet=f.packet();assert.equal(f.fixture.effects,0);
 assert.equal((await f.call('disabled-scope',{meta:f.meta})).data.commit_nonce,null);
 assert.deepEqual((await f.call('commit-prepare',{packet})).data,{state:'commit_scope_rechecked',writer_enabled:false});
 assert.equal(f.fixture.effects,0,'Prepare repeats reads, never creates the owner lock');
 for(const phase of phases) {
  const result=await f.call('commit-step',{phase});assert.equal(result.ok,true);assert.equal(result.data.phase,phase);
  assert.equal(result.data.scope.commit_nonce,packet.nonce);
 }
 const result=await f.call('commit-complete');assert.equal(result.ok,true);const proof=result.data;
 assert.equal(proof.transport_closed,true);assert.equal(proof.program_started,false);assert.equal(proof.boot_flags_changed,false);
 assert.deepEqual(proof.commands_acknowledged,phases);assert.equal(proof.observations.length,3);
 assert.equal(proof.channel_nonce,packet.channel_nonce);assert.equal(f.fixture.effects,3);assert.equal(f.fixture.closed,1);
 assert.equal(f.rawBodies.length,4,'One harmless probe, claim and exactly two script bodies');assert(f.rawBodies[2].length>4096);
 assert(f.fixture.rootReads>=18,'Fresh complete scopes before/after every phase and final close');
 assert.equal((await f.call('channel-close')).ok,true);assert.equal(f.fixture.closed,1,'Independent close shares original actual ACK');
 await assert.rejects(f.link.openApi());await assert.rejects(f.call('commit-step',{phase:'start'}));assert.equal(f.fixture.effects,3);
}
for(const options of [{unsupported:true},{ackLossAfter:1},{changedRootAfter:2},{closeLoss:true}]) {
 const f=await selected(options);
 const probe=await f.call('commit-stream-check');
 if(options.unsupported){assert.equal(probe.ok,false);assert.equal(f.fixture.effects,0);assert.equal(f.rawBodies.length,0);continue;}
 assert.equal(probe.ok,true);assert.equal((await f.call('commit-prepare',{packet:f.packet()})).ok,true);
 let failed=false;
 for(const phase of phases) {
  if(!(await f.call('commit-step',{phase})).ok){failed=true;break;}
 }
 if(!failed)assert.equal((await f.call('commit-complete')).ok,false);
 assert.equal(f.fixture.closed,1);
 await assert.rejects(f.call('commit-step',{phase:'claim'}));
 assert.equal(f.fixture.effects,options.ackLossAfter?1:options.changedRootAfter?2:3,'No retry or automatic rollback after uncertain effects');
}
{
 const f=await selected();await f.call('commit-stream-check');const packet=f.packet();packet.channel_nonce='00000000-0000-0000-0000-000000000000';
 assert.equal((await f.call('commit-prepare',{packet})).ok,false);assert.equal(f.fixture.effects,0);assert.equal(f.fixture.closed,1);
}
{
 const f=await selected();await f.call('commit-stream-check');
 assert.equal((await f.call('commit-prepare',{packet:f.packet(),command:'not admitted'})).ok,false);assert.equal(f.fixture.effects,0);
}
console.log('Actual selected peer commit: fixed probe/stdin, fresh phase scopes, exact proof/USB close and no replay/fallback/rollback passed; no hardware');

// Exercise the actual delivered/minified class and its sealed bootstrap strings.
// Constructing the unused factory opens no USB or key. Its constructor accepts
// the same test-owned transport closures; no product API/export is added.
{
 const f=disabledTransport({},createNativeChannel().constructor),peer=new BrowserChannelPeer(f.link);let id=0;
 const call=(operation,data=null)=>peer.dispatch({id:(++id).toString(16).padStart(32,'0'),operation,data});
 await f.link.selectForReview();assert.equal((await call('commit-stream-check')).ok,true);
 assert.equal((await call('commit-prepare',{packet:f.packet()})).ok,true);
 for(const phase of phases)assert.equal((await call('commit-step',{phase})).ok,true);
 assert.equal((await call('commit-complete')).data.transport_closed,true);
 assert.equal((await call('channel-close')).ok,true);assert.equal(f.effects,3);assert.equal(f.closed,1);
}
console.log('Actual delivered offline bundle: selected commit and sealed bootstrap byte parity passed; no hardware');
