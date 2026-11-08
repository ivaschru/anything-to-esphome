import {InitialRamCommandStream,initialRamStreamService} from './usb-initial-ram-stream.mjs';
import {BrowserInitialRamSession} from './usb-initial-ram-session.mjs';
import {InitialGuardianStream,initialGuardianStreamService} from './usb-initial-guardian-stream.mjs';
import {initialGuardianProcessReads,initialGuardianProcessObservation} from './usb-initial-process-observation.mjs';
import {collectInitialGuardianScope} from './usb-initial-scope-observation.mjs';
import {collectDisabledScope} from "./usb-disabled-scope.mjs";
import {collectInitialTrialPreparation} from "./usb-initial-trial-scope.mjs";
import {DisabledCommandStream,disabledStreamService} from "./usb-disabled-stream.mjs";
import {BrowserDisabledCommitSession} from "./usb-disabled-session.mjs";
import {BrowserStageSession} from "./usb-stage-session.mjs";
import {sourceFileObservationMatches} from "./usb-file-observation.mjs";
/** One live WebUSB capability for the future server-mediated writer.
 *
 * This is transport plumbing, not an installation button or native ADB
 * get-devpath substitute. The selected USB object, authenticated connection
 * and unpredictable channel nonce must all remain in this instance. JSON
 * reports cannot reopen it. Fixed reads/API and a private finite disabled-root
 * stage and first-trial RAM transfer are available; no caller-selected
 * shell/path/launch is admitted. Private writers still need a consumed Core
 * intent and are not a public installer.
 */
const error=code=>{throw {code};};
const serialPattern=/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const uuidPattern=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const macPattern=/^[a-f0-9]{2}(?::[a-f0-9]{2}){5}$/;

