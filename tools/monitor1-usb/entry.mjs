import {Adb, AdbDaemonTransport} from "@yume-chan/adb";
import {AdbDaemonWebUsbDeviceManager} from "@yume-chan/adb-daemon-webusb";
import {BrowserUsbProbe} from "../../custom_components/qingping_esphome/frontend/usb-probe.mjs";
import {contract} from "../../custom_components/qingping_esphome/frontend/usb-probe-contract.mjs";
export {strings} from "../../custom_components/qingping_esphome/frontend/usb-labels.mjs";
export {downloadCapture} from "../../custom_components/qingping_esphome/frontend/usb-capture.mjs";
export {prepareProfile, readPrepared, savedPreparations} from "../../custom_components/qingping_esphome/frontend/usb-preparation.mjs";
export {startBuild, readBuild} from "../../custom_components/qingping_esphome/frontend/usb-build.mjs";
export {preparePlan, readPlan} from "../../custom_components/qingping_esphome/frontend/usb-plan.mjs";

/** A fresh store for one selection only, with no browser persistence. */
function ephemeralCredentials() {
  let key, attempted = false;
  return {
    async generateKey() {
      if (attempted) throw Error("Ephemeral authorization already attempted");
      attempted = true;
      const pair = await crypto.subtle.generateKey({
        name: "RSASSA-PKCS1-v1_5", modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-1",
      }, true, ["sign", "verify"]);
      key = {buffer: new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey)),
        name: "Qingping USB installer"};
      return key;
    },
    *iterateKeys() { if (key) yield key; },
  };
}

/** Imported before enabling the button so WebUSB stays in its click gesture. */
export function createProbe() {
  return new BrowserUsbProbe({
    manager: AdbDaemonWebUsbDeviceManager.BROWSER,
    authenticate: options => AdbDaemonTransport.authenticate(options),
    createClient: transport => new Adb(transport),
    ephemeralCredentials,
  }, contract);
}
