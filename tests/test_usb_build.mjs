import assert from "node:assert/strict";
import {buildStatus, readBuild, startBuild} from "../custom_components/qingping_esphome/frontend/usb-build.mjs";
const id="a".repeat(32), value=(state="building",phase="source")=>({job_id:id,state,phase,
  hardware_contacted:false,installed:false,installation_ready:false});
let calls=[];
assert.equal((await startBuild(async(op,body)=>{calls.push([op,body]);return value();},id)).state,"building");
assert.deepEqual(calls,[["build",{job_id:id}]]);
calls=[];
assert.equal((await startBuild(async(op,body)=>{calls.push([op,body]);if(body) throw Error("lost ACK");return value();},id)).state,"building");
assert.deepEqual(calls,[["build",{job_id:id}],["jobs/"+id+"/build",undefined]]);
calls=[];
await assert.rejects(startBuild(async(op,body)=>{calls.push([op,body]);if(body) throw Error("lost ACK");return value("not_started","unverified");},id),e=>e.code==="usb_build_unverified");
assert.equal(calls.length,2);
for(const mutation of [{installed:true},{hardware_contacted:true},{installation_ready:true},{api_encryption_key:"secret"},{phase:"anything"}])
  assert.throws(()=>buildStatus({...value(),...mutation},id));
calls=[];
await assert.rejects(startBuild(async()=>{calls.push("build");throw {code:"usb_build_space"};},id),e=>e.code==="usb_build_space");
assert.deepEqual(calls,["build"]);
calls=[];
assert.equal((await readBuild(async op=>{calls.push(op);return value("built_not_installed","complete");},id)).state,"built_not_installed");
assert.deepEqual(calls,["jobs/"+id+"/build"]);
console.log("USB build: one start, read-only reconciliation, exact private status and no false installation passed");
