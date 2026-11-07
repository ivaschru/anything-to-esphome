import {embedded, coreFetch} from "./core-bridge.mjs";
import {createProbe, strings, downloadCapture, prepareProfile, readPrepared, savedPreparations, startBuild, readBuild, preparePlan, readPlan,prepareBrowserPlan,readBrowserPlan,reviewBrowserPlan,createNativeChannel,openBrowserControl,
  startInstall, readInstall, readInstallReview, observeBoot,reviewFullUi, startFullUiTrial,readFullUiTrial,startFullUiActivation,readFullUiActivation,startPmExtension,readPmExtension,startEnrollment,readEnrollment,
  downloadPrivateProfile,downloadComputerPackage} from "./usb-probe-bundle.mjs";
const $ = id => document.getElementById(id);
const nonce = document.querySelector('meta[name="qingping-page-nonce"]').content;
let coreToolsReady=false,coreToolsState="tools_required";
let language = "en", busy = embedded, probe, lastError, lastStatus, devices = [], captureProgress;
let pendingPreparation, preparationReady=false;
let storedJobs=[];
let buildState, buildTimer;
let planState,browserScopeState,browserControl,browserLink,unloading=false;
let installState,installReview,bootState;
let installRunning=false,bootReading=false;
let computerDownloaded=false;
let fullReviewState,fullReviewReading=false;
let fullTrialState,fullTrialRunning=false;
// Only a language preference is stored in the browser. This in-memory fence
// also prevents another click after an ambiguous POST in this page lifetime;
// the backend's durable owner intent protects reloads and server restarts.
const attemptedFullTrials=new Set();
const attemptedFullActivations=new Set();
let fullActivationState,fullActivationRunning=false;
let pmState,pmRunning=false;
const attemptedPm=new Set();
let enrollmentState,enrollmentRunning=false;
const attemptedEnrollments=new Set();
try {language = localStorage.getItem("qingping-esphome-language") === "ru" ? "ru" : "en";} catch {}
const text = key => strings[language][key] || strings[language].failed;
function translate() {
  document.documentElement.lang = language; $("language").value = language;
  document.querySelectorAll("[data-text]").forEach(node => {node.textContent = text(node.dataset.text);});
  $("transport-help").textContent = text($("transport").value === "ha" ? "ha_help" : "browser_help");
  if (lastStatus) $("status").textContent = text(lastStatus);
  if (lastError) $("error").textContent = text(lastError);
  if (lastStatus === "copying" && captureProgress !== undefined)
    $("status").textContent = text("copying") + ` ${captureProgress}/9`;
  $("capture-progress").setAttribute("aria-label", text("copying"));
  $("preparation-result").textContent=preparationReady ? text("profile_prepared") : "";
  if(embedded) $("core-tools-status").textContent=text("core_"+coreToolsState);
  renderDevices();
  renderJobs();
  renderBuild();
}
// Browser payloads remain a distinct typed route. In particular, their
// prepared state must never reveal or enable the native USB install control.
const browserPlanning=()=>embedded && pendingPreparation?.transport==="browser_usb";
const emptyPlanState=()=>browserPlanning() ? "not_started" : "not_prepared";
const unknownPlanState=()=>browserPlanning() ? "browser_plan_unverified" : "plan_unverified";
function renderBuild() {
  $("build-controls").hidden=!preparationReady;
  $("backup-controls").hidden=!preparationReady;
  $("export-profile").disabled=$("export-originals").disabled=busy || !preparationReady;
  $("build-firmware").disabled=busy || !preparationReady || (buildState && buildState.state!=="not_started");
  $("build-status").disabled=busy || !pendingPreparation;
  $("build-result").textContent=buildState ? text("build_"+buildState.state)+
    (buildState.state==="building" ? " "+text("build_phase_"+buildState.phase) : "") : "";
  $("plan-controls").hidden=buildState?.state!=="built_not_installed";
  $("prepare-plan").disabled=busy || !pendingPreparation || (planState && planState.state!==emptyPlanState());
  $("plan-status").disabled=busy || !pendingPreparation;
  $("plan-result").textContent=planState ? text(browserPlanning() && planState.state==="not_started" ? "browser_plan_not_started" : "plan_"+planState.state)+
    (["plan_prepared","browser_plan_prepared"].includes(planState.state) ? ` ${Math.ceil(planState.requested_data_free_bytes/1048576)} MiB` : "") : "";
  $("browser-review-controls").hidden=!browserPlanning() || planState?.state!=="browser_plan_prepared";
  $("browser-review").disabled=busy;
  $("browser-review-result").textContent=browserScopeState ? text("browser_review_"+browserScopeState) : "";
  const consumed=installState && installState.state!=="not_started";
  $("computer-controls").hidden=buildState?.state!=="built_not_installed" || !!consumed;
  $("export-computer").disabled=busy || !pendingPreparation || !!consumed;
  $("computer-result").textContent=computerDownloaded ? text("computer_downloaded") : "";
  $("prepare-plan").hidden=$("plan-status").hidden=!!consumed;
  if(consumed) $("plan-result").textContent=text("plan_used");
  $("prepare-plan").disabled=!!$("prepare-plan").disabled || !!consumed;
  $("install-controls").hidden=planState?.state!=="plan_prepared" && !consumed;
  const selectedJob=storedJobs.find(job=>job.job_id===pendingPreparation?.id);
  $("install-target").textContent=installReview ? `${installReview.friendly_name} · CGS1 · ${installReview.co2_type===2 ? "S8" : "SCD40"} · ${installReview.wlan_mac}` : (selectedJob?.friendly_name || "");
  $("install-ack").disabled=busy || !!consumed || !installReview;
  $("install-ack-label").hidden=$("install-firmware").hidden=!!consumed;
  $("install-firmware").disabled=busy || !!consumed || !installReview || !$("install-ack").checked;
  $("install-status").disabled=busy || !pendingPreparation;
  $("install-result").textContent=installRunning ? text("install_running") : (installState ? text("install_"+installState.state) : "");
  $("install-progress").hidden=!installRunning;
  $("install-progress").setAttribute("aria-label",text("install_running"));
  $("observe-boot").hidden=!consumed;
  $("observe-boot").disabled=busy;
  $("boot-result").textContent=bootReading ? text("boot_checking") : (bootState ? text("boot_"+bootState.state) : "");
  $("pm-controls").hidden=!pmState || (pmState.state==="not_started" && fullReviewState?.state!=="pm_extension_required");
  const pmConsumed=pmState?.state!=="not_started" || attemptedPm.has(pendingPreparation?.id);
  $("pm-ack-label").hidden=$("pm-enable").hidden=pmConsumed || !pmState?.pm_available;
  $("pm-ack").disabled=busy;
  $("pm-enable").disabled=busy || pmConsumed || !pmState?.pm_available || !installReview || !$("pm-ack").checked ||
    fullReviewState?.state!=="pm_extension_required";
  $("pm-status").disabled=busy;
  $("pm-compatibility").textContent=pmState?.state==="not_started" && pmState.pm_available===false ? text("usb_pm_extension_bridge_required") : "";
  $("pm-result").textContent=pmRunning ? text("pm_running") : (pmState ? text("pm_"+pmState.state) : "");
  $("pm-progress").hidden=!pmRunning;
  $("pm-progress").setAttribute("aria-label",text("pm_running"));
  $("pm-controls").setAttribute("aria-busy",String(pmRunning));
  $("full-review-controls").hidden=installState?.state!=="bridge_observed";
  $("full-review").disabled=busy;
  $("full-review-result").textContent=fullReviewReading ? text("full_review_reading") : (fullReviewState ? text("full_review_"+fullReviewState.state) : "");
  $("full-trial-controls").hidden=!fullTrialState;
  const trialConsumed=fullTrialState?.state!=="not_started" || attemptedFullTrials.has(pendingPreparation?.id);
  $("full-trial-ack-label").hidden=$("full-trial").hidden=trialConsumed || !fullTrialState?.trial_available;
  $("full-trial-ack").disabled=busy || fullReviewState?.state!=="full_ui_preflight_observed";
  $("full-trial").disabled=busy || trialConsumed || !installReview || !$("full-trial-ack").checked ||
    fullReviewState?.state!=="full_ui_preflight_observed";
  $("full-trial-status").disabled=busy;
  $("full-trial-compatibility").textContent=fullTrialState?.trial_available===false ? text("usb_full_ui_trial_rebuild_required") : "";
  $("full-trial-result").textContent=fullTrialRunning ? text("full_trial_running") :
    (fullTrialState ? text("full_trial_"+fullTrialState.state) : "");
  $("full-trial-progress").hidden=!fullTrialRunning;
  $("full-trial-progress").setAttribute("aria-label",text("full_trial_running"));
  $("full-trial-controls").setAttribute("aria-busy",String(fullTrialRunning));
  const activationConsumed=fullActivationState?.state!=="not_started" || attemptedFullActivations.has(pendingPreparation?.id);
  $("full-activation-controls").hidden=!fullActivationState;
  $("full-activation-ack-label").hidden=$("full-screen-ack-label").hidden=$("full-activate").hidden=
    activationConsumed || !fullActivationState?.activation_available;
  $("full-activation-ack").disabled=$("full-screen-ack").disabled=busy;
  $("full-activate").disabled=busy || activationConsumed || !installReview || !fullActivationState?.activation_available ||
    !$("full-screen-ack").checked || !$("full-activation-ack").checked;
  $("full-activation-status").disabled=busy;
  $("full-activation-result").textContent=fullActivationRunning ? text("full_activation_running") :
    (fullActivationState ? text("full_activation_"+fullActivationState.state) : "");
  $("full-activation-progress").hidden=!fullActivationRunning;
  $("full-activation-progress").setAttribute("aria-label",text("full_activation_running"));
  $("full-activation-controls").setAttribute("aria-busy",String(fullActivationRunning));
  $("enrollment-controls").hidden=!embedded || !enrollmentState;
  const enrollmentConsumed=enrollmentState?.state!=="not_started" || attemptedEnrollments.has(pendingPreparation?.id);
  $("enrollment-ack-label").hidden=$("enrollment-start").hidden=enrollmentConsumed || !enrollmentState?.enrollment_available;
  $("enrollment-ack").disabled=busy;
  $("enrollment-start").disabled=busy || enrollmentConsumed || !installReview || !enrollmentState?.enrollment_available || !$("enrollment-ack").checked;
  $("enrollment-status").disabled=busy;
  $("enrollment-result").textContent=enrollmentRunning ? text("enrollment_running") : (enrollmentState ? text("enrollment_"+enrollmentState.state) : "");
  $("enrollment-progress").hidden=!enrollmentRunning;
  $("enrollment-progress").setAttribute("aria-label",text("enrollment_running"));
  $("enrollment-controls").setAttribute("aria-busy",String(enrollmentRunning));
}
function resetBuild() {clearTimeout(buildTimer);buildTimer=undefined;buildState=undefined;planState=undefined;browserScopeState=undefined;computerDownloaded=false;
  installState=installReview=bootState=fullReviewState=fullTrialState=fullActivationState=pmState=enrollmentState=undefined;
  $("install-ack").checked=$("full-trial-ack").checked=$("full-screen-ack").checked=$("full-activation-ack").checked=$("pm-ack").checked=$("enrollment-ack").checked=false;renderBuild();}
