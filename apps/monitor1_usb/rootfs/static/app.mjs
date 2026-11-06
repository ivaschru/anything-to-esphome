import {createProbe, strings} from "./usb-probe-bundle.mjs";
const $ = id => document.getElementById(id);
const nonce = document.querySelector('meta[name="qingping-page-nonce"]').content;
let language = "en", busy = false, probe, lastError, lastStatus, devices = [];
try {language = localStorage.getItem("qingping-esphome-language") === "ru" ? "ru" : "en";} catch {}
const text = key => strings[language][key] || strings[language].failed;
function translate() {
  document.documentElement.lang = language; $("language").value = language;
  document.querySelectorAll("[data-text]").forEach(node => {node.textContent = text(node.dataset.text);});
  $("transport-help").textContent = text($("transport").value === "ha" ? "ha_help" : "browser_help");
  if (lastStatus) $("status").textContent = text(lastStatus);
  if (lastError) $("error").textContent = text(lastError);
  renderDevices();
}
function controls() {
  $("transport").disabled = $("scan").disabled = $("device").disabled = busy;
  $("inspect").disabled = busy || ($("transport").value === "ha" && !$("device").value);
  $("ha-picker").hidden = $("transport").value !== "ha";
}
function clear() {$("identity").replaceChildren(); $("status").textContent = $("error").textContent = "";lastError = lastStatus = null;}
function renderDevices() {
  const selected = $("device").value;
  $("device").replaceChildren();
  const initial = document.createElement("option");initial.value = "";initial.textContent = text("choose");$("device").append(initial);
  for (const serial of devices) {
    const option = document.createElement("option");option.value = option.textContent = serial;$("device").append(option);
  }
  if (devices.includes(selected)) $("device").value = selected;
}
async function rpc(operation, data) {
  const response = await fetch(operation, {method:data ? "POST" : "GET", credentials:"same-origin",
    headers:{"X-Qingping-Nonce":nonce, ...(data ? {"Content-Type":"application/json"} : {})},
    ...(data ? {body:JSON.stringify(data)} : {}), signal:AbortSignal.timeout(70000)});
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
$("inspect").onclick = async () => {
  if (busy) return;
  busy=true;clear();controls();lastStatus="checking";$("status").textContent=text(lastStatus);
  try {
    let result;
    if ($("transport").value === "browser") {
      probe=createProbe();
      result=await probe.select(); // No await before the actual native picker.
    } else {
      result=await rpc("inspect",{serial:$("device").value});
    }
    for (const [key,value] of [["model",result.model],["version",result.stock_version],
      ["co2",result.co2_type===2 ? "SenseAir S8" : "SCD40"],["mac",result.wlan_mac]]) {
      const label=document.createElement("dt"), content=document.createElement("dd");
      label.dataset.text=key;label.textContent=text(key);content.textContent=value;$("identity").append(label,content);
    }
    lastStatus="success";$("status").textContent=text(lastStatus);
  } catch(error) {lastStatus=null;$("status").textContent="";lastError=error.code || "failed";$("error").textContent=text(lastError);}
  finally {probe=undefined;busy=false;controls();}
};
window.addEventListener("pagehide",()=>{void probe?.close().catch(()=>{});});
translate();controls();
