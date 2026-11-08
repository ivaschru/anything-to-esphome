/** One consumed private disabled commit, with separate finite phase frames.
 * The parent must already own the durable journal/lease and actual registry
 * capability. Metadata cannot register/reopen a transport or renew a deadline.
 * No vendor command text/path, rollback, activation or retry enters this API.
 */
import {DisabledCommandStream} from './usb-disabled-stream.mjs';
import {disabledCommand,validateDisabledObservation,stableDisabledScope} from './usb-disabled-commands.mjs';
import {contract} from './usb-probe-contract.mjs';
import {disabledContract} from './usb-disabled-contract.mjs';
const fail=()=>{throw {code:'usb_browser_scope_unverified'};};
const phases=['claim','watchdog','start'],hex=/^[a-f0-9]{64}$/;
const source='53d97b9609e8e0fcdfc5d003101f620098dbc734';
const keys=value=>value && typeof value==='object' && !Array.isArray(value)?Object.keys(value).sort().join():null;

export class BrowserDisabledCommitSession {
 #backend;#stream;#packet;#baseline;#started=false;#ready=false;#busy=false;#next=0;#observations=[];#acks=[];
 #closed=false;#closing;#finished=false;
 constructor(backend,stream,input) {
  const fields=['schema_version','job_id','plan_sha256','intent_sha256','channel_id','channel_nonce','nonce',
   'source_commit','meta','initial_scope','producer_sha256'];
  if(!backend || keys(backend)!==['scope','closeTransport'].sort().join() || Object.values(backend).some(v=>typeof v!=='function') ||
     !(stream instanceof DisabledCommandStream) || !stream.ready() || keys(input)!==fields.sort().join() ||
     input.schema_version!==1 || input.source_commit!==source || input.meta?.commit_nonce!==null ||
     input.job_id!==input.meta?.job_id || input.plan_sha256!==input.meta?.descriptor?.plan_sha256 ||
     typeof input.intent_sha256!=='string' || !hex.test(input.intent_sha256) ||
     typeof input.channel_id!=='string' || !/^[a-f0-9]{32}$/.test(input.channel_id) ||
     typeof input.channel_nonce!=='string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(input.channel_nonce) ||
     keys(input.producer_sha256)!==['browser_commit.py','disabled-write-contract.json'].sort().join() ||
     Object.values(input.producer_sha256).some(v=>typeof v!=='string' || !hex.test(v)) || JSON.stringify(input).length>32768)fail();
  // This only validates a pure body. No file, process or device action occurs.
  disabledCommand(input.meta,input.initial_scope,input.nonce,'claim');
  this.#packet=JSON.parse(JSON.stringify(input));this.#baseline=stableDisabledScope(input.initial_scope);
  this.#backend=Object.freeze({...backend});this.#stream=stream;
 }
 async #refuse() {await this.close().catch(()=>{});fail();}
 #meta(count) {return {...this.#packet.meta,commit_nonce:count===0?null:this.#packet.nonce};}
 async #scope(count) {
  if(this.#closed)fail();
  const meta=this.#meta(count),observed=await this.#backend.scope(meta);
  if(this.#closed)fail();
  validateDisabledObservation(meta,observed);
  if(stableDisabledScope(observed)!==this.#baseline)fail();
  for(const [path,digest] of observed.vendor_hashes) {
   let expected=contract.files.find(pin=>pin.path===path).sha256;
   if(count>=2 && path==='/data/bin/watchdog.sh' || count===3 && path==='/data/etc/init.d/start.sh')expected=disabledContract.patched[path].sha256;
   if(digest!==expected)fail();
  }
  return JSON.parse(JSON.stringify(observed));
 }
 async prepare() {
  if(this.#closed || this.#started || this.#busy)return this.#refuse();
  this.#started=true;this.#busy=true;
  try {
   await this.#scope(0);this.#ready=true;
   return {state:'commit_scope_rechecked',writer_enabled:false};
  } catch {return this.#refuse();}finally {this.#busy=false;}
 }
 async step(phase) {
  if(this.#closed || !this.#ready || this.#busy || this.#finished || phases[this.#next]!==phase)return this.#refuse();
  const index=this.#next++;this.#busy=true; // Before the possibly lost command ACK.
  try {
   const before=await this.#scope(index);
   const ack=await this.#stream.execute(this.#meta(index),before,this.#packet.nonce,phase);
   if(this.#closed || keys(ack)!==['phase','completed'].sort().join() || ack.phase!==phase || ack.completed!==true)fail();
   const observed=await this.#scope(index+1);
   this.#observations.push(observed);this.#acks.push(phase);
   return {phase,completed:true,scope:observed};
  } catch {return this.#refuse();}finally {this.#busy=false;}
 }
 async finish() {
  if(this.#closed || !this.#ready || this.#busy || this.#finished || this.#next!==3 || this.#observations.length!==3)return this.#refuse();
  this.#finished=true;this.#ready=false;this.#busy=true;
  try {
   // Repeat the final full scope before actual transport teardown, rather
   // than qualifying a cached final step across another server round trip.
   this.#observations[2]=await this.#scope(3);
   const p=this.#packet,proof={schema_version:1,job_id:p.job_id,plan_sha256:p.plan_sha256,intent_sha256:p.intent_sha256,
    channel_id:p.channel_id,channel_nonce:p.channel_nonce,nonce:p.nonce,commands_acknowledged:[...this.#acks],
    observations:this.#observations,transport_closed:true,program_started:false,boot_flags_changed:false};
   await this.#backend.closeTransport();this.#closed=true;
   return JSON.parse(JSON.stringify(proof));
  } catch {return this.#refuse();}finally {this.#busy=false;}
 }
 close() {
  if(this.#closing)return this.#closing;
  this.#closed=true;this.#ready=false;
  this.#closing=Promise.resolve().then(()=>this.#backend.closeTransport());
  return this.#closing;
 }
}
