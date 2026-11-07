import {createProbe, strings, downloadCapture, prepareProfile, readPrepared, savedPreparations, startBuild, readBuild, preparePlan, readPlan,
  startInstall, readInstall, readInstallReview, observeBoot,reviewFullUi, downloadPrivateProfile,downloadComputerPackage} from "./usb-probe-bundle.mjs";
const $ = id => document.getElementById(id);
const nonce = document.querySelector('meta[name="qingping-page-nonce"]').content;
let language = "en", busy = false, probe, lastError, lastStatus, devices = [], captureProgress;
let pendingPreparation, preparationReady=false;
let storedJobs=[];
let buildState, buildTimer;
let planState;
let installState,installReview,bootState;
let installRunning=false,bootReading=false;
let computerDownloaded=false;
let fullReviewState,fullReviewReading=false;
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
  renderDevices();
  renderJobs();
  renderBuild();
}
function renderBuild() {
  $("build-controls").hidden=!preparationReady;
  $("backup-controls").hidden=!preparationReady;
  $("export-profile").disabled=$("export-originals").disabled=busy || !preparationReady;
  $("build-firmware").disabled=busy || !preparationReady || (buildState && buildState.state!=="not_started");
  $("build-status").disabled=busy || !pendingPreparation;
  $("build-result").textContent=buildState ? text("build_"+buildState.state)+
    (buildState.state==="building" ? " "+text("build_phase_"+buildState.phase) : "") : "";
  $("plan-controls").hidden=buildState?.state!=="built_not_installed";
  $("prepare-plan").disabled=busy || !pendingPreparation || (planState && planState.state!=="not_prepared");
  $("plan-status").disabled=busy || !pendingPreparation;
  $("plan-result").textContent=planState ? text("plan_"+planState.state)+
    (planState.state==="plan_prepared" ? ` ${Math.ceil(planState.requested_data_free_bytes/1048576)} MiB` : "") : "";
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
  $("full-review-controls").hidden=installState?.state!=="bridge_observed";
  $("full-review").disabled=busy;
  $("full-review-result").textContent=fullReviewReading ? text("full_review_reading") : (fullReviewState ? text("full_review_"+fullReviewState.state) : "");
}
function resetBuild() {clearTimeout(buildTimer);buildTimer=undefined;buildState=undefined;planState=undefined;computerDownloaded=false;
  installState=installReview=bootState=fullReviewState=undefined;$("install-ack").checked=false;renderBuild();}
function controls() {
  $("transport").disabled = $("scan").disabled = $("device").disabled = busy;
  $("capture").disabled = $("inspect").disabled = busy || ($("transport").value === "ha" && !$("device").value);
  $("prepare-profile").disabled=$("capture").disabled;
  $("friendly-name").disabled=busy;
  $("preparation-status").disabled=busy;
  $("preparation-status").hidden=!pendingPreparation;
  $("refresh-jobs").disabled=$("saved-job").disabled=busy;
  $("ha-picker").hidden = $("transport").value !== "ha";
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
  const response = await fetch(operation, {method:data ? "POST" : "GET", credentials:"same-origin",
    headers:{"X-Qingping-Nonce":nonce, ...(data ? {"Content-Type":"application/json"} : {})},
    ...(data ? {body:JSON.stringify(data)} : {}), signal:AbortSignal.timeout(operation==="install" ? 650000 :
      operation==="full-review" ? 210000 : (operation==="observe" ? 180000 : (binary || operation==="prepare" ? 250000 : 70000)))});
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
      await checkInstall(false);
      if(!installState || installState.state==="not_started") await checkPlan(false);
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
    const result=await readPlan(rpc,id);
    if(pendingPreparation?.id===id) {
      planState=result;
      if(result.state==="plan_prepared") await loadInstallReview();
      renderBuild();
    }
  } catch {if(pendingPreparation?.id===id) {planState={state:"plan_unverified"};renderBuild();}}
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
    (planState && planState.state!=="not_prepared")) return;
  busy=true;controls();
  try {planState=await preparePlan(rpc,pendingPreparation.id);if(planState.state==="plan_prepared") await loadInstallReview();renderBuild();}
  catch(error) {
    lastError=error.code || "usb_plan_unverified";planState={state:"plan_unverified"};
    $("error").textContent=text(lastError);
  }
  finally {busy=false;controls();}
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
  try {fullReviewState=await reviewFullUi(rpc,pendingPreparation.id);}
  catch(error) {lastError=error.code || "usb_full_ui_unverified";$("error").textContent=text(lastError);fullReviewState={state:"full_ui_unverified"};}
  finally {busy=false;fullReviewReading=false;controls();}
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
window.addEventListener("pagehide",()=>{clearTimeout(buildTimer);void probe?.close().catch(()=>{});});
translate();controls();void loadPreparations(); // Owner metadata only; no USB or writer resumes.