export class BrowserNativeChannel {
  #library;#contract;#selected=false;#closed=false;#device;#connection;#client;
  #closing;#nonce;#serial;#scope;#deadline;#expiry;#api;#apiUsed=false;#apiCount=0;#busy=false;#stage;#stageUsed=false;#reviewSelection=false;#commitProbeUsed=false;#commitUsed=false;#commitStream;#commit;#ramProbeUsed=false;#ramUsed=false;#ramStream;#ram;
  #ramPacket;#ramProof;#guardian;#guardianUsed=false;#guardianReady=false;#guardianFinished=false;
  #guardianStarted;#guardianObservations=0;
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
    if(this.#ramProbeUsed || this.#commitProbeUsed) error('usb_busy');
    if(this.#ramProbeUsed || this.#busy || this.#api || this.#apiUsed || this.#stageUsed || this.#commitUsed) error('usb_busy');
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
    if(this.#ramProbeUsed || this.#busy || this.#api || this.#apiUsed || this.#stageUsed || this.#commitUsed) error('usb_busy');
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
    if(this.#ramProbeUsed || this.#busy || this.#api || this.#apiUsed || this.#stageUsed || this.#commitUsed) error('usb_busy');
    this.#busy=true;
    try {return await this.#disabledScope(meta);}
    catch {await this.close().catch(()=>{});error('usb_browser_scope_unverified');}
    finally {this.#busy=false;}
  }

  async #disabledScope(meta) {
      const evidence=this.evidence(),target={kind:'browser_webusb',usb_serial:evidence.serial,
        wlan_mac:evidence.wlan_mac,boot_id:evidence.boot_id,co2_type:evidence.co2_type,stock_version:evidence.stock_version};
      if(!meta?.target || Object.keys(meta.target).sort().join()!==Object.keys(target).sort().join() ||
         Object.keys(target).some(key=>meta.target[key]!==target[key])) error('usb_channel_unverified');
      return await collectDisabledScope({read:command=>this.#read(command),identity:async()=>{
        this.evidence();return JSON.stringify(await this.#identity())===JSON.stringify(this.#scope);
      }},meta);
  }

  /** Preparation-only read through this original selected handle. No RAM job
   * or device image FD exists yet; a later consumed trial must own those.
   */
  async checkInitialTrialPreparation(meta) {
    if(this.#closed || this.#busy || this.#api || this.#apiUsed || this.#stageUsed || this.#commitProbeUsed || this.#ramUsed) error('usb_busy');
    this.#busy=true;
    try {return await this.#initialPreparation(meta);}
    catch {await this.close().catch(()=>{});error('usb_browser_scope_unverified');}
    finally {this.#busy=false;}
  }
  async #initialPreparation(meta) {
    return await collectInitialTrialPreparation({read:command=>this.#read(command),
      scope:input=>this.#disabledScope(input),identity:async()=>{
        this.evidence();return JSON.stringify(await this.#identity())===JSON.stringify(this.#scope);
      }},meta);
  }

  /** Read-only raw-stdin capability probe before any commit intent. No PTY,
   * alternate service or automatic fallback is attempted on old adbd failure.
   */
  async probeCommitStream() {
    if(this.#ramProbeUsed || this.#closed || this.#busy || this.#api || this.#apiUsed || this.#stageUsed || this.#commitProbeUsed) error('usb_selection_consumed');
    this.#commitProbeUsed=true;this.#busy=true;
    try {
      this.evidence();
      if(JSON.stringify(await this.#identity())!==JSON.stringify(this.#scope)) error('usb_selection_changed');
      this.#commitStream=new DisabledCommandStream({
        live:()=>{this.evidence();return true;},
        open:framing=>{this.evidence();return this.#client.createSocket(disabledStreamService(framing));},
        closeTransport:()=>this.close(),
      });
      const result=await this.#commitStream.probe();
      if(JSON.stringify(await this.#identity())!==JSON.stringify(this.#scope)) error('usb_selection_changed');
      this.evidence();return result;
    } catch {await this.close().catch(()=>{});error('usb_browser_scope_unverified');}
    finally {this.#busy=false;}
  }

  async beginCommit(packet) {
    if(this.#ramProbeUsed || this.#closed || this.#busy || this.#api || this.#apiUsed || this.#stageUsed || this.#commitUsed || !this.#commitProbeUsed || !this.#commitStream) error('usb_selection_consumed');
    this.#commitUsed=true;this.#busy=true; // Before a lost prepare/first scope.
    try {
      const evidence=this.evidence(),target={kind:'browser_webusb',usb_serial:evidence.serial,
        wlan_mac:evidence.wlan_mac,boot_id:evidence.boot_id,co2_type:evidence.co2_type,stock_version:evidence.stock_version};
      if(packet?.channel_nonce!==this.#nonce || !packet.meta?.target ||
         Object.keys(packet.meta.target).sort().join()!==Object.keys(target).sort().join() ||
         Object.keys(target).some(key=>packet.meta.target[key]!==target[key])) error('usb_selection_changed');
      this.#commit=new BrowserDisabledCommitSession({scope:meta=>this.#disabledScope(meta),closeTransport:()=>this.close()},this.#commitStream,packet);
      return await this.#commit.prepare();
    } catch {await this.close().catch(()=>{});error('usb_browser_scope_unverified');}
    finally {this.#busy=false;}
  }
  async #commitCall(method,...args) {
    if(this.#closed || this.#busy || !this.#commit) error('usb_browser_scope_unverified');
    this.#busy=true;
    try {this.evidence();return await this.#commit[method](...args);}
    catch {await this.close().catch(()=>{});error('usb_browser_scope_unverified');}
    finally {this.#busy=false;}
  }
  commitStep(phase) {return this.#commitCall('step',phase);}
  finishCommit() {return this.#commitCall('finish');}

  /** Fixed harmless probe before a private Core caller consumes trial intent.
   * This is distinct from the disabled-commit probe and never renews the
   * original selected handle, falls back to PTY or grants a RAM write.
   */
  async probeInitialRamStream() {
    if(this.#closed || this.#busy || this.#api || this.#apiUsed || this.#stageUsed || this.#commitProbeUsed || this.#ramProbeUsed) error('usb_selection_consumed');
    this.#ramProbeUsed=true;this.#busy=true;
    try {
      this.evidence();
      if(JSON.stringify(await this.#identity())!==JSON.stringify(this.#scope)) error('usb_selection_changed');
      this.#ramStream=new InitialRamCommandStream({live:()=>{this.evidence();return true;},
        open:framing=>{this.evidence();return this.#client.createSocket(initialRamStreamService(framing));},
        closeTransport:()=>this.close()});
      const result=await this.#ramStream.probe();
      if(JSON.stringify(await this.#identity())!==JSON.stringify(this.#scope)) error('usb_selection_changed');
      this.evidence();return result;
    } catch {await this.close().catch(()=>{});error('usb_browser_scope_unverified');}
    finally {this.#busy=false;}
  }
  async beginInitialRam(packet) {
    if(this.#closed || this.#busy || this.#api || this.#apiUsed || this.#stageUsed || this.#commitUsed || this.#commitProbeUsed || this.#ramUsed || !this.#ramProbeUsed || !this.#ramStream) error('usb_selection_consumed');
    this.#ramUsed=true;this.#busy=true; // Before the first possible RAM creation ACK.
    try {
      // Preserve only the metadata delivered under the original consumed Core
      // intent. A caller's later mutation cannot replace the eventual launch
      // binding; no guardian body or key belongs in this retained handoff.
      packet=JSON.parse(JSON.stringify(packet));
      const evidence=this.evidence(),target={kind:'browser_webusb',usb_serial:evidence.serial,
        wlan_mac:evidence.wlan_mac,boot_id:evidence.boot_id,co2_type:evidence.co2_type,stock_version:evidence.stock_version};
      const bound=packet?.context?.meta?.target;
      if(packet?.channel_nonce!==this.#nonce || !bound || Object.keys(bound).sort().join()!==Object.keys(target).sort().join() ||
         Object.keys(target).some(k=>bound[k]!==target[k]) || typeof this.#library.createSyncSocket!=='function' || typeof this.#library.pushV1!=='function') error('usb_selection_changed');
      this.#ram=new BrowserInitialRamSession({read:command=>this.#read(command),preparation:meta=>this.#initialPreparation(meta),
        openSync:()=>this.#bounded(async()=>{
          const socket=await this.#client.createSocket('sync:');
          if(this.#closed) {await this.#cleanup(()=>socket.close());error('usb_selection_consumed');}
          try {return this.#library.createSyncSocket(socket);}catch {await this.#cleanup(()=>socket.close());throw Error();}
        },5000),pushV1:options=>this.#library.pushV1(options)},this.#ramStream,packet);
      const prepared=await this.#ram.prepare();this.#ramPacket=packet;return prepared;
    } catch {await this.close().catch(()=>{});error('usb_browser_scope_unverified');}
    finally {this.#busy=false;}
  }
  async #ramCall(method,...args) {
    if(this.#closed || this.#busy || !this.#ram) error('usb_browser_scope_unverified');
    this.#busy=true;
    try {this.evidence();return await this.#ram[method](...args);}
    catch {await this.close().catch(()=>{});error('usb_browser_scope_unverified');}
    finally {this.#busy=false;}
  }
  initialRamAppend(offset,bytes) {return this.#ramCall('append',offset,bytes);}
  async finishInitialRam() {
    const value=await this.#ramCall('finish');
    // Keep a detached private result of this actual session. A later frame
    // takes no packet/proof argument and cannot substitute a JSON handoff.
    this.#ramProof=JSON.parse(JSON.stringify(value));return value;
  }

  /** Private one-shot continuation of THIS completed RAM session only.
   * The Core caller still needs the original live task/actor/lease. These
   * finite transport methods supply no public initiator, observer or terminal
   * journal result. The device guardian alone owns its child and stop timer.
   */
  async startInitialGuardian() {
    if(this.#closed || this.#busy || !this.#ramProof || !this.#ramPacket || this.#guardianUsed) {
      await this.close().catch(()=>{});error('usb_browser_scope_unverified');
    }
    this.#guardianUsed=true;this.#busy=true; // Before fresh reads or possible launch delivery.
    try {
      this.evidence();
      const fresh=await this.#initialPreparation(this.#ramPacket.context.meta);
      this.#guardian=new InitialGuardianStream({live:()=>{this.evidence();return true;},
        open:frame=>{this.evidence();return this.#client.createSocket(initialGuardianStreamService(frame));},
        closeTransport:()=>this.close()});
      const value=await this.#guardian.start(this.#ramPacket,fresh,this.#ramProof);
      this.evidence();this.#guardianStarted=JSON.parse(JSON.stringify(value));this.#guardianReady=true;return value;
    } catch {await this.close().catch(()=>{});error('usb_browser_scope_unverified');}
    finally {this.#busy=false;}
  }
  async finishInitialGuardian() {
    if(this.#closed || this.#busy || this.#api || this.#apiUsed || !this.#guardianReady || this.#guardianFinished) {
      await this.close().catch(()=>{});error('usb_browser_scope_unverified');
    }
    this.#guardianFinished=true;this.#busy=true; // A lost terminal record never permits another read/launch attempt.
    try {this.evidence();const value=await this.#guardian.finish();this.evidence();return value;}
    catch {await this.close().catch(()=>{});error('usb_browser_scope_unverified');}
    finally {this.#busy=false;}
  }

  /** Fixed read-only subset on this original consumed guardian connection.
   * No caller stamp/path/command or cached JSON can select the reads. The
   * budget exceeds the canonical 50s/2s observation cadence, but neither it
   * nor a successful subset extends the original deadline or proves the full
   * stock/vendor/intent/RAM/Noise/terminal conditions.
   */
  async observeInitialGuardianProcesses() {
    if(this.#closed || this.#busy || !this.#guardianReady || this.#guardianFinished || this.#guardianObservations>=32) {
      await this.close().catch(()=>{});error('usb_browser_scope_unverified');
    }
    this.#guardianObservations++;this.#busy=true;
    try {
      this.evidence();
      const commands=initialGuardianProcessReads(this.#ramPacket,this.#ramProof,this.#guardianStarted),reads={};
      for(const [key,command] of Object.entries(commands)) {this.evidence();reads[key]=await this.#read(command);}
      this.evidence();
      return initialGuardianProcessObservation(this.#ramPacket,this.#ramProof,this.#guardianStarted,reads);
    } catch {await this.close().catch(()=>{});error('usb_browser_scope_unverified');}
    finally {this.#busy=false;}
  }

  /** Whole fixed kernel/stock/vendor/intent/RAM read on the same handle.
   * This shares the subset's budget, never opens API or grants terminal proof.
   * The five-second bound is checked after IO, independently in Core as well;
   * it is not a device timer or a promise that a syscall can be interrupted.
   */
  async observeInitialGuardianScope() {
    if(this.#closed || this.#busy || !this.#guardianReady || this.#guardianFinished || this.#guardianObservations>=32) {
      await this.close().catch(()=>{});error('usb_browser_scope_unverified');
    }
    this.#guardianObservations++;this.#busy=true;
    const began=performance.now();
    try {
      this.evidence();
      const value=await collectInitialGuardianScope({read:async command=>{
        this.evidence();if(performance.now()-began>5000)error('usb_browser_scope_unverified');
        const text=await this.#read(command);this.evidence();return text;
      }},this.#ramPacket,this.#ramProof,this.#guardianStarted);
      this.evidence();if(performance.now()-began>5000)error('usb_browser_scope_unverified');
      return value;
    } catch {await this.close().catch(()=>{});error('usb_browser_scope_unverified');}
    finally {this.#busy=false;}
  }

  /** Private finite stage entry, never a shell/filename callback from a frame.
   * The Core coordinator must consume its owner/plan/channel intent FIRST.
   * This browser repeats physical source/identity/space reads immediately
   * before creating a new disabled root; stale JSON cannot skip those reads.
   */
  async beginStage(packet,stockFiles) {
    if(this.#ramProbeUsed || this.#closed || this.#busy || this.#api || this.#apiUsed || this.#stageUsed || this.#commitUsed || this.#commitProbeUsed) error('usb_selection_consumed');
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
    if(this.#ramProbeUsed || this.#busy || this.#stageUsed || this.#commitProbeUsed || this.#apiUsed || this.#closed || this.#apiCount>=16) error('usb_selection_consumed');
    return this.#openApiSocket();
  }

  /** Private guardian phase only. A fresh complete fixed read precedes this
   * original handle's sole tcp:6053 open. No cached DTO, host, port or key can
   * choose a socket; normal close must be acknowledged before another read
   * connection or terminal guardian record. No device writer is replayed.
   */
  async openInitialGuardianApi() {
    if(this.#closed || this.#busy || this.#api || this.#apiUsed || !this.#guardianReady || this.#guardianFinished || this.#apiCount>=16) error('usb_selection_consumed');
    await this.observeInitialGuardianScope();
    if(this.#closed || this.#busy || this.#api || this.#apiUsed || this.#guardianFinished) error('usb_selection_consumed');
    return this.#openApiSocket();
  }

  async #openApiSocket() {
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
    const commit=this.#commit,stream=this.#commitStream;
    if(commit || stream)void this.#closing.finally(()=>Promise.all([commit?.close(),stream?.close()])).catch(()=>{});
    const ram=this.#ram,ramStream=this.#ramStream;
    if(ram || ramStream)void this.#closing.finally(()=>Promise.all([ram?.close(),ramStream?.close()])).catch(()=>{});
    const guardian=this.#guardian;
    this.#ramPacket=this.#ramProof=this.#guardianStarted=undefined;
    if(guardian)void this.#closing.finally(()=>guardian.close()).catch(()=>{});
    return this.#closing;
  }
}
