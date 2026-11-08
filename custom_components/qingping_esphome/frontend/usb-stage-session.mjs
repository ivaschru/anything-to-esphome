/** Fixed initial disabled-root staging; not yet exposed by a channel or HTTP.
 *
 * The constructing private coordinator must already own the consumed intent
 * and shared writer lease. Backend functions are closures over that actual
 * selected handle, never callbacks/commands supplied by a browser request.
 * No vendor replacement, execution, process signal or boot operation exists.
 */
import {BrowserStageFileSink,STAGE_ROLES} from './usb-stage-files.mjs';
import {contract} from './usb-probe-contract.mjs';
import {digestLineMatches} from './usb-file-observation.mjs';
const base='/data/.esphome-cgs1',sidecar='/data/.esphome-cgs1-stage',hash=/^[a-f0-9]{64}$/,uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const fail=()=>{throw {code:'usb_browser_stage_unverified'};};
const executable=new Set(['bridge-program','launch.sh','SnowApp-with-PM']);
const sourcePaths=contract.files.map(file=>file.path);

/** Pure fixed command generator; exported for rewritten Linux/root fixtures.
 * It never executes a command and accepts no remote path or arbitrary text.
 */
export function stageCommands(descriptor,boot) {
  if(!descriptor || typeof descriptor.plan_id!=='string' || !/^[a-f0-9]{32}$/.test(descriptor.plan_id) ||
     typeof descriptor.plan_sha256!=='string' || !hash.test(descriptor.plan_sha256) ||
     typeof descriptor.intent_sha256!=='string' || !hash.test(descriptor.intent_sha256) || typeof boot!=='string' || !uuid.test(boot)) fail();
  const marker=descriptor.plan_id+' '+descriptor.plan_sha256,after=marker+' '+descriptor.intent_sha256;
  const scope=after+' '+boot;
  const bootGuard=`CGS1_STAGE_BOOT=$(cat /proc/sys/kernel/random/boot_id)\ntest "$CGS1_STAGE_BOOT" = '${boot}'`;
  const regular=(leaf,size)=>`test ! -L ${base}/${leaf}\ntest -f ${base}/${leaf}\nCGS1_STAGE_META=$(stat -c '%a %u %h %s' ${base}/${leaf})\ntest "$CGS1_STAGE_META" = '600 0 1 ${size}'`;
  const sideRegular=(leaf,size)=>`test ! -L ${sidecar}/${leaf}\ntest -f ${sidecar}/${leaf}\nCGS1_STAGE_META=$(stat -c '%a %u %h %s' ${sidecar}/${leaf})\ntest "$CGS1_STAGE_META" = '600 0 1 ${size}'`;
  // Hash complete marker bytes, including their final newline. Shell command
  // substitution alone would strip newlines/NUL and weaken an exact marker.
  const exact=(path,value)=>"CGS1_STAGE_EXPECTED=$(printf '%s\\n' '"+value+"' | sha256sum)\n"+
    "CGS1_STAGE_ACTUAL=$(sha256sum "+path+")\n"+
    'test "${CGS1_STAGE_ACTUAL%% *}" = "${CGS1_STAGE_EXPECTED%% *}"';
  // The frozen initial guardian strictly lists its own root. Keep browser
  // journal/AFTER-effects outside that root rather than weakening its gate.
  const sideGuard=`test ! -L ${sidecar}\ntest -d ${sidecar}\nCGS1_STAGE_ROOT=$(stat -c '%a %u' ${sidecar})\ntest "$CGS1_STAGE_ROOT" = '700 0'\n`+
    sideRegular('intent',scope.length+1)+'\n'+exact(sidecar+'/intent',scope);
  const guard=bootGuard+'\n'+sideGuard+`\ntest ! -L ${base}\ntest -d ${base}\nCGS1_STAGE_ROOT=$(stat -c '%a %u' ${base})\ntest "$CGS1_STAGE_ROOT" = '700 0'\n`+
    regular('install.intent',marker.length+1)+'\n'+exact(base+'/install.intent',marker)+'\n'+
    regular('disabled',0)+'\n'+regular('pm-helper.disabled',0);
  const leafFor=role=>{const row=STAGE_ROLES.find(([name])=>name===role);if(!row)fail();return row[1];};
  return Object.freeze({
    guard,
    create:bootGuard+`\ntest ! -L /data\ntest ! -e ${base}\ntest ! -L ${base}\ntest ! -e ${sidecar}\ntest ! -L ${sidecar}\n`+
      `mkdir ${sidecar}\nchmod 700 ${sidecar}\nprintf '%s\\n' '${scope}' > ${sidecar}/intent\nsync\n`+
      `mkdir ${base}\nchmod 700 ${base}\n: > ${base}/disabled\n: > ${base}/pm-helper.disabled\n`+
      `printf '%s\\n' '${marker}' > ${base}/install.intent\nsync`,
    precreate:role=>{const path=base+'/'+leafFor(role);return guard+`\ntest ! -e ${path}\ntest ! -L ${path}\nset -C\n: > ${path}`;},
    setMode:role=>guard+`\nchmod ${executable.has(role)?'700':'600'} ${base}/${leafFor(role)}`,
    inspect:role=>guard+`\ntest ! -L ${base}/${leafFor(role)}\ntest -f ${base}/${leafFor(role)}\n`+
      `stat -c '%s %h %u %a' ${base}/${leafFor(role)}\nsha256sum ${base}/${leafFor(role)}`,
    complete:guard+`\ntest ! -e ${sidecar}/complete\ntest ! -L ${sidecar}/complete\nset -C\n`+
      `printf '%s\\n' '${after}' > ${sidecar}/complete\nsync`,
    inspectComplete:guard+'\n'+sideRegular('complete',after.length+1)+`\nsha256sum ${sidecar}/complete`,
    afterBytes:new TextEncoder().encode(after+'\n'),
  });
}

