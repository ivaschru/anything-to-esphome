/** Pure fixed read-only kernel child/image/socket observation subset.
 *
 * All scripts come from frozen native readers. Typed packet/RAM/start context
 * can expand only fixed PIDs and a bound guardian job name, never a caller path
 * or shell. No transport is opened here. Reported/read JSON is not a live
 * channel, image-FD admission, stock/Noise proof or terminal trial permission.
 */
import {initialProcessContract as contract} from './usb-initial-process-contract.mjs';
import {initialTrialContract} from './usb-initial-trial-contract.mjs';
import {initialGuardianFrame} from './usb-initial-guardian-frame.mjs';
import {initialGuardianRecord} from './usb-initial-guardian-records.mjs';
const fail=()=>{throw {code:'usb_browser_scope_unverified'};};
const keys=['child_before','guardian_process_before','guardian_file','guardian_image','guardian_process_after',
 'child_process_before','child_file','child_image','child_process_after','endpoint','child_after'];
const fields=v=>v && typeof v==='object' && !Array.isArray(v)?Object.keys(v).sort().join():null;
const copy=value=>{try{return JSON.parse(JSON.stringify(value));}catch{fail();}};
const equal=(a,b)=>a.length===b.length && a.every((v,i)=>v===b[i]);
function decimal(value,min=1n,max=(1n<<64n)-1n) {
 if(typeof value!=='string' || !/^(0|[1-9][0-9]*)$/.test(value) || value.length>20)fail();
 const parsed=BigInt(value);if(parsed<min || parsed>max)fail();return value;
}
function started(packet,ram,value) {
 initialGuardianFrame(packet,ram?.preparation,ram); // Full original typed context; no IO/launch.
 if(fields(value)!==['kind','start','child','records_only'].sort().join() ||
    value.kind!=='browser_initial_guardian_started_record' || value.records_only!==true)fail();
 for(const kind of ['start','child']) {
  const r=value[kind];
  if(fields(r)!==['kind','nonce','stamp'].sort().join() || r.kind!==kind || r.nonce!==packet.nonce ||
     !Array.isArray(r.stamp) || r.stamp.length!==2 || !Number.isInteger(r.stamp[0]) || typeof r.stamp[1]!=='string')fail();
  const line=`CGS1_TRIAL_${kind.toUpperCase()}_V1 ${packet.nonce} ${r.stamp[0]} ${r.stamp[1]}\n`;
  initialGuardianRecord(line,packet.nonce,kind==='child'?value.start.stamp:null);
 }
 const forbidden=new Set([packet.context.committed_scope.stock_process[0],packet.context.committed_scope.watchdog_process[0]]);
 if(forbidden.has(value.start.stamp[0]) || forbidden.has(value.child.stamp[0]))fail();
 if(contract.schema_version!==1 || contract.source_commit!==initialTrialContract.source_commit ||
    Object.entries(contract.source_sha256).some(([name,sha])=>initialTrialContract.source_sha256[name]!==sha) ||
    contract.reads.length!==keys.length || contract.reads.some((r,i)=>r.key!==keys[i]))fail();
}

export function initialGuardianProcessReads(input,ramInput,startInput) {
 const [packet,ram,start]=copy([input,ramInput,startInput]);started(packet,ram,start);
 const values={guardian_pid:String(start.start.stamp[0]),child_pid:String(start.child.stamp[0]),guardian_job_id:packet.guardian_job_id};
 const reads=Object.fromEntries(contract.reads.map(({key,parts})=>[key,parts.map(part=>{
  if(typeof part==='string')return part;
  if(fields(part)!=='field' || typeof values[part.field]!=='string')fail();return values[part.field];
 }).join('')]));
 if(Object.values(reads).some(v=>v.length>8192 || /[^\x01-\x7f]/.test(v)))fail();
 return Object.freeze(reads); // No callback/transport/body selector crosses a frame.
}

