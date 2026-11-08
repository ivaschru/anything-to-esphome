/** Independent fixed readback parsing, not device image-FD admission.
 *
 * The future selected-channel caller must read roots BEFORE and AFTER the
 * fixed file stat/SHA read. It must preserve the actual live capability and
 * consumed journal lease. These detached observations cannot recreate either.
 * SYNC OKAY, matching bytes at a different inode, and a file named complete
 * cannot substitute for these reads or authorize chmod/exec/cleanup.
 */
import {initialRamCommands} from './usb-initial-ram-commands.mjs';
import {digestLineMatches} from './usb-file-observation.mjs';
const fail=()=>{throw {code:'usb_browser_scope_unverified'};};
const fields=v=>v && typeof v==='object' && !Array.isArray(v)?Object.keys(v).sort().join():null;
const empty='e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const reserve=8*1024*1024;
function number(text,minimum=0,maximum=Number.MAX_SAFE_INTEGER) {
 if(typeof text!=='string' || !/^(0|[1-9][0-9]*)$/.test(text))fail();
 const value=Number(text);if(!Number.isSafeInteger(value) || value<minimum || value>maximum)fail();return value;
}
function roots(text,budget) {
 if(typeof text!=='string' || text.length>1024)fail();
 const lines=text.split('\n');if(lines.length!==4)fail();
 const identities=[],available=[];
 for(let i=0;i<2;i++) {
  const stat=lines[i*2].split(' '),fs=lines[i*2+1].split(' ');
  if(stat.length!==4 || stat[2]!=='700' || stat[3]!=='0' || fs.length!==3 || fs[0]!=='1021994')fail();
  identities.push([number(stat[0],1),number(stat[1],1)]);
  const blocks=number(fs[1]),size=number(fs[2],512,65536),free=blocks*size;
  if(!Number.isSafeInteger(free) || free>2147483647 || free<budget)fail();available.push(free);
 }
 if(identities[0][0]!==identities[1][0] || identities[0][1]===identities[1][1])fail();
 return {identities,available:Math.min(...available)};
}
const same=(a,b)=>a.length===b.length && a.every((v,i)=>v===b[i]);
const observationFields=['kind','phase','job_id','plan_sha256','intent_sha256','channel_id','channel_nonce',
 'nonce','ram_job_id','guardian_job_id','ram_root_identity','guardian_root_identity','guardian_file_identity',
 'guardian_size','guardian_sha256','tmpfs_available_bytes','image_fd_admitted','execution_authority','context_only'];
function readback(packet,fresh,reads,previous) {
 initialRamCommands(packet,fresh); // Exact original packet/source/fresh committed preparation check; no IO.
 if(fields(reads)!==['roots_before','guardian','roots_after'].sort().join())fail();
 const uploaded=previous!==null,pin=packet.context.guardian,budget=reserve+(uploaded?0:pin.size);
 const first=roots(reads.roots_before,budget),last=roots(reads.roots_after,budget);
 if(first.identities.some((value,i)=>!same(value,last.identities[i])))fail();
 const size=uploaded?pin.size:0,sha=uploaded?pin.sha256:empty;
 if(typeof reads.guardian!=='string' || reads.guardian.length>1024)fail();
 const lines=reads.guardian.split('\n'),stat=lines[0].split(' ');
 const path='/tmp/qingping-initial-guardian-'+packet.guardian_job_id+'/program';
 if(lines.length!==2 || stat.length!==6 || number(stat[0])!==size || stat[1]!=='600' || stat[2]!=='0' ||
    stat[3]!=='1' || !digestLineMatches(lines[1],sha,path))fail();
 const identity=[number(stat[4],1),number(stat[5],1)];
 if(identity[0]!==first.identities[1][0] || identity[1]===first.identities[0][1] || identity[1]===first.identities[1][1])fail();
 const binding=Object.fromEntries(['job_id','plan_sha256','intent_sha256','channel_id','channel_nonce','nonce','ram_job_id','guardian_job_id'].map(k=>[k,packet[k]]));
 if(uploaded) {
  if(fields(previous)!==observationFields.sort().join() || previous.kind!=='browser_initial_ram_observation' ||
     previous.phase!=='precreated' || previous.guardian_size!==0 || previous.guardian_sha256!==empty ||
     previous.context_only!==true || previous.image_fd_admitted!==false || previous.execution_authority!==false ||
     Object.entries(binding).some(([k,v])=>previous[k]!==v) ||
     !Array.isArray(previous.ram_root_identity) || !Array.isArray(previous.guardian_root_identity) ||
     !Array.isArray(previous.guardian_file_identity) ||
     !same(previous.ram_root_identity,first.identities[0]) || !same(previous.guardian_root_identity,first.identities[1]) ||
     !same(previous.guardian_file_identity,identity) || !Number.isSafeInteger(previous.tmpfs_available_bytes) ||
     previous.tmpfs_available_bytes<reserve+pin.size || previous.tmpfs_available_bytes>2147483647)fail();
 }
 return Object.freeze({kind:'browser_initial_ram_observation',phase:uploaded?'uploaded':'precreated',...binding,
  ram_root_identity:Object.freeze(first.identities[0]),guardian_root_identity:Object.freeze(first.identities[1]),
  guardian_file_identity:Object.freeze(identity),guardian_size:size,guardian_sha256:sha,
  tmpfs_available_bytes:Math.min(first.available,last.available),
  image_fd_admitted:false,execution_authority:false,context_only:true});
}
export function initialRamPrecreated(packet,fresh,reads) {return readback(packet,fresh,reads,null);}
export function initialGuardianReadback(packet,fresh,previous,reads) {
 if(previous===null || previous===undefined)fail();return readback(packet,fresh,reads,previous);
}
