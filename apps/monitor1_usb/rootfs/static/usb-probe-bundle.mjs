// Tango ADB browser probe. Rebuild: tools/monitor1-usb/build.mjs; MIT notices: usb-probe-NOTICES.txt
var Xr=Object.defineProperty;var Zr=(t,e)=>{for(var s in e)Xr(t,s,{get:e[s],enumerable:!0})};var Ut=()=>{throw{code:"usb_browser_scope_unverified"}},Fe=(t,e)=>t&&typeof t=="object"&&!Array.isArray(t)&&Object.keys(t).sort().join()===e.slice().sort().join(),pt=(t,e)=>typeof t=="string"&&new RegExp("^[a-f0-9]{"+e+"}$").test(t),ps=t=>typeof t=="string"&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(t),Ii=t=>typeof t=="string"&&/^[a-f0-9]{2}(?::[a-f0-9]{2}){5}$/.test(t)&&t!=="00:00:00:00:00:00"&&!(parseInt(t.slice(0,2),16)&1),qi=["browser_full_ui_context.py","full_ui_review.py","full_ui_trial.py","full_ui_activation.py"];function Oi(t){return Fe(t,["size","sha256"])&&Number.isInteger(t.size)&&t.size>0&&t.size<=16*1024**2&&pt(t.sha256,64)}function Ia(t){(!Fe(t,["schema_version","kind","job_id","plan_sha256","source_commit","pm_intent_sha256","pm_proof_sha256","target","pm_armed_boot","api_identity","bridge","native_pair","producer_sha256","context_only","writer_enabled","device_writes"])||t.schema_version!==1||t.kind!=="browser_full_ui_context"||!pt(t.job_id,32)||!pt(t.plan_sha256,64)||t.source_commit!=="53d97b9609e8e0fcdfc5d003101f620098dbc734"||!pt(t.pm_intent_sha256,64)||!pt(t.pm_proof_sha256,64)||!ps(t.pm_armed_boot)||t.context_only!==!0||t.writer_enabled!==!1||t.device_writes!==0||!Fe(t.producer_sha256,qi)||!qi.every(s=>pt(t.producer_sha256[s],64))||!Oi(t.bridge)||!Fe(t.native_pair,["native-program","guardian-program"])||!Object.values(t.native_pair).every(Oi)||!Fe(t.api_identity,["node_name","api_mac"])||typeof t.api_identity.node_name!="string"||!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(t.api_identity.node_name)||!Ii(t.api_identity.api_mac))&&Ut();let e=t.target;return(!Fe(e,["kind","usb_serial","wlan_mac","boot_id","co2_type","stock_version"])||e.kind!=="browser_webusb"||typeof e.usb_serial!="string"||!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(e.usb_serial)||!Ii(e.wlan_mac)||!ps(e.boot_id)||e.boot_id===t.pm_armed_boot||![2,3].includes(e.co2_type)||e.stock_version!=="4.1.8_0287")&&Ut(),t}async function Ni(t,e,s){let a=Ia(e),i=a.target,n=s;(!Fe(n,["kind","channel","serial","wlan_mac","boot_id","co2_type","stock_version","native_get_devpath"])||n.kind!=="browser_webusb"||n.boot_id===i.boot_id||n.native_get_devpath!==!1||!ps(n.channel)||!ps(n.boot_id)||n.serial!==i.usb_serial||n.wlan_mac!==i.wlan_mac||n.co2_type!==i.co2_type||n.stock_version!==i.stock_version)&&Ut(),await t.identity()!==!0&&Ut();let r="/data/.esphome-cgs1/program",o="test ! -L "+r+`
test -f `+r+`
stat -c '%s %h' `+r+`
sha256sum `+r;for(let d=0;d<2;d++){let c=await t.read(o),l=typeof c=="string"?c.split(`
`):[];(l.length!==2||l[0]!==a.bridge.size+" 1"||![a.bridge.sha256+"  "+r,a.bridge.sha256+" "+r].includes(l[1])||await t.identity()!==!0)&&Ut()}return{kind:n.boot_id===a.pm_armed_boot?"browser_full_ui_waiting_for_pm_boot":"browser_full_ui_scope",job_id:a.job_id,plan_sha256:a.plan_sha256,pm_intent_sha256:a.pm_intent_sha256,pm_proof_sha256:a.pm_proof_sha256,target:{kind:"browser_webusb",usb_serial:n.serial,wlan_mac:n.wlan_mac,boot_id:n.boot_id,co2_type:n.co2_type,stock_version:n.stock_version},bridge_checked:!0,context_only:!0,device_writes:0}}var K=()=>{throw{code:"usb_browser_scope_unverified"}},Pi="exec:/bin/sh",Ti="CGS1_FIXED_STDIN_READY",Yr=new TextEncoder;function oe(t,e=32768){[32768,65536].includes(e)||K(),(!t||Object.keys(t).sort().join()!==["size","sha256","marker"].sort().join()||!Number.isInteger(t.size)||t.size<1||t.size>e||typeof t.sha256!="string"||!/^[a-f0-9]{64}$/.test(t.sha256)||typeof t.marker!="string"||!/^__CGS1_FIXED_OK_[a-f0-9]{32}__$/.test(t.marker))&&K();let a="'"+`set -eu
umask 077
CGS1_FIXED_BODY=$(dd bs=1 count=${t.size} 2>/dev/null)
[ "\${#CGS1_FIXED_BODY}" -eq ${t.size} ]
CGS1_FIXED_SHA=$(printf '%s' "$CGS1_FIXED_BODY" | sha256sum)
[ "\${CGS1_FIXED_SHA%% *}" = '${t.sha256}' ]
/bin/sh -c "$CGS1_FIXED_BODY"
printf '\\n${t.marker}\\n'
`.replaceAll("'","'\\''")+"'";return Pi+" -c "+a}var ge=class{#e;#t;#s;#i=new Set;#n=!1;#a=!1;#h=!1;#r=!1;#c;#u;constructor(e,s,a=32768){[32768,65536].includes(a)||K(),(!e||Object.keys(e).sort().join()!==["open","live","closeTransport"].sort().join()||Object.values(e).some(i=>typeof i!="function")||typeof s!="function")&&K(),this.#e=Object.freeze({...e}),this.#c=s,this.#u=a}#l(){(this.#n||this.#e.live()!==!0)&&K()}async#b(e,s){this.#l();let a=s-Date.now();a<=0&&K();let i,n;try{let r=await Promise.race([Promise.resolve().then(e),new Promise((o,d)=>{n=d,this.#i.add(d),i=setTimeout(()=>{this.close().catch(()=>{}),d({code:"usb_browser_scope_unverified"})},a)})]);return this.#l(),r}finally{clearTimeout(i),this.#i.delete(n)}}async#p(e){if(e)return e.cleanup||(e.cleanup=(async()=>{let s=!1,a=async i=>{let n;try{await Promise.race([Promise.resolve().then(i),new Promise((r,o)=>{n=setTimeout(()=>o({}),2e3)})])}finally{clearTimeout(n)}};try{await a(()=>e.socket.close())}catch{s=!0}if(e.reader){try{await a(()=>e.reader.cancel()),e.reader.releaseLock()}catch{s=!0}e.reader=void 0}if(e.writer){try{e.writer.releaseLock()}catch{s=!0}e.writer=void 0}s&&K()})()),e.cleanup}async#m(e,s,a){this.#l(),(typeof e!="string"||!e.length||e.length>this.#u||e.endsWith(`
`)||/[^\x01-\x7f]/.test(e))&&K();let i=Date.now()+a,n="__CGS1_FIXED_OK_"+crypto.randomUUID().replaceAll("-","")+"__",r=Yr.encode(e),o;try{let d=Array.from(new Uint8Array(await this.#b(()=>crypto.subtle.digest("SHA-256",r),i)),v=>v.toString(16).padStart(2,"0")).join(""),c=Object.freeze({size:r.length,sha256:d,marker:n}),l=oe(c,this.#u),_=await this.#b(async()=>{let v=await this.#e.open(c);try{this.#l()}catch{await this.#p({socket:v}).catch(()=>{}),K()}return v},Math.min(i,Date.now()+5e3));o={socket:_},this.#t=o,(!_||![l,l+"\0"].includes(_.service)||typeof _.closed?.then!="function"||typeof _.readable?.getReader!="function"||typeof _.writable?.getWriter!="function")&&K(),o.reader=_.readable.getReader(),o.writer=_.writable.getWriter();let b=o.reader,p=o.writer,u=new Uint8Array,f=async()=>{for(;;){let{value:v,done:m}=await this.#b(()=>b.read(),i);if(m)break;(!(v instanceof Uint8Array)||u.length+v.length>4096||v.some(k=>k===0||k>127))&&K();let w=new Uint8Array(u.length+v.length);w.set(u),w.set(v,u.length),u=w}},g=async()=>{for(let v=0;v<r.length;v+=4096)this.#l(),await this.#b(()=>p.write(r.slice(v,v+4096)),i)};await Promise.all([f(),g()]),await this.#b(()=>_.closed,i),new TextDecoder().decode(u)!==s+`
`+n+`
`&&K(),await this.#p(o),this.#t===o&&(this.#t=void 0),this.#l()}catch{await this.close().catch(()=>{}),K()}finally{o&&await this.#p(o).catch(()=>{})}}ready(){return this.#l(),this.#r&&!this.#a}async probe(){(this.#a||this.#h||this.#n)&&(await this.close().catch(()=>{}),K()),this.#h=!0,this.#a=!0;try{let e=`set -eu
umask 077
printf '%s\\n' '`+Ti+"'";if(this.#u===65536){let s="",a=this.#u-e.length;for(;a>0;){let i=Math.min(120,a);s+=i===1?`
`:"#"+"x".repeat(i-2)+`
`,a-=i}e=s+e}return await this.#m(e,Ti+`
`,this.#u===65536?15e3:5e3),this.#l(),this.#r=!0,{kind:"browser_fixed_stdin_probe",service:Pi,ready:!0,device_files_changed:!1,writer_enabled:!1}}finally{this.#a=!1}}async execute(e){(this.#a||!this.#r||this.#n)&&(await this.close().catch(()=>{}),K()),this.#a=!0;try{let s=await this.#b(()=>this.#c(e),Date.now()+5e3);return await this.#m(s,"",3e4),this.#l(),{completed:!0}}catch{await this.close().catch(()=>{}),K()}finally{this.#a=!1}}close(){if(this.#s)return this.#s;this.#n=!0,this.#r=!1;for(let e of this.#i)e({code:"usb_browser_scope_unverified"});return this.#s=(async()=>{let e=!1;try{await this.#p(this.#t)}catch{e=!0}let s;try{await Promise.race([Promise.resolve().then(()=>this.#e.closeTransport()),new Promise((a,i)=>{s=setTimeout(()=>i({}),2e3)})])}catch{e=!0}finally{clearTimeout(s)}e&&K()})(),this.#s}};var zt={schema_version:1,maximum_body_bytes:65536,source_commit:"53d97b9609e8e0fcdfc5d003101f620098dbc734",native_source_sha256:{"arm_bridge_next_boot_adb.py":"ab3dee1e5761f160e4c0905e1253d0fe29b06064a8b8b65a91177b33ecc934a1","bootstrap_patches.py":"12bc6fb3fadfe6c0101130914c3dafe7db243669b8a000e83806ff0afd66f959","commit_disabled_install.py":"b78470c8fe3f6275d2eca07067ec56beb858f11d8037b435be08f9f6781b4408","disabled_commit_policy.py":"ad8b50cd9c112f37b40bb1f3a77ba2ca598bf307deb1817ea1fdda4c492f2ab7","preflight_adb.py":"128cf367baeee28bcfb4156256548fdded689a42d50662e77580fdd71ab19b47","review_disabled_install.py":"174d4e23e1aaf4c386ab7afcf280a7b99b169ca877130ad1f556295a28850d1a","review_initial_trial.py":"d9f2f022edbbe190d8c8b0ccbb87071f9c6dfcb53320f8e53232264ac71cc0b4","stage_install_adb.py":"7546caa212b3b44b1a3d8717e550b7bfd5f0893a342c80c6e847cfd2be56b8eb","trial_initial_bridge_adb.py":"4f29bb503dd2d792a42aa2a642505edd2ccf84a3eb35ae7a8964b39006aaf032","verify_bridge_boot_adb.py":"2c7029ed1781289f406051138f538461c441fab498becd39d3b3ea468cdb6114"},guard_sha256:"61dd3056c0325cecf6202501a0fc63a8c5222f29089681cb8cd9f42ba5939b79",templates:{arm:[`umask 077
test ! -L /data
test ! -L /data/.esphome-cgs1
test -d /data/.esphome-cgs1
observed_value=$(stat -c '%d %i %a %u' /data/.esphome-cgs1)
[ "$observed_value" = '`,{field:"root_device"}," ",{field:"root_inode"},` 700 0' ]
observed_value=$(stat -f -c '%t' /data/.esphome-cgs1)
[ "$observed_value" = ef53 ]
test ! -L /data/.esphome-cgs1/install.intent
test -f /data/.esphome-cgs1/install.intent
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/install.intent)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/install.intent | awk '{print $1}')
[ "$observed_value" = `,{field:"install_marker_sha256"},` ]
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/install.intent)
[ "$observed_value" = '98 600 0 1' ]
# CGS1_BRIDGE_COMPLETION arm
test ! -L /data/.esphome-cgs1/bridge-next-boot.complete
test -f /data/.esphome-cgs1/bridge-next-boot.complete
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/bridge-next-boot.complete)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/bridge-next-boot.complete | awk '{print $1}')
[ "$observed_value" = `,{field:"arm_completion_sha256"},` ]
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/bridge-next-boot.complete)
[ "$observed_value" = '135 600 0 1' ]
observed_value=$(cat /data/.esphome-cgs1/bridge-next-boot.complete)
[ "$observed_value" = 'arm `,{field:"nonce"}," ",{field:"plan_id"}," ",{field:"plan_sha256"},`' ]
entries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
 case "$entry" in (disabled) exit 1;; esac
done
observed_value=$(cat /sys/class/net/wlan0/address)
[ "$observed_value" = `,{field:"wlan_mac"},` ]
observed_value=$(cat /data/etc/os-release)
[ "$observed_value" = CLEARGRASS_VERSION=4.1.8_0287 ]
observed_value=$(cat /proc/sys/kernel/random/boot_id)
[ "$observed_value" = `,{field:"boot_id"},` ]
observed_value=$(awk '
BEGIN { section=0; count=0 }
/^[ \\t]*\\[/ { section=($0 ~ /^[ \\t]*\\[sensors\\][ \\t]*\\r?$/) }
section && /^[ \\t]*co2_type[ \\t]*=/ {
    value=$0; sub(/^[^=]*=[ \\t]*/, "", value); sub(/[ \\t\\r]*$/, "", value)
    print value; count++
}
END { if (count != 1) exit 1 }
' /data/etc/setting.ini)
`,'[ "$observed_value" = ',{field:"co2_type"}," ]",`
test ! -L /data/.esphome-cgs1/program
test -f /data/.esphome-cgs1/program
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/program)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/program | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_sha_0"},` ]
test ! -L /data/.esphome-cgs1/pm_qt_bridge.so
test -f /data/.esphome-cgs1/pm_qt_bridge.so
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/pm_qt_bridge.so)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/pm_qt_bridge.so | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_sha_1"},` ]
test ! -L /data/.esphome-cgs1/launch.sh
test -f /data/.esphome-cgs1/launch.sh
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/launch.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/launch.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_sha_2"},` ]
test ! -L /data/.esphome-cgs1/SnowApp-with-PM
test -f /data/.esphome-cgs1/SnowApp-with-PM
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/SnowApp-with-PM)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/SnowApp-with-PM | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_sha_3"},` ]
test ! -L /data/.esphome-cgs1/startup-hook.sh
test -f /data/.esphome-cgs1/startup-hook.sh
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/startup-hook.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/startup-hook.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_sha_4"},` ]
test ! -L /data/.esphome-cgs1/stock-start.sh.original
test -f /data/.esphome-cgs1/stock-start.sh.original
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/stock-start.sh.original)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/stock-start.sh.original | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_sha_5"},` ]
test ! -L /data/.esphome-cgs1/stock-watchdog.sh.original
test -f /data/.esphome-cgs1/stock-watchdog.sh.original
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/stock-watchdog.sh.original)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/stock-watchdog.sh.original | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_sha_6"},` ]
test ! -L /data/.esphome-cgs1/start.sh.candidate
test -f /data/.esphome-cgs1/start.sh.candidate
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/start.sh.candidate)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/start.sh.candidate | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_sha_7"},` ]
test ! -L /data/.esphome-cgs1/watchdog.sh.candidate
test -f /data/.esphome-cgs1/watchdog.sh.candidate
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/watchdog.sh.candidate)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/watchdog.sh.candidate | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_sha_8"},` ]
test ! -L /data/bin/SnowApp
test -f /data/bin/SnowApp
observed_value=$(stat -c '%h %u' /data/bin/SnowApp)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/bin/SnowApp | awk '{print $1}')
[ "$observed_value" = a39016531620a874668ee322f0e976f48e47943742c54c8a7291b9e830c91abb ]
test ! -L /data/bin/watchdog.sh
test -f /data/bin/watchdog.sh
observed_value=$(stat -c '%h %u' /data/bin/watchdog.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/bin/watchdog.sh | awk '{print $1}')
[ "$observed_value" = 1d74ef0946734e1ddf9e76301012f9ed66d7b38d9d7a0239a5d0e80acabf2cce ]
test ! -L /data/etc/init.d/start.sh
test -f /data/etc/init.d/start.sh
observed_value=$(stat -c '%h %u' /data/etc/init.d/start.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/etc/init.d/start.sh | awk '{print $1}')
[ "$observed_value" = f104f873dd3ce4544d5f3e3f90a4056bffc811bcaae037e347306e1084e7f1d1 ]
test ! -L /etc/init.d/S12_launcher_init
test -f /etc/init.d/S12_launcher_init
observed_value=$(stat -c '%h %u' /etc/init.d/S12_launcher_init)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /etc/init.d/S12_launcher_init | awk '{print $1}')
[ "$observed_value" = 533cac6f65b3ccf8d3404216c688877ad03a8b03af64edaade9bd6dc3aad1c35 ]
test ! -L /etc/init.d/S50_px3se_init
test -f /etc/init.d/S50_px3se_init
observed_value=$(stat -c '%h %u' /etc/init.d/S50_px3se_init)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /etc/init.d/S50_px3se_init | awk '{print $1}')
[ "$observed_value" = d818606f68bc1428ef96c5257df751a843cc9a6770dc25a2487a940c6bcb2492 ]
test ! -L /lib/ld-2.23.so
test -f /lib/ld-2.23.so
observed_value=$(stat -c '%h %u' /lib/ld-2.23.so)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /lib/ld-2.23.so | awk '{print $1}')
[ "$observed_value" = 6da48efda9ff440998747a66131e8ebdc6a57a15bb19dcfd7895a031368dd50a ]
test ! -L /lib/libc-2.23.so
test -f /lib/libc-2.23.so
observed_value=$(stat -c '%h %u' /lib/libc-2.23.so)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /lib/libc-2.23.so | awk '{print $1}')
[ "$observed_value" = 6479e377cd35c6e90e9aba990ac5137b195ca765544ad0c561f7f5945ea7133e ]
test ! -L /usr/lib/libQt5Core.so.5.9.4
test -f /usr/lib/libQt5Core.so.5.9.4
observed_value=$(stat -c '%h %u' /usr/lib/libQt5Core.so.5.9.4)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /usr/lib/libQt5Core.so.5.9.4 | awk '{print $1}')
[ "$observed_value" = b43e1cc628e625a422cfcf98aad38c9542b98cea28196ac4fd14931fd5ccf88d ]
test ! -L /usr/lib/libstdc++.so.6.0.20
test -f /usr/lib/libstdc++.so.6.0.20
observed_value=$(stat -c '%h %u' /usr/lib/libstdc++.so.6.0.20)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /usr/lib/libstdc++.so.6.0.20 | awk '{print $1}')
[ "$observed_value" = 93cc1352b59a0d3a39a8f9d311332f84115e3c5ee71afd846302b942071675c4 ]
observed_value=$(# CGS1_BOOT_LOCK
test ! -L /tmp
observed_value=$(stat -c '%a %u' /tmp)
[ "$observed_value" = '1777 0' ]
test ! -L /tmp/qingping-cgs1-esphome.lock
test -d /tmp/qingping-cgs1-esphome.lock
observed_value=$(stat -c '%a %u' /tmp/qingping-cgs1-esphome.lock)
[ "$observed_value" = '700 0' ]
observed_value=$(stat -f -c '%t' /tmp/qingping-cgs1-esphome.lock)
[ "$observed_value" = 1021994 ]
entries=$(LC_ALL=C ls -A1 /tmp/qingping-cgs1-esphome.lock)
[ "$entries" = "$(printf 'child.pid\\nsupervisor.pid')" ]
test ! -L /tmp/qingping-cgs1-esphome.lock/supervisor.pid
test -f /tmp/qingping-cgs1-esphome.lock/supervisor.pid
observed_value=$(stat -c '%a %u %h' /tmp/qingping-cgs1-esphome.lock/supervisor.pid)
[ "$observed_value" = '600 0 1' ]
value=$(cat /tmp/qingping-cgs1-esphome.lock/supervisor.pid)
case "$value" in (''|*[!0-9]*) exit 1;; esac
[ "\${#value}" -le 10 ]
printf '%s\\n' "$value"
test ! -L /tmp/qingping-cgs1-esphome.lock/child.pid
test -f /tmp/qingping-cgs1-esphome.lock/child.pid
observed_value=$(stat -c '%a %u %h' /tmp/qingping-cgs1-esphome.lock/child.pid)
[ "$observed_value" = '600 0 1' ]
value=$(cat /tmp/qingping-cgs1-esphome.lock/child.pid)
case "$value" in (''|*[!0-9]*) exit 1;; esac
[ "\${#value}" -le 10 ]
printf '%s\\n' "$value"
)
[ "$observed_value" = '`,{field:"supervisor_pid"},`
`,{field:"child_pid"},`' ]
entries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
 case "$entry" in (full-releases|wifi|full-state) exit 1;; esac
done
observed_value=$(cat /tmp/qingping-cgs1-esphome.lock/supervisor.pid)
[ "$observed_value" = `,{field:"supervisor_pid"},` ]
observed_value=$(cat /tmp/qingping-cgs1-esphome.lock/child.pid)
[ "$observed_value" = `,{field:"child_pid"},` ]
observed_value=$(count=0
for link in /proc/[0-9]*/exe; do
    count=$((count+1))
    [ "$count" -le 4096 ] || exit 1
    pid=\${link#/proc/}; pid=\${pid%/exe}
    case "$pid" in (''|*[!0-9]*) exit 1;; esac
    if executable=$(readlink "$link" 2>/dev/null); then
        :
    else
        # Kernel threads and exited tasks legitimately have no executable.
        # An unreadable live userspace exe is NOT evidence of its absence.
        [ -d "/proc/$pid" ] || continue
        metadata=$(sed 's/.*) //' "/proc/$pid/stat" 2>/dev/null | awk '{print $1, $7}')
        set -- $metadata
        if [ "$#" -ne 2 ]; then
            [ ! -d "/proc/$pid" ] && continue
            exit 1
        fi
        case "$2" in (''|*[!0-9]*) exit 1;; esac
        case "$1" in (Z|X|x) continue;; esac
        [ "$(($2 & 2097152))" -ne 0 ] || exit 1
        continue
    fi
    case "$executable" in
        (/data/.esphome-cgs1/*|/tmp/qingping-full-*/*|/tmp/qingping-initial-*/*)
case "$pid:$executable" in
(`,{field:"child_pid"},`:/data/.esphome-cgs1/program) :;;
(*) exit 1;;
esac;;
        (/data/bin/SnowApp) printf '%s\\n' "$pid";;
    esac
done)
[ "$observed_value" = `,{field:"stock_pid"},` ]
observed_value=$(readlink /proc/`,{field:"child_pid"},`/exe)
[ "$observed_value" = /data/.esphome-cgs1/program ]
observed_value=$(stat -c '%u' /proc/`,{field:"child_pid"},`)
[ "$observed_value" = 0 ]
observed_value=$(sed 's/.*) //' /proc/`,{field:"child_pid"},`/stat | awk '{print $20}')
[ "$observed_value" = `,{field:"child_birth"},` ]
process_state=$(sed 's/.*) //' /proc/`,{field:"child_pid"},`/stat | awk '{print $1}')
case "$process_state" in R|S|D|I) :;; *) exit 1;; esac
observed_value=$(readlink /proc/`,{field:"supervisor_pid"},`/exe)
[ "$observed_value" = /bin/busybox ]
observed_value=$(stat -c '%u' /proc/`,{field:"supervisor_pid"},`)
[ "$observed_value" = 0 ]
observed_value=$(sed 's/.*) //' /proc/`,{field:"supervisor_pid"},`/stat | awk '{print $20}')
[ "$observed_value" = `,{field:"supervisor_birth"},` ]
process_state=$(sed 's/.*) //' /proc/`,{field:"supervisor_pid"},`/stat | awk '{print $1}')
case "$process_state" in R|S|D|I) :;; *) exit 1;; esac
observed_value=$(readlink /proc/`,{field:"stock_pid"},`/exe)
[ "$observed_value" = /data/bin/SnowApp ]
observed_value=$(stat -c '%u' /proc/`,{field:"stock_pid"},`)
[ "$observed_value" = 0 ]
observed_value=$(sed 's/.*) //' /proc/`,{field:"stock_pid"},`/stat | awk '{print $20}')
[ "$observed_value" = `,{field:"stock_birth"},` ]
process_state=$(sed 's/.*) //' /proc/`,{field:"stock_pid"},`/stat | awk '{print $1}')
case "$process_state" in R|S|D|I) :;; *) exit 1;; esac
observed_value=$(readlink /proc/`,{field:"watchdog_pid"},`/exe)
[ "$observed_value" = /bin/busybox ]
observed_value=$(stat -c '%u' /proc/`,{field:"watchdog_pid"},`)
[ "$observed_value" = 0 ]
observed_value=$(sed 's/.*) //' /proc/`,{field:"watchdog_pid"},`/stat | awk '{print $20}')
[ "$observed_value" = `,{field:"watchdog_birth"},` ]
process_state=$(sed 's/.*) //' /proc/`,{field:"watchdog_pid"},`/stat | awk '{print $1}')
case "$process_state" in R|S|D|I) :;; *) exit 1;; esac
observed_value=$(sed 's/.*) //' /proc/`,{field:"stock_pid"},`/stat | awk '{print $2}')
[ "$observed_value" = `,{field:"watchdog_pid"},` ]
observed_value=$(sed 's/.*) //' /proc/`,{field:"child_pid"},`/stat | awk '{print $2}')
[ "$observed_value" = `,{field:"supervisor_pid"},` ]
arguments=$(tr '\\000' '\\n' < /proc/`,{field:"supervisor_pid"},`/cmdline)
[ "$arguments" = "$(printf '/bin/sh\\n/data/.esphome-cgs1/launch.sh\\nsupervise')" ]
arguments=$(tr '\\000' '\\n' < /proc/`,{field:"watchdog_pid"},`/cmdline)
[ "$arguments" = "$(printf '/bin/sh\\n/data/bin/watchdog.sh')" ]
test -r /proc/`,{field:"stock_pid"},`/maps
if grep -F -q /data/.esphome-cgs1/ /proc/`,{field:"stock_pid"},`/maps; then exit 1; else result=$?; [ "$result" -eq 1 ]; fi
test -r /proc/`,{field:"stock_pid"},`/maps
if grep -F -q /tmp/qingping-full- /proc/`,{field:"stock_pid"},`/maps; then exit 1; else result=$?; [ "$result" -eq 1 ]; fi
test -r /proc/`,{field:"stock_pid"},`/maps
if grep -F -q /tmp/qingping-initial- /proc/`,{field:"stock_pid"},`/maps; then exit 1; else result=$?; [ "$result" -eq 1 ]; fi
test ! -L /tmp
test -d /tmp
observed_value=$(stat -c '%a %u' /tmp)
[ "$observed_value" = '1777 0' ]
observed_value=$(stat -f -c '%t' /tmp)
[ "$observed_value" = 1021994 ]
entries=$(LC_ALL=C ls -A1 /tmp)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
 case "$entry" in (qingping-pm-helper.attempted) exit 1;; esac
done
test ! -L /data/.esphome-cgs1/pm-helper.disabled
test -f /data/.esphome-cgs1/pm-helper.disabled
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/pm-helper.disabled)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/pm-helper.disabled | awk '{print $1}')
[ "$observed_value" = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 ]
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/pm-helper.disabled)
[ "$observed_value" = '0 600 0 1' ]
entries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
 case "$entry" in (pm-helper.disabled.before-initial-enable) exit 1;; esac
done
entries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
 case "$entry" in (.initial-pm-enable.lock) exit 1;; esac
done
entries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
 case "$entry" in (initial-pm-enable.complete) exit 1;; esac
done
mkdir /data/.esphome-cgs1/.initial-pm-enable.lock
set -C
printf '%s\\n' 'initial-pm-enable `,{field:"pm_nonce"}," ",{field:"plan_id"}," ",{field:"plan_sha256"}," ",{field:"boot_id"},`' > /data/.esphome-cgs1/.initial-pm-enable.lock/owner
sync
test ! -L /data
test ! -L /data/.esphome-cgs1
test -d /data/.esphome-cgs1
observed_value=$(stat -c '%d %i %a %u' /data/.esphome-cgs1)
[ "$observed_value" = '`,{field:"root_device"}," ",{field:"root_inode"},` 700 0' ]
observed_value=$(stat -f -c '%t' /data/.esphome-cgs1)
[ "$observed_value" = ef53 ]
test ! -L /data/.esphome-cgs1/install.intent
test -f /data/.esphome-cgs1/install.intent
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/install.intent)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/install.intent | awk '{print $1}')
[ "$observed_value" = `,{field:"install_marker_sha256"},` ]
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/install.intent)
[ "$observed_value" = '98 600 0 1' ]
# CGS1_BRIDGE_COMPLETION arm
test ! -L /data/.esphome-cgs1/bridge-next-boot.complete
test -f /data/.esphome-cgs1/bridge-next-boot.complete
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/bridge-next-boot.complete)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/bridge-next-boot.complete | awk '{print $1}')
[ "$observed_value" = `,{field:"arm_completion_sha256"},` ]
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/bridge-next-boot.complete)
[ "$observed_value" = '135 600 0 1' ]
observed_value=$(cat /data/.esphome-cgs1/bridge-next-boot.complete)
[ "$observed_value" = 'arm `,{field:"nonce"}," ",{field:"plan_id"}," ",{field:"plan_sha256"},`' ]
entries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
 case "$entry" in (disabled) exit 1;; esac
done
observed_value=$(cat /sys/class/net/wlan0/address)
[ "$observed_value" = `,{field:"wlan_mac"},` ]
observed_value=$(cat /data/etc/os-release)
[ "$observed_value" = CLEARGRASS_VERSION=4.1.8_0287 ]
observed_value=$(cat /proc/sys/kernel/random/boot_id)
[ "$observed_value" = `,{field:"boot_id"},` ]
observed_value=$(awk '
BEGIN { section=0; count=0 }
/^[ \\t]*\\[/ { section=($0 ~ /^[ \\t]*\\[sensors\\][ \\t]*\\r?$/) }
section && /^[ \\t]*co2_type[ \\t]*=/ {
    value=$0; sub(/^[^=]*=[ \\t]*/, "", value); sub(/[ \\t\\r]*$/, "", value)
    print value; count++
}
END { if (count != 1) exit 1 }
' /data/etc/setting.ini)
`,'[ "$observed_value" = ',{field:"co2_type"}," ]",`
test ! -L /data/.esphome-cgs1/program
test -f /data/.esphome-cgs1/program
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/program)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/program | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_sha_0"},` ]
test ! -L /data/.esphome-cgs1/pm_qt_bridge.so
test -f /data/.esphome-cgs1/pm_qt_bridge.so
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/pm_qt_bridge.so)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/pm_qt_bridge.so | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_sha_1"},` ]
test ! -L /data/.esphome-cgs1/launch.sh
test -f /data/.esphome-cgs1/launch.sh
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/launch.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/launch.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_sha_2"},` ]
test ! -L /data/.esphome-cgs1/SnowApp-with-PM
test -f /data/.esphome-cgs1/SnowApp-with-PM
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/SnowApp-with-PM)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/SnowApp-with-PM | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_sha_3"},` ]
test ! -L /data/.esphome-cgs1/startup-hook.sh
test -f /data/.esphome-cgs1/startup-hook.sh
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/startup-hook.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/startup-hook.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_sha_4"},` ]
test ! -L /data/.esphome-cgs1/stock-start.sh.original
test -f /data/.esphome-cgs1/stock-start.sh.original
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/stock-start.sh.original)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/stock-start.sh.original | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_sha_5"},` ]
test ! -L /data/.esphome-cgs1/stock-watchdog.sh.original
test -f /data/.esphome-cgs1/stock-watchdog.sh.original
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/stock-watchdog.sh.original)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/stock-watchdog.sh.original | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_sha_6"},` ]
test ! -L /data/.esphome-cgs1/start.sh.candidate
test -f /data/.esphome-cgs1/start.sh.candidate
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/start.sh.candidate)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/start.sh.candidate | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_sha_7"},` ]
test ! -L /data/.esphome-cgs1/watchdog.sh.candidate
test -f /data/.esphome-cgs1/watchdog.sh.candidate
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/watchdog.sh.candidate)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/watchdog.sh.candidate | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_sha_8"},` ]
test ! -L /data/bin/SnowApp
test -f /data/bin/SnowApp
observed_value=$(stat -c '%h %u' /data/bin/SnowApp)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/bin/SnowApp | awk '{print $1}')
[ "$observed_value" = a39016531620a874668ee322f0e976f48e47943742c54c8a7291b9e830c91abb ]
test ! -L /data/bin/watchdog.sh
test -f /data/bin/watchdog.sh
observed_value=$(stat -c '%h %u' /data/bin/watchdog.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/bin/watchdog.sh | awk '{print $1}')
[ "$observed_value" = 1d74ef0946734e1ddf9e76301012f9ed66d7b38d9d7a0239a5d0e80acabf2cce ]
test ! -L /data/etc/init.d/start.sh
test -f /data/etc/init.d/start.sh
observed_value=$(stat -c '%h %u' /data/etc/init.d/start.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/etc/init.d/start.sh | awk '{print $1}')
[ "$observed_value" = f104f873dd3ce4544d5f3e3f90a4056bffc811bcaae037e347306e1084e7f1d1 ]
test ! -L /etc/init.d/S12_launcher_init
test -f /etc/init.d/S12_launcher_init
observed_value=$(stat -c '%h %u' /etc/init.d/S12_launcher_init)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /etc/init.d/S12_launcher_init | awk '{print $1}')
[ "$observed_value" = 533cac6f65b3ccf8d3404216c688877ad03a8b03af64edaade9bd6dc3aad1c35 ]
test ! -L /etc/init.d/S50_px3se_init
test -f /etc/init.d/S50_px3se_init
observed_value=$(stat -c '%h %u' /etc/init.d/S50_px3se_init)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /etc/init.d/S50_px3se_init | awk '{print $1}')
[ "$observed_value" = d818606f68bc1428ef96c5257df751a843cc9a6770dc25a2487a940c6bcb2492 ]
test ! -L /lib/ld-2.23.so
test -f /lib/ld-2.23.so
observed_value=$(stat -c '%h %u' /lib/ld-2.23.so)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /lib/ld-2.23.so | awk '{print $1}')
[ "$observed_value" = 6da48efda9ff440998747a66131e8ebdc6a57a15bb19dcfd7895a031368dd50a ]
test ! -L /lib/libc-2.23.so
test -f /lib/libc-2.23.so
observed_value=$(stat -c '%h %u' /lib/libc-2.23.so)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /lib/libc-2.23.so | awk '{print $1}')
[ "$observed_value" = 6479e377cd35c6e90e9aba990ac5137b195ca765544ad0c561f7f5945ea7133e ]
test ! -L /usr/lib/libQt5Core.so.5.9.4
test -f /usr/lib/libQt5Core.so.5.9.4
observed_value=$(stat -c '%h %u' /usr/lib/libQt5Core.so.5.9.4)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /usr/lib/libQt5Core.so.5.9.4 | awk '{print $1}')
[ "$observed_value" = b43e1cc628e625a422cfcf98aad38c9542b98cea28196ac4fd14931fd5ccf88d ]
test ! -L /usr/lib/libstdc++.so.6.0.20
test -f /usr/lib/libstdc++.so.6.0.20
observed_value=$(stat -c '%h %u' /usr/lib/libstdc++.so.6.0.20)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /usr/lib/libstdc++.so.6.0.20 | awk '{print $1}')
[ "$observed_value" = 93cc1352b59a0d3a39a8f9d311332f84115e3c5ee71afd846302b942071675c4 ]
observed_value=$(# CGS1_BOOT_LOCK
test ! -L /tmp
observed_value=$(stat -c '%a %u' /tmp)
[ "$observed_value" = '1777 0' ]
test ! -L /tmp/qingping-cgs1-esphome.lock
test -d /tmp/qingping-cgs1-esphome.lock
observed_value=$(stat -c '%a %u' /tmp/qingping-cgs1-esphome.lock)
[ "$observed_value" = '700 0' ]
observed_value=$(stat -f -c '%t' /tmp/qingping-cgs1-esphome.lock)
[ "$observed_value" = 1021994 ]
entries=$(LC_ALL=C ls -A1 /tmp/qingping-cgs1-esphome.lock)
[ "$entries" = "$(printf 'child.pid\\nsupervisor.pid')" ]
test ! -L /tmp/qingping-cgs1-esphome.lock/supervisor.pid
test -f /tmp/qingping-cgs1-esphome.lock/supervisor.pid
observed_value=$(stat -c '%a %u %h' /tmp/qingping-cgs1-esphome.lock/supervisor.pid)
[ "$observed_value" = '600 0 1' ]
value=$(cat /tmp/qingping-cgs1-esphome.lock/supervisor.pid)
case "$value" in (''|*[!0-9]*) exit 1;; esac
[ "\${#value}" -le 10 ]
printf '%s\\n' "$value"
test ! -L /tmp/qingping-cgs1-esphome.lock/child.pid
test -f /tmp/qingping-cgs1-esphome.lock/child.pid
observed_value=$(stat -c '%a %u %h' /tmp/qingping-cgs1-esphome.lock/child.pid)
[ "$observed_value" = '600 0 1' ]
value=$(cat /tmp/qingping-cgs1-esphome.lock/child.pid)
case "$value" in (''|*[!0-9]*) exit 1;; esac
[ "\${#value}" -le 10 ]
printf '%s\\n' "$value"
)
[ "$observed_value" = '`,{field:"supervisor_pid"},`
`,{field:"child_pid"},`' ]
entries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
 case "$entry" in (full-releases|wifi|full-state) exit 1;; esac
done
observed_value=$(cat /tmp/qingping-cgs1-esphome.lock/supervisor.pid)
[ "$observed_value" = `,{field:"supervisor_pid"},` ]
observed_value=$(cat /tmp/qingping-cgs1-esphome.lock/child.pid)
[ "$observed_value" = `,{field:"child_pid"},` ]
observed_value=$(count=0
for link in /proc/[0-9]*/exe; do
    count=$((count+1))
    [ "$count" -le 4096 ] || exit 1
    pid=\${link#/proc/}; pid=\${pid%/exe}
    case "$pid" in (''|*[!0-9]*) exit 1;; esac
    if executable=$(readlink "$link" 2>/dev/null); then
        :
    else
        # Kernel threads and exited tasks legitimately have no executable.
        # An unreadable live userspace exe is NOT evidence of its absence.
        [ -d "/proc/$pid" ] || continue
        metadata=$(sed 's/.*) //' "/proc/$pid/stat" 2>/dev/null | awk '{print $1, $7}')
        set -- $metadata
        if [ "$#" -ne 2 ]; then
            [ ! -d "/proc/$pid" ] && continue
            exit 1
        fi
        case "$2" in (''|*[!0-9]*) exit 1;; esac
        case "$1" in (Z|X|x) continue;; esac
        [ "$(($2 & 2097152))" -ne 0 ] || exit 1
        continue
    fi
    case "$executable" in
        (/data/.esphome-cgs1/*|/tmp/qingping-full-*/*|/tmp/qingping-initial-*/*)
case "$pid:$executable" in
(`,{field:"child_pid"},`:/data/.esphome-cgs1/program) :;;
(*) exit 1;;
esac;;
        (/data/bin/SnowApp) printf '%s\\n' "$pid";;
    esac
done)
[ "$observed_value" = `,{field:"stock_pid"},` ]
observed_value=$(readlink /proc/`,{field:"child_pid"},`/exe)
[ "$observed_value" = /data/.esphome-cgs1/program ]
observed_value=$(stat -c '%u' /proc/`,{field:"child_pid"},`)
[ "$observed_value" = 0 ]
observed_value=$(sed 's/.*) //' /proc/`,{field:"child_pid"},`/stat | awk '{print $20}')
[ "$observed_value" = `,{field:"child_birth"},` ]
process_state=$(sed 's/.*) //' /proc/`,{field:"child_pid"},`/stat | awk '{print $1}')
case "$process_state" in R|S|D|I) :;; *) exit 1;; esac
observed_value=$(readlink /proc/`,{field:"supervisor_pid"},`/exe)
[ "$observed_value" = /bin/busybox ]
observed_value=$(stat -c '%u' /proc/`,{field:"supervisor_pid"},`)
[ "$observed_value" = 0 ]
observed_value=$(sed 's/.*) //' /proc/`,{field:"supervisor_pid"},`/stat | awk '{print $20}')
[ "$observed_value" = `,{field:"supervisor_birth"},` ]
process_state=$(sed 's/.*) //' /proc/`,{field:"supervisor_pid"},`/stat | awk '{print $1}')
case "$process_state" in R|S|D|I) :;; *) exit 1;; esac
observed_value=$(readlink /proc/`,{field:"stock_pid"},`/exe)
[ "$observed_value" = /data/bin/SnowApp ]
observed_value=$(stat -c '%u' /proc/`,{field:"stock_pid"},`)
[ "$observed_value" = 0 ]
observed_value=$(sed 's/.*) //' /proc/`,{field:"stock_pid"},`/stat | awk '{print $20}')
[ "$observed_value" = `,{field:"stock_birth"},` ]
process_state=$(sed 's/.*) //' /proc/`,{field:"stock_pid"},`/stat | awk '{print $1}')
case "$process_state" in R|S|D|I) :;; *) exit 1;; esac
observed_value=$(readlink /proc/`,{field:"watchdog_pid"},`/exe)
[ "$observed_value" = /bin/busybox ]
observed_value=$(stat -c '%u' /proc/`,{field:"watchdog_pid"},`)
[ "$observed_value" = 0 ]
observed_value=$(sed 's/.*) //' /proc/`,{field:"watchdog_pid"},`/stat | awk '{print $20}')
[ "$observed_value" = `,{field:"watchdog_birth"},` ]
process_state=$(sed 's/.*) //' /proc/`,{field:"watchdog_pid"},`/stat | awk '{print $1}')
case "$process_state" in R|S|D|I) :;; *) exit 1;; esac
observed_value=$(sed 's/.*) //' /proc/`,{field:"stock_pid"},`/stat | awk '{print $2}')
[ "$observed_value" = `,{field:"watchdog_pid"},` ]
observed_value=$(sed 's/.*) //' /proc/`,{field:"child_pid"},`/stat | awk '{print $2}')
[ "$observed_value" = `,{field:"supervisor_pid"},` ]
arguments=$(tr '\\000' '\\n' < /proc/`,{field:"supervisor_pid"},`/cmdline)
[ "$arguments" = "$(printf '/bin/sh\\n/data/.esphome-cgs1/launch.sh\\nsupervise')" ]
arguments=$(tr '\\000' '\\n' < /proc/`,{field:"watchdog_pid"},`/cmdline)
[ "$arguments" = "$(printf '/bin/sh\\n/data/bin/watchdog.sh')" ]
test -r /proc/`,{field:"stock_pid"},`/maps
if grep -F -q /data/.esphome-cgs1/ /proc/`,{field:"stock_pid"},`/maps; then exit 1; else result=$?; [ "$result" -eq 1 ]; fi
test -r /proc/`,{field:"stock_pid"},`/maps
if grep -F -q /tmp/qingping-full- /proc/`,{field:"stock_pid"},`/maps; then exit 1; else result=$?; [ "$result" -eq 1 ]; fi
test -r /proc/`,{field:"stock_pid"},`/maps
if grep -F -q /tmp/qingping-initial- /proc/`,{field:"stock_pid"},`/maps; then exit 1; else result=$?; [ "$result" -eq 1 ]; fi
test ! -L /data/.esphome-cgs1/.initial-pm-enable.lock
test -d /data/.esphome-cgs1/.initial-pm-enable.lock
observed_value=$(stat -c '%a %u' /data/.esphome-cgs1/.initial-pm-enable.lock)
[ "$observed_value" = '700 0' ]
test ! -L /data/.esphome-cgs1/.initial-pm-enable.lock/owner
test -f /data/.esphome-cgs1/.initial-pm-enable.lock/owner
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/.initial-pm-enable.lock/owner)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/.initial-pm-enable.lock/owner | awk '{print $1}')
[ "$observed_value" = `,{field:"pm_owner_sha256"},` ]
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/.initial-pm-enable.lock/owner)
[ "$observed_value" = '186 600 0 1' ]
test ! -L /data/.esphome-cgs1/pm-helper.disabled
test -f /data/.esphome-cgs1/pm-helper.disabled
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/pm-helper.disabled)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/pm-helper.disabled | awk '{print $1}')
[ "$observed_value" = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 ]
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/pm-helper.disabled)
[ "$observed_value" = '0 600 0 1' ]
entries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
 case "$entry" in (pm-helper.disabled.before-initial-enable) exit 1;; esac
done
entries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
 case "$entry" in (initial-pm-enable.complete) exit 1;; esac
done
test ! -L /tmp
test -d /tmp
observed_value=$(stat -c '%a %u' /tmp)
[ "$observed_value" = '1777 0' ]
observed_value=$(stat -f -c '%t' /tmp)
[ "$observed_value" = 1021994 ]
entries=$(LC_ALL=C ls -A1 /tmp)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
 case "$entry" in (qingping-pm-helper.attempted) exit 1;; esac
done
: > /tmp/qingping-pm-helper.attempted
sync
test ! -L /data
test ! -L /data/.esphome-cgs1
test -d /data/.esphome-cgs1
observed_value=$(stat -c '%d %i %a %u' /data/.esphome-cgs1)
[ "$observed_value" = '`,{field:"root_device"}," ",{field:"root_inode"},` 700 0' ]
observed_value=$(stat -f -c '%t' /data/.esphome-cgs1)
[ "$observed_value" = ef53 ]
test ! -L /data/.esphome-cgs1/install.intent
test -f /data/.esphome-cgs1/install.intent
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/install.intent)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/install.intent | awk '{print $1}')
[ "$observed_value" = `,{field:"install_marker_sha256"},` ]
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/install.intent)
[ "$observed_value" = '98 600 0 1' ]
# CGS1_BRIDGE_COMPLETION arm
test ! -L /data/.esphome-cgs1/bridge-next-boot.complete
test -f /data/.esphome-cgs1/bridge-next-boot.complete
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/bridge-next-boot.complete)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/bridge-next-boot.complete | awk '{print $1}')
[ "$observed_value" = `,{field:"arm_completion_sha256"},` ]
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/bridge-next-boot.complete)
[ "$observed_value" = '135 600 0 1' ]
observed_value=$(cat /data/.esphome-cgs1/bridge-next-boot.complete)
[ "$observed_value" = 'arm `,{field:"nonce"}," ",{field:"plan_id"}," ",{field:"plan_sha256"},`' ]
entries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
 case "$entry" in (disabled) exit 1;; esac
done
observed_value=$(cat /sys/class/net/wlan0/address)
[ "$observed_value" = `,{field:"wlan_mac"},` ]
observed_value=$(cat /data/etc/os-release)
[ "$observed_value" = CLEARGRASS_VERSION=4.1.8_0287 ]
observed_value=$(cat /proc/sys/kernel/random/boot_id)
[ "$observed_value" = `,{field:"boot_id"},` ]
observed_value=$(awk '
BEGIN { section=0; count=0 }
/^[ \\t]*\\[/ { section=($0 ~ /^[ \\t]*\\[sensors\\][ \\t]*\\r?$/) }
section && /^[ \\t]*co2_type[ \\t]*=/ {
    value=$0; sub(/^[^=]*=[ \\t]*/, "", value); sub(/[ \\t\\r]*$/, "", value)
    print value; count++
}
END { if (count != 1) exit 1 }
' /data/etc/setting.ini)
`,'[ "$observed_value" = ',{field:"co2_type"}," ]",`
test ! -L /data/.esphome-cgs1/program
test -f /data/.esphome-cgs1/program
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/program)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/program | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_sha_0"},` ]
test ! -L /data/.esphome-cgs1/pm_qt_bridge.so
test -f /data/.esphome-cgs1/pm_qt_bridge.so
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/pm_qt_bridge.so)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/pm_qt_bridge.so | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_sha_1"},` ]
test ! -L /data/.esphome-cgs1/launch.sh
test -f /data/.esphome-cgs1/launch.sh
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/launch.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/launch.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_sha_2"},` ]
test ! -L /data/.esphome-cgs1/SnowApp-with-PM
test -f /data/.esphome-cgs1/SnowApp-with-PM
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/SnowApp-with-PM)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/SnowApp-with-PM | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_sha_3"},` ]
test ! -L /data/.esphome-cgs1/startup-hook.sh
test -f /data/.esphome-cgs1/startup-hook.sh
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/startup-hook.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/startup-hook.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_sha_4"},` ]
test ! -L /data/.esphome-cgs1/stock-start.sh.original
test -f /data/.esphome-cgs1/stock-start.sh.original
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/stock-start.sh.original)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/stock-start.sh.original | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_sha_5"},` ]
test ! -L /data/.esphome-cgs1/stock-watchdog.sh.original
test -f /data/.esphome-cgs1/stock-watchdog.sh.original
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/stock-watchdog.sh.original)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/stock-watchdog.sh.original | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_sha_6"},` ]
test ! -L /data/.esphome-cgs1/start.sh.candidate
test -f /data/.esphome-cgs1/start.sh.candidate
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/start.sh.candidate)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/start.sh.candidate | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_sha_7"},` ]
test ! -L /data/.esphome-cgs1/watchdog.sh.candidate
test -f /data/.esphome-cgs1/watchdog.sh.candidate
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/watchdog.sh.candidate)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/watchdog.sh.candidate | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_sha_8"},` ]
test ! -L /data/bin/SnowApp
test -f /data/bin/SnowApp
observed_value=$(stat -c '%h %u' /data/bin/SnowApp)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/bin/SnowApp | awk '{print $1}')
[ "$observed_value" = a39016531620a874668ee322f0e976f48e47943742c54c8a7291b9e830c91abb ]
test ! -L /data/bin/watchdog.sh
test -f /data/bin/watchdog.sh
observed_value=$(stat -c '%h %u' /data/bin/watchdog.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/bin/watchdog.sh | awk '{print $1}')
[ "$observed_value" = 1d74ef0946734e1ddf9e76301012f9ed66d7b38d9d7a0239a5d0e80acabf2cce ]
test ! -L /data/etc/init.d/start.sh
test -f /data/etc/init.d/start.sh
observed_value=$(stat -c '%h %u' /data/etc/init.d/start.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/etc/init.d/start.sh | awk '{print $1}')
[ "$observed_value" = f104f873dd3ce4544d5f3e3f90a4056bffc811bcaae037e347306e1084e7f1d1 ]
test ! -L /etc/init.d/S12_launcher_init
test -f /etc/init.d/S12_launcher_init
observed_value=$(stat -c '%h %u' /etc/init.d/S12_launcher_init)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /etc/init.d/S12_launcher_init | awk '{print $1}')
[ "$observed_value" = 533cac6f65b3ccf8d3404216c688877ad03a8b03af64edaade9bd6dc3aad1c35 ]
test ! -L /etc/init.d/S50_px3se_init
test -f /etc/init.d/S50_px3se_init
observed_value=$(stat -c '%h %u' /etc/init.d/S50_px3se_init)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /etc/init.d/S50_px3se_init | awk '{print $1}')
[ "$observed_value" = d818606f68bc1428ef96c5257df751a843cc9a6770dc25a2487a940c6bcb2492 ]
test ! -L /lib/ld-2.23.so
test -f /lib/ld-2.23.so
observed_value=$(stat -c '%h %u' /lib/ld-2.23.so)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /lib/ld-2.23.so | awk '{print $1}')
[ "$observed_value" = 6da48efda9ff440998747a66131e8ebdc6a57a15bb19dcfd7895a031368dd50a ]
test ! -L /lib/libc-2.23.so
test -f /lib/libc-2.23.so
observed_value=$(stat -c '%h %u' /lib/libc-2.23.so)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /lib/libc-2.23.so | awk '{print $1}')
[ "$observed_value" = 6479e377cd35c6e90e9aba990ac5137b195ca765544ad0c561f7f5945ea7133e ]
test ! -L /usr/lib/libQt5Core.so.5.9.4
test -f /usr/lib/libQt5Core.so.5.9.4
observed_value=$(stat -c '%h %u' /usr/lib/libQt5Core.so.5.9.4)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /usr/lib/libQt5Core.so.5.9.4 | awk '{print $1}')
[ "$observed_value" = b43e1cc628e625a422cfcf98aad38c9542b98cea28196ac4fd14931fd5ccf88d ]
test ! -L /usr/lib/libstdc++.so.6.0.20
test -f /usr/lib/libstdc++.so.6.0.20
observed_value=$(stat -c '%h %u' /usr/lib/libstdc++.so.6.0.20)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /usr/lib/libstdc++.so.6.0.20 | awk '{print $1}')
[ "$observed_value" = 93cc1352b59a0d3a39a8f9d311332f84115e3c5ee71afd846302b942071675c4 ]
observed_value=$(# CGS1_BOOT_LOCK
test ! -L /tmp
observed_value=$(stat -c '%a %u' /tmp)
[ "$observed_value" = '1777 0' ]
test ! -L /tmp/qingping-cgs1-esphome.lock
test -d /tmp/qingping-cgs1-esphome.lock
observed_value=$(stat -c '%a %u' /tmp/qingping-cgs1-esphome.lock)
[ "$observed_value" = '700 0' ]
observed_value=$(stat -f -c '%t' /tmp/qingping-cgs1-esphome.lock)
[ "$observed_value" = 1021994 ]
entries=$(LC_ALL=C ls -A1 /tmp/qingping-cgs1-esphome.lock)
[ "$entries" = "$(printf 'child.pid\\nsupervisor.pid')" ]
test ! -L /tmp/qingping-cgs1-esphome.lock/supervisor.pid
test -f /tmp/qingping-cgs1-esphome.lock/supervisor.pid
observed_value=$(stat -c '%a %u %h' /tmp/qingping-cgs1-esphome.lock/supervisor.pid)
[ "$observed_value" = '600 0 1' ]
value=$(cat /tmp/qingping-cgs1-esphome.lock/supervisor.pid)
case "$value" in (''|*[!0-9]*) exit 1;; esac
[ "\${#value}" -le 10 ]
printf '%s\\n' "$value"
test ! -L /tmp/qingping-cgs1-esphome.lock/child.pid
test -f /tmp/qingping-cgs1-esphome.lock/child.pid
observed_value=$(stat -c '%a %u %h' /tmp/qingping-cgs1-esphome.lock/child.pid)
[ "$observed_value" = '600 0 1' ]
value=$(cat /tmp/qingping-cgs1-esphome.lock/child.pid)
case "$value" in (''|*[!0-9]*) exit 1;; esac
[ "\${#value}" -le 10 ]
printf '%s\\n' "$value"
)
[ "$observed_value" = '`,{field:"supervisor_pid"},`
`,{field:"child_pid"},`' ]
entries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
 case "$entry" in (full-releases|wifi|full-state) exit 1;; esac
done
observed_value=$(cat /tmp/qingping-cgs1-esphome.lock/supervisor.pid)
[ "$observed_value" = `,{field:"supervisor_pid"},` ]
observed_value=$(cat /tmp/qingping-cgs1-esphome.lock/child.pid)
[ "$observed_value" = `,{field:"child_pid"},` ]
observed_value=$(count=0
for link in /proc/[0-9]*/exe; do
    count=$((count+1))
    [ "$count" -le 4096 ] || exit 1
    pid=\${link#/proc/}; pid=\${pid%/exe}
    case "$pid" in (''|*[!0-9]*) exit 1;; esac
    if executable=$(readlink "$link" 2>/dev/null); then
        :
    else
        # Kernel threads and exited tasks legitimately have no executable.
        # An unreadable live userspace exe is NOT evidence of its absence.
        [ -d "/proc/$pid" ] || continue
        metadata=$(sed 's/.*) //' "/proc/$pid/stat" 2>/dev/null | awk '{print $1, $7}')
        set -- $metadata
        if [ "$#" -ne 2 ]; then
            [ ! -d "/proc/$pid" ] && continue
            exit 1
        fi
        case "$2" in (''|*[!0-9]*) exit 1;; esac
        case "$1" in (Z|X|x) continue;; esac
        [ "$(($2 & 2097152))" -ne 0 ] || exit 1
        continue
    fi
    case "$executable" in
        (/data/.esphome-cgs1/*|/tmp/qingping-full-*/*|/tmp/qingping-initial-*/*)
case "$pid:$executable" in
(`,{field:"child_pid"},`:/data/.esphome-cgs1/program) :;;
(*) exit 1;;
esac;;
        (/data/bin/SnowApp) printf '%s\\n' "$pid";;
    esac
done)
[ "$observed_value" = `,{field:"stock_pid"},` ]
observed_value=$(readlink /proc/`,{field:"child_pid"},`/exe)
[ "$observed_value" = /data/.esphome-cgs1/program ]
observed_value=$(stat -c '%u' /proc/`,{field:"child_pid"},`)
[ "$observed_value" = 0 ]
observed_value=$(sed 's/.*) //' /proc/`,{field:"child_pid"},`/stat | awk '{print $20}')
[ "$observed_value" = `,{field:"child_birth"},` ]
process_state=$(sed 's/.*) //' /proc/`,{field:"child_pid"},`/stat | awk '{print $1}')
case "$process_state" in R|S|D|I) :;; *) exit 1;; esac
observed_value=$(readlink /proc/`,{field:"supervisor_pid"},`/exe)
[ "$observed_value" = /bin/busybox ]
observed_value=$(stat -c '%u' /proc/`,{field:"supervisor_pid"},`)
[ "$observed_value" = 0 ]
observed_value=$(sed 's/.*) //' /proc/`,{field:"supervisor_pid"},`/stat | awk '{print $20}')
[ "$observed_value" = `,{field:"supervisor_birth"},` ]
process_state=$(sed 's/.*) //' /proc/`,{field:"supervisor_pid"},`/stat | awk '{print $1}')
case "$process_state" in R|S|D|I) :;; *) exit 1;; esac
observed_value=$(readlink /proc/`,{field:"stock_pid"},`/exe)
[ "$observed_value" = /data/bin/SnowApp ]
observed_value=$(stat -c '%u' /proc/`,{field:"stock_pid"},`)
[ "$observed_value" = 0 ]
observed_value=$(sed 's/.*) //' /proc/`,{field:"stock_pid"},`/stat | awk '{print $20}')
[ "$observed_value" = `,{field:"stock_birth"},` ]
process_state=$(sed 's/.*) //' /proc/`,{field:"stock_pid"},`/stat | awk '{print $1}')
case "$process_state" in R|S|D|I) :;; *) exit 1;; esac
observed_value=$(readlink /proc/`,{field:"watchdog_pid"},`/exe)
[ "$observed_value" = /bin/busybox ]
observed_value=$(stat -c '%u' /proc/`,{field:"watchdog_pid"},`)
[ "$observed_value" = 0 ]
observed_value=$(sed 's/.*) //' /proc/`,{field:"watchdog_pid"},`/stat | awk '{print $20}')
[ "$observed_value" = `,{field:"watchdog_birth"},` ]
process_state=$(sed 's/.*) //' /proc/`,{field:"watchdog_pid"},`/stat | awk '{print $1}')
case "$process_state" in R|S|D|I) :;; *) exit 1;; esac
observed_value=$(sed 's/.*) //' /proc/`,{field:"stock_pid"},`/stat | awk '{print $2}')
[ "$observed_value" = `,{field:"watchdog_pid"},` ]
observed_value=$(sed 's/.*) //' /proc/`,{field:"child_pid"},`/stat | awk '{print $2}')
[ "$observed_value" = `,{field:"supervisor_pid"},` ]
arguments=$(tr '\\000' '\\n' < /proc/`,{field:"supervisor_pid"},`/cmdline)
[ "$arguments" = "$(printf '/bin/sh\\n/data/.esphome-cgs1/launch.sh\\nsupervise')" ]
arguments=$(tr '\\000' '\\n' < /proc/`,{field:"watchdog_pid"},`/cmdline)
[ "$arguments" = "$(printf '/bin/sh\\n/data/bin/watchdog.sh')" ]
test -r /proc/`,{field:"stock_pid"},`/maps
if grep -F -q /data/.esphome-cgs1/ /proc/`,{field:"stock_pid"},`/maps; then exit 1; else result=$?; [ "$result" -eq 1 ]; fi
test -r /proc/`,{field:"stock_pid"},`/maps
if grep -F -q /tmp/qingping-full- /proc/`,{field:"stock_pid"},`/maps; then exit 1; else result=$?; [ "$result" -eq 1 ]; fi
test -r /proc/`,{field:"stock_pid"},`/maps
if grep -F -q /tmp/qingping-initial- /proc/`,{field:"stock_pid"},`/maps; then exit 1; else result=$?; [ "$result" -eq 1 ]; fi
test ! -L /data/.esphome-cgs1/.initial-pm-enable.lock
test -d /data/.esphome-cgs1/.initial-pm-enable.lock
observed_value=$(stat -c '%a %u' /data/.esphome-cgs1/.initial-pm-enable.lock)
[ "$observed_value" = '700 0' ]
test ! -L /data/.esphome-cgs1/.initial-pm-enable.lock/owner
test -f /data/.esphome-cgs1/.initial-pm-enable.lock/owner
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/.initial-pm-enable.lock/owner)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/.initial-pm-enable.lock/owner | awk '{print $1}')
[ "$observed_value" = `,{field:"pm_owner_sha256"},` ]
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/.initial-pm-enable.lock/owner)
[ "$observed_value" = '186 600 0 1' ]
test ! -L /tmp
test -d /tmp
observed_value=$(stat -c '%a %u' /tmp)
[ "$observed_value" = '1777 0' ]
observed_value=$(stat -f -c '%t' /tmp)
[ "$observed_value" = 1021994 ]
test ! -L /tmp/qingping-pm-helper.attempted
test -f /tmp/qingping-pm-helper.attempted
observed_value=$(stat -c '%h %u' /tmp/qingping-pm-helper.attempted)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /tmp/qingping-pm-helper.attempted | awk '{print $1}')
[ "$observed_value" = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 ]
observed_value=$(stat -c '%s %a %u %h' /tmp/qingping-pm-helper.attempted)
[ "$observed_value" = '0 600 0 1' ]
test ! -L /data/.esphome-cgs1/pm-helper.disabled
test -f /data/.esphome-cgs1/pm-helper.disabled
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/pm-helper.disabled)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/pm-helper.disabled | awk '{print $1}')
[ "$observed_value" = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 ]
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/pm-helper.disabled)
[ "$observed_value" = '0 600 0 1' ]
entries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
 case "$entry" in (pm-helper.disabled.before-initial-enable) exit 1;; esac
done
entries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
 case "$entry" in (initial-pm-enable.complete) exit 1;; esac
done
: > /data/.esphome-cgs1/pm-helper.disabled.before-initial-enable
sync
test ! -L /data
test ! -L /data/.esphome-cgs1
test -d /data/.esphome-cgs1
observed_value=$(stat -c '%d %i %a %u' /data/.esphome-cgs1)
[ "$observed_value" = '`,{field:"root_device"}," ",{field:"root_inode"},` 700 0' ]
observed_value=$(stat -f -c '%t' /data/.esphome-cgs1)
[ "$observed_value" = ef53 ]
test ! -L /data/.esphome-cgs1/install.intent
test -f /data/.esphome-cgs1/install.intent
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/install.intent)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/install.intent | awk '{print $1}')
[ "$observed_value" = `,{field:"install_marker_sha256"},` ]
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/install.intent)
[ "$observed_value" = '98 600 0 1' ]
# CGS1_BRIDGE_COMPLETION arm
test ! -L /data/.esphome-cgs1/bridge-next-boot.complete
test -f /data/.esphome-cgs1/bridge-next-boot.complete
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/bridge-next-boot.complete)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/bridge-next-boot.complete | awk '{print $1}')
[ "$observed_value" = `,{field:"arm_completion_sha256"},` ]
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/bridge-next-boot.complete)
[ "$observed_value" = '135 600 0 1' ]
observed_value=$(cat /data/.esphome-cgs1/bridge-next-boot.complete)
[ "$observed_value" = 'arm `,{field:"nonce"}," ",{field:"plan_id"}," ",{field:"plan_sha256"},`' ]
entries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
 case "$entry" in (disabled) exit 1;; esac
done
observed_value=$(cat /sys/class/net/wlan0/address)
[ "$observed_value" = `,{field:"wlan_mac"},` ]
observed_value=$(cat /data/etc/os-release)
[ "$observed_value" = CLEARGRASS_VERSION=4.1.8_0287 ]
observed_value=$(cat /proc/sys/kernel/random/boot_id)
[ "$observed_value" = `,{field:"boot_id"},` ]
observed_value=$(awk '
BEGIN { section=0; count=0 }
/^[ \\t]*\\[/ { section=($0 ~ /^[ \\t]*\\[sensors\\][ \\t]*\\r?$/) }
section && /^[ \\t]*co2_type[ \\t]*=/ {
    value=$0; sub(/^[^=]*=[ \\t]*/, "", value); sub(/[ \\t\\r]*$/, "", value)
    print value; count++
}
END { if (count != 1) exit 1 }
' /data/etc/setting.ini)
`,'[ "$observed_value" = ',{field:"co2_type"}," ]",`
test ! -L /data/.esphome-cgs1/program
test -f /data/.esphome-cgs1/program
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/program)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/program | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_sha_0"},` ]
test ! -L /data/.esphome-cgs1/pm_qt_bridge.so
test -f /data/.esphome-cgs1/pm_qt_bridge.so
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/pm_qt_bridge.so)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/pm_qt_bridge.so | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_sha_1"},` ]
test ! -L /data/.esphome-cgs1/launch.sh
test -f /data/.esphome-cgs1/launch.sh
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/launch.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/launch.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_sha_2"},` ]
test ! -L /data/.esphome-cgs1/SnowApp-with-PM
test -f /data/.esphome-cgs1/SnowApp-with-PM
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/SnowApp-with-PM)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/SnowApp-with-PM | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_sha_3"},` ]
test ! -L /data/.esphome-cgs1/startup-hook.sh
test -f /data/.esphome-cgs1/startup-hook.sh
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/startup-hook.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/startup-hook.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_sha_4"},` ]
test ! -L /data/.esphome-cgs1/stock-start.sh.original
test -f /data/.esphome-cgs1/stock-start.sh.original
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/stock-start.sh.original)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/stock-start.sh.original | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_sha_5"},` ]
test ! -L /data/.esphome-cgs1/stock-watchdog.sh.original
test -f /data/.esphome-cgs1/stock-watchdog.sh.original
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/stock-watchdog.sh.original)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/stock-watchdog.sh.original | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_sha_6"},` ]
test ! -L /data/.esphome-cgs1/start.sh.candidate
test -f /data/.esphome-cgs1/start.sh.candidate
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/start.sh.candidate)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/start.sh.candidate | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_sha_7"},` ]
test ! -L /data/.esphome-cgs1/watchdog.sh.candidate
test -f /data/.esphome-cgs1/watchdog.sh.candidate
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/watchdog.sh.candidate)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/watchdog.sh.candidate | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_sha_8"},` ]
test ! -L /data/bin/SnowApp
test -f /data/bin/SnowApp
observed_value=$(stat -c '%h %u' /data/bin/SnowApp)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/bin/SnowApp | awk '{print $1}')
[ "$observed_value" = a39016531620a874668ee322f0e976f48e47943742c54c8a7291b9e830c91abb ]
test ! -L /data/bin/watchdog.sh
test -f /data/bin/watchdog.sh
observed_value=$(stat -c '%h %u' /data/bin/watchdog.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/bin/watchdog.sh | awk '{print $1}')
[ "$observed_value" = 1d74ef0946734e1ddf9e76301012f9ed66d7b38d9d7a0239a5d0e80acabf2cce ]
test ! -L /data/etc/init.d/start.sh
test -f /data/etc/init.d/start.sh
observed_value=$(stat -c '%h %u' /data/etc/init.d/start.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/etc/init.d/start.sh | awk '{print $1}')
[ "$observed_value" = f104f873dd3ce4544d5f3e3f90a4056bffc811bcaae037e347306e1084e7f1d1 ]
test ! -L /etc/init.d/S12_launcher_init
test -f /etc/init.d/S12_launcher_init
observed_value=$(stat -c '%h %u' /etc/init.d/S12_launcher_init)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /etc/init.d/S12_launcher_init | awk '{print $1}')
[ "$observed_value" = 533cac6f65b3ccf8d3404216c688877ad03a8b03af64edaade9bd6dc3aad1c35 ]
test ! -L /etc/init.d/S50_px3se_init
test -f /etc/init.d/S50_px3se_init
observed_value=$(stat -c '%h %u' /etc/init.d/S50_px3se_init)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /etc/init.d/S50_px3se_init | awk '{print $1}')
[ "$observed_value" = d818606f68bc1428ef96c5257df751a843cc9a6770dc25a2487a940c6bcb2492 ]
test ! -L /lib/ld-2.23.so
test -f /lib/ld-2.23.so
observed_value=$(stat -c '%h %u' /lib/ld-2.23.so)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /lib/ld-2.23.so | awk '{print $1}')
[ "$observed_value" = 6da48efda9ff440998747a66131e8ebdc6a57a15bb19dcfd7895a031368dd50a ]
test ! -L /lib/libc-2.23.so
test -f /lib/libc-2.23.so
observed_value=$(stat -c '%h %u' /lib/libc-2.23.so)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /lib/libc-2.23.so | awk '{print $1}')
[ "$observed_value" = 6479e377cd35c6e90e9aba990ac5137b195ca765544ad0c561f7f5945ea7133e ]
test ! -L /usr/lib/libQt5Core.so.5.9.4
test -f /usr/lib/libQt5Core.so.5.9.4
observed_value=$(stat -c '%h %u' /usr/lib/libQt5Core.so.5.9.4)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /usr/lib/libQt5Core.so.5.9.4 | awk '{print $1}')
[ "$observed_value" = b43e1cc628e625a422cfcf98aad38c9542b98cea28196ac4fd14931fd5ccf88d ]
test ! -L /usr/lib/libstdc++.so.6.0.20
test -f /usr/lib/libstdc++.so.6.0.20
observed_value=$(stat -c '%h %u' /usr/lib/libstdc++.so.6.0.20)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /usr/lib/libstdc++.so.6.0.20 | awk '{print $1}')
[ "$observed_value" = 93cc1352b59a0d3a39a8f9d311332f84115e3c5ee71afd846302b942071675c4 ]
observed_value=$(# CGS1_BOOT_LOCK
test ! -L /tmp
observed_value=$(stat -c '%a %u' /tmp)
[ "$observed_value" = '1777 0' ]
test ! -L /tmp/qingping-cgs1-esphome.lock
test -d /tmp/qingping-cgs1-esphome.lock
observed_value=$(stat -c '%a %u' /tmp/qingping-cgs1-esphome.lock)
[ "$observed_value" = '700 0' ]
observed_value=$(stat -f -c '%t' /tmp/qingping-cgs1-esphome.lock)
[ "$observed_value" = 1021994 ]
entries=$(LC_ALL=C ls -A1 /tmp/qingping-cgs1-esphome.lock)
[ "$entries" = "$(printf 'child.pid\\nsupervisor.pid')" ]
test ! -L /tmp/qingping-cgs1-esphome.lock/supervisor.pid
test -f /tmp/qingping-cgs1-esphome.lock/supervisor.pid
observed_value=$(stat -c '%a %u %h' /tmp/qingping-cgs1-esphome.lock/supervisor.pid)
[ "$observed_value" = '600 0 1' ]
value=$(cat /tmp/qingping-cgs1-esphome.lock/supervisor.pid)
case "$value" in (''|*[!0-9]*) exit 1;; esac
[ "\${#value}" -le 10 ]
printf '%s\\n' "$value"
test ! -L /tmp/qingping-cgs1-esphome.lock/child.pid
test -f /tmp/qingping-cgs1-esphome.lock/child.pid
observed_value=$(stat -c '%a %u %h' /tmp/qingping-cgs1-esphome.lock/child.pid)
[ "$observed_value" = '600 0 1' ]
value=$(cat /tmp/qingping-cgs1-esphome.lock/child.pid)
case "$value" in (''|*[!0-9]*) exit 1;; esac
[ "\${#value}" -le 10 ]
printf '%s\\n' "$value"
)
[ "$observed_value" = '`,{field:"supervisor_pid"},`
`,{field:"child_pid"},`' ]
entries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
 case "$entry" in (full-releases|wifi|full-state) exit 1;; esac
done
observed_value=$(cat /tmp/qingping-cgs1-esphome.lock/supervisor.pid)
[ "$observed_value" = `,{field:"supervisor_pid"},` ]
observed_value=$(cat /tmp/qingping-cgs1-esphome.lock/child.pid)
[ "$observed_value" = `,{field:"child_pid"},` ]
observed_value=$(count=0
for link in /proc/[0-9]*/exe; do
    count=$((count+1))
    [ "$count" -le 4096 ] || exit 1
    pid=\${link#/proc/}; pid=\${pid%/exe}
    case "$pid" in (''|*[!0-9]*) exit 1;; esac
    if executable=$(readlink "$link" 2>/dev/null); then
        :
    else
        # Kernel threads and exited tasks legitimately have no executable.
        # An unreadable live userspace exe is NOT evidence of its absence.
        [ -d "/proc/$pid" ] || continue
        metadata=$(sed 's/.*) //' "/proc/$pid/stat" 2>/dev/null | awk '{print $1, $7}')
        set -- $metadata
        if [ "$#" -ne 2 ]; then
            [ ! -d "/proc/$pid" ] && continue
            exit 1
        fi
        case "$2" in (''|*[!0-9]*) exit 1;; esac
        case "$1" in (Z|X|x) continue;; esac
        [ "$(($2 & 2097152))" -ne 0 ] || exit 1
        continue
    fi
    case "$executable" in
        (/data/.esphome-cgs1/*|/tmp/qingping-full-*/*|/tmp/qingping-initial-*/*)
case "$pid:$executable" in
(`,{field:"child_pid"},`:/data/.esphome-cgs1/program) :;;
(*) exit 1;;
esac;;
        (/data/bin/SnowApp) printf '%s\\n' "$pid";;
    esac
done)
[ "$observed_value" = `,{field:"stock_pid"},` ]
observed_value=$(readlink /proc/`,{field:"child_pid"},`/exe)
[ "$observed_value" = /data/.esphome-cgs1/program ]
observed_value=$(stat -c '%u' /proc/`,{field:"child_pid"},`)
[ "$observed_value" = 0 ]
observed_value=$(sed 's/.*) //' /proc/`,{field:"child_pid"},`/stat | awk '{print $20}')
[ "$observed_value" = `,{field:"child_birth"},` ]
process_state=$(sed 's/.*) //' /proc/`,{field:"child_pid"},`/stat | awk '{print $1}')
case "$process_state" in R|S|D|I) :;; *) exit 1;; esac
observed_value=$(readlink /proc/`,{field:"supervisor_pid"},`/exe)
[ "$observed_value" = /bin/busybox ]
observed_value=$(stat -c '%u' /proc/`,{field:"supervisor_pid"},`)
[ "$observed_value" = 0 ]
observed_value=$(sed 's/.*) //' /proc/`,{field:"supervisor_pid"},`/stat | awk '{print $20}')
[ "$observed_value" = `,{field:"supervisor_birth"},` ]
process_state=$(sed 's/.*) //' /proc/`,{field:"supervisor_pid"},`/stat | awk '{print $1}')
case "$process_state" in R|S|D|I) :;; *) exit 1;; esac
observed_value=$(readlink /proc/`,{field:"stock_pid"},`/exe)
[ "$observed_value" = /data/bin/SnowApp ]
observed_value=$(stat -c '%u' /proc/`,{field:"stock_pid"},`)
[ "$observed_value" = 0 ]
observed_value=$(sed 's/.*) //' /proc/`,{field:"stock_pid"},`/stat | awk '{print $20}')
[ "$observed_value" = `,{field:"stock_birth"},` ]
process_state=$(sed 's/.*) //' /proc/`,{field:"stock_pid"},`/stat | awk '{print $1}')
case "$process_state" in R|S|D|I) :;; *) exit 1;; esac
observed_value=$(readlink /proc/`,{field:"watchdog_pid"},`/exe)
[ "$observed_value" = /bin/busybox ]
observed_value=$(stat -c '%u' /proc/`,{field:"watchdog_pid"},`)
[ "$observed_value" = 0 ]
observed_value=$(sed 's/.*) //' /proc/`,{field:"watchdog_pid"},`/stat | awk '{print $20}')
[ "$observed_value" = `,{field:"watchdog_birth"},` ]
process_state=$(sed 's/.*) //' /proc/`,{field:"watchdog_pid"},`/stat | awk '{print $1}')
case "$process_state" in R|S|D|I) :;; *) exit 1;; esac
observed_value=$(sed 's/.*) //' /proc/`,{field:"stock_pid"},`/stat | awk '{print $2}')
[ "$observed_value" = `,{field:"watchdog_pid"},` ]
observed_value=$(sed 's/.*) //' /proc/`,{field:"child_pid"},`/stat | awk '{print $2}')
[ "$observed_value" = `,{field:"supervisor_pid"},` ]
arguments=$(tr '\\000' '\\n' < /proc/`,{field:"supervisor_pid"},`/cmdline)
[ "$arguments" = "$(printf '/bin/sh\\n/data/.esphome-cgs1/launch.sh\\nsupervise')" ]
arguments=$(tr '\\000' '\\n' < /proc/`,{field:"watchdog_pid"},`/cmdline)
[ "$arguments" = "$(printf '/bin/sh\\n/data/bin/watchdog.sh')" ]
test -r /proc/`,{field:"stock_pid"},`/maps
if grep -F -q /data/.esphome-cgs1/ /proc/`,{field:"stock_pid"},`/maps; then exit 1; else result=$?; [ "$result" -eq 1 ]; fi
test -r /proc/`,{field:"stock_pid"},`/maps
if grep -F -q /tmp/qingping-full- /proc/`,{field:"stock_pid"},`/maps; then exit 1; else result=$?; [ "$result" -eq 1 ]; fi
test -r /proc/`,{field:"stock_pid"},`/maps
if grep -F -q /tmp/qingping-initial- /proc/`,{field:"stock_pid"},`/maps; then exit 1; else result=$?; [ "$result" -eq 1 ]; fi
test ! -L /data/.esphome-cgs1/.initial-pm-enable.lock
test -d /data/.esphome-cgs1/.initial-pm-enable.lock
observed_value=$(stat -c '%a %u' /data/.esphome-cgs1/.initial-pm-enable.lock)
[ "$observed_value" = '700 0' ]
test ! -L /data/.esphome-cgs1/.initial-pm-enable.lock/owner
test -f /data/.esphome-cgs1/.initial-pm-enable.lock/owner
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/.initial-pm-enable.lock/owner)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/.initial-pm-enable.lock/owner | awk '{print $1}')
[ "$observed_value" = `,{field:"pm_owner_sha256"},` ]
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/.initial-pm-enable.lock/owner)
[ "$observed_value" = '186 600 0 1' ]
test ! -L /tmp
test -d /tmp
observed_value=$(stat -c '%a %u' /tmp)
[ "$observed_value" = '1777 0' ]
observed_value=$(stat -f -c '%t' /tmp)
[ "$observed_value" = 1021994 ]
test ! -L /tmp/qingping-pm-helper.attempted
test -f /tmp/qingping-pm-helper.attempted
observed_value=$(stat -c '%h %u' /tmp/qingping-pm-helper.attempted)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /tmp/qingping-pm-helper.attempted | awk '{print $1}')
[ "$observed_value" = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 ]
observed_value=$(stat -c '%s %a %u %h' /tmp/qingping-pm-helper.attempted)
[ "$observed_value" = '0 600 0 1' ]
test ! -L /data/.esphome-cgs1/pm-helper.disabled
test -f /data/.esphome-cgs1/pm-helper.disabled
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/pm-helper.disabled)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/pm-helper.disabled | awk '{print $1}')
[ "$observed_value" = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 ]
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/pm-helper.disabled)
[ "$observed_value" = '0 600 0 1' ]
test ! -L /data/.esphome-cgs1/pm-helper.disabled.before-initial-enable
test -f /data/.esphome-cgs1/pm-helper.disabled.before-initial-enable
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/pm-helper.disabled.before-initial-enable)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/pm-helper.disabled.before-initial-enable | awk '{print $1}')
[ "$observed_value" = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 ]
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/pm-helper.disabled.before-initial-enable)
[ "$observed_value" = '0 600 0 1' ]
entries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
 case "$entry" in (initial-pm-enable.complete) exit 1;; esac
done
rm /data/.esphome-cgs1/pm-helper.disabled
sync
entries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
 case "$entry" in (initial-pm-enable.complete) exit 1;; esac
done
printf '%s\\n' 'initial-pm-enable `,{field:"pm_nonce"}," ",{field:"plan_id"}," ",{field:"plan_sha256"}," ",{field:"boot_id"},`' > /data/.esphome-cgs1/initial-pm-enable.complete
sync
`],complete:[`test ! -L /data
test ! -L /data/.esphome-cgs1
test -d /data/.esphome-cgs1
observed_value=$(stat -c '%d %i %a %u' /data/.esphome-cgs1)
[ "$observed_value" = '`,{field:"root_device"}," ",{field:"root_inode"},` 700 0' ]
observed_value=$(cat /proc/sys/kernel/random/boot_id)
[ "$observed_value" = `,{field:"boot_id"},` ]
observed_value=$(cat /sys/class/net/wlan0/address)
[ "$observed_value" = `,{field:"wlan_mac"},` ]
observed_value=$(cat /data/etc/os-release)
[ "$observed_value" = CLEARGRASS_VERSION=4.1.8_0287 ]
observed_value=$(awk '
BEGIN { section=0; count=0 }
/^[ \\t]*\\[/ { section=($0 ~ /^[ \\t]*\\[sensors\\][ \\t]*\\r?$/) }
section && /^[ \\t]*co2_type[ \\t]*=/ {
    value=$0; sub(/^[^=]*=[ \\t]*/, "", value); sub(/[ \\t\\r]*$/, "", value)
    print value; count++
}
END { if (count != 1) exit 1 }
' /data/etc/setting.ini)
`,'[ "$observed_value" = ',{field:"co2_type"}," ]",`
test ! -L /data/.esphome-cgs1/install.intent
test -f /data/.esphome-cgs1/install.intent
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/install.intent)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/install.intent | awk '{print $1}')
[ "$observed_value" = `,{field:"install_marker_sha256"},` ]
test ! -L /data/.esphome-cgs1/.initial-pm-enable.lock/owner
test -f /data/.esphome-cgs1/.initial-pm-enable.lock/owner
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/.initial-pm-enable.lock/owner)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/.initial-pm-enable.lock/owner | awk '{print $1}')
[ "$observed_value" = `,{field:"pm_owner_sha256"},` ]
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/.initial-pm-enable.lock/owner)
[ "$observed_value" = '186 600 0 1' ]
test ! -L /data/.esphome-cgs1/initial-pm-enable.complete
test -f /data/.esphome-cgs1/initial-pm-enable.complete
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/initial-pm-enable.complete)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/initial-pm-enable.complete | awk '{print $1}')
[ "$observed_value" = `,{field:"pm_owner_sha256"},` ]
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/initial-pm-enable.complete)
[ "$observed_value" = '186 600 0 1' ]
test ! -L /data/.esphome-cgs1/.initial-pm-enable.lock
test -d /data/.esphome-cgs1/.initial-pm-enable.lock
observed_value=$(stat -c '%a %u' /data/.esphome-cgs1/.initial-pm-enable.lock)
[ "$observed_value" = '700 0' ]
entries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
 case "$entry" in (pm-helper.disabled) exit 1;; esac
done
entries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
 case "$entry" in (disabled) exit 1;; esac
done
test ! -L /data/.esphome-cgs1/pm-helper.disabled.before-initial-enable
test -f /data/.esphome-cgs1/pm-helper.disabled.before-initial-enable
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/pm-helper.disabled.before-initial-enable)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/pm-helper.disabled.before-initial-enable | awk '{print $1}')
[ "$observed_value" = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 ]
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/pm-helper.disabled.before-initial-enable)
[ "$observed_value" = '0 600 0 1' ]
test ! -L /tmp/qingping-pm-helper.attempted
test -f /tmp/qingping-pm-helper.attempted
observed_value=$(stat -c '%h %u' /tmp/qingping-pm-helper.attempted)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /tmp/qingping-pm-helper.attempted | awk '{print $1}')
[ "$observed_value" = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 ]
observed_value=$(stat -c '%s %a %u %h' /tmp/qingping-pm-helper.attempted)
[ "$observed_value" = '0 600 0 1' ]
test ! -L /tmp
test -d /tmp
observed_value=$(stat -c '%a %u' /tmp)
[ "$observed_value" = '1777 0' ]
observed_value=$(stat -f -c '%t' /tmp)
[ "$observed_value" = 1021994 ]
observed_value=$(stat -f -c '%t' /data/.esphome-cgs1)
[ "$observed_value" = ef53 ]
test ! -L /data/.esphome-cgs1/program
test -f /data/.esphome-cgs1/program
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/program)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/program | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_sha_0"},` ]
test ! -L /data/.esphome-cgs1/pm_qt_bridge.so
test -f /data/.esphome-cgs1/pm_qt_bridge.so
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/pm_qt_bridge.so)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/pm_qt_bridge.so | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_sha_1"},` ]
test ! -L /data/.esphome-cgs1/launch.sh
test -f /data/.esphome-cgs1/launch.sh
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/launch.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/launch.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_sha_2"},` ]
test ! -L /data/.esphome-cgs1/SnowApp-with-PM
test -f /data/.esphome-cgs1/SnowApp-with-PM
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/SnowApp-with-PM)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/SnowApp-with-PM | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_sha_3"},` ]
test ! -L /data/.esphome-cgs1/startup-hook.sh
test -f /data/.esphome-cgs1/startup-hook.sh
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/startup-hook.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/startup-hook.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_sha_4"},` ]
test ! -L /data/.esphome-cgs1/stock-start.sh.original
test -f /data/.esphome-cgs1/stock-start.sh.original
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/stock-start.sh.original)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/stock-start.sh.original | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_sha_5"},` ]
test ! -L /data/.esphome-cgs1/stock-watchdog.sh.original
test -f /data/.esphome-cgs1/stock-watchdog.sh.original
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/stock-watchdog.sh.original)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/stock-watchdog.sh.original | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_sha_6"},` ]
test ! -L /data/.esphome-cgs1/start.sh.candidate
test -f /data/.esphome-cgs1/start.sh.candidate
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/start.sh.candidate)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/start.sh.candidate | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_sha_7"},` ]
test ! -L /data/.esphome-cgs1/watchdog.sh.candidate
test -f /data/.esphome-cgs1/watchdog.sh.candidate
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/watchdog.sh.candidate)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/watchdog.sh.candidate | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_sha_8"},` ]
`]}};var ht={schema_version:1,source_commit:"53d97b9609e8e0fcdfc5d003101f620098dbc734",source_sha256:{"arm_bridge_next_boot_adb.py":"ab3dee1e5761f160e4c0905e1253d0fe29b06064a8b8b65a91177b33ecc934a1","bootstrap_patches.py":"12bc6fb3fadfe6c0101130914c3dafe7db243669b8a000e83806ff0afd66f959","commit_disabled_install.py":"b78470c8fe3f6275d2eca07067ec56beb858f11d8037b435be08f9f6781b4408","disabled_commit_policy.py":"ad8b50cd9c112f37b40bb1f3a77ba2ca598bf307deb1817ea1fdda4c492f2ab7","preflight_adb.py":"128cf367baeee28bcfb4156256548fdded689a42d50662e77580fdd71ab19b47","review_disabled_install.py":"174d4e23e1aaf4c386ab7afcf280a7b99b169ca877130ad1f556295a28850d1a","review_initial_trial.py":"d9f2f022edbbe190d8c8b0ccbb87071f9c6dfcb53320f8e53232264ac71cc0b4","stage_install_adb.py":"7546caa212b3b44b1a3d8717e550b7bfd5f0893a342c80c6e847cfd2be56b8eb","trial_initial_bridge_adb.py":"4f29bb503dd2d792a42aa2a642505edd2ccf84a3eb35ae7a8964b39006aaf032","verify_bridge_boot_adb.py":"2c7029ed1781289f406051138f538461c441fab498becd39d3b3ea468cdb6114"},reads:[{key:"identity_uid",parts:["id -u"]},{key:"identity_wlan",parts:["cat /sys/class/net/wlan0/address"]},{key:"identity_version",parts:["cat /data/etc/os-release"]},{key:"identity_architecture",parts:["uname -m"]},{key:"identity_co2",parts:[`awk '
BEGIN { section=0; count=0 }
/^[ \\t]*\\[/ { section=($0 ~ /^[ \\t]*\\[sensors\\][ \\t]*\\r?$/) }
section && /^[ \\t]*co2_type[ \\t]*=/ {
    value=$0; sub(/^[^=]*=[ \\t]*/, "", value); sub(/[ \\t\\r]*$/, "", value)
    print value; count++
}
END { if (count != 1) exit 1 }
' /data/etc/setting.ini`]},{key:"identity_boot",parts:["cat /proc/sys/kernel/random/boot_id"]},{key:"root",parts:[`test ! -L /data/.esphome-cgs1
test -d /data/.esphome-cgs1
stat -c '%d %i %a %u' /data/.esphome-cgs1
test ! -L /data/.esphome-cgs1/install.intent
test -f /data/.esphome-cgs1/install.intent
[ "$(stat -c '%s %a %u %h' /data/.esphome-cgs1/install.intent)" = '98 600 0 1' ]
cat /data/.esphome-cgs1/install.intent`]},{key:"parents",parts:[`test ! -L /data/bin
test ! -L /data/etc
test ! -L /data/etc/init.d
stat -c '%d' /data/bin /data/etc/init.d`]},{key:"commit_marker",parts:[`# CGS1_INITIAL_COMMIT_MARKER
test ! -L /data/.esphome-cgs1/.commit-disabled.lock
test -d /data/.esphome-cgs1/.commit-disabled.lock
observed_value=$(stat -c '%a %u' /data/.esphome-cgs1/.commit-disabled.lock)
[ "$observed_value" = '700 0' ]
test ! -L /data/.esphome-cgs1/.commit-disabled.lock/owner
test -f /data/.esphome-cgs1/.commit-disabled.lock/owner
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/.commit-disabled.lock/owner)
[ "$observed_value" = '82 600 0 1' ]
cat /data/.esphome-cgs1/.commit-disabled.lock/owner`]},{key:"completion_guard",parts:[`# CGS1_BRIDGE_COMPLETION arm
test ! -L /data/.esphome-cgs1/bridge-next-boot.complete
test -f /data/.esphome-cgs1/bridge-next-boot.complete
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/bridge-next-boot.complete)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/bridge-next-boot.complete | awk '{print $1}')
[ "$observed_value" = `,{field:"completion_sha256"},` ]
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/bridge-next-boot.complete)
[ "$observed_value" = '135 600 0 1' ]
observed_value=$(cat /data/.esphome-cgs1/bridge-next-boot.complete)
[ "$observed_value" = 'arm `,{field:"nonce"}," ",{field:"plan_id"}," ",{field:"plan_sha256"},`' ]
`]},{key:"armed_flags",parts:[`entries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
 case "$entry" in (disabled) exit 1;; esac
done
entries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
 case "$entry" in (bridge-disarm-before-boot.complete) exit 1;; esac
done
test ! -L /data/.esphome-cgs1/disabled.before-next-boot
test -f /data/.esphome-cgs1/disabled.before-next-boot
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/disabled.before-next-boot)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/disabled.before-next-boot | awk '{print $1}')
[ "$observed_value" = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 ]
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/disabled.before-next-boot)
[ "$observed_value" = '0 600 0 1' ]
`]},{key:"pm_flag",parts:[`test ! -L /data/.esphome-cgs1/pm-helper.disabled
test -f /data/.esphome-cgs1/pm-helper.disabled
stat -c '%s %a %u %h' /data/.esphome-cgs1/pm-helper.disabled
sha256sum /data/.esphome-cgs1/pm-helper.disabled`]},{key:"bridge_layout",parts:[`entries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
 case "$entry" in (full-releases|wifi|full-state) exit 1;; esac
done
test ! -L /data/.esphome-cgs1/prefs
test -d /data/.esphome-cgs1/prefs
observed_value=$(stat -c '%a %u' /data/.esphome-cgs1/prefs)
[ "$observed_value" = '700 0' ]
`]},{key:"staged_0",parts:[`test ! -L /data/.esphome-cgs1/program
test -f /data/.esphome-cgs1/program
stat -c '%s %h' /data/.esphome-cgs1/program
sha256sum /data/.esphome-cgs1/program`]},{key:"staged_1",parts:[`test ! -L /data/.esphome-cgs1/pm_qt_bridge.so
test -f /data/.esphome-cgs1/pm_qt_bridge.so
stat -c '%s %h' /data/.esphome-cgs1/pm_qt_bridge.so
sha256sum /data/.esphome-cgs1/pm_qt_bridge.so`]},{key:"staged_2",parts:[`test ! -L /data/.esphome-cgs1/launch.sh
test -f /data/.esphome-cgs1/launch.sh
stat -c '%s %h' /data/.esphome-cgs1/launch.sh
sha256sum /data/.esphome-cgs1/launch.sh`]},{key:"staged_3",parts:[`test ! -L /data/.esphome-cgs1/SnowApp-with-PM
test -f /data/.esphome-cgs1/SnowApp-with-PM
stat -c '%s %h' /data/.esphome-cgs1/SnowApp-with-PM
sha256sum /data/.esphome-cgs1/SnowApp-with-PM`]},{key:"staged_4",parts:[`test ! -L /data/.esphome-cgs1/startup-hook.sh
test -f /data/.esphome-cgs1/startup-hook.sh
stat -c '%s %h' /data/.esphome-cgs1/startup-hook.sh
sha256sum /data/.esphome-cgs1/startup-hook.sh`]},{key:"staged_5",parts:[`test ! -L /data/.esphome-cgs1/stock-start.sh.original
test -f /data/.esphome-cgs1/stock-start.sh.original
stat -c '%s %h' /data/.esphome-cgs1/stock-start.sh.original
sha256sum /data/.esphome-cgs1/stock-start.sh.original`]},{key:"staged_6",parts:[`test ! -L /data/.esphome-cgs1/stock-watchdog.sh.original
test -f /data/.esphome-cgs1/stock-watchdog.sh.original
stat -c '%s %h' /data/.esphome-cgs1/stock-watchdog.sh.original
sha256sum /data/.esphome-cgs1/stock-watchdog.sh.original`]},{key:"staged_7",parts:[`test ! -L /data/.esphome-cgs1/start.sh.candidate
test -f /data/.esphome-cgs1/start.sh.candidate
stat -c '%s %h' /data/.esphome-cgs1/start.sh.candidate
sha256sum /data/.esphome-cgs1/start.sh.candidate`]},{key:"staged_8",parts:[`test ! -L /data/.esphome-cgs1/watchdog.sh.candidate
test -f /data/.esphome-cgs1/watchdog.sh.candidate
stat -c '%s %h' /data/.esphome-cgs1/watchdog.sh.candidate
sha256sum /data/.esphome-cgs1/watchdog.sh.candidate`]},{key:"vendor_0",parts:[`test ! -L /data/bin/SnowApp
test -f /data/bin/SnowApp
stat -c '%s %h' /data/bin/SnowApp
sha256sum /data/bin/SnowApp`]},{key:"vendor_1",parts:[`test ! -L /data/bin/watchdog.sh
test -f /data/bin/watchdog.sh
stat -c '%s %h' /data/bin/watchdog.sh
sha256sum /data/bin/watchdog.sh`]},{key:"vendor_2",parts:[`test ! -L /data/etc/init.d/start.sh
test -f /data/etc/init.d/start.sh
stat -c '%s %h' /data/etc/init.d/start.sh
sha256sum /data/etc/init.d/start.sh`]},{key:"vendor_3",parts:[`test ! -L /etc/init.d/S12_launcher_init
test -f /etc/init.d/S12_launcher_init
stat -c '%s %h' /etc/init.d/S12_launcher_init
sha256sum /etc/init.d/S12_launcher_init`]},{key:"vendor_4",parts:[`test ! -L /etc/init.d/S50_px3se_init
test -f /etc/init.d/S50_px3se_init
stat -c '%s %h' /etc/init.d/S50_px3se_init
sha256sum /etc/init.d/S50_px3se_init`]},{key:"vendor_5",parts:[`test ! -L /lib/ld-2.23.so
test -f /lib/ld-2.23.so
stat -c '%s %h' /lib/ld-2.23.so
sha256sum /lib/ld-2.23.so`]},{key:"vendor_6",parts:[`test ! -L /lib/libc-2.23.so
test -f /lib/libc-2.23.so
stat -c '%s %h' /lib/libc-2.23.so
sha256sum /lib/libc-2.23.so`]},{key:"vendor_7",parts:[`test ! -L /usr/lib/libstdc++.so.6.0.20
test -f /usr/lib/libstdc++.so.6.0.20
stat -c '%s %h' /usr/lib/libstdc++.so.6.0.20
sha256sum /usr/lib/libstdc++.so.6.0.20`]},{key:"vendor_8",parts:[`test ! -L /usr/lib/libQt5Core.so.5.9.4
test -f /usr/lib/libQt5Core.so.5.9.4
stat -c '%s %h' /usr/lib/libQt5Core.so.5.9.4
sha256sum /usr/lib/libQt5Core.so.5.9.4`]},{key:"lock",parts:[`# CGS1_BOOT_LOCK
test ! -L /tmp
observed_value=$(stat -c '%a %u' /tmp)
[ "$observed_value" = '1777 0' ]
test ! -L /tmp/qingping-cgs1-esphome.lock
test -d /tmp/qingping-cgs1-esphome.lock
observed_value=$(stat -c '%a %u' /tmp/qingping-cgs1-esphome.lock)
[ "$observed_value" = '700 0' ]
observed_value=$(stat -f -c '%t' /tmp/qingping-cgs1-esphome.lock)
[ "$observed_value" = 1021994 ]
entries=$(LC_ALL=C ls -A1 /tmp/qingping-cgs1-esphome.lock)
[ "$entries" = "$(printf 'child.pid\\nsupervisor.pid')" ]
test ! -L /tmp/qingping-cgs1-esphome.lock/supervisor.pid
test -f /tmp/qingping-cgs1-esphome.lock/supervisor.pid
observed_value=$(stat -c '%a %u %h' /tmp/qingping-cgs1-esphome.lock/supervisor.pid)
[ "$observed_value" = '600 0 1' ]
value=$(cat /tmp/qingping-cgs1-esphome.lock/supervisor.pid)
case "$value" in (''|*[!0-9]*) exit 1;; esac
[ "\${#value}" -le 10 ]
printf '%s\\n' "$value"
test ! -L /tmp/qingping-cgs1-esphome.lock/child.pid
test -f /tmp/qingping-cgs1-esphome.lock/child.pid
observed_value=$(stat -c '%a %u %h' /tmp/qingping-cgs1-esphome.lock/child.pid)
[ "$observed_value" = '600 0 1' ]
value=$(cat /tmp/qingping-cgs1-esphome.lock/child.pid)
case "$value" in (''|*[!0-9]*) exit 1;; esac
[ "\${#value}" -le 10 ]
printf '%s\\n' "$value"
`]},{key:"child",parts:["cat /proc/",{field:"child_pid"},`/stat
stat -c '%u' /proc/`,{field:"child_pid"},`
readlink /proc/`,{field:"child_pid"},"/exe"]},{key:"supervisor",parts:["cat /proc/",{field:"supervisor_pid"},`/stat
stat -c '%u' /proc/`,{field:"supervisor_pid"},`
readlink /proc/`,{field:"supervisor_pid"},"/exe"]},{key:"child_image_process_before",parts:["cat /proc/",{field:"child_pid"},`/stat
stat -c '%u' /proc/`,{field:"child_pid"},`
readlink /proc/`,{field:"child_pid"},"/exe"]},{key:"child_image_file",parts:[`test ! -L /data/.esphome-cgs1/program
test -f /data/.esphome-cgs1/program
stat -c '%s %h' /data/.esphome-cgs1/program
sha256sum /data/.esphome-cgs1/program`]},{key:"child_image",parts:["stat -L -c '%d %i %s %a %u %h' /proc/",{field:"child_pid"},`/exe
stat -c '%d %i %s %a %u %h' /data/.esphome-cgs1/program
sha256sum /proc/`,{field:"child_pid"},"/exe"]},{key:"child_image_process_after",parts:["cat /proc/",{field:"child_pid"},`/stat
stat -c '%u' /proc/`,{field:"child_pid"},`
readlink /proc/`,{field:"child_pid"},"/exe"]},{key:"supervisor_image",parts:[`test ! -L /bin/busybox
test -f /bin/busybox
stat -L -c '%d %i %s %u %h' /proc/`,{field:"supervisor_pid"},`/exe
stat -c '%d %i %s %u %h' /bin/busybox`]},{key:"supervisor_arguments",parts:["arguments=$(tr '\\000' '\\n' < /proc/",{field:"supervisor_pid"},`/cmdline)
[ "$arguments" = "$(printf '/bin/sh\\n/data/.esphome-cgs1/launch.sh\\nsupervise')" ]
`]},{key:"process_scan",parts:[`count=0
for link in /proc/[0-9]*/exe; do
    count=$((count+1))
    [ "$count" -le 4096 ] || exit 1
    pid=\${link#/proc/}; pid=\${pid%/exe}
    case "$pid" in (''|*[!0-9]*) exit 1;; esac
    if executable=$(readlink "$link" 2>/dev/null); then
        :
    else
        # Kernel threads and exited tasks legitimately have no executable.
        # An unreadable live userspace exe is NOT evidence of its absence.
        [ -d "/proc/$pid" ] || continue
        metadata=$(sed 's/.*) //' "/proc/$pid/stat" 2>/dev/null | awk '{print $1, $7}')
        set -- $metadata
        if [ "$#" -ne 2 ]; then
            [ ! -d "/proc/$pid" ] && continue
            exit 1
        fi
        case "$2" in (''|*[!0-9]*) exit 1;; esac
        case "$1" in (Z|X|x) continue;; esac
        [ "$(($2 & 2097152))" -ne 0 ] || exit 1
        continue
    fi
    case "$executable" in
        (/data/.esphome-cgs1/*|/tmp/qingping-full-*/*|/tmp/qingping-initial-*/*)
case "$pid:$executable" in
(`,{field:"child_pid"},`:/data/.esphome-cgs1/program) :;;
(*) exit 1;;
esac;;
        (/data/bin/SnowApp) printf '%s\\n' "$pid";;
    esac
done`]},{key:"stock",parts:["cat /proc/",{field:"stock_pid"},`/stat
stat -c '%u' /proc/`,{field:"stock_pid"},`
readlink /proc/`,{field:"stock_pid"},"/exe"]},{key:"watchdog",parts:["cat /proc/",{field:"watchdog_pid"},`/stat
stat -c '%u' /proc/`,{field:"watchdog_pid"},`
readlink /proc/`,{field:"watchdog_pid"},"/exe"]},{key:"stock_image",parts:[`test ! -L /data/bin/SnowApp
test -f /data/bin/SnowApp
stat -L -c '%d %i %s %u %h' /proc/`,{field:"stock_pid"},`/exe
stat -c '%d %i %s %u %h' /data/bin/SnowApp`]},{key:"watchdog_image",parts:[`test ! -L /bin/busybox
test -f /bin/busybox
stat -L -c '%d %i %s %u %h' /proc/`,{field:"watchdog_pid"},`/exe
stat -c '%d %i %s %u %h' /bin/busybox`]},{key:"watchdog_arguments",parts:["arguments=$(tr '\\000' '\\n' < /proc/",{field:"watchdog_pid"},`/cmdline)
[ "$arguments" = "$(printf '/bin/sh\\n/data/bin/watchdog.sh')" ]
`]},{key:"stock_maps_0",parts:["test -r /proc/",{field:"stock_pid"},`/maps
if grep -F -q /data/.esphome-cgs1/ /proc/`,{field:"stock_pid"},'/maps; then exit 1; else result=$?; [ "$result" -eq 1 ]; fi']},{key:"stock_maps_1",parts:["test -r /proc/",{field:"stock_pid"},`/maps
if grep -F -q /tmp/qingping-full- /proc/`,{field:"stock_pid"},'/maps; then exit 1; else result=$?; [ "$result" -eq 1 ]; fi']},{key:"stock_maps_2",parts:["test -r /proc/",{field:"stock_pid"},`/maps
if grep -F -q /tmp/qingping-initial- /proc/`,{field:"stock_pid"},'/maps; then exit 1; else result=$?; [ "$result" -eq 1 ]; fi']},{key:"endpoint",parts:[`sockets=' '
count=0
for file in /proc/`,{field:"child_pid"},`/fd/*; do
 count=$((count+1)); [ "$count" -le 4096 ] || exit 1
 link=$(readlink "$file")
 case "$link" in (socket:\\[*\\]) inode=\${link#socket:}; inode=\${inode#\\[}; inode=\${inode%\\]}; case "$inode" in (''|*[!0-9]*) exit 1;; esac; sockets="$sockets$inode ";; esac
done
for table in /proc/net/tcp /proc/net/tcp6; do
 test -r "$table"
 awk -v owned="$sockets" '
 NR==1 { if ($2!="local_address") bad=1; next }
 { count=split($2, local, ":"); port=toupper(local[2]); address=toupper(local[1]); state=toupper($4);
   if ($1 !~ /^[0-9]+:$/ || NF<10 || count!=2 || (length(address)!=8 && length(address)!=32) ||
       address ~ /[^0-9A-F]/ || length(port)!=4 || port ~ /[^0-9A-F]/ ||
       length(state)!=2 || state ~ /[^0-9A-F]/ || $10 !~ /^[0-9]+$/) bad=1;
   if (port=="17A5" || port=="0CA0") {
     if ($10 !~ /^[1-9][0-9]*$/ || index(owned, " " $10 " ")==0) bad=1;
     if (state=="0A") print FILENAME, port;
   }
 }
 END { if (!NR || bad) exit 1 }
 ' "$table"
done`]},{key:"memory",parts:[`# CGS1_INITIAL_MEMORY
awk '$1 == "MemTotal:" || $1 == "MemFree:" { print }' /proc/meminfo`]},{key:"child_after",parts:["cat /proc/",{field:"child_pid"},`/stat
stat -c '%u' /proc/`,{field:"child_pid"},`
readlink /proc/`,{field:"child_pid"},"/exe"]},{key:"supervisor_after",parts:["cat /proc/",{field:"supervisor_pid"},`/stat
stat -c '%u' /proc/`,{field:"supervisor_pid"},`
readlink /proc/`,{field:"supervisor_pid"},"/exe"]},{key:"stock_after",parts:["cat /proc/",{field:"stock_pid"},`/stat
stat -c '%u' /proc/`,{field:"stock_pid"},`
readlink /proc/`,{field:"stock_pid"},"/exe"]},{key:"watchdog_after",parts:["cat /proc/",{field:"watchdog_pid"},`/stat
stat -c '%u' /proc/`,{field:"watchdog_pid"},`
readlink /proc/`,{field:"watchdog_pid"},"/exe"]},{key:"lock_after",parts:[`# CGS1_BOOT_LOCK
test ! -L /tmp
observed_value=$(stat -c '%a %u' /tmp)
[ "$observed_value" = '1777 0' ]
test ! -L /tmp/qingping-cgs1-esphome.lock
test -d /tmp/qingping-cgs1-esphome.lock
observed_value=$(stat -c '%a %u' /tmp/qingping-cgs1-esphome.lock)
[ "$observed_value" = '700 0' ]
observed_value=$(stat -f -c '%t' /tmp/qingping-cgs1-esphome.lock)
[ "$observed_value" = 1021994 ]
entries=$(LC_ALL=C ls -A1 /tmp/qingping-cgs1-esphome.lock)
[ "$entries" = "$(printf 'child.pid\\nsupervisor.pid')" ]
test ! -L /tmp/qingping-cgs1-esphome.lock/supervisor.pid
test -f /tmp/qingping-cgs1-esphome.lock/supervisor.pid
observed_value=$(stat -c '%a %u %h' /tmp/qingping-cgs1-esphome.lock/supervisor.pid)
[ "$observed_value" = '600 0 1' ]
value=$(cat /tmp/qingping-cgs1-esphome.lock/supervisor.pid)
case "$value" in (''|*[!0-9]*) exit 1;; esac
[ "\${#value}" -le 10 ]
printf '%s\\n' "$value"
test ! -L /tmp/qingping-cgs1-esphome.lock/child.pid
test -f /tmp/qingping-cgs1-esphome.lock/child.pid
observed_value=$(stat -c '%a %u %h' /tmp/qingping-cgs1-esphome.lock/child.pid)
[ "$observed_value" = '600 0 1' ]
value=$(cat /tmp/qingping-cgs1-esphome.lock/child.pid)
case "$value" in (''|*[!0-9]*) exit 1;; esac
[ "\${#value}" -le 10 ]
printf '%s\\n' "$value"
`]},{key:"identity_uid_after",parts:["id -u"]},{key:"identity_wlan_after",parts:["cat /sys/class/net/wlan0/address"]},{key:"identity_version_after",parts:["cat /data/etc/os-release"]},{key:"identity_architecture_after",parts:["uname -m"]},{key:"identity_co2_after",parts:[`awk '
BEGIN { section=0; count=0 }
/^[ \\t]*\\[/ { section=($0 ~ /^[ \\t]*\\[sensors\\][ \\t]*\\r?$/) }
section && /^[ \\t]*co2_type[ \\t]*=/ {
    value=$0; sub(/^[^=]*=[ \\t]*/, "", value); sub(/[ \\t\\r]*$/, "", value)
    print value; count++
}
END { if (count != 1) exit 1 }
' /data/etc/setting.ini`]},{key:"identity_boot_after",parts:["cat /proc/sys/kernel/random/boot_id"]},{key:"root_after",parts:[`test ! -L /data/.esphome-cgs1
test -d /data/.esphome-cgs1
stat -c '%d %i %a %u' /data/.esphome-cgs1
test ! -L /data/.esphome-cgs1/install.intent
test -f /data/.esphome-cgs1/install.intent
[ "$(stat -c '%s %a %u %h' /data/.esphome-cgs1/install.intent)" = '98 600 0 1' ]
cat /data/.esphome-cgs1/install.intent`]},{key:"parents_after",parts:[`test ! -L /data/bin
test ! -L /data/etc
test ! -L /data/etc/init.d
stat -c '%d' /data/bin /data/etc/init.d`]}]};var ut={schema_version:1,staged_roles:["bridge-program","pm_qt_bridge.so","launch.sh","SnowApp-with-PM","startup-hook.sh","stock-start.sh.original","stock-watchdog.sh.original","start.sh.candidate","watchdog.sh.candidate"],vendor_paths:["/data/bin/SnowApp","/data/bin/watchdog.sh","/data/etc/init.d/start.sh","/etc/init.d/S12_launcher_init","/etc/init.d/S50_px3se_init","/lib/ld-2.23.so","/lib/libc-2.23.so","/usr/lib/libQt5Core.so.5.9.4","/usr/lib/libstdc++.so.6.0.20"],source_sha256:{"arm_bridge_next_boot_adb.py":"ab3dee1e5761f160e4c0905e1253d0fe29b06064a8b8b65a91177b33ecc934a1","commit_disabled_install.py":"b78470c8fe3f6275d2eca07067ec56beb858f11d8037b435be08f9f6781b4408","stage_install_adb.py":"7546caa212b3b44b1a3d8717e550b7bfd5f0893a342c80c6e847cfd2be56b8eb","review_disabled_install.py":"174d4e23e1aaf4c386ab7afcf280a7b99b169ca877130ad1f556295a28850d1a","disabled_commit_policy.py":"ad8b50cd9c112f37b40bb1f3a77ba2ca598bf307deb1817ea1fdda4c492f2ab7","bootstrap_patches.py":"12bc6fb3fadfe6c0101130914c3dafe7db243669b8a000e83806ff0afd66f959","preflight_adb.py":"128cf367baeee28bcfb4156256548fdded689a42d50662e77580fdd71ab19b47","review_initial_trial.py":"d9f2f022edbbe190d8c8b0ccbb87071f9c6dfcb53320f8e53232264ac71cc0b4","trial_initial_bridge_adb.py":"4f29bb503dd2d792a42aa2a642505edd2ccf84a3eb35ae7a8964b39006aaf032"},templates:{before:[`# CGS1_BRIDGE_NEXT_BOOT_SCOPE disabled
test ! -L /data/.esphome-cgs1
test -d /data/.esphome-cgs1
observed_value=$(stat -c '%d %i %a %u' /data/.esphome-cgs1)
[ "$observed_value" = '`,{field:"root_device"}," ",{field:"root_inode"},` 700 0' ]
test ! -L /data/bin
test ! -L /data/etc
test ! -L /data/etc/init.d
observed_value=$(stat -c '%d' /data/bin)
[ "$observed_value" = `,{field:"root_device"},` ]
observed_value=$(stat -c '%d' /data/etc/init.d)
[ "$observed_value" = `,{field:"root_device"},` ]
test ! -L /data/.esphome-cgs1/install.intent
test -f /data/.esphome-cgs1/install.intent
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/install.intent)
[ "$observed_value" = '98 600 0 1' ]
observed_value=$(cat /data/.esphome-cgs1/install.intent)
[ "$observed_value" = '`,{field:"plan_id"}," ",{field:"plan_sha256"},`' ]
test ! -L /data/.esphome-cgs1/disabled
test -f /data/.esphome-cgs1/disabled
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/disabled)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/disabled | awk '{print $1}')
[ "$observed_value" = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 ]
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/disabled)
[ "$observed_value" = '0 600 0 1' ]
entries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
 case "$entry" in (disabled.before-next-boot) exit 1;; esac
done
test ! -L /data/.esphome-cgs1/pm-helper.disabled
test -f /data/.esphome-cgs1/pm-helper.disabled
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/pm-helper.disabled)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/pm-helper.disabled | awk '{print $1}')
[ "$observed_value" = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 ]
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/pm-helper.disabled)
[ "$observed_value" = '0 600 0 1' ]
observed_value=$(cat /sys/class/net/wlan0/address)
[ "$observed_value" = `,{field:"wlan_mac"},` ]
observed_value=$(cat /data/etc/os-release)
[ "$observed_value" = CLEARGRASS_VERSION=4.1.8_0287 ]
observed_value=$(cat /proc/sys/kernel/random/boot_id)
[ "$observed_value" = `,{field:"boot_id"},` ]
observed_value=$(awk '
BEGIN { section=0; count=0 }
/^[ \\t]*\\[/ { section=($0 ~ /^[ \\t]*\\[sensors\\][ \\t]*\\r?$/) }
section && /^[ \\t]*co2_type[ \\t]*=/ {
    value=$0; sub(/^[^=]*=[ \\t]*/, "", value); sub(/[ \\t\\r]*$/, "", value)
    print value; count++
}
END { if (count != 1) exit 1 }
' /data/etc/setting.ini)
[ "$observed_value" = `,{field:"co2_type"},` ]
observed_value=$(count=0
for link in /proc/[0-9]*/exe; do
    count=$((count+1))
    [ "$count" -le 4096 ] || exit 1
    pid=\${link#/proc/}; pid=\${pid%/exe}
    case "$pid" in (''|*[!0-9]*) exit 1;; esac
    if executable=$(readlink "$link" 2>/dev/null); then
        :
    else
        # Kernel threads and exited tasks legitimately have no executable.
        # An unreadable live userspace exe is NOT evidence of its absence.
        [ -d "/proc/$pid" ] || continue
        metadata=$(sed 's/.*) //' "/proc/$pid/stat" 2>/dev/null | awk '{print $1, $7}')
        set -- $metadata
        if [ "$#" -ne 2 ]; then
            [ ! -d "/proc/$pid" ] && continue
            exit 1
        fi
        case "$2" in (''|*[!0-9]*) exit 1;; esac
        case "$1" in (Z|X|x) continue;; esac
        [ "$(($2 & 2097152))" -ne 0 ] || exit 1
        continue
    fi
    case "$executable" in
        (/data/.esphome-cgs1/*|/tmp/qingping-full-*/*|/tmp/qingping-initial-*/*) exit 1;;
        (/data/bin/SnowApp) printf '%s\\n' "$pid";;
    esac
done)
[ "$observed_value" = `,{field:"stock_pid"},` ]
observed_value=$(readlink /proc/`,{field:"stock_pid"},`/exe)
[ "$observed_value" = /data/bin/SnowApp ]
observed_value=$(stat -c '%u' /proc/`,{field:"stock_pid"},`)
[ "$observed_value" = 0 ]
observed_value=$(sed 's/.*) //' /proc/`,{field:"stock_pid"},`/stat | awk '{print $20}')
[ "$observed_value" = `,{field:"stock_start"},` ]
process_state=$(sed 's/.*) //' /proc/`,{field:"stock_pid"},`/stat | awk '{print $1}')
case "$process_state" in R|S|D|I) :;; *) exit 1;; esac
observed_value=$(readlink /proc/`,{field:"watchdog_pid"},`/exe)
[ "$observed_value" = /bin/busybox ]
observed_value=$(stat -c '%u' /proc/`,{field:"watchdog_pid"},`)
[ "$observed_value" = 0 ]
observed_value=$(sed 's/.*) //' /proc/`,{field:"watchdog_pid"},`/stat | awk '{print $20}')
[ "$observed_value" = `,{field:"watchdog_start"},` ]
process_state=$(sed 's/.*) //' /proc/`,{field:"watchdog_pid"},`/stat | awk '{print $1}')
case "$process_state" in R|S|D|I) :;; *) exit 1;; esac
observed_value=$(sed 's/.*) //' /proc/`,{field:"stock_pid"},`/stat | awk '{print $2}')
[ "$observed_value" = `,{field:"watchdog_pid"},` ]
arguments=$(tr '\\000' '\\n' < /proc/`,{field:"watchdog_pid"},`/cmdline)
[ "$arguments" = "$(printf '/bin/sh\\n/data/bin/watchdog.sh')" ]
test -r /proc/`,{field:"stock_pid"},`/maps
if grep -F -q '/data/.esphome-cgs1/pm_qt_bridge.so' /proc/`,{field:"stock_pid"},`/maps; then exit 1; else result=$?; [ "$result" -eq 1 ]; fi
test ! -L /data/.esphome-cgs1/program
test -f /data/.esphome-cgs1/program
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/program)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/program | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_0"},` ]
test ! -L /data/.esphome-cgs1/pm_qt_bridge.so
test -f /data/.esphome-cgs1/pm_qt_bridge.so
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/pm_qt_bridge.so)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/pm_qt_bridge.so | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_1"},` ]
test ! -L /data/.esphome-cgs1/launch.sh
test -f /data/.esphome-cgs1/launch.sh
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/launch.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/launch.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_2"},` ]
test ! -L /data/.esphome-cgs1/SnowApp-with-PM
test -f /data/.esphome-cgs1/SnowApp-with-PM
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/SnowApp-with-PM)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/SnowApp-with-PM | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_3"},` ]
test ! -L /data/.esphome-cgs1/startup-hook.sh
test -f /data/.esphome-cgs1/startup-hook.sh
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/startup-hook.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/startup-hook.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_4"},` ]
test ! -L /data/.esphome-cgs1/stock-start.sh.original
test -f /data/.esphome-cgs1/stock-start.sh.original
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/stock-start.sh.original)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/stock-start.sh.original | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_5"},` ]
test ! -L /data/.esphome-cgs1/stock-watchdog.sh.original
test -f /data/.esphome-cgs1/stock-watchdog.sh.original
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/stock-watchdog.sh.original)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/stock-watchdog.sh.original | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_6"},` ]
test ! -L /data/.esphome-cgs1/start.sh.candidate
test -f /data/.esphome-cgs1/start.sh.candidate
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/start.sh.candidate)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/start.sh.candidate | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_7"},` ]
test ! -L /data/.esphome-cgs1/watchdog.sh.candidate
test -f /data/.esphome-cgs1/watchdog.sh.candidate
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/watchdog.sh.candidate)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/watchdog.sh.candidate | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_8"},` ]
test ! -L /data/bin/SnowApp
test -f /data/bin/SnowApp
observed_value=$(stat -c '%h %u' /data/bin/SnowApp)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/bin/SnowApp | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_0"},` ]
test ! -L /data/bin/watchdog.sh
test -f /data/bin/watchdog.sh
observed_value=$(stat -c '%h %u' /data/bin/watchdog.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/bin/watchdog.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_1"},` ]
test ! -L /data/etc/init.d/start.sh
test -f /data/etc/init.d/start.sh
observed_value=$(stat -c '%h %u' /data/etc/init.d/start.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/etc/init.d/start.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_2"},` ]
test ! -L /etc/init.d/S12_launcher_init
test -f /etc/init.d/S12_launcher_init
observed_value=$(stat -c '%h %u' /etc/init.d/S12_launcher_init)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /etc/init.d/S12_launcher_init | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_3"},` ]
test ! -L /etc/init.d/S50_px3se_init
test -f /etc/init.d/S50_px3se_init
observed_value=$(stat -c '%h %u' /etc/init.d/S50_px3se_init)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /etc/init.d/S50_px3se_init | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_4"},` ]
test ! -L /lib/ld-2.23.so
test -f /lib/ld-2.23.so
observed_value=$(stat -c '%h %u' /lib/ld-2.23.so)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /lib/ld-2.23.so | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_5"},` ]
test ! -L /lib/libc-2.23.so
test -f /lib/libc-2.23.so
observed_value=$(stat -c '%h %u' /lib/libc-2.23.so)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /lib/libc-2.23.so | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_6"},` ]
test ! -L /usr/lib/libQt5Core.so.5.9.4
test -f /usr/lib/libQt5Core.so.5.9.4
observed_value=$(stat -c '%h %u' /usr/lib/libQt5Core.so.5.9.4)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /usr/lib/libQt5Core.so.5.9.4 | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_7"},` ]
test ! -L /usr/lib/libstdc++.so.6.0.20
test -f /usr/lib/libstdc++.so.6.0.20
observed_value=$(stat -c '%h %u' /usr/lib/libstdc++.so.6.0.20)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /usr/lib/libstdc++.so.6.0.20 | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_8"},` ]
observed_value=$(stat -c '%a %u %h' /data/.esphome-cgs1/program)
[ "$observed_value" = '700 0 1' ]
observed_value=$(stat -c '%a %u %h' /data/.esphome-cgs1/launch.sh)
[ "$observed_value" = '700 0 1' ]
observed_value=$(stat -c '%a %u %h' /data/.esphome-cgs1/SnowApp-with-PM)
[ "$observed_value" = '700 0 1' ]
observed_value=$(stat -c '%a %u %h' /data/etc/init.d/start.sh)
[ "$observed_value" = '755 0 1' ]
observed_value=$(stat -c '%a %u %h' /data/bin/watchdog.sh)
[ "$observed_value" = '755 0 1' ]
test -x /data/bin/SnowApp
# CGS1_INITIAL_ABSENT_STORES
entries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
    case "$entry" in (full-releases|wifi|prefs|full-state) exit 1;; esac
done
entries=$(LC_ALL=C ls -A1 /tmp)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
    case "$entry" in (qingping-cgs1-esphome.lock) exit 1;; esac
done
entries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
 case "$entry" in (bridge-next-boot.complete) exit 1;; esac
done
entries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
 case "$entry" in (bridge-disarm-before-boot.complete) exit 1;; esac
done
`],arm:[`# CGS1_BRIDGE_NEXT_BOOT_SCOPE disabled
test ! -L /data/.esphome-cgs1
test -d /data/.esphome-cgs1
observed_value=$(stat -c '%d %i %a %u' /data/.esphome-cgs1)
[ "$observed_value" = '`,{field:"root_device"}," ",{field:"root_inode"},` 700 0' ]
test ! -L /data/bin
test ! -L /data/etc
test ! -L /data/etc/init.d
observed_value=$(stat -c '%d' /data/bin)
[ "$observed_value" = `,{field:"root_device"},` ]
observed_value=$(stat -c '%d' /data/etc/init.d)
[ "$observed_value" = `,{field:"root_device"},` ]
test ! -L /data/.esphome-cgs1/install.intent
test -f /data/.esphome-cgs1/install.intent
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/install.intent)
[ "$observed_value" = '98 600 0 1' ]
observed_value=$(cat /data/.esphome-cgs1/install.intent)
[ "$observed_value" = '`,{field:"plan_id"}," ",{field:"plan_sha256"},`' ]
test ! -L /data/.esphome-cgs1/disabled
test -f /data/.esphome-cgs1/disabled
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/disabled)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/disabled | awk '{print $1}')
[ "$observed_value" = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 ]
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/disabled)
[ "$observed_value" = '0 600 0 1' ]
entries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
 case "$entry" in (disabled.before-next-boot) exit 1;; esac
done
test ! -L /data/.esphome-cgs1/pm-helper.disabled
test -f /data/.esphome-cgs1/pm-helper.disabled
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/pm-helper.disabled)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/pm-helper.disabled | awk '{print $1}')
[ "$observed_value" = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 ]
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/pm-helper.disabled)
[ "$observed_value" = '0 600 0 1' ]
observed_value=$(cat /sys/class/net/wlan0/address)
[ "$observed_value" = `,{field:"wlan_mac"},` ]
observed_value=$(cat /data/etc/os-release)
[ "$observed_value" = CLEARGRASS_VERSION=4.1.8_0287 ]
observed_value=$(cat /proc/sys/kernel/random/boot_id)
[ "$observed_value" = `,{field:"boot_id"},` ]
observed_value=$(awk '
BEGIN { section=0; count=0 }
/^[ \\t]*\\[/ { section=($0 ~ /^[ \\t]*\\[sensors\\][ \\t]*\\r?$/) }
section && /^[ \\t]*co2_type[ \\t]*=/ {
    value=$0; sub(/^[^=]*=[ \\t]*/, "", value); sub(/[ \\t\\r]*$/, "", value)
    print value; count++
}
END { if (count != 1) exit 1 }
' /data/etc/setting.ini)
[ "$observed_value" = `,{field:"co2_type"},` ]
observed_value=$(count=0
for link in /proc/[0-9]*/exe; do
    count=$((count+1))
    [ "$count" -le 4096 ] || exit 1
    pid=\${link#/proc/}; pid=\${pid%/exe}
    case "$pid" in (''|*[!0-9]*) exit 1;; esac
    if executable=$(readlink "$link" 2>/dev/null); then
        :
    else
        # Kernel threads and exited tasks legitimately have no executable.
        # An unreadable live userspace exe is NOT evidence of its absence.
        [ -d "/proc/$pid" ] || continue
        metadata=$(sed 's/.*) //' "/proc/$pid/stat" 2>/dev/null | awk '{print $1, $7}')
        set -- $metadata
        if [ "$#" -ne 2 ]; then
            [ ! -d "/proc/$pid" ] && continue
            exit 1
        fi
        case "$2" in (''|*[!0-9]*) exit 1;; esac
        case "$1" in (Z|X|x) continue;; esac
        [ "$(($2 & 2097152))" -ne 0 ] || exit 1
        continue
    fi
    case "$executable" in
        (/data/.esphome-cgs1/*|/tmp/qingping-full-*/*|/tmp/qingping-initial-*/*) exit 1;;
        (/data/bin/SnowApp) printf '%s\\n' "$pid";;
    esac
done)
[ "$observed_value" = `,{field:"stock_pid"},` ]
observed_value=$(readlink /proc/`,{field:"stock_pid"},`/exe)
[ "$observed_value" = /data/bin/SnowApp ]
observed_value=$(stat -c '%u' /proc/`,{field:"stock_pid"},`)
[ "$observed_value" = 0 ]
observed_value=$(sed 's/.*) //' /proc/`,{field:"stock_pid"},`/stat | awk '{print $20}')
[ "$observed_value" = `,{field:"stock_start"},` ]
process_state=$(sed 's/.*) //' /proc/`,{field:"stock_pid"},`/stat | awk '{print $1}')
case "$process_state" in R|S|D|I) :;; *) exit 1;; esac
observed_value=$(readlink /proc/`,{field:"watchdog_pid"},`/exe)
[ "$observed_value" = /bin/busybox ]
observed_value=$(stat -c '%u' /proc/`,{field:"watchdog_pid"},`)
[ "$observed_value" = 0 ]
observed_value=$(sed 's/.*) //' /proc/`,{field:"watchdog_pid"},`/stat | awk '{print $20}')
[ "$observed_value" = `,{field:"watchdog_start"},` ]
process_state=$(sed 's/.*) //' /proc/`,{field:"watchdog_pid"},`/stat | awk '{print $1}')
case "$process_state" in R|S|D|I) :;; *) exit 1;; esac
observed_value=$(sed 's/.*) //' /proc/`,{field:"stock_pid"},`/stat | awk '{print $2}')
[ "$observed_value" = `,{field:"watchdog_pid"},` ]
arguments=$(tr '\\000' '\\n' < /proc/`,{field:"watchdog_pid"},`/cmdline)
[ "$arguments" = "$(printf '/bin/sh\\n/data/bin/watchdog.sh')" ]
test -r /proc/`,{field:"stock_pid"},`/maps
if grep -F -q '/data/.esphome-cgs1/pm_qt_bridge.so' /proc/`,{field:"stock_pid"},`/maps; then exit 1; else result=$?; [ "$result" -eq 1 ]; fi
test ! -L /data/.esphome-cgs1/program
test -f /data/.esphome-cgs1/program
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/program)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/program | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_0"},` ]
test ! -L /data/.esphome-cgs1/pm_qt_bridge.so
test -f /data/.esphome-cgs1/pm_qt_bridge.so
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/pm_qt_bridge.so)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/pm_qt_bridge.so | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_1"},` ]
test ! -L /data/.esphome-cgs1/launch.sh
test -f /data/.esphome-cgs1/launch.sh
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/launch.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/launch.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_2"},` ]
test ! -L /data/.esphome-cgs1/SnowApp-with-PM
test -f /data/.esphome-cgs1/SnowApp-with-PM
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/SnowApp-with-PM)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/SnowApp-with-PM | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_3"},` ]
test ! -L /data/.esphome-cgs1/startup-hook.sh
test -f /data/.esphome-cgs1/startup-hook.sh
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/startup-hook.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/startup-hook.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_4"},` ]
test ! -L /data/.esphome-cgs1/stock-start.sh.original
test -f /data/.esphome-cgs1/stock-start.sh.original
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/stock-start.sh.original)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/stock-start.sh.original | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_5"},` ]
test ! -L /data/.esphome-cgs1/stock-watchdog.sh.original
test -f /data/.esphome-cgs1/stock-watchdog.sh.original
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/stock-watchdog.sh.original)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/stock-watchdog.sh.original | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_6"},` ]
test ! -L /data/.esphome-cgs1/start.sh.candidate
test -f /data/.esphome-cgs1/start.sh.candidate
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/start.sh.candidate)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/start.sh.candidate | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_7"},` ]
test ! -L /data/.esphome-cgs1/watchdog.sh.candidate
test -f /data/.esphome-cgs1/watchdog.sh.candidate
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/watchdog.sh.candidate)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/watchdog.sh.candidate | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_8"},` ]
test ! -L /data/bin/SnowApp
test -f /data/bin/SnowApp
observed_value=$(stat -c '%h %u' /data/bin/SnowApp)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/bin/SnowApp | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_0"},` ]
test ! -L /data/bin/watchdog.sh
test -f /data/bin/watchdog.sh
observed_value=$(stat -c '%h %u' /data/bin/watchdog.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/bin/watchdog.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_1"},` ]
test ! -L /data/etc/init.d/start.sh
test -f /data/etc/init.d/start.sh
observed_value=$(stat -c '%h %u' /data/etc/init.d/start.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/etc/init.d/start.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_2"},` ]
test ! -L /etc/init.d/S12_launcher_init
test -f /etc/init.d/S12_launcher_init
observed_value=$(stat -c '%h %u' /etc/init.d/S12_launcher_init)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /etc/init.d/S12_launcher_init | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_3"},` ]
test ! -L /etc/init.d/S50_px3se_init
test -f /etc/init.d/S50_px3se_init
observed_value=$(stat -c '%h %u' /etc/init.d/S50_px3se_init)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /etc/init.d/S50_px3se_init | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_4"},` ]
test ! -L /lib/ld-2.23.so
test -f /lib/ld-2.23.so
observed_value=$(stat -c '%h %u' /lib/ld-2.23.so)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /lib/ld-2.23.so | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_5"},` ]
test ! -L /lib/libc-2.23.so
test -f /lib/libc-2.23.so
observed_value=$(stat -c '%h %u' /lib/libc-2.23.so)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /lib/libc-2.23.so | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_6"},` ]
test ! -L /usr/lib/libQt5Core.so.5.9.4
test -f /usr/lib/libQt5Core.so.5.9.4
observed_value=$(stat -c '%h %u' /usr/lib/libQt5Core.so.5.9.4)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /usr/lib/libQt5Core.so.5.9.4 | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_7"},` ]
test ! -L /usr/lib/libstdc++.so.6.0.20
test -f /usr/lib/libstdc++.so.6.0.20
observed_value=$(stat -c '%h %u' /usr/lib/libstdc++.so.6.0.20)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /usr/lib/libstdc++.so.6.0.20 | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_8"},` ]
observed_value=$(stat -c '%a %u %h' /data/.esphome-cgs1/program)
[ "$observed_value" = '700 0 1' ]
observed_value=$(stat -c '%a %u %h' /data/.esphome-cgs1/launch.sh)
[ "$observed_value" = '700 0 1' ]
observed_value=$(stat -c '%a %u %h' /data/.esphome-cgs1/SnowApp-with-PM)
[ "$observed_value" = '700 0 1' ]
observed_value=$(stat -c '%a %u %h' /data/etc/init.d/start.sh)
[ "$observed_value" = '755 0 1' ]
observed_value=$(stat -c '%a %u %h' /data/bin/watchdog.sh)
[ "$observed_value" = '755 0 1' ]
test -x /data/bin/SnowApp
# CGS1_INITIAL_ABSENT_STORES
entries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
    case "$entry" in (full-releases|wifi|prefs|full-state) exit 1;; esac
done
entries=$(LC_ALL=C ls -A1 /tmp)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
    case "$entry" in (qingping-cgs1-esphome.lock) exit 1;; esac
done
entries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
 case "$entry" in (bridge-next-boot.complete) exit 1;; esac
done
entries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
 case "$entry" in (bridge-disarm-before-boot.complete) exit 1;; esac
done
set -C
: > /data/.esphome-cgs1/disabled.before-next-boot
sync
# CGS1_BRIDGE_NEXT_BOOT_SCOPE backup_disabled
test ! -L /data/.esphome-cgs1
test -d /data/.esphome-cgs1
observed_value=$(stat -c '%d %i %a %u' /data/.esphome-cgs1)
[ "$observed_value" = '`,{field:"root_device"}," ",{field:"root_inode"},` 700 0' ]
test ! -L /data/bin
test ! -L /data/etc
test ! -L /data/etc/init.d
observed_value=$(stat -c '%d' /data/bin)
[ "$observed_value" = `,{field:"root_device"},` ]
observed_value=$(stat -c '%d' /data/etc/init.d)
[ "$observed_value" = `,{field:"root_device"},` ]
test ! -L /data/.esphome-cgs1/install.intent
test -f /data/.esphome-cgs1/install.intent
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/install.intent)
[ "$observed_value" = '98 600 0 1' ]
observed_value=$(cat /data/.esphome-cgs1/install.intent)
[ "$observed_value" = '`,{field:"plan_id"}," ",{field:"plan_sha256"},`' ]
test ! -L /data/.esphome-cgs1/disabled.before-next-boot
test -f /data/.esphome-cgs1/disabled.before-next-boot
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/disabled.before-next-boot)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/disabled.before-next-boot | awk '{print $1}')
[ "$observed_value" = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 ]
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/disabled.before-next-boot)
[ "$observed_value" = '0 600 0 1' ]
test ! -L /data/.esphome-cgs1/disabled
test -f /data/.esphome-cgs1/disabled
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/disabled)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/disabled | awk '{print $1}')
[ "$observed_value" = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 ]
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/disabled)
[ "$observed_value" = '0 600 0 1' ]
test ! -L /data/.esphome-cgs1/pm-helper.disabled
test -f /data/.esphome-cgs1/pm-helper.disabled
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/pm-helper.disabled)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/pm-helper.disabled | awk '{print $1}')
[ "$observed_value" = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 ]
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/pm-helper.disabled)
[ "$observed_value" = '0 600 0 1' ]
observed_value=$(cat /sys/class/net/wlan0/address)
[ "$observed_value" = `,{field:"wlan_mac"},` ]
observed_value=$(cat /data/etc/os-release)
[ "$observed_value" = CLEARGRASS_VERSION=4.1.8_0287 ]
observed_value=$(cat /proc/sys/kernel/random/boot_id)
[ "$observed_value" = `,{field:"boot_id"},` ]
observed_value=$(awk '
BEGIN { section=0; count=0 }
/^[ \\t]*\\[/ { section=($0 ~ /^[ \\t]*\\[sensors\\][ \\t]*\\r?$/) }
section && /^[ \\t]*co2_type[ \\t]*=/ {
    value=$0; sub(/^[^=]*=[ \\t]*/, "", value); sub(/[ \\t\\r]*$/, "", value)
    print value; count++
}
END { if (count != 1) exit 1 }
' /data/etc/setting.ini)
[ "$observed_value" = `,{field:"co2_type"},` ]
observed_value=$(count=0
for link in /proc/[0-9]*/exe; do
    count=$((count+1))
    [ "$count" -le 4096 ] || exit 1
    pid=\${link#/proc/}; pid=\${pid%/exe}
    case "$pid" in (''|*[!0-9]*) exit 1;; esac
    if executable=$(readlink "$link" 2>/dev/null); then
        :
    else
        # Kernel threads and exited tasks legitimately have no executable.
        # An unreadable live userspace exe is NOT evidence of its absence.
        [ -d "/proc/$pid" ] || continue
        metadata=$(sed 's/.*) //' "/proc/$pid/stat" 2>/dev/null | awk '{print $1, $7}')
        set -- $metadata
        if [ "$#" -ne 2 ]; then
            [ ! -d "/proc/$pid" ] && continue
            exit 1
        fi
        case "$2" in (''|*[!0-9]*) exit 1;; esac
        case "$1" in (Z|X|x) continue;; esac
        [ "$(($2 & 2097152))" -ne 0 ] || exit 1
        continue
    fi
    case "$executable" in
        (/data/.esphome-cgs1/*|/tmp/qingping-full-*/*|/tmp/qingping-initial-*/*) exit 1;;
        (/data/bin/SnowApp) printf '%s\\n' "$pid";;
    esac
done)
[ "$observed_value" = `,{field:"stock_pid"},` ]
observed_value=$(readlink /proc/`,{field:"stock_pid"},`/exe)
[ "$observed_value" = /data/bin/SnowApp ]
observed_value=$(stat -c '%u' /proc/`,{field:"stock_pid"},`)
[ "$observed_value" = 0 ]
observed_value=$(sed 's/.*) //' /proc/`,{field:"stock_pid"},`/stat | awk '{print $20}')
[ "$observed_value" = `,{field:"stock_start"},` ]
process_state=$(sed 's/.*) //' /proc/`,{field:"stock_pid"},`/stat | awk '{print $1}')
case "$process_state" in R|S|D|I) :;; *) exit 1;; esac
observed_value=$(readlink /proc/`,{field:"watchdog_pid"},`/exe)
[ "$observed_value" = /bin/busybox ]
observed_value=$(stat -c '%u' /proc/`,{field:"watchdog_pid"},`)
[ "$observed_value" = 0 ]
observed_value=$(sed 's/.*) //' /proc/`,{field:"watchdog_pid"},`/stat | awk '{print $20}')
[ "$observed_value" = `,{field:"watchdog_start"},` ]
process_state=$(sed 's/.*) //' /proc/`,{field:"watchdog_pid"},`/stat | awk '{print $1}')
case "$process_state" in R|S|D|I) :;; *) exit 1;; esac
observed_value=$(sed 's/.*) //' /proc/`,{field:"stock_pid"},`/stat | awk '{print $2}')
[ "$observed_value" = `,{field:"watchdog_pid"},` ]
arguments=$(tr '\\000' '\\n' < /proc/`,{field:"watchdog_pid"},`/cmdline)
[ "$arguments" = "$(printf '/bin/sh\\n/data/bin/watchdog.sh')" ]
test -r /proc/`,{field:"stock_pid"},`/maps
if grep -F -q '/data/.esphome-cgs1/pm_qt_bridge.so' /proc/`,{field:"stock_pid"},`/maps; then exit 1; else result=$?; [ "$result" -eq 1 ]; fi
test ! -L /data/.esphome-cgs1/program
test -f /data/.esphome-cgs1/program
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/program)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/program | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_0"},` ]
test ! -L /data/.esphome-cgs1/pm_qt_bridge.so
test -f /data/.esphome-cgs1/pm_qt_bridge.so
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/pm_qt_bridge.so)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/pm_qt_bridge.so | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_1"},` ]
test ! -L /data/.esphome-cgs1/launch.sh
test -f /data/.esphome-cgs1/launch.sh
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/launch.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/launch.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_2"},` ]
test ! -L /data/.esphome-cgs1/SnowApp-with-PM
test -f /data/.esphome-cgs1/SnowApp-with-PM
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/SnowApp-with-PM)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/SnowApp-with-PM | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_3"},` ]
test ! -L /data/.esphome-cgs1/startup-hook.sh
test -f /data/.esphome-cgs1/startup-hook.sh
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/startup-hook.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/startup-hook.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_4"},` ]
test ! -L /data/.esphome-cgs1/stock-start.sh.original
test -f /data/.esphome-cgs1/stock-start.sh.original
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/stock-start.sh.original)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/stock-start.sh.original | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_5"},` ]
test ! -L /data/.esphome-cgs1/stock-watchdog.sh.original
test -f /data/.esphome-cgs1/stock-watchdog.sh.original
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/stock-watchdog.sh.original)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/stock-watchdog.sh.original | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_6"},` ]
test ! -L /data/.esphome-cgs1/start.sh.candidate
test -f /data/.esphome-cgs1/start.sh.candidate
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/start.sh.candidate)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/start.sh.candidate | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_7"},` ]
test ! -L /data/.esphome-cgs1/watchdog.sh.candidate
test -f /data/.esphome-cgs1/watchdog.sh.candidate
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/watchdog.sh.candidate)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/watchdog.sh.candidate | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_8"},` ]
test ! -L /data/bin/SnowApp
test -f /data/bin/SnowApp
observed_value=$(stat -c '%h %u' /data/bin/SnowApp)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/bin/SnowApp | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_0"},` ]
test ! -L /data/bin/watchdog.sh
test -f /data/bin/watchdog.sh
observed_value=$(stat -c '%h %u' /data/bin/watchdog.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/bin/watchdog.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_1"},` ]
test ! -L /data/etc/init.d/start.sh
test -f /data/etc/init.d/start.sh
observed_value=$(stat -c '%h %u' /data/etc/init.d/start.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/etc/init.d/start.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_2"},` ]
test ! -L /etc/init.d/S12_launcher_init
test -f /etc/init.d/S12_launcher_init
observed_value=$(stat -c '%h %u' /etc/init.d/S12_launcher_init)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /etc/init.d/S12_launcher_init | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_3"},` ]
test ! -L /etc/init.d/S50_px3se_init
test -f /etc/init.d/S50_px3se_init
observed_value=$(stat -c '%h %u' /etc/init.d/S50_px3se_init)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /etc/init.d/S50_px3se_init | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_4"},` ]
test ! -L /lib/ld-2.23.so
test -f /lib/ld-2.23.so
observed_value=$(stat -c '%h %u' /lib/ld-2.23.so)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /lib/ld-2.23.so | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_5"},` ]
test ! -L /lib/libc-2.23.so
test -f /lib/libc-2.23.so
observed_value=$(stat -c '%h %u' /lib/libc-2.23.so)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /lib/libc-2.23.so | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_6"},` ]
test ! -L /usr/lib/libQt5Core.so.5.9.4
test -f /usr/lib/libQt5Core.so.5.9.4
observed_value=$(stat -c '%h %u' /usr/lib/libQt5Core.so.5.9.4)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /usr/lib/libQt5Core.so.5.9.4 | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_7"},` ]
test ! -L /usr/lib/libstdc++.so.6.0.20
test -f /usr/lib/libstdc++.so.6.0.20
observed_value=$(stat -c '%h %u' /usr/lib/libstdc++.so.6.0.20)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /usr/lib/libstdc++.so.6.0.20 | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_8"},` ]
observed_value=$(stat -c '%a %u %h' /data/.esphome-cgs1/program)
[ "$observed_value" = '700 0 1' ]
observed_value=$(stat -c '%a %u %h' /data/.esphome-cgs1/launch.sh)
[ "$observed_value" = '700 0 1' ]
observed_value=$(stat -c '%a %u %h' /data/.esphome-cgs1/SnowApp-with-PM)
[ "$observed_value" = '700 0 1' ]
observed_value=$(stat -c '%a %u %h' /data/etc/init.d/start.sh)
[ "$observed_value" = '755 0 1' ]
observed_value=$(stat -c '%a %u %h' /data/bin/watchdog.sh)
[ "$observed_value" = '755 0 1' ]
test -x /data/bin/SnowApp
# CGS1_INITIAL_ABSENT_STORES
entries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
    case "$entry" in (full-releases|wifi|prefs|full-state) exit 1;; esac
done
entries=$(LC_ALL=C ls -A1 /tmp)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
    case "$entry" in (qingping-cgs1-esphome.lock) exit 1;; esac
done
rm /data/.esphome-cgs1/disabled
sync
entries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
 case "$entry" in (bridge-next-boot.complete) exit 1;; esac
done
set -C
printf '%s\\n' 'arm `,{field:"nonce"}," ",{field:"plan_id"}," ",{field:"plan_sha256"},`' > /data/.esphome-cgs1/bridge-next-boot.complete
sync
`],armed:[`# CGS1_BRIDGE_NEXT_BOOT_SCOPE armed
test ! -L /data/.esphome-cgs1
test -d /data/.esphome-cgs1
observed_value=$(stat -c '%d %i %a %u' /data/.esphome-cgs1)
[ "$observed_value" = '`,{field:"root_device"}," ",{field:"root_inode"},` 700 0' ]
test ! -L /data/bin
test ! -L /data/etc
test ! -L /data/etc/init.d
observed_value=$(stat -c '%d' /data/bin)
[ "$observed_value" = `,{field:"root_device"},` ]
observed_value=$(stat -c '%d' /data/etc/init.d)
[ "$observed_value" = `,{field:"root_device"},` ]
test ! -L /data/.esphome-cgs1/install.intent
test -f /data/.esphome-cgs1/install.intent
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/install.intent)
[ "$observed_value" = '98 600 0 1' ]
observed_value=$(cat /data/.esphome-cgs1/install.intent)
[ "$observed_value" = '`,{field:"plan_id"}," ",{field:"plan_sha256"},`' ]
test ! -L /data/.esphome-cgs1/disabled.before-next-boot
test -f /data/.esphome-cgs1/disabled.before-next-boot
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/disabled.before-next-boot)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/disabled.before-next-boot | awk '{print $1}')
[ "$observed_value" = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 ]
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/disabled.before-next-boot)
[ "$observed_value" = '0 600 0 1' ]
entries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
 case "$entry" in (disabled) exit 1;; esac
done
test ! -L /data/.esphome-cgs1/pm-helper.disabled
test -f /data/.esphome-cgs1/pm-helper.disabled
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/pm-helper.disabled)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/pm-helper.disabled | awk '{print $1}')
[ "$observed_value" = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 ]
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/pm-helper.disabled)
[ "$observed_value" = '0 600 0 1' ]
observed_value=$(cat /sys/class/net/wlan0/address)
[ "$observed_value" = `,{field:"wlan_mac"},` ]
observed_value=$(cat /data/etc/os-release)
[ "$observed_value" = CLEARGRASS_VERSION=4.1.8_0287 ]
observed_value=$(cat /proc/sys/kernel/random/boot_id)
[ "$observed_value" = `,{field:"boot_id"},` ]
observed_value=$(awk '
BEGIN { section=0; count=0 }
/^[ \\t]*\\[/ { section=($0 ~ /^[ \\t]*\\[sensors\\][ \\t]*\\r?$/) }
section && /^[ \\t]*co2_type[ \\t]*=/ {
    value=$0; sub(/^[^=]*=[ \\t]*/, "", value); sub(/[ \\t\\r]*$/, "", value)
    print value; count++
}
END { if (count != 1) exit 1 }
' /data/etc/setting.ini)
[ "$observed_value" = `,{field:"co2_type"},` ]
observed_value=$(count=0
for link in /proc/[0-9]*/exe; do
    count=$((count+1))
    [ "$count" -le 4096 ] || exit 1
    pid=\${link#/proc/}; pid=\${pid%/exe}
    case "$pid" in (''|*[!0-9]*) exit 1;; esac
    if executable=$(readlink "$link" 2>/dev/null); then
        :
    else
        # Kernel threads and exited tasks legitimately have no executable.
        # An unreadable live userspace exe is NOT evidence of its absence.
        [ -d "/proc/$pid" ] || continue
        metadata=$(sed 's/.*) //' "/proc/$pid/stat" 2>/dev/null | awk '{print $1, $7}')
        set -- $metadata
        if [ "$#" -ne 2 ]; then
            [ ! -d "/proc/$pid" ] && continue
            exit 1
        fi
        case "$2" in (''|*[!0-9]*) exit 1;; esac
        case "$1" in (Z|X|x) continue;; esac
        [ "$(($2 & 2097152))" -ne 0 ] || exit 1
        continue
    fi
    case "$executable" in
        (/data/.esphome-cgs1/*|/tmp/qingping-full-*/*|/tmp/qingping-initial-*/*) exit 1;;
        (/data/bin/SnowApp) printf '%s\\n' "$pid";;
    esac
done)
[ "$observed_value" = `,{field:"stock_pid"},` ]
observed_value=$(readlink /proc/`,{field:"stock_pid"},`/exe)
[ "$observed_value" = /data/bin/SnowApp ]
observed_value=$(stat -c '%u' /proc/`,{field:"stock_pid"},`)
[ "$observed_value" = 0 ]
observed_value=$(sed 's/.*) //' /proc/`,{field:"stock_pid"},`/stat | awk '{print $20}')
[ "$observed_value" = `,{field:"stock_start"},` ]
process_state=$(sed 's/.*) //' /proc/`,{field:"stock_pid"},`/stat | awk '{print $1}')
case "$process_state" in R|S|D|I) :;; *) exit 1;; esac
observed_value=$(readlink /proc/`,{field:"watchdog_pid"},`/exe)
[ "$observed_value" = /bin/busybox ]
observed_value=$(stat -c '%u' /proc/`,{field:"watchdog_pid"},`)
[ "$observed_value" = 0 ]
observed_value=$(sed 's/.*) //' /proc/`,{field:"watchdog_pid"},`/stat | awk '{print $20}')
[ "$observed_value" = `,{field:"watchdog_start"},` ]
process_state=$(sed 's/.*) //' /proc/`,{field:"watchdog_pid"},`/stat | awk '{print $1}')
case "$process_state" in R|S|D|I) :;; *) exit 1;; esac
observed_value=$(sed 's/.*) //' /proc/`,{field:"stock_pid"},`/stat | awk '{print $2}')
[ "$observed_value" = `,{field:"watchdog_pid"},` ]
arguments=$(tr '\\000' '\\n' < /proc/`,{field:"watchdog_pid"},`/cmdline)
[ "$arguments" = "$(printf '/bin/sh\\n/data/bin/watchdog.sh')" ]
test -r /proc/`,{field:"stock_pid"},`/maps
if grep -F -q '/data/.esphome-cgs1/pm_qt_bridge.so' /proc/`,{field:"stock_pid"},`/maps; then exit 1; else result=$?; [ "$result" -eq 1 ]; fi
test ! -L /data/.esphome-cgs1/program
test -f /data/.esphome-cgs1/program
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/program)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/program | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_0"},` ]
test ! -L /data/.esphome-cgs1/pm_qt_bridge.so
test -f /data/.esphome-cgs1/pm_qt_bridge.so
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/pm_qt_bridge.so)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/pm_qt_bridge.so | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_1"},` ]
test ! -L /data/.esphome-cgs1/launch.sh
test -f /data/.esphome-cgs1/launch.sh
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/launch.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/launch.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_2"},` ]
test ! -L /data/.esphome-cgs1/SnowApp-with-PM
test -f /data/.esphome-cgs1/SnowApp-with-PM
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/SnowApp-with-PM)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/SnowApp-with-PM | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_3"},` ]
test ! -L /data/.esphome-cgs1/startup-hook.sh
test -f /data/.esphome-cgs1/startup-hook.sh
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/startup-hook.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/startup-hook.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_4"},` ]
test ! -L /data/.esphome-cgs1/stock-start.sh.original
test -f /data/.esphome-cgs1/stock-start.sh.original
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/stock-start.sh.original)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/stock-start.sh.original | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_5"},` ]
test ! -L /data/.esphome-cgs1/stock-watchdog.sh.original
test -f /data/.esphome-cgs1/stock-watchdog.sh.original
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/stock-watchdog.sh.original)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/stock-watchdog.sh.original | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_6"},` ]
test ! -L /data/.esphome-cgs1/start.sh.candidate
test -f /data/.esphome-cgs1/start.sh.candidate
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/start.sh.candidate)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/start.sh.candidate | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_7"},` ]
test ! -L /data/.esphome-cgs1/watchdog.sh.candidate
test -f /data/.esphome-cgs1/watchdog.sh.candidate
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/watchdog.sh.candidate)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/watchdog.sh.candidate | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_8"},` ]
test ! -L /data/bin/SnowApp
test -f /data/bin/SnowApp
observed_value=$(stat -c '%h %u' /data/bin/SnowApp)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/bin/SnowApp | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_0"},` ]
test ! -L /data/bin/watchdog.sh
test -f /data/bin/watchdog.sh
observed_value=$(stat -c '%h %u' /data/bin/watchdog.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/bin/watchdog.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_1"},` ]
test ! -L /data/etc/init.d/start.sh
test -f /data/etc/init.d/start.sh
observed_value=$(stat -c '%h %u' /data/etc/init.d/start.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/etc/init.d/start.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_2"},` ]
test ! -L /etc/init.d/S12_launcher_init
test -f /etc/init.d/S12_launcher_init
observed_value=$(stat -c '%h %u' /etc/init.d/S12_launcher_init)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /etc/init.d/S12_launcher_init | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_3"},` ]
test ! -L /etc/init.d/S50_px3se_init
test -f /etc/init.d/S50_px3se_init
observed_value=$(stat -c '%h %u' /etc/init.d/S50_px3se_init)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /etc/init.d/S50_px3se_init | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_4"},` ]
test ! -L /lib/ld-2.23.so
test -f /lib/ld-2.23.so
observed_value=$(stat -c '%h %u' /lib/ld-2.23.so)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /lib/ld-2.23.so | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_5"},` ]
test ! -L /lib/libc-2.23.so
test -f /lib/libc-2.23.so
observed_value=$(stat -c '%h %u' /lib/libc-2.23.so)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /lib/libc-2.23.so | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_6"},` ]
test ! -L /usr/lib/libQt5Core.so.5.9.4
test -f /usr/lib/libQt5Core.so.5.9.4
observed_value=$(stat -c '%h %u' /usr/lib/libQt5Core.so.5.9.4)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /usr/lib/libQt5Core.so.5.9.4 | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_7"},` ]
test ! -L /usr/lib/libstdc++.so.6.0.20
test -f /usr/lib/libstdc++.so.6.0.20
observed_value=$(stat -c '%h %u' /usr/lib/libstdc++.so.6.0.20)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /usr/lib/libstdc++.so.6.0.20 | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_8"},` ]
observed_value=$(stat -c '%a %u %h' /data/.esphome-cgs1/program)
[ "$observed_value" = '700 0 1' ]
observed_value=$(stat -c '%a %u %h' /data/.esphome-cgs1/launch.sh)
[ "$observed_value" = '700 0 1' ]
observed_value=$(stat -c '%a %u %h' /data/.esphome-cgs1/SnowApp-with-PM)
[ "$observed_value" = '700 0 1' ]
observed_value=$(stat -c '%a %u %h' /data/etc/init.d/start.sh)
[ "$observed_value" = '755 0 1' ]
observed_value=$(stat -c '%a %u %h' /data/bin/watchdog.sh)
[ "$observed_value" = '755 0 1' ]
test -x /data/bin/SnowApp
# CGS1_INITIAL_ABSENT_STORES
entries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
    case "$entry" in (full-releases|wifi|prefs|full-state) exit 1;; esac
done
entries=$(LC_ALL=C ls -A1 /tmp)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
    case "$entry" in (qingping-cgs1-esphome.lock) exit 1;; esac
done
`],complete:[`# CGS1_BRIDGE_COMPLETION arm
test ! -L /data/.esphome-cgs1/bridge-next-boot.complete
test -f /data/.esphome-cgs1/bridge-next-boot.complete
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/bridge-next-boot.complete)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/bridge-next-boot.complete | awk '{print $1}')
[ "$observed_value" = `,{field:"completion_sha256"},` ]
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/bridge-next-boot.complete)
[ "$observed_value" = '`,{field:"completion_size"},` 600 0 1' ]
observed_value=$(cat /data/.esphome-cgs1/bridge-next-boot.complete)
[ "$observed_value" = 'arm `,{field:"nonce"}," ",{field:"plan_id"}," ",{field:"plan_sha256"},`' ]
`]}};var F={process_scan:`count=0
for link in /proc/[0-9]*/exe; do
    count=$((count+1))
    [ "$count" -le 4096 ] || exit 1
    pid=\${link#/proc/}; pid=\${pid%/exe}
    case "$pid" in (''|*[!0-9]*) exit 1;; esac
    if executable=$(readlink "$link" 2>/dev/null); then
        :
    else
        # Kernel threads and exited tasks legitimately have no executable.
        # An unreadable live userspace exe is NOT evidence of its absence.
        [ -d "/proc/$pid" ] || continue
        metadata=$(sed 's/.*) //' "/proc/$pid/stat" 2>/dev/null | awk '{print $1, $7}')
        set -- $metadata
        if [ "$#" -ne 2 ]; then
            [ ! -d "/proc/$pid" ] && continue
            exit 1
        fi
        case "$2" in (''|*[!0-9]*) exit 1;; esac
        case "$1" in (Z|X|x) continue;; esac
        [ "$(($2 & 2097152))" -ne 0 ] || exit 1
        continue
    fi
    case "$executable" in
        (/data/.esphome-cgs1/*) exit 1;;
        (/data/bin/SnowApp) printf '%s\\n' "$pid";;
    esac
done`,patched:{"/data/etc/init.d/start.sh":{sha256:"f104f873dd3ce4544d5f3e3f90a4056bffc811bcaae037e347306e1084e7f1d1",size:1937},"/data/bin/watchdog.sh":{sha256:"1d74ef0946734e1ddf9e76301012f9ed66d7b38d9d7a0239a5d0e80acabf2cce",size:1719}},sources:{"stock-start.sh.original":"c38d532b44f02922aa850c247f0ddd227265c7873a35a20e9ac71ac21b9627e6","stock-watchdog.sh.original":"07b61bb67ff58a97e0f92de5b8bf0a94ca106e27ba3afa50f322817b8896dad7","start.sh.candidate":"f104f873dd3ce4544d5f3e3f90a4056bffc811bcaae037e347306e1084e7f1d1","watchdog.sh.candidate":"1d74ef0946734e1ddf9e76301012f9ed66d7b38d9d7a0239a5d0e80acabf2cce","launch.sh":"0e3b041b629cf24f1be8327df858913bd7f6f37164013b52cb1d9ef232ad4117","SnowApp-with-PM":"c1a1700e5172e7a9f415b947ad9b3e852e2d3ec2ca770315894a3b9e7866530a","startup-hook.sh":"42ffeb1329a9185431ba2f7006d0e64ac87214967ab6e0c30f276bb63665314e"},source_sha256:{"review_disabled_install.py":"174d4e23e1aaf4c386ab7afcf280a7b99b169ca877130ad1f556295a28850d1a","bootstrap_patches.py":"12bc6fb3fadfe6c0101130914c3dafe7db243669b8a000e83806ff0afd66f959","preflight_adb.py":"128cf367baeee28bcfb4156256548fdded689a42d50662e77580fdd71ab19b47","disabled_commit_policy.py":"ad8b50cd9c112f37b40bb1f3a77ba2ca598bf307deb1817ea1fdda4c492f2ab7"}};var Ee={schema_version:1,staged_roles:["bridge-program","pm_qt_bridge.so","launch.sh","SnowApp-with-PM","startup-hook.sh","stock-start.sh.original","stock-watchdog.sh.original","start.sh.candidate","watchdog.sh.candidate"],vendor_paths:["/data/bin/SnowApp","/data/bin/watchdog.sh","/data/etc/init.d/start.sh","/etc/init.d/S12_launcher_init","/etc/init.d/S50_px3se_init","/lib/ld-2.23.so","/lib/libc-2.23.so","/usr/lib/libQt5Core.so.5.9.4","/usr/lib/libstdc++.so.6.0.20"],source_sha256:{"commit_disabled_install.py":"b78470c8fe3f6275d2eca07067ec56beb858f11d8037b435be08f9f6781b4408","stage_install_adb.py":"7546caa212b3b44b1a3d8717e550b7bfd5f0893a342c80c6e847cfd2be56b8eb","review_disabled_install.py":"174d4e23e1aaf4c386ab7afcf280a7b99b169ca877130ad1f556295a28850d1a","disabled_commit_policy.py":"ad8b50cd9c112f37b40bb1f3a77ba2ca598bf307deb1817ea1fdda4c492f2ab7","bootstrap_patches.py":"12bc6fb3fadfe6c0101130914c3dafe7db243669b8a000e83806ff0afd66f959","preflight_adb.py":"128cf367baeee28bcfb4156256548fdded689a42d50662e77580fdd71ab19b47"},templates:{claim:[`test ! -L /data/.esphome-cgs1
test -d /data/.esphome-cgs1
observed_value=$(stat -c '%d %i %a %u' /data/.esphome-cgs1)
[ "$observed_value" = '`,{field:"root_device"}," ",{field:"root_inode"},` 700 0' ]
test ! -L /data/bin
test ! -L /data/etc
test ! -L /data/etc/init.d
observed_value=$(stat -c '%d' /data/bin)
[ "$observed_value" = `,{field:"root_device"},` ]
observed_value=$(stat -c '%d' /data/etc/init.d)
[ "$observed_value" = `,{field:"root_device"},` ]
test ! -L /data/.esphome-cgs1/install.intent
test -f /data/.esphome-cgs1/install.intent
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/install.intent)
[ "$observed_value" = '98 600 0 1' ]
observed_value=$(cat /data/.esphome-cgs1/install.intent)
[ "$observed_value" = '`,{field:"plan_id"}," ",{field:"plan_sha256"},`' ]
test ! -L /data/.esphome-cgs1/disabled
test -f /data/.esphome-cgs1/disabled
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/disabled)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/disabled | awk '{print $1}')
[ "$observed_value" = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 ]
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/disabled)
[ "$observed_value" = '0 600 0 1' ]
test ! -L /data/.esphome-cgs1/pm-helper.disabled
test -f /data/.esphome-cgs1/pm-helper.disabled
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/pm-helper.disabled)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/pm-helper.disabled | awk '{print $1}')
[ "$observed_value" = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 ]
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/pm-helper.disabled)
[ "$observed_value" = '0 600 0 1' ]
observed_value=$(cat /sys/class/net/wlan0/address)
[ "$observed_value" = `,{field:"wlan_mac"},` ]
observed_value=$(cat /data/etc/os-release)
[ "$observed_value" = CLEARGRASS_VERSION=4.1.8_0287 ]
observed_value=$(cat /proc/sys/kernel/random/boot_id)
[ "$observed_value" = `,{field:"boot_id"},` ]
observed_value=$(awk '
BEGIN { section=0; count=0 }
/^[ \\t]*\\[/ { section=($0 ~ /^[ \\t]*\\[sensors\\][ \\t]*\\r?$/) }
section && /^[ \\t]*co2_type[ \\t]*=/ {
    value=$0; sub(/^[^=]*=[ \\t]*/, "", value); sub(/[ \\t\\r]*$/, "", value)
    print value; count++
}
END { if (count != 1) exit 1 }
' /data/etc/setting.ini)
[ "$observed_value" = `,{field:"co2_type"},` ]
observed_value=$(count=0
for link in /proc/[0-9]*/exe; do
    count=$((count+1))
    [ "$count" -le 4096 ] || exit 1
    pid=\${link#/proc/}; pid=\${pid%/exe}
    case "$pid" in (''|*[!0-9]*) exit 1;; esac
    if executable=$(readlink "$link" 2>/dev/null); then
        :
    else
        # Kernel threads and exited tasks legitimately have no executable.
        # An unreadable live userspace exe is NOT evidence of its absence.
        [ -d "/proc/$pid" ] || continue
        metadata=$(sed 's/.*) //' "/proc/$pid/stat" 2>/dev/null | awk '{print $1, $7}')
        set -- $metadata
        if [ "$#" -ne 2 ]; then
            [ ! -d "/proc/$pid" ] && continue
            exit 1
        fi
        case "$2" in (''|*[!0-9]*) exit 1;; esac
        case "$1" in (Z|X|x) continue;; esac
        [ "$(($2 & 2097152))" -ne 0 ] || exit 1
        continue
    fi
    case "$executable" in
        (/data/.esphome-cgs1/*) exit 1;;
        (/data/bin/SnowApp) printf '%s\\n' "$pid";;
    esac
done)
[ "$observed_value" = `,{field:"stock_pid"},` ]
observed_value=$(readlink /proc/`,{field:"stock_pid"},`/exe)
[ "$observed_value" = /data/bin/SnowApp ]
observed_value=$(stat -c '%u' /proc/`,{field:"stock_pid"},`)
[ "$observed_value" = 0 ]
observed_value=$(sed 's/.*) //' /proc/`,{field:"stock_pid"},`/stat | awk '{print $20}')
[ "$observed_value" = `,{field:"stock_start"},` ]
process_state=$(sed 's/.*) //' /proc/`,{field:"stock_pid"},`/stat | awk '{print $1}')
case "$process_state" in R|S|D|I) :;; *) exit 1;; esac
observed_value=$(readlink /proc/`,{field:"watchdog_pid"},`/exe)
[ "$observed_value" = /bin/busybox ]
observed_value=$(stat -c '%u' /proc/`,{field:"watchdog_pid"},`)
[ "$observed_value" = 0 ]
observed_value=$(sed 's/.*) //' /proc/`,{field:"watchdog_pid"},`/stat | awk '{print $20}')
[ "$observed_value" = `,{field:"watchdog_start"},` ]
process_state=$(sed 's/.*) //' /proc/`,{field:"watchdog_pid"},`/stat | awk '{print $1}')
case "$process_state" in R|S|D|I) :;; *) exit 1;; esac
observed_value=$(sed 's/.*) //' /proc/`,{field:"stock_pid"},`/stat | awk '{print $2}')
[ "$observed_value" = `,{field:"watchdog_pid"},` ]
arguments=$(tr '\\000' '\\n' < /proc/`,{field:"watchdog_pid"},`/cmdline)
[ "$arguments" = "$(printf '/bin/sh\\n/data/bin/watchdog.sh')" ]
test -r /proc/`,{field:"stock_pid"},`/maps
if grep -F -q '/data/.esphome-cgs1/pm_qt_bridge.so' /proc/`,{field:"stock_pid"},`/maps; then exit 1; else result=$?; [ "$result" -eq 1 ]; fi
test ! -L /data/.esphome-cgs1/program
test -f /data/.esphome-cgs1/program
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/program)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/program | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_0"},` ]
test ! -L /data/.esphome-cgs1/pm_qt_bridge.so
test -f /data/.esphome-cgs1/pm_qt_bridge.so
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/pm_qt_bridge.so)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/pm_qt_bridge.so | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_1"},` ]
test ! -L /data/.esphome-cgs1/launch.sh
test -f /data/.esphome-cgs1/launch.sh
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/launch.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/launch.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_2"},` ]
test ! -L /data/.esphome-cgs1/SnowApp-with-PM
test -f /data/.esphome-cgs1/SnowApp-with-PM
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/SnowApp-with-PM)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/SnowApp-with-PM | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_3"},` ]
test ! -L /data/.esphome-cgs1/startup-hook.sh
test -f /data/.esphome-cgs1/startup-hook.sh
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/startup-hook.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/startup-hook.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_4"},` ]
test ! -L /data/.esphome-cgs1/stock-start.sh.original
test -f /data/.esphome-cgs1/stock-start.sh.original
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/stock-start.sh.original)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/stock-start.sh.original | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_5"},` ]
test ! -L /data/.esphome-cgs1/stock-watchdog.sh.original
test -f /data/.esphome-cgs1/stock-watchdog.sh.original
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/stock-watchdog.sh.original)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/stock-watchdog.sh.original | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_6"},` ]
test ! -L /data/.esphome-cgs1/start.sh.candidate
test -f /data/.esphome-cgs1/start.sh.candidate
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/start.sh.candidate)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/start.sh.candidate | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_7"},` ]
test ! -L /data/.esphome-cgs1/watchdog.sh.candidate
test -f /data/.esphome-cgs1/watchdog.sh.candidate
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/watchdog.sh.candidate)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/watchdog.sh.candidate | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_8"},` ]
test ! -L /data/bin/SnowApp
test -f /data/bin/SnowApp
observed_value=$(stat -c '%h %u' /data/bin/SnowApp)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/bin/SnowApp | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_0"},` ]
test ! -L /data/bin/watchdog.sh
test -f /data/bin/watchdog.sh
observed_value=$(stat -c '%h %u' /data/bin/watchdog.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/bin/watchdog.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_1"},` ]
test ! -L /data/etc/init.d/start.sh
test -f /data/etc/init.d/start.sh
observed_value=$(stat -c '%h %u' /data/etc/init.d/start.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/etc/init.d/start.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_2"},` ]
test ! -L /etc/init.d/S12_launcher_init
test -f /etc/init.d/S12_launcher_init
observed_value=$(stat -c '%h %u' /etc/init.d/S12_launcher_init)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /etc/init.d/S12_launcher_init | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_3"},` ]
test ! -L /etc/init.d/S50_px3se_init
test -f /etc/init.d/S50_px3se_init
observed_value=$(stat -c '%h %u' /etc/init.d/S50_px3se_init)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /etc/init.d/S50_px3se_init | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_4"},` ]
test ! -L /lib/ld-2.23.so
test -f /lib/ld-2.23.so
observed_value=$(stat -c '%h %u' /lib/ld-2.23.so)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /lib/ld-2.23.so | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_5"},` ]
test ! -L /lib/libc-2.23.so
test -f /lib/libc-2.23.so
observed_value=$(stat -c '%h %u' /lib/libc-2.23.so)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /lib/libc-2.23.so | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_6"},` ]
test ! -L /usr/lib/libQt5Core.so.5.9.4
test -f /usr/lib/libQt5Core.so.5.9.4
observed_value=$(stat -c '%h %u' /usr/lib/libQt5Core.so.5.9.4)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /usr/lib/libQt5Core.so.5.9.4 | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_7"},` ]
test ! -L /usr/lib/libstdc++.so.6.0.20
test -f /usr/lib/libstdc++.so.6.0.20
observed_value=$(stat -c '%h %u' /usr/lib/libstdc++.so.6.0.20)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /usr/lib/libstdc++.so.6.0.20 | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_8"},` ]
mkdir /data/.esphome-cgs1/.commit-disabled.lock
chmod 700 /data/.esphome-cgs1/.commit-disabled.lock
printf '%s\\n' 'commit-disabled `,{field:"nonce"}," ",{field:"plan_id"},`' > /data/.esphome-cgs1/.commit-disabled.lock/owner
sync`],watchdog:[`test ! -L /data/.esphome-cgs1
test -d /data/.esphome-cgs1
observed_value=$(stat -c '%d %i %a %u' /data/.esphome-cgs1)
[ "$observed_value" = '`,{field:"root_device"}," ",{field:"root_inode"},` 700 0' ]
test ! -L /data/bin
test ! -L /data/etc
test ! -L /data/etc/init.d
observed_value=$(stat -c '%d' /data/bin)
[ "$observed_value" = `,{field:"root_device"},` ]
observed_value=$(stat -c '%d' /data/etc/init.d)
[ "$observed_value" = `,{field:"root_device"},` ]
test ! -L /data/.esphome-cgs1/install.intent
test -f /data/.esphome-cgs1/install.intent
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/install.intent)
[ "$observed_value" = '98 600 0 1' ]
observed_value=$(cat /data/.esphome-cgs1/install.intent)
[ "$observed_value" = '`,{field:"plan_id"}," ",{field:"plan_sha256"},`' ]
test ! -L /data/.esphome-cgs1/disabled
test -f /data/.esphome-cgs1/disabled
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/disabled)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/disabled | awk '{print $1}')
[ "$observed_value" = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 ]
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/disabled)
[ "$observed_value" = '0 600 0 1' ]
test ! -L /data/.esphome-cgs1/pm-helper.disabled
test -f /data/.esphome-cgs1/pm-helper.disabled
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/pm-helper.disabled)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/pm-helper.disabled | awk '{print $1}')
[ "$observed_value" = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 ]
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/pm-helper.disabled)
[ "$observed_value" = '0 600 0 1' ]
observed_value=$(cat /sys/class/net/wlan0/address)
[ "$observed_value" = `,{field:"wlan_mac"},` ]
observed_value=$(cat /data/etc/os-release)
[ "$observed_value" = CLEARGRASS_VERSION=4.1.8_0287 ]
observed_value=$(cat /proc/sys/kernel/random/boot_id)
[ "$observed_value" = `,{field:"boot_id"},` ]
observed_value=$(awk '
BEGIN { section=0; count=0 }
/^[ \\t]*\\[/ { section=($0 ~ /^[ \\t]*\\[sensors\\][ \\t]*\\r?$/) }
section && /^[ \\t]*co2_type[ \\t]*=/ {
    value=$0; sub(/^[^=]*=[ \\t]*/, "", value); sub(/[ \\t\\r]*$/, "", value)
    print value; count++
}
END { if (count != 1) exit 1 }
' /data/etc/setting.ini)
[ "$observed_value" = `,{field:"co2_type"},` ]
observed_value=$(count=0
for link in /proc/[0-9]*/exe; do
    count=$((count+1))
    [ "$count" -le 4096 ] || exit 1
    pid=\${link#/proc/}; pid=\${pid%/exe}
    case "$pid" in (''|*[!0-9]*) exit 1;; esac
    if executable=$(readlink "$link" 2>/dev/null); then
        :
    else
        # Kernel threads and exited tasks legitimately have no executable.
        # An unreadable live userspace exe is NOT evidence of its absence.
        [ -d "/proc/$pid" ] || continue
        metadata=$(sed 's/.*) //' "/proc/$pid/stat" 2>/dev/null | awk '{print $1, $7}')
        set -- $metadata
        if [ "$#" -ne 2 ]; then
            [ ! -d "/proc/$pid" ] && continue
            exit 1
        fi
        case "$2" in (''|*[!0-9]*) exit 1;; esac
        case "$1" in (Z|X|x) continue;; esac
        [ "$(($2 & 2097152))" -ne 0 ] || exit 1
        continue
    fi
    case "$executable" in
        (/data/.esphome-cgs1/*) exit 1;;
        (/data/bin/SnowApp) printf '%s\\n' "$pid";;
    esac
done)
[ "$observed_value" = `,{field:"stock_pid"},` ]
observed_value=$(readlink /proc/`,{field:"stock_pid"},`/exe)
[ "$observed_value" = /data/bin/SnowApp ]
observed_value=$(stat -c '%u' /proc/`,{field:"stock_pid"},`)
[ "$observed_value" = 0 ]
observed_value=$(sed 's/.*) //' /proc/`,{field:"stock_pid"},`/stat | awk '{print $20}')
[ "$observed_value" = `,{field:"stock_start"},` ]
process_state=$(sed 's/.*) //' /proc/`,{field:"stock_pid"},`/stat | awk '{print $1}')
case "$process_state" in R|S|D|I) :;; *) exit 1;; esac
observed_value=$(readlink /proc/`,{field:"watchdog_pid"},`/exe)
[ "$observed_value" = /bin/busybox ]
observed_value=$(stat -c '%u' /proc/`,{field:"watchdog_pid"},`)
[ "$observed_value" = 0 ]
observed_value=$(sed 's/.*) //' /proc/`,{field:"watchdog_pid"},`/stat | awk '{print $20}')
[ "$observed_value" = `,{field:"watchdog_start"},` ]
process_state=$(sed 's/.*) //' /proc/`,{field:"watchdog_pid"},`/stat | awk '{print $1}')
case "$process_state" in R|S|D|I) :;; *) exit 1;; esac
observed_value=$(sed 's/.*) //' /proc/`,{field:"stock_pid"},`/stat | awk '{print $2}')
[ "$observed_value" = `,{field:"watchdog_pid"},` ]
arguments=$(tr '\\000' '\\n' < /proc/`,{field:"watchdog_pid"},`/cmdline)
[ "$arguments" = "$(printf '/bin/sh\\n/data/bin/watchdog.sh')" ]
test -r /proc/`,{field:"stock_pid"},`/maps
if grep -F -q '/data/.esphome-cgs1/pm_qt_bridge.so' /proc/`,{field:"stock_pid"},`/maps; then exit 1; else result=$?; [ "$result" -eq 1 ]; fi
test ! -L /data/.esphome-cgs1/program
test -f /data/.esphome-cgs1/program
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/program)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/program | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_0"},` ]
test ! -L /data/.esphome-cgs1/pm_qt_bridge.so
test -f /data/.esphome-cgs1/pm_qt_bridge.so
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/pm_qt_bridge.so)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/pm_qt_bridge.so | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_1"},` ]
test ! -L /data/.esphome-cgs1/launch.sh
test -f /data/.esphome-cgs1/launch.sh
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/launch.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/launch.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_2"},` ]
test ! -L /data/.esphome-cgs1/SnowApp-with-PM
test -f /data/.esphome-cgs1/SnowApp-with-PM
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/SnowApp-with-PM)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/SnowApp-with-PM | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_3"},` ]
test ! -L /data/.esphome-cgs1/startup-hook.sh
test -f /data/.esphome-cgs1/startup-hook.sh
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/startup-hook.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/startup-hook.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_4"},` ]
test ! -L /data/.esphome-cgs1/stock-start.sh.original
test -f /data/.esphome-cgs1/stock-start.sh.original
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/stock-start.sh.original)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/stock-start.sh.original | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_5"},` ]
test ! -L /data/.esphome-cgs1/stock-watchdog.sh.original
test -f /data/.esphome-cgs1/stock-watchdog.sh.original
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/stock-watchdog.sh.original)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/stock-watchdog.sh.original | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_6"},` ]
test ! -L /data/.esphome-cgs1/start.sh.candidate
test -f /data/.esphome-cgs1/start.sh.candidate
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/start.sh.candidate)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/start.sh.candidate | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_7"},` ]
test ! -L /data/.esphome-cgs1/watchdog.sh.candidate
test -f /data/.esphome-cgs1/watchdog.sh.candidate
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/watchdog.sh.candidate)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/watchdog.sh.candidate | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_8"},` ]
test ! -L /data/bin/SnowApp
test -f /data/bin/SnowApp
observed_value=$(stat -c '%h %u' /data/bin/SnowApp)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/bin/SnowApp | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_0"},` ]
test ! -L /data/bin/watchdog.sh
test -f /data/bin/watchdog.sh
observed_value=$(stat -c '%h %u' /data/bin/watchdog.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/bin/watchdog.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_1"},` ]
test ! -L /data/etc/init.d/start.sh
test -f /data/etc/init.d/start.sh
observed_value=$(stat -c '%h %u' /data/etc/init.d/start.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/etc/init.d/start.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_2"},` ]
test ! -L /etc/init.d/S12_launcher_init
test -f /etc/init.d/S12_launcher_init
observed_value=$(stat -c '%h %u' /etc/init.d/S12_launcher_init)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /etc/init.d/S12_launcher_init | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_3"},` ]
test ! -L /etc/init.d/S50_px3se_init
test -f /etc/init.d/S50_px3se_init
observed_value=$(stat -c '%h %u' /etc/init.d/S50_px3se_init)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /etc/init.d/S50_px3se_init | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_4"},` ]
test ! -L /lib/ld-2.23.so
test -f /lib/ld-2.23.so
observed_value=$(stat -c '%h %u' /lib/ld-2.23.so)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /lib/ld-2.23.so | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_5"},` ]
test ! -L /lib/libc-2.23.so
test -f /lib/libc-2.23.so
observed_value=$(stat -c '%h %u' /lib/libc-2.23.so)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /lib/libc-2.23.so | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_6"},` ]
test ! -L /usr/lib/libQt5Core.so.5.9.4
test -f /usr/lib/libQt5Core.so.5.9.4
observed_value=$(stat -c '%h %u' /usr/lib/libQt5Core.so.5.9.4)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /usr/lib/libQt5Core.so.5.9.4 | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_7"},` ]
test ! -L /usr/lib/libstdc++.so.6.0.20
test -f /usr/lib/libstdc++.so.6.0.20
observed_value=$(stat -c '%h %u' /usr/lib/libstdc++.so.6.0.20)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /usr/lib/libstdc++.so.6.0.20 | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_8"},` ]
test ! -L /data/.esphome-cgs1/.commit-disabled.lock
test -d /data/.esphome-cgs1/.commit-disabled.lock
observed_value=$(stat -c '%a %u' /data/.esphome-cgs1/.commit-disabled.lock)
[ "$observed_value" = '700 0' ]
test ! -L /data/.esphome-cgs1/.commit-disabled.lock/owner
test -f /data/.esphome-cgs1/.commit-disabled.lock/owner
observed_value=$(stat -c '%a %u %h' /data/.esphome-cgs1/.commit-disabled.lock/owner)
[ "$observed_value" = '600 0 1' ]
observed_value=$(cat /data/.esphome-cgs1/.commit-disabled.lock/owner)
[ "$observed_value" = 'commit-disabled `,{field:"nonce"}," ",{field:"plan_id"},`' ]
test ! -e /data/.esphome-cgs1/.commit-disabled.next
test ! -L /data/.esphome-cgs1/.commit-disabled.next
cp /data/.esphome-cgs1/watchdog.sh.candidate /data/.esphome-cgs1/.commit-disabled.next
chmod 755 /data/.esphome-cgs1/.commit-disabled.next
/bin/sh -n /data/.esphome-cgs1/.commit-disabled.next
test ! -L /data/.esphome-cgs1/.commit-disabled.next
test -f /data/.esphome-cgs1/.commit-disabled.next
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/.commit-disabled.next)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/.commit-disabled.next | awk '{print $1}')
[ "$observed_value" = 1d74ef0946734e1ddf9e76301012f9ed66d7b38d9d7a0239a5d0e80acabf2cce ]
sync
test ! -L /data/.esphome-cgs1
test -d /data/.esphome-cgs1
observed_value=$(stat -c '%d %i %a %u' /data/.esphome-cgs1)
[ "$observed_value" = '`,{field:"root_device"}," ",{field:"root_inode"},` 700 0' ]
test ! -L /data/bin
test ! -L /data/etc
test ! -L /data/etc/init.d
observed_value=$(stat -c '%d' /data/bin)
[ "$observed_value" = `,{field:"root_device"},` ]
observed_value=$(stat -c '%d' /data/etc/init.d)
[ "$observed_value" = `,{field:"root_device"},` ]
test ! -L /data/.esphome-cgs1/install.intent
test -f /data/.esphome-cgs1/install.intent
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/install.intent)
[ "$observed_value" = '98 600 0 1' ]
observed_value=$(cat /data/.esphome-cgs1/install.intent)
[ "$observed_value" = '`,{field:"plan_id"}," ",{field:"plan_sha256"},`' ]
test ! -L /data/.esphome-cgs1/disabled
test -f /data/.esphome-cgs1/disabled
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/disabled)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/disabled | awk '{print $1}')
[ "$observed_value" = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 ]
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/disabled)
[ "$observed_value" = '0 600 0 1' ]
test ! -L /data/.esphome-cgs1/pm-helper.disabled
test -f /data/.esphome-cgs1/pm-helper.disabled
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/pm-helper.disabled)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/pm-helper.disabled | awk '{print $1}')
[ "$observed_value" = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 ]
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/pm-helper.disabled)
[ "$observed_value" = '0 600 0 1' ]
observed_value=$(cat /sys/class/net/wlan0/address)
[ "$observed_value" = `,{field:"wlan_mac"},` ]
observed_value=$(cat /data/etc/os-release)
[ "$observed_value" = CLEARGRASS_VERSION=4.1.8_0287 ]
observed_value=$(cat /proc/sys/kernel/random/boot_id)
[ "$observed_value" = `,{field:"boot_id"},` ]
observed_value=$(awk '
BEGIN { section=0; count=0 }
/^[ \\t]*\\[/ { section=($0 ~ /^[ \\t]*\\[sensors\\][ \\t]*\\r?$/) }
section && /^[ \\t]*co2_type[ \\t]*=/ {
    value=$0; sub(/^[^=]*=[ \\t]*/, "", value); sub(/[ \\t\\r]*$/, "", value)
    print value; count++
}
END { if (count != 1) exit 1 }
' /data/etc/setting.ini)
[ "$observed_value" = `,{field:"co2_type"},` ]
observed_value=$(count=0
for link in /proc/[0-9]*/exe; do
    count=$((count+1))
    [ "$count" -le 4096 ] || exit 1
    pid=\${link#/proc/}; pid=\${pid%/exe}
    case "$pid" in (''|*[!0-9]*) exit 1;; esac
    if executable=$(readlink "$link" 2>/dev/null); then
        :
    else
        # Kernel threads and exited tasks legitimately have no executable.
        # An unreadable live userspace exe is NOT evidence of its absence.
        [ -d "/proc/$pid" ] || continue
        metadata=$(sed 's/.*) //' "/proc/$pid/stat" 2>/dev/null | awk '{print $1, $7}')
        set -- $metadata
        if [ "$#" -ne 2 ]; then
            [ ! -d "/proc/$pid" ] && continue
            exit 1
        fi
        case "$2" in (''|*[!0-9]*) exit 1;; esac
        case "$1" in (Z|X|x) continue;; esac
        [ "$(($2 & 2097152))" -ne 0 ] || exit 1
        continue
    fi
    case "$executable" in
        (/data/.esphome-cgs1/*) exit 1;;
        (/data/bin/SnowApp) printf '%s\\n' "$pid";;
    esac
done)
[ "$observed_value" = `,{field:"stock_pid"},` ]
observed_value=$(readlink /proc/`,{field:"stock_pid"},`/exe)
[ "$observed_value" = /data/bin/SnowApp ]
observed_value=$(stat -c '%u' /proc/`,{field:"stock_pid"},`)
[ "$observed_value" = 0 ]
observed_value=$(sed 's/.*) //' /proc/`,{field:"stock_pid"},`/stat | awk '{print $20}')
[ "$observed_value" = `,{field:"stock_start"},` ]
process_state=$(sed 's/.*) //' /proc/`,{field:"stock_pid"},`/stat | awk '{print $1}')
case "$process_state" in R|S|D|I) :;; *) exit 1;; esac
observed_value=$(readlink /proc/`,{field:"watchdog_pid"},`/exe)
[ "$observed_value" = /bin/busybox ]
observed_value=$(stat -c '%u' /proc/`,{field:"watchdog_pid"},`)
[ "$observed_value" = 0 ]
observed_value=$(sed 's/.*) //' /proc/`,{field:"watchdog_pid"},`/stat | awk '{print $20}')
[ "$observed_value" = `,{field:"watchdog_start"},` ]
process_state=$(sed 's/.*) //' /proc/`,{field:"watchdog_pid"},`/stat | awk '{print $1}')
case "$process_state" in R|S|D|I) :;; *) exit 1;; esac
observed_value=$(sed 's/.*) //' /proc/`,{field:"stock_pid"},`/stat | awk '{print $2}')
[ "$observed_value" = `,{field:"watchdog_pid"},` ]
arguments=$(tr '\\000' '\\n' < /proc/`,{field:"watchdog_pid"},`/cmdline)
[ "$arguments" = "$(printf '/bin/sh\\n/data/bin/watchdog.sh')" ]
test -r /proc/`,{field:"stock_pid"},`/maps
if grep -F -q '/data/.esphome-cgs1/pm_qt_bridge.so' /proc/`,{field:"stock_pid"},`/maps; then exit 1; else result=$?; [ "$result" -eq 1 ]; fi
test ! -L /data/.esphome-cgs1/program
test -f /data/.esphome-cgs1/program
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/program)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/program | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_0"},` ]
test ! -L /data/.esphome-cgs1/pm_qt_bridge.so
test -f /data/.esphome-cgs1/pm_qt_bridge.so
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/pm_qt_bridge.so)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/pm_qt_bridge.so | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_1"},` ]
test ! -L /data/.esphome-cgs1/launch.sh
test -f /data/.esphome-cgs1/launch.sh
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/launch.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/launch.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_2"},` ]
test ! -L /data/.esphome-cgs1/SnowApp-with-PM
test -f /data/.esphome-cgs1/SnowApp-with-PM
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/SnowApp-with-PM)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/SnowApp-with-PM | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_3"},` ]
test ! -L /data/.esphome-cgs1/startup-hook.sh
test -f /data/.esphome-cgs1/startup-hook.sh
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/startup-hook.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/startup-hook.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_4"},` ]
test ! -L /data/.esphome-cgs1/stock-start.sh.original
test -f /data/.esphome-cgs1/stock-start.sh.original
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/stock-start.sh.original)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/stock-start.sh.original | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_5"},` ]
test ! -L /data/.esphome-cgs1/stock-watchdog.sh.original
test -f /data/.esphome-cgs1/stock-watchdog.sh.original
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/stock-watchdog.sh.original)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/stock-watchdog.sh.original | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_6"},` ]
test ! -L /data/.esphome-cgs1/start.sh.candidate
test -f /data/.esphome-cgs1/start.sh.candidate
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/start.sh.candidate)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/start.sh.candidate | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_7"},` ]
test ! -L /data/.esphome-cgs1/watchdog.sh.candidate
test -f /data/.esphome-cgs1/watchdog.sh.candidate
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/watchdog.sh.candidate)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/watchdog.sh.candidate | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_8"},` ]
test ! -L /data/bin/SnowApp
test -f /data/bin/SnowApp
observed_value=$(stat -c '%h %u' /data/bin/SnowApp)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/bin/SnowApp | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_0"},` ]
test ! -L /data/bin/watchdog.sh
test -f /data/bin/watchdog.sh
observed_value=$(stat -c '%h %u' /data/bin/watchdog.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/bin/watchdog.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_1"},` ]
test ! -L /data/etc/init.d/start.sh
test -f /data/etc/init.d/start.sh
observed_value=$(stat -c '%h %u' /data/etc/init.d/start.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/etc/init.d/start.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_2"},` ]
test ! -L /etc/init.d/S12_launcher_init
test -f /etc/init.d/S12_launcher_init
observed_value=$(stat -c '%h %u' /etc/init.d/S12_launcher_init)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /etc/init.d/S12_launcher_init | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_3"},` ]
test ! -L /etc/init.d/S50_px3se_init
test -f /etc/init.d/S50_px3se_init
observed_value=$(stat -c '%h %u' /etc/init.d/S50_px3se_init)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /etc/init.d/S50_px3se_init | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_4"},` ]
test ! -L /lib/ld-2.23.so
test -f /lib/ld-2.23.so
observed_value=$(stat -c '%h %u' /lib/ld-2.23.so)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /lib/ld-2.23.so | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_5"},` ]
test ! -L /lib/libc-2.23.so
test -f /lib/libc-2.23.so
observed_value=$(stat -c '%h %u' /lib/libc-2.23.so)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /lib/libc-2.23.so | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_6"},` ]
test ! -L /usr/lib/libQt5Core.so.5.9.4
test -f /usr/lib/libQt5Core.so.5.9.4
observed_value=$(stat -c '%h %u' /usr/lib/libQt5Core.so.5.9.4)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /usr/lib/libQt5Core.so.5.9.4 | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_7"},` ]
test ! -L /usr/lib/libstdc++.so.6.0.20
test -f /usr/lib/libstdc++.so.6.0.20
observed_value=$(stat -c '%h %u' /usr/lib/libstdc++.so.6.0.20)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /usr/lib/libstdc++.so.6.0.20 | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_8"},` ]
test ! -L /data/.esphome-cgs1/.commit-disabled.lock
test -d /data/.esphome-cgs1/.commit-disabled.lock
observed_value=$(stat -c '%a %u' /data/.esphome-cgs1/.commit-disabled.lock)
[ "$observed_value" = '700 0' ]
test ! -L /data/.esphome-cgs1/.commit-disabled.lock/owner
test -f /data/.esphome-cgs1/.commit-disabled.lock/owner
observed_value=$(stat -c '%a %u %h' /data/.esphome-cgs1/.commit-disabled.lock/owner)
[ "$observed_value" = '600 0 1' ]
observed_value=$(cat /data/.esphome-cgs1/.commit-disabled.lock/owner)
[ "$observed_value" = 'commit-disabled `,{field:"nonce"}," ",{field:"plan_id"},`' ]
test ! -L /data/bin/watchdog.sh
test -f /data/bin/watchdog.sh
observed_value=$(stat -c '%h %u' /data/bin/watchdog.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/bin/watchdog.sh | awk '{print $1}')
[ "$observed_value" = 07b61bb67ff58a97e0f92de5b8bf0a94ca106e27ba3afa50f322817b8896dad7 ]
mv /data/.esphome-cgs1/.commit-disabled.next /data/bin/watchdog.sh
sync`],start:[`test ! -L /data/.esphome-cgs1
test -d /data/.esphome-cgs1
observed_value=$(stat -c '%d %i %a %u' /data/.esphome-cgs1)
[ "$observed_value" = '`,{field:"root_device"}," ",{field:"root_inode"},` 700 0' ]
test ! -L /data/bin
test ! -L /data/etc
test ! -L /data/etc/init.d
observed_value=$(stat -c '%d' /data/bin)
[ "$observed_value" = `,{field:"root_device"},` ]
observed_value=$(stat -c '%d' /data/etc/init.d)
[ "$observed_value" = `,{field:"root_device"},` ]
test ! -L /data/.esphome-cgs1/install.intent
test -f /data/.esphome-cgs1/install.intent
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/install.intent)
[ "$observed_value" = '98 600 0 1' ]
observed_value=$(cat /data/.esphome-cgs1/install.intent)
[ "$observed_value" = '`,{field:"plan_id"}," ",{field:"plan_sha256"},`' ]
test ! -L /data/.esphome-cgs1/disabled
test -f /data/.esphome-cgs1/disabled
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/disabled)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/disabled | awk '{print $1}')
[ "$observed_value" = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 ]
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/disabled)
[ "$observed_value" = '0 600 0 1' ]
test ! -L /data/.esphome-cgs1/pm-helper.disabled
test -f /data/.esphome-cgs1/pm-helper.disabled
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/pm-helper.disabled)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/pm-helper.disabled | awk '{print $1}')
[ "$observed_value" = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 ]
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/pm-helper.disabled)
[ "$observed_value" = '0 600 0 1' ]
observed_value=$(cat /sys/class/net/wlan0/address)
[ "$observed_value" = `,{field:"wlan_mac"},` ]
observed_value=$(cat /data/etc/os-release)
[ "$observed_value" = CLEARGRASS_VERSION=4.1.8_0287 ]
observed_value=$(cat /proc/sys/kernel/random/boot_id)
[ "$observed_value" = `,{field:"boot_id"},` ]
observed_value=$(awk '
BEGIN { section=0; count=0 }
/^[ \\t]*\\[/ { section=($0 ~ /^[ \\t]*\\[sensors\\][ \\t]*\\r?$/) }
section && /^[ \\t]*co2_type[ \\t]*=/ {
    value=$0; sub(/^[^=]*=[ \\t]*/, "", value); sub(/[ \\t\\r]*$/, "", value)
    print value; count++
}
END { if (count != 1) exit 1 }
' /data/etc/setting.ini)
[ "$observed_value" = `,{field:"co2_type"},` ]
observed_value=$(count=0
for link in /proc/[0-9]*/exe; do
    count=$((count+1))
    [ "$count" -le 4096 ] || exit 1
    pid=\${link#/proc/}; pid=\${pid%/exe}
    case "$pid" in (''|*[!0-9]*) exit 1;; esac
    if executable=$(readlink "$link" 2>/dev/null); then
        :
    else
        # Kernel threads and exited tasks legitimately have no executable.
        # An unreadable live userspace exe is NOT evidence of its absence.
        [ -d "/proc/$pid" ] || continue
        metadata=$(sed 's/.*) //' "/proc/$pid/stat" 2>/dev/null | awk '{print $1, $7}')
        set -- $metadata
        if [ "$#" -ne 2 ]; then
            [ ! -d "/proc/$pid" ] && continue
            exit 1
        fi
        case "$2" in (''|*[!0-9]*) exit 1;; esac
        case "$1" in (Z|X|x) continue;; esac
        [ "$(($2 & 2097152))" -ne 0 ] || exit 1
        continue
    fi
    case "$executable" in
        (/data/.esphome-cgs1/*) exit 1;;
        (/data/bin/SnowApp) printf '%s\\n' "$pid";;
    esac
done)
[ "$observed_value" = `,{field:"stock_pid"},` ]
observed_value=$(readlink /proc/`,{field:"stock_pid"},`/exe)
[ "$observed_value" = /data/bin/SnowApp ]
observed_value=$(stat -c '%u' /proc/`,{field:"stock_pid"},`)
[ "$observed_value" = 0 ]
observed_value=$(sed 's/.*) //' /proc/`,{field:"stock_pid"},`/stat | awk '{print $20}')
[ "$observed_value" = `,{field:"stock_start"},` ]
process_state=$(sed 's/.*) //' /proc/`,{field:"stock_pid"},`/stat | awk '{print $1}')
case "$process_state" in R|S|D|I) :;; *) exit 1;; esac
observed_value=$(readlink /proc/`,{field:"watchdog_pid"},`/exe)
[ "$observed_value" = /bin/busybox ]
observed_value=$(stat -c '%u' /proc/`,{field:"watchdog_pid"},`)
[ "$observed_value" = 0 ]
observed_value=$(sed 's/.*) //' /proc/`,{field:"watchdog_pid"},`/stat | awk '{print $20}')
[ "$observed_value" = `,{field:"watchdog_start"},` ]
process_state=$(sed 's/.*) //' /proc/`,{field:"watchdog_pid"},`/stat | awk '{print $1}')
case "$process_state" in R|S|D|I) :;; *) exit 1;; esac
observed_value=$(sed 's/.*) //' /proc/`,{field:"stock_pid"},`/stat | awk '{print $2}')
[ "$observed_value" = `,{field:"watchdog_pid"},` ]
arguments=$(tr '\\000' '\\n' < /proc/`,{field:"watchdog_pid"},`/cmdline)
[ "$arguments" = "$(printf '/bin/sh\\n/data/bin/watchdog.sh')" ]
test -r /proc/`,{field:"stock_pid"},`/maps
if grep -F -q '/data/.esphome-cgs1/pm_qt_bridge.so' /proc/`,{field:"stock_pid"},`/maps; then exit 1; else result=$?; [ "$result" -eq 1 ]; fi
test ! -L /data/.esphome-cgs1/program
test -f /data/.esphome-cgs1/program
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/program)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/program | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_0"},` ]
test ! -L /data/.esphome-cgs1/pm_qt_bridge.so
test -f /data/.esphome-cgs1/pm_qt_bridge.so
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/pm_qt_bridge.so)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/pm_qt_bridge.so | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_1"},` ]
test ! -L /data/.esphome-cgs1/launch.sh
test -f /data/.esphome-cgs1/launch.sh
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/launch.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/launch.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_2"},` ]
test ! -L /data/.esphome-cgs1/SnowApp-with-PM
test -f /data/.esphome-cgs1/SnowApp-with-PM
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/SnowApp-with-PM)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/SnowApp-with-PM | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_3"},` ]
test ! -L /data/.esphome-cgs1/startup-hook.sh
test -f /data/.esphome-cgs1/startup-hook.sh
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/startup-hook.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/startup-hook.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_4"},` ]
test ! -L /data/.esphome-cgs1/stock-start.sh.original
test -f /data/.esphome-cgs1/stock-start.sh.original
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/stock-start.sh.original)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/stock-start.sh.original | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_5"},` ]
test ! -L /data/.esphome-cgs1/stock-watchdog.sh.original
test -f /data/.esphome-cgs1/stock-watchdog.sh.original
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/stock-watchdog.sh.original)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/stock-watchdog.sh.original | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_6"},` ]
test ! -L /data/.esphome-cgs1/start.sh.candidate
test -f /data/.esphome-cgs1/start.sh.candidate
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/start.sh.candidate)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/start.sh.candidate | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_7"},` ]
test ! -L /data/.esphome-cgs1/watchdog.sh.candidate
test -f /data/.esphome-cgs1/watchdog.sh.candidate
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/watchdog.sh.candidate)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/watchdog.sh.candidate | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_8"},` ]
test ! -L /data/bin/SnowApp
test -f /data/bin/SnowApp
observed_value=$(stat -c '%h %u' /data/bin/SnowApp)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/bin/SnowApp | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_0"},` ]
test ! -L /data/bin/watchdog.sh
test -f /data/bin/watchdog.sh
observed_value=$(stat -c '%h %u' /data/bin/watchdog.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/bin/watchdog.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_1"},` ]
test ! -L /data/etc/init.d/start.sh
test -f /data/etc/init.d/start.sh
observed_value=$(stat -c '%h %u' /data/etc/init.d/start.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/etc/init.d/start.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_2"},` ]
test ! -L /etc/init.d/S12_launcher_init
test -f /etc/init.d/S12_launcher_init
observed_value=$(stat -c '%h %u' /etc/init.d/S12_launcher_init)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /etc/init.d/S12_launcher_init | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_3"},` ]
test ! -L /etc/init.d/S50_px3se_init
test -f /etc/init.d/S50_px3se_init
observed_value=$(stat -c '%h %u' /etc/init.d/S50_px3se_init)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /etc/init.d/S50_px3se_init | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_4"},` ]
test ! -L /lib/ld-2.23.so
test -f /lib/ld-2.23.so
observed_value=$(stat -c '%h %u' /lib/ld-2.23.so)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /lib/ld-2.23.so | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_5"},` ]
test ! -L /lib/libc-2.23.so
test -f /lib/libc-2.23.so
observed_value=$(stat -c '%h %u' /lib/libc-2.23.so)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /lib/libc-2.23.so | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_6"},` ]
test ! -L /usr/lib/libQt5Core.so.5.9.4
test -f /usr/lib/libQt5Core.so.5.9.4
observed_value=$(stat -c '%h %u' /usr/lib/libQt5Core.so.5.9.4)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /usr/lib/libQt5Core.so.5.9.4 | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_7"},` ]
test ! -L /usr/lib/libstdc++.so.6.0.20
test -f /usr/lib/libstdc++.so.6.0.20
observed_value=$(stat -c '%h %u' /usr/lib/libstdc++.so.6.0.20)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /usr/lib/libstdc++.so.6.0.20 | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_8"},` ]
test ! -L /data/.esphome-cgs1/.commit-disabled.lock
test -d /data/.esphome-cgs1/.commit-disabled.lock
observed_value=$(stat -c '%a %u' /data/.esphome-cgs1/.commit-disabled.lock)
[ "$observed_value" = '700 0' ]
test ! -L /data/.esphome-cgs1/.commit-disabled.lock/owner
test -f /data/.esphome-cgs1/.commit-disabled.lock/owner
observed_value=$(stat -c '%a %u %h' /data/.esphome-cgs1/.commit-disabled.lock/owner)
[ "$observed_value" = '600 0 1' ]
observed_value=$(cat /data/.esphome-cgs1/.commit-disabled.lock/owner)
[ "$observed_value" = 'commit-disabled `,{field:"nonce"}," ",{field:"plan_id"},`' ]
test ! -e /data/.esphome-cgs1/.commit-disabled.next
test ! -L /data/.esphome-cgs1/.commit-disabled.next
cp /data/.esphome-cgs1/start.sh.candidate /data/.esphome-cgs1/.commit-disabled.next
chmod 755 /data/.esphome-cgs1/.commit-disabled.next
/bin/sh -n /data/.esphome-cgs1/.commit-disabled.next
test ! -L /data/.esphome-cgs1/.commit-disabled.next
test -f /data/.esphome-cgs1/.commit-disabled.next
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/.commit-disabled.next)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/.commit-disabled.next | awk '{print $1}')
[ "$observed_value" = f104f873dd3ce4544d5f3e3f90a4056bffc811bcaae037e347306e1084e7f1d1 ]
sync
test ! -L /data/.esphome-cgs1
test -d /data/.esphome-cgs1
observed_value=$(stat -c '%d %i %a %u' /data/.esphome-cgs1)
[ "$observed_value" = '`,{field:"root_device"}," ",{field:"root_inode"},` 700 0' ]
test ! -L /data/bin
test ! -L /data/etc
test ! -L /data/etc/init.d
observed_value=$(stat -c '%d' /data/bin)
[ "$observed_value" = `,{field:"root_device"},` ]
observed_value=$(stat -c '%d' /data/etc/init.d)
[ "$observed_value" = `,{field:"root_device"},` ]
test ! -L /data/.esphome-cgs1/install.intent
test -f /data/.esphome-cgs1/install.intent
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/install.intent)
[ "$observed_value" = '98 600 0 1' ]
observed_value=$(cat /data/.esphome-cgs1/install.intent)
[ "$observed_value" = '`,{field:"plan_id"}," ",{field:"plan_sha256"},`' ]
test ! -L /data/.esphome-cgs1/disabled
test -f /data/.esphome-cgs1/disabled
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/disabled)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/disabled | awk '{print $1}')
[ "$observed_value" = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 ]
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/disabled)
[ "$observed_value" = '0 600 0 1' ]
test ! -L /data/.esphome-cgs1/pm-helper.disabled
test -f /data/.esphome-cgs1/pm-helper.disabled
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/pm-helper.disabled)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/pm-helper.disabled | awk '{print $1}')
[ "$observed_value" = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 ]
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/pm-helper.disabled)
[ "$observed_value" = '0 600 0 1' ]
observed_value=$(cat /sys/class/net/wlan0/address)
[ "$observed_value" = `,{field:"wlan_mac"},` ]
observed_value=$(cat /data/etc/os-release)
[ "$observed_value" = CLEARGRASS_VERSION=4.1.8_0287 ]
observed_value=$(cat /proc/sys/kernel/random/boot_id)
[ "$observed_value" = `,{field:"boot_id"},` ]
observed_value=$(awk '
BEGIN { section=0; count=0 }
/^[ \\t]*\\[/ { section=($0 ~ /^[ \\t]*\\[sensors\\][ \\t]*\\r?$/) }
section && /^[ \\t]*co2_type[ \\t]*=/ {
    value=$0; sub(/^[^=]*=[ \\t]*/, "", value); sub(/[ \\t\\r]*$/, "", value)
    print value; count++
}
END { if (count != 1) exit 1 }
' /data/etc/setting.ini)
[ "$observed_value" = `,{field:"co2_type"},` ]
observed_value=$(count=0
for link in /proc/[0-9]*/exe; do
    count=$((count+1))
    [ "$count" -le 4096 ] || exit 1
    pid=\${link#/proc/}; pid=\${pid%/exe}
    case "$pid" in (''|*[!0-9]*) exit 1;; esac
    if executable=$(readlink "$link" 2>/dev/null); then
        :
    else
        # Kernel threads and exited tasks legitimately have no executable.
        # An unreadable live userspace exe is NOT evidence of its absence.
        [ -d "/proc/$pid" ] || continue
        metadata=$(sed 's/.*) //' "/proc/$pid/stat" 2>/dev/null | awk '{print $1, $7}')
        set -- $metadata
        if [ "$#" -ne 2 ]; then
            [ ! -d "/proc/$pid" ] && continue
            exit 1
        fi
        case "$2" in (''|*[!0-9]*) exit 1;; esac
        case "$1" in (Z|X|x) continue;; esac
        [ "$(($2 & 2097152))" -ne 0 ] || exit 1
        continue
    fi
    case "$executable" in
        (/data/.esphome-cgs1/*) exit 1;;
        (/data/bin/SnowApp) printf '%s\\n' "$pid";;
    esac
done)
[ "$observed_value" = `,{field:"stock_pid"},` ]
observed_value=$(readlink /proc/`,{field:"stock_pid"},`/exe)
[ "$observed_value" = /data/bin/SnowApp ]
observed_value=$(stat -c '%u' /proc/`,{field:"stock_pid"},`)
[ "$observed_value" = 0 ]
observed_value=$(sed 's/.*) //' /proc/`,{field:"stock_pid"},`/stat | awk '{print $20}')
[ "$observed_value" = `,{field:"stock_start"},` ]
process_state=$(sed 's/.*) //' /proc/`,{field:"stock_pid"},`/stat | awk '{print $1}')
case "$process_state" in R|S|D|I) :;; *) exit 1;; esac
observed_value=$(readlink /proc/`,{field:"watchdog_pid"},`/exe)
[ "$observed_value" = /bin/busybox ]
observed_value=$(stat -c '%u' /proc/`,{field:"watchdog_pid"},`)
[ "$observed_value" = 0 ]
observed_value=$(sed 's/.*) //' /proc/`,{field:"watchdog_pid"},`/stat | awk '{print $20}')
[ "$observed_value" = `,{field:"watchdog_start"},` ]
process_state=$(sed 's/.*) //' /proc/`,{field:"watchdog_pid"},`/stat | awk '{print $1}')
case "$process_state" in R|S|D|I) :;; *) exit 1;; esac
observed_value=$(sed 's/.*) //' /proc/`,{field:"stock_pid"},`/stat | awk '{print $2}')
[ "$observed_value" = `,{field:"watchdog_pid"},` ]
arguments=$(tr '\\000' '\\n' < /proc/`,{field:"watchdog_pid"},`/cmdline)
[ "$arguments" = "$(printf '/bin/sh\\n/data/bin/watchdog.sh')" ]
test -r /proc/`,{field:"stock_pid"},`/maps
if grep -F -q '/data/.esphome-cgs1/pm_qt_bridge.so' /proc/`,{field:"stock_pid"},`/maps; then exit 1; else result=$?; [ "$result" -eq 1 ]; fi
test ! -L /data/.esphome-cgs1/program
test -f /data/.esphome-cgs1/program
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/program)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/program | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_0"},` ]
test ! -L /data/.esphome-cgs1/pm_qt_bridge.so
test -f /data/.esphome-cgs1/pm_qt_bridge.so
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/pm_qt_bridge.so)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/pm_qt_bridge.so | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_1"},` ]
test ! -L /data/.esphome-cgs1/launch.sh
test -f /data/.esphome-cgs1/launch.sh
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/launch.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/launch.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_2"},` ]
test ! -L /data/.esphome-cgs1/SnowApp-with-PM
test -f /data/.esphome-cgs1/SnowApp-with-PM
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/SnowApp-with-PM)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/SnowApp-with-PM | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_3"},` ]
test ! -L /data/.esphome-cgs1/startup-hook.sh
test -f /data/.esphome-cgs1/startup-hook.sh
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/startup-hook.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/startup-hook.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_4"},` ]
test ! -L /data/.esphome-cgs1/stock-start.sh.original
test -f /data/.esphome-cgs1/stock-start.sh.original
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/stock-start.sh.original)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/stock-start.sh.original | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_5"},` ]
test ! -L /data/.esphome-cgs1/stock-watchdog.sh.original
test -f /data/.esphome-cgs1/stock-watchdog.sh.original
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/stock-watchdog.sh.original)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/stock-watchdog.sh.original | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_6"},` ]
test ! -L /data/.esphome-cgs1/start.sh.candidate
test -f /data/.esphome-cgs1/start.sh.candidate
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/start.sh.candidate)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/start.sh.candidate | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_7"},` ]
test ! -L /data/.esphome-cgs1/watchdog.sh.candidate
test -f /data/.esphome-cgs1/watchdog.sh.candidate
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/watchdog.sh.candidate)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/watchdog.sh.candidate | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_8"},` ]
test ! -L /data/bin/SnowApp
test -f /data/bin/SnowApp
observed_value=$(stat -c '%h %u' /data/bin/SnowApp)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/bin/SnowApp | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_0"},` ]
test ! -L /data/bin/watchdog.sh
test -f /data/bin/watchdog.sh
observed_value=$(stat -c '%h %u' /data/bin/watchdog.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/bin/watchdog.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_1"},` ]
test ! -L /data/etc/init.d/start.sh
test -f /data/etc/init.d/start.sh
observed_value=$(stat -c '%h %u' /data/etc/init.d/start.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/etc/init.d/start.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_2"},` ]
test ! -L /etc/init.d/S12_launcher_init
test -f /etc/init.d/S12_launcher_init
observed_value=$(stat -c '%h %u' /etc/init.d/S12_launcher_init)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /etc/init.d/S12_launcher_init | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_3"},` ]
test ! -L /etc/init.d/S50_px3se_init
test -f /etc/init.d/S50_px3se_init
observed_value=$(stat -c '%h %u' /etc/init.d/S50_px3se_init)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /etc/init.d/S50_px3se_init | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_4"},` ]
test ! -L /lib/ld-2.23.so
test -f /lib/ld-2.23.so
observed_value=$(stat -c '%h %u' /lib/ld-2.23.so)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /lib/ld-2.23.so | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_5"},` ]
test ! -L /lib/libc-2.23.so
test -f /lib/libc-2.23.so
observed_value=$(stat -c '%h %u' /lib/libc-2.23.so)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /lib/libc-2.23.so | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_6"},` ]
test ! -L /usr/lib/libQt5Core.so.5.9.4
test -f /usr/lib/libQt5Core.so.5.9.4
observed_value=$(stat -c '%h %u' /usr/lib/libQt5Core.so.5.9.4)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /usr/lib/libQt5Core.so.5.9.4 | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_7"},` ]
test ! -L /usr/lib/libstdc++.so.6.0.20
test -f /usr/lib/libstdc++.so.6.0.20
observed_value=$(stat -c '%h %u' /usr/lib/libstdc++.so.6.0.20)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /usr/lib/libstdc++.so.6.0.20 | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_8"},` ]
test ! -L /data/.esphome-cgs1/.commit-disabled.lock
test -d /data/.esphome-cgs1/.commit-disabled.lock
observed_value=$(stat -c '%a %u' /data/.esphome-cgs1/.commit-disabled.lock)
[ "$observed_value" = '700 0' ]
test ! -L /data/.esphome-cgs1/.commit-disabled.lock/owner
test -f /data/.esphome-cgs1/.commit-disabled.lock/owner
observed_value=$(stat -c '%a %u %h' /data/.esphome-cgs1/.commit-disabled.lock/owner)
[ "$observed_value" = '600 0 1' ]
observed_value=$(cat /data/.esphome-cgs1/.commit-disabled.lock/owner)
[ "$observed_value" = 'commit-disabled `,{field:"nonce"}," ",{field:"plan_id"},`' ]
test ! -L /data/etc/init.d/start.sh
test -f /data/etc/init.d/start.sh
observed_value=$(stat -c '%h %u' /data/etc/init.d/start.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/etc/init.d/start.sh | awk '{print $1}')
[ "$observed_value" = c38d532b44f02922aa850c247f0ddd227265c7873a35a20e9ac71ac21b9627e6 ]
mv /data/.esphome-cgs1/.commit-disabled.next /data/etc/init.d/start.sh
sync`]}};var J={identity:[{name:"uid",command:"id -u"},{name:"wlan_mac",command:"cat /sys/class/net/wlan0/address"},{name:"version",command:"cat /data/etc/os-release"},{name:"arch",command:"uname -m"},{name:"co2_type",command:`awk '
BEGIN { section=0; count=0 }
/^[ \\t]*\\[/ { section=($0 ~ /^[ \\t]*\\[sensors\\][ \\t]*\\r?$/) }
section && /^[ \\t]*co2_type[ \\t]*=/ {
    value=$0; sub(/^[^=]*=[ \\t]*/, "", value); sub(/[ \\t\\r]*$/, "", value)
    print value; count++
}
END { if (count != 1) exit 1 }
' /data/etc/setting.ini`},{name:"boot_id",command:"cat /proc/sys/kernel/random/boot_id"}],files:[{path:"/data/bin/SnowApp",sha256:"a39016531620a874668ee322f0e976f48e47943742c54c8a7291b9e830c91abb",size:4925568,command:`test ! -L /data/bin/SnowApp
test -f /data/bin/SnowApp
stat -c '%s %h' /data/bin/SnowApp
sha256sum /data/bin/SnowApp`,expected:`4925568 1
a39016531620a874668ee322f0e976f48e47943742c54c8a7291b9e830c91abb /data/bin/SnowApp`},{path:"/data/bin/watchdog.sh",sha256:"07b61bb67ff58a97e0f92de5b8bf0a94ca106e27ba3afa50f322817b8896dad7",size:1701,command:`test ! -L /data/bin/watchdog.sh
test -f /data/bin/watchdog.sh
stat -c '%s %h' /data/bin/watchdog.sh
sha256sum /data/bin/watchdog.sh`,expected:`1701 1
07b61bb67ff58a97e0f92de5b8bf0a94ca106e27ba3afa50f322817b8896dad7 /data/bin/watchdog.sh`},{path:"/data/etc/init.d/start.sh",sha256:"c38d532b44f02922aa850c247f0ddd227265c7873a35a20e9ac71ac21b9627e6",size:1639,command:`test ! -L /data/etc/init.d/start.sh
test -f /data/etc/init.d/start.sh
stat -c '%s %h' /data/etc/init.d/start.sh
sha256sum /data/etc/init.d/start.sh`,expected:`1639 1
c38d532b44f02922aa850c247f0ddd227265c7873a35a20e9ac71ac21b9627e6 /data/etc/init.d/start.sh`},{path:"/etc/init.d/S12_launcher_init",sha256:"533cac6f65b3ccf8d3404216c688877ad03a8b03af64edaade9bd6dc3aad1c35",size:497,command:`test ! -L /etc/init.d/S12_launcher_init
test -f /etc/init.d/S12_launcher_init
stat -c '%s %h' /etc/init.d/S12_launcher_init
sha256sum /etc/init.d/S12_launcher_init`,expected:`497 1
533cac6f65b3ccf8d3404216c688877ad03a8b03af64edaade9bd6dc3aad1c35 /etc/init.d/S12_launcher_init`},{path:"/etc/init.d/S50_px3se_init",sha256:"d818606f68bc1428ef96c5257df751a843cc9a6770dc25a2487a940c6bcb2492",size:480,command:`test ! -L /etc/init.d/S50_px3se_init
test -f /etc/init.d/S50_px3se_init
stat -c '%s %h' /etc/init.d/S50_px3se_init
sha256sum /etc/init.d/S50_px3se_init`,expected:`480 1
d818606f68bc1428ef96c5257df751a843cc9a6770dc25a2487a940c6bcb2492 /etc/init.d/S50_px3se_init`},{path:"/lib/ld-2.23.so",sha256:"6da48efda9ff440998747a66131e8ebdc6a57a15bb19dcfd7895a031368dd50a",size:155376,command:`test ! -L /lib/ld-2.23.so
test -f /lib/ld-2.23.so
stat -c '%s %h' /lib/ld-2.23.so
sha256sum /lib/ld-2.23.so`,expected:`155376 1
6da48efda9ff440998747a66131e8ebdc6a57a15bb19dcfd7895a031368dd50a /lib/ld-2.23.so`},{path:"/lib/libc-2.23.so",sha256:"6479e377cd35c6e90e9aba990ac5137b195ca765544ad0c561f7f5945ea7133e",size:1209932,command:`test ! -L /lib/libc-2.23.so
test -f /lib/libc-2.23.so
stat -c '%s %h' /lib/libc-2.23.so
sha256sum /lib/libc-2.23.so`,expected:`1209932 1
6479e377cd35c6e90e9aba990ac5137b195ca765544ad0c561f7f5945ea7133e /lib/libc-2.23.so`},{path:"/usr/lib/libstdc++.so.6.0.20",sha256:"93cc1352b59a0d3a39a8f9d311332f84115e3c5ee71afd846302b942071675c4",size:658792,command:`test ! -L /usr/lib/libstdc++.so.6.0.20
test -f /usr/lib/libstdc++.so.6.0.20
stat -c '%s %h' /usr/lib/libstdc++.so.6.0.20
sha256sum /usr/lib/libstdc++.so.6.0.20`,expected:`658792 1
93cc1352b59a0d3a39a8f9d311332f84115e3c5ee71afd846302b942071675c4 /usr/lib/libstdc++.so.6.0.20`},{path:"/usr/lib/libQt5Core.so.5.9.4",sha256:"b43e1cc628e625a422cfcf98aad38c9542b98cea28196ac4fd14931fd5ccf88d",size:5427824,command:`test ! -L /usr/lib/libQt5Core.so.5.9.4
test -f /usr/lib/libQt5Core.so.5.9.4
stat -c '%s %h' /usr/lib/libQt5Core.so.5.9.4
sha256sum /usr/lib/libQt5Core.so.5.9.4`,expected:`5427824 1
b43e1cc628e625a422cfcf98aad38c9542b98cea28196ac4fd14931fd5ccf88d /usr/lib/libQt5Core.so.5.9.4`}],absent_install:`test ! -e /data/.esphome-cgs1
test ! -L /data/.esphome-cgs1`};var I=Object.freeze([["bridge-program","program"],["pm_qt_bridge.so","pm_qt_bridge.so"],["launch.sh","launch.sh"],["SnowApp-with-PM","SnowApp-with-PM"],["startup-hook.sh","startup-hook.sh"],["stock-start.sh.original","stock-start.sh.original"],["stock-watchdog.sh.original","stock-watchdog.sh.original"],["start.sh.candidate","start.sh.candidate"],["watchdog.sh.candidate","watchdog.sh.candidate"]].map(t=>Object.freeze(t))),eo="/data/.esphome-cgs1/",to=16*1024*1024,Ri=65536,qa=/^[a-f0-9]{64}$/,hs=()=>{throw{code:"usb_browser_stage_unverified"}};async function so(t){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",t)),e=>e.toString(16).padStart(2,"0")).join("")}async function us(t){let e;try{return await Promise.race([Promise.resolve().then(t),new Promise((s,a)=>{e=setTimeout(()=>a({code:"usb_close_unverified"}),2e3)})])}finally{clearTimeout(e)}}var _s=class{#e;#t;#s=0;#i;#n;#a=!1;#h;#r=!1;#c;#u;constructor(e,s){(!e||Object.keys(e).sort().join()!==["openSync","pushV1","closeTransport"].sort().join()||Object.values(e).some(n=>typeof n!="function")||!s||Object.keys(s).sort().join()!==["plan_id","plan_sha256","intent_sha256","files"].sort().join()||typeof s.plan_id!="string"||!/^[a-f0-9]{32}$/.test(s.plan_id)||typeof s.plan_sha256!="string"||!qa.test(s.plan_sha256)||typeof s.intent_sha256!="string"||!qa.test(s.intent_sha256)||!s.files||Object.keys(s.files).sort().join()!==I.map(([n])=>n).sort().join())&&hs();let a={},i=0;for(let[n]of I){let r=s.files[n];(!r||Object.keys(r).sort().join()!==["size","sha256"].sort().join()||!Number.isInteger(r.size)||r.size<=0||r.size>to||typeof r.sha256!="string"||!qa.test(r.sha256))&&hs(),i+=r.size,a[n]=Object.freeze({...r})}i>32*1024*1024&&hs(),this.#t=Object.freeze(a),this.#e=Object.freeze({...e}),this.#c=Date.now()+24e4,this.#u=setTimeout(()=>{this.close().catch(()=>{})},24e4)}async#l(){await this.close().catch(()=>{}),hs()}#b(){return!this.#a&&Date.now()<this.#c}async begin(e){return!this.#b()||this.#r||this.#i||this.#s>=I.length||e!==I[this.#s][0]?this.#l():(this.#i={role:e,offset:0,bytes:new Uint8Array(this.#t[e].size)},{role:e,offset:0})}async append(e,s,a){let i=this.#i;return!this.#b()||this.#r||!i||e!==i.role||!Number.isInteger(s)||s!==i.offset||!(a instanceof Uint8Array)||a.length<1||a.length>Ri||s+a.length>i.bytes.length?this.#l():(i.bytes.set(a,s),i.offset+=a.length,{role:e,offset:i.offset})}async#p(e){let s=this.#c-Date.now();if(s<=0)return this.#l();let a;try{return await Promise.race([Promise.resolve().then(e),new Promise((i,n)=>{a=setTimeout(()=>n({code:"usb_browser_stage_unverified"}),Math.min(9e4,s))})])}finally{clearTimeout(a)}}async finish(e){let s=this.#i;if(!this.#b()||this.#r||!s||e!==s.role||s.offset!==s.bytes.length)return this.#l();this.#r=!0;try{let a=this.#t[e];if(await so(s.bytes)!==a.sha256||!this.#b()||(await this.#p(async()=>{let i=await this.#e.openSync();if(this.#a)throw await us(()=>i.close()),Error();this.#n=i}),await this.#p(()=>this.#e.pushV1({socket:this.#n,filename:eo+I[this.#s][1],type:8,permission:384,mtime:0,packetSize:Ri,file:new ReadableStream({start(i){i.enqueue(s.bytes),i.close()}})})),await us(()=>this.#n.close()),this.#n=void 0,!this.#b()))throw Error();return this.#i=void 0,this.#s++,{role:e,size:a.size,sha256:a.sha256,wire_acknowledged:!0}}catch{return await this.#l()}finally{this.#r=!1}}close(){if(this.#h)return this.#h;this.#a=!0,clearTimeout(this.#u);let e=this.#n;return this.#n=void 0,this.#i=void 0,this.#h=(async()=>{let s=!1;if(e)try{await us(()=>e.close())}catch{s=!0}try{await us(()=>this.#e.closeTransport())}catch{s=!0}if(s)throw{code:"usb_close_unverified"}})(),this.#h}};function W(t,e,s){return typeof t!="string"||typeof e!="string"||!/^[a-f0-9]{64}$/.test(e)||typeof s!="string"||!/^\/[A-Za-z0-9._/+-]+$/.test(s)||s.split("/").slice(1).some(a=>!a||a==="."||a==="..")?!1:t===e+" "+s||t===e+"  "+s}function _t(t,e){if(typeof t!="string"||!e||!Number.isInteger(e.size)||e.size<1||e.size>8*1024*1024)return!1;let s=t.split(`
`);return s.length===2&&s[0]===`${e.size} 1`&&W(s[1],e.sha256,e.path)}var M="/data/.esphome-cgs1",X="/data/.esphome-cgs1-stage",Oa=/^[a-f0-9]{64}$/,ao=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/,bt=()=>{throw{code:"usb_browser_stage_unverified"}},Na=new Set(["bridge-program","launch.sh","SnowApp-with-PM"]),io=J.files.map(t=>t.path);function Ta(t,e){return Ui(t,e,!1)}function Bi(t,e){let s=Ui(t,e,!0);return Object.freeze({guard:s.guard,inspect:s.inspect,inspectComplete:s.inspectComplete,afterBytes:s.afterBytes})}function Ui(t,e,s){(!t||typeof t.plan_id!="string"||!/^[a-f0-9]{32}$/.test(t.plan_id)||typeof t.plan_sha256!="string"||!Oa.test(t.plan_sha256)||typeof t.intent_sha256!="string"||!Oa.test(t.intent_sha256)||typeof e!="string"||!ao.test(e))&&bt();let a=t.plan_id+" "+t.plan_sha256,i=a+" "+t.intent_sha256,n=i+" "+e,r=`CGS1_STAGE_BOOT=$(cat /proc/sys/kernel/random/boot_id)
test "$CGS1_STAGE_BOOT" = '${e}'`,o=(p,u)=>`test ! -L ${M}/${p}
test -f ${M}/${p}
CGS1_STAGE_META=$(stat -c '%a %u %h %s' ${M}/${p})
test "$CGS1_STAGE_META" = '600 0 1 ${u}'`,d=(p,u)=>`test ! -L ${X}/${p}
test -f ${X}/${p}
CGS1_STAGE_META=$(stat -c '%a %u %h %s' ${X}/${p})
test "$CGS1_STAGE_META" = '600 0 1 ${u}'`,c=(p,u)=>"CGS1_STAGE_EXPECTED=$(printf '%s\\n' '"+u+`' | sha256sum)
CGS1_STAGE_ACTUAL=$(sha256sum `+p+')\ntest "${CGS1_STAGE_ACTUAL%% *}" = "${CGS1_STAGE_EXPECTED%% *}"',l=`test ! -L ${X}
test -d ${X}
CGS1_STAGE_ROOT=$(stat -c '%a %u' ${X})
test "$CGS1_STAGE_ROOT" = '700 0'
`+d("intent",n.length+1)+`
`+c(X+"/intent",n),_=r+`
`+l+`
test ! -L ${M}
test -d ${M}
CGS1_STAGE_ROOT=$(stat -c '%a %u' ${M})
test "$CGS1_STAGE_ROOT" = '700 0'
`+o("install.intent",a.length+1)+`
`+c(M+"/install.intent",a)+`
`+o(s?"disabled.before-next-boot":"disabled",0)+`
`+o("pm-helper.disabled",0),b=p=>{let u=I.find(([f])=>f===p);return u||bt(),u[1]};return Object.freeze({guard:_,create:r+`
test ! -L /data
test ! -e ${M}
test ! -L ${M}
test ! -e ${X}
test ! -L ${X}
mkdir ${X}
chmod 700 ${X}
printf '%s\\n' '${n}' > ${X}/intent
sync
mkdir ${M}
chmod 700 ${M}
: > ${M}/disabled
: > ${M}/pm-helper.disabled
printf '%s\\n' '${a}' > ${M}/install.intent
sync`,precreate:p=>{let u=M+"/"+b(p);return _+`
test ! -e ${u}
test ! -L ${u}
set -C
: > ${u}`},setMode:p=>_+`
chmod ${Na.has(p)?"700":"600"} ${M}/${b(p)}`,inspect:p=>_+`
test ! -L ${M}/${b(p)}
test -f ${M}/${b(p)}
stat -c '%s %h %u %a' ${M}/${b(p)}
sha256sum ${M}/${b(p)}`,complete:_+`
test ! -e ${X}/complete
test ! -L ${X}/complete
set -C
printf '%s\\n' '${i}' > ${X}/complete
sync`,inspectComplete:_+`
`+d("complete",i.length+1)+`
sha256sum ${X}/complete`,afterBytes:new TextEncoder().encode(i+`
`)})}async function no(t){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",t)),e=>e.toString(16).padStart(2,"0")).join("")}var bs=class{#e;#t;#s;#i;#n;#a=!1;#h=!1;#r=!1;#c=!1;#u=0;#l;#b;constructor(e,s,a){let i=["read","initial","inventory","identity","openSync","pushV1","closeTransport"];(!e||Object.keys(e).sort().join()!==i.sort().join()||Object.values(e).some(r=>typeof r!="function")||!s||Object.keys(s).sort().join()!==["schema_version","job_id","target","descriptor","requested_data_free_bytes"].sort().join()||s.schema_version!==1||typeof s.job_id!="string"||!/^[a-f0-9]{32}$/.test(s.job_id)||!s.target||Object.keys(s.target).sort().join()!==["kind","wlan_mac","co2_type","stock_version","usb_serial","boot_id"].sort().join()||s.target.kind!=="browser_webusb"||s.target.stock_version!=="4.1.8_0287"||![2,3].includes(s.target.co2_type)||typeof s.target.wlan_mac!="string"||!/^[a-f0-9]{2}(?::[a-f0-9]{2}){5}$/.test(s.target.wlan_mac)||typeof s.target.usb_serial!="string"||!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(s.target.usb_serial)||!Number.isInteger(s.requested_data_free_bytes)||s.requested_data_free_bytes<=0||s.requested_data_free_bytes>256*1024*1024||!a||Object.keys(a).sort().join()!==[...io].sort().join())&&bt();for(let r of Object.values(a))(!r||Object.keys(r).sort().join()!==["size","sha256"].sort().join()||!Number.isInteger(r.size)||r.size<1||r.size>8*1024*1024||typeof r.sha256!="string"||!Oa.test(r.sha256))&&bt();this.#s=Ta(s.descriptor,s.target.boot_id);let n=Object.values(s.descriptor.files||{}).reduce((r,o)=>r+(o?.size||0),0)+8*1024*1024;s.requested_data_free_bytes<n&&bt(),this.#t=JSON.parse(JSON.stringify(s)),this.#i=JSON.parse(JSON.stringify(a)),this.#e=Object.freeze({...e}),this.#n=new _s({openSync:e.openSync,pushV1:e.pushV1,closeTransport:e.closeTransport},s.descriptor)}async#p(){await this.close().catch(()=>{}),bt()}async#m(e){if(await this.#v(`set -eu
umask 077
`+e)!=="")throw Error()}async#v(e){if(this.#r)throw Error();let s=await this.#e.read(e);if(this.#r)throw Error();return s}async#o(){if(this.#r||await this.#e.identity(this.#t.target)!==!0||this.#r)throw Error()}async#_(){if(this.#r||await this.#e.inventory()!==!0||this.#r)throw Error()}async prepare(){if(this.#r||this.#a||this.#c)return this.#p();this.#a=!0,this.#c=!0;try{if(await this.#e.initial(this.#t.target,this.#t.requested_data_free_bytes)!==!0||this.#r)throw Error();return await this.#m(this.#s.create),await this.#m(this.#s.guard),this.#h=!0,{state:"disabled_root_created"}}catch{return await this.#p()}finally{this.#c=!1}}async begin(e){if(this.#r||!this.#h||this.#c||this.#l||this.#u>=I.length||e!==I[this.#u][0])return this.#p();this.#c=!0,this.#l=e;try{return await this.#o(),await this.#n.begin(e),await this.#m(this.#s.precreate(e)),{role:e,offset:0}}catch{return await this.#p()}finally{this.#c=!1}}async append(e,s,a){if(this.#r||this.#c||e!==this.#l)return this.#p();this.#c=!0;try{return await this.#n.append(e,s,a)}catch{return await this.#p()}finally{this.#c=!1}}async#w(e,s){let a=this.#t.descriptor.files[e],i=I.find(([r])=>r===e)[1],n=(await this.#v(this.#s.inspect(e))).split(`
`);if(n.length!==2||n[0]!==`${a.size} 1 0 ${s}`||!W(n[1],a.sha256,M+"/"+i))throw Error()}async finishFile(e){if(this.#r||this.#c||e!==this.#l)return this.#p();this.#c=!0;try{return await this.#o(),await this.#n.finish(e),await this.#w(e,"600"),await this.#m(this.#s.setMode(e)),await this.#w(e,Na.has(e)?"700":"600"),this.#l=void 0,this.#u++,{role:e,state:"remote_file_verified"}}catch{return await this.#p()}finally{this.#c=!1}}async finish(){if(this.#r||!this.#h||this.#c||this.#l||this.#u!==I.length)return this.#p();this.#c=!0;try{await this.#o(),await this.#_();for(let[s]of I)await this.#w(s,Na.has(s)?"700":"600");await this.#m(this.#s.complete);let e=await no(this.#s.afterBytes);if(!W(await this.#v(this.#s.inspectComplete),e,X+"/complete"))throw Error();return await this.#o(),await this.#_(),await this.close(),{plan_id:this.#t.descriptor.plan_id,plan_sha256:this.#t.descriptor.plan_sha256,intent_sha256:this.#t.descriptor.intent_sha256,target:this.#t.target,files:this.#t.descriptor.files,stock_files:this.#i,root_mode_uid:"700 0",stage_metadata_mode_uid:"700 0",optouts_empty_regular:!0,transport_closed:!0,vendor_files_changed:!1,program_started:!1,after_effects_sha256:e}}catch{return await this.#p()}finally{this.#c=!1}}close(){return this.#b?this.#b:(this.#r=!0,this.#b=this.#n.close(),this.#b)}};var Ge="/data/.esphome-cgs1",Di="/data/.esphome-cgs1-stage",S=()=>{throw{code:"usb_browser_scope_unverified"}},zi=async t=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",t)),e=>e.toString(16).padStart(2,"0")).join(""),ro=new Set(["bridge-program","launch.sh","SnowApp-with-PM"]);function mt(t){(typeof t!="string"||!/^[0-9]+$/.test(t))&&S();let e=Number(t);return(!Number.isSafeInteger(e)||e<1)&&S(),e}function ft(t,e){return JSON.stringify(t)===JSON.stringify(e)}function fs(t){return Fi(t,!1)}function Fi(t,e){let s=["schema_version","job_id","target","descriptor","commit_nonce"];(!t||Object.keys(t).sort().join()!==s.sort().join()||t.schema_version!==1||typeof t.job_id!="string"||!/^[a-f0-9]{32}$/.test(t.job_id)||!(t.commit_nonce===null||typeof t.commit_nonce=="string"&&/^[a-f0-9]{32}$/.test(t.commit_nonce))||!t.target||Object.keys(t.target).sort().join()!==["kind","wlan_mac","co2_type","stock_version","usb_serial","boot_id"].sort().join()||t.target.kind!=="browser_webusb"||![2,3].includes(t.target.co2_type)||t.target.stock_version!=="4.1.8_0287"||typeof t.target.wlan_mac!="string"||!/^[a-f0-9]{2}(?::[a-f0-9]{2}){5}$/.test(t.target.wlan_mac)||t.target.wlan_mac==="00:00:00:00:00:00"||parseInt(t.target.wlan_mac.slice(0,2),16)&1||typeof t.target.usb_serial!="string"||!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(t.target.usb_serial)||!t.descriptor||Object.keys(t.descriptor).sort().join()!==["plan_id","plan_sha256","intent_sha256","files"].sort().join()||!t.descriptor.files||Object.keys(t.descriptor.files).sort().join()!==I.map(([c])=>c).sort().join())&&S();let a=0;for(let c of Object.values(t.descriptor.files))(!c||Object.keys(c).sort().join()!==["size","sha256"].sort().join()||!Number.isInteger(c.size)||c.size<1||c.size>16*1024*1024||typeof c.sha256!="string"||!/^[a-f0-9]{64}$/.test(c.sha256))&&S(),a+=c.size;a>32*1024*1024&&S();for(let[c,l]of Object.entries(F.sources))t.descriptor.files[c]?.sha256!==l&&S();let i=(e?Bi:Ta)(t.descriptor,t.target.boot_id),n=Ge+"/.commit-disabled.lock",r="commit-disabled "+t.commit_nonce+" "+t.descriptor.plan_id,o=t.commit_nonce===null?"":`test ! -L ${n}
test -d ${n}
CGS1_SCOPE_LOCK=$(stat -c '%a %u' ${n})
test "$CGS1_SCOPE_LOCK" = '700 0'
test ! -L ${n}/owner
test -f ${n}/owner
CGS1_SCOPE_OWNER=$(stat -c '%s %a %u %h' ${n}/owner)
test "$CGS1_SCOPE_OWNER" = '${r.length+1} 600 0 1'
CGS1_SCOPE_ACTUAL=$(sha256sum ${n}/owner)
CGS1_SCOPE_EXPECTED=$(printf '%s\\n' '${r}' | sha256sum)
test "\${CGS1_SCOPE_ACTUAL%% *}" = "\${CGS1_SCOPE_EXPECTED%% *}"
`,d=i.guard+`
`+o;return Object.freeze({stage:i,guard:d,root:d+`
stat -c '%d %i %a %u' ${Ge}`,entries:d+`
LC_ALL=C ls -A1 ${Ge}`,sideEntries:d+`
LC_ALL=C ls -A1 ${Di}`,lockEntries:t.commit_nonce===null?null:d+`
LC_ALL=C ls -A1 ${n}`,parents:d+`
test ! -L /data
test ! -L /data/bin
test ! -L /data/etc
test ! -L /data/etc/init.d
stat -c '%d' /data/bin /data/etc/init.d`,process:c=>((!Number.isInteger(c)||c<=1||c>2147483647)&&S(),`cat /proc/${c}/stat
stat -c '%u' /proc/${c}
readlink /proc/${c}/exe`),watchdog:c=>((!Number.isInteger(c)||c<=1||c>2147483647)&&S(),`CGS1_SCOPE_ARGS=$(tr '\\000' '\\n' < /proc/${c}/cmdline)
[ "$CGS1_SCOPE_ARGS" = "$(printf '/bin/sh\\n/data/bin/watchdog.sh')" ]`),maps:c=>((!Number.isInteger(c)||c<=1||c>2147483647)&&S(),`test -r /proc/${c}/maps
if grep -F -q '${Ge}/pm_qt_bridge.so' /proc/${c}/maps; then exit 1; else CGS1_SCOPE_RESULT=$?; [ "$CGS1_SCOPE_RESULT" -eq 1 ]; fi`)})}function Mi(t,e,s){let a=t.split(`
`);(a.length!==3||a[1]!=="0"||a[2]!==s)&&S();let i=a[0],n=i.indexOf("("),r=i.lastIndexOf(") ");(n<1||r<=n||i.slice(0,n).trim()!==String(e))&&S();let o=i.slice(r+2).split(/\s+/);return(o.length<20||!["R","S","D","I"].includes(o[0]))&&S(),[e,mt(o[1]),mt(o[19])]}async function Gi(t,e){return await Pa(t,e,void 0)}async function Ji(t,e,s){return(!s||Object.keys(s).sort().join()!=="sha256,size"||!Number.isSafeInteger(s.size)||s.size<1||s.size>4096||typeof s.sha256!="string"||!/^[a-f0-9]{64}$/.test(s.sha256))&&S(),await Pa(t,e,JSON.parse(JSON.stringify(s)))}async function Wi(t,e,s,a){let i=n=>n&&Object.keys(n).sort().join()==="sha256,size"&&Number.isSafeInteger(n.size)&&n.size>0&&n.size<=4096&&typeof n.sha256=="string"&&/^[a-f0-9]{64}$/.test(n.sha256);return(!i(s)||!i(a))&&S(),await Pa(t,e,JSON.parse(JSON.stringify(s)),JSON.parse(JSON.stringify(a)))}async function Pa(t,e,s,a=void 0){(!t||Object.keys(t).sort().join()!==["read","identity"].sort().join()||Object.values(t).some(p=>typeof p!="function"))&&S();let i=Fi(e,a!==void 0),n=JSON.parse(JSON.stringify(e)),r=p=>t.read(p),o=async()=>{await t.identity(n.target)!==!0&&S()},d=async p=>{await r(p)!==""&&S()},c=async()=>{let p=(await r(i.root)).split(" ");(p.length!==4||p[2]!=="700"||p[3]!=="0")&&S();let u=[mt(p[0]),mt(p[1])],f=[...I.map(([,v])=>v),"install.intent","pm-helper.disabled",...a?["disabled.before-next-boot","bridge-next-boot.complete"]:["disabled"]];if(n.commit_nonce!==null&&f.push(".commit-disabled.lock"),s){n.commit_nonce===null&&S(),f.push("initial-trial.intent");let v=Ge+"/initial-trial.intent",m=`test ! -L ${v}
test -f ${v}
stat -c '%s %a %u %h' ${v}
sha256sum ${v}`,w=(await r(m)).split(`
`);(w.length!==2||w[0]!==`${s.size} 600 0 1`||!W(w[1],s.sha256,v))&&S()}if(a){let v=Ge+"/bridge-next-boot.complete",m=(await r(`test ! -L ${v}
test -f ${v}
stat -c '%s %a %u %h' ${v}
sha256sum ${v}`)).split(`
`);(m.length!==2||m[0]!==`${a.size} 600 0 1`||!W(m[1],a.sha256,v))&&S()}(!ft((await r(i.entries)).split(`
`).sort(),f.sort())||!ft((await r(i.sideEntries)).split(`
`).sort(),["complete","intent"])||i.lockEntries&&await r(i.lockEntries)!=="owner"||!ft((await r(i.parents)).split(`
`),[String(u[0]),String(u[0])]))&&S();let g=await zi(i.stage.afterBytes);return W(await r(i.stage.inspectComplete),g,Di+"/complete")||S(),u},l=async()=>{for(let[p,u]of I){let f=n.descriptor.files[p],g=(await r(i.stage.inspect(p))).split(`
`);(g.length!==2||g[0]!==`${f.size} 1 0 ${ro.has(p)?"700":"600"}`||!W(g[1],f.sha256,Ge+"/"+u))&&S()}},_=async()=>{let p=[];for(let u of J.files){let f=(await r(u.command)).split(`
`),v=[u,F.patched[u.path]].filter(Boolean).find(m=>f.length===2&&f[0]===`${m.size} 1`&&W(f[1],m.sha256,u.path));v||S(),p.push([u.path,v.sha256])}return p.sort(([u],[f])=>u<f?-1:u>f?1:0)},b=async()=>{let p=await r(F.process_scan);/^[0-9]+$/.test(p)||S();let u=mt(p);(u<=1||u>2147483647)&&S();let f=Mi(await r(i.process(u)),u,"/data/bin/SnowApp"),g=Mi(await r(i.process(f[1])),f[1],"/bin/busybox");return f[0]===g[0]&&S(),await d(i.watchdog(g[0])),await d(i.maps(f[0])),{stock:[f[0],f[2],J.files.find(v=>v.path==="/data/bin/SnowApp").sha256,0],watchdog:[g[0],g[2],0]}};try{await o();let p=await c(),u=await _(),f=await b();await l();let g=(await r("stat -f -c '%t %a %S' /data")).split(/\s+/);(g.length!==3||g[0]!=="ef53"||!/^[0-9]+$/.test(g[1]))&&S();let v=Number(g[1]),m=mt(g[2]),w=v*m;(!Number.isSafeInteger(v)||v<0||m<512||m>65536||!Number.isSafeInteger(w)||w<8*1024*1024)&&S(),(!ft(await c(),p)||!ft(await _(),u)||!ft(await b(),f))&&S(),await l(),await o();let k=await zi(new Uint8Array);return{kind:a?"browser_bridge_armed_scope":"browser_disabled_scope",target:n.target,plan_id:n.descriptor.plan_id,plan_sha256:n.descriptor.plan_sha256,stage_intent_sha256:n.descriptor.intent_sha256,root_identity:p,install_marker:n.descriptor.plan_id+" "+n.descriptor.plan_sha256,root_mode:448,root_uid:0,...a?{boot_flags:{bridge_disabled:!1,recovery_backup:!0,pm_disabled:!0},arm_marker:a}:{disabled_flags:Array.from({length:2},()=>[k,0,384,0,1,!1])},source_hashes:Object.entries(F.sources).sort(([R],[ls])=>R<ls?-1:R>ls?1:0),vendor_hashes:u,stock_process:f.stock,watchdog_process:f.watchdog,own_code_running:!1,pm_helper_loaded:!1,data_available_bytes:w,same_filesystem:!0,staged_files:n.descriptor.files,commit_nonce:n.commit_nonce}}catch{S()}}var he=()=>{throw{code:"usb_browser_scope_unverified"}},Qi=/^[a-f0-9]{64}$/,oo=/^[a-f0-9]{32}$/,Hi="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",co="/data/etc/init.d/start.sh",Ra="/data/bin/watchdog.sh",Vi=t=>t&&typeof t=="object"&&!Array.isArray(t)?Object.keys(t).sort().join():null;function Mt(t){return Array.isArray(t)?"["+t.map(Mt).join(",")+"]":t&&typeof t=="object"?"{"+Object.keys(t).sort().map(e=>JSON.stringify(e)+":"+Mt(t[e])).join(",")+"}":JSON.stringify(t)}var ms=(t,e)=>Mt(t)===Mt(e),vt=(t,e=1,s=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(t)&&t>=e&&t<=s;function Ie(t,e){fs(t);let s=["kind","target","plan_id","plan_sha256","stage_intent_sha256","root_identity","install_marker","root_mode","root_uid","disabled_flags","source_hashes","vendor_hashes","stock_process","watchdog_process","own_code_running","pm_helper_loaded","data_available_bytes","same_filesystem","staged_files","commit_nonce"],a=t.descriptor;(Vi(e)!==s.sort().join()||e.kind!=="browser_disabled_scope"||!ms(e.target,t.target)||e.plan_id!==a.plan_id||e.plan_sha256!==a.plan_sha256||e.stage_intent_sha256!==a.intent_sha256||e.install_marker!==a.plan_id+" "+a.plan_sha256||e.root_mode!==448||e.root_uid!==0||!ms(e.staged_files,a.files)||e.commit_nonce!==t.commit_nonce||e.own_code_running!==!1||e.pm_helper_loaded!==!1||e.same_filesystem!==!0||!vt(e.data_available_bytes,8*1024*1024)||!Array.isArray(e.root_identity)||e.root_identity.length!==2||!e.root_identity.every(o=>vt(o))||!ms(e.disabled_flags,[[Hi,0,384,0,1,!1],[Hi,0,384,0,1,!1]])||!ms(e.source_hashes,Object.entries(F.sources).sort(([o],[d])=>o<d?-1:o>d?1:0)))&&he();let i=e.stock_process,n=e.watchdog_process;(!Array.isArray(i)||i.length!==4||!Array.isArray(n)||n.length!==3||!vt(i[0],2,2147483647)||!vt(n[0],2,2147483647)||i[0]===n[0]||!vt(i[1],2)||!vt(n[1],2)||i[3]!==0||n[2]!==0||i[2]!==J.files.find(o=>o.path==="/data/bin/SnowApp").sha256)&&he();let r=e.vendor_hashes;(!Array.isArray(r)||r.length!==Ee.vendor_paths.length||r.some((o,d)=>!Array.isArray(o)||o.length!==2||o[0]!==Ee.vendor_paths[d]||typeof o[1]!="string"||!Qi.test(o[1])))&&he();for(let[o,d]of r){let c=J.files.find(l=>l.path===o)?.sha256;d!==c&&d!==F.patched[o]?.sha256&&he()}}function qe(t){let e=new Set(["vendor_hashes","commit_nonce","data_available_bytes"]);return Mt(Object.fromEntries(Object.entries(t).filter(([s])=>!e.has(s))))}function vs(t,e,s,a){Ie(t,e),(!["claim","watchdog","start"].includes(a)||typeof s!="string"||!oo.test(s)||(a==="claim"?t.commit_nonce!==null:t.commit_nonce!==s))&&he();let i=t.descriptor,n=e.stock_process,r=e.watchdog_process,o=e.vendor_hashes;for(let[_,b]of o){let p=J.files.find(f=>f.path===_)?.sha256,u=a==="start"&&_===Ra?F.patched[Ra].sha256:p;(!p||b!==u)&&he()}(!Ee.vendor_paths.includes(co)||!Ee.vendor_paths.includes(Ra)||Ee.schema_version!==1)&&he();let d={plan_id:i.plan_id,plan_sha256:i.plan_sha256,root_device:String(e.root_identity[0]),root_inode:String(e.root_identity[1]),wlan_mac:t.target.wlan_mac,co2_type:String(t.target.co2_type),boot_id:t.target.boot_id,stock_pid:String(n[0]),stock_start:String(n[1]),watchdog_pid:String(r[0]),watchdog_start:String(r[1]),nonce:s};Ee.staged_roles.forEach((_,b)=>{let p=i.files[_]?.sha256;(typeof p!="string"||!Qi.test(p))&&he(),d["staged_"+b]=p}),o.forEach(([,_],b)=>{d["vendor_"+b]=_});let c=Ee.templates[a];Array.isArray(c)||he();let l=c.map(_=>typeof _=="string"?_:((Vi(_)!=="field"||typeof d[_.field]!="string")&&he(),d[_.field])).join("");return(l.length>32768||l.includes("CGS1_"))&&he(),`set -eu
umask 077
`+l}var Se=()=>{throw{code:"usb_browser_scope_unverified"}},gs=/^[a-f0-9]{32}$/;async function Je(t,e,s){(typeof t!="string"||!gs.test(t)||typeof e!="string"||!/^[a-f0-9]{64}$/.test(e)||typeof s!="string"||!gs.test(s))&&Se();let a=new TextEncoder().encode(`arm ${s} ${t} ${e}
`);return{size:a.byteLength,sha256:Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",a)),i=>i.toString(16).padStart(2,"0")).join("")}}async function Ki(t,e,s,a){Ie(t,e),(ut.schema_version!==1||!["before","arm","armed","complete"].includes(a)||typeof s!="string"||!gs.test(s)||typeof t.commit_nonce!="string"||!gs.test(t.commit_nonce)||s===t.commit_nonce)&&Se();for(let[b,p]of Object.entries(F.patched))e.vendor_hashes.find(([u])=>u===b)?.[1]!==p.sha256&&Se();let i=t.descriptor,n=e.stock_process,r=e.watchdog_process,o={plan_id:i.plan_id,plan_sha256:i.plan_sha256,root_device:String(e.root_identity[0]),root_inode:String(e.root_identity[1]),wlan_mac:t.target.wlan_mac,co2_type:String(t.target.co2_type),boot_id:t.target.boot_id,stock_pid:String(n[0]),stock_start:String(n[1]),watchdog_pid:String(r[0]),watchdog_start:String(r[1]),nonce:s};ut.staged_roles.forEach((b,p)=>{let u=i.files[b];u||Se(),o["staged_"+p]=u.sha256}),e.vendor_hashes.length!==ut.vendor_paths.length&&Se(),e.vendor_hashes.forEach(([b,p],u)=>{b!==ut.vendor_paths[u]&&Se(),o["vendor_"+u]=p});let d=await Je(o.plan_id,o.plan_sha256,s);o.completion_size=String(d.size),o.completion_sha256=d.sha256;let c=ut.templates[a];Array.isArray(c)||Se();let l=c.map(b=>typeof b=="string"?b:((!b||Object.keys(b).join()!=="field"||typeof o[b.field]!="string")&&Se(),o[b.field])).join(""),_=l.replace(/^# CGS1_BRIDGE_(?:NEXT_BOOT_SCOPE (?:disabled|backup_disabled|armed)|COMPLETION arm)$/gm,"").replace(/^# CGS1_INITIAL_ABSENT_STORES$/gm,"");return(l.length>32768||_.includes("CGS1_")||/[^\x09\x0a\x0d\x20-\x7e]/.test(l))&&Se(),`set -eu
umask 077
`+l}var H={source_commit:"53d97b9609e8e0fcdfc5d003101f620098dbc734",guardian_role:"initial-trial-guardian-program",reads:{absent_stores:`# CGS1_INITIAL_ABSENT_STORES
entries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
    case "$entry" in (full-releases|wifi|prefs|full-state) exit 1;; esac
done
entries=$(LC_ALL=C ls -A1 /tmp)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
    case "$entry" in (qingping-cgs1-esphome.lock) exit 1;; esac
done`,process_scan:`count=0
for link in /proc/[0-9]*/exe; do
    count=$((count+1))
    [ "$count" -le 4096 ] || exit 1
    pid=\${link#/proc/}; pid=\${pid%/exe}
    case "$pid" in (''|*[!0-9]*) exit 1;; esac
    if executable=$(readlink "$link" 2>/dev/null); then
        :
    else
        # Kernel threads and exited tasks legitimately have no executable.
        # An unreadable live userspace exe is NOT evidence of its absence.
        [ -d "/proc/$pid" ] || continue
        metadata=$(sed 's/.*) //' "/proc/$pid/stat" 2>/dev/null | awk '{print $1, $7}')
        set -- $metadata
        if [ "$#" -ne 2 ]; then
            [ ! -d "/proc/$pid" ] && continue
            exit 1
        fi
        case "$2" in (''|*[!0-9]*) exit 1;; esac
        case "$1" in (Z|X|x) continue;; esac
        [ "$(($2 & 2097152))" -ne 0 ] || exit 1
        continue
    fi
    case "$executable" in
        (/data/.esphome-cgs1/*|/tmp/qingping-full-*/*|/tmp/qingping-initial-*/*) exit 1;;
        (/data/bin/SnowApp) printf '%s\\n' "$pid";;
    esac
done`,memory:`# CGS1_INITIAL_MEMORY
awk '$1 == "MemTotal:" || $1 == "MemFree:" { print }' /proc/meminfo`,tcp4:`# CGS1_INITIAL_TCP
test -r /proc/net/tcp
awk '
NR == 1 { if ($2 != "local_address") bad=1; next }
{ count=split($2, local, ":"); port=toupper(local[2]);
  address=toupper(local[1]); state=toupper($4);
  if ($1 !~ /^[0-9]+:$/ || count != 2 || length(address) != 8 ||
      address ~ /[^0-9A-F]/ || length(state) != 2 || state ~ /[^0-9A-F]/ ||
      length(port) != 4 || port ~ /[^0-9A-F]/ ||
      port == "17A5" || port == "0CA0") bad=1 }
END { if (!NR || bad) exit 1 }
' /proc/net/tcp`,tcp6:`# CGS1_INITIAL_TCP
test -r /proc/net/tcp6
awk '
NR == 1 { if ($2 != "local_address") bad=1; next }
{ count=split($2, local, ":"); port=toupper(local[2]);
  address=toupper(local[1]); state=toupper($4);
  if ($1 !~ /^[0-9]+:$/ || count != 2 || length(address) != 32 ||
      address ~ /[^0-9A-F]/ || length(state) != 2 || state ~ /[^0-9A-F]/ ||
      length(port) != 4 || port ~ /[^0-9A-F]/ ||
      port == "17A5" || port == "0CA0") bad=1 }
END { if (!NR || bad) exit 1 }
' /proc/net/tcp6`},minimum_start_ram:33554432,source_sha256:{"bootstrap_patches.py":"12bc6fb3fadfe6c0101130914c3dafe7db243669b8a000e83806ff0afd66f959","build_candidate.py":"a5583b8e0159c3df425d5e500de5599b66b93a5e17ff6107d8fa75fe64caa294","build_pm_helper.py":"94a8f6c9d11fad0c18d459019b9791db1797ce339a5aa9b821d41b2199aa8851","commit_disabled_install.py":"b78470c8fe3f6275d2eca07067ec56beb858f11d8037b435be08f9f6781b4408","disabled_commit_policy.py":"ad8b50cd9c112f37b40bb1f3a77ba2ca598bf307deb1817ea1fdda4c492f2ab7","initial_bridge_trial_main.cpp":"fd00040a0c6fbf23ded86e833aa86dd5dbaa9f75a3b5ca25bb9b53ae485eb5eb","initial_bridge_trial_policy.py":"c304ce59b7df712bcbb9b2fa1564a70e1ed22fb5c2575d3bdbeebc08556b4677","initial_trial_admission.h":"77f5b1ce0c002ec9f32b87ce6615e4128134b28363e33bfc530f32af87dc9ba5","initial_trial_child.h":"5fe9e093428228ee9b0a9f6b599f402825e9a952623bfff160a4e7af3ae954cf","initial_trial_device.h":"7e2b0e9857b37b0530bc8fb69d8bb42df5a54485aef1b86fb2f75da2e078c39d","initial_trial_exec.h":"a5f09c528f03e0c61c7748ce4d68861507d2e79a49240e92dcdba89b96cbd880","initial_trial_filesystem.h":"b3018ddb17960c4bb5108602e243121159d4542f19522de9a9d4542ee9a830c5","initial_trial_intent.h":"ac429b5817af301da0cc3f3ba7f32f9cbb4730e8fb53771ba08873a91bf20c11","initial_trial_ram_scope.h":"393ab184fa31189cde891c9e736256af2eb3945f1dc6ca34a74dbd077e4276b9","initial_trial_resources.h":"d09bdf079d157a80f385a3e83d14f9237514393e635b17f6b0c33061892a492f","initial_trial_scope.h":"e3f059e3c5f97b241c588b71a7c6aa8df114bddac0082f6a1f0a2520eab9e7ac","initial_trial_self.h":"d62dbc7cf9d513bed3a506e64993efc710f3c12e7ebf6030d9754ba5a054f357","initial_trial_stock.h":"8e94e07eb9ca82f16fb79c36b8b72f69792a107b575cda356353c0b29a87e1a9","initial_trial_vendor.h":"08a506963b9e9a4c2b2b36c2085976ccfbbc6deec3276c67a8149b6d2d70b90c","preflight_adb.py":"128cf367baeee28bcfb4156256548fdded689a42d50662e77580fdd71ab19b47","prepare_install.py":"92f99cf2ff074d58f734303c54907a73feffab33d4e174d70def6d1ee70fa375","review_disabled_install.py":"174d4e23e1aaf4c386ab7afcf280a7b99b169ca877130ad1f556295a28850d1a","review_initial_trial.py":"d9f2f022edbbe190d8c8b0ccbb87071f9c6dfcb53320f8e53232264ac71cc0b4","stage_install_adb.py":"7546caa212b3b44b1a3d8717e550b7bfd5f0893a342c80c6e847cfd2be56b8eb","trial_initial_bridge_adb.py":"4f29bb503dd2d792a42aa2a642505edd2ccf84a3eb35ae7a8964b39006aaf032"}};var ie=()=>{throw{code:"usb_browser_scope_unverified"}},Ba=t=>t&&typeof t=="object"&&!Array.isArray(t)?Object.keys(t).sort().join():null;function lo(t){typeof t!="string"&&ie();let e={};for(let s of t.split(`
`)){let a=/^(MemTotal|MemFree):[ \t]+([0-9]+)[ \t]+kB$/.exec(s);(!a||Object.hasOwn(e,a[1]))&&ie();let i=Number(a[2])*1024;Number.isSafeInteger(i)||ie(),e[a[1]]=i}return(Ba(e)!==["MemFree","MemTotal"].sort().join()||e.MemFree<H.minimum_start_ram||e.MemTotal>2**40||e.MemFree>e.MemTotal)&&ie(),e.MemFree}function Oe(t,e,s=void 0){let a=["kind","scope","ram_available_bytes","memory_basis","persistent_stores_absent","ram_processes_absent","api_ota_listeners_free","ram_scope_checked","image_fd_admitted","execution_authority","device_writes"];(Ba(t)!==a.sort().join()||t.kind!=="browser_initial_trial_preparation"||t.memory_basis!=="MemFree_lower_bound"||!Number.isSafeInteger(t.ram_available_bytes)||t.ram_available_bytes<H.minimum_start_ram||t.ram_available_bytes>2**40||["persistent_stores_absent","ram_processes_absent","api_ota_listeners_free"].some(n=>t[n]!==!0)||["ram_scope_checked","image_fd_admitted","execution_authority"].some(n=>t[n]!==!1)||t.device_writes!==0||typeof e?.commit_nonce!="string"||!/^[a-f0-9]{32}$/.test(e.commit_nonce))&&ie();let i=n=>{Ie(e,n);for(let[r,o]of Object.entries(F.patched))n.vendor_hashes.find(d=>d[0]===r)?.[1]!==o.sha256&&ie()};i(t.scope),s!==void 0&&(i(s),qe(t.scope)!==qe(s)&&ie())}async function Ua(t,e){(Ba(t)!==["read","identity","scope"].sort().join()||Object.values(t).some(n=>typeof n!="function"))&&ie(),fs(e);let s=JSON.parse(JSON.stringify(e));(typeof s.commit_nonce!="string"||!/^[a-f0-9]{32}$/.test(s.commit_nonce))&&ie();let a=async()=>{let n=await t.scope(s);Ie(s,n);for(let[r,o]of Object.entries(F.patched))n.vendor_hashes.find(d=>d[0]===r)?.[1]!==o.sha256&&ie();return n},i=async n=>((await t.read(H.reads.absent_stores)!==""||await t.read(H.reads.process_scan)!==String(n.stock_process[0])||await t.read(H.reads.tcp4)!==""||await t.read(H.reads.tcp6)!=="")&&ie(),lo(await t.read(H.reads.memory)));try{await t.identity(s.target)!==!0&&ie();let n=await a(),r=await i(n),o=await a(),d=await i(o);(qe(n)!==qe(o)||await t.identity(s.target)!==!0)&&ie();let c={kind:"browser_initial_trial_preparation",scope:o,ram_available_bytes:Math.min(r,d),memory_basis:"MemFree_lower_bound",persistent_stores_absent:!0,ram_processes_absent:!0,api_ota_listeners_free:!0,ram_scope_checked:!1,image_fd_admitted:!1,execution_authority:!1,device_writes:0};return Oe(c,s,n),c}catch{ie()}}var ce=()=>{throw{code:"usb_browser_scope_unverified"}},$t=["before","arm","armed","complete"],gt=/^[a-f0-9]{64}$/,za=/^[a-f0-9]{32}$/,po=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/,Ne=t=>t&&typeof t=="object"&&!Array.isArray(t)?Object.keys(t).sort().join():null,de=t=>Array.isArray(t)?"["+t.map(de).join(",")+"]":t&&typeof t=="object"?"{"+Object.keys(t).sort().map(e=>JSON.stringify(e)+":"+de(t[e])).join(",")+"}":JSON.stringify(t),Xi=oe,Dt=class{#e;#t=0;constructor(e){this.#e=new ge(e,async({meta:s,scope:a,nonce:i,phase:n})=>{let r=await Ki(s,a,i,n);return r.endsWith(`
`)?r.slice(0,-1):r})}ready(){return this.#e.ready()}probe(){return this.#e.probe()}async execute(e,s,a,i){return(this.#t>=$t.length||$t[this.#t]!==i||!this.#e.ready())&&(await this.close().catch(()=>{}),ce()),this.#t++,await this.#e.execute({meta:e,scope:s,nonce:a,phase:i}),{phase:i,completed:!0}}close(){return this.#e.close()}};function Zi(t,e){(Ne(t)!==["kind","preparation","trial_marker","trial_marker_checked","context_only"].sort().join()||t.kind!=="browser_bridge_boot_preparation"||t.trial_marker_checked!==!0||t.context_only!==!0||de(t.trial_marker)!==de(e.trial_marker))&&ce(),Oe(t.preparation,e.meta,e.committed_scope)}function Ma(t){let e=["schema_version","job_id","plan_sha256","intent_sha256","channel_id","channel_nonce","nonce","context","preparation","producer_sha256"],s=["browser_bridge_boot_journal.py","browser_bridge_boot_observation.py","browser_bridge_boot.py","bridge-next-boot-contract.json"];(Ne(t)!==e.sort().join()||t.schema_version!==1||typeof t.job_id!="string"||!za.test(t.job_id)||typeof t.channel_id!="string"||!za.test(t.channel_id)||typeof t.channel_nonce!="string"||!po.test(t.channel_nonce)||typeof t.nonce!="string"||!za.test(t.nonce)||typeof t.plan_sha256!="string"||!gt.test(t.plan_sha256)||typeof t.intent_sha256!="string"||!gt.test(t.intent_sha256)||Ne(t.producer_sha256)!==s.sort().join()||Object.values(t.producer_sha256).some(n=>typeof n!="string"||!gt.test(n))||JSON.stringify(t).length>65536)&&ce();let a=t.context,i=["schema_version","kind","job_id","plan_sha256","source_commit","trial_intent_sha256","trial_proof_sha256","meta","committed_scope","trial_marker","producer_sha256","context_only","writer_enabled","installed","installation_ready","device_writes","live_recheck_required"];(Ne(a)!==i.sort().join()||Ne(a.producer_sha256)!==["browser_bridge_boot.py","bridge-next-boot-contract.json"].sort().join())&&ce(),(a?.kind!=="browser_bridge_next_boot_context"||a.schema_version!==1||a.job_id!==t.job_id||a.plan_sha256!==t.plan_sha256||a.source_commit!=="53d97b9609e8e0fcdfc5d003101f620098dbc734"||a.context_only!==!0||a.writer_enabled!==!1||a.installed!==!1||a.installation_ready!==!1||a.device_writes!==0||a.live_recheck_required!==!0||a.meta?.job_id!==t.job_id||a.meta?.descriptor?.plan_sha256!==t.plan_sha256||t.nonce===a.meta?.commit_nonce||typeof a.trial_intent_sha256!="string"||!gt.test(a.trial_intent_sha256)||typeof a.trial_proof_sha256!="string"||!gt.test(a.trial_proof_sha256)||Ne(a.trial_marker)!=="sha256,size"||!Number.isSafeInteger(a.trial_marker.size)||a.trial_marker.size<1||a.trial_marker.size>4096||typeof a.trial_marker.sha256!="string"||!gt.test(a.trial_marker.sha256))&&ce();for(let n of["browser_bridge_boot.py","bridge-next-boot-contract.json"])a.producer_sha256?.[n]!==t.producer_sha256[n]&&ce();Zi(t.preparation,a)}function ho(t,e,s){let a=Object.keys(e).filter(r=>r!=="disabled_flags").concat("boot_flags","arm_marker");(Ne(t)!==a.sort().join()||t.kind!=="browser_bridge_armed_scope"||de(t.boot_flags)!==de({bridge_disabled:!1,recovery_backup:!0,pm_disabled:!0})||de(t.arm_marker)!==de(s)||!Number.isSafeInteger(t.data_available_bytes)||t.data_available_bytes<8*1024**2)&&ce();let i=new Set(["kind","disabled_flags","boot_flags","arm_marker","data_available_bytes"]),n=r=>Object.fromEntries(Object.entries(r).filter(([o])=>!i.has(o)));de(n(t))!==de(n(e))&&ce()}var $s=class{#e;#t;#s;#i=!1;#n=!1;#a=0;#h=!1;#r=!1;#c=!1;#u;constructor(e,s,a){(Ne(e)!==["preparation","armed","identity","closeTransport"].sort().join()||Object.values(e).some(i=>typeof i!="function")||!(s instanceof Dt)||!s.ready())&&ce(),Ma(a),this.#s=JSON.parse(JSON.stringify(a)),this.#e=Object.freeze({...e}),this.#t=s}async#l(){await this.close().catch(()=>{}),ce()}async#b(){(this.#r||await this.#e.identity(this.#s.context.meta.target)!==!0||this.#r)&&ce()}async prepare(){if(this.#r||this.#n||this.#h)return this.#l();this.#n=!0,this.#h=!0;try{await this.#b();let e=this.#s;return Zi(await this.#e.preparation(e.context.meta,e.context.trial_marker),e.context),await this.#b(),this.#i=!0,{state:"bridge_boot_scope_rechecked",writer_enabled:!1}}catch{return this.#l()}finally{this.#h=!1}}async step(e){if(this.#r||!this.#i||this.#h||this.#c||this.#a>=$t.length||$t[this.#a]!==e)return this.#l();this.#a++,this.#h=!0;try{await this.#b();let s=this.#s,a=await this.#t.execute(s.context.meta,s.preparation.preparation.scope,s.nonce,e);return(this.#r||de(a)!==de({phase:e,completed:!0}))&&ce(),await this.#b(),a}catch{return this.#l()}finally{this.#h=!1}}async finish(){if(this.#r||!this.#i||this.#h||this.#c||this.#a!==$t.length)return this.#l();this.#c=!0,this.#h=!0,this.#i=!1;try{await this.#b();let e=this.#s,s=await Je(e.context.meta.descriptor.plan_id,e.plan_sha256,e.nonce),a=await this.#e.armed(e.context.meta,e.context.trial_marker,s);ho(a,e.preparation.preparation.scope,s),await this.#b();let i={schema_version:1,...Object.fromEntries(["job_id","plan_sha256","intent_sha256","channel_id","channel_nonce","nonce"].map(n=>[n,e[n]])),commands_acknowledged:[...$t],armed_scope:a,transport_closed:!0,channel_closed:!1,program_started:!1,autostart_armed:!0,pm_disabled:!0};return await this.#e.closeTransport(),this.#r=!0,JSON.parse(JSON.stringify(i))}catch{return this.#l()}finally{this.#h=!1}}close(){return this.#u?this.#u:(this.#r=!0,this.#i=!1,this.#u=Promise.resolve().then(()=>this.#e.closeTransport()),this.#u)}};var x=()=>{throw{code:"usb_browser_scope_unverified"}},Le=t=>t&&typeof t=="object"&&!Array.isArray(t)?Object.keys(t).sort().join():null,le=t=>Array.isArray(t)?"["+t.map(le).join(",")+"]":t&&typeof t=="object"?"{"+Object.keys(t).sort().map(e=>JSON.stringify(e)+":"+le(t[e])).join(",")+"}":JSON.stringify(t),uo=t=>{try{return JSON.parse(JSON.stringify(t))}catch{x()}},Yi=/^[a-f0-9]{64}$/,_o=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/,wt="/data/.esphome-cgs1";function Ft(t,e=1,s=Number.MAX_SAFE_INTEGER){(typeof t!="string"||!/^[0-9]+$/.test(t))&&x();let a=Number(t);return(!Number.isSafeInteger(a)||a<e||a>s)&&x(),a}function pe(t){return(typeof t!="string"||t.length>4096||/[\x00\x80-\uffff\r]/.test(t))&&x(),t===""?[]:t.split(`
`)}function bo(t){pe(t).length&&x()}function Da(t,e,s){let a=pe(t);(a.length!==3||a[1]!=="0"||a[2]!==s)&&x();let i=a[0].indexOf("("),n=a[0].lastIndexOf(") ");(i<1||n<=i||a[0].slice(0,i).trim()!==String(e))&&x();let r=a[0].slice(n+2).split(/\s+/);return(r.length<20||!["R","S","D","I"].includes(r[0])||!/^[1-9][0-9]{0,19}$/.test(r[19])||BigInt(r[19])>=2n**64n)&&x(),[e,Ft(r[1],1,2147483647),r[19]]}function Fa(t,e,s){let a=pe(t);(a.length!==2||a[0]!==e.size+" 1"||!W(a[1],e.sha256,s))&&x()}function fo(t){let e=pe(t);(e.length!==2||e[0]!==e[1]||!/^[1-9][0-9]* [1-9][0-9]* [1-9][0-9]* 0 1$/.test(e[0]))&&x()}function Gt(t){let e=["schema_version","kind","job_id","plan_sha256","arming","arming_proof_sha256","api_identity","producer_sha256","context_only","writer_enabled","device_writes"];(Le(t)!==e.sort().join()||t.schema_version!==1||t.kind!=="browser_bridge_boot_observer_context"||t.context_only!==!0||t.writer_enabled!==!1||t.device_writes!==0||typeof t.arming_proof_sha256!="string"||!Yi.test(t.arming_proof_sha256)||Le(t.producer_sha256)!==["browser_boot_context.py","bridge-observer-contract.json"].sort().join()||Object.values(t.producer_sha256).some(s=>typeof s!="string"||!Yi.test(s))||Le(t.api_identity)!=="api_mac,node_name"||typeof t.api_identity.node_name!="string"||!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(t.api_identity.node_name)||typeof t.api_identity.api_mac!="string"||!/^[a-f0-9]{2}(?::[a-f0-9]{2}){5}$/.test(t.api_identity.api_mac)||t.api_identity.api_mac==="00:00:00:00:00:00"||parseInt(t.api_identity.api_mac.slice(0,2),16)&1)&&x(),Ma(t.arming),(t.job_id!==t.arming.job_id||t.plan_sha256!==t.arming.plan_sha256||ht.schema_version!==1||ht.source_commit!==t.arming.context.source_commit||!Array.isArray(ht.reads)||ht.reads.length!==64||JSON.stringify(t).length>65536)&&x()}function mo(t,e){let s=t.arming.context.meta.target;(Le(e)!==Le(s)||typeof e.boot_id!="string"||!_o.test(e.boot_id)||le({...e,boot_id:s.boot_id})!==le(s))&&x()}async function vo(t,e){Gt(t),mo(t,e);let s=t.arming,a=s.context.meta,i=await Je(a.descriptor.plan_id,s.plan_sha256,s.nonce),n={plan_id:a.descriptor.plan_id,plan_sha256:s.plan_sha256,nonce:s.nonce,commit_nonce:a.commit_nonce,wlan_mac:e.wlan_mac,boot_id:e.boot_id,completion_sha256:i.sha256};return I.forEach(([r],o)=>{let d=a.descriptor.files[r];n["staged_size_"+o]=String(d.size),n["staged_sha_"+o]=d.sha256}),{values:n,reads:ht.reads}}async function en(t,e,s){(Le(t)!=="identity,read"||Object.values(t).some(g=>typeof g!="function"))&&x();let[a,i]=uo([e,s]),{values:n,reads:r}=await vo(a,i);i.boot_id===a.arming.context.meta.target.boot_id&&x();let o=a.arming.context.meta,d=a.arming.preparation.preparation.scope.root_identity,c={},l={},_,b=async()=>{await t.identity(i)!==!0&&x()},p=g=>{le(pe(g))!==le([d.join(" ")+" 700 0",o.descriptor.plan_id+" "+a.plan_sha256])&&x()},u=g=>Ft(g,2,2147483647),f=(g,v,m=void 0)=>{let w=Da(c[g],u(n[g+"_pid"]),v);m!==void 0&&w[1]!==m&&x(),l[g]=w};try{await b();for(let g of r){(Le(g)!=="key,parts"||typeof g.key!="string"||Object.hasOwn(c,g.key)||!Array.isArray(g.parts))&&x();let v=g.parts.map(k=>typeof k=="string"?k:((Le(k)!=="field"||typeof n[k.field]!="string")&&x(),n[k.field])).join("");(v.length>8192||/[^\x01-\x7f]/.test(v))&&x();let m=await t.read(v);pe(m),c[g.key]=m;let w=g.key;if(w.startsWith("identity_")){let k=w.slice(9).replace(/_after$/,""),R={uid:"0",wlan:i.wlan_mac,version:"CLEARGRASS_VERSION=4.1.8_0287",architecture:"armv7l",co2:String(i.co2_type),boot:i.boot_id};m!==R[k]&&x()}else if(w==="root"||w==="root_after")p(m);else if(w==="parents"||w==="parents_after")le(pe(m))!==le(d.map(()=>String(d[0])))&&x();else if(w==="commit_marker")m!=="commit-disabled "+o.commit_nonce+" "+o.descriptor.plan_id&&x();else if(["completion_guard","armed_flags","bridge_layout","supervisor_arguments","watchdog_arguments"].includes(w)||w.startsWith("stock_maps_"))bo(m);else if(w==="pm_flag"){let k=pe(m);(k.length!==2||k[0]!=="0 600 0 1"||!W(k[1],"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",wt+"/pm-helper.disabled"))&&x()}else if(w.startsWith("staged_")){let[k,R]=I[Ft(w.slice(7),0,I.length-1)];Fa(m,o.descriptor.files[k],wt+"/"+R)}else if(w.startsWith("vendor_")){let k=J.files[Ft(w.slice(7),0,J.files.length-1)];Fa(m,F.patched[k.path]||k,k.path)}else if(w==="lock"){let k=pe(m);(k.length!==2||k[0]===k[1])&&x(),n.supervisor_pid=String(u(k[0])),n.child_pid=String(u(k[1]))}else if(w==="child")f("child",wt+"/program",u(n.supervisor_pid));else if(w==="supervisor")f("supervisor","/bin/busybox");else if(w==="process_scan")n.stock_pid=String(u(m));else if(w==="stock")f("stock","/data/bin/SnowApp"),n.watchdog_pid=String(l.stock[1]);else if(w==="watchdog")f("watchdog","/bin/busybox"),new Set(Object.values(l).map(k=>k[0])).size!==4&&x();else if(w==="child_image_process_before"||w==="child_image_process_after")le(Da(m,u(n.child_pid),wt+"/program"))!==le(l.child)&&x();else if(w==="child_image_file")Fa(m,o.descriptor.files["bridge-program"],wt+"/program");else if(w==="child_image"){let k=pe(m),R=o.descriptor.files["bridge-program"];(k.length!==3||k[0]!==k[1]||!new RegExp("^"+d[0]+" [1-9][0-9]* "+R.size+" 700 0 1$").test(k[0])||!W(k[2],R.sha256,"/proc/"+n.child_pid+"/exe"))&&x()}else if(["supervisor_image","stock_image","watchdog_image"].includes(w))fo(m);else if(w==="endpoint"){let k=pe(m);(k.length<2||k.length>4||new Set(k).size!==k.length||k.some(R=>!/^\/proc\/net\/tcp6? (?:17A5|0CA0)$/.test(R))||new Set(k.map(R=>R.split(" ")[1])).size!==2)&&x()}else if(w==="memory"){_={};for(let k of pe(m)){let R=/^(MemTotal|MemFree):[ \t]+([0-9]+)[ \t]+kB$/.exec(k);(!R||Object.hasOwn(_,R[1]))&&x(),_[R[1]]=Ft(R[2],0,2**30)*1024}(Le(_)!=="MemFree,MemTotal"||_.MemFree<8*1024**2||_.MemFree>_.MemTotal)&&x()}else if(w==="lock_after")m!==c.lock&&x();else if(/^(child|supervisor|stock|watchdog)_after$/.test(w)){let k=w.slice(0,-6),R=k==="child"?wt+"/program":k==="stock"?"/data/bin/SnowApp":"/bin/busybox";le(Da(m,u(n[k+"_pid"]),R))!==le(l[k])&&x()}else x()}return await b(),Object.freeze({kind:"browser_bridge_boot_runtime_scope",job_id:a.job_id,plan_sha256:a.plan_sha256,arming_intent_sha256:a.arming.intent_sha256,arming_proof_sha256:a.arming_proof_sha256,target:i,root_identity:d,processes:l,pm_disabled:!0,recovery_backup:!0,bridge_disabled:!1,canonical_scope_checked:!0,memory_free_bytes:_.MemFree,memory_total_bytes:_.MemTotal,context_only:!0,device_writes:0})}catch{x()}}var We=()=>{throw{code:"usb_browser_scope_unverified"}},Jt=t=>t&&typeof t=="object"&&!Array.isArray(t)?Object.keys(t).sort().join():null,go=/^[a-f0-9]{32}$/,yt=t=>Array.isArray(t)?"["+t.map(yt).join(",")+"]":t&&typeof t=="object"?"{"+Object.keys(t).sort().map(e=>JSON.stringify(e)+":"+yt(t[e])).join(",")+"}":JSON.stringify(t),Ga=async t=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(t))),e=>e.toString(16).padStart(2,"0")).join("");function ws(t,e){Gt(t);let s=t.arming,a=s.context.meta.target,i=["kind","job_id","plan_sha256","arming_intent_sha256","arming_proof_sha256","target","root_identity","processes","pm_disabled","recovery_backup","bridge_disabled","canonical_scope_checked","memory_free_bytes","memory_total_bytes","context_only","device_writes"];(Jt(e)!==i.sort().join()||e.kind!=="browser_bridge_boot_runtime_scope"||e.job_id!==t.job_id||e.plan_sha256!==t.plan_sha256||e.arming_intent_sha256!==s.intent_sha256||e.arming_proof_sha256!==t.arming_proof_sha256||Jt(e.target)!==Jt(a)||typeof e.target.boot_id!="string"||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(e.target.boot_id)||e.target.boot_id===a.boot_id||yt({...e.target,boot_id:a.boot_id})!==yt(a)||yt(e.root_identity)!==yt(s.preparation.preparation.scope.root_identity)||e.pm_disabled!==!0||e.recovery_backup!==!0||e.bridge_disabled!==!1||e.canonical_scope_checked!==!0||e.context_only!==!0||e.device_writes!==0||Jt(e.processes)!=="child,stock,supervisor,watchdog"||!Number.isSafeInteger(e.memory_free_bytes)||!Number.isSafeInteger(e.memory_total_bytes)||e.memory_free_bytes<8*1024**2||e.memory_free_bytes>e.memory_total_bytes||e.memory_total_bytes>2**40)&&We();let n=Object.values(e.processes);for(let r of n)(!Array.isArray(r)||r.length!==3||!Number.isInteger(r[0])||r[0]<2||r[0]>2147483647||!Number.isInteger(r[1])||r[1]<1||r[1]>2147483647||typeof r[2]!="string"||!/^[1-9][0-9]{0,19}$/.test(r[2])||BigInt(r[2])>=2n**64n)&&We();(new Set(n.map(r=>r[0])).size!==4||e.processes.child[1]!==e.processes.supervisor[0]||e.processes.stock[1]!==e.processes.watchdog[0])&&We()}async function tn(t,e,s,a){ws(t,e),(zt.schema_version!==1||zt.maximum_body_bytes!==65536||zt.source_commit!==t.arming.context.source_commit||!["arm","complete"].includes(a)||typeof s!="string"||!go.test(s)||s==="0".repeat(32)||s===t.arming.nonce||s===t.arming.context.meta.commit_nonce)&&We();let i=t.arming.context.meta,n={plan_id:i.descriptor.plan_id,plan_sha256:t.plan_sha256,nonce:t.arming.nonce,pm_nonce:s,commit_nonce:i.commit_nonce,wlan_mac:e.target.wlan_mac,boot_id:e.target.boot_id,co2_type:String(e.target.co2_type),root_device:String(e.root_identity[0]),root_inode:String(e.root_identity[1])};for(let[l,_]of Object.entries(e.processes))n[l+"_pid"]=String(_[0]),n[l+"_birth"]=_[2];I.forEach(([l],_)=>{n["staged_sha_"+_]=i.descriptor.files[l].sha256});let r=`initial-pm-enable ${s} ${n.plan_id} ${n.plan_sha256} ${n.boot_id}
`,o=await Promise.all([Ga(r),Ga(n.plan_id+" "+n.plan_sha256+`
`),Ga(`arm ${n.nonce} ${n.plan_id} ${n.plan_sha256}
`)]);[n.pm_owner_sha256,n.install_marker_sha256,n.arm_completion_sha256]=o;let d=zt.templates[a];Array.isArray(d)||We();let c=`set -eu
`+d.map(l=>typeof l=="string"?l:((Jt(l)!=="field"||typeof n[l.field]!="string")&&We(),n[l.field])).join("");return(c.length>65536||/[^\x09\x0a\x0d\x20-\x7e]/.test(c))&&We(),c}var $o=()=>{throw{code:"usb_browser_scope_unverified"}},sn=t=>oe(t,65536),kt=class{#e;#t=0;constructor(e){this.#e=new ge(e,async({context:s,scope:a,nonce:i,phase:n})=>{let r=await tn(s,a,i,n);return r.endsWith(`
`)?r.slice(0,-1):r},65536)}ready(){return this.#e.ready()}async probe(){return{...await this.#e.probe(),kind:"browser_pm_fixed_stdin_probe",maximum_body_bytes:65536,probe_body_bytes:65536}}async execute(e,s,a,i){return(this.#t>=2||["arm","complete"][this.#t]!==i||!this.#e.ready())&&(await this.close().catch(()=>{}),$o()),this.#t++,await this.#e.execute({context:e,scope:s,nonce:a,phase:i}),{phase:i,completed:!0}}close(){return this.#e.close()}};var Te=()=>{throw{code:"usb_browser_scope_unverified"}},He=t=>t&&typeof t=="object"&&!Array.isArray(t)?Object.keys(t).sort().join():null,Pe=t=>Array.isArray(t)?"["+t.map(Pe).join(",")+"]":t&&typeof t=="object"?"{"+Object.keys(t).sort().map(e=>JSON.stringify(e)+":"+Pe(t[e])).join(",")+"}":JSON.stringify(t),ys=/^[a-f0-9]{64}$/,Ja=/^[a-f0-9]{32}$/;function wo(t){let e=["schema_version","job_id","plan_sha256","channel_id","channel_nonce","nonce","context","native_pair","observation","producer_sha256","intent_sha256"],s=["browser_pm_boot_journal.py","browser_pm_boot_observation.py","pm-next-boot-contract.json","pm_extension_guard.py","browser_boot_context.py"];(He(t)!==e.sort().join()||t.schema_version!==1||typeof t.job_id!="string"||!Ja.test(t.job_id)||typeof t.plan_sha256!="string"||!ys.test(t.plan_sha256)||typeof t.intent_sha256!="string"||!ys.test(t.intent_sha256)||typeof t.channel_id!="string"||!Ja.test(t.channel_id)||typeof t.channel_nonce!="string"||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(t.channel_nonce)||typeof t.nonce!="string"||!Ja.test(t.nonce)||t.nonce==="0".repeat(32)||He(t.producer_sha256)!==s.sort().join()||Object.values(t.producer_sha256).some(n=>typeof n!="string"||!ys.test(n))||He(t.native_pair)!=="guardian-program,native-program"||He(t.observation)!=="scope,wire"||JSON.stringify(t).length>65536)&&Te();for(let n of Object.values(t.native_pair))(He(n)!=="sha256,size"||!Number.isSafeInteger(n.size)||n.size<1||n.size>16*1024**2||typeof n.sha256!="string"||!ys.test(n.sha256))&&Te();ws(t.context,t.observation.scope);let a=t.context,i=t.observation.wire;(t.job_id!==a.job_id||t.plan_sha256!==a.plan_sha256||t.channel_id===a.arming.channel_id||t.channel_nonce===a.arming.channel_nonce||t.nonce===a.arming.nonce||t.nonce===a.arming.context.meta.commit_nonce||He(i)!=="api_closed,final_scope_checked,identity,last_sample_age_at_prepare_s,samples"||!Number.isInteger(i.samples)||i.samples<2||i.samples>32||typeof i.last_sample_age_at_prepare_s!="number"||!Number.isFinite(i.last_sample_age_at_prepare_s)||i.last_sample_age_at_prepare_s<0||i.last_sample_age_at_prepare_s>20||Pe(i.identity)!==Pe(a.api_identity)||i.api_closed!==!0||i.final_scope_checked!==!0)&&Te()}var ks=class{#e;#t;#s;#i=!1;#n=!1;#a=0;#h=!1;#r=!1;#c;#u=!1;constructor(e,s,a){(He(e)!=="closeTransport,identity,scope"||Object.values(e).some(i=>typeof i!="function")||!(s instanceof kt)||!s.ready())&&Te(),wo(a),this.#e=Object.freeze({...e}),this.#t=s,this.#s=JSON.parse(JSON.stringify(a))}async#l(){await this.close().catch(()=>{}),Te()}async#b(){(this.#r||await this.#e.identity(this.#s.observation.scope.target)!==!0||this.#r)&&Te()}async#p(){let e=this.#s,s=await this.#e.scope(e.context);ws(e.context,s);let a=i=>Object.fromEntries(Object.entries(i).filter(([n])=>n!=="memory_free_bytes"));Pe(a(s))!==Pe(a(e.observation.scope))&&Te()}async prepare(){if(this.#r||this.#n||this.#h)return this.#l();this.#n=!0,this.#h=!0;try{return await this.#b(),await this.#p(),await this.#b(),this.#i=!0,{state:"pm_boot_scope_rechecked",writer_enabled:!1}}catch{return this.#l()}finally{this.#h=!1}}async step(e){if(this.#r||!this.#i||this.#h||this.#u||this.#a>=2||["arm","complete"][this.#a]!==e)return this.#l();this.#a++,this.#h=!0;try{await this.#b(),e==="arm"&&await this.#p();let s=this.#s,a=await this.#t.execute(s.context,s.observation.scope,s.nonce,e);return Pe(a)!==Pe({phase:e,completed:!0})&&Te(),await this.#b(),a}catch{return this.#l()}finally{this.#h=!1}}async finish(){if(this.#r||!this.#i||this.#h||this.#u||this.#a!==2)return this.#l();this.#u=!0,this.#h=!0,this.#i=!1;try{await this.#b();let e=this.#s,s={schema_version:1,...Object.fromEntries(["job_id","plan_sha256","channel_id","channel_nonce","nonce","intent_sha256"].map(a=>[a,e[a]])),commands_acknowledged:["arm","complete"],after_effects_read_acknowledged:!0,target:e.observation.scope.target,current_boot_preserved:!0,transport_closed:!0,channel_closed:!1,pm_next_boot_armed:!0};return await this.#e.closeTransport(),this.#r=!0,JSON.parse(JSON.stringify(s))}catch{return this.#l()}finally{this.#h=!1}}close(){return this.#c?this.#c:(this.#r=!0,this.#i=!1,this.#c=Promise.resolve().then(()=>this.#e.closeTransport()),this.#c)}};var Ae={schema_version:1,source_commit:"53d97b9609e8e0fcdfc5d003101f620098dbc734",staged_roles:["bridge-program","pm_qt_bridge.so","launch.sh","SnowApp-with-PM","startup-hook.sh","stock-start.sh.original","stock-watchdog.sh.original","start.sh.candidate","watchdog.sh.candidate"],vendor_paths:["/data/bin/SnowApp","/data/bin/watchdog.sh","/data/etc/init.d/start.sh","/etc/init.d/S12_launcher_init","/etc/init.d/S50_px3se_init","/lib/ld-2.23.so","/lib/libc-2.23.so","/usr/lib/libQt5Core.so.5.9.4","/usr/lib/libstdc++.so.6.0.20"],producer_files:["browser_initial_journal.py","browser_initial_observation.py","browser_initial_trial.py","browser_initial_trial_job.py","initial-trial-contract.json","initial-ram-contract.json","initial-guardian-contract.json","initial-process-contract.json","browser_initial_api.py","initial-scope-contract.json"],source_sha256:{"commit_disabled_install.py":"b78470c8fe3f6275d2eca07067ec56beb858f11d8037b435be08f9f6781b4408","review_initial_trial.py":"d9f2f022edbbe190d8c8b0ccbb87071f9c6dfcb53320f8e53232264ac71cc0b4","review_disabled_install.py":"174d4e23e1aaf4c386ab7afcf280a7b99b169ca877130ad1f556295a28850d1a","stage_install_adb.py":"7546caa212b3b44b1a3d8717e550b7bfd5f0893a342c80c6e847cfd2be56b8eb","initial_bridge_trial_policy.py":"c304ce59b7df712bcbb9b2fa1564a70e1ed22fb5c2575d3bdbeebc08556b4677","disabled_commit_policy.py":"ad8b50cd9c112f37b40bb1f3a77ba2ca598bf307deb1817ea1fdda4c492f2ab7","bootstrap_patches.py":"12bc6fb3fadfe6c0101130914c3dafe7db243669b8a000e83806ff0afd66f959","preflight_adb.py":"128cf367baeee28bcfb4156256548fdded689a42d50662e77580fdd71ab19b47"},templates:{create:[`set -eu
umask 077
test ! -L /data/.esphome-cgs1
test -d /data/.esphome-cgs1
observed_value=$(stat -c '%d %i %a %u' /data/.esphome-cgs1)
[ "$observed_value" = '`,{field:"root_device"}," ",{field:"root_inode"},` 700 0' ]
test ! -L /data/bin
test ! -L /data/etc
test ! -L /data/etc/init.d
observed_value=$(stat -c '%d' /data/bin)
[ "$observed_value" = `,{field:"root_device"},` ]
observed_value=$(stat -c '%d' /data/etc/init.d)
[ "$observed_value" = `,{field:"root_device"},` ]
test ! -L /data/.esphome-cgs1/install.intent
test -f /data/.esphome-cgs1/install.intent
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/install.intent)
[ "$observed_value" = '98 600 0 1' ]
observed_value=$(cat /data/.esphome-cgs1/install.intent)
[ "$observed_value" = '`,{field:"plan_id"}," ",{field:"plan_sha256"},`' ]
test ! -L /data/.esphome-cgs1/disabled
test -f /data/.esphome-cgs1/disabled
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/disabled)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/disabled | awk '{print $1}')
[ "$observed_value" = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 ]
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/disabled)
[ "$observed_value" = '0 600 0 1' ]
test ! -L /data/.esphome-cgs1/pm-helper.disabled
test -f /data/.esphome-cgs1/pm-helper.disabled
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/pm-helper.disabled)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/pm-helper.disabled | awk '{print $1}')
[ "$observed_value" = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 ]
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/pm-helper.disabled)
[ "$observed_value" = '0 600 0 1' ]
observed_value=$(cat /sys/class/net/wlan0/address)
[ "$observed_value" = `,{field:"wlan_mac"},` ]
observed_value=$(cat /data/etc/os-release)
[ "$observed_value" = CLEARGRASS_VERSION=4.1.8_0287 ]
observed_value=$(cat /proc/sys/kernel/random/boot_id)
[ "$observed_value" = `,{field:"boot_id"},` ]
observed_value=$(awk '
BEGIN { section=0; count=0 }
/^[ \\t]*\\[/ { section=($0 ~ /^[ \\t]*\\[sensors\\][ \\t]*\\r?$/) }
section && /^[ \\t]*co2_type[ \\t]*=/ {
    value=$0; sub(/^[^=]*=[ \\t]*/, "", value); sub(/[ \\t\\r]*$/, "", value)
    print value; count++
}
END { if (count != 1) exit 1 }
' /data/etc/setting.ini)
[ "$observed_value" = `,{field:"co2_type"},` ]
observed_value=$(count=0
for link in /proc/[0-9]*/exe; do
    count=$((count+1))
    [ "$count" -le 4096 ] || exit 1
    pid=\${link#/proc/}; pid=\${pid%/exe}
    case "$pid" in (''|*[!0-9]*) exit 1;; esac
    if executable=$(readlink "$link" 2>/dev/null); then
        :
    else
        # Kernel threads and exited tasks legitimately have no executable.
        # An unreadable live userspace exe is NOT evidence of its absence.
        [ -d "/proc/$pid" ] || continue
        metadata=$(sed 's/.*) //' "/proc/$pid/stat" 2>/dev/null | awk '{print $1, $7}')
        set -- $metadata
        if [ "$#" -ne 2 ]; then
            [ ! -d "/proc/$pid" ] && continue
            exit 1
        fi
        case "$2" in (''|*[!0-9]*) exit 1;; esac
        case "$1" in (Z|X|x) continue;; esac
        [ "$(($2 & 2097152))" -ne 0 ] || exit 1
        continue
    fi
    case "$executable" in
        (/data/.esphome-cgs1/*|/tmp/qingping-full-*/*|/tmp/qingping-initial-*/*) exit 1;;
        (/data/bin/SnowApp) printf '%s\\n' "$pid";;
    esac
done)
[ "$observed_value" = `,{field:"stock_pid"},` ]
observed_value=$(readlink /proc/`,{field:"stock_pid"},`/exe)
[ "$observed_value" = /data/bin/SnowApp ]
observed_value=$(stat -c '%u' /proc/`,{field:"stock_pid"},`)
[ "$observed_value" = 0 ]
observed_value=$(sed 's/.*) //' /proc/`,{field:"stock_pid"},`/stat | awk '{print $20}')
[ "$observed_value" = `,{field:"stock_start"},` ]
process_state=$(sed 's/.*) //' /proc/`,{field:"stock_pid"},`/stat | awk '{print $1}')
case "$process_state" in R|S|D|I) :;; *) exit 1;; esac
observed_value=$(readlink /proc/`,{field:"watchdog_pid"},`/exe)
[ "$observed_value" = /bin/busybox ]
observed_value=$(stat -c '%u' /proc/`,{field:"watchdog_pid"},`)
[ "$observed_value" = 0 ]
observed_value=$(sed 's/.*) //' /proc/`,{field:"watchdog_pid"},`/stat | awk '{print $20}')
[ "$observed_value" = `,{field:"watchdog_start"},` ]
process_state=$(sed 's/.*) //' /proc/`,{field:"watchdog_pid"},`/stat | awk '{print $1}')
case "$process_state" in R|S|D|I) :;; *) exit 1;; esac
observed_value=$(sed 's/.*) //' /proc/`,{field:"stock_pid"},`/stat | awk '{print $2}')
[ "$observed_value" = `,{field:"watchdog_pid"},` ]
arguments=$(tr '\\000' '\\n' < /proc/`,{field:"watchdog_pid"},`/cmdline)
[ "$arguments" = "$(printf '/bin/sh\\n/data/bin/watchdog.sh')" ]
test -r /proc/`,{field:"stock_pid"},`/maps
if grep -F -q '/data/.esphome-cgs1/pm_qt_bridge.so' /proc/`,{field:"stock_pid"},`/maps; then exit 1; else result=$?; [ "$result" -eq 1 ]; fi
test ! -L /data/.esphome-cgs1/program
test -f /data/.esphome-cgs1/program
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/program)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/program | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_0"},` ]
test ! -L /data/.esphome-cgs1/pm_qt_bridge.so
test -f /data/.esphome-cgs1/pm_qt_bridge.so
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/pm_qt_bridge.so)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/pm_qt_bridge.so | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_1"},` ]
test ! -L /data/.esphome-cgs1/launch.sh
test -f /data/.esphome-cgs1/launch.sh
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/launch.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/launch.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_2"},` ]
test ! -L /data/.esphome-cgs1/SnowApp-with-PM
test -f /data/.esphome-cgs1/SnowApp-with-PM
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/SnowApp-with-PM)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/SnowApp-with-PM | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_3"},` ]
test ! -L /data/.esphome-cgs1/startup-hook.sh
test -f /data/.esphome-cgs1/startup-hook.sh
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/startup-hook.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/startup-hook.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_4"},` ]
test ! -L /data/.esphome-cgs1/stock-start.sh.original
test -f /data/.esphome-cgs1/stock-start.sh.original
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/stock-start.sh.original)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/stock-start.sh.original | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_5"},` ]
test ! -L /data/.esphome-cgs1/stock-watchdog.sh.original
test -f /data/.esphome-cgs1/stock-watchdog.sh.original
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/stock-watchdog.sh.original)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/stock-watchdog.sh.original | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_6"},` ]
test ! -L /data/.esphome-cgs1/start.sh.candidate
test -f /data/.esphome-cgs1/start.sh.candidate
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/start.sh.candidate)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/start.sh.candidate | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_7"},` ]
test ! -L /data/.esphome-cgs1/watchdog.sh.candidate
test -f /data/.esphome-cgs1/watchdog.sh.candidate
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/watchdog.sh.candidate)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/watchdog.sh.candidate | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_8"},` ]
test ! -L /data/bin/SnowApp
test -f /data/bin/SnowApp
observed_value=$(stat -c '%h %u' /data/bin/SnowApp)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/bin/SnowApp | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_0"},` ]
test ! -L /data/bin/watchdog.sh
test -f /data/bin/watchdog.sh
observed_value=$(stat -c '%h %u' /data/bin/watchdog.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/bin/watchdog.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_1"},` ]
test ! -L /data/etc/init.d/start.sh
test -f /data/etc/init.d/start.sh
observed_value=$(stat -c '%h %u' /data/etc/init.d/start.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/etc/init.d/start.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_2"},` ]
test ! -L /etc/init.d/S12_launcher_init
test -f /etc/init.d/S12_launcher_init
observed_value=$(stat -c '%h %u' /etc/init.d/S12_launcher_init)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /etc/init.d/S12_launcher_init | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_3"},` ]
test ! -L /etc/init.d/S50_px3se_init
test -f /etc/init.d/S50_px3se_init
observed_value=$(stat -c '%h %u' /etc/init.d/S50_px3se_init)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /etc/init.d/S50_px3se_init | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_4"},` ]
test ! -L /lib/ld-2.23.so
test -f /lib/ld-2.23.so
observed_value=$(stat -c '%h %u' /lib/ld-2.23.so)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /lib/ld-2.23.so | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_5"},` ]
test ! -L /lib/libc-2.23.so
test -f /lib/libc-2.23.so
observed_value=$(stat -c '%h %u' /lib/libc-2.23.so)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /lib/libc-2.23.so | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_6"},` ]
test ! -L /usr/lib/libQt5Core.so.5.9.4
test -f /usr/lib/libQt5Core.so.5.9.4
observed_value=$(stat -c '%h %u' /usr/lib/libQt5Core.so.5.9.4)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /usr/lib/libQt5Core.so.5.9.4 | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_7"},` ]
test ! -L /usr/lib/libstdc++.so.6.0.20
test -f /usr/lib/libstdc++.so.6.0.20
observed_value=$(stat -c '%h %u' /usr/lib/libstdc++.so.6.0.20)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /usr/lib/libstdc++.so.6.0.20 | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_8"},` ]
test ! -L /data/.esphome-cgs1/.commit-disabled.lock
test -d /data/.esphome-cgs1/.commit-disabled.lock
observed_value=$(stat -c '%a %u' /data/.esphome-cgs1/.commit-disabled.lock)
[ "$observed_value" = '700 0' ]
test ! -L /data/.esphome-cgs1/.commit-disabled.lock/owner
test -f /data/.esphome-cgs1/.commit-disabled.lock/owner
observed_value=$(stat -c '%a %u %h' /data/.esphome-cgs1/.commit-disabled.lock/owner)
[ "$observed_value" = '600 0 1' ]
observed_value=$(cat /data/.esphome-cgs1/.commit-disabled.lock/owner)
[ "$observed_value" = 'commit-disabled `,{field:"commit_nonce"}," ",{field:"plan_id"},`' ]
# CGS1_INITIAL_ABSENT_STORES
entries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
    case "$entry" in (full-releases|wifi|prefs|full-state) exit 1;; esac
done
entries=$(LC_ALL=C ls -A1 /tmp)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
    case "$entry" in (qingping-cgs1-esphome.lock) exit 1;; esac
done
# CGS1_INITIAL_TCP
test -r /proc/net/tcp
awk '
NR == 1 { if ($2 != "local_address") bad=1; next }
{ count=split($2, local, ":"); port=toupper(local[2]);
  address=toupper(local[1]); state=toupper($4);
  if ($1 !~ /^[0-9]+:$/ || count != 2 || length(address) != 8 ||
      address ~ /[^0-9A-F]/ || length(state) != 2 || state ~ /[^0-9A-F]/ ||
      length(port) != 4 || port ~ /[^0-9A-F]/ ||
      port == "17A5" || port == "0CA0") bad=1 }
END { if (!NR || bad) exit 1 }
' /proc/net/tcp
# CGS1_INITIAL_TCP
test -r /proc/net/tcp6
awk '
NR == 1 { if ($2 != "local_address") bad=1; next }
{ count=split($2, local, ":"); port=toupper(local[2]);
  address=toupper(local[1]); state=toupper($4);
  if ($1 !~ /^[0-9]+:$/ || count != 2 || length(address) != 32 ||
      address ~ /[^0-9A-F]/ || length(state) != 2 || state ~ /[^0-9A-F]/ ||
      length(port) != 4 || port ~ /[^0-9A-F]/ ||
      port == "17A5" || port == "0CA0") bad=1 }
END { if (!NR || bad) exit 1 }
' /proc/net/tcp6
awk '
$1 == "MemTotal:" || $1 == "MemFree:" {
 if (NF != 3 || $2 !~ /^[0-9]+$/ || $3 != "kB" || seen[$1]++) bad=1;
 if ($1 == "MemTotal:") total=$2; else free=$2;
}
END { if (bad || seen["MemTotal:"] != 1 || seen["MemFree:"] != 1 ||
 free < 32768 || free > total || total > 1073741824) exit 1 }
' /proc/meminfo
test ! -L /tmp
test -d /tmp
observed_value=$(readlink -f /tmp)
[ "$observed_value" = /tmp ]
observed_value=$(stat -c '%a %u' /tmp)
[ "$observed_value" = '1777 0' ]
qp_ram_fs=$(stat -f -c '%t %a %S' /tmp)
set -- $qp_ram_fs
[ "$#" -eq 3 ]
[ "$1" = '1021994' ]
case "$2:$3" in (*[!0-9:]*|:*|*:) exit 1;; esac
[ "$3" -ge 512 ]
[ "$3" -le 65536 ]
[ "\${#2}" -le 10 ]
[ "\${#3}" -le 5 ]
[ "$2" -le "$(( 2147483647 / $3 ))" ]
[ "$(( $2 * $3 ))" -ge "$(( `,{field:"guardian_bytes"},` + 8388608 ))" ]
test ! -e /tmp/qingping-initial-trial-`,{field:"ram_job_id"},`
test ! -L /tmp/qingping-initial-trial-`,{field:"ram_job_id"},`
test ! -e /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},`
test ! -L /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},`
mkdir -m 700 /tmp/qingping-initial-trial-`,{field:"ram_job_id"},`
mkdir -m 700 /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},`
test ! -e /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},`/program
test ! -L /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},`/program
set -C
: > /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},"/program"],inspect_roots:[`set -eu
umask 077
test ! -L /tmp
test -d /tmp
observed_value=$(readlink -f /tmp)
[ "$observed_value" = /tmp ]
observed_value=$(stat -c '%a %u' /tmp)
[ "$observed_value" = '1777 0' ]
test ! -L /tmp/qingping-initial-trial-`,{field:"ram_job_id"},`
test -d /tmp/qingping-initial-trial-`,{field:"ram_job_id"},`
observed_value=$(readlink -f /tmp/qingping-initial-trial-`,{field:"ram_job_id"},`)
[ "$observed_value" = /tmp/qingping-initial-trial-`,{field:"ram_job_id"},` ]
observed_value=$(stat -c '%a %u' /tmp/qingping-initial-trial-`,{field:"ram_job_id"},`)
[ "$observed_value" = '700 0' ]
observed_value=$(LC_ALL=C ls -A1 /tmp/qingping-initial-trial-`,{field:"ram_job_id"},`)
[ "$observed_value" = '' ]
stat -c '%d %i %a %u' /tmp/qingping-initial-trial-`,{field:"ram_job_id"},`
stat -f -c '%t %a %S' /tmp/qingping-initial-trial-`,{field:"ram_job_id"},`
test ! -L /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},`
test -d /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},`
observed_value=$(readlink -f /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},`)
[ "$observed_value" = /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},` ]
observed_value=$(stat -c '%a %u' /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},`)
[ "$observed_value" = '700 0' ]
observed_value=$(LC_ALL=C ls -A1 /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},`)
[ "$observed_value" = program ]
stat -c '%d %i %a %u' /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},`
stat -f -c '%t %a %S' /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"}],inspect_guardian:[`set -eu
umask 077
test ! -L /tmp
test -d /tmp
observed_value=$(readlink -f /tmp)
[ "$observed_value" = /tmp ]
observed_value=$(stat -c '%a %u' /tmp)
[ "$observed_value" = '1777 0' ]
test ! -L /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},`
test -d /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},`
observed_value=$(readlink -f /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},`)
[ "$observed_value" = /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},` ]
observed_value=$(stat -c '%a %u' /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},`)
[ "$observed_value" = '700 0' ]
test ! -L /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},`/program
test -f /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},`/program
observed_value=$(stat -c '%a %u %h' /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},`/program)
[ "$observed_value" = '600 0 1' ]
stat -c '%s %a %u %h %d %i' /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},`/program
sha256sum /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},"/program"]}};var xt=()=>{throw{code:"usb_browser_scope_unverified"}},Ha=t=>t&&typeof t=="object"&&!Array.isArray(t)?Object.keys(t).sort().join():null,Wa=(t,e)=>typeof t=="string"&&new RegExp("^[a-f0-9]{"+e+"}$").test(t),yo=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;async function ko(t){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",t)),e=>e.toString(16).padStart(2,"0")).join("")}async function xs(t){let e;try{return await Promise.race([Promise.resolve().then(t),new Promise((s,a)=>{e=setTimeout(()=>a({code:"usb_close_unverified"}),2e3)})])}finally{clearTimeout(e)}}function Wt(t){let e;try{e=JSON.parse(JSON.stringify(t))}catch{xt()}let s=["schema_version","job_id","plan_sha256","intent_sha256","channel_id","channel_nonce","nonce","ram_job_id","guardian_job_id","guardian"];return(Ha(e)!==s.sort().join()||e.schema_version!==1||["job_id","channel_id","nonce","ram_job_id","guardian_job_id"].some(a=>!Wa(e[a],32))||["plan_sha256","intent_sha256"].some(a=>!Wa(e[a],64))||typeof e.channel_nonce!="string"||!yo.test(e.channel_nonce)||new Set([e.nonce,e.ram_job_id,e.guardian_job_id]).size!==3||Ha(e.guardian)!==["size","sha256"].sort().join()||!Number.isInteger(e.guardian.size)||e.guardian.size<52||e.guardian.size>16777216||!Wa(e.guardian.sha256,64))&&xt(),Object.freeze({...e,guardian:Object.freeze(e.guardian)})}var Ss=class{#e;#t;#s;#i=0;#n=!1;#a=!1;#h=!1;#r=!1;#c;#u;#l=new Set;#b;#p;constructor(e,s){(Ha(e)!==["openSync","pushV1","closeTransport"].sort().join()||Object.values(e).some(a=>typeof a!="function"))&&xt(),this.#e=Object.freeze({...e}),this.#t=Wt(s),this.#b=Date.now()+24e4,this.#p=setTimeout(()=>{this.close().catch(()=>{})},24e4)}#m(){return!this.#r&&Date.now()<this.#b}async#v(){await this.close().catch(()=>{}),xt()}async#o(e){this.#m()||xt();let s,a;try{let i=await Promise.race([Promise.resolve().then(e),new Promise((n,r)=>{a=r,this.#l.add(r),s=setTimeout(()=>r({}),Math.min(9e4,this.#b-Date.now()))})]);return this.#m()||xt(),i}finally{clearTimeout(s),this.#l.delete(a)}}async begin(){if(!this.#m()||this.#n||this.#h)return this.#v();this.#n=!0;try{return this.#s=new Uint8Array(this.#t.guardian.size),{offset:0}}catch{return this.#v()}}async append(e,s){return!this.#m()||!this.#n||this.#a||this.#h||!this.#s||!Number.isInteger(e)||e!==this.#i||!(s instanceof Uint8Array)||s.length<1||s.length>65536||e+s.length>this.#s.length?this.#v():(this.#s.set(s,e),this.#i+=s.length,{offset:this.#i})}async finish(){if(!this.#m()||!this.#n||this.#a||this.#h||!this.#s||this.#i!==this.#s.length)return this.#v();this.#h=!0,this.#a=!0;try{let e=this.#t.guardian;if(await this.#o(()=>ko(this.#s))!==e.sha256)throw Error();await this.#o(async()=>{let i=await this.#e.openSync();if(!this.#m())throw await xs(()=>i.close()),Error();this.#c=i});let s=this.#s;await this.#o(()=>this.#e.pushV1({socket:this.#c,filename:"/tmp/qingping-initial-guardian-"+this.#t.guardian_job_id+"/program",type:8,permission:384,mtime:0,packetSize:65536,file:new ReadableStream({start(i){i.enqueue(s),i.close()}})}));let a=this.#c;if(this.#c=void 0,await xs(()=>a.close()),!this.#m())throw Error();return this.#s=void 0,{guardian_job_id:this.#t.guardian_job_id,size:e.size,sha256:e.sha256,wire_acknowledged:!0}}catch{return this.#v()}finally{this.#h=!1}}close(){if(this.#u)return this.#u;this.#r=!0,clearTimeout(this.#p),this.#s=void 0;for(let s of this.#l)s({code:"usb_browser_scope_unverified"});let e=this.#c;return this.#c=void 0,this.#u=(async()=>{let s=!1;if(e)try{await xs(()=>e.close())}catch{s=!0}try{await xs(()=>this.#e.closeTransport())}catch{s=!0}if(s)throw{code:"usb_close_unverified"}})(),this.#u}};var $e=()=>{throw{code:"usb_browser_scope_unverified"}},Qe=t=>t&&typeof t=="object"&&!Array.isArray(t)?Object.keys(t).sort().join():null,Ls=t=>typeof t=="string"&&/^[a-f0-9]{64}$/.test(t);function we(t,e){let s=["schema_version","job_id","plan_sha256","intent_sha256","channel_id","channel_nonce","nonce","ram_job_id","guardian_job_id","context","preparation","producer_sha256"],a=["schema_version","job_id","plan_sha256","source_commit","commit_intent_sha256","commit_proof_sha256","candidate_sha256","guardian","api_identity","meta","committed_scope","context_only","guardian_artifact_checked","image_fd_admitted","hardware_contacted","device_writes","writer_enabled","installation_ready","live_recheck_required"];(Qe(t)!==s.sort().join()||Qe(t.context)!==a.sort().join())&&$e();let i,n;try{i=JSON.parse(JSON.stringify(t)),n=JSON.parse(JSON.stringify(e))}catch{$e()}let r=i.context;(Qe(i)!==s.sort().join()||Qe(r)!==a.sort().join()||r.schema_version!==1||r.job_id!==i.job_id||r.plan_sha256!==i.plan_sha256||Ae.schema_version!==1||Ae.source_commit!==H.source_commit||r.source_commit!==Ae.source_commit||["commit_intent_sha256","commit_proof_sha256","candidate_sha256"].some(p=>!Ls(r[p]))||["context_only","guardian_artifact_checked","live_recheck_required"].some(p=>r[p]!==!0)||["image_fd_admitted","hardware_contacted","writer_enabled","installation_ready"].some(p=>r[p]!==!1)||r.device_writes!==0||r.meta?.job_id!==i.job_id||r.meta?.descriptor?.plan_sha256!==i.plan_sha256||Qe(i.producer_sha256)!==[...Ae.producer_files].sort().join()||Object.values(i.producer_sha256).some(p=>!Ls(p)))&&$e(),(Qe(r.api_identity)!==["node_name","api_mac"].sort().join()||typeof r.api_identity.node_name!="string"||!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(r.api_identity.node_name)||typeof r.api_identity.api_mac!="string"||!/^[a-f0-9]{2}(?::[a-f0-9]{2}){5}$/.test(r.api_identity.api_mac)||r.api_identity.api_mac==="00:00:00:00:00:00"||parseInt(r.api_identity.api_mac.slice(0,2),16)&1)&&$e();let o=Wt(Object.fromEntries(["schema_version","job_id","plan_sha256","intent_sha256","channel_id","channel_nonce","nonce","ram_job_id","guardian_job_id"].map(p=>[p,i[p]]).concat([["guardian",r.guardian]])));Oe(i.preparation,r.meta,r.committed_scope),Oe(n,r.meta,r.committed_scope);let d=n.scope,c=r.meta,l=d.stock_process,_=d.watchdog_process,b={plan_id:d.plan_id,plan_sha256:d.plan_sha256,root_device:String(d.root_identity[0]),root_inode:String(d.root_identity[1]),wlan_mac:c.target.wlan_mac,co2_type:String(c.target.co2_type),boot_id:c.target.boot_id,stock_pid:String(l[0]),stock_start:String(l[1]),watchdog_pid:String(_[0]),watchdog_start:String(_[1]),commit_nonce:c.commit_nonce,ram_job_id:o.ram_job_id,guardian_job_id:o.guardian_job_id,guardian_bytes:String(o.guardian.size)};return Ae.staged_roles.forEach((p,u)=>{let f=c.descriptor.files[p]?.sha256;Ls(f)||$e(),b["staged_"+u]=f}),d.vendor_hashes.length!==Ae.vendor_paths.length&&$e(),d.vendor_hashes.forEach(([p,u],f)=>{(p!==Ae.vendor_paths[f]||!Ls(u))&&$e(),b["vendor_"+f]=u}),Object.freeze(Object.fromEntries(["create","inspect_roots","inspect_guardian"].map(p=>{let u=Ae.templates[p];Array.isArray(u)||$e();let f=u.map(g=>typeof g=="string"?g:((Qe(g)!=="field"||typeof b[g.field]!="string")&&$e(),b[g.field])).join("");return(f.length>32768||f.includes("QP_BROWSER_RAM_FIELD_")||!f.startsWith(`set -eu
umask 077
`))&&$e(),[p,f]})))}var xo=()=>{throw{code:"usb_browser_scope_unverified"}},an=oe,St=class{#e;#t=!1;constructor(e){this.#e=new ge(e,({packet:s,fresh:a})=>we(s,a).create)}ready(){return!this.#t&&this.#e.ready()}probe(){return this.#e.probe()}async create(e,s){return(this.#t||!this.#e.ready())&&(await this.close().catch(()=>{}),xo()),this.#t=!0,await this.#e.execute({packet:e,fresh:s}),{kind:"browser_initial_ram_command_ack",completed:!0,remote_verified:!1,image_fd_admitted:!1}}close(){return this.#e.close()}};var Z=()=>{throw{code:"usb_browser_scope_unverified"}},Qa=t=>t&&typeof t=="object"&&!Array.isArray(t)?Object.keys(t).sort().join():null,Va="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",Ka=8*1024*1024;function Ve(t,e=0,s=Number.MAX_SAFE_INTEGER){(typeof t!="string"||!/^(0|[1-9][0-9]*)$/.test(t))&&Z();let a=Number(t);return(!Number.isSafeInteger(a)||a<e||a>s)&&Z(),a}function nn(t,e){(typeof t!="string"||t.length>1024)&&Z();let s=t.split(`
`);s.length!==4&&Z();let a=[],i=[];for(let n=0;n<2;n++){let r=s[n*2].split(" "),o=s[n*2+1].split(" ");(r.length!==4||r[2]!=="700"||r[3]!=="0"||o.length!==3||o[0]!=="1021994")&&Z(),a.push([Ve(r[0],1),Ve(r[1],1)]);let d=Ve(o[1]),c=Ve(o[2],512,65536),l=d*c;(!Number.isSafeInteger(l)||l>2147483647||l<e)&&Z(),i.push(l)}return(a[0][0]!==a[1][0]||a[0][1]===a[1][1])&&Z(),{identities:a,available:Math.min(...i)}}var Ht=(t,e)=>t.length===e.length&&t.every((s,a)=>s===e[a]),rn=["kind","phase","job_id","plan_sha256","intent_sha256","channel_id","channel_nonce","nonce","ram_job_id","guardian_job_id","ram_root_identity","guardian_root_identity","guardian_file_identity","guardian_size","guardian_sha256","tmpfs_available_bytes","image_fd_admitted","execution_authority","context_only"];function Qt(t,e,s=!1,a=null){let i=e?.context?.guardian;(!i||!Number.isSafeInteger(i.size)||i.size<52||i.size>16*1024*1024||typeof i.sha256!="string"||!/^[a-f0-9]{64}$/.test(i.sha256)||typeof s!="boolean"||Qa(t)!==rn.sort().join()||t.kind!=="browser_initial_ram_observation"||t.phase!==(s?"uploaded":"precreated")||["job_id","plan_sha256","intent_sha256","channel_id","channel_nonce","nonce","ram_job_id","guardian_job_id"].some(o=>typeof e[o]!="string"||t[o]!==e[o])||t.guardian_size!==(s?i.size:0)||t.guardian_sha256!==(s?i.sha256:Va)||t.image_fd_admitted!==!1||t.execution_authority!==!1||t.context_only!==!0||!Number.isSafeInteger(t.tmpfs_available_bytes)||t.tmpfs_available_bytes<Ka+(s?0:i.size)||t.tmpfs_available_bytes>2147483647)&&Z();let n=["ram_root_identity","guardian_root_identity","guardian_file_identity"],r=n.map(o=>t[o]);(r.some(o=>!Array.isArray(o)||o.length!==2||o.some(d=>!Number.isSafeInteger(d)||d<1))||new Set(r.map(o=>o[0])).size!==1||new Set(r.map(o=>o[1])).size!==3)&&Z(),a!==null&&(Qt(a,e,!1),n.some(o=>!Ht(t[o],a[o]))&&Z())}function on(t,e,s,a){we(t,e),Qa(s)!==["roots_before","guardian","roots_after"].sort().join()&&Z();let i=a!==null,n=t.context.guardian,r=Ka+(i?0:n.size),o=nn(s.roots_before,r),d=nn(s.roots_after,r);o.identities.some((v,m)=>!Ht(v,d.identities[m]))&&Z();let c=i?n.size:0,l=i?n.sha256:Va;(typeof s.guardian!="string"||s.guardian.length>1024)&&Z();let _=s.guardian.split(`
`),b=_[0].split(" "),p="/tmp/qingping-initial-guardian-"+t.guardian_job_id+"/program";(_.length!==2||b.length!==6||Ve(b[0])!==c||b[1]!=="600"||b[2]!=="0"||b[3]!=="1"||!W(_[1],l,p))&&Z();let u=[Ve(b[4],1),Ve(b[5],1)];(u[0]!==o.identities[1][0]||u[1]===o.identities[0][1]||u[1]===o.identities[1][1])&&Z();let f=Object.fromEntries(["job_id","plan_sha256","intent_sha256","channel_id","channel_nonce","nonce","ram_job_id","guardian_job_id"].map(v=>[v,t[v]]));i&&(Qa(a)!==rn.sort().join()||a.kind!=="browser_initial_ram_observation"||a.phase!=="precreated"||a.guardian_size!==0||a.guardian_sha256!==Va||a.context_only!==!0||a.image_fd_admitted!==!1||a.execution_authority!==!1||Object.entries(f).some(([v,m])=>a[v]!==m)||!Array.isArray(a.ram_root_identity)||!Array.isArray(a.guardian_root_identity)||!Array.isArray(a.guardian_file_identity)||!Ht(a.ram_root_identity,o.identities[0])||!Ht(a.guardian_root_identity,o.identities[1])||!Ht(a.guardian_file_identity,u)||!Number.isSafeInteger(a.tmpfs_available_bytes)||a.tmpfs_available_bytes<Ka+n.size||a.tmpfs_available_bytes>2147483647)&&Z();let g=Object.freeze({kind:"browser_initial_ram_observation",phase:i?"uploaded":"precreated",...f,ram_root_identity:Object.freeze(o.identities[0]),guardian_root_identity:Object.freeze(o.identities[1]),guardian_file_identity:Object.freeze(u),guardian_size:c,guardian_sha256:l,tmpfs_available_bytes:Math.min(o.available,d.available),image_fd_admitted:!1,execution_authority:!1,context_only:!0});return Qt(g,t,i,a),g}function dn(t,e,s){return on(t,e,s,null)}function cn(t,e,s,a){return s==null&&Z(),on(t,e,a,s)}var Ke=()=>{throw{code:"usb_browser_scope_unverified"}},Xa=t=>t&&typeof t=="object"&&!Array.isArray(t)?Object.keys(t).sort().join():null,As=class{#e;#t;#s;#i;#n;#a=!1;#h=!1;#r=!1;#c=!1;#u=!1;#l;#b=new Set;#p;#m;constructor(e,s,a){(Xa(e)!==["preparation","read","openSync","pushV1"].sort().join()||Object.values(e).some(r=>typeof r!="function")||!(s instanceof St)||!s.ready())&&Ke();let i;try{i=JSON.parse(JSON.stringify(a))}catch{Ke()}we(i,i?.preparation);let n=Wt(Object.fromEntries(["schema_version","job_id","plan_sha256","intent_sha256","channel_id","channel_nonce","nonce","ram_job_id","guardian_job_id"].map(r=>[r,i[r]]).concat([["guardian",i.context.guardian]])));this.#e=Object.freeze({...e}),this.#t=s,this.#i=i,this.#s=new Ss({openSync:()=>this.#e.openSync(),pushV1:r=>this.#e.pushV1(r),closeTransport:()=>this.#t.close()},n),this.#p=Date.now()+24e4,this.#m=setTimeout(()=>{this.close().catch(()=>{})},24e4)}async#v(){await this.close().catch(()=>{}),Ke()}async#o(e){(this.#u||Date.now()>=this.#p)&&Ke();let s,a;try{let i=await Promise.race([Promise.resolve().then(e),new Promise((n,r)=>{a=r,this.#b.add(r),s=setTimeout(()=>{this.close().catch(()=>{}),r({code:"usb_browser_scope_unverified"})},Math.min(9e4,this.#p-Date.now()))})]);return(this.#u||Date.now()>=this.#p)&&Ke(),i}finally{clearTimeout(s),this.#b.delete(a)}}async#_(){let e=await this.#o(()=>this.#e.preparation(this.#i.context.meta));return we(this.#i,e),e}async#w(e){let s=we(this.#i,e),a=await this.#o(()=>this.#e.read(s.inspect_roots)),i=await this.#o(()=>this.#e.read(s.inspect_guardian)),n=await this.#o(()=>this.#e.read(s.inspect_roots));return{roots_before:a,guardian:i,roots_after:n}}async prepare(){if(this.#u||this.#a||this.#c)return this.#v();this.#a=!0,this.#c=!0;try{await this.#o(()=>this.#s.begin());let e=await this.#_(),s=await this.#o(()=>this.#t.create(this.#i,e));return(Xa(s)!==["kind","completed","remote_verified","image_fd_admitted"].sort().join()||s.kind!=="browser_initial_ram_command_ack"||s.completed!==!0||s.remote_verified!==!1||s.image_fd_admitted!==!1)&&Ke(),this.#n=dn(this.#i,e,await this.#w(e)),await this.#_(),this.#h=!0,{state:"ram_precreated",precreated:this.#n,writer_enabled:!1,image_fd_admitted:!1}}catch{return this.#v()}finally{this.#c=!1}}async append(e,s){if(this.#u||!this.#h||this.#r||this.#c)return this.#v();this.#c=!0;try{return await this.#o(()=>this.#s.append(e,s))}catch{return this.#v()}finally{this.#c=!1}}async finish(){if(this.#u||!this.#h||this.#r||this.#c)return this.#v();this.#r=!0,this.#c=!0;try{let e=await this.#o(()=>this.#s.finish()),s=this.#i.context.guardian;(Xa(e)!==["guardian_job_id","size","sha256","wire_acknowledged"].sort().join()||e.guardian_job_id!==this.#i.guardian_job_id||e.size!==s.size||e.sha256!==s.sha256||e.wire_acknowledged!==!0)&&Ke();let a=await this.#_(),i=cn(this.#i,a,this.#n,await this.#w(a)),n=await this.#_();return{kind:"browser_initial_ram_ready",precreated:this.#n,uploaded:i,preparation:n,transport_closed:!1,guardian_started:!1,image_fd_admitted:!1,execution_authority:!1,context_only:!0}}catch{return this.#v()}finally{this.#c=!1}}close(){if(this.#l)return this.#l;this.#u=!0,this.#h=!1,clearTimeout(this.#m);for(let e of this.#b)e({code:"usb_browser_scope_unverified"});return this.#l=this.#s.close(),this.#l}};var Q={schema_version:1,source_commit:"53d97b9609e8e0fcdfc5d003101f620098dbc734",source_sha256:{"trial_initial_bridge_adb.py":"4f29bb503dd2d792a42aa2a642505edd2ccf84a3eb35ae7a8964b39006aaf032","initial_bridge_trial_main.cpp":"fd00040a0c6fbf23ded86e833aa86dd5dbaa9f75a3b5ca25bb9b53ae485eb5eb"},markers:{start:"CGS1_TRIAL_START_V1",child:"CGS1_TRIAL_CHILD_V1",end:"CGS1_TRIAL_END_V1"},vendor_paths:["/data/bin/SnowApp","/data/bin/watchdog.sh","/data/etc/init.d/start.sh","/etc/init.d/S12_launcher_init","/etc/init.d/S50_px3se_init","/lib/ld-2.23.so","/lib/libc-2.23.so","/usr/lib/libQt5Core.so.5.9.4","/usr/lib/libstdc++.so.6.0.20"],launch_template:[`set -eu
umask 077
test ! -L /data/.esphome-cgs1
test -d /data/.esphome-cgs1
observed_value=$(stat -c '%d %i %a %u' /data/.esphome-cgs1)
[ "$observed_value" = '`,{field:"root_device"}," ",{field:"root_inode"},` 700 0' ]
test ! -L /data/bin
test ! -L /data/etc
test ! -L /data/etc/init.d
observed_value=$(stat -c '%d' /data/bin)
[ "$observed_value" = `,{field:"root_device"},` ]
observed_value=$(stat -c '%d' /data/etc/init.d)
[ "$observed_value" = `,{field:"root_device"},` ]
test ! -L /data/.esphome-cgs1/install.intent
test -f /data/.esphome-cgs1/install.intent
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/install.intent)
[ "$observed_value" = '98 600 0 1' ]
observed_value=$(cat /data/.esphome-cgs1/install.intent)
[ "$observed_value" = '`,{field:"plan_id"}," ",{field:"plan_sha256"},`' ]
test ! -L /data/.esphome-cgs1/disabled
test -f /data/.esphome-cgs1/disabled
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/disabled)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/disabled | awk '{print $1}')
[ "$observed_value" = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 ]
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/disabled)
[ "$observed_value" = '0 600 0 1' ]
test ! -L /data/.esphome-cgs1/pm-helper.disabled
test -f /data/.esphome-cgs1/pm-helper.disabled
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/pm-helper.disabled)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/pm-helper.disabled | awk '{print $1}')
[ "$observed_value" = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 ]
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/pm-helper.disabled)
[ "$observed_value" = '0 600 0 1' ]
observed_value=$(cat /sys/class/net/wlan0/address)
[ "$observed_value" = `,{field:"wlan_mac"},` ]
observed_value=$(cat /data/etc/os-release)
[ "$observed_value" = CLEARGRASS_VERSION=4.1.8_0287 ]
observed_value=$(cat /proc/sys/kernel/random/boot_id)
[ "$observed_value" = `,{field:"boot_id"},` ]
observed_value=$(awk '
BEGIN { section=0; count=0 }
/^[ \\t]*\\[/ { section=($0 ~ /^[ \\t]*\\[sensors\\][ \\t]*\\r?$/) }
section && /^[ \\t]*co2_type[ \\t]*=/ {
    value=$0; sub(/^[^=]*=[ \\t]*/, "", value); sub(/[ \\t\\r]*$/, "", value)
    print value; count++
}
END { if (count != 1) exit 1 }
' /data/etc/setting.ini)
[ "$observed_value" = `,{field:"co2_type"},` ]
observed_value=$(count=0
for link in /proc/[0-9]*/exe; do
    count=$((count+1))
    [ "$count" -le 4096 ] || exit 1
    pid=\${link#/proc/}; pid=\${pid%/exe}
    case "$pid" in (''|*[!0-9]*) exit 1;; esac
    if executable=$(readlink "$link" 2>/dev/null); then
        :
    else
        # Kernel threads and exited tasks legitimately have no executable.
        # An unreadable live userspace exe is NOT evidence of its absence.
        [ -d "/proc/$pid" ] || continue
        metadata=$(sed 's/.*) //' "/proc/$pid/stat" 2>/dev/null | awk '{print $1, $7}')
        set -- $metadata
        if [ "$#" -ne 2 ]; then
            [ ! -d "/proc/$pid" ] && continue
            exit 1
        fi
        case "$2" in (''|*[!0-9]*) exit 1;; esac
        case "$1" in (Z|X|x) continue;; esac
        [ "$(($2 & 2097152))" -ne 0 ] || exit 1
        continue
    fi
    case "$executable" in
        (/data/.esphome-cgs1/*|/tmp/qingping-full-*/*|/tmp/qingping-initial-*/*) exit 1;;
        (/data/bin/SnowApp) printf '%s\\n' "$pid";;
    esac
done)
[ "$observed_value" = `,{field:"stock_pid"},` ]
observed_value=$(readlink /proc/`,{field:"stock_pid"},`/exe)
[ "$observed_value" = /data/bin/SnowApp ]
observed_value=$(stat -c '%u' /proc/`,{field:"stock_pid"},`)
[ "$observed_value" = 0 ]
observed_value=$(sed 's/.*) //' /proc/`,{field:"stock_pid"},`/stat | awk '{print $20}')
[ "$observed_value" = `,{field:"stock_start"},` ]
process_state=$(sed 's/.*) //' /proc/`,{field:"stock_pid"},`/stat | awk '{print $1}')
case "$process_state" in R|S|D|I) :;; *) exit 1;; esac
observed_value=$(readlink /proc/`,{field:"watchdog_pid"},`/exe)
[ "$observed_value" = /bin/busybox ]
observed_value=$(stat -c '%u' /proc/`,{field:"watchdog_pid"},`)
[ "$observed_value" = 0 ]
observed_value=$(sed 's/.*) //' /proc/`,{field:"watchdog_pid"},`/stat | awk '{print $20}')
[ "$observed_value" = `,{field:"watchdog_start"},` ]
process_state=$(sed 's/.*) //' /proc/`,{field:"watchdog_pid"},`/stat | awk '{print $1}')
case "$process_state" in R|S|D|I) :;; *) exit 1;; esac
observed_value=$(sed 's/.*) //' /proc/`,{field:"stock_pid"},`/stat | awk '{print $2}')
[ "$observed_value" = `,{field:"watchdog_pid"},` ]
arguments=$(tr '\\000' '\\n' < /proc/`,{field:"watchdog_pid"},`/cmdline)
[ "$arguments" = "$(printf '/bin/sh\\n/data/bin/watchdog.sh')" ]
test -r /proc/`,{field:"stock_pid"},`/maps
if grep -F -q '/data/.esphome-cgs1/pm_qt_bridge.so' /proc/`,{field:"stock_pid"},`/maps; then exit 1; else result=$?; [ "$result" -eq 1 ]; fi
test ! -L /data/.esphome-cgs1/program
test -f /data/.esphome-cgs1/program
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/program)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/program | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_0_sha256"},` ]
test ! -L /data/.esphome-cgs1/pm_qt_bridge.so
test -f /data/.esphome-cgs1/pm_qt_bridge.so
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/pm_qt_bridge.so)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/pm_qt_bridge.so | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_1_sha256"},` ]
test ! -L /data/.esphome-cgs1/launch.sh
test -f /data/.esphome-cgs1/launch.sh
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/launch.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/launch.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_2_sha256"},` ]
test ! -L /data/.esphome-cgs1/SnowApp-with-PM
test -f /data/.esphome-cgs1/SnowApp-with-PM
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/SnowApp-with-PM)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/SnowApp-with-PM | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_3_sha256"},` ]
test ! -L /data/.esphome-cgs1/startup-hook.sh
test -f /data/.esphome-cgs1/startup-hook.sh
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/startup-hook.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/startup-hook.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_4_sha256"},` ]
test ! -L /data/.esphome-cgs1/stock-start.sh.original
test -f /data/.esphome-cgs1/stock-start.sh.original
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/stock-start.sh.original)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/stock-start.sh.original | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_5_sha256"},` ]
test ! -L /data/.esphome-cgs1/stock-watchdog.sh.original
test -f /data/.esphome-cgs1/stock-watchdog.sh.original
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/stock-watchdog.sh.original)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/stock-watchdog.sh.original | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_6_sha256"},` ]
test ! -L /data/.esphome-cgs1/start.sh.candidate
test -f /data/.esphome-cgs1/start.sh.candidate
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/start.sh.candidate)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/start.sh.candidate | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_7_sha256"},` ]
test ! -L /data/.esphome-cgs1/watchdog.sh.candidate
test -f /data/.esphome-cgs1/watchdog.sh.candidate
observed_value=$(stat -c '%h %u' /data/.esphome-cgs1/watchdog.sh.candidate)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/.esphome-cgs1/watchdog.sh.candidate | awk '{print $1}')
[ "$observed_value" = `,{field:"staged_8_sha256"},` ]
test ! -L /data/bin/SnowApp
test -f /data/bin/SnowApp
observed_value=$(stat -c '%h %u' /data/bin/SnowApp)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/bin/SnowApp | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_0"},` ]
test ! -L /data/bin/watchdog.sh
test -f /data/bin/watchdog.sh
observed_value=$(stat -c '%h %u' /data/bin/watchdog.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/bin/watchdog.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_1"},` ]
test ! -L /data/etc/init.d/start.sh
test -f /data/etc/init.d/start.sh
observed_value=$(stat -c '%h %u' /data/etc/init.d/start.sh)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /data/etc/init.d/start.sh | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_2"},` ]
test ! -L /etc/init.d/S12_launcher_init
test -f /etc/init.d/S12_launcher_init
observed_value=$(stat -c '%h %u' /etc/init.d/S12_launcher_init)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /etc/init.d/S12_launcher_init | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_3"},` ]
test ! -L /etc/init.d/S50_px3se_init
test -f /etc/init.d/S50_px3se_init
observed_value=$(stat -c '%h %u' /etc/init.d/S50_px3se_init)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /etc/init.d/S50_px3se_init | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_4"},` ]
test ! -L /lib/ld-2.23.so
test -f /lib/ld-2.23.so
observed_value=$(stat -c '%h %u' /lib/ld-2.23.so)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /lib/ld-2.23.so | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_5"},` ]
test ! -L /lib/libc-2.23.so
test -f /lib/libc-2.23.so
observed_value=$(stat -c '%h %u' /lib/libc-2.23.so)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /lib/libc-2.23.so | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_6"},` ]
test ! -L /usr/lib/libQt5Core.so.5.9.4
test -f /usr/lib/libQt5Core.so.5.9.4
observed_value=$(stat -c '%h %u' /usr/lib/libQt5Core.so.5.9.4)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /usr/lib/libQt5Core.so.5.9.4 | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_7"},` ]
test ! -L /usr/lib/libstdc++.so.6.0.20
test -f /usr/lib/libstdc++.so.6.0.20
observed_value=$(stat -c '%h %u' /usr/lib/libstdc++.so.6.0.20)
[ "$observed_value" = '1 0' ]
observed_value=$(sha256sum /usr/lib/libstdc++.so.6.0.20 | awk '{print $1}')
[ "$observed_value" = `,{field:"vendor_8"},` ]
test ! -L /data/.esphome-cgs1/.commit-disabled.lock
test -d /data/.esphome-cgs1/.commit-disabled.lock
observed_value=$(stat -c '%a %u' /data/.esphome-cgs1/.commit-disabled.lock)
[ "$observed_value" = '700 0' ]
test ! -L /data/.esphome-cgs1/.commit-disabled.lock/owner
test -f /data/.esphome-cgs1/.commit-disabled.lock/owner
observed_value=$(stat -c '%a %u %h' /data/.esphome-cgs1/.commit-disabled.lock/owner)
[ "$observed_value" = '600 0 1' ]
observed_value=$(cat /data/.esphome-cgs1/.commit-disabled.lock/owner)
[ "$observed_value" = 'commit-disabled `,{field:"commit_nonce"}," ",{field:"plan_id"},`' ]
# CGS1_INITIAL_ABSENT_STORES
entries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
    case "$entry" in (full-releases|wifi|prefs|full-state) exit 1;; esac
done
entries=$(LC_ALL=C ls -A1 /tmp)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
    case "$entry" in (qingping-cgs1-esphome.lock) exit 1;; esac
done
# CGS1_INITIAL_TCP
test -r /proc/net/tcp
awk '
NR == 1 { if ($2 != "local_address") bad=1; next }
{ count=split($2, local, ":"); port=toupper(local[2]);
  address=toupper(local[1]); state=toupper($4);
  if ($1 !~ /^[0-9]+:$/ || count != 2 || length(address) != 8 ||
      address ~ /[^0-9A-F]/ || length(state) != 2 || state ~ /[^0-9A-F]/ ||
      length(port) != 4 || port ~ /[^0-9A-F]/ ||
      port == "17A5" || port == "0CA0") bad=1 }
END { if (!NR || bad) exit 1 }
' /proc/net/tcp
# CGS1_INITIAL_TCP
test -r /proc/net/tcp6
awk '
NR == 1 { if ($2 != "local_address") bad=1; next }
{ count=split($2, local, ":"); port=toupper(local[2]);
  address=toupper(local[1]); state=toupper($4);
  if ($1 !~ /^[0-9]+:$/ || count != 2 || length(address) != 32 ||
      address ~ /[^0-9A-F]/ || length(state) != 2 || state ~ /[^0-9A-F]/ ||
      length(port) != 4 || port ~ /[^0-9A-F]/ ||
      port == "17A5" || port == "0CA0") bad=1 }
END { if (!NR || bad) exit 1 }
' /proc/net/tcp6
awk '
$1 == "MemTotal:" || $1 == "MemFree:" {
 if (NF != 3 || $2 !~ /^[0-9]+$/ || $3 != "kB" || seen[$1]++) bad=1;
 if ($1 == "MemTotal:") total=$2; else free=$2;
}
END { if (bad || seen["MemTotal:"] != 1 || seen["MemFree:"] != 1 ||
 free < 32768 || free > total || total > 1073741824) exit 1 }
' /proc/meminfo
test ! -L /tmp
test -d /tmp
observed_value=$(readlink -f /tmp)
[ "$observed_value" = /tmp ]
observed_value=$(stat -c '%a %u' /tmp)
[ "$observed_value" = '1777 0' ]
test ! -L /tmp/qingping-initial-trial-`,{field:"ram_job_id"},`
test -d /tmp/qingping-initial-trial-`,{field:"ram_job_id"},`
observed_value=$(readlink -f /tmp/qingping-initial-trial-`,{field:"ram_job_id"},`)
[ "$observed_value" = /tmp/qingping-initial-trial-`,{field:"ram_job_id"},` ]
observed_value=$(stat -c '%d %i %a %u' /tmp/qingping-initial-trial-`,{field:"ram_job_id"},`)
[ "$observed_value" = '`,{field:"ram_device"}," ",{field:"ram_inode"},` 700 0' ]
observed_value=$(stat -f -c '%t' /tmp/qingping-initial-trial-`,{field:"ram_job_id"},`)
[ "$observed_value" = 1021994 ]
observed_value=$(LC_ALL=C ls -A1 /tmp/qingping-initial-trial-`,{field:"ram_job_id"},`)
[ "$observed_value" = '' ]
test ! -L /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},`
test -d /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},`
observed_value=$(readlink -f /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},`)
[ "$observed_value" = /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},` ]
observed_value=$(stat -c '%d %i %a %u' /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},`)
[ "$observed_value" = '`,{field:"guardian_device"}," ",{field:"guardian_inode"},` 700 0' ]
observed_value=$(stat -f -c '%t' /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},`)
[ "$observed_value" = 1021994 ]
observed_value=$(LC_ALL=C ls -A1 /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},`)
[ "$observed_value" = program ]
test ! -L /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},`/program
test -f /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},`/program
observed_value=$(readlink -f /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},`/program)
[ "$observed_value" = /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},`/program ]
observed_value=$(stat -c '%s %a %u %h %d %i' /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},`/program)
[ "$observed_value" = '`,{field:"guardian_bytes"}," 600 0 1 ",{field:"guardian_device"}," ",{field:"guardian_file_inode"},`' ]
qp_guard_sha=$(sha256sum /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},`/program)
[ "$qp_guard_sha" = '`,{field:"guardian_sha256"}," /tmp/qingping-initial-guardian-",{field:"guardian_job_id"},`/program' ] || [ "$qp_guard_sha" = '`,{field:"guardian_sha256"},"  /tmp/qingping-initial-guardian-",{field:"guardian_job_id"},`/program' ]
chmod 700 /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},`/program
test ! -L /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},`/program
test -f /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},`/program
observed_value=$(readlink -f /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},`/program)
[ "$observed_value" = /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},`/program ]
observed_value=$(stat -c '%s %a %u %h %d %i' /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},`/program)
[ "$observed_value" = '`,{field:"guardian_bytes"}," 700 0 1 ",{field:"guardian_device"}," ",{field:"guardian_file_inode"},`' ]
qp_guard_sha=$(sha256sum /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},`/program)
[ "$qp_guard_sha" = '`,{field:"guardian_sha256"}," /tmp/qingping-initial-guardian-",{field:"guardian_job_id"},`/program' ] || [ "$qp_guard_sha" = '`,{field:"guardian_sha256"},"  /tmp/qingping-initial-guardian-",{field:"guardian_job_id"},`/program' ]
exec /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},"/program --bounded-first-bridge-v1 ",{field:"plan_id"}," ",{field:"plan_sha256"}," ",{field:"commit_nonce"}," ",{field:"boot_id"}," ",{field:"wlan_mac"}," ",{field:"co2_type"}," ",{field:"root_device"}," ",{field:"root_inode"}," ",{field:"stock_pid"}," ",{field:"stock_start"}," ",{field:"watchdog_pid"}," ",{field:"watchdog_start"}," ",{field:"ram_job_id"}," ",{field:"ram_device"}," ",{field:"ram_inode"}," ",{field:"guardian_job_id"}," ",{field:"guardian_device"}," ",{field:"guardian_inode"}," ",{field:"guardian_bytes"}," ",{field:"guardian_sha256"}," ",{field:"nonce"}," ",{field:"staged_0_bytes"}," ",{field:"staged_0_sha256"}," ",{field:"staged_1_bytes"}," ",{field:"staged_1_sha256"}," ",{field:"staged_2_bytes"}," ",{field:"staged_2_sha256"}," ",{field:"staged_3_bytes"}," ",{field:"staged_3_sha256"}," ",{field:"staged_4_bytes"}," ",{field:"staged_4_sha256"}," ",{field:"staged_5_bytes"}," ",{field:"staged_5_sha256"}," ",{field:"staged_6_bytes"}," ",{field:"staged_6_sha256"}," ",{field:"staged_7_bytes"}," ",{field:"staged_7_sha256"}," ",{field:"staged_8_bytes"}," ",{field:"staged_8_sha256"}],staged_roles:["bridge-program","pm_qt_bridge.so","launch.sh","SnowApp-with-PM","startup-hook.sh","stock-start.sh.original","stock-watchdog.sh.original","start.sh.candidate","watchdog.sh.candidate"],frame:["--bounded-first-bridge-v1",{field:"plan_id"},{field:"plan_sha256"},{field:"commit_nonce"},{field:"boot_id"},{field:"wlan_mac"},{field:"co2_type"},{field:"root_device"},{field:"root_inode"},{field:"stock_pid"},{field:"stock_start"},{field:"watchdog_pid"},{field:"watchdog_start"},{field:"ram_job_id"},{field:"ram_device"},{field:"ram_inode"},{field:"guardian_job_id"},{field:"guardian_device"},{field:"guardian_inode"},{field:"guardian_bytes"},{field:"guardian_sha256"},{field:"nonce"},{field:"staged_0_bytes"},{field:"staged_0_sha256"},{field:"staged_1_bytes"},{field:"staged_1_sha256"},{field:"staged_2_bytes"},{field:"staged_2_sha256"},{field:"staged_3_bytes"},{field:"staged_3_sha256"},{field:"staged_4_bytes"},{field:"staged_4_sha256"},{field:"staged_5_bytes"},{field:"staged_5_sha256"},{field:"staged_6_bytes"},{field:"staged_6_sha256"},{field:"staged_7_bytes"},{field:"staged_7_sha256"},{field:"staged_8_bytes"},{field:"staged_8_sha256"}]};var ue=()=>{throw{code:"usb_browser_scope_unverified"}},Za=t=>t&&typeof t=="object"&&!Array.isArray(t)?Object.keys(t).sort().join():null;function Ya(t,e,s){try{[t,e,s]=JSON.parse(JSON.stringify([t,e,s]))}catch{ue()}we(t,e);let a=["kind","precreated","uploaded","preparation","transport_closed","guardian_started","image_fd_admitted","execution_authority","context_only"];(Za(s)!==a.sort().join()||s.kind!=="browser_initial_ram_ready"||s.context_only!==!0||["transport_closed","guardian_started","image_fd_admitted","execution_authority"].some(l=>s[l]!==!1)||Q.schema_version!==1||Q.source_commit!==H.source_commit||Q.frame.length!==40||Object.entries(Q.source_sha256).some(([l,_])=>H.source_sha256[l]!==_))&&ue(),Oe(s.preparation,t.context.meta,t.context.committed_scope),Qt(s.precreated,t,!1),Qt(s.uploaded,t,!0,s.precreated);let i=e.scope,n=t.context.meta,r=t.context.guardian,o=s.uploaded,d={plan_id:i.plan_id,plan_sha256:i.plan_sha256,commit_nonce:n.commit_nonce,boot_id:n.target.boot_id,wlan_mac:n.target.wlan_mac,co2_type:String(n.target.co2_type),root_device:String(i.root_identity[0]),root_inode:String(i.root_identity[1]),stock_pid:String(i.stock_process[0]),stock_start:String(i.stock_process[1]),watchdog_pid:String(i.watchdog_process[0]),watchdog_start:String(i.watchdog_process[1]),ram_job_id:t.ram_job_id,ram_device:String(o.ram_root_identity[0]),ram_inode:String(o.ram_root_identity[1]),guardian_job_id:t.guardian_job_id,guardian_device:String(o.guardian_root_identity[0]),guardian_inode:String(o.guardian_root_identity[1]),guardian_bytes:String(r.size),guardian_sha256:r.sha256,nonce:t.nonce};Q.staged_roles.forEach((l,_)=>{let b=n.descriptor.files[l];b||ue(),d[`staged_${_}_bytes`]=String(b.size),d[`staged_${_}_sha256`]=b.sha256});let c=Q.frame.map(l=>typeof l=="string"?l:((Za(l)!=="field"||typeof d[l.field]!="string")&&ue(),d[l.field]));return(c[0]!=="--bounded-first-bridge-v1"||c.length!==40||c.some(l=>!/^[a-zA-Z0-9:_-]{1,128}$/.test(l)))&&ue(),Object.freeze(c)}function ln(t,e,s){try{[t,e,s]=JSON.parse(JSON.stringify([t,e,s]))}catch{ue()}let a=Ya(t,e,s),i={};Q.frame.forEach((r,o)=>{typeof r!="string"&&(i[r.field]=a[o])}),i.guardian_file_inode=String(s.uploaded.guardian_file_identity[1]),(!Array.isArray(Q.vendor_paths)||e.scope.vendor_hashes.length!==Q.vendor_paths.length)&&ue(),e.scope.vendor_hashes.forEach(([r,o],d)=>{(r!==Q.vendor_paths[d]||typeof o!="string"||!/^[a-f0-9]{64}$/.test(o))&&ue(),i["vendor_"+d]=o}),Array.isArray(Q.launch_template)||ue();let n=Q.launch_template.map(r=>typeof r=="string"?r:((Za(r)!=="field"||typeof i[r.field]!="string")&&ue(),i[r.field])).join("");return(n.length>32768||n.endsWith(`
`)||/[^\x01-\x7f]/.test(n)||n.includes("CGS1_ABI_FIELD_")||!n.startsWith(`set -eu
umask 077
`)||!n.endsWith("exec /tmp/qingping-initial-guardian-"+t.guardian_job_id+"/program "+a.join(" ")))&&ue(),n}var ye=()=>{throw{code:"usb_browser_scope_unverified"}};function ti(t,e,s){(typeof t!="string"||!/^(0|[1-9][0-9]*)$/.test(t)||t.length>20)&&ye();let a=BigInt(t);return(a<e||a>s)&&ye(),t}var js=t=>ti(t,1n,(1n<<64n)-1n),ei=t=>Number(ti(t,2n,2147483647n));function pn(t){return(!Array.isArray(t)||t.length!==2||!Number.isInteger(t[0])||t[0]<2||t[0]>2147483647)&&ye(),js(t[1]),t}function Lt(t,e,s=null){(typeof t!="string"||t.length>512||/[^\x01-\x7f]/.test(t)||typeof e!="string"||!/^[a-f0-9]{32}$/.test(e))&&ye(),t.endsWith(`\r
`)?t=t.slice(0,-2):t.endsWith(`
`)?t=t.slice(0,-1):ye();let a=t.split(" ");if((a.some(d=>!d.length)||a[1]!==e)&&ye(),a[0]===Q.markers.start||a[0]===Q.markers.child){(a.length!==4||a[0]===Q.markers.start&&s!==null)&&ye();let d=Object.freeze([ei(a[2]),js(a[3])]);return s!==null&&pn(s)[0]===d[0]&&ye(),Object.freeze({kind:a[0]===Q.markers.start?"start":"child",nonce:e,stamp:d})}(a[0]!==Q.markers.end||a.length!==12||s===null)&&ye();let i=Object.freeze([ei(a[2]),js(a[3])]),n=Object.freeze([ei(a[4]),js(a[5])]),r=pn(s);(i[0]!==r[0]||i[1]!==r[1]||i[0]===n[0]||a.slice(7,11).join(" ")!=="1 1 1 0"||!["0","15"].includes(a[11]))&&ye();let o=Number(ti(a[6],60000n,71000n));return Object.freeze({kind:"end",nonce:e,guardian:i,child:n,elapsed_ms:o,reaped:!0,protection_ack:!0,term_sent:!0,forced:!1,wait_status:Number(a[11])})}var D=()=>{throw{code:"usb_browser_scope_unverified"}},So=new TextEncoder;function hn(){let t,e,s=new Promise((a,i)=>{t=a,e=i});return s.catch(()=>{}),{promise:s,resolve:t,reject:e}}var un=oe,Cs=class{#e;#t=!1;#s=!1;#i=!1;#n=!1;#a=!1;#h;#r;#c=new Set;#u;#l;#b;#p;#m;#v;#o;#_;#w;constructor(e){(!e||Object.keys(e).sort().join()!==["open","live","closeTransport"].sort().join()||Object.values(e).some(s=>typeof s!="function"))&&D(),this.#e=Object.freeze({...e})}#d(){(this.#a||this.#e.live()!==!0||Date.now()>=this.#u)&&D()}async#f(e,s=this.#u){this.#d();let a,i;try{let n=await Promise.race([Promise.resolve().then(e),new Promise((r,o)=>{i=o,this.#c.add(o),a=setTimeout(()=>{this.close().catch(()=>{}),o({code:"usb_browser_scope_unverified"})},Math.max(0,s-Date.now()))})]);return this.#d(),n}finally{clearTimeout(a),this.#c.delete(i)}}async#$(e){if(e)return e.cleanup||(e.cleanup=(async()=>{let s=!1,a=async i=>{let n;try{await Promise.race([Promise.resolve().then(i),new Promise((r,o)=>{n=setTimeout(()=>o({}),2e3)})])}finally{clearTimeout(n)}};try{await a(()=>e.socket.close())}catch{s=!0}if(e.reader){try{await a(()=>e.reader.cancel()),e.reader.releaseLock()}catch{s=!0}e.reader=void 0}if(e.writer){try{e.writer.releaseLock()}catch{s=!0}e.writer=void 0}s&&D()})()),e.cleanup}async#q(e,s,a){let i="",n=0,r=0;for(;;){let{value:o,done:d}=await this.#f(()=>e.reader.read());if(d)break;for((!(o instanceof Uint8Array)||!o.length||o.some(c=>c===0||c>127)||(r+=o.length)>4096)&&D(),i+=new TextDecoder().decode(o);i.includes(`
`);){let c=i.indexOf(`
`),l=i.slice(0,c+1);i=i.slice(c+1),n===0?(this.#v=Lt(l,s),(this.#v.kind!=="start"||this.#w.has(this.#v.stamp[0]))&&D()):n===1?(this.#o=Lt(l,s,this.#v.stamp),(this.#o.kind!=="child"||this.#w.has(this.#o.stamp[0]))&&D(),this.#b.resolve()):n===2?(this.#_=Lt(l,s,this.#v.stamp),(this.#_.kind!=="end"||this.#_.child[0]!==this.#o.stamp[0]||this.#_.child[1]!==this.#o.stamp[1])&&D()):n===3?l!==`
`&&l!==`\r
`&&D():n===4?l!==a+`
`&&l!==a+`\r
`&&D():D(),n++}i.length>512&&D()}return(i||n!==5||!this.#_)&&D(),await this.#f(()=>e.socket.closed),await this.#f(()=>this.#p.promise),await this.#$(e),this.#d(),clearTimeout(this.#l),{kind:"browser_initial_guardian_records",start:this.#v,child:this.#o,end:this.#_,raw_closed:!0,transport_closed:!1,records_only:!0}}async start(e,s,a){(this.#t||this.#s||this.#a)&&(await this.close().catch(()=>{}),D()),this.#t=!0,this.#s=!0,this.#u=Date.now()+11e4,this.#l=setTimeout(()=>{this.close().catch(()=>{})},11e4),this.#b=hn(),this.#p=hn();try{let i,n,r;try{[i,n,r]=JSON.parse(JSON.stringify([e,s,a]))}catch{D()}let o=So.encode(ln(i,n,r));this.#w=new Set([n.scope.stock_process[0],n.scope.watchdog_process[0]]);let d=Array.from(new Uint8Array(await this.#f(()=>crypto.subtle.digest("SHA-256",o))),f=>f.toString(16).padStart(2,"0")).join(""),c="__CGS1_FIXED_OK_"+crypto.randomUUID().replaceAll("-","")+"__",l=Object.freeze({size:o.length,sha256:d,marker:c}),_=oe(l),b=await this.#f(async()=>{let f=await this.#e.open(l);try{this.#d()}catch{await this.#$({socket:f}).catch(()=>{}),D()}return f},Date.now()+5e3),p=this.#r={socket:b};(!b||![_,_+"\0"].includes(b.service)||typeof b.closed?.then!="function"||typeof b.readable?.getReader!="function"||typeof b.writable?.getWriter!="function")&&D(),p.reader=b.readable.getReader(),p.writer=b.writable.getWriter(),this.#m=this.#q(p,i.nonce,c).catch(async()=>{await this.close().catch(()=>{}),D()}),this.#m.catch(()=>{});let u=async()=>{try{for(let f=0;f<o.length;f+=4096)await this.#f(()=>p.writer.write(o.slice(f,f+4096)));this.#p.resolve()}catch(f){throw this.#p.reject(f),f}};return await this.#f(()=>Promise.all([u(),this.#b.promise]),Date.now()+3e4),this.#d(),this.#i=!0,{kind:"browser_initial_guardian_started_record",start:this.#v,child:this.#o,records_only:!0}}catch{await this.close().catch(()=>{}),D()}finally{this.#s=!1}}async finish(){(!this.#i||this.#n||this.#s||this.#a)&&(await this.close().catch(()=>{}),D()),this.#n=!0,this.#s=!0;try{let e=await this.#f(()=>this.#m);return this.#d(),e}catch{await this.close().catch(()=>{}),D()}finally{this.#s=!1}}close(){if(this.#h)return this.#h;this.#a=!0,clearTimeout(this.#l),this.#b?.reject({code:"usb_browser_scope_unverified"}),this.#p?.reject({code:"usb_browser_scope_unverified"});for(let e of this.#c)e({code:"usb_browser_scope_unverified"});return this.#h=(async()=>{let e=!1;try{await this.#$(this.#r)}catch{e=!0}let s;try{await Promise.race([Promise.resolve().then(()=>this.#e.closeTransport()),new Promise((a,i)=>{s=setTimeout(()=>i({}),2e3)})])}catch{e=!0}finally{clearTimeout(s)}e&&D()})(),this.#h}};var Xe={schema_version:1,source_commit:"53d97b9609e8e0fcdfc5d003101f620098dbc734",source_sha256:{"trial_initial_bridge_adb.py":"4f29bb503dd2d792a42aa2a642505edd2ccf84a3eb35ae7a8964b39006aaf032","review_disabled_install.py":"174d4e23e1aaf4c386ab7afcf280a7b99b169ca877130ad1f556295a28850d1a","stage_install_adb.py":"7546caa212b3b44b1a3d8717e550b7bfd5f0893a342c80c6e847cfd2be56b8eb"},reads:[{key:"child_before",parts:[`count=0
for file in /proc/[0-9]*/stat; do
 count=$((count+1)); [ "$count" -le 4096 ] || exit 1
 task=\${file%/stat}; child=\${task#/proc/}
 row=$(sed 's/.*) //' "$file" 2>/dev/null | awk '{print $1, $2, $20}')
 set -- $row
 if [ "$#" -ne 3 ]; then [ ! -d "$task" ] && continue; exit 1; fi
 case "$2:$3" in (*[!0-9:]*|:*|*:) exit 1;; esac
 if [ "$2" = '`,{field:"guardian_pid"},`' ]; then printf '%s %s %s\\n' "$child" "$3" "$1"; fi
done`]},{key:"guardian_process_before",parts:["cat /proc/",{field:"guardian_pid"},`/stat
stat -c '%u' /proc/`,{field:"guardian_pid"},`
readlink /proc/`,{field:"guardian_pid"},"/exe"]},{key:"guardian_file",parts:["test ! -L /tmp/qingping-initial-guardian-",{field:"guardian_job_id"},`/program
test -f /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},`/program
stat -c '%s %h' /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},`/program
sha256sum /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},"/program"]},{key:"guardian_image",parts:["stat -L -c '%d %i %s %a %u %h' /proc/",{field:"guardian_pid"},`/exe
stat -c '%d %i %s %a %u %h' /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},`/program
sha256sum /proc/`,{field:"guardian_pid"},"/exe"]},{key:"guardian_process_after",parts:["cat /proc/",{field:"guardian_pid"},`/stat
stat -c '%u' /proc/`,{field:"guardian_pid"},`
readlink /proc/`,{field:"guardian_pid"},"/exe"]},{key:"child_process_before",parts:["cat /proc/",{field:"child_pid"},`/stat
stat -c '%u' /proc/`,{field:"child_pid"},`
readlink /proc/`,{field:"child_pid"},"/exe"]},{key:"child_file",parts:[`test ! -L /data/.esphome-cgs1/program
test -f /data/.esphome-cgs1/program
stat -c '%s %h' /data/.esphome-cgs1/program
sha256sum /data/.esphome-cgs1/program`]},{key:"child_image",parts:["stat -L -c '%d %i %s %a %u %h' /proc/",{field:"child_pid"},`/exe
stat -c '%d %i %s %a %u %h' /data/.esphome-cgs1/program
sha256sum /proc/`,{field:"child_pid"},"/exe"]},{key:"child_process_after",parts:["cat /proc/",{field:"child_pid"},`/stat
stat -c '%u' /proc/`,{field:"child_pid"},`
readlink /proc/`,{field:"child_pid"},"/exe"]},{key:"endpoint",parts:[`sockets=' '
count=0
for file in /proc/`,{field:"child_pid"},`/fd/*; do
 count=$((count+1)); [ "$count" -le 4096 ] || exit 1
 link=$(readlink "$file")
 case "$link" in (socket:\\[*\\]) inode=\${link#socket:}; inode=\${inode#\\[}; inode=\${inode%\\]}; case "$inode" in (''|*[!0-9]*) exit 1;; esac; sockets="$sockets$inode ";; esac
done
for table in /proc/net/tcp /proc/net/tcp6; do
 test -r "$table"
 awk -v owned="$sockets" '
 NR==1 { if ($2!="local_address") bad=1; next }
 { count=split($2, local, ":"); port=toupper(local[2]); address=toupper(local[1]); state=toupper($4);
   if ($1 !~ /^[0-9]+:$/ || NF<10 || count!=2 || (length(address)!=8 && length(address)!=32) ||
       address ~ /[^0-9A-F]/ || length(port)!=4 || port ~ /[^0-9A-F]/ ||
       length(state)!=2 || state ~ /[^0-9A-F]/ || $10 !~ /^[0-9]+$/) bad=1;
   if (port=="17A5" || port=="0CA0") {
     if ($10 !~ /^[1-9][0-9]*$/ || index(owned, " " $10 " ")==0) bad=1;
     if (state=="0A") print FILENAME, port;
   }
 }
 END { if (!NR || bad) exit 1 }
 ' "$table"
done`]},{key:"child_after",parts:[`count=0
for file in /proc/[0-9]*/stat; do
 count=$((count+1)); [ "$count" -le 4096 ] || exit 1
 task=\${file%/stat}; child=\${task#/proc/}
 row=$(sed 's/.*) //' "$file" 2>/dev/null | awk '{print $1, $2, $20}')
 set -- $row
 if [ "$#" -ne 3 ]; then [ ! -d "$task" ] && continue; exit 1; fi
 case "$2:$3" in (*[!0-9:]*|:*|*:) exit 1;; esac
 if [ "$2" = '`,{field:"guardian_pid"},`' ]; then printf '%s %s %s\\n' "$child" "$3" "$1"; fi
done`]}]};var q=()=>{throw{code:"usb_browser_scope_unverified"}},si=["child_before","guardian_process_before","guardian_file","guardian_image","guardian_process_after","child_process_before","child_file","child_image","child_process_after","endpoint","child_after"],Es=t=>t&&typeof t=="object"&&!Array.isArray(t)?Object.keys(t).sort().join():null,vn=t=>{try{return JSON.parse(JSON.stringify(t))}catch{q()}},_n=(t,e)=>t.length===e.length&&t.every((s,a)=>s===e[a]);function At(t,e=1n,s=(1n<<64n)-1n){(typeof t!="string"||!/^(0|[1-9][0-9]*)$/.test(t)||t.length>20)&&q();let a=BigInt(t);return(a<e||a>s)&&q(),t}function gn(t,e,s){Ya(t,e?.preparation,e),(Es(s)!==["kind","start","child","records_only"].sort().join()||s.kind!=="browser_initial_guardian_started_record"||s.records_only!==!0)&&q();for(let i of["start","child"]){let n=s[i];(Es(n)!==["kind","nonce","stamp"].sort().join()||n.kind!==i||n.nonce!==t.nonce||!Array.isArray(n.stamp)||n.stamp.length!==2||!Number.isInteger(n.stamp[0])||typeof n.stamp[1]!="string")&&q();let r=`CGS1_TRIAL_${i.toUpperCase()}_V1 ${t.nonce} ${n.stamp[0]} ${n.stamp[1]}
`;Lt(r,t.nonce,i==="child"?s.start.stamp:null)}let a=new Set([t.context.committed_scope.stock_process[0],t.context.committed_scope.watchdog_process[0]]);(a.has(s.start.stamp[0])||a.has(s.child.stamp[0]))&&q(),(Xe.schema_version!==1||Xe.source_commit!==H.source_commit||Object.entries(Xe.source_sha256).some(([i,n])=>H.source_sha256[i]!==n)||Xe.reads.length!==si.length||Xe.reads.some((i,n)=>i.key!==si[n]))&&q()}function Kt(t,e,s){let[a,i,n]=vn([t,e,s]);gn(a,i,n);let r={guardian_pid:String(n.start.stamp[0]),child_pid:String(n.child.stamp[0]),guardian_job_id:a.guardian_job_id},o=Object.fromEntries(Xe.reads.map(({key:d,parts:c})=>[d,c.map(l=>typeof l=="string"?l:((Es(l)!=="field"||typeof r[l.field]!="string")&&q(),r[l.field])).join("")]));return Object.values(o).some(d=>d.length>8192||/[^\x01-\x7f]/.test(d))&&q(),Object.freeze(o)}function Vt(t){(typeof t!="string"||!t.length||t.length>65536||/[^\x01-\x7f]/.test(t))&&q(),t.endsWith(`\r
`)?t=t.slice(0,-2):t.endsWith(`
`)&&(t=t.slice(0,-1));let e=t.split(/\r?\n/);return e.some(s=>!s.length||s.includes("\r"))&&q(),e}function Ze(t,e,s,a=null){let i=Vt(t);(i.length!==3||i[1]!=="0"||i[2]!==s)&&q();let n=i[0],r=n.indexOf("("),o=n.lastIndexOf(") ");(r<1||o<=r||n.slice(0,r)!==String(e[0])+" ")&&q();let d=n.slice(o+2).split(" ");(d.length<20||d.length>128||!/^[RSDI]$/.test(d[0]))&&q();let c=Number(At(d[1],1n,2147483647n)),l=At(d[19]);return(l!==e[1]||a!==null&&c!==a)&&q(),[e[0],c,l]}function bn(t,e){let s=Vt(t);s.length!==1&&q();let a=s[0].split(" ");(a.length!==3||!/^[RSDI]$/.test(a[2])||Number(At(a[0],2n,2147483647n))!==e[0]||At(a[1])!==e[1])&&q()}function fn(t,e,s){t!==e+" "+s&&t!==e+"  "+s&&q()}function mn(t,e,s,a,i,n,r=null){let o=Vt(t[e+"_file"]);(o.length!==2||o[0]!==i.size+" 1")&&q(),fn(o[1],i.sha256,a);let d=Vt(t[e+"_image"]);(d.length!==3||d[0]!==d[1])&&q();let c=d[0].split(" ");return(c.length!==6||c.slice(2).join(" ")!==i.size+" 700 0 1"||At(c[0])!==String(n))&&q(),At(c[1]),r!==null&&c[1]!==String(r)&&q(),fn(d[2],i.sha256,"/proc/"+s[0]+"/exe"),Object.freeze(c.slice(0,2))}function Is(t,e,s,a){let[i,n,r,o]=vn([t,e,s,a]);gn(i,n,r),Es(o)!==[...si].sort().join()&&q();let d=r.start.stamp,c=r.child.stamp,l="/tmp/qingping-initial-guardian-"+i.guardian_job_id+"/program",_="/data/.esphome-cgs1/program";bn(o.child_before,c);let b=Ze(o.guardian_process_before,d,l),p=Ze(o.child_process_before,c,_,d[0]),u=mn(o,"guardian",d,l,i.context.guardian,...n.uploaded.guardian_file_identity),f=mn(o,"child",c,_,i.context.meta.descriptor.files["bridge-program"],i.context.committed_scope.root_identity[0]);(!_n(b,Ze(o.guardian_process_after,d,l))||!_n(p,Ze(o.child_process_after,c,_,d[0])))&&q();let g=Vt(o.endpoint);(g.length<2||g.length>4||new Set(g).size!==g.length||g.some(m=>!/^\/proc\/net\/tcp6? (17A5|0CA0)$/.test(m))||new Set(g.map(m=>m.split(" ")[1])).size!==2)&&q(),bn(o.child_after,c);let v=Object.fromEntries(["job_id","plan_sha256","intent_sha256","channel_id","channel_nonce","nonce","ram_job_id","guardian_job_id"].map(m=>[m,i[m]]));return Object.freeze({kind:"browser_initial_process_observation",...v,guardian:Object.freeze(d),child:Object.freeze(c),guardian_parent:b[1],guardian_image:u,child_image:f,kernel_child_checked:!0,process_images_checked:!0,endpoint_ownership_checked:!0,image_fd_admitted:!1,execution_authority:!1,context_only:!0})}var _e={schema_version:1,source_commit:"53d97b9609e8e0fcdfc5d003101f620098dbc734",maximum_observation_ms:5e3,source_sha256:{"bootstrap_patches.py":"12bc6fb3fadfe6c0101130914c3dafe7db243669b8a000e83806ff0afd66f959","build_candidate.py":"a5583b8e0159c3df425d5e500de5599b66b93a5e17ff6107d8fa75fe64caa294","build_pm_helper.py":"94a8f6c9d11fad0c18d459019b9791db1797ce339a5aa9b821d41b2199aa8851","commit_disabled_install.py":"b78470c8fe3f6275d2eca07067ec56beb858f11d8037b435be08f9f6781b4408","disabled_commit_policy.py":"ad8b50cd9c112f37b40bb1f3a77ba2ca598bf307deb1817ea1fdda4c492f2ab7","initial_bridge_trial_main.cpp":"fd00040a0c6fbf23ded86e833aa86dd5dbaa9f75a3b5ca25bb9b53ae485eb5eb","initial_bridge_trial_policy.py":"c304ce59b7df712bcbb9b2fa1564a70e1ed22fb5c2575d3bdbeebc08556b4677","initial_trial_admission.h":"77f5b1ce0c002ec9f32b87ce6615e4128134b28363e33bfc530f32af87dc9ba5","initial_trial_child.h":"5fe9e093428228ee9b0a9f6b599f402825e9a952623bfff160a4e7af3ae954cf","initial_trial_device.h":"7e2b0e9857b37b0530bc8fb69d8bb42df5a54485aef1b86fb2f75da2e078c39d","initial_trial_exec.h":"a5f09c528f03e0c61c7748ce4d68861507d2e79a49240e92dcdba89b96cbd880","initial_trial_filesystem.h":"b3018ddb17960c4bb5108602e243121159d4542f19522de9a9d4542ee9a830c5","initial_trial_intent.h":"ac429b5817af301da0cc3f3ba7f32f9cbb4730e8fb53771ba08873a91bf20c11","initial_trial_ram_scope.h":"393ab184fa31189cde891c9e736256af2eb3945f1dc6ca34a74dbd077e4276b9","initial_trial_resources.h":"d09bdf079d157a80f385a3e83d14f9237514393e635b17f6b0c33061892a492f","initial_trial_scope.h":"e3f059e3c5f97b241c588b71a7c6aa8df114bddac0082f6a1f0a2520eab9e7ac","initial_trial_self.h":"d62dbc7cf9d513bed3a506e64993efc710f3c12e7ebf6030d9754ba5a054f357","initial_trial_stock.h":"8e94e07eb9ca82f16fb79c36b8b72f69792a107b575cda356353c0b29a87e1a9","initial_trial_vendor.h":"08a506963b9e9a4c2b2b36c2085976ccfbbc6deec3276c67a8149b6d2d70b90c","preflight_adb.py":"128cf367baeee28bcfb4156256548fdded689a42d50662e77580fdd71ab19b47","prepare_install.py":"92f99cf2ff074d58f734303c54907a73feffab33d4e174d70def6d1ee70fa375","review_disabled_install.py":"174d4e23e1aaf4c386ab7afcf280a7b99b169ca877130ad1f556295a28850d1a","review_initial_trial.py":"d9f2f022edbbe190d8c8b0ccbb87071f9c6dfcb53320f8e53232264ac71cc0b4","stage_install_adb.py":"7546caa212b3b44b1a3d8717e550b7bfd5f0893a342c80c6e847cfd2be56b8eb","trial_initial_bridge_adb.py":"4f29bb503dd2d792a42aa2a642505edd2ccf84a3eb35ae7a8964b39006aaf032"},branches:{empty:[{key:"child_before",parts:[`count=0
for file in /proc/[0-9]*/stat; do
 count=$((count+1)); [ "$count" -le 4096 ] || exit 1
 task=\${file%/stat}; child=\${task#/proc/}
 row=$(sed 's/.*) //' "$file" 2>/dev/null | awk '{print $1, $2, $20}')
 set -- $row
 if [ "$#" -ne 3 ]; then [ ! -d "$task" ] && continue; exit 1; fi
 case "$2:$3" in (*[!0-9:]*|:*|*:) exit 1;; esac
 if [ "$2" = '`,{field:"guardian_pid"},`' ]; then printf '%s %s %s\\n' "$child" "$3" "$1"; fi
done`]},{key:"guardian_process_before",parts:["cat /proc/",{field:"guardian_pid"},`/stat
stat -c '%u' /proc/`,{field:"guardian_pid"},`
readlink /proc/`,{field:"guardian_pid"},"/exe"]},{key:"guardian_file",parts:["test ! -L /tmp/qingping-initial-guardian-",{field:"guardian_job_id"},`/program
test -f /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},`/program
stat -c '%s %h' /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},`/program
sha256sum /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},"/program"]},{key:"guardian_image",parts:["stat -L -c '%d %i %s %a %u %h' /proc/",{field:"guardian_pid"},`/exe
stat -c '%d %i %s %a %u %h' /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},`/program
sha256sum /proc/`,{field:"guardian_pid"},"/exe"]},{key:"guardian_process_after",parts:["cat /proc/",{field:"guardian_pid"},`/stat
stat -c '%u' /proc/`,{field:"guardian_pid"},`
readlink /proc/`,{field:"guardian_pid"},"/exe"]},{key:"child_process_before",parts:["cat /proc/",{field:"child_pid"},`/stat
stat -c '%u' /proc/`,{field:"child_pid"},`
readlink /proc/`,{field:"child_pid"},"/exe"]},{key:"child_file",parts:[`test ! -L /data/.esphome-cgs1/program
test -f /data/.esphome-cgs1/program
stat -c '%s %h' /data/.esphome-cgs1/program
sha256sum /data/.esphome-cgs1/program`]},{key:"child_image",parts:["stat -L -c '%d %i %s %a %u %h' /proc/",{field:"child_pid"},`/exe
stat -c '%d %i %s %a %u %h' /data/.esphome-cgs1/program
sha256sum /proc/`,{field:"child_pid"},"/exe"]},{key:"child_process_after",parts:["cat /proc/",{field:"child_pid"},`/stat
stat -c '%u' /proc/`,{field:"child_pid"},`
readlink /proc/`,{field:"child_pid"},"/exe"]},{key:"endpoint",parts:[`sockets=' '
count=0
for file in /proc/`,{field:"child_pid"},`/fd/*; do
 count=$((count+1)); [ "$count" -le 4096 ] || exit 1
 link=$(readlink "$file")
 case "$link" in (socket:\\[*\\]) inode=\${link#socket:}; inode=\${inode#\\[}; inode=\${inode%\\]}; case "$inode" in (''|*[!0-9]*) exit 1;; esac; sockets="$sockets$inode ";; esac
done
for table in /proc/net/tcp /proc/net/tcp6; do
 test -r "$table"
 awk -v owned="$sockets" '
 NR==1 { if ($2!="local_address") bad=1; next }
 { count=split($2, local, ":"); port=toupper(local[2]); address=toupper(local[1]); state=toupper($4);
   if ($1 !~ /^[0-9]+:$/ || NF<10 || count!=2 || (length(address)!=8 && length(address)!=32) ||
       address ~ /[^0-9A-F]/ || length(port)!=4 || port ~ /[^0-9A-F]/ ||
       length(state)!=2 || state ~ /[^0-9A-F]/ || $10 !~ /^[0-9]+$/) bad=1;
   if (port=="17A5" || port=="0CA0") {
     if ($10 !~ /^[1-9][0-9]*$/ || index(owned, " " $10 " ")==0) bad=1;
     if (state=="0A") print FILENAME, port;
   }
 }
 END { if (!NR || bad) exit 1 }
 ' "$table"
done`]},{key:"process_scan",parts:[`count=0
for link in /proc/[0-9]*/exe; do
    count=$((count+1))
    [ "$count" -le 4096 ] || exit 1
    pid=\${link#/proc/}; pid=\${pid%/exe}
    case "$pid" in (''|*[!0-9]*) exit 1;; esac
    if executable=$(readlink "$link" 2>/dev/null); then
        :
    else
        # Kernel threads and exited tasks legitimately have no executable.
        # An unreadable live userspace exe is NOT evidence of its absence.
        [ -d "/proc/$pid" ] || continue
        metadata=$(sed 's/.*) //' "/proc/$pid/stat" 2>/dev/null | awk '{print $1, $7}')
        set -- $metadata
        if [ "$#" -ne 2 ]; then
            [ ! -d "/proc/$pid" ] && continue
            exit 1
        fi
        case "$2" in (''|*[!0-9]*) exit 1;; esac
        case "$1" in (Z|X|x) continue;; esac
        [ "$(($2 & 2097152))" -ne 0 ] || exit 1
        continue
    fi
    case "$executable" in
        (/data/.esphome-cgs1/*|/tmp/qingping-full-*/*|/tmp/qingping-initial-*/*)
case "$pid:$executable" in
(`,{field:"guardian_pid"},":/tmp/qingping-initial-guardian-",{field:"guardian_job_id"},"/program|",{field:"child_pid"},`:/data/.esphome-cgs1/program) :;;
(*) exit 1;;
esac;;
        (/data/bin/SnowApp) printf '%s\\n' "$pid";;
    esac
done`]},{key:"stock_process",parts:["cat /proc/",{field:"stock_pid"},`/stat
stat -c '%u' /proc/`,{field:"stock_pid"},`
readlink /proc/`,{field:"stock_pid"},"/exe"]},{key:"watchdog_process",parts:["cat /proc/",{field:"watchdog_pid"},`/stat
stat -c '%u' /proc/`,{field:"watchdog_pid"},`
readlink /proc/`,{field:"watchdog_pid"},"/exe"]},{key:"watchdog_arguments",parts:["arguments=$(tr '\\000' '\\n' < /proc/",{field:"watchdog_pid"},`/cmdline)
[ "$arguments" = "$(printf '/bin/sh\\n/data/bin/watchdog.sh')" ]`]},{key:"stock_maps_0",parts:["test -r /proc/",{field:"stock_pid"},`/maps
if grep -F -q /data/.esphome-cgs1/ /proc/`,{field:"stock_pid"},'/maps; then exit 1; else result=$?; [ "$result" -eq 1 ]; fi']},{key:"stock_maps_1",parts:["test -r /proc/",{field:"stock_pid"},`/maps
if grep -F -q /tmp/qingping-full- /proc/`,{field:"stock_pid"},'/maps; then exit 1; else result=$?; [ "$result" -eq 1 ]; fi']},{key:"stock_maps_2",parts:["test -r /proc/",{field:"stock_pid"},`/maps
if grep -F -q /tmp/qingping-initial- /proc/`,{field:"stock_pid"},'/maps; then exit 1; else result=$?; [ "$result" -eq 1 ]; fi']},{key:"vendor_0",parts:[`test ! -L /data/bin/SnowApp
test -f /data/bin/SnowApp
stat -c '%s %h' /data/bin/SnowApp
sha256sum /data/bin/SnowApp`]},{key:"vendor_1",parts:[`test ! -L /data/bin/watchdog.sh
test -f /data/bin/watchdog.sh
stat -c '%s %h' /data/bin/watchdog.sh
sha256sum /data/bin/watchdog.sh`]},{key:"vendor_2",parts:[`test ! -L /data/etc/init.d/start.sh
test -f /data/etc/init.d/start.sh
stat -c '%s %h' /data/etc/init.d/start.sh
sha256sum /data/etc/init.d/start.sh`]},{key:"vendor_3",parts:[`test ! -L /etc/init.d/S12_launcher_init
test -f /etc/init.d/S12_launcher_init
stat -c '%s %h' /etc/init.d/S12_launcher_init
sha256sum /etc/init.d/S12_launcher_init`]},{key:"vendor_4",parts:[`test ! -L /etc/init.d/S50_px3se_init
test -f /etc/init.d/S50_px3se_init
stat -c '%s %h' /etc/init.d/S50_px3se_init
sha256sum /etc/init.d/S50_px3se_init`]},{key:"vendor_5",parts:[`test ! -L /lib/ld-2.23.so
test -f /lib/ld-2.23.so
stat -c '%s %h' /lib/ld-2.23.so
sha256sum /lib/ld-2.23.so`]},{key:"vendor_6",parts:[`test ! -L /lib/libc-2.23.so
test -f /lib/libc-2.23.so
stat -c '%s %h' /lib/libc-2.23.so
sha256sum /lib/libc-2.23.so`]},{key:"vendor_7",parts:[`test ! -L /usr/lib/libstdc++.so.6.0.20
test -f /usr/lib/libstdc++.so.6.0.20
stat -c '%s %h' /usr/lib/libstdc++.so.6.0.20
sha256sum /usr/lib/libstdc++.so.6.0.20`]},{key:"vendor_8",parts:[`test ! -L /usr/lib/libQt5Core.so.5.9.4
test -f /usr/lib/libQt5Core.so.5.9.4
stat -c '%s %h' /usr/lib/libQt5Core.so.5.9.4
sha256sum /usr/lib/libQt5Core.so.5.9.4`]},{key:"staged_0",parts:[`test ! -L /data/.esphome-cgs1/program
test -f /data/.esphome-cgs1/program
stat -c '%s %h' /data/.esphome-cgs1/program
sha256sum /data/.esphome-cgs1/program`]},{key:"staged_1",parts:[`test ! -L /data/.esphome-cgs1/pm_qt_bridge.so
test -f /data/.esphome-cgs1/pm_qt_bridge.so
stat -c '%s %h' /data/.esphome-cgs1/pm_qt_bridge.so
sha256sum /data/.esphome-cgs1/pm_qt_bridge.so`]},{key:"staged_2",parts:[`test ! -L /data/.esphome-cgs1/launch.sh
test -f /data/.esphome-cgs1/launch.sh
stat -c '%s %h' /data/.esphome-cgs1/launch.sh
sha256sum /data/.esphome-cgs1/launch.sh`]},{key:"staged_3",parts:[`test ! -L /data/.esphome-cgs1/SnowApp-with-PM
test -f /data/.esphome-cgs1/SnowApp-with-PM
stat -c '%s %h' /data/.esphome-cgs1/SnowApp-with-PM
sha256sum /data/.esphome-cgs1/SnowApp-with-PM`]},{key:"staged_4",parts:[`test ! -L /data/.esphome-cgs1/startup-hook.sh
test -f /data/.esphome-cgs1/startup-hook.sh
stat -c '%s %h' /data/.esphome-cgs1/startup-hook.sh
sha256sum /data/.esphome-cgs1/startup-hook.sh`]},{key:"staged_5",parts:[`test ! -L /data/.esphome-cgs1/stock-start.sh.original
test -f /data/.esphome-cgs1/stock-start.sh.original
stat -c '%s %h' /data/.esphome-cgs1/stock-start.sh.original
sha256sum /data/.esphome-cgs1/stock-start.sh.original`]},{key:"staged_6",parts:[`test ! -L /data/.esphome-cgs1/stock-watchdog.sh.original
test -f /data/.esphome-cgs1/stock-watchdog.sh.original
stat -c '%s %h' /data/.esphome-cgs1/stock-watchdog.sh.original
sha256sum /data/.esphome-cgs1/stock-watchdog.sh.original`]},{key:"staged_7",parts:[`test ! -L /data/.esphome-cgs1/start.sh.candidate
test -f /data/.esphome-cgs1/start.sh.candidate
stat -c '%s %h' /data/.esphome-cgs1/start.sh.candidate
sha256sum /data/.esphome-cgs1/start.sh.candidate`]},{key:"staged_8",parts:[`test ! -L /data/.esphome-cgs1/watchdog.sh.candidate
test -f /data/.esphome-cgs1/watchdog.sh.candidate
stat -c '%s %h' /data/.esphome-cgs1/watchdog.sh.candidate
sha256sum /data/.esphome-cgs1/watchdog.sh.candidate`]},{key:"root",parts:[`test ! -L /data/.esphome-cgs1
test -d /data/.esphome-cgs1
stat -c '%d %i %a %u' /data/.esphome-cgs1
test ! -L /data/.esphome-cgs1/install.intent
test -f /data/.esphome-cgs1/install.intent
[ "$(stat -c '%s %a %u %h' /data/.esphome-cgs1/install.intent)" = '98 600 0 1' ]
cat /data/.esphome-cgs1/install.intent`]},{key:"parents",parts:[`test ! -L /data/bin
test ! -L /data/etc
test ! -L /data/etc/init.d
stat -c '%d' /data/bin /data/etc/init.d`]},{key:"disabled",parts:[`test ! -L /data/.esphome-cgs1/disabled
test -f /data/.esphome-cgs1/disabled
stat -c '%s %a %u %h' /data/.esphome-cgs1/disabled
sha256sum /data/.esphome-cgs1/disabled`]},{key:"pm-helper.disabled",parts:[`test ! -L /data/.esphome-cgs1/pm-helper.disabled
test -f /data/.esphome-cgs1/pm-helper.disabled
stat -c '%s %a %u %h' /data/.esphome-cgs1/pm-helper.disabled
sha256sum /data/.esphome-cgs1/pm-helper.disabled`]},{key:"absent_stores",parts:[`# CGS1_INITIAL_ABSENT_STORES
entries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
    case "$entry" in (full-releases|wifi|prefs|full-state) exit 1;; esac
done
entries=$(LC_ALL=C ls -A1 /tmp)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
    case "$entry" in (qingping-cgs1-esphome.lock) exit 1;; esac
done`]},{key:"memory",parts:[`# CGS1_INITIAL_MEMORY
awk '$1 == "MemTotal:" || $1 == "MemFree:" { print }' /proc/meminfo`]},{key:"intent_file",parts:[`test ! -L /data/.esphome-cgs1/initial-trial.intent
test -f /data/.esphome-cgs1/initial-trial.intent
stat -c '%s %h' /data/.esphome-cgs1/initial-trial.intent
sha256sum /data/.esphome-cgs1/initial-trial.intent`]},{key:"intent_mode",parts:[`observed_value=$(stat -c '%a %u' /data/.esphome-cgs1/initial-trial.intent)
[ "$observed_value" = '600 0' ]
`]},{key:"nand_entries",parts:["LC_ALL=C ls -A1 /data/.esphome-cgs1"]},{key:"commit_marker",parts:[`# CGS1_INITIAL_COMMIT_MARKER
test ! -L /data/.esphome-cgs1/.commit-disabled.lock
test -d /data/.esphome-cgs1/.commit-disabled.lock
observed_value=$(stat -c '%a %u' /data/.esphome-cgs1/.commit-disabled.lock)
[ "$observed_value" = '700 0' ]
test ! -L /data/.esphome-cgs1/.commit-disabled.lock/owner
test -f /data/.esphome-cgs1/.commit-disabled.lock/owner
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/.commit-disabled.lock/owner)
[ "$observed_value" = '82 600 0 1' ]
cat /data/.esphome-cgs1/.commit-disabled.lock/owner`]},{key:"ram_identity",parts:[`test ! -L /tmp
test ! -L /tmp/qingping-initial-trial-`,{field:"ram_job_id"},`
test -d /tmp/qingping-initial-trial-`,{field:"ram_job_id"},`
stat -c '%d %i %a %u' /tmp/qingping-initial-trial-`,{field:"ram_job_id"},`
stat -f -c '%t' /tmp/qingping-initial-trial-`,{field:"ram_job_id"}]},{key:"ram_entries",parts:["LC_ALL=C ls -A1 /tmp/qingping-initial-trial-",{field:"ram_job_id"}]},{key:"identity_uid",parts:["id -u"]},{key:"identity_wlan",parts:["cat /sys/class/net/wlan0/address"]},{key:"identity_version",parts:["cat /data/etc/os-release"]},{key:"identity_architecture",parts:["uname -m"]},{key:"identity_co2",parts:[`awk '
BEGIN { section=0; count=0 }
/^[ \\t]*\\[/ { section=($0 ~ /^[ \\t]*\\[sensors\\][ \\t]*\\r?$/) }
section && /^[ \\t]*co2_type[ \\t]*=/ {
    value=$0; sub(/^[^=]*=[ \\t]*/, "", value); sub(/[ \\t\\r]*$/, "", value)
    print value; count++
}
END { if (count != 1) exit 1 }
' /data/etc/setting.ini`]},{key:"identity_boot",parts:["cat /proc/sys/kernel/random/boot_id"]},{key:"child_after",parts:[`count=0
for file in /proc/[0-9]*/stat; do
 count=$((count+1)); [ "$count" -le 4096 ] || exit 1
 task=\${file%/stat}; child=\${task#/proc/}
 row=$(sed 's/.*) //' "$file" 2>/dev/null | awk '{print $1, $2, $20}')
 set -- $row
 if [ "$#" -ne 3 ]; then [ ! -d "$task" ] && continue; exit 1; fi
 case "$2:$3" in (*[!0-9:]*|:*|*:) exit 1;; esac
 if [ "$2" = '`,{field:"guardian_pid"},`' ]; then printf '%s %s %s\\n' "$child" "$3" "$1"; fi
done`]}],prefs_empty:[{key:"child_before",parts:[`count=0
for file in /proc/[0-9]*/stat; do
 count=$((count+1)); [ "$count" -le 4096 ] || exit 1
 task=\${file%/stat}; child=\${task#/proc/}
 row=$(sed 's/.*) //' "$file" 2>/dev/null | awk '{print $1, $2, $20}')
 set -- $row
 if [ "$#" -ne 3 ]; then [ ! -d "$task" ] && continue; exit 1; fi
 case "$2:$3" in (*[!0-9:]*|:*|*:) exit 1;; esac
 if [ "$2" = '`,{field:"guardian_pid"},`' ]; then printf '%s %s %s\\n' "$child" "$3" "$1"; fi
done`]},{key:"guardian_process_before",parts:["cat /proc/",{field:"guardian_pid"},`/stat
stat -c '%u' /proc/`,{field:"guardian_pid"},`
readlink /proc/`,{field:"guardian_pid"},"/exe"]},{key:"guardian_file",parts:["test ! -L /tmp/qingping-initial-guardian-",{field:"guardian_job_id"},`/program
test -f /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},`/program
stat -c '%s %h' /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},`/program
sha256sum /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},"/program"]},{key:"guardian_image",parts:["stat -L -c '%d %i %s %a %u %h' /proc/",{field:"guardian_pid"},`/exe
stat -c '%d %i %s %a %u %h' /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},`/program
sha256sum /proc/`,{field:"guardian_pid"},"/exe"]},{key:"guardian_process_after",parts:["cat /proc/",{field:"guardian_pid"},`/stat
stat -c '%u' /proc/`,{field:"guardian_pid"},`
readlink /proc/`,{field:"guardian_pid"},"/exe"]},{key:"child_process_before",parts:["cat /proc/",{field:"child_pid"},`/stat
stat -c '%u' /proc/`,{field:"child_pid"},`
readlink /proc/`,{field:"child_pid"},"/exe"]},{key:"child_file",parts:[`test ! -L /data/.esphome-cgs1/program
test -f /data/.esphome-cgs1/program
stat -c '%s %h' /data/.esphome-cgs1/program
sha256sum /data/.esphome-cgs1/program`]},{key:"child_image",parts:["stat -L -c '%d %i %s %a %u %h' /proc/",{field:"child_pid"},`/exe
stat -c '%d %i %s %a %u %h' /data/.esphome-cgs1/program
sha256sum /proc/`,{field:"child_pid"},"/exe"]},{key:"child_process_after",parts:["cat /proc/",{field:"child_pid"},`/stat
stat -c '%u' /proc/`,{field:"child_pid"},`
readlink /proc/`,{field:"child_pid"},"/exe"]},{key:"endpoint",parts:[`sockets=' '
count=0
for file in /proc/`,{field:"child_pid"},`/fd/*; do
 count=$((count+1)); [ "$count" -le 4096 ] || exit 1
 link=$(readlink "$file")
 case "$link" in (socket:\\[*\\]) inode=\${link#socket:}; inode=\${inode#\\[}; inode=\${inode%\\]}; case "$inode" in (''|*[!0-9]*) exit 1;; esac; sockets="$sockets$inode ";; esac
done
for table in /proc/net/tcp /proc/net/tcp6; do
 test -r "$table"
 awk -v owned="$sockets" '
 NR==1 { if ($2!="local_address") bad=1; next }
 { count=split($2, local, ":"); port=toupper(local[2]); address=toupper(local[1]); state=toupper($4);
   if ($1 !~ /^[0-9]+:$/ || NF<10 || count!=2 || (length(address)!=8 && length(address)!=32) ||
       address ~ /[^0-9A-F]/ || length(port)!=4 || port ~ /[^0-9A-F]/ ||
       length(state)!=2 || state ~ /[^0-9A-F]/ || $10 !~ /^[0-9]+$/) bad=1;
   if (port=="17A5" || port=="0CA0") {
     if ($10 !~ /^[1-9][0-9]*$/ || index(owned, " " $10 " ")==0) bad=1;
     if (state=="0A") print FILENAME, port;
   }
 }
 END { if (!NR || bad) exit 1 }
 ' "$table"
done`]},{key:"process_scan",parts:[`count=0
for link in /proc/[0-9]*/exe; do
    count=$((count+1))
    [ "$count" -le 4096 ] || exit 1
    pid=\${link#/proc/}; pid=\${pid%/exe}
    case "$pid" in (''|*[!0-9]*) exit 1;; esac
    if executable=$(readlink "$link" 2>/dev/null); then
        :
    else
        # Kernel threads and exited tasks legitimately have no executable.
        # An unreadable live userspace exe is NOT evidence of its absence.
        [ -d "/proc/$pid" ] || continue
        metadata=$(sed 's/.*) //' "/proc/$pid/stat" 2>/dev/null | awk '{print $1, $7}')
        set -- $metadata
        if [ "$#" -ne 2 ]; then
            [ ! -d "/proc/$pid" ] && continue
            exit 1
        fi
        case "$2" in (''|*[!0-9]*) exit 1;; esac
        case "$1" in (Z|X|x) continue;; esac
        [ "$(($2 & 2097152))" -ne 0 ] || exit 1
        continue
    fi
    case "$executable" in
        (/data/.esphome-cgs1/*|/tmp/qingping-full-*/*|/tmp/qingping-initial-*/*)
case "$pid:$executable" in
(`,{field:"guardian_pid"},":/tmp/qingping-initial-guardian-",{field:"guardian_job_id"},"/program|",{field:"child_pid"},`:/data/.esphome-cgs1/program) :;;
(*) exit 1;;
esac;;
        (/data/bin/SnowApp) printf '%s\\n' "$pid";;
    esac
done`]},{key:"stock_process",parts:["cat /proc/",{field:"stock_pid"},`/stat
stat -c '%u' /proc/`,{field:"stock_pid"},`
readlink /proc/`,{field:"stock_pid"},"/exe"]},{key:"watchdog_process",parts:["cat /proc/",{field:"watchdog_pid"},`/stat
stat -c '%u' /proc/`,{field:"watchdog_pid"},`
readlink /proc/`,{field:"watchdog_pid"},"/exe"]},{key:"watchdog_arguments",parts:["arguments=$(tr '\\000' '\\n' < /proc/",{field:"watchdog_pid"},`/cmdline)
[ "$arguments" = "$(printf '/bin/sh\\n/data/bin/watchdog.sh')" ]`]},{key:"stock_maps_0",parts:["test -r /proc/",{field:"stock_pid"},`/maps
if grep -F -q /data/.esphome-cgs1/ /proc/`,{field:"stock_pid"},'/maps; then exit 1; else result=$?; [ "$result" -eq 1 ]; fi']},{key:"stock_maps_1",parts:["test -r /proc/",{field:"stock_pid"},`/maps
if grep -F -q /tmp/qingping-full- /proc/`,{field:"stock_pid"},'/maps; then exit 1; else result=$?; [ "$result" -eq 1 ]; fi']},{key:"stock_maps_2",parts:["test -r /proc/",{field:"stock_pid"},`/maps
if grep -F -q /tmp/qingping-initial- /proc/`,{field:"stock_pid"},'/maps; then exit 1; else result=$?; [ "$result" -eq 1 ]; fi']},{key:"vendor_0",parts:[`test ! -L /data/bin/SnowApp
test -f /data/bin/SnowApp
stat -c '%s %h' /data/bin/SnowApp
sha256sum /data/bin/SnowApp`]},{key:"vendor_1",parts:[`test ! -L /data/bin/watchdog.sh
test -f /data/bin/watchdog.sh
stat -c '%s %h' /data/bin/watchdog.sh
sha256sum /data/bin/watchdog.sh`]},{key:"vendor_2",parts:[`test ! -L /data/etc/init.d/start.sh
test -f /data/etc/init.d/start.sh
stat -c '%s %h' /data/etc/init.d/start.sh
sha256sum /data/etc/init.d/start.sh`]},{key:"vendor_3",parts:[`test ! -L /etc/init.d/S12_launcher_init
test -f /etc/init.d/S12_launcher_init
stat -c '%s %h' /etc/init.d/S12_launcher_init
sha256sum /etc/init.d/S12_launcher_init`]},{key:"vendor_4",parts:[`test ! -L /etc/init.d/S50_px3se_init
test -f /etc/init.d/S50_px3se_init
stat -c '%s %h' /etc/init.d/S50_px3se_init
sha256sum /etc/init.d/S50_px3se_init`]},{key:"vendor_5",parts:[`test ! -L /lib/ld-2.23.so
test -f /lib/ld-2.23.so
stat -c '%s %h' /lib/ld-2.23.so
sha256sum /lib/ld-2.23.so`]},{key:"vendor_6",parts:[`test ! -L /lib/libc-2.23.so
test -f /lib/libc-2.23.so
stat -c '%s %h' /lib/libc-2.23.so
sha256sum /lib/libc-2.23.so`]},{key:"vendor_7",parts:[`test ! -L /usr/lib/libstdc++.so.6.0.20
test -f /usr/lib/libstdc++.so.6.0.20
stat -c '%s %h' /usr/lib/libstdc++.so.6.0.20
sha256sum /usr/lib/libstdc++.so.6.0.20`]},{key:"vendor_8",parts:[`test ! -L /usr/lib/libQt5Core.so.5.9.4
test -f /usr/lib/libQt5Core.so.5.9.4
stat -c '%s %h' /usr/lib/libQt5Core.so.5.9.4
sha256sum /usr/lib/libQt5Core.so.5.9.4`]},{key:"staged_0",parts:[`test ! -L /data/.esphome-cgs1/program
test -f /data/.esphome-cgs1/program
stat -c '%s %h' /data/.esphome-cgs1/program
sha256sum /data/.esphome-cgs1/program`]},{key:"staged_1",parts:[`test ! -L /data/.esphome-cgs1/pm_qt_bridge.so
test -f /data/.esphome-cgs1/pm_qt_bridge.so
stat -c '%s %h' /data/.esphome-cgs1/pm_qt_bridge.so
sha256sum /data/.esphome-cgs1/pm_qt_bridge.so`]},{key:"staged_2",parts:[`test ! -L /data/.esphome-cgs1/launch.sh
test -f /data/.esphome-cgs1/launch.sh
stat -c '%s %h' /data/.esphome-cgs1/launch.sh
sha256sum /data/.esphome-cgs1/launch.sh`]},{key:"staged_3",parts:[`test ! -L /data/.esphome-cgs1/SnowApp-with-PM
test -f /data/.esphome-cgs1/SnowApp-with-PM
stat -c '%s %h' /data/.esphome-cgs1/SnowApp-with-PM
sha256sum /data/.esphome-cgs1/SnowApp-with-PM`]},{key:"staged_4",parts:[`test ! -L /data/.esphome-cgs1/startup-hook.sh
test -f /data/.esphome-cgs1/startup-hook.sh
stat -c '%s %h' /data/.esphome-cgs1/startup-hook.sh
sha256sum /data/.esphome-cgs1/startup-hook.sh`]},{key:"staged_5",parts:[`test ! -L /data/.esphome-cgs1/stock-start.sh.original
test -f /data/.esphome-cgs1/stock-start.sh.original
stat -c '%s %h' /data/.esphome-cgs1/stock-start.sh.original
sha256sum /data/.esphome-cgs1/stock-start.sh.original`]},{key:"staged_6",parts:[`test ! -L /data/.esphome-cgs1/stock-watchdog.sh.original
test -f /data/.esphome-cgs1/stock-watchdog.sh.original
stat -c '%s %h' /data/.esphome-cgs1/stock-watchdog.sh.original
sha256sum /data/.esphome-cgs1/stock-watchdog.sh.original`]},{key:"staged_7",parts:[`test ! -L /data/.esphome-cgs1/start.sh.candidate
test -f /data/.esphome-cgs1/start.sh.candidate
stat -c '%s %h' /data/.esphome-cgs1/start.sh.candidate
sha256sum /data/.esphome-cgs1/start.sh.candidate`]},{key:"staged_8",parts:[`test ! -L /data/.esphome-cgs1/watchdog.sh.candidate
test -f /data/.esphome-cgs1/watchdog.sh.candidate
stat -c '%s %h' /data/.esphome-cgs1/watchdog.sh.candidate
sha256sum /data/.esphome-cgs1/watchdog.sh.candidate`]},{key:"root",parts:[`test ! -L /data/.esphome-cgs1
test -d /data/.esphome-cgs1
stat -c '%d %i %a %u' /data/.esphome-cgs1
test ! -L /data/.esphome-cgs1/install.intent
test -f /data/.esphome-cgs1/install.intent
[ "$(stat -c '%s %a %u %h' /data/.esphome-cgs1/install.intent)" = '98 600 0 1' ]
cat /data/.esphome-cgs1/install.intent`]},{key:"parents",parts:[`test ! -L /data/bin
test ! -L /data/etc
test ! -L /data/etc/init.d
stat -c '%d' /data/bin /data/etc/init.d`]},{key:"disabled",parts:[`test ! -L /data/.esphome-cgs1/disabled
test -f /data/.esphome-cgs1/disabled
stat -c '%s %a %u %h' /data/.esphome-cgs1/disabled
sha256sum /data/.esphome-cgs1/disabled`]},{key:"pm-helper.disabled",parts:[`test ! -L /data/.esphome-cgs1/pm-helper.disabled
test -f /data/.esphome-cgs1/pm-helper.disabled
stat -c '%s %a %u %h' /data/.esphome-cgs1/pm-helper.disabled
sha256sum /data/.esphome-cgs1/pm-helper.disabled`]},{key:"absent_stores",parts:[`# CGS1_INITIAL_ABSENT_STORES
entries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
    case "$entry" in (full-releases|wifi|prefs|full-state) exit 1;; esac
done
entries=$(LC_ALL=C ls -A1 /tmp)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
    case "$entry" in (qingping-cgs1-esphome.lock) exit 1;; esac
done`]},{key:"memory",parts:[`# CGS1_INITIAL_MEMORY
awk '$1 == "MemTotal:" || $1 == "MemFree:" { print }' /proc/meminfo`]},{key:"intent_file",parts:[`test ! -L /data/.esphome-cgs1/initial-trial.intent
test -f /data/.esphome-cgs1/initial-trial.intent
stat -c '%s %h' /data/.esphome-cgs1/initial-trial.intent
sha256sum /data/.esphome-cgs1/initial-trial.intent`]},{key:"intent_mode",parts:[`observed_value=$(stat -c '%a %u' /data/.esphome-cgs1/initial-trial.intent)
[ "$observed_value" = '600 0' ]
`]},{key:"nand_entries",parts:["LC_ALL=C ls -A1 /data/.esphome-cgs1"]},{key:"commit_marker",parts:[`# CGS1_INITIAL_COMMIT_MARKER
test ! -L /data/.esphome-cgs1/.commit-disabled.lock
test -d /data/.esphome-cgs1/.commit-disabled.lock
observed_value=$(stat -c '%a %u' /data/.esphome-cgs1/.commit-disabled.lock)
[ "$observed_value" = '700 0' ]
test ! -L /data/.esphome-cgs1/.commit-disabled.lock/owner
test -f /data/.esphome-cgs1/.commit-disabled.lock/owner
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/.commit-disabled.lock/owner)
[ "$observed_value" = '82 600 0 1' ]
cat /data/.esphome-cgs1/.commit-disabled.lock/owner`]},{key:"ram_identity",parts:[`test ! -L /tmp
test ! -L /tmp/qingping-initial-trial-`,{field:"ram_job_id"},`
test -d /tmp/qingping-initial-trial-`,{field:"ram_job_id"},`
stat -c '%d %i %a %u' /tmp/qingping-initial-trial-`,{field:"ram_job_id"},`
stat -f -c '%t' /tmp/qingping-initial-trial-`,{field:"ram_job_id"}]},{key:"ram_entries",parts:["LC_ALL=C ls -A1 /tmp/qingping-initial-trial-",{field:"ram_job_id"}]},{key:"prefs_guard",parts:["test ! -L /tmp/qingping-initial-trial-",{field:"ram_job_id"},`/prefs
test -d /tmp/qingping-initial-trial-`,{field:"ram_job_id"},`/prefs
observed_value=$(stat -c '%a %u %d' /tmp/qingping-initial-trial-`,{field:"ram_job_id"},`/prefs)
[ "$observed_value" = '700 0 `,{field:"ram_device"},`' ]
`]},{key:"prefs_entries",parts:["LC_ALL=C ls -A1 /tmp/qingping-initial-trial-",{field:"ram_job_id"},"/prefs"]},{key:"identity_uid",parts:["id -u"]},{key:"identity_wlan",parts:["cat /sys/class/net/wlan0/address"]},{key:"identity_version",parts:["cat /data/etc/os-release"]},{key:"identity_architecture",parts:["uname -m"]},{key:"identity_co2",parts:[`awk '
BEGIN { section=0; count=0 }
/^[ \\t]*\\[/ { section=($0 ~ /^[ \\t]*\\[sensors\\][ \\t]*\\r?$/) }
section && /^[ \\t]*co2_type[ \\t]*=/ {
    value=$0; sub(/^[^=]*=[ \\t]*/, "", value); sub(/[ \\t\\r]*$/, "", value)
    print value; count++
}
END { if (count != 1) exit 1 }
' /data/etc/setting.ini`]},{key:"identity_boot",parts:["cat /proc/sys/kernel/random/boot_id"]},{key:"child_after",parts:[`count=0
for file in /proc/[0-9]*/stat; do
 count=$((count+1)); [ "$count" -le 4096 ] || exit 1
 task=\${file%/stat}; child=\${task#/proc/}
 row=$(sed 's/.*) //' "$file" 2>/dev/null | awk '{print $1, $2, $20}')
 set -- $row
 if [ "$#" -ne 3 ]; then [ ! -d "$task" ] && continue; exit 1; fi
 case "$2:$3" in (*[!0-9:]*|:*|*:) exit 1;; esac
 if [ "$2" = '`,{field:"guardian_pid"},`' ]; then printf '%s %s %s\\n' "$child" "$3" "$1"; fi
done`]}],prefs_file:[{key:"child_before",parts:[`count=0
for file in /proc/[0-9]*/stat; do
 count=$((count+1)); [ "$count" -le 4096 ] || exit 1
 task=\${file%/stat}; child=\${task#/proc/}
 row=$(sed 's/.*) //' "$file" 2>/dev/null | awk '{print $1, $2, $20}')
 set -- $row
 if [ "$#" -ne 3 ]; then [ ! -d "$task" ] && continue; exit 1; fi
 case "$2:$3" in (*[!0-9:]*|:*|*:) exit 1;; esac
 if [ "$2" = '`,{field:"guardian_pid"},`' ]; then printf '%s %s %s\\n' "$child" "$3" "$1"; fi
done`]},{key:"guardian_process_before",parts:["cat /proc/",{field:"guardian_pid"},`/stat
stat -c '%u' /proc/`,{field:"guardian_pid"},`
readlink /proc/`,{field:"guardian_pid"},"/exe"]},{key:"guardian_file",parts:["test ! -L /tmp/qingping-initial-guardian-",{field:"guardian_job_id"},`/program
test -f /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},`/program
stat -c '%s %h' /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},`/program
sha256sum /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},"/program"]},{key:"guardian_image",parts:["stat -L -c '%d %i %s %a %u %h' /proc/",{field:"guardian_pid"},`/exe
stat -c '%d %i %s %a %u %h' /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},`/program
sha256sum /proc/`,{field:"guardian_pid"},"/exe"]},{key:"guardian_process_after",parts:["cat /proc/",{field:"guardian_pid"},`/stat
stat -c '%u' /proc/`,{field:"guardian_pid"},`
readlink /proc/`,{field:"guardian_pid"},"/exe"]},{key:"child_process_before",parts:["cat /proc/",{field:"child_pid"},`/stat
stat -c '%u' /proc/`,{field:"child_pid"},`
readlink /proc/`,{field:"child_pid"},"/exe"]},{key:"child_file",parts:[`test ! -L /data/.esphome-cgs1/program
test -f /data/.esphome-cgs1/program
stat -c '%s %h' /data/.esphome-cgs1/program
sha256sum /data/.esphome-cgs1/program`]},{key:"child_image",parts:["stat -L -c '%d %i %s %a %u %h' /proc/",{field:"child_pid"},`/exe
stat -c '%d %i %s %a %u %h' /data/.esphome-cgs1/program
sha256sum /proc/`,{field:"child_pid"},"/exe"]},{key:"child_process_after",parts:["cat /proc/",{field:"child_pid"},`/stat
stat -c '%u' /proc/`,{field:"child_pid"},`
readlink /proc/`,{field:"child_pid"},"/exe"]},{key:"endpoint",parts:[`sockets=' '
count=0
for file in /proc/`,{field:"child_pid"},`/fd/*; do
 count=$((count+1)); [ "$count" -le 4096 ] || exit 1
 link=$(readlink "$file")
 case "$link" in (socket:\\[*\\]) inode=\${link#socket:}; inode=\${inode#\\[}; inode=\${inode%\\]}; case "$inode" in (''|*[!0-9]*) exit 1;; esac; sockets="$sockets$inode ";; esac
done
for table in /proc/net/tcp /proc/net/tcp6; do
 test -r "$table"
 awk -v owned="$sockets" '
 NR==1 { if ($2!="local_address") bad=1; next }
 { count=split($2, local, ":"); port=toupper(local[2]); address=toupper(local[1]); state=toupper($4);
   if ($1 !~ /^[0-9]+:$/ || NF<10 || count!=2 || (length(address)!=8 && length(address)!=32) ||
       address ~ /[^0-9A-F]/ || length(port)!=4 || port ~ /[^0-9A-F]/ ||
       length(state)!=2 || state ~ /[^0-9A-F]/ || $10 !~ /^[0-9]+$/) bad=1;
   if (port=="17A5" || port=="0CA0") {
     if ($10 !~ /^[1-9][0-9]*$/ || index(owned, " " $10 " ")==0) bad=1;
     if (state=="0A") print FILENAME, port;
   }
 }
 END { if (!NR || bad) exit 1 }
 ' "$table"
done`]},{key:"process_scan",parts:[`count=0
for link in /proc/[0-9]*/exe; do
    count=$((count+1))
    [ "$count" -le 4096 ] || exit 1
    pid=\${link#/proc/}; pid=\${pid%/exe}
    case "$pid" in (''|*[!0-9]*) exit 1;; esac
    if executable=$(readlink "$link" 2>/dev/null); then
        :
    else
        # Kernel threads and exited tasks legitimately have no executable.
        # An unreadable live userspace exe is NOT evidence of its absence.
        [ -d "/proc/$pid" ] || continue
        metadata=$(sed 's/.*) //' "/proc/$pid/stat" 2>/dev/null | awk '{print $1, $7}')
        set -- $metadata
        if [ "$#" -ne 2 ]; then
            [ ! -d "/proc/$pid" ] && continue
            exit 1
        fi
        case "$2" in (''|*[!0-9]*) exit 1;; esac
        case "$1" in (Z|X|x) continue;; esac
        [ "$(($2 & 2097152))" -ne 0 ] || exit 1
        continue
    fi
    case "$executable" in
        (/data/.esphome-cgs1/*|/tmp/qingping-full-*/*|/tmp/qingping-initial-*/*)
case "$pid:$executable" in
(`,{field:"guardian_pid"},":/tmp/qingping-initial-guardian-",{field:"guardian_job_id"},"/program|",{field:"child_pid"},`:/data/.esphome-cgs1/program) :;;
(*) exit 1;;
esac;;
        (/data/bin/SnowApp) printf '%s\\n' "$pid";;
    esac
done`]},{key:"stock_process",parts:["cat /proc/",{field:"stock_pid"},`/stat
stat -c '%u' /proc/`,{field:"stock_pid"},`
readlink /proc/`,{field:"stock_pid"},"/exe"]},{key:"watchdog_process",parts:["cat /proc/",{field:"watchdog_pid"},`/stat
stat -c '%u' /proc/`,{field:"watchdog_pid"},`
readlink /proc/`,{field:"watchdog_pid"},"/exe"]},{key:"watchdog_arguments",parts:["arguments=$(tr '\\000' '\\n' < /proc/",{field:"watchdog_pid"},`/cmdline)
[ "$arguments" = "$(printf '/bin/sh\\n/data/bin/watchdog.sh')" ]`]},{key:"stock_maps_0",parts:["test -r /proc/",{field:"stock_pid"},`/maps
if grep -F -q /data/.esphome-cgs1/ /proc/`,{field:"stock_pid"},'/maps; then exit 1; else result=$?; [ "$result" -eq 1 ]; fi']},{key:"stock_maps_1",parts:["test -r /proc/",{field:"stock_pid"},`/maps
if grep -F -q /tmp/qingping-full- /proc/`,{field:"stock_pid"},'/maps; then exit 1; else result=$?; [ "$result" -eq 1 ]; fi']},{key:"stock_maps_2",parts:["test -r /proc/",{field:"stock_pid"},`/maps
if grep -F -q /tmp/qingping-initial- /proc/`,{field:"stock_pid"},'/maps; then exit 1; else result=$?; [ "$result" -eq 1 ]; fi']},{key:"vendor_0",parts:[`test ! -L /data/bin/SnowApp
test -f /data/bin/SnowApp
stat -c '%s %h' /data/bin/SnowApp
sha256sum /data/bin/SnowApp`]},{key:"vendor_1",parts:[`test ! -L /data/bin/watchdog.sh
test -f /data/bin/watchdog.sh
stat -c '%s %h' /data/bin/watchdog.sh
sha256sum /data/bin/watchdog.sh`]},{key:"vendor_2",parts:[`test ! -L /data/etc/init.d/start.sh
test -f /data/etc/init.d/start.sh
stat -c '%s %h' /data/etc/init.d/start.sh
sha256sum /data/etc/init.d/start.sh`]},{key:"vendor_3",parts:[`test ! -L /etc/init.d/S12_launcher_init
test -f /etc/init.d/S12_launcher_init
stat -c '%s %h' /etc/init.d/S12_launcher_init
sha256sum /etc/init.d/S12_launcher_init`]},{key:"vendor_4",parts:[`test ! -L /etc/init.d/S50_px3se_init
test -f /etc/init.d/S50_px3se_init
stat -c '%s %h' /etc/init.d/S50_px3se_init
sha256sum /etc/init.d/S50_px3se_init`]},{key:"vendor_5",parts:[`test ! -L /lib/ld-2.23.so
test -f /lib/ld-2.23.so
stat -c '%s %h' /lib/ld-2.23.so
sha256sum /lib/ld-2.23.so`]},{key:"vendor_6",parts:[`test ! -L /lib/libc-2.23.so
test -f /lib/libc-2.23.so
stat -c '%s %h' /lib/libc-2.23.so
sha256sum /lib/libc-2.23.so`]},{key:"vendor_7",parts:[`test ! -L /usr/lib/libstdc++.so.6.0.20
test -f /usr/lib/libstdc++.so.6.0.20
stat -c '%s %h' /usr/lib/libstdc++.so.6.0.20
sha256sum /usr/lib/libstdc++.so.6.0.20`]},{key:"vendor_8",parts:[`test ! -L /usr/lib/libQt5Core.so.5.9.4
test -f /usr/lib/libQt5Core.so.5.9.4
stat -c '%s %h' /usr/lib/libQt5Core.so.5.9.4
sha256sum /usr/lib/libQt5Core.so.5.9.4`]},{key:"staged_0",parts:[`test ! -L /data/.esphome-cgs1/program
test -f /data/.esphome-cgs1/program
stat -c '%s %h' /data/.esphome-cgs1/program
sha256sum /data/.esphome-cgs1/program`]},{key:"staged_1",parts:[`test ! -L /data/.esphome-cgs1/pm_qt_bridge.so
test -f /data/.esphome-cgs1/pm_qt_bridge.so
stat -c '%s %h' /data/.esphome-cgs1/pm_qt_bridge.so
sha256sum /data/.esphome-cgs1/pm_qt_bridge.so`]},{key:"staged_2",parts:[`test ! -L /data/.esphome-cgs1/launch.sh
test -f /data/.esphome-cgs1/launch.sh
stat -c '%s %h' /data/.esphome-cgs1/launch.sh
sha256sum /data/.esphome-cgs1/launch.sh`]},{key:"staged_3",parts:[`test ! -L /data/.esphome-cgs1/SnowApp-with-PM
test -f /data/.esphome-cgs1/SnowApp-with-PM
stat -c '%s %h' /data/.esphome-cgs1/SnowApp-with-PM
sha256sum /data/.esphome-cgs1/SnowApp-with-PM`]},{key:"staged_4",parts:[`test ! -L /data/.esphome-cgs1/startup-hook.sh
test -f /data/.esphome-cgs1/startup-hook.sh
stat -c '%s %h' /data/.esphome-cgs1/startup-hook.sh
sha256sum /data/.esphome-cgs1/startup-hook.sh`]},{key:"staged_5",parts:[`test ! -L /data/.esphome-cgs1/stock-start.sh.original
test -f /data/.esphome-cgs1/stock-start.sh.original
stat -c '%s %h' /data/.esphome-cgs1/stock-start.sh.original
sha256sum /data/.esphome-cgs1/stock-start.sh.original`]},{key:"staged_6",parts:[`test ! -L /data/.esphome-cgs1/stock-watchdog.sh.original
test -f /data/.esphome-cgs1/stock-watchdog.sh.original
stat -c '%s %h' /data/.esphome-cgs1/stock-watchdog.sh.original
sha256sum /data/.esphome-cgs1/stock-watchdog.sh.original`]},{key:"staged_7",parts:[`test ! -L /data/.esphome-cgs1/start.sh.candidate
test -f /data/.esphome-cgs1/start.sh.candidate
stat -c '%s %h' /data/.esphome-cgs1/start.sh.candidate
sha256sum /data/.esphome-cgs1/start.sh.candidate`]},{key:"staged_8",parts:[`test ! -L /data/.esphome-cgs1/watchdog.sh.candidate
test -f /data/.esphome-cgs1/watchdog.sh.candidate
stat -c '%s %h' /data/.esphome-cgs1/watchdog.sh.candidate
sha256sum /data/.esphome-cgs1/watchdog.sh.candidate`]},{key:"root",parts:[`test ! -L /data/.esphome-cgs1
test -d /data/.esphome-cgs1
stat -c '%d %i %a %u' /data/.esphome-cgs1
test ! -L /data/.esphome-cgs1/install.intent
test -f /data/.esphome-cgs1/install.intent
[ "$(stat -c '%s %a %u %h' /data/.esphome-cgs1/install.intent)" = '98 600 0 1' ]
cat /data/.esphome-cgs1/install.intent`]},{key:"parents",parts:[`test ! -L /data/bin
test ! -L /data/etc
test ! -L /data/etc/init.d
stat -c '%d' /data/bin /data/etc/init.d`]},{key:"disabled",parts:[`test ! -L /data/.esphome-cgs1/disabled
test -f /data/.esphome-cgs1/disabled
stat -c '%s %a %u %h' /data/.esphome-cgs1/disabled
sha256sum /data/.esphome-cgs1/disabled`]},{key:"pm-helper.disabled",parts:[`test ! -L /data/.esphome-cgs1/pm-helper.disabled
test -f /data/.esphome-cgs1/pm-helper.disabled
stat -c '%s %a %u %h' /data/.esphome-cgs1/pm-helper.disabled
sha256sum /data/.esphome-cgs1/pm-helper.disabled`]},{key:"absent_stores",parts:[`# CGS1_INITIAL_ABSENT_STORES
entries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
    case "$entry" in (full-releases|wifi|prefs|full-state) exit 1;; esac
done
entries=$(LC_ALL=C ls -A1 /tmp)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
    case "$entry" in (qingping-cgs1-esphome.lock) exit 1;; esac
done`]},{key:"memory",parts:[`# CGS1_INITIAL_MEMORY
awk '$1 == "MemTotal:" || $1 == "MemFree:" { print }' /proc/meminfo`]},{key:"intent_file",parts:[`test ! -L /data/.esphome-cgs1/initial-trial.intent
test -f /data/.esphome-cgs1/initial-trial.intent
stat -c '%s %h' /data/.esphome-cgs1/initial-trial.intent
sha256sum /data/.esphome-cgs1/initial-trial.intent`]},{key:"intent_mode",parts:[`observed_value=$(stat -c '%a %u' /data/.esphome-cgs1/initial-trial.intent)
[ "$observed_value" = '600 0' ]
`]},{key:"nand_entries",parts:["LC_ALL=C ls -A1 /data/.esphome-cgs1"]},{key:"commit_marker",parts:[`# CGS1_INITIAL_COMMIT_MARKER
test ! -L /data/.esphome-cgs1/.commit-disabled.lock
test -d /data/.esphome-cgs1/.commit-disabled.lock
observed_value=$(stat -c '%a %u' /data/.esphome-cgs1/.commit-disabled.lock)
[ "$observed_value" = '700 0' ]
test ! -L /data/.esphome-cgs1/.commit-disabled.lock/owner
test -f /data/.esphome-cgs1/.commit-disabled.lock/owner
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/.commit-disabled.lock/owner)
[ "$observed_value" = '82 600 0 1' ]
cat /data/.esphome-cgs1/.commit-disabled.lock/owner`]},{key:"ram_identity",parts:[`test ! -L /tmp
test ! -L /tmp/qingping-initial-trial-`,{field:"ram_job_id"},`
test -d /tmp/qingping-initial-trial-`,{field:"ram_job_id"},`
stat -c '%d %i %a %u' /tmp/qingping-initial-trial-`,{field:"ram_job_id"},`
stat -f -c '%t' /tmp/qingping-initial-trial-`,{field:"ram_job_id"}]},{key:"ram_entries",parts:["LC_ALL=C ls -A1 /tmp/qingping-initial-trial-",{field:"ram_job_id"}]},{key:"prefs_guard",parts:["test ! -L /tmp/qingping-initial-trial-",{field:"ram_job_id"},`/prefs
test -d /tmp/qingping-initial-trial-`,{field:"ram_job_id"},`/prefs
observed_value=$(stat -c '%a %u %d' /tmp/qingping-initial-trial-`,{field:"ram_job_id"},`/prefs)
[ "$observed_value" = '700 0 `,{field:"ram_device"},`' ]
`]},{key:"prefs_entries",parts:["LC_ALL=C ls -A1 /tmp/qingping-initial-trial-",{field:"ram_job_id"},"/prefs"]},{key:"prefs_file",parts:["test ! -L /tmp/qingping-initial-trial-",{field:"ram_job_id"},"/prefs/",{field:"node_name"},`.prefs
test -f /tmp/qingping-initial-trial-`,{field:"ram_job_id"},"/prefs/",{field:"node_name"},`.prefs
stat -c '%s %a %u %h %d' /tmp/qingping-initial-trial-`,{field:"ram_job_id"},"/prefs/",{field:"node_name"},".prefs"]},{key:"identity_uid",parts:["id -u"]},{key:"identity_wlan",parts:["cat /sys/class/net/wlan0/address"]},{key:"identity_version",parts:["cat /data/etc/os-release"]},{key:"identity_architecture",parts:["uname -m"]},{key:"identity_co2",parts:[`awk '
BEGIN { section=0; count=0 }
/^[ \\t]*\\[/ { section=($0 ~ /^[ \\t]*\\[sensors\\][ \\t]*\\r?$/) }
section && /^[ \\t]*co2_type[ \\t]*=/ {
    value=$0; sub(/^[^=]*=[ \\t]*/, "", value); sub(/[ \\t\\r]*$/, "", value)
    print value; count++
}
END { if (count != 1) exit 1 }
' /data/etc/setting.ini`]},{key:"identity_boot",parts:["cat /proc/sys/kernel/random/boot_id"]},{key:"child_after",parts:[`count=0
for file in /proc/[0-9]*/stat; do
 count=$((count+1)); [ "$count" -le 4096 ] || exit 1
 task=\${file%/stat}; child=\${task#/proc/}
 row=$(sed 's/.*) //' "$file" 2>/dev/null | awk '{print $1, $2, $20}')
 set -- $row
 if [ "$#" -ne 3 ]; then [ ! -d "$task" ] && continue; exit 1; fi
 case "$2:$3" in (*[!0-9:]*|:*|*:) exit 1;; esac
 if [ "$2" = '`,{field:"guardian_pid"},`' ]; then printf '%s %s %s\\n' "$child" "$3" "$1"; fi
done`]}]},return_branches:{empty:[{key:"process_scan",parts:[`count=0
for link in /proc/[0-9]*/exe; do
    count=$((count+1))
    [ "$count" -le 4096 ] || exit 1
    pid=\${link#/proc/}; pid=\${pid%/exe}
    case "$pid" in (''|*[!0-9]*) exit 1;; esac
    if executable=$(readlink "$link" 2>/dev/null); then
        :
    else
        # Kernel threads and exited tasks legitimately have no executable.
        # An unreadable live userspace exe is NOT evidence of its absence.
        [ -d "/proc/$pid" ] || continue
        metadata=$(sed 's/.*) //' "/proc/$pid/stat" 2>/dev/null | awk '{print $1, $7}')
        set -- $metadata
        if [ "$#" -ne 2 ]; then
            [ ! -d "/proc/$pid" ] && continue
            exit 1
        fi
        case "$2" in (''|*[!0-9]*) exit 1;; esac
        case "$1" in (Z|X|x) continue;; esac
        [ "$(($2 & 2097152))" -ne 0 ] || exit 1
        continue
    fi
    case "$executable" in
        (/data/.esphome-cgs1/*|/tmp/qingping-full-*/*|/tmp/qingping-initial-*/*) exit 1;;
        (/data/bin/SnowApp) printf '%s\\n' "$pid";;
    esac
done`]},{key:"stock_process",parts:["cat /proc/",{field:"stock_pid"},`/stat
stat -c '%u' /proc/`,{field:"stock_pid"},`
readlink /proc/`,{field:"stock_pid"},"/exe"]},{key:"watchdog_process",parts:["cat /proc/",{field:"watchdog_pid"},`/stat
stat -c '%u' /proc/`,{field:"watchdog_pid"},`
readlink /proc/`,{field:"watchdog_pid"},"/exe"]},{key:"watchdog_arguments",parts:["arguments=$(tr '\\000' '\\n' < /proc/",{field:"watchdog_pid"},`/cmdline)
[ "$arguments" = "$(printf '/bin/sh\\n/data/bin/watchdog.sh')" ]`]},{key:"stock_maps_0",parts:["test -r /proc/",{field:"stock_pid"},`/maps
if grep -F -q /data/.esphome-cgs1/ /proc/`,{field:"stock_pid"},'/maps; then exit 1; else result=$?; [ "$result" -eq 1 ]; fi']},{key:"stock_maps_1",parts:["test -r /proc/",{field:"stock_pid"},`/maps
if grep -F -q /tmp/qingping-full- /proc/`,{field:"stock_pid"},'/maps; then exit 1; else result=$?; [ "$result" -eq 1 ]; fi']},{key:"stock_maps_2",parts:["test -r /proc/",{field:"stock_pid"},`/maps
if grep -F -q /tmp/qingping-initial- /proc/`,{field:"stock_pid"},'/maps; then exit 1; else result=$?; [ "$result" -eq 1 ]; fi']},{key:"vendor_0",parts:[`test ! -L /data/bin/SnowApp
test -f /data/bin/SnowApp
stat -c '%s %h' /data/bin/SnowApp
sha256sum /data/bin/SnowApp`]},{key:"vendor_1",parts:[`test ! -L /data/bin/watchdog.sh
test -f /data/bin/watchdog.sh
stat -c '%s %h' /data/bin/watchdog.sh
sha256sum /data/bin/watchdog.sh`]},{key:"vendor_2",parts:[`test ! -L /data/etc/init.d/start.sh
test -f /data/etc/init.d/start.sh
stat -c '%s %h' /data/etc/init.d/start.sh
sha256sum /data/etc/init.d/start.sh`]},{key:"vendor_3",parts:[`test ! -L /etc/init.d/S12_launcher_init
test -f /etc/init.d/S12_launcher_init
stat -c '%s %h' /etc/init.d/S12_launcher_init
sha256sum /etc/init.d/S12_launcher_init`]},{key:"vendor_4",parts:[`test ! -L /etc/init.d/S50_px3se_init
test -f /etc/init.d/S50_px3se_init
stat -c '%s %h' /etc/init.d/S50_px3se_init
sha256sum /etc/init.d/S50_px3se_init`]},{key:"vendor_5",parts:[`test ! -L /lib/ld-2.23.so
test -f /lib/ld-2.23.so
stat -c '%s %h' /lib/ld-2.23.so
sha256sum /lib/ld-2.23.so`]},{key:"vendor_6",parts:[`test ! -L /lib/libc-2.23.so
test -f /lib/libc-2.23.so
stat -c '%s %h' /lib/libc-2.23.so
sha256sum /lib/libc-2.23.so`]},{key:"vendor_7",parts:[`test ! -L /usr/lib/libstdc++.so.6.0.20
test -f /usr/lib/libstdc++.so.6.0.20
stat -c '%s %h' /usr/lib/libstdc++.so.6.0.20
sha256sum /usr/lib/libstdc++.so.6.0.20`]},{key:"vendor_8",parts:[`test ! -L /usr/lib/libQt5Core.so.5.9.4
test -f /usr/lib/libQt5Core.so.5.9.4
stat -c '%s %h' /usr/lib/libQt5Core.so.5.9.4
sha256sum /usr/lib/libQt5Core.so.5.9.4`]},{key:"staged_0",parts:[`test ! -L /data/.esphome-cgs1/program
test -f /data/.esphome-cgs1/program
stat -c '%s %h' /data/.esphome-cgs1/program
sha256sum /data/.esphome-cgs1/program`]},{key:"staged_1",parts:[`test ! -L /data/.esphome-cgs1/pm_qt_bridge.so
test -f /data/.esphome-cgs1/pm_qt_bridge.so
stat -c '%s %h' /data/.esphome-cgs1/pm_qt_bridge.so
sha256sum /data/.esphome-cgs1/pm_qt_bridge.so`]},{key:"staged_2",parts:[`test ! -L /data/.esphome-cgs1/launch.sh
test -f /data/.esphome-cgs1/launch.sh
stat -c '%s %h' /data/.esphome-cgs1/launch.sh
sha256sum /data/.esphome-cgs1/launch.sh`]},{key:"staged_3",parts:[`test ! -L /data/.esphome-cgs1/SnowApp-with-PM
test -f /data/.esphome-cgs1/SnowApp-with-PM
stat -c '%s %h' /data/.esphome-cgs1/SnowApp-with-PM
sha256sum /data/.esphome-cgs1/SnowApp-with-PM`]},{key:"staged_4",parts:[`test ! -L /data/.esphome-cgs1/startup-hook.sh
test -f /data/.esphome-cgs1/startup-hook.sh
stat -c '%s %h' /data/.esphome-cgs1/startup-hook.sh
sha256sum /data/.esphome-cgs1/startup-hook.sh`]},{key:"staged_5",parts:[`test ! -L /data/.esphome-cgs1/stock-start.sh.original
test -f /data/.esphome-cgs1/stock-start.sh.original
stat -c '%s %h' /data/.esphome-cgs1/stock-start.sh.original
sha256sum /data/.esphome-cgs1/stock-start.sh.original`]},{key:"staged_6",parts:[`test ! -L /data/.esphome-cgs1/stock-watchdog.sh.original
test -f /data/.esphome-cgs1/stock-watchdog.sh.original
stat -c '%s %h' /data/.esphome-cgs1/stock-watchdog.sh.original
sha256sum /data/.esphome-cgs1/stock-watchdog.sh.original`]},{key:"staged_7",parts:[`test ! -L /data/.esphome-cgs1/start.sh.candidate
test -f /data/.esphome-cgs1/start.sh.candidate
stat -c '%s %h' /data/.esphome-cgs1/start.sh.candidate
sha256sum /data/.esphome-cgs1/start.sh.candidate`]},{key:"staged_8",parts:[`test ! -L /data/.esphome-cgs1/watchdog.sh.candidate
test -f /data/.esphome-cgs1/watchdog.sh.candidate
stat -c '%s %h' /data/.esphome-cgs1/watchdog.sh.candidate
sha256sum /data/.esphome-cgs1/watchdog.sh.candidate`]},{key:"root",parts:[`test ! -L /data/.esphome-cgs1
test -d /data/.esphome-cgs1
stat -c '%d %i %a %u' /data/.esphome-cgs1
test ! -L /data/.esphome-cgs1/install.intent
test -f /data/.esphome-cgs1/install.intent
[ "$(stat -c '%s %a %u %h' /data/.esphome-cgs1/install.intent)" = '98 600 0 1' ]
cat /data/.esphome-cgs1/install.intent`]},{key:"parents",parts:[`test ! -L /data/bin
test ! -L /data/etc
test ! -L /data/etc/init.d
stat -c '%d' /data/bin /data/etc/init.d`]},{key:"disabled",parts:[`test ! -L /data/.esphome-cgs1/disabled
test -f /data/.esphome-cgs1/disabled
stat -c '%s %a %u %h' /data/.esphome-cgs1/disabled
sha256sum /data/.esphome-cgs1/disabled`]},{key:"pm-helper.disabled",parts:[`test ! -L /data/.esphome-cgs1/pm-helper.disabled
test -f /data/.esphome-cgs1/pm-helper.disabled
stat -c '%s %a %u %h' /data/.esphome-cgs1/pm-helper.disabled
sha256sum /data/.esphome-cgs1/pm-helper.disabled`]},{key:"absent_stores",parts:[`# CGS1_INITIAL_ABSENT_STORES
entries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
    case "$entry" in (full-releases|wifi|prefs|full-state) exit 1;; esac
done
entries=$(LC_ALL=C ls -A1 /tmp)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
    case "$entry" in (qingping-cgs1-esphome.lock) exit 1;; esac
done`]},{key:"memory",parts:[`# CGS1_INITIAL_MEMORY
awk '$1 == "MemTotal:" || $1 == "MemFree:" { print }' /proc/meminfo`]},{key:"intent_file",parts:[`test ! -L /data/.esphome-cgs1/initial-trial.intent
test -f /data/.esphome-cgs1/initial-trial.intent
stat -c '%s %h' /data/.esphome-cgs1/initial-trial.intent
sha256sum /data/.esphome-cgs1/initial-trial.intent`]},{key:"intent_mode",parts:[`observed_value=$(stat -c '%a %u' /data/.esphome-cgs1/initial-trial.intent)
[ "$observed_value" = '600 0' ]
`]},{key:"nand_entries",parts:["LC_ALL=C ls -A1 /data/.esphome-cgs1"]},{key:"commit_marker",parts:[`# CGS1_INITIAL_COMMIT_MARKER
test ! -L /data/.esphome-cgs1/.commit-disabled.lock
test -d /data/.esphome-cgs1/.commit-disabled.lock
observed_value=$(stat -c '%a %u' /data/.esphome-cgs1/.commit-disabled.lock)
[ "$observed_value" = '700 0' ]
test ! -L /data/.esphome-cgs1/.commit-disabled.lock/owner
test -f /data/.esphome-cgs1/.commit-disabled.lock/owner
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/.commit-disabled.lock/owner)
[ "$observed_value" = '82 600 0 1' ]
cat /data/.esphome-cgs1/.commit-disabled.lock/owner`]},{key:"ram_identity",parts:[`test ! -L /tmp
test ! -L /tmp/qingping-initial-trial-`,{field:"ram_job_id"},`
test -d /tmp/qingping-initial-trial-`,{field:"ram_job_id"},`
stat -c '%d %i %a %u' /tmp/qingping-initial-trial-`,{field:"ram_job_id"},`
stat -f -c '%t' /tmp/qingping-initial-trial-`,{field:"ram_job_id"}]},{key:"ram_entries",parts:["LC_ALL=C ls -A1 /tmp/qingping-initial-trial-",{field:"ram_job_id"}]},{key:"identity_uid",parts:["id -u"]},{key:"identity_wlan",parts:["cat /sys/class/net/wlan0/address"]},{key:"identity_version",parts:["cat /data/etc/os-release"]},{key:"identity_architecture",parts:["uname -m"]},{key:"identity_co2",parts:[`awk '
BEGIN { section=0; count=0 }
/^[ \\t]*\\[/ { section=($0 ~ /^[ \\t]*\\[sensors\\][ \\t]*\\r?$/) }
section && /^[ \\t]*co2_type[ \\t]*=/ {
    value=$0; sub(/^[^=]*=[ \\t]*/, "", value); sub(/[ \\t\\r]*$/, "", value)
    print value; count++
}
END { if (count != 1) exit 1 }
' /data/etc/setting.ini`]},{key:"identity_boot",parts:["cat /proc/sys/kernel/random/boot_id"]}],prefs_empty:[{key:"process_scan",parts:[`count=0
for link in /proc/[0-9]*/exe; do
    count=$((count+1))
    [ "$count" -le 4096 ] || exit 1
    pid=\${link#/proc/}; pid=\${pid%/exe}
    case "$pid" in (''|*[!0-9]*) exit 1;; esac
    if executable=$(readlink "$link" 2>/dev/null); then
        :
    else
        # Kernel threads and exited tasks legitimately have no executable.
        # An unreadable live userspace exe is NOT evidence of its absence.
        [ -d "/proc/$pid" ] || continue
        metadata=$(sed 's/.*) //' "/proc/$pid/stat" 2>/dev/null | awk '{print $1, $7}')
        set -- $metadata
        if [ "$#" -ne 2 ]; then
            [ ! -d "/proc/$pid" ] && continue
            exit 1
        fi
        case "$2" in (''|*[!0-9]*) exit 1;; esac
        case "$1" in (Z|X|x) continue;; esac
        [ "$(($2 & 2097152))" -ne 0 ] || exit 1
        continue
    fi
    case "$executable" in
        (/data/.esphome-cgs1/*|/tmp/qingping-full-*/*|/tmp/qingping-initial-*/*) exit 1;;
        (/data/bin/SnowApp) printf '%s\\n' "$pid";;
    esac
done`]},{key:"stock_process",parts:["cat /proc/",{field:"stock_pid"},`/stat
stat -c '%u' /proc/`,{field:"stock_pid"},`
readlink /proc/`,{field:"stock_pid"},"/exe"]},{key:"watchdog_process",parts:["cat /proc/",{field:"watchdog_pid"},`/stat
stat -c '%u' /proc/`,{field:"watchdog_pid"},`
readlink /proc/`,{field:"watchdog_pid"},"/exe"]},{key:"watchdog_arguments",parts:["arguments=$(tr '\\000' '\\n' < /proc/",{field:"watchdog_pid"},`/cmdline)
[ "$arguments" = "$(printf '/bin/sh\\n/data/bin/watchdog.sh')" ]`]},{key:"stock_maps_0",parts:["test -r /proc/",{field:"stock_pid"},`/maps
if grep -F -q /data/.esphome-cgs1/ /proc/`,{field:"stock_pid"},'/maps; then exit 1; else result=$?; [ "$result" -eq 1 ]; fi']},{key:"stock_maps_1",parts:["test -r /proc/",{field:"stock_pid"},`/maps
if grep -F -q /tmp/qingping-full- /proc/`,{field:"stock_pid"},'/maps; then exit 1; else result=$?; [ "$result" -eq 1 ]; fi']},{key:"stock_maps_2",parts:["test -r /proc/",{field:"stock_pid"},`/maps
if grep -F -q /tmp/qingping-initial- /proc/`,{field:"stock_pid"},'/maps; then exit 1; else result=$?; [ "$result" -eq 1 ]; fi']},{key:"vendor_0",parts:[`test ! -L /data/bin/SnowApp
test -f /data/bin/SnowApp
stat -c '%s %h' /data/bin/SnowApp
sha256sum /data/bin/SnowApp`]},{key:"vendor_1",parts:[`test ! -L /data/bin/watchdog.sh
test -f /data/bin/watchdog.sh
stat -c '%s %h' /data/bin/watchdog.sh
sha256sum /data/bin/watchdog.sh`]},{key:"vendor_2",parts:[`test ! -L /data/etc/init.d/start.sh
test -f /data/etc/init.d/start.sh
stat -c '%s %h' /data/etc/init.d/start.sh
sha256sum /data/etc/init.d/start.sh`]},{key:"vendor_3",parts:[`test ! -L /etc/init.d/S12_launcher_init
test -f /etc/init.d/S12_launcher_init
stat -c '%s %h' /etc/init.d/S12_launcher_init
sha256sum /etc/init.d/S12_launcher_init`]},{key:"vendor_4",parts:[`test ! -L /etc/init.d/S50_px3se_init
test -f /etc/init.d/S50_px3se_init
stat -c '%s %h' /etc/init.d/S50_px3se_init
sha256sum /etc/init.d/S50_px3se_init`]},{key:"vendor_5",parts:[`test ! -L /lib/ld-2.23.so
test -f /lib/ld-2.23.so
stat -c '%s %h' /lib/ld-2.23.so
sha256sum /lib/ld-2.23.so`]},{key:"vendor_6",parts:[`test ! -L /lib/libc-2.23.so
test -f /lib/libc-2.23.so
stat -c '%s %h' /lib/libc-2.23.so
sha256sum /lib/libc-2.23.so`]},{key:"vendor_7",parts:[`test ! -L /usr/lib/libstdc++.so.6.0.20
test -f /usr/lib/libstdc++.so.6.0.20
stat -c '%s %h' /usr/lib/libstdc++.so.6.0.20
sha256sum /usr/lib/libstdc++.so.6.0.20`]},{key:"vendor_8",parts:[`test ! -L /usr/lib/libQt5Core.so.5.9.4
test -f /usr/lib/libQt5Core.so.5.9.4
stat -c '%s %h' /usr/lib/libQt5Core.so.5.9.4
sha256sum /usr/lib/libQt5Core.so.5.9.4`]},{key:"staged_0",parts:[`test ! -L /data/.esphome-cgs1/program
test -f /data/.esphome-cgs1/program
stat -c '%s %h' /data/.esphome-cgs1/program
sha256sum /data/.esphome-cgs1/program`]},{key:"staged_1",parts:[`test ! -L /data/.esphome-cgs1/pm_qt_bridge.so
test -f /data/.esphome-cgs1/pm_qt_bridge.so
stat -c '%s %h' /data/.esphome-cgs1/pm_qt_bridge.so
sha256sum /data/.esphome-cgs1/pm_qt_bridge.so`]},{key:"staged_2",parts:[`test ! -L /data/.esphome-cgs1/launch.sh
test -f /data/.esphome-cgs1/launch.sh
stat -c '%s %h' /data/.esphome-cgs1/launch.sh
sha256sum /data/.esphome-cgs1/launch.sh`]},{key:"staged_3",parts:[`test ! -L /data/.esphome-cgs1/SnowApp-with-PM
test -f /data/.esphome-cgs1/SnowApp-with-PM
stat -c '%s %h' /data/.esphome-cgs1/SnowApp-with-PM
sha256sum /data/.esphome-cgs1/SnowApp-with-PM`]},{key:"staged_4",parts:[`test ! -L /data/.esphome-cgs1/startup-hook.sh
test -f /data/.esphome-cgs1/startup-hook.sh
stat -c '%s %h' /data/.esphome-cgs1/startup-hook.sh
sha256sum /data/.esphome-cgs1/startup-hook.sh`]},{key:"staged_5",parts:[`test ! -L /data/.esphome-cgs1/stock-start.sh.original
test -f /data/.esphome-cgs1/stock-start.sh.original
stat -c '%s %h' /data/.esphome-cgs1/stock-start.sh.original
sha256sum /data/.esphome-cgs1/stock-start.sh.original`]},{key:"staged_6",parts:[`test ! -L /data/.esphome-cgs1/stock-watchdog.sh.original
test -f /data/.esphome-cgs1/stock-watchdog.sh.original
stat -c '%s %h' /data/.esphome-cgs1/stock-watchdog.sh.original
sha256sum /data/.esphome-cgs1/stock-watchdog.sh.original`]},{key:"staged_7",parts:[`test ! -L /data/.esphome-cgs1/start.sh.candidate
test -f /data/.esphome-cgs1/start.sh.candidate
stat -c '%s %h' /data/.esphome-cgs1/start.sh.candidate
sha256sum /data/.esphome-cgs1/start.sh.candidate`]},{key:"staged_8",parts:[`test ! -L /data/.esphome-cgs1/watchdog.sh.candidate
test -f /data/.esphome-cgs1/watchdog.sh.candidate
stat -c '%s %h' /data/.esphome-cgs1/watchdog.sh.candidate
sha256sum /data/.esphome-cgs1/watchdog.sh.candidate`]},{key:"root",parts:[`test ! -L /data/.esphome-cgs1
test -d /data/.esphome-cgs1
stat -c '%d %i %a %u' /data/.esphome-cgs1
test ! -L /data/.esphome-cgs1/install.intent
test -f /data/.esphome-cgs1/install.intent
[ "$(stat -c '%s %a %u %h' /data/.esphome-cgs1/install.intent)" = '98 600 0 1' ]
cat /data/.esphome-cgs1/install.intent`]},{key:"parents",parts:[`test ! -L /data/bin
test ! -L /data/etc
test ! -L /data/etc/init.d
stat -c '%d' /data/bin /data/etc/init.d`]},{key:"disabled",parts:[`test ! -L /data/.esphome-cgs1/disabled
test -f /data/.esphome-cgs1/disabled
stat -c '%s %a %u %h' /data/.esphome-cgs1/disabled
sha256sum /data/.esphome-cgs1/disabled`]},{key:"pm-helper.disabled",parts:[`test ! -L /data/.esphome-cgs1/pm-helper.disabled
test -f /data/.esphome-cgs1/pm-helper.disabled
stat -c '%s %a %u %h' /data/.esphome-cgs1/pm-helper.disabled
sha256sum /data/.esphome-cgs1/pm-helper.disabled`]},{key:"absent_stores",parts:[`# CGS1_INITIAL_ABSENT_STORES
entries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
    case "$entry" in (full-releases|wifi|prefs|full-state) exit 1;; esac
done
entries=$(LC_ALL=C ls -A1 /tmp)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
    case "$entry" in (qingping-cgs1-esphome.lock) exit 1;; esac
done`]},{key:"memory",parts:[`# CGS1_INITIAL_MEMORY
awk '$1 == "MemTotal:" || $1 == "MemFree:" { print }' /proc/meminfo`]},{key:"intent_file",parts:[`test ! -L /data/.esphome-cgs1/initial-trial.intent
test -f /data/.esphome-cgs1/initial-trial.intent
stat -c '%s %h' /data/.esphome-cgs1/initial-trial.intent
sha256sum /data/.esphome-cgs1/initial-trial.intent`]},{key:"intent_mode",parts:[`observed_value=$(stat -c '%a %u' /data/.esphome-cgs1/initial-trial.intent)
[ "$observed_value" = '600 0' ]
`]},{key:"nand_entries",parts:["LC_ALL=C ls -A1 /data/.esphome-cgs1"]},{key:"commit_marker",parts:[`# CGS1_INITIAL_COMMIT_MARKER
test ! -L /data/.esphome-cgs1/.commit-disabled.lock
test -d /data/.esphome-cgs1/.commit-disabled.lock
observed_value=$(stat -c '%a %u' /data/.esphome-cgs1/.commit-disabled.lock)
[ "$observed_value" = '700 0' ]
test ! -L /data/.esphome-cgs1/.commit-disabled.lock/owner
test -f /data/.esphome-cgs1/.commit-disabled.lock/owner
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/.commit-disabled.lock/owner)
[ "$observed_value" = '82 600 0 1' ]
cat /data/.esphome-cgs1/.commit-disabled.lock/owner`]},{key:"ram_identity",parts:[`test ! -L /tmp
test ! -L /tmp/qingping-initial-trial-`,{field:"ram_job_id"},`
test -d /tmp/qingping-initial-trial-`,{field:"ram_job_id"},`
stat -c '%d %i %a %u' /tmp/qingping-initial-trial-`,{field:"ram_job_id"},`
stat -f -c '%t' /tmp/qingping-initial-trial-`,{field:"ram_job_id"}]},{key:"ram_entries",parts:["LC_ALL=C ls -A1 /tmp/qingping-initial-trial-",{field:"ram_job_id"}]},{key:"prefs_guard",parts:["test ! -L /tmp/qingping-initial-trial-",{field:"ram_job_id"},`/prefs
test -d /tmp/qingping-initial-trial-`,{field:"ram_job_id"},`/prefs
observed_value=$(stat -c '%a %u %d' /tmp/qingping-initial-trial-`,{field:"ram_job_id"},`/prefs)
[ "$observed_value" = '700 0 `,{field:"ram_device"},`' ]
`]},{key:"prefs_entries",parts:["LC_ALL=C ls -A1 /tmp/qingping-initial-trial-",{field:"ram_job_id"},"/prefs"]},{key:"identity_uid",parts:["id -u"]},{key:"identity_wlan",parts:["cat /sys/class/net/wlan0/address"]},{key:"identity_version",parts:["cat /data/etc/os-release"]},{key:"identity_architecture",parts:["uname -m"]},{key:"identity_co2",parts:[`awk '
BEGIN { section=0; count=0 }
/^[ \\t]*\\[/ { section=($0 ~ /^[ \\t]*\\[sensors\\][ \\t]*\\r?$/) }
section && /^[ \\t]*co2_type[ \\t]*=/ {
    value=$0; sub(/^[^=]*=[ \\t]*/, "", value); sub(/[ \\t\\r]*$/, "", value)
    print value; count++
}
END { if (count != 1) exit 1 }
' /data/etc/setting.ini`]},{key:"identity_boot",parts:["cat /proc/sys/kernel/random/boot_id"]}],prefs_file:[{key:"process_scan",parts:[`count=0
for link in /proc/[0-9]*/exe; do
    count=$((count+1))
    [ "$count" -le 4096 ] || exit 1
    pid=\${link#/proc/}; pid=\${pid%/exe}
    case "$pid" in (''|*[!0-9]*) exit 1;; esac
    if executable=$(readlink "$link" 2>/dev/null); then
        :
    else
        # Kernel threads and exited tasks legitimately have no executable.
        # An unreadable live userspace exe is NOT evidence of its absence.
        [ -d "/proc/$pid" ] || continue
        metadata=$(sed 's/.*) //' "/proc/$pid/stat" 2>/dev/null | awk '{print $1, $7}')
        set -- $metadata
        if [ "$#" -ne 2 ]; then
            [ ! -d "/proc/$pid" ] && continue
            exit 1
        fi
        case "$2" in (''|*[!0-9]*) exit 1;; esac
        case "$1" in (Z|X|x) continue;; esac
        [ "$(($2 & 2097152))" -ne 0 ] || exit 1
        continue
    fi
    case "$executable" in
        (/data/.esphome-cgs1/*|/tmp/qingping-full-*/*|/tmp/qingping-initial-*/*) exit 1;;
        (/data/bin/SnowApp) printf '%s\\n' "$pid";;
    esac
done`]},{key:"stock_process",parts:["cat /proc/",{field:"stock_pid"},`/stat
stat -c '%u' /proc/`,{field:"stock_pid"},`
readlink /proc/`,{field:"stock_pid"},"/exe"]},{key:"watchdog_process",parts:["cat /proc/",{field:"watchdog_pid"},`/stat
stat -c '%u' /proc/`,{field:"watchdog_pid"},`
readlink /proc/`,{field:"watchdog_pid"},"/exe"]},{key:"watchdog_arguments",parts:["arguments=$(tr '\\000' '\\n' < /proc/",{field:"watchdog_pid"},`/cmdline)
[ "$arguments" = "$(printf '/bin/sh\\n/data/bin/watchdog.sh')" ]`]},{key:"stock_maps_0",parts:["test -r /proc/",{field:"stock_pid"},`/maps
if grep -F -q /data/.esphome-cgs1/ /proc/`,{field:"stock_pid"},'/maps; then exit 1; else result=$?; [ "$result" -eq 1 ]; fi']},{key:"stock_maps_1",parts:["test -r /proc/",{field:"stock_pid"},`/maps
if grep -F -q /tmp/qingping-full- /proc/`,{field:"stock_pid"},'/maps; then exit 1; else result=$?; [ "$result" -eq 1 ]; fi']},{key:"stock_maps_2",parts:["test -r /proc/",{field:"stock_pid"},`/maps
if grep -F -q /tmp/qingping-initial- /proc/`,{field:"stock_pid"},'/maps; then exit 1; else result=$?; [ "$result" -eq 1 ]; fi']},{key:"vendor_0",parts:[`test ! -L /data/bin/SnowApp
test -f /data/bin/SnowApp
stat -c '%s %h' /data/bin/SnowApp
sha256sum /data/bin/SnowApp`]},{key:"vendor_1",parts:[`test ! -L /data/bin/watchdog.sh
test -f /data/bin/watchdog.sh
stat -c '%s %h' /data/bin/watchdog.sh
sha256sum /data/bin/watchdog.sh`]},{key:"vendor_2",parts:[`test ! -L /data/etc/init.d/start.sh
test -f /data/etc/init.d/start.sh
stat -c '%s %h' /data/etc/init.d/start.sh
sha256sum /data/etc/init.d/start.sh`]},{key:"vendor_3",parts:[`test ! -L /etc/init.d/S12_launcher_init
test -f /etc/init.d/S12_launcher_init
stat -c '%s %h' /etc/init.d/S12_launcher_init
sha256sum /etc/init.d/S12_launcher_init`]},{key:"vendor_4",parts:[`test ! -L /etc/init.d/S50_px3se_init
test -f /etc/init.d/S50_px3se_init
stat -c '%s %h' /etc/init.d/S50_px3se_init
sha256sum /etc/init.d/S50_px3se_init`]},{key:"vendor_5",parts:[`test ! -L /lib/ld-2.23.so
test -f /lib/ld-2.23.so
stat -c '%s %h' /lib/ld-2.23.so
sha256sum /lib/ld-2.23.so`]},{key:"vendor_6",parts:[`test ! -L /lib/libc-2.23.so
test -f /lib/libc-2.23.so
stat -c '%s %h' /lib/libc-2.23.so
sha256sum /lib/libc-2.23.so`]},{key:"vendor_7",parts:[`test ! -L /usr/lib/libstdc++.so.6.0.20
test -f /usr/lib/libstdc++.so.6.0.20
stat -c '%s %h' /usr/lib/libstdc++.so.6.0.20
sha256sum /usr/lib/libstdc++.so.6.0.20`]},{key:"vendor_8",parts:[`test ! -L /usr/lib/libQt5Core.so.5.9.4
test -f /usr/lib/libQt5Core.so.5.9.4
stat -c '%s %h' /usr/lib/libQt5Core.so.5.9.4
sha256sum /usr/lib/libQt5Core.so.5.9.4`]},{key:"staged_0",parts:[`test ! -L /data/.esphome-cgs1/program
test -f /data/.esphome-cgs1/program
stat -c '%s %h' /data/.esphome-cgs1/program
sha256sum /data/.esphome-cgs1/program`]},{key:"staged_1",parts:[`test ! -L /data/.esphome-cgs1/pm_qt_bridge.so
test -f /data/.esphome-cgs1/pm_qt_bridge.so
stat -c '%s %h' /data/.esphome-cgs1/pm_qt_bridge.so
sha256sum /data/.esphome-cgs1/pm_qt_bridge.so`]},{key:"staged_2",parts:[`test ! -L /data/.esphome-cgs1/launch.sh
test -f /data/.esphome-cgs1/launch.sh
stat -c '%s %h' /data/.esphome-cgs1/launch.sh
sha256sum /data/.esphome-cgs1/launch.sh`]},{key:"staged_3",parts:[`test ! -L /data/.esphome-cgs1/SnowApp-with-PM
test -f /data/.esphome-cgs1/SnowApp-with-PM
stat -c '%s %h' /data/.esphome-cgs1/SnowApp-with-PM
sha256sum /data/.esphome-cgs1/SnowApp-with-PM`]},{key:"staged_4",parts:[`test ! -L /data/.esphome-cgs1/startup-hook.sh
test -f /data/.esphome-cgs1/startup-hook.sh
stat -c '%s %h' /data/.esphome-cgs1/startup-hook.sh
sha256sum /data/.esphome-cgs1/startup-hook.sh`]},{key:"staged_5",parts:[`test ! -L /data/.esphome-cgs1/stock-start.sh.original
test -f /data/.esphome-cgs1/stock-start.sh.original
stat -c '%s %h' /data/.esphome-cgs1/stock-start.sh.original
sha256sum /data/.esphome-cgs1/stock-start.sh.original`]},{key:"staged_6",parts:[`test ! -L /data/.esphome-cgs1/stock-watchdog.sh.original
test -f /data/.esphome-cgs1/stock-watchdog.sh.original
stat -c '%s %h' /data/.esphome-cgs1/stock-watchdog.sh.original
sha256sum /data/.esphome-cgs1/stock-watchdog.sh.original`]},{key:"staged_7",parts:[`test ! -L /data/.esphome-cgs1/start.sh.candidate
test -f /data/.esphome-cgs1/start.sh.candidate
stat -c '%s %h' /data/.esphome-cgs1/start.sh.candidate
sha256sum /data/.esphome-cgs1/start.sh.candidate`]},{key:"staged_8",parts:[`test ! -L /data/.esphome-cgs1/watchdog.sh.candidate
test -f /data/.esphome-cgs1/watchdog.sh.candidate
stat -c '%s %h' /data/.esphome-cgs1/watchdog.sh.candidate
sha256sum /data/.esphome-cgs1/watchdog.sh.candidate`]},{key:"root",parts:[`test ! -L /data/.esphome-cgs1
test -d /data/.esphome-cgs1
stat -c '%d %i %a %u' /data/.esphome-cgs1
test ! -L /data/.esphome-cgs1/install.intent
test -f /data/.esphome-cgs1/install.intent
[ "$(stat -c '%s %a %u %h' /data/.esphome-cgs1/install.intent)" = '98 600 0 1' ]
cat /data/.esphome-cgs1/install.intent`]},{key:"parents",parts:[`test ! -L /data/bin
test ! -L /data/etc
test ! -L /data/etc/init.d
stat -c '%d' /data/bin /data/etc/init.d`]},{key:"disabled",parts:[`test ! -L /data/.esphome-cgs1/disabled
test -f /data/.esphome-cgs1/disabled
stat -c '%s %a %u %h' /data/.esphome-cgs1/disabled
sha256sum /data/.esphome-cgs1/disabled`]},{key:"pm-helper.disabled",parts:[`test ! -L /data/.esphome-cgs1/pm-helper.disabled
test -f /data/.esphome-cgs1/pm-helper.disabled
stat -c '%s %a %u %h' /data/.esphome-cgs1/pm-helper.disabled
sha256sum /data/.esphome-cgs1/pm-helper.disabled`]},{key:"absent_stores",parts:[`# CGS1_INITIAL_ABSENT_STORES
entries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
    case "$entry" in (full-releases|wifi|prefs|full-state) exit 1;; esac
done
entries=$(LC_ALL=C ls -A1 /tmp)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
    case "$entry" in (qingping-cgs1-esphome.lock) exit 1;; esac
done`]},{key:"memory",parts:[`# CGS1_INITIAL_MEMORY
awk '$1 == "MemTotal:" || $1 == "MemFree:" { print }' /proc/meminfo`]},{key:"intent_file",parts:[`test ! -L /data/.esphome-cgs1/initial-trial.intent
test -f /data/.esphome-cgs1/initial-trial.intent
stat -c '%s %h' /data/.esphome-cgs1/initial-trial.intent
sha256sum /data/.esphome-cgs1/initial-trial.intent`]},{key:"intent_mode",parts:[`observed_value=$(stat -c '%a %u' /data/.esphome-cgs1/initial-trial.intent)
[ "$observed_value" = '600 0' ]
`]},{key:"nand_entries",parts:["LC_ALL=C ls -A1 /data/.esphome-cgs1"]},{key:"commit_marker",parts:[`# CGS1_INITIAL_COMMIT_MARKER
test ! -L /data/.esphome-cgs1/.commit-disabled.lock
test -d /data/.esphome-cgs1/.commit-disabled.lock
observed_value=$(stat -c '%a %u' /data/.esphome-cgs1/.commit-disabled.lock)
[ "$observed_value" = '700 0' ]
test ! -L /data/.esphome-cgs1/.commit-disabled.lock/owner
test -f /data/.esphome-cgs1/.commit-disabled.lock/owner
observed_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/.commit-disabled.lock/owner)
[ "$observed_value" = '82 600 0 1' ]
cat /data/.esphome-cgs1/.commit-disabled.lock/owner`]},{key:"ram_identity",parts:[`test ! -L /tmp
test ! -L /tmp/qingping-initial-trial-`,{field:"ram_job_id"},`
test -d /tmp/qingping-initial-trial-`,{field:"ram_job_id"},`
stat -c '%d %i %a %u' /tmp/qingping-initial-trial-`,{field:"ram_job_id"},`
stat -f -c '%t' /tmp/qingping-initial-trial-`,{field:"ram_job_id"}]},{key:"ram_entries",parts:["LC_ALL=C ls -A1 /tmp/qingping-initial-trial-",{field:"ram_job_id"}]},{key:"prefs_guard",parts:["test ! -L /tmp/qingping-initial-trial-",{field:"ram_job_id"},`/prefs
test -d /tmp/qingping-initial-trial-`,{field:"ram_job_id"},`/prefs
observed_value=$(stat -c '%a %u %d' /tmp/qingping-initial-trial-`,{field:"ram_job_id"},`/prefs)
[ "$observed_value" = '700 0 `,{field:"ram_device"},`' ]
`]},{key:"prefs_entries",parts:["LC_ALL=C ls -A1 /tmp/qingping-initial-trial-",{field:"ram_job_id"},"/prefs"]},{key:"prefs_file",parts:["test ! -L /tmp/qingping-initial-trial-",{field:"ram_job_id"},"/prefs/",{field:"node_name"},`.prefs
test -f /tmp/qingping-initial-trial-`,{field:"ram_job_id"},"/prefs/",{field:"node_name"},`.prefs
stat -c '%s %a %u %h %d' /tmp/qingping-initial-trial-`,{field:"ram_job_id"},"/prefs/",{field:"node_name"},".prefs"]},{key:"identity_uid",parts:["id -u"]},{key:"identity_wlan",parts:["cat /sys/class/net/wlan0/address"]},{key:"identity_version",parts:["cat /data/etc/os-release"]},{key:"identity_architecture",parts:["uname -m"]},{key:"identity_co2",parts:[`awk '
BEGIN { section=0; count=0 }
/^[ \\t]*\\[/ { section=($0 ~ /^[ \\t]*\\[sensors\\][ \\t]*\\r?$/) }
section && /^[ \\t]*co2_type[ \\t]*=/ {
    value=$0; sub(/^[^=]*=[ \\t]*/, "", value); sub(/[ \\t\\r]*$/, "", value)
    print value; count++
}
END { if (count != 1) exit 1 }
' /data/etc/setting.ini`]},{key:"identity_boot",parts:["cat /proc/sys/kernel/random/boot_id"]}]},post_stop_transport_close:!0};var j=()=>{throw{code:"usb_browser_scope_unverified"}},Re=t=>t&&typeof t=="object"&&!Array.isArray(t)?Object.keys(t).sort().join():null,qs=t=>{try{return JSON.parse(JSON.stringify(t))}catch{j()}},jt=(t,e)=>JSON.stringify(t)===JSON.stringify(e),Lo=async t=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(t))),e=>e.toString(16).padStart(2,"0")).join("");function be(t){return(typeof t!="string"||t.length>65536||/[^\x01-\x7f]/.test(t))&&j(),t.endsWith(`\r
`)?t=t.slice(0,-2):t.endsWith(`
`)&&(t=t.slice(0,-1)),t.includes("\r")&&j(),t===""?[]:t.split(`
`)}function $n(t,e=0,s=Number.MAX_SAFE_INTEGER){(typeof t!="string"||!/^[0-9]+$/.test(t))&&j();let a=Number(t);return(!Number.isSafeInteger(a)||a<e||a>s)&&j(),a}function Xt(t){be(t).length&&j()}function ai(t,e,s){let a=be(t);(a.length!==2||a[0]!==e.size+" 1"||!W(a[1],e.sha256,s))&&j()}function wn(t,e,s,a=!1){let[i,n,r]=qs([t,e,s]);Kt(i,n,r),(_e.schema_version!==1||_e.maximum_observation_ms!==5e3||_e.source_commit!==H.source_commit||!jt(_e.source_sha256,H.source_sha256)||Re(_e.branches)!==["empty","prefs_empty","prefs_file"].sort().join()||Re(_e.return_branches)!==Re(_e.branches)||a&&_e.post_stop_transport_close!==!0)&&j();let o=i.context.committed_scope,d={guardian_pid:String(r.start.stamp[0]),child_pid:String(r.child.stamp[0]),stock_pid:String(o.stock_process[0]),watchdog_pid:String(o.watchdog_process[0]),guardian_job_id:i.guardian_job_id,ram_job_id:i.ram_job_id,ram_device:String(n.uploaded.ram_root_identity[0]),node_name:i.context.api_identity.node_name},c={};for(let[l,_]of Object.entries(a?_e.return_branches:_e.branches)){(!Array.isArray(_)||_.length!==(l==="empty"?54:l==="prefs_empty"?56:57)-(a?11:0))&&j();let b={};for(let p of _)(Re(p)!==["key","parts"].sort().join()||typeof p.key!="string"||Object.hasOwn(b,p.key)||!Array.isArray(p.parts))&&j(),b[p.key]=p.parts.map(u=>typeof u=="string"?u:((Re(u)!=="field"||typeof d[u.field]!="string")&&j(),d[u.field])).join(""),(b[p.key].length>8192||/[^\x01-\x7f]/.test(b[p.key]))&&j();c[l]=Object.freeze(b)}for(let[l,_]of Object.entries(c.empty))(c.prefs_empty[l]!==_||c.prefs_file[l]!==_)&&j();for(let[l,_]of Object.entries(c.prefs_empty))c.prefs_file[l]!==_&&j();return Object.freeze(c)}async function Ao(t,e,s,a,i=!1){let[n,r,o,d]=qs([t,e,s,a]),c=wn(n,r,o,i),l="/data/.esphome-cgs1",_;be(d.ram_entries).length===0?_="empty":d.ram_entries==="prefs"?be(d.prefs_entries).length===0?_="prefs_empty":d.prefs_entries===n.context.api_identity.node_name+".prefs"?_="prefs_file":j():j(),Re(d)!==Object.keys(c[_]).sort().join()&&j();let b;if(!i){let E=Object.keys(Kt(n,r,o));b=Is(n,r,o,Object.fromEntries(E.map(z=>[z,d[z]])))}let p=n.context.committed_scope,u=n.context.meta,f=p.root_identity;d.process_scan!==String(p.stock_process[0])&&j();let g=Ze(d.stock_process,[p.stock_process[0],String(p.stock_process[1])],"/data/bin/SnowApp",p.watchdog_process[0]),v=Ze(d.watchdog_process,[p.watchdog_process[0],String(p.watchdog_process[1])],"/bin/busybox");Xt(d.watchdog_arguments);for(let E=0;E<3;E++)Xt(d["stock_maps_"+E]);J.files.forEach((E,z)=>ai(d["vendor_"+z],F.patched[E.path]||E,E.path)),I.forEach(([E,z],Kr)=>ai(d["staged_"+Kr],u.descriptor.files[E],l+"/"+z)),(!jt(be(d.root),[f.join(" ")+" 700 0",p.plan_id+" "+p.plan_sha256])||!jt(be(d.parents),[String(f[0]),String(f[0])]))&&j();for(let E of["disabled","pm-helper.disabled"]){let z=be(d[E]);(z.length!==2||z[0]!=="0 600 0 1"||!W(z[1],"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",l+"/"+E))&&j()}Xt(d.absent_stores);let m={};for(let E of be(d.memory)){let z=/^(MemTotal|MemFree):[ \t]+([0-9]+)[ \t]+kB$/.exec(E);(!z||Object.hasOwn(m,z[1]))&&j(),m[z[1]]=$n(z[2],0,2**30)*1024}(Re(m)!==["MemFree","MemTotal"].sort().join()||m.MemFree<8*1024**2||m.MemFree>m.MemTotal)&&j();let w=r.uploaded.ram_root_identity,k=o.start.stamp,R=`CGS1_INITIAL_TRIAL_V1
`+p.plan_id+`
`+p.plan_sha256+`
`+u.target.boot_id+`
`+u.descriptor.files["bridge-program"].sha256+`
`+n.context.guardian.sha256+`
`+n.nonce+`
`+w.join(" ")+`
`+k.join(" ")+`
`;ai(d.intent_file,{size:R.length,sha256:await Lo(R)},l+"/initial-trial.intent"),Xt(d.intent_mode);let ls=[...I.map(([,E])=>E),"install.intent","disabled","pm-helper.disabled",".commit-disabled.lock","initial-trial.intent"];if((!jt(be(d.nand_entries).sort(),ls.sort())||d.commit_marker!=="commit-disabled "+u.commit_nonce+" "+p.plan_id||!jt(be(d.ram_identity),[w.join(" ")+" 700 0","1021994"]))&&j(),_!=="empty"&&Xt(d.prefs_guard),_==="prefs_file"){let E=be(d.prefs_file);E.length!==1&&j();let z=E[0].split(" ");(z.length!==5||z.slice(1).join(" ")!=="600 0 1 "+w[0])&&j(),$n(z[0],0,65536)}let Ea=u.target,Qr={uid:"0",wlan:Ea.wlan_mac,version:"CLEARGRASS_VERSION=4.1.8_0287",architecture:"armv7l",co2:String(Ea.co2_type),boot:Ea.boot_id};for(let[E,z]of Object.entries(Qr))d["identity_"+E]!==z&&j();let Vr=Object.fromEntries(["job_id","plan_sha256","intent_sha256","channel_id","channel_nonce","nonce","ram_job_id","guardian_job_id"].map(E=>[E,n[E]]));return Object.freeze({kind:i?"browser_initial_return_observation":"browser_initial_scope_observation",...Vr,...i?{guardian:Object.freeze(o.start.stamp),child:Object.freeze(o.child.stamp),own_programs_absent:!0}:{process:b},root_identity:Object.freeze(f),ram_root_identity:Object.freeze(w),stock_process:Object.freeze([g[0],g[2]]),watchdog_process:Object.freeze([v[0],v[2]]),prefs_layout:_,memory_free_bytes:m.MemFree,memory_total_bytes:m.MemTotal,kernel_scope_checked:!0,image_fd_admitted:!1,execution_authority:!1,context_only:!0})}async function ii(t,e,s,a,i=!1){(Re(t)!=="read"||typeof t.read!="function")&&j(),[e,s,a]=qs([e,s,a]);let n=wn(e,s,a,i),r={},o=n.prefs_file;for(let d=0;d<Object.keys(o).length;d++){let c=Object.keys(o)[d];r[c]=await t.read(o[c]),c==="ram_entries"?r[c]===""?o=n.empty:r[c]!=="prefs"&&j():c==="prefs_entries"&&(r[c]===""?o=n.prefs_empty:r[c]!==e.context.api_identity.node_name+".prefs"&&j())}return Ao(e,s,a,r,i)}function yn(t,e,s,a){return ii(t,e,s,a)}async function kn(t,e,s,a){[e,s,a]=qs([e,s,a]);let i=await ii(t,e,s,a,!0),n=await ii(t,e,s,a,!0),r=o=>Object.fromEntries(Object.entries(o).filter(([d])=>d!=="memory_free_bytes"));return jt(r(i),r(n))||j(),n}var jo=()=>{throw{code:"usb_browser_scope_unverified"}},xn=["claim","watchdog","start"],Sn=oe,Ct=class{#e;#t=0;constructor(e){this.#e=new ge(e,({meta:s,scope:a,nonce:i,phase:n})=>vs(s,a,i,n))}ready(){return this.#e.ready()}probe(){return this.#e.probe()}async execute(e,s,a,i){return(!xn.includes(i)||xn[this.#t]!==i||!this.#e.ready())&&(await this.close().catch(()=>{}),jo()),this.#t++,await this.#e.execute({meta:e,scope:s,nonce:a,phase:i}),{phase:i,completed:!0}}close(){return this.#e.close()}};var Ye=()=>{throw{code:"usb_browser_scope_unverified"}},Co=["claim","watchdog","start"],Ln=/^[a-f0-9]{64}$/,Eo="53d97b9609e8e0fcdfc5d003101f620098dbc734",Os=t=>t&&typeof t=="object"&&!Array.isArray(t)?Object.keys(t).sort().join():null,Ns=class{#e;#t;#s;#i;#n=!1;#a=!1;#h=!1;#r=0;#c=[];#u=[];#l=!1;#b;#p=!1;constructor(e,s,a){let i=["schema_version","job_id","plan_sha256","intent_sha256","channel_id","channel_nonce","nonce","source_commit","meta","initial_scope","producer_sha256"];(!e||Os(e)!==["scope","closeTransport"].sort().join()||Object.values(e).some(n=>typeof n!="function")||!(s instanceof Ct)||!s.ready()||Os(a)!==i.sort().join()||a.schema_version!==1||a.source_commit!==Eo||a.meta?.commit_nonce!==null||a.job_id!==a.meta?.job_id||a.plan_sha256!==a.meta?.descriptor?.plan_sha256||typeof a.intent_sha256!="string"||!Ln.test(a.intent_sha256)||typeof a.channel_id!="string"||!/^[a-f0-9]{32}$/.test(a.channel_id)||typeof a.channel_nonce!="string"||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(a.channel_nonce)||Os(a.producer_sha256)!==["browser_commit.py","disabled-write-contract.json"].sort().join()||Object.values(a.producer_sha256).some(n=>typeof n!="string"||!Ln.test(n))||JSON.stringify(a).length>32768)&&Ye(),vs(a.meta,a.initial_scope,a.nonce,"claim"),this.#s=JSON.parse(JSON.stringify(a)),this.#i=qe(a.initial_scope),this.#e=Object.freeze({...e}),this.#t=s}async#m(){await this.close().catch(()=>{}),Ye()}#v(e){return{...this.#s.meta,commit_nonce:e===0?null:this.#s.nonce}}async#o(e){this.#l&&Ye();let s=this.#v(e),a=await this.#e.scope(s);this.#l&&Ye(),Ie(s,a),qe(a)!==this.#i&&Ye();for(let[i,n]of a.vendor_hashes){let r=J.files.find(o=>o.path===i).sha256;(e>=2&&i==="/data/bin/watchdog.sh"||e===3&&i==="/data/etc/init.d/start.sh")&&(r=F.patched[i].sha256),n!==r&&Ye()}return JSON.parse(JSON.stringify(a))}async prepare(){if(this.#l||this.#n||this.#h)return this.#m();this.#n=!0,this.#h=!0;try{return await this.#o(0),this.#a=!0,{state:"commit_scope_rechecked",writer_enabled:!1}}catch{return this.#m()}finally{this.#h=!1}}async step(e){if(this.#l||!this.#a||this.#h||this.#p||Co[this.#r]!==e)return this.#m();let s=this.#r++;this.#h=!0;try{let a=await this.#o(s),i=await this.#t.execute(this.#v(s),a,this.#s.nonce,e);(this.#l||Os(i)!==["phase","completed"].sort().join()||i.phase!==e||i.completed!==!0)&&Ye();let n=await this.#o(s+1);return this.#c.push(n),this.#u.push(e),{phase:e,completed:!0,scope:n}}catch{return this.#m()}finally{this.#h=!1}}async finish(){if(this.#l||!this.#a||this.#h||this.#p||this.#r!==3||this.#c.length!==3)return this.#m();this.#p=!0,this.#a=!1,this.#h=!0;try{this.#c[2]=await this.#o(3);let e=this.#s,s={schema_version:1,job_id:e.job_id,plan_sha256:e.plan_sha256,intent_sha256:e.intent_sha256,channel_id:e.channel_id,channel_nonce:e.channel_nonce,nonce:e.nonce,commands_acknowledged:[...this.#u],observations:this.#c,transport_closed:!0,program_started:!1,boot_flags_changed:!1};return await this.#e.closeTransport(),this.#l=!0,JSON.parse(JSON.stringify(s))}catch{return this.#m()}finally{this.#h=!1}}close(){return this.#b?this.#b:(this.#l=!0,this.#a=!1,this.#b=Promise.resolve().then(()=>this.#e.closeTransport()),this.#b)}};var h=t=>{throw{code:t}},Io=/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/,qo=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/,Oo=/^[a-f0-9]{2}(?::[a-f0-9]{2}){5}$/,Ts=class{#e=!1;#t;#s;#i;#n=!1;#a=!1;#h;#r;#c;#u;#l;#b;#p;#m;#v;#o;#_=!1;#w=0;#d=!1;#f;#$=!1;#q=!1;#k=!1;#L=!1;#C;#E;#A=!1;#M=!1;#D;#F;#V=!1;#ne=!1;#re=!1;#G;#N;#x=!1;#J;#B;#S=!1;#W=!1;#H;#T;#I;#O;#K;#se=!1;#Q=!1;#P=!1;#U;#X;#Z;#oe=!1;#de=!1;#z=0;constructor(e,s){this.#s=e,this.#i=s}select(){return this.#ae(!1,!1)}selectForReview(){return this.#ae(!0,!1)}selectForFullUiReview(){return this.#ae(!0,!0)}#ae(e,s){(this.#n||this.#a)&&h("usb_selection_consumed"),this.#n=!0,this.#q=e,this.#e=s,this.#s.manager||h("webusb_unavailable");let a;try{a=this.#s.manager.requestDevice()}catch{this.#a=!0,h("usb_selection_failed")}return this.#_e(a)}async#R(e,s=1e4){this.#a&&h("usb_selection_consumed");let a=this.#m-Date.now();a<=0&&(this.close().catch(()=>{}),h("usb_read_timeout"));let i;try{return await Promise.race([e(),new Promise((n,r)=>{i=setTimeout(()=>{this.close().catch(()=>{}),r({code:"usb_read_timeout"})},Math.min(s,a))})])}finally{clearTimeout(i)}}async#j(e){let s;try{await Promise.race([Promise.resolve().then(e),new Promise((a,i)=>{s=setTimeout(()=>i({code:"usb_close_unverified"}),2e3)})])}catch{h("usb_close_unverified")}finally{clearTimeout(s)}}async#_e(e){try{let s=await e;(this.#a||!s||!Io.test(s.serial))&&h("usb_identity_invalid"),this.#h=s,this.#b=s.serial,this.#l=crypto.randomUUID();let a=this.#e?9e5:24e4;this.#m=Date.now()+a,this.#v=setTimeout(()=>{this.close().catch(()=>{})},a),await this.#R(async()=>{let r=await s.connect();this.#a&&(await this.#j(()=>Promise.all([r.readable.cancel(),r.writable.close()])),h("usb_selection_consumed")),this.#r=r},5e3);let i=await this.#R(async()=>{let r=await this.#s.authenticate({serial:this.#b,connection:this.#r,credentialStore:this.#s.ephemeralCredentials(),initialDelayedAckBytes:0,readTimeLimit:1e4});return this.#a&&(await this.#j(()=>r.close()),h("usb_selection_consumed")),r},15e3);this.#c=this.#s.createClient(i),this.#a&&(await this.#j(()=>this.#c.close()),h("usb_selection_consumed"));let n=await this.#g();return this.#p=Object.freeze({...n}),this.#q?JSON.stringify(await this.#g())!==JSON.stringify(this.#p)&&h("usb_selection_changed"):await this.checkInitialScope(),this.evidence()}catch{await this.close(),h("usb_channel_unverified")}}async#y(e){let s="__CGS1_CHANNEL_OK_"+crypto.randomUUID().replaceAll("-","")+"__",a=await this.#R(async()=>{let d=await this.#c.createSocket(`shell:set -e
`+e+`
printf '\\n`+s+`\\n'
`);return this.#a&&(await this.#j(()=>d.close()),h("usb_selection_consumed")),d},5e3),i,n=new Uint8Array;try{for(i=a.readable.getReader();;){let{value:d,done:c}=await this.#R(()=>i.read());if(c)break;(!(d instanceof Uint8Array)||n.length+d.length>4096)&&h("usb_read_invalid");let l=new Uint8Array(n.length+d.length);l.set(n),l.set(d,n.length),n=l}}finally{i?.releaseLock(),await this.#j(()=>a.close())}n.some(d=>d===0||d>127)&&h("usb_read_invalid");let r=new TextDecoder().decode(n).replaceAll(`\r
`,`
`),o=`
`+s+`
`;return r.endsWith(o)||h("usb_read_incomplete"),r.slice(0,-o.length).trim()}async#g(){let e={};for(let s of this.#i.identity)e[s.name]=await this.#y(s.command);return(e.uid!=="0"||e.arch!=="armv7l"||e.version!=="CLEARGRASS_VERSION=4.1.8_0287"||!["2","3"].includes(e.co2_type)||!qo.test(e.boot_id)||!Oo.test(e.wlan_mac)||e.wlan_mac==="00:00:00:00:00:00"||parseInt(e.wlan_mac.slice(0,2),16)&1)&&h("usb_identity_invalid"),e}evidence(){return(this.#a||!this.#p||!this.#c||this.#h.serial!==this.#b||Date.now()>=this.#m)&&h("usb_channel_unverified"),Object.freeze({kind:"browser_webusb",channel:this.#l,serial:this.#b,wlan_mac:this.#p.wlan_mac,boot_id:this.#p.boot_id,co2_type:Number(this.#p.co2_type),stock_version:"4.1.8_0287",native_get_devpath:!1})}async checkInitialScope(){this.#e&&h("usb_selection_consumed"),(this.#S||this.#x)&&h("usb_busy"),(this.#A||this.#k)&&h("usb_busy"),(this.#A||this.#d||this.#o||this.#_||this.#$||this.#L)&&h("usb_busy"),this.#d=!0;try{this.evidence();let e=await this.#g();JSON.stringify(e)!==JSON.stringify(this.#p)&&h("usb_selection_changed");for(let a of this.#i.files)_t(await this.#y(a.command),a)||h("usb_stock_unverified");await this.#y(this.#i.absent_install)!==""&&h("usb_existing_installation");let s=await this.#g();return JSON.stringify(s)!==JSON.stringify(e)&&h("usb_selection_changed"),this.evidence()}catch{await this.close(),h("usb_channel_unverified")}finally{this.#d=!1}}async checkStageScope(){this.#e&&h("usb_selection_consumed"),(this.#S||this.#x)&&h("usb_busy");let e=await this.checkInitialScope();(this.#A||this.#d||this.#o||this.#_||this.#$||this.#L)&&h("usb_busy"),this.#d=!0;try{let s=(await this.#y("stat -f -c '%t %a %S' /data")).split(/\s+/);(s.length!==3||s[0]!=="ef53"||!/^[0-9]+$/.test(s[1])||!/^[0-9]+$/.test(s[2]))&&h("usb_channel_unverified");let a=Number(s[1]),i=Number(s[2]);return(!Number.isSafeInteger(a)||a<0||!Number.isSafeInteger(i)||i<512||i>65536||!Number.isSafeInteger(a*i))&&h("usb_channel_unverified"),JSON.stringify(await this.#g())!==JSON.stringify(this.#p)&&h("usb_selection_changed"),this.evidence(),{evidence:e,filesystem:{magic:"ef53",available_blocks:a,block_bytes:i}}}catch{await this.close(),h("usb_channel_unverified")}finally{this.#d=!1}}async checkDisabledScope(e){this.#e&&h("usb_selection_consumed"),(this.#S||this.#x)&&h("usb_busy"),(this.#A||this.#d||this.#o||this.#_||this.#$||this.#L)&&h("usb_busy"),this.#d=!0;try{return await this.#Y(e)}catch{await this.close().catch(()=>{}),h("usb_browser_scope_unverified")}finally{this.#d=!1}}async#Y(e,s=void 0){let a=this.evidence(),i={kind:"browser_webusb",usb_serial:a.serial,wlan_mac:a.wlan_mac,boot_id:a.boot_id,co2_type:a.co2_type,stock_version:a.stock_version};return(!e?.target||Object.keys(e.target).sort().join()!==Object.keys(i).sort().join()||Object.keys(i).some(r=>e.target[r]!==i[r]))&&h("usb_channel_unverified"),await(s===void 0?Gi:Ji)({read:r=>this.#y(r),identity:async()=>(this.evidence(),JSON.stringify(await this.#g())===JSON.stringify(this.#p))},e,s)}async checkInitialTrialPreparation(e){this.#e&&h("usb_selection_consumed"),(this.#S||this.#x)&&h("usb_busy"),(this.#a||this.#d||this.#o||this.#_||this.#$||this.#k||this.#M)&&h("usb_busy"),this.#d=!0;try{return await this.#ie(e)}catch{await this.close().catch(()=>{}),h("usb_browser_scope_unverified")}finally{this.#d=!1}}async#ie(e){return await Ua({read:s=>this.#y(s),scope:s=>this.#Y(s),identity:async()=>(this.evidence(),JSON.stringify(await this.#g())===JSON.stringify(this.#p))},e)}async observeFullUiScope(e){(!this.#e||this.#a||this.#d||this.#o||this.#_)&&h("usb_busy"),Ia(e),this.#t&&JSON.stringify(e)!==JSON.stringify(this.#t)&&h("usb_selection_changed"),this.#t=JSON.parse(JSON.stringify(e)),this.#d=!0;try{let s=this.evidence();return await Ni({read:a=>this.#y(a),identity:async()=>(this.evidence(),JSON.stringify(await this.#g())===JSON.stringify(this.#p))},e,s)}catch{await this.close().catch(()=>{}),h("usb_channel_unverified")}finally{this.#d=!1}}async openFullUiApi(){(!this.#t||!this.#e||this.#a||this.#d||this.#o||this.#_||this.#w>=1024)&&h("usb_selection_consumed"),(await this.observeFullUiScope(this.#t)).kind!=="browser_full_ui_scope"&&h("usb_selection_consumed"),this.#d=!0;try{this.evidence();let s=await this.#y(`awk 'FNR>1 && $4=="0A" && $2 ~ /:17A5$/ {n++} END {print n+0}' /proc/net/tcp /proc/net/tcp6`);if(s==="0")return Object.freeze({kind:"browser_full_ui_api_waiting",socket_open_issued:!1,listener_absence_checked:!0});["1","2"].includes(s)||h("usb_channel_unverified"),JSON.stringify(await this.#g())!==JSON.stringify(this.#p)&&h("usb_selection_changed")}catch{await this.close().catch(()=>{}),h("usb_channel_unverified")}finally{this.#d=!1}return this.#te()}async observeBridgeBoot(e){this.#e&&h("usb_selection_consumed"),(this.#a||this.#d||this.#re||this.#S||this.#A||this.#$||this.#k||this.#_&&!this.#o||this.#se)&&h("usb_busy"),Gt(e),this.#x&&JSON.stringify(e)!==JSON.stringify(this.#J)&&h("usb_selection_consumed"),this.#x=!0,this.#J=JSON.parse(JSON.stringify(e)),this.#d=!0;try{return await this.#ce(e)}catch{await this.close().catch(()=>{}),h("usb_channel_unverified")}finally{this.#d=!1}}async#ce(e){this.evidence();let s=e.arming.context.meta,a=await this.#g();JSON.stringify(a)!==JSON.stringify(this.#p)&&h("usb_selection_changed");let i={...s.target,boot_id:a.boot_id},n=this.evidence();(i.usb_serial!==n.serial||i.wlan_mac!==n.wlan_mac||i.co2_type!==n.co2_type||i.stock_version!==n.stock_version)&&h("usb_selection_changed");let r;if(i.boot_id===s.target.boot_id){let d=await Je(s.descriptor.plan_id,e.plan_sha256,e.arming.nonce);await this.#pe(s,e.arming.context.trial_marker,d),r={kind:"browser_bridge_boot_waiting",job_id:e.job_id,plan_sha256:e.plan_sha256,arming_intent_sha256:e.arming.intent_sha256,arming_proof_sha256:e.arming_proof_sha256,target:i,device_writes:0,context_only:!0}}else r=await en({read:d=>this.#y(d),identity:async d=>(this.evidence(),JSON.stringify(await this.#g())===JSON.stringify(this.#p)&&JSON.stringify(d)===JSON.stringify(i))},e,i);let o=d=>JSON.stringify({...d,memory_free_bytes:void 0});return this.#B&&o(r)!==o(this.#B)&&h("usb_selection_changed"),this.#B=JSON.parse(JSON.stringify(r)),r}async openBridgeBootApi(){return this.#e&&h("usb_selection_consumed"),(this.#V||!this.#x||this.#B?.kind!=="browser_bridge_boot_runtime_scope"||this.#d||this.#o||this.#_||this.#a||this.#w>=(this.#e?1024:16))&&h("usb_selection_consumed"),await this.observeBridgeBoot(this.#J),this.#te()}async probePmBootStream(){this.#e&&h("usb_selection_consumed"),(this.#a||this.#d||this.#o||this.#_||this.#V||!this.#x||this.#B?.kind!=="browser_bridge_boot_runtime_scope"||this.#m-Date.now()<65e3)&&h("usb_selection_consumed"),this.#V=!0,this.#d=!0;try{return this.evidence(),this.#G=new kt({live:()=>{try{return this.evidence(),!0}catch{return!1}},open:e=>(this.evidence(),this.#c.createSocket(sn(e))),closeTransport:()=>this.close()}),await this.#G.probe()}catch{await this.close().catch(()=>{}),h("usb_channel_unverified")}finally{this.#d=!1}}async beginPmBoot(e){(this.#a||this.#d||this.#o||this.#_||!this.#V||this.#ne||!this.#G||e?.channel_nonce!==this.#l||this.#m-Date.now()<6e4)&&h("usb_selection_consumed"),this.#ne=!0,this.#d=!0;try{return JSON.stringify(e.context)!==JSON.stringify(this.#J)&&h("usb_selection_changed"),this.#N=new ks({scope:s=>this.#ce(s),identity:async s=>{this.evidence();let a=await this.#g();return JSON.stringify(a)===JSON.stringify(this.#p)&&s.usb_serial===this.#b&&s.boot_id===a.boot_id&&s.wlan_mac===a.wlan_mac&&s.co2_type===Number(a.co2_type)},closeTransport:()=>this.close()},this.#G,e),await this.#N.prepare()}catch{await this.close().catch(()=>{}),h("usb_channel_unverified")}finally{this.#d=!1}}async pmBootStep(e){(this.#a||this.#d||!this.#N)&&h("usb_selection_consumed"),this.#d=!0,this.#re=!0;try{return await this.#N.step(e)}catch{await this.close().catch(()=>{}),h("usb_channel_unverified")}finally{this.#d=!1}}async completePmBoot(){(this.#a||this.#d||!this.#N)&&h("usb_selection_consumed"),this.#d=!0;try{return await this.#N.finish()}catch{await this.close().catch(()=>{}),h("usb_channel_unverified")}finally{this.#d=!1}}async checkBridgeBootPreparation(e,s){this.#e&&h("usb_selection_consumed"),this.#x&&h("usb_busy"),(this.#a||this.#d||this.#o||this.#_||this.#$||this.#k||this.#A||this.#M||this.#W)&&h("usb_busy"),this.#d=!0;try{return await this.#le(e,s)}catch{await this.close().catch(()=>{}),h("usb_browser_scope_unverified")}finally{this.#d=!1}}async#le(e,s){let a=JSON.parse(JSON.stringify(s));return{kind:"browser_bridge_boot_preparation",preparation:await Ua({read:n=>this.#y(n),scope:n=>this.#Y(n,a),identity:async()=>(this.evidence(),JSON.stringify(await this.#g())===JSON.stringify(this.#p))},e),trial_marker:a,trial_marker_checked:!0,context_only:!0}}async#pe(e,s,a){let i=this.evidence(),n={kind:"browser_webusb",usb_serial:i.serial,wlan_mac:i.wlan_mac,boot_id:i.boot_id,co2_type:i.co2_type,stock_version:i.stock_version};return(!e?.target||Object.keys(e.target).sort().join()!==Object.keys(n).sort().join()||Object.keys(n).some(r=>e.target[r]!==n[r]))&&h("usb_selection_changed"),await Wi({read:r=>this.#y(r),identity:async()=>(this.evidence(),JSON.stringify(await this.#g())===JSON.stringify(this.#p))},e,s,a)}async probeBridgeBootStream(){this.#e&&h("usb_selection_consumed"),(this.#a||this.#d||this.#o||this.#_||this.#$||this.#k||this.#A||this.#M||this.#S||this.#x)&&h("usb_selection_consumed"),this.#S=!0,this.#d=!0;try{this.evidence(),JSON.stringify(await this.#g())!==JSON.stringify(this.#p)&&h("usb_selection_changed"),this.#H=new Dt({live:()=>(this.evidence(),!0),open:s=>(this.evidence(),this.#c.createSocket(Xi(s))),closeTransport:()=>this.close()});let e=await this.#H.probe();return JSON.stringify(await this.#g())!==JSON.stringify(this.#p)&&h("usb_selection_changed"),this.evidence(),e}catch{await this.close().catch(()=>{}),h("usb_browser_scope_unverified")}finally{this.#d=!1}}async beginBridgeBoot(e){(this.#a||this.#d||this.#o||this.#_||!this.#S||!this.#H||this.#W)&&h("usb_selection_consumed"),this.#W=!0,this.#d=!0;try{let s=this.evidence(),a={kind:"browser_webusb",usb_serial:s.serial,wlan_mac:s.wlan_mac,boot_id:s.boot_id,co2_type:s.co2_type,stock_version:s.stock_version};return(e?.channel_nonce!==this.#l||!e.context?.meta?.target||Object.keys(e.context.meta.target).sort().join()!==Object.keys(a).sort().join()||Object.keys(a).some(i=>e.context.meta.target[i]!==a[i]))&&h("usb_selection_changed"),this.#T=new $s({preparation:(i,n)=>this.#le(i,n),armed:(i,n,r)=>this.#pe(i,n,r),identity:async()=>(this.evidence(),JSON.stringify(await this.#g())===JSON.stringify(this.#p)),closeTransport:()=>this.close()},this.#H,e),await this.#T.prepare()}catch{await this.close().catch(()=>{}),h("usb_browser_scope_unverified")}finally{this.#d=!1}}async bridgeBootStep(e){(this.#a||this.#d||!this.#W||!this.#T)&&h("usb_selection_consumed"),this.#d=!0;try{return this.evidence(),await this.#T.step(e)}catch{await this.close().catch(()=>{}),h("usb_browser_scope_unverified")}finally{this.#d=!1}}async completeBridgeBoot(){(this.#a||this.#d||!this.#W||!this.#T)&&h("usb_selection_consumed"),this.#d=!0;try{return this.evidence(),await this.#T.finish()}catch{await this.close().catch(()=>{}),h("usb_browser_scope_unverified")}finally{this.#d=!1}}async probeCommitStream(){this.#e&&h("usb_selection_consumed"),(this.#S||this.#x)&&h("usb_busy"),(this.#A||this.#a||this.#d||this.#o||this.#_||this.#$||this.#k)&&h("usb_selection_consumed"),this.#k=!0,this.#d=!0;try{this.evidence(),JSON.stringify(await this.#g())!==JSON.stringify(this.#p)&&h("usb_selection_changed"),this.#C=new Ct({live:()=>(this.evidence(),!0),open:s=>(this.evidence(),this.#c.createSocket(Sn(s))),closeTransport:()=>this.close()});let e=await this.#C.probe();return JSON.stringify(await this.#g())!==JSON.stringify(this.#p)&&h("usb_selection_changed"),this.evidence(),e}catch{await this.close().catch(()=>{}),h("usb_browser_scope_unverified")}finally{this.#d=!1}}async beginCommit(e){(this.#S||this.#x)&&h("usb_busy"),(this.#A||this.#a||this.#d||this.#o||this.#_||this.#$||this.#L||!this.#k||!this.#C)&&h("usb_selection_consumed"),this.#L=!0,this.#d=!0;try{let s=this.evidence(),a={kind:"browser_webusb",usb_serial:s.serial,wlan_mac:s.wlan_mac,boot_id:s.boot_id,co2_type:s.co2_type,stock_version:s.stock_version};return(e?.channel_nonce!==this.#l||!e.meta?.target||Object.keys(e.meta.target).sort().join()!==Object.keys(a).sort().join()||Object.keys(a).some(i=>e.meta.target[i]!==a[i]))&&h("usb_selection_changed"),this.#E=new Ns({scope:i=>this.#Y(i),closeTransport:()=>this.close()},this.#C,e),await this.#E.prepare()}catch{await this.close().catch(()=>{}),h("usb_browser_scope_unverified")}finally{this.#d=!1}}async#he(e,...s){(this.#a||this.#d||!this.#E)&&h("usb_browser_scope_unverified"),this.#d=!0;try{return this.evidence(),await this.#E[e](...s)}catch{await this.close().catch(()=>{}),h("usb_browser_scope_unverified")}finally{this.#d=!1}}commitStep(e){return this.#he("step",e)}finishCommit(){return this.#he("finish")}async probeInitialRamStream(){this.#e&&h("usb_selection_consumed"),(this.#S||this.#x)&&h("usb_busy"),(this.#a||this.#d||this.#o||this.#_||this.#$||this.#k||this.#A)&&h("usb_selection_consumed"),this.#A=!0,this.#d=!0;try{this.evidence(),JSON.stringify(await this.#g())!==JSON.stringify(this.#p)&&h("usb_selection_changed"),this.#D=new St({live:()=>(this.evidence(),!0),open:s=>(this.evidence(),this.#c.createSocket(an(s))),closeTransport:()=>this.close()});let e=await this.#D.probe();return JSON.stringify(await this.#g())!==JSON.stringify(this.#p)&&h("usb_selection_changed"),this.evidence(),e}catch{await this.close().catch(()=>{}),h("usb_browser_scope_unverified")}finally{this.#d=!1}}async beginInitialRam(e){(this.#S||this.#x)&&h("usb_busy"),(this.#a||this.#d||this.#o||this.#_||this.#$||this.#L||this.#k||this.#M||!this.#A||!this.#D)&&h("usb_selection_consumed"),this.#M=!0,this.#d=!0;try{e=JSON.parse(JSON.stringify(e));let s=this.evidence(),a={kind:"browser_webusb",usb_serial:s.serial,wlan_mac:s.wlan_mac,boot_id:s.boot_id,co2_type:s.co2_type,stock_version:s.stock_version},i=e?.context?.meta?.target;(e?.channel_nonce!==this.#l||!i||Object.keys(i).sort().join()!==Object.keys(a).sort().join()||Object.keys(a).some(r=>i[r]!==a[r])||typeof this.#s.createSyncSocket!="function"||typeof this.#s.pushV1!="function")&&h("usb_selection_changed"),this.#F=new As({read:r=>this.#y(r),preparation:r=>this.#ie(r),openSync:()=>this.#R(async()=>{let r=await this.#c.createSocket("sync:");this.#a&&(await this.#j(()=>r.close()),h("usb_selection_consumed"));try{return this.#s.createSyncSocket(r)}catch{throw await this.#j(()=>r.close()),Error()}},5e3),pushV1:r=>this.#s.pushV1(r)},this.#D,e);let n=await this.#F.prepare();return this.#I=e,n}catch{await this.close().catch(()=>{}),h("usb_browser_scope_unverified")}finally{this.#d=!1}}async#ue(e,...s){(this.#a||this.#d||!this.#F)&&h("usb_browser_scope_unverified"),this.#d=!0;try{return this.evidence(),await this.#F[e](...s)}catch{await this.close().catch(()=>{}),h("usb_browser_scope_unverified")}finally{this.#d=!1}}initialRamAppend(e,s){return this.#ue("append",e,s)}async finishInitialRam(){let e=await this.#ue("finish");return this.#O=JSON.parse(JSON.stringify(e)),e}async startInitialGuardian(){(this.#S||this.#x)&&h("usb_busy"),(this.#a||this.#d||!this.#O||!this.#I||this.#se)&&(await this.close().catch(()=>{}),h("usb_browser_scope_unverified")),this.#se=!0,this.#d=!0;try{this.evidence();let e=await this.#ie(this.#I.context.meta);this.#K=new Cs({live:()=>(this.evidence(),!0),open:a=>(this.evidence(),this.#c.createSocket(un(a))),closeTransport:()=>this.close()});let s=await this.#K.start(this.#I,e,this.#O);return this.evidence(),this.#U=JSON.parse(JSON.stringify(s)),this.#Q=!0,s}catch{await this.close().catch(()=>{}),h("usb_browser_scope_unverified")}finally{this.#d=!1}}async finishInitialGuardian(){(this.#a||this.#d||this.#o||this.#_||!this.#Q||this.#P)&&(await this.close().catch(()=>{}),h("usb_browser_scope_unverified")),this.#P=!0,this.#d=!0;try{this.evidence();let e=await this.#K.finish();return this.evidence(),this.#X=JSON.parse(JSON.stringify(e)),e}catch{await this.close().catch(()=>{}),h("usb_browser_scope_unverified")}finally{this.#d=!1}}async observeInitialGuardianReturn(){(this.#a||this.#d||this.#o||this.#_||!this.#X||!this.#P||this.#oe||this.#z>=32)&&(await this.close().catch(()=>{}),h("usb_browser_scope_unverified")),this.#oe=!0,this.#z++,this.#d=!0;let e=performance.now();try{this.evidence();let s=await kn({read:async a=>{this.evidence(),performance.now()-e>5e3&&h("usb_browser_scope_unverified");let i=await this.#y(a);return this.evidence(),i}},this.#I,this.#O,this.#U);return this.evidence(),performance.now()-e>5e3&&h("usb_browser_scope_unverified"),this.#Z=JSON.parse(JSON.stringify(s)),s}catch{await this.close().catch(()=>{}),h("usb_browser_scope_unverified")}finally{this.#d=!1}}async closeInitialGuardianReturn(){(this.#a||this.#d||this.#o||this.#_||!this.#Z||!this.#X||this.#de)&&h("usb_browser_scope_unverified"),this.#de=!0,this.#d=!0;let e=JSON.parse(JSON.stringify(this.#Z));try{return this.evidence(),await this.close(),{kind:"browser_initial_return_closed",observation:e,transport_closed:!0,context_only:!0}}catch{await this.close().catch(()=>{}),h("usb_close_unverified")}finally{this.#d=!1}}async observeInitialGuardianProcesses(){(this.#a||this.#d||!this.#Q||this.#P||this.#z>=32)&&(await this.close().catch(()=>{}),h("usb_browser_scope_unverified")),this.#z++,this.#d=!0;try{this.evidence();let e=Kt(this.#I,this.#O,this.#U),s={};for(let[a,i]of Object.entries(e))this.evidence(),s[a]=await this.#y(i);return this.evidence(),Is(this.#I,this.#O,this.#U,s)}catch{await this.close().catch(()=>{}),h("usb_browser_scope_unverified")}finally{this.#d=!1}}async observeInitialGuardianScope(){(this.#a||this.#d||!this.#Q||this.#P||this.#z>=32)&&(await this.close().catch(()=>{}),h("usb_browser_scope_unverified")),this.#z++,this.#d=!0;let e=performance.now();try{this.evidence();let s=await yn({read:async a=>{this.evidence(),performance.now()-e>5e3&&h("usb_browser_scope_unverified");let i=await this.#y(a);return this.evidence(),i}},this.#I,this.#O,this.#U);return this.evidence(),performance.now()-e>5e3&&h("usb_browser_scope_unverified"),s}catch{await this.close().catch(()=>{}),h("usb_browser_scope_unverified")}finally{this.#d=!1}}async beginStage(e,s){this.#e&&h("usb_selection_consumed"),(this.#S||this.#x)&&h("usb_busy"),(this.#A||this.#a||this.#d||this.#o||this.#_||this.#$||this.#L||this.#k)&&h("usb_selection_consumed"),this.#$=!0;try{let a=this.evidence(),i={kind:"browser_webusb",usb_serial:a.serial,wlan_mac:a.wlan_mac,boot_id:a.boot_id,co2_type:a.co2_type,stock_version:a.stock_version};(!e?.target||Object.keys(e.target).sort().join()!==Object.keys(i).sort().join()||Object.keys(i).some(o=>e.target[o]!==i[o])||!s||Object.keys(s).sort().join()!==this.#i.files.map(o=>o.path).sort().join()||this.#i.files.some(o=>s[o.path]?.size!==o.size||s[o.path]?.sha256!==o.sha256)||typeof this.#s.createSyncSocket!="function"||typeof this.#s.pushV1!="function")&&h("usb_channel_unverified");let n=async()=>(this.evidence(),JSON.stringify(await this.#g())===JSON.stringify(this.#p)),r=async()=>{for(let o of this.#i.files)if(!_t(await this.#y(o.command),o))return!1;return!0};return this.#f=new bs({read:o=>this.#y(o),identity:n,inventory:r,initial:async(o,d)=>{if(!await n()||!await r()||await this.#y(this.#i.absent_install)!=="")return!1;let c=(await this.#y("stat -f -c '%t %a %S' /data")).split(/\s+/);if(c.length!==3||c[0]!=="ef53"||!/^[0-9]+$/.test(c[1])||!/^[0-9]+$/.test(c[2]))return!1;let l=Number(c[1]),_=Number(c[2]);return Number.isSafeInteger(l)&&l>=0&&Number.isSafeInteger(_)&&_>=512&&_<=65536&&Number.isSafeInteger(l*_)&&l*_>=d&&await n()},openSync:()=>this.#R(async()=>{let o=await this.#c.createSocket("sync:");this.#a&&(await this.#j(()=>o.close()),h("usb_selection_consumed"));try{return this.#s.createSyncSocket(o)}catch{throw await this.#j(()=>o.close()),Error()}},5e3),pushV1:o=>this.#s.pushV1(o),closeTransport:()=>this.close()},e,s),await this.#f.prepare()}catch{await this.close().catch(()=>{}),h("usb_browser_stage_unverified")}}async#ee(e,...s){(this.#a||!this.#f)&&h("usb_browser_stage_unverified");try{return this.evidence(),await this.#f[e](...s)}catch{await this.close().catch(()=>{}),h("usb_browser_stage_unverified")}}stageBeginFile(e){return this.#ee("begin",e)}stageAppend(e,s,a){return this.#ee("append",e,s,a)}stageFinishFile(e){return this.#ee("finishFile",e)}finishStage(){return this.#ee("finish")}async openApi(){return this.#e&&h("usb_selection_consumed"),(this.#S||this.#x)&&h("usb_busy"),(this.#A||this.#d||this.#$||this.#k||this.#_||this.#a||this.#w>=(this.#e?1024:16))&&h("usb_selection_consumed"),this.#te()}async openInitialGuardianApi(){return this.#e&&h("usb_selection_consumed"),(this.#a||this.#d||this.#o||this.#_||!this.#Q||this.#P||this.#w>=(this.#e?1024:16))&&h("usb_selection_consumed"),await this.observeInitialGuardianScope(),(this.#a||this.#d||this.#o||this.#_||this.#P)&&h("usb_selection_consumed"),this.#te()}async#te(){this.#_=!0,this.#w++;try{this.evidence();let e=await this.#g();JSON.stringify(e)!==JSON.stringify(this.#p)&&h("usb_selection_changed");let s=await this.#R(async()=>{let a=await this.#c.createSocket("tcp:6053");return this.#a&&(await this.#j(()=>a.close()),h("usb_selection_consumed")),a},5e3);return this.#o=s,s}catch{await this.close(),h("usb_channel_unverified")}}async closeApi(){(!this.#o||this.#a||this.#d)&&h("usb_channel_unverified");let e=this.#o;this.#o=void 0;try{await this.#j(()=>e.close()),this.#a&&h("usb_selection_consumed"),this.#_=!1}catch{await this.close(),h("usb_close_unverified")}}close(){if(this.#u)return this.#u;this.#a=!0,clearTimeout(this.#v),this.#v=void 0;let e=this.#c,s=this.#r,a=this.#o;this.#c=this.#r=this.#o=void 0,this.#u=(async()=>{let u=!1;if(a)try{await this.#j(()=>a.close())}catch{u=!0}if(e)try{await this.#j(()=>e.close())}catch{u=!0}else if(s)try{await this.#j(async()=>{(await Promise.allSettled([s.readable.cancel(),s.writable.close()])).some(g=>g.status==="rejected")&&h("usb_close_unverified")})}catch{u=!0}u&&h("usb_close_unverified")})();let i=this.#f;i&&this.#u.finally(()=>i.close()).catch(()=>{});let n=this.#E,r=this.#C;(n||r)&&this.#u.finally(()=>Promise.all([n?.close(),r?.close()])).catch(()=>{});let o=this.#N,d=this.#G;(o||d)&&this.#u.finally(()=>Promise.all([o?.close(),d?.close()])).catch(()=>{});let c=this.#T,l=this.#H;(c||l)&&this.#u.finally(()=>Promise.all([c?.close(),l?.close()])).catch(()=>{});let _=this.#F,b=this.#D;(_||b)&&this.#u.finally(()=>Promise.all([_?.close(),b?.close()])).catch(()=>{});let p=this.#K;return this.#J=this.#B=void 0,this.#I=this.#O=this.#U=this.#X=this.#Z=void 0,p&&this.#u.finally(()=>p.close()).catch(()=>{}),this.#u}};var y=()=>{throw{code:"usb_channel_unverified"}};async function ni(t){let e;try{return await Promise.race([Promise.resolve().then(t),new Promise((s,a)=>{e=setTimeout(()=>a({code:"usb_close_unverified"}),2e3)})])}finally{clearTimeout(e)}}function ri(t){(typeof t!="string"||t.length>4*Math.ceil(65536/3))&&y();let e;try{e=Uint8Array.from(atob(t),s=>s.charCodeAt(0))}catch{y()}return(e.length>65536||btoa(String.fromCharCode(...e))!==t)&&y(),e}function No(t){return btoa(String.fromCharCode(...t))}var Ps=class{#e=!1;#t=2048;#s=!1;#i=!1;#n=!1;#a;#h=new Set;#r;#c;#u;#l=new Uint8Array;#b=!1;#p=!1;#m=!1;#v;#o=!1;#_=!1;#w=!1;#d=!1;#f=!1;#$=!1;#q=!1;#k=!1;#L=!1;#C=!1;#E=!1;constructor(e,{purpose:s="standard"}={}){["standard","full-ui"].includes(s)||y(),this.#a=e,this.#e=s==="full-ui",this.#t=this.#e?131072:2048}async dispatch(e){(this.#$||!e||Object.keys(e).sort().join()!==["id","operation","data"].sort().join()||typeof e.id!="string"||!/^[a-f0-9]{32}$/.test(e.id)||this.#h.has(e.id)||this.#h.size>=this.#t)&&(await this.close(),y()),this.#h.add(e.id);let s=null;try{this.#e&&!["full-ui-scope","api-open","api-read","api-write","api-close","channel-close"].includes(e.operation)&&y();let a=this.#k&&this.#L&&!this.#C,i=["api-open","api-read","api-write","api-close"].includes(e.operation);if(this.#o&&e.operation!=="channel-close"&&!(this.#E&&(a||this.#i)&&this.#r&&e.operation==="api-read")&&y(),this.#i&&!["pm-stream-check","pm-prepare","pm-step","pm-complete","boot-observe","channel-close","api-open","api-read","api-write","api-close"].includes(e.operation)&&y(),this.#n&&!["pm-prepare","pm-step","pm-complete","boot-observe","channel-close"].includes(e.operation)&&y(),this.#s&&!["bridge-boot-preparation","bridge-boot-prepare","bridge-boot-step","bridge-boot-complete","channel-close"].includes(e.operation)&&y(),this.#b&&!["stage-file-begin","stage-chunk","stage-file-finish","stage-complete","channel-close"].includes(e.operation)&&y(),this.#m&&!["ram-chunk","ram-complete","guardian-start","guardian-finish","guardian-process-observe","guardian-scope-observe","guardian-return-observe","guardian-return-close","channel-close"].includes(e.operation)&&!(a&&i)&&y(),this.#k&&!["guardian-finish","guardian-process-observe","guardian-scope-observe","guardian-return-observe","guardian-return-close","channel-close"].includes(e.operation)&&!(a&&i)&&y(),this.#p&&!["commit-step","commit-complete","channel-close"].includes(e.operation)&&y(),e.operation==="full-ui-scope"){(!this.#e||this.#_||this.#r||this.#f||!e.data||Object.keys(e.data).join()!=="context")&&y(),this.#o=!0;try{s=await this.#a.observeFullUiScope(e.data.context)}finally{this.#o=!1}}else if(["scope-check","stage-admission"].includes(e.operation)&&e.data===null){(this.#_||this.#r||this.#f)&&y(),this.#o=!0;try{s=await(e.operation==="scope-check"?this.#a.checkInitialScope():this.#a.checkStageScope())}finally{this.#o=!1}}else if(e.operation==="disabled-scope"){(this.#_||this.#r||this.#f||!e.data||Object.keys(e.data).join()!=="meta")&&y(),this.#o=!0;try{s=await this.#a.checkDisabledScope(e.data.meta)}finally{this.#o=!1}}else if(e.operation==="pm-stream-check"){(e.data!==null||!this.#i||this.#n||this.#_||this.#r||this.#f)&&y(),this.#n=!0,this.#o=!0;try{s=await this.#a.probePmBootStream()}finally{this.#o=!1}}else if(e.operation==="pm-prepare"){(!this.#n||this.#_||this.#r||this.#f||!e.data||Object.keys(e.data).join()!=="packet")&&y(),this.#o=!0;try{s=await this.#a.beginPmBoot(e.data.packet)}finally{this.#o=!1}}else if(e.operation==="pm-step"){(!this.#n||this.#_||this.#r||this.#f||!e.data||Object.keys(e.data).join()!=="phase")&&y(),this.#o=!0;try{s=await this.#a.pmBootStep(e.data.phase)}finally{this.#o=!1}}else if(e.operation==="pm-complete"){(!this.#n||e.data!==null||this.#_||this.#r||this.#f)&&y(),this.#o=!0;try{s=await this.#a.completePmBoot()}finally{this.#o=!1}}else if(e.operation==="boot-observe"){(this.#_||this.#f||this.#d||!e.data||Object.keys(e.data).join()!=="context")&&y(),this.#i=!0,this.#o=!0,this.#E=!0;try{s=await this.#a.observeBridgeBoot(e.data.context)}finally{this.#o=!1,this.#E=!1}}else if(e.operation==="bridge-boot-stream-check"){(e.data!==null||this.#_||this.#r||this.#f||this.#s)&&y(),this.#s=!0,this.#o=!0;try{s=await this.#a.probeBridgeBootStream()}finally{this.#o=!1}}else if(e.operation==="bridge-boot-prepare"){(!this.#s||this.#_||this.#r||this.#f||!e.data||Object.keys(e.data).join()!=="packet")&&y(),this.#o=!0;try{s=await this.#a.beginBridgeBoot(e.data.packet)}finally{this.#o=!1}}else if(e.operation==="bridge-boot-step"){(!this.#s||this.#_||this.#r||this.#f||!e.data||Object.keys(e.data).join()!=="phase")&&y(),this.#o=!0;try{s=await this.#a.bridgeBootStep(e.data.phase)}finally{this.#o=!1}}else if(e.operation==="bridge-boot-complete"){(!this.#s||e.data!==null||this.#_||this.#r||this.#f)&&y(),this.#o=!0;try{s=await this.#a.completeBridgeBoot()}finally{this.#o=!1}}else if(e.operation==="bridge-boot-preparation"){(this.#_||this.#r||this.#f||!e.data||Object.keys(e.data).sort().join()!=="meta,trial_marker")&&y(),this.#o=!0;try{s=await this.#a.checkBridgeBootPreparation(e.data.meta,e.data.trial_marker)}finally{this.#o=!1}}else if(e.operation==="initial-trial-preparation"){(this.#_||this.#r||this.#f||!e.data||Object.keys(e.data).join()!=="meta")&&y(),this.#o=!0;try{s=await this.#a.checkInitialTrialPreparation(e.data.meta)}finally{this.#o=!1}}else if(e.operation==="ram-stream-check"){(e.data!==null||this.#_||this.#r||this.#f)&&y(),this.#o=!0;try{s=await this.#a.probeInitialRamStream()}finally{this.#o=!1}}else if(e.operation==="ram-prepare"){(this.#_||this.#r||this.#f||!e.data||Object.keys(e.data).join()!=="packet")&&y(),this.#m=!0,this.#o=!0;try{s=await this.#a.beginInitialRam(e.data.packet)}finally{this.#o=!1}}else if(e.operation==="ram-chunk"||e.operation==="ram-complete"){(!this.#m||this.#_||this.#r||this.#f)&&y(),this.#o=!0;try{if(e.operation==="ram-complete")(e.data!==null||this.#q)&&y(),s=await this.#a.finishInitialRam(),this.#q=!0;else{(!e.data||Object.keys(e.data).sort().join()!==["offset","body"].sort().join()||!Number.isInteger(e.data.offset)||e.data.offset<0)&&y();let n=ri(e.data.body);n.length||y(),s=await this.#a.initialRamAppend(e.data.offset,n)}}finally{this.#o=!1}}else if(["guardian-start","guardian-finish","guardian-process-observe","guardian-scope-observe","guardian-return-observe","guardian-return-close"].includes(e.operation)){let n=e.operation==="guardian-scope-observe"&&a&&!this.#d;(e.data!==null||!this.#q||this.#_||this.#f||this.#r&&!n||e.operation==="guardian-scope-observe"&&this.#d)&&y(),this.#o=!0,this.#E=e.operation==="guardian-scope-observe";try{e.operation==="guardian-start"?(this.#k&&y(),this.#k=!0,s=await this.#a.startInitialGuardian(),this.#L=!0):e.operation==="guardian-finish"?((!this.#L||this.#C)&&y(),this.#C=!0,s=await this.#a.finishInitialGuardian()):e.operation==="guardian-return-close"?((!this.#L||!this.#C)&&y(),s=await this.#a.closeInitialGuardianReturn()):e.operation==="guardian-return-observe"?((!this.#L||!this.#C)&&y(),s=await this.#a.observeInitialGuardianReturn()):((!this.#L||this.#C)&&y(),s=await(e.operation==="guardian-scope-observe"?this.#a.observeInitialGuardianScope():this.#a.observeInitialGuardianProcesses()))}finally{this.#o=!1,this.#E=!1}}else if(e.operation==="commit-stream-check"){(e.data!==null||this.#_||this.#r||this.#f)&&y(),this.#o=!0;try{s=await this.#a.probeCommitStream()}finally{this.#o=!1}}else if(e.operation==="commit-prepare"){(this.#_||this.#r||this.#f||!e.data||Object.keys(e.data).join()!=="packet")&&y(),this.#p=!0,this.#o=!0;try{s=await this.#a.beginCommit(e.data.packet)}finally{this.#o=!1}}else if(e.operation==="commit-step"||e.operation==="commit-complete"){(!this.#p||this.#_||this.#r||this.#f)&&y(),this.#o=!0;try{e.operation==="commit-step"?((!e.data||Object.keys(e.data).join()!=="phase"||!["claim","watchdog","start"].includes(e.data.phase))&&y(),s=await this.#a.commitStep(e.data.phase)):(e.data!==null&&y(),s=await this.#a.finishCommit())}finally{this.#o=!1}}else if(e.operation==="stage-prepare"){(this.#_||this.#r||this.#f||!e.data||Object.keys(e.data).sort().join()!==["packet","stock_files"].sort().join())&&y(),this.#b=!0,this.#o=!0;try{s=await this.#a.beginStage(e.data.packet,e.data.stock_files)}finally{this.#o=!1}}else if(["stage-file-begin","stage-chunk","stage-file-finish","stage-complete"].includes(e.operation)){(!this.#b||this.#_||this.#r||this.#f)&&y(),this.#o=!0;try{if(e.operation==="stage-complete")e.data!==null&&y(),s=await this.#a.finishStage();else{let n=e.operation==="stage-chunk"?["role","offset","body"]:["role"];if((!e.data||Object.keys(e.data).sort().join()!==n.sort().join()||typeof e.data.role!="string")&&y(),e.operation==="stage-chunk"){let r=ri(e.data.body);(!r.length||!Number.isInteger(e.data.offset)||e.data.offset<0)&&y(),s=await this.#a.stageAppend(e.data.role,e.data.offset,r)}else s=await this.#a[e.operation==="stage-file-begin"?"stageBeginFile":"stageFinishFile"](e.data.role)}}finally{this.#o=!1}}else if(e.operation==="api-open"&&e.data===null){(this.#_||this.#r||this.#f)&&y(),this.#_=!0;try{this.#r=await(this.#e?this.#a.openFullUiApi():this.#i?this.#a.openBridgeBootApi():a?this.#a.openInitialGuardianApi():this.#a.openApi());let n={kind:"browser_full_ui_api_waiting",socket_open_issued:!1,listener_absence_checked:!0};this.#e&&this.#r?.kind===n.kind?((Object.keys(this.#r).sort().join()!==Object.keys(n).sort().join()||Object.keys(n).some(r=>this.#r[r]!==n[r]))&&y(),s=n,this.#r=void 0):(this.#c=this.#r.readable.getReader(),this.#u=this.#r.writable.getWriter())}finally{this.#_=!1}}else if(e.operation==="api-read"){(!this.#c||this.#w||this.#f||!e.data||Object.keys(e.data).join()!=="max_bytes"||!Number.isInteger(e.data.max_bytes)||e.data.max_bytes<1||e.data.max_bytes>65536)&&y(),this.#w=!0;try{if(!this.#l.length){let{value:r,done:o}=await this.#c.read();o||((!(r instanceof Uint8Array)||!r.length||r.length>1048576)&&y(),this.#l=r)}let n=Math.min(e.data.max_bytes,this.#l.length);s=No(this.#l.slice(0,n)),this.#l=this.#l.slice(n)}finally{this.#w=!1}}else if(e.operation==="api-write"){(!this.#u||this.#d||this.#f)&&y();let n=ri(e.data);n.length||y(),this.#d=!0;try{await this.#u.write(n)}finally{this.#d=!1}}else if(e.operation==="api-close"&&e.data===null){(!this.#r||this.#_||this.#d||this.#f)&&y(),this.#f=!0;try{await ni(()=>this.#c.cancel()),this.#c.releaseLock(),this.#c=void 0,this.#u.releaseLock(),this.#u=void 0,await this.#a.closeApi(),this.#r=void 0,this.#l=new Uint8Array}finally{this.#f=!1}}else e.operation==="channel-close"&&e.data===null?await this.close():y();return{id:e.id,ok:!0,data:s}}catch{return await this.close().catch(()=>{}),{id:e.id,ok:!1,data:null}}}close(){return this.#v?this.#v:(this.#$=!0,this.#v=(async()=>{try{await ni(()=>this.#a.close())}finally{if(this.#c){try{await ni(()=>this.#c.cancel()),this.#c.releaseLock()}catch{}this.#c=void 0}if(this.#u){try{this.#u.releaseLock()}catch{}this.#u=void 0}this.#r=void 0,this.#l=new Uint8Array}})(),this.#v)}};function To(t,e){return oi(t,e,"standard")}function Po(t,e){return oi(t,e,"review")}function Ro(t,e){return oi(t,e,"full-ui")}async function oi(t,e,s){let a,i=new Ps(t,{purpose:s==="full-ui"?"full-ui":"standard"});try{let u=await(s==="full-ui"?t.selectForFullUiReview():s==="review"?t.selectForReview():t.select());if(a=await e("browser/open",s==="full-ui"?{evidence:u,purpose:"full-ui"}:{evidence:u}),!a||Object.keys(a).sort().join()!==["channel_id","state","writer_enabled"].sort().join()||typeof a.channel_id!="string"||!/^[a-f0-9]{32}$/.test(a.channel_id)||a.state!=="registered"||a.writer_enabled!==!1)throw Error()}catch{throw await i.close().catch(()=>{}),{code:"usb_channel_unverified"}}let n=a.channel_id,r=new Set,o=!1,d=!1,c=!1,l;function _(){return l||(o=!0,l=(async()=>{await i.close().catch(()=>{c=!0});try{(await e("browser/close",{channel_id:n}))?.state!=="retired"&&(c=!0)}catch{c=!0}return{state:c?"unverified":"closed"}})(),l)}async function b(u){try{let f=await i.dispatch(u);if(o)return;if((await e("browser/answer",{channel_id:n,frame:f}))?.state!=="accepted"||f.ok!==!0)throw Error();u.operation==="channel-close"&&(o=!0)}catch{c=!0,await _()}}let p=(async()=>{try{for(;!o&&!d;){if(r.size>=2){await Promise.race(r);continue}let u=await e("browser/poll",{channel_id:n});if(o)break;if(!u||Object.keys(u).join()!=="request")throw Error();if(u.request!==null){u.request.operation==="channel-close"&&(d=!0);let f=b(u.request);r.add(f),f.finally(()=>r.delete(f))}}}catch{o||(c=!0)}finally{d&&!c&&await Promise.allSettled(r),await _(),await Promise.allSettled(r)}return{state:c?"unverified":"closed"}})();return Object.freeze({channel_id:n,done:p,close:_})}var L=class{#e;get promise(){return this.#e}#t;#s;#i="running";get state(){return this.#i}constructor(){this.#e=new Promise((e,s)=>{this.#t=e,this.#s=s})}resolve=e=>{this.#t(e),this.#i="resolved"};reject=e=>{this.#s(e),this.#i="rejected"}};var Rs=class{nextId;pendingResolvers=new Map;constructor(e=0){this.nextId=e}add(){let e=this.nextId++,s=new L;return this.pendingResolvers.set(e,s),[e,s.promise]}getResolver(e){if(!this.pendingResolvers.has(e))return null;let s=this.pendingResolvers.get(e);return this.pendingResolvers.delete(e),s}resolve(e,s){let a=this.getResolver(e);return a!==null?(a.resolve(s),!0):!1}reject(e,s){let a=this.getResolver(e);return a!==null?(a.reject(s),!0):!1}};function An(t){return new Promise(e=>{globalThis.setTimeout(()=>e(),t)})}function fe(t){return typeof t=="object"&&t!==null&&"then"in t}function di(t,e){for(;;){let{done:s,value:a}=t.next(e);if(s)return a;if(fe(a))return a.then(i=>di(t,{resolved:i}),i=>di(t,{error:i}));e=a}}function Et(t,e){function s(...a){let i=t.call(this,function*(n){if(fe(n)){let r=yield n;if("resolved"in r)return r.resolved;throw r.error}return n},...a);return di(i,void 0)}return e?s.bind(e):s}function jn(t){return(e,s)=>{if("buffer"in s){let a=t(e,s);return s.buffer.set(a,s.index),a.length}else return t(e,s)}}function Cn(t,e){return(s,a)=>{if("buffer"in a)return a.index??=0,e(s,a),t;{let i=new Uint8Array(t);return e(s,{buffer:i,index:0,littleEndian:a.littleEndian}),i}}}function Bo(t,e,s,a,i){let n={size:t,type:e,serialize:e==="default"?jn(s):Cn(t,s),deserialize:Et(a),omitInit:i?.omitInit};return i?.init&&(n.init=i.init),n}var et=Bo;var N=new Uint8Array(0);function Uo(t,e,s,a){e.length<a?(t.set(e,s),t.fill(0,s+e.length,s+a)):e.length===a?t.set(e,s):t.set(e.subarray(0,a),s)}function me(t,e){if(typeof t=="number"){let i,n,r;return t===0?(i=()=>{},e?n=function*(){return e.convert(N)}:n=function*(){return N}):(i=(o,{buffer:d,index:c})=>Uo(d,o,c,t),e?(n=function*(o,d){let c=d.readExactly(t);return e.convert(yield*o(c))},r=o=>e.back(o)):n=function*(o,d){return d.readExactly(t)}),et(t,"byob",i,n,{init:r})}if((typeof t=="object"||typeof t=="function")&&"serialize"in t){let i,n;return e?(i=function*(r,o,d){let c=yield*r(t.deserialize(o,d)),l=c!==0?o.readExactly(c):N;return e.convert(yield*r(l))},n=r=>e.back(r)):i=function*(r,o,d){let c=yield*r(t.deserialize(o,d));return c!==0?o.readExactly(c):N},et(t.size,"default",(r,{littleEndian:o})=>{if(t.type==="default"){let d=t.serialize(r.length,{littleEndian:o});if(r.length===0)return d;let c=new Uint8Array(d.length+r.length);return c.set(d,0),c.set(r,d.length),c}else{let d=new Uint8Array(t.size+r.length);return t.serialize(r.length,{buffer:d,index:0,littleEndian:o}),d.set(r,t.size),d}},i,{init:n})}if(typeof t=="string"){let i,n;return e?(i=function*(r,o,{dependencies:d}){let c=d[t],l=c!==0?o.readExactly(c):N;return e.convert(yield*r(l))},n=(r,o)=>{let d=e.back(r);return o[t]=d.length,d}):(i=function*(r,o,{dependencies:d}){let c=d[t];return c!==0?o.readExactly(c):N},n=(r,o)=>{let d=r;return o[t]=d.length,d}),et(0,"default",r=>r,i,{init:n})}let s,a;return e?(s=function*(i,n,{dependencies:r}){let o=r[t.field],d=t.convert(o),c=d!==0?n.readExactly(d):N;return e.convert(yield*i(c))},a=(i,n)=>{let r=e.back(i);return n[t.field]=t.back(r.length),r}):(s=function*(i,n,{dependencies:r}){let o=r[t.field],d=t.convert(o);return d!==0?n.readExactly(d):N},a=(i,n)=>{let r=i;return n[t.field]=t.back(r.length),r}),et(0,"default",i=>i,s,{init:a})}var je=class extends Error{constructor(){super("ExactReadable ended")}},Bs=class{#e;#t;get position(){return this.#t}constructor(e){this.#e=e,this.#t=0}readExactly(e){if(this.#t+e>this.#e.length)throw new je;let s=this.#e.subarray(this.#t,this.#t+e);return this.#t+=e,s}};var Us=class extends Error{constructor(e){super(e)}},ci=class extends Us{constructor(){super("The underlying readable was ended before the struct was fully deserialized")}},tt=class extends Us{constructor(){super("The underlying readable doesn't contain any more struct")}};function T(t,e){let s=Object.entries(t),a=0,i=!0;for(let[,o]of s)a+=o.size,i&&o.type!=="byob"&&(i=!1);let n=e.littleEndian,r=e.extra?Object.getOwnPropertyDescriptors(e.extra):void 0;return{littleEndian:n,fields:t,extra:e.extra,type:i?"byob":"default",size:a,serialize(o,d){let c={...o};for(let[v,m]of s)if(v in c&&"init"in m){let w=m.init?.(c[v],c);c[v]=w}let l=new Array(s.length),_=new Array(s.length);{let v={littleEndian:n};for(let[m,[w,k]]of s.entries())k.type==="byob"?l[m]=k.size:(_[m]=k.serialize(c[w],v),l[m]=_[m].length)}let b=l.reduce((v,m)=>v+m,0),p,u,f;if(d instanceof Uint8Array){if(d.length<b)throw new Error("Buffer too small");p=!0,u=d,f=0}else if(typeof d=="object"&&"buffer"in d){if(p=!0,u=d.buffer,f=d.index??0,u.length-f<b)throw new Error("Buffer too small")}else p=!1,u=new Uint8Array(b),f=0;let g={buffer:u,index:f,littleEndian:n};for(let[v,[m,w]]of s.entries())_[v]?u.set(_[v],g.index):w.serialize(c[m],g),g.index+=l[v];return p?b:u},deserialize:Et(function*(o,d){let c=d.position,l={},_={dependencies:l,littleEndian:n};try{for(let[b,p]of s)l[b]=yield*o(p.deserialize(d,_))}catch(b){throw b instanceof je?d.position===c?new tt:new ci:b}return r&&Object.defineProperties(l,r),e.postDeserialize?e.postDeserialize.call(l,l):l})}}function st(t,e,s){return T(Object.assign({},t.fields,e),{littleEndian:s?.littleEndian??t.littleEndian,extra:t.extra,postDeserialize:s?.postDeserialize})}function En(t,e,s){return s?t[e]|t[e+1]<<8|t[e+2]<<16|t[e+3]<<24:t[e]<<24|t[e+1]<<16|t[e+2]<<8|t[e+3]}function In(t,e,s,a){a?(t[e]=s,t[e+1]=s>>8,t[e+2]=s>>16,t[e+3]=s>>24):(t[e]=s>>24,t[e+1]=s>>16,t[e+2]=s>>8,t[e+3]=s)}function qn(t,e,s){t[e]=Number(s&0xffn),t[e+1]=Number(s>>8n&0xffn),t[e+2]=Number(s>>16n&0xffn),t[e+3]=Number(s>>24n&0xffn),t[e+4]=Number(s>>32n&0xffn),t[e+5]=Number(s>>40n&0xffn),t[e+6]=Number(s>>48n&0xffn),t[e+7]=Number(s>>56n&0xffn)}function On(t,e,s){t[e]=Number(s>>56n&0xffn),t[e+1]=Number(s>>48n&0xffn),t[e+2]=Number(s>>40n&0xffn),t[e+3]=Number(s>>32n&0xffn),t[e+4]=Number(s>>24n&0xffn),t[e+5]=Number(s>>16n&0xffn),t[e+6]=Number(s>>8n&0xffn),t[e+7]=Number(s&0xffn)}function It(t,e){return(t[e]|t[e+1]<<8|t[e+2]<<16|t[e+3]<<24)>>>0}function Nn(t,e,s){return s?(t[e]|t[e+1]<<8|t[e+2]<<16|t[e+3]<<24)>>>0:(t[e]<<24|t[e+1]<<16|t[e+2]<<8|t[e+3])>>>0}function Tn(t,e,s){t[e]=s,t[e+1]=s>>8,t[e+2]=s>>16,t[e+3]=s>>24}function Pn(t,e,s,a){a?(t[e]=s,t[e+1]=s>>8,t[e+2]=s>>16,t[e+3]=s>>24):(t[e]=s>>24,t[e+1]=s>>16,t[e+2]=s>>8,t[e+3]=s)}function Rn(t,e){return BigInt(t[e])<<56n|BigInt(t[e+1])<<48n|BigInt(t[e+2])<<40n|BigInt(t[e+3])<<32n|BigInt(t[e+4])<<24n|BigInt(t[e+5])<<16n|BigInt(t[e+6])<<8n|BigInt(t[e+7])}function Bn(t,e,s){return s?BigInt(t[e])|BigInt(t[e+1])<<8n|BigInt(t[e+2])<<16n|BigInt(t[e+3])<<24n|BigInt(t[e+4])<<32n|BigInt(t[e+5])<<40n|BigInt(t[e+6])<<48n|BigInt(t[e+7])<<56n:BigInt(t[e])<<56n|BigInt(t[e+1])<<48n|BigInt(t[e+2])<<40n|BigInt(t[e+3])<<32n|BigInt(t[e+4])<<24n|BigInt(t[e+5])<<16n|BigInt(t[e+6])<<8n|BigInt(t[e+7])}function Un(t,e,s,a){a?(t[e]=Number(s&0xffn),t[e+1]=Number(s>>8n&0xffn),t[e+2]=Number(s>>16n&0xffn),t[e+3]=Number(s>>24n&0xffn),t[e+4]=Number(s>>32n&0xffn),t[e+5]=Number(s>>40n&0xffn),t[e+6]=Number(s>>48n&0xffn),t[e+7]=Number(s>>56n&0xffn)):(t[e]=Number(s>>56n&0xffn),t[e+1]=Number(s>>48n&0xffn),t[e+2]=Number(s>>40n&0xffn),t[e+3]=Number(s>>32n&0xffn),t[e+4]=Number(s>>24n&0xffn),t[e+5]=Number(s>>16n&0xffn),t[e+6]=Number(s>>8n&0xffn),t[e+7]=Number(s&0xffn))}function zs(t,e,s){let a=(()=>a);return Object.assign(a,et(t,"byob",e,s)),a}var zn=zs(1,(t,{buffer:e,index:s})=>{e[s]=t},function*(t,e){return(yield*t(e.readExactly(1)))[0]});var $=zs(4,(t,{buffer:e,index:s,littleEndian:a})=>{Pn(e,s,t,a)},function*(t,e,{littleEndian:s}){let a=yield*t(e.readExactly(4));return Nn(a,0,s)}),Mn=zs(4,(t,{buffer:e,index:s,littleEndian:a})=>{In(e,s,t,a)},function*(t,e,{littleEndian:s}){let a=yield*t(e.readExactly(4));return En(a,0,s)}),at=zs(8,(t,{buffer:e,index:s,littleEndian:a})=>{Un(e,s,t,a)},function*(t,e,{littleEndian:s}){let a=yield*t(e.readExactly(8));return Bn(a,0,s)});var{TextEncoder:zo,TextDecoder:Mo}=globalThis,Do=new zo,Fo=new Mo;function se(t){return Do.encode(t)}function ke(t){return Fo.decode(t)}var Be=(t=>{let e=me(t,{convert:ke,back:se});return e.as=()=>e,e});var{AbortController:Ue}=globalThis,Y=(()=>{let{ReadableStream:t}=globalThis;return t.from||(t.from=function(e){let s=Symbol.asyncIterator in e?e[Symbol.asyncIterator]():e[Symbol.iterator]();return new t({async pull(a){let i=await s.next();if(i.done){a.close();return}a.enqueue(i.value)},async cancel(a){await s.return?.(a)}})}),(!t.prototype[Symbol.asyncIterator]||!t.prototype.values)&&(t.prototype.values=async function*(e){let s=this.getReader();try{for(;;){let{done:a,value:i}=await s.read();if(a)return;yield i}}finally{e?.preventCancel||await s.cancel(),s.releaseLock()}},t.prototype[Symbol.asyncIterator]=t.prototype.values),t})(),{WritableStream:O,TransformStream:Ms}=globalThis;var Ds=class{#e;#t=!1;enqueue(e,s=!1){if(this.#t)throw new Error("TaskQueue is disposed");if(!this.#e)try{let i=e();return fe(i)&&(this.#e=i.then(()=>{},n=>{if(s)throw n})),i}catch(i){if(s){let n=Promise.reject(i);n.catch(()=>{}),this.#e=n}throw i}let a=this.#e.then(()=>{if(this.#t)throw new Error("TaskQueue is disposed");return e()});return this.#e=a.then(()=>{},i=>{if(s||this.#t)throw i}),a}dispose(){this.#t=!0}};var re=class extends Y{constructor(e,s,a){let i,n=new Ds,r=!1,o,d=new Ue,c=!1,l=p=>{if(a?.({source:"producer",operation:"enqueue",value:p,phase:"start"}),d.signal.aborted)return a?.({source:"producer",operation:"enqueue",value:p,phase:"ignored"}),!1;if(i.desiredSize===null)throw i.enqueue(p),new Error("unreachable");return r?(r=!1,i.enqueue(p),a?.({source:"producer",operation:"enqueue",value:p,phase:"complete"}),!0):i.desiredSize<=0?(a?.({source:"producer",operation:"enqueue",value:p,phase:"waiting"}),o=new L,o.promise.then(()=>(i.enqueue(p),a?.({source:"producer",operation:"enqueue",value:p,phase:"complete"}),!0),()=>(a?.({source:"producer",operation:"enqueue",value:p,phase:"ignored"}),!1))):(i.enqueue(p),a?.({source:"producer",operation:"enqueue",value:p,phase:"complete"}),!0)},_=p=>{if(a?.({source:"producer",operation:"close",explicit:p,phase:"start"}),d.signal.aborted||c&&!p){a?.({source:"producer",operation:"close",explicit:p,phase:"ignored"});return}i.close(),c=!0,o?.reject(),a?.({source:"producer",operation:"close",explicit:p,phase:"complete"})},b=(p,u)=>{a?.({source:"producer",operation:"error",explicit:u,phase:"start"}),c=!0,i.error(p),o?.reject(),a?.({source:"producer",operation:"error",explicit:u,phase:"complete"})};super({start:p=>{i=p;let u=e({abortSignal:d.signal,enqueue:async f=>await n.enqueue(()=>l(f)),close(){_(!0)},error(f){b(f,!0)}});!c&&fe(u)&&u.then(()=>_(!1),f=>b(f,!1))},pull:()=>{a?.({source:"consumer",operation:"pull",phase:"start"}),o?(o.resolve(void 0),o=void 0):s?.highWaterMark===0&&(r=!0),a?.({source:"consumer",operation:"pull",phase:"complete"})},cancel:p=>{a?.({source:"consumer",operation:"cancel",phase:"start"}),c=!0,d.abort(p),o?.reject(),a?.({source:"consumer",operation:"cancel",phase:"complete"})}},s)}};function Dn(t){try{let e=t.close();return fe(e)?e.then(()=>!0,()=>!1):!0}catch{return!1}}async function Fn(t){try{return await t.cancel(),!0}catch{return!1}}var xe=class{#e;#t=0;#s=0;#i=0;get position(){return this.#i}stream;reader;constructor(e){this.stream=e,this.reader=e.getReader()}#n(e){if(!this.#e)return;let s=this.#e.subarray(this.#t,this.#t+e);return this.#s>e?(this.#i+=e,this.#t+=e,this.#s-=e,s):(this.#i+=this.#s,this.#e=void 0,this.#t=0,this.#s=0,s)}async#a(e){let{done:s,value:a}=await this.reader.read();if(s)throw new je;return a.length>e?(this.#e=a,this.#t=e,this.#s=a.length-e,this.#i+=e,a.subarray(0,e)):(this.#i+=a.length,a)}iterateExactly(e){let s=this.#e?0:1;return{next:()=>{switch(s){case 0:{let a=this.#n(e);return a.length===e?s=2:(e-=a.length,s=1),{done:!1,value:a}}case 1:return s=3,{done:!1,value:this.#a(e).then(a=>(a.length===e?s=2:(e-=a.length,s=1),a))};case 2:return{done:!0,value:void 0};case 3:throw new Error("Can't call `next` before previous Promise resolves");default:throw new Error("unreachable")}}}}readExactly=Et(function*(e,s){let a,i=0,n=this.#n(s);if(n){if(n.length===s)return n;a=new Uint8Array(s),a.set(n,i),i+=n.length,s-=n.length}else a=new Uint8Array(s);for(;s>0;){let r=yield*e(this.#a(s));a.set(r,i),i+=r.length,s-=r.length}return a});release(){return this.#s>0?new re(async e=>{let s=this.#e.subarray(this.#t);for(await e.enqueue(s),e.abortSignal.addEventListener("abort",()=>{Fn(this.reader)});;){let{done:a,value:i}=await this.reader.read();if(a)return;await e.enqueue(i)}}):(this.reader.releaseLock(),this.stream)}async cancel(e){await this.reader.cancel(e)}};var Fs=class{#e;get readable(){return this.#e}#t;get writable(){return this.#t}constructor(e){let s,a,i=new xe(new re(n=>{s=n}));this.#e=new Y({async pull(n){try{let r=await e(i);n.enqueue(r)}catch(r){if(r instanceof tt){n.close();return}throw r}},cancel:n=>a.error(n)}),this.#t=new O({start(n){a=n},async write(n){await s.enqueue(n)},abort(){s.close()},close(){s.close()}})}};var Ce=class{#e="";#t=new L;#s=new O({write:e=>{this.#e+=e},close:()=>{this.#t.resolve(this.#e),this.#i.enqueue(this.#e),this.#i.close()},abort:e=>{this.#t.reject(e),this.#i.error(e)}});get writable(){return this.#s}#i;#n=new Y({start:e=>{this.#i=e}});get readable(){return this.#n}constructor(){Object.defineProperties(this.#n,{then:{get:()=>this.#t.promise.then.bind(this.#t.promise)},catch:{get:()=>this.#t.promise.catch.bind(this.#t.promise)},finally:{get:()=>this.#t.promise.finally.bind(this.#t.promise)}})}},it=class{#e=[];#t=new L;#s=new O({write:e=>{this.#e.push(e)},close:()=>{let e,s=0;switch(this.#e.length){case 0:e=N;break;case 1:e=this.#e[0];break;default:e=new Uint8Array(this.#e.reduce((a,i)=>a+i.length,0));for(let a of this.#e)e.set(a,s),s+=a.length;break}this.#t.resolve(e),this.#i.enqueue(e),this.#i.close()},abort:e=>{this.#t.reject(e),this.#i.error(e)}});get writable(){return this.#s}#i;#n=new Y({start:e=>{this.#i=e}});get readable(){return this.#n}constructor(){Object.defineProperties(this.#n,{then:{get:()=>this.#t.promise.then.bind(this.#t.promise)},catch:{get:()=>this.#t.promise.catch.bind(this.#t.promise)},finally:{get:()=>this.#t.promise.finally.bind(this.#t.promise)}})}};var qt=class t extends Y{static async enqueue(e,s){let a=new P(s);e.enqueue(a),await a.consumed}constructor(e,s){let a,i;s&&(i={},"highWaterMark"in s&&(i.highWaterMark=s.highWaterMark),"size"in s&&(i.size=n=>s.size(n.value))),super({start(n){return a={enqueue(r){return t.enqueue(n,r)},close(){n.close()},error(r){n.error(r)}},e.start?.(a)},pull(){return e.pull?.(a)},cancel(n){return e.cancel?.(n)}},i)}};var Gs=class extends Y{constructor(e,s,a){let i=e.getReader({mode:"byob"}),n=new Uint8Array(s);super({async pull(r){let{done:o,value:d}=await i.read(n,{min:a});if(o){r.close();return}await qt.enqueue(r,d),n=new Uint8Array(d.buffer)},cancel(r){return i.cancel(r)}})}};var Js=class extends O{constructor(e){let s=e.getWriter();super({write(a){return a.tryConsume(i=>s.write(i))},abort(a){return s.abort(a)},close(){return s.close()}})}};var Ws=class extends O{static async write(e,s){let a=new P(s);await e.write(a),await a.consumed}constructor(e,s){let a;s&&(a={},"highWaterMark"in s&&(a.highWaterMark=s.highWaterMark),"size"in s&&(a.size=i=>s.size(i instanceof P?i.value:i))),super({start(i){return e.start?.(i)},write(i,n){return i.tryConsume(r=>e.write?.(r,n))},abort(i){return e.abort?.(i)},close(){return e.close?.()}},a)}};var{console:Gn}=globalThis,Jn=Gn?.createTask?.bind(Gn)??(()=>({run(t){return t()}}));var P=class{static WritableStream=Ws;static WrapWritableStream=Js;static ReadableStream=qt;static WrapByteReadableStream=Gs;#e;#t;value;consumed;constructor(e){this.#e=Jn("Consumable"),this.value=e,this.#t=new L,this.consumed=this.#t.promise}consume(){this.#t.resolve()}error(e){this.#t.reject(e)}tryConsume(e){try{let s=this.#e.run(()=>e(this.value));return fe(s)?s=s.then(a=>(this.#t.resolve(),a),a=>{throw this.#t.reject(a),a}):this.#t.resolve(),s}catch(s){throw this.#t.reject(s),s}}};var ee={};Zr(ee,{WrapWritableStream:()=>Hs,WritableStream:()=>Qs,getValue:()=>Go,tryConsume:()=>Zt});function Go(t){return t instanceof P?t.value:t}function Zt(t,e){return t instanceof P?t.tryConsume(e):e(t)}var Hs=class extends O{constructor(e){let s=e.getWriter();super({write(a){return Zt(a,i=>s.write(i))},abort(a){return s.abort(a)},close(){return s.close()}})}};var Qs=class extends O{constructor(e,s){let a;s&&(a={},"highWaterMark"in s&&(a.highWaterMark=s.highWaterMark),"size"in s&&(a.size=i=>s.size(i instanceof P?i.value:i))),super({start(i){return e.start?.(i)},write(i,n){return Zt(i,r=>e.write?.(r,n))},abort(i){return e.abort?.(i)},close(){return e.close?.()}},a)}};var Yt=class{#e;#t;#s;#i;constructor(e){this.#e=e,this.#t=new Uint8Array(e),this.#s=0,this.#i=e}*push(e){let s=0,a=e.length;if(this.#s!==0)if(a>=this.#i){if(this.#t.set(e.subarray(0,this.#i),this.#s),s+=this.#i,a-=this.#i,yield this.#t,this.#s=0,this.#i=this.#e,a===0)return}else{this.#t.set(e,this.#s),this.#s+=a,this.#i-=a;return}for(;a>=this.#e;){let i=s+this.#e;yield e.subarray(s,i),s=i,a-=this.#e}a>0&&(this.#t.set(e.subarray(s),this.#s),this.#s+=a,this.#i-=a)}flush(){if(this.#s===0)return;let e=this.#t.subarray(0,this.#s);return this.#s=0,this.#i=this.#e,e}},Vs=class extends Ms{constructor(e,s=!1){let a=s?new Yt(e):void 0;super({async transform(i,n){await ee.tryConsume(i,async r=>{if(a)for(let o of a.push(r))await P.ReadableStream.enqueue(n,o);else{let o=0,d=r.length;for(;d>0;){let c=o+e;await P.ReadableStream.enqueue(n,r.subarray(o,c)),o=c,d-=e}}})},flush(i){if(a){let n=a.flush();n&&i.enqueue(n)}}})}};function Jo(t,e){return"start"in t?t.start(e):typeof t=="function"?t(e):t}var Ks=class extends Y{readable;#e;constructor(e,s){super({start:async a=>{let i=await Jo(e,a);this.readable=i,this.#e=this.readable.getReader()},pull:async a=>{let{done:i,value:n}=await this.#e.read().catch(r=>{throw"error"in e&&e.error(r),r});i?(a.close(),"close"in e&&await e.close?.()):a.enqueue(n)},cancel:async a=>{await this.#e.cancel(a),"cancel"in e&&await e.cancel?.(a)}},s)}};var Wn=()=>{},Xs=class{#e=[];#t=[];#s=!1;get writableClosed(){return this.#s}#i=new L;get closed(){return this.#i.promise}#n;constructor(e){this.#n=e??{}}wrapReadable(e,s){return new Ks({start:a=>(this.#e.push(a),e),cancel:async()=>{await this.close()},close:async()=>{await this.dispose()}},s)}createWritable(e){let s=e.getWriter();return this.#t.push(s),new O({write:async a=>{await s.write(a)},abort:async a=>{await s.abort(a),await this.close()},close:async()=>{await s.close().catch(Wn),await this.close()}})}async close(){if(!this.#s){this.#s=!0,await this.#n.close?.()!==!1&&await this.dispose();for(let e of this.#t)e.close().catch(Wn)}}async dispose(){this.#s=!0,this.#i.resolve();for(let e of this.#e)Dn(e);await this.#n.dispose?.()}};var Hn=globalThis,nt=Hn.TextDecoderStream,Lu=Hn.TextEncoderStream;function Qn(t,e){let s=e.writable.getWriter(),a=e.readable.pipeTo(t);return new O({async write(i){await s.write(i)},async close(){await s.close(),await a}})}var Ot=class extends Fs{constructor(e){super(s=>e.deserialize(s))}};var Zs=class{#e=[];constructor(){this.dispose=this.dispose.bind(this)}addDisposable(e){return this.#e.push(e),e}dispose(){for(let e of this.#e)e.dispose();this.#e=[]}};var rt=class{listeners=[];constructor(){this.event=this.event.bind(this)}addEventListener(e){this.listeners.push(e);let s=()=>{let a=this.listeners.indexOf(e);a!==-1&&this.listeners.splice(a,1)};return s.dispose=s,s}event=(e,s,...a)=>{let i={listener:e,thisArg:s,args:a};return this.addEventListener(i)};fire(e){for(let s of this.listeners.slice())s.listener.call(s.thisArg,e,...s.args)}dispose(){this.listeners.length=0}};var Vn=Symbol("undefined"),Ys=class extends rt{#e=Vn;addEventListener(e){return this.#e!==Vn&&e.listener.call(e.thisArg,this.#e,...e.args),super.addEventListener(e)}fire(e){this.#e=e,super.fire(e)}};var ze=class extends Zs{#e;get adb(){return this.#e}constructor(e){super(),this.#e=e}};var Wo=T({version:$},{littleEndian:!0}),Ho=T({bpp:$,size:$,width:$,height:$,red_offset:$,red_length:$,blue_offset:$,blue_length:$,green_offset:$,green_length:$,alpha_offset:$,alpha_length:$,data:me("size")},{littleEndian:!0}),Qo=T({bpp:$,colorSpace:$,size:$,width:$,height:$,red_offset:$,red_length:$,blue_offset:$,blue_length:$,green_offset:$,green_length:$,alpha_offset:$,alpha_length:$,data:me("size")},{littleEndian:!0}),ea=class extends Error{constructor(e,s){super(e,s)}},li=class extends ea{constructor(e){super(`Unsupported FrameBuffer version ${e}`)}},pi=class extends ea{constructor(){super("FrameBuffer is disabled by current app")}};async function Kn(t){let e=await t.createSocket("framebuffer:"),s=new xe(e.readable),a;try{({version:a}=await Wo.deserialize(s))}catch(i){throw i instanceof tt?new pi:i}switch(a){case 1:return await Ho.deserialize(s);case 2:return await Qo.deserialize(s);default:throw new li(a)}}var ta=class extends ze{reboot(e=""){return this.adb.createSocketAndWait(`reboot:${e}`)}bootloader(){return this.reboot("bootloader")}fastboot(){return this.reboot("fastboot")}recovery(){return this.reboot("recovery")}sideload(){return this.reboot("sideload")}qualcommEdlMode(){return this.reboot("edl")}powerOff(){return this.adb.subprocess.noneProtocol.spawnWaitText(["reboot","-p"])}powerButton(e=!1){let s=["input","keyevent"];return e&&s.push("--longpress"),s.push("POWER"),this.adb.subprocess.noneProtocol.spawnWaitText(s)}samsungOdin(){return this.reboot("download")}};function Xn(t){if(t.buffer instanceof ArrayBuffer)return t;let e=new Uint8Array(t.length);return e.set(t),e}var es=class{#e;#t=[];constructor(e=!1){this.#e=e}wait(){if(!this.#e&&(this.#e=!0,this.#t.length===0))return Promise.resolve();let e=new L;return this.#t.push(e),e.promise}notifyOne(){this.#t.length!==0?this.#t.pop().resolve():this.#e=!1}dispose(){for(let e of this.#t)e.reject(new Error("The AutoResetEvent has been disposed"));this.#t.length=0}};var[Wu,V,Nt]=(()=>{let t=[],e=[];function a(i,n){let r=i.charCodeAt(0),o=n.charCodeAt(0);for(let d=r;d<=o;d+=1)t[d]=e.length,e.push(d)}return a("A","Z"),a("a","z"),a("0","9"),a("+","+"),a("/","/"),[t,e,61]})();function ui(t){let e=t%3,s=e!==0?3-e:0;return[(t+s)/3*4,s]}function Zn(t,e){let[s,a]=ui(t.length);if(e){if(e.length<s)throw new TypeError("output buffer is too small");if(e=e.subarray(0,s),t.buffer!==e.buffer)hi(t,e,a);else if(e.byteOffset+e.length-(a+1)<=t.byteOffset+t.length)hi(t,e,a);else if(e.byteOffset>=t.byteOffset-1)Vo(t,e,a);else throw new TypeError("input and output cannot overlap");return s}else return e=new Uint8Array(s),hi(t,e,a),e}function hi(t,e,s){let a=0,i=0;for(;a<t.length-2;){let n=t[a];a+=1;let r=t[a];a+=1;let o=t[a];a+=1,e[i]=V[n>>2],i+=1,e[i]=V[(n&3)<<4|r>>4],i+=1,e[i]=V[(r&15)<<2|o>>6],i+=1,e[i]=V[o&63],i+=1}if(s===2){let n=t[a];e[i]=V[n>>2],i+=1,e[i]=V[(n&3)<<4],i+=1,e[i]=Nt,i+=1,e[i]=Nt}else if(s===1){let n=t[a];a+=1;let r=t[a];e[i]=V[n>>2],i+=1,e[i]=V[(n&3)<<4|r>>4],i+=1,e[i]=V[(r&15)<<2],i+=1,e[i]=Nt}}function Vo(t,e,s){let a=t.length-1,i=e.length-1;if(s===2){let n=t[a];a-=1,e[i]=Nt,i-=1,e[i]=Nt,i-=1,e[i]=V[(n&3)<<4],i-=1,e[i]=V[n>>2],i-=1}else if(s===1){let n=t[a];a-=1;let r=t[a];a-=1,e[i]=Nt,i-=1,e[i]=V[(n&15)<<2],i-=1,e[i]=V[(r&3)<<4|n>>4],i-=1,e[i]=V[r>>2],i-=1}for(;a>=0;){let n=t[a];a-=1;let r=t[a];a-=1;let o=t[a];a-=1,e[i]=V[n&63],i-=1,e[i]=V[(r&15)<<2|n>>6],i-=1,e[i]=V[(o&3)<<4|r>>4],i-=1,e[i]=V[o>>2],i-=1}}function Ko(t){if(t<48)throw new TypeError(`Invalid hex char ${t}`);if(t<58)return t-48;if(t<65)throw new TypeError(`Invalid hex char ${t}`);if(t<71)return t-55;if(t<97)throw new TypeError(`Invalid hex char ${t}`);if(t<103)return t-87;throw new TypeError(`Invalid hex char ${t}`)}function Yn(t){let e=0;for(let s=0;s<t.length;s+=1)e=e<<4|Ko(t[s]);return e}var er=()=>{};function sa(...t){throw new Error(`Unreachable. Arguments:
`+t.join(`
`))}function tr(t,e){if(t.length!==e.length)return!1;for(let s=0;s<t.length;s+=1)if(t[s]!==e[s])return!1;return!0}var sr=T({length:Be(4),content:Be({field:"length",convert(t){return Number.parseInt(t,16)},back(t){return t.toString(16).padStart(4,"0")}})},{littleEndian:!0}),aa=class extends Error{constructor(e){super(e)}},_i=class extends aa{constructor(){super("ADB reverse tunnel is not supported on this device when connected wirelessly.")}},Xo=st(sr,{},{postDeserialize(t){throw t.content==="more than one device/emulator"?new _i:new aa(t.content)}});function Zo(t){let e=0;for(let s of t){if(s<48||s>57)return e;e=e*10+s-48}return e}var Yo=se("OKAY"),ia=class extends ze{#e=new Map;async createBufferedStream(e){let s=await this.adb.createSocket(e);return new xe(s.readable)}async sendRequest(e){let s=await this.createBufferedStream(e),a=await s.readExactly(4);return tr(a,Yo)||await Xo.deserialize(s),s}async list(){let e=await this.createBufferedStream("reverse:list-forward");return(await sr.deserialize(e)).content.split(`
`).filter(a=>!!a).map(a=>{let[i,n,r]=a.split(" ");return{deviceSerial:i,localName:n,remoteName:r}})}async addExternal(e,s){let a=await this.sendRequest(`reverse:forward:${e};${s}`);if(e.startsWith("tcp:")){let i=a.position;try{let n=Yn(await a.readExactly(4));e=`tcp:${Zo(await a.readExactly(n))}`}catch(n){if(!(n instanceof je&&a.position===i))throw n}}return e}async add(e,s,a){a=await this.adb.transport.addReverseTunnel(s,a);try{return e=await this.addExternal(e,a),this.#e.set(e,a),e}catch(i){throw await this.adb.transport.removeReverseTunnel(a),i}}async remove(e){let s=this.#e.get(e);s&&await this.adb.transport.removeReverseTunnel(s),await this.sendRequest(`reverse:killforward:${e}`)}async removeAll(){await this.adb.transport.clearReverseTunnels(),this.#e.clear(),await this.sendRequest("reverse:killforward-all")}};var na=class{#e;get stdin(){return this.#e.writable}get output(){return this.#e.readable}#t;get exited(){return this.#t}constructor(e,s){if(this.#e=e,s){let a=new L;this.#e.closed.then(()=>a.resolve(void 0),i=>a.reject(i)),s.addEventListener("abort",()=>{a.reject(s.reason),this.#e.close()}),this.#t=a.promise}else this.#t=this.#e.closed}kill(){return this.#e.close()}};var ra=class{#e;#t;#s;get input(){return this.#s}get output(){return this.#e.readable}get exited(){return this.#e.closed}constructor(e){this.#e=e,this.#t=this.#e.writable.getWriter(),this.#s=new ee.WritableStream({write:s=>this.#t.write(s)})}sigint(){return this.#t.write(new Uint8Array([3]))}kill(){return this.#e.close()}};function ts(t){let e="";e+="'";let s=0;for(;;){let a=t.indexOf("'",s);if(a===-1){e+=t.substring(s);break}e+=t.substring(s,a),e+=String.raw`'\''`,s=a+1}return e+="'",e}function oa(t){let e=[],s,a=!1,i=0;for(let n=0,r=t.length;n<r;n+=1){if(a){a=!1;continue}let o=t.charAt(n);switch(o){case" ":!s&&n!==i&&(e.push(t.substring(i,n)),i=n+1);break;case"'":case'"':s?o===s&&(s=void 0):s=o;break;case"\\":a=!0;break}}return i<t.length&&e.push(t.substring(i)),e}var da=class{#e;constructor(e){this.#e=e}spawn(e,s){return s?.throwIfAborted(),typeof e=="string"&&(e=oa(e)),this.#e(e,s)}async spawnWait(e){return await(await this.spawn(e)).output.pipeThrough(new it)}async spawnWaitText(e){return await(await this.spawn(e)).output.pipeThrough(new nt).pipeThrough(new Ce)}};var ca=class extends da{#e;get adb(){return this.#e}constructor(e){super(async(s,a)=>{let i=await this.#e.createSocket(`exec:${s.join(" ")}`);if(a?.aborted)throw await i.close(),a.reason;return new na(i,a)}),this.#e=e}async pty(e){return e===void 0?e="":Array.isArray(e)&&(e=e.join(" ")),new ra(await this.#e.createSocket(`shell:${e}`))}};var B={ShellV2:"shell_v2",Cmd:"cmd",StatV2:"stat_v2",ListV2:"ls_v2",FixedPushMkdir:"fixed_push_mkdir",Abb:"abb",AbbExec:"abb_exec",SendReceiveV2:"sendrecv_v2",DelayedAck:"delayed_ack"};var ve={Stdin:0,Stdout:1,Stderr:2,Exit:3,CloseStdin:4,WindowSizeChange:5},Me=T({id:zn(),data:me($)},{littleEndian:!0});var la=class{#e;#t;#s;get stdin(){return this.#s}#i;get stdout(){return this.#i}#n;get stderr(){return this.#n}#a;get exited(){return this.#a}constructor(e,s){this.#e=e;let a,i;this.#i=new re(r=>{a=r}),this.#n=new re(r=>{i=r});let n=new L;this.#a=n.promise,e.readable.pipeThrough(new Ot(Me)).pipeTo(new O({write:async r=>{switch(r.id){case ve.Exit:n.resolve(r.data[0]);break;case ve.Stdout:await a.enqueue(r.data);break;case ve.Stderr:await i.enqueue(r.data);break;default:break}}})).then(()=>{a.close(),i.close(),n.reject(new Error("Socket ended without exit message"))},r=>{a.error(r),i.error(r),n.reject(r)}),s&&s.addEventListener("abort",()=>{n.reject(s.reason),this.#e.close()}),this.#t=this.#e.writable.getWriter(),this.#s=new ee.WritableStream({write:async r=>{await this.#t.write(Me.serialize({id:ve.Stdin,data:r}))},close:()=>this.#t.write(Me.serialize({id:ve.CloseStdin,data:N}))})}kill(){return this.#e.close()}};var pa=class{#e;#t;#s;get input(){return this.#s}#i;get output(){return this.#i}#n=new L;get exited(){return this.#n.promise}constructor(e){this.#e=e;let s;this.#i=new re(a=>{s=a}),e.readable.pipeThrough(new Ot(Me)).pipeTo(new O({write:async a=>{switch(a.id){case ve.Exit:this.#n.resolve(a.data[0]);break;case ve.Stdout:await s.enqueue(a.data);break}}})).then(()=>{s.close(),this.#n.reject(new Error("Socket ended without exit message"))},a=>{s.error(a),this.#n.reject(a)}),this.#t=this.#e.writable.getWriter(),this.#s=new ee.WritableStream({write:a=>this.#a(a)})}#a(e){return this.#t.write(Me.serialize({id:ve.Stdin,data:e}))}async resize(e,s){await this.#t.write(Me.serialize({id:ve.WindowSizeChange,data:se(`${e}x${s},0x0\0`)}))}sigint(){return this.#a(new Uint8Array([3]))}kill(){return this.#e.close()}};var ha=class{#e;constructor(e){this.#e=e}spawn(e,s){return s?.throwIfAborted(),typeof e=="string"&&(e=oa(e)),this.#e(e,s)}async spawnWait(e){let s=await this.spawn(e),[a,i,n]=await Promise.all([s.stdout.pipeThrough(new it),s.stderr.pipeThrough(new it),s.exited]);return{stdout:a,stderr:i,exitCode:n}}async spawnWaitText(e){let s=await this.spawn(e),[a,i,n]=await Promise.all([s.stdout.pipeThrough(new nt).pipeThrough(new Ce),s.stderr.pipeThrough(new nt).pipeThrough(new Ce),s.exited]);return{stdout:a,stderr:i,exitCode:n}}};var ua=class extends ha{#e;get adb(){return this.#e}get isSupported(){return this.#e.canUseFeature(B.ShellV2)}constructor(e){super(async(s,a)=>{let i=await this.#e.createSocket(`shell,v2,raw:${s.join(" ")}`);if(a?.aborted)throw await i.close(),a.reason;return new la(i,a)}),this.#e=e}async pty(e){let s="shell,v2,pty";return e?.terminalType&&(s+=",TERM="+e.terminalType),s+=":",e&&(typeof e.command=="string"?s+=e.command:Array.isArray(e.command)&&(s+=e.command.join(" "))),new pa(await this.#e.createSocket(s))}};var _a=class{#e;get adb(){return this.#e}#t;get noneProtocol(){return this.#t}#s;get shellProtocol(){return this.#s}constructor(e){this.#e=e,this.#t=new ca(e),e.canUseFeature(B.ShellV2)&&(this.#s=new ua(e))}};function ed(t){let e=new Uint8Array(t.length);for(let s=0;s<t.length;s+=1)e[s]=t.charCodeAt(s);return e}function U(t){let e=ed(t);return It(e,0)}var te={Entry:U("DENT"),Entry2:U("DNT2"),Lstat:U("STAT"),Stat:U("STA2"),Lstat2:U("LST2"),Done:U("DONE"),Data:U("DATA"),Ok:U("OKAY"),Fail:U("FAIL")},bi=class extends Error{},ar=T({message:Be($)},{littleEndian:!0,postDeserialize(t){throw new bi(t.message)}});async function Tt(t,e,s){typeof e=="string"&&(e=U(e));let a=await t.readExactly(4);switch(It(a,0)){case te.Fail:throw await ar.deserialize(t),new Error("Unreachable");case e:return await s.deserialize(t);default:throw new Error(`Expected '${e}', but got '${ke(a)}'`)}}async function*Pt(t,e,s){for(typeof e=="string"&&(e=U(e));;){let a=await t.readExactly(4);switch(It(a,0)){case te.Fail:await ar.deserialize(t),sa();case te.Done:await t.readExactly(s.size);return;case e:yield await s.deserialize(t);break;default:throw new Error(`Expected '${e}' or '${te.Done}', but got '${ke(a)}'`)}}}var ae={List:U("LIST"),ListV2:U("LIS2"),Send:U("SEND"),SendV2:U("SND2"),Lstat:U("STAT"),Stat:U("STA2"),LstatV2:U("LST2"),Data:U("DATA"),Done:U("DONE"),Receive:U("RECV")},ir=T({id:$,arg:$},{littleEndian:!0});async function ne(t,e,s){if(typeof e=="string"&&(e=U(e)),typeof s=="number"){await t.write(ir.serialize({id:e,arg:s}));return}typeof s=="string"&&(s=se(s)),await t.write(ir.serialize({id:e,arg:s.length})),await t.write(s)}var fi={Directory:4,File:8,Link:10},mi=T({mode:$,size:$,mtime:$},{littleEndian:!0,extra:{get type(){return this.mode>>12},get permission(){return this.mode&4095}},postDeserialize(t){if(t.mode===0&&t.size===0&&t.mtime===0)throw new Error("lstat error");return t}}),vi={SUCCESS:0,EACCES:13,EEXIST:17,EFAULT:14,EFBIG:27,EINTR:4,EINVAL:22,EIO:5,EISDIR:21,ELOOP:40,EMFILE:24,ENAMETOOLONG:36,ENFILE:23,ENOENT:2,ENOMEM:12,ENOSPC:28,ENOTDIR:20,EOVERFLOW:75,EPERM:1,EROFS:30,ETXTBSY:26},td=Object.fromEntries(Object.entries(vi).map(([t,e])=>[e,t])),ba=T({error:$(),dev:at,ino:at,mode:$,nlink:$,uid:$,gid:$,size:at,atime:at,mtime:at,ctime:at},{littleEndian:!0,extra:{get type(){return this.mode>>12},get permission(){return this.mode&4095}},postDeserialize(t){if(t.error)throw new Error(td[t.error]);return t}});async function nr(t,e,s){let a=await t.lock();try{if(s)return await ne(a,ae.LstatV2,e),await Tt(a,te.Lstat2,ba);{await ne(a,ae.Lstat,e);let i=await Tt(a,te.Lstat,mi);return{mode:i.mode,size:BigInt(i.size),mtime:BigInt(i.mtime),get type(){return i.type},get permission(){return i.permission}}}}finally{a.release()}}async function rr(t,e){let s=await t.lock();try{return await ne(s,ae.Stat,e),await Tt(s,te.Stat,ba)}finally{s.release()}}var sd=st(mi,{name:Be($)}),ad=st(ba,{name:Be($)});async function*id(t,e){let s=await t.lock();try{await ne(s,ae.ListV2,e);for await(let a of Pt(s,te.Entry2,ad))a.error===vi.SUCCESS&&(yield a)}finally{s.release()}}async function*nd(t,e){let s=await t.lock();try{await ne(s,ae.List,e);for await(let a of Pt(s,te.Entry,sd))yield a}finally{s.release()}}async function*or(t,e,s){if(s)yield*id(t,e);else for await(let a of nd(t,e))yield{mode:a.mode,size:BigInt(a.size),mtime:BigInt(a.mtime),get type(){return a.type},get permission(){return a.permission},name:a.name}}var dr=T({data:me($)},{littleEndian:!0});async function*rd(t,e){let s=await t.lock(),a=!1;try{await ne(s,ae.Receive,e);for await(let i of Pt(s,te.Data,dr))yield i.data;a=!0}catch(i){throw a=!0,i}finally{if(!a)for await(let i of Pt(s,te.Data,dr));s.release()}}function cr(t,e){return Y.from(rd(t,e))}var pr=64*1024,od=T({unused:$},{littleEndian:!0});async function hr(t,e,s,a){let i=new Ue;e.pipeThrough(new Vs(s,!0)).pipeTo(new ee.WritableStream({write(n){return ne(t,ae.Data,n)}}),{signal:i.signal}).then(async()=>{await ne(t,ae.Done,a),await t.flush()},er),await Tt(t,te.Ok,od).catch(n=>{throw i.abort(),n})}async function gi({socket:t,filename:e,file:s,type:a=fi.File,permission:i=438,mtime:n=Date.now()/1e3|0,packetSize:r=pr}){let o=await t.lock();try{let d=a<<12|i,c=`${e},${d.toString()}`;await ne(o,ae.Send,c),await hr(o,s,r,n)}finally{o.release()}}var lr={None:0,Brotli:1,Lz4:2,Zstd:4,DryRun:2147483648},dd=T({id:$,mode:$,flags:$()},{littleEndian:!0});async function cd({socket:t,filename:e,file:s,type:a=fi.File,permission:i=438,mtime:n=Date.now()/1e3|0,packetSize:r=pr,dryRun:o=!1}){let d=await t.lock();try{await ne(d,ae.SendV2,e);let c=a<<12|i,l=lr.None;o&&(l|=lr.DryRun),await d.write(dd.serialize({id:ae.SendV2,mode:c,flags:l})),await hr(d,s,r,n)}finally{d.release()}}function ur(t){if(t.v2)return cd(t);if(t.dryRun)throw new Error("dryRun is not supported in v1");return gi(t)}var $i=class{#e;#t;#s;#i=new es;#n;get position(){return this.#t.position}constructor(e,s,a,i){this.#e=e,this.#t=s,this.#s=i,this.#n=new Yt(a)}#a(e){return P.WritableStream.write(this.#e,e)}async flush(){try{await this.#i.wait();let e=this.#n.flush();e&&await this.#a(e)}finally{this.#i.notifyOne()}}async write(e){try{await this.#i.wait();for(let s of this.#n.push(e))await this.#a(s)}finally{this.#i.notifyOne()}}async readExactly(e){return await this.flush(),await this.#t.readExactly(e)}release(){this.#n.flush(),this.#s.notifyOne()}async close(){await this.#t.cancel()}},Rt=class{#e=new es;#t;#s;constructor(e,s){this.#t=e,this.#s=new $i(e.writable.getWriter(),new xe(e.readable),s,this.#e)}async lock(){return await this.#e.wait(),this.#s}async close(){await this.#s.close(),await this.#t.close()}};function ld(t){let e=t.lastIndexOf("/");if(e===-1)throw new Error("Invalid path");return e===0?"/":t.substring(0,e)}var fa=class{_adb;_socket;#e;#t;#s;#i;#n;get supportsStat(){return this.#e}get supportsListV2(){return this.#t}get fixedPushMkdir(){return this.#s}get supportsSendReceiveV2(){return this.#i}get needPushMkdirWorkaround(){return this.#n}constructor(e,s){this._adb=e,this._socket=new Rt(s,e.maxPayloadSize),this.#e=e.canUseFeature(B.StatV2),this.#t=e.canUseFeature(B.ListV2),this.#s=e.canUseFeature(B.FixedPushMkdir),this.#i=e.canUseFeature(B.SendReceiveV2),this.#n=this._adb.canUseFeature(B.ShellV2)&&!this.fixedPushMkdir}async lstat(e){return await nr(this._socket,e,this.#e)}async stat(e){if(!this.#e)throw new Error("Not supported");return await rr(this._socket,e)}async isDirectory(e){try{return await this.lstat(e+"/"),!0}catch{return!1}}opendir(e){return or(this._socket,e,this.supportsListV2)}async readdir(e){let s=[];for await(let a of this.opendir(e))s.push(a);return s}read(e){return cr(this._socket,e)}async write(e){this.needPushMkdirWorkaround&&await this._adb.subprocess.noneProtocol.spawnWait(["mkdir","-p",ts(ld(e.filename))]),await ur({v2:this.supportsSendReceiveV2,socket:this._socket,...e})}lockSocket(){return this._socket.lock()}dispose(){return this._socket.close()}};function _r(t){if(!(!t||t==="0"))return Number.parseInt(t,10)}var ma=class extends ze{async getListenAddresses(){let e=await this.adb.getProp("service.adb.listen_addrs"),s=await this.adb.getProp("service.adb.tcp.port"),a=await this.adb.getProp("persist.adb.tcp.port");return{serviceListenAddresses:e!=""?e.split(","):[],servicePort:_r(s),persistPort:_r(a)}}async setPort(e){if(e<=0)throw new TypeError(`Invalid port ${e}`);let s=await this.adb.createSocketAndWait(`tcpip:${e}`);if(s!==`restarting in TCP mode port: ${e}
`)throw new Error(s);return s}async disable(){let e=await this.adb.createSocketAndWait("usb:");if(e!==`restarting in USB mode
`)throw new Error(e);return e}};var ss=class{#e;get transport(){return this.#e}get serial(){return this.#e.serial}get maxPayloadSize(){return this.#e.maxPayloadSize}get banner(){return this.#e.banner}get disconnected(){return this.#e.disconnected}get clientFeatures(){return this.#e.clientFeatures}get deviceFeatures(){return this.banner.features}subprocess;power;reverse;tcpip;constructor(e){this.#e=e,this.subprocess=new _a(this),this.power=new ta(this),this.reverse=new ia(this),this.tcpip=new ma(this)}canUseFeature(e){return this.clientFeatures.includes(e)&&this.deviceFeatures.includes(e)}async createSocket(e){return this.#e.connect(e)}async createSocketAndWait(e){return await(await this.createSocket(e)).readable.pipeThrough(new nt).pipeThrough(new Ce)}getProp(e){return this.subprocess.noneProtocol.spawnWaitText(["getprop",e]).then(s=>s.trim())}rm(e,s){let a=["rm"];if(s?.recursive&&a.push("-r"),s?.force&&a.push("-f"),Array.isArray(e))for(let i of e)a.push(ts(i));else a.push(ts(e));return a.push("</dev/null"),this.subprocess.noneProtocol.spawnWaitText(a)}async sync(){let e=await this.createSocket("sync:");return new fa(this,e)}async framebuffer(){return Kn(this)}async close(){await this.#e.close()}};var va={Product:"ro.product.name",Model:"ro.product.model",Device:"ro.product.device",Features:"features"},ga=class t{static parse(e){let s,a,i,n,r=[],o=e.split("::");if(o.length>1){s=o[0].trim()||void 0;let d=o[1];for(let c of d.split(";")){if(!c)continue;let l=c.split("=");if(l.length!==2)continue;let[_,b]=l;switch(_){case va.Product:a=b;break;case va.Model:i=b;break;case va.Device:n=b;break;case va.Features:r=b.split(",");break}}}return new t(s,a,i,n,r)}#e;get state(){return this.#e}#t;get product(){return this.#t}#s;get model(){return this.#s}#i;get device(){return this.#i}#n=[];get features(){return this.#n}constructor(e,s,a,i,n){this.#e=e,this.#t=s,this.#s=a,this.#i=i,this.#n=n}};function yi(t,e,s){let a=0n;for(let i=e;i<e+s;i+=8){a<<=64n;let n=Rn(t,i);a|=n}return a}function ki(t,e,s,a,i){if(i)for(;a>0n;)qn(t,e,a),e+=8,a>>=64n;else{let n=e+s-8;for(;a>0n;)On(t,n,a),n-=8,a>>=64n}}var pd=38,hd=2048/8,ud=303,_d=2048/8;function vr(t){let e=yi(t,pd,hd),s=yi(t,ud,_d);return[e,s]}function br(t,e){let s=t%e;return s>0?s:s+(e>0?e:-e)}function bd(t,e){if(t=br(t,e),!t||e<2)return NaN;let s=[],a=e;for(;a;)[t,a]=[a,t%a],s.push({a:t,b:a});if(t!==1)return NaN;let i=1,n=0;for(let r=s.length-2;r>=0;r-=1)[i,n]=[n,i-n*Math.floor(s[r].a/s[r].b)];return br(n,e)}var ot=2048/8,fd=ot/4;function xi(){return 8+ot+ot+4}function gr(t,e){let s,a=xi();if(!e)e=new Uint8Array(a),s="Uint8Array";else{if(e.length<a)throw new TypeError("output buffer is too small");s="number"}let i=new DataView(e.buffer,e.byteOffset,e.length),n=0;i.setUint32(n,fd,!0),n+=4;let[r]=vr(t),o=-bd(Number(r%2n**32n),2**32);i.setInt32(n,o,!0),n+=4,ki(e,n,ot,r,!0),n+=ot;let d=2n**4096n%r;return ki(e,n,ot,d,!0),n+=ot,i.setUint32(n,65537,!0),s==="Uint8Array"?e:a}function md(t,e,s){if(s===1n)return 0n;let a=1n;for(t=t%s;e>0n;)BigInt.asUintN(1,e)===1n&&(a=a*t%s),t=t*t%s,e>>=1n;return a}var fr=20,mr=48,vd=4,gd=5,$d=6,wi=new Uint8Array([mr,13+fr,mr,9,$d,5,43,14,3,2,26,gd,0,vd,fr]);function $r(t,e){let[s,a]=vr(t),i=new Uint8Array(256),n=0;i[n]=0,n+=1,i[n]=1,n+=1;let r=i.length-wi.length-e.length-1;for(;n<r;)i[n]=255,n+=1;i[n]=0,n+=1,i.set(wi,n),n+=wi.length,i.set(e,n);let o=md(yi(i,0,i.length),a,s);return ki(i,0,i.length,o,!1),i}var G={Auth:1213486401,Close:1163086915,Connect:1314410051,Okay:1497451343,Open:1313165391,Write:1163154007},as=T({command:$,arg0:$,arg1:$,payloadLength:$,checksum:$,magic:Mn},{littleEndian:!0}),Fb=st(as,{payload:me("payloadLength")});function wa(t){return t.reduce((e,s)=>e+s,0)}var $a=class extends Ms{constructor(){let e=new Uint8Array(as.size);super({transform:async(s,a)=>{await s.tryConsume(async i=>{let n=i;n.payloadLength=n.payload.length,as.serialize(n,e),await P.ReadableStream.enqueue(a,e),n.payloadLength&&await P.ReadableStream.enqueue(a,n.payload)})}})}};var ya={Token:1,Signature:2,PublicKey:3},wd=async function*(t,e){for await(let s of t.iterateKeys()){let a=await e();if(a.arg0!==ya.Token)return;let i=$r(s.buffer,a.payload);yield{command:G.Auth,arg0:ya.Signature,arg1:0,payload:i}}},yd=async function*(t,e){if((await e()).arg0!==ya.Token)return;let a;for await(let d of t.iterateKeys()){a=d;break}a||(a=await t.generateKey());let i=xi(),[n]=ui(i),r=a.name?.length?se(a.name):N,o=new Uint8Array(n+(r.length?r.length+1:0)+1);gr(a.buffer,o),Zn(o.subarray(0,i),o),r.length&&(o[n]=32,o.set(r,n+1)),yield{command:G.Auth,arg0:ya.PublicKey,arg1:0,payload:o}},wr=[wd,yd],ka=class{authenticators;#e;#t=new L;#s;constructor(e,s){this.authenticators=e,this.#e=s}#i=()=>this.#t.promise;async*#n(){for(let e of this.authenticators)for await(let s of e(this.#e,this.#i))this.#t=new L,yield s}async process(e){this.#s||(this.#s=this.#n()),this.#t.resolve(e);let s=await this.#s.next();if(s.done)throw new Error("No authenticator can handle the request");return s.value}dispose(){this.#s?.return?.()}};var is=class{#e;localId;remoteId;localCreated;service;#t;#s;get readable(){return this.#t}#i;writable;#n=!1;#a=new L;get closed(){return this.#a.promise}#h;get socket(){return this.#h}#r;#c=0;constructor(e){this.#e=e.dispatcher,this.localId=e.localId,this.remoteId=e.remoteId,this.localCreated=e.localCreated,this.service=e.service,this.#t=new re(s=>{this.#s=s}),this.writable=new ee.WritableStream({start:s=>{this.#i=s,s.signal.addEventListener("abort",()=>{this.#r?.reject(s.signal.reason)})},write:async s=>{let a=s.length,i=this.#e.options.maxPayloadSize;for(let n=0,r=i;n<a;n=r,r+=i){let o=s.subarray(n,r);await this.#u(o)}}}),this.#h=new Si(this),this.#c=e.availableWriteBytes}async#u(e){let s=e.length;for(;this.#c<s;){let a=new L;this.#r=a,await a.promise}this.#c===1/0?this.#c=-1:this.#c-=s,await this.#e.sendPacket(G.Write,this.localId,this.remoteId,e)}async enqueue(e){await this.#s.enqueue(e)}ack(e){this.#c+=e,this.#r?.resolve()}async close(){if(!this.#n){this.#n=!0,this.#r?.reject(new Error("Socket closed"));try{this.#i.error(new Error("Socket closed"))}catch{}await this.#e.sendPacket(G.Close,this.localId,this.remoteId,N)}}dispose(){this.#s.close(),this.#a.resolve(void 0)}},Si=class{#e;get localId(){return this.#e.localId}get remoteId(){return this.#e.remoteId}get localCreated(){return this.#e.localCreated}get service(){return this.#e.service}get readable(){return this.#e.readable}get writable(){return this.#e.writable}get closed(){return this.#e.closed}constructor(e){this.#e=e}close(){return this.#e.close()}};var xa=class{#e=new Rs(1);#t=new Map;#s;options;#i=!1;#n=new L;get disconnected(){return this.#n.promise}#a=new Map;#h=new Ue;constructor(e,s){this.options=s,this.options.initialDelayedAckBytes<0&&(this.options.initialDelayedAckBytes=0),e.readable.pipeTo(new O({write:async(a,i)=>{switch(a.command){case G.Close:await this.#r(a);break;case G.Okay:this.#c(a);break;case G.Open:await this.#l(a);break;case G.Write:this.#b(a).catch(n=>{i.error(n)});break;default:throw new Error(`Unknown command: ${a.command.toString(16)}`)}}}),{preventCancel:s.preserveConnection??!1,signal:this.#h.signal}).then(()=>{this.#p()},a=>{this.#i||this.#n.reject(a),this.#p()}),this.#s=e.writable.getWriter()}async#r(e){if(e.arg0===0&&this.#e.reject(e.arg1,new Error("Socket open failed")))return;let s=this.#t.get(e.arg1);if(s){await s.close(),s.dispose(),this.#t.delete(e.arg1);return}}#c(e){let s;if(this.options.initialDelayedAckBytes!==0){if(e.payload.length!==4)throw new Error("Invalid OKAY packet. Payload size should be 4");s=It(e.payload,0)}else{if(e.payload.length!==0)throw new Error("Invalid OKAY packet. Payload size should be 0");s=1/0}if(this.#e.resolve(e.arg1,{remoteId:e.arg0,availableWriteBytes:s}))return;let a=this.#t.get(e.arg1);if(a){a.ack(s);return}this.sendPacket(G.Close,e.arg1,e.arg0,N)}#u(e,s,a){let i;return this.options.initialDelayedAckBytes!==0?(i=new Uint8Array(4),Tn(i,0,a)):i=N,this.sendPacket(G.Okay,e,s,i)}async#l(e){let[s]=this.#e.add();this.#e.resolve(s,void 0);let a=e.arg0,i=e.arg1,n=ke(e.payload);if(n.endsWith("\0")&&(n=n.substring(0,n.length-1)),this.options.initialDelayedAckBytes===0){if(i!==0)throw new Error("Invalid OPEN packet. arg1 should be 0");i=1/0}else if(i===0)throw new Error("Invalid OPEN packet. arg1 should be greater than 0");let r=this.#a.get(n);if(!r){await this.sendPacket(G.Close,0,a,N);return}let o=new is({dispatcher:this,localId:s,remoteId:a,localCreated:!1,service:n,availableWriteBytes:i});try{await r(o.socket),this.#t.set(s,o),await this.#u(s,a,this.options.initialDelayedAckBytes)}catch{await this.sendPacket(G.Close,0,a,N)}}async#b(e){let s=this.#t.get(e.arg1);if(!s)throw new Error(`Unknown local socket id: ${e.arg1}`);let a=!1,i=[(async()=>{await s.enqueue(e.payload),await this.#u(e.arg1,e.arg0,e.payload.length),a=!0})()];this.options.readTimeLimit&&i.push((async()=>{if(await An(this.options.readTimeLimit),!a)throw new Error(`readable of \`${s.service}\` has stalled for ${this.options.readTimeLimit} milliseconds`)})()),await Promise.race(i)}async createSocket(e){this.options.appendNullToServiceString&&(e+="\0");let[s,a]=this.#e.add();await this.sendPacket(G.Open,s,this.options.initialDelayedAckBytes,e);let{remoteId:i,availableWriteBytes:n}=await a,r=new is({dispatcher:this,localId:s,remoteId:i,localCreated:!0,service:e,availableWriteBytes:n});return this.#t.set(s,r),r.socket}addReverseTunnel(e,s){this.#a.set(e,s)}removeReverseTunnel(e){this.#a.delete(e)}clearReverseTunnels(){this.#a.clear()}async sendPacket(e,s,a,i){if(typeof i=="string"&&(i=se(i)),i.length>this.options.maxPayloadSize)throw new TypeError("payload too large");await P.WritableStream.write(this.#s,{command:e,arg0:s,arg1:a,payload:i,checksum:this.options.calculateChecksum?wa(i):0,magic:e^4294967295})}async close(){await Promise.all(Array.from(this.#t.values(),e=>e.close())),this.#i=!0,this.#h.abort(),this.options.preserveConnection?this.#s.releaseLock():await this.#s.close()}#p(){for(let e of this.#t.values())e.dispose();this.#n.resolve()}};var kd=16777217,yr=[B.ShellV2,B.Cmd,B.StatV2,B.ListV2,B.FixedPushMkdir,"apex",B.Abb,"fixed_push_symlink_timestamp",B.AbbExec,"remount_shell","track_app",B.SendReceiveV2,"sendrecv_v2_brotli","sendrecv_v2_lz4","sendrecv_v2_zstd","sendrecv_v2_dry_run_send",B.DelayedAck],xd=32*1024*1024,ns=class t{static async authenticate({serial:e,connection:s,credentialStore:a,authenticators:i=wr,features:n=yr,initialDelayedAckBytes:r=xd,...o}){let d=16777217,c=1024*1024,l=new L,_=new ka(i,a),b=new Ue,p=s.readable.pipeTo(new O({async write(m){switch(m.command){case G.Connect:d=Math.min(d,m.arg0),c=Math.min(c,m.arg1),l.resolve(ke(m.payload));break;case G.Auth:{let w=await _.process(m);await f(w);break}default:break}}}),{preventCancel:!0,signal:b.signal}).then(()=>{l.reject(new Error("Connection closed unexpectedly"))},m=>{l.reject(m)}),u=s.writable.getWriter();async function f(m){m.checksum=wa(m.payload),m.magic=m.command^4294967295,await P.WritableStream.write(u,m)}let g=n.slice();if(r<=0){let m=n.indexOf(B.DelayedAck);m!==-1&&g.splice(m,1)}let v;try{await f({command:G.Connect,arg0:d,arg1:c,payload:se(`host::features=${g.join(",")}`)}),v=await l.promise}finally{b.abort(),u.releaseLock(),await p}return new t({serial:e,connection:s,version:d,maxPayloadSize:c,banner:v,features:g,initialDelayedAckBytes:r,...o})}#e;get connection(){return this.#e}#t;#s;get serial(){return this.#s}#i;get protocolVersion(){return this.#i}get maxPayloadSize(){return this.#t.options.maxPayloadSize}#n;get banner(){return this.#n}get disconnected(){return this.#t.disconnected}#a;get clientFeatures(){return this.#a}constructor({serial:e,connection:s,version:a,banner:i,features:n=yr,initialDelayedAckBytes:r,...o}){if(this.#s=e,this.#e=s,this.#n=ga.parse(i),this.#a=n,n.includes(B.DelayedAck)){if(r<=0)throw new TypeError("`initialDelayedAckBytes` must be greater than 0 when DelayedAck feature is enabled.");this.#n.features.includes(B.DelayedAck)||(r=0)}else r=0;let d,c;a>=kd?(d=!1,c=!1):(d=!0,c=!0),this.#t=new xa(s,{calculateChecksum:d,appendNullToServiceString:c,initialDelayedAckBytes:r,...o}),this.#i=a}connect(e){return this.#t.createSocket(e)}addReverseTunnel(e,s){return s||(s=`localabstract:reverse_${Math.random().toString().substring(2)}`),this.#t.addReverseTunnel(s,e),s}removeReverseTunnel(e){this.#t.removeReverseTunnel(e)}clearReverseTunnels(){this.#t.clearReverseTunnels()}close(){return this.#t.close()}};function kr(t,e){e<0||e>=t.length||(t[e]=t[t.length-1],t.length-=1)}var Sa=class extends Error{constructor(e){super("The device is already in used by another program",{cause:e})}};function rs(t,e){return typeof t=="object"&&t!==null&&"name"in t&&t.name===e}function Sd(t){return t.classCode!==void 0&&t.subclassCode!==void 0&&t.protocolCode!==void 0}function Ld(t,e){return t.interfaceClass===e.classCode&&t.interfaceSubclass===e.subclassCode&&t.interfaceProtocol===e.protocolCode}function Ad(t,e){for(let s of t.configurations)for(let a of s.interfaces)for(let i of a.alternates)if(Ld(i,e))return{configuration:s,interface_:a,alternate:i}}function xr(t){return t.toString(16).padStart(4,"0")}function Li(t){return t.serialNumber?t.serialNumber:xr(t.vendorId)+"x"+xr(t.productId)}function Sr(t){if(t.length===0)throw new TypeError("No endpoints given");let e,s;for(let a of t)switch(a.direction){case"in":if(e=a,s)return{inEndpoint:e,outEndpoint:s};break;case"out":if(s=a,e)return{inEndpoint:e,outEndpoint:s};break}throw e?s?new Error("unreachable"):new TypeError("No output endpoint found."):new TypeError("No input endpoint found.")}function jd(t,e){return e.vendorId!==void 0&&t.vendorId!==e.vendorId||e.productId!==void 0&&t.productId!==e.productId||e.serialNumber!==void 0&&Li(t)!==e.serialNumber?!1:Sd(e)?Ad(t,e)||!1:!0}function Bt(t,e,s){if(s&&s.length>0&&Bt(t,s))return!1;for(let a of e){let i=jd(t,a);if(i)return i}return!1}var La={classCode:255,subclassCode:66,protocolCode:1};function os(t){return!t||t.length===0?[La]:t.map(e=>({...e,classCode:e.classCode??La.classCode,subclassCode:e.subclassCode??La.subclassCode,protocolCode:e.protocolCode??La.protocolCode}))}var Ai=class{#e;get device(){return this.#e}#t;get inEndpoint(){return this.#t}#s;get outEndpoint(){return this.#s}#i;get readable(){return this.#i}#n;get writable(){return this.#n}constructor(e,s,a,i){this.#e=e,this.#t=s,this.#s=a;let n=!1,r=new Xs({close:async()=>{try{n=!0,await e.raw.close()}catch{}},dispose:()=>{n=!0,i.removeEventListener("disconnect",o)}});function o(c){c.device===e.raw&&r.dispose().catch(sa)}i.addEventListener("disconnect",o),this.#i=r.wrapReadable(new Y({pull:async c=>{let l=await this.#a();l?c.enqueue(l):c.close()}},{highWaterMark:0}));let d=a.packetSize-1;this.#n=Qn(r.createWritable(new ee.WritableStream({write:async c=>{try{await e.raw.transferOut(a.endpointNumber,Xn(c)),d&&(c.length&d)===0&&await e.raw.transferOut(a.endpointNumber,N)}catch(l){if(n)return;throw l}}})),new $a)}async#a(){try{for(;;){let e=await this.#e.raw.transferIn(this.#t.endpointNumber,this.#t.packetSize);if(e.data.byteLength!==24)continue;let s=new Uint8Array(e.data.buffer),a=new Bs(s),i=as.deserialize(a);if(i.magic===(i.command^4294967295)){if(i.payloadLength!==0){let n=await this.#e.raw.transferIn(this.#t.endpointNumber,i.payloadLength);i.payload=new Uint8Array(n.data.buffer)}else i.payload=N;return i}}}catch(e){if(rs(e,"NetworkError")&&(await new Promise(s=>{setTimeout(()=>{s()},100)}),closed))return;throw e}}},dt=class t{static DeviceBusyError=Sa;#e;#t;#s;get raw(){return this.#s}#i;get serial(){return this.#i}get name(){return this.#s.productName}constructor(e,s,a){this.#s=e,this.#i=Li(e),this.#e=s,this.#t=a}async#n(){this.#s.opened||await this.#s.open();let{configuration:e,interface_:s,alternate:a}=this.#e;if(this.#s.configuration?.configurationValue!==e.configurationValue&&await this.#s.selectConfiguration(e.configurationValue),!s.claimed)try{await this.#s.claimInterface(s.interfaceNumber)}catch(i){throw rs(i,"NetworkError")?new t.DeviceBusyError(i):i}return s.alternate.alternateSetting!==a.alternateSetting&&await this.#s.selectAlternateInterface(s.interfaceNumber,a.alternateSetting),Sr(a.endpoints)}async connect(){let{inEndpoint:e,outEndpoint:s}=await this.#n();return new Ai(this,e,s,this.#t)}};var Aa=class t{static async create(e,s={}){let a=await e.getDevices();return new t(e,a,s)}#e;#t;#s;#i=new rt;onDeviceAdd=this.#i.event;#n=new rt;onDeviceRemove=this.#n.event;#a=new Ys;onListChange=this.#a.event;current=[];constructor(e,s,a={}){this.#e=os(a.filters),this.#t=a.exclusionFilters,this.#s=e,this.current=s.map(i=>this.#h(i)).filter(i=>!!i),this.#a.fire(this.current),this.#s.addEventListener("connect",this.#r),this.#s.addEventListener("disconnect",this.#c)}#h(e){let s=Bt(e,this.#e,this.#t);if(s)return new dt(e,s,this.#s)}#r=e=>{let s=this.#h(e.device);if(!s||this.current.some(i=>i.raw===s.raw))return;let a=this.current.slice();a.push(s),this.current=a,this.#i.fire([s]),this.#a.fire(this.current)};#c=e=>{let s=this.current.findIndex(a=>a.raw===e.device);if(s!==-1){let a=this.current[s],i=this.current.slice();kr(i,s),this.current=i,this.#n.fire([a]),this.#a.fire(this.current)}};stop(){this.#s.removeEventListener("connect",this.#r),this.#s.removeEventListener("disconnect",this.#c),this.#i.dispose(),this.#n.dispose(),this.#a.dispose()}};var ds=class t{static BROWSER=typeof globalThis.navigator<"u"&&globalThis.navigator.usb?new t(globalThis.navigator.usb):void 0;#e;constructor(e){this.#e=e}async requestDevice(e={}){let s=os(e.filters);try{let a=await this.#e.requestDevice({filters:s,exclusionFilters:e.exclusionFilters}),i=Bt(a,s,e.exclusionFilters);return i?(this.#e.dispatchEvent(new USBConnectionEvent("connect",{device:a})),new dt(a,i,this.#e)):void 0}catch(a){if(rs(a,"NotFoundError"))return;throw a}}async getDevices(e={}){let s=os(e.filters),a=await this.#e.getDevices(),i=[];for(let n of a){let r=Bt(n,s,e.exclusionFilters);r&&i.push(new dt(n,r,this.#e))}return i}trackDevices(e={}){return Aa.create(this.#e,e)}};var Lr=new TextEncoder,ji="qingping-cgs1-capture";function Ci(t,e,s){if(!/^[A-Za-z0-9._/+-]+$/.test(t)||t.startsWith("/")||t.split("/").includes("..")||t.length>100||!Number.isInteger(e)||e<0||e>32*1024*1024)throw Error("Invalid fixed capture member");let a=new Uint8Array(512),i=(o,d)=>a.set(Lr.encode(d),o),n=(o,d,c)=>i(o,c.toString(8).padStart(d-1,"0")+"\0");i(0,t),n(100,8,s?448:384),n(108,8,0),n(116,8,0),n(124,12,e),n(136,12,0),a.fill(32,148,156),i(156,s?"5":"0"),i(257,"ustar\0"),i(263,"00");let r=a.reduce((o,d)=>o+d,0);return i(148,r.toString(8).padStart(6,"0")+"\0 "),a}function Ar(t,e,s){if(!(e instanceof Map)||e.size!==t.files.length||t.files.length!==9)throw Error("Complete fixed capture required");let a=[],i=new Set([ji]),n=0;for(let d of t.files){let c=e.get(d.path);if(!(c instanceof Uint8Array)||c.length!==d.size)throw Error("Capture size changed");if(n+=c.length,n>32*1024*1024)throw Error("Capture budget exceeded");let l=ji+"/"+d.path.replace(/^\//,"");Ci(l,c.length,!1);let _=l.split("/");for(let b=1;b<_.length;b++)i.add(_.slice(0,b).join("/"));a.push([l,c])}let r=Lr.encode(JSON.stringify(s,null,2)+`
`);if(r.length>65536)throw Error("Capture metadata budget exceeded");a.push([ji+"/result.json",r]);let o=[...i].sort().map(d=>Ci(d+"/",0,!0));for(let[d,c]of a){o.push(Ci(d,c.length,!1),c);let l=(512-c.length%512)%512;l&&o.push(new Uint8Array(l))}return o.push(new Uint8Array(1024)),new Blob(o,{type:"application/x-tar"})}function Cd(t){if(!(t instanceof Blob)||t.type!=="application/x-tar"||t.size>33*1024*1024)throw Error("Invalid private capture download");let e=URL.createObjectURL(t),s=document.createElement("a");s.href=e,s.download="qingping-cgs1-capture.tar",s.click(),setTimeout(()=>URL.revokeObjectURL(e),1e3)}var De=class extends Error{constructor(e){super(e),this.code=e}},C=t=>{throw new De(t)};function Ei(t,e){return(typeof t!="string"||!e.test(t))&&C("usb_identity_invalid"),t}var ja=class{#e;#t;#s=!1;#i;#n;#a=!1;#h;constructor(e,s){this.#e=e,this.#t=s}select(){return this.#r(!1)}capture(e=()=>{}){return typeof e!="function"&&C("usb_request_invalid"),this.#r(!0,e)}#r(e,s){(this.#s||this.#a)&&C("usb_selection_consumed");let a=this.#e.manager;a||C("webusb_unavailable"),this.#s=!0;let i;try{i=a.requestDevice()}catch{return Promise.reject(new De("usb_selection_failed"))}return this.#l(i,e,s)}async#c(e,s,a){this.#a&&C("usb_selection_consumed"),this.#h&&(s=Math.min(s,this.#h-Date.now())),s<=0&&C("usb_read_timeout");let i;try{return await Promise.race([e(),new Promise((n,r)=>{i=setTimeout(()=>{this.close().catch(()=>{}),r(new De(a))},s)})])}finally{clearTimeout(i)}}async#u(e){let s="__CGS1_WEBUSB_OK_"+crypto.randomUUID().replaceAll("-","")+"__",a=`set -e
`+e+`
printf '\\n`+s+`\\n'
`,i=await this.#c(async()=>{let c=await this.#i.createSocket("shell:"+a);return this.#a&&(Promise.resolve(c.close()).catch(()=>{}),C("usb_selection_consumed")),c},5e3,"usb_read_timeout"),n=i.readable.getReader(),r=new Uint8Array(0);try{for(;;){let{value:c,done:l}=await this.#c(()=>n.read(),1e4,"usb_read_timeout");if(l)break;(!(c instanceof Uint8Array)||r.length+c.length>4096)&&C("usb_read_invalid");let _=new Uint8Array(r.length+c.length);_.set(r),_.set(c,r.length),r=_}}finally{n.releaseLock(),await this.#p(()=>i.close())}r.some(c=>c>127||c===0)&&C("usb_read_invalid");let o=new TextDecoder().decode(r).replaceAll(`\r
`,`
`),d=`
`+s+`
`;return o.endsWith(d)||C("usb_read_incomplete"),o.slice(0,-d.length).trim()}async#l(e,s,a){try{let i=await e;i||C("usb_selection_cancelled"),this.#a&&C("usb_selection_consumed"),this.#h=Date.now()+(s?24e4:6e4);let n=Ei(i.serial,/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/);await this.#c(async()=>{let c=await i.connect();this.#a&&(Promise.allSettled([c.readable.cancel(),c.writable.close()]),C("usb_selection_consumed")),this.#n=c},5e3,"usb_connect_timeout");let r=await this.#c(async()=>{let c=await this.#e.authenticate({serial:n,connection:this.#n,credentialStore:this.#e.ephemeralCredentials(),initialDelayedAckBytes:0,readTimeLimit:1e4});return this.#a&&(Promise.resolve(c.close()).catch(()=>{}),C("usb_selection_consumed")),c},15e3,"usb_auth_timeout");this.#i=this.#e.createClient(r);let o={};for(let c of this.#t.identity)o[c.name]=await this.#u(c.command);(o.uid!=="0"||o.arch!=="armv7l"||o.version!=="CLEARGRASS_VERSION=4.1.8_0287"||!["2","3"].includes(o.co2_type))&&C("usb_profile_unsupported"),Ei(o.wlan_mac,/^[0-9a-f]{2}(?::[0-9a-f]{2}){5}$/),(parseInt(o.wlan_mac.slice(0,2),16)&1||o.wlan_mac==="00:00:00:00:00:00")&&C("usb_identity_invalid"),Ei(o.boot_id,/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);for(let c of this.#t.files){let l=await this.#u(c.command);_t(l,c)||C("usb_stock_unverified")}await this.#u(this.#t.absent_install)!==""&&C("usb_existing_installation"),(await this.#u("cat /proc/sys/kernel/random/boot_id")!==o.boot_id||await this.#u("cat /sys/class/net/wlan0/address")!==o.wlan_mac)&&C("usb_selection_changed");let d={model:"CGS1",stock_version:"4.1.8_0287",co2_type:Number(o.co2_type),wlan_mac:o.wlan_mac,boot_id:o.boot_id,transport:"browser_usb",source_checked:!0,installation_ready:!1};return s&&(d.archive=await this.#b(n,o,a)),d}catch(i){throw i instanceof De?i:new De("usb_probe_failed")}finally{await this.close()}}async#b(e,s,a){let i=new Map;(this.#t.files.length!==9||this.#t.files.reduce((o,d)=>o+d.size,0)>32*1024*1024)&&C("usb_capture_unverified");let n=await this.#c(async()=>{let o=await this.#i.sync();return this.#a&&(Promise.resolve(o.dispose()).catch(()=>{}),C("usb_selection_consumed")),o},5e3,"usb_read_timeout");try{a(0,this.#t.files.length);for(let o of this.#t.files){let d=n.read(o.path).getReader(),c=new Uint8Array(o.size),l=0;try{for(;;){let{value:b,done:p}=await this.#c(()=>d.read(),3e4,"usb_read_timeout");if(p)break;(!(b instanceof Uint8Array)||l+b.length>c.length)&&C("usb_capture_unverified"),c.set(b,l),l+=b.length}}finally{d.releaseLock()}l!==o.size&&C("usb_capture_unverified"),[...new Uint8Array(await crypto.subtle.digest("SHA-256",c))].map(b=>b.toString(16).padStart(2,"0")).join("")!==o.sha256&&C("usb_capture_unverified"),i.set(o.path,c),a(i.size,this.#t.files.length)}}finally{await this.#p(()=>n.dispose())}for(let o of this.#t.files)_t(await this.#u(o.command),o)||C("usb_capture_unverified");await this.#u(this.#t.absent_install)!==""&&C("usb_existing_installation");for(let o of this.#t.identity)await this.#u(o.command)!==s[o.name]&&C("usb_selection_changed");let r={schema_version:1,stage:"read_only_browser_capture_complete",hardware_contacted:!0,device_writes:0,installed:!1,installation_ready:!1,usb_serial:e,transport:"browser_usb",wlan_mac:s.wlan_mac,boot_id:s.boot_id,co2_type:Number(s.co2_type),stock_version:"4.1.8_0287",files:Object.fromEntries(this.#t.files.map(o=>[o.path,{sha256:o.sha256,size:o.size}])),limitations:["Fixed recovery/build files, not a NAND/user-data backup","Browser transport has no native ADB get-devpath; this archive is not a native USB plan","No installation, activation, fallback or boot test performed"]};return Ar(this.#t,i,r)}async close(){this.#a=!0;let e=this.#i,s=this.#n;this.#i=this.#n=void 0,e?await this.#p(()=>e.close()):s&&await this.#p(async()=>{(await Promise.allSettled([s.readable.cancel(),s.writable.close()])).some(i=>i.status==="rejected")&&C("usb_close_unverified")})}async#p(e){let s;try{await Promise.race([Promise.resolve().then(e),new Promise((a,i)=>{s=setTimeout(()=>i(new De("usb_close_unverified")),2e3)})])}catch{C("usb_close_unverified")}finally{clearTimeout(s)}}};var Ed={en:{browser_plan_not_started:"The private build is ready for a computer USB payload. This step keeps the browser capture separate and does not write to the monitor.",plan_browser_plan_prepared:"Computer USB files verified. Browser writing is still being integrated. Requested device free-space budget (not measured capacity):",plan_browser_plan_unverified:"Computer USB file preparation is unverified. Check the same job; do not repeat preparation.",plan_browser_plan_failed:"Computer USB file preparation failed. The inputs and log are preserved; no USB write occurred.",usb_browser_plan_unverified:"The computer USB file set is unverified. Preserve the job and check its status; no request is repeated.",usb_browser_plan_consumed:"Computer USB file preparation was already requested. Check the same job.",usb_browser_plan_build_required:"Build and verify this private firmware first.",usb_browser_plan_transport_required:"This file preparation belongs only to a computer USB job.",usb_browser_plan_source_required:"This older build cannot be joined to the browser installer. Its files and history are preserved.",browser_review:"Select and check the computer USB monitor",browser_review_running:"Reading the selected USB monitor and comparing it with this build\u2026",browser_review_verified:"The selected monitor matches this build. No files were written; browser installation is still being integrated.",browser_review_unverified:"The live USB check is unverified. The build is retained; no installation was started.",usb_browser_scope_unverified:"The selected USB monitor could not be verified against this exact build.",usb_browser_stage_unverified:"The USB write result is unverified. Preserve this job and read its status; do not repeat the write.",usb_browser_stage_consumed:"A write was already requested for this job. Read its status.",usb_browser_stage_review_required:"Review the selected monitor and installation changes first.",usb_browser_stage_space:"The selected monitor has insufficient verified free space for this build.",usb_browser_stage_previous_unverified:"A previous computer USB write is unverified. New writes are blocked; preserve its original job.",usb_channel_unverified:"The selected USB channel is unverified. Preserve this operation\u2019s history and do not repeat an installation.",enrollment_title:"Add to Home Assistant",enrollment_help:"Connect USB and keep the monitor on the same local network as HA. Checks its current address and encrypted identity, then adds the verified device through the standard ESPHome integration. Existing conflicts need manual review. This step does not flash or restart the monitor.",enrollment_ack:"Add this verified monitor to the ESPHome integration in this Home Assistant.",enrollment_start:"Add to Home Assistant",enrollment_status:"Read HA enrollment status",enrollment_running:"Reading the monitor address and native session, verifying the encrypted LAN connection and adding the ESPHome entry\u2026",enrollment_not_started:"The permanent interface was observed. You can now add this monitor to HA.",enrollment_created:"The monitor was added to the ESPHome integration. This saved result does not certify current device health.",enrollment_already_configured:"An exact matching ESPHome entry exists in this Home Assistant.",enrollment_conflict:"An ESPHome entry conflicts with this device identity, address or key. Review it in Settings \u2192 Devices & services \u2192 ESPHome; the wizard did not replace it.",enrollment_manual_flow_required:"The native ESPHome flow needs a manual decision. Open Settings \u2192 Devices & services \u2192 ESPHome. Do not repeat firmware installation.",enrollment_unverified:"HA enrollment could not be confirmed. Read status to check existing entries; no flow or firmware write will be repeated.",usb_enrollment_review_required:"Confirm adding this exact verified monitor to HA.",usb_enrollment_activation_required:"A verified permanent Full UI startup is required first.",usb_enrollment_consumed:"HA enrollment was already requested. Read its status.",usb_enrollment_unverified:"HA enrollment is unverified. Read status; do not repeat the request.",pm_title:"Prepare Full UI",pm_help:"Enables the stock software extension required for the full interface on the next ordinary boot. The current screen stays stock. Keep USB and power connected until the result; this step does not restart the monitor.",pm_ack:"I accept this experimental prerequisite and will power the monitor off and on after a confirmed result.",pm_start:"Prepare the next boot",pm_status:"Read prerequisite status",pm_running:"Checking the exact stock/bridge session, preparing its next boot and verifying the saved result. Do not disconnect USB or repeat the request.",pm_not_started:"Check Full UI prerequisites, then confirm this separate next-boot preparation if required.",pm_pm_extension_unverified:"The prerequisite outcome is unverified. Preserve this job and read its status. Do not repeat preparation or reboot during an uncertain write.",pm_pm_extension_armed_waiting_reboot:"Next-boot preparation was confirmed. If you have not powered the monitor off and on since this step, do that now. Then check Full UI prerequisites again. This saved result is not current runtime health.",usb_pm_extension_review_required:"Review the exact build and acknowledge the separate next-boot preparation.",usb_pm_extension_bridge_required:"This step requires a verified first bridge boot from a matching new build, before any Full UI attempt. Preserve older jobs; do not reset an installed monitor to reuse this wizard.",usb_pm_extension_unverified:"The prerequisite result is unverified. Read this job\u2019s status; do not repeat the write.",usb_pm_extension_consumed:"Prerequisite preparation was already requested. Read its saved status instead of repeating it.",usb_pm_extension_previous_unverified:"An earlier prerequisite write is unverified. Preserve and reconcile that operation before another device writer.",full_activation_title:"Keep the full interface",full_activation_help:"After a successful screen trial, saves this exact program pair to the monitor, enables startup and starts the full interface. Keep USB and power connected. This does not reboot the monitor or add it to Home Assistant.",full_activation_screen_ack:"I saw the trial screen and checked that the display and touch controls worked.",full_activation_ack:"I want to save this build and enable permanent full-interface startup. I understand that first installation is experimental.",full_activation_start:"Save and start the full interface",full_activation_status:"Read permanent-start status",full_activation_running:"Saving the matched pair and starting the full interface. Waiting for fresh physical readings and both guardians; this can take several minutes. No repeat launch will be sent.",full_activation_not_started:"The screen trial returned to stock. Check the display yourself, then choose whether to enable permanent startup.",full_activation_full_ui_active_observed:"The saved full interface started: physical core readings and both guardians were observed. Startup was enabled. This is recorded evidence, not a current health check. ESPHome enrollment in HA is still separate.",full_activation_full_ui_activation_unverified:"The permanent-start outcome is unverified. Preserve this job and read its status; do not repeat the request or reset its history.",full_activation_full_ui_activation_close_unverified:"Connection cleanup is unverified. Preserve this job; do not repeat the permanent-start request.",full_activation_full_ui_activation_space:"The monitor has insufficient measured storage space. No program copy or startup change was requested. Preserve this consumed attempt; do not remove files or retry it blindly.",usb_full_ui_activation_review_required:"Review this exact build, confirm the visible screen worked and separately accept permanent startup.",usb_full_ui_activation_trial_required:"A successful original screen trial with a verified return to stock is required first.",usb_full_ui_activation_unverified:"The permanent-start outcome could not be verified. Read saved status; do not repeat the request.",usb_full_ui_activation_consumed:"Permanent startup was already requested for this job. Read its status instead of starting it again.",usb_full_ui_activation_previous_unverified:"An earlier permanent-start operation is unverified. Preserve and reconcile its history before another device writer.",core_tools_title:"Prepare server tools",core_tools_help:"Included in this HACS integration. Downloads verified ADB/build tools into private HA storage; it does not install a separate app or start USB. The first setup needs internet and at least 6 GiB free.",core_tools_prepare:"Prepare tools",core_tools_required:"Server tools need preparation.",core_tools_preparing:"Downloading and verifying tools\u2026 This can take a few minutes.",core_tools_ready:"Server tools are ready.",usb_core_tools_failed:"Tool preparation failed. Check internet and free space. No device installation started.",usb_core_unsupported:"Server USB currently needs Home Assistant on Alpine 3.24, x86-64 or ARM64. Computer USB remains available.",usb_core_unverified:"The server result is uncertain. Read saved task status; do not repeat an installation.",usb_core_unavailable:"The integrated Monitor 1 worker is unavailable. Update the HACS integration.",usb_core_storage_unverified:"Private server storage could not be verified. Existing files were preserved.",language:"Language",intro:"Monitor 1 / CGS1 \u2014 experimental USB installation",prepare:"Prepare the monitor",enable:"On the stock monitor, enable ADB with #adb=on# in a Wi-Fi password field. Afterwards reconnect to your own Wi-Fi with its real password.",cable:"Connect a USB-C data cable to the computer or to the Home Assistant server, according to the option below.",boundary:"Connection checks and capture read identity and original files. Installation is a separate reviewed action below. Already modified or unknown stock variants are refused by the first-install path.",where:"Where is the cable connected?",transport:"USB connection",computer:"To this computer",server:"To the Home Assistant server",browser_help:"Chrome or Edge over HTTPS. The browser will ask you to select the USB device.",ha_help:"The integration reads the server's USB. Your browser needs no USB support or local cable.",scan:"Find USB devices",device:"Selected USB device",choose:"Choose a device",inspect:"Check USB connection",searching:"Looking for USB devices on the server\u2026",found:"USB devices found. Select the monitor.",no_devices:"No authorized USB ADB devices found. Check the cable and enable ADB on the monitor.",checking:"Checking the selected monitor\u2026",success:"Stock source checked. Firmware installation has not started.",capture:"Save original files",copying:"Copying and verifying original files\u2026",capture_help:"Downloads nine original recovery/build files to this computer. This is not a full device backup. Keep the archive private; it contains your device identity. Firmware installation does not start.",capture_success:"Original files verified and download started. Keep the archive for installation and recovery.",usb_capture_unverified:"The original-file copy could not be verified. No incomplete archive was offered. Nothing was installed.",prepare_install:"Prepare installation",friendly_name:"Device name",prepare_profile:"Prepare device profile",open_preparation:"Open preparation on Home Assistant",refresh_preparations:"Refresh saved preparations",saved_preparations:"Available saved preparations",choose_preparation:"Choose a saved preparation",preparation_pending:"Unverified",usb_job_list_failed:"Saved preparations could not be read. Existing files are preserved; refresh to check again.",preparation_help:"Creates a private profile on your Home Assistant server. Computer USB sends the verified original files to that server. The key stays private. You can then build firmware here; installation is a separate step.",build_firmware:"Build private firmware",check_build:"Check build status",build_help:"Builds on your HA server using one logical CPU at low priority. Requires at least 6 GiB free space and downloads public build tools. Private inputs stay on this server. Nothing is written to the monitor. A started build is never automatically repeated.",build_not_started:"Firmware has not been built yet.",build_building:"Building private firmware\u2026",build_phase_source:"Downloading the pinned public source.",build_phase_sdk:"Preparing build tools.",build_phase_compile:"Compiling the matched programs.",build_built_not_installed:"Private firmware built and its hashes verified. Choose the next step below; this build has not written anything to the monitor.",computer_install_title:"Install from this computer",computer_install_help:"Download this private build, then use its included macOS/Linux ADB installer and instructions. Compilation stays on HA; the computer needs Python and Android platform-tools, with no VM. Local preparation reads a new real USB capture before an explicitly reviewed installation. Browser-only WebUSB writing is still unfinished.",export_computer:"Download private computer installer",computer_downloaded:"Private installer download started. Read README.txt inside it before running the local commands. No monitor write was requested by this download.",usb_computer_after_install:"This HA job already has an installation attempt. Preserve its original receipts and use its status/recovery path; no second computer installer was exported.",usb_computer_package_limit:"The private bundle exceeds the bounded download budget. Existing files are preserved.",build_build_failed:"The build failed. Private inputs and logs are retained; the consumed build will not restart automatically.",build_build_unverified:"Build status is unverified. Check status again; do not start a replacement build.",usb_build_unverified:"Build status is unverified. Read the same job's status; the start request will not be repeated.",usb_build_consumed:"A build was already requested for this job. Check its status.",usb_build_space:"At least 6 GiB free space is required before starting. Existing jobs are preserved.",usb_build_busy:"Another private build holds the server's build slot. This job has not started.",prepare_plan:"Prepare installation files",check_plan:"Check installation files",plan_not_prepared:"The built programs can now be joined with verified original files. This only prepares a private payload; it does not write to USB.",plan_plan_prepared:"Installation files verified. Review the experimental server USB installation below. Requested device free-space budget (not measured capacity):",plan_plan_unverified:"Installation-file preparation is unverified. Read its status; do not repeat the request.",plan_plan_failed:"Installation-file preparation failed. Its inputs and private log are preserved; no USB write occurred.",plan_build_required:"A complete matched build is required first.",plan_browser_adapter_pending:"This installation-file step currently supports server USB only. Computer USB support is still being integrated; your profile and build are retained.",usb_plan_browser_pending:"This installation-file step is not available for computer USB yet. Your profile and build are retained.",usb_plan_build_required:"Build and verify this job's private firmware first.",usb_plan_consumed:"Installation-file preparation was already requested. Read its status.",usb_plan_unverified:"The private installation-file set is unverified. Read the same job's status; no request is replayed.",plan_used:"This payload belongs to a consumed installation request. It will not be used to repeat the write.",install_title:"Experimental installation with the stock screen",install_experimental:"The first installation through this wizard has not been physically qualified on an untouched monitor. Use only the exact CGS1 S8/SCD40 device shown below; keep USB access for recovery.",install_changes:"Creates a private ESPHome directory, saves the original startup files and changes two startup scripts. Runs the 60-second bounded bridge trial alongside the stock program. Only a verified stopped trial and completed transport cleanup allow the separately guarded next-boot autostart step. PM preload remains off; the full replacement UI is a later step.",install_power:"Keep USB and power connected until the result. If a response is lost, read status instead of repeating installation or rebooting during an unverified write.",install_ack:"I checked the selected device and reviewed these experimental installation steps.",install_firmware:"Run experimental installation",check_install:"Read operation status",observe_boot:"Check the monitor",install_not_started:"Review the selected monitor before starting.",install_running:"Experimental installation is running. Keep USB and power connected; the bounded trial and its result checks can take several minutes.",install_armed_waiting_reboot:"The operation verified the stopped trial and enabled next-boot autostart. Use Check the monitor for a fresh device check before the normal power cycle.",install_install_unverified:"The write outcome is unverified. Do not repeat installation or reboot during a possibly pending write. Read operation status or check the monitor; the original receipts are preserved.",install_bridge_observed:"ESPHome was verified after a new boot. Check the monitor again for a fresh observation.",boot_checking:"Reading the monitor's current boot and ESPHome state\u2026",boot_awaiting_reboot:"Autostart was checked on the current idle stock boot. Shut down through the stock menu, turn the monitor on again, keep USB connected, then check the monitor again.",boot_bridge_observed:"ESPHome was verified on a new boot with the expected running programs and fresh authenticated sensor updates.",boot_boot_unverified:"The monitor's state is unverified. Read the operation status; this check does not repeat installation or restart the monitor.",usb_install_review_required:"Read the current device review and confirm the experimental steps before starting.",usb_install_plan_required:"A verified private installation-file set is required first.",usb_install_consumed:"This installation request is already consumed. Read status; do not repeat it.",usb_install_previous_unverified:"An earlier installation remains unverified. Its original operation must be reconciled before starting another.",usb_install_host_space:"The HA server needs at least 512 MiB free for private installation records. No new installation request was started.",usb_install_unverified:"The installation outcome is unverified. Check the same job's status; do not repeat the write.",usb_boot_unverified:"The current boot observation is unverified. No installation or reboot was requested.",usb_observation_limit:"This job retains 64 read observations. Existing records are preserved; inspect them before another observation.",full_review_title:"Full replacement UI prerequisites",full_review:"Check Full UI prerequisites",full_review_help:"Reads the current authenticated bridge and its original stock preflight for this exact native/guardian pair. It does not enable the PM extension, upload, launch, reboot or change installation readiness.",full_review_reading:"Reading current Full UI prerequisites\u2026",full_review_pm_extension_required:"The initial bridge deliberately leaves the stock PM extension off. Full UI requires a separate verified extension transition; this check does not enable it.",full_review_full_ui_preflight_observed:"The current stock preflight passed for the exact build. This is a read observation, not an installation or launch. The full transition remains a separate step.",full_review_full_ui_unverified:"Full UI prerequisites are unverified. Existing programs and settings are preserved; this check grants no launch.",full_review_full_ui_close_unverified:"Read or connection cleanup is unverified. No Full UI activation was requested; keep the original operation history.",usb_full_ui_bridge_required:"Verify the installed bridge after its new boot before reading Full UI prerequisites.",usb_full_ui_unverified:"Full UI prerequisites could not be verified. No activation was requested.",usb_full_ui_close_unverified:"The exact read connection could not be confirmed closed. No activation was requested.",full_trial_title:"Try the full interface",full_trial_start:"Run a 60-second screen trial",full_trial_status:"Read screen-trial status",full_trial_help:"Uploads this build's two exact programs to RAM, shows the new interface for up to 60 seconds and observes its return to stock. The device guardians enforce the limit even if this page closes. Keep USB connected; this does not enable permanent startup.",full_trial_ack:"I understand this is an experimental screen trial, will watch the display and will keep the monitor powered and connected.",full_trial_running:"Uploading the matched pair, running the temporary interface and waiting for stock to return. This can take several minutes; no second launch will be sent.",full_trial_not_started:"First check Full UI prerequisites, then acknowledge and start the separate screen trial.",full_trial_full_ui_trial_returned_observed:"The new interface and fresh core sensor readiness were observed, then the stock bridge returned. Permanent startup was off when this trial ended. This is historical trial evidence, not completed installation.",full_trial_full_ui_trial_unverified:"The trial outcome is unverified. Preserve this job and read its status; do not repeat the launch or reset its history.",full_trial_full_ui_trial_close_unverified:"The trial connection or USB forward cleanup is unverified. Preserve the original operation history; no repeat launch is permitted.",full_trial_full_ui_trial_rebuild_required:"This bridge lacks the fixed screen-trial action. Its consumed request is preserved; do not retry this job.",usb_full_ui_trial_review_required:"Review the exact build and acknowledge the separate screen trial before starting.",usb_full_ui_trial_rebuild_required:"This job was built from an older source without the fixed screen trial. It stays unchanged; a new matching build is required. Do not reset an installed monitor to reuse this wizard.",usb_full_ui_trial_unverified:"The screen-trial outcome is unverified. Read the same job's status; do not repeat the write.",usb_full_ui_trial_close_unverified:"The screen-trial connection cleanup could not be verified. Preserve its history; do not repeat the launch.",usb_full_ui_trial_consumed:"This screen trial was already requested. Read its status; it cannot be started again.",usb_full_ui_trial_previous_unverified:"An earlier screen trial remains unverified. Preserve and reconcile that operation before another device writer.",private_backup_help:"Save private backups before installation. The profile contains your individual ESPHome encryption key; keep it private. Saved originals remain downloadable from this job after installation. They are a fixed recovery set, not a full device backup.",export_profile:"Download private ESPHome profile",export_originals:"Download saved original files",private_backup_downloaded:"Private backup download started. Keep it private; the profile contains the ESPHome encryption key.",usb_private_export_unverified:"The private backup could not be verified or downloaded. Existing job files are preserved.",preparing_profile:"Preparing the private device profile\u2026",profile_prepared:"The private device profile is ready.",check_preparation:"Check preparation status",usb_preparation_unverified:"Preparation is unverified. Check its status; the request will not be sent again automatically.",usb_profile_name_invalid:"Enter a printable device name up to 120 UTF-8 bytes, without slashes.",usb_job_limit:"The server retains eight preparation jobs. Existing data is preserved; cleanup through the wizard is not implemented yet.",usb_job_unavailable:"The preparation job is unavailable, incomplete or belongs to another user.",next:"Server USB and the downloaded computer ADB installer are experimental and await physical first-install QA. Browser-only WebUSB writing remains unfinished. The initial stock-extension transition is a separate reviewed next-boot step. Full UI requires its separate prerequisite, trial and permanent-start steps.",docs:"Experimental installation documentation",model:"Model",version:"Stock version",co2:"CO2 variant",mac:"WLAN identity",webusb_unavailable:"Use Chrome or Edge over HTTPS, or choose the server USB option.",usb_selection_cancelled:"No device selected.",usb_stock_unverified:"Stock files differ from the initial-install profile. An existing ESPHome installation needs its own update route.",usb_profile_unsupported:"This stock version, CO2 type or CPU is not admitted.",usb_busy:"Another USB check is in progress.",open_companion:"Open server USB check",usb_companion_unavailable:"Install the Qingping USB companion for server USB. The documentation link below explains how. Computer USB does not need it.",usb_companion_stopped:"Start the installed Qingping USB companion manually, then open the server USB check again.",usb_selection_consumed:"This selection was already checked. Discover devices again for a new read-only check.",usb_unauthorized:"Open the companion from Home Assistant as an administrator.",failed:"The USB check was incomplete. Nothing was installed. Check the cable, ADB and selected connection."},ru:{browser_plan_not_started:"\u041F\u0440\u0438\u0432\u0430\u0442\u043D\u0430\u044F \u0441\u0431\u043E\u0440\u043A\u0430 \u0433\u043E\u0442\u043E\u0432\u0430 \u0434\u043B\u044F \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0438 \u0444\u0430\u0439\u043B\u043E\u0432 USB \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440\u0430. \u042D\u0442\u043E\u0442 \u0448\u0430\u0433 \u0441\u043E\u0445\u0440\u0430\u043D\u044F\u0435\u0442 \u0434\u0430\u043D\u043D\u044B\u0435 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u043D\u043E\u0433\u043E \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044F \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E \u0438 \u043D\u0435 \u0437\u0430\u043F\u0438\u0441\u044B\u0432\u0430\u0435\u0442 \u0438\u0445 \u043D\u0430 \u043F\u0440\u0438\u0431\u043E\u0440.",plan_browser_plan_prepared:"\u0424\u0430\u0439\u043B\u044B \u0434\u043B\u044F USB \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440\u0430 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u044B. \u0417\u0430\u043F\u0438\u0441\u044C \u0438\u0437 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0430 \u0435\u0449\u0451 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0430\u0435\u0442\u0441\u044F. \u0417\u0430\u043F\u0440\u0430\u0448\u0438\u0432\u0430\u0435\u043C\u044B\u0439 \u0437\u0430\u043F\u0430\u0441 \u043C\u0435\u0441\u0442\u0430 \u043D\u0430 \u043F\u0440\u0438\u0431\u043E\u0440\u0435 (\u043D\u0435 \u0438\u0437\u043C\u0435\u0440\u0435\u043D\u043D\u0430\u044F \u0441\u0432\u043E\u0431\u043E\u0434\u043D\u0430\u044F \u043F\u0430\u043C\u044F\u0442\u044C):",plan_browser_plan_unverified:"\u041F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0430 \u0444\u0430\u0439\u043B\u043E\u0432 USB \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440\u0430 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0430. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0442\u043E \u0436\u0435 \u0437\u0430\u0434\u0430\u043D\u0438\u0435; \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439\u0442\u0435 \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0443.",plan_browser_plan_failed:"\u041F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0430 \u0444\u0430\u0439\u043B\u043E\u0432 USB \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440\u0430 \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u043B\u0430\u0441\u044C \u043E\u0448\u0438\u0431\u043A\u043E\u0439. \u0418\u0441\u0445\u043E\u0434\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435 \u0438 \u0436\u0443\u0440\u043D\u0430\u043B \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B; \u0437\u0430\u043F\u0438\u0441\u0438 \u0447\u0435\u0440\u0435\u0437 USB \u043D\u0435 \u0431\u044B\u043B\u043E.",usb_browser_plan_unverified:"\u041D\u0430\u0431\u043E\u0440 \u0444\u0430\u0439\u043B\u043E\u0432 USB \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440\u0430 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D. \u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u0437\u0430\u0434\u0430\u043D\u0438\u0435 \u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0435\u0433\u043E \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435; \u0437\u0430\u043F\u0440\u043E\u0441 \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0435\u0442\u0441\u044F.",usb_browser_plan_consumed:"\u041F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0430 \u0444\u0430\u0439\u043B\u043E\u0432 USB \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440\u0430 \u0443\u0436\u0435 \u0437\u0430\u043F\u0440\u043E\u0448\u0435\u043D\u0430. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0442\u043E \u0436\u0435 \u0437\u0430\u0434\u0430\u043D\u0438\u0435.",usb_browser_plan_build_required:"\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0441\u043E\u0431\u0435\u0440\u0438\u0442\u0435 \u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u044D\u0442\u0443 \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u0443\u044E \u043F\u0440\u043E\u0448\u0438\u0432\u043A\u0443.",usb_browser_plan_transport_required:"\u042D\u0442\u0430 \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0430 \u0444\u0430\u0439\u043B\u043E\u0432 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430 \u0442\u043E\u043B\u044C\u043A\u043E \u0434\u043B\u044F \u0437\u0430\u0434\u0430\u043D\u0438\u044F USB \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440\u0430.",usb_browser_plan_source_required:"\u042D\u0442\u0443 \u0441\u0442\u0430\u0440\u0443\u044E \u0441\u0431\u043E\u0440\u043A\u0443 \u043D\u0435\u043B\u044C\u0437\u044F \u043E\u0431\u044A\u0435\u0434\u0438\u043D\u0438\u0442\u044C \u0441 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u043D\u044B\u043C \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u0449\u0438\u043A\u043E\u043C. \u0415\u0451 \u0444\u0430\u0439\u043B\u044B \u0438 \u0438\u0441\u0442\u043E\u0440\u0438\u044F \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B.",browser_review:"\u0412\u044B\u0431\u0440\u0430\u0442\u044C \u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u043C\u043E\u043D\u0438\u0442\u043E\u0440 \u043F\u043E USB \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440\u0430",browser_review_running:"\u0427\u0438\u0442\u0430\u044E \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0439 USB-\u043C\u043E\u043D\u0438\u0442\u043E\u0440 \u0438 \u0441\u0432\u0435\u0440\u044F\u044E \u0435\u0433\u043E \u0441 \u044D\u0442\u043E\u0439 \u0441\u0431\u043E\u0440\u043A\u043E\u0439\u2026",browser_review_verified:"\u0412\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0439 \u043C\u043E\u043D\u0438\u0442\u043E\u0440 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u044D\u0442\u043E\u0439 \u0441\u0431\u043E\u0440\u043A\u0435. \u0424\u0430\u0439\u043B\u044B \u043D\u0435 \u0437\u0430\u043F\u0438\u0441\u044B\u0432\u0430\u043B\u0438\u0441\u044C; \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u043D\u0430\u044F \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u0435\u0449\u0451 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0430\u0435\u0442\u0441\u044F.",browser_review_unverified:"\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0436\u0438\u0432\u043E\u0433\u043E USB-\u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044F \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0430. \u0421\u0431\u043E\u0440\u043A\u0430 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0430; \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u043D\u0435 \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u043B\u0430\u0441\u044C.",usb_browser_scope_unverified:"\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044C \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u0435 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u0433\u043E USB-\u043C\u043E\u043D\u0438\u0442\u043E\u0440\u0430 \u044D\u0442\u043E\u0439 \u0441\u0431\u043E\u0440\u043A\u0435.",usb_browser_stage_unverified:"\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u0437\u0430\u043F\u0438\u0441\u0438 \u0447\u0435\u0440\u0435\u0437 USB \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D. \u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u044D\u0442\u043E \u0437\u0430\u0434\u0430\u043D\u0438\u0435 \u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0435\u0433\u043E \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435; \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439\u0442\u0435 \u0437\u0430\u043F\u0438\u0441\u044C.",usb_browser_stage_consumed:"\u0417\u0430\u043F\u0438\u0441\u044C \u0434\u043B\u044F \u044D\u0442\u043E\u0433\u043E \u0437\u0430\u0434\u0430\u043D\u0438\u044F \u0443\u0436\u0435 \u0437\u0430\u043F\u0440\u043E\u0448\u0435\u043D\u0430. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0435\u0451 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435.",usb_browser_stage_review_required:"\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0435 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0439 \u043C\u043E\u043D\u0438\u0442\u043E\u0440 \u0438 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F \u043F\u0440\u0438 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0435.",usb_browser_stage_space:"\u041D\u0430 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u043C \u043C\u043E\u043D\u0438\u0442\u043E\u0440\u0435 \u043D\u0435\u0434\u043E\u0441\u0442\u0430\u0442\u043E\u0447\u043D\u043E \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D\u043D\u043E\u0433\u043E \u0441\u0432\u043E\u0431\u043E\u0434\u043D\u043E\u0433\u043E \u043C\u0435\u0441\u0442\u0430 \u0434\u043B\u044F \u044D\u0442\u043E\u0439 \u0441\u0431\u043E\u0440\u043A\u0438.",usb_browser_stage_previous_unverified:"\u041F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0430\u044F \u0437\u0430\u043F\u0438\u0441\u044C \u0447\u0435\u0440\u0435\u0437 USB \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440\u0430 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0430. \u041D\u043E\u0432\u0430\u044F \u0437\u0430\u043F\u0438\u0441\u044C \u0437\u0430\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043D\u0430; \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u0438\u0441\u0445\u043E\u0434\u043D\u043E\u0435 \u0437\u0430\u0434\u0430\u043D\u0438\u0435.",usb_channel_unverified:"\u041A\u0430\u043D\u0430\u043B \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u0433\u043E USB-\u043F\u0440\u0438\u0431\u043E\u0440\u0430 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D. \u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u0438\u0441\u0442\u043E\u0440\u0438\u044E \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u0438 \u0438 \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439\u0442\u0435 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0443.",enrollment_title:"\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0432 Home Assistant",enrollment_help:"\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u0435 USB \u0438 \u043E\u0441\u0442\u0430\u0432\u044C\u0442\u0435 \u043C\u043E\u043D\u0438\u0442\u043E\u0440 \u0432 \u043E\u0434\u043D\u043E\u0439 \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u043E\u0439 \u0441\u0435\u0442\u0438 \u0441 HA. \u041C\u0430\u0441\u0442\u0435\u0440 \u043F\u0440\u043E\u0432\u0435\u0440\u0438\u0442 \u0442\u0435\u043A\u0443\u0449\u0438\u0439 \u0430\u0434\u0440\u0435\u0441 \u0438 \u0437\u0430\u0448\u0438\u0444\u0440\u043E\u0432\u0430\u043D\u043D\u043E\u0435 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435, \u0437\u0430\u0442\u0435\u043C \u0434\u043E\u0431\u0430\u0432\u0438\u0442 \u043F\u0440\u0438\u0431\u043E\u0440 \u0447\u0435\u0440\u0435\u0437 \u0448\u0442\u0430\u0442\u043D\u0443\u044E \u0438\u043D\u0442\u0435\u0433\u0440\u0430\u0446\u0438\u044E ESPHome. \u041A\u043E\u043D\u0444\u043B\u0438\u043A\u0442\u0443\u044E\u0449\u0438\u0435 \u0437\u0430\u043F\u0438\u0441\u0438 \u0442\u0440\u0435\u0431\u0443\u044E\u0442 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E\u0433\u043E \u0440\u0435\u0448\u0435\u043D\u0438\u044F. \u041F\u0440\u0438\u0431\u043E\u0440 \u043D\u0435 \u043F\u0440\u043E\u0448\u0438\u0432\u0430\u0435\u0442\u0441\u044F \u0438 \u043D\u0435 \u043F\u0435\u0440\u0435\u0437\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u0442\u0441\u044F.",enrollment_ack:"\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u044D\u0442\u043E\u0442 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043D\u044B\u0439 \u043C\u043E\u043D\u0438\u0442\u043E\u0440 \u0432 \u0438\u043D\u0442\u0435\u0433\u0440\u0430\u0446\u0438\u044E ESPHome \u044D\u0442\u043E\u0433\u043E Home Assistant.",enrollment_start:"\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0432 Home Assistant",enrollment_status:"\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u0432 HA",enrollment_running:"\u0427\u0438\u0442\u0430\u0435\u043C \u0430\u0434\u0440\u0435\u0441 \u0438 \u0442\u0435\u043A\u0443\u0449\u0443\u044E \u0441\u0435\u0441\u0441\u0438\u044E \u043F\u0440\u0438\u0431\u043E\u0440\u0430, \u043F\u0440\u043E\u0432\u0435\u0440\u044F\u0435\u043C \u0437\u0430\u0448\u0438\u0444\u0440\u043E\u0432\u0430\u043D\u043D\u043E\u0435 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u043F\u043E \u0441\u0435\u0442\u0438 \u0438 \u0434\u043E\u0431\u0430\u0432\u043B\u044F\u0435\u043C \u0437\u0430\u043F\u0438\u0441\u044C ESPHome\u2026",enrollment_not_started:"\u041F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u044B\u0439 \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441 \u0431\u044B\u043B \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D. \u0422\u0435\u043F\u0435\u0440\u044C \u043C\u043E\u0436\u043D\u043E \u0434\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u043C\u043E\u043D\u0438\u0442\u043E\u0440 \u0432 HA.",enrollment_created:"\u041C\u043E\u043D\u0438\u0442\u043E\u0440 \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D \u0432 \u0438\u043D\u0442\u0435\u0433\u0440\u0430\u0446\u0438\u044E ESPHome. \u0421\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0439 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0430\u0435\u0442 \u0442\u0435\u043A\u0443\u0449\u0443\u044E \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E\u0441\u0442\u044C \u043F\u0440\u0438\u0431\u043E\u0440\u0430.",enrollment_already_configured:"\u0412 \u044D\u0442\u043E\u043C Home Assistant \u0443\u0436\u0435 \u0435\u0441\u0442\u044C \u043F\u043E\u043B\u043D\u043E\u0441\u0442\u044C\u044E \u0441\u043E\u0432\u043F\u0430\u0434\u0430\u044E\u0449\u0430\u044F \u0437\u0430\u043F\u0438\u0441\u044C ESPHome.",enrollment_conflict:"\u0415\u0441\u0442\u044C \u043A\u043E\u043D\u0444\u043B\u0438\u043A\u0442 \u0437\u0430\u043F\u0438\u0441\u0438 ESPHome \u0441 \u0430\u0434\u0440\u0435\u0441\u043E\u043C, \u043A\u043B\u044E\u0447\u043E\u043C \u0438\u043B\u0438 \u0438\u0434\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0442\u043E\u0440\u043E\u043C \u043F\u0440\u0438\u0431\u043E\u0440\u0430. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0435\u0451 \u0432 \xAB\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u2192 \u0423\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430 \u0438 \u0441\u043B\u0443\u0436\u0431\u044B \u2192 ESPHome\xBB. \u041C\u0430\u0441\u0442\u0435\u0440 \u043D\u0435 \u0437\u0430\u043C\u0435\u043D\u0438\u043B \u0437\u0430\u043F\u0438\u0441\u044C.",enrollment_manual_flow_required:"\u0428\u0442\u0430\u0442\u043D\u0430\u044F \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430 ESPHome \u0442\u0440\u0435\u0431\u0443\u0435\u0442 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E\u0433\u043E \u0440\u0435\u0448\u0435\u043D\u0438\u044F. \u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \xAB\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u2192 \u0423\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430 \u0438 \u0441\u043B\u0443\u0436\u0431\u044B \u2192 ESPHome\xBB. \u041D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439\u0442\u0435 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0443 \u043F\u0440\u043E\u0448\u0438\u0432\u043A\u0438.",enrollment_unverified:"\u0414\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u0432 HA \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u043E. \u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0441\u0442\u0430\u0442\u0443\u0441\u0430 \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u0435\u0442 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0438\u0435 \u0437\u0430\u043F\u0438\u0441\u0438; \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430 \u0438 \u043F\u0440\u043E\u0448\u0438\u0432\u043A\u0430 \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u043E \u043D\u0435 \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u044E\u0442\u0441\u044F.",usb_enrollment_review_required:"\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0435 \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u0438\u043C\u0435\u043D\u043D\u043E \u044D\u0442\u043E\u0433\u043E \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043D\u043E\u0433\u043E \u043C\u043E\u043D\u0438\u0442\u043E\u0440\u0430 \u0432 HA.",usb_enrollment_activation_required:"\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u043D\u0443\u0436\u0435\u043D \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043D\u044B\u0439 \u043F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u044B\u0439 \u0437\u0430\u043F\u0443\u0441\u043A \u043F\u043E\u043B\u043D\u043E\u0433\u043E \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430.",usb_enrollment_consumed:"\u0414\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u0432 HA \u0443\u0436\u0435 \u0437\u0430\u043F\u0440\u0430\u0448\u0438\u0432\u0430\u043B\u043E\u0441\u044C. \u041F\u0440\u043E\u0447\u0438\u0442\u0430\u0439\u0442\u0435 \u0441\u0442\u0430\u0442\u0443\u0441.",usb_enrollment_unverified:"\u0414\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u0432 HA \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u043E. \u041F\u0440\u043E\u0447\u0438\u0442\u0430\u0439\u0442\u0435 \u0441\u0442\u0430\u0442\u0443\u0441, \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u044F \u0437\u0430\u043F\u0440\u043E\u0441.",pm_title:"\u041F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u0438\u0442\u044C \u043F\u043E\u043B\u043D\u044B\u0439 \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441",pm_help:"\u0412\u043A\u043B\u044E\u0447\u0438\u0442 \u0448\u0442\u0430\u0442\u043D\u043E\u0435 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u043D\u043E\u0435 \u0440\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u0435, \u043D\u0443\u0436\u043D\u043E\u0435 \u0434\u043B\u044F \u043F\u043E\u043B\u043D\u043E\u0433\u043E \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430, \u043D\u0430 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0443\u044E \u043E\u0431\u044B\u0447\u043D\u0443\u044E \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0443. \u0422\u0435\u043A\u0443\u0449\u0438\u0439 \u044D\u043A\u0440\u0430\u043D \u043E\u0441\u0442\u0430\u043D\u0435\u0442\u0441\u044F \u0448\u0442\u0430\u0442\u043D\u044B\u043C. \u0414\u043E \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0430 \u043E\u0441\u0442\u0430\u0432\u044C\u0442\u0435 USB \u0438 \u043F\u0438\u0442\u0430\u043D\u0438\u0435 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D\u043D\u044B\u043C\u0438; \u044D\u0442\u043E\u0442 \u0448\u0430\u0433 \u043D\u0435 \u043F\u0435\u0440\u0435\u0437\u0430\u043F\u0443\u0441\u043A\u0430\u0435\u0442 \u043F\u0440\u0438\u0431\u043E\u0440.",pm_ack:"\u0421\u043E\u0433\u043B\u0430\u0441\u0435\u043D \u043D\u0430 \u044D\u0442\u043E\u0442 \u044D\u043A\u0441\u043F\u0435\u0440\u0438\u043C\u0435\u043D\u0442\u0430\u043B\u044C\u043D\u044B\u0439 \u044D\u0442\u0430\u043F. \u041F\u043E\u0441\u043B\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D\u043D\u043E\u0433\u043E \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0430 \u043F\u043E\u043B\u043D\u043E\u0441\u0442\u044C\u044E \u0432\u044B\u043A\u043B\u044E\u0447\u0443 \u0438 \u0432\u043A\u043B\u044E\u0447\u0443 \u043F\u0440\u0438\u0431\u043E\u0440.",pm_start:"\u041F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u0438\u0442\u044C \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0443\u044E \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0443",pm_status:"\u041F\u0440\u043E\u0447\u0438\u0442\u0430\u0442\u044C \u0441\u0442\u0430\u0442\u0443\u0441 \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0438",pm_running:"\u041F\u0440\u043E\u0432\u0435\u0440\u044F\u044E \u0442\u043E\u0447\u043D\u044B\u0439 \u0441\u0435\u0430\u043D\u0441 \u0448\u0442\u0430\u0442\u043D\u043E\u0439 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u044B \u0438 bridge, \u043F\u043E\u0434\u0433\u043E\u0442\u0430\u0432\u043B\u0438\u0432\u0430\u044E \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0443\u044E \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0443 \u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u044F\u044E \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0439 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442. \u041D\u0435 \u043E\u0442\u043A\u043B\u044E\u0447\u0430\u0439\u0442\u0435 USB \u0438 \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439\u0442\u0435 \u0437\u0430\u043F\u0440\u043E\u0441.",pm_not_started:"\u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0443\u0441\u043B\u043E\u0432\u0438\u044F \u043F\u043E\u043B\u043D\u043E\u0433\u043E \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430, \u0437\u0430\u0442\u0435\u043C \u043F\u0440\u0438 \u043D\u0435\u043E\u0431\u0445\u043E\u0434\u0438\u043C\u043E\u0441\u0442\u0438 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0435 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u0443\u044E \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0443 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0435\u0439 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438.",pm_pm_extension_unverified:"\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0438 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D. \u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u0437\u0430\u0434\u0430\u043D\u0438\u0435 \u0438 \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u0439\u0442\u0435 \u0435\u0433\u043E \u0441\u0442\u0430\u0442\u0443\u0441. \u041D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439\u0442\u0435 \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0443 \u0438 \u043D\u0435 \u043F\u0435\u0440\u0435\u0437\u0430\u0433\u0440\u0443\u0436\u0430\u0439\u0442\u0435 \u043F\u0440\u0438\u0431\u043E\u0440 \u0432\u043E \u0432\u0440\u0435\u043C\u044F \u043D\u0435\u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0451\u043D\u043D\u043E\u0439 \u0437\u0430\u043F\u0438\u0441\u0438.",pm_pm_extension_armed_waiting_reboot:"\u041F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0430 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0435\u0439 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0430. \u0415\u0441\u043B\u0438 \u043F\u043E\u0441\u043B\u0435 \u044D\u0442\u043E\u0433\u043E \u0448\u0430\u0433\u0430 \u0435\u0449\u0451 \u043D\u0435 \u0432\u044B\u043A\u043B\u044E\u0447\u0430\u043B\u0438 \u043F\u0440\u0438\u0431\u043E\u0440 \u043F\u043E\u043B\u043D\u043E\u0441\u0442\u044C\u044E \u0438 \u043D\u0435 \u0432\u043A\u043B\u044E\u0447\u0430\u043B\u0438 \u043E\u0431\u0440\u0430\u0442\u043D\u043E, \u0441\u0434\u0435\u043B\u0430\u0439\u0442\u0435 \u044D\u0442\u043E \u0441\u0435\u0439\u0447\u0430\u0441. \u0417\u0430\u0442\u0435\u043C \u0441\u043D\u043E\u0432\u0430 \u043F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0443\u0441\u043B\u043E\u0432\u0438\u044F \u043F\u043E\u043B\u043D\u043E\u0433\u043E \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430. \u042D\u0442\u043E \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0439 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442, \u043D\u0435 \u0442\u0435\u043A\u0443\u0449\u0430\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0440\u0430\u0431\u043E\u0442\u044B.",usb_pm_extension_review_required:"\u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0442\u043E\u0447\u043D\u0443\u044E \u0441\u0431\u043E\u0440\u043A\u0443 \u0438 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0435 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u0443\u044E \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0443 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0435\u0439 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438.",usb_pm_extension_bridge_required:"\u041D\u0443\u0436\u043D\u0430 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D\u043D\u0430\u044F \u043F\u0435\u0440\u0432\u0430\u044F \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0430 bridge \u0438\u0437 \u043D\u043E\u0432\u043E\u0439 \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u043D\u043E\u0439 \u0441\u0431\u043E\u0440\u043A\u0438 \u0434\u043E \u043B\u044E\u0431\u043E\u0439 \u043F\u043E\u043F\u044B\u0442\u043A\u0438 \u043F\u043E\u043B\u043D\u043E\u0433\u043E \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430. \u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u0441\u0442\u0430\u0440\u044B\u0435 \u0437\u0430\u0434\u0430\u043D\u0438\u044F; \u043D\u0435 \u0441\u0431\u0440\u0430\u0441\u044B\u0432\u0430\u0439\u0442\u0435 \u0443\u0436\u0435 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u044B\u0439 \u043C\u043E\u043D\u0438\u0442\u043E\u0440 \u0440\u0430\u0434\u0438 \u044D\u0442\u043E\u0433\u043E \u043C\u0430\u0441\u0442\u0435\u0440\u0430.",usb_pm_extension_unverified:"\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0438 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D. \u041F\u0440\u043E\u0447\u0438\u0442\u0430\u0439\u0442\u0435 \u0441\u0442\u0430\u0442\u0443\u0441 \u044D\u0442\u043E\u0433\u043E \u0437\u0430\u0434\u0430\u043D\u0438\u044F; \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439\u0442\u0435 \u0437\u0430\u043F\u0438\u0441\u044C.",usb_pm_extension_consumed:"\u041F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0430 \u0443\u0436\u0435 \u0437\u0430\u043F\u0440\u0430\u0448\u0438\u0432\u0430\u043B\u0430\u0441\u044C. \u041F\u0440\u043E\u0447\u0438\u0442\u0430\u0439\u0442\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0439 \u0441\u0442\u0430\u0442\u0443\u0441 \u0432\u043C\u0435\u0441\u0442\u043E \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u043E\u0439 \u0437\u0430\u043F\u0438\u0441\u0438.",usb_pm_extension_previous_unverified:"\u041F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0430\u044F \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0430 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0430. \u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0438\u0441\u0445\u043E\u0434\u043D\u0443\u044E \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u044E \u043F\u0435\u0440\u0435\u0434 \u043D\u043E\u0432\u043E\u0439 \u0437\u0430\u043F\u0438\u0441\u044C\u044E \u043D\u0430 \u043F\u0440\u0438\u0431\u043E\u0440.",full_activation_title:"\u041E\u0441\u0442\u0430\u0432\u0438\u0442\u044C \u043F\u043E\u043B\u043D\u044B\u0439 \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441",full_activation_help:"\u041F\u043E\u0441\u043B\u0435 \u0443\u0441\u043F\u0435\u0448\u043D\u043E\u0439 \u043F\u0440\u043E\u0431\u044B \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442 \u044D\u0442\u0443 \u0442\u043E\u0447\u043D\u0443\u044E \u043F\u0430\u0440\u0443 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C \u043D\u0430 \u043F\u0440\u0438\u0431\u043E\u0440\u0435, \u0432\u043A\u043B\u044E\u0447\u0438\u0442 \u0430\u0432\u0442\u043E\u0437\u0430\u043F\u0443\u0441\u043A \u0438 \u0437\u0430\u043F\u0443\u0441\u0442\u0438\u0442 \u043F\u043E\u043B\u043D\u044B\u0439 \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441. \u041E\u0441\u0442\u0430\u0432\u044C\u0442\u0435 USB \u0438 \u043F\u0438\u0442\u0430\u043D\u0438\u0435 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D\u043D\u044B\u043C\u0438. \u041F\u0435\u0440\u0435\u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 \u0438 \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u0438\u044F \u0432 Home Assistant \u044D\u0442\u043E\u0442 \u0448\u0430\u0433 \u043D\u0435 \u0434\u0435\u043B\u0430\u0435\u0442.",full_activation_screen_ack:"\u042F \u0432\u0438\u0434\u0435\u043B \u043F\u0440\u043E\u0431\u043D\u044B\u0439 \u044D\u043A\u0440\u0430\u043D \u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u0438\u043B, \u0447\u0442\u043E \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435 \u0438 \u043A\u0430\u0441\u0430\u043D\u0438\u044F \u0440\u0430\u0431\u043E\u0442\u0430\u044E\u0442.",full_activation_ack:"\u0425\u043E\u0447\u0443 \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u044D\u0442\u0443 \u0441\u0431\u043E\u0440\u043A\u0443 \u0438 \u0432\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u043F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u044B\u0439 \u0437\u0430\u043F\u0443\u0441\u043A \u043F\u043E\u043B\u043D\u043E\u0433\u043E \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430. \u041F\u043E\u043D\u0438\u043C\u0430\u044E, \u0447\u0442\u043E \u043F\u0435\u0440\u0432\u0430\u044F \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u044D\u043A\u0441\u043F\u0435\u0440\u0438\u043C\u0435\u043D\u0442\u0430\u043B\u044C\u043D\u0430\u044F.",full_activation_start:"\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0438 \u0437\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u044C \u043F\u043E\u043B\u043D\u044B\u0439 \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441",full_activation_status:"\u041F\u0440\u043E\u0447\u0438\u0442\u0430\u0442\u044C \u0441\u0442\u0430\u0442\u0443\u0441 \u043F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u043E\u0433\u043E \u0437\u0430\u043F\u0443\u0441\u043A\u0430",full_activation_running:"\u0421\u043E\u0445\u0440\u0430\u043D\u044F\u044E \u043F\u0430\u0440\u0443 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C \u0438 \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u044E \u043F\u043E\u043B\u043D\u044B\u0439 \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441. \u0416\u0434\u0443 \u0441\u0432\u0435\u0436\u0438\u0445 \u043E\u0441\u043D\u043E\u0432\u043D\u044B\u0445 \u043F\u043E\u043A\u0430\u0437\u0430\u043D\u0438\u0439 \u0438 \u043E\u0431\u0435\u0438\u0445 \u0437\u0430\u0449\u0438\u0442\u043D\u044B\u0445 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C; \u044D\u0442\u043E \u043C\u043E\u0436\u0435\u0442 \u0437\u0430\u043D\u044F\u0442\u044C \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u043C\u0438\u043D\u0443\u0442. \u041F\u043E\u0432\u0442\u043E\u0440\u043D\u043E\u0439 \u043A\u043E\u043C\u0430\u043D\u0434\u044B \u0437\u0430\u043F\u0443\u0441\u043A\u0430 \u043D\u0435 \u0431\u0443\u0434\u0435\u0442.",full_activation_not_started:"\u041F\u043E\u0441\u043B\u0435 \u043F\u0440\u043E\u0431\u044B \u0432\u0435\u0440\u043D\u0443\u043B\u0441\u044F \u0448\u0442\u0430\u0442\u043D\u044B\u0439 \u0440\u0435\u0436\u0438\u043C. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u044D\u043A\u0440\u0430\u043D \u0441\u0430\u043C\u0438, \u0437\u0430\u0442\u0435\u043C \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u044B\u0439 \u0437\u0430\u043F\u0443\u0441\u043A.",full_activation_full_ui_active_observed:"\u0421\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0439 \u043F\u043E\u043B\u043D\u044B\u0439 \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441 \u0437\u0430\u043F\u0443\u0441\u0442\u0438\u043B\u0441\u044F: \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u044B \u043E\u0441\u043D\u043E\u0432\u043D\u044B\u0435 \u0444\u0438\u0437\u0438\u0447\u0435\u0441\u043A\u0438\u0435 \u043F\u043E\u043A\u0430\u0437\u0430\u043D\u0438\u044F \u0438 \u043E\u0431\u0435 \u0437\u0430\u0449\u0438\u0442\u043D\u044B\u0435 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u044B. \u0410\u0432\u0442\u043E\u0437\u0430\u043F\u0443\u0441\u043A \u0431\u044B\u043B \u0432\u043A\u043B\u044E\u0447\u0451\u043D. \u042D\u0442\u043E \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0439 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442, \u043D\u0435 \u0442\u0435\u043A\u0443\u0449\u0430\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0441\u0432\u044F\u0437\u0438. \u0414\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u0438\u0435 ESPHome \u0432 HA \u043E\u0441\u0442\u0430\u0451\u0442\u0441\u044F \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u043C \u0448\u0430\u0433\u043E\u043C.",full_activation_full_ui_activation_unverified:"\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u043F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u043E\u0433\u043E \u0437\u0430\u043F\u0443\u0441\u043A\u0430 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D. \u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u0437\u0430\u0434\u0430\u043D\u0438\u0435 \u0438 \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u0439\u0442\u0435 \u0435\u0433\u043E \u0441\u0442\u0430\u0442\u0443\u0441; \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439\u0442\u0435 \u0437\u0430\u043F\u0440\u043E\u0441 \u0438 \u043D\u0435 \u0441\u0431\u0440\u0430\u0441\u044B\u0432\u0430\u0439\u0442\u0435 \u0438\u0441\u0442\u043E\u0440\u0438\u044E.",full_activation_full_ui_activation_close_unverified:"\u0417\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u0435 \u0441\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u044F \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u043E. \u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u0437\u0430\u0434\u0430\u043D\u0438\u0435; \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439\u0442\u0435 \u0437\u0430\u043F\u0440\u043E\u0441 \u043F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u043E\u0433\u043E \u0437\u0430\u043F\u0443\u0441\u043A\u0430.",full_activation_full_ui_activation_space:"\u041D\u0430 \u043F\u0440\u0438\u0431\u043E\u0440\u0435 \u043D\u0435\u0434\u043E\u0441\u0442\u0430\u0442\u043E\u0447\u043D\u043E \u0438\u0437\u043C\u0435\u0440\u0435\u043D\u043D\u043E\u0433\u043E \u0441\u0432\u043E\u0431\u043E\u0434\u043D\u043E\u0433\u043E \u043C\u0435\u0441\u0442\u0430. \u041A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C \u0438 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0435 \u0430\u0432\u0442\u043E\u0437\u0430\u043F\u0443\u0441\u043A\u0430 \u043D\u0435 \u0437\u0430\u043F\u0440\u0430\u0448\u0438\u0432\u0430\u043B\u0438\u0441\u044C. \u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u044D\u0442\u0443 \u043F\u043E\u043F\u044B\u0442\u043A\u0443; \u043D\u0435 \u0443\u0434\u0430\u043B\u044F\u0439\u0442\u0435 \u0444\u0430\u0439\u043B\u044B \u0438 \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439\u0442\u0435 \u0435\u0451 \u0432\u0441\u043B\u0435\u043F\u0443\u044E.",usb_full_ui_activation_review_required:"\u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0442\u043E\u0447\u043D\u0443\u044E \u0441\u0431\u043E\u0440\u043A\u0443, \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0435 \u0440\u0430\u0431\u043E\u0442\u0443 \u043F\u0440\u043E\u0431\u043D\u043E\u0433\u043E \u044D\u043A\u0440\u0430\u043D\u0430 \u0438 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E \u0441\u043E\u0433\u043B\u0430\u0441\u0438\u0442\u0435\u0441\u044C \u043D\u0430 \u043F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u044B\u0439 \u0437\u0430\u043F\u0443\u0441\u043A.",usb_full_ui_activation_trial_required:"\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u043D\u0443\u0436\u043D\u0430 \u0443\u0441\u043F\u0435\u0448\u043D\u0430\u044F \u0438\u0441\u0445\u043E\u0434\u043D\u0430\u044F \u043F\u0440\u043E\u0431\u0430 \u044D\u043A\u0440\u0430\u043D\u0430 \u0441 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D\u043D\u044B\u043C \u0432\u043E\u0437\u0432\u0440\u0430\u0442\u043E\u043C \u0432 \u0448\u0442\u0430\u0442\u043D\u044B\u0439 \u0440\u0435\u0436\u0438\u043C.",usb_full_ui_activation_unverified:"\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u043F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u043E\u0433\u043E \u0437\u0430\u043F\u0443\u0441\u043A\u0430 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D. \u041F\u0440\u043E\u0447\u0438\u0442\u0430\u0439\u0442\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0439 \u0441\u0442\u0430\u0442\u0443\u0441; \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439\u0442\u0435 \u0437\u0430\u043F\u0440\u043E\u0441.",usb_full_ui_activation_consumed:"\u041F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u044B\u0439 \u0437\u0430\u043F\u0443\u0441\u043A \u0434\u043B\u044F \u044D\u0442\u043E\u0433\u043E \u0437\u0430\u0434\u0430\u043D\u0438\u044F \u0443\u0436\u0435 \u0437\u0430\u043F\u0440\u0430\u0448\u0438\u0432\u0430\u043B\u0441\u044F. \u041F\u0440\u043E\u0447\u0438\u0442\u0430\u0439\u0442\u0435 \u0435\u0433\u043E \u0441\u0442\u0430\u0442\u0443\u0441 \u0432\u043C\u0435\u0441\u0442\u043E \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u043E\u0433\u043E \u0437\u0430\u043F\u0443\u0441\u043A\u0430.",usb_full_ui_activation_previous_unverified:"\u041F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0430\u044F \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u044F \u043F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u043E\u0433\u043E \u0437\u0430\u043F\u0443\u0441\u043A\u0430 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0430. \u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0435\u0451 \u0438\u0441\u0442\u043E\u0440\u0438\u044E \u043F\u0435\u0440\u0435\u0434 \u043D\u043E\u0432\u043E\u0439 \u0437\u0430\u043F\u0438\u0441\u044C\u044E \u043D\u0430 \u043F\u0440\u0438\u0431\u043E\u0440.",core_tools_title:"\u041F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0430",core_tools_help:"\u0412\u0441\u0451 \u0432\u0445\u043E\u0434\u0438\u0442 \u0432 \u044D\u0442\u0443 HACS-\u0438\u043D\u0442\u0435\u0433\u0440\u0430\u0446\u0438\u044E. \u041F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043D\u044B\u0435 ADB \u0438 \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u044B \u0441\u0431\u043E\u0440\u043A\u0438 \u0441\u043A\u0430\u0447\u0438\u0432\u0430\u044E\u0442\u0441\u044F \u0432 \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u043E\u0435 \u0445\u0440\u0430\u043D\u0438\u043B\u0438\u0449\u0435 HA. \u041E\u0442\u0434\u0435\u043B\u044C\u043D\u043E\u0435 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u043D\u0435 \u0443\u0441\u0442\u0430\u043D\u0430\u0432\u043B\u0438\u0432\u0430\u0435\u0442\u0441\u044F, USB \u0435\u0449\u0451 \u043D\u0435 \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u0435\u0442\u0441\u044F. \u0414\u043B\u044F \u043F\u0435\u0440\u0432\u043E\u0439 \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0438 \u043D\u0443\u0436\u043D\u044B \u0438\u043D\u0442\u0435\u0440\u043D\u0435\u0442 \u0438 \u043C\u0438\u043D\u0438\u043C\u0443\u043C 6 \u0413\u0438\u0411 \u0441\u0432\u043E\u0431\u043E\u0434\u043D\u043E\u0433\u043E \u043C\u0435\u0441\u0442\u0430.",core_tools_prepare:"\u041F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u0438\u0442\u044C \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u044B",core_tools_required:"\u041D\u0443\u0436\u043D\u043E \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u0438\u0442\u044C \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u044B \u0441\u0435\u0440\u0432\u0435\u0440\u0430.",core_tools_preparing:"\u0421\u043A\u0430\u0447\u0438\u0432\u0430\u044E \u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u044F\u044E \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u044B\u2026 \u042D\u0442\u043E \u043C\u043E\u0436\u0435\u0442 \u0437\u0430\u043D\u044F\u0442\u044C \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u043C\u0438\u043D\u0443\u0442.",core_tools_ready:"\u0418\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u044B \u0441\u0435\u0440\u0432\u0435\u0440\u0430 \u0433\u043E\u0442\u043E\u0432\u044B.",usb_core_tools_failed:"\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u0438\u0442\u044C \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u044B. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0438\u043D\u0442\u0435\u0440\u043D\u0435\u0442 \u0438 \u0441\u0432\u043E\u0431\u043E\u0434\u043D\u043E\u0435 \u043C\u0435\u0441\u0442\u043E. \u0423\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u043D\u0430 \u043F\u0440\u0438\u0431\u043E\u0440 \u043D\u0435 \u043D\u0430\u0447\u0438\u043D\u0430\u043B\u0430\u0441\u044C.",usb_core_unsupported:"USB \u0441\u0435\u0440\u0432\u0435\u0440\u0430 \u043F\u043E\u043A\u0430 \u0442\u0440\u0435\u0431\u0443\u0435\u0442 Home Assistant \u043D\u0430 Alpine 3.24, x86-64 \u0438\u043B\u0438 ARM64. USB \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440\u0430 \u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E.",usb_core_unverified:"\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u0438 \u0441\u0435\u0440\u0432\u0435\u0440\u0430 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D. \u041F\u0440\u043E\u0447\u0438\u0442\u0430\u0439\u0442\u0435 \u0441\u0442\u0430\u0442\u0443\u0441 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u043E\u0433\u043E \u0437\u0430\u0434\u0430\u043D\u0438\u044F, \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439\u0442\u0435 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0443.",usb_core_unavailable:"\u0412\u0441\u0442\u0440\u043E\u0435\u043D\u043D\u044B\u0439 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u0447\u0438\u043A Monitor 1 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D. \u041E\u0431\u043D\u043E\u0432\u0438\u0442\u0435 HACS-\u0438\u043D\u0442\u0435\u0433\u0440\u0430\u0446\u0438\u044E.",usb_core_storage_unverified:"\u041F\u0440\u0438\u0432\u0430\u0442\u043D\u043E\u0435 \u0445\u0440\u0430\u043D\u0438\u043B\u0438\u0449\u0435 \u0441\u0435\u0440\u0432\u0435\u0440\u0430 \u043D\u0435 \u043F\u0440\u043E\u0448\u043B\u043E \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0443. \u0421\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0438\u0435 \u0444\u0430\u0439\u043B\u044B \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B.",language:"\u042F\u0437\u044B\u043A",intro:"Monitor 1 / CGS1 \u2014 \u044D\u043A\u0441\u043F\u0435\u0440\u0438\u043C\u0435\u043D\u0442\u0430\u043B\u044C\u043D\u0430\u044F \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u0447\u0435\u0440\u0435\u0437 USB",prepare:"\u041F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u044C\u0442\u0435 \u043C\u043E\u043D\u0438\u0442\u043E\u0440",enable:"\u041D\u0430 \u0448\u0442\u0430\u0442\u043D\u043E\u043C \u043C\u043E\u043D\u0438\u0442\u043E\u0440\u0435 \u0432\u043A\u043B\u044E\u0447\u0438\u0442\u0435 ADB: \u0432\u0432\u0435\u0434\u0438\u0442\u0435 #adb=on# \u0432 \u043F\u043E\u043B\u0435 \u043F\u0430\u0440\u043E\u043B\u044F Wi-Fi. \u0417\u0430\u0442\u0435\u043C \u0432\u0435\u0440\u043D\u0438\u0442\u0435\u0441\u044C \u0432 \u0441\u0432\u043E\u044E \u0441\u0435\u0442\u044C \u0441 \u0435\u0451 \u043D\u0430\u0441\u0442\u043E\u044F\u0449\u0438\u043C \u043F\u0430\u0440\u043E\u043B\u0435\u043C.",cable:"\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u0435 USB-C \u043A\u0430\u0431\u0435\u043B\u0435\u043C \u0441 \u043F\u0435\u0440\u0435\u0434\u0430\u0447\u0435\u0439 \u0434\u0430\u043D\u043D\u044B\u0445 \u043A \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440\u0443 \u0438\u043B\u0438 \u0441\u0435\u0440\u0432\u0435\u0440\u0443 Home Assistant \u2014 \u0432 \u0437\u0430\u0432\u0438\u0441\u0438\u043C\u043E\u0441\u0442\u0438 \u043E\u0442 \u0432\u044B\u0431\u043E\u0440\u0430 \u043D\u0438\u0436\u0435.",boundary:"\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044F \u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u0435 \u0438\u0441\u0445\u043E\u0434\u043D\u044B\u0445 \u0444\u0430\u0439\u043B\u043E\u0432 \u0447\u0438\u0442\u0430\u044E\u0442 \u043F\u0440\u0438\u0431\u043E\u0440. \u0423\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u0432\u044B\u043F\u043E\u043B\u043D\u044F\u0435\u0442\u0441\u044F \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E \u043F\u043E\u0441\u043B\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u044F \u043D\u0438\u0436\u0435. \u0423\u0436\u0435 \u0438\u0437\u043C\u0435\u043D\u0451\u043D\u043D\u044B\u0435 \u0438 \u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0435 \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u044B \u043D\u0435 \u0434\u043E\u043F\u0443\u0441\u043A\u0430\u044E\u0442\u0441\u044F \u043A \u043F\u0435\u0440\u0432\u043E\u0439 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0435.",where:"\u041A\u0443\u0434\u0430 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D \u043A\u0430\u0431\u0435\u043B\u044C?",transport:"USB-\u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435",computer:"\u041A \u044D\u0442\u043E\u043C\u0443 \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440\u0443",server:"\u041A \u0441\u0435\u0440\u0432\u0435\u0440\u0443 Home Assistant",browser_help:"\u041D\u0443\u0436\u0435\u043D Chrome \u0438\u043B\u0438 Edge \u0438 HTTPS. \u0411\u0440\u0430\u0443\u0437\u0435\u0440 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0438\u0442 \u0432\u044B\u0431\u0440\u0430\u0442\u044C USB-\u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E.",ha_help:"\u0418\u043D\u0442\u0435\u0433\u0440\u0430\u0446\u0438\u044F \u0447\u0438\u0442\u0430\u0435\u0442 USB \u0441\u0435\u0440\u0432\u0435\u0440\u0430. \u041F\u043E\u0434\u0434\u0435\u0440\u0436\u043A\u0430 USB \u0432 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0435 \u0438 \u043A\u0430\u0431\u0435\u043B\u044C \u0443 \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440\u0430 \u043D\u0435 \u043D\u0443\u0436\u043D\u044B.",scan:"\u041D\u0430\u0439\u0442\u0438 USB-\u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430",device:"\u0412\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u0435 USB-\u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E",choose:"\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E",inspect:"\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C USB-\u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435",searching:"\u0418\u0449\u0443 USB-\u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430 \u043D\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0435\u2026",found:"USB-\u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430 \u043D\u0430\u0439\u0434\u0435\u043D\u044B. \u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043C\u043E\u043D\u0438\u0442\u043E\u0440.",no_devices:"\u0410\u0432\u0442\u043E\u0440\u0438\u0437\u043E\u0432\u0430\u043D\u043D\u044B\u0435 USB-\u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430 ADB \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u044B. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u043A\u0430\u0431\u0435\u043B\u044C \u0438 \u0432\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 ADB \u043D\u0430 \u043C\u043E\u043D\u0438\u0442\u043E\u0440\u0435.",checking:"\u041F\u0440\u043E\u0432\u0435\u0440\u044F\u044E \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0439 \u043C\u043E\u043D\u0438\u0442\u043E\u0440\u2026",success:"\u0428\u0442\u0430\u0442\u043D\u044B\u0435 \u0438\u0441\u0445\u043E\u0434\u043D\u044B\u0435 \u0444\u0430\u0439\u043B\u044B \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u044B. \u0423\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u043F\u0440\u043E\u0448\u0438\u0432\u043A\u0438 \u0435\u0449\u0451 \u043D\u0435 \u043D\u0430\u0447\u0430\u043B\u0430\u0441\u044C.",capture:"\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0438\u0441\u0445\u043E\u0434\u043D\u044B\u0435 \u0444\u0430\u0439\u043B\u044B",copying:"\u041A\u043E\u043F\u0438\u0440\u0443\u044E \u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u044F\u044E \u0438\u0441\u0445\u043E\u0434\u043D\u044B\u0435 \u0444\u0430\u0439\u043B\u044B\u2026",capture_help:"\u0421\u043A\u0430\u0447\u0438\u0432\u0430\u0435\u0442 \u043D\u0430 \u044D\u0442\u043E\u0442 \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440 \u0434\u0435\u0432\u044F\u0442\u044C \u0438\u0441\u0445\u043E\u0434\u043D\u044B\u0445 \u0444\u0430\u0439\u043B\u043E\u0432 \u0434\u043B\u044F \u0441\u0431\u043E\u0440\u043A\u0438 \u0438 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F. \u042D\u0442\u043E \u043D\u0435 \u043F\u043E\u043B\u043D\u0430\u044F \u0440\u0435\u0437\u0435\u0440\u0432\u043D\u0430\u044F \u043A\u043E\u043F\u0438\u044F \u043F\u0440\u0438\u0431\u043E\u0440\u0430. \u0425\u0440\u0430\u043D\u0438\u0442\u0435 \u0430\u0440\u0445\u0438\u0432 \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u043E: \u043E\u043D \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u0438\u0434\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0442\u043E\u0440\u044B \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430. \u0423\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u043F\u0440\u043E\u0448\u0438\u0432\u043A\u0438 \u043D\u0435 \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u0435\u0442\u0441\u044F.",capture_success:"\u0418\u0441\u0445\u043E\u0434\u043D\u044B\u0435 \u0444\u0430\u0439\u043B\u044B \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u044B, \u0441\u043A\u0430\u0447\u0438\u0432\u0430\u043D\u0438\u0435 \u043D\u0430\u0447\u0430\u043B\u043E\u0441\u044C. \u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u0430\u0440\u0445\u0438\u0432 \u0434\u043B\u044F \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438 \u0438 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F.",usb_capture_unverified:"\u041A\u043E\u043F\u0438\u044E \u0438\u0441\u0445\u043E\u0434\u043D\u044B\u0445 \u0444\u0430\u0439\u043B\u043E\u0432 \u043D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C. \u041D\u0435\u043F\u043E\u043B\u043D\u044B\u0439 \u0430\u0440\u0445\u0438\u0432 \u043D\u0435 \u043F\u0440\u0435\u0434\u043B\u0430\u0433\u0430\u043B\u0441\u044F. \u041F\u0440\u043E\u0448\u0438\u0432\u043A\u0430 \u043D\u0435 \u0443\u0441\u0442\u0430\u043D\u0430\u0432\u043B\u0438\u0432\u0430\u043B\u0430\u0441\u044C.",prepare_install:"\u041F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0430 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438",friendly_name:"\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430",prepare_profile:"\u041F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u0438\u0442\u044C \u043F\u0440\u043E\u0444\u0438\u043B\u044C \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430",open_preparation:"\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0443 \u043D\u0430 Home Assistant",refresh_preparations:"\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0435 \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0438",saved_preparations:"\u0414\u043E\u0441\u0442\u0443\u043F\u043D\u044B\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0435 \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0438",choose_preparation:"\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u0443\u044E \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0443",preparation_pending:"\u041D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u043E",usb_job_list_failed:"\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u0442\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0435 \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0438. \u041F\u0440\u0435\u0436\u043D\u0438\u0435 \u0444\u0430\u0439\u043B\u044B \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B; \u043E\u0431\u043D\u043E\u0432\u0438\u0442\u0435 \u0441\u043F\u0438\u0441\u043E\u043A \u0434\u043B\u044F \u043D\u043E\u0432\u043E\u0439 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438.",preparation_help:"\u0421\u043E\u0437\u0434\u0430\u0451\u0442 \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u044B\u0439 \u043F\u0440\u043E\u0444\u0438\u043B\u044C \u043D\u0430 \u0432\u0430\u0448\u0435\u043C \u0441\u0435\u0440\u0432\u0435\u0440\u0435 Home Assistant. \u041F\u0440\u0438 USB \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440\u0430 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043D\u044B\u0435 \u0438\u0441\u0445\u043E\u0434\u043D\u044B\u0435 \u0444\u0430\u0439\u043B\u044B \u043F\u0435\u0440\u0435\u0434\u0430\u044E\u0442\u0441\u044F \u044D\u0442\u043E\u043C\u0443 \u0441\u0435\u0440\u0432\u0435\u0440\u0443. \u041A\u043B\u044E\u0447 \u043E\u0441\u0442\u0430\u0451\u0442\u0441\u044F \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u044B\u043C. \u0417\u0430\u0442\u0435\u043C \u0437\u0434\u0435\u0441\u044C \u043C\u043E\u0436\u043D\u043E \u0441\u043E\u0431\u0440\u0430\u0442\u044C \u043F\u0440\u043E\u0448\u0438\u0432\u043A\u0443; \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u0432\u044B\u043F\u043E\u043B\u043D\u044F\u0435\u0442\u0441\u044F \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E.",build_firmware:"\u0421\u043E\u0431\u0440\u0430\u0442\u044C \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u0443\u044E \u043F\u0440\u043E\u0448\u0438\u0432\u043A\u0443",check_build:"\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u0441\u0431\u043E\u0440\u043A\u0443",build_help:"\u0421\u0431\u043E\u0440\u043A\u0430 \u0432\u044B\u043F\u043E\u043B\u043D\u044F\u0435\u0442\u0441\u044F \u043D\u0430 HA-\u0441\u0435\u0440\u0432\u0435\u0440\u0435 \u043D\u0430 \u043E\u0434\u043D\u043E\u043C \u043B\u043E\u0433\u0438\u0447\u0435\u0441\u043A\u043E\u043C \u044F\u0434\u0440\u0435 \u0441 \u043F\u043E\u043D\u0438\u0436\u0435\u043D\u043D\u044B\u043C \u043F\u0440\u0438\u043E\u0440\u0438\u0442\u0435\u0442\u043E\u043C. \u041D\u0443\u0436\u043D\u044B \u043C\u0438\u043D\u0438\u043C\u0443\u043C 6 \u0413\u0438\u0411 \u0441\u0432\u043E\u0431\u043E\u0434\u043D\u043E\u0433\u043E \u043C\u0435\u0441\u0442\u0430 \u0438 \u0441\u043A\u0430\u0447\u0438\u0432\u0430\u043D\u0438\u0435 \u043F\u0443\u0431\u043B\u0438\u0447\u043D\u044B\u0445 \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u043E\u0432 \u0441\u0431\u043E\u0440\u043A\u0438. \u041F\u0440\u0438\u0432\u0430\u0442\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435 \u043E\u0441\u0442\u0430\u044E\u0442\u0441\u044F \u043D\u0430 \u044D\u0442\u043E\u043C \u0441\u0435\u0440\u0432\u0435\u0440\u0435. \u041D\u0430 \u043C\u043E\u043D\u0438\u0442\u043E\u0440 \u043D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u0437\u0430\u043F\u0438\u0441\u044B\u0432\u0430\u0435\u0442\u0441\u044F. \u041D\u0430\u0447\u0430\u0442\u0430\u044F \u0441\u0431\u043E\u0440\u043A\u0430 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438 \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0435\u0442\u0441\u044F.",build_not_started:"\u041F\u0440\u043E\u0448\u0438\u0432\u043A\u0430 \u0435\u0449\u0451 \u043D\u0435 \u0441\u043E\u0431\u0440\u0430\u043D\u0430.",build_building:"\u0421\u043E\u0431\u0438\u0440\u0430\u044E \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u0443\u044E \u043F\u0440\u043E\u0448\u0438\u0432\u043A\u0443\u2026",build_phase_source:"\u0421\u043A\u0430\u0447\u0438\u0432\u0430\u044E \u0437\u0430\u043A\u0440\u0435\u043F\u043B\u0451\u043D\u043D\u0443\u044E \u0432\u0435\u0440\u0441\u0438\u044E \u0438\u0441\u0445\u043E\u0434\u043D\u0438\u043A\u043E\u0432.",build_phase_sdk:"\u041F\u043E\u0434\u0433\u043E\u0442\u0430\u0432\u043B\u0438\u0432\u0430\u044E \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u044B \u0441\u0431\u043E\u0440\u043A\u0438.",build_phase_compile:"\u041A\u043E\u043C\u043F\u0438\u043B\u0438\u0440\u0443\u044E \u0441\u0432\u044F\u0437\u0430\u043D\u043D\u044B\u0435 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u044B.",build_built_not_installed:"\u041F\u0440\u0438\u0432\u0430\u0442\u043D\u0430\u044F \u043F\u0440\u043E\u0448\u0438\u0432\u043A\u0430 \u0441\u043E\u0431\u0440\u0430\u043D\u0430, \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u044C\u043D\u044B\u0435 \u0441\u0443\u043C\u043C\u044B \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u044B. \u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 \u0448\u0430\u0433 \u043D\u0438\u0436\u0435; \u0441\u0431\u043E\u0440\u043A\u0430 \u043D\u0438\u0447\u0435\u0433\u043E \u043D\u0430 \u043C\u043E\u043D\u0438\u0442\u043E\u0440 \u043D\u0435 \u0437\u0430\u043F\u0438\u0441\u044B\u0432\u0430\u043B\u0430.",computer_install_title:"\u0423\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u0447\u0435\u0440\u0435\u0437 \u044D\u0442\u043E\u0442 \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440",computer_install_help:"\u0421\u043A\u0430\u0447\u0430\u0439\u0442\u0435 \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u0443\u044E \u0441\u0431\u043E\u0440\u043A\u0443, \u0437\u0430\u0442\u0435\u043C \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439\u0442\u0435 \u0432\u043B\u043E\u0436\u0435\u043D\u043D\u044B\u0439 ADB-\u0443\u0441\u0442\u0430\u043D\u043E\u0432\u0449\u0438\u043A \u0434\u043B\u044F macOS/Linux \u0438 \u0438\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0438\u044E. \u0421\u0431\u043E\u0440\u043A\u0430 \u043E\u0441\u0442\u0430\u0451\u0442\u0441\u044F \u043D\u0430 HA; \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440\u0443 \u043D\u0443\u0436\u043D\u044B Python \u0438 Android platform-tools, \u0431\u0435\u0437 VM. \u041B\u043E\u043A\u0430\u043B\u044C\u043D\u0430\u044F \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0430 \u0437\u0430\u043D\u043E\u0432\u043E \u0447\u0438\u0442\u0430\u0435\u0442 \u043D\u0430\u0441\u0442\u043E\u044F\u0449\u0438\u0439 USB \u043F\u0435\u0440\u0435\u0434 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u043E\u0439 \u043F\u043E\u0441\u043B\u0435 \u044F\u0432\u043D\u043E\u0439 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438. \u0417\u0430\u043F\u0438\u0441\u044C \u0442\u043E\u043B\u044C\u043A\u043E \u0438\u0437 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0430 \u0447\u0435\u0440\u0435\u0437 WebUSB \u0435\u0449\u0451 \u043D\u0435 \u0433\u043E\u0442\u043E\u0432\u0430.",export_computer:"\u0421\u043A\u0430\u0447\u0430\u0442\u044C \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u044B\u0439 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u0449\u0438\u043A \u0434\u043B\u044F \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440\u0430",computer_downloaded:"\u041D\u0430\u0447\u0430\u043B\u043E\u0441\u044C \u0441\u043A\u0430\u0447\u0438\u0432\u0430\u043D\u0438\u0435 \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u043E\u0433\u043E \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u0449\u0438\u043A\u0430. \u041F\u0440\u043E\u0447\u0438\u0442\u0430\u0439\u0442\u0435 README.txt \u0432\u043D\u0443\u0442\u0440\u0438 \u043F\u0435\u0440\u0435\u0434 \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u044B\u043C\u0438 \u043A\u043E\u043C\u0430\u043D\u0434\u0430\u043C\u0438. \u0421\u0430\u043C\u043E \u0441\u043A\u0430\u0447\u0438\u0432\u0430\u043D\u0438\u0435 \u043D\u0438\u0447\u0435\u0433\u043E \u043D\u0430 \u043C\u043E\u043D\u0438\u0442\u043E\u0440 \u043D\u0435 \u0437\u0430\u043F\u0438\u0441\u044B\u0432\u0430\u0435\u0442.",usb_computer_after_install:"\u0412 \u044D\u0442\u043E\u043C \u0437\u0430\u0434\u0430\u043D\u0438\u0438 HA \u0443\u0436\u0435 \u0431\u044B\u043B\u0430 \u043F\u043E\u043F\u044B\u0442\u043A\u0430 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438. \u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u0435\u0451 \u0438\u0441\u0445\u043E\u0434\u043D\u044B\u0435 \u0437\u0430\u043F\u0438\u0441\u0438 \u0438 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439\u0442\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0443 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0430 \u0438\u043B\u0438 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435; \u0432\u0442\u043E\u0440\u043E\u0439 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u0449\u0438\u043A \u0434\u043B\u044F \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440\u0430 \u043D\u0435 \u0432\u044B\u0434\u0430\u043D.",usb_computer_package_limit:"\u041F\u0440\u0438\u0432\u0430\u0442\u043D\u044B\u0439 \u043D\u0430\u0431\u043E\u0440 \u043F\u0440\u0435\u0432\u044B\u0448\u0430\u0435\u0442 \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0435\u043D\u0438\u0435 \u0441\u043A\u0430\u0447\u0438\u0432\u0430\u043D\u0438\u044F. \u0421\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0438\u0435 \u0444\u0430\u0439\u043B\u044B \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B.",build_build_failed:"\u0421\u0431\u043E\u0440\u043A\u0430 \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u043B\u0430\u0441\u044C \u043E\u0448\u0438\u0431\u043A\u043E\u0439. \u041F\u0440\u0438\u0432\u0430\u0442\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435 \u0438 \u0436\u0443\u0440\u043D\u0430\u043B \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B; \u043D\u0430\u0447\u0430\u0442\u0430\u044F \u0441\u0431\u043E\u0440\u043A\u0430 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438 \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u0441\u044F.",build_build_unverified:"\u0421\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \u0441\u0431\u043E\u0440\u043A\u0438 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u043E. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0435\u0433\u043E \u0435\u0449\u0451 \u0440\u0430\u0437; \u043D\u0435 \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u0439\u0442\u0435 \u0437\u0430\u043C\u0435\u043D\u044F\u044E\u0449\u0443\u044E \u0441\u0431\u043E\u0440\u043A\u0443.",usb_build_unverified:"\u0421\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \u0441\u0431\u043E\u0440\u043A\u0438 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u043E. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0442\u043E \u0436\u0435 \u0437\u0430\u0434\u0430\u043D\u0438\u0435; \u0437\u0430\u043F\u0440\u043E\u0441 \u0437\u0430\u043F\u0443\u0441\u043A\u0430 \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0435\u0442\u0441\u044F.",usb_build_consumed:"\u0421\u0431\u043E\u0440\u043A\u0430 \u0434\u043B\u044F \u044D\u0442\u043E\u0433\u043E \u0437\u0430\u0434\u0430\u043D\u0438\u044F \u0443\u0436\u0435 \u0437\u0430\u043F\u0440\u043E\u0448\u0435\u043D\u0430. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0435\u0451 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435.",usb_build_space:"\u0414\u043B\u044F \u0437\u0430\u043F\u0443\u0441\u043A\u0430 \u043D\u0443\u0436\u043D\u044B \u043C\u0438\u043D\u0438\u043C\u0443\u043C 6 \u0413\u0438\u0411 \u0441\u0432\u043E\u0431\u043E\u0434\u043D\u043E\u0433\u043E \u043C\u0435\u0441\u0442\u0430. \u041F\u0440\u0435\u0436\u043D\u0438\u0435 \u0437\u0430\u0434\u0430\u043D\u0438\u044F \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B.",usb_build_busy:"\u041D\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0435 \u0443\u0436\u0435 \u0432\u044B\u043F\u043E\u043B\u043D\u044F\u0435\u0442\u0441\u044F \u0434\u0440\u0443\u0433\u0430\u044F \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u0430\u044F \u0441\u0431\u043E\u0440\u043A\u0430. \u042D\u0442\u043E \u0437\u0430\u0434\u0430\u043D\u0438\u0435 \u0435\u0449\u0451 \u043D\u0435 \u0437\u0430\u043F\u0443\u0449\u0435\u043D\u043E.",prepare_plan:"\u041F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u0438\u0442\u044C \u0444\u0430\u0439\u043B\u044B \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438",check_plan:"\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u0444\u0430\u0439\u043B\u044B \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438",plan_not_prepared:"\u0413\u043E\u0442\u043E\u0432\u044B\u0435 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u044B \u043C\u043E\u0436\u043D\u043E \u043E\u0431\u044A\u0435\u0434\u0438\u043D\u0438\u0442\u044C \u0441 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043D\u044B\u043C\u0438 \u0438\u0441\u0445\u043E\u0434\u043D\u044B\u043C\u0438 \u0444\u0430\u0439\u043B\u0430\u043C\u0438. \u042D\u0442\u043E\u0442 \u0448\u0430\u0433 \u0442\u043E\u043B\u044C\u043A\u043E \u0441\u043E\u0437\u0434\u0430\u0451\u0442 \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u044B\u0439 \u043D\u0430\u0431\u043E\u0440; \u0437\u0430\u043F\u0438\u0441\u0438 \u0447\u0435\u0440\u0435\u0437 USB \u043D\u0435\u0442.",plan_plan_prepared:"\u0424\u0430\u0439\u043B\u044B \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u044B. \u041D\u0438\u0436\u0435 \u043C\u043E\u0436\u043D\u043E \u043F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u0438 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044C \u044D\u043A\u0441\u043F\u0435\u0440\u0438\u043C\u0435\u043D\u0442\u0430\u043B\u044C\u043D\u0443\u044E \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0443 \u0447\u0435\u0440\u0435\u0437 USB \u0441\u0435\u0440\u0432\u0435\u0440\u0430. \u0417\u0430\u043F\u0440\u0430\u0448\u0438\u0432\u0430\u0435\u043C\u044B\u0439 \u0437\u0430\u043F\u0430\u0441 \u043C\u0435\u0441\u0442\u0430 \u043D\u0430 \u043F\u0440\u0438\u0431\u043E\u0440\u0435 (\u043D\u0435 \u0438\u0437\u043C\u0435\u0440\u0435\u043D\u043D\u0430\u044F \u0441\u0432\u043E\u0431\u043E\u0434\u043D\u0430\u044F \u043F\u0430\u043C\u044F\u0442\u044C):",plan_plan_unverified:"\u041F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0430 \u0444\u0430\u0439\u043B\u043E\u0432 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0430. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0435\u0451 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435; \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439\u0442\u0435 \u0437\u0430\u043F\u0440\u043E\u0441.",plan_plan_failed:"\u041F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0430 \u0444\u0430\u0439\u043B\u043E\u0432 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438 \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u043B\u0430\u0441\u044C \u043E\u0448\u0438\u0431\u043A\u043E\u0439. \u0418\u0441\u0445\u043E\u0434\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435 \u0438 \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u044B\u0439 \u0436\u0443\u0440\u043D\u0430\u043B \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B; \u0437\u0430\u043F\u0438\u0441\u0438 \u0447\u0435\u0440\u0435\u0437 USB \u043D\u0435 \u0431\u044B\u043B\u043E.",plan_build_required:"\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u043D\u0443\u0436\u043D\u0430 \u043F\u043E\u043B\u043D\u0430\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043D\u0430\u044F \u0441\u0431\u043E\u0440\u043A\u0430 \u0434\u043B\u044F \u044D\u0442\u043E\u0433\u043E \u0437\u0430\u0434\u0430\u043D\u0438\u044F.",plan_browser_adapter_pending:"\u041D\u0430 \u044D\u0442\u043E\u043C \u044D\u0442\u0430\u043F\u0435 \u043F\u043E\u043A\u0430 \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044F \u0442\u043E\u043B\u044C\u043A\u043E USB \u0441\u0435\u0440\u0432\u0435\u0440\u0430 HA. \u041F\u043E\u0434\u0434\u0435\u0440\u0436\u043A\u0430 USB \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440\u0430 \u0435\u0449\u0451 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0430\u0435\u0442\u0441\u044F; \u043F\u0440\u043E\u0444\u0438\u043B\u044C \u0438 \u0441\u0431\u043E\u0440\u043A\u0430 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B.",usb_plan_browser_pending:"\u0414\u043B\u044F USB \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440\u0430 \u044D\u0442\u043E\u0442 \u044D\u0442\u0430\u043F \u043F\u043E\u043A\u0430 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D. \u041F\u0440\u043E\u0444\u0438\u043B\u044C \u0438 \u0441\u0431\u043E\u0440\u043A\u0430 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B.",usb_plan_build_required:"\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0441\u043E\u0431\u0435\u0440\u0438\u0442\u0435 \u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u0443\u044E \u043F\u0440\u043E\u0448\u0438\u0432\u043A\u0443 \u044D\u0442\u043E\u0433\u043E \u0437\u0430\u0434\u0430\u043D\u0438\u044F.",usb_plan_consumed:"\u041F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0430 \u0444\u0430\u0439\u043B\u043E\u0432 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438 \u0443\u0436\u0435 \u0437\u0430\u043F\u0440\u043E\u0448\u0435\u043D\u0430. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0435\u0451 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435.",usb_plan_unverified:"\u041F\u0440\u0438\u0432\u0430\u0442\u043D\u044B\u0439 \u043D\u0430\u0431\u043E\u0440 \u0444\u0430\u0439\u043B\u043E\u0432 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0442\u043E \u0436\u0435 \u0437\u0430\u0434\u0430\u043D\u0438\u0435; \u0437\u0430\u043F\u0440\u043E\u0441 \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0435\u0442\u0441\u044F.",plan_used:"\u042D\u0442\u043E\u0442 \u043D\u0430\u0431\u043E\u0440 \u0441\u0432\u044F\u0437\u0430\u043D \u0441 \u0443\u0436\u0435 \u0437\u0430\u043F\u0440\u043E\u0448\u0435\u043D\u043D\u043E\u0439 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u043E\u0439. \u041F\u043E\u0432\u0442\u043E\u0440\u043D\u0430\u044F \u0437\u0430\u043F\u0438\u0441\u044C \u0447\u0435\u0440\u0435\u0437 \u043D\u0435\u0433\u043E \u043D\u0435 \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u0435\u0442\u0441\u044F.",install_title:"\u042D\u043A\u0441\u043F\u0435\u0440\u0438\u043C\u0435\u043D\u0442\u0430\u043B\u044C\u043D\u0430\u044F \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u0441\u043E \u0448\u0442\u0430\u0442\u043D\u044B\u043C \u044D\u043A\u0440\u0430\u043D\u043E\u043C",install_experimental:"\u041F\u0435\u0440\u0432\u0430\u044F \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u044D\u0442\u0438\u043C \u043C\u0430\u0441\u0442\u0435\u0440\u043E\u043C \u043D\u0430 \u043D\u0435\u0442\u0440\u043E\u043D\u0443\u0442\u044B\u0439 \u043F\u0440\u0438\u0431\u043E\u0440 \u0435\u0449\u0451 \u043D\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u0430 \u0444\u0438\u0437\u0438\u0447\u0435\u0441\u043A\u0438. \u0418\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439\u0442\u0435 \u0442\u043E\u043B\u044C\u043A\u043E \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0439 \u043D\u0438\u0436\u0435 CGS1 S8/SCD40 \u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 USB-\u0434\u043E\u0441\u0442\u0443\u043F \u0434\u043B\u044F \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F.",install_changes:"\u0421\u043E\u0437\u0434\u0430\u0451\u0442 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u0439 \u043A\u0430\u0442\u0430\u043B\u043E\u0433 ESPHome, \u0441\u043E\u0445\u0440\u0430\u043D\u044F\u0435\u0442 \u0438\u0441\u0445\u043E\u0434\u043D\u044B\u0435 \u0437\u0430\u0433\u0440\u0443\u0437\u043E\u0447\u043D\u044B\u0435 \u0444\u0430\u0439\u043B\u044B \u0438 \u043C\u0435\u043D\u044F\u0435\u0442 \u0434\u0432\u0430 \u0441\u043A\u0440\u0438\u043F\u0442\u0430 \u0437\u0430\u043F\u0443\u0441\u043A\u0430. \u0412\u044B\u043F\u043E\u043B\u043D\u044F\u0435\u0442 \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0435\u043D\u043D\u044B\u0439 60-\u0441\u0435\u043A\u0443\u043D\u0434\u043D\u044B\u0439 \u043F\u0440\u043E\u0431\u043D\u044B\u0439 \u0437\u0430\u043F\u0443\u0441\u043A \u0440\u044F\u0434\u043E\u043C \u0441\u043E \u0448\u0442\u0430\u0442\u043D\u043E\u0439 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u043E\u0439. \u0422\u043E\u043B\u044C\u043A\u043E \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043D\u043E\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u0435 \u043F\u0440\u043E\u0431\u044B \u0438 \u043E\u0447\u0438\u0441\u0442\u043A\u0430 \u0441\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u0439 \u043F\u043E\u0437\u0432\u043E\u043B\u044F\u044E\u0442 \u0432\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u0430\u0432\u0442\u043E\u0437\u0430\u043F\u0443\u0441\u043A \u043D\u0430 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0443\u044E \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0443 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u043C \u0437\u0430\u0449\u0438\u0449\u0451\u043D\u043D\u044B\u043C \u0448\u0430\u0433\u043E\u043C. PM preload \u043E\u0441\u0442\u0430\u0451\u0442\u0441\u044F \u0432\u044B\u043A\u043B\u044E\u0447\u0435\u043D; \u043F\u043E\u043B\u043D\u044B\u0439 \u043D\u043E\u0432\u044B\u0439 \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441 \u0443\u0441\u0442\u0430\u043D\u0430\u0432\u043B\u0438\u0432\u0430\u0435\u0442\u0441\u044F \u043F\u043E\u0437\u0436\u0435.",install_power:"\u0414\u043E \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0430 \u043E\u0441\u0442\u0430\u0432\u044C\u0442\u0435 USB \u0438 \u043F\u0438\u0442\u0430\u043D\u0438\u0435 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D\u043D\u044B\u043C\u0438. \u041F\u0440\u0438 \u043F\u043E\u0442\u0435\u0440\u0435 \u043E\u0442\u0432\u0435\u0442\u0430 \u043F\u0440\u043E\u0432\u0435\u0440\u044F\u0439\u0442\u0435 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435; \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439\u0442\u0435 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0443 \u0438 \u043D\u0435 \u043F\u0435\u0440\u0435\u0437\u0430\u0433\u0440\u0443\u0436\u0430\u0439\u0442\u0435 \u043F\u0440\u0438\u0431\u043E\u0440 \u0432\u043E \u0432\u0440\u0435\u043C\u044F \u043D\u0435\u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D\u043D\u043E\u0439 \u0437\u0430\u043F\u0438\u0441\u0438.",install_ack:"\u042F \u043F\u0440\u043E\u0432\u0435\u0440\u0438\u043B \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u0435 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E \u0438 \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u043B \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u044D\u043A\u0441\u043F\u0435\u0440\u0438\u043C\u0435\u043D\u0442\u0430\u043B\u044C\u043D\u043E\u0439 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438.",install_firmware:"\u0412\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u044C \u044D\u043A\u0441\u043F\u0435\u0440\u0438\u043C\u0435\u043D\u0442\u0430\u043B\u044C\u043D\u0443\u044E \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0443",check_install:"\u041F\u0440\u043E\u0447\u0438\u0442\u0430\u0442\u044C \u0441\u0442\u0430\u0442\u0443\u0441 \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u0438",observe_boot:"\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u043F\u0440\u0438\u0431\u043E\u0440",install_not_started:"\u041F\u0435\u0440\u0435\u0434 \u0437\u0430\u043F\u0443\u0441\u043A\u043E\u043C \u043F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0439 \u043C\u043E\u043D\u0438\u0442\u043E\u0440.",install_running:"\u0412\u044B\u043F\u043E\u043B\u043D\u044F\u0435\u0442\u0441\u044F \u044D\u043A\u0441\u043F\u0435\u0440\u0438\u043C\u0435\u043D\u0442\u0430\u043B\u044C\u043D\u0430\u044F \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430. \u041E\u0441\u0442\u0430\u0432\u044C\u0442\u0435 USB \u0438 \u043F\u0438\u0442\u0430\u043D\u0438\u0435 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D\u043D\u044B\u043C\u0438; \u043F\u0440\u043E\u0431\u043D\u044B\u0439 \u0437\u0430\u043F\u0443\u0441\u043A \u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438 \u043C\u043E\u0433\u0443\u0442 \u0437\u0430\u043D\u044F\u0442\u044C \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u043C\u0438\u043D\u0443\u0442.",install_armed_waiting_reboot:"\u041E\u043F\u0435\u0440\u0430\u0446\u0438\u044F \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u043B\u0430 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u0435 \u043F\u0440\u043E\u0431\u043D\u043E\u0433\u043E \u0437\u0430\u043F\u0443\u0441\u043A\u0430 \u0438 \u0432\u043A\u043B\u044E\u0447\u0438\u043B\u0430 \u0430\u0432\u0442\u043E\u0437\u0430\u043F\u0443\u0441\u043A \u043D\u0430 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0443\u044E \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0443. \u041F\u0435\u0440\u0435\u0434 \u043E\u0431\u044B\u0447\u043D\u044B\u043C \u0432\u044B\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435\u043C \u043D\u0430\u0436\u043C\u0438\u0442\u0435 \xAB\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u043F\u0440\u0438\u0431\u043E\u0440\xBB \u0434\u043B\u044F \u0441\u0432\u0435\u0436\u0435\u0439 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438.",install_install_unverified:"\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u0437\u0430\u043F\u0438\u0441\u0438 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D. \u041D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439\u0442\u0435 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0443 \u0438 \u043D\u0435 \u043F\u0435\u0440\u0435\u0437\u0430\u0433\u0440\u0443\u0436\u0430\u0439\u0442\u0435 \u043F\u0440\u0438\u0431\u043E\u0440, \u043F\u043E\u043A\u0430 \u0437\u0430\u043F\u0438\u0441\u044C \u043C\u043E\u0436\u0435\u0442 \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0430\u0442\u044C\u0441\u044F. \u041F\u0440\u043E\u0447\u0438\u0442\u0430\u0439\u0442\u0435 \u0441\u0442\u0430\u0442\u0443\u0441 \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u0438 \u0438\u043B\u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u043F\u0440\u0438\u0431\u043E\u0440; \u0438\u0441\u0445\u043E\u0434\u043D\u044B\u0435 \u0437\u0430\u043F\u0438\u0441\u0438 \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B.",install_bridge_observed:"\u0417\u0430\u043F\u0443\u0441\u043A ESPHome \u043F\u043E\u0441\u043B\u0435 \u043D\u043E\u0432\u043E\u0439 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 \u0431\u044B\u043B \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D. \u0414\u043B\u044F \u0441\u0432\u0435\u0436\u0435\u0439 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438 \u0441\u043D\u043E\u0432\u0430 \u043D\u0430\u0436\u043C\u0438\u0442\u0435 \xAB\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u043F\u0440\u0438\u0431\u043E\u0440\xBB.",boot_checking:"\u041F\u0440\u043E\u0432\u0435\u0440\u044F\u044E \u0442\u0435\u043A\u0443\u0449\u0443\u044E \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0443 \u043F\u0440\u0438\u0431\u043E\u0440\u0430 \u0438 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435 ESPHome\u2026",boot_awaiting_reboot:"\u0410\u0432\u0442\u043E\u0437\u0430\u043F\u0443\u0441\u043A \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D \u043D\u0430 \u0442\u0435\u043A\u0443\u0449\u0435\u0439 \u0448\u0442\u0430\u0442\u043D\u043E\u0439 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0435. \u0412\u044B\u043A\u043B\u044E\u0447\u0438\u0442\u0435 \u043C\u043E\u043D\u0438\u0442\u043E\u0440 \u0447\u0435\u0440\u0435\u0437 \u0448\u0442\u0430\u0442\u043D\u043E\u0435 \u043C\u0435\u043D\u044E, \u0432\u043A\u043B\u044E\u0447\u0438\u0442\u0435 \u0441\u043D\u043E\u0432\u0430, \u043E\u0441\u0442\u0430\u0432\u044C\u0442\u0435 USB \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D\u043D\u044B\u043C \u0438 \u0435\u0449\u0451 \u0440\u0430\u0437 \u043D\u0430\u0436\u043C\u0438\u0442\u0435 \xAB\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u043F\u0440\u0438\u0431\u043E\u0440\xBB.",boot_bridge_observed:"ESPHome \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D \u043F\u043E\u0441\u043B\u0435 \u043D\u043E\u0432\u043E\u0439 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438: \u0440\u0430\u0431\u043E\u0442\u0430\u044E\u0442 \u043E\u0436\u0438\u0434\u0430\u0435\u043C\u044B\u0435 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u044B \u0438 \u043F\u0440\u0438\u0445\u043E\u0434\u044F\u0442 \u0441\u0432\u0435\u0436\u0438\u0435 \u0434\u0430\u043D\u043D\u044B\u0435 \u0447\u0435\u0440\u0435\u0437 \u0437\u0430\u0449\u0438\u0449\u0451\u043D\u043D\u043E\u0435 \u0441\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u0435.",boot_boot_unverified:"\u0421\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \u043F\u0440\u0438\u0431\u043E\u0440\u0430 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u043E. \u041F\u0440\u043E\u0447\u0438\u0442\u0430\u0439\u0442\u0435 \u0441\u0442\u0430\u0442\u0443\u0441 \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u0438; \u044D\u0442\u0430 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0435\u0442 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0443 \u0438 \u043D\u0435 \u043F\u0435\u0440\u0435\u0437\u0430\u043F\u0443\u0441\u043A\u0430\u0435\u0442 \u043C\u043E\u043D\u0438\u0442\u043E\u0440.",usb_install_review_required:"\u041F\u0440\u043E\u0447\u0438\u0442\u0430\u0439\u0442\u0435 \u0441\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u043E \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u043C \u043F\u0440\u0438\u0431\u043E\u0440\u0435 \u0438 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0435 \u044D\u043A\u0441\u043F\u0435\u0440\u0438\u043C\u0435\u043D\u0442\u0430\u043B\u044C\u043D\u044B\u0435 \u0448\u0430\u0433\u0438 \u043F\u0435\u0440\u0435\u0434 \u0437\u0430\u043F\u0443\u0441\u043A\u043E\u043C.",usb_install_plan_required:"\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u043D\u0443\u0436\u0435\u043D \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043D\u044B\u0439 \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u044B\u0439 \u043D\u0430\u0431\u043E\u0440 \u0444\u0430\u0439\u043B\u043E\u0432 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438.",usb_install_consumed:"\u042D\u0442\u0430 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u0443\u0436\u0435 \u0437\u0430\u043F\u0440\u043E\u0448\u0435\u043D\u0430. \u041F\u0440\u043E\u0447\u0438\u0442\u0430\u0439\u0442\u0435 \u0441\u0442\u0430\u0442\u0443\u0441; \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439\u0442\u0435 \u0437\u0430\u043F\u0438\u0441\u044C.",usb_install_previous_unverified:"\u041F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0430\u044F \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0430. \u041F\u0435\u0440\u0435\u0434 \u043D\u043E\u0432\u043E\u0439 \u043D\u0443\u0436\u043D\u043E \u043F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u0438\u0441\u0445\u043E\u0434\u043D\u0443\u044E \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u044E.",usb_install_host_space:"\u041D\u0430 HA-\u0441\u0435\u0440\u0432\u0435\u0440\u0435 \u043D\u0443\u0436\u043D\u044B \u043C\u0438\u043D\u0438\u043C\u0443\u043C 512 \u041C\u0438\u0411 \u0441\u0432\u043E\u0431\u043E\u0434\u043D\u043E\u0433\u043E \u043C\u0435\u0441\u0442\u0430 \u0434\u043B\u044F \u0437\u0430\u043F\u0438\u0441\u0435\u0439 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438. \u041D\u043E\u0432\u044B\u0439 \u0437\u0430\u043F\u0440\u043E\u0441 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438 \u043D\u0435 \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u043B\u0441\u044F.",usb_install_unverified:"\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \u0442\u043E\u0433\u043E \u0436\u0435 \u0437\u0430\u0434\u0430\u043D\u0438\u044F; \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439\u0442\u0435 \u0437\u0430\u043F\u0438\u0441\u044C.",usb_boot_unverified:"\u0422\u0435\u043A\u0443\u0449\u0430\u044F \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0430. \u0423\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u0438 \u043F\u0435\u0440\u0435\u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u043D\u0435 \u0437\u0430\u043F\u0440\u0430\u0448\u0438\u0432\u0430\u043B\u0438\u0441\u044C.",usb_observation_limit:"\u0412 \u044D\u0442\u043E\u043C \u0437\u0430\u0434\u0430\u043D\u0438\u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B 64 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u044F. \u041F\u0440\u0435\u0436\u043D\u0438\u0435 \u0437\u0430\u043F\u0438\u0441\u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B; \u0440\u0430\u0437\u0431\u0435\u0440\u0438\u0442\u0435 \u0438\u0445 \u043F\u0435\u0440\u0435\u0434 \u043D\u043E\u0432\u043E\u0439 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u043E\u0439.",full_review_title:"\u0423\u0441\u043B\u043E\u0432\u0438\u044F \u043F\u043E\u043B\u043D\u043E\u0433\u043E \u043D\u043E\u0432\u043E\u0433\u043E \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430",full_review:"\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u0443\u0441\u043B\u043E\u0432\u0438\u044F \u043F\u043E\u043B\u043D\u043E\u0433\u043E \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430",full_review_help:"\u0427\u0438\u0442\u0430\u0435\u0442 \u0442\u0435\u043A\u0443\u0449\u0438\u0439 \u0437\u0430\u0449\u0438\u0449\u0451\u043D\u043D\u044B\u0439 bridge \u0438 \u0448\u0442\u0430\u0442\u043D\u0443\u044E \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0443 \u0434\u043B\u044F \u044D\u0442\u043E\u0439 \u043F\u0430\u0440\u044B native/guardian. \u041D\u0435 \u0432\u043A\u043B\u044E\u0447\u0430\u0435\u0442 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u043D\u043E\u0435 PM-\u0440\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u0435, \u043D\u0435 \u0437\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u0442 \u0438 \u043D\u0435 \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u0435\u0442 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u044B, \u043D\u0435 \u043F\u0435\u0440\u0435\u0437\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u0442 \u043F\u0440\u0438\u0431\u043E\u0440 \u0438 \u043D\u0435 \u043C\u0435\u043D\u044F\u0435\u0442 \u0433\u043E\u0442\u043E\u0432\u043D\u043E\u0441\u0442\u044C \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438.",full_review_reading:"\u0427\u0438\u0442\u0430\u044E \u0442\u0435\u043A\u0443\u0449\u0438\u0435 \u0443\u0441\u043B\u043E\u0432\u0438\u044F \u043F\u043E\u043B\u043D\u043E\u0433\u043E \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430\u2026",full_review_pm_extension_required:"\u041D\u0430\u0447\u0430\u043B\u044C\u043D\u044B\u0439 bridge \u043E\u0441\u0442\u0430\u0432\u043B\u044F\u0435\u0442 \u0432\u044B\u043A\u043B\u044E\u0447\u0435\u043D\u043D\u044B\u043C \u043D\u0430\u0448\u0435 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u043D\u043E\u0435 \u0440\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u0435 \u0434\u043E\u0441\u0442\u0443\u043F\u0430 \u043A PM. \u042D\u0442\u043E \u043D\u0435 \u0432\u044B\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u0441\u0430\u043C\u043E\u0433\u043E PM-\u0434\u0430\u0442\u0447\u0438\u043A\u0430 \u0432 \u0448\u0442\u0430\u0442\u043D\u043E\u0439 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u0435. \u0414\u043B\u044F \u043F\u043E\u043B\u043D\u043E\u0433\u043E \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430 \u043D\u0443\u0436\u0435\u043D \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u0439 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043D\u044B\u0439 \u043F\u0435\u0440\u0435\u0445\u043E\u0434; \u044D\u0442\u0430 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0440\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u0435 \u043D\u0435 \u0432\u043A\u043B\u044E\u0447\u0430\u0435\u0442.",full_review_full_ui_preflight_observed:"\u0422\u0435\u043A\u0443\u0449\u0430\u044F \u0448\u0442\u0430\u0442\u043D\u0430\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043F\u0440\u043E\u0439\u0434\u0435\u043D\u0430 \u0434\u043B\u044F \u0442\u043E\u0447\u043D\u043E\u0439 \u0441\u0431\u043E\u0440\u043A\u0438. \u042D\u0442\u043E \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u0447\u0442\u0435\u043D\u0438\u044F, \u043D\u0435 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u0438\u043B\u0438 \u0437\u0430\u043F\u0443\u0441\u043A. \u041F\u043E\u043B\u043D\u044B\u0439 \u043F\u0435\u0440\u0435\u0445\u043E\u0434 \u043E\u0441\u0442\u0430\u0451\u0442\u0441\u044F \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u043C \u044D\u0442\u0430\u043F\u043E\u043C.",full_review_full_ui_unverified:"\u0423\u0441\u043B\u043E\u0432\u0438\u044F \u043F\u043E\u043B\u043D\u043E\u0433\u043E \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u044B. \u041F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u044B \u0438 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B; \u044D\u0442\u0430 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043D\u0435 \u0440\u0430\u0437\u0440\u0435\u0448\u0430\u0435\u0442 \u0437\u0430\u043F\u0443\u0441\u043A.",full_review_full_ui_close_unverified:"\u0427\u0442\u0435\u043D\u0438\u0435 \u0438\u043B\u0438 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u0435 \u0441\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u044F \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u043E. \u0410\u043A\u0442\u0438\u0432\u0430\u0446\u0438\u044F \u043F\u043E\u043B\u043D\u043E\u0433\u043E \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430 \u043D\u0435 \u0437\u0430\u043F\u0440\u0430\u0448\u0438\u0432\u0430\u043B\u0430\u0441\u044C; \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u0438\u0441\u0442\u043E\u0440\u0438\u044E \u0438\u0441\u0445\u043E\u0434\u043D\u043E\u0439 \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u0438.",usb_full_ui_bridge_required:"\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0435 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u044B\u0439 bridge \u043F\u043E\u0441\u043B\u0435 \u0435\u0433\u043E \u043D\u043E\u0432\u043E\u0439 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438, \u0437\u0430\u0442\u0435\u043C \u043F\u0440\u043E\u0432\u0435\u0440\u044F\u0439\u0442\u0435 \u0443\u0441\u043B\u043E\u0432\u0438\u044F \u043F\u043E\u043B\u043D\u043E\u0433\u043E \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430.",usb_full_ui_unverified:"\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044C \u0443\u0441\u043B\u043E\u0432\u0438\u044F \u043F\u043E\u043B\u043D\u043E\u0433\u043E \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430. \u0410\u043A\u0442\u0438\u0432\u0430\u0446\u0438\u044F \u043D\u0435 \u0437\u0430\u043F\u0440\u0430\u0448\u0438\u0432\u0430\u043B\u0430\u0441\u044C.",usb_full_ui_close_unverified:"\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044C \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u0435 \u0442\u043E\u0447\u043D\u043E\u0433\u043E \u0441\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u044F \u0447\u0442\u0435\u043D\u0438\u044F. \u0410\u043A\u0442\u0438\u0432\u0430\u0446\u0438\u044F \u043D\u0435 \u0437\u0430\u043F\u0440\u0430\u0448\u0438\u0432\u0430\u043B\u0430\u0441\u044C.",full_trial_title:"\u041F\u0440\u043E\u0431\u043D\u044B\u0439 \u043F\u043E\u043B\u043D\u044B\u0439 \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441",full_trial_start:"\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u043D\u043E\u0432\u044B\u0439 \u044D\u043A\u0440\u0430\u043D \u043D\u0430 60 \u0441\u0435\u043A\u0443\u043D\u0434",full_trial_status:"\u041F\u0440\u043E\u0447\u0438\u0442\u0430\u0442\u044C \u0441\u0442\u0430\u0442\u0443\u0441 \u043F\u0440\u043E\u0431\u044B \u044D\u043A\u0440\u0430\u043D\u0430",full_trial_help:"\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442 \u0432 \u041E\u0417\u0423 \u0434\u0432\u0435 \u0442\u043E\u0447\u043D\u044B\u0435 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u044B \u044D\u0442\u043E\u0439 \u0441\u0431\u043E\u0440\u043A\u0438, \u043F\u043E\u043A\u0430\u0436\u0435\u0442 \u043D\u043E\u0432\u044B\u0439 \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441 \u0434\u043E 60 \u0441\u0435\u043A\u0443\u043D\u0434 \u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u0438\u0442 \u0432\u043E\u0437\u0432\u0440\u0430\u0442 \u043A \u0448\u0442\u0430\u0442\u043D\u043E\u043C\u0443. \u0412\u0440\u0435\u043C\u044F \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0438\u0432\u0430\u044E\u0442 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u044B \u043D\u0430 \u0441\u0430\u043C\u043E\u043C \u043F\u0440\u0438\u0431\u043E\u0440\u0435, \u0434\u0430\u0436\u0435 \u0435\u0441\u043B\u0438 \u0437\u0430\u043A\u0440\u044B\u0442\u044C \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443. \u041E\u0441\u0442\u0430\u0432\u044C\u0442\u0435 USB \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D\u043D\u044B\u043C; \u043F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u044B\u0439 \u0437\u0430\u043F\u0443\u0441\u043A \u043D\u0435 \u0432\u043A\u043B\u044E\u0447\u0430\u0435\u0442\u0441\u044F.",full_trial_ack:"\u041F\u043E\u043D\u0438\u043C\u0430\u044E, \u0447\u0442\u043E \u044D\u0442\u043E \u044D\u043A\u0441\u043F\u0435\u0440\u0438\u043C\u0435\u043D\u0442\u0430\u043B\u044C\u043D\u0430\u044F \u043F\u0440\u043E\u0431\u0430 \u044D\u043A\u0440\u0430\u043D\u0430. \u0411\u0443\u0434\u0443 \u0441\u043C\u043E\u0442\u0440\u0435\u0442\u044C \u043D\u0430 \u044D\u043A\u0440\u0430\u043D \u0438 \u043E\u0441\u0442\u0430\u0432\u043B\u044E \u043F\u0438\u0442\u0430\u043D\u0438\u0435 \u0438 USB \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D\u043D\u044B\u043C\u0438.",full_trial_running:"\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u044E \u043F\u0430\u0440\u0443 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C, \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u044E \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u044B\u0439 \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441 \u0438 \u0436\u0434\u0443 \u0432\u043E\u0437\u0432\u0440\u0430\u0442\u0430 \u0448\u0442\u0430\u0442\u043D\u043E\u0433\u043E \u044D\u043A\u0440\u0430\u043D\u0430. \u042D\u0442\u043E \u043C\u043E\u0436\u0435\u0442 \u0437\u0430\u043D\u044F\u0442\u044C \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u043C\u0438\u043D\u0443\u0442; \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u0430\u044F \u043A\u043E\u043C\u0430\u043D\u0434\u0430 \u0437\u0430\u043F\u0443\u0441\u043A\u0430 \u043D\u0435 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u044F\u0435\u0442\u0441\u044F.",full_trial_not_started:"\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u043F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0443\u0441\u043B\u043E\u0432\u0438\u044F \u043F\u043E\u043B\u043D\u043E\u0433\u043E \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430, \u0437\u0430\u0442\u0435\u043C \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0435 \u0438 \u0437\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u0435 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u0443\u044E \u043F\u0440\u043E\u0431\u0443 \u044D\u043A\u0440\u0430\u043D\u0430.",full_trial_full_ui_trial_returned_observed:"\u041D\u043E\u0432\u044B\u0439 \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441 \u0438 \u0433\u043E\u0442\u043E\u0432\u043D\u043E\u0441\u0442\u044C \u0441\u0432\u0435\u0436\u0438\u0445 \u043E\u0441\u043D\u043E\u0432\u043D\u044B\u0445 \u043F\u043E\u043A\u0430\u0437\u0430\u043D\u0438\u0439 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u044B, \u0437\u0430\u0442\u0435\u043C \u0432\u0435\u0440\u043D\u0443\u043B\u0441\u044F \u0448\u0442\u0430\u0442\u043D\u044B\u0439 bridge. \u041D\u0430 \u043C\u043E\u043C\u0435\u043D\u0442 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u044F \u043F\u0440\u043E\u0431\u044B \u043F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u044B\u0439 \u0437\u0430\u043F\u0443\u0441\u043A \u0431\u044B\u043B \u0432\u044B\u043A\u043B\u044E\u0447\u0435\u043D. \u042D\u0442\u043E \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0439 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u043F\u0440\u043E\u0431\u044B.",full_trial_full_ui_trial_unverified:"\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u043F\u0440\u043E\u0431\u044B \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D. \u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u0437\u0430\u0434\u0430\u043D\u0438\u0435 \u0438 \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u0439\u0442\u0435 \u0435\u0433\u043E \u0441\u0442\u0430\u0442\u0443\u0441; \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439\u0442\u0435 \u0437\u0430\u043F\u0443\u0441\u043A \u0438 \u043D\u0435 \u0441\u0431\u0440\u0430\u0441\u044B\u0432\u0430\u0439\u0442\u0435 \u0438\u0441\u0442\u043E\u0440\u0438\u044E.",full_trial_full_ui_trial_close_unverified:"\u0417\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u0435 API-\u0441\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u044F \u0438\u043B\u0438 USB-\u043F\u0440\u043E\u0431\u0440\u043E\u0441\u0430 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u043E. \u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u0438\u0441\u0442\u043E\u0440\u0438\u044E \u0438\u0441\u0445\u043E\u0434\u043D\u043E\u0439 \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u0438; \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u044B\u0439 \u0437\u0430\u043F\u0443\u0441\u043A \u0437\u0430\u043F\u0440\u0435\u0449\u0451\u043D.",full_trial_full_ui_trial_rebuild_required:"\u0412 bridge \u043D\u0435\u0442 \u043A\u043E\u043C\u0430\u043D\u0434\u044B \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0435\u043D\u043D\u043E\u0439 \u043F\u0440\u043E\u0431\u044B \u044D\u043A\u0440\u0430\u043D\u0430. \u0418\u0441\u0445\u043E\u0434\u043D\u044B\u0439 \u0437\u0430\u043F\u0440\u043E\u0441 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D; \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439\u0442\u0435 \u0435\u0433\u043E \u0432 \u044D\u0442\u043E\u043C \u0437\u0430\u0434\u0430\u043D\u0438\u0438.",usb_full_ui_trial_review_required:"\u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0442\u043E\u0447\u043D\u0443\u044E \u0441\u0431\u043E\u0440\u043A\u0443 \u0438 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0435 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u0443\u044E \u043F\u0440\u043E\u0431\u0443 \u044D\u043A\u0440\u0430\u043D\u0430 \u043F\u0435\u0440\u0435\u0434 \u0437\u0430\u043F\u0443\u0441\u043A\u043E\u043C.",usb_full_ui_trial_rebuild_required:"\u042D\u0442\u043E \u0437\u0430\u0434\u0430\u043D\u0438\u0435 \u0441\u043E\u0431\u0440\u0430\u043D\u043E \u0438\u0437 \u0441\u0442\u0430\u0440\u044B\u0445 \u0438\u0441\u0445\u043E\u0434\u043D\u0438\u043A\u043E\u0432 \u0431\u0435\u0437 \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0435\u043D\u043D\u043E\u0439 \u043F\u0440\u043E\u0431\u044B \u044D\u043A\u0440\u0430\u043D\u0430. \u041E\u043D\u043E \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043E \u0431\u0435\u0437 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0439; \u043D\u0443\u0436\u043D\u0430 \u043D\u043E\u0432\u0430\u044F \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u043D\u0430\u044F \u0441\u0431\u043E\u0440\u043A\u0430. \u041D\u0435 \u0441\u0431\u0440\u0430\u0441\u044B\u0432\u0430\u0439\u0442\u0435 \u0443\u0436\u0435 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u044B\u0439 \u043C\u043E\u043D\u0438\u0442\u043E\u0440 \u0440\u0430\u0434\u0438 \u044D\u0442\u043E\u0433\u043E \u043C\u0430\u0441\u0442\u0435\u0440\u0430.",usb_full_ui_trial_unverified:"\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u043F\u0440\u043E\u0431\u044B \u044D\u043A\u0440\u0430\u043D\u0430 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D. \u041F\u0440\u043E\u0447\u0438\u0442\u0430\u0439\u0442\u0435 \u0441\u0442\u0430\u0442\u0443\u0441 \u0442\u043E\u0433\u043E \u0436\u0435 \u0437\u0430\u0434\u0430\u043D\u0438\u044F; \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439\u0442\u0435 \u0437\u0430\u043F\u0438\u0441\u044C.",usb_full_ui_trial_close_unverified:"\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044C \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u0435 \u0441\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u044F \u043F\u0440\u043E\u0431\u044B \u044D\u043A\u0440\u0430\u043D\u0430. \u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u0438\u0441\u0442\u043E\u0440\u0438\u044E; \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439\u0442\u0435 \u0437\u0430\u043F\u0443\u0441\u043A.",usb_full_ui_trial_consumed:"\u041F\u0440\u043E\u0431\u0430 \u044D\u043A\u0440\u0430\u043D\u0430 \u0443\u0436\u0435 \u0437\u0430\u043F\u0440\u0430\u0448\u0438\u0432\u0430\u043B\u0430\u0441\u044C. \u041F\u0440\u043E\u0447\u0438\u0442\u0430\u0439\u0442\u0435 \u0435\u0451 \u0441\u0442\u0430\u0442\u0443\u0441; \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u044B\u0439 \u0437\u0430\u043F\u0443\u0441\u043A \u043D\u0435\u0432\u043E\u0437\u043C\u043E\u0436\u0435\u043D.",usb_full_ui_trial_previous_unverified:"\u041F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0430\u044F \u043F\u0440\u043E\u0431\u0430 \u044D\u043A\u0440\u0430\u043D\u0430 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0430. \u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0438\u0441\u0445\u043E\u0434\u043D\u0443\u044E \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u044E \u043F\u0435\u0440\u0435\u0434 \u043D\u043E\u0432\u043E\u0439 \u0437\u0430\u043F\u0438\u0441\u044C\u044E \u043D\u0430 \u043F\u0440\u0438\u0431\u043E\u0440.",private_backup_help:"\u041F\u0435\u0440\u0435\u0434 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u043E\u0439 \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u044B\u0435 \u043A\u043E\u043F\u0438\u0438. \u0412 \u043F\u0440\u043E\u0444\u0438\u043B\u0435 \u043D\u0430\u0445\u043E\u0434\u0438\u0442\u0441\u044F \u0438\u043D\u0434\u0438\u0432\u0438\u0434\u0443\u0430\u043B\u044C\u043D\u044B\u0439 \u043A\u043B\u044E\u0447 \u0448\u0438\u0444\u0440\u043E\u0432\u0430\u043D\u0438\u044F ESPHome; \u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u0444\u0430\u0439\u043B \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u043E. \u0418\u0441\u0445\u043E\u0434\u043D\u044B\u0435 \u0444\u0430\u0439\u043B\u044B \u044D\u0442\u043E\u0433\u043E \u0437\u0430\u0434\u0430\u043D\u0438\u044F \u043C\u043E\u0436\u043D\u043E \u0441\u043A\u0430\u0447\u0430\u0442\u044C \u0438 \u043F\u043E\u0441\u043B\u0435 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438. \u042D\u0442\u043E \u0444\u0438\u043A\u0441\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0439 \u043D\u0430\u0431\u043E\u0440 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F, \u043D\u0435 \u043F\u043E\u043B\u043D\u0430\u044F \u0440\u0435\u0437\u0435\u0440\u0432\u043D\u0430\u044F \u043A\u043E\u043F\u0438\u044F \u043F\u0440\u0438\u0431\u043E\u0440\u0430.",export_profile:"\u0421\u043A\u0430\u0447\u0430\u0442\u044C \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u044B\u0439 \u043F\u0440\u043E\u0444\u0438\u043B\u044C ESPHome",export_originals:"\u0421\u043A\u0430\u0447\u0430\u0442\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0435 \u0438\u0441\u0445\u043E\u0434\u043D\u044B\u0435 \u0444\u0430\u0439\u043B\u044B",private_backup_downloaded:"\u0421\u043A\u0430\u0447\u0438\u0432\u0430\u043D\u0438\u0435 \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u043E\u0439 \u043A\u043E\u043F\u0438\u0438 \u043D\u0430\u0447\u0430\u043B\u043E\u0441\u044C. \u0425\u0440\u0430\u043D\u0438\u0442\u0435 \u0435\u0451 \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u043E; \u043F\u0440\u043E\u0444\u0438\u043B\u044C \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u043A\u043B\u044E\u0447 \u0448\u0438\u0444\u0440\u043E\u0432\u0430\u043D\u0438\u044F ESPHome.",usb_private_export_unverified:"\u041F\u0440\u0438\u0432\u0430\u0442\u043D\u0443\u044E \u043A\u043E\u043F\u0438\u044E \u043D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u0438\u043B\u0438 \u0441\u043A\u0430\u0447\u0430\u0442\u044C. \u041F\u0440\u0435\u0436\u043D\u0438\u0435 \u0444\u0430\u0439\u043B\u044B \u0437\u0430\u0434\u0430\u043D\u0438\u044F \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B.",preparing_profile:"\u041F\u043E\u0434\u0433\u043E\u0442\u0430\u0432\u043B\u0438\u0432\u0430\u044E \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u044B\u0439 \u043F\u0440\u043E\u0444\u0438\u043B\u044C \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430\u2026",profile_prepared:"\u041F\u0440\u0438\u0432\u0430\u0442\u043D\u044B\u0439 \u043F\u0440\u043E\u0444\u0438\u043B\u044C \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430 \u0433\u043E\u0442\u043E\u0432.",check_preparation:"\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0443",usb_preparation_unverified:"\u041F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0430 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0430. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0435\u0451 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435; \u0437\u0430\u043F\u0440\u043E\u0441 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0442\u044C\u0441\u044F \u043D\u0435 \u0431\u0443\u0434\u0435\u0442.",usb_profile_name_invalid:"\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043F\u0435\u0447\u0430\u0442\u043D\u043E\u0435 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0434\u043E 120 \u0431\u0430\u0439\u0442 UTF-8, \u0431\u0435\u0437 \u043A\u043E\u0441\u044B\u0445 \u0447\u0435\u0440\u0442.",usb_job_limit:"\u041D\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0435 \u0443\u0436\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B \u0432\u043E\u0441\u0435\u043C\u044C \u0437\u0430\u0434\u0430\u043D\u0438\u0439 \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0438. \u041F\u0440\u0435\u0436\u043D\u0438\u0435 \u0434\u0430\u043D\u043D\u044B\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B; \u043E\u0447\u0438\u0441\u0442\u043A\u0430 \u0447\u0435\u0440\u0435\u0437 \u043C\u0430\u0441\u0442\u0435\u0440 \u043F\u043E\u043A\u0430 \u043D\u0435 \u0440\u0435\u0430\u043B\u0438\u0437\u043E\u0432\u0430\u043D\u0430.",usb_job_unavailable:"\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0438 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E, \u043D\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u043E \u0438\u043B\u0438 \u043F\u0440\u0438\u043D\u0430\u0434\u043B\u0435\u0436\u0438\u0442 \u0434\u0440\u0443\u0433\u043E\u043C\u0443 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044E.",next:"USB \u0441\u0435\u0440\u0432\u0435\u0440\u0430 \u0438 \u0441\u043A\u0430\u0447\u0438\u0432\u0430\u0435\u043C\u044B\u0439 \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440\u043D\u044B\u0439 ADB-\u0443\u0441\u0442\u0430\u043D\u043E\u0432\u0449\u0438\u043A \u044D\u043A\u0441\u043F\u0435\u0440\u0438\u043C\u0435\u043D\u0442\u0430\u043B\u044C\u043D\u044B\u0435: \u043F\u0435\u0440\u0432\u0430\u044F \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u043D\u0430 \u0448\u0442\u0430\u0442\u043D\u044B\u0439 \u043F\u0440\u0438\u0431\u043E\u0440 \u0435\u0449\u0451 \u043D\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u0430 \u0444\u0438\u0437\u0438\u0447\u0435\u0441\u043A\u0438. \u0417\u0430\u043F\u0438\u0441\u044C \u0442\u043E\u043B\u044C\u043A\u043E \u0438\u0437 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0430 \u0447\u0435\u0440\u0435\u0437 WebUSB \u0435\u0449\u0451 \u043D\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0430. \u041D\u0430\u0447\u0430\u043B\u044C\u043D\u043E\u0435 \u0440\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u0435 \u043F\u043E\u0434\u0433\u043E\u0442\u0430\u0432\u043B\u0438\u0432\u0430\u0435\u0442\u0441\u044F \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u043C \u0448\u0430\u0433\u043E\u043C \u043D\u0430 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0443\u044E \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0443. \u0414\u043B\u044F \u043F\u043E\u043B\u043D\u043E\u0433\u043E \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430 \u043D\u0443\u0436\u043D\u044B \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0443\u0441\u043B\u043E\u0432\u0438\u0439, \u043F\u0440\u043E\u0431\u0430 \u0438 \u043F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u044B\u0439 \u0437\u0430\u043F\u0443\u0441\u043A.",docs:"\u0418\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0438\u044F \u043F\u043E \u044D\u043A\u0441\u043F\u0435\u0440\u0438\u043C\u0435\u043D\u0442\u0430\u043B\u044C\u043D\u043E\u0439 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0435",model:"\u041C\u043E\u0434\u0435\u043B\u044C",version:"\u0428\u0442\u0430\u0442\u043D\u0430\u044F \u0432\u0435\u0440\u0441\u0438\u044F",co2:"\u0412\u0430\u0440\u0438\u0430\u043D\u0442 CO2",mac:"WLAN-\u0438\u0434\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0442\u043E\u0440",webusb_unavailable:"\u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u0447\u0435\u0440\u0435\u0437 Chrome \u0438\u043B\u0438 Edge \u043F\u043E HTTPS \u043B\u0438\u0431\u043E \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 USB \u0441\u0435\u0440\u0432\u0435\u0440\u0430.",usb_selection_cancelled:"\u0423\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E \u043D\u0435 \u0432\u044B\u0431\u0440\u0430\u043D\u043E.",usb_stock_unverified:"\u0428\u0442\u0430\u0442\u043D\u044B\u0435 \u0444\u0430\u0439\u043B\u044B \u043E\u0442\u043B\u0438\u0447\u0430\u044E\u0442\u0441\u044F \u043E\u0442 \u043F\u0440\u043E\u0444\u0438\u043B\u044F \u043F\u0435\u0440\u0432\u043E\u0439 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438. \u0423\u0436\u0435 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u044B\u0439 ESPHome \u043E\u0431\u043D\u043E\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u0441\u0432\u043E\u0438\u043C \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u043C \u043F\u0443\u0442\u0451\u043C.",usb_profile_unsupported:"\u042D\u0442\u0430 \u0448\u0442\u0430\u0442\u043D\u0430\u044F \u0432\u0435\u0440\u0441\u0438\u044F, \u0432\u0430\u0440\u0438\u0430\u043D\u0442 CO2 \u0438\u043B\u0438 \u043F\u0440\u043E\u0446\u0435\u0441\u0441\u043E\u0440 \u043D\u0435 \u0434\u043E\u043F\u0443\u0449\u0435\u043D\u044B.",usb_busy:"\u0423\u0436\u0435 \u0432\u044B\u043F\u043E\u043B\u043D\u044F\u0435\u0442\u0441\u044F \u0434\u0440\u0443\u0433\u0430\u044F USB-\u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430.",open_companion:"\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0443 USB \u0441\u0435\u0440\u0432\u0435\u0440\u0430",usb_companion_unavailable:"\u0414\u043B\u044F USB \u0441\u0435\u0440\u0432\u0435\u0440\u0430 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u0435 \u0434\u043E\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u0435 Qingping USB \u043F\u043E \u0438\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0438\u0438 \u043D\u0438\u0436\u0435. \u0414\u043B\u044F USB \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440\u0430 \u043E\u043D\u043E \u043D\u0435 \u043D\u0443\u0436\u043D\u043E.",usb_companion_stopped:"\u0417\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u0435 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u043E\u0435 \u0434\u043E\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u0435 Qingping USB \u0432\u0440\u0443\u0447\u043D\u0443\u044E, \u0437\u0430\u0442\u0435\u043C \u0441\u043D\u043E\u0432\u0430 \u043E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0443 USB \u0441\u0435\u0440\u0432\u0435\u0440\u0430.",usb_selection_consumed:"\u042D\u0442\u043E\u0442 \u0432\u044B\u0431\u043E\u0440 \u0443\u0436\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D. \u0421\u043D\u043E\u0432\u0430 \u043D\u0430\u0439\u0434\u0438\u0442\u0435 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430 \u0434\u043B\u044F \u043D\u043E\u0432\u043E\u0439 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438 \u0442\u043E\u043B\u044C\u043A\u043E \u0434\u043B\u044F \u0447\u0442\u0435\u043D\u0438\u044F.",usb_unauthorized:"\u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u0434\u043E\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u0435 \u0438\u0437 Home Assistant \u0441 \u043F\u0440\u0430\u0432\u0430\u043C\u0438 \u0430\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u0430.",failed:"USB-\u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043D\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0430. \u041F\u0440\u043E\u0448\u0438\u0432\u043A\u0430 \u043D\u0435 \u0443\u0441\u0442\u0430\u043D\u0430\u0432\u043B\u0438\u0432\u0430\u043B\u0430\u0441\u044C. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u043A\u0430\u0431\u0435\u043B\u044C, ADB \u0438 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u0435 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435."}};var ct=t=>{throw{code:t}},Id=["job_id","stage","model","co2_type","transport","node_name","friendly_name","live_recheck_required","installed","installation_ready"];function jr(t,e,s,a){return(!t||typeof t!="object"||Object.keys(t).sort().join()!==[...Id].sort().join()||t.job_id!==e||!/^[a-f0-9]{32}$/.test(e)||!a.includes(t.stage)||t.model!=="CGS1"||![2,3].includes(t.co2_type)||t.transport!==s||!/^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/.test(t.node_name)||typeof t.friendly_name!="string"||t.live_recheck_required!==!0||t.installed!==!1||t.installation_ready!==!1)&&ct("usb_preparation_unverified"),t}function Cr(t,e,s){return jr(t,e,s,["profile_prepared"])}async function qd(t){let e=await t("jobs");(!e||Object.keys(e).join()!=="jobs"||!Array.isArray(e.jobs)||e.jobs.length>8)&&ct("usb_preparation_unverified");let s=new Set;for(let a of e.jobs)(!a||!["ha_usb","browser_usb"].includes(a.transport)||s.has(a.job_id))&&ct("usb_preparation_unverified"),jr(a,a.job_id,a.transport,["profile_prepared","preparation_unverified"]),s.add(a.job_id);return e.jobs}async function Od(t){(!(t instanceof Blob)||t.type!=="application/x-tar"||t.size>16*1024*1024)&&ct("usb_capture_unverified");let e=new Uint8Array(await t.arrayBuffer()),s=[];for(let a=0;a<e.length;a+=32768)s.push(String.fromCharCode(...e.subarray(a,a+32768)));return btoa(s.join(""))}async function Nd(t,e,s,a){(!/^[a-f0-9]{32}$/.test(e)||typeof s!="string"||!s)&&ct("usb_request_invalid");let i=a.archive instanceof Blob,n=i?"browser_usb":"ha_usb",r={request_id:e,friendly_name:s,...i?{capture:await Od(a.archive)}:{serial:a.serial}};try{return Cr(await t("prepare",r),e,n)}catch(o){if(["usb_unauthorized","usb_busy","usb_request_invalid","usb_capture_unverified","usb_profile_name_invalid","usb_job_limit"].includes(o?.code))throw o;try{return await Er(t,e,n)}catch{}ct("usb_preparation_unverified")}}async function Er(t,e,s){return(!/^[a-f0-9]{32}$/.test(e)||!["browser_usb","ha_usb"].includes(s))&&ct("usb_request_invalid"),Cr(await t("jobs/"+e),e,s)}var Ca=t=>{throw{code:t}},Td={not_started:["unverified"],building:["source","sdk","compile"],built_not_installed:["complete"],build_failed:["failed"],build_unverified:["unverified"]};function Ir(t,e){return(!t||Object.keys(t).sort().join()!==["job_id","state","phase","hardware_contacted","installed","installation_ready"].sort().join()||!/^[a-f0-9]{32}$/.test(e)||t.job_id!==e||!Td[t.state]?.includes(t.phase)||t.hardware_contacted!==!1||t.installed!==!1||t.installation_ready!==!1)&&Ca("usb_build_unverified"),t}async function qr(t,e){return/^[a-f0-9]{32}$/.test(e)||Ca("usb_request_invalid"),Ir(await t("jobs/"+e+"/build"),e)}async function Pd(t,e){/^[a-f0-9]{32}$/.test(e)||Ca("usb_request_invalid");try{return Ir(await t("build",{job_id:e}),e)}catch(s){if(["usb_unauthorized","usb_build_space","usb_build_busy","usb_preparation_unverified"].includes(s?.code))throw s;try{let a=await qr(t,e);if(a.state!=="not_started")return a}catch{}Ca("usb_build_unverified")}}var lt=()=>{throw{code:"usb_browser_plan_unverified"}},Rd=["not_started","browser_plan_prepared","browser_plan_unverified","browser_plan_failed"];function Or(t,e){let s=["job_id","state","plan_id","plan_sha256","requested_data_free_bytes","transport_kind","native_get_devpath","hardware_contacted","device_writes","installed","installation_ready","writer_enabled","live_recheck_required"];return(!t||Object.keys(t).sort().join()!==s.sort().join()||!/^[a-f0-9]{32}$/.test(e)||t.job_id!==e||!Rd.includes(t.state)||t.transport_kind!=="browser_webusb"||["native_get_devpath","hardware_contacted","installed","installation_ready","writer_enabled"].some(a=>t[a]!==!1)||t.device_writes!==0||t.live_recheck_required!==!0)&&lt(),t.state==="browser_plan_prepared"?(!/^[a-f0-9]{32}$/.test(t.plan_id)||!/^[a-f0-9]{64}$/.test(t.plan_sha256)||!Number.isInteger(t.requested_data_free_bytes)||t.requested_data_free_bytes<=0||t.requested_data_free_bytes>256*1024*1024)&&lt():[t.plan_id,t.plan_sha256,t.requested_data_free_bytes].some(a=>a!==null)&&lt(),t}async function Nr(t,e){return/^[a-f0-9]{32}$/.test(e)||lt(),Or(await t("jobs/"+e+"/browser-plan"),e)}async function Bd(t,e){/^[a-f0-9]{32}$/.test(e)||lt();try{return Or(await t("browser-plan",{job_id:e}),e)}catch(s){if(["usb_unauthorized","usb_browser_plan_build_required","usb_browser_plan_transport_required","usb_browser_plan_source_required"].includes(s?.code))throw s;try{let a=await Nr(t,e);if(a.state!=="not_started")return a}catch{}lt()}}async function Ud(t,e,s,a){(!/^[a-f0-9]{32}$/.test(e)||!/^[a-f0-9]{64}$/.test(s)||!/^[a-f0-9]{32}$/.test(a))&&lt();let i=await t("browser-review",{job_id:e,expected_plan_sha256:s,channel_id:a}),n=["job_id","plan_sha256","state","hardware_contacted","device_writes","installed","installation_ready","writer_enabled","native_get_devpath","live_recheck_required"];if(!i||Object.keys(i).sort().join()!==n.sort().join()||i.job_id!==e||i.plan_sha256!==s||i.state!=="browser_scope_verified"||i.hardware_contacted!==!0||i.device_writes!==0||["installed","installation_ready","writer_enabled","native_get_devpath"].some(r=>i[r]!==!1)||i.live_recheck_required!==!0)throw{code:"usb_browser_scope_unverified"};return i}var cs=()=>{throw{code:"usb_plan_unverified"}},zd=["not_prepared","plan_prepared","plan_unverified","plan_failed","build_required","browser_adapter_pending"];function Tr(t,e){let s=["job_id","state","requested_data_free_bytes","hardware_contacted","device_writes","installed","installation_ready","live_recheck_required"];return(!t||Object.keys(t).sort().join()!==s.sort().join()||!/^[a-f0-9]{32}$/.test(e)||t.job_id!==e||!zd.includes(t.state)||t.hardware_contacted!==!1||t.device_writes!==0||t.installed!==!1||t.installation_ready!==!1||t.live_recheck_required!==!0)&&cs(),(t.state==="plan_prepared"?!Number.isInteger(t.requested_data_free_bytes)||t.requested_data_free_bytes<=0||t.requested_data_free_bytes>256*1024*1024:t.requested_data_free_bytes!==null)&&cs(),t}async function Pr(t,e){return/^[a-f0-9]{32}$/.test(e)||cs(),Tr(await t("jobs/"+e+"/plan"),e)}async function Md(t,e){/^[a-f0-9]{32}$/.test(e)||cs();try{return Tr(await t("plan",{job_id:e}),e)}catch(s){if(["usb_unauthorized","usb_plan_build_required","usb_plan_browser_pending"].includes(s?.code))throw s;try{let a=await Pr(t,e);if(a.state!=="not_prepared")return a}catch{}cs()}}var A=t=>{throw{code:t}};function Rr(t,e){let s=["job_id","state","autostart_armed","installed","installation_ready","replay_allowed","live_recheck_required"];return(!t||Object.keys(t).sort().join()!==s.sort().join()||!/^[a-f0-9]{32}$/.test(e)||t.job_id!==e||!["not_started","install_unverified","armed_waiting_reboot","bridge_observed"].includes(t.state)||t.autostart_armed!==(["armed_waiting_reboot","bridge_observed"].includes(t.state)?!0:null)||t.installed!==!1||t.installation_ready!==!1||t.replay_allowed!==!1||t.live_recheck_required!==!0)&&A("usb_install_unverified"),t}async function Br(t,e){return/^[a-f0-9]{32}$/.test(e)||A("usb_install_unverified"),Rr(await t("jobs/"+e+"/install"),e)}async function Dd(t,e){/^[a-f0-9]{32}$/.test(e)||A("usb_install_review_required");let s=await t("jobs/"+e+"/install-review"),a=["job_id","plan_sha256","model","co2_type","friendly_name","wlan_mac","stock_version","requested_data_free_bytes","experimental","installation_ready"];return(!s||Object.keys(s).sort().join()!==a.sort().join()||s.job_id!==e||!/^[a-f0-9]{64}$/.test(s.plan_sha256)||s.model!=="CGS1"||![2,3].includes(s.co2_type)||typeof s.friendly_name!="string"||!/^[0-9a-f]{2}(?::[0-9a-f]{2}){5}$/.test(s.wlan_mac)||s.stock_version!=="4.1.8_0287"||s.experimental!==!0||s.installation_ready!==!1||!Number.isInteger(s.requested_data_free_bytes)||s.requested_data_free_bytes<=0)&&A("usb_install_review_required"),s}async function Fd(t,e,s){(s!==!0||!e||!/^[a-f0-9]{32}$/.test(e.job_id)||!/^[a-f0-9]{64}$/.test(e.plan_sha256))&&A("usb_install_review_required");try{return Rr(await t("install",{job_id:e.job_id,expected_plan_sha256:e.plan_sha256,experimental_reviewed:!0}),e.job_id)}catch(a){if(["usb_unauthorized","usb_busy","usb_install_review_required","usb_install_plan_required","usb_install_host_space","usb_install_previous_unverified","usb_pm_extension_previous_unverified"].includes(a?.code))throw a;try{let i=await Br(t,e.job_id);if(i.state!=="not_started")return i}catch{}A("usb_install_unverified")}}async function Gd(t,e){/^[a-f0-9]{32}$/.test(e)||A("usb_boot_unverified");let s=await t("observe",{job_id:e});return(!s||Object.keys(s).sort().join()!==["job_id","state","runtime_observed","device_writes","installed","installation_ready"].sort().join()||s.job_id!==e||!["bridge_observed","boot_unverified","awaiting_reboot"].includes(s.state)||s.runtime_observed!==(s.state==="bridge_observed")||s.device_writes!==0||s.installed!==!1||s.installation_ready!==!1)&&A("usb_boot_unverified"),s}async function Jd(t,e){/^[a-f0-9]{32}$/.test(e)||A("usb_full_ui_unverified");let s=await t("full-review",{job_id:e}),a=["job_id","state","read_only","device_writes","launch_authorized","installation_ready","installed","live_recheck_required"];return(!s||Object.keys(s).sort().join()!==a.sort().join()||s.job_id!==e||!["full_ui_preflight_observed","pm_extension_required","full_ui_unverified","full_ui_close_unverified"].includes(s.state)||s.read_only!==!0||s.device_writes!==0||s.launch_authorized!==!1||s.installation_ready!==!1||s.installed!==!1||s.live_recheck_required!==!0)&&A("usb_full_ui_unverified"),s}function Ur(t,e){let s=["job_id","state","trial_available","hard_runtime_ms","native_observations","stock_return_observed","launch_acknowledged","installed","installation_ready","boot_enabled","replay_allowed","live_recheck_required"];(!t||Object.keys(t).sort().join()!==s.sort().join()||!/^[a-f0-9]{32}$/.test(e)||t.job_id!==e||!["not_started","full_ui_trial_returned_observed","full_ui_trial_unverified","full_ui_trial_close_unverified","full_ui_trial_rebuild_required"].includes(t.state)||typeof t.trial_available!="boolean"||t.hard_runtime_ms!==6e4||t.installed!==!1||t.installation_ready!==!1||t.boot_enabled!==!1||t.replay_allowed!==!1||t.live_recheck_required!==!0)&&A("usb_full_ui_trial_unverified");let a=t.native_observations===null&&t.stock_return_observed===null&&t.launch_acknowledged===null;return!a&&(!Number.isInteger(t.native_observations)||t.native_observations<0||t.native_observations>2||typeof t.stock_return_observed!="boolean"||typeof t.launch_acknowledged!="boolean")&&A("usb_full_ui_trial_unverified"),t.state==="not_started"&&!a&&A("usb_full_ui_trial_unverified"),t.state==="full_ui_trial_returned_observed"&&(t.native_observations!==2||t.stock_return_observed!==!0||!t.trial_available)&&A("usb_full_ui_trial_unverified"),t}async function zr(t,e){return/^[a-f0-9]{32}$/.test(e)||A("usb_full_ui_trial_unverified"),Ur(await t("jobs/"+e+"/full-trial"),e)}async function Wd(t,e,s){(s!==!0||!e||!/^[a-f0-9]{32}$/.test(e.job_id)||!/^[a-f0-9]{64}$/.test(e.plan_sha256))&&A("usb_full_ui_trial_review_required");try{return Ur(await t("full-trial",{job_id:e.job_id,expected_plan_sha256:e.plan_sha256,experimental_reviewed:!0}),e.job_id)}catch(a){if(["usb_unauthorized","usb_busy","usb_full_ui_trial_review_required","usb_full_ui_bridge_required","usb_full_ui_trial_rebuild_required","usb_install_host_space","usb_install_previous_unverified","usb_pm_extension_previous_unverified","usb_full_ui_trial_previous_unverified","usb_pm_extension_previous_unverified"].includes(a?.code))throw a;try{let i=await zr(t,e.job_id);if(i.state!=="not_started")return i}catch{}A("usb_full_ui_trial_unverified")}}function Mr(t,e){let s=["job_id","state","activation_available","native_observations","store_installed","boot_enabled","start_acknowledged","installed","installation_ready","replay_allowed","live_recheck_required"];return(!t||Object.keys(t).sort().join()!==s.sort().join()||!/^[a-f0-9]{32}$/.test(e)||t.job_id!==e||!["not_started","full_ui_active_observed","full_ui_activation_unverified","full_ui_activation_close_unverified","full_ui_activation_space"].includes(t.state)||typeof t.activation_available!="boolean"||t.installed!==!1||t.installation_ready!==!1||t.replay_allowed!==!1||t.live_recheck_required!==!0||![null,!0,!1].includes(t.store_installed)||![null,!0,!1].includes(t.boot_enabled)||![null,!0,!1].includes(t.start_acknowledged)||!(t.native_observations===null||Number.isInteger(t.native_observations)&&t.native_observations>=0&&t.native_observations<=2))&&A("usb_full_ui_activation_unverified"),t.state!=="not_started"&&t.activation_available&&A("usb_full_ui_activation_unverified"),t.state==="not_started"&&[t.native_observations,t.store_installed,t.boot_enabled,t.start_acknowledged].some(a=>a!==null)&&A("usb_full_ui_activation_unverified"),t.state==="full_ui_active_observed"&&(t.native_observations!==2||t.store_installed!==!0||t.boot_enabled!==!0||typeof t.start_acknowledged!="boolean")&&A("usb_full_ui_activation_unverified"),t}async function Dr(t,e){return/^[a-f0-9]{32}$/.test(e)||A("usb_full_ui_activation_unverified"),Mr(await t("jobs/"+e+"/full-activate"),e)}async function Hd(t,e,s,a){(s!==!0||a!==!0||!e||!/^[a-f0-9]{32}$/.test(e.job_id)||!/^[a-f0-9]{64}$/.test(e.plan_sha256))&&A("usb_full_ui_activation_review_required");try{return Mr(await t("full-activate",{job_id:e.job_id,expected_plan_sha256:e.plan_sha256,experimental_reviewed:!0,screen_reviewed:!0}),e.job_id)}catch(i){if(["usb_unauthorized","usb_busy","usb_full_ui_activation_review_required","usb_full_ui_activation_trial_required","usb_install_host_space","usb_install_previous_unverified","usb_pm_extension_previous_unverified","usb_full_ui_trial_previous_unverified","usb_full_ui_activation_previous_unverified","usb_pm_extension_previous_unverified"].includes(i?.code))throw i;try{let n=await Dr(t,e.job_id);if(n.state!=="not_started")return n}catch{}A("usb_full_ui_activation_unverified")}}function Fr(t,e){let s=["job_id","state","pm_available","arming_acknowledged","completion_observed","next_boot_armed","installed","installation_ready","replay_allowed","live_recheck_required"];return(!t||Object.keys(t).sort().join()!==s.sort().join()||!/^[a-f0-9]{32}$/.test(e)||t.job_id!==e||!["not_started","pm_extension_unverified","pm_extension_armed_waiting_reboot"].includes(t.state)||typeof t.pm_available!="boolean"||![null,!0,!1].includes(t.arming_acknowledged)||![null,!0,!1].includes(t.completion_observed)||t.next_boot_armed!==(t.state==="pm_extension_armed_waiting_reboot"?!0:null)||t.installed!==!1||t.installation_ready!==!1||t.replay_allowed!==!1||t.live_recheck_required!==!0)&&A("usb_pm_extension_unverified"),t.state!=="not_started"&&t.pm_available&&A("usb_pm_extension_unverified"),t.state==="not_started"&&(t.arming_acknowledged!==null||t.completion_observed!==null)&&A("usb_pm_extension_unverified"),t.state==="pm_extension_armed_waiting_reboot"&&(t.completion_observed!==!0||typeof t.arming_acknowledged!="boolean")&&A("usb_pm_extension_unverified"),t}async function Gr(t,e){return/^[a-f0-9]{32}$/.test(e)||A("usb_pm_extension_unverified"),Fr(await t("jobs/"+e+"/pm-enable"),e)}async function Qd(t,e,s){(s!==!0||!e||!/^[a-f0-9]{32}$/.test(e.job_id)||!/^[a-f0-9]{64}$/.test(e.plan_sha256))&&A("usb_pm_extension_review_required");try{return Fr(await t("pm-enable",{job_id:e.job_id,expected_plan_sha256:e.plan_sha256,experimental_reviewed:!0}),e.job_id)}catch(a){if(["usb_unauthorized","usb_busy","usb_pm_extension_review_required","usb_pm_extension_bridge_required","usb_install_host_space","usb_pm_extension_previous_unverified","usb_full_ui_activation_previous_unverified","usb_full_ui_trial_previous_unverified","usb_install_previous_unverified"].includes(a?.code))throw a;try{let i=await Gr(t,e.job_id);if(i.state!=="not_started")return i}catch{}A("usb_pm_extension_unverified")}}function Jr(t,e){let s=["job_id","state","enrollment_available","entry_id","replay_allowed","installation_ready"];if(!t||Object.keys(t).sort().join()!==s.sort().join()||!/^[a-f0-9]{32}$/.test(e)||t.job_id!==e||!["not_started","created","already_configured","conflict","manual_flow_required","unverified"].includes(t.state)||typeof t.enrollment_available!="boolean"||t.replay_allowed!==!1||t.installation_ready!==!1||!(t.entry_id===null||typeof t.entry_id=="string"&&/^[A-Za-z0-9_-]{1,64}$/.test(t.entry_id))||["created","already_configured"].includes(t.state)!==(t.entry_id!==null)||t.state!=="not_started"&&t.enrollment_available)throw{code:"usb_enrollment_unverified"};return t}async function Wr(t,e){if(!/^[a-f0-9]{32}$/.test(e))throw{code:"usb_enrollment_unverified"};return Jr(await t("jobs/"+e+"/enroll"),e)}async function Vd(t,e,s){if(s!==!0||!e||!/^[a-f0-9]{32}$/.test(e.job_id)||!/^[a-f0-9]{64}$/.test(e.plan_sha256))throw{code:"usb_enrollment_review_required"};try{return Jr(await t("enroll",{job_id:e.job_id,expected_plan_sha256:e.plan_sha256,reviewed:!0}),e.job_id)}catch(a){if(["usb_unauthorized","usb_busy","usb_enrollment_review_required","usb_enrollment_activation_required"].includes(a?.code))throw a;try{let i=await Wr(t,e.job_id);if(i.state!=="not_started")return i}catch{}throw{code:"usb_enrollment_unverified"}}}function Kd(t){if(!(t instanceof Blob)||t.type!=="application/vnd.qingping.private-profile+json"||!t.size||t.size>16384)throw{code:"usb_private_export_unverified"};let e=URL.createObjectURL(t),s=document.createElement("a");s.href=e,s.download="qingping-cgs1-private-profile.json",s.rel="noreferrer",s.click(),setTimeout(()=>URL.revokeObjectURL(e),1e3)}function Xd(t){if(!(t instanceof Blob)||t.type!=="application/vnd.qingping.private-computer-bundle+tar"||!t.size||t.size>64*1024*1024)throw{code:"usb_private_export_unverified"};let e=URL.createObjectURL(t),s=document.createElement("a");s.href=e,s.download="qingping-cgs1-computer.tar",s.rel="noreferrer",s.click(),setTimeout(()=>URL.revokeObjectURL(e),1e3)}function Hr(){let t,e=!1;return{async generateKey(){if(e)throw Error("Ephemeral authorization already attempted");e=!0;let s=await crypto.subtle.generateKey({name:"RSASSA-PKCS1-v1_5",modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:"SHA-1"},!0,["sign","verify"]);return t={buffer:new Uint8Array(await crypto.subtle.exportKey("pkcs8",s.privateKey)),name:"Qingping USB installer"},t},*iterateKeys(){t&&(yield t)}}}function Yf(){return new ja({manager:ds.BROWSER,authenticate:t=>ns.authenticate(t),createClient:t=>new ss(t),ephemeralCredentials:Hr},J)}function em(){return new Ts({manager:ds.BROWSER,authenticate:t=>ns.authenticate(t),createClient:t=>new ss(t),ephemeralCredentials:Hr,createSyncSocket:t=>new Rt(t,65536),pushV1:gi},J)}export{em as createNativeChannel,Yf as createProbe,Cd as downloadCapture,Xd as downloadComputerPackage,Kd as downloadPrivateProfile,Gd as observeBoot,To as openBrowserControl,Ro as openBrowserFullUiControl,Po as openBrowserReviewControl,Bd as prepareBrowserPlan,Md as preparePlan,Nd as prepareProfile,Nr as readBrowserPlan,qr as readBuild,Wr as readEnrollment,Dr as readFullUiActivation,zr as readFullUiTrial,Br as readInstall,Dd as readInstallReview,Pr as readPlan,Gr as readPmExtension,Er as readPrepared,Ud as reviewBrowserPlan,Jd as reviewFullUi,qd as savedPreparations,Pd as startBuild,Vd as startEnrollment,Hd as startFullUiActivation,Wd as startFullUiTrial,Fd as startInstall,Qd as startPmExtension,Ed as strings};
