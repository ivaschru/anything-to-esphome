/** S60TPF UI: state restoration only, never an automatic write/retry.
 * HA authenticates every command and binds selections/jobs to its admin user.
 * Credentials stay in this live form until sign-in, then are cleared; only a
 * non-authorizing job ID may be stored in sessionStorage for read-only resume.
 */
const TEXT = {
  en: {
    title: "Sonoff S60TPF", note: "Experimental installation · Wi-Fi S60TPF, factory 1.2.0 only. Keep the plug powered during conversion.",
    find: "Find plugs", finding: "Looking for configured Sonoff devices and local plugs…", choose: "Choose a plug",
    devices: "Device", empty: "No supported owned plugs found. Add the plug to eWeLink, then sign in below.",
    source: "Existing Sonoff integration", cloud: "eWeLink account", account: "Sign into eWeLink", accountHelp: "Needed when HA has no compatible authenticated Sonoff session. The plug must already belong to this account.",
    username: "Email or phone", password: "Password", region: "Account region", country: "Phone country code", login: "Sign in and load plugs",
    manual: "Not found? Enter an IP address", address: "Plug LAN IPv4", check: "Check selected plug",
    checking: "Checking account ownership, factory version and a fresh encrypted LAN reply…", ready: "Identity verified. Review the connected load before installation.",
    load: "The connected appliance may lose power and the relay will be tested. I allow this interruption.",
    power: "I understand that losing power while the initial bootloader is written may require opening the plug to recover it.",
    ble: "Enable Bluetooth Proxy after installation", install: "Back up and install ESPHome", preparing: "Preparing the verified engine and consuming this installation request…",
    running: "Converting firmware", verifying: "Checking encrypted ESPHome and measurements", verified: "ESPHome verified",
    outcome_unknown: "Outcome needs review. Installation has not been repeated. Keep the plug powered and inspect its state before any further conversion.",
    backup: "Download private factory backup", backupHelp: "Contains device and Wi-Fi secrets. Keep this file private.",
    another: "Choose another plug", generic: "The operation did not finish. Check the account, network and current installation before trying another action.",
    auth: "An authorized eWeLink session is required. Sign in below; do not enter a device key manually.",
    busy: "A conversion is running or its outcome needs review. Read its status first.",
    unavailable: "The plug did not answer locally. Check its network or try its IP address.",
    identity: "The identity, model or factory version changed. Select the plug again.",
    expired: "The selection expired. Search and select the plug again.",
    template: "The matching S60TPF template is missing. Install the complete release ZIP.",
    enrolling: "HA enrollment", existing_entry_check_required: "Existing ESPHome entry needs review", created: "Added to ESPHome",
    manual_flow_required: "Add this verified device through the ESPHome integration", existing_or_pending_flow: "An ESPHome entry or flow already exists",
    history: "Installation history", historyChoose: "Choose an installation", more: "Load older installations",
    diagnostics: "Download diagnostics", recover: "Check installed ESPHome", recoveryHelp: "Reads the existing encrypted app. Does not flash again, toggle the relay or change Bluetooth settings. If DHCP changed its address, enter the current local IP.",
    recoveryHost: "Current local IP (optional)", recovering: "Checking the original key, device identity and fresh measurements…",
    app_verified: "Installed app verified; the original worker has finished.", app_unavailable: "Could not verify the installed app. Keep the backup and check power/network before another read-only check.",
    writer_unconfirmed: "The app answers, but the original worker's completion is unconfirmed. The job remains blocked; no conversion was repeated.",
  },
  ru: {
    title: "Sonoff S60TPF", note: "Экспериментальная установка · только Wi-Fi S60TPF с заводской 1.2.0. Не отключайте питание во время установки.",
    find: "Найти розетки", finding: "Ищем устройства из Sonoff-интеграции и розетки в локальной сети…", choose: "Выберите розетку",
    devices: "Устройство", empty: "Поддерживаемые розетки не найдены. Добавьте розетку в eWeLink и войдите в аккаунт ниже.",
    source: "Настроенная интеграция Sonoff", cloud: "Аккаунт eWeLink", account: "Войти в eWeLink", accountHelp: "Нужно, если в HA нет совместимой авторизованной Sonoff-сессии. Розетка уже должна быть добавлена в этот аккаунт.",
    username: "Почта или телефон", password: "Пароль", region: "Регион аккаунта", country: "Телефонный код страны", login: "Войти и загрузить розетки",
    manual: "Не найдена? Указать IP", address: "Локальный IPv4 розетки", check: "Проверить выбранную розетку",
    checking: "Проверяем владельца, заводскую версию и свежий зашифрованный ответ по LAN…", ready: "Устройство проверено. Перед установкой проверьте подключённый потребитель.",
    load: "Питание подключённого прибора может прерываться, реле будет проверяться. Разрешаю этот перерыв.",
    power: "Понимаю: потеря питания во время первичной записи загрузчика может потребовать вскрытия розетки для восстановления.",
    ble: "Включить Bluetooth Proxy после установки", install: "Сохранить бэкап и установить ESPHome", preparing: "Готовим проверенный движок и фиксируем однократный запуск…",
    running: "Переводим на ESPHome", verifying: "Проверяем защищённый ESPHome и измерения", verified: "ESPHome проверен",
    outcome_unknown: "Нужно проверить результат на устройстве. Установка не повторялась. Оставьте розетку под питанием; не запускайте новую конверсию до проверки состояния.",
    backup: "Скачать закрытый заводской бэкап", backupHelp: "Содержит ключи устройства и Wi-Fi. Храните файл приватно.",
    another: "Выбрать другую розетку", generic: "Операция не завершилась. Проверьте аккаунт, сеть и текущее состояние установки перед дальнейшими действиями.",
    auth: "Нужна авторизация eWeLink. Войдите ниже; вручную вводить ключ устройства не требуется.",
    busy: "Конверсия уже выполняется или её результат требует проверки. Сначала проверьте статус.",
    unavailable: "Розетка не ответила по LAN. Проверьте сеть или укажите её IP.",
    identity: "Устройство, модель или заводская версия изменились. Выберите розетку заново.",
    expired: "Выбор устройства истёк. Повторите поиск и выбор розетки.",
    template: "Нет подходящего шаблона S60TPF. Установите полный ZIP релиза.",
    enrolling: "Подключение в HA", existing_entry_check_required: "Нужно проверить существующий ESPHome entry", created: "Добавлено в ESPHome",
    manual_flow_required: "Добавьте проверенную розетку через интеграцию ESPHome", existing_or_pending_flow: "ESPHome entry или настройка уже существует",
    history: "История установок", historyChoose: "Выберите установку", more: "Загрузить более ранние установки",
    diagnostics: "Скачать диагностику", recover: "Проверить установленный ESPHome", recoveryHelp: "Читает уже установленную прошивку по защищённому API. Не прошивает повторно, не переключает реле и Bluetooth. Если DHCP сменил адрес, укажите текущий локальный IP.",
    recoveryHost: "Текущий локальный IP (необязательно)", recovering: "Проверяем исходный ключ, устройство и свежие измерения…",
    app_verified: "Установленная прошивка проверена, исходный worker завершён.", app_unavailable: "Не удалось проверить прошивку. Сохраните бэкап и проверьте питание и сеть перед следующей проверкой.",
    writer_unconfirmed: "Прошивка отвечает, но завершение исходного worker не подтверждено. Попытка остаётся заблокированной, конверсия не повторялась.",
  },
};

