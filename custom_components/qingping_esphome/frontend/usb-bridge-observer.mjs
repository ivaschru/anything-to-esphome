/** Read-only ordinary-boot observer, using the exact canonical native reads.
 * No reboot, signal, command selector, writer receipt or PID adoption. PIDs
 * below are read hints for this one bounded frame, never launch authority.
 */
import {bridgeObserverContract as contract} from './usb-bridge-observer-contract.mjs';
import {validateBridgeBootPacket} from './usb-bridge-boot-session.mjs';
import {bridgeBootCompletion} from './usb-bridge-boot-commands.mjs';
import {contract as stock} from './usb-probe-contract.mjs';
import {disabledContract} from './usb-disabled-contract.mjs';
import {STAGE_ROLES} from './usb-stage-files.mjs';
import {digestLineMatches} from './usb-file-observation.mjs';
const fail=()=>{throw {code:'usb_browser_scope_unverified'};};
const keys=v=>v && typeof v==='object' && !Array.isArray(v)?Object.keys(v).sort().join():null;
const stable=v=>Array.isArray(v)?'['+v.map(stable).join(',')+']':v && typeof v==='object'?
 '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}':JSON.stringify(v);
const clone=v=>{try{return JSON.parse(JSON.stringify(v));}catch{fail();}};
const hex=/^[a-f0-9]{64}$/,uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const base='/data/.esphome-cgs1';
function number(text,min=1,max=Number.MAX_SAFE_INTEGER) {
 if(typeof text!=='string' || !/^[0-9]+$/.test(text))fail();
 const v=Number(text);if(!Number.isSafeInteger(v) || v<min || v>max)fail();return v;
}
function rows(value) {
 if(typeof value!=='string' || value.length>4096 || /[\x00\x80-\uffff\r]/.test(value))fail();
 return value===''?[]:value.split('\n');
}
function empty(value) {if(rows(value).length)fail();}
function process(text,pid,path) {
 const r=rows(text);if(r.length!==3 || r[1]!=='0' || r[2]!==path)fail();
 const left=r[0].indexOf('('),right=r[0].lastIndexOf(') ');
 if(left<1 || right<=left || r[0].slice(0,left).trim()!==String(pid))fail();
 const p=r[0].slice(right+2).split(/\s+/);
 if(p.length<20 || !['R','S','D','I'].includes(p[0]) || !/^[1-9][0-9]{0,19}$/.test(p[19]) || BigInt(p[19])>=2n**64n)fail();
 return [pid,number(p[1],1,2147483647),p[19]];
}
function file(text,pin,path) {
 const r=rows(text);if(r.length!==2 || r[0]!==pin.size+' 1' || !digestLineMatches(r[1],pin.sha256,path))fail();
}
function namedImage(text) {
 const r=rows(text);if(r.length!==2 || r[0]!==r[1] || !/^[1-9][0-9]* [1-9][0-9]* [1-9][0-9]* 0 1$/.test(r[0]))fail();
}
export function validateBridgeObserverContext(c) {
 const fields=['schema_version','kind','job_id','plan_sha256','arming','arming_proof_sha256','api_identity','producer_sha256','context_only','writer_enabled','device_writes'];
 if(keys(c)!==fields.sort().join() || c.schema_version!==1 || c.kind!=='browser_bridge_boot_observer_context' ||
    c.context_only!==true || c.writer_enabled!==false || c.device_writes!==0 ||
    typeof c.arming_proof_sha256!=='string' || !hex.test(c.arming_proof_sha256) ||
    keys(c.producer_sha256)!==['browser_boot_context.py','bridge-observer-contract.json'].sort().join() ||
    Object.values(c.producer_sha256).some(v=>typeof v!=='string' || !hex.test(v)) ||
    keys(c.api_identity)!=='api_mac,node_name' || typeof c.api_identity.node_name!=='string' || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(c.api_identity.node_name) ||
    typeof c.api_identity.api_mac!=='string' || !/^[a-f0-9]{2}(?::[a-f0-9]{2}){5}$/.test(c.api_identity.api_mac) ||
    c.api_identity.api_mac==='00:00:00:00:00:00' || (parseInt(c.api_identity.api_mac.slice(0,2),16)&1))fail();
 validateBridgeBootPacket(c.arming);
 if(c.job_id!==c.arming.job_id || c.plan_sha256!==c.arming.plan_sha256 || contract.schema_version!==1 ||
    contract.source_commit!==c.arming.context.source_commit || !Array.isArray(contract.reads) ||
    contract.reads.length!==64 || JSON.stringify(c).length>65536)fail();
}
function currentTarget(c,target) {
 const old=c.arming.context.meta.target;
 if(keys(target)!==keys(old) || typeof target.boot_id!=='string' || !uuid.test(target.boot_id) ||
    stable({...target,boot_id:old.boot_id})!==stable(old))fail();
}
/** Exact ordered command list with only typed descriptor/current-PID leaves.
 * This pure helper is used for parity QA; a production caller cannot pass a
 * command, path or alternate source into collectBridgeRuntimeScope.
 */
