/** srcdoc's location.origin is null; its inherited security origin is not. */
import assert from "node:assert/strict";
const sent=[],listeners=[];
globalThis.location={origin:"null"};
const body={getBoundingClientRect:()=>({height:1800})};
globalThis.document={baseURI:"https://ha.invalid/api/qingping_esphome/static/monitor1/",
  querySelector:()=>({content:"test-frame-channel"}),body,documentElement:{scrollHeight:12000}};
globalThis.window={parent:{postMessage:(message,origin)=>sent.push({message,origin})},
  addEventListener:(type,listener)=>listeners.push(listener)};
globalThis.ResizeObserver=class {
  constructor(callback){this.callback=callback;}
  observe(element){assert.equal(element,body);this.callback();}
};
const {coreFetch,embedded}=await import("../apps/monitor1_usb/rootfs/static/core-bridge.mjs");
assert.equal(embedded,true);
assert.equal(sent[0].origin,"https://ha.invalid");
assert.equal(sent[0].message.height,1800,"Intrinsic body height must not feed back from the iframe viewport");
const pending=coreFetch("jobs",undefined,1000);
const {message,origin}=sent.at(-1);
assert.equal(origin,"https://ha.invalid","Never post to srcdoc's null origin or wildcard");
assert.equal(message.operation,"jobs");
const reply={kind:"qingping-core-response",channel:"test-frame-channel",id:message.id,
  status:200,mime:"application/json",body:new TextEncoder().encode('{"jobs":[]}').buffer};
listeners[0]({source:window.parent,origin:"https://other.invalid",data:reply});
listeners[0]({source:{},origin:"https://ha.invalid",data:reply});
listeners[0]({source:window.parent,origin:"https://ha.invalid",data:reply});
const response=await pending;
assert.equal(response.status,200);
assert.deepEqual(await response.json(),{jobs:[]});
console.log("Real srcdoc origin, exact parent replies, opaque response and intrinsic frame sizing passed");
