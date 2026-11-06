/** Resolve only the installed, exact companion; never guess a repository ID
 * or start/install an app. Use HA's exact admin ingress/session methods, as
 * src/data/hassio/ingress.ts does; never guess a historical frontend route.
 * Raw Supervisor errors and session/private URLs must never be logged.
 */
export async function companionPath(hass) {
  if (!hass?.user?.is_admin) throw {code:"usb_unauthorized"};
  let response;
  try {response=await hass.callWS({type:"supervisor/api",endpoint:"/addons",method:"get"});}
  catch {throw {code:"usb_companion_unavailable"};}
  const addons=response?.addons;
  if (!Array.isArray(addons)) throw {code:"usb_companion_unavailable"};
  const matches=addons.filter(app=>app.url === "https://github.com/ivaschru/qingping-esphome/tree/main/apps/monitor1_usb"
    && typeof app.slug === "string" && /^[a-zA-Z0-9_.-]+_qingping_monitor1_usb$/.test(app.slug));
  if (matches.length !== 1) throw {code:"usb_companion_unavailable"};
  const selected=matches[0];
  let info;
  try {info=await hass.callWS({type:"supervisor/ingress/info",slug:selected.slug});}
  catch {throw {code:"usb_companion_unavailable"};}
  if (info?.slug !== selected.slug || info.state !== "started") throw {code:"usb_companion_stopped"};
  if (typeof info.ingress_url !== "string" || !/^\/api\/hassio_ingress\/[A-Za-z0-9_-]{1,256}\/?$/.test(info.ingress_url))
    throw {code:"usb_companion_unavailable"};
  let auth;
  try {auth=await hass.callWS({type:"supervisor/ingress/session",slug:selected.slug});}
  catch {throw {code:"usb_companion_unavailable"};}
  if (typeof auth?.session !== "string" || !/^[A-Za-z0-9_-]{16,256}$/.test(auth.session))
    throw {code:"usb_companion_unavailable"};
  // Returned only to the same HA page for its normal first-party session
  // cookie/navigation. Do not persist this object in application storage.
  return {path:info.ingress_url.replace(/\/?$/,"/"),session:auth.session};
}
