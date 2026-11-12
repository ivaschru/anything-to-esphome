import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import {HABluetoothConnection} from "../custom_components/qingping_esphome/frontend/ha-transport.mjs";
import {requireLiteProfile} from "../custom_components/qingping_esphome/frontend/compatibility.mjs";
import {t, failure, errorKey, scanSummary} from "../custom_components/qingping_esphome/frontend/i18n.mjs";

const identity = {model: "CGDN1", stock_version: "4.5.8", hardware: "0001", mac: "001122334455"};
const calls = [];
const connection = new HABluetoothConnection(async (operation, data) => {
  calls.push({operation, data});
  return operation === "ble_select" ? {selection: "opaque-selection", identity} : {provisioned: true};
}, "00:11:22:33:44:55");
assert.deepEqual(await connection.connect(), identity);
assert.equal(connection.selection, "opaque-selection");
await connection.provision("private-ssid", "private-password", {}, () => {}, "owned-session");
assert.deepEqual(calls, [
  {operation: "ble_select", data: {address: "00:11:22:33:44:55"}},
  {operation: "ble_provision", data: {session: "owned-session"}},
]);
let attempts = 0;
connection.rpc = async () => { attempts++; throw Error("connection lost"); };
await assert.rejects(connection.provision("", "", {}, () => {}, "session"));
assert.equal(attempts, 1, "An ambiguous setup request must never retry");
connection.rpc = async () => ({error_code: "selected_changed"});
await assert.rejects(connection.provision("", "", {}, () => {}, "session"), {code: "selected_changed"});
connection.rpc = async () => ({provisioned: false});
await assert.rejects(connection.provision("", "", {}, () => {}, "session"), {code: "ha_bluetooth_setup_incomplete"});

// Exercise actual panel methods without a browser/radio. Minimal elements model
// only the state boundaries: stale identities, blocked switching and selection.
let Panel;
const context = vm.createContext({
  HTMLElement: class {}, customElements: {define(_name, type) { Panel = type; }},
  navigator: {}, TextDecoder, TextEncoder, Uint8Array, Map, Promise,
  requireLiteProfile, HABluetoothConnection, t, failure, errorKey, scanSummary,
  readLanguage: () => "en", saveLanguage() {}, normalizeLanguage: value => value,
  document: {createElement: () => ({})},
});
const panelSource = readFileSync(new URL("../custom_components/qingping_esphome/frontend/panel.js", import.meta.url), "utf8");
vm.runInContext(panelSource.replace(/^import .*;$/gm, ""), context);
const panel = new Panel();
const elements = new Map();
panel.$ = key => {
  if (!elements.has(key)) elements.set(key, {value: "", disabled: false, textContent: "", children: [],
    classList: {values: new Set(), add(key) {this.values.add(key);}, toggle(key, on) {on ? this.values.add(key) : this.values.delete(key);}, remove(key) {this.values.delete(key);}},
    replaceChildren(...children) {this.children = children;},
  });
  return elements.get(key);
};
panel.language = "en"; panel.transport = "browser";
panel.identity = identity; panel.profile = {id: "lite"};
let disconnected = false;
panel.stock = {disconnect() {disconnected = true;}};
panel.$("#transport").value = "ha";
panel.changeTransport();
assert.equal(panel.transport, "ha");
assert.equal(panel.identity, null);
assert.equal(panel.profile, null);
assert.ok(disconnected);
assert.equal(panel.$("#connect").disabled, true, "HA selection must be explicit");
panel.$("#ha-device").value = "selected"; panel.connectionControls();
assert.equal(panel.$("#connect").disabled, false);
panel.busy = true;
panel.$("#transport").value = "browser"; panel.changeTransport();
assert.equal(panel.transport, "ha", "Do not change transport during installation");
assert.equal(panel.$("#transport").value, "ha");
panel.busy = false;

panel.rpc = async operation => {
  assert.equal(operation, "ble_scan");
  assert.match(panel.$("#ble-status").textContent, /^Searching/);
  assert.equal(panel.$("#ble-status").classList.values.has("scan-success"), false);
  return {devices: [{address: "selected", name: "CGDN1", ha_name: "<img src=x onerror=bad()>"},
                    {address: "other", name: "Air Monitor"}]};
};
await panel.scan();
assert.equal(panel.$("#ha-device").children[1].textContent, "<img src=x onerror=bad()> · CGDN1 · selected");
assert.equal(panel.$("#ha-device").children[1].innerHTML, undefined);
assert.equal(panel.$("#ha-device").children[1].value, "selected");
assert.equal(panel.$("#ha-device").children[2].textContent, "Air Monitor · other");
assert.equal(panel.$("#ble-status").textContent, "Search complete. Found 2 devices.");
assert.equal(panel.$("#ble-status").classList.values.has("scan-success"), true);
panel.language = "ru"; panel.updateTransport();
assert.match(panel.$("#transport-help").textContent, /прокси/);
assert.equal(panel.$("#ble-status").textContent, "Поиск завершён. Найдено 2 устройства.");
assert.match(panel.$("#ble-hint").textContent, /^Выберите прибор/);

panel.catalog = [{id: "lite", model: "CGDN1", stock_versions: ["4.5.8"], hardware_versions: ["0001"], installer: "beta", firmware: "lite"}];
panel.catalogReady = Promise.resolve();
panel.rpc = async operation => {
  assert.equal(operation, "ble_select");
  return {identity, selection: "opaque-selection"};
};
// No navigator.bluetooth exists here: this is the user's no-radio browser case.
await panel.connect();
assert.deepEqual(panel.identity, identity);
assert.equal(panel.profile.id, "lite");
assert.equal(panel.stock.selection, "opaque-selection");

panel.transport = "browser";
let pickerCalled = false;
context.navigator.bluetooth = {requestDevice() {pickerCalled = true; return Promise.reject({name: "NotFoundError"});}};
const pending = panel.connect();
assert.equal(pickerCalled, true, "Browser picker must run synchronously inside the click activation");
await pending;
assert.equal(panel.identity, null, "Cancelled/rejected selection must not retain the preceding HA identity");

panel.transport = "ha";
panel.rpc = async () => ({devices: []});
await panel.scan();
assert.equal(panel.$("#ble-status").textContent, "Поиск завершён. Найдено 0 устройств.");
assert.equal(panel.$("#ble-status").classList.values.has("scan-success"), false);
assert.match(panel.$("#ble-hint").textContent, /^Включите/);
panel.rpc = async () => { throw failure("ha_bluetooth_unavailable"); };
await panel.scan();
assert.equal(panel.$("#ble-status").textContent, "");
assert.equal(panel.$("#ble-hint").classList.values.has("hidden"), true);
console.log("HA/browser transport selection, no-radio browser, safe text, owner session RPC and no replay passed");
