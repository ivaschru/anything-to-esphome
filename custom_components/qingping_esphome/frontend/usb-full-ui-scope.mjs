/** Fixed post-PM Full UI reader. No command, file or host selector is exposed.
 * This repeats the native Full UI USB adapter's identity/regular-image check;
 * authenticated inspect_start supplies its independent complete hardware gate.
 * Historical PM completion only proves which earlier attempt must not repeat.
 */
const fail=()=>{throw {code:'usb_browser_scope_unverified'};};
const fields=(v,n)=>v && typeof v==='object' && !Array.isArray(v) && Object.keys(v).sort().join()===n.slice().sort().join();
const hex=(v,n)=>typeof v==='string' && new RegExp('^[a-f0-9]{'+n+'}$').test(v);
const uuid=v=>typeof v==='string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const mac=v=>typeof v==='string' && /^[a-f0-9]{2}(?::[a-f0-9]{2}){5}$/.test(v) && v!=='00:00:00:00:00:00' && !(parseInt(v.slice(0,2),16)&1);
const producers=['browser_full_ui_context.py','full_ui_review.py','full_ui_trial.py','full_ui_activation.py'];
function pin(p) {return fields(p,['size','sha256']) && Number.isInteger(p.size) && p.size>0 && p.size<=16*1024**2 && hex(p.sha256,64);}
export function validateFullUiContext(c) {
 if(!fields(c,['schema_version','kind','job_id','plan_sha256','source_commit','pm_intent_sha256','pm_proof_sha256',
    'target','pm_armed_boot','api_identity','bridge','native_pair','producer_sha256','context_only','writer_enabled','device_writes']) ||
    c.schema_version!==1 || c.kind!=='browser_full_ui_context' || !hex(c.job_id,32) || !hex(c.plan_sha256,64) ||
    c.source_commit!=='53d97b9609e8e0fcdfc5d003101f620098dbc734' || !hex(c.pm_intent_sha256,64) || !hex(c.pm_proof_sha256,64) ||
    !uuid(c.pm_armed_boot) || c.context_only!==true || c.writer_enabled!==false || c.device_writes!==0 ||
    !fields(c.producer_sha256,producers) || !producers.every(n=>hex(c.producer_sha256[n],64)) || !pin(c.bridge) ||
    !fields(c.native_pair,['native-program','guardian-program']) || !Object.values(c.native_pair).every(pin) ||
    !fields(c.api_identity,['node_name','api_mac']) || typeof c.api_identity.node_name!=='string' ||
    !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(c.api_identity.node_name) || !mac(c.api_identity.api_mac))fail();
 const t=c.target;
 if(!fields(t,['kind','usb_serial','wlan_mac','boot_id','co2_type','stock_version']) || t.kind!=='browser_webusb' ||
    typeof t.usb_serial!=='string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(t.usb_serial) || !mac(t.wlan_mac) ||
    !uuid(t.boot_id) || t.boot_id===c.pm_armed_boot || ![2,3].includes(t.co2_type) || t.stock_version!=='4.1.8_0287')fail();
 return c;
}
export async function collectFullUiScope(backend,context,evidence) {
 const c=validateFullUiContext(context),t=c.target,e=evidence;
 if(!fields(e,['kind','channel','serial','wlan_mac','boot_id','co2_type','stock_version','native_get_devpath']) ||
    e.kind!=='browser_webusb' || e.boot_id===t.boot_id || e.native_get_devpath!==false || !uuid(e.channel) || !uuid(e.boot_id) ||
    e.serial!==t.usb_serial || e.wlan_mac!==t.wlan_mac || e.co2_type!==t.co2_type || e.stock_version!==t.stock_version)fail();
 if(await backend.identity()!==true)fail();
 const path='/data/.esphome-cgs1/program';
 // Verbatim command from canonical stage_install_adb.verify_remote_file,
 // with only its fixed bridge path. Independent metadata and digest checks.
 const command="test ! -L "+path+"\ntest -f "+path+"\nstat -c '%s %h' "+path+"\nsha256sum "+path;
 for(let pass=0;pass<2;pass++) {
  const value=await backend.read(command),lines=typeof value==='string'?value.split('\n'):[];
  if(lines.length!==2 || lines[0]!==c.bridge.size+' 1' ||
     ![c.bridge.sha256+'  '+path,c.bridge.sha256+' '+path].includes(lines[1]) || await backend.identity()!==true)fail();
 }
 return {kind:e.boot_id===c.pm_armed_boot?'browser_full_ui_waiting_for_pm_boot':'browser_full_ui_scope',
  job_id:c.job_id,plan_sha256:c.plan_sha256,pm_intent_sha256:c.pm_intent_sha256,pm_proof_sha256:c.pm_proof_sha256,
  target:{kind:'browser_webusb',usb_serial:e.serial,wlan_mac:e.wlan_mac,boot_id:e.boot_id,co2_type:e.co2_type,stock_version:e.stock_version},
  bridge_checked:true,context_only:true,device_writes:0};
}
