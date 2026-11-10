/** Actual component methods with finite DOM/HA peers; no browser storage/write IO. */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

class Node {
  constructor() { this.value = ""; this.checked = false; this.hidden = false; this.disabled = false; this.dataset = {}; }
  replaceChildren(...children) { this.children = children; this.value = children[0]?.value || ""; }
  setAttribute(key, value) { this[key] = value; }
}
class Shadow {
  constructor() { this.nodes = new Map(); this.labels = []; }
  set innerHTML(source) {
    for (const match of source.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)) {
      const node = new Node(); node.value = /\bvalue="([^"]*)"/.exec(match[0])?.[1] || "";
      this.nodes.set("#" + match[1], node);
    }
    for (const match of source.matchAll(/\bdata-t="([^"]+)"/g)) {
      const node = new Node(); node.dataset.t = match[1]; this.labels.push(node);
    }
  }
  querySelector(key) { assert.ok(this.nodes.has(key), key); return this.nodes.get(key); }
  querySelectorAll(key) { return key === "[data-t]" ? this.labels : [...this.nodes.values()]; }
}
let Component;
const context = vm.createContext({HTMLElement: class {
  constructor() { this.lang = "en"; this.isConnected = false; }
  attachShadow() { this.shadowRoot = new Shadow(); }
}, document: {createElement: () => new Node()}, console,
customElements: {define(_name, value) { Component = value; }},
clearTimeout() {}, setTimeout() { return 1; }, URL});
const source = readFileSync(new URL("../custom_components/qingping_esphome/frontend/sonoff.mjs", import.meta.url), "utf8");
vm.runInContext(source.replace(/^export /gm, ""), context);
const calls = [];
let savedJob = null;
const view = new Component();
view._hass = {async callWS(message) {
  calls.push(message);
  if (message.operation === "sonoff_jobs") return {jobs: savedJob ? [savedJob] : []};
  if (message.operation === "sonoff_scan") return {devices: [{selection: "choice", name: "<img onerror=bad>", mac: "AA:BB:CC:11:22:33", source: "sonoff"}]};
  if (message.operation === "sonoff_select") return {ready: true};
  if (message.operation === "sonoff_install") {
    savedJob = {job: "owned-job", name: "Plug", state: "outcome_unknown", completed: 3, total: 11};
    throw Error("reply disappeared after commit");
  }
  if (message.operation === "sonoff_login") return {devices: []};
  if (message.operation === "sonoff_recover") return {...savedJob, state: "verified", writer_settled: true, recovery: "app_verified"};
  throw Error("Unexpected operation");
}};
view.initialize(); await new Promise(resolve => setImmediate(resolve));
await view.$("#scan").onclick(); await new Promise(resolve => setImmediate(resolve));
assert.equal(view.$("#devices").children[1].textContent.includes("<img onerror=bad>"), true, "Untrusted name stays text");
view.$("#devices").value = "choice"; view.$("#devices").onchange();
await view.$("#check").onclick(); await new Promise(resolve => setImmediate(resolve));
assert.equal(view.ready, true);
assert.equal(view.$("#install").disabled, true);
view.$("#username").value = "fixture@example.invalid";
view.$("#password").value = "fixture-password";
view.lang = "ru"; view.translate();
assert.equal(view.$("#password").value, "fixture-password", "Language never rebuilds the live form");
view.$("#load").checked = true; view.$("#power").checked = true; view.controls();
assert.equal(view.$("#install").disabled, false);
await view.$("#install").onclick(); await new Promise(resolve => setImmediate(resolve));
assert.equal(view.job, "owned-job"); assert.equal(view.state, "outcome_unknown");
await view.$("#install").onclick(); await view.restore();
assert.equal(calls.filter(call => call.operation === "sonoff_install").length, 1, "Lost reply/restoration never resends Install");
assert.equal(view.$("#another").hidden, true);
const fresh = new Component(); fresh._hass = view._hass; savedJob = null;
fresh.initialize(); await new Promise(resolve => setImmediate(resolve));
fresh.$("#username").value = "fixture@example.invalid"; fresh.$("#password").value = "fixture-password";
fresh.$("#login").onsubmit({preventDefault() {}});
assert.equal(fresh.$("#password").value, "", "Password leaves the form immediately after sign-in submission");
await new Promise(resolve => setImmediate(resolve));
assert.equal(calls.at(-1).operation, "sonoff_login");
assert.equal(calls.at(-1).data.password, "fixture-password");
savedJob = {job: "verified-job", name: "Plug", state: "verified", completed: 11, total: 11};
const reloaded = new Component(); reloaded._hass = view._hass;
reloaded.initialize(); await new Promise(resolve => setImmediate(resolve));
assert.equal(reloaded.job, "verified-job", "Verified backup remains reachable after a page reload");
assert.equal(reloaded.$("#another").hidden, false);
const older = {job: "older-job", name: "<script>untrusted</script>", mac: "AA:BB:CC:11:22:44", state: "outcome_unknown", completed: 4, total: 11};
reloaded.jobs.push(older); reloaded.renderHistory();
assert.equal(reloaded.$("#history").children[1].textContent.includes("<script>"), true);
reloaded.$("#history").value = older.job; reloaded.$("#history").onchange();
assert.equal(reloaded.job, older.job, "Old installation and its backup remain independently reachable");
reloaded.$("#recoveryHost").value = "192.168.1.44";
const installsBeforeRecovery = calls.filter(call => call.operation === "sonoff_install").length;
savedJob = older;
await reloaded.recover();
assert.equal(reloaded.state, "verified");
assert.equal(calls.at(-1).operation, "sonoff_recover");
assert.equal(calls.at(-1).data.job, older.job);
assert.equal(calls.at(-1).data.host, "192.168.1.44");
assert.equal(calls.filter(call => call.operation === "sonoff_install").length, installsBeforeRecovery);
reloaded.lang = "ru"; reloaded.translate();
assert.equal(reloaded.$("#history").value, older.job, "Language preserves selected installation");
assert.equal(reloaded.$("#recoveryHost").value, "192.168.1.44");
// An older status reply may not undo a deliberate history selection.
let statusReply;
reloaded.isConnected = true;
const originalRPC = reloaded.rpc;
reloaded.rpc = () => new Promise(resolve => { statusReply = resolve; });
const pendingStatus = reloaded.poll();
reloaded.showJob({job: "newer-job", name: "Newer", state: "verified", completed: 11, total: 11});
statusReply(older); await pendingStatus;
assert.equal(reloaded.job, "newer-job");
reloaded.rpc = originalRPC;
console.log("Sonoff selection, acknowledgements, language, private login and lost-response restoration passed");

