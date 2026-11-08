import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {BrowserNativeChannel as Raw} from '../custom_components/qingping_esphome/frontend/usb-native-channel.mjs';
import {BrowserChannelPeer} from '../custom_components/qingping_esphome/frontend/usb-channel-peer.mjs';
import {openBrowserFullUiControl} from '../custom_components/qingping_esphome/frontend/usb-browser-control.mjs';
import {validateFullUiContext,fullUiIpv4} from '../custom_components/qingping_esphome/frontend/usb-full-ui-scope.mjs';
const original='11111111-1111-4111-8111-111111111111',pm='22222222-2222-4222-8222-222222222222',boot='33333333-3333-4333-8333-333333333333';
const pin={size:55,sha256:'a'.repeat(64)};
const context={schema_version:1,kind:'browser_full_ui_context',job_id:'b'.repeat(32),plan_sha256:'c'.repeat(64),
 source_commit:'53d97b9609e8e0fcdfc5d003101f620098dbc734',pm_intent_sha256:'d'.repeat(64),pm_proof_sha256:'e'.repeat(64),
 target:{kind:'browser_webusb',usb_serial:'synthetic-usb',wlan_mac:'02:00:00:00:00:01',boot_id:original,co2_type:3,stock_version:'4.1.8_0287'},pm_armed_boot:pm,
 api_identity:{node_name:'fixture',api_mac:'02:00:00:00:00:01'},bridge:pin,native_pair:{'native-program':pin,'guardian-program':pin},
 producer_sha256:Object.fromEntries(['browser_full_ui_context.py','full_ui_review.py','full_ui_trial.py','full_ui_activation.py'].map(n=>[n,'f'.repeat(64)])),
 context_only:true,writer_enabled:false,device_writes:0};
