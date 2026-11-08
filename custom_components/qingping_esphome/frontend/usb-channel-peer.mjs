/** Finite read/API/disabled-stage/first-trial RAM peer for the private Core control loop.
 * No URL, caller file path, shell, host, port, key or launch selector is accepted.
 * Requests are consumed before IO. HTTP delivery/reply failures must close
 * this peer, not repeat dispatch; its caller owns that authenticated framing.
 */
const maximum=65536,packetMaximum=1024*1024;
const fail=()=>{throw {code:'usb_channel_unverified'};};
async function cleanup(operation) {
  let timer;
  try {return await Promise.race([Promise.resolve().then(operation),new Promise((_,reject)=>{
    timer=setTimeout(()=>reject({code:'usb_close_unverified'}),2000);
  })]);} finally {clearTimeout(timer);}
}
function bytes(value) {
  if(typeof value!=='string' || value.length>4*Math.ceil(maximum/3)) fail();
  let raw;
  try {raw=Uint8Array.from(atob(value),c=>c.charCodeAt(0));}catch {fail();}
  if(raw.length>maximum || btoa(String.fromCharCode(...raw))!==value) fail();
  return raw;
}
function base64(value) {return btoa(String.fromCharCode(...value));}

export class BrowserChannelPeer {
  #link;#seen=new Set();#socket;#reader;#writer;#buffer=new Uint8Array();
  #staging=false;#committing=false;#ramming=false;#cleanupPromise;#checking=false;#opening=false;#reading=false;#writing=false;#closing=false;#closed=false;
  #ramComplete=false;#guardianUsed=false;#guardianReady=false;#guardianFinished=false;
  #scopeChecking=false;
  constructor(link) {this.#link=link;}

  async dispatch(request) {
    if(this.#closed || !request || Object.keys(request).sort().join()!==['id','operation','data'].sort().join() ||
       typeof request.id!=='string' || !/^[a-f0-9]{32}$/.test(request.id) || this.#seen.has(request.id) || this.#seen.size>=2048) {
      await this.close();fail();
    }
    this.#seen.add(request.id);
    let data=null;
    try {
      const guardianApi=this.#guardianUsed && this.#guardianReady && !this.#guardianFinished;
      const apiOperation=['api-open','api-read','api-write','api-close'].includes(request.operation);
      // One pending opaque read may continue beside the fixed scope reader.
      // Writes/close are serialized in Core; another phase cannot borrow this
      // exception. The original two-handler budget is unchanged.
      if(this.#checking && request.operation!=='channel-close' &&
         !(this.#scopeChecking && guardianApi && this.#socket && request.operation==='api-read')) fail();
      if(this.#staging && !['stage-file-begin','stage-chunk','stage-file-finish','stage-complete','channel-close'].includes(request.operation)) fail();
      if(this.#ramming && !['ram-chunk','ram-complete','guardian-start','guardian-finish','guardian-process-observe','guardian-scope-observe','guardian-return-observe','channel-close'].includes(request.operation) && !(guardianApi && apiOperation)) fail();
      if(this.#guardianUsed && !['guardian-finish','guardian-process-observe','guardian-scope-observe','guardian-return-observe','channel-close'].includes(request.operation) && !(guardianApi && apiOperation))fail();
      if(this.#committing && !['commit-step','commit-complete','channel-close'].includes(request.operation)) fail();
      if(['scope-check','stage-admission'].includes(request.operation) && request.data===null) {
        if(this.#opening || this.#socket || this.#closing) fail();
        this.#checking=true;
        try {data=await (request.operation==='scope-check' ? this.#link.checkInitialScope() : this.#link.checkStageScope());}finally {this.#checking=false;}
      } else if(request.operation==='disabled-scope') {
        if(this.#opening || this.#socket || this.#closing || !request.data || Object.keys(request.data).join()!=='meta') fail();
        this.#checking=true;
        try {data=await this.#link.checkDisabledScope(request.data.meta);}finally {this.#checking=false;}
      } else if(request.operation==='initial-trial-preparation') {
        if(this.#opening || this.#socket || this.#closing || !request.data || Object.keys(request.data).join()!=='meta') fail();
        this.#checking=true;
        try {data=await this.#link.checkInitialTrialPreparation(request.data.meta);}finally {this.#checking=false;}
      } else if(request.operation==='ram-stream-check') {
        if(request.data!==null || this.#opening || this.#socket || this.#closing) fail();
        this.#checking=true;
        try {data=await this.#link.probeInitialRamStream();}finally {this.#checking=false;}
      } else if(request.operation==='ram-prepare') {
        if(this.#opening || this.#socket || this.#closing || !request.data || Object.keys(request.data).join()!=='packet') fail();
        this.#ramming=true;this.#checking=true;
        try {data=await this.#link.beginInitialRam(request.data.packet);}finally {this.#checking=false;}
      } else if(request.operation==='ram-chunk' || request.operation==='ram-complete') {
        if(!this.#ramming || this.#opening || this.#socket || this.#closing) fail();
        this.#checking=true;
        try {
          if(request.operation==='ram-complete') {if(request.data!==null || this.#ramComplete)fail();data=await this.#link.finishInitialRam();this.#ramComplete=true;}
          else {
            if(!request.data || Object.keys(request.data).sort().join()!==['offset','body'].sort().join() ||
               !Number.isInteger(request.data.offset) || request.data.offset<0)fail();
            const chunk=bytes(request.data.body);if(!chunk.length)fail();
            data=await this.#link.initialRamAppend(request.data.offset,chunk);
          }
        }finally {this.#checking=false;}
      } else if(['guardian-start','guardian-finish','guardian-process-observe','guardian-scope-observe','guardian-return-observe'].includes(request.operation)) {
        const concurrentScope=request.operation==='guardian-scope-observe' && guardianApi && !this.#writing;
        if(request.data!==null || !this.#ramComplete || this.#opening || this.#closing ||
           this.#socket && !concurrentScope || request.operation==='guardian-scope-observe' && this.#writing)fail();
        this.#checking=true;
        this.#scopeChecking=request.operation==='guardian-scope-observe';
        try {
          if(request.operation==='guardian-start') {
            if(this.#guardianUsed)fail();this.#guardianUsed=true;
            data=await this.#link.startInitialGuardian();this.#guardianReady=true;
          } else if(request.operation==='guardian-finish') {
            if(!this.#guardianReady || this.#guardianFinished)fail();this.#guardianFinished=true;
            data=await this.#link.finishInitialGuardian();
          } else if(request.operation==='guardian-return-observe') {
            if(!this.#guardianReady || !this.#guardianFinished)fail();
            data=await this.#link.observeInitialGuardianReturn();
          } else {
            if(!this.#guardianReady || this.#guardianFinished)fail();
            data=await (request.operation==='guardian-scope-observe'?this.#link.observeInitialGuardianScope():this.#link.observeInitialGuardianProcesses());
          }
        }finally {this.#checking=false;this.#scopeChecking=false;}
      } else if(request.operation==='commit-stream-check') {
        if(request.data!==null || this.#opening || this.#socket || this.#closing) fail();
        this.#checking=true;
        try {data=await this.#link.probeCommitStream();}finally {this.#checking=false;}
      } else if(request.operation==='commit-prepare') {
        if(this.#opening || this.#socket || this.#closing || !request.data || Object.keys(request.data).join()!=='packet') fail();
        this.#committing=true;this.#checking=true;
        try {data=await this.#link.beginCommit(request.data.packet);}finally {this.#checking=false;}
      } else if(request.operation==='commit-step' || request.operation==='commit-complete') {
        if(!this.#committing || this.#opening || this.#socket || this.#closing) fail();
        this.#checking=true;
        try {
          if(request.operation==='commit-step') {
            if(!request.data || Object.keys(request.data).join()!=='phase' || !['claim','watchdog','start'].includes(request.data.phase)) fail();
            data=await this.#link.commitStep(request.data.phase);
          } else {if(request.data!==null) fail();data=await this.#link.finishCommit();}
        }finally {this.#checking=false;}
      } else if(request.operation==='stage-prepare') {
        if(this.#opening || this.#socket || this.#closing || !request.data ||
           Object.keys(request.data).sort().join()!==['packet','stock_files'].sort().join()) fail();
        this.#staging=true;this.#checking=true; // Before the first root-write ACK.
        try {data=await this.#link.beginStage(request.data.packet,request.data.stock_files);}finally {this.#checking=false;}
      } else if(['stage-file-begin','stage-chunk','stage-file-finish','stage-complete'].includes(request.operation)) {
        if(!this.#staging || this.#opening || this.#socket || this.#closing) fail();
        this.#checking=true;
        try {
          if(request.operation==='stage-complete') {
            if(request.data!==null) fail();
            data=await this.#link.finishStage();
          } else {
            const keys=request.operation==='stage-chunk'?['role','offset','body']:['role'];
            if(!request.data || Object.keys(request.data).sort().join()!==keys.sort().join() || typeof request.data.role!=='string') fail();
            if(request.operation==='stage-chunk') {
              const chunk=bytes(request.data.body);
              if(!chunk.length || !Number.isInteger(request.data.offset) || request.data.offset<0) fail();
              data=await this.#link.stageAppend(request.data.role,request.data.offset,chunk);
            } else data=await this.#link[request.operation==='stage-file-begin'?'stageBeginFile':'stageFinishFile'](request.data.role);
          }
        } finally {this.#checking=false;}
      } else if(request.operation==='api-open' && request.data===null) {
        if(this.#opening || this.#socket || this.#closing) fail();
        this.#opening=true;
        try {
          this.#socket=await (guardianApi?this.#link.openInitialGuardianApi():this.#link.openApi());
          this.#reader=this.#socket.readable.getReader();
          this.#writer=this.#socket.writable.getWriter();
        } finally {this.#opening=false;}
      } else if(request.operation==='api-read') {
        if(!this.#reader || this.#reading || this.#closing || !request.data ||
           Object.keys(request.data).join()!=='max_bytes' || !Number.isInteger(request.data.max_bytes) ||
           request.data.max_bytes<1 || request.data.max_bytes>maximum) fail();
        this.#reading=true;
        try {
          if(!this.#buffer.length) {
            const {value,done}=await this.#reader.read();
            if(!done) {
              if(!(value instanceof Uint8Array) || !value.length || value.length>packetMaximum) fail();
              this.#buffer=value;
            }
          }
          const count=Math.min(request.data.max_bytes,this.#buffer.length);
          data=base64(this.#buffer.slice(0,count));this.#buffer=this.#buffer.slice(count);
        } finally {this.#reading=false;}
      } else if(request.operation==='api-write') {
        if(!this.#writer || this.#writing || this.#closing) fail();
        const value=bytes(request.data);if(!value.length) fail();
        this.#writing=true;
        try {await this.#writer.write(value);}finally {this.#writing=false;}
      } else if(request.operation==='api-close' && request.data===null) {
        if(!this.#socket || this.#opening || this.#writing || this.#closing) fail();
        this.#closing=true;
        try {
          // Retire a pending pure read to EOF before acknowledging close. Its
          // late answer retains its original ID and cannot satisfy a new read.
          await cleanup(()=>this.#reader.cancel());this.#reader.releaseLock();this.#reader=undefined;
          this.#writer.releaseLock();this.#writer=undefined;
          await this.#link.closeApi();this.#socket=undefined;this.#buffer=new Uint8Array();
        } finally {this.#closing=false;}
      } else if(request.operation==='channel-close' && request.data===null) {
        await this.close();
      } else fail();
      return {id:request.id,ok:true,data};
    } catch {
      await this.close().catch(()=>{});
      return {id:request.id,ok:false,data:null};
    }
  }

  close() {
    if(this.#cleanupPromise)return this.#cleanupPromise;
    this.#closed=true;
    // All close callers await the same owned transport ACK. Cleared fields
    // must not turn an in-flight or failed close into a later positive result.
    this.#cleanupPromise=(async()=>{
      try {await cleanup(()=>this.#link.close());}
      finally {
        if(this.#reader) {try {await cleanup(()=>this.#reader.cancel());this.#reader.releaseLock();}catch {}this.#reader=undefined;}
        if(this.#writer) {try {this.#writer.releaseLock();}catch {}this.#writer=undefined;}
        this.#socket=undefined;this.#buffer=new Uint8Array();
      }
    })();
    return this.#cleanupPromise;
  }
}
