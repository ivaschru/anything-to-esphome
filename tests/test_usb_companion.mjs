import assert from "node:assert/strict";
import {companionPath} from "../custom_components/qingping_esphome/frontend/usb-companion.mjs";
const url="https://github.com/ivaschru/qingping-esphome/tree/main/apps/monitor1_usb";
const app={slug:"fixture_qingping_monitor1_usb",url};
function fixture(addons=[app],info={slug:app.slug,state:"started"}) {
  const calls=[];
  return {calls,hass:{user:{is_admin:true},async callWS(request) {
    calls.push(request);return request.type === "supervisor/api" ? {addons} : info;
  }}};
}
{
  const f=fixture();
  assert.equal(await companionPath(f.hass),"/hassio/ingress/fixture_qingping_monitor1_usb");
  assert.deepEqual(f.calls,[{type:"supervisor/api",endpoint:"/addons",method:"get"},
    {type:"supervisor/ingress/info",slug:app.slug}]);
  assert.ok(f.calls.every(call=>!["post","put","delete"].includes(call.method)));
}
{
  const f=fixture();f.hass.user.is_admin=false;
  await assert.rejects(companionPath(f.hass),{code:"usb_unauthorized"});assert.equal(f.calls.length,0);
}
for (const addons of [[],[app,app],[{...app,url:"https://other.invalid/"}],[{...app,slug:"foreign"}]]) {
  const f=fixture(addons);
  await assert.rejects(companionPath(f.hass),{code:"usb_companion_unavailable"});
  assert.equal(f.calls.length,1);
}
{
  const f=fixture([app],{slug:app.slug,state:"stopped"});
  await assert.rejects(companionPath(f.hass),{code:"usb_companion_stopped"});
}
{
  const f=fixture();f.hass.callWS=async()=>{throw Error("private Supervisor exception");};
  await assert.rejects(companionPath(f.hass),error=>error.code === "usb_companion_unavailable" && !error.message);
}
console.log("Exact companion discovery, native admin ingress and no automatic install/start passed");
