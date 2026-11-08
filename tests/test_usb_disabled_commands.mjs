/** Exact canonical-text parity and refusal tests; never execute the scripts. */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {disabledCommand} from '../custom_components/qingping_esphome/frontend/usb-disabled-commands.mjs';
const env={PATH:process.env.PATH};
const result=spawnSync('python3',['tests/fixtures/monitor1_browser_commands.py'],{encoding:'utf8',env,maxBuffer:1024*1024,timeout:15000});
assert.equal(result.status,0,result.stderr);
const vectors=JSON.parse(result.stdout);
assert.equal(vectors.length,12);
for(const v of vectors) {
 const command=disabledCommand(v.meta,v.scope,v.nonce,v.phase);
 assert.equal(command,v.expected,'Every guard/substitution/order must match frozen canonical code');
 assert(command.startsWith('set -eu\numask 077\n'));
 assert(command.length<32768);
 assert(!/(^|\n)(?:rm |kill |reboot|exec |LD_PRELOAD=)/.test(command),'No activation, cleanup or process control');
 // -n parses only: production-path commands and synthetic fixture scripts are
 // never executed. Root-owned rewritten Linux fixtures cover canonical CAS.
 const syntax=spawnSync('/bin/sh',['-n'],{input:command,encoding:'utf8',env,timeout:5000});
 assert.equal(syntax.status,0,syntax.stderr);
 if(v.phase!=='claim') {
  assert(command.indexOf('/bin/sh -n ')<command.lastIndexOf('\nmv '));
  assert(command.indexOf('\nsync\n')<command.lastIndexOf('\nmv '));
  assert.equal(command.split('\nmv ').length,2,'Exactly one fixed rename, no extra generic operation');
 } else assert(!command.includes('\nmv '));
}
const source=vectors[0];
function refused(change) {
 const v=structuredClone(source);change(v);
 assert.throws(()=>disabledCommand(v.meta,v.scope,v.nonce,v.phase),error=>error.code==='usb_browser_scope_unverified' && !error.message);
}
for(const change of [
 v=>{v.phase='rollback';},v=>{v.phase='complete';},v=>{v.nonce="'; reboot";},
 v=>{v.meta.command='arbitrary';},v=>{v.meta.commit_nonce=v.nonce;},v=>{v.meta.target.usb_serial="'; reboot";},
 v=>{v.scope.root_identity=[true,2];},v=>{v.scope.root_identity=[1,Number.MAX_SAFE_INTEGER+1];},
 v=>{v.scope.root_mode=0o777;},v=>{v.scope.root_uid=1;},v=>{v.scope.same_filesystem=1;},
 v=>{v.scope.data_available_bytes=1;},v=>{v.scope.own_code_running=null;},v=>{v.scope.pm_helper_loaded=0;},
 v=>{v.scope.disabled_flags[0][1]=false;},v=>{v.scope.source_hashes.pop();},v=>{v.scope.vendor_hashes.pop();},
 v=>{v.scope.vendor_hashes[0][1]='0'.repeat(64);},v=>{v.scope.vendor_hashes[0][0]='/other-file';},
 v=>{v.scope.stock_process[0]=v.scope.watchdog_process[0];},v=>{v.scope.stock_process[1]=1;},
 v=>{v.scope.watchdog_process[2]=true;},v=>{v.scope.target.boot_id='33333333-3333-3333-3333-333333333333';},
 v=>{v.scope.stage_intent_sha256='0'.repeat(64);},v=>{v.scope.commit_nonce=v.nonce;},
 v=>{v.scope.staged_files['bridge-program'].size=999;},v=>{v.scope.extra='not admitted';},
])refused(change);
// A next phase cannot adopt an arbitrary partial old transaction. All-known
// script variants are readable; only the exact predecessor fits each command.
for(const v of vectors.filter(v=>v.phase==='watchdog')) {
 assert.throws(()=>disabledCommand(v.meta,v.scope,v.nonce,'start'));
 const partial=structuredClone(vectors.find(c=>c.phase==='start').scope);
 assert.throws(()=>disabledCommand(v.meta,partial,v.nonce,'watchdog'));
}
// Key insertion order is not source identity. Byte output remains canonical.
const ordered=structuredClone(source);
ordered.meta.target=Object.fromEntries(Object.entries(ordered.meta.target).reverse());
assert.equal(disabledCommand(ordered.meta,ordered.scope,ordered.nonce,ordered.phase),source.expected);
console.log('12 frozen canonical command vectors, syntax-only parses and closed-field/phase refusals passed; no device IO');
