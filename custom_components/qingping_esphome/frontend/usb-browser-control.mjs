import {BrowserChannelPeer} from './usb-channel-peer.mjs';

/** Start from the original USB-picker click. There is no writer in this loop.
 * The existing authenticated parent supplies rpc; no URL/token/key is accepted.
 * Two handlers allow a pending read and its write/close to make progress. Poll
 * and answers are each issued once; a lost response closes the selected link.
 */
export async function openBrowserControl(link,rpc) {
  let registration;
  const peer=new BrowserChannelPeer(link);
  try {
    const evidence=await link.select();
    registration=await rpc('browser/open',{evidence});
    if(!registration || Object.keys(registration).sort().join()!==['channel_id','state','writer_enabled'].sort().join() ||
       typeof registration.channel_id!=='string' || !/^[a-f0-9]{32}$/.test(registration.channel_id) ||
       registration.state!=='registered' || registration.writer_enabled!==false) throw Error();
  } catch {await peer.close().catch(()=>{});throw {code:'usb_channel_unverified'};}
  const identity=registration.channel_id,tasks=new Set();
  let closed=false,stopping=false,failed=false,retirementSent=false;
  async function retire() {
    closed=true;
    await peer.close().catch(()=>{failed=true;});
    if(!retirementSent) {
      retirementSent=true;
      try {const result=await rpc('browser/close',{channel_id:identity});if(result?.state!=='retired') failed=true;}
      catch {failed=true;}
    }
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
    } catch {failed=true;}
    finally {
      if(stopping && !failed) await Promise.allSettled(tasks);
      await retire();
      await Promise.allSettled(tasks);
    }
    return {state:failed?'unverified':'closed'};
  })();
  return Object.freeze({channel_id:identity,done,close:retire});
}
