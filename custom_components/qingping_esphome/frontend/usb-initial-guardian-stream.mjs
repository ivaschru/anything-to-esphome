/** Unwired one-shot bounded guardian stdout transport, never a PID controller.
 *
 * Its private caller must FIRST retain the consumed actor/RAM handoff, same
 * selected channel and positive harmless exec probe. JSON grants none of that.
 * The fixed guarded body is sealed before parsing. Only complete ordered
 * START/CHILD/END records and the final raw close are accepted; they remain
 * reported context until independent process/stock/Noise checks join them.
 * No signal, retry, path, service, duration, boot change or terminal journal
 * operation is exposed. Closing retires only this owned connection; the
 * admitted device guardian owns its child and fixed 60/5/5-second stop loop.
 */
import {fixedStdinService} from './usb-fixed-stdin.mjs';
import {initialGuardianLaunchBody} from './usb-initial-guardian-frame.mjs';
import {initialGuardianRecord} from './usb-initial-guardian-records.mjs';
const fail=()=>{throw {code:'usb_browser_scope_unverified'};};
const encoder=new TextEncoder();
function deferred() {let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});promise.catch(()=>{});return {promise,resolve,reject};}
export const initialGuardianStreamService=fixedStdinService;
export class InitialGuardianStream {
 #backend;#used=false;#busy=false;#started=false;#finished=false;#closed=false;#closing;
 #resource;#waiters=new Set();#deadline;#expiry;#ready;#sent;#draining;#start;#child;#end;#forbidden;
 constructor(backend) {
  if(!backend || Object.keys(backend).sort().join()!==['open','live','closeTransport'].sort().join() ||
     Object.values(backend).some(v=>typeof v!=='function'))fail();
  this.#backend=Object.freeze({...backend});
 }
 #live() {if(this.#closed || this.#backend.live()!==true || Date.now()>=this.#deadline)fail();}
 async #bounded(operation,deadline=this.#deadline) {
  this.#live();let timer,rejectWaiter;
  try {
   const value=await Promise.race([Promise.resolve().then(operation),new Promise((_,reject)=>{
    rejectWaiter=reject;this.#waiters.add(reject);
    timer=setTimeout(()=>{void this.close().catch(()=>{});reject({code:'usb_browser_scope_unverified'});},Math.max(0,deadline-Date.now()));
   })]);this.#live();return value;
  } finally {clearTimeout(timer);this.#waiters.delete(rejectWaiter);}
 }
 async #cleanup(resource) {
  if(!resource)return;
  if(resource.cleanup)return resource.cleanup;
  resource.cleanup=(async()=>{
   let failed=false;
   const bounded=async action=>{
    let timer;try {await Promise.race([Promise.resolve().then(action),new Promise((_,reject)=>{timer=setTimeout(()=>reject({}),2000);})]);}
    finally {clearTimeout(timer);}
   };
   try {await bounded(()=>resource.socket.close());}catch {failed=true;}
   if(resource.reader){try {await bounded(()=>resource.reader.cancel());resource.reader.releaseLock();}catch {failed=true;}resource.reader=undefined;}
   if(resource.writer){try {resource.writer.releaseLock();}catch {failed=true;}resource.writer=undefined;}
   if(failed)fail();
  })();return resource.cleanup;
 }
 async #drain(resource,nonce,marker) {
  let buffer='',phase=0,total=0;
  while(true) {
   const {value,done}=await this.#bounded(()=>resource.reader.read());if(done)break;
   if(!(value instanceof Uint8Array) || !value.length || value.some(v=>v===0 || v>127) || (total+=value.length)>4096)fail();
   buffer+=new TextDecoder().decode(value);
   while(buffer.includes('\n')) {
    const index=buffer.indexOf('\n'),line=buffer.slice(0,index+1);buffer=buffer.slice(index+1);
    if(phase===0) {
     this.#start=initialGuardianRecord(line,nonce);if(this.#start.kind!=='start' || this.#forbidden.has(this.#start.stamp[0]))fail();
    } else if(phase===1) {
     this.#child=initialGuardianRecord(line,nonce,this.#start.stamp);if(this.#child.kind!=='child' || this.#forbidden.has(this.#child.stamp[0]))fail();
     this.#ready.resolve();
    } else if(phase===2) {
     this.#end=initialGuardianRecord(line,nonce,this.#start.stamp);
     if(this.#end.kind!=='end' || this.#end.child[0]!==this.#child.stamp[0] || this.#end.child[1]!==this.#child.stamp[1])fail();
    } else if(phase===3) {if(line!=='\n' && line!=='\r\n')fail();}
    else if(phase===4) {if(line!==marker+'\n' && line!==marker+'\r\n')fail();}
    else fail();
    phase++;
   }
   if(buffer.length>512)fail(); // No partial oversized line survives another read.
  }
  if(buffer || phase!==5 || !this.#end)fail();
  await this.#bounded(()=>resource.socket.closed);
  await this.#bounded(()=>this.#sent.promise); // Do not release a writer with its final WRTE ACK pending.
  await this.#cleanup(resource);this.#live();clearTimeout(this.#expiry);
  return {kind:'browser_initial_guardian_records',start:this.#start,child:this.#child,end:this.#end,
   raw_closed:true,transport_closed:false,records_only:true};
 }
 async start(input,freshInput,ramInput) {
  if(this.#used || this.#busy || this.#closed){await this.close().catch(()=>{});fail();}
  this.#used=true;this.#busy=true;
  // A fixed additional host limit, never a replacement/extension for the
  // backend's earlier original selected-channel deadline or device stop timer.
  this.#deadline=Date.now()+110000;
  this.#expiry=setTimeout(()=>{void this.close().catch(()=>{});},110000);
  this.#ready=deferred();this.#sent=deferred();
  try {
   let packet,fresh,ram;
   try {[packet,fresh,ram]=JSON.parse(JSON.stringify([input,freshInput,ramInput]));}catch{fail();}
   const body=encoder.encode(initialGuardianLaunchBody(packet,fresh,ram));
   this.#forbidden=new Set([fresh.scope.stock_process[0],fresh.scope.watchdog_process[0]]);
   const sha=Array.from(new Uint8Array(await this.#bounded(()=>crypto.subtle.digest('SHA-256',body))),v=>v.toString(16).padStart(2,'0')).join('');
   const marker='__CGS1_FIXED_OK_'+crypto.randomUUID().replaceAll('-','')+'__';
   const framing=Object.freeze({size:body.length,sha256:sha,marker}),service=fixedStdinService(framing);
   const socket=await this.#bounded(async()=>{
    const value=await this.#backend.open(framing);
    try {this.#live();}catch {await this.#cleanup({socket:value}).catch(()=>{});fail();}return value;
   },Date.now()+5000);
   const resource=this.#resource={socket};
   if(!socket || ![service,service+'\0'].includes(socket.service) || typeof socket.closed?.then!=='function' ||
      typeof socket.readable?.getReader!=='function' || typeof socket.writable?.getWriter!=='function')fail();
   resource.reader=socket.readable.getReader();resource.writer=socket.writable.getWriter();
   this.#draining=this.#drain(resource,packet.nonce,marker).catch(async()=>{await this.close().catch(()=>{});fail();});
   this.#draining.catch(()=>{});
   const send=async()=>{
    try {
     for(let offset=0;offset<body.length;offset+=4096)
      await this.#bounded(()=>resource.writer.write(body.slice(offset,offset+4096)));
     this.#sent.resolve();
    } catch(error) {this.#sent.reject(error);throw error;}
   };
   await this.#bounded(()=>Promise.all([send(),this.#ready.promise]),Date.now()+30000);
   this.#live();this.#started=true;
   return {kind:'browser_initial_guardian_started_record',start:this.#start,child:this.#child,records_only:true};
  } catch {await this.close().catch(()=>{});fail();}
  finally {this.#busy=false;}
 }
 async finish() {
  if(!this.#started || this.#finished || this.#busy || this.#closed){await this.close().catch(()=>{});fail();}
  this.#finished=true;this.#busy=true;
  try {const value=await this.#bounded(()=>this.#draining);this.#live();return value;}
  catch {await this.close().catch(()=>{});fail();}finally {this.#busy=false;}
 }
 close() {
  if(this.#closing)return this.#closing;
  this.#closed=true;clearTimeout(this.#expiry);this.#ready?.reject({code:'usb_browser_scope_unverified'});this.#sent?.reject({code:'usb_browser_scope_unverified'});
  for(const reject of this.#waiters)reject({code:'usb_browser_scope_unverified'});
  this.#closing=(async()=>{
   let failed=false;
   try {await this.#cleanup(this.#resource);}catch {failed=true;}
   let timer;try {await Promise.race([Promise.resolve().then(()=>this.#backend.closeTransport()),new Promise((_,reject)=>{timer=setTimeout(()=>reject({}),2000);})]);}
   catch {failed=true;}finally {clearTimeout(timer);}
   if(failed)fail();
  })();return this.#closing;
 }
}
