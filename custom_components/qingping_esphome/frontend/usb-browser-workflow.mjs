/** Browser wizard metadata and single-issue actions, separate from native USB.
 * A status read never selects USB or repeats a request. Every initiating action
 * uses a fresh original-click channel; Core joins its own consumed journal.
 */
const fail=()=>{throw {code:'usb_browser_scope_unverified'};};
export const browserPhases=['stage','commit','trial','arm','pm','full-trial','full-activate','enroll','complete'];
const identity=(id,sha)=>/^[a-f0-9]{32}$/.test(id) && /^[a-f0-9]{64}$/.test(sha);
export function browserWizardStatus(value,id) {
 const keys=['job_id','phase','state','can_start','installed','installation_ready','replay_allowed'];
 if(value?.trial_proof_sha256!==undefined)keys.push('trial_proof_sha256');
 if(value?.entry_id!==undefined)keys.push('entry_id');
 if(!value || Object.keys(value).sort().join()!==keys.sort().join() || value.job_id!==id || !/^[a-f0-9]{32}$/.test(id) ||
    !browserPhases.includes(value.phase) || typeof value.state!=='string' || !/^[a-z_]{1,80}$/.test(value.state) ||
    typeof value.can_start!=='boolean' || ['installed','installation_ready','replay_allowed'].some(k=>value[k]!==false) ||
    value.can_start!==(value.state==='not_started') ||
    value.trial_proof_sha256!==undefined && (value.phase!=='full-activate' || !value.can_start || !/^[a-f0-9]{64}$/.test(value.trial_proof_sha256)) ||
    value.phase==='full-activate' && value.can_start && value.trial_proof_sha256===undefined ||
    value.entry_id!==undefined && value.entry_id!==null && !/^[A-Za-z0-9_-]{1,64}$/.test(value.entry_id) ||
    value.phase==='complete' && (!['created','already_configured'].includes(value.state) || !value.entry_id || value.can_start))fail();
 return value;
}
export async function readBrowserWizard(rpc,id,sha) {
 if(!identity(id,sha))fail();
 return browserWizardStatus(await rpc('browser-wizard-status',{job_id:id,expected_plan_sha256:sha}),id);
}
export async function startBrowserWizard(rpc,id,sha,channel,phase,{reviewed=false,screenReviewed=false,trialProof}={}) {
 if(!identity(id,sha) || !/^[a-f0-9]{32}$/.test(channel) ||
    ![...browserPhases.filter(p=>p!=='complete'),'observe','full-review'].includes(phase))fail();
 const data={job_id:id,expected_plan_sha256:sha,channel_id:channel};
 if(!['observe','full-review'].includes(phase)) {
  if(reviewed!==true)fail();
  if(phase==='enroll')data.reviewed=true;else data.experimental_reviewed=true;
 }
 if(phase==='full-activate') {
  if(screenReviewed!==true || !/^[a-f0-9]{64}$/.test(trialProof))fail();
  data.screen_reviewed=true;data.expected_trial_proof_sha256=trialProof;
 }
 // Exactly one initiating POST. Reconciliation is a separate explicit read;
 // neither a lost response nor even a not_started status retries this call.
 const r=await rpc('browser-wizard-'+phase,data);
 if(!r || r.job_id!==id || typeof r.state!=='string' || (phase==='enroll' ? r.installed!==undefined && r.installed!==false : r.installed!==false) || r.installation_ready!==false)fail();
 return r;
}
