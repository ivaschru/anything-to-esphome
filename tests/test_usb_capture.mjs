import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {spawnSync} from "node:child_process";
import {BrowserUsbProbe} from "../custom_components/qingping_esphome/frontend/usb-probe.mjs";
import {contract as real} from "../custom_components/qingping_esphome/frontend/usb-probe-contract.mjs";
import {captureArchive} from "../custom_components/qingping_esphome/frontend/usb-capture.mjs";

function fixture() {
  const contents=new Map(real.files.map((file,i)=>[file.path,new TextEncoder().encode(`synthetic-${i}`)]));
  const contract={...real,files:real.files.map(file=>{
    const data=contents.get(file.path), sha256=createHash("sha256").update(data).digest("hex");
    return {...file,size:data.length,sha256,expected:`${data.length} 1\n${sha256} ${file.path}`};
  })};
  const identity={uid:"0",wlan_mac:"02:00:00:00:00:01",arch:"armv7l",version:"CLEARGRASS_VERSION=4.1.8_0287",
    co2_type:"3",boot_id:"01234567-1234-4234-8234-123456789abc"};
  const replies=new Map(contract.identity.map(step=>[step.command,identity[step.name]]));
  for(const file of contract.files) replies.set(file.command,file.expected);
  replies.set(contract.absent_install,"");
  const state={picked:0,closed:0,disposed:0,pulled:[],corrupt:false,extra:false,change:false};
  const client={
    async createSocket(service) {
      const match=/^shell:set -e\n([\s\S]*)\nprintf '\\n(__CGS1_WEBUSB_OK_[a-f0-9]{32}__)\\n'\n$/.exec(service);
      assert.ok(match);assert.ok(replies.has(match[1]));
      return {readable:new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode(replies.get(match[1])+"\n"+match[2]+"\n"));controller.close();}}),async close(){}};
    },
    async sync(){return {
      read(path) {
        assert.ok(contents.has(path));state.pulled.push(path);
        const data=contents.get(path).slice();if(state.corrupt)data[0]^=1;
        if(state.change)replies.set("cat /proc/sys/kernel/random/boot_id","00000000-0000-4000-8000-000000000099");
        return new ReadableStream({start(controller){controller.enqueue(data);if(state.extra)controller.enqueue(new Uint8Array([0]));controller.close();}});
      },
      async dispose(){state.disposed++;},
    };},
    async close(){state.closed++;},
  };
  const library={manager:{requestDevice(){state.picked++;return Promise.resolve({serial:"fixture",async connect(){return {};}});}},
    authenticate:async()=>({}),createClient:()=>client,ephemeralCredentials:()=>({})};
  return {contract,contents,state,probe:new BrowserUsbProbe(library,contract)};
}
{
  const f=fixture(), progress=[];
  const pending=f.probe.capture((done,total)=>progress.push([done,total]));
  assert.equal(f.state.picked,1,"Capture also needs synchronous picker activation");
  assert.throws(()=>f.probe.capture(),{code:"usb_selection_consumed"});
  const result=await pending;
  assert.equal(result.installation_ready,false);assert.equal(result.archive.type,"application/x-tar");
  assert.equal(f.state.closed,1);assert.equal(f.state.disposed,1);
  assert.deepEqual(f.state.pulled,[...f.contents.keys()]);
  assert.deepEqual(progress,Array.from({length:10},(_,i)=>[i,9]));
  // Independent standard-library parser checks the real archive format and
  // private modes, rather than mirroring this implementation's header parser.
  const parsed=spawnSync("python3",["-c",`import io,json,sys,tarfile
with tarfile.open(fileobj=io.BytesIO(sys.stdin.buffer.read())) as archive:
 members=archive.getmembers()
 assert all(not x.issym() and not x.islnk() for x in members)
 assert all(x.mode==(0o700 if x.isdir() else 0o600) for x in members)
 report=json.load(archive.extractfile('qingping-cgs1-capture/result.json'))
 assert report['stage']=='read_only_browser_capture_complete'
 assert 'usb_transport' not in report
 assert report['device_writes']==0 and report['installed']==False
 files=[x for x in members if x.isfile()]
 assert len(files)==10
 print(json.dumps({'files':len(files),'ready':report['installation_ready']}))
`],{input:Buffer.from(await result.archive.arrayBuffer()),encoding:"utf8"});
  assert.equal(parsed.status,0,parsed.stderr);assert.deepEqual(JSON.parse(parsed.stdout),{files:10,ready:false});
}
for(const flag of ["corrupt","extra","change"]) {
  const f=fixture();f.state[flag]=true;
  await assert.rejects(f.probe.capture(),{code:flag==="change"?"usb_selection_changed":"usb_capture_unverified"});
  assert.equal(f.state.closed,1);assert.equal(f.state.disposed,1);
}
{
  const f=fixture();assert.throws(()=>captureArchive(f.contract,new Map(),{}));
  const bad={...f.contract,files:f.contract.files.map((file,i)=>i===0?{...file,path:"/../../escape"}:file)};
  const contents=new Map(f.contents);contents.set("/../../escape",contents.get(f.contract.files[0].path));contents.delete(f.contract.files[0].path);
  assert.throws(()=>captureArchive(bad,contents,{}));
}
console.log("USB capture: fixed RECV, copy hashes, fresh scope, private USTAR and no partial archive passed");