export async function bridgeObserverReadParts(c,target) {
 validateBridgeObserverContext(c);currentTarget(c,target);
 const p=c.arming,meta=p.context.meta,pin=await bridgeBootCompletion(meta.descriptor.plan_id,p.plan_sha256,p.nonce);
 const values={plan_id:meta.descriptor.plan_id,plan_sha256:p.plan_sha256,nonce:p.nonce,
  commit_nonce:meta.commit_nonce,wlan_mac:target.wlan_mac,boot_id:target.boot_id,completion_sha256:pin.sha256};
 STAGE_ROLES.forEach(([role],i)=>{const f=meta.descriptor.files[role];values['staged_size_'+i]=String(f.size);values['staged_sha_'+i]=f.sha256;});
 return {values,reads:contract.reads};
}

export async function collectBridgeRuntimeScope(backend,input,targetInput) {
 if(keys(backend)!=='identity,read' || Object.values(backend).some(v=>typeof v!=='function'))fail();
 const [c,target]=clone([input,targetInput]);const {values,reads}=await bridgeObserverReadParts(c,target);
 if(target.boot_id===c.arming.context.meta.target.boot_id)fail(); // Idle arming has a separate reader.
 const meta=c.arming.context.meta,root=c.arming.preparation.preparation.scope.root_identity;
 const replies={},processes={};let memory;
 const identity=async()=>{if(await backend.identity(target)!==true)fail();};
 const rootRead=value=>{if(stable(rows(value))!==stable([root.join(' ')+' 700 0',meta.descriptor.plan_id+' '+c.plan_sha256]))fail();};
 const pid=value=>number(value,2,2147483647);
 const procRead=(name,path,parent=undefined)=>{
  const v=process(replies[name],pid(values[name+'_pid']),path);if(parent!==undefined && v[1]!==parent)fail();processes[name]=v;
 };
 try {
  await identity();
  for(const row of reads) {
   if(keys(row)!=='key,parts' || typeof row.key!=='string' || Object.hasOwn(replies,row.key) || !Array.isArray(row.parts))fail();
   const command=row.parts.map(part=>{
    if(typeof part==='string')return part;
    if(keys(part)!=='field' || typeof values[part.field]!=='string')fail();return values[part.field];
   }).join('');
   if(command.length>8192 || /[^\x01-\x7f]/.test(command))fail();
   const value=await backend.read(command);rows(value);replies[row.key]=value;
   const key=row.key;
   if(key.startsWith('identity_')) {
    const name=key.slice(9).replace(/_after$/,'');
    const expected={uid:'0',wlan:target.wlan_mac,version:'CLEARGRASS_VERSION=4.1.8_0287',architecture:'armv7l',co2:String(target.co2_type),boot:target.boot_id};
    if(value!==expected[name])fail();
   } else if(key==='root' || key==='root_after')rootRead(value);
   else if(key==='parents' || key==='parents_after') {if(stable(rows(value))!==stable(root.map(()=>String(root[0]))))fail();}
   else if(key==='commit_marker') {if(value!=='commit-disabled '+meta.commit_nonce+' '+meta.descriptor.plan_id)fail();}
   else if(['completion_guard','armed_flags','bridge_layout','supervisor_arguments','watchdog_arguments'].includes(key) || key.startsWith('stock_maps_'))empty(value);
   else if(key==='pm_flag') {
    const r=rows(value);if(r.length!==2 || r[0]!=='0 600 0 1' || !digestLineMatches(r[1],'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',base+'/pm-helper.disabled'))fail();
   } else if(key.startsWith('staged_')) {
    const [role,leaf]=STAGE_ROLES[number(key.slice(7),0,STAGE_ROLES.length-1)];file(value,meta.descriptor.files[role],base+'/'+leaf);
   } else if(key.startsWith('vendor_')) {
    const pin=stock.files[number(key.slice(7),0,stock.files.length-1)];file(value,disabledContract.patched[pin.path]||pin,pin.path);
   } else if(key==='lock') {
    const r=rows(value);if(r.length!==2 || r[0]===r[1])fail();values.supervisor_pid=String(pid(r[0]));values.child_pid=String(pid(r[1]));
   } else if(key==='child')procRead('child',base+'/program',pid(values.supervisor_pid));
   else if(key==='supervisor')procRead('supervisor','/bin/busybox');
   else if(key==='process_scan') {values.stock_pid=String(pid(value));}
   else if(key==='stock') {procRead('stock','/data/bin/SnowApp');values.watchdog_pid=String(processes.stock[1]);}
   else if(key==='watchdog') {procRead('watchdog','/bin/busybox');if(new Set(Object.values(processes).map(v=>v[0])).size!==4)fail();}
   else if(key==='child_image_process_before' || key==='child_image_process_after') {
    if(stable(process(value,pid(values.child_pid),base+'/program'))!==stable(processes.child))fail();
   } else if(key==='child_image_file')file(value,meta.descriptor.files['bridge-program'],base+'/program');
   else if(key==='child_image') {
    const r=rows(value),pin=meta.descriptor.files['bridge-program'];
    if(r.length!==3 || r[0]!==r[1] || !new RegExp('^'+root[0]+' [1-9][0-9]* '+pin.size+' 700 0 1$').test(r[0]) ||
       !digestLineMatches(r[2],pin.sha256,'/proc/'+values.child_pid+'/exe'))fail();
   } else if(['supervisor_image','stock_image','watchdog_image'].includes(key))namedImage(value);
   else if(key==='endpoint') {
    const r=rows(value);if(r.length<2 || r.length>4 || new Set(r).size!==r.length ||
     r.some(v=>!/^\/proc\/net\/tcp6? (?:17A5|0CA0)$/.test(v)) || new Set(r.map(v=>v.split(' ')[1])).size!==2)fail();
   } else if(key==='memory') {
    memory={};for(const line of rows(value)) {
     const match=/^(MemTotal|MemFree):[ \t]+([0-9]+)[ \t]+kB$/.exec(line);
     if(!match || Object.hasOwn(memory,match[1]))fail();memory[match[1]]=number(match[2],0,2**30)*1024;
    }
    if(keys(memory)!=='MemFree,MemTotal' || memory.MemFree<8*1024**2 || memory.MemFree>memory.MemTotal)fail();
   } else if(key==='lock_after') {if(value!==replies.lock)fail();}
   else if(/^(child|supervisor|stock|watchdog)_after$/.test(key)) {
    const name=key.slice(0,-6),path=name==='child'?base+'/program':name==='stock'?'/data/bin/SnowApp':'/bin/busybox';
    if(stable(process(value,pid(values[name+'_pid']),path))!==stable(processes[name]))fail();
   } else fail();
  }
  await identity();
  return Object.freeze({kind:'browser_bridge_boot_runtime_scope',job_id:c.job_id,plan_sha256:c.plan_sha256,
   arming_intent_sha256:c.arming.intent_sha256,arming_proof_sha256:c.arming_proof_sha256,target,root_identity:root,
   processes,pm_disabled:true,recovery_backup:true,bridge_disabled:false,canonical_scope_checked:true,
   memory_free_bytes:memory.MemFree,memory_total_bytes:memory.MemTotal,context_only:true,device_writes:0});
 }catch{fail();}
}
