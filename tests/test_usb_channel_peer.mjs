import assert from 'node:assert/strict';
import {BrowserChannelPeer} from '../custom_components/qingping_esphome/frontend/usb-channel-peer.mjs';
let next=0;
const request=(operation,data=null)=>({id:(++next).toString(16).padStart(32,'0'),operation,data});
function fixture() {
 let controller,closed=0,apiClosed=0,written=[];
 const makeSocket=()=>({readable:new ReadableStream({start(c){controller=c;}}),
  writable:new WritableStream({write(value){written.push(value);}})});
 const link={openApi:async()=>makeSocket(),closeApi:async()=>{apiClosed++;},close:async()=>{closed++;}};
 return {peer:new BrowserChannelPeer(link),push:value=>controller.enqueue(value),get closed(){return closed;},get apiClosed(){return apiClosed;},written};
}
{
 const f=fixture();assert.deepEqual(await f.peer.dispatch(request('api-open')),{id:next.toString(16).padStart(32,'0'),ok:true,data:null});
 assert.equal((await f.peer.dispatch(request('api-write',btoa('opaque bytes')))).ok,true);
 assert.equal(new TextDecoder().decode(f.written[0]),'opaque bytes');
 f.push(new TextEncoder().encode('opaque bytes'));
 assert.equal(atob((await f.peer.dispatch(request('api-read',{max_bytes:6}))).data),'opaque');
 assert.equal(atob((await f.peer.dispatch(request('api-read',{max_bytes:6}))).data),' bytes');
 const pending=f.peer.dispatch(request('api-read',{max_bytes:8}));
 assert.equal((await f.peer.dispatch(request('api-close'))).ok,true);
 assert.equal((await pending).data,'');assert.equal(f.apiClosed,1);
 assert.equal((await f.peer.dispatch(request('api-open'))).ok,true);
 assert.equal((await f.peer.dispatch(request('channel-close'))).ok,true);assert.equal(f.closed,1);
}
{
 const f=fixture();const original=request('api-open');await f.peer.dispatch(original);
 await assert.rejects(f.peer.dispatch(original));assert.equal(f.closed,1);
}
for(const body of [request('shell','reboot'),request('api-open',{host:'foreign'}),request('api-write','bad-base64!')]) {
 const f=fixture();const result=await f.peer.dispatch(body);assert.equal(result.ok,false);assert.equal(f.closed,1);
}
console.log('Browser API peer: exact finite frames, opaque bounded bytes, concurrent read/close EOF, consumed IDs and no generic command passed');
