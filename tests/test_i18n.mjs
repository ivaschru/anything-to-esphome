import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {MESSAGES, t, readLanguage, saveLanguage, LANGUAGE_KEY, errorKey, scanSummary} from "../custom_components/qingping_esphome/frontend/i18n.mjs";

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
assert.equal(errorKey({name: "NotFoundError"}), "bluetooth_cancelled");
assert.equal(errorKey({message: "private arbitrary text"}), "operation_failed");
assert.equal(scanSummary("ru", 0), "Поиск завершён. Найдено 0 устройств.");
assert.equal(scanSummary("ru", 1), "Поиск завершён. Найдено 1 устройство.");
assert.equal(scanSummary("ru", 3), "Поиск завершён. Найдено 3 устройства.");
assert.equal(scanSummary("ru", 11), "Поиск завершён. Найдено 11 устройств.");
assert.equal(scanSummary("ru", 21), "Поиск завершён. Найдено 21 устройство.");
assert.equal(scanSummary("en", 1), "Search complete. Found 1 device.");
assert.equal(scanSummary("en", 3), "Search complete. Found 3 devices.");
console.log("Language defaults, storage, key parity and backend error translations passed");