async function digest(bytes) {return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');}
export class BrowserStageSession {
  #backend;#packet;#commands;#stock;#sink;#started=false;#ready=false;#closed=false;#busy=false;#next=0;#role;#closing;
  constructor(backend,packet,stockFiles) {
    const functions=['read','initial','inventory','identity','openSync','pushV1','closeTransport'];
    if(!backend || Object.keys(backend).sort().join()!==functions.sort().join() || Object.values(backend).some(v=>typeof v!=='function') ||
       !packet || Object.keys(packet).sort().join()!==['schema_version','job_id','target','descriptor','requested_data_free_bytes'].sort().join() ||
       packet.schema_version!==1 || typeof packet.job_id!=='string' || !/^[a-f0-9]{32}$/.test(packet.job_id) ||
       !packet.target || Object.keys(packet.target).sort().join()!==['kind','wlan_mac','co2_type','stock_version','usb_serial','boot_id'].sort().join() ||
       packet.target.kind!=='browser_webusb' || packet.target.stock_version!=='4.1.8_0287' || ![2,3].includes(packet.target.co2_type) ||
       typeof packet.target.wlan_mac!=='string' || !/^[a-f0-9]{2}(?::[a-f0-9]{2}){5}$/.test(packet.target.wlan_mac) ||
       typeof packet.target.usb_serial!=='string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(packet.target.usb_serial) ||
       !Number.isInteger(packet.requested_data_free_bytes) || packet.requested_data_free_bytes<=0 || packet.requested_data_free_bytes>256*1024*1024 ||
       !stockFiles || Object.keys(stockFiles).sort().join()!==[...sourcePaths].sort().join()) fail();
    for(const pin of Object.values(stockFiles))
      if(!pin || Object.keys(pin).sort().join()!==['size','sha256'].sort().join() || !Number.isInteger(pin.size) || pin.size<1 || pin.size>8*1024*1024 ||
        typeof pin.sha256!=='string' || !hash.test(pin.sha256)) fail();
    this.#commands=stageCommands(packet.descriptor,packet.target.boot_id);
    const minimum=Object.values(packet.descriptor.files || {}).reduce((sum,pin)=>sum+(pin?.size || 0),0)+8*1024*1024;
    if(packet.requested_data_free_bytes<minimum) fail();
    // Detach all data from mutable frame/packet objects before any await.
    this.#packet=JSON.parse(JSON.stringify(packet));this.#stock=JSON.parse(JSON.stringify(stockFiles));this.#backend=Object.freeze({...backend});
    this.#sink=new BrowserStageFileSink({openSync:backend.openSync,pushV1:backend.pushV1,closeTransport:backend.closeTransport},packet.descriptor);
  }
  async #refuse() {await this.close().catch(()=>{});fail();}
  async #write(command) {
    // Caller sees only finite methods. Every dynamic shell value is a checked
    // hex/UUID or fixed role above, never a frame's command/path/body text.
    if(await this.#read('set -eu\numask 077\n'+command)!=='') throw Error();
  }
  async #read(command) {
    if(this.#closed)throw Error();
    const result=await this.#backend.read(command);
    if(this.#closed)throw Error();
    return result;
  }
  async #identity() {if(this.#closed || await this.#backend.identity(this.#packet.target)!==true || this.#closed)throw Error();}
  async #inventory() {if(this.#closed || await this.#backend.inventory()!==true || this.#closed)throw Error();}
  async prepare() {
    if(this.#closed || this.#started || this.#busy) return this.#refuse();
    this.#started=true;this.#busy=true; // Before the first possibly lost ACK.
    try {
      if(await this.#backend.initial(this.#packet.target,this.#packet.requested_data_free_bytes)!==true || this.#closed)throw Error();
      await this.#write(this.#commands.create);
      await this.#write(this.#commands.guard);
      this.#ready=true;
      return {state:'disabled_root_created'};
    } catch {return await this.#refuse();}
    finally {this.#busy=false;}
  }
  async begin(role) {
    if(this.#closed || !this.#ready || this.#busy || this.#role || this.#next>=STAGE_ROLES.length || role!==STAGE_ROLES[this.#next][0])return this.#refuse();
    this.#busy=true;this.#role=role;
    try {
      await this.#identity();
      await this.#sink.begin(role);
      // Both opt-outs and the original intent must still be private BEFORE
      // precreating this one new 0600 destination. No overwrite/resume exists.
      await this.#write(this.#commands.precreate(role));
      return {role,offset:0};
    } catch {return await this.#refuse();}
    finally {this.#busy=false;}
  }
  async append(role,offset,bytes) {
    if(this.#closed || this.#busy || role!==this.#role)return this.#refuse();
    this.#busy=true;
    try {return await this.#sink.append(role,offset,bytes);}catch {return await this.#refuse();}
    finally {this.#busy=false;}
  }
  async #inspect(role,mode) {
    const pin=this.#packet.descriptor.files[role],leaf=STAGE_ROLES.find(([name])=>name===role)[1];
    const lines=(await this.#read(this.#commands.inspect(role))).split('\n');
    if(lines.length!==2 || lines[0]!==`${pin.size} 1 0 ${mode}` || !digestLineMatches(lines[1],pin.sha256,base+'/'+leaf))throw Error();
  }
  async finishFile(role) {
    if(this.#closed || this.#busy || role!==this.#role)return this.#refuse();
    this.#busy=true;
    try {
      await this.#identity();
      await this.#sink.finish(role);
      await this.#inspect(role,'600'); // Independent remote bytes/UID/nlink.
      await this.#write(this.#commands.setMode(role));
      await this.#inspect(role,executable.has(role)?'700':'600');
      this.#role=undefined;this.#next++;
      return {role,state:'remote_file_verified'};
    } catch {return await this.#refuse();}
    finally {this.#busy=false;}
  }
  async finish() {
    if(this.#closed || !this.#ready || this.#busy || this.#role || this.#next!==STAGE_ROLES.length)return this.#refuse();
    this.#busy=true;
    try {
      await this.#identity();await this.#inventory();
      for(const [role] of STAGE_ROLES)await this.#inspect(role,executable.has(role)?'700':'600');
      await this.#write(this.#commands.complete);
      const after=await digest(this.#commands.afterBytes);
      if(!digestLineMatches(await this.#read(this.#commands.inspectComplete),after,sidecar+'/complete'))throw Error();
      await this.#identity();await this.#inventory();
      // Only after marker/readback and the actual owned USB close ACK may a
      // private Core coordinator record this terminal outcome. No code ran.
      await this.close();
      return {plan_id:this.#packet.descriptor.plan_id,plan_sha256:this.#packet.descriptor.plan_sha256,
        intent_sha256:this.#packet.descriptor.intent_sha256,target:this.#packet.target,
        files:this.#packet.descriptor.files,stock_files:this.#stock,root_mode_uid:'700 0',stage_metadata_mode_uid:'700 0',
        optouts_empty_regular:true,transport_closed:true,vendor_files_changed:false,program_started:false,after_effects_sha256:after};
    } catch {return await this.#refuse();}
    finally {this.#busy=false;}
  }
  close() {
    if(this.#closing)return this.#closing;
    this.#closed=true;
    this.#closing=this.#sink.close();
    return this.#closing;
  }
}
