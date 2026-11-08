/** Pure frozen guardian ABI and guarded text; no transport or execution.
 *
 * The caller still needs its original live RAM handoff, consumed journal and
 * new device checks. Matching JSON/readback cannot admit an image FD or grant
 * fork/exec. No service, path, duration, signal or caller command is accepted.
 */
import {initialGuardianContract as abi} from './usb-initial-guardian-contract.mjs';
import {initialTrialContract as trial} from './usb-initial-trial-contract.mjs';
import {initialRamCommands} from './usb-initial-ram-commands.mjs';
import {validateInitialPreparation} from './usb-initial-trial-scope.mjs';
import {validateInitialRamObservation} from './usb-initial-ram-observation.mjs';
const fail=()=>{throw {code:'usb_browser_scope_unverified'};};
const fields=v=>v && typeof v==='object' && !Array.isArray(v)?Object.keys(v).sort().join():null;
export function initialGuardianFrame(packet,fresh,ram) {
 try {[packet,fresh,ram]=JSON.parse(JSON.stringify([packet,fresh,ram]));}catch{fail();}
 initialRamCommands(packet,fresh); // Full typed source/owner/committed state, no IO.
 const expected=['kind','precreated','uploaded','preparation','transport_closed','guardian_started','image_fd_admitted','execution_authority','context_only'];
 if(fields(ram)!==expected.sort().join() || ram.kind!=='browser_initial_ram_ready' || ram.context_only!==true ||
    ['transport_closed','guardian_started','image_fd_admitted','execution_authority'].some(k=>ram[k]!==false) ||
    abi.schema_version!==1 || abi.source_commit!==trial.source_commit || abi.frame.length!==40 ||
    Object.entries(abi.source_sha256).some(([name,sha])=>trial.source_sha256[name]!==sha))fail();
 validateInitialPreparation(ram.preparation,packet.context.meta,packet.context.committed_scope);
 validateInitialRamObservation(ram.precreated,packet,false);
 validateInitialRamObservation(ram.uploaded,packet,true,ram.precreated);
 const scope=fresh.scope,meta=packet.context.meta,pin=packet.context.guardian,root=ram.uploaded;
 const values={plan_id:scope.plan_id,plan_sha256:scope.plan_sha256,commit_nonce:meta.commit_nonce,
  boot_id:meta.target.boot_id,wlan_mac:meta.target.wlan_mac,co2_type:String(meta.target.co2_type),
  root_device:String(scope.root_identity[0]),root_inode:String(scope.root_identity[1]),
  stock_pid:String(scope.stock_process[0]),stock_start:String(scope.stock_process[1]),
  watchdog_pid:String(scope.watchdog_process[0]),watchdog_start:String(scope.watchdog_process[1]),
  ram_job_id:packet.ram_job_id,ram_device:String(root.ram_root_identity[0]),ram_inode:String(root.ram_root_identity[1]),
  guardian_job_id:packet.guardian_job_id,guardian_device:String(root.guardian_root_identity[0]),guardian_inode:String(root.guardian_root_identity[1]),
  guardian_bytes:String(pin.size),guardian_sha256:pin.sha256,nonce:packet.nonce};
 abi.staged_roles.forEach((role,i)=>{
  const file=meta.descriptor.files[role];if(!file)fail();values[`staged_${i}_bytes`]=String(file.size);values[`staged_${i}_sha256`]=file.sha256;
 });
 const frame=abi.frame.map(part=>{
  if(typeof part==='string')return part;
  if(fields(part)!=='field' || typeof values[part.field]!=='string')fail();return values[part.field];
 });
 if(frame[0]!=='--bounded-first-bridge-v1' || frame.length!==40 || frame.some(v=>!/^[a-zA-Z0-9:_-]{1,128}$/.test(v)))fail();
 return Object.freeze(frame); // No path prefix, chmod, exec or transport action.
}


/** Pure guarded launch text for a future separate one-shot transport.
 * The whole body must be received and length/SHA checked before parsing. This
 * function itself performs no chmod/exec and grants no launch permission.
 * Before changing only the RAM guardian mode it repeats source/resources,
 * private roots and the exact original file inode/hash; the file pin repeats
 * after chmod. The device guardian must still admit its own and child FDs.
 */
export function initialGuardianLaunchBody(packet,fresh,ram) {
 try {[packet,fresh,ram]=JSON.parse(JSON.stringify([packet,fresh,ram]));}catch{fail();}
 const frame=initialGuardianFrame(packet,fresh,ram),values={};
 abi.frame.forEach((part,i)=>{if(typeof part!=='string')values[part.field]=frame[i];});
 values.guardian_file_inode=String(ram.uploaded.guardian_file_identity[1]);
 if(!Array.isArray(abi.vendor_paths) || fresh.scope.vendor_hashes.length!==abi.vendor_paths.length)fail();
 fresh.scope.vendor_hashes.forEach(([path,sha],i)=>{
  if(path!==abi.vendor_paths[i] || typeof sha!=='string' || !/^[a-f0-9]{64}$/.test(sha))fail();values['vendor_'+i]=sha;
 });
 if(!Array.isArray(abi.launch_template))fail();
 const body=abi.launch_template.map(part=>{
  if(typeof part==='string')return part;
  if(fields(part)!=='field' || typeof values[part.field]!=='string')fail();return values[part.field];
 }).join('');
 if(body.length>32768 || body.endsWith('\n') || /[^\x01-\x7f]/.test(body) || body.includes('CGS1_ABI_FIELD_') ||
    !body.startsWith('set -eu\numask 077\n') ||
    !body.endsWith('exec /tmp/qingping-initial-guardian-'+packet.guardian_job_id+'/program '+frame.join(' ')))fail();
 return body;
}
