import {sourceFileObservationMatches} from "./usb-file-observation.mjs";
import {captureArchive} from "./usb-capture.mjs";

/** Read-only browser USB selection/capture for the CGS1 installer.
 *
 * Dependency injection keeps the protocol/lifetime tests independent of USB.
 * No caller-supplied shell, generic ADB method, setup packet, push, reboot or
 * activation is exposed. A probe is one selection and disconnects immediately.
 * Its result is context for the installer, never installation authority.
 */
export class UsbProbeError extends Error {
  constructor(code) { super(code); this.code = code; }
}
const refused = code => { throw new UsbProbeError(code); };

function scalar(text, expression) {
  if (typeof text !== "string" || !expression.test(text)) refused("usb_identity_invalid");
  return text;
}

export class BrowserUsbProbe {
  #library; #contract; #busy = false; #client; #connection; #closed = false; #deadline;
  constructor(library, contract) {
    this.#library = library;
    this.#contract = contract;
  }

  /** Call directly from the button handler, before any asynchronous work. */
  select() {
    return this.#select(false);
  }

  /** Explicit second action, with its own synchronous native device picker. */
  capture(onProgress = () => {}) {
    if (typeof onProgress !== "function") refused("usb_request_invalid");
    return this.#select(true, onProgress);
  }

  #select(capture, onProgress) {
    if (this.#busy || this.#closed) refused("usb_selection_consumed");
    const manager = this.#library.manager;
    if (!manager) refused("webusb_unavailable");
    this.#busy = true; // Consumed before picker, including cancellation.
    let picked;
    try { picked = manager.requestDevice(); }
    catch { return Promise.reject(new UsbProbeError("usb_selection_failed")); }
    return this.#inspect(picked, capture, onProgress);
  }

