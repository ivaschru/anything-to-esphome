/** Stateful synthetic source/daemon for the real selected-channel composition.
 * Commands are compared as text; no shell, USB or vendor executable is run.
 */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {BrowserNativeChannel} from '../../custom_components/qingping_esphome/frontend/usb-native-channel.mjs';
import {disabledScopeCommands} from '../../custom_components/qingping_esphome/frontend/usb-disabled-scope.mjs';
import {disabledStreamService} from '../../custom_components/qingping_esphome/frontend/usb-disabled-stream.mjs';
import {disabledCommand} from '../../custom_components/qingping_esphome/frontend/usb-disabled-commands.mjs';
import {disabledContract} from '../../custom_components/qingping_esphome/frontend/usb-disabled-contract.mjs';
import {initialTrialContract} from '../../custom_components/qingping_esphome/frontend/usb-initial-trial-contract.mjs';
import {contract} from '../../custom_components/qingping_esphome/frontend/usb-probe-contract.mjs';
import {STAGE_ROLES} from '../../custom_components/qingping_esphome/frontend/usb-stage-files.mjs';
const loaded=spawnSync('python3',['tests/fixtures/monitor1_browser_commands.py'],{encoding:'utf8',env:{PATH:process.env.PATH},maxBuffer:1024*1024,timeout:15000});
assert.equal(loaded.status,0,loaded.stderr);const vector=JSON.parse(loaded.stdout)[0];
const encoder=new TextEncoder(),sha=body=>createHash('sha256').update(body).digest('hex');
const base='/data/.esphome-cgs1',phases=['claim','watchdog','start'];
function processStat(pid,parent,start) {
 const fields=Array.from({length:20},()=> '0');fields[0]='S';fields[1]=String(parent);fields[19]=String(start);
 return `${pid} (synthetic process) ${fields.join(' ')}\n0\n${pid===50?'/data/bin/SnowApp':'/bin/busybox'}`;
}
export function disabledTransport(options={},NativeChannel=BrowserNativeChannel) {
 const meta=structuredClone(vector.meta),initial=structuredClone(vector.scope),nonce=vector.nonce;
 let effects=options.initialEffects??(options.committed?3:0),picked=0,closed=0,currentPacket,rootReads=0;
 const rawBodies=[],readCommands=[],rawSockets=[];
 const plain=disabledScopeCommands(meta),locked=disabledScopeCommands({...meta,commit_nonce:nonce});
 function observed() {
  const value=structuredClone(initial);value.commit_nonce=effects?nonce:null;
  for(const pair of value.vendor_hashes)
   if(effects>=2 && pair[0]==='/data/bin/watchdog.sh' || effects===3 && pair[0]==='/data/etc/init.d/start.sh')pair[1]=disabledContract.patched[pair[0]].sha256;
  return value;
 }
 function read(command) {
  readCommands.push(command);
  if(options.customRead){const value=options.customRead(command);if(value!==undefined)return value;}
  if(Object.values(initialTrialContract.reads).includes(command)) {
   if(options.initialRead)return options.initialRead(command);
   return command===initialTrialContract.reads.memory?'MemTotal: 131072 kB\nMemFree: 65536 kB':
    command===initialTrialContract.reads.process_scan?'50':'';
  }
  for(const [index,c] of [plain,locked].entries()) {
   if(index && !effects && command.startsWith(c.guard))throw Error('synthetic lock absent');
   if(command===c.root){rootReads++;return '1 '+(options.changedRootAfter && effects>=options.changedRootAfter?'3':'2')+' 700 0';}
   if(command===c.entries)return [...STAGE_ROLES.map(([,leaf])=>leaf),'install.intent','disabled','pm-helper.disabled',...(effects?['.commit-disabled.lock']:[])].join('\n');
   if(command===c.sideEntries)return 'complete\nintent';
   if(c.lockEntries && command===c.lockEntries)return 'owner';
   if(command===c.parents)return '1\n1';
   if(command===c.stage.inspectComplete)return sha(c.stage.afterBytes)+'  /data/.esphome-cgs1-stage/complete';
   for(const [role,leaf] of STAGE_ROLES)if(command===c.stage.inspect(role)) {
    const pin=meta.descriptor.files[role],mode=['bridge-program','launch.sh','SnowApp-with-PM'].includes(role)?'700':'600';
    return `${pin.size} 1 0 ${mode}\n${pin.sha256}  ${base}/${leaf}`;
   }
   if(command===c.process(50))return processStat(50,51,100);
   if(command===c.process(51))return processStat(51,1,110);
   if(command===c.watchdog(51) || command===c.maps(50))return '';
  }
  for(const file of contract.files)if(command===file.command) {
   const patched=effects>=2 && file.path==='/data/bin/watchdog.sh' || effects===3 && file.path==='/data/etc/init.d/start.sh';
   const pin=patched?disabledContract.patched[file.path]:file;return `${pin.size} 1\n${pin.sha256}  ${file.path}`;
  }
  if(command===disabledContract.process_scan)return '50';
  if(command==="stat -f -c '%t %a %S' /data")return 'ef53 8192 4096';
  assert.fail('Only fixed collector reads are accepted by the fixture');
 }
 const identity={uid:'0',wlan_mac:meta.target.wlan_mac,version:'CLEARGRASS_VERSION=4.1.8_0287',arch:'armv7l',
  co2_type:String(meta.target.co2_type),boot_id:meta.target.boot_id};
 const client={close:async()=>{closed++;for(const socket of rawSockets)await socket.close();if(options.closeLoss)throw Error('synthetic close loss');},createSocket:async service=>{
  if(service.startsWith('exec:/bin/sh -c ')) {
   const framing={size:Number(service.match(/count=([0-9]+)/)[1]),sha256:service.match(/[a-f0-9]{64}/)[0],marker:service.match(/__CGS1_FIXED_OK_[a-f0-9]{32}__/)[0]};
   assert.equal(service,disabledStreamService(framing));
   if(options.unsupported)throw Error('synthetic unsupported exec');
   let output,resolve,reject,ended=false,ownedClosed=false,body='';
   const completion=new Promise((a,b)=>{resolve=a;reject=b;});completion.catch(()=>{});
   const socket={service,closed:completion,readable:new ReadableStream({start(c){output=c;},cancel(){ended=true;resolve();}}),
    writable:new WritableStream({write(bytes){
     assert(bytes.length<=4096);body+=new TextDecoder().decode(bytes);
     if(body.length===framing.size) {
      assert.equal(sha(body),framing.sha256);
      const marker=framing.marker;let prefix='';
      if(body.includes('CGS1_FIXED_STDIN_READY'))prefix='CGS1_FIXED_STDIN_READY\n';
      else if(options.rawCommand)options.rawCommand(body);
      else {
       const phase=phases[effects];assert(phase);const before=observed();
       assert(body.startsWith(disabledCommand({...meta,commit_nonce:effects?nonce:null},before,nonce,phase)));
       effects++;
      }
      rawBodies.push(body);output.enqueue(encoder.encode(prefix+'\n'+marker+'\n'));output.close();ended=true;
      if(options.ackLossAfter===effects && !prefix)reject(Error('synthetic lost remote CLSE'));else resolve();
     }
    },close(){assert.fail('No premature stdin EOF');}}),close:async()=>{if(ownedClosed)return;ownedClosed=true;
     if(!ended){output.close();ended=true;}resolve();
    }};
   rawSockets.push(socket);return socket;
  }
  if(service==='sync:' && options.syncSocket)return options.syncSocket();
  assert(service.startsWith('shell:set -e\n'),'No TCP/SYNC/shell-v2 or arbitrary service');
  const marker=service.match(/__CGS1_CHANNEL_OK_[a-f0-9]+__/)[0];
  const command=service.slice('shell:set -e\n'.length,service.lastIndexOf('\nprintf '));
  const step=contract.identity.find(v=>v.command===command),body=step?identity[step.name]:read(command);
  return {readable:new ReadableStream({start(c){c.enqueue(encoder.encode(body+'\n'+marker+'\n'));c.close();}}),close:async()=>{}};
 }};
 const link=new NativeChannel({manager:{requestDevice:()=>{picked++;return Promise.resolve({serial:meta.target.usb_serial,connect:async()=>({})});}},
  authenticate:async()=>({}),createClient:()=>client,ephemeralCredentials:()=>({}),
  createSyncSocket:socket=>socket,pushV1:request=>{assert(options.pushV1);return options.pushV1(request);}},contract);
 return {link,meta,initial,rawBodies,readCommands,packet(){
  const evidence=link.evidence();
  currentPacket={schema_version:1,job_id:meta.job_id,plan_sha256:meta.descriptor.plan_sha256,intent_sha256:'1'.repeat(64),
   channel_id:'e'.repeat(32),channel_nonce:evidence.channel,nonce,source_commit:'53d97b9609e8e0fcdfc5d003101f620098dbc734',
   meta,initial_scope:initial,producer_sha256:{'browser_commit.py':'2'.repeat(64),'disabled-write-contract.json':'3'.repeat(64)}};
  return structuredClone(currentPacket);
 },get picked(){return picked;},get closed(){return closed;},get effects(){return effects;},get rootReads(){return rootReads;}};
}
