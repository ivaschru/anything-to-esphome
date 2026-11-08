/** Unwired finite RAM creation -> guardian transfer -> independent readback.
 *
 * The private caller must hold the consumed first-trial journal/lease and the
 * ORIGINAL selected channel. Pass its already-probed InitialRamCommandStream;
 * serialized metadata cannot reopen/adopt a handle or renew its deadline.
 * This session never chmods, starts, signals, prunes or changes a boot flag.
 * A successful result keeps the original transport for the separate actual
 * device image-FD admission and guardian lifecycle, neither implemented here.
 */
import {InitialRamCommandStream} from './usb-initial-ram-stream.mjs';
import {BrowserInitialGuardianSink,initialGuardianDescriptor} from './usb-initial-guardian-file.mjs';
import {initialRamCommands} from './usb-initial-ram-commands.mjs';
import {initialRamPrecreated,initialGuardianReadback} from './usb-initial-ram-observation.mjs';
const fail=()=>{throw {code:'usb_browser_scope_unverified'};};
const fields=v=>v && typeof v==='object' && !Array.isArray(v)?Object.keys(v).sort().join():null;
export class BrowserInitialRamSession {
 #backend;#stream;#sink;#packet;#precreated;#started=false;#prepared=false;#finished=false;#busy=false;
 #closed=false;#closing;#waiters=new Set();#deadline;#expiry;
 constructor(backend,stream,input) {
  if(fields(backend)!==['preparation','read','openSync','pushV1'].sort().join() ||
     Object.values(backend).some(v=>typeof v!=='function') || !(stream instanceof InitialRamCommandStream) || !stream.ready())fail();
  let packet;try {packet=JSON.parse(JSON.stringify(input));}catch{fail();}
  // Pure full metadata/source/committed-state validation before any timer/IO.
  initialRamCommands(packet,packet?.preparation);
  const descriptor=initialGuardianDescriptor(Object.fromEntries(
   ['schema_version','job_id','plan_sha256','intent_sha256','channel_id','channel_nonce','nonce','ram_job_id','guardian_job_id']
    .map(k=>[k,packet[k]]).concat([['guardian',packet.context.guardian]])));
  this.#backend=Object.freeze({...backend});this.#stream=stream;this.#packet=packet;
  // The sink owns its SYNC resource; the stream owns actual transport cleanup.
  // Every failure converges on the SAME stream close promise, never a second
  // backend teardown or a recursive session-close callback.
  this.#sink=new BrowserInitialGuardianSink({openSync:()=>this.#backend.openSync(),pushV1:r=>this.#backend.pushV1(r),
   closeTransport:()=>this.#stream.close()},descriptor);
  // Additional maximum only. Every supplied closure must retain the earlier
  // actual selected-channel deadline; this cannot prolong that capability.
  this.#deadline=Date.now()+240000;
  this.#expiry=setTimeout(()=>{void this.close().catch(()=>{});},240000);
 }
 async #refuse() {await this.close().catch(()=>{});fail();}
 async #bounded(operation) {
  if(this.#closed || Date.now()>=this.#deadline)fail();
  let timer,rejectWaiter;
  try {
   const result=await Promise.race([Promise.resolve().then(operation),new Promise((_,reject)=>{
    rejectWaiter=reject;this.#waiters.add(reject);
    timer=setTimeout(()=>{void this.close().catch(()=>{});reject({code:'usb_browser_scope_unverified'});},
     Math.min(90000,this.#deadline-Date.now()));
   })]);
   if(this.#closed || Date.now()>=this.#deadline)fail();return result;
  } finally {clearTimeout(timer);this.#waiters.delete(rejectWaiter);}
 }
 async #fresh() {
  const value=await this.#bounded(()=>this.#backend.preparation(this.#packet.context.meta));
  initialRamCommands(this.#packet,value);return value;
 }
 async #reads(fresh) {
  const commands=initialRamCommands(this.#packet,fresh);
  const roots_before=await this.#bounded(()=>this.#backend.read(commands.inspect_roots));
  const guardian=await this.#bounded(()=>this.#backend.read(commands.inspect_guardian));
  const roots_after=await this.#bounded(()=>this.#backend.read(commands.inspect_roots));
  return {roots_before,guardian,roots_after};
 }
 async prepare() {
  if(this.#closed || this.#started || this.#busy)return this.#refuse();
  this.#started=true;this.#busy=true; // No retry after any possibly lost creation ACK.
  try {
   await this.#bounded(()=>this.#sink.begin());
   const fresh=await this.#fresh();
   const ack=await this.#bounded(()=>this.#stream.create(this.#packet,fresh));
   if(fields(ack)!==['kind','completed','remote_verified','image_fd_admitted'].sort().join() ||
      ack.kind!=='browser_initial_ram_command_ack' || ack.completed!==true || ack.remote_verified!==false || ack.image_fd_admitted!==false)fail();
   this.#precreated=initialRamPrecreated(this.#packet,fresh,await this.#reads(fresh));
   await this.#fresh(); // Recheck original NAND/stock scope after RAM observations.
   this.#prepared=true;
   return {state:'ram_precreated',precreated:this.#precreated,writer_enabled:false,image_fd_admitted:false};
  } catch {return this.#refuse();}finally {this.#busy=false;}
 }
 async append(offset,bytes) {
  if(this.#closed || !this.#prepared || this.#finished || this.#busy)return this.#refuse();
  this.#busy=true;
  try {return await this.#bounded(()=>this.#sink.append(offset,bytes));}
  catch {return this.#refuse();}finally {this.#busy=false;}
 }
 async finish() {
  if(this.#closed || !this.#prepared || this.#finished || this.#busy)return this.#refuse();
  this.#finished=true;this.#busy=true;
  try {
   const sent=await this.#bounded(()=>this.#sink.finish()); // Full body hash before one SYNC SEND.
   const pin=this.#packet.context.guardian;
   if(fields(sent)!==['guardian_job_id','size','sha256','wire_acknowledged'].sort().join() ||
      sent.guardian_job_id!==this.#packet.guardian_job_id || sent.size!==pin.size || sent.sha256!==pin.sha256 || sent.wire_acknowledged!==true)fail();
   const fresh=await this.#fresh();
   const uploaded=initialGuardianReadback(this.#packet,fresh,this.#precreated,await this.#reads(fresh));
   const preparation=await this.#fresh();
   return {kind:'browser_initial_ram_ready',precreated:this.#precreated,uploaded,preparation,
    transport_closed:false,guardian_started:false,image_fd_admitted:false,execution_authority:false,context_only:true};
  } catch {return this.#refuse();}finally {this.#busy=false;}
 }
 close() {
  if(this.#closing)return this.#closing;
  this.#closed=true;this.#prepared=false;clearTimeout(this.#expiry);
  for(const reject of this.#waiters)reject({code:'usb_browser_scope_unverified'});
  this.#closing=this.#sink.close();return this.#closing;
 }
}
