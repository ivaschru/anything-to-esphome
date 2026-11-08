/** Complete fixed read-only native live_scope adapter, without Noise or stop proof.
 * The only paths/PIDs come from the original consumed packet/RAM/START. No
 * frame can select a node preference filename or supply shell/host/path data.
 * Failed reads are refusal, never absence. The device's own timer is separate.
 */
import {initialScopeContract as contract} from './usb-initial-scope-contract.mjs';
import {initialTrialContract} from './usb-initial-trial-contract.mjs';
import {initialGuardianProcessReads,initialGuardianProcessObservation,initialProcessText} from './usb-initial-process-observation.mjs';
import {contract as stock} from './usb-probe-contract.mjs';
import {disabledContract} from './usb-disabled-contract.mjs';
import {STAGE_ROLES} from './usb-stage-files.mjs';
import {digestLineMatches} from './usb-file-observation.mjs';
const fail=()=>{throw {code:'usb_browser_scope_unverified'};};
const fields=v=>v && typeof v==='object' && !Array.isArray(v)?Object.keys(v).sort().join():null;
const clone=v=>{try{return JSON.parse(JSON.stringify(v));}catch{fail();}};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const sha=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),v=>v.toString(16).padStart(2,'0')).join('');
function lines(text) {
 if(typeof text!=='string' || text.length>65536 || /[^\x01-\x7f]/.test(text))fail();
 if(text.endsWith('\r\n'))text=text.slice(0,-2);else if(text.endsWith('\n'))text=text.slice(0,-1);
 if(text.includes('\r'))fail();return text===''?[]:text.split('\n');
}
function number(text,min=0,max=Number.MAX_SAFE_INTEGER) {
 if(typeof text!=='string' || !/^[0-9]+$/.test(text))fail();
 const value=Number(text);if(!Number.isSafeInteger(value) || value<min || value>max)fail();return value;
}
function empty(value) {if(lines(value).length)fail();}
function file(value,pin,path) {
 const rows=lines(value);if(rows.length!==2 || rows[0]!==pin.size+' 1' || !digestLineMatches(rows[1],pin.sha256,path))fail();
}

function scopeReads(input,ramInput,startInput,returning=false) {
 const [packet,ram,start]=clone([input,ramInput,startInput]);
 initialGuardianProcessReads(packet,ram,start); // Complete typed original context, not IO/admission.
 if(contract.schema_version!==1 || contract.maximum_observation_ms!==5000 || contract.source_commit!==initialTrialContract.source_commit ||
    !same(contract.source_sha256,initialTrialContract.source_sha256) ||
    fields(contract.branches)!==['empty','prefs_empty','prefs_file'].sort().join() ||
    fields(contract.return_branches)!==fields(contract.branches))fail();
 const baseline=packet.context.committed_scope,values={guardian_pid:String(start.start.stamp[0]),child_pid:String(start.child.stamp[0]),
  stock_pid:String(baseline.stock_process[0]),watchdog_pid:String(baseline.watchdog_process[0]),
  guardian_job_id:packet.guardian_job_id,ram_job_id:packet.ram_job_id,
  ram_device:String(ram.uploaded.ram_root_identity[0]),node_name:packet.context.api_identity.node_name};
 const result={};
 for(const [layout,rows] of Object.entries(returning?contract.return_branches:contract.branches)) {
  if(!Array.isArray(rows) || rows.length!==((layout==='empty'?54:layout==='prefs_empty'?56:57)-(returning?11:0)))fail();
  const commands={};
  for(const row of rows) {
   if(fields(row)!==['key','parts'].sort().join() || typeof row.key!=='string' || Object.hasOwn(commands,row.key) || !Array.isArray(row.parts))fail();
   commands[row.key]=row.parts.map(p=>{
    if(typeof p==='string')return p;
    if(fields(p)!=='field' || typeof values[p.field]!=='string')fail();return values[p.field];
   }).join('');
   if(commands[row.key].length>8192 || /[^\x01-\x7f]/.test(commands[row.key]))fail();
  }
  result[layout]=Object.freeze(commands);
 }
 // Branch selection is solely a complete positive RAM listing. All reads
 // before it and after the optional prefs tail must be byte-identical.
 for(const [key,command] of Object.entries(result.empty))
  if(result.prefs_empty[key]!==command || result.prefs_file[key]!==command)fail();
 for(const [key,command] of Object.entries(result.prefs_empty))
  if(result.prefs_file[key]!==command)fail();
 return Object.freeze(result);
}

