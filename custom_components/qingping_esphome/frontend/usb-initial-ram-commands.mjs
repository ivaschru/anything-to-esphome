/** Pure finite first-trial RAM command assembly; no transport or execution.
 *
 * The private caller must retain its ORIGINAL consumed journal/lease and live
 * selected-channel capability. Neither the packet nor this text authorizes a
 * device write. Creation must later use sealed length/SHA-checked RAM stdin;
 * raw shell lines or a long ADB OPEN may execute a truncated command. Metadata,
 * bytes and image-FD admission still need independent post-transfer readback.
 */
import {initialRamContract as ram} from './usb-initial-ram-contract.mjs';
import {initialTrialContract as trial} from './usb-initial-trial-contract.mjs';
import {initialGuardianDescriptor} from './usb-initial-guardian-file.mjs';
import {validateInitialPreparation} from './usb-initial-trial-scope.mjs';
const fail=()=>{throw {code:'usb_browser_scope_unverified'};};
const fields=v=>v && typeof v==='object' && !Array.isArray(v)?Object.keys(v).sort().join():null;
const hex=v=>typeof v==='string' && /^[a-f0-9]{64}$/.test(v);

export function initialRamCommands(input,fresh) {
 const packetFields=['schema_version','job_id','plan_sha256','intent_sha256','channel_id','channel_nonce',
  'nonce','ram_job_id','guardian_job_id','context','preparation','producer_sha256'];
 const contextFields=['schema_version','job_id','plan_sha256','source_commit','commit_intent_sha256',
  'commit_proof_sha256','candidate_sha256','guardian','meta','committed_scope','context_only',
  'guardian_artifact_checked','image_fd_admitted','hardware_contacted','device_writes','writer_enabled',
  'installation_ready','live_recheck_required'];
 if(fields(input)!==packetFields.sort().join() || fields(input.context)!==contextFields.sort().join())fail();
 // Detach all leaves before they reach the generated literal templates. There
 // are no async operations/getters used after this snapshot, no eval and no
 // second substitution of a value as source text.
 let packet,observed;
 try {packet=JSON.parse(JSON.stringify(input));observed=JSON.parse(JSON.stringify(fresh));}catch{fail();}
 const c=packet.context;
 if(fields(packet)!==packetFields.sort().join() || fields(c)!==contextFields.sort().join() ||
    c.schema_version!==1 || c.job_id!==packet.job_id || c.plan_sha256!==packet.plan_sha256 ||
    ram.schema_version!==1 || ram.source_commit!==trial.source_commit || c.source_commit!==ram.source_commit ||
    ['commit_intent_sha256','commit_proof_sha256','candidate_sha256'].some(k=>!hex(c[k])) ||
    ['context_only','guardian_artifact_checked','live_recheck_required'].some(k=>c[k]!==true) ||
    ['image_fd_admitted','hardware_contacted','writer_enabled','installation_ready'].some(k=>c[k]!==false) ||
    c.device_writes!==0 || c.meta?.job_id!==packet.job_id || c.meta?.descriptor?.plan_sha256!==packet.plan_sha256 ||
    fields(packet.producer_sha256)!==[...ram.producer_files].sort().join() ||
    Object.values(packet.producer_sha256).some(v=>!hex(v)))fail();
 const descriptor=initialGuardianDescriptor(Object.fromEntries(
  ['schema_version','job_id','plan_sha256','intent_sha256','channel_id','channel_nonce',
   'nonce','ram_job_id','guardian_job_id'].map(k=>[k,packet[k]]).concat([['guardian',c.guardian]])));
 // The stored pre-intent observation cannot stand in for the new live one.
 // Both must match the same original terminal commit and process births.
 validateInitialPreparation(packet.preparation,c.meta,c.committed_scope);
 validateInitialPreparation(observed,c.meta,c.committed_scope);
 const scope=observed.scope,meta=c.meta,stock=scope.stock_process,parent=scope.watchdog_process;
 const values={plan_id:scope.plan_id,plan_sha256:scope.plan_sha256,root_device:String(scope.root_identity[0]),
  root_inode:String(scope.root_identity[1]),wlan_mac:meta.target.wlan_mac,co2_type:String(meta.target.co2_type),
  boot_id:meta.target.boot_id,stock_pid:String(stock[0]),stock_start:String(stock[1]),
  watchdog_pid:String(parent[0]),watchdog_start:String(parent[1]),commit_nonce:meta.commit_nonce,
  ram_job_id:descriptor.ram_job_id,guardian_job_id:descriptor.guardian_job_id,guardian_bytes:String(descriptor.guardian.size)};
 ram.staged_roles.forEach((role,i)=>{const v=meta.descriptor.files[role]?.sha256;if(!hex(v))fail();values['staged_'+i]=v;});
 if(scope.vendor_hashes.length!==ram.vendor_paths.length)fail();
 scope.vendor_hashes.forEach(([path,digest],i)=>{if(path!==ram.vendor_paths[i] || !hex(digest))fail();values['vendor_'+i]=digest;});
 return Object.freeze(Object.fromEntries(['create','inspect_roots','inspect_guardian'].map(name=>{
  const parts=ram.templates[name];if(!Array.isArray(parts))fail();
  const command=parts.map(part=>{
   if(typeof part==='string')return part;
   if(fields(part)!=='field' || typeof values[part.field]!=='string')fail();return values[part.field];
  }).join('');
  if(command.length>32768 || command.includes('QP_BROWSER_RAM_FIELD_') || !command.startsWith('set -eu\numask 077\n'))fail();
  return [name,command];
 })));
}
