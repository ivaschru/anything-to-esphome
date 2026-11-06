/** Build-only owner job. Never repeat POST after any ambiguous response. */
const fail=code=>{throw {code};};
const states={not_started:["unverified"],building:["source","sdk","compile"],
  built_not_installed:["complete"],build_failed:["failed"],build_unverified:["unverified"]};
export function buildStatus(value,jobId) {
  if (!value || Object.keys(value).sort().join()!==
      ["job_id","state","phase","hardware_contacted","installed","installation_ready"].sort().join() ||
      !/^[a-f0-9]{32}$/.test(jobId) || value.job_id!==jobId ||
      !states[value.state]?.includes(value.phase) || value.hardware_contacted!==false ||
      value.installed!==false || value.installation_ready!==false) fail("usb_build_unverified");
  return value;
}
export async function readBuild(rpc,jobId) {
  if (!/^[a-f0-9]{32}$/.test(jobId)) fail("usb_request_invalid");
  return buildStatus(await rpc("jobs/"+jobId+"/build"),jobId);
}
export async function startBuild(rpc,jobId) {
  if (!/^[a-f0-9]{32}$/.test(jobId)) fail("usb_request_invalid");
  try {return buildStatus(await rpc("build",{job_id:jobId}),jobId);}
  catch(error) {
    if (["usb_unauthorized","usb_build_space","usb_build_busy","usb_preparation_unverified"].includes(error?.code)) throw error;
    // A consumed or lost start can only be reconciled by reading the original
    // job. A not_started result after a lost ACK is not permission to resubmit.
    try {
      const result=await readBuild(rpc,jobId);
      if(result.state!=="not_started") return result;
    } catch {}
    fail("usb_build_unverified");
  }
}
