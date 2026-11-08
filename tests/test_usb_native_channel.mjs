import assert from 'node:assert/strict';
import {BrowserNativeChannel} from '../custom_components/qingping_esphome/frontend/usb-native-channel.mjs';
const boot='22222222-2222-2222-2222-222222222222';
const identity={uid:'0',arch:'armv7l',version:'CLEARGRASS_VERSION=4.1.8_0287',co2_type:'3',boot_id:boot,wlan_mac:'02:00:00:00:00:01'};
const contract={identity:Object.keys(identity).map(name=>({name,command:'read-'+name})),
 files:[{command:'read-fixed-original-pin',expected:'matching-pin'}],absent_install:'check-fixed-absent-install'};
function fixture() {
 const calls=[],state={boot,closed:0,apiClosed:0,filesystem:'ef53 10000 4096',changedPin:false,failApi:false};
 const api={close:async()=>{state.apiClosed++;},readable:new ReadableStream(),writable:new WritableStream()};
 const client={close:async()=>{state.closed++;},createSocket:async service=>{
  calls.push(service);
  if(service==='tcp:6053') {if(state.failApi)throw Error('synthetic lost ACK');return api;}
  assert(service.startsWith('shell:set -e\n'));
  const command=service.slice('shell:set -e\n'.length).split('\nprintf ')[0];
  const marker=service.match(/__CGS1_CHANNEL_OK_[a-f0-9]+__/)[0];
  let body;
  if(command==="stat -f -c '%t %a %S' /data") body=state.filesystem;
  else if(command.startsWith('read-') && command!=='read-fixed-original-pin') {
   const name=command.slice(5);assert(name in identity);body=name==='boot_id'?state.boot:identity[name];
  } else if(command==='read-fixed-original-pin')body=state.changedPin?'foreign-pin':'matching-pin';
  else {assert.equal(command,'check-fixed-absent-install');body='';}
  return {readable:new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode(body+'\n'+marker+'\n'));controller.close();}}),close:async()=>{}};
 }};
 const device={serial:'synthetic-usb',connect:async()=>({readable:{cancel:async()=>{}},writable:{close:async()=>{}}})};
 const library={manager:{requestDevice:()=>{calls.push('picker');return Promise.resolve(device);}},
  authenticate:async()=>({}),createClient:()=>client,ephemeralCredentials:()=>({})};
 return {link:new BrowserNativeChannel(library,contract),calls,state,device,library,api};
}
{
 const f=fixture();const pending=f.link.select();assert.equal(f.calls[0],'picker','Picker remains in original click');
 const proof=await pending;assert.equal(proof.kind,'browser_webusb');assert.equal(proof.native_get_devpath,false);
 assert.equal(proof.serial,'synthetic-usb');assert(!('usb_transport' in proof));assert(Object.isFrozen(proof));
 assert.throws(()=>f.link.select());
 assert.equal(await f.link.openApi(),f.api);assert.equal(f.calls.filter(c=>c==='tcp:6053').length,1);
 await assert.rejects(f.link.openApi());await f.link.close();
 assert.equal(f.state.closed,1);assert.equal(f.state.apiClosed,1);assert.throws(()=>f.link.evidence());
 await f.link.close();assert.equal(f.state.closed,1);
}
{
 const f=fixture();await f.link.select();f.state.boot='33333333-3333-3333-3333-333333333333';
 await assert.rejects(f.link.openApi());assert(!f.calls.includes('tcp:6053'));assert.equal(f.state.closed,1);
}
{
 const f=fixture();await f.link.select();f.state.failApi=true;
 await assert.rejects(f.link.openApi());await assert.rejects(f.link.openApi());
 assert.equal(f.calls.filter(c=>c==='tcp:6053').length,1,'Lost socket ACK never permits retry');assert.equal(f.state.closed,1);
}
{
 const f=fixture();f.state.changedPin=true;await assert.rejects(f.link.select());assert.equal(f.state.closed,1);
 assert(!f.calls.includes('tcp:6053'));assert.throws(()=>f.link.evidence());
}
{
 const f=fixture();await f.link.select();f.device.serial='foreign-usb';
 await assert.rejects(f.link.openApi());assert(!f.calls.includes('tcp:6053'));assert.equal(f.state.closed,1);await f.link.close();
}
{
 const f=fixture();await f.link.select();await f.link.openApi();await f.link.closeApi();
 assert.equal(await f.link.openApi(),f.api);assert.equal(f.calls.filter(c=>c==='tcp:6053').length,2);
 await f.link.close();assert.equal(f.state.closed,1);assert.equal(f.state.apiClosed,2);
}
console.log('Live WebUSB transport: original picker, typed evidence, source/boot fences, fixed API socket, no adoption/retry and owned cleanup passed');

{
 const f=fixture();await f.link.select();
 const result=await f.link.checkStageScope();assert.equal(result.evidence.native_get_devpath,false);
 assert.deepEqual(result.filesystem,{magic:'ef53',available_blocks:10000,block_bytes:4096});
 assert(!f.calls.includes('tcp:6053'));await f.link.close();
}
for(const filesystem of ['tmpfs 10000 4096','ef53 bad 4096','ef53 10000 1','ef53 999999999999999999999999 4096']) {
 const f=fixture();await f.link.select();f.state.filesystem=filesystem;
 await assert.rejects(f.link.checkStageScope());assert.equal(f.state.closed,1);
 assert(!f.calls.includes('tcp:6053'));
}
