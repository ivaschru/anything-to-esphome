/** Rebuild the offline browser USB bundle with the exact lockfile.
 * npm ci --ignore-scripts in this directory installs only pinned dependencies.
 * An explicit --dependencies path permits a private build cache; it changes
 * no source or version pin and is never included in generated metadata.
 */
import {readFile, writeFile, copyFile, mkdir} from "node:fs/promises";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";
import path from "node:path";

const own = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(own, "../..");
const option = process.argv.slice(2);
if (option.length !== 0 && !(option.length === 2 && option[0] === "--dependencies"))
  throw Error("Only an explicit dependency directory is accepted");
const dependencies = option.length ? path.resolve(option[1]) : own;
const require = createRequire(path.join(dependencies, "package.json"));
const expected = JSON.parse(await readFile(path.join(own, "package-lock.json"), "utf8"));
const notices = [];
for (const [name, spec] of Object.entries(expected.packages)) {
  if (!name || name.includes("@esbuild/")) continue; // Build tool, not browser runtime.
  const installed = JSON.parse(await readFile(path.join(dependencies, name, "package.json"), "utf8"));
  if (installed.version !== spec.version || installed.license !== "MIT")
    throw Error("Installed browser dependency differs from the reviewed lock");
  if (!name.includes("@yume-chan/")) continue;
  const license = await readFile(path.join(dependencies, name, "LICENSE"), "utf8");
  notices.push(name.slice("node_modules/".length) + " " + spec.version + "\n\n" + license.trim());
}
await require("esbuild").build({
  entryPoints: [path.join(own, "entry.mjs")],
  outfile: path.join(root, "custom_components/qingping_esphome/frontend/usb-probe-bundle.mjs"),
  nodePaths: [path.join(dependencies, "node_modules")],
  bundle: true, format: "esm", platform: "browser", target: "chrome110",
  minify: true, legalComments: "inline",
  banner: {js: "// Tango ADB browser probe. Rebuild: tools/monitor1-usb/build.mjs; MIT notices: usb-probe-NOTICES.txt"},
});
await writeFile(path.join(root, "custom_components/qingping_esphome/frontend/usb-probe-NOTICES.txt"),
  notices.join("\n\n--------------------\n\n") + "\n");
const appStatic = path.join(root, "apps/monitor1_usb/rootfs/static");
await mkdir(appStatic, {recursive:true});
for (const name of ["usb-probe-bundle.mjs", "usb-probe-NOTICES.txt"])
  await copyFile(path.join(root, "custom_components/qingping_esphome/frontend", name), path.join(appStatic, name));
