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
        "usb_install_host_space","usb_install_previous_unverified","usb_pm_extension_previous_unverified"].includes(error?.code)) throw error;
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

/** Separate live read: it never grants a stage/launch or replays installation. */
export async function reviewFullUi(rpc,id) {
  if(!/^[a-f0-9]{32}$/.test(id)) fail("usb_full_ui_unverified");
  const value=await rpc("full-review",{job_id:id});
  const keys=["job_id","state","read_only","device_writes","launch_authorized","installation_ready","installed","live_recheck_required"];
  if(!value || Object.keys(value).sort().join()!==keys.sort().join() || value.job_id!==id ||
     !["full_ui_preflight_observed","pm_extension_required","full_ui_unverified","full_ui_close_unverified"].includes(value.state) ||
     value.read_only!==true || value.device_writes!==0 || value.launch_authorized!==false ||
     value.installation_ready!==false || value.installed!==false || value.live_recheck_required!==true)
    fail("usb_full_ui_unverified");
  return value;
}

/** Historical trial result only: never reinterpret return as installation. */
export function fullTrialStatus(value,id) {
  const keys=["job_id","state","trial_available","hard_runtime_ms","native_observations","stock_return_observed",
    "launch_acknowledged","installed","installation_ready","boot_enabled","replay_allowed","live_recheck_required"];
  if(!value || Object.keys(value).sort().join()!==keys.sort().join() || !/^[a-f0-9]{32}$/.test(id) || value.job_id!==id ||
     !["not_started","full_ui_trial_returned_observed","full_ui_trial_unverified","full_ui_trial_close_unverified",
       "full_ui_trial_rebuild_required"].includes(value.state) || typeof value.trial_available!=="boolean" ||
     value.hard_runtime_ms!==60000 || value.installed!==false || value.installation_ready!==false ||
     value.boot_enabled!==false || value.replay_allowed!==false || value.live_recheck_required!==true)
    fail("usb_full_ui_trial_unverified");
  const unknown=value.native_observations===null && value.stock_return_observed===null && value.launch_acknowledged===null;
  if(!unknown && (!Number.isInteger(value.native_observations) || value.native_observations<0 || value.native_observations>2 ||
      typeof value.stock_return_observed!=="boolean" || typeof value.launch_acknowledged!=="boolean"))
    fail("usb_full_ui_trial_unverified");
  if(value.state==="not_started" && !unknown) fail("usb_full_ui_trial_unverified");
  if(value.state==="full_ui_trial_returned_observed" && (value.native_observations!==2 ||
      value.stock_return_observed!==true || !value.trial_available)) fail("usb_full_ui_trial_unverified");
  return value;
}
export async function readFullUiTrial(rpc,id) {
  if(!/^[a-f0-9]{32}$/.test(id)) fail("usb_full_ui_trial_unverified");
  return fullTrialStatus(await rpc("jobs/"+id+"/full-trial"),id);
}
export async function startFullUiTrial(rpc,review,acknowledged) {
  if(acknowledged!==true || !review || !/^[a-f0-9]{32}$/.test(review.job_id) || !/^[a-f0-9]{64}$/.test(review.plan_sha256))
    fail("usb_full_ui_trial_review_required");
  try {
    return fullTrialStatus(await rpc("full-trial",{job_id:review.job_id,expected_plan_sha256:review.plan_sha256,
      experimental_reviewed:true}),review.job_id);
  } catch(error) {
    if(["usb_unauthorized","usb_busy","usb_full_ui_trial_review_required","usb_full_ui_bridge_required",
       "usb_full_ui_trial_rebuild_required","usb_install_host_space","usb_install_previous_unverified","usb_pm_extension_previous_unverified",
       "usb_full_ui_trial_previous_unverified","usb_pm_extension_previous_unverified"].includes(error?.code)) throw error;
    // A timeout/disconnected page may hide a consumed writer. One GET of
    // the same job is safe; no second POST, reset or automatic activation.
    try {
      const value=await readFullUiTrial(rpc,review.job_id);
      if(value.state!=="not_started") return value;
    } catch {}
    fail("usb_full_ui_trial_unverified");
  }
}

