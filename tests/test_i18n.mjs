import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {MESSAGES, t, readLanguage, saveLanguage, LANGUAGE_KEY, errorKey, scanSummary} from "../custom_components/qingping_esphome/frontend/i18n.mjs";
import {strings as usbLabels} from "../custom_components/qingping_esphome/frontend/usb-labels.mjs";
import {strings as bundledUsbLabels} from "../custom_components/qingping_esphome/frontend/usb-probe-bundle.mjs";

assert.deepEqual(Object.keys(MESSAGES.en).sort(), Object.keys(MESSAGES.ru).sort());
for (const language of ["en", "ru"]) {
  for (const text of Object.values(MESSAGES[language])) assert.ok(text.trim());
}
const python = process.env.QINGPING_TEST_PYTHON || "python3";
const backend = JSON.parse(execFileSync(python, ["-c",
  "import runpy,json; print(json.dumps(runpy.run_path('custom_components/qingping_esphome/errors.py')['MESSAGES']))"],
  {cwd: fileURLToPath(new URL("../", import.meta.url)), encoding: "utf8"}));
for (const [key, english] of Object.entries(backend)) {
  assert.equal(t("en", key), english);
  assert.notEqual(t("ru", key), english);
  assert.equal(errorKey({code: "qingping_" + key}), key);
}
const storage = new Map();
globalThis.localStorage = {getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value)};
assert.equal(readLanguage(), "en");
saveLanguage("ru"); assert.equal(readLanguage(), "ru");
assert.deepEqual([...storage], [[LANGUAGE_KEY, "ru"]]);
saveLanguage("unknown"); assert.equal(readLanguage(), "en");
Object.defineProperty(globalThis, "localStorage", {configurable: true, get() { throw Error("Blocked storage"); }});
assert.equal(readLanguage(), "en");
assert.doesNotThrow(() => saveLanguage("ru"));
assert.equal(t("unknown", "connect"), MESSAGES.en.connect);
assert.equal(t("ru", "missing_key"), MESSAGES.ru.operation_failed);
assert.equal(errorKey({name: "NotFoundError"}), "bluetooth_cancelled");
assert.equal(errorKey({message: "private arbitrary text"}), "operation_failed");
assert.equal(scanSummary("ru", 0), "Поиск завершён. Найдено 0 устройств.");
assert.equal(scanSummary("ru", 1), "Поиск завершён. Найдено 1 устройство.");
assert.equal(scanSummary("ru", 3), "Поиск завершён. Найдено 3 устройства.");
assert.equal(scanSummary("ru", 11), "Поиск завершён. Найдено 11 устройств.");
assert.equal(scanSummary("ru", 21), "Поиск завершён. Найдено 21 устройство.");
assert.equal(scanSummary("en", 1), "Search complete. Found 1 device.");
assert.equal(scanSummary("en", 3), "Search complete. Found 3 devices.");

// The first USB screen and the detailed wizard ship bundled strings. Each
// language must retain the stock command verbatim and carry its own USB help.
assert.deepEqual(Object.keys(usbLabels.en).sort(), Object.keys(usbLabels.ru).sort());
assert.deepEqual(bundledUsbLabels, usbLabels);

// A copied English sentence can satisfy key parity. The two language-neutral
// panel labels below are intentional, and all USB labels have a translation.
function unchangedLabels(catalog) {
  return Object.keys(catalog.en).filter(key => catalog.en[key] === catalog.ru[key]).sort();
}
assert.deepEqual(unchangedLabels(MESSAGES), ["lite_sensor_CO2", "transport_ha"]);
assert.deepEqual(unchangedLabels(usbLabels), []);

for (const key of ["prepare", "enable", "cable", "usb_selection_cancelled"]) {
  assert.notEqual(usbLabels.en[key], usbLabels.ru[key]);
}
assert.match(usbLabels.en.enable, /#adb=on#/);
assert.match(usbLabels.ru.enable, /#adb=on#/);
// Dictionary parity alone can pass while a component renders in English.
// Check the same public USB element that the HACS panel calls, without
// simulating any attribute callback or starting a transport.
const customElements = new Map();
globalThis.HTMLElement = class {
  setAttribute(name, value) { this[name] = value; }
};
globalThis.customElements = {define: (name, component) => customElements.set(name, component)};
await import("../custom_components/qingping_esphome/frontend/usb-choice.mjs");
const usb = new (customElements.get("qingping-usb-choice"))();
usb.setLanguage("ru");
assert.equal(usb.text("prepare"), usbLabels.ru.prepare, "Locale can arrive before the element connects");
const heading = {dataset: {label: "prepare"}};
const nodes = {
  location: {value: "ha"},
  help: {}, check: {}, capture: {}, prepare: {}, progress: {setAttribute() {}},
  status: {}, error: {},
};
usb.$ = id => nodes[id];
usb.root = {querySelectorAll: () => [heading]};
usb.status = "copying"; usb.completed = 3;
usb.error = "future_unknown_error";
usb.setLanguage("en");
assert.equal(heading.textContent, usbLabels.en.prepare);
usb.setLanguage("ru");
assert.equal(heading.textContent, usbLabels.ru.prepare);
assert.equal(nodes.location.value, "ha");
assert.equal(nodes.help.textContent, usbLabels.ru.ha_help);
assert.equal(nodes.status.textContent, usbLabels.ru.copying + " 3/9");
assert.equal(nodes.error.textContent, usbLabels.ru.failed);

// Cover static labels and accessible names in both browser entry points, in
// addition to checking the translated JS dictionaries for missing values.
const load = path => readFileSync(new URL(path, import.meta.url), "utf8");
const frontend = "../custom_components/qingping_esphome/frontend/";
for (const [path, attrs, messages] of [
  [frontend + "panel.js", /data-i18n(?:-aria)?="([\w-]+)"/g, MESSAGES],
  [frontend + "usb-choice.mjs", /data-label="([\w-]+)"/g, usbLabels],
  [frontend + "monitor1/index.html", /data-text="([\w-]+)"/g, usbLabels],
]) {
  for (const [, key] of load(path).matchAll(attrs)) {
    assert.ok(messages.en[key]?.trim() && messages.ru[key]?.trim(), path + " · " + key);
  }
}
function translationPaths(value, base = "") {
  if (typeof value === "string") {
    assert.ok(value.trim(), base);
    return [base];
  }
  return Object.entries(value).flatMap(([key, child]) => translationPaths(child, base + "." + key)).sort();
}
const ha = "../custom_components/qingping_esphome/";
const nativeEnglish = JSON.parse(load(ha + "translations/en.json"));
assert.deepEqual(nativeEnglish, JSON.parse(load(ha + "strings.json")));
assert.deepEqual(translationPaths(JSON.parse(load(ha + "translations/ru.json"))), translationPaths(nativeEnglish));
console.log("Language defaults, locale propagation, rendered labels and backend error translations passed");