export const sonoffText = (lang, key) => TEXT[lang === "ru" ? "ru" : "en"][key] || TEXT.en.generic;
const ERROR_KEYS = {
  sonoff_auth_required: "auth", sonoff_auth_failed: "auth", sonoff_busy: "busy",
  sonoff_unavailable: "unavailable", sonoff_unsupported: "identity", sonoff_identity_changed: "identity",
  sonoff_selection_expired: "expired", sonoff_template_missing: "template", sonoff_outcome_unknown: "outcome_unknown",
};

class SonoffInstaller extends HTMLElement {
  static get observedAttributes() { return ["lang"]; }
  set hass(value) { this._hass = value; if (this.isConnected && !this.initialized) this.initialize(); }
  get hass() { return this._hass; }
  get busy() { return this.pending || this.jobs?.some(job => ["running", "verifying"].includes(job.state)
    || (job.state === "outcome_unknown" && !job.writer_settled)); }
  connectedCallback() {
    if (this.hass && !this.initialized) this.initialize();
    else if (this.initialized && this.job) this.poll();
  }
  disconnectedCallback() { clearTimeout(this.timer); }
  attributeChangedCallback() { if (this.initialized) this.translate(); }
  t(key) { return sonoffText(this.lang, key); }
  rpc(operation, data = {}) { return this.hass.callWS({type: "qingping_esphome/command", operation, data}); }
  $(selector) { return this.shadowRoot.querySelector(selector); }