/** Separate permanent decision. A lost reply permits one status GET only. */
export function fullActivationStatus(value,id) {
  const keys=["job_id","state","activation_available","native_observations","store_installed","boot_enabled",
    "start_acknowledged","installed","installation_ready","replay_allowed","live_recheck_required"];
  if(!value || Object.keys(value).sort().join()!==keys.sort().join() || !/^[a-f0-9]{32}$/.test(id) || value.job_id!==id ||
     !["not_started","full_ui_active_observed","full_ui_activation_unverified","full_ui_activation_close_unverified",
       "full_ui_activation_space"].includes(value.state) || typeof value.activation_available!=="boolean" ||
     value.installed!==false || value.installation_ready!==false || value.replay_allowed!==false || value.live_recheck_required!==true ||
     ![null,true,false].includes(value.store_installed) || ![null,true,false].includes(value.boot_enabled) ||
     ![null,true,false].includes(value.start_acknowledged) ||
     !(value.native_observations===null || (Number.isInteger(value.native_observations) && value.native_observations>=0 && value.native_observations<=2)))
    fail("usb_full_ui_activation_unverified");
  if(value.state!=="not_started" && value.activation_available) fail("usb_full_ui_activation_unverified");
  if(value.state==="not_started" && [value.native_observations,value.store_installed,value.boot_enabled,value.start_acknowledged].some(v=>v!==null))
    fail("usb_full_ui_activation_unverified");
  if(value.state==="full_ui_active_observed" && (value.native_observations!==2 || value.store_installed!==true || value.boot_enabled!==true ||
      typeof value.start_acknowledged!=="boolean")) fail("usb_full_ui_activation_unverified");
  return value;
}
export async function readFullUiActivation(rpc,id) {
  if(!/^[a-f0-9]{32}$/.test(id)) fail("usb_full_ui_activation_unverified");
  return fullActivationStatus(await rpc("jobs/"+id+"/full-activate"),id);
}
export async function startFullUiActivation(rpc,review,acknowledged,screenReviewed) {
  if(acknowledged!==true || screenReviewed!==true || !review || !/^[a-f0-9]{32}$/.test(review.job_id) || !/^[a-f0-9]{64}$/.test(review.plan_sha256))
    fail("usb_full_ui_activation_review_required");
  try {
    return fullActivationStatus(await rpc("full-activate",{job_id:review.job_id,expected_plan_sha256:review.plan_sha256,
      experimental_reviewed:true,screen_reviewed:true}),review.job_id);
  } catch(error) {
    if(["usb_unauthorized","usb_busy","usb_full_ui_activation_review_required","usb_full_ui_activation_trial_required",
       "usb_install_host_space","usb_install_previous_unverified","usb_pm_extension_previous_unverified","usb_full_ui_trial_previous_unverified",
       "usb_full_ui_activation_previous_unverified","usb_pm_extension_previous_unverified"].includes(error?.code)) throw error;
    try {const value=await readFullUiActivation(rpc,review.job_id);if(value.state!=="not_started") return value;} catch {}
    fail("usb_full_ui_activation_unverified");
  }
}

/** A distinct next-boot prerequisite, never a replayable activation action. */
export function pmStatus(value,id) {
  const keys=["job_id","state","pm_available","arming_acknowledged","completion_observed","next_boot_armed",
    "installed","installation_ready","replay_allowed","live_recheck_required"];
  if(!value || Object.keys(value).sort().join()!==keys.sort().join() || !/^[a-f0-9]{32}$/.test(id) || value.job_id!==id ||
     !["not_started","pm_extension_unverified","pm_extension_armed_waiting_reboot"].includes(value.state) ||
     typeof value.pm_available!=="boolean" || ![null,true,false].includes(value.arming_acknowledged) ||
     ![null,true,false].includes(value.completion_observed) || value.next_boot_armed!==(value.state==="pm_extension_armed_waiting_reboot" ? true : null) ||
     value.installed!==false || value.installation_ready!==false || value.replay_allowed!==false || value.live_recheck_required!==true)
    fail("usb_pm_extension_unverified");
  if(value.state!=="not_started" && value.pm_available) fail("usb_pm_extension_unverified");
  if(value.state==="not_started" && (value.arming_acknowledged!==null || value.completion_observed!==null)) fail("usb_pm_extension_unverified");
  if(value.state==="pm_extension_armed_waiting_reboot" && (value.completion_observed!==true || typeof value.arming_acknowledged!=="boolean"))
    fail("usb_pm_extension_unverified");
  return value;
}
export async function readPmExtension(rpc,id) {
  if(!/^[a-f0-9]{32}$/.test(id)) fail("usb_pm_extension_unverified");
  return pmStatus(await rpc("jobs/"+id+"/pm-enable"),id);
}
export async function startPmExtension(rpc,review,acknowledged) {
  if(acknowledged!==true || !review || !/^[a-f0-9]{32}$/.test(review.job_id) || !/^[a-f0-9]{64}$/.test(review.plan_sha256))
    fail("usb_pm_extension_review_required");
  try {
    return pmStatus(await rpc("pm-enable",{job_id:review.job_id,expected_plan_sha256:review.plan_sha256,experimental_reviewed:true}),review.job_id);
  } catch(error) {
    if(["usb_unauthorized","usb_busy","usb_pm_extension_review_required","usb_pm_extension_bridge_required","usb_install_host_space",
       "usb_pm_extension_previous_unverified","usb_full_ui_activation_previous_unverified","usb_full_ui_trial_previous_unverified",
       "usb_install_previous_unverified"].includes(error?.code)) throw error;
    try {const value=await readPmExtension(rpc,review.job_id);if(value.state!=="not_started") return value;} catch {}
    fail("usb_pm_extension_unverified");
  }
}
