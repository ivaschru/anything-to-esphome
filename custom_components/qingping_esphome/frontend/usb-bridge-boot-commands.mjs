/** Pure next-boot guard/text assembly; no IO, lease or launch authority.
 *
 * A future coordinator must require its original stopped trial journal, a NEW
 * positively selected channel/fresh scope and a separately consumed intent.
 * This JSON cannot supply any of those. Native trial receipts/get-devpath are
 * never fabricated. No disarm/reboot/start or generic command is exposed here.
 */
import {bridgeBootContract as boot} from './usb-bridge-boot-contract.mjs';
import {disabledContract as reader} from './usb-disabled-contract.mjs';
import {validateDisabledObservation} from './usb-disabled-commands.mjs';
const fail=()=>{throw {code:'usb_browser_scope_unverified'};};
const noncePattern=/^[a-f0-9]{32}$/;

/** Derived fixed AFTER-effects record, never a caller-supplied body/path. */
export async function bridgeBootCompletion(plan,sha,nonce) {
 if(typeof plan!=='string' || !noncePattern.test(plan) || typeof sha!=='string' || !/^[a-f0-9]{64}$/.test(sha) ||
    typeof nonce!=='string' || !noncePattern.test(nonce))fail();
 const body=new TextEncoder().encode(`arm ${nonce} ${plan} ${sha}\n`);
 return {size:body.byteLength,sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',body)),
  value=>value.toString(16).padStart(2,'0')).join('')};
}

export async function bridgeNextBootCommand(meta,scope,nonce,phase) {
 validateDisabledObservation(meta,scope);
 if(boot.schema_version!==1 || !['before','arm','armed','complete'].includes(phase) ||
    typeof nonce!=='string' || !noncePattern.test(nonce) ||
    typeof meta.commit_nonce!=='string' || !noncePattern.test(meta.commit_nonce) || nonce===meta.commit_nonce)fail();
 // Both vendor boot scripts must ALREADY be the exact committed-disabled
 // variants. A known factory/partial scope may be read but cannot be armed.
 for(const [path,pin] of Object.entries(reader.patched)) {
  if(scope.vendor_hashes.find(([name])=>name===path)?.[1]!==pin.sha256)fail();
 }
 const desc=meta.descriptor,stock=scope.stock_process,parent=scope.watchdog_process;
 const values={plan_id:desc.plan_id,plan_sha256:desc.plan_sha256,root_device:String(scope.root_identity[0]),
  root_inode:String(scope.root_identity[1]),wlan_mac:meta.target.wlan_mac,co2_type:String(meta.target.co2_type),
  boot_id:meta.target.boot_id,stock_pid:String(stock[0]),stock_start:String(stock[1]),
  watchdog_pid:String(parent[0]),watchdog_start:String(parent[1]),nonce};
 boot.staged_roles.forEach((role,i)=>{const pin=desc.files[role];if(!pin)fail();values['staged_'+i]=pin.sha256;});
 if(scope.vendor_hashes.length!==boot.vendor_paths.length)fail();
 scope.vendor_hashes.forEach(([path,pin],i)=>{if(path!==boot.vendor_paths[i])fail();values['vendor_'+i]=pin;});
 // Copy all typed values before this await. Concurrent changes to caller JSON
 // must not replace validated leaves during hashing or change a record's body.
 const pin=await bridgeBootCompletion(values.plan_id,values.plan_sha256,nonce);
 values.completion_size=String(pin.size);values.completion_sha256=pin.sha256;
 const parts=boot.templates[phase];
 if(!Array.isArray(parts))fail();
 const command=parts.map(part=>{
  if(typeof part==='string')return part;
  if(!part || Object.keys(part).join()!=='field' || typeof values[part.field]!=='string')fail();
  return values[part.field];
 }).join('');
 const literals=command.replace(/^# CGS1_BRIDGE_(?:NEXT_BOOT_SCOPE (?:disabled|backup_disabled|armed)|COMPLETION arm)$/gm,'').replace(/^# CGS1_INITIAL_ABSENT_STORES$/gm,'');
 if(command.length>32768 || literals.includes('CGS1_') || /[^\x09\x0a\x0d\x20-\x7e]/.test(command))fail();
 // These are the same per-process shell settings as native completed_write.
 // The eventual transport must use sealed stdin, not a long OPEN packet or
 // executable partial shell lines. Returning text does NOT consume an intent.
 return 'set -eu\numask 077\n'+command;
}
