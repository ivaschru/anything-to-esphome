/** One original PM next-boot packet; no launch, reboot or generic selector. */
import {PmBootCommandStream} from './usb-pm-boot-stream.mjs';
import {validatePmBootScope} from './usb-pm-boot-commands.mjs';
const fail=()=>{throw {code:'usb_browser_scope_unverified'};};
const keys=v=>v && typeof v==='object' && !Array.isArray(v)?Object.keys(v).sort().join():null;
const stable=v=>Array.isArray(v)?'['+v.map(stable).join(',')+']':v && typeof v==='object'?
 '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}':JSON.stringify(v);
const hex=/^[a-f0-9]{64}$/,id=/^[a-f0-9]{32}$/;
export function validatePmBootPacket(p) {
 const fields=['schema_version','job_id','plan_sha256','channel_id','channel_nonce','nonce','context','native_pair','observation','producer_sha256','intent_sha256'];
 const producers=['browser_pm_boot_journal.py','browser_pm_boot_observation.py','pm-next-boot-contract.json','pm_extension_guard.py','browser_boot_context.py'];
 if(keys(p)!==fields.sort().join() || p.schema_version!==1 || typeof p.job_id!=='string' || !id.test(p.job_id) ||
    typeof p.plan_sha256!=='string' || !hex.test(p.plan_sha256) || typeof p.intent_sha256!=='string' || !hex.test(p.intent_sha256) ||
    typeof p.channel_id!=='string' || !id.test(p.channel_id) || typeof p.channel_nonce!=='string' ||
    !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(p.channel_nonce) || typeof p.nonce!=='string' || !id.test(p.nonce) ||
    p.nonce==='0'.repeat(32) || keys(p.producer_sha256)!==producers.sort().join() ||
    Object.values(p.producer_sha256).some(v=>typeof v!=='string' || !hex.test(v)) ||
    keys(p.native_pair)!=='guardian-program,native-program' || keys(p.observation)!=='scope,wire' || JSON.stringify(p).length>65536)fail();
 for(const pin of Object.values(p.native_pair))if(keys(pin)!=='sha256,size' || !Number.isSafeInteger(pin.size) || pin.size<1 || pin.size>16*1024**2 ||
    typeof pin.sha256!=='string' || !hex.test(pin.sha256))fail();
 validatePmBootScope(p.context,p.observation.scope);
 const c=p.context,w=p.observation.wire;
 if(p.job_id!==c.job_id || p.plan_sha256!==c.plan_sha256 || p.channel_id===c.arming.channel_id || p.channel_nonce===c.arming.channel_nonce ||
    p.nonce===c.arming.nonce || p.nonce===c.arming.context.meta.commit_nonce ||
    keys(w)!=='api_closed,final_scope_checked,identity,last_sample_age_at_prepare_s,samples' ||
    !Number.isInteger(w.samples) || w.samples<2 || w.samples>32 || typeof w.last_sample_age_at_prepare_s!=='number' ||
    !Number.isFinite(w.last_sample_age_at_prepare_s) || w.last_sample_age_at_prepare_s<0 || w.last_sample_age_at_prepare_s>20 ||
    stable(w.identity)!==stable(c.api_identity) || w.api_closed!==true || w.final_scope_checked!==true)fail();
}

export class BrowserPmBootSession {
 #backend;#stream;#packet;#ready=false;#used=false;#next=0;#busy=false;#closed=false;#closing;#finished=false;
 constructor(backend,stream,packet) {
  if(keys(backend)!=='closeTransport,identity,scope' || Object.values(backend).some(v=>typeof v!=='function') ||
     !(stream instanceof PmBootCommandStream) || !stream.ready())fail();
  validatePmBootPacket(packet);this.#backend=Object.freeze({...backend});this.#stream=stream;this.#packet=JSON.parse(JSON.stringify(packet));
 }
 async #refuse(){await this.close().catch(()=>{});fail();}
 async #identity(){if(this.#closed || await this.#backend.identity(this.#packet.observation.scope.target)!==true || this.#closed)fail();}
 async #scope(){
  const p=this.#packet,value=await this.#backend.scope(p.context);validatePmBootScope(p.context,value);
  const invariant=v=>Object.fromEntries(Object.entries(v).filter(([key])=>key!=='memory_free_bytes'));
  if(stable(invariant(value))!==stable(invariant(p.observation.scope)))fail();
 }
 async prepare(){
  if(this.#closed || this.#used || this.#busy)return this.#refuse();this.#used=true;this.#busy=true;
  try{await this.#identity();await this.#scope();await this.#identity();this.#ready=true;return {state:'pm_boot_scope_rechecked',writer_enabled:false};}
  catch{return this.#refuse();}finally{this.#busy=false;}
 }
 async step(phase){
  if(this.#closed || !this.#ready || this.#busy || this.#finished || this.#next>=2 || ['arm','complete'][this.#next]!==phase)return this.#refuse();
  this.#next++;this.#busy=true;
  try{
   await this.#identity();
   if(phase==='arm')await this.#scope(); // Only BEFORE effects, never a fictitious disabled read after the write.
   const p=this.#packet,value=await this.#stream.execute(p.context,p.observation.scope,p.nonce,phase);
   if(stable(value)!==stable({phase,completed:true}))fail();await this.#identity();return value;
  }catch{return this.#refuse();}finally{this.#busy=false;}
 }
 async finish(){
  if(this.#closed || !this.#ready || this.#busy || this.#finished || this.#next!==2)return this.#refuse();
  this.#finished=true;this.#busy=true;this.#ready=false;
  try{
   await this.#identity();const p=this.#packet;
   // The second sealed command is the independent canonical READ of all
   // AFTER-effects, not another writer or merely the first write's ACK.
   const proof={schema_version:1,...Object.fromEntries(['job_id','plan_sha256','channel_id','channel_nonce','nonce','intent_sha256'].map(k=>[k,p[k]])),
    commands_acknowledged:['arm','complete'],after_effects_read_acknowledged:true,target:p.observation.scope.target,
    current_boot_preserved:true,transport_closed:true,channel_closed:false,pm_next_boot_armed:true};
   await this.#backend.closeTransport();this.#closed=true;return JSON.parse(JSON.stringify(proof));
  }catch{return this.#refuse();}finally{this.#busy=false;}
 }
 close(){
  if(this.#closing)return this.#closing;this.#closed=true;this.#ready=false;
  this.#closing=Promise.resolve().then(()=>this.#backend.closeTransport());return this.#closing;
 }
}
