/** Private recovery archive, never a public firmware asset or a NAND image.
 * All member names/sizes come from the generated fixed contract. USTAR uses
 * private file/dir modes and no executable, link or host-owner metadata.
 */
const encoder = new TextEncoder();
const ROOT = "qingping-cgs1-capture";
function header(name, size, directory) {
  if (!/^[A-Za-z0-9._/+-]+$/.test(name) || name.startsWith("/") || name.split("/").includes("..") ||
      name.length > 100 || !Number.isInteger(size) || size < 0 || size > 32 * 1024 * 1024)
    throw Error("Invalid fixed capture member");
  const block = new Uint8Array(512);
  const put = (offset, text) => block.set(encoder.encode(text), offset);
  const octal = (offset, width, value) => put(offset, value.toString(8).padStart(width - 1, "0") + "\0");
  put(0, name); octal(100, 8, directory ? 0o700 : 0o600); octal(108, 8, 0); octal(116, 8, 0);
  octal(124, 12, size); octal(136, 12, 0); block.fill(32, 148, 156);
  put(156, directory ? "5" : "0"); put(257, "ustar\0"); put(263, "00");
  const checksum = block.reduce((sum, value) => sum + value, 0);
  put(148, checksum.toString(8).padStart(6, "0") + "\0 ");
  return block;
}

export function captureArchive(contract, contents, report) {
  if (!(contents instanceof Map) || contents.size !== contract.files.length || contract.files.length !== 9)
    throw Error("Complete fixed capture required");
  const entries = [], directories = new Set([ROOT]);
  let total = 0;
  for (const file of contract.files) {
    const data = contents.get(file.path);
    if (!(data instanceof Uint8Array) || data.length !== file.size) throw Error("Capture size changed");
    total += data.length;
    if (total > 32 * 1024 * 1024) throw Error("Capture budget exceeded");
    const name = ROOT + "/" + file.path.replace(/^\//, "");
    // header also validates the complete final member before a Blob exists.
    header(name, data.length, false);
    const parts = name.split("/");
    for (let i = 1; i < parts.length; i++) directories.add(parts.slice(0, i).join("/"));
    entries.push([name, data]);
  }
  const manifest = encoder.encode(JSON.stringify(report, null, 2) + "\n");
  if (manifest.length > 65536) throw Error("Capture metadata budget exceeded");
  entries.push([ROOT + "/result.json", manifest]);
  const chunks = [...directories].sort().map(name => header(name + "/", 0, true));
  for (const [name, data] of entries) {
    chunks.push(header(name, data.length, false), data);
    const padding = (512 - data.length % 512) % 512;
    if (padding) chunks.push(new Uint8Array(padding));
  }
  chunks.push(new Uint8Array(1024));
  return new Blob(chunks, {type: "application/x-tar"});
}

/** One local download, no server upload, object persistence or remote URL. */
export function downloadCapture(archive) {
  if (!(archive instanceof Blob) || archive.type !== "application/x-tar" || archive.size > 33 * 1024 * 1024)
    throw Error("Invalid private capture download");
  const url = URL.createObjectURL(archive), anchor = document.createElement("a");
  anchor.href = url; anchor.download = "qingping-cgs1-capture.tar";
  anchor.click();
  // Allow the download to start before retiring this ephemeral object URL.
  // The selected device/source bytes are never written to browser storage.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
