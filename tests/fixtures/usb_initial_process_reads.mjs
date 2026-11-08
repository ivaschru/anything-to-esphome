/** Synthetic ordered replies for the actual selected-channel read join.
 * Commands are never executed. Canonical byte parity is checked independently
 * in test_usb_initial_process_observation.mjs, not claimed by this emulator.
 */
import assert from 'node:assert/strict';
import {initialGuardianProcessReads} from '../../custom_components/qingping_esphome/frontend/usb-initial-process-observation.mjs';
export function initialProcessFixture(packet,ram,start,options={}) {
 const commands=initialGuardianProcessReads(packet,ram,start),keys=Object.keys(commands);
 const g=start.start.stamp,c=start.child.stamp,guard='/tmp/qingping-initial-guardian-'+packet.guardian_job_id+'/program';
 const bridge='/data/.esphome-cgs1/program',gp=packet.context.guardian,cp=packet.context.meta.descriptor.files['bridge-program'];
 const stat=(stamp,parent,path)=>{
  const fields=Array(20).fill('0');fields[0]='S';fields[1]=String(parent);fields[19]=stamp[1];
  return `${stamp[0]} (synthetic process) ${fields.join(' ')}\n0\n${path}`;
 };
 const file=(pin,path)=>`${pin.size} 1\n${pin.sha256}  ${path}`;
 const image=(pin,pid,device,inode)=>{
  const metadata=`${device} ${inode} ${pin.size} 700 0 1`;return metadata+'\n'+metadata+`\n${pin.sha256}  /proc/${pid}/exe`;
 };
 const child=`${c[0]} ${c[1]} S`,guardianProcess=stat(g,1,guard),childProcess=stat(c,g[0],bridge);
 const replies={child_before:child,guardian_process_before:guardianProcess,guardian_file:file(gp,guard),
  guardian_image:image(gp,g[0],...ram.uploaded.guardian_file_identity),guardian_process_after:guardianProcess,
  child_process_before:childProcess,child_file:file(cp,bridge),child_image:image(cp,c[0],packet.context.committed_scope.root_identity[0],104),
  child_process_after:childProcess,endpoint:'/proc/net/tcp 17A5\n/proc/net/tcp 0CA0',child_after:child};
 let count=0;
 return {read(command) {
  const key=keys[count%keys.length];
  if(command!==commands[key])return undefined;
  count++;
  if(options.unreadable && key==='guardian_image')throw Error('Synthetic unreadable process image');
  if(options.wrongImage && key==='guardian_image')return replies[key].replaceAll(' 102 ',' 999 ');
  if(options.noChild && key==='child_before')return '';
  assert.equal(typeof replies[key],'string');return replies[key];
 },get count(){return count;}};
}
