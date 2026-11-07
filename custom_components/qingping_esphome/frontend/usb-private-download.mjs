/** Explicit secret-file download only; never parse it into UI/status state. */
export function downloadPrivateProfile(blob) {
  if(!(blob instanceof Blob) || blob.type!=="application/vnd.qingping.private-profile+json" || !blob.size || blob.size>16384)
    throw {code:"usb_private_export_unverified"};
  const url=URL.createObjectURL(blob),link=document.createElement("a");
  link.href=url;link.download="qingping-cgs1-private-profile.json";link.rel="noreferrer";
  link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
