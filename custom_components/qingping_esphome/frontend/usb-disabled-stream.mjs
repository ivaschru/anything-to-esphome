/** Finite canonical disabled-commit wrapper over sealed stdin mechanics.
 * No caller body/path/service or generic stream method is exposed. Keep this
 * class identity for the existing consumed commit session and original exact
 * claim -> watchdog -> start order. Each step is consumed before validation.
 */
import {FixedStdinLifecycle,fixedStdinService} from './usb-fixed-stdin.mjs';
import {disabledCommand} from './usb-disabled-commands.mjs';
const fail=()=>{throw {code:'usb_browser_scope_unverified'};};
const phases=['claim','watchdog','start'];
export const disabledStreamService=fixedStdinService;
export class DisabledCommandStream {
 #engine;#next=0;
 constructor(backend) {
  this.#engine=new FixedStdinLifecycle(backend,({meta,scope,nonce,phase})=>disabledCommand(meta,scope,nonce,phase));
 }
 ready() {return this.#engine.ready();}
 probe() {return this.#engine.probe();}
 async execute(meta,scope,nonce,phase) {
  if(!phases.includes(phase) || phases[this.#next]!==phase || !this.#engine.ready()) {
   await this.close().catch(()=>{});fail();
  }
  this.#next++; // No lost-ACK/validation failure can make this phase reusable.
  await this.#engine.execute({meta,scope,nonce,phase});return {phase,completed:true};
 }
 close() {return this.#engine.close();}
}
