/** Fixed read-only collector for a private disabled vendor transaction.
 * Backend callbacks must close over the actual selected NativeChannel. No
 * caller command/path is accepted. Metadata is context, not a consumed commit
 * intent; this reader never creates a lock, changes scripts or starts code.
 */
import {contract} from './usb-probe-contract.mjs';
import {disabledContract} from './usb-disabled-contract.mjs';
import {stageCommands,bridgeBootStageReads} from './usb-stage-session.mjs';
import {STAGE_ROLES} from './usb-stage-files.mjs';
import {digestLineMatches} from './usb-file-observation.mjs';
const base='/data/.esphome-cgs1',side='/data/.esphome-cgs1-stage';
const fail=()=>{throw {code:'usb_browser_scope_unverified'};};
const sha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
const executable=new Set(['bridge-program','launch.sh','SnowApp-with-PM']);
function positive(value) {
 if(typeof value!=='string' || !/^[0-9]+$/.test(value))fail();
 const number=Number(value);if(!Number.isSafeInteger(number) || number<1)fail();return number;
}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}

export function disabledScopeCommands(meta) {return scopeCommands(meta,false);}
export function armedBridgeScopeCommands(meta) {return scopeCommands(meta,true);}
function scopeCommands(meta,armed) {
 const fields=['schema_version','job_id','target','descriptor','commit_nonce'];
 if(!meta || Object.keys(meta).sort().join()!==fields.sort().join() || meta.schema_version!==1 ||
    typeof meta.job_id!=='string' || !/^[a-f0-9]{32}$/.test(meta.job_id) ||
    !(meta.commit_nonce===null || typeof meta.commit_nonce==='string' && /^[a-f0-9]{32}$/.test(meta.commit_nonce)) ||
    !meta.target || Object.keys(meta.target).sort().join()!==['kind','wlan_mac','co2_type','stock_version','usb_serial','boot_id'].sort().join() ||
    meta.target.kind!=='browser_webusb' || ![2,3].includes(meta.target.co2_type) || meta.target.stock_version!=='4.1.8_0287' ||
    typeof meta.target.wlan_mac!=='string' || !/^[a-f0-9]{2}(?::[a-f0-9]{2}){5}$/.test(meta.target.wlan_mac) ||
    meta.target.wlan_mac==='00:00:00:00:00:00' || (parseInt(meta.target.wlan_mac.slice(0,2),16)&1) ||
    typeof meta.target.usb_serial!=='string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(meta.target.usb_serial) ||
    !meta.descriptor || Object.keys(meta.descriptor).sort().join()!==['plan_id','plan_sha256','intent_sha256','files'].sort().join() ||
    !meta.descriptor.files || Object.keys(meta.descriptor.files).sort().join()!==STAGE_ROLES.map(([role])=>role).sort().join())fail();
 let total=0;
 for(const pin of Object.values(meta.descriptor.files)) {
  if(!pin || Object.keys(pin).sort().join()!==['size','sha256'].sort().join() || !Number.isInteger(pin.size) || pin.size<1 || pin.size>16*1024*1024 ||
     typeof pin.sha256!=='string' || !/^[a-f0-9]{64}$/.test(pin.sha256))fail();
  total+=pin.size;
 }
 if(total>32*1024*1024)fail();
 for(const [role,digest] of Object.entries(disabledContract.sources))if(meta.descriptor.files[role]?.sha256!==digest)fail();
 const stage=(armed?bridgeBootStageReads:stageCommands)(meta.descriptor,meta.target.boot_id);
 const lock=base+'/.commit-disabled.lock',marker='commit-disabled '+meta.commit_nonce+' '+meta.descriptor.plan_id;
 // A nonce is only a read comparator obtained from the private journal. It
 // never creates/adopts a lock or authorizes another forward/rollback attempt.
 const lockGuard=meta.commit_nonce===null?'':
  `test ! -L ${lock}\ntest -d ${lock}\nCGS1_SCOPE_LOCK=$(stat -c '%a %u' ${lock})\ntest "$CGS1_SCOPE_LOCK" = '700 0'\n`+
  `test ! -L ${lock}/owner\ntest -f ${lock}/owner\nCGS1_SCOPE_OWNER=$(stat -c '%s %a %u %h' ${lock}/owner)\n`+
  `test "$CGS1_SCOPE_OWNER" = '${marker.length+1} 600 0 1'\n`+
  `CGS1_SCOPE_ACTUAL=$(sha256sum ${lock}/owner)\nCGS1_SCOPE_EXPECTED=$(printf '%s\\n' '${marker}' | sha256sum)\n`+
  'test "${CGS1_SCOPE_ACTUAL%% *}" = "${CGS1_SCOPE_EXPECTED%% *}"\n';
 const guard=stage.guard+'\n'+lockGuard;
 return Object.freeze({
  stage,guard,root:guard+`\nstat -c '%d %i %a %u' ${base}`,
  entries:guard+`\nLC_ALL=C ls -A1 ${base}`,
  sideEntries:guard+`\nLC_ALL=C ls -A1 ${side}`,
  lockEntries:meta.commit_nonce===null?null:guard+`\nLC_ALL=C ls -A1 ${lock}`,
  parents:guard+"\ntest ! -L /data\ntest ! -L /data/bin\ntest ! -L /data/etc\ntest ! -L /data/etc/init.d\nstat -c '%d' /data/bin /data/etc/init.d",
  process:pid=>{if(!Number.isInteger(pid) || pid<=1 || pid>2147483647)fail();return `cat /proc/${pid}/stat\nstat -c '%u' /proc/${pid}\nreadlink /proc/${pid}/exe`;},
  watchdog:pid=>{if(!Number.isInteger(pid) || pid<=1 || pid>2147483647)fail();return `CGS1_SCOPE_ARGS=$(tr '\\000' '\\n' < /proc/${pid}/cmdline)\n[ "$CGS1_SCOPE_ARGS" = "$(printf '/bin/sh\\n/data/bin/watchdog.sh')" ]`;},
  maps:pid=>{if(!Number.isInteger(pid) || pid<=1 || pid>2147483647)fail();return `test -r /proc/${pid}/maps\nif grep -F -q '${base}/pm_qt_bridge.so' /proc/${pid}/maps; then exit 1; else CGS1_SCOPE_RESULT=$?; [ "$CGS1_SCOPE_RESULT" -eq 1 ]; fi`;},
 });
}

