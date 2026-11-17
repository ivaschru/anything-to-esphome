import {normalizeLanguage} from "./i18n.mjs";

/** Embed the shared offline wizard inside the authenticated HACS panel.
 * Same-origin srcdoc keeps WebUSB's original click and standard downloads.
 * The parent retains HA authentication; no bearer token/session URL is passed
 * into the child, localStorage, query string, logs or a separate HTTP server.
 */
export async function openCoreWizard(container,hass,language="en") {
  if(!hass?.user?.is_admin || typeof hass.fetchWithAuth!=="function") throw {code:"usb_unauthorized"};
  const page=await hass.fetchWithAuth("/api/qingping_esphome/monitor1/page",{
    method:"POST",headers:{"Content-Type":"application/json"},body:"null"});
  if(!page.ok) throw {code:"usb_core_unavailable"};
  const {nonce}=await page.json();
  if(!/^[a-f0-9]{64}$/.test(nonce)) throw {code:"usb_core_unverified"};
  // Resolve the HTML and its modules under the parent panel release so an
  // older cached Core bridge cannot be paired with a newer child script.
  const assets = new URL("./monitor1/", import.meta.url);
  const template=await fetch(new URL("index.html", assets).pathname,{credentials:"same-origin"});
  if(!template.ok) throw {code:"usb_core_unavailable"};
  const html=await template.text();
  const channel=crypto.randomUUID(),frame=document.createElement("iframe");
  let closed=false,busy=false,frameRequests=0;
  let locale = normalizeLanguage(language);
  const setLanguage = value => {
    locale = normalizeLanguage(value);
    frame.title = locale === "ru" ? "Установка Qingping Monitor 1" : "Qingping Monitor 1 installation";
    if (!closed) frame.contentWindow?.postMessage({kind:"qingping-core-language", channel, language:locale}, location.origin);
  };
  frame.setAttribute("allow","usb");
  frame.style.cssText="width:100%;height:1100px;border:0;display:block;background:var(--card-background-color,#fff)";
  const seen=new Set(),frameSeen=new Set();let frameLimit=4096;
  const listener=async event=>{
    const data=event.data;
    if(closed || event.source!==frame.contentWindow || event.origin!==location.origin || data?.channel!==channel) return;
    if(data.kind==="qingping-core-height") {
      if(Number.isFinite(data.height)) frame.style.height=Math.min(12000,Math.max(600,data.height+12))+"px";
      return;
    }
    if(data.kind!=="qingping-core-request" || typeof data.id!=="string" || !/^[a-f0-9-]{36}$/.test(data.id)
        || typeof data.operation!=="string" || !/^[a-z][a-z0-9/-]{0,100}$/.test(data.operation)) return;
    const reply=message=>{if(!closed) frame.contentWindow.postMessage({kind:"qingping-core-response",channel,id:data.id,...message},location.origin);};
    // Only finite reply/delivery/retirement frames may run while a native
    // operation owns the ordinary request. Otherwise that operation could
    // deadlock waiting for its own browser. This grants no second writer.
    const frameIO=/^browser\/(poll|answer|close)$/.test(data.operation);
    if((busy && !frameIO) || (frameIO && frameRequests>=2) || seen.has(data.id) || frameSeen.has(data.id) || (frameIO ? frameSeen.size>=frameLimit : seen.size>=4096)) {reply({error:"usb_busy"});return;}
    // Consume before authenticated IO, including a lost response. Status
    // refresh uses a new read ID; a writer is never repeated automatically.
    (frameIO?frameSeen:seen).add(data.id);if(frameIO) frameRequests++;else busy=true;
    try {
      const body=JSON.stringify(data.data===undefined ? null : data.data);
      if(new TextEncoder().encode(body).byteLength>24*1024*1024) throw Error();
      const response=await hass.fetchWithAuth("/api/qingping_esphome/monitor1/"+data.operation,{
        method:"POST",headers:{"Content-Type":"application/json","X-Qingping-Nonce":nonce},body});
      const length=Number(response.headers.get("Content-Length"));
      if(!Number.isInteger(length) || length<=0 || length>64*1024*1024) throw Error();
      const result=await response.arrayBuffer();
      if(result.byteLength!==length) throw Error();
      // Enlarge only the initial frame-ID budget for an ACTUALLY accepted
      // fresh Full UI registration. Ordinary operations remain capped4096,
      // two frame requests in flight stay unchanged, and no counter resets.
      // The Core capability still owns its independent900s/byte/frame limits.
      if(data.operation==="browser/open" && data.data?.purpose==="full-ui" && response.ok &&
         response.headers.get("Content-Type")?.split(";")[0]==="application/json") {
        const registration=JSON.parse(new TextDecoder().decode(result));
        if(registration.state==="registered" && registration.writer_enabled===false &&
           /^[a-f0-9]{32}$/.test(registration.channel_id))frameLimit=300000;
      }
      reply({status:response.status,mime:response.headers.get("Content-Type"),body:result});
    } catch {reply({error:"usb_core_unverified"});}
    finally {if(frameIO) frameRequests--;else busy=false;}
  };
  window.addEventListener("message",listener);
  // Seed the first render before the child's modules run. Reapply the latest
  // selection once it loads in case the parent changed during that interval.
  frame.srcdoc = html.replace('<html lang="en">', `<html lang="${locale}">`)
    .replace("__PAGE_NONCE__", nonce)
    .replace("<head>", `<head><base href="${assets.pathname}"><meta name="qingping-core-channel" content="${channel}">`);
  frame.onload = () => setLanguage(locale);
  container.replaceChildren(frame);
  setLanguage(locale);
  return {setLanguage, close() {
    closed=true;
    frame.onload=null;
    window.removeEventListener("message",listener);
    frame.remove();
  }};
}
