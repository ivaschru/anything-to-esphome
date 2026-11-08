import assert from 'node:assert/strict';
import {openBrowserControl,openBrowserReviewControl} from '../custom_components/qingping_esphome/frontend/usb-browser-control.mjs';
let count=0;const req=(operation,data=null)=>({id:(++count).toString(16).padStart(32,'0'),operation,data});
const channel='c'.repeat(32);
{
 let selected=0,closed=0;
 const queue=[req('api-open'),req('api-read',{max_bytes:16}),req('api-close'),req('channel-close')],calls=[];
 const readId=queue[1].id;
 const socket={readable:new ReadableStream(),writable:new WritableStream()};
 const link={select:()=>{selected++;return Promise.resolve({kind:'browser_webusb'});},openApi:async()=>socket,closeApi:async()=>{},close:async()=>{closed++;}};
 const rpc=async(op,data)=>{
  calls.push([op,data]);
  if(op==='browser/open')return {channel_id:channel,state:'registered',writer_enabled:false};
  if(op==='browser/poll') {assert(queue.length);return {request:queue.shift()};}
  if(op==='browser/answer')return {state:'accepted'};
  if(op==='browser/close')return {state:'retired'};
  assert.fail(op);
 };
 const pending=openBrowserControl(link,rpc);assert.equal(selected,1);
 const session=await pending;assert.equal(session.channel_id,channel);
 assert.deepEqual(await session.done,{state:'closed'});
 assert.equal(calls.filter(([op])=>op==='browser/open').length,1);
 assert.equal(calls.filter(([op])=>op==='browser/answer').length,4);
 const frames=calls.filter(([op])=>op==='browser/answer').map(([,data])=>data.frame);
 assert(frames.every(frame=>frame.ok));assert.equal(frames.find(f=>f.id===readId).data,'');
 assert(closed>=1);assert(!calls.some(([op])=>/install|launch|shell/.test(op)));
}
{
 let selected=0,closed=0;const calls=[];
 const link={select:()=>{selected++;return Promise.resolve({kind:'browser_webusb'});},close:async()=>{closed++;}};
 const rpc=async(op)=>{calls.push(op);throw Error('synthetic lost registration ACK');};
 const pending=openBrowserControl(link,rpc);assert.equal(selected,1);
 await assert.rejects(pending,e=>e.code==='usb_channel_unverified');
 assert.deepEqual(calls,['browser/open']);assert.equal(closed,1);
}
console.log('Browser control: original picker, two API frame handlers, pending read close, one registration/reply and lost-ACK retirement passed');

for(const lostClose of [false,true]) {
 let release,selected=0,closed=0;
 const calls=[];
 const link={select:()=>{selected++;return Promise.resolve({kind:'browser_webusb'});},close:async()=>{closed++;}};
 const rpc=async(op)=>{
  calls.push(op);
  if(op==='browser/open') return {channel_id:channel,state:'registered',writer_enabled:false};
  if(op==='browser/poll') return new Promise(resolve=>{release=resolve;});
  if(op==='browser/close') {release({request:null});if(lostClose) throw Error('synthetic lost close ACK');return {state:'retired'};}
  assert.fail(op);
 };
 const session=await openBrowserControl(link,rpc);
 const first=session.close(),second=session.close();
 assert.deepEqual(await first,{state:lostClose?'unverified':'closed'});
 assert.deepEqual(await second,await first);
 assert.deepEqual(await session.done,await first);
 assert.equal(selected,1);assert.equal(closed,1);
 assert.equal(calls.filter(op=>op==='browser/close').length,1,'Concurrent cleanup shares its one ACK');
}
console.log('Manual browser cleanup: one shared ACK, ordinary pending poll and lost-close refusal passed');

{
 let selected=0,closed=0;const calls=[],queue=[req('channel-close')];
 const link={select:()=>{assert.fail('No implicit factory selection for staged review');},
  selectForReview:()=>{selected++;return Promise.resolve({kind:'browser_webusb'});},close:async()=>{closed++;}};
 const rpc=async(op)=>{calls.push(op);
  if(op==='browser/open')return {channel_id:channel,state:'registered',writer_enabled:false};
  if(op==='browser/poll')return {request:queue.shift()};
  if(op==='browser/answer')return {state:'accepted'};
  if(op==='browser/close')return {state:'retired'};
  assert.fail(op);
 };
 const pending=openBrowserReviewControl(link,rpc);assert.equal(selected,1,'Original click starts the staged-review picker before RPC');
 const session=await pending;assert.deepEqual(await session.done,{state:'closed'});
 assert.equal(closed,1);assert.equal(calls.filter(op=>op==='browser/open').length,1);
}
console.log('Review control: separate original-click identity-only opening, same private framing and acknowledged cleanup passed');
