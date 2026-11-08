/** Separate finite PM sealed stream. No Native/Core/UI initiator is implied. */
import {FixedStdinLifecycle,fixedStdinService} from './usb-fixed-stdin.mjs';
import {pmNextBootCommand} from './usb-pm-boot-commands.mjs';
const fail=()=>{throw {code:'usb_browser_scope_unverified'};};
export const pmBootStreamService=frame=>fixedStdinService(frame,65536);

export class PmBootCommandStream {
 #engine;#next=0;
 constructor(backend) {
  this.#engine=new FixedStdinLifecycle(backend,async({context,scope,nonce,phase})=>{
   const command=await pmNextBootCommand(context,scope,nonce,phase);
   return command.endsWith('\n')?command.slice(0,-1):command;
  },65536); // Trusted module constant; never a caller-selected larger bound.
 }
 ready() {return this.#engine.ready();}
 async probe() {
  const value=await this.#engine.probe();
  return {...value,kind:'browser_pm_fixed_stdin_probe',maximum_body_bytes:65536,probe_body_bytes:65536};
 }
 async execute(context,scope,nonce,phase) {
  if(this.#next>=2 || ['arm','complete'][this.#next]!==phase || !this.#engine.ready()) {
   await this.close().catch(()=>{});fail();
  }
  this.#next++; // Consume before assembly, OPEN or possible flag effects.
  await this.#engine.execute({context,scope,nonce,phase});
  return {phase,completed:true};
 }
 close() {return this.#engine.close();}
}
