import {createProbe, strings, downloadCapture} from "./usb-probe-bundle.mjs";
const $ = id => document.getElementById(id);
const nonce = document.querySelector('meta[name="qingping-page-nonce"]').content;
let language = "en", busy = false, probe, lastError, lastStatus, devices = [], captureProgress;
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
  renderDevices();
}
function controls() {
  $("transport").disabled = $("scan").disabled = $("device").disabled = busy;
  $("capture").disabled = $("inspect").disabled = busy || ($("transport").value === "ha" && !$("device").value);
  $("ha-picker").hidden = $("transport").value !== "ha";
}
function clear() {$("identity").replaceChildren(); $("status").textContent = $("error").textContent = "";lastError = lastStatus = null;
  captureProgress=undefined;$("capture-progress").hidden=true;$("capture-progress").removeAttribute("value");}
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
    ...(data ? {body:JSON.stringify(data)} : {}), signal:AbortSignal.timeout(binary ? 250000 : 70000)});
  if (binary && response.ok) {
    const length=Number(response.headers.get("Content-Length"));
    if (response.headers.get("Content-Type") !== "application/x-tar" || !Number.isInteger(length) ||
        length <= 0 || length > 33*1024*1024) throw {code:"usb_capture_unverified"};
    const reader=response.body.getReader(), chunks=[];let size=0;
    try {
      while (true) {
        const {done,value}=await reader.read();if (done) break;
        size+=value.length;if (size>length) throw {code:"usb_capture_unverified"};chunks.push(value);
      }
    } finally {reader.releaseLock();}
    if (size!==length) throw {code:"usb_capture_unverified"};
    return new Blob(chunks,{type:"application/x-tar"});
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
window.addEventListener("pagehide",()=>{void probe?.close().catch(()=>{});});
translate();controls();