  async #bounded(operation, milliseconds, code) {
    if (this.#closed) refused("usb_selection_consumed");
    if (this.#deadline) milliseconds = Math.min(milliseconds, this.#deadline - Date.now());
    if (milliseconds <= 0) refused("usb_read_timeout");
    let timer;
    try {
      return await Promise.race([operation(), new Promise((_, reject) => {
        timer = setTimeout(() => {
          // Closing only this selected connection cancels its pending IO.
          // A timeout never starts another selection, handshake or command.
          void this.close().catch(() => {});
          reject(new UsbProbeError(code));
        }, milliseconds);
      })]);
    } finally { clearTimeout(timer); }
  }

  async #read(command) {
    const marker = "__CGS1_WEBUSB_OK_" + crypto.randomUUID().replaceAll("-", "") + "__";
    const script = "set -e\n" + command + "\nprintf '\\n" + marker + "\\n'\n";
    const socket = await this.#bounded(async () => {
      const value = await this.#client.createSocket("shell:" + script);
      if (this.#closed) { void Promise.resolve(value.close()).catch(() => {}); refused("usb_selection_consumed"); }
      return value;
    }, 5000, "usb_read_timeout");
    const reader = socket.readable.getReader();
    let data = new Uint8Array(0);
    try {
      // Old adbd has no reliable remote exit code. A complete final marker
      // matters more than an apparently successful socket/host close.
      while (true) {
        const {value, done} = await this.#bounded(() => reader.read(), 10000, "usb_read_timeout");
        if (done) break;
        if (!(value instanceof Uint8Array) || data.length + value.length > 4096) refused("usb_read_invalid");
        const next = new Uint8Array(data.length + value.length);
        next.set(data); next.set(value, data.length); data = next;
      }
    } finally {
      reader.releaseLock();
      // Closing a socket is teardown, including after the global deadline.
      await this.#cleanup(() => socket.close());
    }
    if (data.some(byte => byte > 127 || byte === 0)) refused("usb_read_invalid");
    const text = new TextDecoder().decode(data).replaceAll("\r\n", "\n");
    const suffix = "\n" + marker + "\n";
    if (!text.endsWith(suffix)) refused("usb_read_incomplete");
    return text.slice(0, -suffix.length).trim();
  }

  async #inspect(picked, capture, onProgress) {
    try {
      const device = await picked; // Picker remains user-controlled, no timeout.
      if (!device) refused("usb_selection_cancelled");
      if (this.#closed) refused("usb_selection_consumed");
      this.#deadline = Date.now() + (capture ? 240000 : 60000);
      const serial = scalar(device.serial, /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/);
      await this.#bounded(async () => {
        const connection = await device.connect();
        if (this.#closed) {
          void Promise.allSettled([connection.readable.cancel(), connection.writable.close()]);
          refused("usb_selection_consumed");
        }
        this.#connection = connection;
      }, 5000, "usb_connect_timeout");
      const transport = await this.#bounded(async () => {
        const transport = await this.#library.authenticate({
        serial, connection: this.#connection,
        // Fresh RAM-only keys. Nothing in localStorage/IndexedDB, URL or logs.
        // A daemon requiring authorization may ask again after disconnect.
        credentialStore: this.#library.ephemeralCredentials(),
        initialDelayedAckBytes: 0, readTimeLimit: 10000,
        });
        if (this.#closed) { void Promise.resolve(transport.close()).catch(() => {}); refused("usb_selection_consumed"); }
        return transport;
      }, 15000, "usb_auth_timeout");
      this.#client = this.#library.createClient(transport);
      const identity = {};
      for (const step of this.#contract.identity) identity[step.name] = await this.#read(step.command);
      if (identity.uid !== "0" || identity.arch !== "armv7l" ||
          identity.version !== "CLEARGRASS_VERSION=4.1.8_0287" || !["2", "3"].includes(identity.co2_type))
        refused("usb_profile_unsupported");
      scalar(identity.wlan_mac, /^[0-9a-f]{2}(?::[0-9a-f]{2}){5}$/);
      if (parseInt(identity.wlan_mac.slice(0, 2), 16) & 1 || identity.wlan_mac === "00:00:00:00:00:00")
        refused("usb_identity_invalid");
      scalar(identity.boot_id, /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);
      // Recheck fixed source bytes, not a model string/banner. This strict
      // first-install probe refuses already modified or unknown installations.
      for (const file of this.#contract.files) {
        const observed = await this.#read(file.command);
        if (!sourceFileObservationMatches(observed,file)) refused("usb_stock_unverified");
      }
      if (await this.#read(this.#contract.absent_install) !== "") refused("usb_existing_installation");
      if (await this.#read("cat /proc/sys/kernel/random/boot_id") !== identity.boot_id ||
          await this.#read("cat /sys/class/net/wlan0/address") !== identity.wlan_mac)
        refused("usb_selection_changed");
      const result = {model: "CGS1", stock_version: "4.1.8_0287", co2_type: Number(identity.co2_type),
        wlan_mac: identity.wlan_mac, boot_id: identity.boot_id,
        transport: "browser_usb", source_checked: true, installation_ready: false};
      if (capture) result.archive = await this.#capture(serial, identity, onProgress);
      return result;
    } catch (error) {
      // Libraries/USB errors can include host/device details. Expose only
      // fixed categories; never log the original exception or shell output.
      if (error instanceof UsbProbeError) throw error;
      throw new UsbProbeError("usb_probe_failed");
    } finally {
      await this.close();
    }
  }

  async #capture(serial, identity, progress) {
    const contents = new Map();
    if (this.#contract.files.length !== 9 || this.#contract.files.reduce((sum, file) => sum + file.size, 0) > 32 * 1024 * 1024)
      refused("usb_capture_unverified");
    const sync = await this.#bounded(async () => {
      const value = await this.#client.sync();
      if (this.#closed) { void Promise.resolve(value.dispose()).catch(() => {}); refused("usb_selection_consumed"); }
      return value;
    }, 5000, "usb_read_timeout");
    try {
      progress(0, this.#contract.files.length);
      for (const file of this.#contract.files) {
        // No remote name comes from a caller/device reply. SYNC is RECV only;
        // only the exact fixed expected size can enter the in-memory archive.
        const reader = sync.read(file.path).getReader(), data = new Uint8Array(file.size);
        let offset = 0;
        try {
          while (true) {
            const {value, done} = await this.#bounded(() => reader.read(), 30000, "usb_read_timeout");
            if (done) break;
            if (!(value instanceof Uint8Array) || offset + value.length > data.length) refused("usb_capture_unverified");
            data.set(value, offset); offset += value.length;
          }
        } finally {reader.releaseLock();}
        if (offset !== file.size) refused("usb_capture_unverified");
        const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", data))]
          .map(value => value.toString(16).padStart(2, "0")).join("");
        if (digest !== file.sha256) refused("usb_capture_unverified");
        contents.set(file.path, data); progress(contents.size, this.#contract.files.length);
      }
    } finally {await this.#cleanup(() => sync.dispose());}
    // No archive is returned before independent complete post-copy source,
    // identity and absent-install checks. A partial read is discarded locally.
    for (const file of this.#contract.files)
      if (!sourceFileObservationMatches(await this.#read(file.command),file)) refused("usb_capture_unverified");
    if (await this.#read(this.#contract.absent_install) !== "") refused("usb_existing_installation");
    for (const step of this.#contract.identity)
      if (await this.#read(step.command) !== identity[step.name]) refused("usb_selection_changed");
    const report = {schema_version: 1, stage: "read_only_browser_capture_complete", hardware_contacted: true,
      device_writes: 0, installed: false, installation_ready: false, usb_serial: serial,
      transport: "browser_usb", wlan_mac: identity.wlan_mac, boot_id: identity.boot_id,
      co2_type: Number(identity.co2_type), stock_version: "4.1.8_0287",
      files: Object.fromEntries(this.#contract.files.map(file => [file.path, {sha256: file.sha256, size: file.size}])),
      limitations: ["Fixed recovery/build files, not a NAND/user-data backup",
        "Browser transport has no native ADB get-devpath; this archive is not a native USB plan",
        "No installation, activation, fallback or boot test performed"]};
    return captureArchive(this.#contract, contents, report);
  }

  async close() {
    this.#closed = true;
    const client = this.#client, connection = this.#connection;
    this.#client = this.#connection = undefined;
    // Transport closes its owned WebUSB connection. If authentication failed,
    // Tango deliberately leaves that raw connection open, so close it here.
    if (client) await this.#cleanup(() => client.close());
    else if (connection) {
      await this.#cleanup(async () => {
        const results = await Promise.allSettled([connection.readable.cancel(), connection.writable.close()]);
        if (results.some(item => item.status === "rejected")) refused("usb_close_unverified");
      });
    }
  }

  async #cleanup(operation) {
    let timer;
    try {
      await Promise.race([Promise.resolve().then(operation), new Promise((_, reject) => {
        timer = setTimeout(() => reject(new UsbProbeError("usb_close_unverified")), 2000);
      })]);
    } catch { refused("usb_close_unverified"); }
    finally { clearTimeout(timer); }
  }
}
