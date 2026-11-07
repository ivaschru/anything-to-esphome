import assert from "node:assert/strict";
import {downloadPrivateProfile} from "../custom_components/qingping_esphome/frontend/usb-private-download.mjs";
const priorDocument=globalThis.document,priorTimeout=globalThis.setTimeout;
const create=URL.createObjectURL,revoke=URL.revokeObjectURL;
let clicks=0,revoked=0;
const link={click(){clicks++;assert.equal(this.download,"qingping-cgs1-private-profile.json");}};
try {
  globalThis.document={createElement:tag=>{assert.equal(tag,"a");return link;}};
  globalThis.setTimeout=callback=>{callback();return 1;};
  URL.createObjectURL=()=>"blob:fixture-only";
  URL.revokeObjectURL=url=>{assert.equal(url,"blob:fixture-only");revoked++;};
  downloadPrivateProfile(new Blob(["synthetic-profile"],{type:"application/vnd.qingping.private-profile+json"}));
  assert.equal(clicks,1);assert.equal(revoked,1);
  assert.throws(()=>downloadPrivateProfile(new Blob(["untyped"])));
} finally {
  globalThis.document=priorDocument;globalThis.setTimeout=priorTimeout;
  URL.createObjectURL=create;URL.revokeObjectURL=revoke;
}
console.log("Private profile download: opaque bounded attachment, fixed filename and URL cleanup passed");