function lines(value) {
 if(typeof value!=='string' || !value.length || value.length>65536 || /[^\x01-\x7f]/.test(value))fail();
 if(value.endsWith('\r\n'))value=value.slice(0,-2);
 else if(value.endsWith('\n'))value=value.slice(0,-1);
 const result=value.split(/\r?\n/);if(result.some(v=>!v.length || v.includes('\r')))fail();return result;
}
function process(value,stamp,path,parent=null) {
 const reply=lines(value);if(reply.length!==3 || reply[1]!=='0' || reply[2]!==path)fail();
 const row=reply[0],left=row.indexOf('('),right=row.lastIndexOf(') ');
 if(left<1 || right<=left || row.slice(0,left)!==String(stamp[0])+' ')fail();
 const tokens=row.slice(right+2).split(' ');
 if(tokens.length<20 || tokens.length>128 || !/^[RSDI]$/.test(tokens[0]))fail();
 const p=Number(decimal(tokens[1],1n,2147483647n)),birth=decimal(tokens[19]);
 if(birth!==stamp[1] || parent!==null && p!==parent)fail();return [stamp[0],p,birth];
}
function child(value,expected) {
 const reply=lines(value);
 if(reply.length!==1)fail();
 const row=reply[0].split(' ');
 if(row.length!==3 || !/^[RSDI]$/.test(row[2]) || Number(decimal(row[0],2n,2147483647n))!==expected[0] || decimal(row[1])!==expected[1])fail();
}
function digest(line,sha,path) {if(line!==sha+' '+path && line!==sha+'  '+path)fail();}
function image(reads,prefix,stamp,path,pin,device,inode=null) {
 const file=lines(reads[prefix+'_file']);
 if(file.length!==2 || file[0]!==pin.size+' 1')fail();digest(file[1],pin.sha256,path);
 const executable=lines(reads[prefix+'_image']);
 if(executable.length!==3 || executable[0]!==executable[1])fail();
 const meta=executable[0].split(' ');
 if(meta.length!==6 || meta.slice(2).join(' ')!==pin.size+' 700 0 1' || decimal(meta[0])!==String(device))fail();
 decimal(meta[1]);if(inode!==null && meta[1]!==String(inode))fail();
 digest(executable[2],pin.sha256,'/proc/'+stamp[0]+'/exe');
 return Object.freeze(meta.slice(0,2));
}

export function initialGuardianProcessObservation(input,ramInput,startInput,observedInput) {
 const [packet,ram,start,reads]=copy([input,ramInput,startInput,observedInput]);started(packet,ram,start);
 if(fields(reads)!==[...keys].sort().join())fail();
 const guardian=start.start.stamp,c=start.child.stamp,guard='/tmp/qingping-initial-guardian-'+packet.guardian_job_id+'/program';
 const bridge='/data/.esphome-cgs1/program';
 child(reads.child_before,c);
 const gp=process(reads.guardian_process_before,guardian,guard),cp=process(reads.child_process_before,c,bridge,guardian[0]);
 const guardImage=image(reads,'guardian',guardian,guard,packet.context.guardian,...ram.uploaded.guardian_file_identity);
 const bridgeImage=image(reads,'child',c,bridge,packet.context.meta.descriptor.files['bridge-program'],packet.context.committed_scope.root_identity[0]);
 if(!equal(gp,process(reads.guardian_process_after,guardian,guard)) || !equal(cp,process(reads.child_process_after,c,bridge,guardian[0])))fail();
 const endpoints=lines(reads.endpoint);
 if(endpoints.length<2 || endpoints.length>4 || new Set(endpoints).size!==endpoints.length ||
    endpoints.some(v=>!/^\/proc\/net\/tcp6? (17A5|0CA0)$/.test(v)) ||
    new Set(endpoints.map(v=>v.split(' ')[1])).size!==2)fail();
 child(reads.child_after,c);
 const binding=Object.fromEntries(['job_id','plan_sha256','intent_sha256','channel_id','channel_nonce','nonce','ram_job_id','guardian_job_id'].map(k=>[k,packet[k]]));
 return Object.freeze({kind:'browser_initial_process_observation',...binding,
  guardian:Object.freeze(guardian),child:Object.freeze(c),guardian_parent:gp[1],guardian_image:guardImage,child_image:bridgeImage,
  kernel_child_checked:true,process_images_checked:true,endpoint_ownership_checked:true,
  image_fd_admitted:false,execution_authority:false,context_only:true});
}