function process(text,pid,executable) {
 const lines=text.split('\n');if(lines.length!==3 || lines[1]!=='0' || lines[2]!==executable)fail();
 const stat=lines[0],left=stat.indexOf('('),right=stat.lastIndexOf(') ');
 if(left<1 || right<=left || stat.slice(0,left).trim()!==String(pid))fail();
 const fields=stat.slice(right+2).split(/\s+/);
 if(fields.length<20 || !['R','S','D','I'].includes(fields[0]))fail();
 return [pid,positive(fields[1]),positive(fields[19])];
}

export async function collectDisabledScope(backend,input) {
 return await collect(backend,input,undefined);
}

/** Read the one known native trial marker after an exact stopped journal.
 * This is a separate fixed reader, not a caller-provided file allowlist. A
 * marker hash is a comparator only: no lease, retry, writer or native receipt.
 */
export async function collectStoppedTrialScope(backend,input,marker) {
 if(!marker || Object.keys(marker).sort().join()!=='sha256,size' ||
    !Number.isSafeInteger(marker.size) || marker.size<1 || marker.size>4096 ||
    typeof marker.sha256!=='string' || !/^[a-f0-9]{64}$/.test(marker.sha256))fail();
 return await collect(backend,input,JSON.parse(JSON.stringify(marker)));
}

/** Explicit armed reader, with both fixed marker pins; never an extra-file API. */
export async function collectArmedBridgeScope(backend,input,marker,completion) {
 const valid=v=>v && Object.keys(v).sort().join()==='sha256,size' && Number.isSafeInteger(v.size) &&
  v.size>0 && v.size<=4096 && typeof v.sha256==='string' && /^[a-f0-9]{64}$/.test(v.sha256);
 if(!valid(marker) || !valid(completion))fail();
 return await collect(backend,input,JSON.parse(JSON.stringify(marker)),JSON.parse(JSON.stringify(completion)));
}

