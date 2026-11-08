// Tango ADB browser probe. Rebuild: tools/monitor1-usb/build.mjs; MIT notices: usb-probe-NOTICES.txt
var An=Object.defineProperty;var jn=(t,e)=>{for(var s in e)An(t,s,{get:e[s],enumerable:!0})};var W=()=>{throw{code:"usb_browser_scope_unverified"}},Ai="exec:/bin/sh",Si="CGS1_FIXED_STDIN_READY",En=new TextEncoder;function be(t){(!t||Object.keys(t).sort().join()!==["size","sha256","marker"].sort().join()||!Number.isInteger(t.size)||t.size<1||t.size>32768||typeof t.sha256!="string"||!/^[a-f0-9]{64}$/.test(t.sha256)||typeof t.marker!="string"||!/^__CGS1_FIXED_OK_[a-f0-9]{32}__$/.test(t.marker))&&W();let s="'"+`set -eu
umask 077
CGS1_FIXED_BODY=$(dd bs=1 count=${t.size} 2>/dev/null)
[ "\${#CGS1_FIXED_BODY}" -eq ${t.size} ]
CGS1_FIXED_SHA=$(printf '%s' "$CGS1_FIXED_BODY" | sha256sum)
[ "\${CGS1_FIXED_SHA%% *}" = '${t.sha256}' ]
/bin/sh -c "$CGS1_FIXED_BODY"
printf '\\n${t.marker}\\n'
`.replaceAll("'","'\\''")+"'";return Ai+" -c "+s}var Ue=class{#e;#t;#s;#i=new Set;#a=!1;#r=!1;#d=!1;#c=!1;#o;constructor(e,s){(!e||Object.keys(e).sort().join()!==["open","live","closeTransport"].sort().join()||Object.values(e).some(i=>typeof i!="function")||typeof s!="function")&&W(),this.#e=Object.freeze({...e}),this.#o=s}#u(){(this.#a||this.#e.live()!==!0)&&W()}async#n(e,s){this.#u();let i=s-Date.now();i<=0&&W();let a,n;try{let r=await Promise.race([Promise.resolve().then(e),new Promise((o,d)=>{n=d,this.#i.add(d),a=setTimeout(()=>{this.close().catch(()=>{}),d({code:"usb_browser_scope_unverified"})},i)})]);return this.#u(),r}finally{clearTimeout(a),this.#i.delete(n)}}async#_(e){if(e)return e.cleanup||(e.cleanup=(async()=>{let s=!1,i=async a=>{let n;try{await Promise.race([Promise.resolve().then(a),new Promise((r,o)=>{n=setTimeout(()=>o({}),2e3)})])}finally{clearTimeout(n)}};try{await i(()=>e.socket.close())}catch{s=!0}if(e.reader){try{await i(()=>e.reader.cancel()),e.reader.releaseLock()}catch{s=!0}e.reader=void 0}if(e.writer){try{e.writer.releaseLock()}catch{s=!0}e.writer=void 0}s&&W()})()),e.cleanup}async#p(e,s,i){this.#u(),(typeof e!="string"||!e.length||e.length>32768||e.endsWith(`
`)||/[^\x01-\x7f]/.test(e))&&W();let a=Date.now()+i,n="__CGS1_FIXED_OK_"+crypto.randomUUID().replaceAll("-","")+"__",r=En.encode(e),o;try{let d=Array.from(new Uint8Array(await this.#n(()=>crypto.subtle.digest("SHA-256",r),a)),v=>v.toString(16).padStart(2,"0")).join(""),c=Object.freeze({size:r.length,sha256:d,marker:n}),l=be(c),_=await this.#n(async()=>{let v=await this.#e.open(c);try{this.#u()}catch{await this.#_({socket:v}).catch(()=>{}),W()}return v},Math.min(a,Date.now()+5e3));o={socket:_},this.#t=o,(!_||![l,l+"\0"].includes(_.service)||typeof _.closed?.then!="function"||typeof _.readable?.getReader!="function"||typeof _.writable?.getWriter!="function")&&W(),o.reader=_.readable.getReader(),o.writer=_.writable.getWriter();let u=o.reader,h=o.writer,p=new Uint8Array,f=async()=>{for(;;){let{value:v,done:g}=await this.#n(()=>u.read(),a);if(g)break;(!(v instanceof Uint8Array)||p.length+v.length>4096||v.some(le=>le===0||le>127))&&W();let J=new Uint8Array(p.length+v.length);J.set(p),J.set(v,p.length),p=J}},y=async()=>{for(let v=0;v<r.length;v+=4096)this.#u(),await this.#n(()=>h.write(r.slice(v,v+4096)),a)};await Promise.all([f(),y()]),await this.#n(()=>_.closed,a),new TextDecoder().decode(p)!==s+`
`+n+`
`&&W(),await this.#_(o),this.#t===o&&(this.#t=void 0),this.#u()}catch{await this.close().catch(()=>{}),W()}finally{o&&await this.#_(o).catch(()=>{})}}ready(){return this.#u(),this.#c&&!this.#r}async probe(){(this.#r||this.#d||this.#a)&&(await this.close().catch(()=>{}),W()),this.#d=!0,this.#r=!0;try{return await this.#p(`set -eu
umask 077
printf '%s\\n' '`+Si+"'",Si+`
`,5e3),this.#u(),this.#c=!0,{kind:"browser_fixed_stdin_probe",service:Ai,ready:!0,device_files_changed:!1,writer_enabled:!1}}finally{this.#r=!1}}async execute(e){(this.#r||!this.#c||this.#a)&&(await this.close().catch(()=>{}),W()),this.#r=!0;try{let s=this.#o(e);return await this.#p(s,"",3e4),this.#u(),{completed:!0}}catch{await this.close().catch(()=>{}),W()}finally{this.#r=!1}}close(){if(this.#s)return this.#s;this.#a=!0,this.#c=!1;for(let e of this.#i)e({code:"usb_browser_scope_unverified"});return this.#s=(async()=>{let e=!1;try{await this.#_(this.#t)}catch{e=!0}let s;try{await Promise.race([Promise.resolve().then(()=>this.#e.closeTransport()),new Promise((i,a)=>{s=setTimeout(()=>a({}),2e3)})])}catch{e=!0}finally{clearTimeout(s)}e&&W()})(),this.#s}};var ue={schema_version:1,source_commit:"53d97b9609e8e0fcdfc5d003101f620098dbc734",staged_roles:["bridge-program","pm_qt_bridge.so","launch.sh","SnowApp-with-PM","startup-hook.sh","stock-start.sh.original","stock-watchdog.sh.original","start.sh.candidate","watchdog.sh.candidate"],vendor_paths:["/data/bin/SnowApp","/data/bin/watchdog.sh","/data/etc/init.d/start.sh","/etc/init.d/S12_launcher_init","/etc/init.d/S50_px3se_init","/lib/ld-2.23.so","/lib/libc-2.23.so","/usr/lib/libQt5Core.so.5.9.4","/usr/lib/libstdc++.so.6.0.20"],producer_files:["browser_initial_journal.py","browser_initial_observation.py","browser_initial_trial.py","browser_initial_trial_job.py","initial-trial-contract.json","initial-ram-contract.json","initial-guardian-contract.json","initial-process-contract.json"],source_sha256:{"commit_disabled_install.py":"b78470c8fe3f6275d2eca07067ec56beb858f11d8037b435be08f9f6781b4408","review_initial_trial.py":"d9f2f022edbbe190d8c8b0ccbb87071f9c6dfcb53320f8e53232264ac71cc0b4","review_disabled_install.py":"174d4e23e1aaf4c386ab7afcf280a7b99b169ca877130ad1f556295a28850d1a","stage_install_adb.py":"7546caa212b3b44b1a3d8717e550b7bfd5f0893a342c80c6e847cfd2be56b8eb","initial_bridge_trial_policy.py":"c304ce59b7df712bcbb9b2fa1564a70e1ed22fb5c2575d3bdbeebc08556b4677","disabled_commit_policy.py":"ad8b50cd9c112f37b40bb1f3a77ba2ca598bf307deb1817ea1fdda4c492f2ab7","bootstrap_patches.py":"12bc6fb3fadfe6c0101130914c3dafe7db243669b8a000e83806ff0afd66f959","preflight_adb.py":"128cf367baeee28bcfb4156256548fdded689a42d50662e77580fdd71ab19b47"},templates:{create:[`set -eu
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
sha256sum /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},"/program"]}};var D={source_commit:"53d97b9609e8e0fcdfc5d003101f620098dbc734",guardian_role:"initial-trial-guardian-program",reads:{absent_stores:`# CGS1_INITIAL_ABSENT_STORES
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
' /proc/net/tcp6`},minimum_start_ram:33554432,source_sha256:{"bootstrap_patches.py":"12bc6fb3fadfe6c0101130914c3dafe7db243669b8a000e83806ff0afd66f959","build_candidate.py":"a5583b8e0159c3df425d5e500de5599b66b93a5e17ff6107d8fa75fe64caa294","build_pm_helper.py":"94a8f6c9d11fad0c18d459019b9791db1797ce339a5aa9b821d41b2199aa8851","commit_disabled_install.py":"b78470c8fe3f6275d2eca07067ec56beb858f11d8037b435be08f9f6781b4408","disabled_commit_policy.py":"ad8b50cd9c112f37b40bb1f3a77ba2ca598bf307deb1817ea1fdda4c492f2ab7","initial_bridge_trial_main.cpp":"fd00040a0c6fbf23ded86e833aa86dd5dbaa9f75a3b5ca25bb9b53ae485eb5eb","initial_bridge_trial_policy.py":"c304ce59b7df712bcbb9b2fa1564a70e1ed22fb5c2575d3bdbeebc08556b4677","initial_trial_admission.h":"77f5b1ce0c002ec9f32b87ce6615e4128134b28363e33bfc530f32af87dc9ba5","initial_trial_child.h":"5fe9e093428228ee9b0a9f6b599f402825e9a952623bfff160a4e7af3ae954cf","initial_trial_device.h":"7e2b0e9857b37b0530bc8fb69d8bb42df5a54485aef1b86fb2f75da2e078c39d","initial_trial_exec.h":"a5f09c528f03e0c61c7748ce4d68861507d2e79a49240e92dcdba89b96cbd880","initial_trial_filesystem.h":"b3018ddb17960c4bb5108602e243121159d4542f19522de9a9d4542ee9a830c5","initial_trial_intent.h":"ac429b5817af301da0cc3f3ba7f32f9cbb4730e8fb53771ba08873a91bf20c11","initial_trial_ram_scope.h":"393ab184fa31189cde891c9e736256af2eb3945f1dc6ca34a74dbd077e4276b9","initial_trial_resources.h":"d09bdf079d157a80f385a3e83d14f9237514393e635b17f6b0c33061892a492f","initial_trial_scope.h":"e3f059e3c5f97b241c588b71a7c6aa8df114bddac0082f6a1f0a2520eab9e7ac","initial_trial_self.h":"d62dbc7cf9d513bed3a506e64993efc710f3c12e7ebf6030d9754ba5a054f357","initial_trial_stock.h":"8e94e07eb9ca82f16fb79c36b8b72f69792a107b575cda356353c0b29a87e1a9","initial_trial_vendor.h":"08a506963b9e9a4c2b2b36c2085976ccfbbc6deec3276c67a8149b6d2d70b90c","preflight_adb.py":"128cf367baeee28bcfb4156256548fdded689a42d50662e77580fdd71ab19b47","prepare_install.py":"92f99cf2ff074d58f734303c54907a73feffab33d4e174d70def6d1ee70fa375","review_disabled_install.py":"174d4e23e1aaf4c386ab7afcf280a7b99b169ca877130ad1f556295a28850d1a","review_initial_trial.py":"d9f2f022edbbe190d8c8b0ccbb87071f9c6dfcb53320f8e53232264ac71cc0b4","stage_install_adb.py":"7546caa212b3b44b1a3d8717e550b7bfd5f0893a342c80c6e847cfd2be56b8eb","trial_initial_bridge_adb.py":"4f29bb503dd2d792a42aa2a642505edd2ccf84a3eb35ae7a8964b39006aaf032"}};var qe=()=>{throw{code:"usb_browser_scope_unverified"}},Us=t=>t&&typeof t=="object"&&!Array.isArray(t)?Object.keys(t).sort().join():null,Bs=(t,e)=>typeof t=="string"&&new RegExp("^[a-f0-9]{"+e+"}$").test(t),Ln=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;async function Cn(t){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",t)),e=>e.toString(16).padStart(2,"0")).join("")}async function At(t){let e;try{return await Promise.race([Promise.resolve().then(t),new Promise((s,i)=>{e=setTimeout(()=>i({code:"usb_close_unverified"}),2e3)})])}finally{clearTimeout(e)}}function ot(t){let e;try{e=JSON.parse(JSON.stringify(t))}catch{qe()}let s=["schema_version","job_id","plan_sha256","intent_sha256","channel_id","channel_nonce","nonce","ram_job_id","guardian_job_id","guardian"];return(Us(e)!==s.sort().join()||e.schema_version!==1||["job_id","channel_id","nonce","ram_job_id","guardian_job_id"].some(i=>!Bs(e[i],32))||["plan_sha256","intent_sha256"].some(i=>!Bs(e[i],64))||typeof e.channel_nonce!="string"||!Ln.test(e.channel_nonce)||new Set([e.nonce,e.ram_job_id,e.guardian_job_id]).size!==3||Us(e.guardian)!==["size","sha256"].sort().join()||!Number.isInteger(e.guardian.size)||e.guardian.size<52||e.guardian.size>16777216||!Bs(e.guardian.sha256,64))&&qe(),Object.freeze({...e,guardian:Object.freeze(e.guardian)})}var jt=class{#e;#t;#s;#i=0;#a=!1;#r=!1;#d=!1;#c=!1;#o;#u;#n=new Set;#_;#p;constructor(e,s){(Us(e)!==["openSync","pushV1","closeTransport"].sort().join()||Object.values(e).some(i=>typeof i!="function"))&&qe(),this.#e=Object.freeze({...e}),this.#t=ot(s),this.#_=Date.now()+24e4,this.#p=setTimeout(()=>{this.close().catch(()=>{})},24e4)}#b(){return!this.#c&&Date.now()<this.#_}async#h(){await this.close().catch(()=>{}),qe()}async#f(e){this.#b()||qe();let s,i;try{let a=await Promise.race([Promise.resolve().then(e),new Promise((n,r)=>{i=r,this.#n.add(r),s=setTimeout(()=>r({}),Math.min(9e4,this.#_-Date.now()))})]);return this.#b()||qe(),a}finally{clearTimeout(s),this.#n.delete(i)}}async begin(){if(!this.#b()||this.#a||this.#d)return this.#h();this.#a=!0;try{return this.#s=new Uint8Array(this.#t.guardian.size),{offset:0}}catch{return this.#h()}}async append(e,s){return!this.#b()||!this.#a||this.#r||this.#d||!this.#s||!Number.isInteger(e)||e!==this.#i||!(s instanceof Uint8Array)||s.length<1||s.length>65536||e+s.length>this.#s.length?this.#h():(this.#s.set(s,e),this.#i+=s.length,{offset:this.#i})}async finish(){if(!this.#b()||!this.#a||this.#r||this.#d||!this.#s||this.#i!==this.#s.length)return this.#h();this.#d=!0,this.#r=!0;try{let e=this.#t.guardian;if(await this.#f(()=>Cn(this.#s))!==e.sha256)throw Error();await this.#f(async()=>{let a=await this.#e.openSync();if(!this.#b())throw await At(()=>a.close()),Error();this.#o=a});let s=this.#s;await this.#f(()=>this.#e.pushV1({socket:this.#o,filename:"/tmp/qingping-initial-guardian-"+this.#t.guardian_job_id+"/program",type:8,permission:384,mtime:0,packetSize:65536,file:new ReadableStream({start(a){a.enqueue(s),a.close()}})}));let i=this.#o;if(this.#o=void 0,await At(()=>i.close()),!this.#b())throw Error();return this.#s=void 0,{guardian_job_id:this.#t.guardian_job_id,size:e.size,sha256:e.sha256,wire_acknowledged:!0}}catch{return this.#h()}finally{this.#d=!1}}close(){if(this.#u)return this.#u;this.#c=!0,clearTimeout(this.#p),this.#s=void 0;for(let s of this.#n)s({code:"usb_browser_scope_unverified"});let e=this.#o;return this.#o=void 0,this.#u=(async()=>{let s=!1;if(e)try{await At(()=>e.close())}catch{s=!0}try{await At(()=>this.#e.closeTransport())}catch{s=!0}if(s)throw{code:"usb_close_unverified"}})(),this.#u}};var K={process_scan:`count=0
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
done`,patched:{"/data/etc/init.d/start.sh":{sha256:"f104f873dd3ce4544d5f3e3f90a4056bffc811bcaae037e347306e1084e7f1d1",size:1937},"/data/bin/watchdog.sh":{sha256:"1d74ef0946734e1ddf9e76301012f9ed66d7b38d9d7a0239a5d0e80acabf2cce",size:1719}},sources:{"stock-start.sh.original":"c38d532b44f02922aa850c247f0ddd227265c7873a35a20e9ac71ac21b9627e6","stock-watchdog.sh.original":"07b61bb67ff58a97e0f92de5b8bf0a94ca106e27ba3afa50f322817b8896dad7","start.sh.candidate":"f104f873dd3ce4544d5f3e3f90a4056bffc811bcaae037e347306e1084e7f1d1","watchdog.sh.candidate":"1d74ef0946734e1ddf9e76301012f9ed66d7b38d9d7a0239a5d0e80acabf2cce","launch.sh":"0e3b041b629cf24f1be8327df858913bd7f6f37164013b52cb1d9ef232ad4117","SnowApp-with-PM":"c1a1700e5172e7a9f415b947ad9b3e852e2d3ec2ca770315894a3b9e7866530a","startup-hook.sh":"42ffeb1329a9185431ba2f7006d0e64ac87214967ab6e0c30f276bb63665314e"},source_sha256:{"review_disabled_install.py":"174d4e23e1aaf4c386ab7afcf280a7b99b169ca877130ad1f556295a28850d1a","bootstrap_patches.py":"12bc6fb3fadfe6c0101130914c3dafe7db243669b8a000e83806ff0afd66f959","preflight_adb.py":"128cf367baeee28bcfb4156256548fdded689a42d50662e77580fdd71ab19b47","disabled_commit_policy.py":"ad8b50cd9c112f37b40bb1f3a77ba2ca598bf307deb1817ea1fdda4c492f2ab7"}};var Q={identity:[{name:"uid",command:"id -u"},{name:"wlan_mac",command:"cat /sys/class/net/wlan0/address"},{name:"version",command:"cat /data/etc/os-release"},{name:"arch",command:"uname -m"},{name:"co2_type",command:`awk '
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
test ! -L /data/.esphome-cgs1`};var M=Object.freeze([["bridge-program","program"],["pm_qt_bridge.so","pm_qt_bridge.so"],["launch.sh","launch.sh"],["SnowApp-with-PM","SnowApp-with-PM"],["startup-hook.sh","startup-hook.sh"],["stock-start.sh.original","stock-start.sh.original"],["stock-watchdog.sh.original","stock-watchdog.sh.original"],["start.sh.candidate","start.sh.candidate"],["watchdog.sh.candidate","watchdog.sh.candidate"]].map(t=>Object.freeze(t))),Tn="/data/.esphome-cgs1/",In=16*1024*1024,ji=65536,qs=/^[a-f0-9]{64}$/,Et=()=>{throw{code:"usb_browser_stage_unverified"}};async function Pn(t){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",t)),e=>e.toString(16).padStart(2,"0")).join("")}async function Lt(t){let e;try{return await Promise.race([Promise.resolve().then(t),new Promise((s,i)=>{e=setTimeout(()=>i({code:"usb_close_unverified"}),2e3)})])}finally{clearTimeout(e)}}var Ct=class{#e;#t;#s=0;#i;#a;#r=!1;#d;#c=!1;#o;#u;constructor(e,s){(!e||Object.keys(e).sort().join()!==["openSync","pushV1","closeTransport"].sort().join()||Object.values(e).some(n=>typeof n!="function")||!s||Object.keys(s).sort().join()!==["plan_id","plan_sha256","intent_sha256","files"].sort().join()||typeof s.plan_id!="string"||!/^[a-f0-9]{32}$/.test(s.plan_id)||typeof s.plan_sha256!="string"||!qs.test(s.plan_sha256)||typeof s.intent_sha256!="string"||!qs.test(s.intent_sha256)||!s.files||Object.keys(s.files).sort().join()!==M.map(([n])=>n).sort().join())&&Et();let i={},a=0;for(let[n]of M){let r=s.files[n];(!r||Object.keys(r).sort().join()!==["size","sha256"].sort().join()||!Number.isInteger(r.size)||r.size<=0||r.size>In||typeof r.sha256!="string"||!qs.test(r.sha256))&&Et(),a+=r.size,i[n]=Object.freeze({...r})}a>32*1024*1024&&Et(),this.#t=Object.freeze(i),this.#e=Object.freeze({...e}),this.#o=Date.now()+24e4,this.#u=setTimeout(()=>{this.close().catch(()=>{})},24e4)}async#n(){await this.close().catch(()=>{}),Et()}#_(){return!this.#r&&Date.now()<this.#o}async begin(e){return!this.#_()||this.#c||this.#i||this.#s>=M.length||e!==M[this.#s][0]?this.#n():(this.#i={role:e,offset:0,bytes:new Uint8Array(this.#t[e].size)},{role:e,offset:0})}async append(e,s,i){let a=this.#i;return!this.#_()||this.#c||!a||e!==a.role||!Number.isInteger(s)||s!==a.offset||!(i instanceof Uint8Array)||i.length<1||i.length>ji||s+i.length>a.bytes.length?this.#n():(a.bytes.set(i,s),a.offset+=i.length,{role:e,offset:a.offset})}async#p(e){let s=this.#o-Date.now();if(s<=0)return this.#n();let i;try{return await Promise.race([Promise.resolve().then(e),new Promise((a,n)=>{i=setTimeout(()=>n({code:"usb_browser_stage_unverified"}),Math.min(9e4,s))})])}finally{clearTimeout(i)}}async finish(e){let s=this.#i;if(!this.#_()||this.#c||!s||e!==s.role||s.offset!==s.bytes.length)return this.#n();this.#c=!0;try{let i=this.#t[e];if(await Pn(s.bytes)!==i.sha256||!this.#_()||(await this.#p(async()=>{let a=await this.#e.openSync();if(this.#r)throw await Lt(()=>a.close()),Error();this.#a=a}),await this.#p(()=>this.#e.pushV1({socket:this.#a,filename:Tn+M[this.#s][1],type:8,permission:384,mtime:0,packetSize:ji,file:new ReadableStream({start(a){a.enqueue(s.bytes),a.close()}})})),await Lt(()=>this.#a.close()),this.#a=void 0,!this.#_()))throw Error();return this.#i=void 0,this.#s++,{role:e,size:i.size,sha256:i.sha256,wire_acknowledged:!0}}catch{return await this.#n()}finally{this.#c=!1}}close(){if(this.#d)return this.#d;this.#r=!0,clearTimeout(this.#u);let e=this.#a;return this.#a=void 0,this.#i=void 0,this.#d=(async()=>{let s=!1;if(e)try{await Lt(()=>e.close())}catch{s=!0}try{await Lt(()=>this.#e.closeTransport())}catch{s=!0}if(s)throw{code:"usb_close_unverified"}})(),this.#d}};function ne(t,e,s){return typeof t!="string"||typeof e!="string"||!/^[a-f0-9]{64}$/.test(e)||typeof s!="string"||!/^\/[A-Za-z0-9._/+-]+$/.test(s)||s.split("/").slice(1).some(i=>!i||i==="."||i==="..")?!1:t===e+" "+s||t===e+"  "+s}function ze(t,e){if(typeof t!="string"||!e||!Number.isInteger(e.size)||e.size<1||e.size>8*1024*1024)return!1;let s=t.split(`
`);return s.length===2&&s[0]===`${e.size} 1`&&ne(s[1],e.sha256,e.path)}var P="/data/.esphome-cgs1",U="/data/.esphome-cgs1-stage",zs=/^[a-f0-9]{64}$/,Nn=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/,De=()=>{throw{code:"usb_browser_stage_unverified"}},Ds=new Set(["bridge-program","launch.sh","SnowApp-with-PM"]),Rn=Q.files.map(t=>t.path);function Ms(t,e){(!t||typeof t.plan_id!="string"||!/^[a-f0-9]{32}$/.test(t.plan_id)||typeof t.plan_sha256!="string"||!zs.test(t.plan_sha256)||typeof t.intent_sha256!="string"||!zs.test(t.intent_sha256)||typeof e!="string"||!Nn.test(e))&&De();let s=t.plan_id+" "+t.plan_sha256,i=s+" "+t.intent_sha256,a=i+" "+e,n=`CGS1_STAGE_BOOT=$(cat /proc/sys/kernel/random/boot_id)
test "$CGS1_STAGE_BOOT" = '${e}'`,r=(u,h)=>`test ! -L ${P}/${u}
test -f ${P}/${u}
CGS1_STAGE_META=$(stat -c '%a %u %h %s' ${P}/${u})
test "$CGS1_STAGE_META" = '600 0 1 ${h}'`,o=(u,h)=>`test ! -L ${U}/${u}
test -f ${U}/${u}
CGS1_STAGE_META=$(stat -c '%a %u %h %s' ${U}/${u})
test "$CGS1_STAGE_META" = '600 0 1 ${h}'`,d=(u,h)=>"CGS1_STAGE_EXPECTED=$(printf '%s\\n' '"+h+`' | sha256sum)
CGS1_STAGE_ACTUAL=$(sha256sum `+u+')\ntest "${CGS1_STAGE_ACTUAL%% *}" = "${CGS1_STAGE_EXPECTED%% *}"',c=`test ! -L ${U}
test -d ${U}
CGS1_STAGE_ROOT=$(stat -c '%a %u' ${U})
test "$CGS1_STAGE_ROOT" = '700 0'
`+o("intent",a.length+1)+`
`+d(U+"/intent",a),l=n+`
`+c+`
test ! -L ${P}
test -d ${P}
CGS1_STAGE_ROOT=$(stat -c '%a %u' ${P})
test "$CGS1_STAGE_ROOT" = '700 0'
`+r("install.intent",s.length+1)+`
`+d(P+"/install.intent",s)+`
`+r("disabled",0)+`
`+r("pm-helper.disabled",0),_=u=>{let h=M.find(([p])=>p===u);return h||De(),h[1]};return Object.freeze({guard:l,create:n+`
test ! -L /data
test ! -e ${P}
test ! -L ${P}
test ! -e ${U}
test ! -L ${U}
mkdir ${U}
chmod 700 ${U}
printf '%s\\n' '${a}' > ${U}/intent
sync
mkdir ${P}
chmod 700 ${P}
: > ${P}/disabled
: > ${P}/pm-helper.disabled
printf '%s\\n' '${s}' > ${P}/install.intent
sync`,precreate:u=>{let h=P+"/"+_(u);return l+`
test ! -e ${h}
test ! -L ${h}
set -C
: > ${h}`},setMode:u=>l+`
chmod ${Ds.has(u)?"700":"600"} ${P}/${_(u)}`,inspect:u=>l+`
test ! -L ${P}/${_(u)}
test -f ${P}/${_(u)}
stat -c '%s %h %u %a' ${P}/${_(u)}
sha256sum ${P}/${_(u)}`,complete:l+`
test ! -e ${U}/complete
test ! -L ${U}/complete
set -C
printf '%s\\n' '${i}' > ${U}/complete
sync`,inspectComplete:l+`
`+o("complete",i.length+1)+`
sha256sum ${U}/complete`,afterBytes:new TextEncoder().encode(i+`
`)})}async function On(t){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",t)),e=>e.toString(16).padStart(2,"0")).join("")}var Tt=class{#e;#t;#s;#i;#a;#r=!1;#d=!1;#c=!1;#o=!1;#u=0;#n;#_;constructor(e,s,i){let a=["read","initial","inventory","identity","openSync","pushV1","closeTransport"];(!e||Object.keys(e).sort().join()!==a.sort().join()||Object.values(e).some(r=>typeof r!="function")||!s||Object.keys(s).sort().join()!==["schema_version","job_id","target","descriptor","requested_data_free_bytes"].sort().join()||s.schema_version!==1||typeof s.job_id!="string"||!/^[a-f0-9]{32}$/.test(s.job_id)||!s.target||Object.keys(s.target).sort().join()!==["kind","wlan_mac","co2_type","stock_version","usb_serial","boot_id"].sort().join()||s.target.kind!=="browser_webusb"||s.target.stock_version!=="4.1.8_0287"||![2,3].includes(s.target.co2_type)||typeof s.target.wlan_mac!="string"||!/^[a-f0-9]{2}(?::[a-f0-9]{2}){5}$/.test(s.target.wlan_mac)||typeof s.target.usb_serial!="string"||!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(s.target.usb_serial)||!Number.isInteger(s.requested_data_free_bytes)||s.requested_data_free_bytes<=0||s.requested_data_free_bytes>256*1024*1024||!i||Object.keys(i).sort().join()!==[...Rn].sort().join())&&De();for(let r of Object.values(i))(!r||Object.keys(r).sort().join()!==["size","sha256"].sort().join()||!Number.isInteger(r.size)||r.size<1||r.size>8*1024*1024||typeof r.sha256!="string"||!zs.test(r.sha256))&&De();this.#s=Ms(s.descriptor,s.target.boot_id);let n=Object.values(s.descriptor.files||{}).reduce((r,o)=>r+(o?.size||0),0)+8*1024*1024;s.requested_data_free_bytes<n&&De(),this.#t=JSON.parse(JSON.stringify(s)),this.#i=JSON.parse(JSON.stringify(i)),this.#e=Object.freeze({...e}),this.#a=new Ct({openSync:e.openSync,pushV1:e.pushV1,closeTransport:e.closeTransport},s.descriptor)}async#p(){await this.close().catch(()=>{}),De()}async#b(e){if(await this.#h(`set -eu
umask 077
`+e)!=="")throw Error()}async#h(e){if(this.#c)throw Error();let s=await this.#e.read(e);if(this.#c)throw Error();return s}async#f(){if(this.#c||await this.#e.identity(this.#t.target)!==!0||this.#c)throw Error()}async#l(){if(this.#c||await this.#e.inventory()!==!0||this.#c)throw Error()}async prepare(){if(this.#c||this.#r||this.#o)return this.#p();this.#r=!0,this.#o=!0;try{if(await this.#e.initial(this.#t.target,this.#t.requested_data_free_bytes)!==!0||this.#c)throw Error();return await this.#b(this.#s.create),await this.#b(this.#s.guard),this.#d=!0,{state:"disabled_root_created"}}catch{return await this.#p()}finally{this.#o=!1}}async begin(e){if(this.#c||!this.#d||this.#o||this.#n||this.#u>=M.length||e!==M[this.#u][0])return this.#p();this.#o=!0,this.#n=e;try{return await this.#f(),await this.#a.begin(e),await this.#b(this.#s.precreate(e)),{role:e,offset:0}}catch{return await this.#p()}finally{this.#o=!1}}async append(e,s,i){if(this.#c||this.#o||e!==this.#n)return this.#p();this.#o=!0;try{return await this.#a.append(e,s,i)}catch{return await this.#p()}finally{this.#o=!1}}async#v(e,s){let i=this.#t.descriptor.files[e],a=M.find(([r])=>r===e)[1],n=(await this.#h(this.#s.inspect(e))).split(`
`);if(n.length!==2||n[0]!==`${i.size} 1 0 ${s}`||!ne(n[1],i.sha256,P+"/"+a))throw Error()}async finishFile(e){if(this.#c||this.#o||e!==this.#n)return this.#p();this.#o=!0;try{return await this.#f(),await this.#a.finish(e),await this.#v(e,"600"),await this.#b(this.#s.setMode(e)),await this.#v(e,Ds.has(e)?"700":"600"),this.#n=void 0,this.#u++,{role:e,state:"remote_file_verified"}}catch{return await this.#p()}finally{this.#o=!1}}async finish(){if(this.#c||!this.#d||this.#o||this.#n||this.#u!==M.length)return this.#p();this.#o=!0;try{await this.#f(),await this.#l();for(let[s]of M)await this.#v(s,Ds.has(s)?"700":"600");await this.#b(this.#s.complete);let e=await On(this.#s.afterBytes);if(!ne(await this.#h(this.#s.inspectComplete),e,U+"/complete"))throw Error();return await this.#f(),await this.#l(),await this.close(),{plan_id:this.#t.descriptor.plan_id,plan_sha256:this.#t.descriptor.plan_sha256,intent_sha256:this.#t.descriptor.intent_sha256,target:this.#t.target,files:this.#t.descriptor.files,stock_files:this.#i,root_mode_uid:"700 0",stage_metadata_mode_uid:"700 0",optouts_empty_regular:!0,transport_closed:!0,vendor_files_changed:!1,program_started:!1,after_effects_sha256:e}}catch{return await this.#p()}finally{this.#o=!1}}close(){return this.#_?this.#_:(this.#c=!0,this.#_=this.#a.close(),this.#_)}};var dt="/data/.esphome-cgs1",Ci="/data/.esphome-cgs1-stage",S=()=>{throw{code:"usb_browser_scope_unverified"}},Ei=async t=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",t)),e=>e.toString(16).padStart(2,"0")).join(""),Bn=new Set(["bridge-program","launch.sh","SnowApp-with-PM"]);function Fe(t){(typeof t!="string"||!/^[0-9]+$/.test(t))&&S();let e=Number(t);return(!Number.isSafeInteger(e)||e<1)&&S(),e}function Me(t,e){return JSON.stringify(t)===JSON.stringify(e)}function ct(t){let e=["schema_version","job_id","target","descriptor","commit_nonce"];(!t||Object.keys(t).sort().join()!==e.sort().join()||t.schema_version!==1||typeof t.job_id!="string"||!/^[a-f0-9]{32}$/.test(t.job_id)||!(t.commit_nonce===null||typeof t.commit_nonce=="string"&&/^[a-f0-9]{32}$/.test(t.commit_nonce))||!t.target||Object.keys(t.target).sort().join()!==["kind","wlan_mac","co2_type","stock_version","usb_serial","boot_id"].sort().join()||t.target.kind!=="browser_webusb"||![2,3].includes(t.target.co2_type)||t.target.stock_version!=="4.1.8_0287"||typeof t.target.wlan_mac!="string"||!/^[a-f0-9]{2}(?::[a-f0-9]{2}){5}$/.test(t.target.wlan_mac)||t.target.wlan_mac==="00:00:00:00:00:00"||parseInt(t.target.wlan_mac.slice(0,2),16)&1||typeof t.target.usb_serial!="string"||!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(t.target.usb_serial)||!t.descriptor||Object.keys(t.descriptor).sort().join()!==["plan_id","plan_sha256","intent_sha256","files"].sort().join()||!t.descriptor.files||Object.keys(t.descriptor.files).sort().join()!==M.map(([d])=>d).sort().join())&&S();let s=0;for(let d of Object.values(t.descriptor.files))(!d||Object.keys(d).sort().join()!==["size","sha256"].sort().join()||!Number.isInteger(d.size)||d.size<1||d.size>16*1024*1024||typeof d.sha256!="string"||!/^[a-f0-9]{64}$/.test(d.sha256))&&S(),s+=d.size;s>32*1024*1024&&S();for(let[d,c]of Object.entries(K.sources))t.descriptor.files[d]?.sha256!==c&&S();let i=Ms(t.descriptor,t.target.boot_id),a=dt+"/.commit-disabled.lock",n="commit-disabled "+t.commit_nonce+" "+t.descriptor.plan_id,r=t.commit_nonce===null?"":`test ! -L ${a}
test -d ${a}
CGS1_SCOPE_LOCK=$(stat -c '%a %u' ${a})
test "$CGS1_SCOPE_LOCK" = '700 0'
test ! -L ${a}/owner
test -f ${a}/owner
CGS1_SCOPE_OWNER=$(stat -c '%s %a %u %h' ${a}/owner)
test "$CGS1_SCOPE_OWNER" = '${n.length+1} 600 0 1'
CGS1_SCOPE_ACTUAL=$(sha256sum ${a}/owner)
CGS1_SCOPE_EXPECTED=$(printf '%s\\n' '${n}' | sha256sum)
test "\${CGS1_SCOPE_ACTUAL%% *}" = "\${CGS1_SCOPE_EXPECTED%% *}"
`,o=i.guard+`
`+r;return Object.freeze({stage:i,guard:o,root:o+`
stat -c '%d %i %a %u' ${dt}`,entries:o+`
LC_ALL=C ls -A1 ${dt}`,sideEntries:o+`
LC_ALL=C ls -A1 ${Ci}`,lockEntries:t.commit_nonce===null?null:o+`
LC_ALL=C ls -A1 ${a}`,parents:o+`
test ! -L /data
test ! -L /data/bin
test ! -L /data/etc
test ! -L /data/etc/init.d
stat -c '%d' /data/bin /data/etc/init.d`,process:d=>((!Number.isInteger(d)||d<=1||d>2147483647)&&S(),`cat /proc/${d}/stat
stat -c '%u' /proc/${d}
readlink /proc/${d}/exe`),watchdog:d=>((!Number.isInteger(d)||d<=1||d>2147483647)&&S(),`CGS1_SCOPE_ARGS=$(tr '\\000' '\\n' < /proc/${d}/cmdline)
[ "$CGS1_SCOPE_ARGS" = "$(printf '/bin/sh\\n/data/bin/watchdog.sh')" ]`),maps:d=>((!Number.isInteger(d)||d<=1||d>2147483647)&&S(),`test -r /proc/${d}/maps
if grep -F -q '${dt}/pm_qt_bridge.so' /proc/${d}/maps; then exit 1; else CGS1_SCOPE_RESULT=$?; [ "$CGS1_SCOPE_RESULT" -eq 1 ]; fi`)})}function Li(t,e,s){let i=t.split(`
`);(i.length!==3||i[1]!=="0"||i[2]!==s)&&S();let a=i[0],n=a.indexOf("("),r=a.lastIndexOf(") ");(n<1||r<=n||a.slice(0,n).trim()!==String(e))&&S();let o=a.slice(r+2).split(/\s+/);return(o.length<20||!["R","S","D","I"].includes(o[0]))&&S(),[e,Fe(o[1]),Fe(o[19])]}async function Ti(t,e){(!t||Object.keys(t).sort().join()!==["read","identity"].sort().join()||Object.values(t).some(_=>typeof _!="function"))&&S();let s=ct(e),i=JSON.parse(JSON.stringify(e)),a=_=>t.read(_),n=async()=>{await t.identity(i.target)!==!0&&S()},r=async _=>{await a(_)!==""&&S()},o=async()=>{let _=(await a(s.root)).split(" ");(_.length!==4||_[2]!=="700"||_[3]!=="0")&&S();let u=[Fe(_[0]),Fe(_[1])],h=[...M.map(([,f])=>f),"install.intent","disabled","pm-helper.disabled"];i.commit_nonce!==null&&h.push(".commit-disabled.lock"),(!Me((await a(s.entries)).split(`
`).sort(),h.sort())||!Me((await a(s.sideEntries)).split(`
`).sort(),["complete","intent"])||s.lockEntries&&await a(s.lockEntries)!=="owner"||!Me((await a(s.parents)).split(`
`),[String(u[0]),String(u[0])]))&&S();let p=await Ei(s.stage.afterBytes);return ne(await a(s.stage.inspectComplete),p,Ci+"/complete")||S(),u},d=async()=>{for(let[_,u]of M){let h=i.descriptor.files[_],p=(await a(s.stage.inspect(_))).split(`
`);(p.length!==2||p[0]!==`${h.size} 1 0 ${Bn.has(_)?"700":"600"}`||!ne(p[1],h.sha256,dt+"/"+u))&&S()}},c=async()=>{let _=[];for(let u of Q.files){let h=(await a(u.command)).split(`
`),f=[u,K.patched[u.path]].filter(Boolean).find(y=>h.length===2&&h[0]===`${y.size} 1`&&ne(h[1],y.sha256,u.path));f||S(),_.push([u.path,f.sha256])}return _.sort(([u],[h])=>u<h?-1:u>h?1:0)},l=async()=>{let _=await a(K.process_scan);/^[0-9]+$/.test(_)||S();let u=Fe(_);(u<=1||u>2147483647)&&S();let h=Li(await a(s.process(u)),u,"/data/bin/SnowApp"),p=Li(await a(s.process(h[1])),h[1],"/bin/busybox");return h[0]===p[0]&&S(),await r(s.watchdog(p[0])),await r(s.maps(h[0])),{stock:[h[0],h[2],Q.files.find(f=>f.path==="/data/bin/SnowApp").sha256,0],watchdog:[p[0],p[2],0]}};try{await n();let _=await o(),u=await c(),h=await l();await d();let p=(await a("stat -f -c '%t %a %S' /data")).split(/\s+/);(p.length!==3||p[0]!=="ef53"||!/^[0-9]+$/.test(p[1]))&&S();let f=Number(p[1]),y=Fe(p[2]),v=f*y;(!Number.isSafeInteger(f)||f<0||y<512||y>65536||!Number.isSafeInteger(v)||v<8*1024*1024)&&S(),(!Me(await o(),_)||!Me(await c(),u)||!Me(await l(),h))&&S(),await d(),await n();let g=await Ei(new Uint8Array);return{kind:"browser_disabled_scope",target:i.target,plan_id:i.descriptor.plan_id,plan_sha256:i.descriptor.plan_sha256,stage_intent_sha256:i.descriptor.intent_sha256,root_identity:_,install_marker:i.descriptor.plan_id+" "+i.descriptor.plan_sha256,root_mode:448,root_uid:0,disabled_flags:Array.from({length:2},()=>[g,0,384,0,1,!1]),source_hashes:Object.entries(K.sources).sort(([J],[le])=>J<le?-1:J>le?1:0),vendor_hashes:u,stock_process:h.stock,watchdog_process:h.watchdog,own_code_running:!1,pm_helper_loaded:!1,data_available_bytes:v,same_filesystem:!0,staged_files:i.descriptor.files,commit_nonce:i.commit_nonce}}catch{S()}}var fe={schema_version:1,staged_roles:["bridge-program","pm_qt_bridge.so","launch.sh","SnowApp-with-PM","startup-hook.sh","stock-start.sh.original","stock-watchdog.sh.original","start.sh.candidate","watchdog.sh.candidate"],vendor_paths:["/data/bin/SnowApp","/data/bin/watchdog.sh","/data/etc/init.d/start.sh","/etc/init.d/S12_launcher_init","/etc/init.d/S50_px3se_init","/lib/ld-2.23.so","/lib/libc-2.23.so","/usr/lib/libQt5Core.so.5.9.4","/usr/lib/libstdc++.so.6.0.20"],source_sha256:{"commit_disabled_install.py":"b78470c8fe3f6275d2eca07067ec56beb858f11d8037b435be08f9f6781b4408","stage_install_adb.py":"7546caa212b3b44b1a3d8717e550b7bfd5f0893a342c80c6e847cfd2be56b8eb","review_disabled_install.py":"174d4e23e1aaf4c386ab7afcf280a7b99b169ca877130ad1f556295a28850d1a","disabled_commit_policy.py":"ad8b50cd9c112f37b40bb1f3a77ba2ca598bf307deb1817ea1fdda4c492f2ab7","bootstrap_patches.py":"12bc6fb3fadfe6c0101130914c3dafe7db243669b8a000e83806ff0afd66f959","preflight_adb.py":"128cf367baeee28bcfb4156256548fdded689a42d50662e77580fdd71ab19b47"},templates:{claim:[`test ! -L /data/.esphome-cgs1
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
sync`]}};var ee=()=>{throw{code:"usb_browser_scope_unverified"}},Pi=/^[a-f0-9]{64}$/,Un=/^[a-f0-9]{32}$/,Ii="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",qn="/data/etc/init.d/start.sh",Fs="/data/bin/watchdog.sh",Ni=t=>t&&typeof t=="object"&&!Array.isArray(t)?Object.keys(t).sort().join():null;function lt(t){return Array.isArray(t)?"["+t.map(lt).join(",")+"]":t&&typeof t=="object"?"{"+Object.keys(t).sort().map(e=>JSON.stringify(e)+":"+lt(t[e])).join(",")+"}":JSON.stringify(t)}var It=(t,e)=>lt(t)===lt(e),Ge=(t,e=1,s=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(t)&&t>=e&&t<=s;function We(t,e){ct(t);let s=["kind","target","plan_id","plan_sha256","stage_intent_sha256","root_identity","install_marker","root_mode","root_uid","disabled_flags","source_hashes","vendor_hashes","stock_process","watchdog_process","own_code_running","pm_helper_loaded","data_available_bytes","same_filesystem","staged_files","commit_nonce"],i=t.descriptor;(Ni(e)!==s.sort().join()||e.kind!=="browser_disabled_scope"||!It(e.target,t.target)||e.plan_id!==i.plan_id||e.plan_sha256!==i.plan_sha256||e.stage_intent_sha256!==i.intent_sha256||e.install_marker!==i.plan_id+" "+i.plan_sha256||e.root_mode!==448||e.root_uid!==0||!It(e.staged_files,i.files)||e.commit_nonce!==t.commit_nonce||e.own_code_running!==!1||e.pm_helper_loaded!==!1||e.same_filesystem!==!0||!Ge(e.data_available_bytes,8*1024*1024)||!Array.isArray(e.root_identity)||e.root_identity.length!==2||!e.root_identity.every(o=>Ge(o))||!It(e.disabled_flags,[[Ii,0,384,0,1,!1],[Ii,0,384,0,1,!1]])||!It(e.source_hashes,Object.entries(K.sources).sort(([o],[d])=>o<d?-1:o>d?1:0)))&&ee();let a=e.stock_process,n=e.watchdog_process;(!Array.isArray(a)||a.length!==4||!Array.isArray(n)||n.length!==3||!Ge(a[0],2,2147483647)||!Ge(n[0],2,2147483647)||a[0]===n[0]||!Ge(a[1],2)||!Ge(n[1],2)||a[3]!==0||n[2]!==0||a[2]!==Q.files.find(o=>o.path==="/data/bin/SnowApp").sha256)&&ee();let r=e.vendor_hashes;(!Array.isArray(r)||r.length!==fe.vendor_paths.length||r.some((o,d)=>!Array.isArray(o)||o.length!==2||o[0]!==fe.vendor_paths[d]||typeof o[1]!="string"||!Pi.test(o[1])))&&ee();for(let[o,d]of r){let c=Q.files.find(l=>l.path===o)?.sha256;d!==c&&d!==K.patched[o]?.sha256&&ee()}}function me(t){let e=new Set(["vendor_hashes","commit_nonce","data_available_bytes"]);return lt(Object.fromEntries(Object.entries(t).filter(([s])=>!e.has(s))))}function Pt(t,e,s,i){We(t,e),(!["claim","watchdog","start"].includes(i)||typeof s!="string"||!Un.test(s)||(i==="claim"?t.commit_nonce!==null:t.commit_nonce!==s))&&ee();let a=t.descriptor,n=e.stock_process,r=e.watchdog_process,o=e.vendor_hashes;for(let[_,u]of o){let h=Q.files.find(f=>f.path===_)?.sha256,p=i==="start"&&_===Fs?K.patched[Fs].sha256:h;(!h||u!==p)&&ee()}(!fe.vendor_paths.includes(qn)||!fe.vendor_paths.includes(Fs)||fe.schema_version!==1)&&ee();let d={plan_id:a.plan_id,plan_sha256:a.plan_sha256,root_device:String(e.root_identity[0]),root_inode:String(e.root_identity[1]),wlan_mac:t.target.wlan_mac,co2_type:String(t.target.co2_type),boot_id:t.target.boot_id,stock_pid:String(n[0]),stock_start:String(n[1]),watchdog_pid:String(r[0]),watchdog_start:String(r[1]),nonce:s};fe.staged_roles.forEach((_,u)=>{let h=a.files[_]?.sha256;(typeof h!="string"||!Pi.test(h))&&ee(),d["staged_"+u]=h}),o.forEach(([,_],u)=>{d["vendor_"+u]=_});let c=fe.templates[i];Array.isArray(c)||ee();let l=c.map(_=>typeof _=="string"?_:((Ni(_)!=="field"||typeof d[_.field]!="string")&&ee(),d[_.field])).join("");return(l.length>32768||l.includes("CGS1_"))&&ee(),`set -eu
umask 077
`+l}var X=()=>{throw{code:"usb_browser_scope_unverified"}},Gs=t=>t&&typeof t=="object"&&!Array.isArray(t)?Object.keys(t).sort().join():null;function zn(t){typeof t!="string"&&X();let e={};for(let s of t.split(`
`)){let i=/^(MemTotal|MemFree):[ \t]+([0-9]+)[ \t]+kB$/.exec(s);(!i||Object.hasOwn(e,i[1]))&&X();let a=Number(i[2])*1024;Number.isSafeInteger(a)||X(),e[i[1]]=a}return(Gs(e)!==["MemFree","MemTotal"].sort().join()||e.MemFree<D.minimum_start_ram||e.MemTotal>2**40||e.MemFree>e.MemTotal)&&X(),e.MemFree}function He(t,e,s=void 0){let i=["kind","scope","ram_available_bytes","memory_basis","persistent_stores_absent","ram_processes_absent","api_ota_listeners_free","ram_scope_checked","image_fd_admitted","execution_authority","device_writes"];(Gs(t)!==i.sort().join()||t.kind!=="browser_initial_trial_preparation"||t.memory_basis!=="MemFree_lower_bound"||!Number.isSafeInteger(t.ram_available_bytes)||t.ram_available_bytes<D.minimum_start_ram||t.ram_available_bytes>2**40||["persistent_stores_absent","ram_processes_absent","api_ota_listeners_free"].some(n=>t[n]!==!0)||["ram_scope_checked","image_fd_admitted","execution_authority"].some(n=>t[n]!==!1)||t.device_writes!==0||typeof e?.commit_nonce!="string"||!/^[a-f0-9]{32}$/.test(e.commit_nonce))&&X();let a=n=>{We(e,n);for(let[r,o]of Object.entries(K.patched))n.vendor_hashes.find(d=>d[0]===r)?.[1]!==o.sha256&&X()};a(t.scope),s!==void 0&&(a(s),me(t.scope)!==me(s)&&X())}async function Ri(t,e){(Gs(t)!==["read","identity","scope"].sort().join()||Object.values(t).some(n=>typeof n!="function"))&&X(),ct(e);let s=JSON.parse(JSON.stringify(e));(typeof s.commit_nonce!="string"||!/^[a-f0-9]{32}$/.test(s.commit_nonce))&&X();let i=async()=>{let n=await t.scope(s);We(s,n);for(let[r,o]of Object.entries(K.patched))n.vendor_hashes.find(d=>d[0]===r)?.[1]!==o.sha256&&X();return n},a=async n=>((await t.read(D.reads.absent_stores)!==""||await t.read(D.reads.process_scan)!==String(n.stock_process[0])||await t.read(D.reads.tcp4)!==""||await t.read(D.reads.tcp6)!=="")&&X(),zn(await t.read(D.reads.memory)));try{await t.identity(s.target)!==!0&&X();let n=await i(),r=await a(n),o=await i(),d=await a(o);(me(n)!==me(o)||await t.identity(s.target)!==!0)&&X();let c={kind:"browser_initial_trial_preparation",scope:o,ram_available_bytes:Math.min(r,d),memory_basis:"MemFree_lower_bound",persistent_stores_absent:!0,ram_processes_absent:!0,api_ota_listeners_free:!0,ram_scope_checked:!1,image_fd_admitted:!1,execution_authority:!1,device_writes:0};return He(c,s,n),c}catch{X()}}var he=()=>{throw{code:"usb_browser_scope_unverified"}},Ve=t=>t&&typeof t=="object"&&!Array.isArray(t)?Object.keys(t).sort().join():null,Nt=t=>typeof t=="string"&&/^[a-f0-9]{64}$/.test(t);function re(t,e){let s=["schema_version","job_id","plan_sha256","intent_sha256","channel_id","channel_nonce","nonce","ram_job_id","guardian_job_id","context","preparation","producer_sha256"],i=["schema_version","job_id","plan_sha256","source_commit","commit_intent_sha256","commit_proof_sha256","candidate_sha256","guardian","meta","committed_scope","context_only","guardian_artifact_checked","image_fd_admitted","hardware_contacted","device_writes","writer_enabled","installation_ready","live_recheck_required"];(Ve(t)!==s.sort().join()||Ve(t.context)!==i.sort().join())&&he();let a,n;try{a=JSON.parse(JSON.stringify(t)),n=JSON.parse(JSON.stringify(e))}catch{he()}let r=a.context;(Ve(a)!==s.sort().join()||Ve(r)!==i.sort().join()||r.schema_version!==1||r.job_id!==a.job_id||r.plan_sha256!==a.plan_sha256||ue.schema_version!==1||ue.source_commit!==D.source_commit||r.source_commit!==ue.source_commit||["commit_intent_sha256","commit_proof_sha256","candidate_sha256"].some(h=>!Nt(r[h]))||["context_only","guardian_artifact_checked","live_recheck_required"].some(h=>r[h]!==!0)||["image_fd_admitted","hardware_contacted","writer_enabled","installation_ready"].some(h=>r[h]!==!1)||r.device_writes!==0||r.meta?.job_id!==a.job_id||r.meta?.descriptor?.plan_sha256!==a.plan_sha256||Ve(a.producer_sha256)!==[...ue.producer_files].sort().join()||Object.values(a.producer_sha256).some(h=>!Nt(h)))&&he();let o=ot(Object.fromEntries(["schema_version","job_id","plan_sha256","intent_sha256","channel_id","channel_nonce","nonce","ram_job_id","guardian_job_id"].map(h=>[h,a[h]]).concat([["guardian",r.guardian]])));He(a.preparation,r.meta,r.committed_scope),He(n,r.meta,r.committed_scope);let d=n.scope,c=r.meta,l=d.stock_process,_=d.watchdog_process,u={plan_id:d.plan_id,plan_sha256:d.plan_sha256,root_device:String(d.root_identity[0]),root_inode:String(d.root_identity[1]),wlan_mac:c.target.wlan_mac,co2_type:String(c.target.co2_type),boot_id:c.target.boot_id,stock_pid:String(l[0]),stock_start:String(l[1]),watchdog_pid:String(_[0]),watchdog_start:String(_[1]),commit_nonce:c.commit_nonce,ram_job_id:o.ram_job_id,guardian_job_id:o.guardian_job_id,guardian_bytes:String(o.guardian.size)};return ue.staged_roles.forEach((h,p)=>{let f=c.descriptor.files[h]?.sha256;Nt(f)||he(),u["staged_"+p]=f}),d.vendor_hashes.length!==ue.vendor_paths.length&&he(),d.vendor_hashes.forEach(([h,p],f)=>{(h!==ue.vendor_paths[f]||!Nt(p))&&he(),u["vendor_"+f]=p}),Object.freeze(Object.fromEntries(["create","inspect_roots","inspect_guardian"].map(h=>{let p=ue.templates[h];Array.isArray(p)||he();let f=p.map(y=>typeof y=="string"?y:((Ve(y)!=="field"||typeof u[y.field]!="string")&&he(),u[y.field])).join("");return(f.length>32768||f.includes("QP_BROWSER_RAM_FIELD_")||!f.startsWith(`set -eu
umask 077
`))&&he(),[h,f]})))}var Dn=()=>{throw{code:"usb_browser_scope_unverified"}},Oi=be,Je=class{#e;#t=!1;constructor(e){this.#e=new Ue(e,({packet:s,fresh:i})=>re(s,i).create)}ready(){return!this.#t&&this.#e.ready()}probe(){return this.#e.probe()}async create(e,s){return(this.#t||!this.#e.ready())&&(await this.close().catch(()=>{}),Dn()),this.#t=!0,await this.#e.execute({packet:e,fresh:s}),{kind:"browser_initial_ram_command_ack",completed:!0,remote_verified:!1,image_fd_admitted:!1}}close(){return this.#e.close()}};var q=()=>{throw{code:"usb_browser_scope_unverified"}},Ws=t=>t&&typeof t=="object"&&!Array.isArray(t)?Object.keys(t).sort().join():null,Hs="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",Vs=8*1024*1024;function ke(t,e=0,s=Number.MAX_SAFE_INTEGER){(typeof t!="string"||!/^(0|[1-9][0-9]*)$/.test(t))&&q();let i=Number(t);return(!Number.isSafeInteger(i)||i<e||i>s)&&q(),i}function Bi(t,e){(typeof t!="string"||t.length>1024)&&q();let s=t.split(`
`);s.length!==4&&q();let i=[],a=[];for(let n=0;n<2;n++){let r=s[n*2].split(" "),o=s[n*2+1].split(" ");(r.length!==4||r[2]!=="700"||r[3]!=="0"||o.length!==3||o[0]!=="1021994")&&q(),i.push([ke(r[0],1),ke(r[1],1)]);let d=ke(o[1]),c=ke(o[2],512,65536),l=d*c;(!Number.isSafeInteger(l)||l>2147483647||l<e)&&q(),a.push(l)}return(i[0][0]!==i[1][0]||i[0][1]===i[1][1])&&q(),{identities:i,available:Math.min(...a)}}var ut=(t,e)=>t.length===e.length&&t.every((s,i)=>s===e[i]),Ui=["kind","phase","job_id","plan_sha256","intent_sha256","channel_id","channel_nonce","nonce","ram_job_id","guardian_job_id","ram_root_identity","guardian_root_identity","guardian_file_identity","guardian_size","guardian_sha256","tmpfs_available_bytes","image_fd_admitted","execution_authority","context_only"];function ht(t,e,s=!1,i=null){let a=e?.context?.guardian;(!a||!Number.isSafeInteger(a.size)||a.size<52||a.size>16*1024*1024||typeof a.sha256!="string"||!/^[a-f0-9]{64}$/.test(a.sha256)||typeof s!="boolean"||Ws(t)!==Ui.sort().join()||t.kind!=="browser_initial_ram_observation"||t.phase!==(s?"uploaded":"precreated")||["job_id","plan_sha256","intent_sha256","channel_id","channel_nonce","nonce","ram_job_id","guardian_job_id"].some(o=>typeof e[o]!="string"||t[o]!==e[o])||t.guardian_size!==(s?a.size:0)||t.guardian_sha256!==(s?a.sha256:Hs)||t.image_fd_admitted!==!1||t.execution_authority!==!1||t.context_only!==!0||!Number.isSafeInteger(t.tmpfs_available_bytes)||t.tmpfs_available_bytes<Vs+(s?0:a.size)||t.tmpfs_available_bytes>2147483647)&&q();let n=["ram_root_identity","guardian_root_identity","guardian_file_identity"],r=n.map(o=>t[o]);(r.some(o=>!Array.isArray(o)||o.length!==2||o.some(d=>!Number.isSafeInteger(d)||d<1))||new Set(r.map(o=>o[0])).size!==1||new Set(r.map(o=>o[1])).size!==3)&&q(),i!==null&&(ht(i,e,!1),n.some(o=>!ut(t[o],i[o]))&&q())}function qi(t,e,s,i){re(t,e),Ws(s)!==["roots_before","guardian","roots_after"].sort().join()&&q();let a=i!==null,n=t.context.guardian,r=Vs+(a?0:n.size),o=Bi(s.roots_before,r),d=Bi(s.roots_after,r);o.identities.some((v,g)=>!ut(v,d.identities[g]))&&q();let c=a?n.size:0,l=a?n.sha256:Hs;(typeof s.guardian!="string"||s.guardian.length>1024)&&q();let _=s.guardian.split(`
`),u=_[0].split(" "),h="/tmp/qingping-initial-guardian-"+t.guardian_job_id+"/program";(_.length!==2||u.length!==6||ke(u[0])!==c||u[1]!=="600"||u[2]!=="0"||u[3]!=="1"||!ne(_[1],l,h))&&q();let p=[ke(u[4],1),ke(u[5],1)];(p[0]!==o.identities[1][0]||p[1]===o.identities[0][1]||p[1]===o.identities[1][1])&&q();let f=Object.fromEntries(["job_id","plan_sha256","intent_sha256","channel_id","channel_nonce","nonce","ram_job_id","guardian_job_id"].map(v=>[v,t[v]]));a&&(Ws(i)!==Ui.sort().join()||i.kind!=="browser_initial_ram_observation"||i.phase!=="precreated"||i.guardian_size!==0||i.guardian_sha256!==Hs||i.context_only!==!0||i.image_fd_admitted!==!1||i.execution_authority!==!1||Object.entries(f).some(([v,g])=>i[v]!==g)||!Array.isArray(i.ram_root_identity)||!Array.isArray(i.guardian_root_identity)||!Array.isArray(i.guardian_file_identity)||!ut(i.ram_root_identity,o.identities[0])||!ut(i.guardian_root_identity,o.identities[1])||!ut(i.guardian_file_identity,p)||!Number.isSafeInteger(i.tmpfs_available_bytes)||i.tmpfs_available_bytes<Vs+n.size||i.tmpfs_available_bytes>2147483647)&&q();let y=Object.freeze({kind:"browser_initial_ram_observation",phase:a?"uploaded":"precreated",...f,ram_root_identity:Object.freeze(o.identities[0]),guardian_root_identity:Object.freeze(o.identities[1]),guardian_file_identity:Object.freeze(p),guardian_size:c,guardian_sha256:l,tmpfs_available_bytes:Math.min(o.available,d.available),image_fd_admitted:!1,execution_authority:!1,context_only:!0});return ht(y,t,a,i),y}function zi(t,e,s){return qi(t,e,s,null)}function Di(t,e,s,i){return s==null&&q(),qi(t,e,i,s)}var xe=()=>{throw{code:"usb_browser_scope_unverified"}},Js=t=>t&&typeof t=="object"&&!Array.isArray(t)?Object.keys(t).sort().join():null,Rt=class{#e;#t;#s;#i;#a;#r=!1;#d=!1;#c=!1;#o=!1;#u=!1;#n;#_=new Set;#p;#b;constructor(e,s,i){(Js(e)!==["preparation","read","openSync","pushV1"].sort().join()||Object.values(e).some(r=>typeof r!="function")||!(s instanceof Je)||!s.ready())&&xe();let a;try{a=JSON.parse(JSON.stringify(i))}catch{xe()}re(a,a?.preparation);let n=ot(Object.fromEntries(["schema_version","job_id","plan_sha256","intent_sha256","channel_id","channel_nonce","nonce","ram_job_id","guardian_job_id"].map(r=>[r,a[r]]).concat([["guardian",a.context.guardian]])));this.#e=Object.freeze({...e}),this.#t=s,this.#i=a,this.#s=new jt({openSync:()=>this.#e.openSync(),pushV1:r=>this.#e.pushV1(r),closeTransport:()=>this.#t.close()},n),this.#p=Date.now()+24e4,this.#b=setTimeout(()=>{this.close().catch(()=>{})},24e4)}async#h(){await this.close().catch(()=>{}),xe()}async#f(e){(this.#u||Date.now()>=this.#p)&&xe();let s,i;try{let a=await Promise.race([Promise.resolve().then(e),new Promise((n,r)=>{i=r,this.#_.add(r),s=setTimeout(()=>{this.close().catch(()=>{}),r({code:"usb_browser_scope_unverified"})},Math.min(9e4,this.#p-Date.now()))})]);return(this.#u||Date.now()>=this.#p)&&xe(),a}finally{clearTimeout(s),this.#_.delete(i)}}async#l(){let e=await this.#f(()=>this.#e.preparation(this.#i.context.meta));return re(this.#i,e),e}async#v(e){let s=re(this.#i,e),i=await this.#f(()=>this.#e.read(s.inspect_roots)),a=await this.#f(()=>this.#e.read(s.inspect_guardian)),n=await this.#f(()=>this.#e.read(s.inspect_roots));return{roots_before:i,guardian:a,roots_after:n}}async prepare(){if(this.#u||this.#r||this.#o)return this.#h();this.#r=!0,this.#o=!0;try{await this.#f(()=>this.#s.begin());let e=await this.#l(),s=await this.#f(()=>this.#t.create(this.#i,e));return(Js(s)!==["kind","completed","remote_verified","image_fd_admitted"].sort().join()||s.kind!=="browser_initial_ram_command_ack"||s.completed!==!0||s.remote_verified!==!1||s.image_fd_admitted!==!1)&&xe(),this.#a=zi(this.#i,e,await this.#v(e)),await this.#l(),this.#d=!0,{state:"ram_precreated",precreated:this.#a,writer_enabled:!1,image_fd_admitted:!1}}catch{return this.#h()}finally{this.#o=!1}}async append(e,s){if(this.#u||!this.#d||this.#c||this.#o)return this.#h();this.#o=!0;try{return await this.#f(()=>this.#s.append(e,s))}catch{return this.#h()}finally{this.#o=!1}}async finish(){if(this.#u||!this.#d||this.#c||this.#o)return this.#h();this.#c=!0,this.#o=!0;try{let e=await this.#f(()=>this.#s.finish()),s=this.#i.context.guardian;(Js(e)!==["guardian_job_id","size","sha256","wire_acknowledged"].sort().join()||e.guardian_job_id!==this.#i.guardian_job_id||e.size!==s.size||e.sha256!==s.sha256||e.wire_acknowledged!==!0)&&xe();let i=await this.#l(),a=Di(this.#i,i,this.#a,await this.#v(i)),n=await this.#l();return{kind:"browser_initial_ram_ready",precreated:this.#a,uploaded:a,preparation:n,transport_closed:!1,guardian_started:!1,image_fd_admitted:!1,execution_authority:!1,context_only:!0}}catch{return this.#h()}finally{this.#o=!1}}close(){if(this.#n)return this.#n;this.#u=!0,this.#d=!1,clearTimeout(this.#b);for(let e of this.#_)e({code:"usb_browser_scope_unverified"});return this.#n=this.#s.close(),this.#n}};var O={schema_version:1,source_commit:"53d97b9609e8e0fcdfc5d003101f620098dbc734",source_sha256:{"trial_initial_bridge_adb.py":"4f29bb503dd2d792a42aa2a642505edd2ccf84a3eb35ae7a8964b39006aaf032","initial_bridge_trial_main.cpp":"fd00040a0c6fbf23ded86e833aa86dd5dbaa9f75a3b5ca25bb9b53ae485eb5eb"},markers:{start:"CGS1_TRIAL_START_V1",child:"CGS1_TRIAL_CHILD_V1",end:"CGS1_TRIAL_END_V1"},vendor_paths:["/data/bin/SnowApp","/data/bin/watchdog.sh","/data/etc/init.d/start.sh","/etc/init.d/S12_launcher_init","/etc/init.d/S50_px3se_init","/lib/ld-2.23.so","/lib/libc-2.23.so","/usr/lib/libQt5Core.so.5.9.4","/usr/lib/libstdc++.so.6.0.20"],launch_template:[`set -eu
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
exec /tmp/qingping-initial-guardian-`,{field:"guardian_job_id"},"/program --bounded-first-bridge-v1 ",{field:"plan_id"}," ",{field:"plan_sha256"}," ",{field:"commit_nonce"}," ",{field:"boot_id"}," ",{field:"wlan_mac"}," ",{field:"co2_type"}," ",{field:"root_device"}," ",{field:"root_inode"}," ",{field:"stock_pid"}," ",{field:"stock_start"}," ",{field:"watchdog_pid"}," ",{field:"watchdog_start"}," ",{field:"ram_job_id"}," ",{field:"ram_device"}," ",{field:"ram_inode"}," ",{field:"guardian_job_id"}," ",{field:"guardian_device"}," ",{field:"guardian_inode"}," ",{field:"guardian_bytes"}," ",{field:"guardian_sha256"}," ",{field:"nonce"}," ",{field:"staged_0_bytes"}," ",{field:"staged_0_sha256"}," ",{field:"staged_1_bytes"}," ",{field:"staged_1_sha256"}," ",{field:"staged_2_bytes"}," ",{field:"staged_2_sha256"}," ",{field:"staged_3_bytes"}," ",{field:"staged_3_sha256"}," ",{field:"staged_4_bytes"}," ",{field:"staged_4_sha256"}," ",{field:"staged_5_bytes"}," ",{field:"staged_5_sha256"}," ",{field:"staged_6_bytes"}," ",{field:"staged_6_sha256"}," ",{field:"staged_7_bytes"}," ",{field:"staged_7_sha256"}," ",{field:"staged_8_bytes"}," ",{field:"staged_8_sha256"}],staged_roles:["bridge-program","pm_qt_bridge.so","launch.sh","SnowApp-with-PM","startup-hook.sh","stock-start.sh.original","stock-watchdog.sh.original","start.sh.candidate","watchdog.sh.candidate"],frame:["--bounded-first-bridge-v1",{field:"plan_id"},{field:"plan_sha256"},{field:"commit_nonce"},{field:"boot_id"},{field:"wlan_mac"},{field:"co2_type"},{field:"root_device"},{field:"root_inode"},{field:"stock_pid"},{field:"stock_start"},{field:"watchdog_pid"},{field:"watchdog_start"},{field:"ram_job_id"},{field:"ram_device"},{field:"ram_inode"},{field:"guardian_job_id"},{field:"guardian_device"},{field:"guardian_inode"},{field:"guardian_bytes"},{field:"guardian_sha256"},{field:"nonce"},{field:"staged_0_bytes"},{field:"staged_0_sha256"},{field:"staged_1_bytes"},{field:"staged_1_sha256"},{field:"staged_2_bytes"},{field:"staged_2_sha256"},{field:"staged_3_bytes"},{field:"staged_3_sha256"},{field:"staged_4_bytes"},{field:"staged_4_sha256"},{field:"staged_5_bytes"},{field:"staged_5_sha256"},{field:"staged_6_bytes"},{field:"staged_6_sha256"},{field:"staged_7_bytes"},{field:"staged_7_sha256"},{field:"staged_8_bytes"},{field:"staged_8_sha256"}]};var te=()=>{throw{code:"usb_browser_scope_unverified"}},Ks=t=>t&&typeof t=="object"&&!Array.isArray(t)?Object.keys(t).sort().join():null;function Qs(t,e,s){try{[t,e,s]=JSON.parse(JSON.stringify([t,e,s]))}catch{te()}re(t,e);let i=["kind","precreated","uploaded","preparation","transport_closed","guardian_started","image_fd_admitted","execution_authority","context_only"];(Ks(s)!==i.sort().join()||s.kind!=="browser_initial_ram_ready"||s.context_only!==!0||["transport_closed","guardian_started","image_fd_admitted","execution_authority"].some(l=>s[l]!==!1)||O.schema_version!==1||O.source_commit!==D.source_commit||O.frame.length!==40||Object.entries(O.source_sha256).some(([l,_])=>D.source_sha256[l]!==_))&&te(),He(s.preparation,t.context.meta,t.context.committed_scope),ht(s.precreated,t,!1),ht(s.uploaded,t,!0,s.precreated);let a=e.scope,n=t.context.meta,r=t.context.guardian,o=s.uploaded,d={plan_id:a.plan_id,plan_sha256:a.plan_sha256,commit_nonce:n.commit_nonce,boot_id:n.target.boot_id,wlan_mac:n.target.wlan_mac,co2_type:String(n.target.co2_type),root_device:String(a.root_identity[0]),root_inode:String(a.root_identity[1]),stock_pid:String(a.stock_process[0]),stock_start:String(a.stock_process[1]),watchdog_pid:String(a.watchdog_process[0]),watchdog_start:String(a.watchdog_process[1]),ram_job_id:t.ram_job_id,ram_device:String(o.ram_root_identity[0]),ram_inode:String(o.ram_root_identity[1]),guardian_job_id:t.guardian_job_id,guardian_device:String(o.guardian_root_identity[0]),guardian_inode:String(o.guardian_root_identity[1]),guardian_bytes:String(r.size),guardian_sha256:r.sha256,nonce:t.nonce};O.staged_roles.forEach((l,_)=>{let u=n.descriptor.files[l];u||te(),d[`staged_${_}_bytes`]=String(u.size),d[`staged_${_}_sha256`]=u.sha256});let c=O.frame.map(l=>typeof l=="string"?l:((Ks(l)!=="field"||typeof d[l.field]!="string")&&te(),d[l.field]));return(c[0]!=="--bounded-first-bridge-v1"||c.length!==40||c.some(l=>!/^[a-zA-Z0-9:_-]{1,128}$/.test(l)))&&te(),Object.freeze(c)}function Mi(t,e,s){try{[t,e,s]=JSON.parse(JSON.stringify([t,e,s]))}catch{te()}let i=Qs(t,e,s),a={};O.frame.forEach((r,o)=>{typeof r!="string"&&(a[r.field]=i[o])}),a.guardian_file_inode=String(s.uploaded.guardian_file_identity[1]),(!Array.isArray(O.vendor_paths)||e.scope.vendor_hashes.length!==O.vendor_paths.length)&&te(),e.scope.vendor_hashes.forEach(([r,o],d)=>{(r!==O.vendor_paths[d]||typeof o!="string"||!/^[a-f0-9]{64}$/.test(o))&&te(),a["vendor_"+d]=o}),Array.isArray(O.launch_template)||te();let n=O.launch_template.map(r=>typeof r=="string"?r:((Ks(r)!=="field"||typeof a[r.field]!="string")&&te(),a[r.field])).join("");return(n.length>32768||n.endsWith(`
`)||/[^\x01-\x7f]/.test(n)||n.includes("CGS1_ABI_FIELD_")||!n.startsWith(`set -eu
umask 077
`)||!n.endsWith("exec /tmp/qingping-initial-guardian-"+t.guardian_job_id+"/program "+i.join(" ")))&&te(),n}var oe=()=>{throw{code:"usb_browser_scope_unverified"}};function Zs(t,e,s){(typeof t!="string"||!/^(0|[1-9][0-9]*)$/.test(t)||t.length>20)&&oe();let i=BigInt(t);return(i<e||i>s)&&oe(),t}var Ot=t=>Zs(t,1n,(1n<<64n)-1n),Xs=t=>Number(Zs(t,2n,2147483647n));function Fi(t){return(!Array.isArray(t)||t.length!==2||!Number.isInteger(t[0])||t[0]<2||t[0]>2147483647)&&oe(),Ot(t[1]),t}function Ke(t,e,s=null){(typeof t!="string"||t.length>512||/[^\x01-\x7f]/.test(t)||typeof e!="string"||!/^[a-f0-9]{32}$/.test(e))&&oe(),t.endsWith(`\r
`)?t=t.slice(0,-2):t.endsWith(`
`)?t=t.slice(0,-1):oe();let i=t.split(" ");if((i.some(d=>!d.length)||i[1]!==e)&&oe(),i[0]===O.markers.start||i[0]===O.markers.child){(i.length!==4||i[0]===O.markers.start&&s!==null)&&oe();let d=Object.freeze([Xs(i[2]),Ot(i[3])]);return s!==null&&Fi(s)[0]===d[0]&&oe(),Object.freeze({kind:i[0]===O.markers.start?"start":"child",nonce:e,stamp:d})}(i[0]!==O.markers.end||i.length!==12||s===null)&&oe();let a=Object.freeze([Xs(i[2]),Ot(i[3])]),n=Object.freeze([Xs(i[4]),Ot(i[5])]),r=Fi(s);(a[0]!==r[0]||a[1]!==r[1]||a[0]===n[0]||i.slice(7,11).join(" ")!=="1 1 1 0"||!["0","15"].includes(i[11]))&&oe();let o=Number(Zs(i[6],60000n,71000n));return Object.freeze({kind:"end",nonce:e,guardian:a,child:n,elapsed_ms:o,reaped:!0,protection_ack:!0,term_sent:!0,forced:!1,wait_status:Number(i[11])})}var N=()=>{throw{code:"usb_browser_scope_unverified"}},Mn=new TextEncoder;function Gi(){let t,e,s=new Promise((i,a)=>{t=i,e=a});return s.catch(()=>{}),{promise:s,resolve:t,reject:e}}var Wi=be,Bt=class{#e;#t=!1;#s=!1;#i=!1;#a=!1;#r=!1;#d;#c;#o=new Set;#u;#n;#_;#p;#b;#h;#f;#l;#v;constructor(e){(!e||Object.keys(e).sort().join()!==["open","live","closeTransport"].sort().join()||Object.values(e).some(s=>typeof s!="function"))&&N(),this.#e=Object.freeze({...e})}#m(){(this.#r||this.#e.live()!==!0||Date.now()>=this.#u)&&N()}async#g(e,s=this.#u){this.#m();let i,a;try{let n=await Promise.race([Promise.resolve().then(e),new Promise((r,o)=>{a=o,this.#o.add(o),i=setTimeout(()=>{this.close().catch(()=>{}),o({code:"usb_browser_scope_unverified"})},Math.max(0,s-Date.now()))})]);return this.#m(),n}finally{clearTimeout(i),this.#o.delete(a)}}async#y(e){if(e)return e.cleanup||(e.cleanup=(async()=>{let s=!1,i=async a=>{let n;try{await Promise.race([Promise.resolve().then(a),new Promise((r,o)=>{n=setTimeout(()=>o({}),2e3)})])}finally{clearTimeout(n)}};try{await i(()=>e.socket.close())}catch{s=!0}if(e.reader){try{await i(()=>e.reader.cancel()),e.reader.releaseLock()}catch{s=!0}e.reader=void 0}if(e.writer){try{e.writer.releaseLock()}catch{s=!0}e.writer=void 0}s&&N()})()),e.cleanup}async#S(e,s,i){let a="",n=0,r=0;for(;;){let{value:o,done:d}=await this.#g(()=>e.reader.read());if(d)break;for((!(o instanceof Uint8Array)||!o.length||o.some(c=>c===0||c>127)||(r+=o.length)>4096)&&N(),a+=new TextDecoder().decode(o);a.includes(`
`);){let c=a.indexOf(`
`),l=a.slice(0,c+1);a=a.slice(c+1),n===0?(this.#h=Ke(l,s),(this.#h.kind!=="start"||this.#v.has(this.#h.stamp[0]))&&N()):n===1?(this.#f=Ke(l,s,this.#h.stamp),(this.#f.kind!=="child"||this.#v.has(this.#f.stamp[0]))&&N(),this.#_.resolve()):n===2?(this.#l=Ke(l,s,this.#h.stamp),(this.#l.kind!=="end"||this.#l.child[0]!==this.#f.stamp[0]||this.#l.child[1]!==this.#f.stamp[1])&&N()):n===3?l!==`
`&&l!==`\r
`&&N():n===4?l!==i+`
`&&l!==i+`\r
`&&N():N(),n++}a.length>512&&N()}return(a||n!==5||!this.#l)&&N(),await this.#g(()=>e.socket.closed),await this.#g(()=>this.#p.promise),await this.#y(e),this.#m(),clearTimeout(this.#n),{kind:"browser_initial_guardian_records",start:this.#h,child:this.#f,end:this.#l,raw_closed:!0,transport_closed:!1,records_only:!0}}async start(e,s,i){(this.#t||this.#s||this.#r)&&(await this.close().catch(()=>{}),N()),this.#t=!0,this.#s=!0,this.#u=Date.now()+11e4,this.#n=setTimeout(()=>{this.close().catch(()=>{})},11e4),this.#_=Gi(),this.#p=Gi();try{let a,n,r;try{[a,n,r]=JSON.parse(JSON.stringify([e,s,i]))}catch{N()}let o=Mn.encode(Mi(a,n,r));this.#v=new Set([n.scope.stock_process[0],n.scope.watchdog_process[0]]);let d=Array.from(new Uint8Array(await this.#g(()=>crypto.subtle.digest("SHA-256",o))),f=>f.toString(16).padStart(2,"0")).join(""),c="__CGS1_FIXED_OK_"+crypto.randomUUID().replaceAll("-","")+"__",l=Object.freeze({size:o.length,sha256:d,marker:c}),_=be(l),u=await this.#g(async()=>{let f=await this.#e.open(l);try{this.#m()}catch{await this.#y({socket:f}).catch(()=>{}),N()}return f},Date.now()+5e3),h=this.#c={socket:u};(!u||![_,_+"\0"].includes(u.service)||typeof u.closed?.then!="function"||typeof u.readable?.getReader!="function"||typeof u.writable?.getWriter!="function")&&N(),h.reader=u.readable.getReader(),h.writer=u.writable.getWriter(),this.#b=this.#S(h,a.nonce,c).catch(async()=>{await this.close().catch(()=>{}),N()}),this.#b.catch(()=>{});let p=async()=>{try{for(let f=0;f<o.length;f+=4096)await this.#g(()=>h.writer.write(o.slice(f,f+4096)));this.#p.resolve()}catch(f){throw this.#p.reject(f),f}};return await this.#g(()=>Promise.all([p(),this.#_.promise]),Date.now()+3e4),this.#m(),this.#i=!0,{kind:"browser_initial_guardian_started_record",start:this.#h,child:this.#f,records_only:!0}}catch{await this.close().catch(()=>{}),N()}finally{this.#s=!1}}async finish(){(!this.#i||this.#a||this.#s||this.#r)&&(await this.close().catch(()=>{}),N()),this.#a=!0,this.#s=!0;try{let e=await this.#g(()=>this.#b);return this.#m(),e}catch{await this.close().catch(()=>{}),N()}finally{this.#s=!1}}close(){if(this.#d)return this.#d;this.#r=!0,clearTimeout(this.#n),this.#_?.reject({code:"usb_browser_scope_unverified"}),this.#p?.reject({code:"usb_browser_scope_unverified"});for(let e of this.#o)e({code:"usb_browser_scope_unverified"});return this.#d=(async()=>{let e=!1;try{await this.#y(this.#c)}catch{e=!0}let s;try{await Promise.race([Promise.resolve().then(()=>this.#e.closeTransport()),new Promise((i,a)=>{s=setTimeout(()=>a({}),2e3)})])}catch{e=!0}finally{clearTimeout(s)}e&&N()})(),this.#d}};var Se={schema_version:1,source_commit:"53d97b9609e8e0fcdfc5d003101f620098dbc734",source_sha256:{"trial_initial_bridge_adb.py":"4f29bb503dd2d792a42aa2a642505edd2ccf84a3eb35ae7a8964b39006aaf032","review_disabled_install.py":"174d4e23e1aaf4c386ab7afcf280a7b99b169ca877130ad1f556295a28850d1a","stage_install_adb.py":"7546caa212b3b44b1a3d8717e550b7bfd5f0893a342c80c6e847cfd2be56b8eb"},reads:[{key:"child_before",parts:[`count=0
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
done`]}]};var A=()=>{throw{code:"usb_browser_scope_unverified"}},Ys=["child_before","guardian_process_before","guardian_file","guardian_image","guardian_process_after","child_process_before","child_file","child_image","child_process_after","endpoint","child_after"],qt=t=>t&&typeof t=="object"&&!Array.isArray(t)?Object.keys(t).sort().join():null,Qi=t=>{try{return JSON.parse(JSON.stringify(t))}catch{A()}},Hi=(t,e)=>t.length===e.length&&t.every((s,i)=>s===e[i]);function Qe(t,e=1n,s=(1n<<64n)-1n){(typeof t!="string"||!/^(0|[1-9][0-9]*)$/.test(t)||t.length>20)&&A();let i=BigInt(t);return(i<e||i>s)&&A(),t}function Xi(t,e,s){Qs(t,e?.preparation,e),(qt(s)!==["kind","start","child","records_only"].sort().join()||s.kind!=="browser_initial_guardian_started_record"||s.records_only!==!0)&&A();for(let a of["start","child"]){let n=s[a];(qt(n)!==["kind","nonce","stamp"].sort().join()||n.kind!==a||n.nonce!==t.nonce||!Array.isArray(n.stamp)||n.stamp.length!==2||!Number.isInteger(n.stamp[0])||typeof n.stamp[1]!="string")&&A();let r=`CGS1_TRIAL_${a.toUpperCase()}_V1 ${t.nonce} ${n.stamp[0]} ${n.stamp[1]}
`;Ke(r,t.nonce,a==="child"?s.start.stamp:null)}let i=new Set([t.context.committed_scope.stock_process[0],t.context.committed_scope.watchdog_process[0]]);(i.has(s.start.stamp[0])||i.has(s.child.stamp[0]))&&A(),(Se.schema_version!==1||Se.source_commit!==D.source_commit||Object.entries(Se.source_sha256).some(([a,n])=>D.source_sha256[a]!==n)||Se.reads.length!==Ys.length||Se.reads.some((a,n)=>a.key!==Ys[n]))&&A()}function Zi(t,e,s){let[i,a,n]=Qi([t,e,s]);Xi(i,a,n);let r={guardian_pid:String(n.start.stamp[0]),child_pid:String(n.child.stamp[0]),guardian_job_id:i.guardian_job_id},o=Object.fromEntries(Se.reads.map(({key:d,parts:c})=>[d,c.map(l=>typeof l=="string"?l:((qt(l)!=="field"||typeof r[l.field]!="string")&&A(),r[l.field])).join("")]));return Object.values(o).some(d=>d.length>8192||/[^\x01-\x7f]/.test(d))&&A(),Object.freeze(o)}function _t(t){(typeof t!="string"||!t.length||t.length>65536||/[^\x01-\x7f]/.test(t))&&A(),t.endsWith(`\r
`)?t=t.slice(0,-2):t.endsWith(`
`)&&(t=t.slice(0,-1));let e=t.split(/\r?\n/);return e.some(s=>!s.length||s.includes("\r"))&&A(),e}function Ut(t,e,s,i=null){let a=_t(t);(a.length!==3||a[1]!=="0"||a[2]!==s)&&A();let n=a[0],r=n.indexOf("("),o=n.lastIndexOf(") ");(r<1||o<=r||n.slice(0,r)!==String(e[0])+" ")&&A();let d=n.slice(o+2).split(" ");(d.length<20||d.length>128||!/^[RSDI]$/.test(d[0]))&&A();let c=Number(Qe(d[1],1n,2147483647n)),l=Qe(d[19]);return(l!==e[1]||i!==null&&c!==i)&&A(),[e[0],c,l]}function Vi(t,e){let s=_t(t);s.length!==1&&A();let i=s[0].split(" ");(i.length!==3||!/^[RSDI]$/.test(i[2])||Number(Qe(i[0],2n,2147483647n))!==e[0]||Qe(i[1])!==e[1])&&A()}function Ji(t,e,s){t!==e+" "+s&&t!==e+"  "+s&&A()}function Ki(t,e,s,i,a,n,r=null){let o=_t(t[e+"_file"]);(o.length!==2||o[0]!==a.size+" 1")&&A(),Ji(o[1],a.sha256,i);let d=_t(t[e+"_image"]);(d.length!==3||d[0]!==d[1])&&A();let c=d[0].split(" ");return(c.length!==6||c.slice(2).join(" ")!==a.size+" 700 0 1"||Qe(c[0])!==String(n))&&A(),Qe(c[1]),r!==null&&c[1]!==String(r)&&A(),Ji(d[2],a.sha256,"/proc/"+s[0]+"/exe"),Object.freeze(c.slice(0,2))}function Yi(t,e,s,i){let[a,n,r,o]=Qi([t,e,s,i]);Xi(a,n,r),qt(o)!==[...Ys].sort().join()&&A();let d=r.start.stamp,c=r.child.stamp,l="/tmp/qingping-initial-guardian-"+a.guardian_job_id+"/program",_="/data/.esphome-cgs1/program";Vi(o.child_before,c);let u=Ut(o.guardian_process_before,d,l),h=Ut(o.child_process_before,c,_,d[0]),p=Ki(o,"guardian",d,l,a.context.guardian,...n.uploaded.guardian_file_identity),f=Ki(o,"child",c,_,a.context.meta.descriptor.files["bridge-program"],a.context.committed_scope.root_identity[0]);(!Hi(u,Ut(o.guardian_process_after,d,l))||!Hi(h,Ut(o.child_process_after,c,_,d[0])))&&A();let y=_t(o.endpoint);(y.length<2||y.length>4||new Set(y).size!==y.length||y.some(g=>!/^\/proc\/net\/tcp6? (17A5|0CA0)$/.test(g))||new Set(y.map(g=>g.split(" ")[1])).size!==2)&&A(),Vi(o.child_after,c);let v=Object.fromEntries(["job_id","plan_sha256","intent_sha256","channel_id","channel_nonce","nonce","ram_job_id","guardian_job_id"].map(g=>[g,a[g]]));return Object.freeze({kind:"browser_initial_process_observation",...v,guardian:Object.freeze(d),child:Object.freeze(c),guardian_parent:u[1],guardian_image:p,child_image:f,kernel_child_checked:!0,process_images_checked:!0,endpoint_ownership_checked:!0,image_fd_admitted:!1,execution_authority:!1,context_only:!0})}var Fn=()=>{throw{code:"usb_browser_scope_unverified"}},ea=["claim","watchdog","start"],ta=be,Xe=class{#e;#t=0;constructor(e){this.#e=new Ue(e,({meta:s,scope:i,nonce:a,phase:n})=>Pt(s,i,a,n))}ready(){return this.#e.ready()}probe(){return this.#e.probe()}async execute(e,s,i,a){return(!ea.includes(a)||ea[this.#t]!==a||!this.#e.ready())&&(await this.close().catch(()=>{}),Fn()),this.#t++,await this.#e.execute({meta:e,scope:s,nonce:i,phase:a}),{phase:a,completed:!0}}close(){return this.#e.close()}};var Ae=()=>{throw{code:"usb_browser_scope_unverified"}},Gn=["claim","watchdog","start"],sa=/^[a-f0-9]{64}$/,Wn="53d97b9609e8e0fcdfc5d003101f620098dbc734",zt=t=>t&&typeof t=="object"&&!Array.isArray(t)?Object.keys(t).sort().join():null,Dt=class{#e;#t;#s;#i;#a=!1;#r=!1;#d=!1;#c=0;#o=[];#u=[];#n=!1;#_;#p=!1;constructor(e,s,i){let a=["schema_version","job_id","plan_sha256","intent_sha256","channel_id","channel_nonce","nonce","source_commit","meta","initial_scope","producer_sha256"];(!e||zt(e)!==["scope","closeTransport"].sort().join()||Object.values(e).some(n=>typeof n!="function")||!(s instanceof Xe)||!s.ready()||zt(i)!==a.sort().join()||i.schema_version!==1||i.source_commit!==Wn||i.meta?.commit_nonce!==null||i.job_id!==i.meta?.job_id||i.plan_sha256!==i.meta?.descriptor?.plan_sha256||typeof i.intent_sha256!="string"||!sa.test(i.intent_sha256)||typeof i.channel_id!="string"||!/^[a-f0-9]{32}$/.test(i.channel_id)||typeof i.channel_nonce!="string"||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(i.channel_nonce)||zt(i.producer_sha256)!==["browser_commit.py","disabled-write-contract.json"].sort().join()||Object.values(i.producer_sha256).some(n=>typeof n!="string"||!sa.test(n))||JSON.stringify(i).length>32768)&&Ae(),Pt(i.meta,i.initial_scope,i.nonce,"claim"),this.#s=JSON.parse(JSON.stringify(i)),this.#i=me(i.initial_scope),this.#e=Object.freeze({...e}),this.#t=s}async#b(){await this.close().catch(()=>{}),Ae()}#h(e){return{...this.#s.meta,commit_nonce:e===0?null:this.#s.nonce}}async#f(e){this.#n&&Ae();let s=this.#h(e),i=await this.#e.scope(s);this.#n&&Ae(),We(s,i),me(i)!==this.#i&&Ae();for(let[a,n]of i.vendor_hashes){let r=Q.files.find(o=>o.path===a).sha256;(e>=2&&a==="/data/bin/watchdog.sh"||e===3&&a==="/data/etc/init.d/start.sh")&&(r=K.patched[a].sha256),n!==r&&Ae()}return JSON.parse(JSON.stringify(i))}async prepare(){if(this.#n||this.#a||this.#d)return this.#b();this.#a=!0,this.#d=!0;try{return await this.#f(0),this.#r=!0,{state:"commit_scope_rechecked",writer_enabled:!1}}catch{return this.#b()}finally{this.#d=!1}}async step(e){if(this.#n||!this.#r||this.#d||this.#p||Gn[this.#c]!==e)return this.#b();let s=this.#c++;this.#d=!0;try{let i=await this.#f(s),a=await this.#t.execute(this.#h(s),i,this.#s.nonce,e);(this.#n||zt(a)!==["phase","completed"].sort().join()||a.phase!==e||a.completed!==!0)&&Ae();let n=await this.#f(s+1);return this.#o.push(n),this.#u.push(e),{phase:e,completed:!0,scope:n}}catch{return this.#b()}finally{this.#d=!1}}async finish(){if(this.#n||!this.#r||this.#d||this.#p||this.#c!==3||this.#o.length!==3)return this.#b();this.#p=!0,this.#r=!1,this.#d=!0;try{this.#o[2]=await this.#f(3);let e=this.#s,s={schema_version:1,job_id:e.job_id,plan_sha256:e.plan_sha256,intent_sha256:e.intent_sha256,channel_id:e.channel_id,channel_nonce:e.channel_nonce,nonce:e.nonce,commands_acknowledged:[...this.#u],observations:this.#o,transport_closed:!0,program_started:!1,boot_flags_changed:!1};return await this.#e.closeTransport(),this.#n=!0,JSON.parse(JSON.stringify(s))}catch{return this.#b()}finally{this.#d=!1}}close(){return this.#_?this.#_:(this.#n=!0,this.#r=!1,this.#_=Promise.resolve().then(()=>this.#e.closeTransport()),this.#_)}};var b=t=>{throw{code:t}},Hn=/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/,Vn=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/,Jn=/^[a-f0-9]{2}(?::[a-f0-9]{2}){5}$/,Mt=class{#e;#t;#s=!1;#i=!1;#a;#r;#d;#c;#o;#u;#n;#_;#p;#b;#h=!1;#f=0;#l=!1;#v;#m=!1;#g=!1;#y=!1;#S=!1;#L;#C;#x=!1;#O=!1;#T;#I;#A;#E;#P;#D=!1;#B=!1;#U=!1;#N;#M=0;constructor(e,s){this.#e=e,this.#t=s}select(){return this.#F(!1)}selectForReview(){return this.#F(!0)}#F(e){(this.#s||this.#i)&&b("usb_selection_consumed"),this.#s=!0,this.#g=e,this.#e.manager||b("webusb_unavailable");let s;try{s=this.#e.manager.requestDevice()}catch{this.#i=!0,b("usb_selection_failed")}return this.#H(s)}async#j(e,s=1e4){this.#i&&b("usb_selection_consumed");let i=this.#_-Date.now();i<=0&&(this.close().catch(()=>{}),b("usb_read_timeout"));let a;try{return await Promise.race([e(),new Promise((n,r)=>{a=setTimeout(()=>{this.close().catch(()=>{}),r({code:"usb_read_timeout"})},Math.min(s,i))})])}finally{clearTimeout(a)}}async#w(e){let s;try{await Promise.race([Promise.resolve().then(e),new Promise((i,a)=>{s=setTimeout(()=>a({code:"usb_close_unverified"}),2e3)})])}catch{b("usb_close_unverified")}finally{clearTimeout(s)}}async#H(e){try{let s=await e;(this.#i||!s||!Hn.test(s.serial))&&b("usb_identity_invalid"),this.#a=s,this.#u=s.serial,this.#o=crypto.randomUUID(),this.#_=Date.now()+24e4,this.#p=setTimeout(()=>{this.close().catch(()=>{})},24e4),await this.#j(async()=>{let n=await s.connect();this.#i&&(await this.#w(()=>Promise.all([n.readable.cancel(),n.writable.close()])),b("usb_selection_consumed")),this.#r=n},5e3);let i=await this.#j(async()=>{let n=await this.#e.authenticate({serial:this.#u,connection:this.#r,credentialStore:this.#e.ephemeralCredentials(),initialDelayedAckBytes:0,readTimeLimit:1e4});return this.#i&&(await this.#w(()=>n.close()),b("usb_selection_consumed")),n},15e3);this.#d=this.#e.createClient(i),this.#i&&(await this.#w(()=>this.#d.close()),b("usb_selection_consumed"));let a=await this.#$();return this.#n=Object.freeze({...a}),this.#g?JSON.stringify(await this.#$())!==JSON.stringify(this.#n)&&b("usb_selection_changed"):await this.checkInitialScope(),this.evidence()}catch{await this.close(),b("usb_channel_unverified")}}async#k(e){let s="__CGS1_CHANNEL_OK_"+crypto.randomUUID().replaceAll("-","")+"__",i=await this.#j(async()=>{let d=await this.#d.createSocket(`shell:set -e
`+e+`
printf '\\n`+s+`\\n'
`);return this.#i&&(await this.#w(()=>d.close()),b("usb_selection_consumed")),d},5e3),a,n=new Uint8Array;try{for(a=i.readable.getReader();;){let{value:d,done:c}=await this.#j(()=>a.read());if(c)break;(!(d instanceof Uint8Array)||n.length+d.length>4096)&&b("usb_read_invalid");let l=new Uint8Array(n.length+d.length);l.set(n),l.set(d,n.length),n=l}}finally{a?.releaseLock(),await this.#w(()=>i.close())}n.some(d=>d===0||d>127)&&b("usb_read_invalid");let r=new TextDecoder().decode(n).replaceAll(`\r
`,`
`),o=`
`+s+`
`;return r.endsWith(o)||b("usb_read_incomplete"),r.slice(0,-o.length).trim()}async#$(){let e={};for(let s of this.#t.identity)e[s.name]=await this.#k(s.command);return(e.uid!=="0"||e.arch!=="armv7l"||e.version!=="CLEARGRASS_VERSION=4.1.8_0287"||!["2","3"].includes(e.co2_type)||!Vn.test(e.boot_id)||!Jn.test(e.wlan_mac)||e.wlan_mac==="00:00:00:00:00:00"||parseInt(e.wlan_mac.slice(0,2),16)&1)&&b("usb_identity_invalid"),e}evidence(){return(this.#i||!this.#n||!this.#d||this.#a.serial!==this.#u||Date.now()>=this.#_)&&b("usb_channel_unverified"),Object.freeze({kind:"browser_webusb",channel:this.#o,serial:this.#u,wlan_mac:this.#n.wlan_mac,boot_id:this.#n.boot_id,co2_type:Number(this.#n.co2_type),stock_version:"4.1.8_0287",native_get_devpath:!1})}async checkInitialScope(){(this.#x||this.#y)&&b("usb_busy"),(this.#x||this.#l||this.#b||this.#h||this.#m||this.#S)&&b("usb_busy"),this.#l=!0;try{this.evidence();let e=await this.#$();JSON.stringify(e)!==JSON.stringify(this.#n)&&b("usb_selection_changed");for(let i of this.#t.files)ze(await this.#k(i.command),i)||b("usb_stock_unverified");await this.#k(this.#t.absent_install)!==""&&b("usb_existing_installation");let s=await this.#$();return JSON.stringify(s)!==JSON.stringify(e)&&b("usb_selection_changed"),this.evidence()}catch{await this.close(),b("usb_channel_unverified")}finally{this.#l=!1}}async checkStageScope(){let e=await this.checkInitialScope();(this.#x||this.#l||this.#b||this.#h||this.#m||this.#S)&&b("usb_busy"),this.#l=!0;try{let s=(await this.#k("stat -f -c '%t %a %S' /data")).split(/\s+/);(s.length!==3||s[0]!=="ef53"||!/^[0-9]+$/.test(s[1])||!/^[0-9]+$/.test(s[2]))&&b("usb_channel_unverified");let i=Number(s[1]),a=Number(s[2]);return(!Number.isSafeInteger(i)||i<0||!Number.isSafeInteger(a)||a<512||a>65536||!Number.isSafeInteger(i*a))&&b("usb_channel_unverified"),JSON.stringify(await this.#$())!==JSON.stringify(this.#n)&&b("usb_selection_changed"),this.evidence(),{evidence:e,filesystem:{magic:"ef53",available_blocks:i,block_bytes:a}}}catch{await this.close(),b("usb_channel_unverified")}finally{this.#l=!1}}async checkDisabledScope(e){(this.#x||this.#l||this.#b||this.#h||this.#m||this.#S)&&b("usb_busy"),this.#l=!0;try{return await this.#q(e)}catch{await this.close().catch(()=>{}),b("usb_browser_scope_unverified")}finally{this.#l=!1}}async#q(e){let s=this.evidence(),i={kind:"browser_webusb",usb_serial:s.serial,wlan_mac:s.wlan_mac,boot_id:s.boot_id,co2_type:s.co2_type,stock_version:s.stock_version};return(!e?.target||Object.keys(e.target).sort().join()!==Object.keys(i).sort().join()||Object.keys(i).some(a=>e.target[a]!==i[a]))&&b("usb_channel_unverified"),await Ti({read:a=>this.#k(a),identity:async()=>(this.evidence(),JSON.stringify(await this.#$())===JSON.stringify(this.#n))},e)}async checkInitialTrialPreparation(e){(this.#i||this.#l||this.#b||this.#h||this.#m||this.#y||this.#O)&&b("usb_busy"),this.#l=!0;try{return await this.#z(e)}catch{await this.close().catch(()=>{}),b("usb_browser_scope_unverified")}finally{this.#l=!1}}async#z(e){return await Ri({read:s=>this.#k(s),scope:s=>this.#q(s),identity:async()=>(this.evidence(),JSON.stringify(await this.#$())===JSON.stringify(this.#n))},e)}async probeCommitStream(){(this.#x||this.#i||this.#l||this.#b||this.#h||this.#m||this.#y)&&b("usb_selection_consumed"),this.#y=!0,this.#l=!0;try{this.evidence(),JSON.stringify(await this.#$())!==JSON.stringify(this.#n)&&b("usb_selection_changed"),this.#L=new Xe({live:()=>(this.evidence(),!0),open:s=>(this.evidence(),this.#d.createSocket(ta(s))),closeTransport:()=>this.close()});let e=await this.#L.probe();return JSON.stringify(await this.#$())!==JSON.stringify(this.#n)&&b("usb_selection_changed"),this.evidence(),e}catch{await this.close().catch(()=>{}),b("usb_browser_scope_unverified")}finally{this.#l=!1}}async beginCommit(e){(this.#x||this.#i||this.#l||this.#b||this.#h||this.#m||this.#S||!this.#y||!this.#L)&&b("usb_selection_consumed"),this.#S=!0,this.#l=!0;try{let s=this.evidence(),i={kind:"browser_webusb",usb_serial:s.serial,wlan_mac:s.wlan_mac,boot_id:s.boot_id,co2_type:s.co2_type,stock_version:s.stock_version};return(e?.channel_nonce!==this.#o||!e.meta?.target||Object.keys(e.meta.target).sort().join()!==Object.keys(i).sort().join()||Object.keys(i).some(a=>e.meta.target[a]!==i[a]))&&b("usb_selection_changed"),this.#C=new Dt({scope:a=>this.#q(a),closeTransport:()=>this.close()},this.#L,e),await this.#C.prepare()}catch{await this.close().catch(()=>{}),b("usb_browser_scope_unverified")}finally{this.#l=!1}}async#G(e,...s){(this.#i||this.#l||!this.#C)&&b("usb_browser_scope_unverified"),this.#l=!0;try{return this.evidence(),await this.#C[e](...s)}catch{await this.close().catch(()=>{}),b("usb_browser_scope_unverified")}finally{this.#l=!1}}commitStep(e){return this.#G("step",e)}finishCommit(){return this.#G("finish")}async probeInitialRamStream(){(this.#i||this.#l||this.#b||this.#h||this.#m||this.#y||this.#x)&&b("usb_selection_consumed"),this.#x=!0,this.#l=!0;try{this.evidence(),JSON.stringify(await this.#$())!==JSON.stringify(this.#n)&&b("usb_selection_changed"),this.#T=new Je({live:()=>(this.evidence(),!0),open:s=>(this.evidence(),this.#d.createSocket(Oi(s))),closeTransport:()=>this.close()});let e=await this.#T.probe();return JSON.stringify(await this.#$())!==JSON.stringify(this.#n)&&b("usb_selection_changed"),this.evidence(),e}catch{await this.close().catch(()=>{}),b("usb_browser_scope_unverified")}finally{this.#l=!1}}async beginInitialRam(e){(this.#i||this.#l||this.#b||this.#h||this.#m||this.#S||this.#y||this.#O||!this.#x||!this.#T)&&b("usb_selection_consumed"),this.#O=!0,this.#l=!0;try{e=JSON.parse(JSON.stringify(e));let s=this.evidence(),i={kind:"browser_webusb",usb_serial:s.serial,wlan_mac:s.wlan_mac,boot_id:s.boot_id,co2_type:s.co2_type,stock_version:s.stock_version},a=e?.context?.meta?.target;(e?.channel_nonce!==this.#o||!a||Object.keys(a).sort().join()!==Object.keys(i).sort().join()||Object.keys(i).some(r=>a[r]!==i[r])||typeof this.#e.createSyncSocket!="function"||typeof this.#e.pushV1!="function")&&b("usb_selection_changed"),this.#I=new Rt({read:r=>this.#k(r),preparation:r=>this.#z(r),openSync:()=>this.#j(async()=>{let r=await this.#d.createSocket("sync:");this.#i&&(await this.#w(()=>r.close()),b("usb_selection_consumed"));try{return this.#e.createSyncSocket(r)}catch{throw await this.#w(()=>r.close()),Error()}},5e3),pushV1:r=>this.#e.pushV1(r)},this.#T,e);let n=await this.#I.prepare();return this.#A=e,n}catch{await this.close().catch(()=>{}),b("usb_browser_scope_unverified")}finally{this.#l=!1}}async#W(e,...s){(this.#i||this.#l||!this.#I)&&b("usb_browser_scope_unverified"),this.#l=!0;try{return this.evidence(),await this.#I[e](...s)}catch{await this.close().catch(()=>{}),b("usb_browser_scope_unverified")}finally{this.#l=!1}}initialRamAppend(e,s){return this.#W("append",e,s)}async finishInitialRam(){let e=await this.#W("finish");return this.#E=JSON.parse(JSON.stringify(e)),e}async startInitialGuardian(){(this.#i||this.#l||!this.#E||!this.#A||this.#D)&&(await this.close().catch(()=>{}),b("usb_browser_scope_unverified")),this.#D=!0,this.#l=!0;try{this.evidence();let e=await this.#z(this.#A.context.meta);this.#P=new Bt({live:()=>(this.evidence(),!0),open:i=>(this.evidence(),this.#d.createSocket(Wi(i))),closeTransport:()=>this.close()});let s=await this.#P.start(this.#A,e,this.#E);return this.evidence(),this.#N=JSON.parse(JSON.stringify(s)),this.#B=!0,s}catch{await this.close().catch(()=>{}),b("usb_browser_scope_unverified")}finally{this.#l=!1}}async finishInitialGuardian(){(this.#i||this.#l||!this.#B||this.#U)&&(await this.close().catch(()=>{}),b("usb_browser_scope_unverified")),this.#U=!0,this.#l=!0;try{this.evidence();let e=await this.#P.finish();return this.evidence(),e}catch{await this.close().catch(()=>{}),b("usb_browser_scope_unverified")}finally{this.#l=!1}}async observeInitialGuardianProcesses(){(this.#i||this.#l||!this.#B||this.#U||this.#M>=32)&&(await this.close().catch(()=>{}),b("usb_browser_scope_unverified")),this.#M++,this.#l=!0;try{this.evidence();let e=Zi(this.#A,this.#E,this.#N),s={};for(let[i,a]of Object.entries(e))this.evidence(),s[i]=await this.#k(a);return this.evidence(),Yi(this.#A,this.#E,this.#N,s)}catch{await this.close().catch(()=>{}),b("usb_browser_scope_unverified")}finally{this.#l=!1}}async beginStage(e,s){(this.#x||this.#i||this.#l||this.#b||this.#h||this.#m||this.#S||this.#y)&&b("usb_selection_consumed"),this.#m=!0;try{let i=this.evidence(),a={kind:"browser_webusb",usb_serial:i.serial,wlan_mac:i.wlan_mac,boot_id:i.boot_id,co2_type:i.co2_type,stock_version:i.stock_version};(!e?.target||Object.keys(e.target).sort().join()!==Object.keys(a).sort().join()||Object.keys(a).some(o=>e.target[o]!==a[o])||!s||Object.keys(s).sort().join()!==this.#t.files.map(o=>o.path).sort().join()||this.#t.files.some(o=>s[o.path]?.size!==o.size||s[o.path]?.sha256!==o.sha256)||typeof this.#e.createSyncSocket!="function"||typeof this.#e.pushV1!="function")&&b("usb_channel_unverified");let n=async()=>(this.evidence(),JSON.stringify(await this.#$())===JSON.stringify(this.#n)),r=async()=>{for(let o of this.#t.files)if(!ze(await this.#k(o.command),o))return!1;return!0};return this.#v=new Tt({read:o=>this.#k(o),identity:n,inventory:r,initial:async(o,d)=>{if(!await n()||!await r()||await this.#k(this.#t.absent_install)!=="")return!1;let c=(await this.#k("stat -f -c '%t %a %S' /data")).split(/\s+/);if(c.length!==3||c[0]!=="ef53"||!/^[0-9]+$/.test(c[1])||!/^[0-9]+$/.test(c[2]))return!1;let l=Number(c[1]),_=Number(c[2]);return Number.isSafeInteger(l)&&l>=0&&Number.isSafeInteger(_)&&_>=512&&_<=65536&&Number.isSafeInteger(l*_)&&l*_>=d&&await n()},openSync:()=>this.#j(async()=>{let o=await this.#d.createSocket("sync:");this.#i&&(await this.#w(()=>o.close()),b("usb_selection_consumed"));try{return this.#e.createSyncSocket(o)}catch{throw await this.#w(()=>o.close()),Error()}},5e3),pushV1:o=>this.#e.pushV1(o),closeTransport:()=>this.close()},e,s),await this.#v.prepare()}catch{await this.close().catch(()=>{}),b("usb_browser_stage_unverified")}}async#R(e,...s){(this.#i||!this.#v)&&b("usb_browser_stage_unverified");try{return this.evidence(),await this.#v[e](...s)}catch{await this.close().catch(()=>{}),b("usb_browser_stage_unverified")}}stageBeginFile(e){return this.#R("begin",e)}stageAppend(e,s,i){return this.#R("append",e,s,i)}stageFinishFile(e){return this.#R("finishFile",e)}finishStage(){return this.#R("finish")}async openApi(){(this.#x||this.#l||this.#m||this.#y||this.#h||this.#i||this.#f>=16)&&b("usb_selection_consumed"),this.#h=!0,this.#f++;try{this.evidence();let e=await this.#$();JSON.stringify(e)!==JSON.stringify(this.#n)&&b("usb_selection_changed");let s=await this.#j(async()=>{let i=await this.#d.createSocket("tcp:6053");return this.#i&&(await this.#w(()=>i.close()),b("usb_selection_consumed")),i},5e3);return this.#b=s,s}catch{await this.close(),b("usb_channel_unverified")}}async closeApi(){(!this.#b||this.#i||this.#l)&&b("usb_channel_unverified");let e=this.#b;this.#b=void 0;try{await this.#w(()=>e.close()),this.#i&&b("usb_selection_consumed"),this.#h=!1}catch{await this.close(),b("usb_close_unverified")}}close(){if(this.#c)return this.#c;this.#i=!0,clearTimeout(this.#p),this.#p=void 0;let e=this.#d,s=this.#r,i=this.#b;this.#d=this.#r=this.#b=void 0,this.#c=(async()=>{let l=!1;if(i)try{await this.#w(()=>i.close())}catch{l=!0}if(e)try{await this.#w(()=>e.close())}catch{l=!0}else if(s)try{await this.#w(async()=>{(await Promise.allSettled([s.readable.cancel(),s.writable.close()])).some(u=>u.status==="rejected")&&b("usb_close_unverified")})}catch{l=!0}l&&b("usb_close_unverified")})();let a=this.#v;a&&this.#c.finally(()=>a.close()).catch(()=>{});let n=this.#C,r=this.#L;(n||r)&&this.#c.finally(()=>Promise.all([n?.close(),r?.close()])).catch(()=>{});let o=this.#I,d=this.#T;(o||d)&&this.#c.finally(()=>Promise.all([o?.close(),d?.close()])).catch(()=>{});let c=this.#P;return this.#A=this.#E=this.#N=void 0,c&&this.#c.finally(()=>c.close()).catch(()=>{}),this.#c}};var w=()=>{throw{code:"usb_channel_unverified"}};async function ei(t){let e;try{return await Promise.race([Promise.resolve().then(t),new Promise((s,i)=>{e=setTimeout(()=>i({code:"usb_close_unverified"}),2e3)})])}finally{clearTimeout(e)}}function ti(t){(typeof t!="string"||t.length>4*Math.ceil(65536/3))&&w();let e;try{e=Uint8Array.from(atob(t),s=>s.charCodeAt(0))}catch{w()}return(e.length>65536||btoa(String.fromCharCode(...e))!==t)&&w(),e}function Kn(t){return btoa(String.fromCharCode(...t))}var Ft=class{#e;#t=new Set;#s;#i;#a;#r=new Uint8Array;#d=!1;#c=!1;#o=!1;#u;#n=!1;#_=!1;#p=!1;#b=!1;#h=!1;#f=!1;#l=!1;#v=!1;#m=!1;#g=!1;constructor(e){this.#e=e}async dispatch(e){(this.#f||!e||Object.keys(e).sort().join()!==["id","operation","data"].sort().join()||typeof e.id!="string"||!/^[a-f0-9]{32}$/.test(e.id)||this.#t.has(e.id)||this.#t.size>=2048)&&(await this.close(),w()),this.#t.add(e.id);let s=null;try{if(this.#n&&e.operation!=="channel-close"&&w(),this.#d&&!["stage-file-begin","stage-chunk","stage-file-finish","stage-complete","channel-close"].includes(e.operation)&&w(),this.#o&&!["ram-chunk","ram-complete","guardian-start","guardian-finish","guardian-process-observe","channel-close"].includes(e.operation)&&w(),this.#v&&!["guardian-finish","guardian-process-observe","channel-close"].includes(e.operation)&&w(),this.#c&&!["commit-step","commit-complete","channel-close"].includes(e.operation)&&w(),["scope-check","stage-admission"].includes(e.operation)&&e.data===null){(this.#_||this.#s||this.#h)&&w(),this.#n=!0;try{s=await(e.operation==="scope-check"?this.#e.checkInitialScope():this.#e.checkStageScope())}finally{this.#n=!1}}else if(e.operation==="disabled-scope"){(this.#_||this.#s||this.#h||!e.data||Object.keys(e.data).join()!=="meta")&&w(),this.#n=!0;try{s=await this.#e.checkDisabledScope(e.data.meta)}finally{this.#n=!1}}else if(e.operation==="initial-trial-preparation"){(this.#_||this.#s||this.#h||!e.data||Object.keys(e.data).join()!=="meta")&&w(),this.#n=!0;try{s=await this.#e.checkInitialTrialPreparation(e.data.meta)}finally{this.#n=!1}}else if(e.operation==="ram-stream-check"){(e.data!==null||this.#_||this.#s||this.#h)&&w(),this.#n=!0;try{s=await this.#e.probeInitialRamStream()}finally{this.#n=!1}}else if(e.operation==="ram-prepare"){(this.#_||this.#s||this.#h||!e.data||Object.keys(e.data).join()!=="packet")&&w(),this.#o=!0,this.#n=!0;try{s=await this.#e.beginInitialRam(e.data.packet)}finally{this.#n=!1}}else if(e.operation==="ram-chunk"||e.operation==="ram-complete"){(!this.#o||this.#_||this.#s||this.#h)&&w(),this.#n=!0;try{if(e.operation==="ram-complete")(e.data!==null||this.#l)&&w(),s=await this.#e.finishInitialRam(),this.#l=!0;else{(!e.data||Object.keys(e.data).sort().join()!==["offset","body"].sort().join()||!Number.isInteger(e.data.offset)||e.data.offset<0)&&w();let i=ti(e.data.body);i.length||w(),s=await this.#e.initialRamAppend(e.data.offset,i)}}finally{this.#n=!1}}else if(["guardian-start","guardian-finish","guardian-process-observe"].includes(e.operation)){(e.data!==null||!this.#l||this.#_||this.#s||this.#h)&&w(),this.#n=!0;try{e.operation==="guardian-start"?(this.#v&&w(),this.#v=!0,s=await this.#e.startInitialGuardian(),this.#m=!0):e.operation==="guardian-finish"?((!this.#m||this.#g)&&w(),this.#g=!0,s=await this.#e.finishInitialGuardian()):((!this.#m||this.#g)&&w(),s=await this.#e.observeInitialGuardianProcesses())}finally{this.#n=!1}}else if(e.operation==="commit-stream-check"){(e.data!==null||this.#_||this.#s||this.#h)&&w(),this.#n=!0;try{s=await this.#e.probeCommitStream()}finally{this.#n=!1}}else if(e.operation==="commit-prepare"){(this.#_||this.#s||this.#h||!e.data||Object.keys(e.data).join()!=="packet")&&w(),this.#c=!0,this.#n=!0;try{s=await this.#e.beginCommit(e.data.packet)}finally{this.#n=!1}}else if(e.operation==="commit-step"||e.operation==="commit-complete"){(!this.#c||this.#_||this.#s||this.#h)&&w(),this.#n=!0;try{e.operation==="commit-step"?((!e.data||Object.keys(e.data).join()!=="phase"||!["claim","watchdog","start"].includes(e.data.phase))&&w(),s=await this.#e.commitStep(e.data.phase)):(e.data!==null&&w(),s=await this.#e.finishCommit())}finally{this.#n=!1}}else if(e.operation==="stage-prepare"){(this.#_||this.#s||this.#h||!e.data||Object.keys(e.data).sort().join()!==["packet","stock_files"].sort().join())&&w(),this.#d=!0,this.#n=!0;try{s=await this.#e.beginStage(e.data.packet,e.data.stock_files)}finally{this.#n=!1}}else if(["stage-file-begin","stage-chunk","stage-file-finish","stage-complete"].includes(e.operation)){(!this.#d||this.#_||this.#s||this.#h)&&w(),this.#n=!0;try{if(e.operation==="stage-complete")e.data!==null&&w(),s=await this.#e.finishStage();else{let i=e.operation==="stage-chunk"?["role","offset","body"]:["role"];if((!e.data||Object.keys(e.data).sort().join()!==i.sort().join()||typeof e.data.role!="string")&&w(),e.operation==="stage-chunk"){let a=ti(e.data.body);(!a.length||!Number.isInteger(e.data.offset)||e.data.offset<0)&&w(),s=await this.#e.stageAppend(e.data.role,e.data.offset,a)}else s=await this.#e[e.operation==="stage-file-begin"?"stageBeginFile":"stageFinishFile"](e.data.role)}}finally{this.#n=!1}}else if(e.operation==="api-open"&&e.data===null){(this.#_||this.#s||this.#h)&&w(),this.#_=!0;try{this.#s=await this.#e.openApi(),this.#i=this.#s.readable.getReader(),this.#a=this.#s.writable.getWriter()}finally{this.#_=!1}}else if(e.operation==="api-read"){(!this.#i||this.#p||this.#h||!e.data||Object.keys(e.data).join()!=="max_bytes"||!Number.isInteger(e.data.max_bytes)||e.data.max_bytes<1||e.data.max_bytes>65536)&&w(),this.#p=!0;try{if(!this.#r.length){let{value:a,done:n}=await this.#i.read();n||((!(a instanceof Uint8Array)||!a.length||a.length>1048576)&&w(),this.#r=a)}let i=Math.min(e.data.max_bytes,this.#r.length);s=Kn(this.#r.slice(0,i)),this.#r=this.#r.slice(i)}finally{this.#p=!1}}else if(e.operation==="api-write"){(!this.#a||this.#b||this.#h)&&w();let i=ti(e.data);i.length||w(),this.#b=!0;try{await this.#a.write(i)}finally{this.#b=!1}}else if(e.operation==="api-close"&&e.data===null){(!this.#s||this.#_||this.#b||this.#h)&&w(),this.#h=!0;try{await ei(()=>this.#i.cancel()),this.#i.releaseLock(),this.#i=void 0,this.#a.releaseLock(),this.#a=void 0,await this.#e.closeApi(),this.#s=void 0,this.#r=new Uint8Array}finally{this.#h=!1}}else e.operation==="channel-close"&&e.data===null?await this.close():w();return{id:e.id,ok:!0,data:s}}catch{return await this.close().catch(()=>{}),{id:e.id,ok:!1,data:null}}}close(){return this.#u?this.#u:(this.#f=!0,this.#u=(async()=>{try{await ei(()=>this.#e.close())}finally{if(this.#i){try{await ei(()=>this.#i.cancel()),this.#i.releaseLock()}catch{}this.#i=void 0}if(this.#a){try{this.#a.releaseLock()}catch{}this.#a=void 0}this.#s=void 0,this.#r=new Uint8Array}})(),this.#u)}};function Qn(t,e){return ia(t,e,!1)}function Xn(t,e){return ia(t,e,!0)}async function ia(t,e,s){let i,a=new Ft(t);try{let p=await(s?t.selectForReview():t.select());if(i=await e("browser/open",{evidence:p}),!i||Object.keys(i).sort().join()!==["channel_id","state","writer_enabled"].sort().join()||typeof i.channel_id!="string"||!/^[a-f0-9]{32}$/.test(i.channel_id)||i.state!=="registered"||i.writer_enabled!==!1)throw Error()}catch{throw await a.close().catch(()=>{}),{code:"usb_channel_unverified"}}let n=i.channel_id,r=new Set,o=!1,d=!1,c=!1,l;function _(){return l||(o=!0,l=(async()=>{await a.close().catch(()=>{c=!0});try{(await e("browser/close",{channel_id:n}))?.state!=="retired"&&(c=!0)}catch{c=!0}return{state:c?"unverified":"closed"}})(),l)}async function u(p){try{let f=await a.dispatch(p);if(o)return;if((await e("browser/answer",{channel_id:n,frame:f}))?.state!=="accepted"||f.ok!==!0)throw Error();p.operation==="channel-close"&&(o=!0)}catch{c=!0,await _()}}let h=(async()=>{try{for(;!o&&!d;){if(r.size>=2){await Promise.race(r);continue}let p=await e("browser/poll",{channel_id:n});if(o)break;if(!p||Object.keys(p).join()!=="request")throw Error();if(p.request!==null){p.request.operation==="channel-close"&&(d=!0);let f=u(p.request);r.add(f),f.finally(()=>r.delete(f))}}}catch{o||(c=!0)}finally{d&&!c&&await Promise.allSettled(r),await _(),await Promise.allSettled(r)}return{state:c?"unverified":"closed"}})();return Object.freeze({channel_id:n,done:h,close:_})}var $=class{#e;get promise(){return this.#e}#t;#s;#i="running";get state(){return this.#i}constructor(){this.#e=new Promise((e,s)=>{this.#t=e,this.#s=s})}resolve=e=>{this.#t(e),this.#i="resolved"};reject=e=>{this.#s(e),this.#i="rejected"}};var Gt=class{nextId;pendingResolvers=new Map;constructor(e=0){this.nextId=e}add(){let e=this.nextId++,s=new $;return this.pendingResolvers.set(e,s),[e,s.promise]}getResolver(e){if(!this.pendingResolvers.has(e))return null;let s=this.pendingResolvers.get(e);return this.pendingResolvers.delete(e),s}resolve(e,s){let i=this.getResolver(e);return i!==null?(i.resolve(s),!0):!1}reject(e,s){let i=this.getResolver(e);return i!==null?(i.reject(s),!0):!1}};function aa(t){return new Promise(e=>{globalThis.setTimeout(()=>e(),t)})}function se(t){return typeof t=="object"&&t!==null&&"then"in t}function si(t,e){for(;;){let{done:s,value:i}=t.next(e);if(s)return i;if(se(i))return i.then(a=>si(t,{resolved:a}),a=>si(t,{error:a}));e=i}}function Ze(t,e){function s(...i){let a=t.call(this,function*(n){if(se(n)){let r=yield n;if("resolved"in r)return r.resolved;throw r.error}return n},...i);return si(a,void 0)}return e?s.bind(e):s}function na(t){return(e,s)=>{if("buffer"in s){let i=t(e,s);return s.buffer.set(i,s.index),i.length}else return t(e,s)}}function ra(t,e){return(s,i)=>{if("buffer"in i)return i.index??=0,e(s,i),t;{let a=new Uint8Array(t);return e(s,{buffer:a,index:0,littleEndian:i.littleEndian}),a}}}function Zn(t,e,s,i,a){let n={size:t,type:e,serialize:e==="default"?na(s):ra(t,s),deserialize:Ze(i),omitInit:a?.omitInit};return a?.init&&(n.init=a.init),n}var je=Zn;var E=new Uint8Array(0);function Yn(t,e,s,i){e.length<i?(t.set(e,s),t.fill(0,s+e.length,s+i)):e.length===i?t.set(e,s):t.set(e.subarray(0,i),s)}function ie(t,e){if(typeof t=="number"){let a,n,r;return t===0?(a=()=>{},e?n=function*(){return e.convert(E)}:n=function*(){return E}):(a=(o,{buffer:d,index:c})=>Yn(d,o,c,t),e?(n=function*(o,d){let c=d.readExactly(t);return e.convert(yield*o(c))},r=o=>e.back(o)):n=function*(o,d){return d.readExactly(t)}),je(t,"byob",a,n,{init:r})}if((typeof t=="object"||typeof t=="function")&&"serialize"in t){let a,n;return e?(a=function*(r,o,d){let c=yield*r(t.deserialize(o,d)),l=c!==0?o.readExactly(c):E;return e.convert(yield*r(l))},n=r=>e.back(r)):a=function*(r,o,d){let c=yield*r(t.deserialize(o,d));return c!==0?o.readExactly(c):E},je(t.size,"default",(r,{littleEndian:o})=>{if(t.type==="default"){let d=t.serialize(r.length,{littleEndian:o});if(r.length===0)return d;let c=new Uint8Array(d.length+r.length);return c.set(d,0),c.set(r,d.length),c}else{let d=new Uint8Array(t.size+r.length);return t.serialize(r.length,{buffer:d,index:0,littleEndian:o}),d.set(r,t.size),d}},a,{init:n})}if(typeof t=="string"){let a,n;return e?(a=function*(r,o,{dependencies:d}){let c=d[t],l=c!==0?o.readExactly(c):E;return e.convert(yield*r(l))},n=(r,o)=>{let d=e.back(r);return o[t]=d.length,d}):(a=function*(r,o,{dependencies:d}){let c=d[t];return c!==0?o.readExactly(c):E},n=(r,o)=>{let d=r;return o[t]=d.length,d}),je(0,"default",r=>r,a,{init:n})}let s,i;return e?(s=function*(a,n,{dependencies:r}){let o=r[t.field],d=t.convert(o),c=d!==0?n.readExactly(d):E;return e.convert(yield*a(c))},i=(a,n)=>{let r=e.back(a);return n[t.field]=t.back(r.length),r}):(s=function*(a,n,{dependencies:r}){let o=r[t.field],d=t.convert(o);return d!==0?n.readExactly(d):E},i=(a,n)=>{let r=a;return n[t.field]=t.back(r.length),r}),je(0,"default",a=>a,s,{init:i})}var _e=class extends Error{constructor(){super("ExactReadable ended")}},Wt=class{#e;#t;get position(){return this.#t}constructor(e){this.#e=e,this.#t=0}readExactly(e){if(this.#t+e>this.#e.length)throw new _e;let s=this.#e.subarray(this.#t,this.#t+e);return this.#t+=e,s}};var Ht=class extends Error{constructor(e){super(e)}},ii=class extends Ht{constructor(){super("The underlying readable was ended before the struct was fully deserialized")}},Ee=class extends Ht{constructor(){super("The underlying readable doesn't contain any more struct")}};function L(t,e){let s=Object.entries(t),i=0,a=!0;for(let[,o]of s)i+=o.size,a&&o.type!=="byob"&&(a=!1);let n=e.littleEndian,r=e.extra?Object.getOwnPropertyDescriptors(e.extra):void 0;return{littleEndian:n,fields:t,extra:e.extra,type:a?"byob":"default",size:i,serialize(o,d){let c={...o};for(let[v,g]of s)if(v in c&&"init"in g){let J=g.init?.(c[v],c);c[v]=J}let l=new Array(s.length),_=new Array(s.length);{let v={littleEndian:n};for(let[g,[J,le]]of s.entries())le.type==="byob"?l[g]=le.size:(_[g]=le.serialize(c[J],v),l[g]=_[g].length)}let u=l.reduce((v,g)=>v+g,0),h,p,f;if(d instanceof Uint8Array){if(d.length<u)throw new Error("Buffer too small");h=!0,p=d,f=0}else if(typeof d=="object"&&"buffer"in d){if(h=!0,p=d.buffer,f=d.index??0,p.length-f<u)throw new Error("Buffer too small")}else h=!1,p=new Uint8Array(u),f=0;let y={buffer:p,index:f,littleEndian:n};for(let[v,[g,J]]of s.entries())_[v]?p.set(_[v],y.index):J.serialize(c[g],y),y.index+=l[v];return h?u:p},deserialize:Ze(function*(o,d){let c=d.position,l={},_={dependencies:l,littleEndian:n};try{for(let[u,h]of s)l[u]=yield*o(h.deserialize(d,_))}catch(u){throw u instanceof _e?d.position===c?new Ee:new ii:u}return r&&Object.defineProperties(l,r),e.postDeserialize?e.postDeserialize.call(l,l):l})}}function Le(t,e,s){return L(Object.assign({},t.fields,e),{littleEndian:s?.littleEndian??t.littleEndian,extra:t.extra,postDeserialize:s?.postDeserialize})}function oa(t,e,s){return s?t[e]|t[e+1]<<8|t[e+2]<<16|t[e+3]<<24:t[e]<<24|t[e+1]<<16|t[e+2]<<8|t[e+3]}function da(t,e,s,i){i?(t[e]=s,t[e+1]=s>>8,t[e+2]=s>>16,t[e+3]=s>>24):(t[e]=s>>24,t[e+1]=s>>16,t[e+2]=s>>8,t[e+3]=s)}function ca(t,e,s){t[e]=Number(s&0xffn),t[e+1]=Number(s>>8n&0xffn),t[e+2]=Number(s>>16n&0xffn),t[e+3]=Number(s>>24n&0xffn),t[e+4]=Number(s>>32n&0xffn),t[e+5]=Number(s>>40n&0xffn),t[e+6]=Number(s>>48n&0xffn),t[e+7]=Number(s>>56n&0xffn)}function la(t,e,s){t[e]=Number(s>>56n&0xffn),t[e+1]=Number(s>>48n&0xffn),t[e+2]=Number(s>>40n&0xffn),t[e+3]=Number(s>>32n&0xffn),t[e+4]=Number(s>>24n&0xffn),t[e+5]=Number(s>>16n&0xffn),t[e+6]=Number(s>>8n&0xffn),t[e+7]=Number(s&0xffn)}function Ye(t,e){return(t[e]|t[e+1]<<8|t[e+2]<<16|t[e+3]<<24)>>>0}function ua(t,e,s){return s?(t[e]|t[e+1]<<8|t[e+2]<<16|t[e+3]<<24)>>>0:(t[e]<<24|t[e+1]<<16|t[e+2]<<8|t[e+3])>>>0}function ha(t,e,s){t[e]=s,t[e+1]=s>>8,t[e+2]=s>>16,t[e+3]=s>>24}function _a(t,e,s,i){i?(t[e]=s,t[e+1]=s>>8,t[e+2]=s>>16,t[e+3]=s>>24):(t[e]=s>>24,t[e+1]=s>>16,t[e+2]=s>>8,t[e+3]=s)}function pa(t,e){return BigInt(t[e])<<56n|BigInt(t[e+1])<<48n|BigInt(t[e+2])<<40n|BigInt(t[e+3])<<32n|BigInt(t[e+4])<<24n|BigInt(t[e+5])<<16n|BigInt(t[e+6])<<8n|BigInt(t[e+7])}function ba(t,e,s){return s?BigInt(t[e])|BigInt(t[e+1])<<8n|BigInt(t[e+2])<<16n|BigInt(t[e+3])<<24n|BigInt(t[e+4])<<32n|BigInt(t[e+5])<<40n|BigInt(t[e+6])<<48n|BigInt(t[e+7])<<56n:BigInt(t[e])<<56n|BigInt(t[e+1])<<48n|BigInt(t[e+2])<<40n|BigInt(t[e+3])<<32n|BigInt(t[e+4])<<24n|BigInt(t[e+5])<<16n|BigInt(t[e+6])<<8n|BigInt(t[e+7])}function fa(t,e,s,i){i?(t[e]=Number(s&0xffn),t[e+1]=Number(s>>8n&0xffn),t[e+2]=Number(s>>16n&0xffn),t[e+3]=Number(s>>24n&0xffn),t[e+4]=Number(s>>32n&0xffn),t[e+5]=Number(s>>40n&0xffn),t[e+6]=Number(s>>48n&0xffn),t[e+7]=Number(s>>56n&0xffn)):(t[e]=Number(s>>56n&0xffn),t[e+1]=Number(s>>48n&0xffn),t[e+2]=Number(s>>40n&0xffn),t[e+3]=Number(s>>32n&0xffn),t[e+4]=Number(s>>24n&0xffn),t[e+5]=Number(s>>16n&0xffn),t[e+6]=Number(s>>8n&0xffn),t[e+7]=Number(s&0xffn))}function Vt(t,e,s){let i=(()=>i);return Object.assign(i,je(t,"byob",e,s)),i}var ma=Vt(1,(t,{buffer:e,index:s})=>{e[s]=t},function*(t,e){return(yield*t(e.readExactly(1)))[0]});var m=Vt(4,(t,{buffer:e,index:s,littleEndian:i})=>{_a(e,s,t,i)},function*(t,e,{littleEndian:s}){let i=yield*t(e.readExactly(4));return ua(i,0,s)}),va=Vt(4,(t,{buffer:e,index:s,littleEndian:i})=>{da(e,s,t,i)},function*(t,e,{littleEndian:s}){let i=yield*t(e.readExactly(4));return oa(i,0,s)}),Ce=Vt(8,(t,{buffer:e,index:s,littleEndian:i})=>{fa(e,s,t,i)},function*(t,e,{littleEndian:s}){let i=yield*t(e.readExactly(8));return ba(i,0,s)});var{TextEncoder:er,TextDecoder:tr}=globalThis,sr=new er,ir=new tr;function H(t){return sr.encode(t)}function de(t){return ir.decode(t)}var ve=(t=>{let e=ie(t,{convert:de,back:H});return e.as=()=>e,e});var{AbortController:ge}=globalThis,z=(()=>{let{ReadableStream:t}=globalThis;return t.from||(t.from=function(e){let s=Symbol.asyncIterator in e?e[Symbol.asyncIterator]():e[Symbol.iterator]();return new t({async pull(i){let a=await s.next();if(a.done){i.close();return}i.enqueue(a.value)},async cancel(i){await s.return?.(i)}})}),(!t.prototype[Symbol.asyncIterator]||!t.prototype.values)&&(t.prototype.values=async function*(e){let s=this.getReader();try{for(;;){let{done:i,value:a}=await s.read();if(i)return;yield a}}finally{e?.preventCancel||await s.cancel(),s.releaseLock()}},t.prototype[Symbol.asyncIterator]=t.prototype.values),t})(),{WritableStream:j,TransformStream:Jt}=globalThis;var Kt=class{#e;#t=!1;enqueue(e,s=!1){if(this.#t)throw new Error("TaskQueue is disposed");if(!this.#e)try{let a=e();return se(a)&&(this.#e=a.then(()=>{},n=>{if(s)throw n})),a}catch(a){if(s){let n=Promise.reject(a);n.catch(()=>{}),this.#e=n}throw a}let i=this.#e.then(()=>{if(this.#t)throw new Error("TaskQueue is disposed");return e()});return this.#e=i.then(()=>{},a=>{if(s||this.#t)throw a}),i}dispose(){this.#t=!0}};var Y=class extends z{constructor(e,s,i){let a,n=new Kt,r=!1,o,d=new ge,c=!1,l=h=>{if(i?.({source:"producer",operation:"enqueue",value:h,phase:"start"}),d.signal.aborted)return i?.({source:"producer",operation:"enqueue",value:h,phase:"ignored"}),!1;if(a.desiredSize===null)throw a.enqueue(h),new Error("unreachable");return r?(r=!1,a.enqueue(h),i?.({source:"producer",operation:"enqueue",value:h,phase:"complete"}),!0):a.desiredSize<=0?(i?.({source:"producer",operation:"enqueue",value:h,phase:"waiting"}),o=new $,o.promise.then(()=>(a.enqueue(h),i?.({source:"producer",operation:"enqueue",value:h,phase:"complete"}),!0),()=>(i?.({source:"producer",operation:"enqueue",value:h,phase:"ignored"}),!1))):(a.enqueue(h),i?.({source:"producer",operation:"enqueue",value:h,phase:"complete"}),!0)},_=h=>{if(i?.({source:"producer",operation:"close",explicit:h,phase:"start"}),d.signal.aborted||c&&!h){i?.({source:"producer",operation:"close",explicit:h,phase:"ignored"});return}a.close(),c=!0,o?.reject(),i?.({source:"producer",operation:"close",explicit:h,phase:"complete"})},u=(h,p)=>{i?.({source:"producer",operation:"error",explicit:p,phase:"start"}),c=!0,a.error(h),o?.reject(),i?.({source:"producer",operation:"error",explicit:p,phase:"complete"})};super({start:h=>{a=h;let p=e({abortSignal:d.signal,enqueue:async f=>await n.enqueue(()=>l(f)),close(){_(!0)},error(f){u(f,!0)}});!c&&se(p)&&p.then(()=>_(!1),f=>u(f,!1))},pull:()=>{i?.({source:"consumer",operation:"pull",phase:"start"}),o?(o.resolve(void 0),o=void 0):s?.highWaterMark===0&&(r=!0),i?.({source:"consumer",operation:"pull",phase:"complete"})},cancel:h=>{i?.({source:"consumer",operation:"cancel",phase:"start"}),c=!0,d.abort(h),o?.reject(),i?.({source:"consumer",operation:"cancel",phase:"complete"})}},s)}};function ga(t){try{let e=t.close();return se(e)?e.then(()=>!0,()=>!1):!0}catch{return!1}}async function wa(t){try{return await t.cancel(),!0}catch{return!1}}var ce=class{#e;#t=0;#s=0;#i=0;get position(){return this.#i}stream;reader;constructor(e){this.stream=e,this.reader=e.getReader()}#a(e){if(!this.#e)return;let s=this.#e.subarray(this.#t,this.#t+e);return this.#s>e?(this.#i+=e,this.#t+=e,this.#s-=e,s):(this.#i+=this.#s,this.#e=void 0,this.#t=0,this.#s=0,s)}async#r(e){let{done:s,value:i}=await this.reader.read();if(s)throw new _e;return i.length>e?(this.#e=i,this.#t=e,this.#s=i.length-e,this.#i+=e,i.subarray(0,e)):(this.#i+=i.length,i)}iterateExactly(e){let s=this.#e?0:1;return{next:()=>{switch(s){case 0:{let i=this.#a(e);return i.length===e?s=2:(e-=i.length,s=1),{done:!1,value:i}}case 1:return s=3,{done:!1,value:this.#r(e).then(i=>(i.length===e?s=2:(e-=i.length,s=1),i))};case 2:return{done:!0,value:void 0};case 3:throw new Error("Can't call `next` before previous Promise resolves");default:throw new Error("unreachable")}}}}readExactly=Ze(function*(e,s){let i,a=0,n=this.#a(s);if(n){if(n.length===s)return n;i=new Uint8Array(s),i.set(n,a),a+=n.length,s-=n.length}else i=new Uint8Array(s);for(;s>0;){let r=yield*e(this.#r(s));i.set(r,a),a+=r.length,s-=r.length}return i});release(){return this.#s>0?new Y(async e=>{let s=this.#e.subarray(this.#t);for(await e.enqueue(s),e.abortSignal.addEventListener("abort",()=>{wa(this.reader)});;){let{done:i,value:a}=await this.reader.read();if(i)return;await e.enqueue(a)}}):(this.reader.releaseLock(),this.stream)}async cancel(e){await this.reader.cancel(e)}};var Qt=class{#e;get readable(){return this.#e}#t;get writable(){return this.#t}constructor(e){let s,i,a=new ce(new Y(n=>{s=n}));this.#e=new z({async pull(n){try{let r=await e(a);n.enqueue(r)}catch(r){if(r instanceof Ee){n.close();return}throw r}},cancel:n=>i.error(n)}),this.#t=new j({start(n){i=n},async write(n){await s.enqueue(n)},abort(){s.close()},close(){s.close()}})}};var pe=class{#e="";#t=new $;#s=new j({write:e=>{this.#e+=e},close:()=>{this.#t.resolve(this.#e),this.#i.enqueue(this.#e),this.#i.close()},abort:e=>{this.#t.reject(e),this.#i.error(e)}});get writable(){return this.#s}#i;#a=new z({start:e=>{this.#i=e}});get readable(){return this.#a}constructor(){Object.defineProperties(this.#a,{then:{get:()=>this.#t.promise.then.bind(this.#t.promise)},catch:{get:()=>this.#t.promise.catch.bind(this.#t.promise)},finally:{get:()=>this.#t.promise.finally.bind(this.#t.promise)}})}},Te=class{#e=[];#t=new $;#s=new j({write:e=>{this.#e.push(e)},close:()=>{let e,s=0;switch(this.#e.length){case 0:e=E;break;case 1:e=this.#e[0];break;default:e=new Uint8Array(this.#e.reduce((i,a)=>i+a.length,0));for(let i of this.#e)e.set(i,s),s+=i.length;break}this.#t.resolve(e),this.#i.enqueue(e),this.#i.close()},abort:e=>{this.#t.reject(e),this.#i.error(e)}});get writable(){return this.#s}#i;#a=new z({start:e=>{this.#i=e}});get readable(){return this.#a}constructor(){Object.defineProperties(this.#a,{then:{get:()=>this.#t.promise.then.bind(this.#t.promise)},catch:{get:()=>this.#t.promise.catch.bind(this.#t.promise)},finally:{get:()=>this.#t.promise.finally.bind(this.#t.promise)}})}};var et=class t extends z{static async enqueue(e,s){let i=new C(s);e.enqueue(i),await i.consumed}constructor(e,s){let i,a;s&&(a={},"highWaterMark"in s&&(a.highWaterMark=s.highWaterMark),"size"in s&&(a.size=n=>s.size(n.value))),super({start(n){return i={enqueue(r){return t.enqueue(n,r)},close(){n.close()},error(r){n.error(r)}},e.start?.(i)},pull(){return e.pull?.(i)},cancel(n){return e.cancel?.(n)}},a)}};var Xt=class extends z{constructor(e,s,i){let a=e.getReader({mode:"byob"}),n=new Uint8Array(s);super({async pull(r){let{done:o,value:d}=await a.read(n,{min:i});if(o){r.close();return}await et.enqueue(r,d),n=new Uint8Array(d.buffer)},cancel(r){return a.cancel(r)}})}};var Zt=class extends j{constructor(e){let s=e.getWriter();super({write(i){return i.tryConsume(a=>s.write(a))},abort(i){return s.abort(i)},close(){return s.close()}})}};var Yt=class extends j{static async write(e,s){let i=new C(s);await e.write(i),await i.consumed}constructor(e,s){let i;s&&(i={},"highWaterMark"in s&&(i.highWaterMark=s.highWaterMark),"size"in s&&(i.size=a=>s.size(a instanceof C?a.value:a))),super({start(a){return e.start?.(a)},write(a,n){return a.tryConsume(r=>e.write?.(r,n))},abort(a){return e.abort?.(a)},close(){return e.close?.()}},i)}};var{console:ya}=globalThis,$a=ya?.createTask?.bind(ya)??(()=>({run(t){return t()}}));var C=class{static WritableStream=Yt;static WrapWritableStream=Zt;static ReadableStream=et;static WrapByteReadableStream=Xt;#e;#t;value;consumed;constructor(e){this.#e=$a("Consumable"),this.value=e,this.#t=new $,this.consumed=this.#t.promise}consume(){this.#t.resolve()}error(e){this.#t.reject(e)}tryConsume(e){try{let s=this.#e.run(()=>e(this.value));return se(s)?s=s.then(i=>(this.#t.resolve(),i),i=>{throw this.#t.reject(i),i}):this.#t.resolve(),s}catch(s){throw this.#t.reject(s),s}}};var F={};jn(F,{WrapWritableStream:()=>es,WritableStream:()=>ts,getValue:()=>ar,tryConsume:()=>pt});function ar(t){return t instanceof C?t.value:t}function pt(t,e){return t instanceof C?t.tryConsume(e):e(t)}var es=class extends j{constructor(e){let s=e.getWriter();super({write(i){return pt(i,a=>s.write(a))},abort(i){return s.abort(i)},close(){return s.close()}})}};var ts=class extends j{constructor(e,s){let i;s&&(i={},"highWaterMark"in s&&(i.highWaterMark=s.highWaterMark),"size"in s&&(i.size=a=>s.size(a instanceof C?a.value:a))),super({start(a){return e.start?.(a)},write(a,n){return pt(a,r=>e.write?.(r,n))},abort(a){return e.abort?.(a)},close(){return e.close?.()}},i)}};var bt=class{#e;#t;#s;#i;constructor(e){this.#e=e,this.#t=new Uint8Array(e),this.#s=0,this.#i=e}*push(e){let s=0,i=e.length;if(this.#s!==0)if(i>=this.#i){if(this.#t.set(e.subarray(0,this.#i),this.#s),s+=this.#i,i-=this.#i,yield this.#t,this.#s=0,this.#i=this.#e,i===0)return}else{this.#t.set(e,this.#s),this.#s+=i,this.#i-=i;return}for(;i>=this.#e;){let a=s+this.#e;yield e.subarray(s,a),s=a,i-=this.#e}i>0&&(this.#t.set(e.subarray(s),this.#s),this.#s+=i,this.#i-=i)}flush(){if(this.#s===0)return;let e=this.#t.subarray(0,this.#s);return this.#s=0,this.#i=this.#e,e}},ss=class extends Jt{constructor(e,s=!1){let i=s?new bt(e):void 0;super({async transform(a,n){await F.tryConsume(a,async r=>{if(i)for(let o of i.push(r))await C.ReadableStream.enqueue(n,o);else{let o=0,d=r.length;for(;d>0;){let c=o+e;await C.ReadableStream.enqueue(n,r.subarray(o,c)),o=c,d-=e}}})},flush(a){if(i){let n=i.flush();n&&a.enqueue(n)}}})}};function nr(t,e){return"start"in t?t.start(e):typeof t=="function"?t(e):t}var is=class extends z{readable;#e;constructor(e,s){super({start:async i=>{let a=await nr(e,i);this.readable=a,this.#e=this.readable.getReader()},pull:async i=>{let{done:a,value:n}=await this.#e.read().catch(r=>{throw"error"in e&&e.error(r),r});a?(i.close(),"close"in e&&await e.close?.()):i.enqueue(n)},cancel:async i=>{await this.#e.cancel(i),"cancel"in e&&await e.cancel?.(i)}},s)}};var ka=()=>{},as=class{#e=[];#t=[];#s=!1;get writableClosed(){return this.#s}#i=new $;get closed(){return this.#i.promise}#a;constructor(e){this.#a=e??{}}wrapReadable(e,s){return new is({start:i=>(this.#e.push(i),e),cancel:async()=>{await this.close()},close:async()=>{await this.dispose()}},s)}createWritable(e){let s=e.getWriter();return this.#t.push(s),new j({write:async i=>{await s.write(i)},abort:async i=>{await s.abort(i),await this.close()},close:async()=>{await s.close().catch(ka),await this.close()}})}async close(){if(!this.#s){this.#s=!0,await this.#a.close?.()!==!1&&await this.dispose();for(let e of this.#t)e.close().catch(ka)}}async dispose(){this.#s=!0,this.#i.resolve();for(let e of this.#e)ga(e);await this.#a.dispose?.()}};var xa=globalThis,Ie=xa.TextDecoderStream,Kl=xa.TextEncoderStream;function Sa(t,e){let s=e.writable.getWriter(),i=e.readable.pipeTo(t);return new j({async write(a){await s.write(a)},async close(){await s.close(),await i}})}var tt=class extends Qt{constructor(e){super(s=>e.deserialize(s))}};var ns=class{#e=[];constructor(){this.dispose=this.dispose.bind(this)}addDisposable(e){return this.#e.push(e),e}dispose(){for(let e of this.#e)e.dispose();this.#e=[]}};var Pe=class{listeners=[];constructor(){this.event=this.event.bind(this)}addEventListener(e){this.listeners.push(e);let s=()=>{let i=this.listeners.indexOf(e);i!==-1&&this.listeners.splice(i,1)};return s.dispose=s,s}event=(e,s,...i)=>{let a={listener:e,thisArg:s,args:i};return this.addEventListener(a)};fire(e){for(let s of this.listeners.slice())s.listener.call(s.thisArg,e,...s.args)}dispose(){this.listeners.length=0}};var Aa=Symbol("undefined"),rs=class extends Pe{#e=Aa;addEventListener(e){return this.#e!==Aa&&e.listener.call(e.thisArg,this.#e,...e.args),super.addEventListener(e)}fire(e){this.#e=e,super.fire(e)}};var we=class extends ns{#e;get adb(){return this.#e}constructor(e){super(),this.#e=e}};var rr=L({version:m},{littleEndian:!0}),or=L({bpp:m,size:m,width:m,height:m,red_offset:m,red_length:m,blue_offset:m,blue_length:m,green_offset:m,green_length:m,alpha_offset:m,alpha_length:m,data:ie("size")},{littleEndian:!0}),dr=L({bpp:m,colorSpace:m,size:m,width:m,height:m,red_offset:m,red_length:m,blue_offset:m,blue_length:m,green_offset:m,green_length:m,alpha_offset:m,alpha_length:m,data:ie("size")},{littleEndian:!0}),os=class extends Error{constructor(e,s){super(e,s)}},ai=class extends os{constructor(e){super(`Unsupported FrameBuffer version ${e}`)}},ni=class extends os{constructor(){super("FrameBuffer is disabled by current app")}};async function ja(t){let e=await t.createSocket("framebuffer:"),s=new ce(e.readable),i;try{({version:i}=await rr.deserialize(s))}catch(a){throw a instanceof Ee?new ni:a}switch(i){case 1:return await or.deserialize(s);case 2:return await dr.deserialize(s);default:throw new ai(i)}}var ds=class extends we{reboot(e=""){return this.adb.createSocketAndWait(`reboot:${e}`)}bootloader(){return this.reboot("bootloader")}fastboot(){return this.reboot("fastboot")}recovery(){return this.reboot("recovery")}sideload(){return this.reboot("sideload")}qualcommEdlMode(){return this.reboot("edl")}powerOff(){return this.adb.subprocess.noneProtocol.spawnWaitText(["reboot","-p"])}powerButton(e=!1){let s=["input","keyevent"];return e&&s.push("--longpress"),s.push("POWER"),this.adb.subprocess.noneProtocol.spawnWaitText(s)}samsungOdin(){return this.reboot("download")}};function Ea(t){if(t.buffer instanceof ArrayBuffer)return t;let e=new Uint8Array(t.length);return e.set(t),e}var ft=class{#e;#t=[];constructor(e=!1){this.#e=e}wait(){if(!this.#e&&(this.#e=!0,this.#t.length===0))return Promise.resolve();let e=new $;return this.#t.push(e),e.promise}notifyOne(){this.#t.length!==0?this.#t.pop().resolve():this.#e=!1}dispose(){for(let e of this.#t)e.reject(new Error("The AutoResetEvent has been disposed"));this.#t.length=0}};var[bu,B,st]=(()=>{let t=[],e=[];function i(a,n){let r=a.charCodeAt(0),o=n.charCodeAt(0);for(let d=r;d<=o;d+=1)t[d]=e.length,e.push(d)}return i("A","Z"),i("a","z"),i("0","9"),i("+","+"),i("/","/"),[t,e,61]})();function oi(t){let e=t%3,s=e!==0?3-e:0;return[(t+s)/3*4,s]}function La(t,e){let[s,i]=oi(t.length);if(e){if(e.length<s)throw new TypeError("output buffer is too small");if(e=e.subarray(0,s),t.buffer!==e.buffer)ri(t,e,i);else if(e.byteOffset+e.length-(i+1)<=t.byteOffset+t.length)ri(t,e,i);else if(e.byteOffset>=t.byteOffset-1)cr(t,e,i);else throw new TypeError("input and output cannot overlap");return s}else return e=new Uint8Array(s),ri(t,e,i),e}function ri(t,e,s){let i=0,a=0;for(;i<t.length-2;){let n=t[i];i+=1;let r=t[i];i+=1;let o=t[i];i+=1,e[a]=B[n>>2],a+=1,e[a]=B[(n&3)<<4|r>>4],a+=1,e[a]=B[(r&15)<<2|o>>6],a+=1,e[a]=B[o&63],a+=1}if(s===2){let n=t[i];e[a]=B[n>>2],a+=1,e[a]=B[(n&3)<<4],a+=1,e[a]=st,a+=1,e[a]=st}else if(s===1){let n=t[i];i+=1;let r=t[i];e[a]=B[n>>2],a+=1,e[a]=B[(n&3)<<4|r>>4],a+=1,e[a]=B[(r&15)<<2],a+=1,e[a]=st}}function cr(t,e,s){let i=t.length-1,a=e.length-1;if(s===2){let n=t[i];i-=1,e[a]=st,a-=1,e[a]=st,a-=1,e[a]=B[(n&3)<<4],a-=1,e[a]=B[n>>2],a-=1}else if(s===1){let n=t[i];i-=1;let r=t[i];i-=1,e[a]=st,a-=1,e[a]=B[(n&15)<<2],a-=1,e[a]=B[(r&3)<<4|n>>4],a-=1,e[a]=B[r>>2],a-=1}for(;i>=0;){let n=t[i];i-=1;let r=t[i];i-=1;let o=t[i];i-=1,e[a]=B[n&63],a-=1,e[a]=B[(r&15)<<2|n>>6],a-=1,e[a]=B[(o&3)<<4|r>>4],a-=1,e[a]=B[o>>2],a-=1}}function lr(t){if(t<48)throw new TypeError(`Invalid hex char ${t}`);if(t<58)return t-48;if(t<65)throw new TypeError(`Invalid hex char ${t}`);if(t<71)return t-55;if(t<97)throw new TypeError(`Invalid hex char ${t}`);if(t<103)return t-87;throw new TypeError(`Invalid hex char ${t}`)}function Ca(t){let e=0;for(let s=0;s<t.length;s+=1)e=e<<4|lr(t[s]);return e}var Ta=()=>{};function cs(...t){throw new Error(`Unreachable. Arguments:
`+t.join(`
`))}function Ia(t,e){if(t.length!==e.length)return!1;for(let s=0;s<t.length;s+=1)if(t[s]!==e[s])return!1;return!0}var Pa=L({length:ve(4),content:ve({field:"length",convert(t){return Number.parseInt(t,16)},back(t){return t.toString(16).padStart(4,"0")}})},{littleEndian:!0}),ls=class extends Error{constructor(e){super(e)}},di=class extends ls{constructor(){super("ADB reverse tunnel is not supported on this device when connected wirelessly.")}},ur=Le(Pa,{},{postDeserialize(t){throw t.content==="more than one device/emulator"?new di:new ls(t.content)}});function hr(t){let e=0;for(let s of t){if(s<48||s>57)return e;e=e*10+s-48}return e}var _r=H("OKAY"),us=class extends we{#e=new Map;async createBufferedStream(e){let s=await this.adb.createSocket(e);return new ce(s.readable)}async sendRequest(e){let s=await this.createBufferedStream(e),i=await s.readExactly(4);return Ia(i,_r)||await ur.deserialize(s),s}async list(){let e=await this.createBufferedStream("reverse:list-forward");return(await Pa.deserialize(e)).content.split(`
`).filter(i=>!!i).map(i=>{let[a,n,r]=i.split(" ");return{deviceSerial:a,localName:n,remoteName:r}})}async addExternal(e,s){let i=await this.sendRequest(`reverse:forward:${e};${s}`);if(e.startsWith("tcp:")){let a=i.position;try{let n=Ca(await i.readExactly(4));e=`tcp:${hr(await i.readExactly(n))}`}catch(n){if(!(n instanceof _e&&i.position===a))throw n}}return e}async add(e,s,i){i=await this.adb.transport.addReverseTunnel(s,i);try{return e=await this.addExternal(e,i),this.#e.set(e,i),e}catch(a){throw await this.adb.transport.removeReverseTunnel(i),a}}async remove(e){let s=this.#e.get(e);s&&await this.adb.transport.removeReverseTunnel(s),await this.sendRequest(`reverse:killforward:${e}`)}async removeAll(){await this.adb.transport.clearReverseTunnels(),this.#e.clear(),await this.sendRequest("reverse:killforward-all")}};var hs=class{#e;get stdin(){return this.#e.writable}get output(){return this.#e.readable}#t;get exited(){return this.#t}constructor(e,s){if(this.#e=e,s){let i=new $;this.#e.closed.then(()=>i.resolve(void 0),a=>i.reject(a)),s.addEventListener("abort",()=>{i.reject(s.reason),this.#e.close()}),this.#t=i.promise}else this.#t=this.#e.closed}kill(){return this.#e.close()}};var _s=class{#e;#t;#s;get input(){return this.#s}get output(){return this.#e.readable}get exited(){return this.#e.closed}constructor(e){this.#e=e,this.#t=this.#e.writable.getWriter(),this.#s=new F.WritableStream({write:s=>this.#t.write(s)})}sigint(){return this.#t.write(new Uint8Array([3]))}kill(){return this.#e.close()}};function mt(t){let e="";e+="'";let s=0;for(;;){let i=t.indexOf("'",s);if(i===-1){e+=t.substring(s);break}e+=t.substring(s,i),e+=String.raw`'\''`,s=i+1}return e+="'",e}function ps(t){let e=[],s,i=!1,a=0;for(let n=0,r=t.length;n<r;n+=1){if(i){i=!1;continue}let o=t.charAt(n);switch(o){case" ":!s&&n!==a&&(e.push(t.substring(a,n)),a=n+1);break;case"'":case'"':s?o===s&&(s=void 0):s=o;break;case"\\":i=!0;break}}return a<t.length&&e.push(t.substring(a)),e}var bs=class{#e;constructor(e){this.#e=e}spawn(e,s){return s?.throwIfAborted(),typeof e=="string"&&(e=ps(e)),this.#e(e,s)}async spawnWait(e){return await(await this.spawn(e)).output.pipeThrough(new Te)}async spawnWaitText(e){return await(await this.spawn(e)).output.pipeThrough(new Ie).pipeThrough(new pe)}};var fs=class extends bs{#e;get adb(){return this.#e}constructor(e){super(async(s,i)=>{let a=await this.#e.createSocket(`exec:${s.join(" ")}`);if(i?.aborted)throw await a.close(),i.reason;return new hs(a,i)}),this.#e=e}async pty(e){return e===void 0?e="":Array.isArray(e)&&(e=e.join(" ")),new _s(await this.#e.createSocket(`shell:${e}`))}};var T={ShellV2:"shell_v2",Cmd:"cmd",StatV2:"stat_v2",ListV2:"ls_v2",FixedPushMkdir:"fixed_push_mkdir",Abb:"abb",AbbExec:"abb_exec",SendReceiveV2:"sendrecv_v2",DelayedAck:"delayed_ack"};var ae={Stdin:0,Stdout:1,Stderr:2,Exit:3,CloseStdin:4,WindowSizeChange:5},ye=L({id:ma(),data:ie(m)},{littleEndian:!0});var ms=class{#e;#t;#s;get stdin(){return this.#s}#i;get stdout(){return this.#i}#a;get stderr(){return this.#a}#r;get exited(){return this.#r}constructor(e,s){this.#e=e;let i,a;this.#i=new Y(r=>{i=r}),this.#a=new Y(r=>{a=r});let n=new $;this.#r=n.promise,e.readable.pipeThrough(new tt(ye)).pipeTo(new j({write:async r=>{switch(r.id){case ae.Exit:n.resolve(r.data[0]);break;case ae.Stdout:await i.enqueue(r.data);break;case ae.Stderr:await a.enqueue(r.data);break;default:break}}})).then(()=>{i.close(),a.close(),n.reject(new Error("Socket ended without exit message"))},r=>{i.error(r),a.error(r),n.reject(r)}),s&&s.addEventListener("abort",()=>{n.reject(s.reason),this.#e.close()}),this.#t=this.#e.writable.getWriter(),this.#s=new F.WritableStream({write:async r=>{await this.#t.write(ye.serialize({id:ae.Stdin,data:r}))},close:()=>this.#t.write(ye.serialize({id:ae.CloseStdin,data:E}))})}kill(){return this.#e.close()}};var vs=class{#e;#t;#s;get input(){return this.#s}#i;get output(){return this.#i}#a=new $;get exited(){return this.#a.promise}constructor(e){this.#e=e;let s;this.#i=new Y(i=>{s=i}),e.readable.pipeThrough(new tt(ye)).pipeTo(new j({write:async i=>{switch(i.id){case ae.Exit:this.#a.resolve(i.data[0]);break;case ae.Stdout:await s.enqueue(i.data);break}}})).then(()=>{s.close(),this.#a.reject(new Error("Socket ended without exit message"))},i=>{s.error(i),this.#a.reject(i)}),this.#t=this.#e.writable.getWriter(),this.#s=new F.WritableStream({write:i=>this.#r(i)})}#r(e){return this.#t.write(ye.serialize({id:ae.Stdin,data:e}))}async resize(e,s){await this.#t.write(ye.serialize({id:ae.WindowSizeChange,data:H(`${e}x${s},0x0\0`)}))}sigint(){return this.#r(new Uint8Array([3]))}kill(){return this.#e.close()}};var gs=class{#e;constructor(e){this.#e=e}spawn(e,s){return s?.throwIfAborted(),typeof e=="string"&&(e=ps(e)),this.#e(e,s)}async spawnWait(e){let s=await this.spawn(e),[i,a,n]=await Promise.all([s.stdout.pipeThrough(new Te),s.stderr.pipeThrough(new Te),s.exited]);return{stdout:i,stderr:a,exitCode:n}}async spawnWaitText(e){let s=await this.spawn(e),[i,a,n]=await Promise.all([s.stdout.pipeThrough(new Ie).pipeThrough(new pe),s.stderr.pipeThrough(new Ie).pipeThrough(new pe),s.exited]);return{stdout:i,stderr:a,exitCode:n}}};var ws=class extends gs{#e;get adb(){return this.#e}get isSupported(){return this.#e.canUseFeature(T.ShellV2)}constructor(e){super(async(s,i)=>{let a=await this.#e.createSocket(`shell,v2,raw:${s.join(" ")}`);if(i?.aborted)throw await a.close(),i.reason;return new ms(a,i)}),this.#e=e}async pty(e){let s="shell,v2,pty";return e?.terminalType&&(s+=",TERM="+e.terminalType),s+=":",e&&(typeof e.command=="string"?s+=e.command:Array.isArray(e.command)&&(s+=e.command.join(" "))),new vs(await this.#e.createSocket(s))}};var ys=class{#e;get adb(){return this.#e}#t;get noneProtocol(){return this.#t}#s;get shellProtocol(){return this.#s}constructor(e){this.#e=e,this.#t=new fs(e),e.canUseFeature(T.ShellV2)&&(this.#s=new ws(e))}};function pr(t){let e=new Uint8Array(t.length);for(let s=0;s<t.length;s+=1)e[s]=t.charCodeAt(s);return e}function I(t){let e=pr(t);return Ye(e,0)}var G={Entry:I("DENT"),Entry2:I("DNT2"),Lstat:I("STAT"),Stat:I("STA2"),Lstat2:I("LST2"),Done:I("DONE"),Data:I("DATA"),Ok:I("OKAY"),Fail:I("FAIL")},ci=class extends Error{},Na=L({message:ve(m)},{littleEndian:!0,postDeserialize(t){throw new ci(t.message)}});async function it(t,e,s){typeof e=="string"&&(e=I(e));let i=await t.readExactly(4);switch(Ye(i,0)){case G.Fail:throw await Na.deserialize(t),new Error("Unreachable");case e:return await s.deserialize(t);default:throw new Error(`Expected '${e}', but got '${de(i)}'`)}}async function*at(t,e,s){for(typeof e=="string"&&(e=I(e));;){let i=await t.readExactly(4);switch(Ye(i,0)){case G.Fail:await Na.deserialize(t),cs();case G.Done:await t.readExactly(s.size);return;case e:yield await s.deserialize(t);break;default:throw new Error(`Expected '${e}' or '${G.Done}', but got '${de(i)}'`)}}}var V={List:I("LIST"),ListV2:I("LIS2"),Send:I("SEND"),SendV2:I("SND2"),Lstat:I("STAT"),Stat:I("STA2"),LstatV2:I("LST2"),Data:I("DATA"),Done:I("DONE"),Receive:I("RECV")},Ra=L({id:m,arg:m},{littleEndian:!0});async function Z(t,e,s){if(typeof e=="string"&&(e=I(e)),typeof s=="number"){await t.write(Ra.serialize({id:e,arg:s}));return}typeof s=="string"&&(s=H(s)),await t.write(Ra.serialize({id:e,arg:s.length})),await t.write(s)}var li={Directory:4,File:8,Link:10},ui=L({mode:m,size:m,mtime:m},{littleEndian:!0,extra:{get type(){return this.mode>>12},get permission(){return this.mode&4095}},postDeserialize(t){if(t.mode===0&&t.size===0&&t.mtime===0)throw new Error("lstat error");return t}}),hi={SUCCESS:0,EACCES:13,EEXIST:17,EFAULT:14,EFBIG:27,EINTR:4,EINVAL:22,EIO:5,EISDIR:21,ELOOP:40,EMFILE:24,ENAMETOOLONG:36,ENFILE:23,ENOENT:2,ENOMEM:12,ENOSPC:28,ENOTDIR:20,EOVERFLOW:75,EPERM:1,EROFS:30,ETXTBSY:26},br=Object.fromEntries(Object.entries(hi).map(([t,e])=>[e,t])),$s=L({error:m(),dev:Ce,ino:Ce,mode:m,nlink:m,uid:m,gid:m,size:Ce,atime:Ce,mtime:Ce,ctime:Ce},{littleEndian:!0,extra:{get type(){return this.mode>>12},get permission(){return this.mode&4095}},postDeserialize(t){if(t.error)throw new Error(br[t.error]);return t}});async function Oa(t,e,s){let i=await t.lock();try{if(s)return await Z(i,V.LstatV2,e),await it(i,G.Lstat2,$s);{await Z(i,V.Lstat,e);let a=await it(i,G.Lstat,ui);return{mode:a.mode,size:BigInt(a.size),mtime:BigInt(a.mtime),get type(){return a.type},get permission(){return a.permission}}}}finally{i.release()}}async function Ba(t,e){let s=await t.lock();try{return await Z(s,V.Stat,e),await it(s,G.Stat,$s)}finally{s.release()}}var fr=Le(ui,{name:ve(m)}),mr=Le($s,{name:ve(m)});async function*vr(t,e){let s=await t.lock();try{await Z(s,V.ListV2,e);for await(let i of at(s,G.Entry2,mr))i.error===hi.SUCCESS&&(yield i)}finally{s.release()}}async function*gr(t,e){let s=await t.lock();try{await Z(s,V.List,e);for await(let i of at(s,G.Entry,fr))yield i}finally{s.release()}}async function*Ua(t,e,s){if(s)yield*vr(t,e);else for await(let i of gr(t,e))yield{mode:i.mode,size:BigInt(i.size),mtime:BigInt(i.mtime),get type(){return i.type},get permission(){return i.permission},name:i.name}}var qa=L({data:ie(m)},{littleEndian:!0});async function*wr(t,e){let s=await t.lock(),i=!1;try{await Z(s,V.Receive,e);for await(let a of at(s,G.Data,qa))yield a.data;i=!0}catch(a){throw i=!0,a}finally{if(!i)for await(let a of at(s,G.Data,qa));s.release()}}function za(t,e){return z.from(wr(t,e))}var Ma=64*1024,yr=L({unused:m},{littleEndian:!0});async function Fa(t,e,s,i){let a=new ge;e.pipeThrough(new ss(s,!0)).pipeTo(new F.WritableStream({write(n){return Z(t,V.Data,n)}}),{signal:a.signal}).then(async()=>{await Z(t,V.Done,i),await t.flush()},Ta),await it(t,G.Ok,yr).catch(n=>{throw a.abort(),n})}async function _i({socket:t,filename:e,file:s,type:i=li.File,permission:a=438,mtime:n=Date.now()/1e3|0,packetSize:r=Ma}){let o=await t.lock();try{let d=i<<12|a,c=`${e},${d.toString()}`;await Z(o,V.Send,c),await Fa(o,s,r,n)}finally{o.release()}}var Da={None:0,Brotli:1,Lz4:2,Zstd:4,DryRun:2147483648},$r=L({id:m,mode:m,flags:m()},{littleEndian:!0});async function kr({socket:t,filename:e,file:s,type:i=li.File,permission:a=438,mtime:n=Date.now()/1e3|0,packetSize:r=Ma,dryRun:o=!1}){let d=await t.lock();try{await Z(d,V.SendV2,e);let c=i<<12|a,l=Da.None;o&&(l|=Da.DryRun),await d.write($r.serialize({id:V.SendV2,mode:c,flags:l})),await Fa(d,s,r,n)}finally{d.release()}}function Ga(t){if(t.v2)return kr(t);if(t.dryRun)throw new Error("dryRun is not supported in v1");return _i(t)}var pi=class{#e;#t;#s;#i=new ft;#a;get position(){return this.#t.position}constructor(e,s,i,a){this.#e=e,this.#t=s,this.#s=a,this.#a=new bt(i)}#r(e){return C.WritableStream.write(this.#e,e)}async flush(){try{await this.#i.wait();let e=this.#a.flush();e&&await this.#r(e)}finally{this.#i.notifyOne()}}async write(e){try{await this.#i.wait();for(let s of this.#a.push(e))await this.#r(s)}finally{this.#i.notifyOne()}}async readExactly(e){return await this.flush(),await this.#t.readExactly(e)}release(){this.#a.flush(),this.#s.notifyOne()}async close(){await this.#t.cancel()}},nt=class{#e=new ft;#t;#s;constructor(e,s){this.#t=e,this.#s=new pi(e.writable.getWriter(),new ce(e.readable),s,this.#e)}async lock(){return await this.#e.wait(),this.#s}async close(){await this.#s.close(),await this.#t.close()}};function xr(t){let e=t.lastIndexOf("/");if(e===-1)throw new Error("Invalid path");return e===0?"/":t.substring(0,e)}var ks=class{_adb;_socket;#e;#t;#s;#i;#a;get supportsStat(){return this.#e}get supportsListV2(){return this.#t}get fixedPushMkdir(){return this.#s}get supportsSendReceiveV2(){return this.#i}get needPushMkdirWorkaround(){return this.#a}constructor(e,s){this._adb=e,this._socket=new nt(s,e.maxPayloadSize),this.#e=e.canUseFeature(T.StatV2),this.#t=e.canUseFeature(T.ListV2),this.#s=e.canUseFeature(T.FixedPushMkdir),this.#i=e.canUseFeature(T.SendReceiveV2),this.#a=this._adb.canUseFeature(T.ShellV2)&&!this.fixedPushMkdir}async lstat(e){return await Oa(this._socket,e,this.#e)}async stat(e){if(!this.#e)throw new Error("Not supported");return await Ba(this._socket,e)}async isDirectory(e){try{return await this.lstat(e+"/"),!0}catch{return!1}}opendir(e){return Ua(this._socket,e,this.supportsListV2)}async readdir(e){let s=[];for await(let i of this.opendir(e))s.push(i);return s}read(e){return za(this._socket,e)}async write(e){this.needPushMkdirWorkaround&&await this._adb.subprocess.noneProtocol.spawnWait(["mkdir","-p",mt(xr(e.filename))]),await Ga({v2:this.supportsSendReceiveV2,socket:this._socket,...e})}lockSocket(){return this._socket.lock()}dispose(){return this._socket.close()}};function Wa(t){if(!(!t||t==="0"))return Number.parseInt(t,10)}var xs=class extends we{async getListenAddresses(){let e=await this.adb.getProp("service.adb.listen_addrs"),s=await this.adb.getProp("service.adb.tcp.port"),i=await this.adb.getProp("persist.adb.tcp.port");return{serviceListenAddresses:e!=""?e.split(","):[],servicePort:Wa(s),persistPort:Wa(i)}}async setPort(e){if(e<=0)throw new TypeError(`Invalid port ${e}`);let s=await this.adb.createSocketAndWait(`tcpip:${e}`);if(s!==`restarting in TCP mode port: ${e}
`)throw new Error(s);return s}async disable(){let e=await this.adb.createSocketAndWait("usb:");if(e!==`restarting in USB mode
`)throw new Error(e);return e}};var vt=class{#e;get transport(){return this.#e}get serial(){return this.#e.serial}get maxPayloadSize(){return this.#e.maxPayloadSize}get banner(){return this.#e.banner}get disconnected(){return this.#e.disconnected}get clientFeatures(){return this.#e.clientFeatures}get deviceFeatures(){return this.banner.features}subprocess;power;reverse;tcpip;constructor(e){this.#e=e,this.subprocess=new ys(this),this.power=new ds(this),this.reverse=new us(this),this.tcpip=new xs(this)}canUseFeature(e){return this.clientFeatures.includes(e)&&this.deviceFeatures.includes(e)}async createSocket(e){return this.#e.connect(e)}async createSocketAndWait(e){return await(await this.createSocket(e)).readable.pipeThrough(new Ie).pipeThrough(new pe)}getProp(e){return this.subprocess.noneProtocol.spawnWaitText(["getprop",e]).then(s=>s.trim())}rm(e,s){let i=["rm"];if(s?.recursive&&i.push("-r"),s?.force&&i.push("-f"),Array.isArray(e))for(let a of e)i.push(mt(a));else i.push(mt(e));return i.push("</dev/null"),this.subprocess.noneProtocol.spawnWaitText(i)}async sync(){let e=await this.createSocket("sync:");return new ks(this,e)}async framebuffer(){return ja(this)}async close(){await this.#e.close()}};var Ss={Product:"ro.product.name",Model:"ro.product.model",Device:"ro.product.device",Features:"features"},As=class t{static parse(e){let s,i,a,n,r=[],o=e.split("::");if(o.length>1){s=o[0].trim()||void 0;let d=o[1];for(let c of d.split(";")){if(!c)continue;let l=c.split("=");if(l.length!==2)continue;let[_,u]=l;switch(_){case Ss.Product:i=u;break;case Ss.Model:a=u;break;case Ss.Device:n=u;break;case Ss.Features:r=u.split(",");break}}}return new t(s,i,a,n,r)}#e;get state(){return this.#e}#t;get product(){return this.#t}#s;get model(){return this.#s}#i;get device(){return this.#i}#a=[];get features(){return this.#a}constructor(e,s,i,a,n){this.#e=e,this.#t=s,this.#s=i,this.#i=a,this.#a=n}};function fi(t,e,s){let i=0n;for(let a=e;a<e+s;a+=8){i<<=64n;let n=pa(t,a);i|=n}return i}function mi(t,e,s,i,a){if(a)for(;i>0n;)ca(t,e,i),e+=8,i>>=64n;else{let n=e+s-8;for(;i>0n;)la(t,n,i),n-=8,i>>=64n}}var Sr=38,Ar=2048/8,jr=303,Er=2048/8;function Ka(t){let e=fi(t,Sr,Ar),s=fi(t,jr,Er);return[e,s]}function Ha(t,e){let s=t%e;return s>0?s:s+(e>0?e:-e)}function Lr(t,e){if(t=Ha(t,e),!t||e<2)return NaN;let s=[],i=e;for(;i;)[t,i]=[i,t%i],s.push({a:t,b:i});if(t!==1)return NaN;let a=1,n=0;for(let r=s.length-2;r>=0;r-=1)[a,n]=[n,a-n*Math.floor(s[r].a/s[r].b)];return Ha(n,e)}var Ne=2048/8,Cr=Ne/4;function vi(){return 8+Ne+Ne+4}function Qa(t,e){let s,i=vi();if(!e)e=new Uint8Array(i),s="Uint8Array";else{if(e.length<i)throw new TypeError("output buffer is too small");s="number"}let a=new DataView(e.buffer,e.byteOffset,e.length),n=0;a.setUint32(n,Cr,!0),n+=4;let[r]=Ka(t),o=-Lr(Number(r%2n**32n),2**32);a.setInt32(n,o,!0),n+=4,mi(e,n,Ne,r,!0),n+=Ne;let d=2n**4096n%r;return mi(e,n,Ne,d,!0),n+=Ne,a.setUint32(n,65537,!0),s==="Uint8Array"?e:i}function Tr(t,e,s){if(s===1n)return 0n;let i=1n;for(t=t%s;e>0n;)BigInt.asUintN(1,e)===1n&&(i=i*t%s),t=t*t%s,e>>=1n;return i}var Va=20,Ja=48,Ir=4,Pr=5,Nr=6,bi=new Uint8Array([Ja,13+Va,Ja,9,Nr,5,43,14,3,2,26,Pr,0,Ir,Va]);function Xa(t,e){let[s,i]=Ka(t),a=new Uint8Array(256),n=0;a[n]=0,n+=1,a[n]=1,n+=1;let r=a.length-bi.length-e.length-1;for(;n<r;)a[n]=255,n+=1;a[n]=0,n+=1,a.set(bi,n),n+=bi.length,a.set(e,n);let o=Tr(fi(a,0,a.length),i,s);return mi(a,0,a.length,o,!1),a}var R={Auth:1213486401,Close:1163086915,Connect:1314410051,Okay:1497451343,Open:1313165391,Write:1163154007},gt=L({command:m,arg0:m,arg1:m,payloadLength:m,checksum:m,magic:va},{littleEndian:!0}),h_=Le(gt,{payload:ie("payloadLength")});function Es(t){return t.reduce((e,s)=>e+s,0)}var js=class extends Jt{constructor(){let e=new Uint8Array(gt.size);super({transform:async(s,i)=>{await s.tryConsume(async a=>{let n=a;n.payloadLength=n.payload.length,gt.serialize(n,e),await C.ReadableStream.enqueue(i,e),n.payloadLength&&await C.ReadableStream.enqueue(i,n.payload)})}})}};var Ls={Token:1,Signature:2,PublicKey:3},Rr=async function*(t,e){for await(let s of t.iterateKeys()){let i=await e();if(i.arg0!==Ls.Token)return;let a=Xa(s.buffer,i.payload);yield{command:R.Auth,arg0:Ls.Signature,arg1:0,payload:a}}},Or=async function*(t,e){if((await e()).arg0!==Ls.Token)return;let i;for await(let d of t.iterateKeys()){i=d;break}i||(i=await t.generateKey());let a=vi(),[n]=oi(a),r=i.name?.length?H(i.name):E,o=new Uint8Array(n+(r.length?r.length+1:0)+1);Qa(i.buffer,o),La(o.subarray(0,a),o),r.length&&(o[n]=32,o.set(r,n+1)),yield{command:R.Auth,arg0:Ls.PublicKey,arg1:0,payload:o}},Za=[Rr,Or],Cs=class{authenticators;#e;#t=new $;#s;constructor(e,s){this.authenticators=e,this.#e=s}#i=()=>this.#t.promise;async*#a(){for(let e of this.authenticators)for await(let s of e(this.#e,this.#i))this.#t=new $,yield s}async process(e){this.#s||(this.#s=this.#a()),this.#t.resolve(e);let s=await this.#s.next();if(s.done)throw new Error("No authenticator can handle the request");return s.value}dispose(){this.#s?.return?.()}};var wt=class{#e;localId;remoteId;localCreated;service;#t;#s;get readable(){return this.#t}#i;writable;#a=!1;#r=new $;get closed(){return this.#r.promise}#d;get socket(){return this.#d}#c;#o=0;constructor(e){this.#e=e.dispatcher,this.localId=e.localId,this.remoteId=e.remoteId,this.localCreated=e.localCreated,this.service=e.service,this.#t=new Y(s=>{this.#s=s}),this.writable=new F.WritableStream({start:s=>{this.#i=s,s.signal.addEventListener("abort",()=>{this.#c?.reject(s.signal.reason)})},write:async s=>{let i=s.length,a=this.#e.options.maxPayloadSize;for(let n=0,r=a;n<i;n=r,r+=a){let o=s.subarray(n,r);await this.#u(o)}}}),this.#d=new gi(this),this.#o=e.availableWriteBytes}async#u(e){let s=e.length;for(;this.#o<s;){let i=new $;this.#c=i,await i.promise}this.#o===1/0?this.#o=-1:this.#o-=s,await this.#e.sendPacket(R.Write,this.localId,this.remoteId,e)}async enqueue(e){await this.#s.enqueue(e)}ack(e){this.#o+=e,this.#c?.resolve()}async close(){if(!this.#a){this.#a=!0,this.#c?.reject(new Error("Socket closed"));try{this.#i.error(new Error("Socket closed"))}catch{}await this.#e.sendPacket(R.Close,this.localId,this.remoteId,E)}}dispose(){this.#s.close(),this.#r.resolve(void 0)}},gi=class{#e;get localId(){return this.#e.localId}get remoteId(){return this.#e.remoteId}get localCreated(){return this.#e.localCreated}get service(){return this.#e.service}get readable(){return this.#e.readable}get writable(){return this.#e.writable}get closed(){return this.#e.closed}constructor(e){this.#e=e}close(){return this.#e.close()}};var Ts=class{#e=new Gt(1);#t=new Map;#s;options;#i=!1;#a=new $;get disconnected(){return this.#a.promise}#r=new Map;#d=new ge;constructor(e,s){this.options=s,this.options.initialDelayedAckBytes<0&&(this.options.initialDelayedAckBytes=0),e.readable.pipeTo(new j({write:async(i,a)=>{switch(i.command){case R.Close:await this.#c(i);break;case R.Okay:this.#o(i);break;case R.Open:await this.#n(i);break;case R.Write:this.#_(i).catch(n=>{a.error(n)});break;default:throw new Error(`Unknown command: ${i.command.toString(16)}`)}}}),{preventCancel:s.preserveConnection??!1,signal:this.#d.signal}).then(()=>{this.#p()},i=>{this.#i||this.#a.reject(i),this.#p()}),this.#s=e.writable.getWriter()}async#c(e){if(e.arg0===0&&this.#e.reject(e.arg1,new Error("Socket open failed")))return;let s=this.#t.get(e.arg1);if(s){await s.close(),s.dispose(),this.#t.delete(e.arg1);return}}#o(e){let s;if(this.options.initialDelayedAckBytes!==0){if(e.payload.length!==4)throw new Error("Invalid OKAY packet. Payload size should be 4");s=Ye(e.payload,0)}else{if(e.payload.length!==0)throw new Error("Invalid OKAY packet. Payload size should be 0");s=1/0}if(this.#e.resolve(e.arg1,{remoteId:e.arg0,availableWriteBytes:s}))return;let i=this.#t.get(e.arg1);if(i){i.ack(s);return}this.sendPacket(R.Close,e.arg1,e.arg0,E)}#u(e,s,i){let a;return this.options.initialDelayedAckBytes!==0?(a=new Uint8Array(4),ha(a,0,i)):a=E,this.sendPacket(R.Okay,e,s,a)}async#n(e){let[s]=this.#e.add();this.#e.resolve(s,void 0);let i=e.arg0,a=e.arg1,n=de(e.payload);if(n.endsWith("\0")&&(n=n.substring(0,n.length-1)),this.options.initialDelayedAckBytes===0){if(a!==0)throw new Error("Invalid OPEN packet. arg1 should be 0");a=1/0}else if(a===0)throw new Error("Invalid OPEN packet. arg1 should be greater than 0");let r=this.#r.get(n);if(!r){await this.sendPacket(R.Close,0,i,E);return}let o=new wt({dispatcher:this,localId:s,remoteId:i,localCreated:!1,service:n,availableWriteBytes:a});try{await r(o.socket),this.#t.set(s,o),await this.#u(s,i,this.options.initialDelayedAckBytes)}catch{await this.sendPacket(R.Close,0,i,E)}}async#_(e){let s=this.#t.get(e.arg1);if(!s)throw new Error(`Unknown local socket id: ${e.arg1}`);let i=!1,a=[(async()=>{await s.enqueue(e.payload),await this.#u(e.arg1,e.arg0,e.payload.length),i=!0})()];this.options.readTimeLimit&&a.push((async()=>{if(await aa(this.options.readTimeLimit),!i)throw new Error(`readable of \`${s.service}\` has stalled for ${this.options.readTimeLimit} milliseconds`)})()),await Promise.race(a)}async createSocket(e){this.options.appendNullToServiceString&&(e+="\0");let[s,i]=this.#e.add();await this.sendPacket(R.Open,s,this.options.initialDelayedAckBytes,e);let{remoteId:a,availableWriteBytes:n}=await i,r=new wt({dispatcher:this,localId:s,remoteId:a,localCreated:!0,service:e,availableWriteBytes:n});return this.#t.set(s,r),r.socket}addReverseTunnel(e,s){this.#r.set(e,s)}removeReverseTunnel(e){this.#r.delete(e)}clearReverseTunnels(){this.#r.clear()}async sendPacket(e,s,i,a){if(typeof a=="string"&&(a=H(a)),a.length>this.options.maxPayloadSize)throw new TypeError("payload too large");await C.WritableStream.write(this.#s,{command:e,arg0:s,arg1:i,payload:a,checksum:this.options.calculateChecksum?Es(a):0,magic:e^4294967295})}async close(){await Promise.all(Array.from(this.#t.values(),e=>e.close())),this.#i=!0,this.#d.abort(),this.options.preserveConnection?this.#s.releaseLock():await this.#s.close()}#p(){for(let e of this.#t.values())e.dispose();this.#a.resolve()}};var Br=16777217,Ya=[T.ShellV2,T.Cmd,T.StatV2,T.ListV2,T.FixedPushMkdir,"apex",T.Abb,"fixed_push_symlink_timestamp",T.AbbExec,"remount_shell","track_app",T.SendReceiveV2,"sendrecv_v2_brotli","sendrecv_v2_lz4","sendrecv_v2_zstd","sendrecv_v2_dry_run_send",T.DelayedAck],Ur=32*1024*1024,yt=class t{static async authenticate({serial:e,connection:s,credentialStore:i,authenticators:a=Za,features:n=Ya,initialDelayedAckBytes:r=Ur,...o}){let d=16777217,c=1024*1024,l=new $,_=new Cs(a,i),u=new ge,h=s.readable.pipeTo(new j({async write(g){switch(g.command){case R.Connect:d=Math.min(d,g.arg0),c=Math.min(c,g.arg1),l.resolve(de(g.payload));break;case R.Auth:{let J=await _.process(g);await f(J);break}default:break}}}),{preventCancel:!0,signal:u.signal}).then(()=>{l.reject(new Error("Connection closed unexpectedly"))},g=>{l.reject(g)}),p=s.writable.getWriter();async function f(g){g.checksum=Es(g.payload),g.magic=g.command^4294967295,await C.WritableStream.write(p,g)}let y=n.slice();if(r<=0){let g=n.indexOf(T.DelayedAck);g!==-1&&y.splice(g,1)}let v;try{await f({command:R.Connect,arg0:d,arg1:c,payload:H(`host::features=${y.join(",")}`)}),v=await l.promise}finally{u.abort(),p.releaseLock(),await h}return new t({serial:e,connection:s,version:d,maxPayloadSize:c,banner:v,features:y,initialDelayedAckBytes:r,...o})}#e;get connection(){return this.#e}#t;#s;get serial(){return this.#s}#i;get protocolVersion(){return this.#i}get maxPayloadSize(){return this.#t.options.maxPayloadSize}#a;get banner(){return this.#a}get disconnected(){return this.#t.disconnected}#r;get clientFeatures(){return this.#r}constructor({serial:e,connection:s,version:i,banner:a,features:n=Ya,initialDelayedAckBytes:r,...o}){if(this.#s=e,this.#e=s,this.#a=As.parse(a),this.#r=n,n.includes(T.DelayedAck)){if(r<=0)throw new TypeError("`initialDelayedAckBytes` must be greater than 0 when DelayedAck feature is enabled.");this.#a.features.includes(T.DelayedAck)||(r=0)}else r=0;let d,c;i>=Br?(d=!1,c=!1):(d=!0,c=!0),this.#t=new Ts(s,{calculateChecksum:d,appendNullToServiceString:c,initialDelayedAckBytes:r,...o}),this.#i=i}connect(e){return this.#t.createSocket(e)}addReverseTunnel(e,s){return s||(s=`localabstract:reverse_${Math.random().toString().substring(2)}`),this.#t.addReverseTunnel(s,e),s}removeReverseTunnel(e){this.#t.removeReverseTunnel(e)}clearReverseTunnels(){this.#t.clearReverseTunnels()}close(){return this.#t.close()}};function en(t,e){e<0||e>=t.length||(t[e]=t[t.length-1],t.length-=1)}var Is=class extends Error{constructor(e){super("The device is already in used by another program",{cause:e})}};function $t(t,e){return typeof t=="object"&&t!==null&&"name"in t&&t.name===e}function qr(t){return t.classCode!==void 0&&t.subclassCode!==void 0&&t.protocolCode!==void 0}function zr(t,e){return t.interfaceClass===e.classCode&&t.interfaceSubclass===e.subclassCode&&t.interfaceProtocol===e.protocolCode}function Dr(t,e){for(let s of t.configurations)for(let i of s.interfaces)for(let a of i.alternates)if(zr(a,e))return{configuration:s,interface_:i,alternate:a}}function tn(t){return t.toString(16).padStart(4,"0")}function wi(t){return t.serialNumber?t.serialNumber:tn(t.vendorId)+"x"+tn(t.productId)}function sn(t){if(t.length===0)throw new TypeError("No endpoints given");let e,s;for(let i of t)switch(i.direction){case"in":if(e=i,s)return{inEndpoint:e,outEndpoint:s};break;case"out":if(s=i,e)return{inEndpoint:e,outEndpoint:s};break}throw e?s?new Error("unreachable"):new TypeError("No output endpoint found."):new TypeError("No input endpoint found.")}function Mr(t,e){return e.vendorId!==void 0&&t.vendorId!==e.vendorId||e.productId!==void 0&&t.productId!==e.productId||e.serialNumber!==void 0&&wi(t)!==e.serialNumber?!1:qr(e)?Dr(t,e)||!1:!0}function rt(t,e,s){if(s&&s.length>0&&rt(t,s))return!1;for(let i of e){let a=Mr(t,i);if(a)return a}return!1}var Ps={classCode:255,subclassCode:66,protocolCode:1};function kt(t){return!t||t.length===0?[Ps]:t.map(e=>({...e,classCode:e.classCode??Ps.classCode,subclassCode:e.subclassCode??Ps.subclassCode,protocolCode:e.protocolCode??Ps.protocolCode}))}var yi=class{#e;get device(){return this.#e}#t;get inEndpoint(){return this.#t}#s;get outEndpoint(){return this.#s}#i;get readable(){return this.#i}#a;get writable(){return this.#a}constructor(e,s,i,a){this.#e=e,this.#t=s,this.#s=i;let n=!1,r=new as({close:async()=>{try{n=!0,await e.raw.close()}catch{}},dispose:()=>{n=!0,a.removeEventListener("disconnect",o)}});function o(c){c.device===e.raw&&r.dispose().catch(cs)}a.addEventListener("disconnect",o),this.#i=r.wrapReadable(new z({pull:async c=>{let l=await this.#r();l?c.enqueue(l):c.close()}},{highWaterMark:0}));let d=i.packetSize-1;this.#a=Sa(r.createWritable(new F.WritableStream({write:async c=>{try{await e.raw.transferOut(i.endpointNumber,Ea(c)),d&&(c.length&d)===0&&await e.raw.transferOut(i.endpointNumber,E)}catch(l){if(n)return;throw l}}})),new js)}async#r(){try{for(;;){let e=await this.#e.raw.transferIn(this.#t.endpointNumber,this.#t.packetSize);if(e.data.byteLength!==24)continue;let s=new Uint8Array(e.data.buffer),i=new Wt(s),a=gt.deserialize(i);if(a.magic===(a.command^4294967295)){if(a.payloadLength!==0){let n=await this.#e.raw.transferIn(this.#t.endpointNumber,a.payloadLength);a.payload=new Uint8Array(n.data.buffer)}else a.payload=E;return a}}}catch(e){if($t(e,"NetworkError")&&(await new Promise(s=>{setTimeout(()=>{s()},100)}),closed))return;throw e}}},Re=class t{static DeviceBusyError=Is;#e;#t;#s;get raw(){return this.#s}#i;get serial(){return this.#i}get name(){return this.#s.productName}constructor(e,s,i){this.#s=e,this.#i=wi(e),this.#e=s,this.#t=i}async#a(){this.#s.opened||await this.#s.open();let{configuration:e,interface_:s,alternate:i}=this.#e;if(this.#s.configuration?.configurationValue!==e.configurationValue&&await this.#s.selectConfiguration(e.configurationValue),!s.claimed)try{await this.#s.claimInterface(s.interfaceNumber)}catch(a){throw $t(a,"NetworkError")?new t.DeviceBusyError(a):a}return s.alternate.alternateSetting!==i.alternateSetting&&await this.#s.selectAlternateInterface(s.interfaceNumber,i.alternateSetting),sn(i.endpoints)}async connect(){let{inEndpoint:e,outEndpoint:s}=await this.#a();return new yi(this,e,s,this.#t)}};var Ns=class t{static async create(e,s={}){let i=await e.getDevices();return new t(e,i,s)}#e;#t;#s;#i=new Pe;onDeviceAdd=this.#i.event;#a=new Pe;onDeviceRemove=this.#a.event;#r=new rs;onListChange=this.#r.event;current=[];constructor(e,s,i={}){this.#e=kt(i.filters),this.#t=i.exclusionFilters,this.#s=e,this.current=s.map(a=>this.#d(a)).filter(a=>!!a),this.#r.fire(this.current),this.#s.addEventListener("connect",this.#c),this.#s.addEventListener("disconnect",this.#o)}#d(e){let s=rt(e,this.#e,this.#t);if(s)return new Re(e,s,this.#s)}#c=e=>{let s=this.#d(e.device);if(!s||this.current.some(a=>a.raw===s.raw))return;let i=this.current.slice();i.push(s),this.current=i,this.#i.fire([s]),this.#r.fire(this.current)};#o=e=>{let s=this.current.findIndex(i=>i.raw===e.device);if(s!==-1){let i=this.current[s],a=this.current.slice();en(a,s),this.current=a,this.#a.fire([i]),this.#r.fire(this.current)}};stop(){this.#s.removeEventListener("connect",this.#c),this.#s.removeEventListener("disconnect",this.#o),this.#i.dispose(),this.#a.dispose(),this.#r.dispose()}};var xt=class t{static BROWSER=typeof globalThis.navigator<"u"&&globalThis.navigator.usb?new t(globalThis.navigator.usb):void 0;#e;constructor(e){this.#e=e}async requestDevice(e={}){let s=kt(e.filters);try{let i=await this.#e.requestDevice({filters:s,exclusionFilters:e.exclusionFilters}),a=rt(i,s,e.exclusionFilters);return a?(this.#e.dispatchEvent(new USBConnectionEvent("connect",{device:i})),new Re(i,a,this.#e)):void 0}catch(i){if($t(i,"NotFoundError"))return;throw i}}async getDevices(e={}){let s=kt(e.filters),i=await this.#e.getDevices(),a=[];for(let n of i){let r=rt(n,s,e.exclusionFilters);r&&a.push(new Re(n,r,this.#e))}return a}trackDevices(e={}){return Ns.create(this.#e,e)}};var an=new TextEncoder,$i="qingping-cgs1-capture";function ki(t,e,s){if(!/^[A-Za-z0-9._/+-]+$/.test(t)||t.startsWith("/")||t.split("/").includes("..")||t.length>100||!Number.isInteger(e)||e<0||e>32*1024*1024)throw Error("Invalid fixed capture member");let i=new Uint8Array(512),a=(o,d)=>i.set(an.encode(d),o),n=(o,d,c)=>a(o,c.toString(8).padStart(d-1,"0")+"\0");a(0,t),n(100,8,s?448:384),n(108,8,0),n(116,8,0),n(124,12,e),n(136,12,0),i.fill(32,148,156),a(156,s?"5":"0"),a(257,"ustar\0"),a(263,"00");let r=i.reduce((o,d)=>o+d,0);return a(148,r.toString(8).padStart(6,"0")+"\0 "),i}function nn(t,e,s){if(!(e instanceof Map)||e.size!==t.files.length||t.files.length!==9)throw Error("Complete fixed capture required");let i=[],a=new Set([$i]),n=0;for(let d of t.files){let c=e.get(d.path);if(!(c instanceof Uint8Array)||c.length!==d.size)throw Error("Capture size changed");if(n+=c.length,n>32*1024*1024)throw Error("Capture budget exceeded");let l=$i+"/"+d.path.replace(/^\//,"");ki(l,c.length,!1);let _=l.split("/");for(let u=1;u<_.length;u++)a.add(_.slice(0,u).join("/"));i.push([l,c])}let r=an.encode(JSON.stringify(s,null,2)+`
`);if(r.length>65536)throw Error("Capture metadata budget exceeded");i.push([$i+"/result.json",r]);let o=[...a].sort().map(d=>ki(d+"/",0,!0));for(let[d,c]of i){o.push(ki(d,c.length,!1),c);let l=(512-c.length%512)%512;l&&o.push(new Uint8Array(l))}return o.push(new Uint8Array(1024)),new Blob(o,{type:"application/x-tar"})}function Fr(t){if(!(t instanceof Blob)||t.type!=="application/x-tar"||t.size>33*1024*1024)throw Error("Invalid private capture download");let e=URL.createObjectURL(t),s=document.createElement("a");s.href=e,s.download="qingping-cgs1-capture.tar",s.click(),setTimeout(()=>URL.revokeObjectURL(e),1e3)}var $e=class extends Error{constructor(e){super(e),this.code=e}},x=t=>{throw new $e(t)};function xi(t,e){return(typeof t!="string"||!e.test(t))&&x("usb_identity_invalid"),t}var Rs=class{#e;#t;#s=!1;#i;#a;#r=!1;#d;constructor(e,s){this.#e=e,this.#t=s}select(){return this.#c(!1)}capture(e=()=>{}){return typeof e!="function"&&x("usb_request_invalid"),this.#c(!0,e)}#c(e,s){(this.#s||this.#r)&&x("usb_selection_consumed");let i=this.#e.manager;i||x("webusb_unavailable"),this.#s=!0;let a;try{a=i.requestDevice()}catch{return Promise.reject(new $e("usb_selection_failed"))}return this.#n(a,e,s)}async#o(e,s,i){this.#r&&x("usb_selection_consumed"),this.#d&&(s=Math.min(s,this.#d-Date.now())),s<=0&&x("usb_read_timeout");let a;try{return await Promise.race([e(),new Promise((n,r)=>{a=setTimeout(()=>{this.close().catch(()=>{}),r(new $e(i))},s)})])}finally{clearTimeout(a)}}async#u(e){let s="__CGS1_WEBUSB_OK_"+crypto.randomUUID().replaceAll("-","")+"__",i=`set -e
`+e+`
printf '\\n`+s+`\\n'
`,a=await this.#o(async()=>{let c=await this.#i.createSocket("shell:"+i);return this.#r&&(Promise.resolve(c.close()).catch(()=>{}),x("usb_selection_consumed")),c},5e3,"usb_read_timeout"),n=a.readable.getReader(),r=new Uint8Array(0);try{for(;;){let{value:c,done:l}=await this.#o(()=>n.read(),1e4,"usb_read_timeout");if(l)break;(!(c instanceof Uint8Array)||r.length+c.length>4096)&&x("usb_read_invalid");let _=new Uint8Array(r.length+c.length);_.set(r),_.set(c,r.length),r=_}}finally{n.releaseLock(),await this.#p(()=>a.close())}r.some(c=>c>127||c===0)&&x("usb_read_invalid");let o=new TextDecoder().decode(r).replaceAll(`\r
`,`
`),d=`
`+s+`
`;return o.endsWith(d)||x("usb_read_incomplete"),o.slice(0,-d.length).trim()}async#n(e,s,i){try{let a=await e;a||x("usb_selection_cancelled"),this.#r&&x("usb_selection_consumed"),this.#d=Date.now()+(s?24e4:6e4);let n=xi(a.serial,/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/);await this.#o(async()=>{let c=await a.connect();this.#r&&(Promise.allSettled([c.readable.cancel(),c.writable.close()]),x("usb_selection_consumed")),this.#a=c},5e3,"usb_connect_timeout");let r=await this.#o(async()=>{let c=await this.#e.authenticate({serial:n,connection:this.#a,credentialStore:this.#e.ephemeralCredentials(),initialDelayedAckBytes:0,readTimeLimit:1e4});return this.#r&&(Promise.resolve(c.close()).catch(()=>{}),x("usb_selection_consumed")),c},15e3,"usb_auth_timeout");this.#i=this.#e.createClient(r);let o={};for(let c of this.#t.identity)o[c.name]=await this.#u(c.command);(o.uid!=="0"||o.arch!=="armv7l"||o.version!=="CLEARGRASS_VERSION=4.1.8_0287"||!["2","3"].includes(o.co2_type))&&x("usb_profile_unsupported"),xi(o.wlan_mac,/^[0-9a-f]{2}(?::[0-9a-f]{2}){5}$/),(parseInt(o.wlan_mac.slice(0,2),16)&1||o.wlan_mac==="00:00:00:00:00:00")&&x("usb_identity_invalid"),xi(o.boot_id,/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);for(let c of this.#t.files){let l=await this.#u(c.command);ze(l,c)||x("usb_stock_unverified")}await this.#u(this.#t.absent_install)!==""&&x("usb_existing_installation"),(await this.#u("cat /proc/sys/kernel/random/boot_id")!==o.boot_id||await this.#u("cat /sys/class/net/wlan0/address")!==o.wlan_mac)&&x("usb_selection_changed");let d={model:"CGS1",stock_version:"4.1.8_0287",co2_type:Number(o.co2_type),wlan_mac:o.wlan_mac,boot_id:o.boot_id,transport:"browser_usb",source_checked:!0,installation_ready:!1};return s&&(d.archive=await this.#_(n,o,i)),d}catch(a){throw a instanceof $e?a:new $e("usb_probe_failed")}finally{await this.close()}}async#_(e,s,i){let a=new Map;(this.#t.files.length!==9||this.#t.files.reduce((o,d)=>o+d.size,0)>32*1024*1024)&&x("usb_capture_unverified");let n=await this.#o(async()=>{let o=await this.#i.sync();return this.#r&&(Promise.resolve(o.dispose()).catch(()=>{}),x("usb_selection_consumed")),o},5e3,"usb_read_timeout");try{i(0,this.#t.files.length);for(let o of this.#t.files){let d=n.read(o.path).getReader(),c=new Uint8Array(o.size),l=0;try{for(;;){let{value:u,done:h}=await this.#o(()=>d.read(),3e4,"usb_read_timeout");if(h)break;(!(u instanceof Uint8Array)||l+u.length>c.length)&&x("usb_capture_unverified"),c.set(u,l),l+=u.length}}finally{d.releaseLock()}l!==o.size&&x("usb_capture_unverified"),[...new Uint8Array(await crypto.subtle.digest("SHA-256",c))].map(u=>u.toString(16).padStart(2,"0")).join("")!==o.sha256&&x("usb_capture_unverified"),a.set(o.path,c),i(a.size,this.#t.files.length)}}finally{await this.#p(()=>n.dispose())}for(let o of this.#t.files)ze(await this.#u(o.command),o)||x("usb_capture_unverified");await this.#u(this.#t.absent_install)!==""&&x("usb_existing_installation");for(let o of this.#t.identity)await this.#u(o.command)!==s[o.name]&&x("usb_selection_changed");let r={schema_version:1,stage:"read_only_browser_capture_complete",hardware_contacted:!0,device_writes:0,installed:!1,installation_ready:!1,usb_serial:e,transport:"browser_usb",wlan_mac:s.wlan_mac,boot_id:s.boot_id,co2_type:Number(s.co2_type),stock_version:"4.1.8_0287",files:Object.fromEntries(this.#t.files.map(o=>[o.path,{sha256:o.sha256,size:o.size}])),limitations:["Fixed recovery/build files, not a NAND/user-data backup","Browser transport has no native ADB get-devpath; this archive is not a native USB plan","No installation, activation, fallback or boot test performed"]};return nn(this.#t,a,r)}async close(){this.#r=!0;let e=this.#i,s=this.#a;this.#i=this.#a=void 0,e?await this.#p(()=>e.close()):s&&await this.#p(async()=>{(await Promise.allSettled([s.readable.cancel(),s.writable.close()])).some(a=>a.status==="rejected")&&x("usb_close_unverified")})}async#p(e){let s;try{await Promise.race([Promise.resolve().then(e),new Promise((i,a)=>{s=setTimeout(()=>a(new $e("usb_close_unverified")),2e3)})])}catch{x("usb_close_unverified")}finally{clearTimeout(s)}}};var Gr={en:{browser_plan_not_started:"The private build is ready for a computer USB payload. This step keeps the browser capture separate and does not write to the monitor.",plan_browser_plan_prepared:"Computer USB files verified. Browser writing is still being integrated. Requested device free-space budget (not measured capacity):",plan_browser_plan_unverified:"Computer USB file preparation is unverified. Check the same job; do not repeat preparation.",plan_browser_plan_failed:"Computer USB file preparation failed. The inputs and log are preserved; no USB write occurred.",usb_browser_plan_unverified:"The computer USB file set is unverified. Preserve the job and check its status; no request is repeated.",usb_browser_plan_consumed:"Computer USB file preparation was already requested. Check the same job.",usb_browser_plan_build_required:"Build and verify this private firmware first.",usb_browser_plan_transport_required:"This file preparation belongs only to a computer USB job.",usb_browser_plan_source_required:"This older build cannot be joined to the browser installer. Its files and history are preserved.",browser_review:"Select and check the computer USB monitor",browser_review_running:"Reading the selected USB monitor and comparing it with this build\u2026",browser_review_verified:"The selected monitor matches this build. No files were written; browser installation is still being integrated.",browser_review_unverified:"The live USB check is unverified. The build is retained; no installation was started.",usb_browser_scope_unverified:"The selected USB monitor could not be verified against this exact build.",usb_browser_stage_unverified:"The USB write result is unverified. Preserve this job and read its status; do not repeat the write.",usb_browser_stage_consumed:"A write was already requested for this job. Read its status.",usb_browser_stage_review_required:"Review the selected monitor and installation changes first.",usb_browser_stage_space:"The selected monitor has insufficient verified free space for this build.",usb_browser_stage_previous_unverified:"A previous computer USB write is unverified. New writes are blocked; preserve its original job.",usb_channel_unverified:"The selected USB channel is unverified. Preserve this operation\u2019s history and do not repeat an installation.",enrollment_title:"Add to Home Assistant",enrollment_help:"Connect USB and keep the monitor on the same local network as HA. Checks its current address and encrypted identity, then adds the verified device through the standard ESPHome integration. Existing conflicts need manual review. This step does not flash or restart the monitor.",enrollment_ack:"Add this verified monitor to the ESPHome integration in this Home Assistant.",enrollment_start:"Add to Home Assistant",enrollment_status:"Read HA enrollment status",enrollment_running:"Reading the monitor address and native session, verifying the encrypted LAN connection and adding the ESPHome entry\u2026",enrollment_not_started:"The permanent interface was observed. You can now add this monitor to HA.",enrollment_created:"The monitor was added to the ESPHome integration. This saved result does not certify current device health.",enrollment_already_configured:"An exact matching ESPHome entry exists in this Home Assistant.",enrollment_conflict:"An ESPHome entry conflicts with this device identity, address or key. Review it in Settings \u2192 Devices & services \u2192 ESPHome; the wizard did not replace it.",enrollment_manual_flow_required:"The native ESPHome flow needs a manual decision. Open Settings \u2192 Devices & services \u2192 ESPHome. Do not repeat firmware installation.",enrollment_unverified:"HA enrollment could not be confirmed. Read status to check existing entries; no flow or firmware write will be repeated.",usb_enrollment_review_required:"Confirm adding this exact verified monitor to HA.",usb_enrollment_activation_required:"A verified permanent Full UI startup is required first.",usb_enrollment_consumed:"HA enrollment was already requested. Read its status.",usb_enrollment_unverified:"HA enrollment is unverified. Read status; do not repeat the request.",pm_title:"Prepare Full UI",pm_help:"Enables the stock software extension required for the full interface on the next ordinary boot. The current screen stays stock. Keep USB and power connected until the result; this step does not restart the monitor.",pm_ack:"I accept this experimental prerequisite and will power the monitor off and on after a confirmed result.",pm_start:"Prepare the next boot",pm_status:"Read prerequisite status",pm_running:"Checking the exact stock/bridge session, preparing its next boot and verifying the saved result. Do not disconnect USB or repeat the request.",pm_not_started:"Check Full UI prerequisites, then confirm this separate next-boot preparation if required.",pm_pm_extension_unverified:"The prerequisite outcome is unverified. Preserve this job and read its status. Do not repeat preparation or reboot during an uncertain write.",pm_pm_extension_armed_waiting_reboot:"Next-boot preparation was confirmed. If you have not powered the monitor off and on since this step, do that now. Then check Full UI prerequisites again. This saved result is not current runtime health.",usb_pm_extension_review_required:"Review the exact build and acknowledge the separate next-boot preparation.",usb_pm_extension_bridge_required:"This step requires a verified first bridge boot from a matching new build, before any Full UI attempt. Preserve older jobs; do not reset an installed monitor to reuse this wizard.",usb_pm_extension_unverified:"The prerequisite result is unverified. Read this job\u2019s status; do not repeat the write.",usb_pm_extension_consumed:"Prerequisite preparation was already requested. Read its saved status instead of repeating it.",usb_pm_extension_previous_unverified:"An earlier prerequisite write is unverified. Preserve and reconcile that operation before another device writer.",full_activation_title:"Keep the full interface",full_activation_help:"After a successful screen trial, saves this exact program pair to the monitor, enables startup and starts the full interface. Keep USB and power connected. This does not reboot the monitor or add it to Home Assistant.",full_activation_screen_ack:"I saw the trial screen and checked that the display and touch controls worked.",full_activation_ack:"I want to save this build and enable permanent full-interface startup. I understand that first installation is experimental.",full_activation_start:"Save and start the full interface",full_activation_status:"Read permanent-start status",full_activation_running:"Saving the matched pair and starting the full interface. Waiting for fresh physical readings and both guardians; this can take several minutes. No repeat launch will be sent.",full_activation_not_started:"The screen trial returned to stock. Check the display yourself, then choose whether to enable permanent startup.",full_activation_full_ui_active_observed:"The saved full interface started: physical core readings and both guardians were observed. Startup was enabled. This is recorded evidence, not a current health check. ESPHome enrollment in HA is still separate.",full_activation_full_ui_activation_unverified:"The permanent-start outcome is unverified. Preserve this job and read its status; do not repeat the request or reset its history.",full_activation_full_ui_activation_close_unverified:"Connection cleanup is unverified. Preserve this job; do not repeat the permanent-start request.",full_activation_full_ui_activation_space:"The monitor has insufficient measured storage space. No program copy or startup change was requested. Preserve this consumed attempt; do not remove files or retry it blindly.",usb_full_ui_activation_review_required:"Review this exact build, confirm the visible screen worked and separately accept permanent startup.",usb_full_ui_activation_trial_required:"A successful original screen trial with a verified return to stock is required first.",usb_full_ui_activation_unverified:"The permanent-start outcome could not be verified. Read saved status; do not repeat the request.",usb_full_ui_activation_consumed:"Permanent startup was already requested for this job. Read its status instead of starting it again.",usb_full_ui_activation_previous_unverified:"An earlier permanent-start operation is unverified. Preserve and reconcile its history before another device writer.",core_tools_title:"Prepare server tools",core_tools_help:"Included in this HACS integration. Downloads verified ADB/build tools into private HA storage; it does not install a separate app or start USB. The first setup needs internet and at least 6 GiB free.",core_tools_prepare:"Prepare tools",core_tools_required:"Server tools need preparation.",core_tools_preparing:"Downloading and verifying tools\u2026 This can take a few minutes.",core_tools_ready:"Server tools are ready.",usb_core_tools_failed:"Tool preparation failed. Check internet and free space. No device installation started.",usb_core_unsupported:"Server USB currently needs Home Assistant on Alpine 3.24, x86-64 or ARM64. Computer USB remains available.",usb_core_unverified:"The server result is uncertain. Read saved task status; do not repeat an installation.",usb_core_unavailable:"The integrated Monitor 1 worker is unavailable. Update the HACS integration.",usb_core_storage_unverified:"Private server storage could not be verified. Existing files were preserved.",language:"Language",intro:"Monitor 1 / CGS1 \u2014 experimental USB installation",prepare:"Prepare the monitor",enable:"On the stock monitor, enable ADB with #adb=on# in a Wi-Fi password field. Afterwards reconnect to your own Wi-Fi with its real password.",cable:"Connect a USB-C data cable to the computer or to the Home Assistant server, according to the option below.",boundary:"Connection checks and capture read identity and original files. Installation is a separate reviewed action below. Already modified or unknown stock variants are refused by the first-install path.",where:"Where is the cable connected?",transport:"USB connection",computer:"To this computer",server:"To the Home Assistant server",browser_help:"Chrome or Edge over HTTPS. The browser will ask you to select the USB device.",ha_help:"The integration reads the server's USB. Your browser needs no USB support or local cable.",scan:"Find USB devices",device:"Selected USB device",choose:"Choose a device",inspect:"Check USB connection",searching:"Looking for USB devices on the server\u2026",found:"USB devices found. Select the monitor.",no_devices:"No authorized USB ADB devices found. Check the cable and enable ADB on the monitor.",checking:"Checking the selected monitor\u2026",success:"Stock source checked. Firmware installation has not started.",capture:"Save original files",copying:"Copying and verifying original files\u2026",capture_help:"Downloads nine original recovery/build files to this computer. This is not a full device backup. Keep the archive private; it contains your device identity. Firmware installation does not start.",capture_success:"Original files verified and download started. Keep the archive for installation and recovery.",usb_capture_unverified:"The original-file copy could not be verified. No incomplete archive was offered. Nothing was installed.",prepare_install:"Prepare installation",friendly_name:"Device name",prepare_profile:"Prepare device profile",open_preparation:"Open preparation on Home Assistant",refresh_preparations:"Refresh saved preparations",saved_preparations:"Available saved preparations",choose_preparation:"Choose a saved preparation",preparation_pending:"Unverified",usb_job_list_failed:"Saved preparations could not be read. Existing files are preserved; refresh to check again.",preparation_help:"Creates a private profile on your Home Assistant server. Computer USB sends the verified original files to that server. The key stays private. You can then build firmware here; installation is a separate step.",build_firmware:"Build private firmware",check_build:"Check build status",build_help:"Builds on your HA server using one logical CPU at low priority. Requires at least 6 GiB free space and downloads public build tools. Private inputs stay on this server. Nothing is written to the monitor. A started build is never automatically repeated.",build_not_started:"Firmware has not been built yet.",build_building:"Building private firmware\u2026",build_phase_source:"Downloading the pinned public source.",build_phase_sdk:"Preparing build tools.",build_phase_compile:"Compiling the matched programs.",build_built_not_installed:"Private firmware built and its hashes verified. Choose the next step below; this build has not written anything to the monitor.",computer_install_title:"Install from this computer",computer_install_help:"Download this private build, then use its included macOS/Linux ADB installer and instructions. Compilation stays on HA; the computer needs Python and Android platform-tools, with no VM. Local preparation reads a new real USB capture before an explicitly reviewed installation. Browser-only WebUSB writing is still unfinished.",export_computer:"Download private computer installer",computer_downloaded:"Private installer download started. Read README.txt inside it before running the local commands. No monitor write was requested by this download.",usb_computer_after_install:"This HA job already has an installation attempt. Preserve its original receipts and use its status/recovery path; no second computer installer was exported.",usb_computer_package_limit:"The private bundle exceeds the bounded download budget. Existing files are preserved.",build_build_failed:"The build failed. Private inputs and logs are retained; the consumed build will not restart automatically.",build_build_unverified:"Build status is unverified. Check status again; do not start a replacement build.",usb_build_unverified:"Build status is unverified. Read the same job's status; the start request will not be repeated.",usb_build_consumed:"A build was already requested for this job. Check its status.",usb_build_space:"At least 6 GiB free space is required before starting. Existing jobs are preserved.",usb_build_busy:"Another private build holds the server's build slot. This job has not started.",prepare_plan:"Prepare installation files",check_plan:"Check installation files",plan_not_prepared:"The built programs can now be joined with verified original files. This only prepares a private payload; it does not write to USB.",plan_plan_prepared:"Installation files verified. Review the experimental server USB installation below. Requested device free-space budget (not measured capacity):",plan_plan_unverified:"Installation-file preparation is unverified. Read its status; do not repeat the request.",plan_plan_failed:"Installation-file preparation failed. Its inputs and private log are preserved; no USB write occurred.",plan_build_required:"A complete matched build is required first.",plan_browser_adapter_pending:"This installation-file step currently supports server USB only. Computer USB support is still being integrated; your profile and build are retained.",usb_plan_browser_pending:"This installation-file step is not available for computer USB yet. Your profile and build are retained.",usb_plan_build_required:"Build and verify this job's private firmware first.",usb_plan_consumed:"Installation-file preparation was already requested. Read its status.",usb_plan_unverified:"The private installation-file set is unverified. Read the same job's status; no request is replayed.",plan_used:"This payload belongs to a consumed installation request. It will not be used to repeat the write.",install_title:"Experimental installation with the stock screen",install_experimental:"The first installation through this wizard has not been physically qualified on an untouched monitor. Use only the exact CGS1 S8/SCD40 device shown below; keep USB access for recovery.",install_changes:"Creates a private ESPHome directory, saves the original startup files and changes two startup scripts. Runs the 60-second bounded bridge trial alongside the stock program. Only a verified stopped trial and completed transport cleanup allow the separately guarded next-boot autostart step. PM preload remains off; the full replacement UI is a later step.",install_power:"Keep USB and power connected until the result. If a response is lost, read status instead of repeating installation or rebooting during an unverified write.",install_ack:"I checked the selected device and reviewed these experimental installation steps.",install_firmware:"Run experimental installation",check_install:"Read operation status",observe_boot:"Check the monitor",install_not_started:"Review the selected monitor before starting.",install_running:"Experimental installation is running. Keep USB and power connected; the bounded trial and its result checks can take several minutes.",install_armed_waiting_reboot:"The operation verified the stopped trial and enabled next-boot autostart. Use Check the monitor for a fresh device check before the normal power cycle.",install_install_unverified:"The write outcome is unverified. Do not repeat installation or reboot during a possibly pending write. Read operation status or check the monitor; the original receipts are preserved.",install_bridge_observed:"ESPHome was verified after a new boot. Check the monitor again for a fresh observation.",boot_checking:"Reading the monitor's current boot and ESPHome state\u2026",boot_awaiting_reboot:"Autostart was checked on the current idle stock boot. Shut down through the stock menu, turn the monitor on again, keep USB connected, then check the monitor again.",boot_bridge_observed:"ESPHome was verified on a new boot with the expected running programs and fresh authenticated sensor updates.",boot_boot_unverified:"The monitor's state is unverified. Read the operation status; this check does not repeat installation or restart the monitor.",usb_install_review_required:"Read the current device review and confirm the experimental steps before starting.",usb_install_plan_required:"A verified private installation-file set is required first.",usb_install_consumed:"This installation request is already consumed. Read status; do not repeat it.",usb_install_previous_unverified:"An earlier installation remains unverified. Its original operation must be reconciled before starting another.",usb_install_host_space:"The HA server needs at least 512 MiB free for private installation records. No new installation request was started.",usb_install_unverified:"The installation outcome is unverified. Check the same job's status; do not repeat the write.",usb_boot_unverified:"The current boot observation is unverified. No installation or reboot was requested.",usb_observation_limit:"This job retains 64 read observations. Existing records are preserved; inspect them before another observation.",full_review_title:"Full replacement UI prerequisites",full_review:"Check Full UI prerequisites",full_review_help:"Reads the current authenticated bridge and its original stock preflight for this exact native/guardian pair. It does not enable the PM extension, upload, launch, reboot or change installation readiness.",full_review_reading:"Reading current Full UI prerequisites\u2026",full_review_pm_extension_required:"The initial bridge deliberately leaves the stock PM extension off. Full UI requires a separate verified extension transition; this check does not enable it.",full_review_full_ui_preflight_observed:"The current stock preflight passed for the exact build. This is a read observation, not an installation or launch. The full transition remains a separate step.",full_review_full_ui_unverified:"Full UI prerequisites are unverified. Existing programs and settings are preserved; this check grants no launch.",full_review_full_ui_close_unverified:"Read or connection cleanup is unverified. No Full UI activation was requested; keep the original operation history.",usb_full_ui_bridge_required:"Verify the installed bridge after its new boot before reading Full UI prerequisites.",usb_full_ui_unverified:"Full UI prerequisites could not be verified. No activation was requested.",usb_full_ui_close_unverified:"The exact read connection could not be confirmed closed. No activation was requested.",full_trial_title:"Try the full interface",full_trial_start:"Run a 60-second screen trial",full_trial_status:"Read screen-trial status",full_trial_help:"Uploads this build's two exact programs to RAM, shows the new interface for up to 60 seconds and observes its return to stock. The device guardians enforce the limit even if this page closes. Keep USB connected; this does not enable permanent startup.",full_trial_ack:"I understand this is an experimental screen trial, will watch the display and will keep the monitor powered and connected.",full_trial_running:"Uploading the matched pair, running the temporary interface and waiting for stock to return. This can take several minutes; no second launch will be sent.",full_trial_not_started:"First check Full UI prerequisites, then acknowledge and start the separate screen trial.",full_trial_full_ui_trial_returned_observed:"The new interface and fresh core sensor readiness were observed, then the stock bridge returned. Permanent startup was off when this trial ended. This is historical trial evidence, not completed installation.",full_trial_full_ui_trial_unverified:"The trial outcome is unverified. Preserve this job and read its status; do not repeat the launch or reset its history.",full_trial_full_ui_trial_close_unverified:"The trial connection or USB forward cleanup is unverified. Preserve the original operation history; no repeat launch is permitted.",full_trial_full_ui_trial_rebuild_required:"This bridge lacks the fixed screen-trial action. Its consumed request is preserved; do not retry this job.",usb_full_ui_trial_review_required:"Review the exact build and acknowledge the separate screen trial before starting.",usb_full_ui_trial_rebuild_required:"This job was built from an older source without the fixed screen trial. It stays unchanged; a new matching build is required. Do not reset an installed monitor to reuse this wizard.",usb_full_ui_trial_unverified:"The screen-trial outcome is unverified. Read the same job's status; do not repeat the write.",usb_full_ui_trial_close_unverified:"The screen-trial connection cleanup could not be verified. Preserve its history; do not repeat the launch.",usb_full_ui_trial_consumed:"This screen trial was already requested. Read its status; it cannot be started again.",usb_full_ui_trial_previous_unverified:"An earlier screen trial remains unverified. Preserve and reconcile that operation before another device writer.",private_backup_help:"Save private backups before installation. The profile contains your individual ESPHome encryption key; keep it private. Saved originals remain downloadable from this job after installation. They are a fixed recovery set, not a full device backup.",export_profile:"Download private ESPHome profile",export_originals:"Download saved original files",private_backup_downloaded:"Private backup download started. Keep it private; the profile contains the ESPHome encryption key.",usb_private_export_unverified:"The private backup could not be verified or downloaded. Existing job files are preserved.",preparing_profile:"Preparing the private device profile\u2026",profile_prepared:"The private device profile is ready.",check_preparation:"Check preparation status",usb_preparation_unverified:"Preparation is unverified. Check its status; the request will not be sent again automatically.",usb_profile_name_invalid:"Enter a printable device name up to 120 UTF-8 bytes, without slashes.",usb_job_limit:"The server retains eight preparation jobs. Existing data is preserved; cleanup through the wizard is not implemented yet.",usb_job_unavailable:"The preparation job is unavailable, incomplete or belongs to another user.",next:"Server USB and the downloaded computer ADB installer are experimental and await physical first-install QA. Browser-only WebUSB writing remains unfinished. The initial stock-extension transition is a separate reviewed next-boot step. Full UI requires its separate prerequisite, trial and permanent-start steps.",docs:"Experimental installation documentation",model:"Model",version:"Stock version",co2:"CO2 variant",mac:"WLAN identity",webusb_unavailable:"Use Chrome or Edge over HTTPS, or choose the server USB option.",usb_selection_cancelled:"No device selected.",usb_stock_unverified:"Stock files differ from the initial-install profile. An existing ESPHome installation needs its own update route.",usb_profile_unsupported:"This stock version, CO2 type or CPU is not admitted.",usb_busy:"Another USB check is in progress.",open_companion:"Open server USB check",usb_companion_unavailable:"Install the Qingping USB companion for server USB. The documentation link below explains how. Computer USB does not need it.",usb_companion_stopped:"Start the installed Qingping USB companion manually, then open the server USB check again.",usb_selection_consumed:"This selection was already checked. Discover devices again for a new read-only check.",usb_unauthorized:"Open the companion from Home Assistant as an administrator.",failed:"The USB check was incomplete. Nothing was installed. Check the cable, ADB and selected connection."},ru:{browser_plan_not_started:"\u041F\u0440\u0438\u0432\u0430\u0442\u043D\u0430\u044F \u0441\u0431\u043E\u0440\u043A\u0430 \u0433\u043E\u0442\u043E\u0432\u0430 \u0434\u043B\u044F \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0438 \u0444\u0430\u0439\u043B\u043E\u0432 USB \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440\u0430. \u042D\u0442\u043E\u0442 \u0448\u0430\u0433 \u0441\u043E\u0445\u0440\u0430\u043D\u044F\u0435\u0442 \u0434\u0430\u043D\u043D\u044B\u0435 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u043D\u043E\u0433\u043E \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044F \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E \u0438 \u043D\u0435 \u0437\u0430\u043F\u0438\u0441\u044B\u0432\u0430\u0435\u0442 \u0438\u0445 \u043D\u0430 \u043F\u0440\u0438\u0431\u043E\u0440.",plan_browser_plan_prepared:"\u0424\u0430\u0439\u043B\u044B \u0434\u043B\u044F USB \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440\u0430 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u044B. \u0417\u0430\u043F\u0438\u0441\u044C \u0438\u0437 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0430 \u0435\u0449\u0451 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0430\u0435\u0442\u0441\u044F. \u0417\u0430\u043F\u0440\u0430\u0448\u0438\u0432\u0430\u0435\u043C\u044B\u0439 \u0437\u0430\u043F\u0430\u0441 \u043C\u0435\u0441\u0442\u0430 \u043D\u0430 \u043F\u0440\u0438\u0431\u043E\u0440\u0435 (\u043D\u0435 \u0438\u0437\u043C\u0435\u0440\u0435\u043D\u043D\u0430\u044F \u0441\u0432\u043E\u0431\u043E\u0434\u043D\u0430\u044F \u043F\u0430\u043C\u044F\u0442\u044C):",plan_browser_plan_unverified:"\u041F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0430 \u0444\u0430\u0439\u043B\u043E\u0432 USB \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440\u0430 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0430. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0442\u043E \u0436\u0435 \u0437\u0430\u0434\u0430\u043D\u0438\u0435; \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439\u0442\u0435 \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0443.",plan_browser_plan_failed:"\u041F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0430 \u0444\u0430\u0439\u043B\u043E\u0432 USB \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440\u0430 \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u043B\u0430\u0441\u044C \u043E\u0448\u0438\u0431\u043A\u043E\u0439. \u0418\u0441\u0445\u043E\u0434\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435 \u0438 \u0436\u0443\u0440\u043D\u0430\u043B \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B; \u0437\u0430\u043F\u0438\u0441\u0438 \u0447\u0435\u0440\u0435\u0437 USB \u043D\u0435 \u0431\u044B\u043B\u043E.",usb_browser_plan_unverified:"\u041D\u0430\u0431\u043E\u0440 \u0444\u0430\u0439\u043B\u043E\u0432 USB \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440\u0430 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D. \u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u0437\u0430\u0434\u0430\u043D\u0438\u0435 \u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0435\u0433\u043E \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435; \u0437\u0430\u043F\u0440\u043E\u0441 \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0435\u0442\u0441\u044F.",usb_browser_plan_consumed:"\u041F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0430 \u0444\u0430\u0439\u043B\u043E\u0432 USB \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440\u0430 \u0443\u0436\u0435 \u0437\u0430\u043F\u0440\u043E\u0448\u0435\u043D\u0430. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0442\u043E \u0436\u0435 \u0437\u0430\u0434\u0430\u043D\u0438\u0435.",usb_browser_plan_build_required:"\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0441\u043E\u0431\u0435\u0440\u0438\u0442\u0435 \u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u044D\u0442\u0443 \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u0443\u044E \u043F\u0440\u043E\u0448\u0438\u0432\u043A\u0443.",usb_browser_plan_transport_required:"\u042D\u0442\u0430 \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0430 \u0444\u0430\u0439\u043B\u043E\u0432 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430 \u0442\u043E\u043B\u044C\u043A\u043E \u0434\u043B\u044F \u0437\u0430\u0434\u0430\u043D\u0438\u044F USB \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440\u0430.",usb_browser_plan_source_required:"\u042D\u0442\u0443 \u0441\u0442\u0430\u0440\u0443\u044E \u0441\u0431\u043E\u0440\u043A\u0443 \u043D\u0435\u043B\u044C\u0437\u044F \u043E\u0431\u044A\u0435\u0434\u0438\u043D\u0438\u0442\u044C \u0441 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u043D\u044B\u043C \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u0449\u0438\u043A\u043E\u043C. \u0415\u0451 \u0444\u0430\u0439\u043B\u044B \u0438 \u0438\u0441\u0442\u043E\u0440\u0438\u044F \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B.",browser_review:"\u0412\u044B\u0431\u0440\u0430\u0442\u044C \u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u043C\u043E\u043D\u0438\u0442\u043E\u0440 \u043F\u043E USB \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440\u0430",browser_review_running:"\u0427\u0438\u0442\u0430\u044E \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0439 USB-\u043C\u043E\u043D\u0438\u0442\u043E\u0440 \u0438 \u0441\u0432\u0435\u0440\u044F\u044E \u0435\u0433\u043E \u0441 \u044D\u0442\u043E\u0439 \u0441\u0431\u043E\u0440\u043A\u043E\u0439\u2026",browser_review_verified:"\u0412\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0439 \u043C\u043E\u043D\u0438\u0442\u043E\u0440 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u044D\u0442\u043E\u0439 \u0441\u0431\u043E\u0440\u043A\u0435. \u0424\u0430\u0439\u043B\u044B \u043D\u0435 \u0437\u0430\u043F\u0438\u0441\u044B\u0432\u0430\u043B\u0438\u0441\u044C; \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u043D\u0430\u044F \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u0435\u0449\u0451 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0430\u0435\u0442\u0441\u044F.",browser_review_unverified:"\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0436\u0438\u0432\u043E\u0433\u043E USB-\u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044F \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0430. \u0421\u0431\u043E\u0440\u043A\u0430 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0430; \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u043D\u0435 \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u043B\u0430\u0441\u044C.",usb_browser_scope_unverified:"\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044C \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u0435 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u0433\u043E USB-\u043C\u043E\u043D\u0438\u0442\u043E\u0440\u0430 \u044D\u0442\u043E\u0439 \u0441\u0431\u043E\u0440\u043A\u0435.",usb_browser_stage_unverified:"\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u0437\u0430\u043F\u0438\u0441\u0438 \u0447\u0435\u0440\u0435\u0437 USB \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D. \u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u044D\u0442\u043E \u0437\u0430\u0434\u0430\u043D\u0438\u0435 \u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0435\u0433\u043E \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435; \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439\u0442\u0435 \u0437\u0430\u043F\u0438\u0441\u044C.",usb_browser_stage_consumed:"\u0417\u0430\u043F\u0438\u0441\u044C \u0434\u043B\u044F \u044D\u0442\u043E\u0433\u043E \u0437\u0430\u0434\u0430\u043D\u0438\u044F \u0443\u0436\u0435 \u0437\u0430\u043F\u0440\u043E\u0448\u0435\u043D\u0430. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0435\u0451 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435.",usb_browser_stage_review_required:"\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0435 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0439 \u043C\u043E\u043D\u0438\u0442\u043E\u0440 \u0438 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F \u043F\u0440\u0438 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0435.",usb_browser_stage_space:"\u041D\u0430 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u043C \u043C\u043E\u043D\u0438\u0442\u043E\u0440\u0435 \u043D\u0435\u0434\u043E\u0441\u0442\u0430\u0442\u043E\u0447\u043D\u043E \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D\u043D\u043E\u0433\u043E \u0441\u0432\u043E\u0431\u043E\u0434\u043D\u043E\u0433\u043E \u043C\u0435\u0441\u0442\u0430 \u0434\u043B\u044F \u044D\u0442\u043E\u0439 \u0441\u0431\u043E\u0440\u043A\u0438.",usb_browser_stage_previous_unverified:"\u041F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0430\u044F \u0437\u0430\u043F\u0438\u0441\u044C \u0447\u0435\u0440\u0435\u0437 USB \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440\u0430 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0430. \u041D\u043E\u0432\u0430\u044F \u0437\u0430\u043F\u0438\u0441\u044C \u0437\u0430\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043D\u0430; \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u0438\u0441\u0445\u043E\u0434\u043D\u043E\u0435 \u0437\u0430\u0434\u0430\u043D\u0438\u0435.",usb_channel_unverified:"\u041A\u0430\u043D\u0430\u043B \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u0433\u043E USB-\u043F\u0440\u0438\u0431\u043E\u0440\u0430 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D. \u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u0438\u0441\u0442\u043E\u0440\u0438\u044E \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u0438 \u0438 \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439\u0442\u0435 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0443.",enrollment_title:"\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0432 Home Assistant",enrollment_help:"\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u0435 USB \u0438 \u043E\u0441\u0442\u0430\u0432\u044C\u0442\u0435 \u043C\u043E\u043D\u0438\u0442\u043E\u0440 \u0432 \u043E\u0434\u043D\u043E\u0439 \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u043E\u0439 \u0441\u0435\u0442\u0438 \u0441 HA. \u041C\u0430\u0441\u0442\u0435\u0440 \u043F\u0440\u043E\u0432\u0435\u0440\u0438\u0442 \u0442\u0435\u043A\u0443\u0449\u0438\u0439 \u0430\u0434\u0440\u0435\u0441 \u0438 \u0437\u0430\u0448\u0438\u0444\u0440\u043E\u0432\u0430\u043D\u043D\u043E\u0435 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435, \u0437\u0430\u0442\u0435\u043C \u0434\u043E\u0431\u0430\u0432\u0438\u0442 \u043F\u0440\u0438\u0431\u043E\u0440 \u0447\u0435\u0440\u0435\u0437 \u0448\u0442\u0430\u0442\u043D\u0443\u044E \u0438\u043D\u0442\u0435\u0433\u0440\u0430\u0446\u0438\u044E ESPHome. \u041A\u043E\u043D\u0444\u043B\u0438\u043A\u0442\u0443\u044E\u0449\u0438\u0435 \u0437\u0430\u043F\u0438\u0441\u0438 \u0442\u0440\u0435\u0431\u0443\u044E\u0442 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E\u0433\u043E \u0440\u0435\u0448\u0435\u043D\u0438\u044F. \u041F\u0440\u0438\u0431\u043E\u0440 \u043D\u0435 \u043F\u0440\u043E\u0448\u0438\u0432\u0430\u0435\u0442\u0441\u044F \u0438 \u043D\u0435 \u043F\u0435\u0440\u0435\u0437\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u0442\u0441\u044F.",enrollment_ack:"\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u044D\u0442\u043E\u0442 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043D\u044B\u0439 \u043C\u043E\u043D\u0438\u0442\u043E\u0440 \u0432 \u0438\u043D\u0442\u0435\u0433\u0440\u0430\u0446\u0438\u044E ESPHome \u044D\u0442\u043E\u0433\u043E Home Assistant.",enrollment_start:"\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0432 Home Assistant",enrollment_status:"\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u0432 HA",enrollment_running:"\u0427\u0438\u0442\u0430\u0435\u043C \u0430\u0434\u0440\u0435\u0441 \u0438 \u0442\u0435\u043A\u0443\u0449\u0443\u044E \u0441\u0435\u0441\u0441\u0438\u044E \u043F\u0440\u0438\u0431\u043E\u0440\u0430, \u043F\u0440\u043E\u0432\u0435\u0440\u044F\u0435\u043C \u0437\u0430\u0448\u0438\u0444\u0440\u043E\u0432\u0430\u043D\u043D\u043E\u0435 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u043F\u043E \u0441\u0435\u0442\u0438 \u0438 \u0434\u043E\u0431\u0430\u0432\u043B\u044F\u0435\u043C \u0437\u0430\u043F\u0438\u0441\u044C ESPHome\u2026",enrollment_not_started:"\u041F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u044B\u0439 \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441 \u0431\u044B\u043B \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D. \u0422\u0435\u043F\u0435\u0440\u044C \u043C\u043E\u0436\u043D\u043E \u0434\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u043C\u043E\u043D\u0438\u0442\u043E\u0440 \u0432 HA.",enrollment_created:"\u041C\u043E\u043D\u0438\u0442\u043E\u0440 \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D \u0432 \u0438\u043D\u0442\u0435\u0433\u0440\u0430\u0446\u0438\u044E ESPHome. \u0421\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0439 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0430\u0435\u0442 \u0442\u0435\u043A\u0443\u0449\u0443\u044E \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E\u0441\u0442\u044C \u043F\u0440\u0438\u0431\u043E\u0440\u0430.",enrollment_already_configured:"\u0412 \u044D\u0442\u043E\u043C Home Assistant \u0443\u0436\u0435 \u0435\u0441\u0442\u044C \u043F\u043E\u043B\u043D\u043E\u0441\u0442\u044C\u044E \u0441\u043E\u0432\u043F\u0430\u0434\u0430\u044E\u0449\u0430\u044F \u0437\u0430\u043F\u0438\u0441\u044C ESPHome.",enrollment_conflict:"\u0415\u0441\u0442\u044C \u043A\u043E\u043D\u0444\u043B\u0438\u043A\u0442 \u0437\u0430\u043F\u0438\u0441\u0438 ESPHome \u0441 \u0430\u0434\u0440\u0435\u0441\u043E\u043C, \u043A\u043B\u044E\u0447\u043E\u043C \u0438\u043B\u0438 \u0438\u0434\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0442\u043E\u0440\u043E\u043C \u043F\u0440\u0438\u0431\u043E\u0440\u0430. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0435\u0451 \u0432 \xAB\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u2192 \u0423\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430 \u0438 \u0441\u043B\u0443\u0436\u0431\u044B \u2192 ESPHome\xBB. \u041C\u0430\u0441\u0442\u0435\u0440 \u043D\u0435 \u0437\u0430\u043C\u0435\u043D\u0438\u043B \u0437\u0430\u043F\u0438\u0441\u044C.",enrollment_manual_flow_required:"\u0428\u0442\u0430\u0442\u043D\u0430\u044F \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430 ESPHome \u0442\u0440\u0435\u0431\u0443\u0435\u0442 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E\u0433\u043E \u0440\u0435\u0448\u0435\u043D\u0438\u044F. \u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \xAB\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u2192 \u0423\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430 \u0438 \u0441\u043B\u0443\u0436\u0431\u044B \u2192 ESPHome\xBB. \u041D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439\u0442\u0435 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0443 \u043F\u0440\u043E\u0448\u0438\u0432\u043A\u0438.",enrollment_unverified:"\u0414\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u0432 HA \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u043E. \u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0441\u0442\u0430\u0442\u0443\u0441\u0430 \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u0435\u0442 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0438\u0435 \u0437\u0430\u043F\u0438\u0441\u0438; \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430 \u0438 \u043F\u0440\u043E\u0448\u0438\u0432\u043A\u0430 \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u043E \u043D\u0435 \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u044E\u0442\u0441\u044F.",usb_enrollment_review_required:"\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0435 \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u0438\u043C\u0435\u043D\u043D\u043E \u044D\u0442\u043E\u0433\u043E \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043D\u043E\u0433\u043E \u043C\u043E\u043D\u0438\u0442\u043E\u0440\u0430 \u0432 HA.",usb_enrollment_activation_required:"\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u043D\u0443\u0436\u0435\u043D \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043D\u044B\u0439 \u043F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u044B\u0439 \u0437\u0430\u043F\u0443\u0441\u043A \u043F\u043E\u043B\u043D\u043E\u0433\u043E \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430.",usb_enrollment_consumed:"\u0414\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u0432 HA \u0443\u0436\u0435 \u0437\u0430\u043F\u0440\u0430\u0448\u0438\u0432\u0430\u043B\u043E\u0441\u044C. \u041F\u0440\u043E\u0447\u0438\u0442\u0430\u0439\u0442\u0435 \u0441\u0442\u0430\u0442\u0443\u0441.",usb_enrollment_unverified:"\u0414\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u0432 HA \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u043E. \u041F\u0440\u043E\u0447\u0438\u0442\u0430\u0439\u0442\u0435 \u0441\u0442\u0430\u0442\u0443\u0441, \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u044F \u0437\u0430\u043F\u0440\u043E\u0441.",pm_title:"\u041F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u0438\u0442\u044C \u043F\u043E\u043B\u043D\u044B\u0439 \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441",pm_help:"\u0412\u043A\u043B\u044E\u0447\u0438\u0442 \u0448\u0442\u0430\u0442\u043D\u043E\u0435 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u043D\u043E\u0435 \u0440\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u0435, \u043D\u0443\u0436\u043D\u043E\u0435 \u0434\u043B\u044F \u043F\u043E\u043B\u043D\u043E\u0433\u043E \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430, \u043D\u0430 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0443\u044E \u043E\u0431\u044B\u0447\u043D\u0443\u044E \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0443. \u0422\u0435\u043A\u0443\u0449\u0438\u0439 \u044D\u043A\u0440\u0430\u043D \u043E\u0441\u0442\u0430\u043D\u0435\u0442\u0441\u044F \u0448\u0442\u0430\u0442\u043D\u044B\u043C. \u0414\u043E \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0430 \u043E\u0441\u0442\u0430\u0432\u044C\u0442\u0435 USB \u0438 \u043F\u0438\u0442\u0430\u043D\u0438\u0435 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D\u043D\u044B\u043C\u0438; \u044D\u0442\u043E\u0442 \u0448\u0430\u0433 \u043D\u0435 \u043F\u0435\u0440\u0435\u0437\u0430\u043F\u0443\u0441\u043A\u0430\u0435\u0442 \u043F\u0440\u0438\u0431\u043E\u0440.",pm_ack:"\u0421\u043E\u0433\u043B\u0430\u0441\u0435\u043D \u043D\u0430 \u044D\u0442\u043E\u0442 \u044D\u043A\u0441\u043F\u0435\u0440\u0438\u043C\u0435\u043D\u0442\u0430\u043B\u044C\u043D\u044B\u0439 \u044D\u0442\u0430\u043F. \u041F\u043E\u0441\u043B\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D\u043D\u043E\u0433\u043E \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0430 \u043F\u043E\u043B\u043D\u043E\u0441\u0442\u044C\u044E \u0432\u044B\u043A\u043B\u044E\u0447\u0443 \u0438 \u0432\u043A\u043B\u044E\u0447\u0443 \u043F\u0440\u0438\u0431\u043E\u0440.",pm_start:"\u041F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u0438\u0442\u044C \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0443\u044E \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0443",pm_status:"\u041F\u0440\u043E\u0447\u0438\u0442\u0430\u0442\u044C \u0441\u0442\u0430\u0442\u0443\u0441 \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0438",pm_running:"\u041F\u0440\u043E\u0432\u0435\u0440\u044F\u044E \u0442\u043E\u0447\u043D\u044B\u0439 \u0441\u0435\u0430\u043D\u0441 \u0448\u0442\u0430\u0442\u043D\u043E\u0439 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u044B \u0438 bridge, \u043F\u043E\u0434\u0433\u043E\u0442\u0430\u0432\u043B\u0438\u0432\u0430\u044E \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0443\u044E \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0443 \u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u044F\u044E \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0439 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442. \u041D\u0435 \u043E\u0442\u043A\u043B\u044E\u0447\u0430\u0439\u0442\u0435 USB \u0438 \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439\u0442\u0435 \u0437\u0430\u043F\u0440\u043E\u0441.",pm_not_started:"\u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0443\u0441\u043B\u043E\u0432\u0438\u044F \u043F\u043E\u043B\u043D\u043E\u0433\u043E \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430, \u0437\u0430\u0442\u0435\u043C \u043F\u0440\u0438 \u043D\u0435\u043E\u0431\u0445\u043E\u0434\u0438\u043C\u043E\u0441\u0442\u0438 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0435 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u0443\u044E \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0443 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0435\u0439 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438.",pm_pm_extension_unverified:"\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0438 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D. \u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u0437\u0430\u0434\u0430\u043D\u0438\u0435 \u0438 \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u0439\u0442\u0435 \u0435\u0433\u043E \u0441\u0442\u0430\u0442\u0443\u0441. \u041D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439\u0442\u0435 \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0443 \u0438 \u043D\u0435 \u043F\u0435\u0440\u0435\u0437\u0430\u0433\u0440\u0443\u0436\u0430\u0439\u0442\u0435 \u043F\u0440\u0438\u0431\u043E\u0440 \u0432\u043E \u0432\u0440\u0435\u043C\u044F \u043D\u0435\u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0451\u043D\u043D\u043E\u0439 \u0437\u0430\u043F\u0438\u0441\u0438.",pm_pm_extension_armed_waiting_reboot:"\u041F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0430 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0435\u0439 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0430. \u0415\u0441\u043B\u0438 \u043F\u043E\u0441\u043B\u0435 \u044D\u0442\u043E\u0433\u043E \u0448\u0430\u0433\u0430 \u0435\u0449\u0451 \u043D\u0435 \u0432\u044B\u043A\u043B\u044E\u0447\u0430\u043B\u0438 \u043F\u0440\u0438\u0431\u043E\u0440 \u043F\u043E\u043B\u043D\u043E\u0441\u0442\u044C\u044E \u0438 \u043D\u0435 \u0432\u043A\u043B\u044E\u0447\u0430\u043B\u0438 \u043E\u0431\u0440\u0430\u0442\u043D\u043E, \u0441\u0434\u0435\u043B\u0430\u0439\u0442\u0435 \u044D\u0442\u043E \u0441\u0435\u0439\u0447\u0430\u0441. \u0417\u0430\u0442\u0435\u043C \u0441\u043D\u043E\u0432\u0430 \u043F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0443\u0441\u043B\u043E\u0432\u0438\u044F \u043F\u043E\u043B\u043D\u043E\u0433\u043E \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430. \u042D\u0442\u043E \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0439 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442, \u043D\u0435 \u0442\u0435\u043A\u0443\u0449\u0430\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0440\u0430\u0431\u043E\u0442\u044B.",usb_pm_extension_review_required:"\u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0442\u043E\u0447\u043D\u0443\u044E \u0441\u0431\u043E\u0440\u043A\u0443 \u0438 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0435 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u0443\u044E \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0443 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0435\u0439 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438.",usb_pm_extension_bridge_required:"\u041D\u0443\u0436\u043D\u0430 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D\u043D\u0430\u044F \u043F\u0435\u0440\u0432\u0430\u044F \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0430 bridge \u0438\u0437 \u043D\u043E\u0432\u043E\u0439 \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u043D\u043E\u0439 \u0441\u0431\u043E\u0440\u043A\u0438 \u0434\u043E \u043B\u044E\u0431\u043E\u0439 \u043F\u043E\u043F\u044B\u0442\u043A\u0438 \u043F\u043E\u043B\u043D\u043E\u0433\u043E \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430. \u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u0441\u0442\u0430\u0440\u044B\u0435 \u0437\u0430\u0434\u0430\u043D\u0438\u044F; \u043D\u0435 \u0441\u0431\u0440\u0430\u0441\u044B\u0432\u0430\u0439\u0442\u0435 \u0443\u0436\u0435 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u044B\u0439 \u043C\u043E\u043D\u0438\u0442\u043E\u0440 \u0440\u0430\u0434\u0438 \u044D\u0442\u043E\u0433\u043E \u043C\u0430\u0441\u0442\u0435\u0440\u0430.",usb_pm_extension_unverified:"\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0438 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D. \u041F\u0440\u043E\u0447\u0438\u0442\u0430\u0439\u0442\u0435 \u0441\u0442\u0430\u0442\u0443\u0441 \u044D\u0442\u043E\u0433\u043E \u0437\u0430\u0434\u0430\u043D\u0438\u044F; \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439\u0442\u0435 \u0437\u0430\u043F\u0438\u0441\u044C.",usb_pm_extension_consumed:"\u041F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0430 \u0443\u0436\u0435 \u0437\u0430\u043F\u0440\u0430\u0448\u0438\u0432\u0430\u043B\u0430\u0441\u044C. \u041F\u0440\u043E\u0447\u0438\u0442\u0430\u0439\u0442\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0439 \u0441\u0442\u0430\u0442\u0443\u0441 \u0432\u043C\u0435\u0441\u0442\u043E \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u043E\u0439 \u0437\u0430\u043F\u0438\u0441\u0438.",usb_pm_extension_previous_unverified:"\u041F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0430\u044F \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0430 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0430. \u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0438\u0441\u0445\u043E\u0434\u043D\u0443\u044E \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u044E \u043F\u0435\u0440\u0435\u0434 \u043D\u043E\u0432\u043E\u0439 \u0437\u0430\u043F\u0438\u0441\u044C\u044E \u043D\u0430 \u043F\u0440\u0438\u0431\u043E\u0440.",full_activation_title:"\u041E\u0441\u0442\u0430\u0432\u0438\u0442\u044C \u043F\u043E\u043B\u043D\u044B\u0439 \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441",full_activation_help:"\u041F\u043E\u0441\u043B\u0435 \u0443\u0441\u043F\u0435\u0448\u043D\u043E\u0439 \u043F\u0440\u043E\u0431\u044B \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442 \u044D\u0442\u0443 \u0442\u043E\u0447\u043D\u0443\u044E \u043F\u0430\u0440\u0443 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C \u043D\u0430 \u043F\u0440\u0438\u0431\u043E\u0440\u0435, \u0432\u043A\u043B\u044E\u0447\u0438\u0442 \u0430\u0432\u0442\u043E\u0437\u0430\u043F\u0443\u0441\u043A \u0438 \u0437\u0430\u043F\u0443\u0441\u0442\u0438\u0442 \u043F\u043E\u043B\u043D\u044B\u0439 \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441. \u041E\u0441\u0442\u0430\u0432\u044C\u0442\u0435 USB \u0438 \u043F\u0438\u0442\u0430\u043D\u0438\u0435 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D\u043D\u044B\u043C\u0438. \u041F\u0435\u0440\u0435\u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 \u0438 \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u0438\u044F \u0432 Home Assistant \u044D\u0442\u043E\u0442 \u0448\u0430\u0433 \u043D\u0435 \u0434\u0435\u043B\u0430\u0435\u0442.",full_activation_screen_ack:"\u042F \u0432\u0438\u0434\u0435\u043B \u043F\u0440\u043E\u0431\u043D\u044B\u0439 \u044D\u043A\u0440\u0430\u043D \u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u0438\u043B, \u0447\u0442\u043E \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435 \u0438 \u043A\u0430\u0441\u0430\u043D\u0438\u044F \u0440\u0430\u0431\u043E\u0442\u0430\u044E\u0442.",full_activation_ack:"\u0425\u043E\u0447\u0443 \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u044D\u0442\u0443 \u0441\u0431\u043E\u0440\u043A\u0443 \u0438 \u0432\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u043F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u044B\u0439 \u0437\u0430\u043F\u0443\u0441\u043A \u043F\u043E\u043B\u043D\u043E\u0433\u043E \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430. \u041F\u043E\u043D\u0438\u043C\u0430\u044E, \u0447\u0442\u043E \u043F\u0435\u0440\u0432\u0430\u044F \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u044D\u043A\u0441\u043F\u0435\u0440\u0438\u043C\u0435\u043D\u0442\u0430\u043B\u044C\u043D\u0430\u044F.",full_activation_start:"\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0438 \u0437\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u044C \u043F\u043E\u043B\u043D\u044B\u0439 \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441",full_activation_status:"\u041F\u0440\u043E\u0447\u0438\u0442\u0430\u0442\u044C \u0441\u0442\u0430\u0442\u0443\u0441 \u043F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u043E\u0433\u043E \u0437\u0430\u043F\u0443\u0441\u043A\u0430",full_activation_running:"\u0421\u043E\u0445\u0440\u0430\u043D\u044F\u044E \u043F\u0430\u0440\u0443 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C \u0438 \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u044E \u043F\u043E\u043B\u043D\u044B\u0439 \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441. \u0416\u0434\u0443 \u0441\u0432\u0435\u0436\u0438\u0445 \u043E\u0441\u043D\u043E\u0432\u043D\u044B\u0445 \u043F\u043E\u043A\u0430\u0437\u0430\u043D\u0438\u0439 \u0438 \u043E\u0431\u0435\u0438\u0445 \u0437\u0430\u0449\u0438\u0442\u043D\u044B\u0445 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C; \u044D\u0442\u043E \u043C\u043E\u0436\u0435\u0442 \u0437\u0430\u043D\u044F\u0442\u044C \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u043C\u0438\u043D\u0443\u0442. \u041F\u043E\u0432\u0442\u043E\u0440\u043D\u043E\u0439 \u043A\u043E\u043C\u0430\u043D\u0434\u044B \u0437\u0430\u043F\u0443\u0441\u043A\u0430 \u043D\u0435 \u0431\u0443\u0434\u0435\u0442.",full_activation_not_started:"\u041F\u043E\u0441\u043B\u0435 \u043F\u0440\u043E\u0431\u044B \u0432\u0435\u0440\u043D\u0443\u043B\u0441\u044F \u0448\u0442\u0430\u0442\u043D\u044B\u0439 \u0440\u0435\u0436\u0438\u043C. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u044D\u043A\u0440\u0430\u043D \u0441\u0430\u043C\u0438, \u0437\u0430\u0442\u0435\u043C \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u044B\u0439 \u0437\u0430\u043F\u0443\u0441\u043A.",full_activation_full_ui_active_observed:"\u0421\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0439 \u043F\u043E\u043B\u043D\u044B\u0439 \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441 \u0437\u0430\u043F\u0443\u0441\u0442\u0438\u043B\u0441\u044F: \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u044B \u043E\u0441\u043D\u043E\u0432\u043D\u044B\u0435 \u0444\u0438\u0437\u0438\u0447\u0435\u0441\u043A\u0438\u0435 \u043F\u043E\u043A\u0430\u0437\u0430\u043D\u0438\u044F \u0438 \u043E\u0431\u0435 \u0437\u0430\u0449\u0438\u0442\u043D\u044B\u0435 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u044B. \u0410\u0432\u0442\u043E\u0437\u0430\u043F\u0443\u0441\u043A \u0431\u044B\u043B \u0432\u043A\u043B\u044E\u0447\u0451\u043D. \u042D\u0442\u043E \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0439 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442, \u043D\u0435 \u0442\u0435\u043A\u0443\u0449\u0430\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0441\u0432\u044F\u0437\u0438. \u0414\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u0438\u0435 ESPHome \u0432 HA \u043E\u0441\u0442\u0430\u0451\u0442\u0441\u044F \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u043C \u0448\u0430\u0433\u043E\u043C.",full_activation_full_ui_activation_unverified:"\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u043F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u043E\u0433\u043E \u0437\u0430\u043F\u0443\u0441\u043A\u0430 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D. \u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u0437\u0430\u0434\u0430\u043D\u0438\u0435 \u0438 \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u0439\u0442\u0435 \u0435\u0433\u043E \u0441\u0442\u0430\u0442\u0443\u0441; \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439\u0442\u0435 \u0437\u0430\u043F\u0440\u043E\u0441 \u0438 \u043D\u0435 \u0441\u0431\u0440\u0430\u0441\u044B\u0432\u0430\u0439\u0442\u0435 \u0438\u0441\u0442\u043E\u0440\u0438\u044E.",full_activation_full_ui_activation_close_unverified:"\u0417\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u0435 \u0441\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u044F \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u043E. \u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u0437\u0430\u0434\u0430\u043D\u0438\u0435; \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439\u0442\u0435 \u0437\u0430\u043F\u0440\u043E\u0441 \u043F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u043E\u0433\u043E \u0437\u0430\u043F\u0443\u0441\u043A\u0430.",full_activation_full_ui_activation_space:"\u041D\u0430 \u043F\u0440\u0438\u0431\u043E\u0440\u0435 \u043D\u0435\u0434\u043E\u0441\u0442\u0430\u0442\u043E\u0447\u043D\u043E \u0438\u0437\u043C\u0435\u0440\u0435\u043D\u043D\u043E\u0433\u043E \u0441\u0432\u043E\u0431\u043E\u0434\u043D\u043E\u0433\u043E \u043C\u0435\u0441\u0442\u0430. \u041A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C \u0438 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0435 \u0430\u0432\u0442\u043E\u0437\u0430\u043F\u0443\u0441\u043A\u0430 \u043D\u0435 \u0437\u0430\u043F\u0440\u0430\u0448\u0438\u0432\u0430\u043B\u0438\u0441\u044C. \u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u044D\u0442\u0443 \u043F\u043E\u043F\u044B\u0442\u043A\u0443; \u043D\u0435 \u0443\u0434\u0430\u043B\u044F\u0439\u0442\u0435 \u0444\u0430\u0439\u043B\u044B \u0438 \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439\u0442\u0435 \u0435\u0451 \u0432\u0441\u043B\u0435\u043F\u0443\u044E.",usb_full_ui_activation_review_required:"\u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0442\u043E\u0447\u043D\u0443\u044E \u0441\u0431\u043E\u0440\u043A\u0443, \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0435 \u0440\u0430\u0431\u043E\u0442\u0443 \u043F\u0440\u043E\u0431\u043D\u043E\u0433\u043E \u044D\u043A\u0440\u0430\u043D\u0430 \u0438 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E \u0441\u043E\u0433\u043B\u0430\u0441\u0438\u0442\u0435\u0441\u044C \u043D\u0430 \u043F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u044B\u0439 \u0437\u0430\u043F\u0443\u0441\u043A.",usb_full_ui_activation_trial_required:"\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u043D\u0443\u0436\u043D\u0430 \u0443\u0441\u043F\u0435\u0448\u043D\u0430\u044F \u0438\u0441\u0445\u043E\u0434\u043D\u0430\u044F \u043F\u0440\u043E\u0431\u0430 \u044D\u043A\u0440\u0430\u043D\u0430 \u0441 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D\u043D\u044B\u043C \u0432\u043E\u0437\u0432\u0440\u0430\u0442\u043E\u043C \u0432 \u0448\u0442\u0430\u0442\u043D\u044B\u0439 \u0440\u0435\u0436\u0438\u043C.",usb_full_ui_activation_unverified:"\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u043F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u043E\u0433\u043E \u0437\u0430\u043F\u0443\u0441\u043A\u0430 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D. \u041F\u0440\u043E\u0447\u0438\u0442\u0430\u0439\u0442\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0439 \u0441\u0442\u0430\u0442\u0443\u0441; \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439\u0442\u0435 \u0437\u0430\u043F\u0440\u043E\u0441.",usb_full_ui_activation_consumed:"\u041F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u044B\u0439 \u0437\u0430\u043F\u0443\u0441\u043A \u0434\u043B\u044F \u044D\u0442\u043E\u0433\u043E \u0437\u0430\u0434\u0430\u043D\u0438\u044F \u0443\u0436\u0435 \u0437\u0430\u043F\u0440\u0430\u0448\u0438\u0432\u0430\u043B\u0441\u044F. \u041F\u0440\u043E\u0447\u0438\u0442\u0430\u0439\u0442\u0435 \u0435\u0433\u043E \u0441\u0442\u0430\u0442\u0443\u0441 \u0432\u043C\u0435\u0441\u0442\u043E \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u043E\u0433\u043E \u0437\u0430\u043F\u0443\u0441\u043A\u0430.",usb_full_ui_activation_previous_unverified:"\u041F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0430\u044F \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u044F \u043F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u043E\u0433\u043E \u0437\u0430\u043F\u0443\u0441\u043A\u0430 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0430. \u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0435\u0451 \u0438\u0441\u0442\u043E\u0440\u0438\u044E \u043F\u0435\u0440\u0435\u0434 \u043D\u043E\u0432\u043E\u0439 \u0437\u0430\u043F\u0438\u0441\u044C\u044E \u043D\u0430 \u043F\u0440\u0438\u0431\u043E\u0440.",core_tools_title:"\u041F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0430",core_tools_help:"\u0412\u0441\u0451 \u0432\u0445\u043E\u0434\u0438\u0442 \u0432 \u044D\u0442\u0443 HACS-\u0438\u043D\u0442\u0435\u0433\u0440\u0430\u0446\u0438\u044E. \u041F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043D\u044B\u0435 ADB \u0438 \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u044B \u0441\u0431\u043E\u0440\u043A\u0438 \u0441\u043A\u0430\u0447\u0438\u0432\u0430\u044E\u0442\u0441\u044F \u0432 \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u043E\u0435 \u0445\u0440\u0430\u043D\u0438\u043B\u0438\u0449\u0435 HA. \u041E\u0442\u0434\u0435\u043B\u044C\u043D\u043E\u0435 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u043D\u0435 \u0443\u0441\u0442\u0430\u043D\u0430\u0432\u043B\u0438\u0432\u0430\u0435\u0442\u0441\u044F, USB \u0435\u0449\u0451 \u043D\u0435 \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u0435\u0442\u0441\u044F. \u0414\u043B\u044F \u043F\u0435\u0440\u0432\u043E\u0439 \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0438 \u043D\u0443\u0436\u043D\u044B \u0438\u043D\u0442\u0435\u0440\u043D\u0435\u0442 \u0438 \u043C\u0438\u043D\u0438\u043C\u0443\u043C 6 \u0413\u0438\u0411 \u0441\u0432\u043E\u0431\u043E\u0434\u043D\u043E\u0433\u043E \u043C\u0435\u0441\u0442\u0430.",core_tools_prepare:"\u041F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u0438\u0442\u044C \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u044B",core_tools_required:"\u041D\u0443\u0436\u043D\u043E \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u0438\u0442\u044C \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u044B \u0441\u0435\u0440\u0432\u0435\u0440\u0430.",core_tools_preparing:"\u0421\u043A\u0430\u0447\u0438\u0432\u0430\u044E \u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u044F\u044E \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u044B\u2026 \u042D\u0442\u043E \u043C\u043E\u0436\u0435\u0442 \u0437\u0430\u043D\u044F\u0442\u044C \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u043C\u0438\u043D\u0443\u0442.",core_tools_ready:"\u0418\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u044B \u0441\u0435\u0440\u0432\u0435\u0440\u0430 \u0433\u043E\u0442\u043E\u0432\u044B.",usb_core_tools_failed:"\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u0438\u0442\u044C \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u044B. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0438\u043D\u0442\u0435\u0440\u043D\u0435\u0442 \u0438 \u0441\u0432\u043E\u0431\u043E\u0434\u043D\u043E\u0435 \u043C\u0435\u0441\u0442\u043E. \u0423\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u043D\u0430 \u043F\u0440\u0438\u0431\u043E\u0440 \u043D\u0435 \u043D\u0430\u0447\u0438\u043D\u0430\u043B\u0430\u0441\u044C.",usb_core_unsupported:"USB \u0441\u0435\u0440\u0432\u0435\u0440\u0430 \u043F\u043E\u043A\u0430 \u0442\u0440\u0435\u0431\u0443\u0435\u0442 Home Assistant \u043D\u0430 Alpine 3.24, x86-64 \u0438\u043B\u0438 ARM64. USB \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440\u0430 \u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E.",usb_core_unverified:"\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u0438 \u0441\u0435\u0440\u0432\u0435\u0440\u0430 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D. \u041F\u0440\u043E\u0447\u0438\u0442\u0430\u0439\u0442\u0435 \u0441\u0442\u0430\u0442\u0443\u0441 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u043E\u0433\u043E \u0437\u0430\u0434\u0430\u043D\u0438\u044F, \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439\u0442\u0435 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0443.",usb_core_unavailable:"\u0412\u0441\u0442\u0440\u043E\u0435\u043D\u043D\u044B\u0439 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u0447\u0438\u043A Monitor 1 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D. \u041E\u0431\u043D\u043E\u0432\u0438\u0442\u0435 HACS-\u0438\u043D\u0442\u0435\u0433\u0440\u0430\u0446\u0438\u044E.",usb_core_storage_unverified:"\u041F\u0440\u0438\u0432\u0430\u0442\u043D\u043E\u0435 \u0445\u0440\u0430\u043D\u0438\u043B\u0438\u0449\u0435 \u0441\u0435\u0440\u0432\u0435\u0440\u0430 \u043D\u0435 \u043F\u0440\u043E\u0448\u043B\u043E \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0443. \u0421\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0438\u0435 \u0444\u0430\u0439\u043B\u044B \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B.",language:"\u042F\u0437\u044B\u043A",intro:"Monitor 1 / CGS1 \u2014 \u044D\u043A\u0441\u043F\u0435\u0440\u0438\u043C\u0435\u043D\u0442\u0430\u043B\u044C\u043D\u0430\u044F \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u0447\u0435\u0440\u0435\u0437 USB",prepare:"\u041F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u044C\u0442\u0435 \u043C\u043E\u043D\u0438\u0442\u043E\u0440",enable:"\u041D\u0430 \u0448\u0442\u0430\u0442\u043D\u043E\u043C \u043C\u043E\u043D\u0438\u0442\u043E\u0440\u0435 \u0432\u043A\u043B\u044E\u0447\u0438\u0442\u0435 ADB: \u0432\u0432\u0435\u0434\u0438\u0442\u0435 #adb=on# \u0432 \u043F\u043E\u043B\u0435 \u043F\u0430\u0440\u043E\u043B\u044F Wi-Fi. \u0417\u0430\u0442\u0435\u043C \u0432\u0435\u0440\u043D\u0438\u0442\u0435\u0441\u044C \u0432 \u0441\u0432\u043E\u044E \u0441\u0435\u0442\u044C \u0441 \u0435\u0451 \u043D\u0430\u0441\u0442\u043E\u044F\u0449\u0438\u043C \u043F\u0430\u0440\u043E\u043B\u0435\u043C.",cable:"\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u0435 USB-C \u043A\u0430\u0431\u0435\u043B\u0435\u043C \u0441 \u043F\u0435\u0440\u0435\u0434\u0430\u0447\u0435\u0439 \u0434\u0430\u043D\u043D\u044B\u0445 \u043A \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440\u0443 \u0438\u043B\u0438 \u0441\u0435\u0440\u0432\u0435\u0440\u0443 Home Assistant \u2014 \u0432 \u0437\u0430\u0432\u0438\u0441\u0438\u043C\u043E\u0441\u0442\u0438 \u043E\u0442 \u0432\u044B\u0431\u043E\u0440\u0430 \u043D\u0438\u0436\u0435.",boundary:"\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044F \u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u0435 \u0438\u0441\u0445\u043E\u0434\u043D\u044B\u0445 \u0444\u0430\u0439\u043B\u043E\u0432 \u0447\u0438\u0442\u0430\u044E\u0442 \u043F\u0440\u0438\u0431\u043E\u0440. \u0423\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u0432\u044B\u043F\u043E\u043B\u043D\u044F\u0435\u0442\u0441\u044F \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E \u043F\u043E\u0441\u043B\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u044F \u043D\u0438\u0436\u0435. \u0423\u0436\u0435 \u0438\u0437\u043C\u0435\u043D\u0451\u043D\u043D\u044B\u0435 \u0438 \u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0435 \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u044B \u043D\u0435 \u0434\u043E\u043F\u0443\u0441\u043A\u0430\u044E\u0442\u0441\u044F \u043A \u043F\u0435\u0440\u0432\u043E\u0439 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0435.",where:"\u041A\u0443\u0434\u0430 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D \u043A\u0430\u0431\u0435\u043B\u044C?",transport:"USB-\u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435",computer:"\u041A \u044D\u0442\u043E\u043C\u0443 \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440\u0443",server:"\u041A \u0441\u0435\u0440\u0432\u0435\u0440\u0443 Home Assistant",browser_help:"\u041D\u0443\u0436\u0435\u043D Chrome \u0438\u043B\u0438 Edge \u0438 HTTPS. \u0411\u0440\u0430\u0443\u0437\u0435\u0440 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0438\u0442 \u0432\u044B\u0431\u0440\u0430\u0442\u044C USB-\u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E.",ha_help:"\u0418\u043D\u0442\u0435\u0433\u0440\u0430\u0446\u0438\u044F \u0447\u0438\u0442\u0430\u0435\u0442 USB \u0441\u0435\u0440\u0432\u0435\u0440\u0430. \u041F\u043E\u0434\u0434\u0435\u0440\u0436\u043A\u0430 USB \u0432 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0435 \u0438 \u043A\u0430\u0431\u0435\u043B\u044C \u0443 \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440\u0430 \u043D\u0435 \u043D\u0443\u0436\u043D\u044B.",scan:"\u041D\u0430\u0439\u0442\u0438 USB-\u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430",device:"\u0412\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u0435 USB-\u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E",choose:"\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E",inspect:"\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C USB-\u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435",searching:"\u0418\u0449\u0443 USB-\u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430 \u043D\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0435\u2026",found:"USB-\u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430 \u043D\u0430\u0439\u0434\u0435\u043D\u044B. \u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043C\u043E\u043D\u0438\u0442\u043E\u0440.",no_devices:"\u0410\u0432\u0442\u043E\u0440\u0438\u0437\u043E\u0432\u0430\u043D\u043D\u044B\u0435 USB-\u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430 ADB \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u044B. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u043A\u0430\u0431\u0435\u043B\u044C \u0438 \u0432\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 ADB \u043D\u0430 \u043C\u043E\u043D\u0438\u0442\u043E\u0440\u0435.",checking:"\u041F\u0440\u043E\u0432\u0435\u0440\u044F\u044E \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0439 \u043C\u043E\u043D\u0438\u0442\u043E\u0440\u2026",success:"\u0428\u0442\u0430\u0442\u043D\u044B\u0435 \u0438\u0441\u0445\u043E\u0434\u043D\u044B\u0435 \u0444\u0430\u0439\u043B\u044B \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u044B. \u0423\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u043F\u0440\u043E\u0448\u0438\u0432\u043A\u0438 \u0435\u0449\u0451 \u043D\u0435 \u043D\u0430\u0447\u0430\u043B\u0430\u0441\u044C.",capture:"\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0438\u0441\u0445\u043E\u0434\u043D\u044B\u0435 \u0444\u0430\u0439\u043B\u044B",copying:"\u041A\u043E\u043F\u0438\u0440\u0443\u044E \u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u044F\u044E \u0438\u0441\u0445\u043E\u0434\u043D\u044B\u0435 \u0444\u0430\u0439\u043B\u044B\u2026",capture_help:"\u0421\u043A\u0430\u0447\u0438\u0432\u0430\u0435\u0442 \u043D\u0430 \u044D\u0442\u043E\u0442 \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440 \u0434\u0435\u0432\u044F\u0442\u044C \u0438\u0441\u0445\u043E\u0434\u043D\u044B\u0445 \u0444\u0430\u0439\u043B\u043E\u0432 \u0434\u043B\u044F \u0441\u0431\u043E\u0440\u043A\u0438 \u0438 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F. \u042D\u0442\u043E \u043D\u0435 \u043F\u043E\u043B\u043D\u0430\u044F \u0440\u0435\u0437\u0435\u0440\u0432\u043D\u0430\u044F \u043A\u043E\u043F\u0438\u044F \u043F\u0440\u0438\u0431\u043E\u0440\u0430. \u0425\u0440\u0430\u043D\u0438\u0442\u0435 \u0430\u0440\u0445\u0438\u0432 \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u043E: \u043E\u043D \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u0438\u0434\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0442\u043E\u0440\u044B \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430. \u0423\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u043F\u0440\u043E\u0448\u0438\u0432\u043A\u0438 \u043D\u0435 \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u0435\u0442\u0441\u044F.",capture_success:"\u0418\u0441\u0445\u043E\u0434\u043D\u044B\u0435 \u0444\u0430\u0439\u043B\u044B \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u044B, \u0441\u043A\u0430\u0447\u0438\u0432\u0430\u043D\u0438\u0435 \u043D\u0430\u0447\u0430\u043B\u043E\u0441\u044C. \u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u0430\u0440\u0445\u0438\u0432 \u0434\u043B\u044F \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438 \u0438 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F.",usb_capture_unverified:"\u041A\u043E\u043F\u0438\u044E \u0438\u0441\u0445\u043E\u0434\u043D\u044B\u0445 \u0444\u0430\u0439\u043B\u043E\u0432 \u043D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C. \u041D\u0435\u043F\u043E\u043B\u043D\u044B\u0439 \u0430\u0440\u0445\u0438\u0432 \u043D\u0435 \u043F\u0440\u0435\u0434\u043B\u0430\u0433\u0430\u043B\u0441\u044F. \u041F\u0440\u043E\u0448\u0438\u0432\u043A\u0430 \u043D\u0435 \u0443\u0441\u0442\u0430\u043D\u0430\u0432\u043B\u0438\u0432\u0430\u043B\u0430\u0441\u044C.",prepare_install:"\u041F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0430 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438",friendly_name:"\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430",prepare_profile:"\u041F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u0438\u0442\u044C \u043F\u0440\u043E\u0444\u0438\u043B\u044C \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430",open_preparation:"\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0443 \u043D\u0430 Home Assistant",refresh_preparations:"\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0435 \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0438",saved_preparations:"\u0414\u043E\u0441\u0442\u0443\u043F\u043D\u044B\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0435 \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0438",choose_preparation:"\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u0443\u044E \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0443",preparation_pending:"\u041D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u043E",usb_job_list_failed:"\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u0442\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0435 \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0438. \u041F\u0440\u0435\u0436\u043D\u0438\u0435 \u0444\u0430\u0439\u043B\u044B \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B; \u043E\u0431\u043D\u043E\u0432\u0438\u0442\u0435 \u0441\u043F\u0438\u0441\u043E\u043A \u0434\u043B\u044F \u043D\u043E\u0432\u043E\u0439 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438.",preparation_help:"\u0421\u043E\u0437\u0434\u0430\u0451\u0442 \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u044B\u0439 \u043F\u0440\u043E\u0444\u0438\u043B\u044C \u043D\u0430 \u0432\u0430\u0448\u0435\u043C \u0441\u0435\u0440\u0432\u0435\u0440\u0435 Home Assistant. \u041F\u0440\u0438 USB \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440\u0430 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043D\u044B\u0435 \u0438\u0441\u0445\u043E\u0434\u043D\u044B\u0435 \u0444\u0430\u0439\u043B\u044B \u043F\u0435\u0440\u0435\u0434\u0430\u044E\u0442\u0441\u044F \u044D\u0442\u043E\u043C\u0443 \u0441\u0435\u0440\u0432\u0435\u0440\u0443. \u041A\u043B\u044E\u0447 \u043E\u0441\u0442\u0430\u0451\u0442\u0441\u044F \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u044B\u043C. \u0417\u0430\u0442\u0435\u043C \u0437\u0434\u0435\u0441\u044C \u043C\u043E\u0436\u043D\u043E \u0441\u043E\u0431\u0440\u0430\u0442\u044C \u043F\u0440\u043E\u0448\u0438\u0432\u043A\u0443; \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u0432\u044B\u043F\u043E\u043B\u043D\u044F\u0435\u0442\u0441\u044F \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E.",build_firmware:"\u0421\u043E\u0431\u0440\u0430\u0442\u044C \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u0443\u044E \u043F\u0440\u043E\u0448\u0438\u0432\u043A\u0443",check_build:"\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u0441\u0431\u043E\u0440\u043A\u0443",build_help:"\u0421\u0431\u043E\u0440\u043A\u0430 \u0432\u044B\u043F\u043E\u043B\u043D\u044F\u0435\u0442\u0441\u044F \u043D\u0430 HA-\u0441\u0435\u0440\u0432\u0435\u0440\u0435 \u043D\u0430 \u043E\u0434\u043D\u043E\u043C \u043B\u043E\u0433\u0438\u0447\u0435\u0441\u043A\u043E\u043C \u044F\u0434\u0440\u0435 \u0441 \u043F\u043E\u043D\u0438\u0436\u0435\u043D\u043D\u044B\u043C \u043F\u0440\u0438\u043E\u0440\u0438\u0442\u0435\u0442\u043E\u043C. \u041D\u0443\u0436\u043D\u044B \u043C\u0438\u043D\u0438\u043C\u0443\u043C 6 \u0413\u0438\u0411 \u0441\u0432\u043E\u0431\u043E\u0434\u043D\u043E\u0433\u043E \u043C\u0435\u0441\u0442\u0430 \u0438 \u0441\u043A\u0430\u0447\u0438\u0432\u0430\u043D\u0438\u0435 \u043F\u0443\u0431\u043B\u0438\u0447\u043D\u044B\u0445 \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u043E\u0432 \u0441\u0431\u043E\u0440\u043A\u0438. \u041F\u0440\u0438\u0432\u0430\u0442\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435 \u043E\u0441\u0442\u0430\u044E\u0442\u0441\u044F \u043D\u0430 \u044D\u0442\u043E\u043C \u0441\u0435\u0440\u0432\u0435\u0440\u0435. \u041D\u0430 \u043C\u043E\u043D\u0438\u0442\u043E\u0440 \u043D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u0437\u0430\u043F\u0438\u0441\u044B\u0432\u0430\u0435\u0442\u0441\u044F. \u041D\u0430\u0447\u0430\u0442\u0430\u044F \u0441\u0431\u043E\u0440\u043A\u0430 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438 \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0435\u0442\u0441\u044F.",build_not_started:"\u041F\u0440\u043E\u0448\u0438\u0432\u043A\u0430 \u0435\u0449\u0451 \u043D\u0435 \u0441\u043E\u0431\u0440\u0430\u043D\u0430.",build_building:"\u0421\u043E\u0431\u0438\u0440\u0430\u044E \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u0443\u044E \u043F\u0440\u043E\u0448\u0438\u0432\u043A\u0443\u2026",build_phase_source:"\u0421\u043A\u0430\u0447\u0438\u0432\u0430\u044E \u0437\u0430\u043A\u0440\u0435\u043F\u043B\u0451\u043D\u043D\u0443\u044E \u0432\u0435\u0440\u0441\u0438\u044E \u0438\u0441\u0445\u043E\u0434\u043D\u0438\u043A\u043E\u0432.",build_phase_sdk:"\u041F\u043E\u0434\u0433\u043E\u0442\u0430\u0432\u043B\u0438\u0432\u0430\u044E \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u044B \u0441\u0431\u043E\u0440\u043A\u0438.",build_phase_compile:"\u041A\u043E\u043C\u043F\u0438\u043B\u0438\u0440\u0443\u044E \u0441\u0432\u044F\u0437\u0430\u043D\u043D\u044B\u0435 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u044B.",build_built_not_installed:"\u041F\u0440\u0438\u0432\u0430\u0442\u043D\u0430\u044F \u043F\u0440\u043E\u0448\u0438\u0432\u043A\u0430 \u0441\u043E\u0431\u0440\u0430\u043D\u0430, \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u044C\u043D\u044B\u0435 \u0441\u0443\u043C\u043C\u044B \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u044B. \u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 \u0448\u0430\u0433 \u043D\u0438\u0436\u0435; \u0441\u0431\u043E\u0440\u043A\u0430 \u043D\u0438\u0447\u0435\u0433\u043E \u043D\u0430 \u043C\u043E\u043D\u0438\u0442\u043E\u0440 \u043D\u0435 \u0437\u0430\u043F\u0438\u0441\u044B\u0432\u0430\u043B\u0430.",computer_install_title:"\u0423\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u0447\u0435\u0440\u0435\u0437 \u044D\u0442\u043E\u0442 \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440",computer_install_help:"\u0421\u043A\u0430\u0447\u0430\u0439\u0442\u0435 \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u0443\u044E \u0441\u0431\u043E\u0440\u043A\u0443, \u0437\u0430\u0442\u0435\u043C \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439\u0442\u0435 \u0432\u043B\u043E\u0436\u0435\u043D\u043D\u044B\u0439 ADB-\u0443\u0441\u0442\u0430\u043D\u043E\u0432\u0449\u0438\u043A \u0434\u043B\u044F macOS/Linux \u0438 \u0438\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0438\u044E. \u0421\u0431\u043E\u0440\u043A\u0430 \u043E\u0441\u0442\u0430\u0451\u0442\u0441\u044F \u043D\u0430 HA; \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440\u0443 \u043D\u0443\u0436\u043D\u044B Python \u0438 Android platform-tools, \u0431\u0435\u0437 VM. \u041B\u043E\u043A\u0430\u043B\u044C\u043D\u0430\u044F \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0430 \u0437\u0430\u043D\u043E\u0432\u043E \u0447\u0438\u0442\u0430\u0435\u0442 \u043D\u0430\u0441\u0442\u043E\u044F\u0449\u0438\u0439 USB \u043F\u0435\u0440\u0435\u0434 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u043E\u0439 \u043F\u043E\u0441\u043B\u0435 \u044F\u0432\u043D\u043E\u0439 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438. \u0417\u0430\u043F\u0438\u0441\u044C \u0442\u043E\u043B\u044C\u043A\u043E \u0438\u0437 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0430 \u0447\u0435\u0440\u0435\u0437 WebUSB \u0435\u0449\u0451 \u043D\u0435 \u0433\u043E\u0442\u043E\u0432\u0430.",export_computer:"\u0421\u043A\u0430\u0447\u0430\u0442\u044C \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u044B\u0439 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u0449\u0438\u043A \u0434\u043B\u044F \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440\u0430",computer_downloaded:"\u041D\u0430\u0447\u0430\u043B\u043E\u0441\u044C \u0441\u043A\u0430\u0447\u0438\u0432\u0430\u043D\u0438\u0435 \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u043E\u0433\u043E \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u0449\u0438\u043A\u0430. \u041F\u0440\u043E\u0447\u0438\u0442\u0430\u0439\u0442\u0435 README.txt \u0432\u043D\u0443\u0442\u0440\u0438 \u043F\u0435\u0440\u0435\u0434 \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u044B\u043C\u0438 \u043A\u043E\u043C\u0430\u043D\u0434\u0430\u043C\u0438. \u0421\u0430\u043C\u043E \u0441\u043A\u0430\u0447\u0438\u0432\u0430\u043D\u0438\u0435 \u043D\u0438\u0447\u0435\u0433\u043E \u043D\u0430 \u043C\u043E\u043D\u0438\u0442\u043E\u0440 \u043D\u0435 \u0437\u0430\u043F\u0438\u0441\u044B\u0432\u0430\u0435\u0442.",usb_computer_after_install:"\u0412 \u044D\u0442\u043E\u043C \u0437\u0430\u0434\u0430\u043D\u0438\u0438 HA \u0443\u0436\u0435 \u0431\u044B\u043B\u0430 \u043F\u043E\u043F\u044B\u0442\u043A\u0430 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438. \u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u0435\u0451 \u0438\u0441\u0445\u043E\u0434\u043D\u044B\u0435 \u0437\u0430\u043F\u0438\u0441\u0438 \u0438 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439\u0442\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0443 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0430 \u0438\u043B\u0438 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435; \u0432\u0442\u043E\u0440\u043E\u0439 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u0449\u0438\u043A \u0434\u043B\u044F \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440\u0430 \u043D\u0435 \u0432\u044B\u0434\u0430\u043D.",usb_computer_package_limit:"\u041F\u0440\u0438\u0432\u0430\u0442\u043D\u044B\u0439 \u043D\u0430\u0431\u043E\u0440 \u043F\u0440\u0435\u0432\u044B\u0448\u0430\u0435\u0442 \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0435\u043D\u0438\u0435 \u0441\u043A\u0430\u0447\u0438\u0432\u0430\u043D\u0438\u044F. \u0421\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0438\u0435 \u0444\u0430\u0439\u043B\u044B \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B.",build_build_failed:"\u0421\u0431\u043E\u0440\u043A\u0430 \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u043B\u0430\u0441\u044C \u043E\u0448\u0438\u0431\u043A\u043E\u0439. \u041F\u0440\u0438\u0432\u0430\u0442\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435 \u0438 \u0436\u0443\u0440\u043D\u0430\u043B \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B; \u043D\u0430\u0447\u0430\u0442\u0430\u044F \u0441\u0431\u043E\u0440\u043A\u0430 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438 \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u0441\u044F.",build_build_unverified:"\u0421\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \u0441\u0431\u043E\u0440\u043A\u0438 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u043E. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0435\u0433\u043E \u0435\u0449\u0451 \u0440\u0430\u0437; \u043D\u0435 \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u0439\u0442\u0435 \u0437\u0430\u043C\u0435\u043D\u044F\u044E\u0449\u0443\u044E \u0441\u0431\u043E\u0440\u043A\u0443.",usb_build_unverified:"\u0421\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \u0441\u0431\u043E\u0440\u043A\u0438 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u043E. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0442\u043E \u0436\u0435 \u0437\u0430\u0434\u0430\u043D\u0438\u0435; \u0437\u0430\u043F\u0440\u043E\u0441 \u0437\u0430\u043F\u0443\u0441\u043A\u0430 \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0435\u0442\u0441\u044F.",usb_build_consumed:"\u0421\u0431\u043E\u0440\u043A\u0430 \u0434\u043B\u044F \u044D\u0442\u043E\u0433\u043E \u0437\u0430\u0434\u0430\u043D\u0438\u044F \u0443\u0436\u0435 \u0437\u0430\u043F\u0440\u043E\u0448\u0435\u043D\u0430. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0435\u0451 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435.",usb_build_space:"\u0414\u043B\u044F \u0437\u0430\u043F\u0443\u0441\u043A\u0430 \u043D\u0443\u0436\u043D\u044B \u043C\u0438\u043D\u0438\u043C\u0443\u043C 6 \u0413\u0438\u0411 \u0441\u0432\u043E\u0431\u043E\u0434\u043D\u043E\u0433\u043E \u043C\u0435\u0441\u0442\u0430. \u041F\u0440\u0435\u0436\u043D\u0438\u0435 \u0437\u0430\u0434\u0430\u043D\u0438\u044F \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B.",usb_build_busy:"\u041D\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0435 \u0443\u0436\u0435 \u0432\u044B\u043F\u043E\u043B\u043D\u044F\u0435\u0442\u0441\u044F \u0434\u0440\u0443\u0433\u0430\u044F \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u0430\u044F \u0441\u0431\u043E\u0440\u043A\u0430. \u042D\u0442\u043E \u0437\u0430\u0434\u0430\u043D\u0438\u0435 \u0435\u0449\u0451 \u043D\u0435 \u0437\u0430\u043F\u0443\u0449\u0435\u043D\u043E.",prepare_plan:"\u041F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u0438\u0442\u044C \u0444\u0430\u0439\u043B\u044B \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438",check_plan:"\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u0444\u0430\u0439\u043B\u044B \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438",plan_not_prepared:"\u0413\u043E\u0442\u043E\u0432\u044B\u0435 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u044B \u043C\u043E\u0436\u043D\u043E \u043E\u0431\u044A\u0435\u0434\u0438\u043D\u0438\u0442\u044C \u0441 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043D\u044B\u043C\u0438 \u0438\u0441\u0445\u043E\u0434\u043D\u044B\u043C\u0438 \u0444\u0430\u0439\u043B\u0430\u043C\u0438. \u042D\u0442\u043E\u0442 \u0448\u0430\u0433 \u0442\u043E\u043B\u044C\u043A\u043E \u0441\u043E\u0437\u0434\u0430\u0451\u0442 \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u044B\u0439 \u043D\u0430\u0431\u043E\u0440; \u0437\u0430\u043F\u0438\u0441\u0438 \u0447\u0435\u0440\u0435\u0437 USB \u043D\u0435\u0442.",plan_plan_prepared:"\u0424\u0430\u0439\u043B\u044B \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u044B. \u041D\u0438\u0436\u0435 \u043C\u043E\u0436\u043D\u043E \u043F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u0438 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044C \u044D\u043A\u0441\u043F\u0435\u0440\u0438\u043C\u0435\u043D\u0442\u0430\u043B\u044C\u043D\u0443\u044E \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0443 \u0447\u0435\u0440\u0435\u0437 USB \u0441\u0435\u0440\u0432\u0435\u0440\u0430. \u0417\u0430\u043F\u0440\u0430\u0448\u0438\u0432\u0430\u0435\u043C\u044B\u0439 \u0437\u0430\u043F\u0430\u0441 \u043C\u0435\u0441\u0442\u0430 \u043D\u0430 \u043F\u0440\u0438\u0431\u043E\u0440\u0435 (\u043D\u0435 \u0438\u0437\u043C\u0435\u0440\u0435\u043D\u043D\u0430\u044F \u0441\u0432\u043E\u0431\u043E\u0434\u043D\u0430\u044F \u043F\u0430\u043C\u044F\u0442\u044C):",plan_plan_unverified:"\u041F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0430 \u0444\u0430\u0439\u043B\u043E\u0432 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0430. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0435\u0451 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435; \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439\u0442\u0435 \u0437\u0430\u043F\u0440\u043E\u0441.",plan_plan_failed:"\u041F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0430 \u0444\u0430\u0439\u043B\u043E\u0432 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438 \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u043B\u0430\u0441\u044C \u043E\u0448\u0438\u0431\u043A\u043E\u0439. \u0418\u0441\u0445\u043E\u0434\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435 \u0438 \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u044B\u0439 \u0436\u0443\u0440\u043D\u0430\u043B \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B; \u0437\u0430\u043F\u0438\u0441\u0438 \u0447\u0435\u0440\u0435\u0437 USB \u043D\u0435 \u0431\u044B\u043B\u043E.",plan_build_required:"\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u043D\u0443\u0436\u043D\u0430 \u043F\u043E\u043B\u043D\u0430\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043D\u0430\u044F \u0441\u0431\u043E\u0440\u043A\u0430 \u0434\u043B\u044F \u044D\u0442\u043E\u0433\u043E \u0437\u0430\u0434\u0430\u043D\u0438\u044F.",plan_browser_adapter_pending:"\u041D\u0430 \u044D\u0442\u043E\u043C \u044D\u0442\u0430\u043F\u0435 \u043F\u043E\u043A\u0430 \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044F \u0442\u043E\u043B\u044C\u043A\u043E USB \u0441\u0435\u0440\u0432\u0435\u0440\u0430 HA. \u041F\u043E\u0434\u0434\u0435\u0440\u0436\u043A\u0430 USB \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440\u0430 \u0435\u0449\u0451 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0430\u0435\u0442\u0441\u044F; \u043F\u0440\u043E\u0444\u0438\u043B\u044C \u0438 \u0441\u0431\u043E\u0440\u043A\u0430 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B.",usb_plan_browser_pending:"\u0414\u043B\u044F USB \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440\u0430 \u044D\u0442\u043E\u0442 \u044D\u0442\u0430\u043F \u043F\u043E\u043A\u0430 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D. \u041F\u0440\u043E\u0444\u0438\u043B\u044C \u0438 \u0441\u0431\u043E\u0440\u043A\u0430 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B.",usb_plan_build_required:"\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0441\u043E\u0431\u0435\u0440\u0438\u0442\u0435 \u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u0443\u044E \u043F\u0440\u043E\u0448\u0438\u0432\u043A\u0443 \u044D\u0442\u043E\u0433\u043E \u0437\u0430\u0434\u0430\u043D\u0438\u044F.",usb_plan_consumed:"\u041F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0430 \u0444\u0430\u0439\u043B\u043E\u0432 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438 \u0443\u0436\u0435 \u0437\u0430\u043F\u0440\u043E\u0448\u0435\u043D\u0430. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0435\u0451 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435.",usb_plan_unverified:"\u041F\u0440\u0438\u0432\u0430\u0442\u043D\u044B\u0439 \u043D\u0430\u0431\u043E\u0440 \u0444\u0430\u0439\u043B\u043E\u0432 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0442\u043E \u0436\u0435 \u0437\u0430\u0434\u0430\u043D\u0438\u0435; \u0437\u0430\u043F\u0440\u043E\u0441 \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0435\u0442\u0441\u044F.",plan_used:"\u042D\u0442\u043E\u0442 \u043D\u0430\u0431\u043E\u0440 \u0441\u0432\u044F\u0437\u0430\u043D \u0441 \u0443\u0436\u0435 \u0437\u0430\u043F\u0440\u043E\u0448\u0435\u043D\u043D\u043E\u0439 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u043E\u0439. \u041F\u043E\u0432\u0442\u043E\u0440\u043D\u0430\u044F \u0437\u0430\u043F\u0438\u0441\u044C \u0447\u0435\u0440\u0435\u0437 \u043D\u0435\u0433\u043E \u043D\u0435 \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u0435\u0442\u0441\u044F.",install_title:"\u042D\u043A\u0441\u043F\u0435\u0440\u0438\u043C\u0435\u043D\u0442\u0430\u043B\u044C\u043D\u0430\u044F \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u0441\u043E \u0448\u0442\u0430\u0442\u043D\u044B\u043C \u044D\u043A\u0440\u0430\u043D\u043E\u043C",install_experimental:"\u041F\u0435\u0440\u0432\u0430\u044F \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u044D\u0442\u0438\u043C \u043C\u0430\u0441\u0442\u0435\u0440\u043E\u043C \u043D\u0430 \u043D\u0435\u0442\u0440\u043E\u043D\u0443\u0442\u044B\u0439 \u043F\u0440\u0438\u0431\u043E\u0440 \u0435\u0449\u0451 \u043D\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u0430 \u0444\u0438\u0437\u0438\u0447\u0435\u0441\u043A\u0438. \u0418\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439\u0442\u0435 \u0442\u043E\u043B\u044C\u043A\u043E \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0439 \u043D\u0438\u0436\u0435 CGS1 S8/SCD40 \u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 USB-\u0434\u043E\u0441\u0442\u0443\u043F \u0434\u043B\u044F \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F.",install_changes:"\u0421\u043E\u0437\u0434\u0430\u0451\u0442 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u0439 \u043A\u0430\u0442\u0430\u043B\u043E\u0433 ESPHome, \u0441\u043E\u0445\u0440\u0430\u043D\u044F\u0435\u0442 \u0438\u0441\u0445\u043E\u0434\u043D\u044B\u0435 \u0437\u0430\u0433\u0440\u0443\u0437\u043E\u0447\u043D\u044B\u0435 \u0444\u0430\u0439\u043B\u044B \u0438 \u043C\u0435\u043D\u044F\u0435\u0442 \u0434\u0432\u0430 \u0441\u043A\u0440\u0438\u043F\u0442\u0430 \u0437\u0430\u043F\u0443\u0441\u043A\u0430. \u0412\u044B\u043F\u043E\u043B\u043D\u044F\u0435\u0442 \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0435\u043D\u043D\u044B\u0439 60-\u0441\u0435\u043A\u0443\u043D\u0434\u043D\u044B\u0439 \u043F\u0440\u043E\u0431\u043D\u044B\u0439 \u0437\u0430\u043F\u0443\u0441\u043A \u0440\u044F\u0434\u043E\u043C \u0441\u043E \u0448\u0442\u0430\u0442\u043D\u043E\u0439 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u043E\u0439. \u0422\u043E\u043B\u044C\u043A\u043E \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043D\u043E\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u0435 \u043F\u0440\u043E\u0431\u044B \u0438 \u043E\u0447\u0438\u0441\u0442\u043A\u0430 \u0441\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u0439 \u043F\u043E\u0437\u0432\u043E\u043B\u044F\u044E\u0442 \u0432\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u0430\u0432\u0442\u043E\u0437\u0430\u043F\u0443\u0441\u043A \u043D\u0430 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0443\u044E \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0443 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u043C \u0437\u0430\u0449\u0438\u0449\u0451\u043D\u043D\u044B\u043C \u0448\u0430\u0433\u043E\u043C. PM preload \u043E\u0441\u0442\u0430\u0451\u0442\u0441\u044F \u0432\u044B\u043A\u043B\u044E\u0447\u0435\u043D; \u043F\u043E\u043B\u043D\u044B\u0439 \u043D\u043E\u0432\u044B\u0439 \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441 \u0443\u0441\u0442\u0430\u043D\u0430\u0432\u043B\u0438\u0432\u0430\u0435\u0442\u0441\u044F \u043F\u043E\u0437\u0436\u0435.",install_power:"\u0414\u043E \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0430 \u043E\u0441\u0442\u0430\u0432\u044C\u0442\u0435 USB \u0438 \u043F\u0438\u0442\u0430\u043D\u0438\u0435 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D\u043D\u044B\u043C\u0438. \u041F\u0440\u0438 \u043F\u043E\u0442\u0435\u0440\u0435 \u043E\u0442\u0432\u0435\u0442\u0430 \u043F\u0440\u043E\u0432\u0435\u0440\u044F\u0439\u0442\u0435 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435; \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439\u0442\u0435 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0443 \u0438 \u043D\u0435 \u043F\u0435\u0440\u0435\u0437\u0430\u0433\u0440\u0443\u0436\u0430\u0439\u0442\u0435 \u043F\u0440\u0438\u0431\u043E\u0440 \u0432\u043E \u0432\u0440\u0435\u043C\u044F \u043D\u0435\u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D\u043D\u043E\u0439 \u0437\u0430\u043F\u0438\u0441\u0438.",install_ack:"\u042F \u043F\u0440\u043E\u0432\u0435\u0440\u0438\u043B \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u0435 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E \u0438 \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u043B \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u044D\u043A\u0441\u043F\u0435\u0440\u0438\u043C\u0435\u043D\u0442\u0430\u043B\u044C\u043D\u043E\u0439 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438.",install_firmware:"\u0412\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u044C \u044D\u043A\u0441\u043F\u0435\u0440\u0438\u043C\u0435\u043D\u0442\u0430\u043B\u044C\u043D\u0443\u044E \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0443",check_install:"\u041F\u0440\u043E\u0447\u0438\u0442\u0430\u0442\u044C \u0441\u0442\u0430\u0442\u0443\u0441 \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u0438",observe_boot:"\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u043F\u0440\u0438\u0431\u043E\u0440",install_not_started:"\u041F\u0435\u0440\u0435\u0434 \u0437\u0430\u043F\u0443\u0441\u043A\u043E\u043C \u043F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0439 \u043C\u043E\u043D\u0438\u0442\u043E\u0440.",install_running:"\u0412\u044B\u043F\u043E\u043B\u043D\u044F\u0435\u0442\u0441\u044F \u044D\u043A\u0441\u043F\u0435\u0440\u0438\u043C\u0435\u043D\u0442\u0430\u043B\u044C\u043D\u0430\u044F \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430. \u041E\u0441\u0442\u0430\u0432\u044C\u0442\u0435 USB \u0438 \u043F\u0438\u0442\u0430\u043D\u0438\u0435 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D\u043D\u044B\u043C\u0438; \u043F\u0440\u043E\u0431\u043D\u044B\u0439 \u0437\u0430\u043F\u0443\u0441\u043A \u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438 \u043C\u043E\u0433\u0443\u0442 \u0437\u0430\u043D\u044F\u0442\u044C \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u043C\u0438\u043D\u0443\u0442.",install_armed_waiting_reboot:"\u041E\u043F\u0435\u0440\u0430\u0446\u0438\u044F \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u043B\u0430 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u0435 \u043F\u0440\u043E\u0431\u043D\u043E\u0433\u043E \u0437\u0430\u043F\u0443\u0441\u043A\u0430 \u0438 \u0432\u043A\u043B\u044E\u0447\u0438\u043B\u0430 \u0430\u0432\u0442\u043E\u0437\u0430\u043F\u0443\u0441\u043A \u043D\u0430 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0443\u044E \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0443. \u041F\u0435\u0440\u0435\u0434 \u043E\u0431\u044B\u0447\u043D\u044B\u043C \u0432\u044B\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435\u043C \u043D\u0430\u0436\u043C\u0438\u0442\u0435 \xAB\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u043F\u0440\u0438\u0431\u043E\u0440\xBB \u0434\u043B\u044F \u0441\u0432\u0435\u0436\u0435\u0439 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438.",install_install_unverified:"\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u0437\u0430\u043F\u0438\u0441\u0438 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D. \u041D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439\u0442\u0435 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0443 \u0438 \u043D\u0435 \u043F\u0435\u0440\u0435\u0437\u0430\u0433\u0440\u0443\u0436\u0430\u0439\u0442\u0435 \u043F\u0440\u0438\u0431\u043E\u0440, \u043F\u043E\u043A\u0430 \u0437\u0430\u043F\u0438\u0441\u044C \u043C\u043E\u0436\u0435\u0442 \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0430\u0442\u044C\u0441\u044F. \u041F\u0440\u043E\u0447\u0438\u0442\u0430\u0439\u0442\u0435 \u0441\u0442\u0430\u0442\u0443\u0441 \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u0438 \u0438\u043B\u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u043F\u0440\u0438\u0431\u043E\u0440; \u0438\u0441\u0445\u043E\u0434\u043D\u044B\u0435 \u0437\u0430\u043F\u0438\u0441\u0438 \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B.",install_bridge_observed:"\u0417\u0430\u043F\u0443\u0441\u043A ESPHome \u043F\u043E\u0441\u043B\u0435 \u043D\u043E\u0432\u043E\u0439 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 \u0431\u044B\u043B \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D. \u0414\u043B\u044F \u0441\u0432\u0435\u0436\u0435\u0439 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438 \u0441\u043D\u043E\u0432\u0430 \u043D\u0430\u0436\u043C\u0438\u0442\u0435 \xAB\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u043F\u0440\u0438\u0431\u043E\u0440\xBB.",boot_checking:"\u041F\u0440\u043E\u0432\u0435\u0440\u044F\u044E \u0442\u0435\u043A\u0443\u0449\u0443\u044E \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0443 \u043F\u0440\u0438\u0431\u043E\u0440\u0430 \u0438 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435 ESPHome\u2026",boot_awaiting_reboot:"\u0410\u0432\u0442\u043E\u0437\u0430\u043F\u0443\u0441\u043A \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D \u043D\u0430 \u0442\u0435\u043A\u0443\u0449\u0435\u0439 \u0448\u0442\u0430\u0442\u043D\u043E\u0439 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0435. \u0412\u044B\u043A\u043B\u044E\u0447\u0438\u0442\u0435 \u043C\u043E\u043D\u0438\u0442\u043E\u0440 \u0447\u0435\u0440\u0435\u0437 \u0448\u0442\u0430\u0442\u043D\u043E\u0435 \u043C\u0435\u043D\u044E, \u0432\u043A\u043B\u044E\u0447\u0438\u0442\u0435 \u0441\u043D\u043E\u0432\u0430, \u043E\u0441\u0442\u0430\u0432\u044C\u0442\u0435 USB \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D\u043D\u044B\u043C \u0438 \u0435\u0449\u0451 \u0440\u0430\u0437 \u043D\u0430\u0436\u043C\u0438\u0442\u0435 \xAB\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u043F\u0440\u0438\u0431\u043E\u0440\xBB.",boot_bridge_observed:"ESPHome \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D \u043F\u043E\u0441\u043B\u0435 \u043D\u043E\u0432\u043E\u0439 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438: \u0440\u0430\u0431\u043E\u0442\u0430\u044E\u0442 \u043E\u0436\u0438\u0434\u0430\u0435\u043C\u044B\u0435 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u044B \u0438 \u043F\u0440\u0438\u0445\u043E\u0434\u044F\u0442 \u0441\u0432\u0435\u0436\u0438\u0435 \u0434\u0430\u043D\u043D\u044B\u0435 \u0447\u0435\u0440\u0435\u0437 \u0437\u0430\u0449\u0438\u0449\u0451\u043D\u043D\u043E\u0435 \u0441\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u0435.",boot_boot_unverified:"\u0421\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \u043F\u0440\u0438\u0431\u043E\u0440\u0430 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u043E. \u041F\u0440\u043E\u0447\u0438\u0442\u0430\u0439\u0442\u0435 \u0441\u0442\u0430\u0442\u0443\u0441 \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u0438; \u044D\u0442\u0430 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0435\u0442 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0443 \u0438 \u043D\u0435 \u043F\u0435\u0440\u0435\u0437\u0430\u043F\u0443\u0441\u043A\u0430\u0435\u0442 \u043C\u043E\u043D\u0438\u0442\u043E\u0440.",usb_install_review_required:"\u041F\u0440\u043E\u0447\u0438\u0442\u0430\u0439\u0442\u0435 \u0441\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u043E \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u043C \u043F\u0440\u0438\u0431\u043E\u0440\u0435 \u0438 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0435 \u044D\u043A\u0441\u043F\u0435\u0440\u0438\u043C\u0435\u043D\u0442\u0430\u043B\u044C\u043D\u044B\u0435 \u0448\u0430\u0433\u0438 \u043F\u0435\u0440\u0435\u0434 \u0437\u0430\u043F\u0443\u0441\u043A\u043E\u043C.",usb_install_plan_required:"\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u043D\u0443\u0436\u0435\u043D \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043D\u044B\u0439 \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u044B\u0439 \u043D\u0430\u0431\u043E\u0440 \u0444\u0430\u0439\u043B\u043E\u0432 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438.",usb_install_consumed:"\u042D\u0442\u0430 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u0443\u0436\u0435 \u0437\u0430\u043F\u0440\u043E\u0448\u0435\u043D\u0430. \u041F\u0440\u043E\u0447\u0438\u0442\u0430\u0439\u0442\u0435 \u0441\u0442\u0430\u0442\u0443\u0441; \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439\u0442\u0435 \u0437\u0430\u043F\u0438\u0441\u044C.",usb_install_previous_unverified:"\u041F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0430\u044F \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0430. \u041F\u0435\u0440\u0435\u0434 \u043D\u043E\u0432\u043E\u0439 \u043D\u0443\u0436\u043D\u043E \u043F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u0438\u0441\u0445\u043E\u0434\u043D\u0443\u044E \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u044E.",usb_install_host_space:"\u041D\u0430 HA-\u0441\u0435\u0440\u0432\u0435\u0440\u0435 \u043D\u0443\u0436\u043D\u044B \u043C\u0438\u043D\u0438\u043C\u0443\u043C 512 \u041C\u0438\u0411 \u0441\u0432\u043E\u0431\u043E\u0434\u043D\u043E\u0433\u043E \u043C\u0435\u0441\u0442\u0430 \u0434\u043B\u044F \u0437\u0430\u043F\u0438\u0441\u0435\u0439 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438. \u041D\u043E\u0432\u044B\u0439 \u0437\u0430\u043F\u0440\u043E\u0441 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438 \u043D\u0435 \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u043B\u0441\u044F.",usb_install_unverified:"\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \u0442\u043E\u0433\u043E \u0436\u0435 \u0437\u0430\u0434\u0430\u043D\u0438\u044F; \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439\u0442\u0435 \u0437\u0430\u043F\u0438\u0441\u044C.",usb_boot_unverified:"\u0422\u0435\u043A\u0443\u0449\u0430\u044F \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0430. \u0423\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u0438 \u043F\u0435\u0440\u0435\u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u043D\u0435 \u0437\u0430\u043F\u0440\u0430\u0448\u0438\u0432\u0430\u043B\u0438\u0441\u044C.",usb_observation_limit:"\u0412 \u044D\u0442\u043E\u043C \u0437\u0430\u0434\u0430\u043D\u0438\u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B 64 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u044F. \u041F\u0440\u0435\u0436\u043D\u0438\u0435 \u0437\u0430\u043F\u0438\u0441\u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B; \u0440\u0430\u0437\u0431\u0435\u0440\u0438\u0442\u0435 \u0438\u0445 \u043F\u0435\u0440\u0435\u0434 \u043D\u043E\u0432\u043E\u0439 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u043E\u0439.",full_review_title:"\u0423\u0441\u043B\u043E\u0432\u0438\u044F \u043F\u043E\u043B\u043D\u043E\u0433\u043E \u043D\u043E\u0432\u043E\u0433\u043E \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430",full_review:"\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u0443\u0441\u043B\u043E\u0432\u0438\u044F \u043F\u043E\u043B\u043D\u043E\u0433\u043E \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430",full_review_help:"\u0427\u0438\u0442\u0430\u0435\u0442 \u0442\u0435\u043A\u0443\u0449\u0438\u0439 \u0437\u0430\u0449\u0438\u0449\u0451\u043D\u043D\u044B\u0439 bridge \u0438 \u0448\u0442\u0430\u0442\u043D\u0443\u044E \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0443 \u0434\u043B\u044F \u044D\u0442\u043E\u0439 \u043F\u0430\u0440\u044B native/guardian. \u041D\u0435 \u0432\u043A\u043B\u044E\u0447\u0430\u0435\u0442 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u043D\u043E\u0435 PM-\u0440\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u0435, \u043D\u0435 \u0437\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u0442 \u0438 \u043D\u0435 \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u0435\u0442 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u044B, \u043D\u0435 \u043F\u0435\u0440\u0435\u0437\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u0442 \u043F\u0440\u0438\u0431\u043E\u0440 \u0438 \u043D\u0435 \u043C\u0435\u043D\u044F\u0435\u0442 \u0433\u043E\u0442\u043E\u0432\u043D\u043E\u0441\u0442\u044C \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438.",full_review_reading:"\u0427\u0438\u0442\u0430\u044E \u0442\u0435\u043A\u0443\u0449\u0438\u0435 \u0443\u0441\u043B\u043E\u0432\u0438\u044F \u043F\u043E\u043B\u043D\u043E\u0433\u043E \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430\u2026",full_review_pm_extension_required:"\u041D\u0430\u0447\u0430\u043B\u044C\u043D\u044B\u0439 bridge \u043E\u0441\u0442\u0430\u0432\u043B\u044F\u0435\u0442 \u0432\u044B\u043A\u043B\u044E\u0447\u0435\u043D\u043D\u044B\u043C \u043D\u0430\u0448\u0435 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u043D\u043E\u0435 \u0440\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u0435 \u0434\u043E\u0441\u0442\u0443\u043F\u0430 \u043A PM. \u042D\u0442\u043E \u043D\u0435 \u0432\u044B\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u0441\u0430\u043C\u043E\u0433\u043E PM-\u0434\u0430\u0442\u0447\u0438\u043A\u0430 \u0432 \u0448\u0442\u0430\u0442\u043D\u043E\u0439 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u0435. \u0414\u043B\u044F \u043F\u043E\u043B\u043D\u043E\u0433\u043E \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430 \u043D\u0443\u0436\u0435\u043D \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u0439 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043D\u044B\u0439 \u043F\u0435\u0440\u0435\u0445\u043E\u0434; \u044D\u0442\u0430 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0440\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u0435 \u043D\u0435 \u0432\u043A\u043B\u044E\u0447\u0430\u0435\u0442.",full_review_full_ui_preflight_observed:"\u0422\u0435\u043A\u0443\u0449\u0430\u044F \u0448\u0442\u0430\u0442\u043D\u0430\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043F\u0440\u043E\u0439\u0434\u0435\u043D\u0430 \u0434\u043B\u044F \u0442\u043E\u0447\u043D\u043E\u0439 \u0441\u0431\u043E\u0440\u043A\u0438. \u042D\u0442\u043E \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u0447\u0442\u0435\u043D\u0438\u044F, \u043D\u0435 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u0438\u043B\u0438 \u0437\u0430\u043F\u0443\u0441\u043A. \u041F\u043E\u043B\u043D\u044B\u0439 \u043F\u0435\u0440\u0435\u0445\u043E\u0434 \u043E\u0441\u0442\u0430\u0451\u0442\u0441\u044F \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u043C \u044D\u0442\u0430\u043F\u043E\u043C.",full_review_full_ui_unverified:"\u0423\u0441\u043B\u043E\u0432\u0438\u044F \u043F\u043E\u043B\u043D\u043E\u0433\u043E \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u044B. \u041F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u044B \u0438 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B; \u044D\u0442\u0430 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043D\u0435 \u0440\u0430\u0437\u0440\u0435\u0448\u0430\u0435\u0442 \u0437\u0430\u043F\u0443\u0441\u043A.",full_review_full_ui_close_unverified:"\u0427\u0442\u0435\u043D\u0438\u0435 \u0438\u043B\u0438 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u0435 \u0441\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u044F \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u043E. \u0410\u043A\u0442\u0438\u0432\u0430\u0446\u0438\u044F \u043F\u043E\u043B\u043D\u043E\u0433\u043E \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430 \u043D\u0435 \u0437\u0430\u043F\u0440\u0430\u0448\u0438\u0432\u0430\u043B\u0430\u0441\u044C; \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u0438\u0441\u0442\u043E\u0440\u0438\u044E \u0438\u0441\u0445\u043E\u0434\u043D\u043E\u0439 \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u0438.",usb_full_ui_bridge_required:"\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0435 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u044B\u0439 bridge \u043F\u043E\u0441\u043B\u0435 \u0435\u0433\u043E \u043D\u043E\u0432\u043E\u0439 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438, \u0437\u0430\u0442\u0435\u043C \u043F\u0440\u043E\u0432\u0435\u0440\u044F\u0439\u0442\u0435 \u0443\u0441\u043B\u043E\u0432\u0438\u044F \u043F\u043E\u043B\u043D\u043E\u0433\u043E \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430.",usb_full_ui_unverified:"\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044C \u0443\u0441\u043B\u043E\u0432\u0438\u044F \u043F\u043E\u043B\u043D\u043E\u0433\u043E \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430. \u0410\u043A\u0442\u0438\u0432\u0430\u0446\u0438\u044F \u043D\u0435 \u0437\u0430\u043F\u0440\u0430\u0448\u0438\u0432\u0430\u043B\u0430\u0441\u044C.",usb_full_ui_close_unverified:"\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044C \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u0435 \u0442\u043E\u0447\u043D\u043E\u0433\u043E \u0441\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u044F \u0447\u0442\u0435\u043D\u0438\u044F. \u0410\u043A\u0442\u0438\u0432\u0430\u0446\u0438\u044F \u043D\u0435 \u0437\u0430\u043F\u0440\u0430\u0448\u0438\u0432\u0430\u043B\u0430\u0441\u044C.",full_trial_title:"\u041F\u0440\u043E\u0431\u043D\u044B\u0439 \u043F\u043E\u043B\u043D\u044B\u0439 \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441",full_trial_start:"\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u043D\u043E\u0432\u044B\u0439 \u044D\u043A\u0440\u0430\u043D \u043D\u0430 60 \u0441\u0435\u043A\u0443\u043D\u0434",full_trial_status:"\u041F\u0440\u043E\u0447\u0438\u0442\u0430\u0442\u044C \u0441\u0442\u0430\u0442\u0443\u0441 \u043F\u0440\u043E\u0431\u044B \u044D\u043A\u0440\u0430\u043D\u0430",full_trial_help:"\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442 \u0432 \u041E\u0417\u0423 \u0434\u0432\u0435 \u0442\u043E\u0447\u043D\u044B\u0435 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u044B \u044D\u0442\u043E\u0439 \u0441\u0431\u043E\u0440\u043A\u0438, \u043F\u043E\u043A\u0430\u0436\u0435\u0442 \u043D\u043E\u0432\u044B\u0439 \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441 \u0434\u043E 60 \u0441\u0435\u043A\u0443\u043D\u0434 \u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u0438\u0442 \u0432\u043E\u0437\u0432\u0440\u0430\u0442 \u043A \u0448\u0442\u0430\u0442\u043D\u043E\u043C\u0443. \u0412\u0440\u0435\u043C\u044F \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0438\u0432\u0430\u044E\u0442 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u044B \u043D\u0430 \u0441\u0430\u043C\u043E\u043C \u043F\u0440\u0438\u0431\u043E\u0440\u0435, \u0434\u0430\u0436\u0435 \u0435\u0441\u043B\u0438 \u0437\u0430\u043A\u0440\u044B\u0442\u044C \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443. \u041E\u0441\u0442\u0430\u0432\u044C\u0442\u0435 USB \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D\u043D\u044B\u043C; \u043F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u044B\u0439 \u0437\u0430\u043F\u0443\u0441\u043A \u043D\u0435 \u0432\u043A\u043B\u044E\u0447\u0430\u0435\u0442\u0441\u044F.",full_trial_ack:"\u041F\u043E\u043D\u0438\u043C\u0430\u044E, \u0447\u0442\u043E \u044D\u0442\u043E \u044D\u043A\u0441\u043F\u0435\u0440\u0438\u043C\u0435\u043D\u0442\u0430\u043B\u044C\u043D\u0430\u044F \u043F\u0440\u043E\u0431\u0430 \u044D\u043A\u0440\u0430\u043D\u0430. \u0411\u0443\u0434\u0443 \u0441\u043C\u043E\u0442\u0440\u0435\u0442\u044C \u043D\u0430 \u044D\u043A\u0440\u0430\u043D \u0438 \u043E\u0441\u0442\u0430\u0432\u043B\u044E \u043F\u0438\u0442\u0430\u043D\u0438\u0435 \u0438 USB \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D\u043D\u044B\u043C\u0438.",full_trial_running:"\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u044E \u043F\u0430\u0440\u0443 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C, \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u044E \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u044B\u0439 \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441 \u0438 \u0436\u0434\u0443 \u0432\u043E\u0437\u0432\u0440\u0430\u0442\u0430 \u0448\u0442\u0430\u0442\u043D\u043E\u0433\u043E \u044D\u043A\u0440\u0430\u043D\u0430. \u042D\u0442\u043E \u043C\u043E\u0436\u0435\u0442 \u0437\u0430\u043D\u044F\u0442\u044C \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u043C\u0438\u043D\u0443\u0442; \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u0430\u044F \u043A\u043E\u043C\u0430\u043D\u0434\u0430 \u0437\u0430\u043F\u0443\u0441\u043A\u0430 \u043D\u0435 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u044F\u0435\u0442\u0441\u044F.",full_trial_not_started:"\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u043F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0443\u0441\u043B\u043E\u0432\u0438\u044F \u043F\u043E\u043B\u043D\u043E\u0433\u043E \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430, \u0437\u0430\u0442\u0435\u043C \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0435 \u0438 \u0437\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u0435 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u0443\u044E \u043F\u0440\u043E\u0431\u0443 \u044D\u043A\u0440\u0430\u043D\u0430.",full_trial_full_ui_trial_returned_observed:"\u041D\u043E\u0432\u044B\u0439 \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441 \u0438 \u0433\u043E\u0442\u043E\u0432\u043D\u043E\u0441\u0442\u044C \u0441\u0432\u0435\u0436\u0438\u0445 \u043E\u0441\u043D\u043E\u0432\u043D\u044B\u0445 \u043F\u043E\u043A\u0430\u0437\u0430\u043D\u0438\u0439 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u044B, \u0437\u0430\u0442\u0435\u043C \u0432\u0435\u0440\u043D\u0443\u043B\u0441\u044F \u0448\u0442\u0430\u0442\u043D\u044B\u0439 bridge. \u041D\u0430 \u043C\u043E\u043C\u0435\u043D\u0442 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u044F \u043F\u0440\u043E\u0431\u044B \u043F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u044B\u0439 \u0437\u0430\u043F\u0443\u0441\u043A \u0431\u044B\u043B \u0432\u044B\u043A\u043B\u044E\u0447\u0435\u043D. \u042D\u0442\u043E \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0439 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u043F\u0440\u043E\u0431\u044B.",full_trial_full_ui_trial_unverified:"\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u043F\u0440\u043E\u0431\u044B \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D. \u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u0437\u0430\u0434\u0430\u043D\u0438\u0435 \u0438 \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u0439\u0442\u0435 \u0435\u0433\u043E \u0441\u0442\u0430\u0442\u0443\u0441; \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439\u0442\u0435 \u0437\u0430\u043F\u0443\u0441\u043A \u0438 \u043D\u0435 \u0441\u0431\u0440\u0430\u0441\u044B\u0432\u0430\u0439\u0442\u0435 \u0438\u0441\u0442\u043E\u0440\u0438\u044E.",full_trial_full_ui_trial_close_unverified:"\u0417\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u0435 API-\u0441\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u044F \u0438\u043B\u0438 USB-\u043F\u0440\u043E\u0431\u0440\u043E\u0441\u0430 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u043E. \u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u0438\u0441\u0442\u043E\u0440\u0438\u044E \u0438\u0441\u0445\u043E\u0434\u043D\u043E\u0439 \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u0438; \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u044B\u0439 \u0437\u0430\u043F\u0443\u0441\u043A \u0437\u0430\u043F\u0440\u0435\u0449\u0451\u043D.",full_trial_full_ui_trial_rebuild_required:"\u0412 bridge \u043D\u0435\u0442 \u043A\u043E\u043C\u0430\u043D\u0434\u044B \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0435\u043D\u043D\u043E\u0439 \u043F\u0440\u043E\u0431\u044B \u044D\u043A\u0440\u0430\u043D\u0430. \u0418\u0441\u0445\u043E\u0434\u043D\u044B\u0439 \u0437\u0430\u043F\u0440\u043E\u0441 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D; \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439\u0442\u0435 \u0435\u0433\u043E \u0432 \u044D\u0442\u043E\u043C \u0437\u0430\u0434\u0430\u043D\u0438\u0438.",usb_full_ui_trial_review_required:"\u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0442\u043E\u0447\u043D\u0443\u044E \u0441\u0431\u043E\u0440\u043A\u0443 \u0438 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0435 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u0443\u044E \u043F\u0440\u043E\u0431\u0443 \u044D\u043A\u0440\u0430\u043D\u0430 \u043F\u0435\u0440\u0435\u0434 \u0437\u0430\u043F\u0443\u0441\u043A\u043E\u043C.",usb_full_ui_trial_rebuild_required:"\u042D\u0442\u043E \u0437\u0430\u0434\u0430\u043D\u0438\u0435 \u0441\u043E\u0431\u0440\u0430\u043D\u043E \u0438\u0437 \u0441\u0442\u0430\u0440\u044B\u0445 \u0438\u0441\u0445\u043E\u0434\u043D\u0438\u043A\u043E\u0432 \u0431\u0435\u0437 \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0435\u043D\u043D\u043E\u0439 \u043F\u0440\u043E\u0431\u044B \u044D\u043A\u0440\u0430\u043D\u0430. \u041E\u043D\u043E \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043E \u0431\u0435\u0437 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0439; \u043D\u0443\u0436\u043D\u0430 \u043D\u043E\u0432\u0430\u044F \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u043D\u0430\u044F \u0441\u0431\u043E\u0440\u043A\u0430. \u041D\u0435 \u0441\u0431\u0440\u0430\u0441\u044B\u0432\u0430\u0439\u0442\u0435 \u0443\u0436\u0435 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u044B\u0439 \u043C\u043E\u043D\u0438\u0442\u043E\u0440 \u0440\u0430\u0434\u0438 \u044D\u0442\u043E\u0433\u043E \u043C\u0430\u0441\u0442\u0435\u0440\u0430.",usb_full_ui_trial_unverified:"\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u043F\u0440\u043E\u0431\u044B \u044D\u043A\u0440\u0430\u043D\u0430 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D. \u041F\u0440\u043E\u0447\u0438\u0442\u0430\u0439\u0442\u0435 \u0441\u0442\u0430\u0442\u0443\u0441 \u0442\u043E\u0433\u043E \u0436\u0435 \u0437\u0430\u0434\u0430\u043D\u0438\u044F; \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439\u0442\u0435 \u0437\u0430\u043F\u0438\u0441\u044C.",usb_full_ui_trial_close_unverified:"\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044C \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u0435 \u0441\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u044F \u043F\u0440\u043E\u0431\u044B \u044D\u043A\u0440\u0430\u043D\u0430. \u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u0438\u0441\u0442\u043E\u0440\u0438\u044E; \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439\u0442\u0435 \u0437\u0430\u043F\u0443\u0441\u043A.",usb_full_ui_trial_consumed:"\u041F\u0440\u043E\u0431\u0430 \u044D\u043A\u0440\u0430\u043D\u0430 \u0443\u0436\u0435 \u0437\u0430\u043F\u0440\u0430\u0448\u0438\u0432\u0430\u043B\u0430\u0441\u044C. \u041F\u0440\u043E\u0447\u0438\u0442\u0430\u0439\u0442\u0435 \u0435\u0451 \u0441\u0442\u0430\u0442\u0443\u0441; \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u044B\u0439 \u0437\u0430\u043F\u0443\u0441\u043A \u043D\u0435\u0432\u043E\u0437\u043C\u043E\u0436\u0435\u043D.",usb_full_ui_trial_previous_unverified:"\u041F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0430\u044F \u043F\u0440\u043E\u0431\u0430 \u044D\u043A\u0440\u0430\u043D\u0430 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0430. \u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0438\u0441\u0445\u043E\u0434\u043D\u0443\u044E \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u044E \u043F\u0435\u0440\u0435\u0434 \u043D\u043E\u0432\u043E\u0439 \u0437\u0430\u043F\u0438\u0441\u044C\u044E \u043D\u0430 \u043F\u0440\u0438\u0431\u043E\u0440.",private_backup_help:"\u041F\u0435\u0440\u0435\u0434 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u043E\u0439 \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u044B\u0435 \u043A\u043E\u043F\u0438\u0438. \u0412 \u043F\u0440\u043E\u0444\u0438\u043B\u0435 \u043D\u0430\u0445\u043E\u0434\u0438\u0442\u0441\u044F \u0438\u043D\u0434\u0438\u0432\u0438\u0434\u0443\u0430\u043B\u044C\u043D\u044B\u0439 \u043A\u043B\u044E\u0447 \u0448\u0438\u0444\u0440\u043E\u0432\u0430\u043D\u0438\u044F ESPHome; \u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u0444\u0430\u0439\u043B \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u043E. \u0418\u0441\u0445\u043E\u0434\u043D\u044B\u0435 \u0444\u0430\u0439\u043B\u044B \u044D\u0442\u043E\u0433\u043E \u0437\u0430\u0434\u0430\u043D\u0438\u044F \u043C\u043E\u0436\u043D\u043E \u0441\u043A\u0430\u0447\u0430\u0442\u044C \u0438 \u043F\u043E\u0441\u043B\u0435 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438. \u042D\u0442\u043E \u0444\u0438\u043A\u0441\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0439 \u043D\u0430\u0431\u043E\u0440 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F, \u043D\u0435 \u043F\u043E\u043B\u043D\u0430\u044F \u0440\u0435\u0437\u0435\u0440\u0432\u043D\u0430\u044F \u043A\u043E\u043F\u0438\u044F \u043F\u0440\u0438\u0431\u043E\u0440\u0430.",export_profile:"\u0421\u043A\u0430\u0447\u0430\u0442\u044C \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u044B\u0439 \u043F\u0440\u043E\u0444\u0438\u043B\u044C ESPHome",export_originals:"\u0421\u043A\u0430\u0447\u0430\u0442\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0435 \u0438\u0441\u0445\u043E\u0434\u043D\u044B\u0435 \u0444\u0430\u0439\u043B\u044B",private_backup_downloaded:"\u0421\u043A\u0430\u0447\u0438\u0432\u0430\u043D\u0438\u0435 \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u043E\u0439 \u043A\u043E\u043F\u0438\u0438 \u043D\u0430\u0447\u0430\u043B\u043E\u0441\u044C. \u0425\u0440\u0430\u043D\u0438\u0442\u0435 \u0435\u0451 \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u043E; \u043F\u0440\u043E\u0444\u0438\u043B\u044C \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u043A\u043B\u044E\u0447 \u0448\u0438\u0444\u0440\u043E\u0432\u0430\u043D\u0438\u044F ESPHome.",usb_private_export_unverified:"\u041F\u0440\u0438\u0432\u0430\u0442\u043D\u0443\u044E \u043A\u043E\u043F\u0438\u044E \u043D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u0438\u043B\u0438 \u0441\u043A\u0430\u0447\u0430\u0442\u044C. \u041F\u0440\u0435\u0436\u043D\u0438\u0435 \u0444\u0430\u0439\u043B\u044B \u0437\u0430\u0434\u0430\u043D\u0438\u044F \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B.",preparing_profile:"\u041F\u043E\u0434\u0433\u043E\u0442\u0430\u0432\u043B\u0438\u0432\u0430\u044E \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u044B\u0439 \u043F\u0440\u043E\u0444\u0438\u043B\u044C \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430\u2026",profile_prepared:"\u041F\u0440\u0438\u0432\u0430\u0442\u043D\u044B\u0439 \u043F\u0440\u043E\u0444\u0438\u043B\u044C \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430 \u0433\u043E\u0442\u043E\u0432.",check_preparation:"\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0443",usb_preparation_unverified:"\u041F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0430 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0430. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0435\u0451 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435; \u0437\u0430\u043F\u0440\u043E\u0441 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0442\u044C\u0441\u044F \u043D\u0435 \u0431\u0443\u0434\u0435\u0442.",usb_profile_name_invalid:"\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043F\u0435\u0447\u0430\u0442\u043D\u043E\u0435 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0434\u043E 120 \u0431\u0430\u0439\u0442 UTF-8, \u0431\u0435\u0437 \u043A\u043E\u0441\u044B\u0445 \u0447\u0435\u0440\u0442.",usb_job_limit:"\u041D\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0435 \u0443\u0436\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B \u0432\u043E\u0441\u0435\u043C\u044C \u0437\u0430\u0434\u0430\u043D\u0438\u0439 \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0438. \u041F\u0440\u0435\u0436\u043D\u0438\u0435 \u0434\u0430\u043D\u043D\u044B\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B; \u043E\u0447\u0438\u0441\u0442\u043A\u0430 \u0447\u0435\u0440\u0435\u0437 \u043C\u0430\u0441\u0442\u0435\u0440 \u043F\u043E\u043A\u0430 \u043D\u0435 \u0440\u0435\u0430\u043B\u0438\u0437\u043E\u0432\u0430\u043D\u0430.",usb_job_unavailable:"\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0438 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E, \u043D\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u043E \u0438\u043B\u0438 \u043F\u0440\u0438\u043D\u0430\u0434\u043B\u0435\u0436\u0438\u0442 \u0434\u0440\u0443\u0433\u043E\u043C\u0443 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044E.",next:"USB \u0441\u0435\u0440\u0432\u0435\u0440\u0430 \u0438 \u0441\u043A\u0430\u0447\u0438\u0432\u0430\u0435\u043C\u044B\u0439 \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440\u043D\u044B\u0439 ADB-\u0443\u0441\u0442\u0430\u043D\u043E\u0432\u0449\u0438\u043A \u044D\u043A\u0441\u043F\u0435\u0440\u0438\u043C\u0435\u043D\u0442\u0430\u043B\u044C\u043D\u044B\u0435: \u043F\u0435\u0440\u0432\u0430\u044F \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u043D\u0430 \u0448\u0442\u0430\u0442\u043D\u044B\u0439 \u043F\u0440\u0438\u0431\u043E\u0440 \u0435\u0449\u0451 \u043D\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u0430 \u0444\u0438\u0437\u0438\u0447\u0435\u0441\u043A\u0438. \u0417\u0430\u043F\u0438\u0441\u044C \u0442\u043E\u043B\u044C\u043A\u043E \u0438\u0437 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0430 \u0447\u0435\u0440\u0435\u0437 WebUSB \u0435\u0449\u0451 \u043D\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0430. \u041D\u0430\u0447\u0430\u043B\u044C\u043D\u043E\u0435 \u0440\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u0435 \u043F\u043E\u0434\u0433\u043E\u0442\u0430\u0432\u043B\u0438\u0432\u0430\u0435\u0442\u0441\u044F \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u043C \u0448\u0430\u0433\u043E\u043C \u043D\u0430 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0443\u044E \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0443. \u0414\u043B\u044F \u043F\u043E\u043B\u043D\u043E\u0433\u043E \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430 \u043D\u0443\u0436\u043D\u044B \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0443\u0441\u043B\u043E\u0432\u0438\u0439, \u043F\u0440\u043E\u0431\u0430 \u0438 \u043F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u044B\u0439 \u0437\u0430\u043F\u0443\u0441\u043A.",docs:"\u0418\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0438\u044F \u043F\u043E \u044D\u043A\u0441\u043F\u0435\u0440\u0438\u043C\u0435\u043D\u0442\u0430\u043B\u044C\u043D\u043E\u0439 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0435",model:"\u041C\u043E\u0434\u0435\u043B\u044C",version:"\u0428\u0442\u0430\u0442\u043D\u0430\u044F \u0432\u0435\u0440\u0441\u0438\u044F",co2:"\u0412\u0430\u0440\u0438\u0430\u043D\u0442 CO2",mac:"WLAN-\u0438\u0434\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0442\u043E\u0440",webusb_unavailable:"\u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u0447\u0435\u0440\u0435\u0437 Chrome \u0438\u043B\u0438 Edge \u043F\u043E HTTPS \u043B\u0438\u0431\u043E \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 USB \u0441\u0435\u0440\u0432\u0435\u0440\u0430.",usb_selection_cancelled:"\u0423\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E \u043D\u0435 \u0432\u044B\u0431\u0440\u0430\u043D\u043E.",usb_stock_unverified:"\u0428\u0442\u0430\u0442\u043D\u044B\u0435 \u0444\u0430\u0439\u043B\u044B \u043E\u0442\u043B\u0438\u0447\u0430\u044E\u0442\u0441\u044F \u043E\u0442 \u043F\u0440\u043E\u0444\u0438\u043B\u044F \u043F\u0435\u0440\u0432\u043E\u0439 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438. \u0423\u0436\u0435 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u044B\u0439 ESPHome \u043E\u0431\u043D\u043E\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u0441\u0432\u043E\u0438\u043C \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u043C \u043F\u0443\u0442\u0451\u043C.",usb_profile_unsupported:"\u042D\u0442\u0430 \u0448\u0442\u0430\u0442\u043D\u0430\u044F \u0432\u0435\u0440\u0441\u0438\u044F, \u0432\u0430\u0440\u0438\u0430\u043D\u0442 CO2 \u0438\u043B\u0438 \u043F\u0440\u043E\u0446\u0435\u0441\u0441\u043E\u0440 \u043D\u0435 \u0434\u043E\u043F\u0443\u0449\u0435\u043D\u044B.",usb_busy:"\u0423\u0436\u0435 \u0432\u044B\u043F\u043E\u043B\u043D\u044F\u0435\u0442\u0441\u044F \u0434\u0440\u0443\u0433\u0430\u044F USB-\u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430.",open_companion:"\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0443 USB \u0441\u0435\u0440\u0432\u0435\u0440\u0430",usb_companion_unavailable:"\u0414\u043B\u044F USB \u0441\u0435\u0440\u0432\u0435\u0440\u0430 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u0435 \u0434\u043E\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u0435 Qingping USB \u043F\u043E \u0438\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0438\u0438 \u043D\u0438\u0436\u0435. \u0414\u043B\u044F USB \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440\u0430 \u043E\u043D\u043E \u043D\u0435 \u043D\u0443\u0436\u043D\u043E.",usb_companion_stopped:"\u0417\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u0435 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u043E\u0435 \u0434\u043E\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u0435 Qingping USB \u0432\u0440\u0443\u0447\u043D\u0443\u044E, \u0437\u0430\u0442\u0435\u043C \u0441\u043D\u043E\u0432\u0430 \u043E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0443 USB \u0441\u0435\u0440\u0432\u0435\u0440\u0430.",usb_selection_consumed:"\u042D\u0442\u043E\u0442 \u0432\u044B\u0431\u043E\u0440 \u0443\u0436\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D. \u0421\u043D\u043E\u0432\u0430 \u043D\u0430\u0439\u0434\u0438\u0442\u0435 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430 \u0434\u043B\u044F \u043D\u043E\u0432\u043E\u0439 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438 \u0442\u043E\u043B\u044C\u043A\u043E \u0434\u043B\u044F \u0447\u0442\u0435\u043D\u0438\u044F.",usb_unauthorized:"\u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u0434\u043E\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u0435 \u0438\u0437 Home Assistant \u0441 \u043F\u0440\u0430\u0432\u0430\u043C\u0438 \u0430\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u0430.",failed:"USB-\u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043D\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0430. \u041F\u0440\u043E\u0448\u0438\u0432\u043A\u0430 \u043D\u0435 \u0443\u0441\u0442\u0430\u043D\u0430\u0432\u043B\u0438\u0432\u0430\u043B\u0430\u0441\u044C. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u043A\u0430\u0431\u0435\u043B\u044C, ADB \u0438 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u0435 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435."}};var Oe=t=>{throw{code:t}},Wr=["job_id","stage","model","co2_type","transport","node_name","friendly_name","live_recheck_required","installed","installation_ready"];function rn(t,e,s,i){return(!t||typeof t!="object"||Object.keys(t).sort().join()!==[...Wr].sort().join()||t.job_id!==e||!/^[a-f0-9]{32}$/.test(e)||!i.includes(t.stage)||t.model!=="CGS1"||![2,3].includes(t.co2_type)||t.transport!==s||!/^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/.test(t.node_name)||typeof t.friendly_name!="string"||t.live_recheck_required!==!0||t.installed!==!1||t.installation_ready!==!1)&&Oe("usb_preparation_unverified"),t}function on(t,e,s){return rn(t,e,s,["profile_prepared"])}async function Hr(t){let e=await t("jobs");(!e||Object.keys(e).join()!=="jobs"||!Array.isArray(e.jobs)||e.jobs.length>8)&&Oe("usb_preparation_unverified");let s=new Set;for(let i of e.jobs)(!i||!["ha_usb","browser_usb"].includes(i.transport)||s.has(i.job_id))&&Oe("usb_preparation_unverified"),rn(i,i.job_id,i.transport,["profile_prepared","preparation_unverified"]),s.add(i.job_id);return e.jobs}async function Vr(t){(!(t instanceof Blob)||t.type!=="application/x-tar"||t.size>16*1024*1024)&&Oe("usb_capture_unverified");let e=new Uint8Array(await t.arrayBuffer()),s=[];for(let i=0;i<e.length;i+=32768)s.push(String.fromCharCode(...e.subarray(i,i+32768)));return btoa(s.join(""))}async function Jr(t,e,s,i){(!/^[a-f0-9]{32}$/.test(e)||typeof s!="string"||!s)&&Oe("usb_request_invalid");let a=i.archive instanceof Blob,n=a?"browser_usb":"ha_usb",r={request_id:e,friendly_name:s,...a?{capture:await Vr(i.archive)}:{serial:i.serial}};try{return on(await t("prepare",r),e,n)}catch(o){if(["usb_unauthorized","usb_busy","usb_request_invalid","usb_capture_unverified","usb_profile_name_invalid","usb_job_limit"].includes(o?.code))throw o;try{return await dn(t,e,n)}catch{}Oe("usb_preparation_unverified")}}async function dn(t,e,s){return(!/^[a-f0-9]{32}$/.test(e)||!["browser_usb","ha_usb"].includes(s))&&Oe("usb_request_invalid"),on(await t("jobs/"+e),e,s)}var Os=t=>{throw{code:t}},Kr={not_started:["unverified"],building:["source","sdk","compile"],built_not_installed:["complete"],build_failed:["failed"],build_unverified:["unverified"]};function cn(t,e){return(!t||Object.keys(t).sort().join()!==["job_id","state","phase","hardware_contacted","installed","installation_ready"].sort().join()||!/^[a-f0-9]{32}$/.test(e)||t.job_id!==e||!Kr[t.state]?.includes(t.phase)||t.hardware_contacted!==!1||t.installed!==!1||t.installation_ready!==!1)&&Os("usb_build_unverified"),t}async function ln(t,e){return/^[a-f0-9]{32}$/.test(e)||Os("usb_request_invalid"),cn(await t("jobs/"+e+"/build"),e)}async function Qr(t,e){/^[a-f0-9]{32}$/.test(e)||Os("usb_request_invalid");try{return cn(await t("build",{job_id:e}),e)}catch(s){if(["usb_unauthorized","usb_build_space","usb_build_busy","usb_preparation_unverified"].includes(s?.code))throw s;try{let i=await ln(t,e);if(i.state!=="not_started")return i}catch{}Os("usb_build_unverified")}}var Be=()=>{throw{code:"usb_browser_plan_unverified"}},Xr=["not_started","browser_plan_prepared","browser_plan_unverified","browser_plan_failed"];function un(t,e){let s=["job_id","state","plan_id","plan_sha256","requested_data_free_bytes","transport_kind","native_get_devpath","hardware_contacted","device_writes","installed","installation_ready","writer_enabled","live_recheck_required"];return(!t||Object.keys(t).sort().join()!==s.sort().join()||!/^[a-f0-9]{32}$/.test(e)||t.job_id!==e||!Xr.includes(t.state)||t.transport_kind!=="browser_webusb"||["native_get_devpath","hardware_contacted","installed","installation_ready","writer_enabled"].some(i=>t[i]!==!1)||t.device_writes!==0||t.live_recheck_required!==!0)&&Be(),t.state==="browser_plan_prepared"?(!/^[a-f0-9]{32}$/.test(t.plan_id)||!/^[a-f0-9]{64}$/.test(t.plan_sha256)||!Number.isInteger(t.requested_data_free_bytes)||t.requested_data_free_bytes<=0||t.requested_data_free_bytes>256*1024*1024)&&Be():[t.plan_id,t.plan_sha256,t.requested_data_free_bytes].some(i=>i!==null)&&Be(),t}async function hn(t,e){return/^[a-f0-9]{32}$/.test(e)||Be(),un(await t("jobs/"+e+"/browser-plan"),e)}async function Zr(t,e){/^[a-f0-9]{32}$/.test(e)||Be();try{return un(await t("browser-plan",{job_id:e}),e)}catch(s){if(["usb_unauthorized","usb_browser_plan_build_required","usb_browser_plan_transport_required","usb_browser_plan_source_required"].includes(s?.code))throw s;try{let i=await hn(t,e);if(i.state!=="not_started")return i}catch{}Be()}}async function Yr(t,e,s,i){(!/^[a-f0-9]{32}$/.test(e)||!/^[a-f0-9]{64}$/.test(s)||!/^[a-f0-9]{32}$/.test(i))&&Be();let a=await t("browser-review",{job_id:e,expected_plan_sha256:s,channel_id:i}),n=["job_id","plan_sha256","state","hardware_contacted","device_writes","installed","installation_ready","writer_enabled","native_get_devpath","live_recheck_required"];if(!a||Object.keys(a).sort().join()!==n.sort().join()||a.job_id!==e||a.plan_sha256!==s||a.state!=="browser_scope_verified"||a.hardware_contacted!==!0||a.device_writes!==0||["installed","installation_ready","writer_enabled","native_get_devpath"].some(r=>a[r]!==!1)||a.live_recheck_required!==!0)throw{code:"usb_browser_scope_unverified"};return a}var St=()=>{throw{code:"usb_plan_unverified"}},eo=["not_prepared","plan_prepared","plan_unverified","plan_failed","build_required","browser_adapter_pending"];function _n(t,e){let s=["job_id","state","requested_data_free_bytes","hardware_contacted","device_writes","installed","installation_ready","live_recheck_required"];return(!t||Object.keys(t).sort().join()!==s.sort().join()||!/^[a-f0-9]{32}$/.test(e)||t.job_id!==e||!eo.includes(t.state)||t.hardware_contacted!==!1||t.device_writes!==0||t.installed!==!1||t.installation_ready!==!1||t.live_recheck_required!==!0)&&St(),(t.state==="plan_prepared"?!Number.isInteger(t.requested_data_free_bytes)||t.requested_data_free_bytes<=0||t.requested_data_free_bytes>256*1024*1024:t.requested_data_free_bytes!==null)&&St(),t}async function pn(t,e){return/^[a-f0-9]{32}$/.test(e)||St(),_n(await t("jobs/"+e+"/plan"),e)}async function to(t,e){/^[a-f0-9]{32}$/.test(e)||St();try{return _n(await t("plan",{job_id:e}),e)}catch(s){if(["usb_unauthorized","usb_plan_build_required","usb_plan_browser_pending"].includes(s?.code))throw s;try{let i=await pn(t,e);if(i.state!=="not_prepared")return i}catch{}St()}}var k=t=>{throw{code:t}};function bn(t,e){let s=["job_id","state","autostart_armed","installed","installation_ready","replay_allowed","live_recheck_required"];return(!t||Object.keys(t).sort().join()!==s.sort().join()||!/^[a-f0-9]{32}$/.test(e)||t.job_id!==e||!["not_started","install_unverified","armed_waiting_reboot","bridge_observed"].includes(t.state)||t.autostart_armed!==(["armed_waiting_reboot","bridge_observed"].includes(t.state)?!0:null)||t.installed!==!1||t.installation_ready!==!1||t.replay_allowed!==!1||t.live_recheck_required!==!0)&&k("usb_install_unverified"),t}async function fn(t,e){return/^[a-f0-9]{32}$/.test(e)||k("usb_install_unverified"),bn(await t("jobs/"+e+"/install"),e)}async function so(t,e){/^[a-f0-9]{32}$/.test(e)||k("usb_install_review_required");let s=await t("jobs/"+e+"/install-review"),i=["job_id","plan_sha256","model","co2_type","friendly_name","wlan_mac","stock_version","requested_data_free_bytes","experimental","installation_ready"];return(!s||Object.keys(s).sort().join()!==i.sort().join()||s.job_id!==e||!/^[a-f0-9]{64}$/.test(s.plan_sha256)||s.model!=="CGS1"||![2,3].includes(s.co2_type)||typeof s.friendly_name!="string"||!/^[0-9a-f]{2}(?::[0-9a-f]{2}){5}$/.test(s.wlan_mac)||s.stock_version!=="4.1.8_0287"||s.experimental!==!0||s.installation_ready!==!1||!Number.isInteger(s.requested_data_free_bytes)||s.requested_data_free_bytes<=0)&&k("usb_install_review_required"),s}async function io(t,e,s){(s!==!0||!e||!/^[a-f0-9]{32}$/.test(e.job_id)||!/^[a-f0-9]{64}$/.test(e.plan_sha256))&&k("usb_install_review_required");try{return bn(await t("install",{job_id:e.job_id,expected_plan_sha256:e.plan_sha256,experimental_reviewed:!0}),e.job_id)}catch(i){if(["usb_unauthorized","usb_busy","usb_install_review_required","usb_install_plan_required","usb_install_host_space","usb_install_previous_unverified","usb_pm_extension_previous_unverified"].includes(i?.code))throw i;try{let a=await fn(t,e.job_id);if(a.state!=="not_started")return a}catch{}k("usb_install_unverified")}}async function ao(t,e){/^[a-f0-9]{32}$/.test(e)||k("usb_boot_unverified");let s=await t("observe",{job_id:e});return(!s||Object.keys(s).sort().join()!==["job_id","state","runtime_observed","device_writes","installed","installation_ready"].sort().join()||s.job_id!==e||!["bridge_observed","boot_unverified","awaiting_reboot"].includes(s.state)||s.runtime_observed!==(s.state==="bridge_observed")||s.device_writes!==0||s.installed!==!1||s.installation_ready!==!1)&&k("usb_boot_unverified"),s}async function no(t,e){/^[a-f0-9]{32}$/.test(e)||k("usb_full_ui_unverified");let s=await t("full-review",{job_id:e}),i=["job_id","state","read_only","device_writes","launch_authorized","installation_ready","installed","live_recheck_required"];return(!s||Object.keys(s).sort().join()!==i.sort().join()||s.job_id!==e||!["full_ui_preflight_observed","pm_extension_required","full_ui_unverified","full_ui_close_unverified"].includes(s.state)||s.read_only!==!0||s.device_writes!==0||s.launch_authorized!==!1||s.installation_ready!==!1||s.installed!==!1||s.live_recheck_required!==!0)&&k("usb_full_ui_unverified"),s}function mn(t,e){let s=["job_id","state","trial_available","hard_runtime_ms","native_observations","stock_return_observed","launch_acknowledged","installed","installation_ready","boot_enabled","replay_allowed","live_recheck_required"];(!t||Object.keys(t).sort().join()!==s.sort().join()||!/^[a-f0-9]{32}$/.test(e)||t.job_id!==e||!["not_started","full_ui_trial_returned_observed","full_ui_trial_unverified","full_ui_trial_close_unverified","full_ui_trial_rebuild_required"].includes(t.state)||typeof t.trial_available!="boolean"||t.hard_runtime_ms!==6e4||t.installed!==!1||t.installation_ready!==!1||t.boot_enabled!==!1||t.replay_allowed!==!1||t.live_recheck_required!==!0)&&k("usb_full_ui_trial_unverified");let i=t.native_observations===null&&t.stock_return_observed===null&&t.launch_acknowledged===null;return!i&&(!Number.isInteger(t.native_observations)||t.native_observations<0||t.native_observations>2||typeof t.stock_return_observed!="boolean"||typeof t.launch_acknowledged!="boolean")&&k("usb_full_ui_trial_unverified"),t.state==="not_started"&&!i&&k("usb_full_ui_trial_unverified"),t.state==="full_ui_trial_returned_observed"&&(t.native_observations!==2||t.stock_return_observed!==!0||!t.trial_available)&&k("usb_full_ui_trial_unverified"),t}async function vn(t,e){return/^[a-f0-9]{32}$/.test(e)||k("usb_full_ui_trial_unverified"),mn(await t("jobs/"+e+"/full-trial"),e)}async function ro(t,e,s){(s!==!0||!e||!/^[a-f0-9]{32}$/.test(e.job_id)||!/^[a-f0-9]{64}$/.test(e.plan_sha256))&&k("usb_full_ui_trial_review_required");try{return mn(await t("full-trial",{job_id:e.job_id,expected_plan_sha256:e.plan_sha256,experimental_reviewed:!0}),e.job_id)}catch(i){if(["usb_unauthorized","usb_busy","usb_full_ui_trial_review_required","usb_full_ui_bridge_required","usb_full_ui_trial_rebuild_required","usb_install_host_space","usb_install_previous_unverified","usb_pm_extension_previous_unverified","usb_full_ui_trial_previous_unverified","usb_pm_extension_previous_unverified"].includes(i?.code))throw i;try{let a=await vn(t,e.job_id);if(a.state!=="not_started")return a}catch{}k("usb_full_ui_trial_unverified")}}function gn(t,e){let s=["job_id","state","activation_available","native_observations","store_installed","boot_enabled","start_acknowledged","installed","installation_ready","replay_allowed","live_recheck_required"];return(!t||Object.keys(t).sort().join()!==s.sort().join()||!/^[a-f0-9]{32}$/.test(e)||t.job_id!==e||!["not_started","full_ui_active_observed","full_ui_activation_unverified","full_ui_activation_close_unverified","full_ui_activation_space"].includes(t.state)||typeof t.activation_available!="boolean"||t.installed!==!1||t.installation_ready!==!1||t.replay_allowed!==!1||t.live_recheck_required!==!0||![null,!0,!1].includes(t.store_installed)||![null,!0,!1].includes(t.boot_enabled)||![null,!0,!1].includes(t.start_acknowledged)||!(t.native_observations===null||Number.isInteger(t.native_observations)&&t.native_observations>=0&&t.native_observations<=2))&&k("usb_full_ui_activation_unverified"),t.state!=="not_started"&&t.activation_available&&k("usb_full_ui_activation_unverified"),t.state==="not_started"&&[t.native_observations,t.store_installed,t.boot_enabled,t.start_acknowledged].some(i=>i!==null)&&k("usb_full_ui_activation_unverified"),t.state==="full_ui_active_observed"&&(t.native_observations!==2||t.store_installed!==!0||t.boot_enabled!==!0||typeof t.start_acknowledged!="boolean")&&k("usb_full_ui_activation_unverified"),t}async function wn(t,e){return/^[a-f0-9]{32}$/.test(e)||k("usb_full_ui_activation_unverified"),gn(await t("jobs/"+e+"/full-activate"),e)}async function oo(t,e,s,i){(s!==!0||i!==!0||!e||!/^[a-f0-9]{32}$/.test(e.job_id)||!/^[a-f0-9]{64}$/.test(e.plan_sha256))&&k("usb_full_ui_activation_review_required");try{return gn(await t("full-activate",{job_id:e.job_id,expected_plan_sha256:e.plan_sha256,experimental_reviewed:!0,screen_reviewed:!0}),e.job_id)}catch(a){if(["usb_unauthorized","usb_busy","usb_full_ui_activation_review_required","usb_full_ui_activation_trial_required","usb_install_host_space","usb_install_previous_unverified","usb_pm_extension_previous_unverified","usb_full_ui_trial_previous_unverified","usb_full_ui_activation_previous_unverified","usb_pm_extension_previous_unverified"].includes(a?.code))throw a;try{let n=await wn(t,e.job_id);if(n.state!=="not_started")return n}catch{}k("usb_full_ui_activation_unverified")}}function yn(t,e){let s=["job_id","state","pm_available","arming_acknowledged","completion_observed","next_boot_armed","installed","installation_ready","replay_allowed","live_recheck_required"];return(!t||Object.keys(t).sort().join()!==s.sort().join()||!/^[a-f0-9]{32}$/.test(e)||t.job_id!==e||!["not_started","pm_extension_unverified","pm_extension_armed_waiting_reboot"].includes(t.state)||typeof t.pm_available!="boolean"||![null,!0,!1].includes(t.arming_acknowledged)||![null,!0,!1].includes(t.completion_observed)||t.next_boot_armed!==(t.state==="pm_extension_armed_waiting_reboot"?!0:null)||t.installed!==!1||t.installation_ready!==!1||t.replay_allowed!==!1||t.live_recheck_required!==!0)&&k("usb_pm_extension_unverified"),t.state!=="not_started"&&t.pm_available&&k("usb_pm_extension_unverified"),t.state==="not_started"&&(t.arming_acknowledged!==null||t.completion_observed!==null)&&k("usb_pm_extension_unverified"),t.state==="pm_extension_armed_waiting_reboot"&&(t.completion_observed!==!0||typeof t.arming_acknowledged!="boolean")&&k("usb_pm_extension_unverified"),t}async function $n(t,e){return/^[a-f0-9]{32}$/.test(e)||k("usb_pm_extension_unverified"),yn(await t("jobs/"+e+"/pm-enable"),e)}async function co(t,e,s){(s!==!0||!e||!/^[a-f0-9]{32}$/.test(e.job_id)||!/^[a-f0-9]{64}$/.test(e.plan_sha256))&&k("usb_pm_extension_review_required");try{return yn(await t("pm-enable",{job_id:e.job_id,expected_plan_sha256:e.plan_sha256,experimental_reviewed:!0}),e.job_id)}catch(i){if(["usb_unauthorized","usb_busy","usb_pm_extension_review_required","usb_pm_extension_bridge_required","usb_install_host_space","usb_pm_extension_previous_unverified","usb_full_ui_activation_previous_unverified","usb_full_ui_trial_previous_unverified","usb_install_previous_unverified"].includes(i?.code))throw i;try{let a=await $n(t,e.job_id);if(a.state!=="not_started")return a}catch{}k("usb_pm_extension_unverified")}}function kn(t,e){let s=["job_id","state","enrollment_available","entry_id","replay_allowed","installation_ready"];if(!t||Object.keys(t).sort().join()!==s.sort().join()||!/^[a-f0-9]{32}$/.test(e)||t.job_id!==e||!["not_started","created","already_configured","conflict","manual_flow_required","unverified"].includes(t.state)||typeof t.enrollment_available!="boolean"||t.replay_allowed!==!1||t.installation_ready!==!1||!(t.entry_id===null||typeof t.entry_id=="string"&&/^[A-Za-z0-9_-]{1,64}$/.test(t.entry_id))||["created","already_configured"].includes(t.state)!==(t.entry_id!==null)||t.state!=="not_started"&&t.enrollment_available)throw{code:"usb_enrollment_unverified"};return t}async function xn(t,e){if(!/^[a-f0-9]{32}$/.test(e))throw{code:"usb_enrollment_unverified"};return kn(await t("jobs/"+e+"/enroll"),e)}async function lo(t,e,s){if(s!==!0||!e||!/^[a-f0-9]{32}$/.test(e.job_id)||!/^[a-f0-9]{64}$/.test(e.plan_sha256))throw{code:"usb_enrollment_review_required"};try{return kn(await t("enroll",{job_id:e.job_id,expected_plan_sha256:e.plan_sha256,reviewed:!0}),e.job_id)}catch(i){if(["usb_unauthorized","usb_busy","usb_enrollment_review_required","usb_enrollment_activation_required"].includes(i?.code))throw i;try{let a=await xn(t,e.job_id);if(a.state!=="not_started")return a}catch{}throw{code:"usb_enrollment_unverified"}}}function uo(t){if(!(t instanceof Blob)||t.type!=="application/vnd.qingping.private-profile+json"||!t.size||t.size>16384)throw{code:"usb_private_export_unverified"};let e=URL.createObjectURL(t),s=document.createElement("a");s.href=e,s.download="qingping-cgs1-private-profile.json",s.rel="noreferrer",s.click(),setTimeout(()=>URL.revokeObjectURL(e),1e3)}function ho(t){if(!(t instanceof Blob)||t.type!=="application/vnd.qingping.private-computer-bundle+tar"||!t.size||t.size>64*1024*1024)throw{code:"usb_private_export_unverified"};let e=URL.createObjectURL(t),s=document.createElement("a");s.href=e,s.download="qingping-cgs1-computer.tar",s.rel="noreferrer",s.click(),setTimeout(()=>URL.revokeObjectURL(e),1e3)}function Sn(){let t,e=!1;return{async generateKey(){if(e)throw Error("Ephemeral authorization already attempted");e=!0;let s=await crypto.subtle.generateKey({name:"RSASSA-PKCS1-v1_5",modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:"SHA-1"},!0,["sign","verify"]);return t={buffer:new Uint8Array(await crypto.subtle.exportKey("pkcs8",s.privateKey)),name:"Qingping USB installer"},t},*iterateKeys(){t&&(yield t)}}}function yp(){return new Rs({manager:xt.BROWSER,authenticate:t=>yt.authenticate(t),createClient:t=>new vt(t),ephemeralCredentials:Sn},Q)}function $p(){return new Mt({manager:xt.BROWSER,authenticate:t=>yt.authenticate(t),createClient:t=>new vt(t),ephemeralCredentials:Sn,createSyncSocket:t=>new nt(t,65536),pushV1:_i},Q)}export{$p as createNativeChannel,yp as createProbe,Fr as downloadCapture,ho as downloadComputerPackage,uo as downloadPrivateProfile,ao as observeBoot,Qn as openBrowserControl,Xn as openBrowserReviewControl,Zr as prepareBrowserPlan,to as preparePlan,Jr as prepareProfile,hn as readBrowserPlan,ln as readBuild,xn as readEnrollment,wn as readFullUiActivation,vn as readFullUiTrial,fn as readInstall,so as readInstallReview,pn as readPlan,$n as readPmExtension,dn as readPrepared,Yr as reviewBrowserPlan,no as reviewFullUi,Hr as savedPreparations,Qr as startBuild,lo as startEnrollment,oo as startFullUiActivation,ro as startFullUiTrial,io as startInstall,co as startPmExtension,Gr as strings};