export function initialGuardianScopeReads(input,ramInput,startInput) {return scopeReads(input,ramInput,startInput);}

/** Fixed post-stop tail and strict absence scan. This is pure read context;
 * an eventual live caller must retain the original consumed guardian session,
 * await its ordered END/raw-close and API-close ACK before issuing any read.
 * JSON cannot grant that capability, stop a process or complete a journal.
 */
export function initialGuardianReturnReads(input,ramInput,startInput) {return scopeReads(input,ramInput,startInput,true);}

async function scopeObservation(input,ramInput,startInput,observedInput,returning=false) {
 const [packet,ram,start,reads]=clone([input,ramInput,startInput,observedInput]);
 const branches=scopeReads(packet,ram,start,returning),base='/data/.esphome-cgs1';
 let layout;
 if(lines(reads.ram_entries).length===0)layout='empty';
 else if(reads.ram_entries==='prefs') {
  if(lines(reads.prefs_entries).length===0)layout='prefs_empty';
  else if(reads.prefs_entries===packet.context.api_identity.node_name+'.prefs')layout='prefs_file';else fail();
 } else fail();
 if(fields(reads)!==Object.keys(branches[layout]).sort().join())fail();
 let process;
 if(!returning) {
  const processKeys=Object.keys(initialGuardianProcessReads(packet,ram,start));
  process=initialGuardianProcessObservation(packet,ram,start,Object.fromEntries(processKeys.map(k=>[k,reads[k]])));
 }
 const scope=packet.context.committed_scope,meta=packet.context.meta,root=scope.root_identity;
 if(reads.process_scan!==String(scope.stock_process[0]))fail();
 const s=initialProcessText(reads.stock_process,[scope.stock_process[0],String(scope.stock_process[1])],'/data/bin/SnowApp',scope.watchdog_process[0]);
 const w=initialProcessText(reads.watchdog_process,[scope.watchdog_process[0],String(scope.watchdog_process[1])],'/bin/busybox');
 empty(reads.watchdog_arguments);
 for(let i=0;i<3;i++)empty(reads['stock_maps_'+i]);
 stock.files.forEach((pin,i)=>file(reads['vendor_'+i],disabledContract.patched[pin.path]||pin,pin.path));
 STAGE_ROLES.forEach(([role,leaf],i)=>file(reads['staged_'+i],meta.descriptor.files[role],base+'/'+leaf));
 if(!same(lines(reads.root),[root.join(' ')+' 700 0',scope.plan_id+' '+scope.plan_sha256]) ||
    !same(lines(reads.parents),[String(root[0]),String(root[0])]))fail();
 for(const leaf of ['disabled','pm-helper.disabled']) {
  const rows=lines(reads[leaf]);if(rows.length!==2 || rows[0]!=='0 600 0 1' ||
   !digestLineMatches(rows[1],'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',base+'/'+leaf))fail();
 }
 empty(reads.absent_stores);
 const memory={};
 for(const line of lines(reads.memory)) {
  const match=/^(MemTotal|MemFree):[ \t]+([0-9]+)[ \t]+kB$/.exec(line);
  if(!match || Object.hasOwn(memory,match[1]))fail();memory[match[1]]=number(match[2],0,2**30)*1024;
 }
 if(fields(memory)!==['MemFree','MemTotal'].sort().join() || memory.MemFree<8*1024**2 || memory.MemFree>memory.MemTotal)fail();
 const ramRoot=ram.uploaded.ram_root_identity,g=start.start.stamp;
 const intent='CGS1_INITIAL_TRIAL_V1\n'+scope.plan_id+'\n'+scope.plan_sha256+'\n'+meta.target.boot_id+'\n'+
  meta.descriptor.files['bridge-program'].sha256+'\n'+packet.context.guardian.sha256+'\n'+packet.nonce+'\n'+
  ramRoot.join(' ')+'\n'+g.join(' ')+'\n';
 file(reads.intent_file,{size:intent.length,sha256:await sha(intent)},base+'/initial-trial.intent');empty(reads.intent_mode);
 const allowed=[...STAGE_ROLES.map(([,leaf])=>leaf),'install.intent','disabled','pm-helper.disabled','.commit-disabled.lock','initial-trial.intent'];
 if(!same(lines(reads.nand_entries).sort(),allowed.sort()) ||
    reads.commit_marker!=='commit-disabled '+meta.commit_nonce+' '+scope.plan_id ||
    !same(lines(reads.ram_identity),[ramRoot.join(' ')+' 700 0','1021994']))fail();
 if(layout!=='empty')empty(reads.prefs_guard);
 if(layout==='prefs_file') {
  const rows=lines(reads.prefs_file);if(rows.length!==1)fail();const v=rows[0].split(' ');
  if(v.length!==5 || v.slice(1).join(' ')!=='600 0 1 '+ramRoot[0])fail();
  number(v[0],0,65536); // Validate size even though its bytes are deliberately not exported.
 }
 const target=meta.target;
 const identity={uid:'0',wlan:target.wlan_mac,version:'CLEARGRASS_VERSION=4.1.8_0287',architecture:'armv7l',co2:String(target.co2_type),boot:target.boot_id};
 for(const [key,value] of Object.entries(identity))if(reads['identity_'+key]!==value)fail();
 const binding=Object.fromEntries(['job_id','plan_sha256','intent_sha256','channel_id','channel_nonce','nonce','ram_job_id','guardian_job_id'].map(k=>[k,packet[k]]));
 return Object.freeze({kind:returning?'browser_initial_return_observation':'browser_initial_scope_observation',...binding,
  ...(returning?{guardian:Object.freeze(start.start.stamp),child:Object.freeze(start.child.stamp),own_programs_absent:true}:{process}),
  root_identity:Object.freeze(root),ram_root_identity:Object.freeze(ramRoot),
  stock_process:Object.freeze([s[0],s[2]]),watchdog_process:Object.freeze([w[0],w[2]]),
  prefs_layout:layout,memory_free_bytes:memory.MemFree,memory_total_bytes:memory.MemTotal,kernel_scope_checked:true,
  image_fd_admitted:false,execution_authority:false,context_only:true});
}

