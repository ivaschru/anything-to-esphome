import assert from "node:assert/strict";
import {installStatus,readInstall,startInstall,readInstallReview,observeBoot,reviewFullUi,
  fullTrialStatus,readFullUiTrial,startFullUiTrial,fullActivationStatus,readFullUiActivation,startFullUiActivation,pmStatus,readPmExtension,startPmExtension} from "../custom_components/qingping_esphome/frontend/usb-install.mjs";
import {strings} from "../custom_components/qingping_esphome/frontend/usb-labels.mjs";
const id="c".repeat(32), review={job_id:id,plan_sha256:"d".repeat(64),model:"CGS1",co2_type:3,
  friendly_name:"Fixture",wlan_mac:"02:00:00:00:00:01",stock_version:"4.1.8_0287",
  requested_data_free_bytes:16000000,experimental:true,installation_ready:false};
const value={job_id:id,state:"armed_waiting_reboot",autostart_armed:true,installed:false,
  installation_ready:false,replay_allowed:false,live_recheck_required:true};
let calls=[];
await assert.rejects(startInstall(async()=>{calls.push("unexpected");},review,false),e=>e.code==="usb_install_review_required");
assert.deepEqual(calls,[]);
assert.deepEqual(await startInstall(async(op,body)=>{calls.push([op,body]);return value;},review,true),value);
assert.deepEqual(calls,[["install",{job_id:id,expected_plan_sha256:review.plan_sha256,experimental_reviewed:true}]]);
calls=[];
assert.deepEqual(await startInstall(async(op,body)=>{calls.push(op);if(body)throw Error("lost ACK");return value;},review,true),value);
assert.deepEqual(calls,["install","jobs/"+id+"/install"]);
for(const change of [{installed:true},{installation_ready:true},{replay_allowed:true},{api_encryption_key:"secret"},
  {state:"install_unverified",autostart_armed:true}]) assert.throws(()=>installStatus({...value,...change},id));
assert.deepEqual(await readInstall(async()=>value,id),value);
assert.deepEqual(await readInstallReview(async()=>review,id),review);
await assert.rejects(readInstallReview(async()=>({...review,co2_type:4}),id));
const observed={job_id:id,state:"bridge_observed",runtime_observed:true,device_writes:0,installed:false,installation_ready:false};
assert.deepEqual(await observeBoot(async()=>observed,id),observed);
await assert.rejects(observeBoot(async()=>({...observed,device_writes:1}),id));
assert.deepEqual(Object.keys(strings.en).sort(),Object.keys(strings.ru).sort());
const full={job_id:id,state:"pm_extension_required",read_only:true,device_writes:0,launch_authorized:false,
  installation_ready:false,installed:false,live_recheck_required:true};
calls=[];
assert.deepEqual(await reviewFullUi(async(op,body)=>{calls.push([op,body]);return full;},id),full);
assert.deepEqual(calls,[["full-review",{job_id:id}]]);
await assert.rejects(reviewFullUi(async()=>({...full,launch_authorized:true}),id));
await assert.rejects(reviewFullUi(async()=>({...full,installation_ready:true}),id));
await assert.rejects(reviewFullUi(async()=>({...full,state:"installed"}),id));
const trial={job_id:id,state:"full_ui_trial_returned_observed",trial_available:true,hard_runtime_ms:60000,
  native_observations:2,stock_return_observed:true,launch_acknowledged:false,installed:false,
  installation_ready:false,boot_enabled:false,replay_allowed:false,live_recheck_required:true};
calls=[];
await assert.rejects(startFullUiTrial(async()=>{calls.push("unexpected");},review,false),e=>e.code==="usb_full_ui_trial_review_required");
assert.deepEqual(calls,[]);
assert.deepEqual(await startFullUiTrial(async(op,body)=>{calls.push([op,body]);return trial;},review,true),trial);
assert.deepEqual(calls,[["full-trial",{job_id:id,expected_plan_sha256:review.plan_sha256,experimental_reviewed:true}]]);
calls=[];
assert.deepEqual(await startFullUiTrial(async(op,body)=>{calls.push(op);if(body)throw Error("lost reply");return trial;},review,true),trial);
assert.deepEqual(calls,["full-trial","jobs/"+id+"/full-trial"]);
assert.deepEqual(await readFullUiTrial(async()=>trial,id),trial);
for(const change of [{installed:true},{installation_ready:true},{boot_enabled:true},{replay_allowed:true},{hard_runtime_ms:0},
  {native_observations:1},{native_observations:true},{stock_return_observed:false},{api_encryption_key:"private"}])
  assert.throws(()=>fullTrialStatus({...trial,...change},id));
