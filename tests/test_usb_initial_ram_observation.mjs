/** Fixed readback parser only; no USB, filesystem writes or ELF execution. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {initialRamPrecreated,initialGuardianReadback} from '../custom_components/qingping_esphome/frontend/usb-initial-ram-observation.mjs';
const vectors=JSON.parse(execFileSync(process.env.PYTHON||'python3',['tests/fixtures/monitor1_browser_initial_ram.py'],{encoding:'utf8',maxBuffer:1024*1024}));
const empty='e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
let refusals=0;
for(const {packet,preparation} of vectors) {
 const root='1 100 700 0\n1021994 16384 4096\n1 101 700 0\n1021994 16384 4096';
 const path='/tmp/qingping-initial-guardian-'+packet.guardian_job_id+'/program';
 const before={roots_before:root,guardian:'0 600 0 1 1 102\n'+empty+'  '+path,roots_after:root};
 const precreated=initialRamPrecreated(packet,preparation,before);
 assert.equal(precreated.phase,'precreated');assert.equal(precreated.guardian_size,0);
 const after={...before,guardian:packet.context.guardian.size+' 600 0 1 1 102\n'+packet.context.guardian.sha256+' '+path};
 const uploaded=initialGuardianReadback(packet,preparation,precreated,after);
 assert.equal(uploaded.phase,'uploaded');assert.equal(uploaded.guardian_size,packet.context.guardian.size);
 assert.equal(uploaded.image_fd_admitted,false);assert.equal(uploaded.execution_authority,false);
 assert.equal(Object.isFrozen(uploaded.guardian_file_identity),true);
 const reject=(change=()=>{},old=precreated)=>{
  const reads=structuredClone(after);change(reads);
  assert.throws(()=>initialGuardianReadback(packet,preparation,old,reads),v=>v.code==='usb_browser_scope_unverified');refusals++;
 };
 reject(v=>{v.roots_after=v.roots_after.replace('1 100','1 103');});
 reject(v=>{v.roots_after=v.roots_after.replace('1 101','1 104');});
 reject(v=>{v.roots_before=v.roots_before.replace('700','777');});
 reject(v=>{v.roots_before=v.roots_before.replace('1021994','ef53');});
 reject(v=>{v.roots_before=v.roots_before.replaceAll('16384','1');});
 reject(v=>{v.roots_before=v.roots_before.replaceAll('16384','999999999');});
 reject(v=>{v.roots_before+='\n';});
 reject(v=>{v.guardian=v.guardian.replace(' 1 1 102',' 2 1 102');});
 reject(v=>{v.guardian=v.guardian.replace(' 1 102',' 1 103');});
 reject(v=>{v.guardian=v.guardian.replace(' 600 0 ',' 600 1 ');});
 reject(v=>{v.guardian=v.guardian.replace(' 600 ',' 700 ');});
 reject(v=>{v.guardian=v.guardian.replace(packet.context.guardian.sha256,'0'.repeat(64));});
 reject(v=>{v.guardian=v.guardian.replace('/program','/different');});
 reject(v=>{v.guardian=v.guardian.replace(' '+path,'   '+path);});
 reject(v=>{v.extra=true;});
 for(const delta of [{phase:'uploaded'},{channel_id:'0'.repeat(32)},{intent_sha256:'0'.repeat(64)},
                    {ram_root_identity:[1,103]},{guardian_file_identity:[1,103]},{execution_authority:true},
                    {tmpfs_available_bytes:1},{extra:true}])reject(()=>{},{...precreated,...delta});
 reject(()=>{},null);
 assert.throws(()=>initialRamPrecreated(packet,preparation,after));
 // Free blocks may fluctuate independently; original roots/inodes may not.
 const lower={...after,roots_after:root.replaceAll('16384','8192')};
 assert.equal(initialGuardianReadback(packet,preparation,precreated,lower).tmpfs_available_bytes,32*1024*1024);
}
console.log(`Initial RAM readback: four vectors, ${refusals} metadata/root/hash/owner refusals, exact inode continuity; no device FD/exec authority or hardware`);
