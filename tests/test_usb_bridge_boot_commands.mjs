/** Exact canonical arming text/parity; scripts are parsed with sh -n ONLY. */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {bridgeNextBootCommand} from '../custom_components/qingping_esphome/frontend/usb-bridge-boot-commands.mjs';
import {disabledContract} from '../custom_components/qingping_esphome/frontend/usb-disabled-contract.mjs';
import {contract} from '../custom_components/qingping_esphome/frontend/usb-probe-contract.mjs';
const env={PATH:process.env.PATH};
const result=spawnSync('python3',['tests/fixtures/monitor1_browser_boot_commands.py'],{encoding:'utf8',env,maxBuffer:1024*1024,timeout:15000});
assert.equal(result.status,0,result.stderr);
const vectors=JSON.parse(result.stdout);assert.equal(vectors.length,16);
for(const v of vectors) {
 const text=await bridgeNextBootCommand(v.meta,v.scope,v.nonce,v.phase);
 assert.equal(text,v.expected,'Preserve the complete frozen canonical guard and correlated completion digest/size');
 assert(!/(^|\n)(?:kill |reboot|exec |LD_PRELOAD=)/.test(text));
 assert(!text.includes('\nrm /data/.esphome-cgs1/pm-helper.disabled'));
 if(v.phase==='arm') {
  const backup=text.indexOf(': > /data/.esphome-cgs1/disabled.before-next-boot');
  const unlink=text.indexOf('\nrm /data/.esphome-cgs1/disabled\n');
  const complete=text.indexOf('> /data/.esphome-cgs1/bridge-next-boot.complete');
  assert(backup>=0 && backup<unlink && unlink<complete);
  assert.equal(text.split('\nrm ').length,2,'Only the fixed verified empty bridge opt-out can be removed');
 } else assert(!text.includes('\nrm '));
 const parsed=spawnSync('/bin/sh',['-n'],{input:text,encoding:'utf8',env,timeout:5000});
 assert.equal(parsed.status,0,parsed.stderr);
}
const original=vectors[0];let refusals=0;
async function refused(edit) {
 const v=structuredClone(original);edit(v);
 await assert.rejects(bridgeNextBootCommand(v.meta,v.scope,v.nonce,v.phase),e=>e.code==='usb_browser_scope_unverified' && !e.message);
 refusals++;
}
for(const edit of [
 v=>{v.phase='disarm';},v=>{v.phase='reboot';},v=>{v.nonce="'; reboot";},
 v=>{v.nonce=v.meta.commit_nonce;},v=>{v.meta.commit_nonce=null;},
 v=>{v.meta.command='not allowed';},v=>{v.meta.target.usb_serial='bad\nserial';},
 v=>{v.scope.root_identity=[true,2];},v=>{v.scope.root_mode=0o777;},
 v=>{v.scope.own_code_running=true;},v=>{v.scope.pm_helper_loaded=true;},
 v=>{v.scope.data_available_bytes=1;},v=>{v.scope.source_hashes.pop();},
 v=>{v.scope.stock_process[0]=v.scope.watchdog_process[0];},
 v=>{v.scope.disabled_flags[0][5]=true;},v=>{v.scope.extra=true;},
 v=>{v.scope.stage_intent_sha256='0'.repeat(64);},
])await refused(edit);
for(const path of Object.keys(disabledContract.patched))await refused(v=>{
 v.scope.vendor_hashes.find(([name])=>name===path)[1]=contract.files.find(row=>row.path===path).sha256;
});
console.log(`16 canonical arming vectors and ${refusals} refusals passed; sh -n only, no IO or writer`);
