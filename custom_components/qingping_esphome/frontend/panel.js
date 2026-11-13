/** Local HACS wizard. No CDN, analytics, cloud build or browser credential storage.
 *
 * Chrome's device picker is always a real user gesture. Setup writes are
 * sequential and acknowledged, while the HA backend independently verifies
 * the stock MQTT MAC/version before consuming its one firmware command.
 */
import {requireLiteProfile} from "./compatibility.mjs";
import {HABluetoothConnection} from "./ha-transport.mjs";
import "./usb-choice.mjs";
import "./sonoff.mjs";
import {SidebarSettings} from "./sidebar-settings.mjs";
import {t, failure, errorKey, readLanguage, saveLanguage, normalizeLanguage, scanSummary} from "./i18n.mjs";

const VENDOR = "22210000-554a-4546-5542-46534450464d";
const INFO = "0000180a-0000-1000-8000-00805f9b34fb";
const characteristic = n => `${n.toString(16).padStart(8, "0")}-0000-1000-8000-00805f9b34fb`;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const decode = value => new TextDecoder().decode(value).replace(/\0+$/, "").trim();

class StockConnection {
  async connect() {
    if (!navigator.bluetooth) throw failure("bluetooth_unavailable");
    this.device = await navigator.bluetooth.requestDevice({
      filters: [{namePrefix: "Qingping"}, {namePrefix: "CGDN1"}, {namePrefix: "Air Monitor"}],
      optionalServices: [VENDOR, INFO],
    });
    this.server = await this.device.gatt.connect();
    const info = await this.server.getPrimaryService(INFO);
    const read = async n => decode(await (await info.getCharacteristic(characteristic(n))).readValue());
    // Browser GATT operations must be sequential (unlike some native clients).
    const model = await read(0x2a24), stock_version = await read(0x2a26), hardware = await read(0x2a27);
    this.service = await this.server.getPrimaryService(VENDOR);
    this.chars = new Map();
    for (const n of [1, 2, 0x0d, 0x0e, 0x17, 0x18]) {
      this.chars.set(n, await this.service.getCharacteristic(characteristic(n)));
    }
    this.acknowledgements = [];
    this.chars.get(2).addEventListener("characteristicvaluechanged", event => {
      const data = new Uint8Array(event.target.value.buffer, event.target.value.byteOffset, event.target.value.byteLength);
      // Do not log arbitrary notifications: some stock versions echo settings.
      if (data.length === 5 && data[0] === 4 && data[1] === 255) {
        this.acknowledgements.push({command: data[2], statusA: data[3], statusB: data[4]});
      }
    });
    await this.chars.get(2).startNotifications();
    await this.chars.get(0x0e).startNotifications();
    const mac = await this.readMac();
    this.identity = {mac, model, stock_version, hardware};
    return this.identity;
  }

  async readMac() {
    const c = this.chars.get(0x18);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { c.removeEventListener("characteristicvaluechanged", received); reject(failure("mac_timeout")); }, 7000);
      const received = event => {
        const data = new Uint8Array(event.target.value.buffer, event.target.value.byteOffset, event.target.value.byteLength);
        if (data.length !== 8 || data[0] !== 7 || data[1] !== 11) return;
        clearTimeout(timeout); c.removeEventListener("characteristicvaluechanged", received);
        resolve([...data.slice(2)].map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase());
      };
      c.addEventListener("characteristicvaluechanged", received);
      c.startNotifications().then(() => this.send(0x17, 0x0b, new Uint8Array())).catch(error => {
        clearTimeout(timeout); c.removeEventListener("characteristicvaluechanged", received); reject(error);
      });
    });
  }

  async send(number, command, payload) {
    if (payload.length > 254) throw failure("ble_packet_length");
    const bytes = new Uint8Array(payload.length + 2);
    bytes[0] = payload.length + 1; bytes[1] = command; bytes.set(payload, 2);
    for (let offset = 0; offset < bytes.length; offset += 20) {
      await this.chars.get(number).writeValueWithResponse(bytes.slice(offset, offset + 20));
      await wait(50);
    }
  }

  async ack(command) {
    const deadline = Date.now() + 7000;
    while (Date.now() < deadline) {
      const result = this.acknowledgements.shift();
      if (result) {
        if (result.command !== command || result.statusA !== 0 || result.statusB !== 0) {
          throw failure("ble_rejected");
        }
        await wait(500); return;
      }
      await wait(30);
    }
    throw failure("ble_ack_timeout");
  }

  async provision(ssid, password, broker, message) {
    const mac = await this.readMac();
    if (mac !== this.identity.mac) throw failure("selected_changed");
    const token = crypto.getRandomValues(new Uint8Array(16));
    for (const command of [1, 2]) {
      await this.send(1, command, token); await this.ack(command);
    }
    const encode = text => new TextEncoder().encode(text);
    message("provisioning");
    await this.send(0x0d, 1, encode(`"${ssid}","${password}"`)); await wait(500);
    await this.send(1, 0x17, encode(`${broker.host} ${broker.port} ${broker.username} ${broker.password}`));
    await this.ack(0x17);
    await this.send(1, 0x18, encode(`${broker.client_id} ${broker.down} ${broker.up}`));
    await this.ack(0x18);
    // Stock can start Wi-Fi asynchronously. Do not tear the BLE session down
    // immediately after its last setter; that caused a real setup failure.
    message("waiting_for_broker");
    await wait(30000);
  }

  disconnect() { if (this.device?.gatt?.connected) this.device.gatt.disconnect(); }
}

class QingpingPanel extends HTMLElement {
  set hass(value) {
    this._hass = value;
    if (this.initialized && this.$) {
      this.$("#usb-choice").hass = value;
      this.$("#sonoff").hass = value;
      // HA broadcasts panel updates when Configure → Interface changes too.
      // Never replace a pending user's selection with an earlier broadcast.
      const panel = value.panels?.["anything-to-esphome"];
      const signature = panel ? JSON.stringify([panel.title, panel.show_in_sidebar]) : null;
      if (signature !== this.sidebarPanelSignature) {
        this.sidebarPanelSignature = signature;
        // Panel metadata may contain a user's personal sidebar overrides.
        // It is a refresh signal only; the integration option stays authority.
        if (this.sidebarLoaded && !this.sidebarPending && panel) this.loadSidebar();
      }
    }
    if (!this.initialized && this.isConnected) this.initialize();
  }
  get hass() { return this._hass; }
  connectedCallback() {
    if (this.hass && !this.initialized) this.initialize();
    else if (this.initialized) {
      this.watchPageSettings();
      this.loadLiteInstallations();
      this.loadSavedWifi();
      if (this.session) this.startPolling();
    }
  }
  disconnectedCallback() {
    clearInterval(this.poller); this.stock?.disconnect();
    clearTimeout(this.recoveryPoll);
    if (this.initialized) {
      this.hideLitePassword("preview");
      this.hideLitePassword("recovery");
    }
    for (const type of ["pointerdown", "focusin", "keydown"]) this.ownerDocument.removeEventListener(type, this.dismissPageSettings);
  }

