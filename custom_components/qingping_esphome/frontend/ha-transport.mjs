/** HA owns GATT and selects a connectable local adapter or Bluetooth proxy.
 * The browser carries only authenticated requests, never calls Web Bluetooth
 * in this mode, and never retries a possibly applied provisioning request.
 */
import {failure} from "./i18n.mjs";

export class HABluetoothConnection {
  constructor(rpc, address) { this.rpc = rpc; this.address = address; }

  async connect() {
    const result = await this.rpc("ble_select", {address: this.address});
    this.selection = result.selection;
    return result.identity;
  }

  async provision(_ssid, _password, _broker, message, session) {
    message("provisioning");
    const result = await this.rpc("ble_provision", {session});
    if (result.error_code) throw failure(result.error_code);
    if (!result.provisioned) throw failure("ha_bluetooth_setup_incomplete");
  }

  disconnect() {
    // Selection already released its HA connection. An in-progress backend
    // task has its own bounded lifetime and is reconciled using session status.
  }
}
