/** Actual wizard DOM handlers + finite adapters; synthetic USB/HA boundaries. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import * as workflow from '../custom_components/qingping_esphome/frontend/usb-browser-workflow.mjs';
import * as preparation from '../custom_components/qingping_esphome/frontend/usb-preparation.mjs';
import * as builds from '../custom_components/qingping_esphome/frontend/usb-build.mjs';
import * as plans from '../custom_components/qingping_esphome/frontend/usb-browser-plan.mjs';
import {strings} from '../custom_components/qingping_esphome/frontend/usb-labels.mjs';
const id='c'.repeat(32),sha='d'.repeat(64),channel='e'.repeat(32);
const phases=workflow.browserPhases;
const response=phase=>({job_id:id,phase,state:phase==='complete'?'created':'not_started',can_start:phase!=='complete',
 installed:false,installation_ready:false,replay_allowed:false,...(phase==='full-activate'?{trial_proof_sha256:'f'.repeat(64)}:{}),
 ...(phase==='complete'?{entry_id:'BROWSER_ENTRY'}:{})});
for(const phase of phases)assert.equal(workflow.browserWizardStatus(response(phase),id).phase,phase);
for(const edit of [v=>v.installed=true,v=>v.can_start=1,v=>v.phase='shell',v=>v.host='192.168.1.25']) {
 const v=response('stage');edit(v);assert.throws(()=>workflow.browserWizardStatus(v,id));
}
let issued=0;
await assert.rejects(workflow.startBrowserWizard(async()=>{issued++;throw Error('lost');},id,sha,channel,'stage',{reviewed:true}));
assert.equal(issued,1);
await assert.rejects(workflow.startBrowserWizard(async()=>{issued++;},id,sha,channel,'full-activate',{reviewed:true,screenReviewed:false,trialProof:'f'.repeat(64)}));
assert.equal(issued,1,'No request without both separate confirmations');
for(const lang of ['en','ru'])for(const phase of phases){assert.ok(strings[lang]['browser_step_'+phase]);assert.ok(strings[lang]['browser_help_'+phase]);}
const source=(await readFile(new URL('../apps/monitor1_usb/rootfs/static/app.mjs',import.meta.url),'utf8'))
 .replace(/import\s*\{([\s\S]*?)\}\s*from\s*"[^"]+";/g,(_,names)=>`const {${names}}=deps;`);
async function fixture(lost=false) {
 const nodes=new Map(),calls=[],events=new Map();let index=0,pickers=0;
 function element(id){if(!nodes.has(id))nodes.set(id,{value:id==='transport'?'browser':'',checked:false,disabled:false,hidden:false,
 textContent:'',dataset:{},style:{},setAttribute(){},removeAttribute(){},replaceChildren(){},append(){}});return nodes.get(id);}
 const job={job_id:id,stage:'profile_prepared',model:'CGS1',co2_type:2,transport:'browser_usb',node_name:'fixture-cgs1',friendly_name:'Synthetic monitor',
 live_recheck_required:true,installed:false,installation_ready:false};
 const plan={job_id:id,state:'browser_plan_prepared',plan_id:'a'.repeat(32),plan_sha256:sha,requested_data_free_bytes:16000000,
 transport_kind:'browser_webusb',native_get_devpath:false,hardware_contacted:false,device_writes:0,installed:false,
 installation_ready:false,writer_enabled:false,live_recheck_required:true};
 const select=()=>{pickers++;calls.push(['picker']);return Promise.resolve({channel_id:channel,close:async()=>({state:'closed'})});};
 const deps={embedded:true,strings,...preparation,...builds,...plans,...workflow,
 createNativeChannel:()=>({close:async()=>{}}),openBrowserControl:select,openBrowserReviewControl:select,openBrowserFullUiControl:select,
 coreFetch:async(op,data)=>{
  calls.push([op,data]);let r;
  if(op==='tools-status')r={state:'tools_ready'};
  else if(op==='jobs')r={jobs:[job]};
  else if(op==='jobs/'+id)r=job;
  else if(op==='jobs/'+id+'/build')r={job_id:id,state:'built_not_installed',phase:'complete',hardware_contacted:false,installed:false,installation_ready:false};
  else if(op==='jobs/'+id+'/browser-plan')r=plan;
  else if(op==='browser-wizard-status')r=response(phases[index]);
  else if(op.startsWith('browser-wizard-')){
   assert.equal(calls.at(-2)[0],'picker','The original click selects USB before the initiating network request');
   assert.equal(op,'browser-wizard-'+phases[index]);
   if(lost)throw Error('synthetic lost response');
   assert.equal(data.job_id,id);assert.equal(data.expected_plan_sha256,sha);assert.equal(data.channel_id,channel);
   if(phases[index]==='full-activate'){assert.equal(data.screen_reviewed,true);assert.equal(data.experimental_reviewed,true);assert.equal(data.expected_trial_proof_sha256,'f'.repeat(64));}
   r={job_id:id,state:'synthetic_step_done',installed:false,installation_ready:false};index++;
  }else throw Error('Unexpected route '+op);
  return new Response(JSON.stringify(r),{headers:{'Content-Type':'application/json'}});
 }};
 runInNewContext(source,{deps,document:{getElementById:element,querySelector:()=>({content:'test-page'}),querySelectorAll:()=>[],createElement:()=>({}),documentElement:{}},
 window:{addEventListener:(n,f)=>events.set(n,f),isSecureContext:true},navigator:{usb:{}},localStorage:{getItem:()=>'en',setItem(){}},
 setTimeout,clearTimeout,AbortSignal,Response,crypto:globalThis.crypto,console},{filename:'actual-browser-wizard.mjs'});
 await new Promise(resolve=>setImmediate(resolve));element('saved-job').value=id;await element('saved-job').onchange();
 assert.equal(element('browser-wizard-controls').hidden,false);assert.equal(element('install-controls').hidden,true,'No native USB authority is inferred');
 for(const phase of phases.filter(p=>p!=='complete')){
  element('browser-wizard-ack').checked=true;
  if(phase==='full-activate'){
   const before=pickers;await element('browser-wizard-start').onclick();assert.equal(pickers,before);
   element('browser-wizard-screen').checked=true;
   const count=calls.length;element('language').value='ru';element('language').onchange();
   assert.equal(element('browser-wizard-screen').checked,true);assert.equal(element('browser-wizard-ack').checked,true);assert.equal(calls.length,count);
  }
  await element('browser-wizard-start').onclick();
  if(lost){
   const before=calls.filter(([op])=>op==='browser-wizard-stage').length;
   await element('browser-wizard-status').onclick(); // Even not_started is not a retry.
   element('browser-wizard-ack').checked=true;await element('browser-wizard-start').onclick();
   assert.equal(calls.filter(([op])=>op==='browser-wizard-stage').length,before);assert.equal(before,1);return;
  }
  assert.equal(element('browser-wizard-ack').checked,false);
 }
 assert.equal(index,8);assert.equal(element('browser-wizard-start').hidden,true);
 assert.equal(element('browser-wizard-result').textContent,strings.ru.browser_state_complete);
 assert.equal(calls.filter(([op])=>/^browser-wizard-(?!status)/.test(op)).length,8);
}
await fixture();await fixture(true);
console.log('Browser wizard: actual eight-step DOM, original picker, two human confirmations, language retention and no lost-response replay passed');
