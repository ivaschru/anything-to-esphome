/** Offline payload only. A prepared plan is never device-write authority. */
const fail=()=>{throw {code:"usb_plan_unverified"};};
const states=["not_prepared","plan_prepared","plan_unverified","plan_failed","build_required","browser_adapter_pending"];
export function planStatus(value,id) {
  const keys=["job_id","state","requested_data_free_bytes","hardware_contacted","device_writes","installed","installation_ready","live_recheck_required"];
  if (!value || Object.keys(value).sort().join()!==keys.sort().join() || !/^[a-f0-9]{32}$/.test(id) ||
      value.job_id!==id || !states.includes(value.state) || value.hardware_contacted!==false ||
      value.device_writes!==0 || value.installed!==false || value.installation_ready!==false ||
      value.live_recheck_required!==true) fail();
  if(value.state==="plan_prepared" ? (!Number.isInteger(value.requested_data_free_bytes) || value.requested_data_free_bytes<=0 || value.requested_data_free_bytes>256*1024*1024)
    : value.requested_data_free_bytes!==null) fail();
  return value;
}
export async function readPlan(rpc,id) {
  if(!/^[a-f0-9]{32}$/.test(id)) fail();
  return planStatus(await rpc("jobs/"+id+"/plan"),id);
}
export async function preparePlan(rpc,id) {
  if(!/^[a-f0-9]{32}$/.test(id)) fail();
  try {return planStatus(await rpc("plan",{job_id:id}),id);}
  catch(error) {
    if(["usb_unauthorized","usb_plan_build_required","usb_plan_browser_pending"].includes(error?.code)) throw error;
    try {
      const result=await readPlan(rpc,id);
      if(result.state!=="not_prepared") return result;
    } catch {}
    fail(); // GET not_prepared after a lost POST is not retry authority.
  }
}
