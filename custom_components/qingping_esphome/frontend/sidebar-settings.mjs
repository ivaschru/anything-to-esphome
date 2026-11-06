/** One HA-owned navigation preference, shared with Configure → Interface.
 * Use the native administrator-only options flow rather than a second Store,
 * browser preference or network configuration endpoint. Opening/reading a form
 * never submits it; every unfinished flow is closed, including error paths.
 */
export class SidebarSettings {
  constructor(hass) { this.hass = hass; }

  async interfaceForm(action) {
    const entries = await this.hass.callWS({type: "config_entries/get", domain: "qingping_esphome"});
    if (entries.length !== 1) throw Error("sidebar_unavailable");
    const base = "config/config_entries/options/flow";
    const initial = await this.hass.callApi("POST", base, {handler: entries[0].entry_id});
    if (!initial.flow_id) throw Error("sidebar_unavailable");
    const path = `${base}/${encodeURIComponent(initial.flow_id)}`;
    try {
      if (initial.type !== "menu" || !initial.menu_options?.includes("interface")) throw Error("sidebar_unavailable");
      const form = await this.hass.callApi("POST", path, {next_step_id: "interface"});
      const field = form.data_schema?.find(item => item.name === "show_sidebar");
      if (form.type !== "form" || form.step_id !== "interface" || typeof field?.default !== "boolean") throw Error("sidebar_unavailable");
      return await action(field.default, path);
    } finally {
      // A successful submit has already removed the flow (DELETE then returns
      // 404). Cleanup is best effort and must not hide a verified saved value.
      try { await this.hass.callApi("DELETE", path); } catch { /* Already closed or connection lost. */ }
    }
  }

  async read() { return this.interfaceForm(value => value); }

  async save(value) {
    if (typeof value !== "boolean") throw Error("sidebar_unavailable");
    try {
      await this.interfaceForm(async (_current, path) => {
        const result = await this.hass.callApi("POST", path, {show_sidebar: value});
        if (result.type !== "create_entry") throw Error("sidebar_unavailable");
      });
    } catch {
      // A lost response is ambiguous. Read HA's actual preference below; never
      // repeat the setter, switch to network options or expose raw API errors.
    }
    const actual = await this.read();
    if (actual !== value) throw Error("sidebar_unavailable");
    return actual;
  }
}