  watchPageSettings() {
    // Native details supplies keyboard activation and expanded state. Close on
    // outside interaction or Escape, without retaining listeners after unload
    // or rebuilding the installation form / Bluetooth picker activation.
    this.dismissPageSettings ??= event => {
      const menu = this.$("#page-settings");
      if (!menu.open) return;
      if (event.key === "Escape") {
        menu.open = false; menu.querySelector("summary").focus();
      } else if (!event.composedPath().includes(menu)) menu.open = false;
    };
    for (const type of ["pointerdown", "focusin", "keydown"]) this.ownerDocument.addEventListener(type, this.dismissPageSettings);
  }

  async rpc(operation, extra = {}) {
    return this.hass.callWS({type: "qingping_esphome/command", operation, ...extra});
  }

  initialize() {
    this.initialized = true;
    this.language = readLanguage();
    this.brand = "qingping";
    this.model = "lite";
    this.transport = navigator.bluetooth ? "browser" : "ha";
    this.attachShadow({mode: "open"});
    this.shadowRoot.innerHTML = `
      <style>
      :host{display:block;color:var(--primary-text-color,#202124);background:var(--primary-background-color,#f6f7f8);min-height:100vh;font:16px/1.5 system-ui,sans-serif;--accent:var(--primary-color,#087f8c)}
      *{box-sizing:border-box} main{max-width:960px;margin:auto;padding:40px 24px 64px}h1{font-size:30px;letter-spacing:-.8px;line-height:1.2;margin:0 0 8px}h2{font-size:20px;margin:0 0 20px}p{margin:0 0 20px}.muted{color:var(--secondary-text-color,#58616b)}
      .heading{display:flex;justify-content:space-between;align-items:start;gap:20px;flex-wrap:wrap}.language{display:flex;align-items:center;gap:10px;font-size:14px}select{min-height:44px;padding:8px;border:1px solid var(--divider-color,#c8cfd6);border-radius:8px;background:var(--card-background-color,#fff);color:inherit;font:inherit}select:focus-visible{outline:3px solid var(--accent);outline-offset:3px}header{margin-bottom:30px} .cards{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px}.model{padding:18px;text-align:left;min-height:100px;background:var(--card-background-color,#fff);border:1px solid var(--divider-color,#d8dde2);border-radius:14px;color:inherit}.model[aria-pressed=true]{border:2px solid var(--accent);padding:17px}.model b{display:block;margin-bottom:8px}.model span{font-size:13px;color:var(--secondary-text-color,#58616b)}
      .box{background:var(--card-background-color,#fff);border:1px solid var(--divider-color,#d8dde2);border-radius:16px;padding:26px;margin-bottom:20px}.identity{display:flex;gap:12px;flex-wrap:wrap;margin:16px 0}.identity span{background:var(--secondary-background-color,#f0f2f5);padding:6px 10px;border-radius:8px;font:13px ui-monospace,monospace}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}label{display:block;font-weight:600;font-size:14px}input[type=text],input[type=password]{display:block;width:100%;height:48px;border:1px solid var(--divider-color,#c8cfd6);border-radius:9px;margin-top:7px;padding:10px 12px;background:var(--card-background-color,#fff);color:inherit;font:16px system-ui}
      button{font:600 15px system-ui;min-height:46px;border-radius:9px;padding:11px 18px;cursor:pointer;transition:background .15s,border-color .15s}button:disabled{opacity:.55;cursor:default}button.primary{background:var(--accent);border:1px solid var(--accent);color:var(--text-primary-color,#fff)}button.secondary{background:transparent;color:inherit;border:1px solid var(--divider-color,#c8cfd6)}button:focus-visible,input:focus-visible,a:focus-visible{outline:3px solid var(--accent);outline-offset:3px}.row{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.check{display:flex;gap:10px;align-items:flex-start;font-weight:400;margin:22px 0}.check input{width:20px;height:20px;margin-top:2px;accent-color:var(--accent)}.note{font-size:14px}.error{color:var(--error-color,#b42318);white-space:pre-wrap}.status{margin-bottom:10px;font-weight:600}progress{width:100%;height:12px;accent-color:var(--accent)}.hidden{display:none!important}.password{display:flex;align-items:end;gap:8px}.password label{flex:1}.password button{padding:10px;min-width:46px;font-size:12px}footer{font-size:13px;color:var(--secondary-text-color,#58616b)}a{color:var(--accent)}
      @media(max-width:650px){main{padding:25px 16px}.cards{grid-template-columns:1fr}.model{min-height:72px}.box{padding:20px}.grid{grid-template-columns:1fr}h1{font-size:27px}}@media(prefers-reduced-motion:reduce){button{transition:none}}
      #transport,#ha-device{display:block;width:100%;max-width:100%;margin:7px 0 12px}.ha-device-field{flex:1;min-width:0}#ha-picker .row{align-items:flex-end}#ha-picker .row>button{margin-bottom:12px}
      #ble-status:empty{margin:0}#ble-status.scan-complete{margin-bottom:4px}#ble-status.scan-success{color:var(--primary-text-color,#202124);color:color-mix(in srgb,var(--success-color,#198754) 48%,var(--primary-text-color,#202124));font-weight:600}
      #progress-box{margin-top:24px;padding:0;overflow-wrap:anywhere}#lite-result-header{justify-content:space-between;align-items:end;padding:16px 18px;border-bottom:1px solid var(--divider-color,#d8dde2)}#lite-result-header h3,#progress-box h4{margin:0}#lite-result-name{margin:4px 0 0}#lite-result-header select{width:100%;max-width:100%}#lite-result-header label{margin-bottom:4px}#lite-result-header>div{min-width:0;max-width:100%}
      .lite-result-body{padding:14px 18px 6px}.lite-result-status{padding:14px;background:var(--secondary-background-color,#f0f2f5);border-radius:12px}.lite-result-status .status{margin:0 0 4px}.lite-result-status p{margin:0}.lite-result-status progress{height:6px;margin:10px 0 0}.lite-result-status[data-tone=warning] .status{color:var(--warning-color,var(--primary-text-color,#202124))}.lite-result-status[data-tone=success] .status{color:color-mix(in srgb,var(--success-color,#198754) 65%,var(--primary-text-color,#202124))}
      .lite-result-actions{margin-top:10px}.lite-result-actions a{display:inline-flex;align-items:center;min-height:44px;font-weight:600}.lite-steps{display:flex;flex-wrap:wrap;gap:3px 14px;list-style:none;margin:10px 0 0;padding:0;font-size:13px}.lite-steps [data-phase=done]{color:color-mix(in srgb,var(--success-color,#198754) 60%,var(--primary-text-color,#202124))}.lite-steps [data-phase=active]{font-weight:600}.lite-result-row{justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--divider-color,#d8dde2)}.lite-result-row p{margin:0}.lite-result-row button{min-height:44px}#recovery-ap-password{flex-basis:100%;font:14px ui-monospace,monospace}
      .lite-history{padding:8px 0}.lite-history summary{min-height:44px;align-content:center;cursor:pointer;font-weight:600}.lite-history ul{margin:0;padding:0;list-style:none}.lite-history li{display:flex;flex-wrap:wrap;gap:2px 12px;padding:6px 0}.lite-history strong{font-weight:600}
      #brands button[aria-pressed=true]{border:2px solid var(--accent);color:var(--accent)}.header-controls{display:flex;align-items:center;gap:12px;margin-left:auto}.page-settings{position:relative}.page-settings>summary{display:flex;align-items:center;justify-content:center;list-style:none;width:44px;height:44px;border:1px solid transparent;border-radius:9px;cursor:pointer;color:var(--secondary-text-color,#58616b)}.page-settings>summary::-webkit-details-marker{display:none}.page-settings>summary:hover,.page-settings[open]>summary{background:var(--secondary-background-color,#f0f2f5);color:var(--primary-text-color,#202124)}.page-settings>summary:focus-visible{outline:3px solid var(--accent);outline-offset:3px}.page-settings svg{width:22px;height:22px}.sidebar-setting{position:absolute;right:0;top:calc(100% + 8px);z-index:2;width:min(340px,calc(100vw - 32px));padding:16px;background:var(--card-background-color,#fff);border:1px solid var(--divider-color,#d8dde2);border-radius:12px;box-shadow:0 8px 24px #0003}.sidebar-setting .check{min-height:44px;align-items:center;margin:0;cursor:pointer}.sidebar-setting .check:has(input:disabled){opacity:.55;cursor:default}.sidebar-setting p{margin:6px 0 0}.sidebar-setting input{flex:none;margin:0}.sidebar-setting #sidebar-status:empty{display:none}
      </style>
      <main><header><div class="heading"><h1>Anything → ESPHome</h1><div class="header-controls"><label class="language"><span data-i18n="language"></span><select id="language"><option value="en" lang="en">English</option><option value="ru" lang="ru">Русский</option></select></label><details id="page-settings" class="page-settings"><summary data-i18n-aria="page_settings"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="var(--card-background-color,#fff)"/><circle cx="15" cy="17" r="3" fill="var(--card-background-color,#fff)"/></svg></summary><div class="sidebar-setting"><label class="check"><input id="show-sidebar" type="checkbox" role="switch" disabled aria-describedby="sidebar-help"><span data-i18n="sidebar_label"></span></label><p id="sidebar-help" class="note muted" data-i18n="sidebar_help"></p><p id="sidebar-status" class="note muted" role="status" aria-live="polite"></p><button id="sidebar-retry" class="secondary hidden" data-i18n="sidebar_retry"></button></div></details></div></div><p class="muted"><span data-i18n="tagline"></span></p></header>
      <div class="row" style="margin-bottom:20px" role="group" id="brands">
       <button class="secondary" data-brand="qingping" aria-pressed="true">Qingping</button>
       <button class="secondary" data-brand="sonoff" aria-pressed="false">Sonoff</button>
      </div>
      <div id="qingping-models" class="cards" role="group" data-i18n-aria="model_label">
       <button class="model" data-model="lite" aria-pressed="true"><b>Air Monitor Lite</b><span><span data-i18n="lite_summary"></span></span></button>
       <button class="model" data-model="monitor1" aria-pressed="false"><b>Air Monitor 1</b><span><span data-i18n="monitor1_summary"></span></span></button>
       <button class="model" data-model="monitor2" aria-pressed="false"><b>Air Monitor 2</b><span><span data-i18n="monitor2_summary"></span></span></button>
      </div>
      <sonoff-installer id="sonoff" class="hidden"></sonoff-installer>
      <section id="unsupported" class="box hidden"><h2 id="unsupported-title"></h2><p id="unsupported-text"></p><qingping-usb-choice id="usb-choice" class="hidden"></qingping-usb-choice><a href="https://github.com/ivaschru/anything-to-esphome#compatibility" target="_blank" rel="noreferrer"><span data-i18n="compatibility"></span></a></section>
      <section id="wizard" class="box"><h2><span data-i18n="connect_title"></span></h2>
       <p class="note muted"><span data-i18n="connect_help"></span></p>
       <label for="transport"><span data-i18n="transport_label"></span></label><select id="transport" aria-describedby="transport-help"><option value="browser" data-i18n="transport_browser"></option><option value="ha" data-i18n="transport_ha"></option></select>
       <p id="transport-help" class="note muted"></p>
       <div id="ha-picker" class="hidden"><div class="row"><div class="ha-device-field"><label for="ha-device"><span data-i18n="ha_device_label"></span></label><select id="ha-device" aria-describedby="ble-hint"></select></div><button id="scan" class="secondary"><span data-i18n="ha_scan"></span></button></div><p id="ble-status" class="note muted" role="status" aria-atomic="true"></p><p id="ble-hint" class="note muted hidden"></p></div>
       <button id="connect" class="secondary"><span data-i18n="connect"></span></button>
       <div id="identity" class="identity" aria-live="polite"></div>
       <p id="profile-version" class="note status hidden"></p>
       <p id="profile-note" class="note hidden"></p>
       <form id="form" class="hidden"><h2><span data-i18n="install_title"></span></h2>
       <div id="saved-wifi" class="hidden">
        <label class="check"><input id="use-saved-wifi" type="checkbox"><span><span data-i18n="lite_saved_wifi"></span> · <b id="saved-ssid"></b></span></label>
        <button id="forget-wifi" type="button" class="secondary" data-i18n="lite_forget_wifi"></button>
       </div>
       <div id="manual-wifi"><div class="grid">
        <label><span data-i18n="ssid"></span><input id="ssid" type="text" required autocomplete="off" spellcheck="false"></label>
        <div class="password"><label><span data-i18n="wifi_password"></span><input id="password" type="password" autocomplete="off"></label><button id="show-password" class="secondary" type="button" data-i18n-aria="show_password"></button></div>
       </div>
       <label class="check"><input id="remember-wifi" type="checkbox"><span data-i18n="lite_remember_wifi"></span></label></div>
       <div class="note">
        <p><span data-i18n="lite_backup_wifi"></span> · <b id="preview-ap-ssid"></b></p>
        <button id="preview-ap" type="button" class="secondary" data-i18n="show_password"></button>
        <p id="preview-ap-password" class="hidden" role="status"></p>
       </div>
       <label class="check"><input id="usb" type="checkbox" required><span><span data-i18n="usb_ack"></span></span></label>
       <p class="note muted"><span data-i18n="install_note"></span></p>
       <button id="flash" type="submit" class="primary"><span data-i18n="flash"></span></button></form>
       <section id="progress-box" class="box hidden" aria-labelledby="lite-result-title">
        <header id="lite-result-header" class="row" style="margin:0">
         <div><h3 id="lite-result-title" data-i18n="lite_result_title"></h3><p id="lite-result-name" class="note muted hidden"></p></div>
         <div id="lite-result-picker" class="hidden"><label for="recovery-device" data-i18n="lite_result_device"></label><select id="recovery-device"></select></div>
        </header>
        <div class="lite-result-body">
         <div id="lite-result-status" class="lite-result-status">
          <div role="status" aria-atomic="true"><h4 id="status" class="status"></h4><p id="detail" class="note muted"></p></div>
          <progress id="progress" class="hidden" max="100" value="0" data-i18n-aria="progress_label"></progress>
          <ol id="lite-steps" class="lite-steps hidden" data-i18n-aria="lite_result_steps"><li></li><li></li><li></li></ol>
          <div id="lite-result-actions" class="row lite-result-actions hidden">
           <button id="recovery-check" type="button" class="primary hidden" data-i18n="lite_check_again"></button>
           <span id="lite-retry-note" class="note muted hidden" data-i18n="lite_check_only"></span>
           <a id="lite-device-link" class="hidden" data-i18n="lite_open_device"></a>
           <button id="resume" type="button" class="primary hidden" data-i18n="resume"></button>
           <button id="cancel" type="button" class="secondary hidden" data-i18n="cancel"></button>
          </div>
         </div>
         <div id="recovery-info" class="hidden">
          <section id="lite-result-wifi" class="row lite-result-row" aria-labelledby="lite-result-wifi-title">
           <div><h4 id="lite-result-wifi-title" data-i18n="lite_backup_wifi"></h4><p id="recovery-ap-network" class="note muted"></p></div>
           <button id="recovery-ap" type="button" class="secondary" aria-controls="recovery-ap-password" aria-expanded="false" data-i18n="lite_show_password"></button>
           <p id="recovery-ap-password" class="hidden" role="status"></p>
          </section>
          <details class="lite-history"><summary data-i18n="lite_history"></summary><ul id="recovery-history"></ul></details>
         </div>
        </div>
       </section>
      </section>
      <p id="error" class="error" role="alert"></p>
      <footer><div><span data-i18n="footer"></span> <a href="https://github.com/ivaschru/anything-to-esphome" target="_blank" rel="noreferrer"><span data-i18n="source"></span></a></div><div><span data-i18n="development"></span> – <a href="https://ivasch.ru/" target="_blank" rel="noopener noreferrer"><span data-i18n="developer_name"></span></a></div></footer></main>`;
    this.$ = selector => this.shadowRoot.querySelector(selector);
    this.shadowRoot.querySelectorAll("[data-brand]").forEach(button => button.onclick = () => this.selectBrand(button.dataset.brand));
    this.shadowRoot.querySelectorAll("[data-model]").forEach(button => button.onclick = () => this.selectModel(button.dataset.model));
    this.$("#language").onchange = event => {
      this.language = normalizeLanguage(event.target.value);
      saveLanguage(this.language);
      this.applyLanguage();
    };
    this.applyLanguage();
    this.watchPageSettings();
    this.$("#show-sidebar").onchange = () => this.saveSidebar();
    this.$("#sidebar-retry").onclick = () => this.loadSidebar();
    this.loadSidebar();
    this.$("#connect").onclick = () => this.connect();
    this.$("#transport").value = this.transport;
    this.$("#transport").onchange = () => this.changeTransport();
    this.$("#scan").onclick = () => this.scan();
    this.$("#ha-device").onchange = () => { this.invalidateSelection(); this.connectionControls(); };
    this.renderDevices([]);
    this.updateTransport();
    this.$("#show-password").onclick = () => {
      const input = this.$("#password"); input.type = input.type === "password" ? "text" : "password";
      this.updatePasswordLabel();
    };
    this.$("#form").onsubmit = event => {event.preventDefault(); this.flash();};
    this.$("#use-saved-wifi").onchange = () => this.renderSavedWifi();
    this.$("#forget-wifi").onclick = async () => {
      try {
        this.savedWifi = await this.rpc("lite_forget_wifi");
        this.renderSavedWifi();
      } catch (error) { this.fail(error); }
    };
    this.$("#preview-ap").onclick = () => this.toggleLitePassword("preview");
    this.$("#recovery-ap").onclick = () => this.toggleLitePassword("recovery");
    this.$("#recovery-device").onchange = () => {
      this.hideLitePassword("recovery");
      this.renderLiteInstallation();
    };
    this.$("#recovery-check").onclick = () => this.retryLiteInstallation();
    this.$("#resume").onclick = async () => {
      this.$("#resume").disabled = true;
      try { await this.rpc("arm", {session: this.session}); this.startPolling(); }
      catch (error) { this.fail(error); }
    };
    this.$("#cancel").onclick = async () => {
      try {
        await this.rpc("cancel", {session: this.session});
        clearInterval(this.poller); sessionStorage.removeItem("qingping-installer-session");
        this.session = null; this.busy = false;
        this.connectionControls(); this.$("#flash").disabled = false;
        this.sessionStatus = null; this.messageKey = null;
        this.renderLiteInstallation(); this.$("#form").classList.add("hidden");
        this.fail({code: "session_closed"});
      } catch (error) { this.fail(error); }
    };
    this.session = sessionStorage.getItem("qingping-installer-session");
    this.activeLite = sessionStorage.getItem("qingping-installer-device");
    if (this.session) { this.busy = true; this.$("#connect").disabled = true; this.startPolling(); }
    this.connectionControls();
    // Retain the same catalog for this page; the backend still checks a fresh
    // request independently. Await this promise before showing the flash form.
    this.catalogReady = this.rpc("catalog").then(result => { this.catalog = result.models; });
    this.catalogReady.catch(error => this.fail(error));
    this.loadSavedWifi();
    this.loadLiteInstallations();
  }