// A job restored by the hidden child must not trap the default brand page.
let Panel;
const panelContext = vm.createContext({HTMLElement: class {}, navigator: {},
  TextDecoder, TextEncoder, Uint8Array, Map, Promise,
  customElements: {define(_name, value) { Panel = value; }}});
const panelSource = readFileSync(new URL("../custom_components/qingping_esphome/frontend/panel.js", import.meta.url), "utf8");
vm.runInContext(panelSource.replace(/^import .*;$/gm, ""), panelContext);
const panel = new Panel(); panel.brand = "qingping"; panel.model = "lite";
const nodes = new Map();
panel.$ = key => {
  if (!nodes.has(key)) nodes.set(key, {busy: false, classList: {toggle() {}}, replaceChildren() {}});
  return nodes.get(key);
};
panel.shadowRoot = {querySelectorAll: () => []};
panel.invalidateSelection = () => {}; panel.updateModelText = () => {};
panel.$("#sonoff").busy = true;
panel.selectBrand("sonoff"); assert.equal(panel.brand, "sonoff", "Restored job status remains reachable");
panel.selectBrand("qingping"); assert.equal(panel.brand, "sonoff", "Active conversion blocks leaving its brand");
panel.$("#sonoff").busy = false;
panel.selectBrand("qingping"); assert.equal(panel.brand, "qingping");
