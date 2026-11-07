import assert from "node:assert/strict";
import {planStatus,preparePlan,readPlan} from "../custom_components/qingping_esphome/frontend/usb-plan.mjs";
const id="b".repeat(32), result={job_id:id,state:"plan_prepared",requested_data_free_bytes:16000000,
  hardware_contacted:false,device_writes:0,installed:false,installation_ready:false,live_recheck_required:true};
let calls=[];
assert.deepEqual(await preparePlan(async(op,body)=>{calls.push([op,body]);return result;},id),result);
assert.deepEqual(calls,[["plan",{job_id:id}]]);
calls=[];
assert.deepEqual(await preparePlan(async(op,body)=>{calls.push(op);if(body)throw Error("lost ACK");return result;},id),result);
assert.deepEqual(calls,["plan","jobs/"+id+"/plan"]);
for(const mutation of [{installed:true},{device_writes:1},{hardware_contacted:true},{installation_ready:true},
  {requested_data_free_bytes:-1},{api_encryption_key:"secret"},{live_recheck_required:false}])
  assert.throws(()=>planStatus({...result,...mutation},id));
calls=[];
assert.deepEqual(await readPlan(async op=>{calls.push(op);return result;},id),result);
assert.deepEqual(calls,["jobs/"+id+"/plan"]);
console.log("USB plan: one offline preparation, GET-only reconciliation and no fabricated install authority passed");