  initialize() {
    this.initialized = true; this.devices = []; this.jobs = []; this.state = "idle";
    this.attachShadow({mode: "open"});
    this.shadowRoot.innerHTML = `<style>
      :host{display:block;font:inherit;color:inherit}*{box-sizing:border-box}[hidden]{display:none!important}
      .box{padding:26px;border:1px solid var(--divider-color,#d8dde2);border-radius:16px;background:var(--card-background-color,#fff)}
      h2{font-size:20px;margin:0 0 14px}p{line-height:1.5}.muted{font-size:14px;color:var(--secondary-text-color,#58616b)}
      label{display:block;margin:16px 0 6px}input:not([type=checkbox]),select{display:block;max-width:100%;width:100%;min-height:46px;padding:10px;border:1px solid var(--divider-color,#c8cfd6);border-radius:8px;color:inherit;background:var(--card-background-color,#fff);font:inherit}
      .row{display:flex;gap:12px;align-items:center;flex-wrap:wrap}button{cursor:pointer;min-height:46px;padding:10px 18px;border:1px solid var(--divider-color,#c8cfd6);border-radius:9px;color:inherit;background:transparent;font:600 15px system-ui}button.primary{background:var(--primary-color,#087f8c);color:var(--text-primary-color,#fff)}button:disabled{opacity:.55;cursor:default}
      button:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible{outline:3px solid var(--primary-color,#087f8c);outline-offset:3px}details{margin:20px 0}summary{cursor:pointer;min-height:44px;padding:10px 0}
      .check{display:flex;align-items:flex-start;gap:10px;font-weight:400}.check input{flex:none;width:20px;height:20px;margin:3px 0}.error{color:var(--error-color,#b42318)}progress{width:100%;height:14px;accent-color:var(--primary-color,#087f8c)}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:650px){.box{padding:20px}.grid{grid-template-columns:1fr}}
    </style><section class="box"><h2 data-t="title"></h2><p class="muted" data-t="note"></p>
      <details id="historyBox" hidden><summary data-t="history"></summary><label for="history" data-t="historyChoose"></label><select id="history"></select><button id="more" data-t="more" hidden></button></details>
      <div id="setup"><button id="scan" data-t="find"></button><p id="message" role="status" aria-live="polite"></p>
        <label for="devices" data-t="devices"></label><select id="devices"></select>
        <details id="account"><summary data-t="account"></summary><p class="muted" data-t="accountHelp"></p><form id="login">
          <label for="username" data-t="username"></label><input id="username" autocomplete="username" type="text" required maxlength="254">
          <label for="password" data-t="password"></label><input id="password" autocomplete="current-password" type="password" required maxlength="256">
          <div class="grid"><div><label for="region" data-t="region"></label><select id="region"><option value="eu">Europe</option><option value="us">America</option><option value="as">Asia</option><option value="cn">China</option></select></div><div><label for="country" data-t="country"></label><input id="country" value="+7" maxlength="5"></div></div>
          <button type="submit" data-t="login"></button></form></details>
        <details><summary data-t="manual"></summary><label for="address" data-t="address"></label><input id="address" inputmode="decimal" autocomplete="off" placeholder="192.168.1.100"></details>
        <button id="check" data-t="check" disabled></button>
        <div id="approval" hidden><label class="check"><input id="load" type="checkbox"><span data-t="load"></span></label><label class="check"><input id="power" type="checkbox"><span data-t="power"></span></label><label class="check"><input id="ble" type="checkbox"><span data-t="ble"></span></label><button id="install" class="primary" data-t="install" disabled></button></div>
      </div><div id="job" hidden aria-live="polite"><p id="state"></p><progress id="progress" max="100"></progress><p id="detail" class="muted"></p><button id="backup" data-t="backup"></button><p class="muted" data-t="backupHelp"></p><button id="another" data-t="another" hidden></button></div>
      <div id="recovery" hidden><p class="muted" data-t="recoveryHelp"></p><label for="recoveryHost" data-t="recoveryHost"></label><input id="recoveryHost" inputmode="decimal" autocomplete="off" placeholder="192.168.1.100"><button id="recover" data-t="recover"></button><p id="recoveryResult" role="status" aria-live="polite"></p></div><button id="diagnostics" data-t="diagnostics" hidden></button>
      <p id="error" class="error" role="alert"></p></section>`;
    this.$("#scan").onclick = () => this.perform("sonoff_scan", {}, "finding", result => this.renderDevices(result));
    this.$("#login").onsubmit = event => {
      event.preventDefault();
      const data = {username: this.$("#username").value, password: this.$("#password").value,
        region: this.$("#region").value, country_code: this.$("#country").value};
      this.perform("sonoff_login", data, "finding", result => { this.$("#account").open = false; this.renderDevices(result); });
      this.$("#password").value = "";
    };
    this.$("#devices").onchange = () => this.invalidate();
    this.$("#address").oninput = () => this.invalidate();
    this.$("#check").onclick = () => this.perform("sonoff_select", {selection: this.$("#devices").value,
      host: this.$("#address").value.trim()}, "checking", result => {
        this.ready = result.ready === true; this.message = "ready";
        this.$("#approval").hidden = !this.ready; this.controls(); this.translate();
      });
    for (const selector of ["#load", "#power"]) this.$(selector).onchange = () => this.controls();
    this.$("#install").onclick = () => this.perform("sonoff_install", {
      selection: this.$("#devices").value, load_ack: this.$("#load").checked,
      power_loss_ack: this.$("#power").checked, bluetooth_proxy: this.$("#ble").checked,
    }, "preparing", result => { this.job = result.job; this.showJob(result); this.poll(); });
    this.$("#backup").onclick = () => this.downloadBackup();
    this.$("#diagnostics").onclick = () => this.download("diagnostics", "sonoff-s60tpf-diagnostics.json");
    this.$("#recover").onclick = () => this.recover();
    this.$("#history").onchange = () => {
      if (this.pending) return;
      const job = this.jobs.find(value => value.job === this.$("#history").value);
      if (job) { this.$("#recoveryHost").value = ""; this.error = null; this.showJob(job); this.poll(); }
    };
    this.$("#more").onclick = async () => {
      try { await this.loadHistory(this.nextOffset); }
      catch { this.error = "generic"; this.translate(); }
    };
    this.$("#another").onclick = () => { this.job = null; this.state = "idle"; this.$("#job").hidden = true;
      this.$("#recovery").hidden = true; this.$("#diagnostics").hidden = true;
      this.$("#setup").hidden = false; this.invalidate(); };
    this.translate(); this.renderDevices({devices: []}); this.restore();
  }

