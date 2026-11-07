/** Detached WebUSB payload; never accepted by the native plan parser.
 * The long private build does not require holding USB open. A future writer
 * must independently join a fresh live handle and consume its own intent.
 */
const fail=()=>{throw {code:"usb_browser_plan_unverified"};};
const states=["not_started","browser_plan_prepared","browser_plan_unverified","browser_plan_failed"];
export function browserPlanStatus(value,id) {
  const keys=["job_id","state","plan_id","plan_sha256","requested_data_free_bytes","transport_kind",
    "native_get_devpath","hardware_contacted","device_writes","installed","installation_ready","writer_enabled","live_recheck_required"];
  if(!value || Object.keys(value).sort().join()!==keys.sort().join() || !/^[a-f0-9]{32}$/.test(id) ||
    value.job_id!==id || !states.includes(value.state) || value.transport_kind!=="browser_webusb" ||
    ["native_get_devpath","hardware_contacted","installed","installation_ready","writer_enabled"].some(key=>value[key]!==false) ||
    value.device_writes!==0 || value.live_recheck_required!==true) fail();
  if(value.state==="browser_plan_prepared") {
    if(!/^[a-f0-9]{32}$/.test(value.plan_id) || !/^[a-f0-9]{64}$/.test(value.plan_sha256) ||
      !Number.isInteger(value.requested_data_free_bytes) || value.requested_data_free_bytes<=0 || value.requested_data_free_bytes>256*1024*1024) fail();
  } else if([value.plan_id,value.plan_sha256,value.requested_data_free_bytes].some(v=>v!==null)) fail();
  return value;
}
export async function readBrowserPlan(rpc,id) {
  if(!/^[a-f0-9]{32}$/.test(id)) fail();
  return browserPlanStatus(await rpc("jobs/"+id+"/browser-plan"),id);
}
export async function prepareBrowserPlan(rpc,id) {
  if(!/^[a-f0-9]{32}$/.test(id)) fail();
  try {return browserPlanStatus(await rpc("browser-plan",{job_id:id}),id);}
  catch(error) {
    if(["usb_unauthorized","usb_browser_plan_build_required","usb_browser_plan_transport_required","usb_browser_plan_source_required"].includes(error?.code)) throw error;
    try {
      const result=await readBrowserPlan(rpc,id);
      if(result.state!=="not_started") return result;
    } catch {}
    fail(); // An empty status after a lost POST never authorizes another POST.
  }
}
