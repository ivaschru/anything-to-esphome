/** One live WebUSB capability for the future server-mediated writer.
 *
 * This is transport plumbing, not an installation button or native ADB
 * get-devpath substitute. The selected USB object, authenticated connection
 * and unpredictable channel nonce must all remain in this instance. JSON
 * reports cannot reopen it. Only fixed original-file reads and the fixed
 * device API socket are available here; shell/push/launch remain unavailable.
 */
const error=code=>{throw {code};};
const serialPattern=/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const uuidPattern=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const macPattern=/^[a-f0-9]{2}(?::[a-f0-9]{2}){5}$/;

export class BrowserNativeChannel {
  #library;#contract;#selected=false;#closed=false;#device;#connection;#client;
  #nonce;#serial;#scope;#deadline;#expiry;#api;#apiUsed=false;#busy=false;
  constructor(library,contract) {this.#library=library;this.#contract=contract;}

  /** Picker must run in the original click, before any network/async work. */
  select() {
    if(this.#selected || this.#closed) error('usb_selection_consumed');
    this.#selected=true;
    if(!this.#library.manager) error('webusb_unavailable');
    let picked;
    try {picked=this.#library.manager.requestDevice();}
    catch {this.#closed=true;error('usb_selection_failed');}
    return this.#open(picked);
  }

  async #bounded(operation,ms=10000) {
    if(this.#closed) error('usb_selection_consumed');
    const remaining=this.#deadline-Date.now();
    if(remaining<=0) {void this.close().catch(()=>{});error('usb_read_timeout');}
    let timer;
    try {
      return await Promise.race([operation(),new Promise((_,reject)=>{
        timer=setTimeout(()=>{void this.close().catch(()=>{});reject({code:'usb_read_timeout'});},Math.min(ms,remaining));
      })]);
    } finally {clearTimeout(timer);}
  }

  async #cleanup(operation) {
    let timer;
    try {await Promise.race([Promise.resolve().then(operation),new Promise((_,reject)=>{
      timer=setTimeout(()=>reject({code:'usb_close_unverified'}),2000);
    })]);} catch {error('usb_close_unverified');} finally {clearTimeout(timer);}
  }

  async #open(picked) {
    try {
      const device=await picked;
      if(this.#closed || !device || !serialPattern.test(device.serial)) error('usb_identity_invalid');
      this.#device=device;this.#serial=device.serial;this.#nonce=crypto.randomUUID();
      // The session's initial read budget is fixed. A future guarded writer
      // needs its own bounded admission; status/polling cannot extend this.
      this.#deadline=Date.now()+240000;
      this.#expiry=setTimeout(()=>{void this.close().catch(()=>{});},240000);
      await this.#bounded(async()=>{
        const value=await device.connect();
        if(this.#closed) {await this.#cleanup(()=>Promise.all([value.readable.cancel(),value.writable.close()]));error('usb_selection_consumed');}
        this.#connection=value;
      },5000);
      const transport=await this.#bounded(async()=>{
        const value=await this.#library.authenticate({serial:this.#serial,connection:this.#connection,
          credentialStore:this.#library.ephemeralCredentials(),initialDelayedAckBytes:0,readTimeLimit:10000});
        if(this.#closed) {await this.#cleanup(()=>value.close());error('usb_selection_consumed');}
        return value;
      },15000);
      this.#client=this.#library.createClient(transport);
      if(this.#closed) {await this.#cleanup(()=>this.#client.close());error('usb_selection_consumed');}
      const identity=await this.#identity();
      this.#scope=Object.freeze({...identity});
      await this.checkInitialScope();
      return this.evidence();
    } catch {
      await this.close();
      error('usb_channel_unverified');
    }
  }

  async #read(command) {
    const marker='__CGS1_CHANNEL_OK_'+crypto.randomUUID().replaceAll('-','')+'__';
    const socket=await this.#bounded(async()=>{
      const value=await this.#client.createSocket('shell:set -e\n'+command+"\nprintf '\\n"+marker+"\\n'\n");
      if(this.#closed) {await this.#cleanup(()=>value.close());error('usb_selection_consumed');}
      return value;
    },5000);
    let reader,bytes=new Uint8Array();
    try {
      reader=socket.readable.getReader();
      while(true) {
        const {value,done}=await this.#bounded(()=>reader.read());if(done) break;
        if(!(value instanceof Uint8Array) || bytes.length+value.length>4096) error('usb_read_invalid');
        const next=new Uint8Array(bytes.length+value.length);next.set(bytes);next.set(value,bytes.length);bytes=next;
      }
    } finally {reader?.releaseLock();await this.#cleanup(()=>socket.close());}
    if(bytes.some(n=>n===0 || n>127)) error('usb_read_invalid');
    const text=new TextDecoder().decode(bytes).replaceAll('\r\n','\n'),suffix='\n'+marker+'\n';
    if(!text.endsWith(suffix)) error('usb_read_incomplete');
    return text.slice(0,-suffix.length).trim();
  }

  async #identity() {
    const value={};
    for(const step of this.#contract.identity) value[step.name]=await this.#read(step.command);
    if(value.uid!=='0' || value.arch!=='armv7l' || value.version!=='CLEARGRASS_VERSION=4.1.8_0287' ||
       !['2','3'].includes(value.co2_type) || !uuidPattern.test(value.boot_id) || !macPattern.test(value.wlan_mac) ||
       value.wlan_mac==='00:00:00:00:00:00' || (parseInt(value.wlan_mac.slice(0,2),16)&1)) error('usb_identity_invalid');
    return value;
  }

  evidence() {
    if(this.#closed || !this.#scope || !this.#client || this.#device.serial!==this.#serial || Date.now()>=this.#deadline) error('usb_channel_unverified');
    return Object.freeze({kind:'browser_webusb',channel:this.#nonce,serial:this.#serial,
      wlan_mac:this.#scope.wlan_mac,boot_id:this.#scope.boot_id,co2_type:Number(this.#scope.co2_type),
      stock_version:'4.1.8_0287',native_get_devpath:false});
  }

  async checkInitialScope() {
    if(this.#busy || this.#api) error('usb_busy');
    this.#busy=true;
    try {
      this.evidence();
      const before=await this.#identity();
      if(JSON.stringify(before)!==JSON.stringify(this.#scope)) error('usb_selection_changed');
      for(const file of this.#contract.files)
        if(await this.#read(file.command)!==file.expected) error('usb_stock_unverified');
      if(await this.#read(this.#contract.absent_install)!=='') error('usb_existing_installation');
      const after=await this.#identity();
      if(JSON.stringify(after)!==JSON.stringify(before)) error('usb_selection_changed');
      return this.evidence();
    } catch {await this.close();error('usb_channel_unverified');}
    finally {this.#busy=false;}
  }

  async openApi() {
    if(this.#busy || this.#apiUsed || this.#closed) error('usb_selection_consumed');
    this.#apiUsed=true; // No second socket after a lost ACK.
    try {
      this.evidence();
      const identity=await this.#identity();
      if(JSON.stringify(identity)!==JSON.stringify(this.#scope)) error('usb_selection_changed');
      const socket=await this.#bounded(async()=>{
        const value=await this.#client.createSocket('tcp:6053');
        if(this.#closed) {await this.#cleanup(()=>value.close());error('usb_selection_consumed');}
        return value;
      },5000);
      this.#api=socket;
      // No host, port or Noise key enters this interface. A future private
      // Core relay owns encrypted API bytes and must provide stream bounds;
      // handing out this socket is not native identity or writer authority.
      return socket;
    } catch {await this.close();error('usb_channel_unverified');}
  }

  async close() {
    if(this.#closed && !this.#client && !this.#connection && !this.#api) return;
    this.#closed=true;clearTimeout(this.#expiry);this.#expiry=undefined;
    const client=this.#client,connection=this.#connection,api=this.#api;
    this.#client=this.#connection=this.#api=undefined;
    let failed=false;
    if(api) {try {await this.#cleanup(()=>api.close());}catch {failed=true;}}
    if(client) {try {await this.#cleanup(()=>client.close());}catch {failed=true;}}
    else if(connection) {try {await this.#cleanup(async()=>{
      const results=await Promise.allSettled([connection.readable.cancel(),connection.writable.close()]);
      if(results.some(r=>r.status==='rejected')) error('usb_close_unverified');
    });}catch {failed=true;}}
    if(failed) error('usb_close_unverified');
  }
}
