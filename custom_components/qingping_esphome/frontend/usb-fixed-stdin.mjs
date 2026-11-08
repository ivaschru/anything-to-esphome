/** Shared internal sealed-stdin transport mechanics for finite wrappers.
 *
 * Only the fixed disabled/RAM/bridge-boot wrappers construct this with
 * their module-owned pure assembler. No peer/frame exports this helper or
 * accepts an assembler, shell body, service, path, timeout or retry selector.
 * Original live capability/deadline and independently consumed journal remain
 * the callers' responsibility. A completed stdout marker is not readback.
 */
const fail=()=>{throw {code:'usb_browser_scope_unverified'};};
const service='exec:/bin/sh';
const ready='CGS1_FIXED_STDIN_READY';
const encoder=new TextEncoder();

/** Tiny typed bootstrap: receive all bytes as DATA, verify, then parse once.
 * Streaming executable shell lines directly is unsafe: EOF in the middle of
 * a rename could turn a truncated destination into a different valid path.
 * The full body stays in bounded RAM; no NAND/RAM script file is created.
 */
export function fixedStdinService(frame) {
 if(!frame || Object.keys(frame).sort().join()!==['size','sha256','marker'].sort().join() ||
    !Number.isInteger(frame.size) || frame.size<1 || frame.size>32768 ||
    typeof frame.sha256!=='string' || !/^[a-f0-9]{64}$/.test(frame.sha256) ||
    typeof frame.marker!=='string' || !/^__CGS1_FIXED_OK_[a-f0-9]{32}__$/.test(frame.marker))fail();
 const bootstrap="set -eu\numask 077\n"+
  `CGS1_FIXED_BODY=$(dd bs=1 count=${frame.size} 2>/dev/null)\n`+
  `[ "\${#CGS1_FIXED_BODY}" -eq ${frame.size} ]\n`+
  "CGS1_FIXED_SHA=$(printf '%s' \"$CGS1_FIXED_BODY\" | sha256sum)\n"+
  `[ "\${CGS1_FIXED_SHA%% *}" = '${frame.sha256}' ]\n`+
  '/bin/sh -c "$CGS1_FIXED_BODY"\n'+`printf '\\n${frame.marker}\\n'\n`;
 const quoted="'"+bootstrap.replaceAll("'", "'\\''")+"'";
 return service+' -c '+quoted;
}

