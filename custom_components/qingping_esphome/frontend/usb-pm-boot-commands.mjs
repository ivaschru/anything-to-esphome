/** Canonical PM next-boot text only; no lease, live handle or writer receipt. */
import {pmBootContract as contract} from './usb-pm-boot-contract.mjs';
import {validateBridgeObserverContext} from './usb-bridge-observer.mjs';
import {STAGE_ROLES} from './usb-stage-files.mjs';
const fail=()=>{throw {code:'usb_browser_scope_unverified'};};
const keys=v=>v && typeof v==='object' && !Array.isArray(v)?Object.keys(v).sort().join():null;
const hex=/^[a-f0-9]{32}$/;
const stable=v=>Array.isArray(v)?'['+v.map(stable).join(',')+']':v && typeof v==='object'?
 '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}':JSON.stringify(v);
const sha=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),v=>v.toString(16).padStart(2,'0')).join('');

export function validatePmBootScope(context,scope) {
 validateBridgeObserverContext(context);
 const p=context.arming,old=p.context.meta.target;
 const fields=['kind','job_id','plan_sha256','arming_intent_sha256','arming_proof_sha256','target','root_identity','processes',
  'pm_disabled','recovery_backup','bridge_disabled','canonical_scope_checked','memory_free_bytes','memory_total_bytes','context_only','device_writes'];
 if(keys(scope)!==fields.sort().join() || scope.kind!=='browser_bridge_boot_runtime_scope' ||
    scope.job_id!==context.job_id || scope.plan_sha256!==context.plan_sha256 || scope.arming_intent_sha256!==p.intent_sha256 ||
    scope.arming_proof_sha256!==context.arming_proof_sha256 || keys(scope.target)!==keys(old) ||
    typeof scope.target.boot_id!=='string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(scope.target.boot_id) ||
    scope.target.boot_id===old.boot_id || stable({...scope.target,boot_id:old.boot_id})!==stable(old) ||
    stable(scope.root_identity)!==stable(p.preparation.preparation.scope.root_identity) ||
    scope.pm_disabled!==true || scope.recovery_backup!==true || scope.bridge_disabled!==false || scope.canonical_scope_checked!==true ||
    scope.context_only!==true || scope.device_writes!==0 || keys(scope.processes)!=='child,stock,supervisor,watchdog' ||
    !Number.isSafeInteger(scope.memory_free_bytes) || !Number.isSafeInteger(scope.memory_total_bytes) ||
    scope.memory_free_bytes<8*1024**2 || scope.memory_free_bytes>scope.memory_total_bytes || scope.memory_total_bytes>2**40)fail();
 const processes=Object.values(scope.processes);
 for(const v of processes)if(!Array.isArray(v) || v.length!==3 || !Number.isInteger(v[0]) || v[0]<2 || v[0]>2147483647 ||
    !Number.isInteger(v[1]) || v[1]<1 || v[1]>2147483647 || typeof v[2]!=='string' || !/^[1-9][0-9]{0,19}$/.test(v[2]) || BigInt(v[2])>=2n**64n)fail();
 if(new Set(processes.map(v=>v[0])).size!==4 || scope.processes.child[1]!==scope.processes.supervisor[0] ||
    scope.processes.stock[1]!==scope.processes.watchdog[0])fail();
}

export async function pmNextBootCommand(context,scope,nonce,phase) {
 validatePmBootScope(context,scope);
 if(contract.schema_version!==1 || contract.maximum_body_bytes!==65536 || contract.source_commit!==context.arming.context.source_commit ||
    !['arm','complete'].includes(phase) || typeof nonce!=='string' || !hex.test(nonce) || nonce==='0'.repeat(32) ||
    nonce===context.arming.nonce || nonce===context.arming.context.meta.commit_nonce)fail();
 const meta=context.arming.context.meta;
 const values={plan_id:meta.descriptor.plan_id,plan_sha256:context.plan_sha256,nonce:context.arming.nonce,pm_nonce:nonce,
  commit_nonce:meta.commit_nonce,wlan_mac:scope.target.wlan_mac,boot_id:scope.target.boot_id,co2_type:String(scope.target.co2_type),
  root_device:String(scope.root_identity[0]),root_inode:String(scope.root_identity[1])};
 for(const [name,v] of Object.entries(scope.processes)){values[name+'_pid']=String(v[0]);values[name+'_birth']=v[2];}
 STAGE_ROLES.forEach(([role],i)=>{values['staged_sha_'+i]=meta.descriptor.files[role].sha256;});
 // Detach typed values before async digest work. No later caller mutation can
 // change a shell leaf or correlate a record with another plan/process boot.
 const body=`initial-pm-enable ${nonce} ${values.plan_id} ${values.plan_sha256} ${values.boot_id}\n`;
 const hashes=await Promise.all([sha(body),sha(values.plan_id+' '+values.plan_sha256+'\n'),
  sha(`arm ${values.nonce} ${values.plan_id} ${values.plan_sha256}\n`)]);
 [values.pm_owner_sha256,values.install_marker_sha256,values.arm_completion_sha256]=hashes;
 const parts=contract.templates[phase];if(!Array.isArray(parts))fail();
 const text='set -eu\n'+parts.map(part=>{
  if(typeof part==='string')return part;
  if(keys(part)!=='field' || typeof values[part.field]!=='string')fail();return values[part.field];
 }).join('');
 if(text.length>65536 || /[^\x09\x0a\x0d\x20-\x7e]/.test(text))fail();
 return text;
}