export function initialGuardianScopeObservation(input,ram,start,reads) {return scopeObservation(input,ram,start,reads);}
export function initialGuardianReturnObservation(input,ram,start,reads) {return scopeObservation(input,ram,start,reads,true);}

async function collectScope(backend,packet,ram,start,returning=false) {
 if(fields(backend)!=='read' || typeof backend.read!=='function')fail();
 [packet,ram,start]=clone([packet,ram,start]);
 const branches=scopeReads(packet,ram,start,returning),reads={};
 let selected=branches.prefs_file;
 // The generated branch order is immutable. Choose only after positively
 // reading its discriminator, before any optional filename read is issued.
 for(let i=0;i<Object.keys(selected).length;i++) {
  const key=Object.keys(selected)[i];reads[key]=await backend.read(selected[key]);
  if(key==='ram_entries') {
   if(reads[key]==='')selected=branches.empty;
   else if(reads[key]!=='prefs')fail();
  } else if(key==='prefs_entries') {
   if(reads[key]==='')selected=branches.prefs_empty;
   else if(reads[key]!==packet.context.api_identity.node_name+'.prefs')fail();
  }
 }
 return scopeObservation(packet,ram,start,reads,returning);
}

export function collectInitialGuardianScope(backend,packet,ram,start) {return collectScope(backend,packet,ram,start);}
export async function collectInitialGuardianReturn(backend,packet,ram,start) {
 [packet,ram,start]=clone([packet,ram,start]); // One original basis across BOTH passes.
 // Independent closing pass: a first scan/digest is not a stable post-stop
 // snapshot. Both passes must positively refuse own programs and validate all
 // original bytes/flags. Only measured MemFree may vary; it grants no space
 // reservation. The actual caller bounds the whole read window, not each pass.
 const before=await collectScope(backend,packet,ram,start,true);
 const after=await collectScope(backend,packet,ram,start,true);
 const stable=value=>Object.fromEntries(Object.entries(value).filter(([key])=>key!=='memory_free_bytes'));
 if(!same(stable(before),stable(after)))fail();return after;
}
