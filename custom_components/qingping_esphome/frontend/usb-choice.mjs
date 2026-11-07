import {createProbe, strings, downloadCapture} from "./usb-probe-bundle.mjs";
import {openCoreWizard} from "./monitor1-core.mjs";

/** The main HACS panel's real first USB step. Computer mode needs no app;
 * server mode opens the exact installed companion through native HA ingress.
 * This component grants no setup/write/trial/activation permission.
 */
class UsbChoice extends HTMLElement {
  static get observedAttributes() {return ["lang"];}
  set hass(value) {this._hass=value;}
  connectedCallback() {
    if (this.root) return;
    this.root=this.attachShadow({mode:"open"});
    this.root.innerHTML=`<style>
      :host{display:block;margin:22px 0}label{display:block;font-weight:600}select{display:block;min-height:46px;max-width:100%;margin:8px 0;padding:8px;border:1px solid var(--divider-color,#c8cfd6);border-radius:8px;font:inherit;background:var(--card-background-color,#fff);color:inherit}
      button{min-height:46px;padding:10px 18px;margin:8px 0;border:1px solid var(--primary-color,#087f8c);border-radius:8px;background:var(--primary-color,#087f8c);color:var(--text-primary-color,#fff);font:600 15px system-ui;cursor:pointer}button:disabled{opacity:.55;cursor:default}:focus-visible{outline:3px solid var(--primary-color,#087f8c);outline-offset:3px}
      button.secondary{background:var(--card-background-color,#fff);color:var(--primary-text-color,#18222c)}progress{display:block;width:100%;max-width:320px}progress[hidden]{display:none}
      p{margin:12px 0;font-size:14px}.muted{color:var(--secondary-text-color,#58616b)}#error{color:var(--error-color,#b42318)}dl{overflow-wrap:anywhere}dt{font-weight:600}dd{margin:0 0 8px}a{color:var(--primary-color,#087f8c)}
      </style><label for="location" data-label="transport"></label>
      <select id="location"><option value="browser" data-label="computer"></option><option value="ha" data-label="server"></option></select>
      <p id="help" class="muted"></p><p class="muted" data-label="boundary"></p>
      <button id="check" data-label="inspect"></button> <button id="capture" class="secondary" data-label="capture"></button>
      <button id="prepare" class="secondary" data-label="open_preparation"></button>
      <p class="muted" data-label="capture_help"></p><progress id="progress" max="9" hidden></progress>
      <p id="status" role="status" aria-live="polite"></p><p id="error" role="alert"></p><dl id="identity"></dl>
      <a href="https://github.com/ivaschru/qingping-esphome/tree/main/apps/monitor1_usb" target="_blank" rel="noreferrer" data-label="docs"></a>`;
    this.$=id=>this.root.getElementById(id);
    this.$("location").value=navigator.usb && window.isSecureContext ? "browser" : "ha";
    this.$("location").onchange=()=>{if (!this.busy){this.clear();this.translate();}};
    this.$("check").onclick=()=>this.inspect();
    this.$("capture").onclick=()=>this.inspect(true);
    this.$("prepare").onclick=()=>this.openPreparation();
    this.translate();
  }
  disconnectedCallback() {this.closeWizard?.();void this.probe?.close().catch(()=>{});}
  attributeChangedCallback() {if (this.root) this.translate();}
  text(key) {return (strings[this.lang === "ru" ? "ru" : "en"])[key] || strings.en.failed;}
  clear() {this.$("identity").replaceChildren();this.$("status").textContent=this.$("error").textContent="";this.status=this.error=null;
    this.completed=undefined;this.$("progress").hidden=true;this.$("progress").removeAttribute("value");}
  translate() {
    this.root.querySelectorAll("[data-label]").forEach(node=>{node.textContent=this.text(node.dataset.label);});
    this.$("help").textContent=this.text(this.$("location").value === "ha" ? "ha_help" : "browser_help");
    this.$("check").textContent=this.text(this.$("location").value === "ha" ? "open_companion" : "inspect");
    this.$("capture").hidden=this.$("location").value === "ha";
    this.$("prepare").hidden=this.$("location").value === "ha";
    this.$("progress").setAttribute("aria-label",this.text("copying"));
    if (this.status) this.$("status").textContent=this.text(this.status);
    if (this.status === "copying" && this.completed !== undefined) this.$("status").textContent+=` ${this.completed}/9`;
    if (this.error) this.$("error").textContent=this.text(this.error);
  }
  async inspect(capture=false) {
    if (this.busy) return;
    this.busy=true;this.clear();this.$("location").disabled=this.$("check").disabled=this.$("capture").disabled=this.$("prepare").disabled=true;
    this.status=capture ? "copying" : "checking";this.$("status").textContent=this.text(this.status);
    if (capture) this.$("progress").hidden=false;
    try {
      if (this.$("location").value === "ha") {
        await this.openCompanion();
        return;
      }
      this.probe=createProbe();
      const result=await (capture ? this.probe.capture(done=>{
        this.completed=done;this.$("progress").value=done;this.$("status").textContent=this.text("copying")+` ${done}/9`;
      }) : this.probe.select()); // Keep the native picker in the click gesture.
      for (const [key,value] of [["model",result.model],["version",result.stock_version],
        ["co2",result.co2_type === 2 ? "SenseAir S8" : "SCD40"],["mac",result.wlan_mac]]) {
        const label=document.createElement("dt"),content=document.createElement("dd");
        label.dataset.label=key;label.textContent=this.text(key);content.textContent=value;this.$("identity").append(label,content);
      }
      if (capture) downloadCapture(result.archive);
      this.status=capture ? "capture_success" : "success";this.$("status").textContent=this.text(this.status);
    } catch(error) {
      this.status=null;this.$("status").textContent="";this.error=error.code || "failed";this.$("error").textContent=this.text(this.error);
    } finally {this.probe=undefined;this.busy=false;this.completed=undefined;this.$("progress").hidden=true;
      this.$("location").disabled=this.$("check").disabled=this.$("capture").disabled=this.$("prepare").disabled=false;}
  }
  async openCompanion() {
    if(this.closeWizard) return;
    const container=document.createElement("section");
    container.setAttribute("aria-label",this.lang === "ru" ? "Мастер Monitor 1" : "Monitor 1 wizard");
    this.root.append(container);
    try {this.closeWizard=await openCoreWizard(container,this._hass,this.lang);}
    catch(error) {container.remove();throw error;}
  }
  async openPreparation() {
    if (this.busy) return;
    this.busy=true;this.clear();this.$("location").disabled=this.$("check").disabled=this.$("capture").disabled=this.$("prepare").disabled=true;
    try {await this.openCompanion();}
    catch(error) {this.error=error.code || "failed";this.$("error").textContent=this.text(this.error);}
    finally {this.busy=false;this.$("location").disabled=this.$("check").disabled=this.$("capture").disabled=this.$("prepare").disabled=false;}
  }
}
customElements.define("qingping-usb-choice",UsbChoice);
