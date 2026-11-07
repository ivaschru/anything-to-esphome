/** Explicit experimental native install. No POST replay or automatic reboot. */
const fail=code=>{throw {code};};
export function installStatus(value,id) {
  const keys=["job_id","state","autostart_armed","installed","installation_ready","replay_allowed","live_recheck_required"];
  if(!value || Object.keys(value).sort().join()!==keys.sort().join() || !/^[a-f0-9]{32}$/.test(id) ||
     value.job_id!==id || !["not_started","install_unverified","armed_waiting_reboot","bridge_observed"].includes(value.state) ||
     value.autostart_armed!==(["armed_waiting_reboot","bridge_observed"].includes(value.state) ? true : null) || value.installed!==false ||
     value.installation_ready!==false || value.replay_allowed!==false || value.live_recheck_required!==true)
    fail("usb_install_unverified");
  return value;
}
export async function readInstall(rpc,id) {
  if(!/^[a-f0-9]{32}$/.test(id)) fail("usb_install_unverified");
  return installStatus(await rpc("jobs/"+id+"/install"),id);
}
export async function readInstallReview(rpc,id) {
  if(!/^[a-f0-9]{32}$/.test(id)) fail("usb_install_review_required");
  const value=await rpc("jobs/"+id+"/install-review");
  const keys=["job_id","plan_sha256","model","co2_type","friendly_name","wlan_mac","stock_version","requested_data_free_bytes","experimental","installation_ready"];
  if(!value || Object.keys(value).sort().join()!==keys.sort().join() || value.job_id!==id ||
     !/^[a-f0-9]{64}$/.test(value.plan_sha256) || value.model!=="CGS1" || ![2,3].includes(value.co2_type) ||
     typeof value.friendly_name!=="string" || !/^[0-9a-f]{2}(?::[0-9a-f]{2}){5}$/.test(value.wlan_mac) ||
     value.stock_version!=="4.1.8_0287" || value.experimental!==true || value.installation_ready!==false ||
     !Number.isInteger(value.requested_data_free_bytes) || value.requested_data_free_bytes<=0)
    fail("usb_install_review_required");
  return value;
}
export async function startInstall(rpc,review,acknowledged) {
  if(acknowledged!==true || !review || !/^[a-f0-9]{32}$/.test(review.job_id) || !/^[a-f0-9]{64}$/.test(review.plan_sha256))
    fail("usb_install_review_required");
  try {
    return installStatus(await rpc("install",{job_id:review.job_id,expected_plan_sha256:review.plan_sha256,
      experimental_reviewed:true}),review.job_id);
  } catch(error) {
    if(["usb_unauthorized","usb_busy","usb_install_review_required","usb_install_plan_required",
        "usb_install_host_space","usb_install_previous_unverified"].includes(error?.code)) throw error;
    try {
      const value=await readInstall(rpc,review.job_id);
      if(value.state!=="not_started") return value;
    } catch {}
    fail("usb_install_unverified");
  }
}
export async function observeBoot(rpc,id) {
  if(!/^[a-f0-9]{32}$/.test(id)) fail("usb_boot_unverified");
  const value=await rpc("observe",{job_id:id});
  if(!value || Object.keys(value).sort().join()!==["job_id","state","runtime_observed","device_writes","installed","installation_ready"].sort().join() ||
     value.job_id!==id || !["bridge_observed","boot_unverified","awaiting_reboot"].includes(value.state) ||
     value.runtime_observed!==(value.state==="bridge_observed") || value.device_writes!==0 ||
     value.installed!==false || value.installation_ready!==false) fail("usb_boot_unverified");
  return value;
}