async function collect(backend,input,marker,completion=undefined) {
 if(!backend || Object.keys(backend).sort().join()!==['read','identity'].sort().join() || Object.values(backend).some(v=>typeof v!=='function'))fail();
 const commands=scopeCommands(input,completion!==undefined),meta=JSON.parse(JSON.stringify(input));
 const read=command=>backend.read(command);
 const identity=async()=>{if(await backend.identity(meta.target)!==true)fail();};
 const empty=async command=>{if(await read(command)!=='')fail();};
 const root=async()=>{
  const value=(await read(commands.root)).split(' ');
  if(value.length!==4 || value[2]!=='700' || value[3]!=='0')fail();
  const result=[positive(value[0]),positive(value[1])];
  const names=[...STAGE_ROLES.map(([,leaf])=>leaf),'install.intent','pm-helper.disabled',
   ...(completion?['disabled.before-next-boot','bridge-next-boot.complete']:['disabled'])];
  if(meta.commit_nonce!==null)names.push('.commit-disabled.lock');
  if(marker) {
   if(meta.commit_nonce===null)fail();
   names.push('initial-trial.intent');
   const path=base+'/initial-trial.intent';
   const command=`test ! -L ${path}\ntest -f ${path}\nstat -c '%s %a %u %h' ${path}\nsha256sum ${path}`;
   const rows=(await read(command)).split('\n');
   if(rows.length!==2 || rows[0]!==`${marker.size} 600 0 1` || !digestLineMatches(rows[1],marker.sha256,path))fail();
  }
  if(completion) {
   const path=base+'/bridge-next-boot.complete';
   const rows=(await read(`test ! -L ${path}\ntest -f ${path}\nstat -c '%s %a %u %h' ${path}\nsha256sum ${path}`)).split('\n');
   if(rows.length!==2 || rows[0]!==`${completion.size} 600 0 1` || !digestLineMatches(rows[1],completion.sha256,path))fail();
  }
  if(!same((await read(commands.entries)).split('\n').sort(),names.sort()) ||
     !same((await read(commands.sideEntries)).split('\n').sort(),['complete','intent']) ||
     commands.lockEntries && await read(commands.lockEntries)!=='owner' ||
     !same((await read(commands.parents)).split('\n'),[String(result[0]),String(result[0])]))fail();
  const after=await sha(commands.stage.afterBytes);
  if(!digestLineMatches(await read(commands.stage.inspectComplete),after,side+'/complete'))fail();
  return result;
 };
 const staged=async()=>{
  for(const [role,leaf] of STAGE_ROLES) {
   const pin=meta.descriptor.files[role],lines=(await read(commands.stage.inspect(role))).split('\n');
   if(lines.length!==2 || lines[0]!==`${pin.size} 1 0 ${executable.has(role)?'700':'600'}` ||
      !digestLineMatches(lines[1],pin.sha256,base+'/'+leaf))fail();
  }
 };
 const vendors=async()=>{
  const result=[];
  for(const file of contract.files) {
   const lines=(await read(file.command)).split('\n');
   const options=[file,disabledContract.patched[file.path]].filter(Boolean);
   const matched=options.find(pin=>lines.length===2 && lines[0]===`${pin.size} 1` && digestLineMatches(lines[1],pin.sha256,file.path));
   if(!matched)fail();result.push([file.path,matched.sha256]);
  }
  return result.sort(([a],[b])=>a<b?-1:a>b?1:0);
 };
 const session=async()=>{
  const value=await read(disabledContract.process_scan);if(!/^[0-9]+$/.test(value))fail();
  const pid=positive(value);if(pid<=1 || pid>2147483647)fail();
  const stock=process(await read(commands.process(pid)),pid,'/data/bin/SnowApp');
  const watchdog=process(await read(commands.process(stock[1])),stock[1],'/bin/busybox');
  if(stock[0]===watchdog[0])fail();
  await empty(commands.watchdog(watchdog[0]));await empty(commands.maps(stock[0]));
  return {stock:[stock[0],stock[2],contract.files.find(file=>file.path==='/data/bin/SnowApp').sha256,0],watchdog:[watchdog[0],watchdog[2],0]};
 };
 try {
  await identity();const rootId=await root(),beforeVendors=await vendors(),beforeSession=await session();await staged();
  const fs=(await read("stat -f -c '%t %a %S' /data")).split(/\s+/);
  if(fs.length!==3 || fs[0]!=='ef53' || !/^[0-9]+$/.test(fs[1]))fail();
  const blocks=Number(fs[1]),size=positive(fs[2]),available=blocks*size;
  if(!Number.isSafeInteger(blocks) || blocks<0 || size<512 || size>65536 || !Number.isSafeInteger(available) || available<8*1024*1024)fail();
  // Independent closing reads, not cached first-pass metadata or ACKs. No
  // partial observation can become False for running code/loaded PM helper.
  if(!same(await root(),rootId) || !same(await vendors(),beforeVendors) || !same(await session(),beforeSession))fail();
  await staged();await identity();
  const emptySha=await sha(new Uint8Array());
  return {kind:completion?'browser_bridge_armed_scope':'browser_disabled_scope',target:meta.target,plan_id:meta.descriptor.plan_id,plan_sha256:meta.descriptor.plan_sha256,
   stage_intent_sha256:meta.descriptor.intent_sha256,root_identity:rootId,install_marker:meta.descriptor.plan_id+' '+meta.descriptor.plan_sha256,
   root_mode:0o700,root_uid:0,...(completion?{boot_flags:{bridge_disabled:false,recovery_backup:true,pm_disabled:true},arm_marker:completion}:
    {disabled_flags:Array.from({length:2},()=>[emptySha,0,0o600,0,1,false])}),
   source_hashes:Object.entries(disabledContract.sources).sort(([a],[b])=>a<b?-1:a>b?1:0),vendor_hashes:beforeVendors,
   stock_process:beforeSession.stock,watchdog_process:beforeSession.watchdog,own_code_running:false,pm_helper_loaded:false,
   data_available_bytes:available,same_filesystem:true,staged_files:meta.descriptor.files,commit_nonce:meta.commit_nonce};
 } catch {fail();}
}
