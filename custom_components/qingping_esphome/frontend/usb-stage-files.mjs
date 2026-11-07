/** Fixed disabled-root file transport, not an installation coordinator.
 *
 * This building block is deliberately not exposed by BrowserNativeChannel,
 * the frame peer or the wizard yet. Its future private caller must FIRST
 * consume its owner/plan write intent, recheck the actual selected handle,
 * admit ext4 capacity, and create the exact private root with both opt-outs.
 * A descriptor is byte context, never proof that those steps happened.
 *
 * Accept only the nine original staging roles, one file at a time. Buffer a
 * bounded file and verify its hash before opening old SYNC-v1 once. Do not use
 * AdbSync.write: its Android mkdir workaround can issue an extra shell command.
 * The caller supplies the pinned Tango adbSyncPushV1 and an owned sync socket.
 * A wire OKAY is not a remote SHA/metadata check; that remains independent.
 */
export const STAGE_ROLES=Object.freeze([
  ['bridge-program','program'],['pm_qt_bridge.so','pm_qt_bridge.so'],['launch.sh','launch.sh'],
  ['SnowApp-with-PM','SnowApp-with-PM'],['startup-hook.sh','startup-hook.sh'],
  ['stock-start.sh.original','stock-start.sh.original'],['stock-watchdog.sh.original','stock-watchdog.sh.original'],
  ['start.sh.candidate','start.sh.candidate'],['watchdog.sh.candidate','watchdog.sh.candidate'],
].map(row=>Object.freeze(row)));
const base='/data/.esphome-cgs1/',maximum=16*1024*1024,chunkMaximum=65536;
const hashPattern=/^[a-f0-9]{64}$/;
const fail=()=>{throw {code:'usb_browser_stage_unverified'};};
async function digest(bytes) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
}
async function cleanup(operation) {
  let timer;
  try {return await Promise.race([Promise.resolve().then(operation),new Promise((_,reject)=>{
    timer=setTimeout(()=>reject({code:'usb_close_unverified'}),2000);
  })]);} finally {clearTimeout(timer);}
}

export class BrowserStageFileSink {
  #factory;#pins;#next=0;#file;#sync;#closed=false;#closing;#busy=false;#deadline;#expiry;
  constructor(factory,descriptor) {
    if(!factory || Object.keys(factory).sort().join()!==['openSync','pushV1','closeTransport'].sort().join() ||
       Object.values(factory).some(value=>typeof value!=='function') || !descriptor ||
       Object.keys(descriptor).sort().join()!==['plan_id','plan_sha256','intent_sha256','files'].sort().join() ||
       typeof descriptor.plan_id!=='string' || !/^[a-f0-9]{32}$/.test(descriptor.plan_id) ||
       typeof descriptor.plan_sha256!=='string' || !hashPattern.test(descriptor.plan_sha256) ||
       typeof descriptor.intent_sha256!=='string' || !hashPattern.test(descriptor.intent_sha256) || !descriptor.files ||
       Object.keys(descriptor.files).sort().join()!==STAGE_ROLES.map(([role])=>role).sort().join()) fail();
    const pins={};let total=0;
    for(const [role] of STAGE_ROLES) {
      const pin=descriptor.files[role];
      if(!pin || Object.keys(pin).sort().join()!==['size','sha256'].sort().join() || !Number.isInteger(pin.size) ||
         pin.size<=0 || pin.size>maximum || typeof pin.sha256!=='string' || !hashPattern.test(pin.sha256)) fail();
      total+=pin.size;pins[role]=Object.freeze({...pin});
    }
    if(total>32*1024*1024) fail();
    this.#pins=Object.freeze(pins);this.#factory=Object.freeze({...factory});
    this.#deadline=Date.now()+240000;
    this.#expiry=setTimeout(()=>{void this.close().catch(()=>{});},240000);
  }
  async #refuse() {await this.close().catch(()=>{});fail();}
  #live() {return !this.#closed && Date.now()<this.#deadline;}
  async begin(role) {
    if(!this.#live() || this.#busy || this.#file || this.#next>=STAGE_ROLES.length || role!==STAGE_ROLES[this.#next][0])
      return this.#refuse();
    // Consume this file slot before any network outcome. There is no reset,
    // resume, seek, replacement descriptor or second begin for a partial file.
    this.#file={role,offset:0,bytes:new Uint8Array(this.#pins[role].size)};
    return {role,offset:0};
  }
  async append(role,offset,bytes) {
    const file=this.#file;
    if(!this.#live() || this.#busy || !file || role!==file.role || !Number.isInteger(offset) || offset!==file.offset ||
       !(bytes instanceof Uint8Array) || bytes.length<1 || bytes.length>chunkMaximum || offset+bytes.length>file.bytes.length)
      return this.#refuse();
    file.bytes.set(bytes,offset);file.offset+=bytes.length;
    return {role,offset:file.offset}; // Buffered locally, not a device-write ACK.
  }
  async #bounded(operation) {
    const remaining=this.#deadline-Date.now();
    if(remaining<=0) return this.#refuse();
    let timer;
    try {return await Promise.race([Promise.resolve().then(operation),new Promise((_,reject)=>{
      timer=setTimeout(()=>reject({code:'usb_browser_stage_unverified'}),Math.min(90000,remaining));
    })]);} finally {clearTimeout(timer);}
  }
  async finish(role) {
    const file=this.#file;
    if(!this.#live() || this.#busy || !file || role!==file.role || file.offset!==file.bytes.length) return this.#refuse();
    this.#busy=true;
    try {
      const pin=this.#pins[role];
      if(await digest(file.bytes)!==pin.sha256 || !this.#live()) throw Error();
      await this.#bounded(async()=>{
        const socket=await this.#factory.openSync();
        if(this.#closed) {await cleanup(()=>socket.close());throw Error();}
        this.#sync=socket;
      });
      // Only a pinned plain SYNC-v1 SEND/DATA/DONE sequence, never compression,
      // a path argument, mkdir workaround, chmod, shell, exec or boot change.
      await this.#bounded(()=>this.#factory.pushV1({socket:this.#sync,filename:base+STAGE_ROLES[this.#next][1],
        type:0o10,permission:0o600,mtime:0,packetSize:chunkMaximum,
        file:new ReadableStream({start(controller){controller.enqueue(file.bytes);controller.close();}})}));
      await cleanup(()=>this.#sync.close());this.#sync=undefined;
      if(!this.#live()) throw Error();
      this.#file=undefined;this.#next++;
      return {role,size:pin.size,sha256:pin.sha256,wire_acknowledged:true};
    } catch {return await this.#refuse();}
    finally {this.#busy=false;}
  }
  close() {
    if(this.#closing) return this.#closing;
    this.#closed=true;clearTimeout(this.#expiry);
    const socket=this.#sync;this.#sync=undefined;this.#file=undefined;
    this.#closing=(async()=>{
      let failed=false;
      if(socket) {try {await cleanup(()=>socket.close());}catch {failed=true;}}
      // This handle belongs solely to the constructing private caller. Never
      // signal/adopt another transport or retry a write to make cleanup pass.
      try {await cleanup(()=>this.#factory.closeTransport());}catch {failed=true;}
      if(failed) throw {code:'usb_close_unverified'};
    })();
    return this.#closing;
  }
}