  renderSidebar() {
    this.$("#show-sidebar").checked = Boolean(this.sidebarValue);
    this.$("#show-sidebar").disabled = !this.sidebarLoaded || Boolean(this.sidebarPending);
    this.$("#sidebar-status").textContent = this.sidebarMessage ? this.t(this.sidebarMessage) : "";
    this.$("#sidebar-status").classList.toggle("error", this.sidebarMessage === "sidebar_failed");
    this.$("#sidebar-retry").classList.toggle("hidden", this.sidebarMessage !== "sidebar_failed");
  }

  async loadSidebar() {
    if (this.sidebarPending) return;
    this.sidebarPending = true; this.sidebarMessage = "sidebar_loading"; this.renderSidebar();
    try {
      this.sidebarValue = await new SidebarSettings(this.hass).read();
      this.sidebarLoaded = true; this.sidebarMessage = null;
    } catch { this.sidebarMessage = "sidebar_failed"; }
    finally { this.sidebarPending = false; this.renderSidebar(); }
  }

  async saveSidebar() {
    if (this.sidebarPending || !this.sidebarLoaded) return;
    const requested = this.$("#show-sidebar").checked;
    this.sidebarPending = true; this.sidebarMessage = "sidebar_saving";
    // Keep the previous confirmed value until HA acknowledges/readbacks it.
    // Updating these nodes never rebuilds the installer or closes its BLE link.
    this.renderSidebar();
    try {
      this.sidebarValue = await new SidebarSettings(this.hass).save(requested);
      this.sidebarMessage = null;
    } catch { this.sidebarMessage = "sidebar_failed"; }
    finally { this.sidebarPending = false; this.renderSidebar(); }
  }

