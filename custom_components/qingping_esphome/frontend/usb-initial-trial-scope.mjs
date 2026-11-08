/** Fixed read-only preparation before allocating a first-trial RAM job.
 * Positive complete store/process/socket reads and conservative MemFree bracket
 * two fresh complete committed-disabled scopes. This does not inspect a RAM
 * job, admit an image FD or grant permission to create/upload/execute anything.
 */
import {initialTrialContract as initial} from './usb-initial-trial-contract.mjs';
import {disabledContract} from './usb-disabled-contract.mjs';
import {disabledScopeCommands} from './usb-disabled-scope.mjs';
import {validateDisabledObservation,stableDisabledScope} from './usb-disabled-commands.mjs';
const fail=()=>{throw {code:'usb_browser_scope_unverified'};};
const fields=value=>value && typeof value==='object' && !Array.isArray(value)?Object.keys(value).sort().join():null;

function memory(text) {
 if(typeof text!=='string')fail();
 const values={};
 for(const line of text.split('\n')) {
  const match=/^(MemTotal|MemFree):[ \t]+([0-9]+)[ \t]+kB$/.exec(line);
  if(!match || Object.hasOwn(values,match[1]))fail();
  const value=Number(match[2])*1024;
  if(!Number.isSafeInteger(value))fail();values[match[1]]=value;
 }
 if(fields(values)!==['MemFree','MemTotal'].sort().join() || values.MemFree<initial.minimum_start_ram ||
    values.MemTotal>2**40 || values.MemFree>values.MemTotal)fail();
 return values.MemFree; // No buffers/cache/swap or fabricated MemAvailable.
}

export async function collectInitialTrialPreparation(backend,input) {
 if(fields(backend)!==['read','identity','scope'].sort().join() || Object.values(backend).some(v=>typeof v!=='function'))fail();
 disabledScopeCommands(input);
 const meta=JSON.parse(JSON.stringify(input));
 if(typeof meta.commit_nonce!=='string' || !/^[a-f0-9]{32}$/.test(meta.commit_nonce))fail();
 const committed=async()=>{
  const observed=await backend.scope(meta);
  validateDisabledObservation(meta,observed);
  for(const [path,pin] of Object.entries(disabledContract.patched))
   if(observed.vendor_hashes.find(pair=>pair[0]===path)?.[1]!==pin.sha256)fail();
  return observed;
 };
 const resources=async scope=>{
  // A failed or partial listing/scan is refusal, never proof of absence.
  if(await backend.read(initial.reads.absent_stores)!=='' ||
     await backend.read(initial.reads.process_scan)!==String(scope.stock_process[0]) ||
     await backend.read(initial.reads.tcp4)!=='' || await backend.read(initial.reads.tcp6)!=='')fail();
  return memory(await backend.read(initial.reads.memory));
 };
 try {
  if(await backend.identity(meta.target)!==true)fail();
  const first=await committed(),before=await resources(first);
  const last=await committed(),after=await resources(last);
  if(stableDisabledScope(first)!==stableDisabledScope(last) || await backend.identity(meta.target)!==true)fail();
  return {kind:'browser_initial_trial_preparation',scope:last,ram_available_bytes:Math.min(before,after),
   memory_basis:'MemFree_lower_bound',persistent_stores_absent:true,ram_processes_absent:true,api_ota_listeners_free:true,
   ram_scope_checked:false,image_fd_admitted:false,execution_authority:false,device_writes:0};
 } catch {fail();}
}
