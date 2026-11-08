/** One typed, sealed RAM-creation command; no guardian chmod/exec/cleanup.
 *
 * This is an unwired transport primitive. Its private caller must FIRST own
 * the consumed trial packet/lease and retain the original live USB capability.
 * A harmless positive exec probe is required before that intent is consumed;
 * the probe itself grants no write authority. Reuse no cached preparation.
 */
import {FixedStdinLifecycle,fixedStdinService} from './usb-fixed-stdin.mjs';
import {initialRamCommands} from './usb-initial-ram-commands.mjs';
const fail=()=>{throw {code:'usb_browser_scope_unverified'};};
export const initialRamStreamService=fixedStdinService;
export class InitialRamCommandStream {
 #engine;#consumed=false;
 constructor(backend) {
  this.#engine=new FixedStdinLifecycle(backend,({packet,fresh})=>initialRamCommands(packet,fresh).create);
 }
 ready() {return !this.#consumed && this.#engine.ready();}
 probe() {return this.#engine.probe();}
 async create(packet,fresh) {
  if(this.#consumed || !this.#engine.ready()) {await this.close().catch(()=>{});fail();}
  this.#consumed=true; // Before assembly/open/IO; no retries after lost ACK.
  await this.#engine.execute({packet,fresh});
  return {kind:'browser_initial_ram_command_ack',completed:true,remote_verified:false,image_fd_admitted:false};
 }
 close() {return this.#engine.close();}
}