// Compare the emitted fixed read with the actual canonical native builder.
// Fake.read only returns synthetic bytes and records text; it executes no shell.
const canonical=spawnSync('python3',['-c',`
import sys,json
sys.path.insert(0,'ports/monitor1')
import stage_install_adb as native
class Reader:
 def read(self,command):
  print(json.dumps(command))
  return '55 1\\n'+'a'*64+'  /data/.esphome-cgs1/program'
native.verify_remote_file(Reader(),native.BASE+'/program',{'size':55,'sha256':'a'*64})
`],{encoding:'utf8'});
assert.equal(canonical.status,0,canonical.stderr);const fileCommand=JSON.parse(canonical.stdout);
const bundle=await import('data:text/javascript;base64,'+Buffer.from(await readFile(new URL('../custom_components/qingping_esphome/frontend/usb-probe-bundle.mjs',import.meta.url))).toString('base64'));
function fixture(Native,current=boot) {
 const state={closed:0,apiClosed:0,changed:false,reads:0,listeners:'1'},calls=[];
 const identity={uid:'0',arch:'armv7l',version:'CLEARGRASS_VERSION=4.1.8_0287',co2_type:'3',boot_id:current,wlan_mac:'02:00:00:00:00:01'};
 const contract={identity:Object.keys(identity).map(name=>({name,command:'read-'+name}))};
 const client={close:async()=>{state.closed++;},createSocket:async service=>{
  calls.push(service);
  if(service==='tcp:6053')return {readable:new ReadableStream(),writable:new WritableStream(),close:async()=>{state.apiClosed++;}};
  assert(service.startsWith('shell:set -e\n'));
  const command=service.slice('shell:set -e\n'.length).split('\nprintf ')[0],marker=service.match(/__CGS1_CHANNEL_OK_[a-f0-9]+__/)[0];
  let value;
  if(command==="awk 'FNR>1 && $4==\"0A\" && $2 ~ /:17A5$/ {n++} END {print n+0}' /proc/net/tcp /proc/net/tcp6")value=state.listeners;
  else if(command==='LC_ALL=C /bin/busybox ifconfig wlan0')value='wlan0 inet addr:192.168.1.25  Bcast:192.168.1.255';
  else if(command.startsWith('read-'))value=identity[command.slice(5)];
  else {assert.equal(command,fileCommand);
   state.reads++;value='55 1\n'+(state.changed?'0'.repeat(64):pin.sha256)+'  /data/.esphome-cgs1/program';}
  return {readable:new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(value+'\n'+marker+'\n'));c.close();}}),close:async()=>{}};
 }};
 const library={manager:{requestDevice:()=>{calls.push('picker');return Promise.resolve({serial:'synthetic-usb',connect:async()=>({readable:{cancel:async()=>{}},writable:{close:async()=>{}}})});}},
 authenticate:async()=>({}),createClient:()=>client,ephemeralCredentials:()=>({})};
 return {link:new Native(library,contract),calls,state};
}
for(const Native of [Raw,bundle.createNativeChannel().constructor]) {
 for(const current of [boot,pm]) {
  const f=fixture(Native,current),pending=f.link.selectForFullUiReview();assert.equal(f.calls[0],'picker');await pending;
  const peer=new BrowserChannelPeer(f.link,{purpose:'full-ui'});let id=0;
  const dispatch=(op,data=null)=>peer.dispatch({id:(++id).toString(16).padStart(32,'0'),operation:op,data});
  const scope=await dispatch('full-ui-scope',{context});assert.equal(scope.ok,true);
  assert.equal(scope.data.kind,current===pm?'browser_full_ui_waiting_for_pm_boot':'browser_full_ui_scope');
  assert.equal(f.state.reads,2);await assert.rejects(f.link.probeCommitStream());await assert.rejects(f.link.checkInitialScope());
  if(current===boot) {
   const network=await dispatch('full-ui-network');assert.equal(network.ok,true);assert.equal(network.data.host,'192.168.1.25');
   assert.deepEqual(network.data,{kind:'browser_full_ui_network',host:'192.168.1.25',device_writes:0});

   f.state.listeners='0';
   const absent=await dispatch('api-open');assert.equal(absent.ok,true);assert.equal(absent.data.socket_open_issued,false);
   assert(!f.calls.includes('tcp:6053'));assert.equal(f.state.closed,0,'Known absent listener cannot retire or issue a socket');
   f.state.listeners='1';
   assert.equal((await dispatch('api-open')).ok,true);assert.equal((await dispatch('api-close')).ok,true);
   assert.equal(f.state.apiClosed,1);assert.equal((await dispatch('full-ui-scope',{context})).ok,true);
  }else {assert.equal((await dispatch('api-open')).ok,false);assert(!f.calls.includes('tcp:6053'));}
  await peer.close();assert.equal(f.state.closed,1);
 }
 const f=fixture(Native);await f.link.selectForFullUiReview();await f.link.observeFullUiScope(context);f.state.changed=true;
 await assert.rejects(f.link.openFullUiApi());assert(!f.calls.includes('tcp:6053'));assert.equal(f.state.closed,1);
}
for(const change of [c=>c.bridge.size=true,c=>c.pm_armed_boot=c.target.boot_id,c=>c.target.co2_type=true,c=>c.producer_sha256.extra='f'.repeat(64)]) {
 const c=structuredClone(context);change(c);assert.throws(()=>validateFullUiContext(c));
}
{
 const f=fixture(Raw);await f.link.selectForFullUiReview();const peer=new BrowserChannelPeer(f.link,{purpose:'full-ui'});
 assert.equal((await peer.dispatch({id:'f'.repeat(32),operation:'commit-stream-check',data:null})).ok,false);
 assert(!f.calls.some(c=>c.startsWith('exec:')));assert.equal(f.state.closed,1);
}
{
 let selected=false,register,closed=0;
 const queue=[{id:'a'.repeat(32),operation:'channel-close',data:null}];
 const link={selectForFullUiReview:()=>{selected=true;return Promise.resolve({kind:'synthetic-only'});},close:async()=>{closed++;}};
 const rpc=async(op,data)=>{
  if(op==='browser/open'){register=data;return {channel_id:'b'.repeat(32),state:'registered',writer_enabled:false};}
  if(op==='browser/poll')return {request:queue.shift()};
  if(op==='browser/answer')return {state:'accepted'};
  if(op==='browser/close')return {state:'retired'};
  assert.fail(op);
 };
 const promise=openBrowserFullUiControl(link,rpc);assert(selected,'Picker starts in the original click');
 const session=await promise;assert.deepEqual(await session.done,{state:'closed'});assert.equal(register.purpose,'full-ui');assert.equal(closed,1);
}
console.log('Full UI raw/delivered selected handle: post-PM scope, waiting boot, immutable bridge, private purpose and independent closure PASS; synthetic USB only');
// Full UI exceeds the ordinary frame history after several MiB. Exercise the
// actual consumed-ID peer, keeping the ordinary bound and replay refusal.
for(const purpose of ['standard','full-ui']) {
 let calls=0;
 const link={checkInitialScope:async()=>{calls++;return {};},observeFullUiScope:async()=>{calls++;return {};},close:async()=>{}};
 const peer=new BrowserChannelPeer(link,{purpose});
 for(let i=1;i<=2049;i++) {
  const frame={id:i.toString(16).padStart(32,'0'),operation:purpose==='full-ui'?'full-ui-scope':'scope-check',data:purpose==='full-ui'?{context}:null};
  if(i===2049 && purpose==='standard')await assert.rejects(peer.dispatch(frame));
  else assert.equal((await peer.dispatch(frame)).ok,true);
 }
 assert.equal(calls,purpose==='full-ui'?2049:2048);await peer.close();
}
console.log('Extended Full UI consumed-ID history crosses 2048; ordinary ceiling remains fixed PASS');

for(const host of ['10.0.0.2','172.16.0.2','192.168.1.25'])assert.equal(fullUiIpv4('wlan0 inet addr:'+host+'  '),host);
for(const raw of ['eth0 inet 192.168.1.2 ', 'wlan0 inet 127.0.0.1 ', 'wlan0 inet 8.8.8.8 ',
 'wlan0 inet 192.168.01.1 ', 'wlan0 inet 192.168.1.2 inet 192.168.1.3 ', 'wlan0 inet 192.168.1.2;reboot '])assert.throws(()=>fullUiIpv4(raw));