const notStarted={...trial,state:"not_started",native_observations:null,stock_return_observed:null,launch_acknowledged:null};
calls=[];
await assert.rejects(startFullUiTrial(async(op,body)=>{calls.push(op);if(body)throw Error("lost reply");return notStarted;},review,true),
  e=>e.code==="usb_full_ui_trial_unverified");
assert.deepEqual(calls,["full-trial","jobs/"+id+"/full-trial"],"Even not-started readback cannot automatically replay the POST");
console.log("Experimental USB install: exact review, one POST, status-only reconciliation and no invented readiness passed");

const permanent={job_id:id,state:"full_ui_active_observed",activation_available:false,native_observations:2,
  store_installed:true,boot_enabled:true,start_acknowledged:false,installed:false,installation_ready:false,
  replay_allowed:false,live_recheck_required:true};
calls=[];
await assert.rejects(startFullUiActivation(async()=>{calls.push("unexpected");},review,true,false));
assert.deepEqual(calls,[]);
assert.deepEqual(await startFullUiActivation(async(op,body)=>{calls.push([op,body]);return permanent;},review,true,true),permanent);
assert.deepEqual(calls,[["full-activate",{job_id:id,expected_plan_sha256:review.plan_sha256,experimental_reviewed:true,screen_reviewed:true}]]);
calls=[];
assert.deepEqual(await startFullUiActivation(async(op,body)=>{calls.push(op);if(body)throw Error("lost reply");return permanent;},review,true,true),permanent);
assert.deepEqual(calls,["full-activate","jobs/"+id+"/full-activate"]);
assert.deepEqual(await readFullUiActivation(async()=>permanent,id),permanent);
for(const change of [{installed:true},{activation_available:true},{boot_enabled:false},{native_observations:true},{native_observations:1},
    {trial_job:"private"},{state:"not_started"}]) assert.throws(()=>fullActivationStatus({...permanent,...change},id));
console.log("Permanent USB UI: separate screen review, one POST, private status and no replay passed");

const pm={job_id:id,state:"pm_extension_armed_waiting_reboot",pm_available:false,arming_acknowledged:false,
  completion_observed:true,next_boot_armed:true,installed:false,installation_ready:false,replay_allowed:false,live_recheck_required:true};
calls=[];
await assert.rejects(startPmExtension(async()=>{calls.push("unexpected");},review,false));
assert.deepEqual(calls,[]);
assert.deepEqual(await startPmExtension(async(op,body)=>{calls.push([op,body]);return pm;},review,true),pm);
assert.deepEqual(calls,[["pm-enable",{job_id:id,expected_plan_sha256:review.plan_sha256,experimental_reviewed:true}]]);
calls=[];
assert.deepEqual(await startPmExtension(async(op,body)=>{calls.push(op);if(body)throw Error("lost reply");return pm;},review,true),pm);
assert.deepEqual(calls,["pm-enable","jobs/"+id+"/pm-enable"]);
assert.deepEqual(await readPmExtension(async()=>pm,id),pm);
for(const change of [{installed:true},{pm_available:true},{completion_observed:false},{next_boot_armed:false},{nonce:"private"}])
  assert.throws(()=>pmStatus({...pm,...change},id));
console.log("PM prerequisite: separate review, one POST, private status and no replay passed");

const {enrollmentStatus,readEnrollment,startEnrollment}=await import('../custom_components/qingping_esphome/frontend/usb-install.mjs');
const enrolled={job_id:id,state:'created',enrollment_available:false,entry_id:'ENTRY_1',replay_allowed:false,installation_ready:false};
calls=[];
await assert.rejects(startEnrollment(async()=>calls.push('unexpected'),review,false));
assert.deepEqual(calls,[]);
assert.deepEqual(await startEnrollment(async(op,body)=>{calls.push([op,body]);return enrolled;},review,true),enrolled);
assert.deepEqual(calls,[['enroll',{job_id:id,expected_plan_sha256:review.plan_sha256,reviewed:true}]]);
calls=[];
assert.deepEqual(await startEnrollment(async(op,body)=>{calls.push(op);if(body)throw Error('lost reply');return enrolled;},review,true),enrolled);
assert.deepEqual(calls,['enroll','jobs/'+id+'/enroll']);
assert.deepEqual(await readEnrollment(async()=>enrolled,id),enrolled);
for(const change of [{enrollment_available:true},{noise_psk:'private'},{installation_ready:true},{entry_id:null},{replay_allowed:true},{state:'not_started'}])
  assert.throws(()=>enrollmentStatus({...enrolled,...change},id));
console.log('HA enrollment: reviewed native step, exact redacted DTO and status-only lost-ACK recovery passed');