function controls() {
  $("transport").disabled = $("scan").disabled = $("device").disabled = busy;
  $("capture").disabled = $("inspect").disabled = busy || ($("transport").value === "ha" && !$("device").value);
  $("prepare-profile").disabled=$("capture").disabled;
  $("friendly-name").disabled=busy;
  $("preparation-status").disabled=busy;
  $("preparation-status").hidden=!pendingPreparation;
  $("refresh-jobs").disabled=$("saved-job").disabled=busy;
  $("ha-picker").hidden = $("transport").value !== "ha";
  if(embedded) {
    $("core-tools-prepare").disabled=busy || coreToolsReady;
    $("core-tools").setAttribute("aria-busy",String(busy && coreToolsState==="tools_preparing"));
    if(!coreToolsReady) {
      $("scan").disabled=true;
      $("prepare-profile").disabled=true;
      if($("transport").value==="ha") $("capture").disabled=$("inspect").disabled=true;
    }
  }
  renderBuild();
}
function clear() {$("identity").replaceChildren(); $("status").textContent = $("error").textContent = "";lastError = lastStatus = null;
  captureProgress=undefined;$("capture-progress").hidden=true;$("capture-progress").removeAttribute("value");
  pendingPreparation=undefined;preparationReady=false;$("preparation-result").textContent="";$("saved-job").value="";resetBuild();}