  selectBrand(brand) {
    // A brand switch is navigation, never cancellation or a second writer.
    // Keep the same child/form nodes so language and navigation retain input.
    const locked = this.brand === "sonoff" ? this.$("#sonoff").busy
      : this.busy || this.connecting || this.scanning || this.$("#usb-choice").busy;
    // A restored Sonoff job must remain reachable from the default Qingping
    // page. Block leaving the active brand, never navigating to its status.
    if (!["qingping", "sonoff"].includes(brand) || brand === this.brand || locked) return;
    this.brand = brand;
    this.stock?.disconnect(); this.invalidateSelection();
    this.shadowRoot.querySelectorAll("[data-brand]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.brand === brand)));
    this.$("#qingping-models").classList.toggle("hidden", brand !== "qingping");
    this.$("#sonoff").classList.toggle("hidden", brand !== "sonoff");
    this.selectModel(this.model);
  }

  selectModel(model) {
    if (this.busy || this.connecting || this.scanning) return;
    this.shadowRoot.querySelectorAll("[data-model]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.model === model)));
    this.$("#wizard").classList.toggle("hidden", this.brand !== "qingping" || model !== "lite");
    if (this.brand !== "qingping" || model !== "lite") this.hideLitePassword("recovery");
    this.$("#unsupported").classList.toggle("hidden", this.brand !== "qingping" || model === "lite");
    this.model = model;
    this.updateModelText();
  }

  async connect() {
    if (this.busy || this.connecting || this.scanning) return;
    this.connecting = true; this.connectionControls();
    this.lastError = null; this.$("#error").textContent = "";
    // Selecting an unsupported second device must not leave the previous
    // supported device's form/identity armed and available for submission.
    this.invalidateSelection();
    this.stock = this.transport === "ha"
      ? new HABluetoothConnection((operation, data) => this.rpc(operation, data), this.$("#ha-device").value)
      : new StockConnection();
    try {
      const identity = await this.stock.connect();
      // requestDevice above must keep the click's transient user activation;
      // do not put a network wait in front of Chrome's Bluetooth picker.
      await this.catalogReady;
      this.$("#identity").replaceChildren(...[identity.model, "stock " + identity.stock_version, "HW " + identity.hardware, identity.mac].map(value => {
        const e = document.createElement("span"); e.textContent = value; return e;
      }));
      const profile = requireLiteProfile(this.catalog, identity);
      if (profile.template_error) throw failure(profile.template_error);
      this.profile = profile;
      this.identity = identity;
      this.$("#preview-ap-ssid").textContent = "Qingping-" + identity.mac.slice(-6);
      this.renderSavedWifi();
      this.renderProfileInfo();
      this.$("#form").classList.remove("hidden");
    } catch (error) { this.stock.disconnect(); this.fail(error); }
    finally { this.connecting = false; this.connectionControls(); }
  }

  renderProfileInfo() {
    const version = this.profile?.public_version;
    const versionText = this.$("#profile-version");
    const hasVersion = Number.isSafeInteger(version) && version > 0;
    versionText.textContent = hasVersion ? this.t("profile_install_version").replace("{version}", version) : "";
    versionText.classList.toggle("hidden", !hasVersion);
    const note = this.$("#profile-note");
    const description = this.profile?.description_key;
    note.textContent = description ? this.t(description) : "";
    note.classList.toggle("hidden", !description);
  }

  invalidateSelection() {
    this.identity = null; this.profile = null;
    this.apToken = null;
    this.hideLitePassword("preview");
    this.stock?.disconnect(); this.stock = null;
    this.$("#identity").replaceChildren();
    this.renderProfileInfo();
    this.$("#form").classList.add("hidden");
  }

  changeTransport() {
    if (this.busy || this.connecting || this.scanning) { this.$("#transport").value = this.transport; return; }
    this.transport = this.$("#transport").value;
    this.invalidateSelection();
    this.renderSavedWifi();
    this.lastError = null; this.$("#error").textContent = "";
    this.updateTransport(); this.connectionControls();
  }

  updateTransport() {
    this.$("#ha-picker").classList.toggle("hidden", this.transport !== "ha");
    this.$("#transport-help").textContent = this.t("transport_" + this.transport + "_help");
    const found = this.bleMessage === "ha_devices_found";
    const completed = found || this.bleMessage === "ha_devices_empty";
    const status = this.$("#ble-status");
    let message = this.bleMessage ? this.t(this.bleMessage) : "";
    if (completed) message = scanSummary(this.language, this.devices.length);
    // Keep the live region stable. Other panel updates need not repeat the
    // announcement, while changing language still updates the whole status.
    if (status.textContent !== message) status.textContent = message;
    status.classList.toggle("scan-complete", completed);
    status.classList.toggle("scan-success", found);
    const hint = this.$("#ble-hint");
    hint.textContent = completed ? this.t(this.bleMessage) : "";
    hint.classList.toggle("hidden", !completed);
    this.$("#scan").disabled = Boolean(this.busy || this.scanning || this.connecting);
  }

  connectionControls() {
    const locked = Boolean(this.busy || this.connecting || this.scanning);
    for (const key of ["#transport", "#ha-device", "#scan"]) this.$(key).disabled = locked;
    this.$("#connect").disabled = locked || (this.transport === "ha" && !this.$("#ha-device").value);
  }

  renderDevices(devices) {
    this.devices = devices;
    const selected = this.$("#ha-device").value;
    // Registry labels are display-only. Render them as plain text and keep
    // the BLE address as the option value for the independent identity read.
    const option = (value, label) => {
      const node = document.createElement("option"); node.value = value; node.textContent = label; return node;
    };
    this.$("#ha-device").replaceChildren(option("", this.t("ha_choose")),
      ...devices.map(device => {
        const label = [device.name, device.address];
        if (device.ha_name && device.ha_name !== device.name) label.unshift(device.ha_name);
        if (device.ha_area && !label.includes(device.ha_area)) label.unshift(device.ha_area);
        return option(device.address, label.join(" · "));
      }));
    if (devices.some(device => device.address === selected)) this.$("#ha-device").value = selected;
  }

  async scan() {
    if (this.busy || this.scanning || this.connecting) return;
    this.invalidateSelection(); this.scanning = true; this.connectionControls();
    this.lastError = null; this.$("#error").textContent = "";
    this.bleMessage = "ha_scanning"; this.updateTransport();
    try {
      const result = await this.rpc("ble_scan");
      this.renderDevices(result.devices);
      this.bleMessage = result.devices.length ? "ha_devices_found" : "ha_devices_empty";
    } catch (error) { this.renderDevices([]); this.bleMessage = null; this.fail(error); }
    finally { this.scanning = false; this.updateTransport(); this.connectionControls(); }
  }

  t(key) { return t(this.language, key); }

  applyLanguage() {
    if (this.$("#show-sidebar")) this.renderSidebar();
    this.setAttribute("lang", this.language);
    this.$("#language").value = this.language;
    this.shadowRoot.querySelectorAll("[data-i18n]").forEach(node => {
      node.textContent = this.t(node.dataset.i18n);
    });
    this.shadowRoot.querySelectorAll("[data-i18n-aria]").forEach(node => {
      node.setAttribute("aria-label", this.t(node.dataset.i18nAria));
    });
    this.$("#sonoff").lang = this.language;
    this.$("#sonoff").hass = this.hass;
    this.$("#brands").setAttribute("aria-label", this.language === "ru" ? "Бренд устройства" : "Device brand");
    this.updatePasswordLabel(); this.updateModelText();
    this.renderProfileInfo();
    this.renderSavedWifi();
    this.renderLiteInstallation();
    for (const scope of ["preview", "recovery"]) {
      const password = this.$(`#${scope}-ap-password`).textContent;
      this.$(`#${scope}-ap`).textContent = this.t(password ? "lite_hide_password" : scope === "recovery" ? "lite_show_password" : "show_password");
    }
    this.updateTransport();
    if (this.devices) this.renderDevices(this.devices);
    if (this.lastError) this.$("#error").textContent = this.t(errorKey(this.lastError));
  }

  updatePasswordLabel() {
    const key = this.$("#password").type === "password" ? "show_password" : "hide_password";
    this.$("#show-password").textContent = this.t(key);
    this.$("#show-password").setAttribute("aria-label", this.t(key));
  }

  updateModelText() {
    const model = this.model === "monitor1" ? "monitor1" : "monitor2";
    this.$("#unsupported-title").textContent = this.t(model + "_title");
    this.$("#unsupported-text").textContent = this.t(model + "_info");
    this.$("#usb-choice").classList.toggle("hidden", this.model !== "monitor1");
    this.$("#usb-choice").lang = this.language;
    this.$("#usb-choice").hass = this.hass;
  }

  message(key) {
    this.messageKey = key;
    this.renderLiteInstallation();
  }
  fail(error) { this.lastError = error; this.$("#error").textContent = this.t(errorKey(error)); }

  async loadSavedWifi() {
    try {
      this.savedWifi = await this.rpc("lite_saved_wifi");
      this.renderSavedWifi();
    } catch (error) { this.fail(error); }
  }

  renderSavedWifi() {
    const available = this.transport === "ha" && Boolean(this.savedWifi?.ssid);
    const choice = this.$("#use-saved-wifi");
    if (!available) choice.checked = false;
    const selected = available && choice.checked;
    this.$("#saved-wifi").classList.toggle("hidden", !available);
    this.$("#saved-ssid").textContent = available ? this.savedWifi.ssid : "";
    this.$("#manual-wifi").classList.toggle("hidden", selected);
    this.$("#ssid").disabled = selected;
    this.$("#password").disabled = selected;
  }

  hideLitePassword(scope) {
    const password = this.$(`#${scope}-ap-password`);
    const button = this.$(`#${scope}-ap`);
    if (password.textContent) button.textContent = this.t(scope === "recovery" ? "lite_show_password" : "show_password");
    if (scope === "recovery") button.setAttribute?.("aria-expanded", "false");
    password.textContent = "";
    password.classList.toggle("hidden", true);
    // Invalidate an in-flight reveal if selection or visibility changed.
    this.apRequests ??= {};
    this.apRequests[scope] = null;
  }

  async toggleLitePassword(scope) {
    const element = this.$(`#${scope}-ap-password`);
    if (element.textContent) { this.hideLitePassword(scope); return; }
    const preview = scope === "preview";
    if (preview && this.busy) return;
    const address = preview ? this.identity?.mac : this.$("#recovery-device").value;
    if (!address) return;
    const request = {};
    this.apRequests ??= {};
    this.apRequests[scope] = request;
    try {
      const result = await this.rpc(preview ? "lite_ap_preview" : "lite_ap_reveal", {address});
      if (this.apRequests[scope] !== request) return;
      if (preview) this.apToken = result.token;
      element.textContent = result.password;
      element.classList.remove("hidden");
      this.$(`#${scope}-ap`).textContent = this.t("lite_hide_password");
      if (!preview) this.$("#recovery-ap").setAttribute("aria-expanded", "true");
    } catch (error) {
      if (this.apRequests[scope] === request) this.fail(error);
    }
  }

  liteCheckText(check) {
    if (!check) return "";
    const text = check.error ? this.t(errorKey({code: check.error}))
      : this.t(check.stage || "lite_check_unknown");
    const sensors = (check.missing || []).filter(name => ["CO2", "Temperature", "Humidity"].includes(name));
    return sensors.length ? `${text} ${this.t("lite_waiting_sensors")} ${sensors.map(name => this.t("lite_sensor_" + name)).join(", ")}.` : text;
  }

  async loadLiteInstallations(preferAddress) {
    clearTimeout(this.recoveryPoll);
    const request = this.installationsRequest = (this.installationsRequest || 0) + 1;
    try {
      const {devices} = await this.rpc("lite_installations");
      if (request !== this.installationsRequest) return;
      const before = this.liteInstallations || [];
      this.liteInstallations = devices;
      if (devices.some(item => item.verification.verified &&
          before.some(previous => previous.mac === item.mac && !previous.verification.verified))) {
        this.loadSavedWifi();
      }
      const picker = this.$("#recovery-device");
      const old = picker.value;
      const signature = JSON.stringify(devices.map(({mac, name, label}) => [mac, name, label]));
      if (signature !== this.recoverySignature) {
        this.recoverySignature = signature;
        picker.replaceChildren(...devices.map(({mac, name, label}) => {
          const option = document.createElement("option");
          option.value = mac;
          option.textContent = label || name;
          return option;
        }));
      }
      const preferred = preferAddress || old || this.activeLite;
      if (devices.some(item => item.mac === preferred)) picker.value = preferred;
      if (picker.value !== old) this.hideLitePassword("recovery");
      this.renderLiteInstallation();
      // HA may register the device a few seconds after creating the config
      // entry. Give the link a bounded chance to appear without rechecking.
      const awaitingLink = devices.some(item => item.verification.stage === "lite_check_added" && !item.device_id);
      if (!awaitingLink) this.linkPolls = 0;
      if (this.isConnected && (devices.some(item => item.verification.running || item.transferring)
          || (awaitingLink && (this.linkPolls = (this.linkPolls || 0) + 1) <= 5))) {
        this.recoveryPoll = setTimeout(() => this.loadLiteInstallations(), 2000);
      }
      return devices;
    } catch (error) {
      if (request !== this.installationsRequest) return;
      this.fail(error);
      if (this.isConnected && this.liteInstallations?.some(item => item.verification.running || item.transferring)) {
        this.recoveryPoll = setTimeout(() => this.loadLiteInstallations(), 2000);
      }
    }
  }

  async retryLiteInstallation() {
    const item = this.liteInstallations?.find(device => device.mac === this.$("#recovery-device").value);
    if (!item || this.retryAddress || item.verification.running || item.verification.verified || item.transferring) return;
    this.retryAddress = item.mac;
    this.retryError = null;
    this.$("#recovery-check").disabled = true;
    this.lastError = null; this.$("#error").textContent = "";
    try {
      // Retry is owner-scoped by MAC. It has no arm, provision or flash path.
      const verification = await this.rpc("lite_verify", {address: item.mac});
      const current = this.liteInstallations.find(device => device.mac === item.mac);
      if (current) current.verification = verification;
    } catch (error) {
      this.retryError = {mac: item.mac, code: errorKey(error)};
    }
    finally {
      this.retryAddress = null;
      this.renderLiteInstallation();
      await this.loadLiteInstallations();
    }
  }

  renderLiteInstallation() {
    const live = this.sessionStatus;
    // Before an OTA intent exists, the transient session owns its setup
    // status. Afterwards the selected durable record is the single result.
    const settingUp = Boolean(this.provisioning || (live && !live.sent) || (!live && this.session));
    const picker = this.$("#recovery-device");
    const devices = this.liteInstallations || [];
    const item = settingUp ? null : devices.find(device => device.mac === picker.value);
    const check = item?.verification || live?.verification;
    const transferring = item?.transferring ?? (live?.state === "sending");
    const verified = Boolean(check?.verified && !check.running);
    const running = Boolean(check?.running);
    const needsReview = Boolean(item && !transferring && !verified && !running);
    const retryError = needsReview && this.retryError?.mac === item.mac ? this.retryError.code : null;
    const error = retryError || check?.error || (!item ? live?.error_code : null);
    const added = verified && (check.stage === "lite_check_added" || Boolean(item?.device_id));
    let state = live?.state || this.messageKey;
    if (transferring) state = "sending";
    else if (running) {
      const stages = {lite_check_readings: "lite_check_readings_title",
        lite_check_enrollment: "lite_check_enrollment_title"};
      state = stages[check.stage] || "lite_check_connecting_title";
    } else if (verified) state = added ? "lite_check_added_title" : "installed";
    else if (needsReview) state = "needs_review";
    const detail = added ? this.t("lite_check_success_detail") : retryError ? this.t(retryError)
      : (transferring ? this.t("lite_transfer_detail")
        : this.liteCheckText(check?.stage || check?.error ? check : null))
        || (error ? this.t(errorKey({code: error})) : needsReview ? this.t("lite_check_unknown") : "");

    this.$("#progress-box").classList.toggle("hidden", !state);
    this.$("#lite-result-picker").classList.toggle("hidden", settingUp || devices.length < 2);
    const name = this.$("#lite-result-name");
    name.textContent = devices.length === 1 && item ? item.label || item.name : "";
    name.classList.toggle("hidden", !name.textContent);
    this.$("#recovery-info").classList.toggle("hidden", !item);
    if (!state) return;
    this.$("#status").textContent = this.t(state);
    this.$("#detail").textContent = detail;
    this.$("#lite-result-status").setAttribute("data-tone", needsReview ? "warning" : verified ? "success" : "active");

    const progress = this.$("#progress");
    progress.classList.toggle("hidden", !transferring);
    progress.value = item?.progress ?? live?.progress ?? 0;
    const steps = this.$("#lite-steps");
    steps.classList.toggle("hidden", !(item || live?.sent));
    const booted = verified || ["lite_check_readings", "lite_check_enrollment"].includes(check?.stage);
    const transferDone = verified || booted || Boolean(item?.transfer_confirmed ?? live?.transfer_confirmed);
    const phases = [transferDone ? "done" : transferring ? "active" : "waiting",
      booted ? "done" : running ? "active" : needsReview && transferDone ? "warn" : "waiting",
      verified ? "done" : booted && running ? "active" : booted && needsReview ? "warn" : "waiting"];
    const symbols = {done: "✓", active: "◉", warn: "!", waiting: "○"};
    for (const [index, key] of ["lite_step_transfer", "lite_step_boot", "lite_step_readings"].entries()) {
      const step = steps.children[index];
      step.textContent = symbols[phases[index]] + " " + this.t(key);
      step.dataset.phase = phases[index];
    }

    const busyBLE = live?.transport === "ha" && live.provisioning_started && !live.provisioned && !live.error_code;
    const resume = Boolean(settingUp && live?.state === "ready" && !live.armed && !this.provisioning
      && (live.transport !== "ha" || live.provisioned));
    const cancel = Boolean(settingUp && live && !live.sent && !this.provisioning && !busyBLE);
    const button = this.$("#recovery-check");
    button.classList.toggle("hidden", !needsReview);
    button.disabled = this.retryAddress === item?.mac && Boolean(this.retryAddress);
    this.$("#lite-retry-note").classList.toggle("hidden", !needsReview);
    this.$("#resume").classList.toggle("hidden", !resume);
    this.$("#cancel").classList.toggle("hidden", !cancel);
    const link = this.$("#lite-device-link");
    const deviceID = added && /^[a-f0-9]{32}$/.test(item?.device_id || "") ? item.device_id : null;
    if (deviceID) link.href = "/config/devices/device/" + deviceID;
    else link.removeAttribute("href");
    link.classList.toggle("hidden", !deviceID);
    this.$("#lite-result-actions").classList.toggle("hidden", !(needsReview || resume || cancel || deviceID));
    if (!item) return;

    this.$("#lite-result-wifi").classList.toggle("hidden", !item.ap_ssid);
    this.$("#recovery-ap").classList.toggle("hidden", !item.ap_available);
    this.$("#recovery-ap-network").textContent = item.ap_ssid || "";
    this.$("#recovery-history").replaceChildren(...item.history.map(row => {
      const node = document.createElement("li");
      const date = document.createElement("span");
      const versions = document.createElement("strong");
      const status = document.createElement("span");
      date.textContent = row.at ? new Date(row.at).toLocaleString(this.language) : "—";
      versions.textContent = (row.from_version ?? "—") + " → " + (row.public_version ?? "—");
      status.textContent = ["verified", "needs_review", "acknowledged", "consumed"].includes(row.state)
        ? this.t("lite_history_" + row.state) : this.t("lite_history_unknown");
      node.append(versions, date, status);
      return node;
    }));
  }

  async flash() {
    if (this.busy) return;
    if (!this.identity || !this.profile) return;
    this.busy = true; this.$("#flash").disabled = true; this.connectionControls();
    this.lastError = null; this.$("#error").textContent = "";
    const ssid = this.$("#ssid").value, password = this.$("#password").value;
    const useSaved = this.transport === "ha" && this.$("#use-saved-wifi").checked;
    const wifi = useSaved ? {use_saved_wifi: true, saved_wifi_revision: this.savedWifi.revision}
      : {ssid, wifi_password: password, remember_wifi: this.$("#remember-wifi").checked};
    this.hideLitePassword("preview");
    try {
      this.provisioning = true;
      this.message("preparing");
      const result = await this.rpc("create", {data: {...this.identity, profile: this.profile.id, ...wifi,
        ...(this.apToken ? {ap_token: this.apToken} : {}),
        usb: this.$("#usb").checked, transport: this.transport, selection: this.stock.selection}});
      this.session = result.id;
      this.activeLite = result.mac;
      sessionStorage.setItem("qingping-installer-device", result.mac);
      // Session ID is not an authorization credential; HA checks its owner.
      sessionStorage.setItem("qingping-installer-session", this.session);
      this.startPolling();
      await this.stock.provision(ssid, password, result.broker, text => this.message(text), this.session);
      this.$("#password").value = "";
      await this.rpc("arm", {session: result.id});
    } catch (error) {
      this.fail(error);
      if (!this.session) {this.busy = false; this.$("#flash").disabled = false; this.connectionControls();}
    } finally {
      this.provisioning = false;
      this.stock?.disconnect();
      this.renderLiteInstallation();
    }
  }

  startPolling() {
    clearInterval(this.poller);
    if (!this.session) return;
    const update = async () => {
      if (this.polling || !this.session) return;
      this.polling = true;
      const session = this.session;
      try {
        const result = await this.rpc("status", {session});
        if (this.session !== session) return;
        this.sessionStatus = result;
        if (result.error && !result.sent) this.fail({code: result.error_code || "operation_failed"});
        if (result.sent) {
          // Hand off to the durable record as soon as the OTA is consumed.
          // This keeps one result even if the short-lived session later expires.
          this.activeLite = result.mac;
          sessionStorage.setItem("qingping-installer-device", result.mac);
          this.lastError = null; this.$("#error").textContent = "";
          const devices = await this.loadLiteInstallations(result.mac);
          if (!devices?.some(item => item.mac === result.mac)) {
            this.renderLiteInstallation();
            return;
          }
          clearInterval(this.poller);
          this.loadSavedWifi();
          this.finishLiteSession();
        } else {
          this.renderLiteInstallation();
        }
      } catch (error) {
        if (this.session !== session) return;
        clearInterval(this.poller);
        if (errorKey(error) === "session_missing") {
          this.finishLiteSession();
          const devices = await this.loadLiteInstallations(this.activeLite);
          if (devices && !devices.some(item => item.mac === this.activeLite)) this.fail(error);
        } else {
          this.fail(error);
        }
      } finally {
        this.polling = false;
      }
    };
    this.poller = setInterval(update, 2000);
    update();
  }

  finishLiteSession() {
    sessionStorage.removeItem("qingping-installer-session");
    this.session = null;
    this.sessionStatus = null;
    this.messageKey = null;
    this.busy = false;
    this.connectionControls();
    this.$("#flash").disabled = false;
    this.$("#form").classList.add("hidden");
    this.renderLiteInstallation();
  }

}

customElements.define("qingping-installer-panel", QingpingPanel);
