/** Local HACS wizard. No CDN, analytics, cloud build or browser credential storage.
 *
 * Chrome's device picker is always a real user gesture. Setup writes are
 * sequential and acknowledged, while the HA backend independently verifies
 * the stock MQTT MAC/version before consuming its one firmware command.
 */
import {requireLiteProfile} from "./compatibility.mjs";
import {HABluetoothConnection} from "./ha-transport.mjs";
import {t, failure, errorKey, readLanguage, saveLanguage, normalizeLanguage} from "./i18n.mjs";

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
    if (!this.initialized && this.isConnected) this.initialize();
  }
  get hass() { return this._hass; }
  connectedCallback() { if (this.hass && !this.initialized) this.initialize(); }
  disconnectedCallback() { clearInterval(this.poller); this.stock?.disconnect(); }

  async rpc(operation, extra = {}) {
    return this.hass.callWS({type: "qingping_esphome/command", operation, ...extra});
  }

  initialize() {
    this.initialized = true;
    this.language = readLanguage();
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
      </style>
      <main><header><div class="heading"><h1>Qingping → ESPHome</h1><label class="language"><span data-i18n="language"></span><select id="language"><option value="en" lang="en">English</option><option value="ru" lang="ru">Русский</option></select></label></div><p class="muted"><span data-i18n="tagline"></span></p></header>
      <div class="cards" role="group" data-i18n-aria="model_label">
       <button class="model" data-model="lite" aria-pressed="true"><b>Air Monitor Lite</b><span><span data-i18n="lite_summary"></span></span></button>
       <button class="model" data-model="monitor1" aria-pressed="false"><b>Air Monitor 1</b><span><span data-i18n="monitor1_summary"></span></span></button>
       <button class="model" data-model="monitor2" aria-pressed="false"><b>Air Monitor 2</b><span><span data-i18n="monitor2_summary"></span></span></button>
      </div>
      <section id="unsupported" class="box hidden"><h2 id="unsupported-title"></h2><p id="unsupported-text"></p><a href="https://github.com/ivaschru/qingping-esphome#compatibility" target="_blank" rel="noreferrer"><span data-i18n="compatibility"></span></a></section>
      <section id="wizard" class="box"><h2><span data-i18n="connect_title"></span></h2>
       <p class="note muted"><span data-i18n="connect_help"></span></p>
       <label for="transport"><span data-i18n="transport_label"></span></label><select id="transport" aria-describedby="transport-help"><option value="browser" data-i18n="transport_browser"></option><option value="ha" data-i18n="transport_ha"></option></select>
       <p id="transport-help" class="note muted"></p>
       <div id="ha-picker" class="hidden"><div class="row"><div class="ha-device-field"><label for="ha-device"><span data-i18n="ha_device_label"></span></label><select id="ha-device"></select></div><button id="scan" class="secondary"><span data-i18n="ha_scan"></span></button></div><p id="ble-status" class="note muted" role="status"></p></div>
       <button id="connect" class="secondary"><span data-i18n="connect"></span></button>
       <div id="identity" class="identity" aria-live="polite"></div>
       <form id="form" class="hidden"><h2><span data-i18n="install_title"></span></h2><div class="grid">
        <label><span data-i18n="ssid"></span><input id="ssid" type="text" required autocomplete="off" spellcheck="false"></label>
        <div class="password"><label><span data-i18n="wifi_password"></span><input id="password" type="password" autocomplete="off"></label><button id="show-password" class="secondary" type="button" data-i18n-aria="show_password"></button></div>
       </div><label class="check"><input id="usb" type="checkbox" required><span><span data-i18n="usb_ack"></span></span></label>
       <p class="note muted"><span data-i18n="install_note"></span></p>
       <button id="flash" type="submit" class="primary"><span data-i18n="flash"></span></button></form>
      </section>
      <section id="progress-box" class="box hidden" aria-live="polite"><div id="status" class="status"></div><progress id="progress" max="100" value="0" data-i18n-aria="progress_label"></progress><p id="detail" class="note muted"></p><button id="resume" class="primary hidden"><span data-i18n="resume"></span></button><button id="cancel" class="secondary hidden"><span data-i18n="cancel"></span></button></section>
      <p id="error" class="error" role="alert"></p>
      <footer><span data-i18n="footer"></span> <a href="https://github.com/ivaschru/qingping-esphome" target="_blank" rel="noreferrer"><span data-i18n="source"></span></a></footer></main>`;
    this.$ = selector => this.shadowRoot.querySelector(selector);
    this.shadowRoot.querySelectorAll("[data-model]").forEach(button => button.onclick = () => this.selectModel(button.dataset.model));
    this.$("#language").onchange = event => {
      this.language = normalizeLanguage(event.target.value);
      saveLanguage(this.language);
      this.applyLanguage();
    };
    this.applyLanguage();
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
        this.$("#progress-box").classList.add("hidden"); this.$("#form").classList.add("hidden");
        this.fail({code: "session_closed"});
      } catch (error) { this.fail(error); }
    };
    this.session = sessionStorage.getItem("qingping-installer-session");
    if (this.session) { this.busy = true; this.$("#connect").disabled = true; this.startPolling(); }
    this.connectionControls();
    // Retain the same catalog for this page; the backend still checks a fresh
    // request independently. Await this promise before showing the flash form.
    this.catalogReady = this.rpc("catalog").then(result => { this.catalog = result.models; });
    this.catalogReady.catch(error => this.fail(error));
  }

  selectModel(model) {
    if (this.busy || this.connecting || this.scanning) return;
    this.shadowRoot.querySelectorAll("[data-model]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.model === model)));
    this.$("#wizard").classList.toggle("hidden", model !== "lite");
    this.$("#unsupported").classList.toggle("hidden", model === "lite");
    this.model = model;
    this.updateModelText();
  }

  async connect() {
    if (this.busy || this.connecting || this.scanning) return;
    this.connecting = true; this.connectionControls();
    this.lastError = null; this.$("#error").textContent = "";
    // Selecting an unsupported second device must not leave the previous
    // supported device's form/identity armed and available for submission.
    this.identity = null; this.profile = null;
    this.$("#form").classList.add("hidden");
    this.stock?.disconnect();
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
      this.profile = requireLiteProfile(this.catalog, identity);
      this.identity = identity;
      this.$("#form").classList.remove("hidden");
    } catch (error) { this.stock.disconnect(); this.fail(error); }
    finally { this.connecting = false; this.connectionControls(); }
  }

  invalidateSelection() {
    this.identity = null; this.profile = null;
    this.stock?.disconnect(); this.stock = null;
    this.$("#identity").replaceChildren();
    this.$("#form").classList.add("hidden");
  }

  changeTransport() {
    if (this.busy || this.connecting || this.scanning) { this.$("#transport").value = this.transport; return; }
    this.transport = this.$("#transport").value;
    this.invalidateSelection();
    this.lastError = null; this.$("#error").textContent = "";
    this.updateTransport(); this.connectionControls();
  }

  updateTransport() {
    this.$("#ha-picker").classList.toggle("hidden", this.transport !== "ha");
    this.$("#transport-help").textContent = this.t("transport_" + this.transport + "_help");
    if (this.bleMessage) this.$("#ble-status").textContent = this.t(this.bleMessage);
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
    // Advertised names are untrusted data. Build text nodes, never HTML.
    const option = (value, label) => {
      const node = document.createElement("option"); node.value = value; node.textContent = label; return node;
    };
    this.$("#ha-device").replaceChildren(option("", this.t("ha_choose")),
      ...devices.map(device => option(device.address, `${device.name} · ${device.address}`)));
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
    } catch (error) { this.renderDevices([]); this.bleMessage = null; this.$("#ble-status").textContent = ""; this.fail(error); }
    finally { this.scanning = false; this.updateTransport(); this.connectionControls(); }
  }

  t(key) { return t(this.language, key); }

  applyLanguage() {
    this.setAttribute("lang", this.language);
    this.$("#language").value = this.language;
    this.shadowRoot.querySelectorAll("[data-i18n]").forEach(node => {
      node.textContent = this.t(node.dataset.i18n);
    });
    this.shadowRoot.querySelectorAll("[data-i18n-aria]").forEach(node => {
      node.setAttribute("aria-label", this.t(node.dataset.i18nAria));
    });
    this.updatePasswordLabel(); this.updateModelText();
    this.updateTransport();
    if (this.devices) this.renderDevices(this.devices);
    if (this.messageKey) this.$("#status").textContent = this.t(this.messageKey);
    if (this.installationComplete) this.$("#detail").textContent = this.t("installed_detail");
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
  }

  message(key) {
    this.messageKey = key;
    this.$("#progress-box").classList.remove("hidden");
    this.$("#status").textContent = this.t(key);
  }
  fail(error) { this.lastError = error; this.$("#error").textContent = this.t(errorKey(error)); }

  async flash() {
    if (this.busy) return;
    if (!this.identity || !this.profile) return;
    this.busy = true; this.$("#flash").disabled = true; this.connectionControls();
    this.lastError = null; this.$("#error").textContent = "";
    const ssid = this.$("#ssid").value, password = this.$("#password").value;
    try {
      this.provisioning = true;
      this.message("preparing");
      const result = await this.rpc("create", {data: {...this.identity, profile: this.profile.id, ssid, wifi_password: password,
        usb: this.$("#usb").checked, transport: this.transport, selection: this.stock.selection}});
      this.session = result.id;
      // Session ID is not an authorization credential; HA checks its owner.
      sessionStorage.setItem("qingping-installer-session", this.session);
      this.startPolling();
      await this.stock.provision(ssid, password, result.broker, text => this.message(text), this.session);
      this.$("#password").value = "";
      await this.rpc("arm", {session: this.session});
      this.message("sending");
    } catch (error) {
      this.fail(error);
      if (!this.session) {this.busy = false; this.$("#flash").disabled = false; this.connectionControls();}
    } finally {
      this.provisioning = false;
      this.stock?.disconnect();
    }
  }

  startPolling() {
    clearInterval(this.poller);
    const update = async () => {
      if (this.polling) return;
      this.polling = true;
      try {
        const result = await this.rpc("status", {session: this.session});

        this.message(result.state); this.$("#progress").value = result.progress;
        const haProvisioning = result.transport === "ha" && result.provisioning_started && !result.provisioned && !result.error_code;
        this.$("#resume").classList.toggle("hidden", result.state !== "ready" || result.armed || this.provisioning || (result.transport === "ha" && !result.provisioned));
        this.$("#cancel").classList.toggle("hidden", result.sent || this.provisioning || haProvisioning);
        this.$("#detail").textContent = result.name + (result.progress ? ` · ${result.progress}%` : "");
        if (result.error) this.fail({code: result.error_code || "operation_failed"});
        if (["installed", "needs_review", "identity_mismatch"].includes(result.state)) {
          clearInterval(this.poller);
          if (result.state === "installed") {
            sessionStorage.removeItem("qingping-installer-session");
            this.installationComplete = true;
            this.$("#detail").textContent = this.t("installed_detail");
          }
        }
      } catch (error) { this.fail(error); clearInterval(this.poller); }
      finally { this.polling = false; }
    };
    update(); this.poller = setInterval(update, 2000);
  }
}

customElements.define("qingping-installer-panel", QingpingPanel);
