/** Executable parent-frame authorization/transport lifecycle; no browser USB. */
import assert from "node:assert/strict";
import {openCoreWizard} from "../custom_components/qingping_esphome/frontend/monitor1-core.mjs";
const listeners=new Set(),calls=[],messages=[];
globalThis.location={origin:"https://ha.invalid"};
globalThis.window={addEventListener:(type,listener)=>listeners.add(listener),removeEventListener:(type,listener)=>listeners.delete(listener)};
const frame={style:{},setAttribute(){},contentWindow:{postMessage:value=>messages.push(value)},remove(){this.removed=true;}};
globalThis.document={createElement:()=>frame};
globalThis.fetch=async()=>new Response('<head><meta content="__PAGE_NONCE__"></head>');
const container={replaceChildren(value){this.frame=value;}};
const hass={user:{is_admin:true},fetchWithAuth:async(path,init)=>{
  calls.push({path,init});
  const body=path.endsWith("/page") ? JSON.stringify({nonce:"a".repeat(64)}) : JSON.stringify({jobs:[]});
  return new Response(body,{headers:{"Content-Length":String(body.length),"Content-Type":"application/json"}});
}};
await assert.rejects(openCoreWizard(container,{...hass,user:{is_admin:false}}),{code:"usb_unauthorized"});
assert.equal(calls.length,0);
const close=await openCoreWizard(container,hass,"ru");
assert.match(frame.title,/Установка/);
assert.match(frame.srcdoc,/static\/monitor1/);
assert.equal(calls.length,1,"Opening the frame only creates an owner page, never starts USB/tools");
const channel=frame.srcdoc.match(/qingping-core-channel" content="([^"]+)"/)[1];
const listener=[...listeners][0];
const event={origin:location.origin,source:frame.contentWindow,data:{channel,kind:"qingping-core-request",
  id:"12345678-1234-4234-8234-123456789abc",operation:"jobs"}};
await listener({...event,origin:"https://other.invalid"});
await listener({...event,source:{}});
await listener({...event,data:{...event.data,channel:"wrong"}});
assert.equal(calls.length,1,"Wrong frame/origin/channel receives no authenticated forwarding");
await listener(event);
assert.equal(calls.length,2);
assert.equal(calls[1].init.body,"null");
assert.equal(calls[1].init.headers["X-Qingping-Nonce"],"a".repeat(64));
assert.equal(messages.at(-1).status,200);
assert.deepEqual(JSON.parse(new TextDecoder().decode(messages.at(-1).body)),{jobs:[]});
await listener(event);
assert.equal(calls.length,2,"An already consumed request is never sent again");
assert.equal(messages.at(-1).error,"usb_busy");
await listener({...event,data:{...event.data,id:"22345678-1234-4234-8234-123456789abc",operation:"../shell"}});
assert.equal(calls.length,2,"Paths/commands cannot enter the finite route adapter");

// A writer can await its own finite browser IO without granting a second
// ordinary writer. Two frame deliveries are the entire parallel exception.
const oldFetch=hass.fetchWithAuth,held=new Map();
hass.fetchWithAuth=async(path,init)=>{
  if(path.endsWith('/install') || path.endsWith('/browser/poll') || path.endsWith('/browser/answer')) {
    calls.push({path,init});return await new Promise(resolve=>held.set(path,resolve));
  }
  return oldFetch(path,init);
};
const send=operation=>listener({...event,data:{...event.data,id:crypto.randomUUID(),operation}});
const writerRequest=send('install');await Promise.resolve();
const beforeFrames=calls.length;
const pollRequest=send('browser/poll'),answerRequest=send('browser/answer');await Promise.resolve();
assert.equal(calls.length,beforeFrames+2,'Finite frame delivery progresses while the writer awaits');
await send('browser/answer');assert.equal(calls.length,beforeFrames+2,'A third frame exceeds its budget');
await send('install');await send('browser/open');
assert.equal(calls.length,beforeFrames+2,'Parallel exception cannot register a new transport or second writer');
for(const resolve of held.values())resolve(new Response('{}',{headers:{'Content-Type':'application/json','Content-Length':'2'}}));
await Promise.all([writerRequest,pollRequest,answerRequest]);
hass.fetchWithAuth=oldFetch;
const beforeClose=calls.length;
close();
assert.equal(listeners.size,0);
assert.equal(frame.removed,true);
await listener({...event,data:{...event.data,id:"32345678-1234-4234-8234-123456789abc"}});
assert.equal(calls.length,beforeClose,"Disconnected components retain no authenticated listener");
console.log("Integrated Core frame: actual HA authentication, origin/source/nonce fences, no replay and cleanup passed");
