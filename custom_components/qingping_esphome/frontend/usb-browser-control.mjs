import {BrowserChannelPeer} from './usb-channel-peer.mjs';

/** Start from the original USB-picker click. This loop cannot initiate writes.
 * The existing authenticated parent supplies rpc; no URL/token/key is accepted.
 * Two handlers allow a pending read and its write/close to make progress. Poll
 * and answers are each issued once; a lost response closes the selected link.
 */
export function openBrowserControl(link,rpc) {return openControl(link,rpc,'standard');}

/** Separate original-click selector for later private staged reads. A review
 * opening claims identity only; the requested collector still checks all files.
 */
export function openBrowserReviewControl(link,rpc) {return openControl(link,rpc,'review');}

/** New Full UI selection, fixed resources before the original picker click.
 * This resource class grants no upload/launch permission. Private Core must
 * still rehash the exact post-PM job and consume each separate writer intent.
 */
export function openBrowserFullUiControl(link,rpc) {return openControl(link,rpc,'full-ui');}

async function openControl(link,rpc,purpose) {
  let registration;
  const peer=new BrowserChannelPeer(link,{purpose:purpose==='full-ui'?'full-ui':'standard'});
  try {
    const evidence=await (purpose==='full-ui'?link.selectForFullUiReview():purpose==='review'?link.selectForReview():link.select());
    registration=await rpc('browser/open',purpose==='full-ui'?{evidence,purpose:'full-ui'}:{evidence});
    if(!registration || Object.keys(registration).sort().join()!==['channel_id','state','writer_enabled'].sort().join() ||
       typeof registration.channel_id!=='string' || !/^[a-f0-9]{32}$/.test(registration.channel_id) ||
       registration.state!=='registered' || registration.writer_enabled!==false) throw Error();
  } catch {await peer.close().catch(()=>{});throw {code:'usb_channel_unverified'};}
  const identity=registration.channel_id,tasks=new Set();
  let closed=false,stopping=false,failed=false,retiring;
  function retire() {
    if(retiring) return retiring;
    closed=true;
    // All callers await the same cleanup/ACK. A second close must not report
    // success while the first registry retirement is still uncertain.
    retiring=(async()=>{
      await peer.close().catch(()=>{failed=true;});
      try {const result=await rpc('browser/close',{channel_id:identity});if(result?.state!=='retired') failed=true;}
      catch {failed=true;}
      return {state:failed?'unverified':'closed'};
    })();
    return retiring;
  }
  async function answer(request) {
    try {
      const frame=await peer.dispatch(request);
      if(closed) return;
      const result=await rpc('browser/answer',{channel_id:identity,frame});
      if(result?.state!=='accepted' || frame.ok!==true) throw Error();
      if(request.operation==='channel-close') closed=true;
    } catch {failed=true;await retire();}
  }
  const done=(async()=>{
    try {
      while(!closed && !stopping) {
        if(tasks.size>=2) {await Promise.race(tasks);continue;}
        const value=await rpc('browser/poll',{channel_id:identity});
        if(closed) break;
        if(!value || Object.keys(value).join()!=='request') throw Error();
        if(value.request!==null) {
          if(value.request.operation==='channel-close') stopping=true;
          const task=answer(value.request);tasks.add(task);task.finally(()=>tasks.delete(task));
        }
      }
    } catch {if(!closed) failed=true;}
    finally {
      if(stopping && !failed) await Promise.allSettled(tasks);
      await retire();
      await Promise.allSettled(tasks);
    }
    return {state:failed?'unverified':'closed'};
  })();
  return Object.freeze({channel_id:identity,done,close:retire});
}
