import assert from "node:assert/strict";
import {BrowserUsbProbe} from "../custom_components/qingping_esphome/frontend/usb-probe.mjs";
import {contract} from "../custom_components/qingping_esphome/frontend/usb-probe-contract.mjs";
import {createProbe} from "../custom_components/qingping_esphome/frontend/usb-probe-bundle.mjs";

function fixture(overrides = {}) {
  const identity = {uid: "0", wlan_mac: "02:00:00:00:00:01",
    version: "CLEARGRASS_VERSION=4.1.8_0287", arch: "armv7l", co2_type: "3",
    boot_id: "01234567-1234-4234-8234-123456789abc", ...overrides};
  const calls = [], state = {picked: 0, connected: 0, closed: 0, rawClosed: 0};
  const replies = new Map(contract.identity.map(item => [item.command, identity[item.name]]));
  for (const file of contract.files) replies.set(file.command, file.expected);
  replies.set(contract.absent_install, "");
  const raw = {readable: {cancel: async () => {state.rawClosed++;}},
    writable: {close: async () => {}}};
  const client = {
    async createSocket(service) {
      assert.ok(service.startsWith("shell:set -e\n"));
      const start = service.slice("shell:set -e\n".length);
      const match = /([\s\S]*)\nprintf '\\n(__CGS1_WEBUSB_OK_[0-9a-f]{32}__)\\n'\n$/.exec(start);
      assert.ok(match, "Every legacy shell read has its fresh completion marker");
      const [, command, marker] = match;
      calls.push(command);
      assert.ok(replies.has(command), "Only generated fixed read commands are exposed");
      const reply = replies.get(command);
      const text = reply + "\n" + marker + "\n";
      return {readable: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(state.partial ? reply : text));
          controller.close();
        },
      }), async close() {}};
    },
    async close() {state.closed++;},
  };
  const library = {
    manager: {requestDevice() {state.picked++; return Promise.resolve({
      serial: "fixture", async connect() {state.connected++; return raw;},
    });}},
    async authenticate(options) {
      assert.equal(options.serial, "fixture");
      assert.equal(options.connection, raw);
      assert.equal(options.initialDelayedAckBytes, 0);
      return {};
    },
    createClient: () => client, ephemeralCredentials: () => ({}),
  };
  return {probe: new BrowserUsbProbe(library, contract), library, calls, state, replies, raw};
}
{
  const f = fixture();
  const operation = f.probe.select();
  assert.equal(f.state.picked, 1, "Picker must run before the first await");
  assert.throws(() => f.probe.select(), {code: "usb_selection_consumed"});
  const result = await operation;
  assert.equal(result.model, "CGS1"); assert.equal(result.co2_type, 3);
  assert.equal(result.source_checked, true); assert.equal(result.installation_ready, false);
  assert.equal(f.state.closed, 1); assert.equal(f.state.rawClosed, 0);
  assert.equal(f.calls.length, contract.identity.length + contract.files.length + 3);
  assert.equal(f.probe.read, undefined, "No arbitrary shell/ADB API is public");
  assert.equal(f.probe.push, undefined); assert.equal(f.probe.reboot, undefined);
}
for (const identity of [{version: "unknown"}, {co2_type: "1"}, {arch: "aarch64"},
                        {wlan_mac: "01:00:00:00:00:01"}, {boot_id: "unverified"}]) {
  const f = fixture(identity);
  await assert.rejects(f.probe.select());
  assert.equal(f.calls.length, contract.identity.length);
  assert.equal(f.state.closed, 1);
}
{
  const f = fixture(); f.replies.set(contract.files[0].command, "unknown fingerprint");
  await assert.rejects(f.probe.select(), {code: "usb_stock_unverified"});
  assert.equal(f.calls.length, contract.identity.length + 1);
  assert.equal(f.state.closed, 1);
}
{
  const f = fixture(); f.state.partial = true;
  await assert.rejects(f.probe.select(), {code: "usb_read_incomplete"});
  assert.equal(f.calls.length, 1); assert.equal(f.state.closed, 1);
}
{
  const f = fixture(); f.library.authenticate = async () => {throw Error("private library details");};
  await assert.rejects(f.probe.select(), {code: "usb_probe_failed"});
  assert.equal(f.state.rawClosed, 1); assert.equal(f.state.closed, 0);
  assert.equal(f.calls.length, 0);
}
{
  const f = fixture(); f.library.manager.requestDevice = () => Promise.resolve(undefined);
  await assert.rejects(f.probe.select(), {code: "usb_selection_cancelled"});
  assert.equal(f.state.connected, 0);
}
{
  const f = fixture(); let finishConnection;
  f.library.manager.requestDevice = () => Promise.resolve({
    serial: "fixture", connect: () => new Promise(resolve => {finishConnection = resolve;}),
  });
  const original = globalThis.setTimeout;
  globalThis.setTimeout = (callback, delay, ...args) => original(callback, Math.min(delay, 5), ...args);
  try {
    await assert.rejects(f.probe.select(), {code: "usb_connect_timeout"});
    finishConnection(f.raw);
    await new Promise(resolve => original(resolve, 10));
    assert.equal(f.state.rawClosed, 1, "A late USB handle is closed, never adopted after timeout");
    assert.equal(f.calls.length, 0);
  } finally {globalThis.setTimeout = original;}
}
{
  // Smoke-load the actual offline bundle with no USB globals: loading the
  // panel must not scan, prompt, authenticate or open a device.
  const probe = createProbe();
  assert.throws(() => probe.select(), {code: "webusb_unavailable"});
}
console.log("Browser USB: fixed source/identity reads, synchronous picker, no replay/writes, bounded/later cleanup passed");
await import("./test_usb_capture.mjs");
await import("./test_usb_preparation.mjs");
await import("./test_usb_build.mjs");
await import("./test_usb_plan.mjs");
