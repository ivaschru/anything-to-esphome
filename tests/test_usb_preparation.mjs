import assert from "node:assert/strict";
import {prepareProfile,readPrepared,preparedStatus,savedPreparations} from "../custom_components/qingping_esphome/frontend/usb-preparation.mjs";
const id="a".repeat(32);
const summary={job_id:id,stage:"profile_prepared",model:"CGS1",co2_type:3,transport:"ha_usb",node_name:"qingping-fixture",
  friendly_name:"fixture",live_recheck_required:true,installed:false,installation_ready:false};
{
  const calls=[];
  const result=await prepareProfile(async(path,body)=>{calls.push([path,body]);return summary;},id,"fixture",{serial:"fixture"});
  assert.deepEqual(result,summary);
  assert.deepEqual(calls,[["prepare",{request_id:id,friendly_name:"fixture",serial:"fixture"}]]);
}
{
  const calls=[];
  const result=await prepareProfile(async(path,body)=>{
    calls.push([path,body]);if(path==="prepare")throw Error("Synthetic lost ACK");return summary;
  },id,"fixture",{serial:"fixture"});
  assert.deepEqual(result,summary);
  assert.deepEqual(calls.map(item=>item[0]),["prepare","jobs/"+id]);
  assert.equal(calls.filter(item=>item[1]).length,1,"Never resubmit after an ambiguous POST");
}
{
  const calls=[];
  await assert.rejects(prepareProfile(async(path,body)=>{
    calls.push([path,body]);throw {code:"usb_profile_name_invalid"};
  },id,"fixture",{serial:"fixture"}),error=>error.code==="usb_profile_name_invalid");
  assert.equal(calls.length,1);
}
{
  const data=new Uint8Array(100000).fill(37),calls=[];
  await prepareProfile(async(path,body)=>{calls.push([path,body]);return {...summary,transport:"browser_usb"};},id,"fixture",
    {archive:new Blob([data],{type:"application/x-tar"})});
  assert.equal(calls[0][0],"prepare");assert.deepEqual(Buffer.from(calls[0][1].capture,"base64"),Buffer.from(data));
  assert.equal(calls[0][1].serial,undefined);
}
for(const changed of [{installed:true},{installation_ready:true},{job_id:"b".repeat(32)},{transport:"browser_usb"},
  {stage:"installed"},{api_encryption_key:"must-never-be-a-public-field"}]) {
  assert.throws(()=>preparedStatus({...summary,...changed},id,"ha_usb"),error=>error.code==="usb_preparation_unverified");
}
{
  const calls=[];
  assert.deepEqual(await readPrepared(async(path,body)=>{calls.push([path,body]);return summary;},id,"ha_usb"),summary);
  assert.deepEqual(calls,[["jobs/"+id,undefined]]);
}
console.log("USB preparation: one POST, read-only lost-ACK reconciliation, private status and bounded archive encoding passed");
{
  const calls=[];
  const partial={...summary,job_id:"b".repeat(32),stage:"preparation_unverified"};
  assert.deepEqual(await savedPreparations(async(path,body)=>{calls.push([path,body]);return {jobs:[summary,partial]};}),[summary,partial]);
  assert.deepEqual(calls,[["jobs",undefined]]);
  await assert.rejects(savedPreparations(async()=>({jobs:[summary,summary]})));
  await assert.rejects(savedPreparations(async()=>({jobs:[{...summary,api_encryption_key:"not-a-public-field"}]})));
}
