import assert from "node:assert/strict";
import {companionPath} from "../custom_components/qingping_esphome/frontend/usb-companion.mjs";
const url="https://github.com/ivaschru/qingping-esphome/tree/main/apps/monitor1_usb";
const app={slug:"fixture_qingping_monitor1_usb",url};
const ingress={path:"/api/hassio_ingress/fixture_ingress/",session:"fixture_session_not_a_real_token"};
function fixture(addons=[app],info={slug:app.slug,state:"started",ingress_url:ingress.path}) {
  const calls=[];
  return {calls,hass:{user:{is_admin:true},async callWS(request) {
    calls.push(request);return request.type === "supervisor/api" ? {addons} :
      request.type === "supervisor/ingress/session" ? {session:ingress.session} : info;
  }}};
}
{
  const f=fixture();
  assert.deepEqual(await companionPath(f.hass),ingress);
  assert.deepEqual(f.calls,[{type:"supervisor/api",endpoint:"/addons",method:"get"},
    {type:"supervisor/ingress/info",slug:app.slug},{type:"supervisor/ingress/session",slug:app.slug}]);
  assert.ok(f.calls.every(call=>!["post","put","delete"].includes(call.method)));
}
for (const path of ["//other.invalid/", "https://other.invalid/", "/api/hassio_ingress/fixture?token=bad", "/hassio/ingress/guessed"]) {
  const f=fixture([app],{slug:app.slug,state:"started",ingress_url:path});
  await assert.rejects(companionPath(f.hass),{code:"usb_companion_unavailable"});
  assert.equal(f.calls.length,2,"Do not mint a session for an unverified URL");
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
{
  const f=fixture(), previous=f.hass.callWS;
  f.hass.callWS=async request=>request.type === "supervisor/ingress/session" ? {session:"bad; cookie=injection"} : previous(request);
  await assert.rejects(companionPath(f.hass),{code:"usb_companion_unavailable"});
}
console.log("Exact companion discovery, native admin ingress and no automatic install/start passed");