export class FixedStdinLifecycle {
 #backend;#active;#closing;#waiters=new Set();#closed=false;#busy=false;#probeUsed=false;#ready=false;#assemble;
 constructor(backend,assemble) {
  if(!backend || Object.keys(backend).sort().join()!==['open','live','closeTransport'].sort().join() ||
     Object.values(backend).some(v=>typeof v!=='function') || typeof assemble!=='function')fail();
  this.#backend=Object.freeze({...backend});this.#assemble=assemble;
 }
 #live() {if(this.#closed || this.#backend.live()!==true)fail();}
 async #bounded(operation,deadline) {
  this.#live();const remaining=deadline-Date.now();if(remaining<=0)fail();
  let timer,retire;
  try {
   const value=await Promise.race([Promise.resolve().then(operation),new Promise((_,reject)=>{
    retire=reject;this.#waiters.add(reject);
    timer=setTimeout(()=>{void this.close().catch(()=>{});reject({code:'usb_browser_scope_unverified'});},remaining);
   })]);
   this.#live();return value;
  } finally {clearTimeout(timer);this.#waiters.delete(retire);}
 }
 async #cleanup(resource) {
  if(!resource)return;
  if(resource.cleanup)return resource.cleanup;
  resource.cleanup=(async()=>{
   let failed=false;
   const bounded=async operation=>{
    let timer;
    try {await Promise.race([Promise.resolve().then(operation),new Promise((_,reject)=>{timer=setTimeout(()=>reject({}),2000);})]);}
    finally {clearTimeout(timer);}
   };
   // A local close is not completion evidence. It only retires this owned
   // socket and pending pure output read; a lost remote ACK remains unknown.
   try {await bounded(()=>resource.socket.close());}catch {failed=true;}
   if(resource.reader) {
    try {await bounded(()=>resource.reader.cancel());resource.reader.releaseLock();}catch {failed=true;}
    resource.reader=undefined;
   }
   if(resource.writer) {try {resource.writer.releaseLock();}catch {failed=true;}resource.writer=undefined;}
   if(failed)fail();
  })();
  return resource.cleanup;
 }
 async #run(body,expected,limit) {
  this.#live();
  if(typeof body!=='string' || !body.length || body.length>32768 || body.endsWith('\n') || /[^\x01-\x7f]/.test(body))fail();
  const deadline=Date.now()+limit;
  const marker='__CGS1_FIXED_OK_'+crypto.randomUUID().replaceAll('-','')+'__';
  const payload=encoder.encode(body);
  let resource;
  try {
   const digest=Array.from(new Uint8Array(await this.#bounded(()=>crypto.subtle.digest('SHA-256',payload),deadline)),v=>v.toString(16).padStart(2,'0')).join('');
   const framing=Object.freeze({size:payload.length,sha256:digest,marker}),expectedService=fixedStdinService(framing);
   const socket=await this.#bounded(async()=>{
    const value=await this.#backend.open(framing); // Fixed typed bootstrap only, never caller shell text.
    try {this.#live();}catch {await this.#cleanup({socket:value}).catch(()=>{});fail();}
    return value;
   },Math.min(deadline,Date.now()+5000));
   resource={socket};this.#active=resource;
   // Tango's old-protocol service may contain its one terminal NUL. Do not
   // fall back to PTY/shell-v2 or reinterpret an unsupported exec service.
   if(!socket || ![expectedService,expectedService+'\0'].includes(socket.service) ||
      typeof socket.closed?.then!=='function' || typeof socket.readable?.getReader!=='function' ||
      typeof socket.writable?.getWriter!=='function')fail();
   resource.reader=socket.readable.getReader();resource.writer=socket.writable.getWriter();
   const reader=resource.reader,writer=resource.writer;
   let bytes=new Uint8Array();
   const drain=async()=>{
    while(true) {
     const {value,done}=await this.#bounded(()=>reader.read(),deadline);
     if(done)break;
     if(!(value instanceof Uint8Array) || bytes.length+value.length>4096 || value.some(v=>v===0 || v>127))fail();
     const next=new Uint8Array(bytes.length+value.length);next.set(bytes);next.set(value,bytes.length);bytes=next;
    }
   };
   const send=async()=>{
    // Keep the OPEN request tiny. Tango additionally fragments each WRTE to
    // its negotiated maxPayloadSize and observes its actual ACK/backpressure.
    // No writable.close/EOF is sent early: it would close the duplex socket.
    for(let offset=0;offset<payload.length;offset+=4096) {
     this.#live();await this.#bounded(()=>writer.write(payload.slice(offset,offset+4096)),deadline);
    }
   };
   // Drain concurrently so diagnostics/remote flow control cannot deadlock
   // stdin. Any failure closes the original transport; no bytes are resent.
   await Promise.all([drain(),send()]);
   await this.#bounded(()=>socket.closed,deadline);
   if(new TextDecoder().decode(bytes)!==expected+'\n'+marker+'\n')fail();
   await this.#cleanup(resource);
   if(this.#active===resource)this.#active=undefined;
   this.#live();
  } catch {
   await this.close().catch(()=>{});fail();
  } finally {
   // Shared cleanup cannot turn a previous failed/lost close into success.
   if(resource)await this.#cleanup(resource).catch(()=>{});
  }
 }
 ready() {this.#live();return this.#ready && !this.#busy;}
 async probe() {
  if(this.#busy || this.#probeUsed || this.#closed) {await this.close().catch(()=>{});fail();}
  this.#probeUsed=true;this.#busy=true;
  try {
   await this.#run("set -eu\numask 077\nprintf '%s\\n' '"+ready+"'",ready+'\n',5000);
   this.#live();this.#ready=true;
   return {kind:'browser_fixed_stdin_probe',service,ready:true,device_files_changed:false,writer_enabled:false};
  } finally {this.#busy=false;}
 }
 async execute(input) {
  if(this.#busy || !this.#ready || this.#closed) {await this.close().catch(()=>{});fail();}
  this.#busy=true;
  try {
   // assemble is a trusted module closure from a finite wrapper,
   // never a function/body/path received from a frame or HTTP request.
   const body=await this.#bounded(()=>this.#assemble(input),Date.now()+5000);
   await this.#run(body,'',30000);
   this.#live();return {completed:true};
  } catch {await this.close().catch(()=>{});fail();}
  finally {this.#busy=false;}
 }

 close() {
  if(this.#closing)return this.#closing;
  this.#closed=true;this.#ready=false;
  for(const reject of this.#waiters)reject({code:'usb_browser_scope_unverified'});
  this.#closing=(async()=>{
   let failed=false;
   try {await this.#cleanup(this.#active);}catch {failed=true;}
   let timer;
   try {await Promise.race([Promise.resolve().then(()=>this.#backend.closeTransport()),new Promise((_,reject)=>{
    timer=setTimeout(()=>reject({}),2000);
   })]);}catch {failed=true;}finally {clearTimeout(timer);}
   if(failed)fail();
  })();
  return this.#closing;
 }
}
