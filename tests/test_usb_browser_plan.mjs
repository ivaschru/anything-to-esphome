import assert from "node:assert/strict";
import {browserPlanStatus,prepareBrowserPlan,readBrowserPlan} from "../custom_components/qingping_esphome/frontend/usb-browser-plan.mjs";
import {planStatus} from "../custom_components/qingping_esphome/frontend/usb-plan.mjs";
import {strings} from "../custom_components/qingping_esphome/frontend/usb-labels.mjs";
const id="b".repeat(32), prepared={job_id:id,state:"browser_plan_prepared",plan_id:"c".repeat(32),plan_sha256:"d".repeat(64),
  requested_data_free_bytes:16000000,transport_kind:"browser_webusb",native_get_devpath:false,hardware_contacted:false,
  device_writes:0,installed:false,installation_ready:false,writer_enabled:false,live_recheck_required:true};
const empty={...prepared,state:"not_started",plan_id:null,plan_sha256:null,requested_data_free_bytes:null};
let calls=[];
assert.deepEqual(await prepareBrowserPlan(async(op,body)=>{calls.push([op,body]);return prepared;},id),prepared);
assert.deepEqual(calls,[["browser-plan",{job_id:id}]]);
calls=[];
assert.deepEqual(await prepareBrowserPlan(async(op,body)=>{calls.push(op);if(body)throw Error("lost ACK");return prepared;},id),prepared);
assert.deepEqual(calls,["browser-plan","jobs/"+id+"/browser-plan"]);
calls=[];
await assert.rejects(prepareBrowserPlan(async(op,body)=>{calls.push(op);if(body)throw Error("lost ACK");return empty;},id),{code:"usb_browser_plan_unverified"});
assert.deepEqual(calls,["browser-plan","jobs/"+id+"/browser-plan"]);
for(const mutation of [{installed:true},{writer_enabled:true},{native_get_devpath:true},{state:"plan_prepared"},
  {device_writes:1},{hardware_contacted:true},{installation_ready:true},{transport_kind:"ha_usb"},
  {requested_data_free_bytes:-1},{api_encryption_key:"secret"},{plan_id:"bad"},{live_recheck_required:false}])
  assert.throws(()=>browserPlanStatus({...prepared,...mutation},id));
assert.throws(()=>planStatus(prepared,id),"Browser status must never reveal the native install control");
assert.throws(()=>browserPlanStatus({...prepared,usb_transport:"usb:invented"},id));
assert.equal(browserPlanStatus(empty,id),empty);
assert.deepEqual(await readBrowserPlan(async op=>{assert.equal(op,"jobs/"+id+"/browser-plan");return prepared;},id),prepared);
for(const lang of ["en","ru"]) for(const state of ["browser_plan_prepared","browser_plan_unverified","browser_plan_failed"])
  assert.ok(strings[lang]["plan_"+state]);
assert.deepEqual(Object.keys(strings.en).sort(),Object.keys(strings.ru).sort());
console.log("Browser plans: distinct schema, no native writer, one POST and status-only lost-ACK reconciliation passed");

// Execute the actual shared wizard module against a small DOM and authenticated
// transport fixture. This catches route/state mistakes that parser tests cannot:
// a browser job must not first read native install status and get stuck there.
const {readFile}=await import("node:fs/promises");
const {runInNewContext}=await import("node:vm");
const preparation=await import("../custom_components/qingping_esphome/frontend/usb-preparation.mjs");
const builds=await import("../custom_components/qingping_esphome/frontend/usb-build.mjs");
const nativePlans=await import("../custom_components/qingping_esphome/frontend/usb-plan.mjs");
const browserPlans=await import("../custom_components/qingping_esphome/frontend/usb-browser-plan.mjs");
const appSource=await readFile(new URL("../apps/monitor1_usb/rootfs/static/app.mjs",import.meta.url),"utf8");
async function appFixture(lost=false) {
  const elements=new Map(),requests=[];
  function element(id) {
    if(!elements.has(id)) elements.set(id,{value:id==="transport" ? "browser" : "",hidden:false,disabled:false,checked:false,textContent:"",
      dataset:{},style:{},setAttribute(){},removeAttribute(){},replaceChildren(){},append(){}});
    return elements.get(id);
  }
  const job={job_id:id,stage:"profile_prepared",model:"CGS1",co2_type:2,transport:"browser_usb",
    node_name:"fixture-cgs1",friendly_name:"Synthetic monitor",live_recheck_required:true,installed:false,installation_ready:false};
  let status=empty;
  const deps={embedded:true,strings,...preparation,...builds,...nativePlans,...browserPlans,
    coreFetch:async(operation,data)=>{
      requests.push([operation,data]);
      let result;
      if(operation==="tools-status") result={state:"tools_ready"};
      else if(operation==="jobs") result={jobs:[job]};
      else if(operation==="jobs/"+id) result=job;
      else if(operation==="jobs/"+id+"/build") result={job_id:id,state:"built_not_installed",phase:"complete",hardware_contacted:false,installed:false,installation_ready:false};
      else if(operation==="jobs/"+id+"/browser-plan") result=status;
      else if(operation==="browser-plan") {
        if(lost) throw Error("synthetic lost response");
        result=status=prepared;
      } else throw Error("Unexpected operation "+operation);
      return new Response(JSON.stringify(result),{headers:{"Content-Type":"application/json"}});
    }};
  // Preserve every real function/event handler in app.mjs; replace only its
  // ES module imports so the fixture can supply the surrounding HA/DOM edge.
  const source=appSource.replace(/import\s*\{([\s\S]*?)\}\s*from\s*"[^"]+";/g,(_,names)=>`const {${names}}=deps;`);
  const context={deps,document:{getElementById:element,querySelector:()=>({content:"test-page-nonce"}),
      querySelectorAll:()=>[],createElement:()=>({}),documentElement:{}},window:{addEventListener(){},isSecureContext:true},navigator:{usb:{}},
    localStorage:{getItem:()=>"en",setItem(){}},setTimeout,clearTimeout,AbortSignal,Response,crypto:globalThis.crypto,console};
  runInNewContext(source,context,{filename:"actual-shared-wizard.mjs"});
  await new Promise(resolve=>setImmediate(resolve));
  element("saved-job").value=id;
  await element("saved-job").onchange();
  assert.ok(!element("prepare-plan").disabled);
  assert.ok(element("install-controls").hidden);
  assert.ok(!requests.some(([op])=>op.endsWith("/install") || op.endsWith("/plan")));
  await element("prepare-plan").onclick();
  assert.equal(requests.filter(([op])=>op==="browser-plan").length,1);
  assert.ok(element("install-controls").hidden,"Detached browser files never reveal native writer");
  assert.ok(element("prepare-plan").disabled,"Consumed/unknown preparation is not repeatable");
  const before=requests.length;
  element("language").value="ru";
  element("language").onchange();
  assert.equal(requests.length,before,"Language changes preserve the operation instead of sending it again");
  assert.ok(element("plan-result").textContent.includes(strings.ru[lost ? "plan_browser_plan_unverified" : "plan_browser_plan_prepared"]));
  await element("prepare-plan").onclick();
  assert.equal(requests.filter(([op])=>op==="browser-plan").length,1);
}
await appFixture();
await appFixture(true);
console.log("Actual shared wizard: browser job restore, detached plan, RU retention, lost ACK and no native writer passed");
