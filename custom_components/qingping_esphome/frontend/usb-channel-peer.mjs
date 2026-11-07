/** Fixed API-only peer for the future authenticated Core/browser control loop.
 * No URL, file, shell, host, port, key, install or launch selector is accepted.
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
  #opening=false;#reading=false;#writing=false;#closing=false;#closed=false;
  constructor(link) {this.#link=link;}

  async dispatch(request) {
    if(this.#closed || !request || Object.keys(request).sort().join()!==['id','operation','data'].sort().join() ||
       typeof request.id!=='string' || !/^[a-f0-9]{32}$/.test(request.id) || this.#seen.has(request.id) || this.#seen.size>=2048) {
      await this.close();fail();
    }
    this.#seen.add(request.id);
    let data=null;
    try {
      if(request.operation==='api-open' && request.data===null) {
        if(this.#opening || this.#socket || this.#closing) fail();
        this.#opening=true;
        try {
          this.#socket=await this.#link.openApi();
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

  async close() {
    if(this.#closed) return;
    this.#closed=true;
    // Closing the owned link retires its transport and pending IO. Locks are
    // released after cancellation, never used to adopt an unrelated socket.
    try {await cleanup(()=>this.#link.close());}
    finally {
      if(this.#reader) {try {await cleanup(()=>this.#reader.cancel());this.#reader.releaseLock();}catch {}this.#reader=undefined;}
      if(this.#writer) {try {this.#writer.releaseLock();}catch {}this.#writer=undefined;}
      this.#socket=undefined;this.#buffer=new Uint8Array();
    }
  }
}
