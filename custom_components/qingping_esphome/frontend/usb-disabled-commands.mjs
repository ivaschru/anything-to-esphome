/** Pure, finite disabled-commit script assembly; NO transport or device IO.
 *
 * The future caller must hold its independently consumed journal intent and
 * native-install lease, and obtain this scope from the original live selected
 * channel. JSON and generated shell text confer none of those permissions.
 * Only claim -> watchdog -> start is described here. There is no caller path,
 * shell/operation body, automatic rollback, launch, boot change or retry.
 */
import {disabledWriteContract as writes} from './usb-disabled-write-contract.mjs';
import {disabledContract as reader} from './usb-disabled-contract.mjs';
import {contract} from './usb-probe-contract.mjs';
import {disabledScopeCommands} from './usb-disabled-scope.mjs';
const fail=()=>{throw {code:'usb_browser_scope_unverified'};};
const hex=/^[a-f0-9]{64}$/,noncePattern=/^[a-f0-9]{32}$/;
const empty='e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const start='/data/etc/init.d/start.sh',watchdog='/data/bin/watchdog.sh';
const keys=value=>value && typeof value==='object' && !Array.isArray(value)?Object.keys(value).sort().join():null;
// Stable structural comparison admits ordinary JSON key order without hiding
// missing/extra leaves. No input is executed, reparsed as code or substituted
// a second time into the generated command.
function stable(value) {
 if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
 if(value && typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';
 return JSON.stringify(value);
}
const same=(a,b)=>stable(a)===stable(b);
const numeric=(v,min=1,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(v) && v>=min && v<=max;

export function disabledCommand(meta,scope,nonce,phase) {
 // Reuse the exact fixed reader metadata validation, including all nine source
 // pins, safe identity values and complete original marker/boot bindings.
 disabledScopeCommands(meta);
 if(!['claim','watchdog','start'].includes(phase) || typeof nonce!=='string' || !noncePattern.test(nonce) ||
    (phase==='claim'?meta.commit_nonce!==null:meta.commit_nonce!==nonce))fail();
 const fields=['kind','target','plan_id','plan_sha256','stage_intent_sha256','root_identity','install_marker',
  'root_mode','root_uid','disabled_flags','source_hashes','vendor_hashes','stock_process','watchdog_process',
  'own_code_running','pm_helper_loaded','data_available_bytes','same_filesystem','staged_files','commit_nonce'];
 const desc=meta.descriptor;
 if(keys(scope)!==fields.sort().join() || scope.kind!=='browser_disabled_scope' || !same(scope.target,meta.target) ||
    scope.plan_id!==desc.plan_id || scope.plan_sha256!==desc.plan_sha256 || scope.stage_intent_sha256!==desc.intent_sha256 ||
    scope.install_marker!==desc.plan_id+' '+desc.plan_sha256 || scope.root_mode!==0o700 || scope.root_uid!==0 ||
    !same(scope.staged_files,desc.files) || scope.commit_nonce!==meta.commit_nonce ||
    scope.own_code_running!==false || scope.pm_helper_loaded!==false || scope.same_filesystem!==true ||
    !numeric(scope.data_available_bytes,8*1024*1024) || !Array.isArray(scope.root_identity) || scope.root_identity.length!==2 ||
    !scope.root_identity.every(v=>numeric(v)) || !same(scope.disabled_flags,[[empty,0,0o600,0,1,false],[empty,0,0o600,0,1,false]]) ||
    !same(scope.source_hashes,Object.entries(reader.sources).sort(([a],[b])=>a<b?-1:a>b?1:0)))fail();
 const stock=scope.stock_process,parent=scope.watchdog_process;
 if(!Array.isArray(stock) || stock.length!==4 || !Array.isArray(parent) || parent.length!==3 ||
    !numeric(stock[0],2,2147483647) || !numeric(parent[0],2,2147483647) || stock[0]===parent[0] ||
    !numeric(stock[1],2) || !numeric(parent[1],2) || stock[3]!==0 || parent[2]!==0 ||
    stock[2]!==contract.files.find(v=>v.path==='/data/bin/SnowApp').sha256)fail();
 const vendors=scope.vendor_hashes;
 if(!Array.isArray(vendors) || vendors.length!==writes.vendor_paths.length ||
    vendors.some((v,i)=>!Array.isArray(v) || v.length!==2 || v[0]!==writes.vendor_paths[i] || typeof v[1]!=='string' || !hex.test(v[1])))fail();
 // A known partial forward state may be read, but only this exact previous
 // acknowledgement's combination belongs to the proposed next phase. This
 // generator never infers completion or finishes a partial old transaction.
 for(const [path,digest] of vendors) {
  const factory=contract.files.find(v=>v.path===path)?.sha256;
  const expected=phase==='start' && path===watchdog?reader.patched[watchdog].sha256:factory;
  if(!factory || digest!==expected)fail();
 }
 if(!writes.vendor_paths.includes(start) || !writes.vendor_paths.includes(watchdog) || writes.schema_version!==1)fail();
 const values={plan_id:desc.plan_id,plan_sha256:desc.plan_sha256,root_device:String(scope.root_identity[0]),
  root_inode:String(scope.root_identity[1]),wlan_mac:meta.target.wlan_mac,co2_type:String(meta.target.co2_type),
  boot_id:meta.target.boot_id,stock_pid:String(stock[0]),stock_start:String(stock[1]),
  watchdog_pid:String(parent[0]),watchdog_start:String(parent[1]),nonce};
 writes.staged_roles.forEach((role,i)=>{const value=desc.files[role]?.sha256;if(typeof value!=='string' || !hex.test(value))fail();values['staged_'+i]=value;});
 vendors.forEach(([,digest],i)=>{values['vendor_'+i]=digest;});
 const parts=writes.templates[phase];
 if(!Array.isArray(parts))fail();
 const command=parts.map(part=>{
  if(typeof part==='string')return part;
  if(keys(part)!=='field' || typeof values[part.field]!=='string')fail();
  return values[part.field];
 }).join('');
 // The native completed_write wrapper supplies these same process-local
 // settings. Keep them in every emitted body: shell sessions share no umask.
 // A future old-adbd transport must stream the bounded body over one owned
 // fixed sh stdin, not assume its entire text fits the OPEN service packet.
 if(command.length>32768 || command.includes('CGS1_'))fail();
 return 'set -eu\numask 077\n'+command;
}
