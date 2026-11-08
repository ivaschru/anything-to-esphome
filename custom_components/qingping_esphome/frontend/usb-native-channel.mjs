import {collectDisabledScope} from "./usb-disabled-scope.mjs";
import {BrowserStageSession} from "./usb-stage-session.mjs";
import {sourceFileObservationMatches} from "./usb-file-observation.mjs";
/** One live WebUSB capability for the future server-mediated writer.
 *
 * This is transport plumbing, not an installation button or native ADB
 * get-devpath substitute. The selected USB object, authenticated connection
 * and unpredictable channel nonce must all remain in this instance. JSON
 * reports cannot reopen it. Fixed reads/API and a private finite disabled-root
 * stage are available; no caller-selected shell/path/launch is admitted. The
 * stage still needs a consumed Core intent and is not a public installer.
 */
const error=code=>{throw {code};};
const serialPattern=/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const uuidPattern=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const macPattern=/^[a-f0-9]{2}(?::[a-f0-9]{2}){5}$/;

export class BrowserNativeChannel {
  #library;#contract;#selected=false;#closed=false;#device;#connection;#client;
  #closing;#nonce;#serial;#scope;#deadline;#expiry;#api;#apiUsed=false;#apiCount=0;#busy=false;#stage;#stageUsed=false;#reviewSelection=false;
  constructor(library,contract) {this.#library=library;this.#contract=contract;}

  /** Picker must run in the original click, before any network/async work. */
  select() {return this.#select(false);}

  /** Reconnect only for a later private staged-scope review.
   * This reads fixed root/model/WLAN/boot identity, without claiming factory
   * files or absent installation. A later phase MUST perform its own complete
   * fresh collector before any consumed writer. Initial staging still always
   * repeats its factory/absence/space guard and cannot use this as a bypass.
   */
  selectForReview() {return this.#select(true);}

  #select(review) {
    if(this.#selected || this.#closed) error('usb_selection_consumed');
    this.#selected=true;this.#reviewSelection=review;
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
      if(this.#reviewSelection) {
        // Opening identity is only ephemeral context. Repeat it after the
        // initial exchange; no cached file/root or writer approval follows.
        if(JSON.stringify(await this.#identity())!==JSON.stringify(this.#scope)) error('usb_selection_changed');
      } else await this.checkInitialScope();
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
    if(this.#busy || this.#api || this.#apiUsed || this.#stageUsed) error('usb_busy');
    this.#busy=true;
    try {
      this.evidence();
      const before=await this.#identity();
      if(JSON.stringify(before)!==JSON.stringify(this.#scope)) error('usb_selection_changed');
      for(const file of this.#contract.files)
        if(!sourceFileObservationMatches(await this.#read(file.command),file)) error('usb_stock_unverified');
      if(await this.#read(this.#contract.absent_install)!=='') error('usb_existing_installation');
      const after=await this.#identity();
      if(JSON.stringify(after)!==JSON.stringify(before)) error('usb_selection_changed');
      return this.evidence();
    } catch {await this.close();error('usb_channel_unverified');}
    finally {this.#busy=false;}
  }

  /** Fixed measured ext4 admission for the future initial-stage coordinator.
   * No allocation probe or caller path/command. Free blocks are a current
   * observation, not a reservation or permission to create the private root.
   */
  async checkStageScope() {
    const evidence=await this.checkInitialScope();
    if(this.#busy || this.#api || this.#apiUsed || this.#stageUsed) error('usb_busy');
    this.#busy=true;
    try {
      const fields=(await this.#read("stat -f -c '%t %a %S' /data")).split(/\s+/);
      if(fields.length!==3 || fields[0]!=='ef53' || !/^[0-9]+$/.test(fields[1]) || !/^[0-9]+$/.test(fields[2])) error('usb_channel_unverified');
      const blocks=Number(fields[1]),size=Number(fields[2]);
      if(!Number.isSafeInteger(blocks) || blocks<0 || !Number.isSafeInteger(size) || size<512 || size>65536 ||
         !Number.isSafeInteger(blocks*size)) error('usb_channel_unverified');
      if(JSON.stringify(await this.#identity())!==JSON.stringify(this.#scope)) error('usb_selection_changed');
      this.evidence();
      return {evidence,filesystem:{magic:'ef53',available_blocks:blocks,block_bytes:size}};
    } catch {await this.close();error('usb_channel_unverified');}
    finally {this.#busy=false;}
  }

  /** Fixed read-only staged collector for a later private transaction.
   * The opening selectForReview identity is not file or writer authority.
   * Both target joins and every source/root/session read are repeated here.
   */
  async checkDisabledScope(meta) {
    if(this.#busy || this.#api || this.#apiUsed || this.#stageUsed) error('usb_busy');
    this.#busy=true;
    try {
      const evidence=this.evidence(),target={kind:'browser_webusb',usb_serial:evidence.serial,
        wlan_mac:evidence.wlan_mac,boot_id:evidence.boot_id,co2_type:evidence.co2_type,stock_version:evidence.stock_version};
      if(!meta?.target || Object.keys(meta.target).sort().join()!==Object.keys(target).sort().join() ||
         Object.keys(target).some(key=>meta.target[key]!==target[key])) error('usb_channel_unverified');
      return await collectDisabledScope({read:command=>this.#read(command),identity:async()=>{
        this.evidence();return JSON.stringify(await this.#identity())===JSON.stringify(this.#scope);
      }},meta);
    } catch {await this.close().catch(()=>{});error('usb_browser_scope_unverified');}
    finally {this.#busy=false;}
  }

  /** Private finite stage entry, never a shell/filename callback from a frame.
   * The Core coordinator must consume its owner/plan/channel intent FIRST.
   * This browser repeats physical source/identity/space reads immediately
   * before creating a new disabled root; stale JSON cannot skip those reads.
   */
  async beginStage(packet,stockFiles) {
    if(this.#closed || this.#busy || this.#api || this.#apiUsed || this.#stageUsed) error('usb_selection_consumed');
    this.#stageUsed=true; // A lost prepare/root ACK can never create another session.
    try {
      const evidence=this.evidence(),target={kind:'browser_webusb',usb_serial:evidence.serial,
        wlan_mac:evidence.wlan_mac,boot_id:evidence.boot_id,co2_type:evidence.co2_type,stock_version:evidence.stock_version};
      if(!packet?.target || Object.keys(packet.target).sort().join()!==Object.keys(target).sort().join() ||
        Object.keys(target).some(key=>packet.target[key]!==target[key]) ||
        !stockFiles || Object.keys(stockFiles).sort().join()!==this.#contract.files.map(file=>file.path).sort().join() ||
        this.#contract.files.some(file=>stockFiles[file.path]?.size!==file.size || stockFiles[file.path]?.sha256!==file.sha256) ||
        typeof this.#library.createSyncSocket!=='function' || typeof this.#library.pushV1!=='function') error('usb_channel_unverified');
      const identity=async()=>{
        this.evidence();
        return JSON.stringify(await this.#identity())===JSON.stringify(this.#scope);
      };
      const inventory=async()=>{
        for(const file of this.#contract.files)
          if(!sourceFileObservationMatches(await this.#read(file.command),file)) return false;
        return true;
      };
      this.#stage=new BrowserStageSession({
        read:command=>this.#read(command),identity,inventory,
        initial:async(_,minimum)=>{
          if(!await identity() || !await inventory() || await this.#read(this.#contract.absent_install)!=='') return false;
          const parts=(await this.#read("stat -f -c '%t %a %S' /data")).split(/\s+/);
          if(parts.length!==3 || parts[0]!=='ef53' || !/^[0-9]+$/.test(parts[1]) || !/^[0-9]+$/.test(parts[2])) return false;
          const blocks=Number(parts[1]),size=Number(parts[2]);
          return Number.isSafeInteger(blocks) && blocks>=0 && Number.isSafeInteger(size) && size>=512 && size<=65536 &&
            Number.isSafeInteger(blocks*size) && blocks*size>=minimum && await identity();
        },
        openSync:()=>this.#bounded(async()=>{
          const socket=await this.#client.createSocket('sync:');
          if(this.#closed) {await this.#cleanup(()=>socket.close());error('usb_selection_consumed');}
          try {return this.#library.createSyncSocket(socket);}catch {await this.#cleanup(()=>socket.close());throw Error();}
        },5000),
        pushV1:options=>this.#library.pushV1(options),closeTransport:()=>this.close(),
      },packet,stockFiles);
      return await this.#stage.prepare();
    } catch {await this.close().catch(()=>{});error('usb_browser_stage_unverified');}
  }

  // These methods retain the actual selected transport and the original stage.
  // The session owns finite role/order/offset/hash checks; none accepts a path,
  // shell string, retry, process identifier or another transport descriptor.
  async #stageCall(method,...args) {
    if(this.#closed || !this.#stage) error('usb_browser_stage_unverified');
    try {this.evidence();return await this.#stage[method](...args);}
    catch {await this.close().catch(()=>{});error('usb_browser_stage_unverified');}
  }
  stageBeginFile(role) {return this.#stageCall('begin',role);}
  stageAppend(role,offset,bytes) {return this.#stageCall('append',role,offset,bytes);}
  stageFinishFile(role) {return this.#stageCall('finishFile',role);}
  finishStage() {return this.#stageCall('finish');}

  async openApi() {
    if(this.#busy || this.#stageUsed || this.#apiUsed || this.#closed || this.#apiCount>=16) error('usb_selection_consumed');
    this.#apiUsed=true;this.#apiCount++; // Consume before a possibly lost ACK.
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

  async closeApi() {
    if(!this.#api || this.#closed || this.#busy) error('usb_channel_unverified');
    const socket=this.#api;this.#api=undefined;
    try {
      await this.#cleanup(()=>socket.close());
      if(this.#closed) error('usb_selection_consumed');
      // An acknowledged teardown permits a new read connection, not another
      // install/launch request. Reusing the selected USB handle across normal
      // ESPHome disconnects must never require replaying a consumed writer.
      this.#apiUsed=false;
    } catch {await this.close();error('usb_close_unverified');}
  }

  close() {
    if(this.#closing) return this.#closing;
    this.#closed=true;clearTimeout(this.#expiry);this.#expiry=undefined;
    const client=this.#client,connection=this.#connection,api=this.#api;
    this.#client=this.#connection=this.#api=undefined;
    // Concurrent page/session retirement must await this same real close ACK,
    // rather than seeing cleared fields and declaring an in-flight close done.
    this.#closing=(async()=>{
      let failed=false;
      if(api) {try {await this.#cleanup(()=>api.close());}catch {failed=true;}}
      if(client) {try {await this.#cleanup(()=>client.close());}catch {failed=true;}}
      else if(connection) {try {await this.#cleanup(async()=>{
        const results=await Promise.allSettled([connection.readable.cancel(),connection.writable.close()]);
        if(results.some(r=>r.status==='rejected')) error('usb_close_unverified');
      });}catch {failed=true;}}
      if(failed) error('usb_close_unverified');
    })();
    // Retire buffered stage bytes/timers after this independent transport
    // close settles. Do not await stage.close inside #closing: the sink's
    // closeTransport callback awaits this same ACK and would form a cycle.
    // Its repeat close observes the original success/failure, never a retry.
    const stage=this.#stage;
    if(stage)void this.#closing.finally(()=>stage.close()).catch(()=>{});
    return this.#closing;
  }
}
