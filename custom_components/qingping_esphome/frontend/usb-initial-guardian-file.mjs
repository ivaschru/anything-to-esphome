/** One fixed first-trial guardian SYNC-v1 transfer, not a trial coordinator.
 *
 * A future private selected-channel caller must FIRST retain the consumed
 * journal/lease, recheck its original capability/scope, create the two exact
 * private tmpfs jobs and exclusively precreate this new 0600 destination.
 * This typed descriptor is context, never proof of those prerequisites.
 * Only /tmp/qingping-initial-guardian-<bound id>/program can be sent. No mkdir,
 * chmod, script, launch, signal, boot change, overwrite/resume or generic path
 * API exists. Hash the whole bounded body before opening SYNC once. A wire
 * OKAY does not verify remote bytes/metadata or admit an executable image FD.
 */
const maximum=16*1024*1024,chunkMaximum=65536;
const fail=()=>{throw {code:'usb_browser_scope_unverified'};};
const fields=value=>value && typeof value==='object' && !Array.isArray(value)?Object.keys(value).sort().join():null;
const hex=(value,length)=>typeof value==='string' && new RegExp('^[a-f0-9]{'+length+'}$').test(value);
const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
async function digest(bytes) {
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
}
async function cleanup(operation) {
 let timer;
 try {return await Promise.race([Promise.resolve().then(operation),new Promise((_,reject)=>{
  timer=setTimeout(()=>reject({code:'usb_close_unverified'}),2000);
 })]);} finally {clearTimeout(timer);}
}

/** Detached pure metadata check, not consumed-intent or live USB proof. */
export function initialGuardianDescriptor(input) {
  let descriptor;
  try {descriptor=JSON.parse(JSON.stringify(input));}catch{fail();}
  const expected=['schema_version','job_id','plan_sha256','intent_sha256','channel_id','channel_nonce',
   'nonce','ram_job_id','guardian_job_id','guardian'];
  if(fields(descriptor)!==expected.sort().join() || descriptor.schema_version!==1 ||
     ['job_id','channel_id','nonce','ram_job_id','guardian_job_id'].some(k=>!hex(descriptor[k],32)) ||
     ['plan_sha256','intent_sha256'].some(k=>!hex(descriptor[k],64)) ||
     typeof descriptor.channel_nonce!=='string' || !uuid.test(descriptor.channel_nonce) ||
     new Set([descriptor.nonce,descriptor.ram_job_id,descriptor.guardian_job_id]).size!==3 ||
     fields(descriptor.guardian)!==['size','sha256'].sort().join() || !Number.isInteger(descriptor.guardian.size) ||
     descriptor.guardian.size<52 || descriptor.guardian.size>maximum || !hex(descriptor.guardian.sha256,64))fail();
  return Object.freeze({...descriptor,guardian:Object.freeze(descriptor.guardian)});
}

export class BrowserInitialGuardianSink {
 #factory;#descriptor;#bytes;#offset=0;#started=false;#finished=false;#busy=false;#closed=false;
 #sync;#closing;#waiters=new Set();#deadline;#expiry;
 constructor(factory,input) {
  if(fields(factory)!==['openSync','pushV1','closeTransport'].sort().join() || Object.values(factory).some(v=>typeof v!=='function'))fail();
  this.#factory=Object.freeze({...factory});this.#descriptor=initialGuardianDescriptor(input);
  // This is only an additional maximum lifetime. The caller's closures must
  // retain the original selected handle's earlier deadline; never renew it.
  this.#deadline=Date.now()+240000;
  this.#expiry=setTimeout(()=>{void this.close().catch(()=>{});},240000);
 }
 #live() {return !this.#closed && Date.now()<this.#deadline;}
 async #refuse() {await this.close().catch(()=>{});fail();}
 async #bounded(operation) {
  if(!this.#live())fail();
  let timer,retire;
  try {
   const value=await Promise.race([Promise.resolve().then(operation),new Promise((_,reject)=>{
    retire=reject;this.#waiters.add(reject);
    timer=setTimeout(()=>reject({}),Math.min(90000,this.#deadline-Date.now()));
   })]);
   if(!this.#live())fail();return value;
  } finally {clearTimeout(timer);this.#waiters.delete(retire);}
 }
 async begin() {
  if(!this.#live() || this.#started || this.#busy)return this.#refuse();
  this.#started=true; // Consume before allocation, IO or any possibly lost ACK.
  try {this.#bytes=new Uint8Array(this.#descriptor.guardian.size);return {offset:0};}
  catch {return this.#refuse();}
 }
 async append(offset,bytes) {
  if(!this.#live() || !this.#started || this.#finished || this.#busy || !this.#bytes ||
     !Number.isInteger(offset) || offset!==this.#offset || !(bytes instanceof Uint8Array) ||
     bytes.length<1 || bytes.length>chunkMaximum || offset+bytes.length>this.#bytes.length)return this.#refuse();
  this.#bytes.set(bytes,offset);this.#offset+=bytes.length;
  return {offset:this.#offset}; // Host buffer acknowledgement only.
 }
 async finish() {
  if(!this.#live() || !this.#started || this.#finished || this.#busy || !this.#bytes || this.#offset!==this.#bytes.length)return this.#refuse();
  this.#busy=true;this.#finished=true; // No resend after hash/open/wire/close failure.
  try {
   const pin=this.#descriptor.guardian;
   if(await this.#bounded(()=>digest(this.#bytes))!==pin.sha256)throw Error();
   await this.#bounded(async()=>{
    const socket=await this.#factory.openSync();
    if(!this.#live()){await cleanup(()=>socket.close());throw Error();}
    this.#sync=socket;
   });
   const body=this.#bytes;
   await this.#bounded(()=>this.#factory.pushV1({socket:this.#sync,
    filename:'/tmp/qingping-initial-guardian-'+this.#descriptor.guardian_job_id+'/program',
    type:0o10,permission:0o600,mtime:0,packetSize:chunkMaximum,
    file:new ReadableStream({start(controller){controller.enqueue(body);controller.close();}})}));
   const socket=this.#sync;this.#sync=undefined;await cleanup(()=>socket.close());
   if(!this.#live())throw Error();
   this.#bytes=undefined;
   // Keep the original transport for the future independent remote SHA/UID/
   // nlink/root/mode readback and guardian lifecycle. Nothing is executed here.
   return {guardian_job_id:this.#descriptor.guardian_job_id,size:pin.size,sha256:pin.sha256,wire_acknowledged:true};
  } catch {return this.#refuse();}
  finally {this.#busy=false;}
 }
 close() {
  if(this.#closing)return this.#closing;
  this.#closed=true;clearTimeout(this.#expiry);this.#bytes=undefined;
  for(const reject of this.#waiters)reject({code:'usb_browser_scope_unverified'});
  const socket=this.#sync;this.#sync=undefined;
  this.#closing=(async()=>{
   let failed=false;
   if(socket){try{await cleanup(()=>socket.close());}catch{failed=true;}}
   try{await cleanup(()=>this.#factory.closeTransport());}catch{failed=true;}
   if(failed)throw {code:'usb_close_unverified'};
  })();
  return this.#closing; // Preserve the same failure for every close caller.
 }
}
