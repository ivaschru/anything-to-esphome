import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import {SidebarSettings} from "../custom_components/qingping_esphome/frontend/sidebar-settings.mjs";
import {t} from "../custom_components/qingping_esphome/frontend/i18n.mjs";

// Model the real HA menu/form shape, including completed-flow removal. A
// response can disappear after a persisted submit; the client must reconcile
// without issuing a second setter or touching any network options.
let stored = true, writes = 0, loseAck = false, rejectWrite = false, counter = 0;
const open = new Set();
const hass = {
  async callWS(message) {
    assert.deepEqual(message, {type: "config_entries/get", domain: "qingping_esphome"});
    return [{entry_id: "installer"}];
  },
  async callApi(method, path, data) {
    const base = "config/config_entries/options/flow";
    if (path === base) {
      assert.equal(method, "POST"); assert.deepEqual(data, {handler: "installer"});
      const flow_id = String(++counter); open.add(flow_id);
      return {type: "menu", flow_id, menu_options: ["interface", "automatic", "manual"]};
    }
    const id = path.slice(base.length + 1);
    if (method === "DELETE") { open.delete(id); return {}; }
    assert.ok(open.has(id));
    if (data.next_step_id) {
      assert.equal(data.next_step_id, "interface");
      return {type: "form", step_id: "interface", data_schema: [{name: "show_sidebar", default: stored}]};
    }
    assert.deepEqual(Object.keys(data), ["show_sidebar"]);
    writes++;
    if (rejectWrite) throw Error("private server details");
    stored = data.show_sidebar; open.delete(id);
    if (loseAck) throw Error("response lost after commit");
    return {type: "create_entry"};
  },
};
const settings = new SidebarSettings(hass);
assert.equal(await settings.read(), true); assert.equal(writes, 0); assert.equal(open.size, 0);
assert.equal(await settings.save(false), false); assert.equal(writes, 1); assert.equal(open.size, 0);
loseAck = true;
assert.equal(await settings.save(true), true); assert.equal(writes, 2, "Lost ACK never replays the submit");
rejectWrite = true;
await assert.rejects(settings.save(false), /sidebar_unavailable/);
assert.equal(writes, 3); assert.equal(open.size, 0); assert.equal(stored, true);
await assert.rejects(settings.save("false")); assert.equal(writes, 3);
await assert.rejects(new SidebarSettings({...hass, callWS: async () => []}).read());
await assert.rejects(new SidebarSettings({...hass, callWS: async () => [{}, {}]}).read());

// Exercise the actual panel's pending/rollback and cross-control sync methods.
// No DOM rebuild, Bluetooth or installer command is available to this fixture.
let Panel;
const context = vm.createContext({HTMLElement: class {}, navigator: {},
  TextDecoder, TextEncoder, Uint8Array, Map, Promise, t, SidebarSettings,
  customElements: {define(_name, type) {Panel = type;}},
});
const source = readFileSync(new URL("../custom_components/qingping_esphome/frontend/panel.js", import.meta.url), "utf8");
vm.runInContext(source.replace(/^import .*;$/gm, ""), context);
const elements = new Map();
const panel = new Panel(); panel.language = "en";
panel.$ = key => {
  if (!elements.has(key)) elements.set(key, {checked: false, disabled: false, textContent: "", classList: {toggle() {}}});
  return elements.get(key);
};
panel._hass = hass;
rejectWrite = false; loseAck = false;
await panel.loadSidebar(); assert.equal(panel.$("#show-sidebar").checked, true);
assert.equal(panel.$("#show-sidebar").disabled, false);
panel.$("#show-sidebar").checked = false;
const pending = panel.saveSidebar();
assert.equal(panel.$("#show-sidebar").disabled, true);
assert.equal(panel.$("#sidebar-status").textContent, "Saving…");
await pending; assert.equal(panel.$("#show-sidebar").checked, false);
rejectWrite = true; panel.$("#show-sidebar").checked = true;
await panel.saveSidebar(); assert.equal(panel.$("#show-sidebar").checked, false);
assert.equal(panel.sidebarMessage, "sidebar_failed");
panel.initialized = true;
stored = true;
panel.hass = {...hass, panels: {qingping_esphome: {title: "Qingping ESPHome"}}};
await new Promise(resolve => setImmediate(resolve));
assert.equal(panel.$("#show-sidebar").checked, true, "Native Configure changes update the panel too");
console.log("Sidebar native flow, persistence, lost ACK reconciliation and panel pending/rollback passed");
