import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {requireLiteProfile} from "../custom_components/qingping_esphome/frontend/compatibility.mjs";

// Read the actual Python catalog without importing HA, rather than duplicating
// the supported/research profile table in a test fixture that can drift.
const root = fileURLToPath(new URL("../", import.meta.url));
const python = process.env.QINGPING_TEST_PYTHON || "python3";
const catalog = JSON.parse(execFileSync(python, ["-c",
  "import json,runpy,sys,types; p=types.ModuleType('qtest'); p.__path__=['custom_components/qingping_esphome']; sys.modules['qtest']=p; print(json.dumps(runpy.run_path('custom_components/qingping_esphome/catalog.py',run_name='qtest.catalog')['CATALOG']))"],
  {cwd: root, encoding: "utf8"}));
const identity = {model: "CGDN1", hardware: "0001", stock_version: "4.5.8"};
assert.equal(requireLiteProfile(catalog, identity).id, "lite");
assert.throws(() => requireLiteProfile(catalog, {...identity, stock_version: "4.2.1"}), {code: "profile_mcu421"});
assert.throws(() => requireLiteProfile(catalog, {...identity, hardware: "0002"}), {code: "identity_unsupported"});
assert.throws(() => requireLiteProfile(catalog, {...identity, model: "CGS1"}), {code: "identity_unsupported"});
assert.throws(() => requireLiteProfile(catalog, {...identity, stock_version: "4.8.5"}), {code: "identity_unsupported"});
assert.throws(() => requireLiteProfile([], identity), {code: "identity_unsupported"});
assert.throws(() => requireLiteProfile([...catalog, catalog[0]], identity), {code: "identity_unsupported"});
console.log("Wizard profile boundaries passed (including stock 4.2.1 refusal)");