function renderJobs() {
  const selected=$("saved-job").value;$("saved-job").replaceChildren();
  const initial=document.createElement("option");initial.value="";initial.textContent=text("choose_preparation");$("saved-job").append(initial);
  for(const job of storedJobs) {
    const option=document.createElement("option");option.value=job.job_id;
    option.textContent=job.friendly_name+" · "+(job.co2_type===2 ? "S8" : "SCD40")+" · …"+job.node_name.slice(-4)+
      (job.stage==="preparation_unverified" ? " · "+text("preparation_pending") : "");
    if(storedJobs.filter(other=>other.friendly_name===job.friendly_name && other.co2_type===job.co2_type && other.node_name===job.node_name).length>1)
      option.textContent+=" · #"+job.job_id.slice(-6); // Disambiguate separate private keys/jobs, not new devices.
    $("saved-job").append(option);
  }
  if(storedJobs.some(job=>job.job_id===selected)) $("saved-job").value=selected;
  $("saved-job").hidden=$("saved-job-label").hidden=storedJobs.length===0;
}
function renderDevices() {
  const selected = $("device").value;
  $("device").replaceChildren();
  const initial = document.createElement("option");initial.value = "";initial.textContent = text("choose");$("device").append(initial);
  for (const serial of devices) {
    const option = document.createElement("option");option.value = option.textContent = serial;$("device").append(option);
  }
  if (devices.includes(selected)) $("device").value = selected;
}
async function rpc(operation, data, binary=false) {
  const duration=operation==="browser-review" ? 200000 : operation==="enroll" ? 300000 : operation==="pm-enable" ? 400000 : operation==="full-activate" ? 800000 : operation==="full-trial" ? 700000 : operation==="browser-plan" || operation==="plan" || operation==="install" || operation==="tools" ? 650000 : operation==="full-review" ? 210000 :
    operation==="observe" ? 180000 : (binary || operation==="prepare" ? 250000 : 70000);
  const response = embedded ? await coreFetch(operation,data,duration) : await fetch(operation, {method:data ? "POST" : "GET", credentials:"same-origin",
    headers:{"X-Qingping-Nonce":nonce, ...(data ? {"Content-Type":"application/json"} : {})},
    ...(data ? {body:JSON.stringify(data)} : {}), signal:AbortSignal.timeout(duration)});
  if (binary && response.ok) {
    const length=Number(response.headers.get("Content-Length"));
    const mime=binary==="computer" ? "application/vnd.qingping.private-computer-bundle+tar" : (
      binary==="profile" ? "application/vnd.qingping.private-profile+json" : "application/x-tar");
    const binaryError=binary==="profile" || operation.startsWith("export-") ? "usb_private_export_unverified" : "usb_capture_unverified";
    if (response.headers.get("Content-Type") !== mime || !Number.isInteger(length) ||
        length <= 0 || length > (binary==="profile" ? 16384 : (binary==="computer" ? 64*1024*1024 : 33*1024*1024))) throw {code:binaryError};
    const reader=response.body.getReader(), chunks=[];let size=0;
    try {
      while (true) {
        const {done,value}=await reader.read();if (done) break;
        size+=value.length;if (size>length) throw {code:binaryError};chunks.push(value);
      }
    } finally {reader.releaseLock();}
    if (size!==length) throw {code:binaryError};
    return new Blob(chunks,{type:mime});
  }
  const result = await response.json();
  if (!response.ok || result.error_code) throw {code:result.error_code || "failed"};
  return result;
}
$("language").onchange = () => {
  language = $("language").value === "ru" ? "ru" : "en";
  try {localStorage.setItem("qingping-esphome-language",language);} catch {}
  translate(); // Same DOM/transport; language never restarts USB or repeats a read.
};
$("transport").value = navigator.usb && window.isSecureContext ? "browser" : "ha";
$("transport").onchange = () => {if (busy) return;clear();translate();controls();};
$("device").onchange = () => {clear();controls();};
$("scan").onclick = async () => {
  if (busy) return;
  busy=true;clear();controls();
  lastStatus="searching";$("status").textContent=text(lastStatus);
  try {devices=(await rpc("devices")).devices;renderDevices();lastStatus=devices.length ? "found" : "no_devices";$("status").textContent=text(lastStatus);}
  catch(error) {lastStatus=null;$("status").textContent="";lastError=error.code || "failed";$("error").textContent=text(lastError);}
  finally {busy=false;controls();}
};
async function inspect(capture=false) {
  if (busy) return;
  busy=true;clear();controls();lastStatus=capture ? "copying" : "checking";$("status").textContent=text(lastStatus);
  if (capture) $("capture-progress").hidden=false;
  try {
    let result;
    if ($("transport").value === "browser") {
      probe=createProbe();
      result=await (capture ? probe.capture(done=>{
        captureProgress=done;$("capture-progress").value=done;
        $("status").textContent=text("copying")+` ${done}/9`;
      }) : probe.select()); // No await before the actual native picker.
    } else {
      if (capture) {
        const archive=await rpc("capture",{serial:$("device").value},true);
        downloadCapture(archive);lastStatus="capture_success";$("status").textContent=text(lastStatus);
        return;
      }
      result=await rpc("inspect",{serial:$("device").value});
    }
    for (const [key,value] of [["model",result.model],["version",result.stock_version],
      ["co2",result.co2_type===2 ? "SenseAir S8" : "SCD40"],["mac",result.wlan_mac]]) {
      const label=document.createElement("dt"), content=document.createElement("dd");
      label.dataset.text=key;label.textContent=text(key);content.textContent=value;$("identity").append(label,content);
    }
    if (capture) downloadCapture(result.archive);
    lastStatus=capture ? "capture_success" : "success";$("status").textContent=text(lastStatus);
  } catch(error) {lastStatus=null;$("status").textContent="";lastError=error.code || "failed";$("error").textContent=text(lastError);}
  finally {probe=undefined;busy=false;captureProgress=undefined;$("capture-progress").hidden=true;controls();}
}
$("inspect").onclick=()=>inspect();
$("capture").onclick=()=>inspect(true);
async function exportPrivate(profile=false) {
  if(busy || !preparationReady || !pendingPreparation) return;
  busy=true;controls();lastError=null;$("error").textContent="";
  try {
    const blob=await rpc(profile ? "export-profile" : "export-originals",{job_id:pendingPreparation.id},profile ? "profile" : true);
    if(profile) downloadPrivateProfile(blob);else downloadCapture(blob);
    lastStatus="private_backup_downloaded";$("status").textContent=text(lastStatus);
  } catch(error) {lastError=error.code || "usb_private_export_unverified";$("error").textContent=text(lastError);}
  finally {busy=false;controls();}
}
$("export-profile").onclick=()=>exportPrivate(true);
$("export-originals").onclick=()=>exportPrivate();
$("prepare-profile").onclick=async()=>{
  if (busy) return;
  const name=$("friendly-name").value;
  if (!name.trim()) {lastError="usb_profile_name_invalid";$("error").textContent=text(lastError);$("friendly-name").focus();return;}
  busy=true;clear();
  pendingPreparation={id:crypto.randomUUID().replaceAll("-",""),
    transport:$("transport").value==="browser" ? "browser_usb" : "ha_usb"};
  controls();lastStatus="preparing_profile";$("status").textContent=text(lastStatus);
  try {
    let source;
    if ($("transport").value==="browser") {
      probe=createProbe();$("capture-progress").hidden=false;
      const result=await probe.capture(done=>{
        captureProgress=done;$("capture-progress").value=done;$("status").textContent=text("copying")+` ${done}/9`;
      }); // Synchronous native picker, before the first await.
      source={archive:result.archive};
    } else source={serial:$("device").value};
    captureProgress=undefined;$("capture-progress").hidden=true;$("status").textContent=text("preparing_profile");
    const job=await prepareProfile(rpc,pendingPreparation.id,name,source);
    storedJobs=[...storedJobs.filter(item=>item.job_id!==job.job_id),job];renderJobs();$("saved-job").value=job.job_id;
    preparationReady=true;lastStatus=null;$("status").textContent="";
    $("preparation-result").textContent=text("profile_prepared");
    buildState={state:"not_started"};
  } catch(error) {lastStatus=null;$("status").textContent="";lastError=error.code || "failed";$("error").textContent=text(lastError);}
  finally {probe=undefined;busy=false;captureProgress=undefined;$("capture-progress").hidden=true;controls();}
};
async function checkPreparation() {
  if(busy || !pendingPreparation) return;
  busy=true;controls();lastError=null;$("error").textContent="";
  try {
    await readPrepared(rpc,pendingPreparation.id,pendingPreparation.transport);
    preparationReady=true;lastStatus=null;$("status").textContent="";
    $("preparation-result").textContent=text("profile_prepared");
    await checkBuild(false);
  } catch {lastError="usb_preparation_unverified";$("error").textContent=text(lastError);}
  finally {busy=false;controls();}
}
$("preparation-status").onclick=()=>checkPreparation();
$("saved-job").onchange=async()=>{
  if(busy) return;
  const job=storedJobs.find(item=>item.job_id===$("saved-job").value);
  pendingPreparation=job ? {id:job.job_id,transport:job.transport} : undefined;
  if(job) {
    $("friendly-name").value=job.friendly_name;
    // Restore the recorded cable location as display state only. Do not
    // scan USB, select a live serial, issue a write or reinterpret the capture.
    $("transport").value=job.transport==="ha_usb" ? "ha" : "browser";
    translate();
  }
  preparationReady=false;$("preparation-result").textContent="";resetBuild();controls();
  if(pendingPreparation) await checkPreparation();
};
async function loadPreparations() {
  if(busy) return;
  busy=true;controls();
  try {
    storedJobs=await savedPreparations(rpc);renderJobs();
    if(pendingPreparation && !storedJobs.some(job=>job.job_id===pendingPreparation.id && job.stage==="profile_prepared")) {
      preparationReady=false;$("preparation-result").textContent="";
    }
  }
  catch {lastError="usb_job_list_failed";$("error").textContent=text(lastError);}
  finally {busy=false;controls();}
}
$("refresh-jobs").onclick=()=>loadPreparations();
$("friendly-name").oninput=()=>{
  if(busy) return;
  pendingPreparation=undefined;preparationReady=false;$("saved-job").value="";$("preparation-result").textContent="";resetBuild();controls();
};
async function checkBuild(manual=true) {
  if(!pendingPreparation || (manual && busy)) return;
  const id=pendingPreparation.id;
  if(manual) {busy=true;controls();}
  clearTimeout(buildTimer);
  try {
    const result=await readBuild(rpc,id);
    if(pendingPreparation?.id!==id) return;
    buildState=result;renderBuild();
    if(result.state==="built_not_installed") {
      if(browserPlanning()) {
        // Reading a browser job never enters the native installation history
        // path, whose distinct transport authority it intentionally lacks.
        installState=undefined;
        await checkPlan(false);
      } else {
        await checkInstall(false);
        if(!installState || installState.state==="not_started") await checkPlan(false);
      }
    }
    // Poll only the same explicitly selected active job. A reload does not
    // select or restart work; owner selection performs GET status only.
    if(result.state==="building") buildTimer=setTimeout(()=>void checkBuild(),5000);
  } catch {if(pendingPreparation?.id===id) {buildState={state:"build_unverified"};renderBuild();}}
  finally {if(manual) {busy=false;controls();}}
}
$("build-status").onclick=()=>checkBuild();
$("build-firmware").onclick=async()=>{
  if(busy || !preparationReady || !pendingPreparation || (buildState && buildState.state!=="not_started")) return;
  busy=true;controls();clearTimeout(buildTimer);lastError=null;$("error").textContent="";
  try {
    buildState=await startBuild(rpc,pendingPreparation.id);renderBuild();
    if(buildState.state==="building") buildTimer=setTimeout(()=>void checkBuild(),5000);
  } catch(error) {
    lastError=error.code || "usb_build_unverified";
    if(lastError==="usb_build_unverified") buildState={state:"build_unverified"};
    $("error").textContent=text(lastError);
  }
  finally {busy=false;controls();}
};
async function checkPlan(manual=true) {
  if(!pendingPreparation || (manual && busy)) return;
  const id=pendingPreparation.id;
  if(manual) {busy=true;controls();}
  try {
    const result=await (browserPlanning() ? readBrowserPlan : readPlan)(rpc,id);
    if(pendingPreparation?.id===id) {
      planState=result;
      if(result.state==="plan_prepared") await loadInstallReview();
      renderBuild();
    }
  } catch {if(pendingPreparation?.id===id) {planState={state:unknownPlanState()};renderBuild();}}
  finally {if(manual) {busy=false;controls();}}
}
$("plan-status").onclick=()=>checkPlan();
$("export-computer").onclick=async()=>{
  if(busy || !pendingPreparation || buildState?.state!=="built_not_installed" ||
     (installState && installState.state!=="not_started")) return;
  busy=true;controls();
  try {
    downloadComputerPackage(await rpc("export-computer",{job_id:pendingPreparation.id},"computer"));
    computerDownloaded=true;
  } catch(error) {lastError=error.code || "usb_private_export_unverified";$("error").textContent=text(lastError);}
  finally {busy=false;controls();}
};
$("prepare-plan").onclick=async()=>{
  if(busy || buildState?.state!=="built_not_installed" || !pendingPreparation ||
    (planState && planState.state!==emptyPlanState())) return;
  busy=true;controls();
  try {planState=await (browserPlanning() ? prepareBrowserPlan : preparePlan)(rpc,pendingPreparation.id);if(planState.state==="plan_prepared") await loadInstallReview();renderBuild();}
  catch(error) {
    lastError=error.code || (browserPlanning() ? "usb_browser_plan_unverified" : "usb_plan_unverified");planState={state:unknownPlanState()};
    $("error").textContent=text(lastError);
  }
  finally {busy=false;controls();}
};
$("browser-review").onclick=async()=>{
  if(busy || !browserPlanning() || planState?.state!=="browser_plan_prepared") return;
  // The picker executes in this original click, before any network await.
  const link=createNativeChannel();browserLink=link;
  const selection=openBrowserControl(link,rpc);
  busy=true;browserScopeState="running";controls();
  try {
    browserControl=await selection;
    if(unloading) throw {code:"usb_channel_unverified"};
    await reviewBrowserPlan(rpc,pendingPreparation.id,planState.plan_sha256,browserControl.channel_id);
    browserScopeState="verified";
  } catch {browserScopeState="unverified";}
  finally {
    if(browserControl) {
      try {if((await browserControl.close())?.state!=="closed") browserScopeState="unverified";}
      catch {browserScopeState="unverified";}
      browserControl=undefined;
    }
    try {await link.close();}catch {browserScopeState="unverified";}
    if(browserLink===link) browserLink=undefined;
    busy=false;controls();
  }
};
async function loadInstallReview() {
  const id=pendingPreparation?.id;if(!id) return;
  try {
    const value=await readInstallReview(rpc,id);
    if(pendingPreparation?.id===id) {installReview=value;if(!installState) installState={state:"not_started"};}
  } catch {installReview=undefined;lastError="usb_install_review_required";$("error").textContent=text(lastError);}
}
async function checkInstall(manual=true) {
  if(!pendingPreparation || (manual && busy)) return;
  const id=pendingPreparation.id;
  if(manual) {busy=true;controls();}
  try {
    const value=await readInstall(rpc,id);
    if(pendingPreparation?.id===id) {
      installState=value;
      if(value.state!=="not_started") await loadInstallReview();
      if(value.state==="bridge_observed") {await checkPm(false);await checkFullTrial(false);}
      renderBuild();
    }
  } catch {if(pendingPreparation?.id===id) {installState={state:"install_unverified"};renderBuild();}}
  finally {if(manual) {busy=false;controls();}}
}
$("install-ack").onchange=()=>renderBuild();
$("install-status").onclick=()=>checkInstall();
$("full-review").onclick=async()=>{
  if(busy || !pendingPreparation || installState?.state!=="bridge_observed") return;
  busy=true;fullReviewReading=true;controls();
  try {fullReviewState=await reviewFullUi(rpc,pendingPreparation.id);await checkPm(false);await checkFullTrial(false);}
  catch(error) {lastError=error.code || "usb_full_ui_unverified";$("error").textContent=text(lastError);fullReviewState={state:"full_ui_unverified"};}
  finally {busy=false;fullReviewReading=false;controls();}
};
async function checkPm(manual=true) {
  if(!pendingPreparation || (manual && busy)) return;
  const id=pendingPreparation.id;
  if(manual) {busy=true;controls();}
  try {const value=await readPmExtension(rpc,id);if(pendingPreparation?.id===id) pmState=value;}
  catch {if(pendingPreparation?.id===id) pmState={state:"pm_extension_unverified"};}
  finally {if(manual) busy=false;controls();}
}
$("pm-status").onclick=()=>checkPm();
$("pm-ack").onchange=()=>renderBuild();
$("pm-enable").onclick=async()=>{
  const id=pendingPreparation?.id;
  if(busy || !id || !installReview || pmState?.state!=="not_started" || !pmState.pm_available || attemptedPm.has(id) ||
     fullReviewState?.state!=="pm_extension_required" || !$("pm-ack").checked) return;
  attemptedPm.add(id);busy=true;pmRunning=true;controls();lastError=null;$("error").textContent="";
  try {pmState=await startPmExtension(rpc,installReview,true);}
  catch(error) {lastError=error.code || "usb_pm_extension_unverified";$("error").textContent=text(lastError);pmState={state:"pm_extension_unverified"};}
  finally {busy=false;pmRunning=false;$("pm-ack").checked=false;controls();}
};
async function checkFullTrial(manual=true) {
  if(!pendingPreparation || (manual && busy)) return;
  const id=pendingPreparation.id;
  if(manual) {busy=true;controls();}
  try {
    const value=await readFullUiTrial(rpc,id);
    if(pendingPreparation?.id===id) {
      fullTrialState=value;
      if(value.state==="full_ui_trial_returned_observed") await checkFullActivation(false);
    }
  } catch {if(pendingPreparation?.id===id) fullTrialState={state:"full_ui_trial_unverified"};}
  finally {if(manual) busy=false;controls();}
}
$("full-trial-status").onclick=()=>checkFullTrial();
$("full-trial-ack").onchange=()=>renderBuild();
$("full-trial").onclick=async()=>{
  const id=pendingPreparation?.id;
  if(busy || !id || !installReview || fullTrialState?.state!=="not_started" || !fullTrialState.trial_available ||
     attemptedFullTrials.has(id) || fullReviewState?.state!=="full_ui_preflight_observed" || !$("full-trial-ack").checked) return;
  attemptedFullTrials.add(id); // Consume locally before sending a request.
  busy=true;fullTrialRunning=true;controls();lastError=null;$("error").textContent="";
  try {
    fullTrialState=await startFullUiTrial(rpc,installReview,true);
    if(fullTrialState.state==="full_ui_trial_returned_observed") await checkFullActivation(false);
  }
  catch(error) {
    lastError=error.code || "usb_full_ui_trial_unverified";$("error").textContent=text(lastError);
    fullTrialState={state:"full_ui_trial_unverified"};
  } finally {busy=false;fullTrialRunning=false;$("full-trial-ack").checked=false;controls();}
};
async function checkFullActivation(manual=true) {
  if(!pendingPreparation || (manual && busy)) return;
  const id=pendingPreparation.id;
  if(manual) {busy=true;controls();}
  try {
    const value=await readFullUiActivation(rpc,id);
    if(pendingPreparation?.id===id) {fullActivationState=value;if(value.state==="full_ui_active_observed") await checkEnrollment(false);}
  } catch {if(pendingPreparation?.id===id) fullActivationState={state:"full_ui_activation_unverified"};}
  finally {if(manual) busy=false;controls();}
}
$("full-activation-status").onclick=()=>checkFullActivation();
$("full-screen-ack").onchange=$("full-activation-ack").onchange=()=>renderBuild();
$("full-activate").onclick=async()=>{
  const id=pendingPreparation?.id;
  if(busy || !id || !installReview || fullActivationState?.state!=="not_started" || !fullActivationState.activation_available ||
     attemptedFullActivations.has(id) || !$("full-screen-ack").checked || !$("full-activation-ack").checked) return;
  attemptedFullActivations.add(id); // A second click cannot resend a lost request.
  busy=true;fullActivationRunning=true;controls();lastError=null;$("error").textContent="";
  try {fullActivationState=await startFullUiActivation(rpc,installReview,true,true);if(fullActivationState.state==="full_ui_active_observed") await checkEnrollment(false);}
  catch(error) {
    lastError=error.code || "usb_full_ui_activation_unverified";$("error").textContent=text(lastError);
    fullActivationState={state:"full_ui_activation_unverified"};
  } finally {
    busy=false;fullActivationRunning=false;$("full-screen-ack").checked=$("full-activation-ack").checked=false;controls();
  }
};
async function checkEnrollment(manual=true) {
  if(!embedded || !pendingPreparation || (manual && busy)) return;
  const id=pendingPreparation.id;
  if(manual) {busy=true;controls();}
  try {const value=await readEnrollment(rpc,id);if(pendingPreparation?.id===id) enrollmentState=value;}
  catch {if(pendingPreparation?.id===id) enrollmentState={state:"unverified"};}
  finally {if(manual) busy=false;controls();}
}
$("enrollment-status").onclick=()=>checkEnrollment();
$("enrollment-ack").onchange=()=>renderBuild();
$("enrollment-start").onclick=async()=>{
  const id=pendingPreparation?.id;
  if(busy || !embedded || !id || !installReview || enrollmentState?.state!=="not_started" ||
     !enrollmentState.enrollment_available || attemptedEnrollments.has(id) || !$("enrollment-ack").checked) return;
  attemptedEnrollments.add(id);busy=true;enrollmentRunning=true;controls();lastError=null;$("error").textContent="";
  try {enrollmentState=await startEnrollment(rpc,installReview,true);}
  catch(error) {lastError=error.code || "usb_enrollment_unverified";$("error").textContent=text(lastError);enrollmentState={state:"unverified"};}
  finally {busy=false;enrollmentRunning=false;$("enrollment-ack").checked=false;controls();}
};
$("install-firmware").onclick=async()=>{
  if(busy || !installReview || !$("install-ack").checked || installState?.state!=="not_started") return;
  installRunning=true;busy=true;controls();lastError=null;$("error").textContent="";
  try {installState=await startInstall(rpc,installReview,true);}
  catch(error) {
    lastError=error.code || "usb_install_unverified";$("error").textContent=text(lastError);
    if(!["usb_busy","usb_install_host_space","usb_install_review_required","usb_install_plan_required","usb_unauthorized"].includes(lastError))
      installState={state:"install_unverified"};
  } finally {installRunning=false;busy=false;$("install-ack").checked=false;controls();}
};
$("observe-boot").onclick=async()=>{
  if(busy || !pendingPreparation || !installState || installState.state==="not_started") return;
  bootReading=true;busy=true;controls();
  try {
    bootState=await observeBoot(rpc,pendingPreparation.id);
    await checkInstall(false);
  } catch {bootState={state:"boot_unverified"};}
  finally {bootReading=false;busy=false;controls();}
};
window.addEventListener("pagehide",()=>{unloading=true;clearTimeout(buildTimer);void browserLink?.close().catch(()=>{});void probe?.close().catch(()=>{});void browserControl?.close().catch(()=>{});});
if(embedded) {
  $("core-tools").hidden=false;
  $("core-tools-prepare").onclick=async()=>{
    if(busy || coreToolsReady) return;
    busy=true;coreToolsState="tools_preparing";lastError=null;controls();translate();
    try {const result=await rpc("tools",{});coreToolsReady=result.state==="tools_ready";coreToolsState=result.state;}
    catch(error) {lastError=error.code || "usb_core_tools_failed";coreToolsState="tools_required";}
    finally {busy=false;controls();translate();}
  };
  void rpc("tools-status").then(result=>{coreToolsReady=result.state==="tools_ready";coreToolsState=result.state;controls();translate();}).catch(error=>{lastError=error.code;translate();}).finally(()=>{busy=false;controls();void loadPreparations();});
}
translate();controls();if(!embedded) void loadPreparations(); // Owner metadata only; no USB or writer resumes.