  invalidate() {
    this.ready = false; this.$("#approval").hidden = true;
    this.$("#load").checked = false; this.$("#power").checked = false; this.controls();
  }
  controls() {
    for (const input of this.shadowRoot.querySelectorAll("#setup input,#setup select,#setup button")) input.disabled = Boolean(this.pending || this.job);
    this.$("#check").disabled = Boolean(this.pending || this.job || !this.$("#devices").value);
    this.$("#install").disabled = Boolean(this.pending || this.job || !this.ready || !this.$("#load").checked || !this.$("#power").checked);
    for (const selector of ["#history", "#more", "#recover", "#recoveryHost", "#another"]) this.$(selector).disabled = Boolean(this.pending);
  }
  renderDevices(result) {
    this.devices = result.devices || []; this.invalidate();
    const option = (value, label) => { const node = document.createElement("option"); node.value = value; node.textContent = label; return node; };
    this.$("#devices").replaceChildren(option("", this.t("choose")), ...this.devices.map(device =>
      option(device.selection, `${device.name} · ${device.mac} · ${this.t(device.source === "sonoff" ? "source" : "cloud")}${device.host ? " · " + device.host : ""}`)));
    this.message = this.devices.length ? null : "empty";
    this.$("#account").open = Boolean(result.needs_login);
    this.controls(); this.translate();
  }
  translate() {
    this.shadowRoot.querySelectorAll("[data-t]").forEach(node => { node.textContent = this.t(node.dataset.t); });
    this.$("#message").textContent = this.message ? this.t(this.message) : "";
    this.$("#error").textContent = this.error ? this.t(this.error) : "";
    // Translate the existing options in place: rebuilding this select would
    // discard a checked identity/acknowledgements when changing language.
    const options = this.$("#devices").options || this.$("#devices").children || [];
    for (const option of options) {
      const device = this.devices.find(value => value.selection === option.value);
      option.textContent = device ? `${device.name} · ${device.mac} · ${this.t(device.source === "sonoff" ? "source" : "cloud")}${device.host ? " · " + device.host : ""}` : this.t("choose");
    }
    if (this.job) this.$("#state").textContent = this.t(this.state);
    this.$("#recoveryResult").textContent = this.recoveryMessage ? this.t(this.recoveryMessage) : "";
    this.renderHistory();
    this.$("#progress").setAttribute("aria-label", this.t("running"));
  }
  async perform(operation, data, message, done) {
    if (this.pending || this.job) return;
    this.pending = true; this.error = null; this.message = message; this.controls(); this.translate();
    try { done(await this.rpc(operation, data)); }
    catch (error) {
      this.error = ERROR_KEYS[String(error?.code || "").replace(/^qingping_/, "")] || "generic";
      if (this.error === "auth") this.$("#account").open = true;
      // An Install response may be lost after consumption. Read owned jobs;
      // never repeat the installation request or manufacture a fresh selection.
      if (operation === "sonoff_install") await this.restore();
    } finally { this.pending = false; this.controls(); this.translate(); }
  }
  showJob(value) {
    this.job = value.job; this.state = value.state;
    const index = this.jobs.findIndex(job => job.job === value.job);
    if (index < 0) this.jobs.unshift(value); else this.jobs[index] = value;
    this.recoveryMessage = value.recovery;
    this.$("#setup").hidden = true; this.$("#job").hidden = false;
    this.$("#progress").value = value.completed * 100 / Math.max(1, value.total);
    this.$("#detail").textContent = `${value.name}${value.mac ? " · " + value.mac : ""} · ${value.completed}/${value.total}${value.enrollment ? " · " + this.t(value.enrollment) : ""}`;
    this.$("#another").hidden = !value.writer_settled && value.state !== "verified";
    this.$("#recovery").hidden = !["verified", "outcome_unknown"].includes(value.state);
    this.$("#diagnostics").hidden = false;
    this.controls(); this.translate();
  }
  async restore() {
    try {
      await this.loadHistory(0);
      // Keep the last successful job reachable too: reloading the page must
      // not hide its private factory-backup download. Choose another plug
      // deliberately leaves this view without clearing the durable record.
      const pending = this.jobs.find(job => job.state !== "verified") || this.jobs[0];
      if (pending) { this.showJob(pending); this.poll(); }
    } catch { /* A read failure never authorizes a repeated installation. */ }
  }
  renderHistory() {
    this.$("#historyBox").hidden = !this.jobs.length;
    const options = this.jobs.map(job => {
      const option = document.createElement("option"); option.value = job.job;
      const date = job.created_at ? new Date(job.created_at * 1000).toLocaleString(this.lang === "ru" ? "ru-RU" : "en-US") : "";
      option.textContent = [job.name, job.mac, date, this.t(job.state)].filter(Boolean).join(" · ");
      return option;
    });
    this.$("#history").replaceChildren(...options); this.$("#history").value = this.job || "";
    this.$("#more").hidden = this.nextOffset == null;
  }
  async loadHistory(offset = 0) {
    const result = await this.rpc("sonoff_jobs", {offset});
    this.jobs = offset ? [...this.jobs, ...result.jobs.filter(job => !this.jobs.some(old => old.job === job.job))] : result.jobs;
    this.nextOffset = result.next_offset; this.renderHistory();
  }
  async recover() {
    if (this.pending || !this.job) return;
    this.pending = true; this.error = null; this.recoveryMessage = "recovering"; this.controls(); this.translate();
    const job = this.job;
    try { this.showJob(await this.rpc("sonoff_recover", {job, host: this.$("#recoveryHost").value.trim()})); }
    catch (error) { this.error = ERROR_KEYS[String(error?.code || "").replace(/^qingping_/, "")] || "generic"; }
    finally { this.pending = false; this.controls(); this.translate(); }
  }
  async poll() {
    clearTimeout(this.timer);
    if (!this.job || !this.isConnected) return;
    const job = this.job;
    if (this.pending) { this.timer = setTimeout(() => this.poll(), 2000); return; }
    try { const result = await this.rpc("sonoff_status", {job});
      // Switching history or starting a recovery retires this read's right to
      // redraw the page. A late status response never changes the chosen job.
      if (this.job !== job) return;
      if (this.pending) { this.timer = setTimeout(() => this.poll(), 2000); return; }
      this.showJob(result);
      if (["verified", "outcome_unknown"].includes(result.state)) return;
    } catch { this.error = "generic"; this.translate(); return; }
    this.timer = setTimeout(() => this.poll(), 2000);
  }
  async downloadBackup() {
    return this.download("backup", "sonoff-s60tpf-private-backup.tar");
  }
  async download(kind, filename) {
    try {
      const response = await this.hass.fetchWithAuth(`/api/qingping_esphome/sonoff/${this.job}/${kind}`);
      if (!response.ok) throw new Error();
      const blob = await response.blob(); const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = url; link.download = filename; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { this.error = "generic"; this.translate(); }
  }
}
customElements.define("sonoff-installer", SonoffInstaller);
