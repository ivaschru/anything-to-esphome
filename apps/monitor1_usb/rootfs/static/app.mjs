import {createProbe} from "./usb-probe-bundle.mjs";
const strings = {
  en: {
    language:"Language", intro:"Monitor 1 / CGS1 — experimental USB connection check",
    prepare:"Prepare the monitor",
    enable:"On the stock monitor, enable ADB with #adb=on# in a Wi-Fi password field. Afterwards reconnect to your own Wi-Fi with its real password.",
    cable:"Connect a USB-C data cable to the computer or to the Home Assistant server, according to the option below.",
    boundary:"This step reads identity and stock fingerprints only. It does not install, reset Wi-Fi, reboot or activate firmware. Already modified or unknown stock variants are refused.",
    where:"Where is the cable connected?", transport:"USB connection", computer:"To this computer", server:"To the Home Assistant server",
    browser_help:"Chrome or Edge over HTTPS. The browser will ask you to select the USB device.", ha_help:"The companion reads the server's USB. Your browser needs no USB support or local cable.",
    scan:"Find USB devices", device:"Selected USB device", choose:"Choose a device", inspect:"Check USB connection",
    searching:"Looking for USB devices on the server…", found:"USB devices found. Select the monitor.", no_devices:"No authorized USB ADB devices found. Check the cable and enable ADB on the monitor.",
    checking:"Checking the selected monitor…", success:"Stock source checked. Firmware installation has not started.",
    next:"The full installer is still being integrated. This experimental first step lets you test either USB location. A successful connection is not permission to repeat a consumed install or trial.",
    docs:"Experimental installation documentation",
    model:"Model", version:"Stock version", co2:"CO2 variant", mac:"WLAN identity",
    webusb_unavailable:"Use Chrome or Edge over HTTPS, or choose the server USB option.",
    usb_selection_cancelled:"No device selected.",
    usb_stock_unverified:"Stock files differ from the initial-install profile. An existing ESPHome installation needs its own update route.",
    usb_profile_unsupported:"This stock version, CO2 type or CPU is not admitted.",
    usb_busy:"Another USB check is in progress.",
    usb_selection_consumed:"This selection was already checked. Discover devices again for a new read-only check.",
    usb_unauthorized:"Open the companion from Home Assistant as an administrator.",
    failed:"The USB check was incomplete. Nothing was installed. Check the cable, ADB and selected connection."
  },
  ru: {
    language:"Язык", intro:"Monitor 1 / CGS1 — экспериментальная проверка USB-подключения",
    prepare:"Подготовьте монитор",
    enable:"На штатном мониторе включите ADB: введите #adb=on# в поле пароля Wi-Fi. Затем вернитесь в свою сеть с её настоящим паролем.",
    cable:"Подключите USB-C кабелем с передачей данных к компьютеру или серверу Home Assistant — в зависимости от выбора ниже.",
    boundary:"Этот шаг только читает идентификаторы и отпечатки штатных файлов. Он не устанавливает прошивку, не сбрасывает Wi-Fi и не перезагружает прибор. Уже изменённые и неизвестные варианты не допускаются к первой установке.",
    where:"Куда подключён кабель?", transport:"USB-подключение", computer:"К этому компьютеру", server:"К серверу Home Assistant",
    browser_help:"Нужен Chrome или Edge и HTTPS. Браузер предложит выбрать USB-устройство.", ha_help:"Дополнение читает USB сервера. Поддержка USB в браузере и кабель у компьютера не нужны.",
    scan:"Найти USB-устройства", device:"Выбранное USB-устройство", choose:"Выберите устройство", inspect:"Проверить USB-подключение",
    searching:"Ищу USB-устройства на сервере…", found:"USB-устройства найдены. Выберите монитор.", no_devices:"Авторизованные USB-устройства ADB не найдены. Проверьте кабель и включение ADB на мониторе.",
    checking:"Проверяю выбранный монитор…", success:"Штатные исходные файлы проверены. Установка прошивки ещё не началась.",
    next:"Полный установщик ещё подключается к мастеру. Этот экспериментальный шаг позволяет проверить оба места подключения USB. Успешная проверка не разрешает повторять использованную установку или trial.",
    docs:"Инструкция по экспериментальной установке",
    model:"Модель", version:"Штатная версия", co2:"Вариант CO2", mac:"WLAN-идентификатор",
    webusb_unavailable:"Откройте через Chrome или Edge по HTTPS либо выберите USB сервера.",
    usb_selection_cancelled:"Устройство не выбрано.",
    usb_stock_unverified:"Штатные файлы отличаются от профиля первой установки. Уже установленный ESPHome обновляется своим отдельным путём.",
    usb_profile_unsupported:"Эта штатная версия, вариант CO2 или процессор не допущены.",
    usb_busy:"Уже выполняется другая USB-проверка.",
    usb_selection_consumed:"Этот выбор уже проверен. Снова найдите устройства для новой проверки только для чтения.",
    usb_unauthorized:"Откройте дополнение из Home Assistant с правами администратора.",
    failed:"USB-проверка не завершена. Прошивка не устанавливалась. Проверьте кабель, ADB и выбранное подключение."
  },
};
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
