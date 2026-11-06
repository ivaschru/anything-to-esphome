/** Owner-bound preparation, not an install or a generic companion API.
 * No secret profile is returned. A lost POST acknowledgement is reconciled
 * only with GET for the same client-selected request ID, never a second POST.
 */
const fail = code => {throw {code};};
const KEYS = ["job_id","stage","model","co2_type","transport","node_name","friendly_name",
  "live_recheck_required","installed","installation_ready"];

function statusFrame(value, requestId, transport, stages) {
  if (!value || typeof value!=="object" || Object.keys(value).sort().join()!==[...KEYS].sort().join() ||
      value.job_id!==requestId || !/^[a-f0-9]{32}$/.test(requestId) || !stages.includes(value.stage) ||
      value.model!=="CGS1" || ![2,3].includes(value.co2_type) || value.transport!==transport ||
      !/^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/.test(value.node_name) ||
      typeof value.friendly_name!=="string" || value.live_recheck_required!==true ||
      value.installed!==false || value.installation_ready!==false)
    fail("usb_preparation_unverified");
  return value;
}

export function preparedStatus(value, requestId, transport) {
  return statusFrame(value,requestId,transport,["profile_prepared"]);
}

export async function savedPreparations(rpc) {
  const value=await rpc("jobs");
  if (!value || Object.keys(value).join()!=="jobs" || !Array.isArray(value.jobs) || value.jobs.length>8)
    fail("usb_preparation_unverified");
  const seen=new Set();
  for(const item of value.jobs) {
    if (!item || !["ha_usb","browser_usb"].includes(item.transport) || seen.has(item.job_id)) fail("usb_preparation_unverified");
    statusFrame(item,item.job_id,item.transport,["profile_prepared","preparation_unverified"]);
    seen.add(item.job_id);
  }
  return value.jobs;
}

async function encodedArchive(archive) {
  if (!(archive instanceof Blob) || archive.type!=="application/x-tar" || archive.size>16*1024*1024)
    fail("usb_capture_unverified");
  const bytes=new Uint8Array(await archive.arrayBuffer()), chunks=[];
  // Spread only bounded chunks: the full vendor archive would exceed the
  // JavaScript argument stack. The resulting body stays within the 24MiB cap.
  for(let start=0;start<bytes.length;start+=32768)
    chunks.push(String.fromCharCode(...bytes.subarray(start,start+32768)));
  return btoa(chunks.join(""));
}

export async function prepareProfile(rpc, requestId, friendlyName, source) {
  if (!/^[a-f0-9]{32}$/.test(requestId) || typeof friendlyName!=="string" || !friendlyName)
    fail("usb_request_invalid");
  const browser=source.archive instanceof Blob;
  const transport=browser ? "browser_usb" : "ha_usb";
  const body={request_id:requestId,friendly_name:friendlyName,
    ...(browser ? {capture:await encodedArchive(source.archive)} : {serial:source.serial})};
  try {
    return preparedStatus(await rpc("prepare",body),requestId,transport);
  } catch(error) {
    // These are pre-job refusals: preserve their actionable fixed labels.
    if (["usb_unauthorized","usb_busy","usb_request_invalid","usb_capture_unverified",
         "usb_profile_name_invalid","usb_job_limit"].includes(error?.code)) throw error;
    try {return await readPrepared(rpc,requestId,transport);} catch {}
    fail("usb_preparation_unverified");
  }
}

export async function readPrepared(rpc,requestId,transport) {
  if (!/^[a-f0-9]{32}$/.test(requestId) || !["browser_usb","ha_usb"].includes(transport))
    fail("usb_request_invalid");
  return preparedStatus(await rpc("jobs/"+requestId),requestId,transport);
}
