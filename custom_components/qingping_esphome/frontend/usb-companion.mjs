/** Resolve only the installed, exact companion; never guess a repository ID
 * or start/install an app. Native ingress navigation performs HA's own admin
 * access/session flow. Raw Supervisor errors/private URLs are not exported.
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
  return "/hassio/ingress/"+encodeURIComponent(selected.slug);
}
