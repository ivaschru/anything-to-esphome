/** One consumed browser arming operation; fixed guards, no reboot or launch. */
import {FixedStdinLifecycle,fixedStdinService} from './usb-fixed-stdin.mjs';
import {bridgeNextBootCommand,bridgeBootCompletion} from './usb-bridge-boot-commands.mjs';
import {validateInitialPreparation} from './usb-initial-trial-scope.mjs';
const fail=()=>{throw {code:'usb_browser_scope_unverified'};};
const phases=['before','arm','armed','complete'];
const hex=/^[a-f0-9]{64}$/,id=/^[a-f0-9]{32}$/,uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const keys=v=>v && typeof v==='object' && !Array.isArray(v)?Object.keys(v).sort().join():null;
const stable=v=>Array.isArray(v)?'['+v.map(stable).join(',')+']':v && typeof v==='object'?
 '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}':JSON.stringify(v);
export const bridgeBootStreamService=fixedStdinService;

export class BridgeBootCommandStream {
 #engine;#next=0;
 constructor(backend) {
  this.#engine=new FixedStdinLifecycle(backend,async({meta,scope,nonce,phase})=>{
   const text=await bridgeNextBootCommand(meta,scope,nonce,phase);
   // The sealed body has no terminal newline because shell substitution
   // strips it. Remove only the builder's one final newline, never trim data.
   return text.endsWith('\n')?text.slice(0,-1):text;
  });
 }
 ready() {return this.#engine.ready();}
 probe() {return this.#engine.probe();}
 async execute(meta,scope,nonce,phase) {
  if(this.#next>=phases.length || phases[this.#next]!==phase || !this.#engine.ready()) {await this.close().catch(()=>{});fail();}
  this.#next++; // Consume before async assembly or a possibly lost command ACK.
  await this.#engine.execute({meta,scope,nonce,phase});
  return {phase,completed:true};
 }
 close() {return this.#engine.close();}
}

function preparation(value,context) {
 if(keys(value)!==['kind','preparation','trial_marker','trial_marker_checked','context_only'].sort().join() ||
    value.kind!=='browser_bridge_boot_preparation' || value.trial_marker_checked!==true || value.context_only!==true ||
    stable(value.trial_marker)!==stable(context.trial_marker))fail();
 validateInitialPreparation(value.preparation,context.meta,context.committed_scope);
}

export function validateBridgeBootPacket(p) {
 const fields=['schema_version','job_id','plan_sha256','intent_sha256','channel_id','channel_nonce','nonce','context','preparation','producer_sha256'];
 const producers=['browser_bridge_boot_journal.py','browser_bridge_boot_observation.py','browser_bridge_boot.py','bridge-next-boot-contract.json'];
 if(keys(p)!==fields.sort().join() || p.schema_version!==1 || typeof p.job_id!=='string' || !id.test(p.job_id) ||
    typeof p.channel_id!=='string' || !id.test(p.channel_id) || typeof p.channel_nonce!=='string' || !uuid.test(p.channel_nonce) ||
    typeof p.nonce!=='string' || !id.test(p.nonce) || typeof p.plan_sha256!=='string' || !hex.test(p.plan_sha256) ||
    typeof p.intent_sha256!=='string' || !hex.test(p.intent_sha256) || keys(p.producer_sha256)!==producers.sort().join() ||
    Object.values(p.producer_sha256).some(v=>typeof v!=='string' || !hex.test(v)) || JSON.stringify(p).length>65536)fail();
 const c=p.context;
 const contextFields=['schema_version','kind','job_id','plan_sha256','source_commit','trial_intent_sha256','trial_proof_sha256',
  'meta','committed_scope','trial_marker','producer_sha256','context_only','writer_enabled','installed','installation_ready','device_writes','live_recheck_required'];
 if(keys(c)!==contextFields.sort().join() || keys(c.producer_sha256)!==['browser_bridge_boot.py','bridge-next-boot-contract.json'].sort().join())fail();
 if(c?.kind!=='browser_bridge_next_boot_context' || c.schema_version!==1 || c.job_id!==p.job_id || c.plan_sha256!==p.plan_sha256 ||
    c.source_commit!=='53d97b9609e8e0fcdfc5d003101f620098dbc734' || c.context_only!==true || c.writer_enabled!==false ||
    c.installed!==false || c.installation_ready!==false || c.device_writes!==0 || c.live_recheck_required!==true ||
    c.meta?.job_id!==p.job_id || c.meta?.descriptor?.plan_sha256!==p.plan_sha256 || p.nonce===c.meta?.commit_nonce ||
    typeof c.trial_intent_sha256!=='string' || !hex.test(c.trial_intent_sha256) ||
    typeof c.trial_proof_sha256!=='string' || !hex.test(c.trial_proof_sha256) ||
    keys(c.trial_marker)!=='sha256,size' || !Number.isSafeInteger(c.trial_marker.size) || c.trial_marker.size<1 || c.trial_marker.size>4096 ||
    typeof c.trial_marker.sha256!=='string' || !hex.test(c.trial_marker.sha256))fail();
 for(const name of ['browser_bridge_boot.py','bridge-next-boot-contract.json'])if(c.producer_sha256?.[name]!==p.producer_sha256[name])fail();
 preparation(p.preparation,c);
}

export function validateArmedBridgeScope(value,baseline,marker) {
 const fields=Object.keys(baseline).filter(k=>k!=='disabled_flags').concat('boot_flags','arm_marker');
 if(keys(value)!==fields.sort().join() || value.kind!=='browser_bridge_armed_scope' ||
    stable(value.boot_flags)!==stable({bridge_disabled:false,recovery_backup:true,pm_disabled:true}) ||
    stable(value.arm_marker)!==stable(marker) || !Number.isSafeInteger(value.data_available_bytes) || value.data_available_bytes<8*1024**2)fail();
 const exclude=new Set(['kind','disabled_flags','boot_flags','arm_marker','data_available_bytes']);
 const invariant=v=>Object.fromEntries(Object.entries(v).filter(([key])=>!exclude.has(key)));
 if(stable(invariant(value))!==stable(invariant(baseline)))fail();
}

export class BrowserBridgeBootSession {
 #backend;#stream;#packet;#ready=false;#started=false;#next=0;#busy=false;#closed=false;#finished=false;#closing;
 constructor(backend,stream,packet) {
  if(keys(backend)!==['preparation','armed','identity','closeTransport'].sort().join() ||
     Object.values(backend).some(v=>typeof v!=='function') || !(stream instanceof BridgeBootCommandStream) || !stream.ready())fail();
  validateBridgeBootPacket(packet);
  this.#packet=JSON.parse(JSON.stringify(packet));this.#backend=Object.freeze({...backend});this.#stream=stream;
 }
 async #refuse() {await this.close().catch(()=>{});fail();}
 async #identity() {if(this.#closed || await this.#backend.identity(this.#packet.context.meta.target)!==true || this.#closed)fail();}
 async prepare() {
  if(this.#closed || this.#started || this.#busy)return this.#refuse();
  this.#started=true;this.#busy=true;
  try {
   await this.#identity();const p=this.#packet;
   preparation(await this.#backend.preparation(p.context.meta,p.context.trial_marker),p.context);
   await this.#identity();this.#ready=true;
   return {state:'bridge_boot_scope_rechecked',writer_enabled:false};
  }catch {return this.#refuse();}finally {this.#busy=false;}
 }
 async step(phase) {
  if(this.#closed || !this.#ready || this.#busy || this.#finished || this.#next>=phases.length || phases[this.#next]!==phase)return this.#refuse();
  this.#next++;this.#busy=true;
  try {
   await this.#identity();const p=this.#packet;
   const result=await this.#stream.execute(p.context.meta,p.preparation.preparation.scope,p.nonce,phase);
   if(this.#closed || stable(result)!==stable({phase,completed:true}))fail();
   await this.#identity();return result;
  }catch {return this.#refuse();}finally {this.#busy=false;}
 }
 async finish() {
  if(this.#closed || !this.#ready || this.#busy || this.#finished || this.#next!==phases.length)return this.#refuse();
  this.#finished=true;this.#busy=true;this.#ready=false;
  try {
   await this.#identity();const p=this.#packet;
   const pin=await bridgeBootCompletion(p.context.meta.descriptor.plan_id,p.plan_sha256,p.nonce);
   const value=await this.#backend.armed(p.context.meta,p.context.trial_marker,pin);
   validateArmedBridgeScope(value,p.preparation.preparation.scope,pin);
   await this.#identity();
   const proof={schema_version:1,...Object.fromEntries(['job_id','plan_sha256','intent_sha256','channel_id','channel_nonce','nonce'].map(k=>[k,p[k]])),
    commands_acknowledged:[...phases],armed_scope:value,transport_closed:true,channel_closed:false,
    program_started:false,autostart_armed:true,pm_disabled:true};
   await this.#backend.closeTransport();this.#closed=true;
   return JSON.parse(JSON.stringify(proof)); // Core must separately await channel-close ACK.
  }catch {return this.#refuse();}finally {this.#busy=false;}
 }
 close() {
  if(this.#closing)return this.#closing;
  this.#closed=true;this.#ready=false;
  this.#closing=Promise.resolve().then(()=>this.#backend.closeTransport());return this.#closing;
 }
}
