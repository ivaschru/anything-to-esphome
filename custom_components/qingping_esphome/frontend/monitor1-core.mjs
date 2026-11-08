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
  const template=await fetch("/api/qingping_esphome/static/monitor1/index.html",{credentials:"same-origin"});
  if(!template.ok) throw {code:"usb_core_unavailable"};
  const html=await template.text();
  const channel=crypto.randomUUID(),frame=document.createElement("iframe");
  frame.title=language==="ru" ? "Установка Qingping Monitor 1" : "Qingping Monitor 1 installation";
  frame.setAttribute("allow","usb");
  frame.style.cssText="width:100%;height:1100px;border:0;display:block;background:var(--card-background-color,#fff)";
  let closed=false,busy=false,frameRequests=0;
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
  frame.srcdoc=html.replace("__PAGE_NONCE__",nonce).replace("<head>",`<head><base href="/api/qingping_esphome/static/monitor1/"><meta name="qingping-core-channel" content="${channel}">`);
  container.replaceChildren(frame);
  return ()=>{closed=true;window.removeEventListener("message",listener);frame.remove();};
}
