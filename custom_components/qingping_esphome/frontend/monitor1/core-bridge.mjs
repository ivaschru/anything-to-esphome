/** Only bundled srcdoc uses this bridge; the legacy ingress page keeps fetch.
 * HA tokens never enter the iframe. Every reply is tied to this frame's nonce
 * and an unrepeated random request ID. Timeout is uncertain, never a resend.
 */
const channel=document.querySelector('meta[name="qingping-core-channel"]')?.content;
// about:srcdoc reports location.origin as "null" even though its inherited
// security origin is HA's. The parent supplied a same-origin base URL; use
// that real document origin instead of weakening postMessage to "*".
const origin=new URL(document.baseURI).origin;
const pending=new Map();
if (channel) window.addEventListener("message",event=>{
  const data=event.data;
  if(event.source!==window.parent || event.origin!==origin || data?.channel!==channel
      || data.kind!=="qingping-core-response" || !pending.has(data.id)) return;
  const callback=pending.get(data.id);pending.delete(data.id);
  callback(data);
});
export const embedded=!!channel;
export function coreFetch(operation,data,timeout) {
  if(!channel) throw {code:"usb_core_unavailable"};
  return new Promise((resolve,reject)=>{
    const id=crypto.randomUUID();
    const timer=setTimeout(()=>{pending.delete(id);reject({code:"usb_core_unverified"});},timeout);
    pending.set(id,response=>{
      clearTimeout(timer);
      if(response.error) {reject({code:response.error});return;}
      resolve(new Response(response.body,{status:response.status,
        headers:{"Content-Type":response.mime,"Content-Length":String(response.body.byteLength)}}));
    });
    window.parent.postMessage({kind:"qingping-core-request",channel,id,operation,data},origin);
  });
}
// Measure intrinsic content, not the root viewport height. Measuring the
// viewport and adding parent padding would grow the iframe on every resize.
if(channel) new ResizeObserver(()=>window.parent.postMessage({kind:"qingping-core-height",channel,
  height:Math.ceil(document.body.getBoundingClientRect().height)},origin)).observe(document.body);
