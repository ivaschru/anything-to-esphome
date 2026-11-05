/** Local HACS wizard. No CDN, analytics, cloud build or browser credential storage.
 *
 * Chrome's device picker is always a real user gesture. Setup writes are
 * sequential and acknowledged, while the HA backend independently verifies
 * the stock MQTT MAC/version before consuming its one firmware command.
 */
const VENDOR = "22210000-554a-4546-5542-46534450464d";
const INFO = "0000180a-0000-1000-8000-00805f9b34fb";
const characteristic = n => `${n.toString(16).padStart(8, "0")}-0000-1000-8000-00805f9b34fb`;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const decode = value => new TextDecoder().decode(value).replace(/\0+$/, "").trim();

class StockConnection {
  async connect() {
    if (!navigator.bluetooth) throw new Error("Откройте панель по HTTPS в Chrome на Mac, Windows или Android");
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
      const timeout = setTimeout(() => { c.removeEventListener("characteristicvaluechanged", received); reject(new Error("Нет ответа MAC. Удерживайте верхнюю полоску 8 секунд до большого Wi-Fi значка и подключитесь снова")); }, 7000);
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
    if (payload.length > 254) throw new Error("Параметры не помещаются в stock BLE packet");
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
          throw new Error("Датчик отклонил настройку. Новая прошивка не отправлялась; проверьте режим подключения");
        }
        await wait(500); return;
      }
      await wait(30);
    }
    throw new Error("Нет подтверждения настройки. Не повторяйте её автоматически; проверьте сессию");
  }

  async provision(ssid, password, broker, message) {
    const mac = await this.readMac();
    if (mac !== this.identity.mac) throw new Error("Выбранный прибор изменился");
    const token = crypto.getRandomValues(new Uint8Array(16));
    for (const command of [1, 2]) {
      await this.send(1, command, token); await this.ack(command);
    }
    const encode = text => new TextEncoder().encode(text);
    message("Передаём Wi-Fi и параметры локального загрузчика");
    await this.send(0x0d, 1, encode(`"${ssid}","${password}"`)); await wait(500);
    await this.send(1, 0x17, encode(`${broker.host} ${broker.port} ${broker.username} ${broker.password}`));
    await this.ack(0x17);
    await this.send(1, 0x18, encode(`${broker.client_id} ${broker.down} ${broker.up}`));
    await this.ack(0x18);
    // Stock can start Wi-Fi asynchronously. Do not tear the BLE session down
    // immediately after its last setter; that caused a real setup failure.
    message("Ждём подключения датчика к локальному загрузчику");
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
    this.attachShadow({mode: "open"});
    this.shadowRoot.innerHTML = `
      <style>
      :host{display:block;color:var(--primary-text-color,#202124);background:var(--primary-background-color,#f6f7f8);min-height:100vh;font:16px/1.5 system-ui,sans-serif;--accent:var(--primary-color,#087f8c)}
      *{box-sizing:border-box} main{max-width:960px;margin:auto;padding:40px 24px 64px}h1{font-size:30px;letter-spacing:-.8px;line-height:1.2;margin:0 0 8px}h2{font-size:20px;margin:0 0 20px}p{margin:0 0 20px}.muted{color:var(--secondary-text-color,#58616b)}
      header{margin-bottom:30px} .cards{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px}.model{padding:18px;text-align:left;min-height:100px;background:var(--card-background-color,#fff);border:1px solid var(--divider-color,#d8dde2);border-radius:14px;color:inherit}.model[aria-pressed=true]{border:2px solid var(--accent);padding:17px}.model b{display:block;margin-bottom:8px}.model span{font-size:13px;color:var(--secondary-text-color,#58616b)}
      .box{background:var(--card-background-color,#fff);border:1px solid var(--divider-color,#d8dde2);border-radius:16px;padding:26px;margin-bottom:20px}.identity{display:flex;gap:12px;flex-wrap:wrap;margin:16px 0}.identity span{background:var(--secondary-background-color,#f0f2f5);padding:6px 10px;border-radius:8px;font:13px ui-monospace,monospace}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}label{display:block;font-weight:600;font-size:14px}input[type=text],input[type=password]{display:block;width:100%;height:48px;border:1px solid var(--divider-color,#c8cfd6);border-radius:9px;margin-top:7px;padding:10px 12px;background:var(--card-background-color,#fff);color:inherit;font:16px system-ui}
      button{font:600 15px system-ui;min-height:46px;border-radius:9px;padding:11px 18px;cursor:pointer;transition:background .15s,border-color .15s}button:disabled{opacity:.55;cursor:default}button.primary{background:var(--accent);border:1px solid var(--accent);color:var(--text-primary-color,#fff)}button.secondary{background:transparent;color:inherit;border:1px solid var(--divider-color,#c8cfd6)}button:focus-visible,input:focus-visible,a:focus-visible{outline:3px solid var(--accent);outline-offset:3px}.row{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.check{display:flex;gap:10px;align-items:flex-start;font-weight:400;margin:22px 0}.check input{width:20px;height:20px;margin-top:2px;accent-color:var(--accent)}.note{font-size:14px}.error{color:var(--error-color,#b42318);white-space:pre-wrap}.status{margin-bottom:10px;font-weight:600}progress{width:100%;height:12px;accent-color:var(--accent)}.hidden{display:none!important}.password{display:flex;align-items:end;gap:8px}.password label{flex:1}.password button{padding:10px;min-width:46px;font-size:12px}footer{font-size:13px;color:var(--secondary-text-color,#58616b)}a{color:var(--accent)}
      @media(max-width:650px){main{padding:25px 16px}.cards{grid-template-columns:1fr}.model{min-height:72px}.box{padding:20px}.grid{grid-template-columns:1fr}h1{font-size:27px}}@media(prefers-reduced-motion:reduce){button{transition:none}}
      </style>
      <main><header><h1>Qingping → ESPHome</h1><p class="muted">Один проект. Отдельный профиль для каждого прибора</p></header>
      <div class="cards" role="group" aria-label="Модель прибора">
       <button class="model" data-model="lite" aria-pressed="true"><b>Air Monitor Lite</b><span>CGDN1 · ESP32 · установщик beta</span></button>
       <button class="model" data-model="monitor1" aria-pressed="false"><b>Air Monitor 1</b><span>CGS1 · S8 / SCD40 · исходники порта</span></button>
       <button class="model" data-model="monitor2" aria-pressed="false"><b>Air Monitor 2</b><span>Отдельный профиль · пока не проверен</span></button>
      </div>
      <section id="unsupported" class="box hidden"><h2 id="unsupported-title"></h2><p id="unsupported-text"></p><a href="https://github.com/ivaschru/qingping-esphome#совместимость" target="_blank" rel="noreferrer">Матрица совместимости и исходники</a></section>
      <section id="wizard" class="box"><h2>1. Подключить прибор</h2>
       <p class="note muted">Подключите Lite к USB. Удерживайте верхнюю сенсорную полоску около 8 секунд до большого значка Wi-Fi – сетевые настройки будут сброшены. Затем выберите прибор через Bluetooth</p>
       <button id="connect" class="secondary">Выбрать Qingping по Bluetooth</button>
       <div id="identity" class="identity" aria-live="polite"></div>
       <form id="form" class="hidden"><h2>2. Установить ESPHome</h2><div class="grid">
        <label>Сеть Wi-Fi 2,4 ГГц<input id="ssid" type="text" required autocomplete="off" spellcheck="false"></label>
        <div class="password"><label>Пароль Wi-Fi<input id="password" type="password" autocomplete="off"></label><button id="show-password" class="secondary" type="button" aria-label="Показать пароль">Показать</button></div>
       </div><label class="check"><input id="usb" type="checkbox" required><span>Прибор подключён к USB. Во время установки питание не отключать</span></label>
       <p class="note muted">Будет установлена обычная UI25. Имя и индивидуальные ключи создаются автоматически внутри Home Assistant. Это заменяет заводскую прошивку; при неудачном раннем запуске восстановление может потребовать вскрытия</p>
       <button id="flash" type="submit" class="primary">Прошить Lite</button></form>
      </section>
      <section id="progress-box" class="box hidden" aria-live="polite"><div id="status" class="status"></div><progress id="progress" max="100" value="0" aria-label="Передача прошивки"></progress><p id="detail" class="note muted"></p><button id="resume" class="primary hidden">Продолжить установку</button><button id="cancel" class="secondary hidden">Закрыть сессию до прошивки</button></section>
      <p id="error" class="error" role="alert"></p>
      <footer>Мастер Lite работает локально через Home Assistant. <a href="https://github.com/ivaschru/qingping-esphome" target="_blank" rel="noreferrer">Открытый код</a></footer></main>`;
    this.$ = selector => this.shadowRoot.querySelector(selector);
    this.shadowRoot.querySelectorAll("[data-model]").forEach(button => button.onclick = () => this.selectModel(button.dataset.model));
    this.$("#connect").onclick = () => this.connect();
    this.$("#show-password").onclick = () => {
      const input = this.$("#password"); input.type = input.type === "password" ? "text" : "password";
      this.$("#show-password").textContent = input.type === "password" ? "Показать" : "Скрыть";
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
        this.$("#connect").disabled = false; this.$("#flash").disabled = false;
        this.$("#progress-box").classList.add("hidden"); this.$("#form").classList.add("hidden");
        this.$("#error").textContent = "Прошивка не отправлялась. Для новой настройки снова включите большой значок Wi-Fi";
      } catch (error) { this.fail(error); }
    };
    this.session = sessionStorage.getItem("qingping-installer-session");
    if (this.session) { this.busy = true; this.$("#connect").disabled = true; this.startPolling(); }
    this.rpc("catalog").catch(error => this.fail(error));
  }

  selectModel(model) {
    if (this.busy) return;
    this.shadowRoot.querySelectorAll("[data-model]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.model === model)));
    this.$("#wizard").classList.toggle("hidden", model !== "lite");
    this.$("#unsupported").classList.toggle("hidden", model === "lite");
    this.$("#unsupported-title").textContent = model === "monitor1" ? "Порт Monitor 1" : "Профиль Monitor 2";
    this.$("#unsupported-text").textContent = model === "monitor1" ? "Проверены CGS1 с SenseAir S8 и SCD40. Для первой установки нужен отдельный USB/ADB-путь; общий мастер ещё готовится. Lite-образ для него не используется." : "Для Monitor 2 ещё нет проверенного на приборе порта. Кнопка прошивки появится после определения аппаратного профиля и испытания установки.";
  }

  async connect() {
    this.$("#error").textContent = ""; this.$("#connect").disabled = true;
    this.stock?.disconnect(); this.stock = new StockConnection();
    try {
      const identity = await this.stock.connect(); this.identity = identity;
      this.$("#identity").replaceChildren(...[identity.model, "stock " + identity.stock_version, "HW " + identity.hardware, identity.mac].map(value => {
        const e = document.createElement("span"); e.textContent = value; return e;
      }));
      if (identity.model !== "CGDN1" || identity.stock_version !== "4.5.8" || identity.hardware !== "0001") {
        throw new Error("Эта аппаратная/заводская версия ещё не поддержана мастером. Настройки не менялись");
      }
      this.$("#form").classList.remove("hidden");
    } catch (error) { this.fail(error); }
    finally { this.$("#connect").disabled = false; }
  }

  message(text) { this.$("#progress-box").classList.remove("hidden"); this.$("#status").textContent = text; }
  fail(error) { this.$("#error").textContent = error.message || "Операция не завершена"; }

  async flash() {
    if (this.busy) return;
    this.busy = true; this.$("#flash").disabled = true; this.$("#connect").disabled = true;
    this.$("#error").textContent = "";
    const ssid = this.$("#ssid").value, password = this.$("#password").value;
    try {
      this.provisioning = true;
      this.message("Готовим индивидуальную прошивку в Home Assistant");
      const result = await this.rpc("create", {data: {...this.identity, profile: "lite", ssid, wifi_password: password, usb: this.$("#usb").checked}});
      this.session = result.id;
      // Session ID is not an authorization credential; HA checks its owner.
      sessionStorage.setItem("qingping-installer-session", this.session);
      this.startPolling();
      await this.stock.provision(ssid, password, result.broker, text => this.message(text));
      this.$("#password").value = "";
      await this.rpc("arm", {session: this.session});
      this.message("Передаём прошивку датчику");
    } catch (error) {
      this.fail(error);
      if (!this.session) {this.busy = false; this.$("#flash").disabled = false; this.$("#connect").disabled = false;}
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
        const text = {waiting_for_device: "Ждём подключения датчика", ready: "Датчик подключён к загрузчику", sending: "Передаём прошивку", waiting_for_esphome: "Проверяем загрузку ESPHome и показания", installed: "ESPHome установлен", needs_review: "Нужна проверка результата", identity_mismatch: "Идентификатор не совпал"}[result.state] || result.state;
        this.message(text); this.$("#progress").value = result.progress;
        this.$("#resume").classList.toggle("hidden", result.state !== "ready" || result.armed || this.provisioning);
        this.$("#cancel").classList.toggle("hidden", result.sent || this.provisioning);
        this.$("#detail").textContent = result.name + (result.progress ? ` · ${result.progress}%` : "");
        if (result.error) this.$("#error").textContent = result.error;
        if (["installed", "needs_review", "identity_mismatch"].includes(result.state)) {
          clearInterval(this.poller);
          if (result.state === "installed") {
            sessionStorage.removeItem("qingping-installer-session");
            this.$("#detail").textContent = "Подтверждены MAC, имя и живые CO₂, температура и влажность. Проверьте устройство в интеграции ESPHome";
          }
        }
      } catch (error) { this.fail(error); clearInterval(this.poller); }
      finally { this.polling = false; }
    };
    update(); this.poller = setInterval(update, 2000);
  }
}

customElements.define("qingping-installer-panel", QingpingPanel);
