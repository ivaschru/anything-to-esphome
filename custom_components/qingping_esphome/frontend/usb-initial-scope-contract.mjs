// Generated fixed read-only live scope; no transport or execution authority.
export const initialScopeContract = {
  "schema_version": 1,
  "source_commit": "53d97b9609e8e0fcdfc5d003101f620098dbc734",
  "maximum_observation_ms": 5000,
  "source_sha256": {
    "bootstrap_patches.py": "12bc6fb3fadfe6c0101130914c3dafe7db243669b8a000e83806ff0afd66f959",
    "build_candidate.py": "a5583b8e0159c3df425d5e500de5599b66b93a5e17ff6107d8fa75fe64caa294",
    "build_pm_helper.py": "94a8f6c9d11fad0c18d459019b9791db1797ce339a5aa9b821d41b2199aa8851",
    "commit_disabled_install.py": "b78470c8fe3f6275d2eca07067ec56beb858f11d8037b435be08f9f6781b4408",
    "disabled_commit_policy.py": "ad8b50cd9c112f37b40bb1f3a77ba2ca598bf307deb1817ea1fdda4c492f2ab7",
    "initial_bridge_trial_main.cpp": "fd00040a0c6fbf23ded86e833aa86dd5dbaa9f75a3b5ca25bb9b53ae485eb5eb",
    "initial_bridge_trial_policy.py": "c304ce59b7df712bcbb9b2fa1564a70e1ed22fb5c2575d3bdbeebc08556b4677",
    "initial_trial_admission.h": "77f5b1ce0c002ec9f32b87ce6615e4128134b28363e33bfc530f32af87dc9ba5",
    "initial_trial_child.h": "5fe9e093428228ee9b0a9f6b599f402825e9a952623bfff160a4e7af3ae954cf",
    "initial_trial_device.h": "7e2b0e9857b37b0530bc8fb69d8bb42df5a54485aef1b86fb2f75da2e078c39d",
    "initial_trial_exec.h": "a5f09c528f03e0c61c7748ce4d68861507d2e79a49240e92dcdba89b96cbd880",
    "initial_trial_filesystem.h": "b3018ddb17960c4bb5108602e243121159d4542f19522de9a9d4542ee9a830c5",
    "initial_trial_intent.h": "ac429b5817af301da0cc3f3ba7f32f9cbb4730e8fb53771ba08873a91bf20c11",
    "initial_trial_ram_scope.h": "393ab184fa31189cde891c9e736256af2eb3945f1dc6ca34a74dbd077e4276b9",
    "initial_trial_resources.h": "d09bdf079d157a80f385a3e83d14f9237514393e635b17f6b0c33061892a492f",
    "initial_trial_scope.h": "e3f059e3c5f97b241c588b71a7c6aa8df114bddac0082f6a1f0a2520eab9e7ac",
    "initial_trial_self.h": "d62dbc7cf9d513bed3a506e64993efc710f3c12e7ebf6030d9754ba5a054f357",
    "initial_trial_stock.h": "8e94e07eb9ca82f16fb79c36b8b72f69792a107b575cda356353c0b29a87e1a9",
    "initial_trial_vendor.h": "08a506963b9e9a4c2b2b36c2085976ccfbbc6deec3276c67a8149b6d2d70b90c",
    "preflight_adb.py": "128cf367baeee28bcfb4156256548fdded689a42d50662e77580fdd71ab19b47",
    "prepare_install.py": "92f99cf2ff074d58f734303c54907a73feffab33d4e174d70def6d1ee70fa375",
    "review_disabled_install.py": "174d4e23e1aaf4c386ab7afcf280a7b99b169ca877130ad1f556295a28850d1a",
    "review_initial_trial.py": "d9f2f022edbbe190d8c8b0ccbb87071f9c6dfcb53320f8e53232264ac71cc0b4",
    "stage_install_adb.py": "7546caa212b3b44b1a3d8717e550b7bfd5f0893a342c80c6e847cfd2be56b8eb",
    "trial_initial_bridge_adb.py": "4f29bb503dd2d792a42aa2a642505edd2ccf84a3eb35ae7a8964b39006aaf032"
  },
  "branches": {
    "empty": [
      {
        "key": "child_before",
        "parts": [
          "count=0\nfor file in /proc/[0-9]*/stat; do\n count=$((count+1)); [ \"$count\" -le 4096 ] || exit 1\n task=${file%/stat}; child=${task#/proc/}\n row=$(sed 's/.*) //' \"$file\" 2>/dev/null | awk '{print $1, $2, $20}')\n set -- $row\n if [ \"$#\" -ne 3 ]; then [ ! -d \"$task\" ] && continue; exit 1; fi\n case \"$2:$3\" in (*[!0-9:]*|:*|*:) exit 1;; esac\n if [ \"$2\" = '",
          {
            "field": "guardian_pid"
          },
          "' ]; then printf '%s %s %s\\n' \"$child\" \"$3\" \"$1\"; fi\ndone"
        ]
      },
      {
        "key": "guardian_process_before",
        "parts": [
          "cat /proc/",
          {
            "field": "guardian_pid"
          },
          "/stat\nstat -c '%u' /proc/",
          {
            "field": "guardian_pid"
          },
          "\nreadlink /proc/",
          {
            "field": "guardian_pid"
          },
          "/exe"
        ]
      },
      {
        "key": "guardian_file",
        "parts": [
          "test ! -L /tmp/qingping-initial-guardian-",
          {
            "field": "guardian_job_id"
          },
          "/program\ntest -f /tmp/qingping-initial-guardian-",
          {
            "field": "guardian_job_id"
          },
          "/program\nstat -c '%s %h' /tmp/qingping-initial-guardian-",
          {
            "field": "guardian_job_id"
          },
          "/program\nsha256sum /tmp/qingping-initial-guardian-",
          {
            "field": "guardian_job_id"
          },
          "/program"
        ]
      },
      {
        "key": "guardian_image",
        "parts": [
          "stat -L -c '%d %i %s %a %u %h' /proc/",
          {
            "field": "guardian_pid"
          },
          "/exe\nstat -c '%d %i %s %a %u %h' /tmp/qingping-initial-guardian-",
          {
            "field": "guardian_job_id"
          },
          "/program\nsha256sum /proc/",
          {
            "field": "guardian_pid"
          },
          "/exe"
        ]
      },
      {
        "key": "guardian_process_after",
        "parts": [
          "cat /proc/",
          {
            "field": "guardian_pid"
          },
          "/stat\nstat -c '%u' /proc/",
          {
            "field": "guardian_pid"
          },
          "\nreadlink /proc/",
          {
            "field": "guardian_pid"
          },
          "/exe"
        ]
      },
      {
        "key": "child_process_before",
        "parts": [
          "cat /proc/",
          {
            "field": "child_pid"
          },
          "/stat\nstat -c '%u' /proc/",
          {
            "field": "child_pid"
          },
          "\nreadlink /proc/",
          {
            "field": "child_pid"
          },
          "/exe"
        ]
      },
      {
        "key": "child_file",
        "parts": [
          "test ! -L /data/.esphome-cgs1/program\ntest -f /data/.esphome-cgs1/program\nstat -c '%s %h' /data/.esphome-cgs1/program\nsha256sum /data/.esphome-cgs1/program"
        ]
      },
      {
        "key": "child_image",
        "parts": [
          "stat -L -c '%d %i %s %a %u %h' /proc/",
          {
            "field": "child_pid"
          },
          "/exe\nstat -c '%d %i %s %a %u %h' /data/.esphome-cgs1/program\nsha256sum /proc/",
          {
            "field": "child_pid"
          },
          "/exe"
        ]
      },
      {
        "key": "child_process_after",
        "parts": [
          "cat /proc/",
          {
            "field": "child_pid"
          },
          "/stat\nstat -c '%u' /proc/",
          {
            "field": "child_pid"
          },
          "\nreadlink /proc/",
          {
            "field": "child_pid"
          },
          "/exe"
        ]
      },
      {
        "key": "endpoint",
        "parts": [
          "sockets=' '\ncount=0\nfor file in /proc/",
          {
            "field": "child_pid"
          },
          "/fd/*; do\n count=$((count+1)); [ \"$count\" -le 4096 ] || exit 1\n link=$(readlink \"$file\")\n case \"$link\" in (socket:\\[*\\]) inode=${link#socket:}; inode=${inode#\\[}; inode=${inode%\\]}; case \"$inode\" in (''|*[!0-9]*) exit 1;; esac; sockets=\"$sockets$inode \";; esac\ndone\nfor table in /proc/net/tcp /proc/net/tcp6; do\n test -r \"$table\"\n awk -v owned=\"$sockets\" '\n NR==1 { if ($2!=\"local_address\") bad=1; next }\n { count=split($2, local, \":\"); port=toupper(local[2]); address=toupper(local[1]); state=toupper($4);\n   if ($1 !~ /^[0-9]+:$/ || NF<10 || count!=2 || (length(address)!=8 && length(address)!=32) ||\n       address ~ /[^0-9A-F]/ || length(port)!=4 || port ~ /[^0-9A-F]/ ||\n       length(state)!=2 || state ~ /[^0-9A-F]/ || $10 !~ /^[0-9]+$/) bad=1;\n   if (port==\"17A5\" || port==\"0CA0\") {\n     if ($10 !~ /^[1-9][0-9]*$/ || index(owned, \" \" $10 \" \")==0) bad=1;\n     if (state==\"0A\") print FILENAME, port;\n   }\n }\n END { if (!NR || bad) exit 1 }\n ' \"$table\"\ndone"
        ]
      },
      {
        "key": "process_scan",
        "parts": [
          "count=0\nfor link in /proc/[0-9]*/exe; do\n    count=$((count+1))\n    [ \"$count\" -le 4096 ] || exit 1\n    pid=${link#/proc/}; pid=${pid%/exe}\n    case \"$pid\" in (''|*[!0-9]*) exit 1;; esac\n    if executable=$(readlink \"$link\" 2>/dev/null); then\n        :\n    else\n        # Kernel threads and exited tasks legitimately have no executable.\n        # An unreadable live userspace exe is NOT evidence of its absence.\n        [ -d \"/proc/$pid\" ] || continue\n        metadata=$(sed 's/.*) //' \"/proc/$pid/stat\" 2>/dev/null | awk '{print $1, $7}')\n        set -- $metadata\n        if [ \"$#\" -ne 2 ]; then\n            [ ! -d \"/proc/$pid\" ] && continue\n            exit 1\n        fi\n        case \"$2\" in (''|*[!0-9]*) exit 1;; esac\n        case \"$1\" in (Z|X|x) continue;; esac\n        [ \"$(($2 & 2097152))\" -ne 0 ] || exit 1\n        continue\n    fi\n    case \"$executable\" in\n        (/data/.esphome-cgs1/*|/tmp/qingping-full-*/*|/tmp/qingping-initial-*/*)\ncase \"$pid:$executable\" in\n(",
          {
            "field": "guardian_pid"
          },
          ":/tmp/qingping-initial-guardian-",
          {
            "field": "guardian_job_id"
          },
          "/program|",
          {
            "field": "child_pid"
          },
          ":/data/.esphome-cgs1/program) :;;\n(*) exit 1;;\nesac;;\n        (/data/bin/SnowApp) printf '%s\\n' \"$pid\";;\n    esac\ndone"
        ]
      },
      {
        "key": "stock_process",
        "parts": [
          "cat /proc/",
          {
            "field": "stock_pid"
          },
          "/stat\nstat -c '%u' /proc/",
          {
            "field": "stock_pid"
          },
          "\nreadlink /proc/",
          {
            "field": "stock_pid"
          },
          "/exe"
        ]
      },
      {
        "key": "watchdog_process",
        "parts": [
          "cat /proc/",
          {
            "field": "watchdog_pid"
          },
          "/stat\nstat -c '%u' /proc/",
          {
            "field": "watchdog_pid"
          },
          "\nreadlink /proc/",
          {
            "field": "watchdog_pid"
          },
          "/exe"
        ]
      },
      {
        "key": "watchdog_arguments",
        "parts": [
          "arguments=$(tr '\\000' '\\n' < /proc/",
          {
            "field": "watchdog_pid"
          },
          "/cmdline)\n[ \"$arguments\" = \"$(printf '/bin/sh\\n/data/bin/watchdog.sh')\" ]"
        ]
      },
      {
        "key": "stock_maps_0",
        "parts": [
          "test -r /proc/",
          {
            "field": "stock_pid"
          },
          "/maps\nif grep -F -q /data/.esphome-cgs1/ /proc/",
          {
            "field": "stock_pid"
          },
          "/maps; then exit 1; else result=$?; [ \"$result\" -eq 1 ]; fi"
        ]
      },
      {
        "key": "stock_maps_1",
        "parts": [
          "test -r /proc/",
          {
            "field": "stock_pid"
          },
          "/maps\nif grep -F -q /tmp/qingping-full- /proc/",
          {
            "field": "stock_pid"
          },
          "/maps; then exit 1; else result=$?; [ \"$result\" -eq 1 ]; fi"
        ]
      },
      {
        "key": "stock_maps_2",
        "parts": [
          "test -r /proc/",
          {
            "field": "stock_pid"
          },
          "/maps\nif grep -F -q /tmp/qingping-initial- /proc/",
          {
            "field": "stock_pid"
          },
          "/maps; then exit 1; else result=$?; [ \"$result\" -eq 1 ]; fi"
        ]
      },
      {
        "key": "vendor_0",
        "parts": [
          "test ! -L /data/bin/SnowApp\ntest -f /data/bin/SnowApp\nstat -c '%s %h' /data/bin/SnowApp\nsha256sum /data/bin/SnowApp"
        ]
      },
      {
        "key": "vendor_1",
        "parts": [
          "test ! -L /data/bin/watchdog.sh\ntest -f /data/bin/watchdog.sh\nstat -c '%s %h' /data/bin/watchdog.sh\nsha256sum /data/bin/watchdog.sh"
        ]
      },
      {
        "key": "vendor_2",
        "parts": [
          "test ! -L /data/etc/init.d/start.sh\ntest -f /data/etc/init.d/start.sh\nstat -c '%s %h' /data/etc/init.d/start.sh\nsha256sum /data/etc/init.d/start.sh"
        ]
      },
      {
        "key": "vendor_3",
        "parts": [
          "test ! -L /etc/init.d/S12_launcher_init\ntest -f /etc/init.d/S12_launcher_init\nstat -c '%s %h' /etc/init.d/S12_launcher_init\nsha256sum /etc/init.d/S12_launcher_init"
        ]
      },
      {
        "key": "vendor_4",
        "parts": [
          "test ! -L /etc/init.d/S50_px3se_init\ntest -f /etc/init.d/S50_px3se_init\nstat -c '%s %h' /etc/init.d/S50_px3se_init\nsha256sum /etc/init.d/S50_px3se_init"
        ]
      },
      {
        "key": "vendor_5",
        "parts": [
          "test ! -L /lib/ld-2.23.so\ntest -f /lib/ld-2.23.so\nstat -c '%s %h' /lib/ld-2.23.so\nsha256sum /lib/ld-2.23.so"
        ]
      },
      {
        "key": "vendor_6",
        "parts": [
          "test ! -L /lib/libc-2.23.so\ntest -f /lib/libc-2.23.so\nstat -c '%s %h' /lib/libc-2.23.so\nsha256sum /lib/libc-2.23.so"
        ]
      },
      {
        "key": "vendor_7",
        "parts": [
          "test ! -L /usr/lib/libstdc++.so.6.0.20\ntest -f /usr/lib/libstdc++.so.6.0.20\nstat -c '%s %h' /usr/lib/libstdc++.so.6.0.20\nsha256sum /usr/lib/libstdc++.so.6.0.20"
        ]
      },
      {
        "key": "vendor_8",
        "parts": [
          "test ! -L /usr/lib/libQt5Core.so.5.9.4\ntest -f /usr/lib/libQt5Core.so.5.9.4\nstat -c '%s %h' /usr/lib/libQt5Core.so.5.9.4\nsha256sum /usr/lib/libQt5Core.so.5.9.4"
        ]
      },
      {
        "key": "staged_0",
        "parts": [
          "test ! -L /data/.esphome-cgs1/program\ntest -f /data/.esphome-cgs1/program\nstat -c '%s %h' /data/.esphome-cgs1/program\nsha256sum /data/.esphome-cgs1/program"
        ]
      },
      {
        "key": "staged_1",
        "parts": [
          "test ! -L /data/.esphome-cgs1/pm_qt_bridge.so\ntest -f /data/.esphome-cgs1/pm_qt_bridge.so\nstat -c '%s %h' /data/.esphome-cgs1/pm_qt_bridge.so\nsha256sum /data/.esphome-cgs1/pm_qt_bridge.so"
        ]
      },
      {
        "key": "staged_2",
        "parts": [
          "test ! -L /data/.esphome-cgs1/launch.sh\ntest -f /data/.esphome-cgs1/launch.sh\nstat -c '%s %h' /data/.esphome-cgs1/launch.sh\nsha256sum /data/.esphome-cgs1/launch.sh"
        ]
      },
      {
        "key": "staged_3",
        "parts": [
          "test ! -L /data/.esphome-cgs1/SnowApp-with-PM\ntest -f /data/.esphome-cgs1/SnowApp-with-PM\nstat -c '%s %h' /data/.esphome-cgs1/SnowApp-with-PM\nsha256sum /data/.esphome-cgs1/SnowApp-with-PM"
        ]
      },
      {
        "key": "staged_4",
        "parts": [
          "test ! -L /data/.esphome-cgs1/startup-hook.sh\ntest -f /data/.esphome-cgs1/startup-hook.sh\nstat -c '%s %h' /data/.esphome-cgs1/startup-hook.sh\nsha256sum /data/.esphome-cgs1/startup-hook.sh"
        ]
      },
      {
        "key": "staged_5",
        "parts": [
          "test ! -L /data/.esphome-cgs1/stock-start.sh.original\ntest -f /data/.esphome-cgs1/stock-start.sh.original\nstat -c '%s %h' /data/.esphome-cgs1/stock-start.sh.original\nsha256sum /data/.esphome-cgs1/stock-start.sh.original"
        ]
      },
      {
        "key": "staged_6",
        "parts": [
          "test ! -L /data/.esphome-cgs1/stock-watchdog.sh.original\ntest -f /data/.esphome-cgs1/stock-watchdog.sh.original\nstat -c '%s %h' /data/.esphome-cgs1/stock-watchdog.sh.original\nsha256sum /data/.esphome-cgs1/stock-watchdog.sh.original"
        ]
      },
      {
        "key": "staged_7",
        "parts": [
          "test ! -L /data/.esphome-cgs1/start.sh.candidate\ntest -f /data/.esphome-cgs1/start.sh.candidate\nstat -c '%s %h' /data/.esphome-cgs1/start.sh.candidate\nsha256sum /data/.esphome-cgs1/start.sh.candidate"
        ]
      },
      {
        "key": "staged_8",
        "parts": [
          "test ! -L /data/.esphome-cgs1/watchdog.sh.candidate\ntest -f /data/.esphome-cgs1/watchdog.sh.candidate\nstat -c '%s %h' /data/.esphome-cgs1/watchdog.sh.candidate\nsha256sum /data/.esphome-cgs1/watchdog.sh.candidate"
        ]
      },
      {
        "key": "root",
        "parts": [
          "test ! -L /data/.esphome-cgs1\ntest -d /data/.esphome-cgs1\nstat -c '%d %i %a %u' /data/.esphome-cgs1\ntest ! -L /data/.esphome-cgs1/install.intent\ntest -f /data/.esphome-cgs1/install.intent\n[ \"$(stat -c '%s %a %u %h' /data/.esphome-cgs1/install.intent)\" = '98 600 0 1' ]\ncat /data/.esphome-cgs1/install.intent"
        ]
      },
      {
        "key": "parents",
        "parts": [
          "test ! -L /data/bin\ntest ! -L /data/etc\ntest ! -L /data/etc/init.d\nstat -c '%d' /data/bin /data/etc/init.d"
        ]
      },
      {
        "key": "disabled",
        "parts": [
          "test ! -L /data/.esphome-cgs1/disabled\ntest -f /data/.esphome-cgs1/disabled\nstat -c '%s %a %u %h' /data/.esphome-cgs1/disabled\nsha256sum /data/.esphome-cgs1/disabled"
        ]
      },
      {
        "key": "pm-helper.disabled",
        "parts": [
          "test ! -L /data/.esphome-cgs1/pm-helper.disabled\ntest -f /data/.esphome-cgs1/pm-helper.disabled\nstat -c '%s %a %u %h' /data/.esphome-cgs1/pm-helper.disabled\nsha256sum /data/.esphome-cgs1/pm-helper.disabled"
        ]
      },
      {
        "key": "absent_stores",
        "parts": [
          "# CGS1_INITIAL_ABSENT_STORES\nentries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)\nprintf '%s\\n' \"$entries\" | while IFS= read -r entry; do\n    case \"$entry\" in (full-releases|wifi|prefs|full-state) exit 1;; esac\ndone\nentries=$(LC_ALL=C ls -A1 /tmp)\nprintf '%s\\n' \"$entries\" | while IFS= read -r entry; do\n    case \"$entry\" in (qingping-cgs1-esphome.lock) exit 1;; esac\ndone"
        ]
      },
      {
        "key": "memory",
        "parts": [
          "# CGS1_INITIAL_MEMORY\nawk '$1 == \"MemTotal:\" || $1 == \"MemFree:\" { print }' /proc/meminfo"
        ]
      },
      {
        "key": "intent_file",
        "parts": [
          "test ! -L /data/.esphome-cgs1/initial-trial.intent\ntest -f /data/.esphome-cgs1/initial-trial.intent\nstat -c '%s %h' /data/.esphome-cgs1/initial-trial.intent\nsha256sum /data/.esphome-cgs1/initial-trial.intent"
        ]
      },
      {
        "key": "intent_mode",
        "parts": [
          "observed_value=$(stat -c '%a %u' /data/.esphome-cgs1/initial-trial.intent)\n[ \"$observed_value\" = '600 0' ]\n"
        ]
      },
      {
        "key": "nand_entries",
        "parts": [
          "LC_ALL=C ls -A1 /data/.esphome-cgs1"
        ]
      },
      {
        "key": "commit_marker",
        "parts": [
          "# CGS1_INITIAL_COMMIT_MARKER\ntest ! -L /data/.esphome-cgs1/.commit-disabled.lock\ntest -d /data/.esphome-cgs1/.commit-disabled.lock\nobserved_value=$(stat -c '%a %u' /data/.esphome-cgs1/.commit-disabled.lock)\n[ \"$observed_value\" = '700 0' ]\ntest ! -L /data/.esphome-cgs1/.commit-disabled.lock/owner\ntest -f /data/.esphome-cgs1/.commit-disabled.lock/owner\nobserved_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/.commit-disabled.lock/owner)\n[ \"$observed_value\" = '82 600 0 1' ]\ncat /data/.esphome-cgs1/.commit-disabled.lock/owner"
        ]
      },
      {
        "key": "ram_identity",
        "parts": [
          "test ! -L /tmp\ntest ! -L /tmp/qingping-initial-trial-",
          {
            "field": "ram_job_id"
          },
          "\ntest -d /tmp/qingping-initial-trial-",
          {
            "field": "ram_job_id"
          },
          "\nstat -c '%d %i %a %u' /tmp/qingping-initial-trial-",
          {
            "field": "ram_job_id"
          },
          "\nstat -f -c '%t' /tmp/qingping-initial-trial-",
          {
            "field": "ram_job_id"
          }
        ]
      },
      {
        "key": "ram_entries",
        "parts": [
          "LC_ALL=C ls -A1 /tmp/qingping-initial-trial-",
          {
            "field": "ram_job_id"
          }
        ]
      },
      {
        "key": "identity_uid",
        "parts": [
          "id -u"
        ]
      },
      {
        "key": "identity_wlan",
        "parts": [
          "cat /sys/class/net/wlan0/address"
        ]
      },
      {
        "key": "identity_version",
        "parts": [
          "cat /data/etc/os-release"
        ]
      },
      {
        "key": "identity_architecture",
        "parts": [
          "uname -m"
        ]
      },
      {
        "key": "identity_co2",
        "parts": [
          "awk '\nBEGIN { section=0; count=0 }\n/^[ \\t]*\\[/ { section=($0 ~ /^[ \\t]*\\[sensors\\][ \\t]*\\r?$/) }\nsection && /^[ \\t]*co2_type[ \\t]*=/ {\n    value=$0; sub(/^[^=]*=[ \\t]*/, \"\", value); sub(/[ \\t\\r]*$/, \"\", value)\n    print value; count++\n}\nEND { if (count != 1) exit 1 }\n' /data/etc/setting.ini"
        ]
      },
      {
        "key": "identity_boot",
        "parts": [
          "cat /proc/sys/kernel/random/boot_id"
        ]
      },
      {
        "key": "child_after",
        "parts": [
          "count=0\nfor file in /proc/[0-9]*/stat; do\n count=$((count+1)); [ \"$count\" -le 4096 ] || exit 1\n task=${file%/stat}; child=${task#/proc/}\n row=$(sed 's/.*) //' \"$file\" 2>/dev/null | awk '{print $1, $2, $20}')\n set -- $row\n if [ \"$#\" -ne 3 ]; then [ ! -d \"$task\" ] && continue; exit 1; fi\n case \"$2:$3\" in (*[!0-9:]*|:*|*:) exit 1;; esac\n if [ \"$2\" = '",
          {
            "field": "guardian_pid"
          },
          "' ]; then printf '%s %s %s\\n' \"$child\" \"$3\" \"$1\"; fi\ndone"
        ]
      }
    ],
    "prefs_empty": [
      {
        "key": "child_before",
        "parts": [
          "count=0\nfor file in /proc/[0-9]*/stat; do\n count=$((count+1)); [ \"$count\" -le 4096 ] || exit 1\n task=${file%/stat}; child=${task#/proc/}\n row=$(sed 's/.*) //' \"$file\" 2>/dev/null | awk '{print $1, $2, $20}')\n set -- $row\n if [ \"$#\" -ne 3 ]; then [ ! -d \"$task\" ] && continue; exit 1; fi\n case \"$2:$3\" in (*[!0-9:]*|:*|*:) exit 1;; esac\n if [ \"$2\" = '",
          {
            "field": "guardian_pid"
          },
          "' ]; then printf '%s %s %s\\n' \"$child\" \"$3\" \"$1\"; fi\ndone"
        ]
      },
      {
        "key": "guardian_process_before",
        "parts": [
          "cat /proc/",
          {
            "field": "guardian_pid"
          },
          "/stat\nstat -c '%u' /proc/",
          {
            "field": "guardian_pid"
          },
          "\nreadlink /proc/",
          {
            "field": "guardian_pid"
          },
          "/exe"
        ]
      },
      {
        "key": "guardian_file",
        "parts": [
          "test ! -L /tmp/qingping-initial-guardian-",
          {
            "field": "guardian_job_id"
          },
          "/program\ntest -f /tmp/qingping-initial-guardian-",
          {
            "field": "guardian_job_id"
          },
          "/program\nstat -c '%s %h' /tmp/qingping-initial-guardian-",
          {
            "field": "guardian_job_id"
          },
          "/program\nsha256sum /tmp/qingping-initial-guardian-",
          {
            "field": "guardian_job_id"
          },
          "/program"
        ]
      },
      {
        "key": "guardian_image",
        "parts": [
          "stat -L -c '%d %i %s %a %u %h' /proc/",
          {
            "field": "guardian_pid"
          },
          "/exe\nstat -c '%d %i %s %a %u %h' /tmp/qingping-initial-guardian-",
          {
            "field": "guardian_job_id"
          },
          "/program\nsha256sum /proc/",
          {
            "field": "guardian_pid"
          },
          "/exe"
        ]
      },
      {
        "key": "guardian_process_after",
        "parts": [
          "cat /proc/",
          {
            "field": "guardian_pid"
          },
          "/stat\nstat -c '%u' /proc/",
          {
            "field": "guardian_pid"
          },
          "\nreadlink /proc/",
          {
            "field": "guardian_pid"
          },
          "/exe"
        ]
      },
      {
        "key": "child_process_before",
        "parts": [
          "cat /proc/",
          {
            "field": "child_pid"
          },
          "/stat\nstat -c '%u' /proc/",
          {
            "field": "child_pid"
          },
          "\nreadlink /proc/",
          {
            "field": "child_pid"
          },
          "/exe"
        ]
      },
      {
        "key": "child_file",
        "parts": [
          "test ! -L /data/.esphome-cgs1/program\ntest -f /data/.esphome-cgs1/program\nstat -c '%s %h' /data/.esphome-cgs1/program\nsha256sum /data/.esphome-cgs1/program"
        ]
      },
      {
        "key": "child_image",
        "parts": [
          "stat -L -c '%d %i %s %a %u %h' /proc/",
          {
            "field": "child_pid"
          },
          "/exe\nstat -c '%d %i %s %a %u %h' /data/.esphome-cgs1/program\nsha256sum /proc/",
          {
            "field": "child_pid"
          },
          "/exe"
        ]
      },
      {
        "key": "child_process_after",
        "parts": [
          "cat /proc/",
          {
            "field": "child_pid"
          },
          "/stat\nstat -c '%u' /proc/",
          {
            "field": "child_pid"
          },
          "\nreadlink /proc/",
          {
            "field": "child_pid"
          },
          "/exe"
        ]
      },
      {
        "key": "endpoint",
        "parts": [
          "sockets=' '\ncount=0\nfor file in /proc/",
          {
            "field": "child_pid"
          },
          "/fd/*; do\n count=$((count+1)); [ \"$count\" -le 4096 ] || exit 1\n link=$(readlink \"$file\")\n case \"$link\" in (socket:\\[*\\]) inode=${link#socket:}; inode=${inode#\\[}; inode=${inode%\\]}; case \"$inode\" in (''|*[!0-9]*) exit 1;; esac; sockets=\"$sockets$inode \";; esac\ndone\nfor table in /proc/net/tcp /proc/net/tcp6; do\n test -r \"$table\"\n awk -v owned=\"$sockets\" '\n NR==1 { if ($2!=\"local_address\") bad=1; next }\n { count=split($2, local, \":\"); port=toupper(local[2]); address=toupper(local[1]); state=toupper($4);\n   if ($1 !~ /^[0-9]+:$/ || NF<10 || count!=2 || (length(address)!=8 && length(address)!=32) ||\n       address ~ /[^0-9A-F]/ || length(port)!=4 || port ~ /[^0-9A-F]/ ||\n       length(state)!=2 || state ~ /[^0-9A-F]/ || $10 !~ /^[0-9]+$/) bad=1;\n   if (port==\"17A5\" || port==\"0CA0\") {\n     if ($10 !~ /^[1-9][0-9]*$/ || index(owned, \" \" $10 \" \")==0) bad=1;\n     if (state==\"0A\") print FILENAME, port;\n   }\n }\n END { if (!NR || bad) exit 1 }\n ' \"$table\"\ndone"
        ]
      },
      {
        "key": "process_scan",
        "parts": [
          "count=0\nfor link in /proc/[0-9]*/exe; do\n    count=$((count+1))\n    [ \"$count\" -le 4096 ] || exit 1\n    pid=${link#/proc/}; pid=${pid%/exe}\n    case \"$pid\" in (''|*[!0-9]*) exit 1;; esac\n    if executable=$(readlink \"$link\" 2>/dev/null); then\n        :\n    else\n        # Kernel threads and exited tasks legitimately have no executable.\n        # An unreadable live userspace exe is NOT evidence of its absence.\n        [ -d \"/proc/$pid\" ] || continue\n        metadata=$(sed 's/.*) //' \"/proc/$pid/stat\" 2>/dev/null | awk '{print $1, $7}')\n        set -- $metadata\n        if [ \"$#\" -ne 2 ]; then\n            [ ! -d \"/proc/$pid\" ] && continue\n            exit 1\n        fi\n        case \"$2\" in (''|*[!0-9]*) exit 1;; esac\n        case \"$1\" in (Z|X|x) continue;; esac\n        [ \"$(($2 & 2097152))\" -ne 0 ] || exit 1\n        continue\n    fi\n    case \"$executable\" in\n        (/data/.esphome-cgs1/*|/tmp/qingping-full-*/*|/tmp/qingping-initial-*/*)\ncase \"$pid:$executable\" in\n(",
          {
            "field": "guardian_pid"
          },
          ":/tmp/qingping-initial-guardian-",
          {
            "field": "guardian_job_id"
          },
          "/program|",
          {
            "field": "child_pid"
          },
          ":/data/.esphome-cgs1/program) :;;\n(*) exit 1;;\nesac;;\n        (/data/bin/SnowApp) printf '%s\\n' \"$pid\";;\n    esac\ndone"
        ]
      },
      {
        "key": "stock_process",
        "parts": [
          "cat /proc/",
          {
            "field": "stock_pid"
          },
          "/stat\nstat -c '%u' /proc/",
          {
            "field": "stock_pid"
          },
          "\nreadlink /proc/",
          {
            "field": "stock_pid"
          },
          "/exe"
        ]
      },
      {
        "key": "watchdog_process",
        "parts": [
          "cat /proc/",
          {
            "field": "watchdog_pid"
          },
          "/stat\nstat -c '%u' /proc/",
          {
            "field": "watchdog_pid"
          },
          "\nreadlink /proc/",
          {
            "field": "watchdog_pid"
          },
          "/exe"
        ]
      },
      {
        "key": "watchdog_arguments",
        "parts": [
          "arguments=$(tr '\\000' '\\n' < /proc/",
          {
            "field": "watchdog_pid"
          },
          "/cmdline)\n[ \"$arguments\" = \"$(printf '/bin/sh\\n/data/bin/watchdog.sh')\" ]"
        ]
      },
      {
        "key": "stock_maps_0",
        "parts": [
          "test -r /proc/",
          {
            "field": "stock_pid"
          },
          "/maps\nif grep -F -q /data/.esphome-cgs1/ /proc/",
          {
            "field": "stock_pid"
          },
          "/maps; then exit 1; else result=$?; [ \"$result\" -eq 1 ]; fi"
        ]
      },
      {
        "key": "stock_maps_1",
        "parts": [
          "test -r /proc/",
          {
            "field": "stock_pid"
          },
          "/maps\nif grep -F -q /tmp/qingping-full- /proc/",
          {
            "field": "stock_pid"
          },
          "/maps; then exit 1; else result=$?; [ \"$result\" -eq 1 ]; fi"
        ]
      },
      {
        "key": "stock_maps_2",
        "parts": [
          "test -r /proc/",
          {
            "field": "stock_pid"
          },
          "/maps\nif grep -F -q /tmp/qingping-initial- /proc/",
          {
            "field": "stock_pid"
          },
          "/maps; then exit 1; else result=$?; [ \"$result\" -eq 1 ]; fi"
        ]
      },
      {
        "key": "vendor_0",
        "parts": [
          "test ! -L /data/bin/SnowApp\ntest -f /data/bin/SnowApp\nstat -c '%s %h' /data/bin/SnowApp\nsha256sum /data/bin/SnowApp"
        ]
      },
      {
        "key": "vendor_1",
        "parts": [
          "test ! -L /data/bin/watchdog.sh\ntest -f /data/bin/watchdog.sh\nstat -c '%s %h' /data/bin/watchdog.sh\nsha256sum /data/bin/watchdog.sh"
        ]
      },
      {
        "key": "vendor_2",
        "parts": [
          "test ! -L /data/etc/init.d/start.sh\ntest -f /data/etc/init.d/start.sh\nstat -c '%s %h' /data/etc/init.d/start.sh\nsha256sum /data/etc/init.d/start.sh"
        ]
      },
      {
        "key": "vendor_3",
        "parts": [
          "test ! -L /etc/init.d/S12_launcher_init\ntest -f /etc/init.d/S12_launcher_init\nstat -c '%s %h' /etc/init.d/S12_launcher_init\nsha256sum /etc/init.d/S12_launcher_init"
        ]
      },
      {
        "key": "vendor_4",
        "parts": [
          "test ! -L /etc/init.d/S50_px3se_init\ntest -f /etc/init.d/S50_px3se_init\nstat -c '%s %h' /etc/init.d/S50_px3se_init\nsha256sum /etc/init.d/S50_px3se_init"
        ]
      },
      {
        "key": "vendor_5",
        "parts": [
          "test ! -L /lib/ld-2.23.so\ntest -f /lib/ld-2.23.so\nstat -c '%s %h' /lib/ld-2.23.so\nsha256sum /lib/ld-2.23.so"
        ]
      },
      {
        "key": "vendor_6",
        "parts": [
          "test ! -L /lib/libc-2.23.so\ntest -f /lib/libc-2.23.so\nstat -c '%s %h' /lib/libc-2.23.so\nsha256sum /lib/libc-2.23.so"
        ]
      },
      {
        "key": "vendor_7",
        "parts": [
          "test ! -L /usr/lib/libstdc++.so.6.0.20\ntest -f /usr/lib/libstdc++.so.6.0.20\nstat -c '%s %h' /usr/lib/libstdc++.so.6.0.20\nsha256sum /usr/lib/libstdc++.so.6.0.20"
        ]
      },
      {
        "key": "vendor_8",
        "parts": [
          "test ! -L /usr/lib/libQt5Core.so.5.9.4\ntest -f /usr/lib/libQt5Core.so.5.9.4\nstat -c '%s %h' /usr/lib/libQt5Core.so.5.9.4\nsha256sum /usr/lib/libQt5Core.so.5.9.4"
        ]
      },
      {
        "key": "staged_0",
        "parts": [
          "test ! -L /data/.esphome-cgs1/program\ntest -f /data/.esphome-cgs1/program\nstat -c '%s %h' /data/.esphome-cgs1/program\nsha256sum /data/.esphome-cgs1/program"
        ]
      },
      {
        "key": "staged_1",
        "parts": [
          "test ! -L /data/.esphome-cgs1/pm_qt_bridge.so\ntest -f /data/.esphome-cgs1/pm_qt_bridge.so\nstat -c '%s %h' /data/.esphome-cgs1/pm_qt_bridge.so\nsha256sum /data/.esphome-cgs1/pm_qt_bridge.so"
        ]
      },
      {
        "key": "staged_2",
        "parts": [
          "test ! -L /data/.esphome-cgs1/launch.sh\ntest -f /data/.esphome-cgs1/launch.sh\nstat -c '%s %h' /data/.esphome-cgs1/launch.sh\nsha256sum /data/.esphome-cgs1/launch.sh"
        ]
      },
      {
        "key": "staged_3",
        "parts": [
          "test ! -L /data/.esphome-cgs1/SnowApp-with-PM\ntest -f /data/.esphome-cgs1/SnowApp-with-PM\nstat -c '%s %h' /data/.esphome-cgs1/SnowApp-with-PM\nsha256sum /data/.esphome-cgs1/SnowApp-with-PM"
        ]
      },
      {
        "key": "staged_4",
        "parts": [
          "test ! -L /data/.esphome-cgs1/startup-hook.sh\ntest -f /data/.esphome-cgs1/startup-hook.sh\nstat -c '%s %h' /data/.esphome-cgs1/startup-hook.sh\nsha256sum /data/.esphome-cgs1/startup-hook.sh"
        ]
      },
      {
        "key": "staged_5",
        "parts": [
          "test ! -L /data/.esphome-cgs1/stock-start.sh.original\ntest -f /data/.esphome-cgs1/stock-start.sh.original\nstat -c '%s %h' /data/.esphome-cgs1/stock-start.sh.original\nsha256sum /data/.esphome-cgs1/stock-start.sh.original"
        ]
      },
      {
        "key": "staged_6",
        "parts": [
          "test ! -L /data/.esphome-cgs1/stock-watchdog.sh.original\ntest -f /data/.esphome-cgs1/stock-watchdog.sh.original\nstat -c '%s %h' /data/.esphome-cgs1/stock-watchdog.sh.original\nsha256sum /data/.esphome-cgs1/stock-watchdog.sh.original"
        ]
      },
      {
        "key": "staged_7",
        "parts": [
          "test ! -L /data/.esphome-cgs1/start.sh.candidate\ntest -f /data/.esphome-cgs1/start.sh.candidate\nstat -c '%s %h' /data/.esphome-cgs1/start.sh.candidate\nsha256sum /data/.esphome-cgs1/start.sh.candidate"
        ]
      },
      {
        "key": "staged_8",
        "parts": [
          "test ! -L /data/.esphome-cgs1/watchdog.sh.candidate\ntest -f /data/.esphome-cgs1/watchdog.sh.candidate\nstat -c '%s %h' /data/.esphome-cgs1/watchdog.sh.candidate\nsha256sum /data/.esphome-cgs1/watchdog.sh.candidate"
        ]
      },
      {
        "key": "root",
        "parts": [
          "test ! -L /data/.esphome-cgs1\ntest -d /data/.esphome-cgs1\nstat -c '%d %i %a %u' /data/.esphome-cgs1\ntest ! -L /data/.esphome-cgs1/install.intent\ntest -f /data/.esphome-cgs1/install.intent\n[ \"$(stat -c '%s %a %u %h' /data/.esphome-cgs1/install.intent)\" = '98 600 0 1' ]\ncat /data/.esphome-cgs1/install.intent"
        ]
      },
      {
        "key": "parents",
        "parts": [
          "test ! -L /data/bin\ntest ! -L /data/etc\ntest ! -L /data/etc/init.d\nstat -c '%d' /data/bin /data/etc/init.d"
        ]
      },
      {
        "key": "disabled",
        "parts": [
          "test ! -L /data/.esphome-cgs1/disabled\ntest -f /data/.esphome-cgs1/disabled\nstat -c '%s %a %u %h' /data/.esphome-cgs1/disabled\nsha256sum /data/.esphome-cgs1/disabled"
        ]
      },
      {
        "key": "pm-helper.disabled",
        "parts": [
          "test ! -L /data/.esphome-cgs1/pm-helper.disabled\ntest -f /data/.esphome-cgs1/pm-helper.disabled\nstat -c '%s %a %u %h' /data/.esphome-cgs1/pm-helper.disabled\nsha256sum /data/.esphome-cgs1/pm-helper.disabled"
        ]
      },
      {
        "key": "absent_stores",
        "parts": [
          "# CGS1_INITIAL_ABSENT_STORES\nentries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)\nprintf '%s\\n' \"$entries\" | while IFS= read -r entry; do\n    case \"$entry\" in (full-releases|wifi|prefs|full-state) exit 1;; esac\ndone\nentries=$(LC_ALL=C ls -A1 /tmp)\nprintf '%s\\n' \"$entries\" | while IFS= read -r entry; do\n    case \"$entry\" in (qingping-cgs1-esphome.lock) exit 1;; esac\ndone"
        ]
      },
      {
        "key": "memory",
        "parts": [
          "# CGS1_INITIAL_MEMORY\nawk '$1 == \"MemTotal:\" || $1 == \"MemFree:\" { print }' /proc/meminfo"
        ]
      },
      {
        "key": "intent_file",
        "parts": [
          "test ! -L /data/.esphome-cgs1/initial-trial.intent\ntest -f /data/.esphome-cgs1/initial-trial.intent\nstat -c '%s %h' /data/.esphome-cgs1/initial-trial.intent\nsha256sum /data/.esphome-cgs1/initial-trial.intent"
        ]
      },
      {
        "key": "intent_mode",
        "parts": [
          "observed_value=$(stat -c '%a %u' /data/.esphome-cgs1/initial-trial.intent)\n[ \"$observed_value\" = '600 0' ]\n"
        ]
      },
      {
        "key": "nand_entries",
        "parts": [
          "LC_ALL=C ls -A1 /data/.esphome-cgs1"
        ]
      },
      {
        "key": "commit_marker",
        "parts": [
          "# CGS1_INITIAL_COMMIT_MARKER\ntest ! -L /data/.esphome-cgs1/.commit-disabled.lock\ntest -d /data/.esphome-cgs1/.commit-disabled.lock\nobserved_value=$(stat -c '%a %u' /data/.esphome-cgs1/.commit-disabled.lock)\n[ \"$observed_value\" = '700 0' ]\ntest ! -L /data/.esphome-cgs1/.commit-disabled.lock/owner\ntest -f /data/.esphome-cgs1/.commit-disabled.lock/owner\nobserved_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/.commit-disabled.lock/owner)\n[ \"$observed_value\" = '82 600 0 1' ]\ncat /data/.esphome-cgs1/.commit-disabled.lock/owner"
        ]
      },
      {
        "key": "ram_identity",
        "parts": [
          "test ! -L /tmp\ntest ! -L /tmp/qingping-initial-trial-",
          {
            "field": "ram_job_id"
          },
          "\ntest -d /tmp/qingping-initial-trial-",
          {
            "field": "ram_job_id"
          },
          "\nstat -c '%d %i %a %u' /tmp/qingping-initial-trial-",
          {
            "field": "ram_job_id"
          },
          "\nstat -f -c '%t' /tmp/qingping-initial-trial-",
          {
            "field": "ram_job_id"
          }
        ]
      },
      {
        "key": "ram_entries",
        "parts": [
          "LC_ALL=C ls -A1 /tmp/qingping-initial-trial-",
          {
            "field": "ram_job_id"
          }
        ]
      },
      {
        "key": "prefs_guard",
        "parts": [
          "test ! -L /tmp/qingping-initial-trial-",
          {
            "field": "ram_job_id"
          },
          "/prefs\ntest -d /tmp/qingping-initial-trial-",
          {
            "field": "ram_job_id"
          },
          "/prefs\nobserved_value=$(stat -c '%a %u %d' /tmp/qingping-initial-trial-",
          {
            "field": "ram_job_id"
          },
          "/prefs)\n[ \"$observed_value\" = '700 0 ",
          {
            "field": "ram_device"
          },
          "' ]\n"
        ]
      },
      {
        "key": "prefs_entries",
        "parts": [
          "LC_ALL=C ls -A1 /tmp/qingping-initial-trial-",
          {
            "field": "ram_job_id"
          },
          "/prefs"
        ]
      },
      {
        "key": "identity_uid",
        "parts": [
          "id -u"
        ]
      },
      {
        "key": "identity_wlan",
        "parts": [
          "cat /sys/class/net/wlan0/address"
        ]
      },
      {
        "key": "identity_version",
        "parts": [
          "cat /data/etc/os-release"
        ]
      },
      {
        "key": "identity_architecture",
        "parts": [
          "uname -m"
        ]
      },
      {
        "key": "identity_co2",
        "parts": [
          "awk '\nBEGIN { section=0; count=0 }\n/^[ \\t]*\\[/ { section=($0 ~ /^[ \\t]*\\[sensors\\][ \\t]*\\r?$/) }\nsection && /^[ \\t]*co2_type[ \\t]*=/ {\n    value=$0; sub(/^[^=]*=[ \\t]*/, \"\", value); sub(/[ \\t\\r]*$/, \"\", value)\n    print value; count++\n}\nEND { if (count != 1) exit 1 }\n' /data/etc/setting.ini"
        ]
      },
      {
        "key": "identity_boot",
        "parts": [
          "cat /proc/sys/kernel/random/boot_id"
        ]
      },
      {
        "key": "child_after",
        "parts": [
          "count=0\nfor file in /proc/[0-9]*/stat; do\n count=$((count+1)); [ \"$count\" -le 4096 ] || exit 1\n task=${file%/stat}; child=${task#/proc/}\n row=$(sed 's/.*) //' \"$file\" 2>/dev/null | awk '{print $1, $2, $20}')\n set -- $row\n if [ \"$#\" -ne 3 ]; then [ ! -d \"$task\" ] && continue; exit 1; fi\n case \"$2:$3\" in (*[!0-9:]*|:*|*:) exit 1;; esac\n if [ \"$2\" = '",
          {
            "field": "guardian_pid"
          },
          "' ]; then printf '%s %s %s\\n' \"$child\" \"$3\" \"$1\"; fi\ndone"
        ]
      }
    ],
    "prefs_file": [
      {
        "key": "child_before",
        "parts": [
          "count=0\nfor file in /proc/[0-9]*/stat; do\n count=$((count+1)); [ \"$count\" -le 4096 ] || exit 1\n task=${file%/stat}; child=${task#/proc/}\n row=$(sed 's/.*) //' \"$file\" 2>/dev/null | awk '{print $1, $2, $20}')\n set -- $row\n if [ \"$#\" -ne 3 ]; then [ ! -d \"$task\" ] && continue; exit 1; fi\n case \"$2:$3\" in (*[!0-9:]*|:*|*:) exit 1;; esac\n if [ \"$2\" = '",
          {
            "field": "guardian_pid"
          },
          "' ]; then printf '%s %s %s\\n' \"$child\" \"$3\" \"$1\"; fi\ndone"
        ]
      },
      {
        "key": "guardian_process_before",
        "parts": [
          "cat /proc/",
          {
            "field": "guardian_pid"
          },
          "/stat\nstat -c '%u' /proc/",
          {
            "field": "guardian_pid"
          },
          "\nreadlink /proc/",
          {
            "field": "guardian_pid"
          },
          "/exe"
        ]
      },
      {
        "key": "guardian_file",
        "parts": [
          "test ! -L /tmp/qingping-initial-guardian-",
          {
            "field": "guardian_job_id"
          },
          "/program\ntest -f /tmp/qingping-initial-guardian-",
          {
            "field": "guardian_job_id"
          },
          "/program\nstat -c '%s %h' /tmp/qingping-initial-guardian-",
          {
            "field": "guardian_job_id"
          },
          "/program\nsha256sum /tmp/qingping-initial-guardian-",
          {
            "field": "guardian_job_id"
          },
          "/program"
        ]
      },
      {
        "key": "guardian_image",
        "parts": [
          "stat -L -c '%d %i %s %a %u %h' /proc/",
          {
            "field": "guardian_pid"
          },
          "/exe\nstat -c '%d %i %s %a %u %h' /tmp/qingping-initial-guardian-",
          {
            "field": "guardian_job_id"
          },
          "/program\nsha256sum /proc/",
          {
            "field": "guardian_pid"
          },
          "/exe"
        ]
      },
      {
        "key": "guardian_process_after",
        "parts": [
          "cat /proc/",
          {
            "field": "guardian_pid"
          },
          "/stat\nstat -c '%u' /proc/",
          {
            "field": "guardian_pid"
          },
          "\nreadlink /proc/",
          {
            "field": "guardian_pid"
          },
          "/exe"
        ]
      },
      {
        "key": "child_process_before",
        "parts": [
          "cat /proc/",
          {
            "field": "child_pid"
          },
          "/stat\nstat -c '%u' /proc/",
          {
            "field": "child_pid"
          },
          "\nreadlink /proc/",
          {
            "field": "child_pid"
          },
          "/exe"
        ]
      },
      {
        "key": "child_file",
        "parts": [
          "test ! -L /data/.esphome-cgs1/program\ntest -f /data/.esphome-cgs1/program\nstat -c '%s %h' /data/.esphome-cgs1/program\nsha256sum /data/.esphome-cgs1/program"
        ]
      },
      {
        "key": "child_image",
        "parts": [
          "stat -L -c '%d %i %s %a %u %h' /proc/",
          {
            "field": "child_pid"
          },
          "/exe\nstat -c '%d %i %s %a %u %h' /data/.esphome-cgs1/program\nsha256sum /proc/",
          {
            "field": "child_pid"
          },
          "/exe"
        ]
      },
      {
        "key": "child_process_after",
        "parts": [
          "cat /proc/",
          {
            "field": "child_pid"
          },
          "/stat\nstat -c '%u' /proc/",
          {
            "field": "child_pid"
          },
          "\nreadlink /proc/",
          {
            "field": "child_pid"
          },
          "/exe"
        ]
      },
      {
        "key": "endpoint",
        "parts": [
          "sockets=' '\ncount=0\nfor file in /proc/",
          {
            "field": "child_pid"
          },
          "/fd/*; do\n count=$((count+1)); [ \"$count\" -le 4096 ] || exit 1\n link=$(readlink \"$file\")\n case \"$link\" in (socket:\\[*\\]) inode=${link#socket:}; inode=${inode#\\[}; inode=${inode%\\]}; case \"$inode\" in (''|*[!0-9]*) exit 1;; esac; sockets=\"$sockets$inode \";; esac\ndone\nfor table in /proc/net/tcp /proc/net/tcp6; do\n test -r \"$table\"\n awk -v owned=\"$sockets\" '\n NR==1 { if ($2!=\"local_address\") bad=1; next }\n { count=split($2, local, \":\"); port=toupper(local[2]); address=toupper(local[1]); state=toupper($4);\n   if ($1 !~ /^[0-9]+:$/ || NF<10 || count!=2 || (length(address)!=8 && length(address)!=32) ||\n       address ~ /[^0-9A-F]/ || length(port)!=4 || port ~ /[^0-9A-F]/ ||\n       length(state)!=2 || state ~ /[^0-9A-F]/ || $10 !~ /^[0-9]+$/) bad=1;\n   if (port==\"17A5\" || port==\"0CA0\") {\n     if ($10 !~ /^[1-9][0-9]*$/ || index(owned, \" \" $10 \" \")==0) bad=1;\n     if (state==\"0A\") print FILENAME, port;\n   }\n }\n END { if (!NR || bad) exit 1 }\n ' \"$table\"\ndone"
        ]
      },
      {
        "key": "process_scan",
        "parts": [
          "count=0\nfor link in /proc/[0-9]*/exe; do\n    count=$((count+1))\n    [ \"$count\" -le 4096 ] || exit 1\n    pid=${link#/proc/}; pid=${pid%/exe}\n    case \"$pid\" in (''|*[!0-9]*) exit 1;; esac\n    if executable=$(readlink \"$link\" 2>/dev/null); then\n        :\n    else\n        # Kernel threads and exited tasks legitimately have no executable.\n        # An unreadable live userspace exe is NOT evidence of its absence.\n        [ -d \"/proc/$pid\" ] || continue\n        metadata=$(sed 's/.*) //' \"/proc/$pid/stat\" 2>/dev/null | awk '{print $1, $7}')\n        set -- $metadata\n        if [ \"$#\" -ne 2 ]; then\n            [ ! -d \"/proc/$pid\" ] && continue\n            exit 1\n        fi\n        case \"$2\" in (''|*[!0-9]*) exit 1;; esac\n        case \"$1\" in (Z|X|x) continue;; esac\n        [ \"$(($2 & 2097152))\" -ne 0 ] || exit 1\n        continue\n    fi\n    case \"$executable\" in\n        (/data/.esphome-cgs1/*|/tmp/qingping-full-*/*|/tmp/qingping-initial-*/*)\ncase \"$pid:$executable\" in\n(",
          {
            "field": "guardian_pid"
          },
          ":/tmp/qingping-initial-guardian-",
          {
            "field": "guardian_job_id"
          },
          "/program|",
          {
            "field": "child_pid"
          },
          ":/data/.esphome-cgs1/program) :;;\n(*) exit 1;;\nesac;;\n        (/data/bin/SnowApp) printf '%s\\n' \"$pid\";;\n    esac\ndone"
        ]
      },
      {
        "key": "stock_process",
        "parts": [
          "cat /proc/",
          {
            "field": "stock_pid"
          },
          "/stat\nstat -c '%u' /proc/",
          {
            "field": "stock_pid"
          },
          "\nreadlink /proc/",
          {
            "field": "stock_pid"
          },
          "/exe"
        ]
      },
      {
        "key": "watchdog_process",
        "parts": [
          "cat /proc/",
          {
            "field": "watchdog_pid"
          },
          "/stat\nstat -c '%u' /proc/",
          {
            "field": "watchdog_pid"
          },
          "\nreadlink /proc/",
          {
            "field": "watchdog_pid"
          },
          "/exe"
        ]
      },
      {
        "key": "watchdog_arguments",
        "parts": [
          "arguments=$(tr '\\000' '\\n' < /proc/",
          {
            "field": "watchdog_pid"
          },
          "/cmdline)\n[ \"$arguments\" = \"$(printf '/bin/sh\\n/data/bin/watchdog.sh')\" ]"
        ]
      },
      {
        "key": "stock_maps_0",
        "parts": [
          "test -r /proc/",
          {
            "field": "stock_pid"
          },
          "/maps\nif grep -F -q /data/.esphome-cgs1/ /proc/",
          {
            "field": "stock_pid"
          },
          "/maps; then exit 1; else result=$?; [ \"$result\" -eq 1 ]; fi"
        ]
      },
      {
        "key": "stock_maps_1",
        "parts": [
          "test -r /proc/",
          {
            "field": "stock_pid"
          },
          "/maps\nif grep -F -q /tmp/qingping-full- /proc/",
          {
            "field": "stock_pid"
          },
          "/maps; then exit 1; else result=$?; [ \"$result\" -eq 1 ]; fi"
        ]
      },
      {
        "key": "stock_maps_2",
        "parts": [
          "test -r /proc/",
          {
            "field": "stock_pid"
          },
          "/maps\nif grep -F -q /tmp/qingping-initial- /proc/",
          {
            "field": "stock_pid"
          },
          "/maps; then exit 1; else result=$?; [ \"$result\" -eq 1 ]; fi"
        ]
      },
      {
        "key": "vendor_0",
        "parts": [
          "test ! -L /data/bin/SnowApp\ntest -f /data/bin/SnowApp\nstat -c '%s %h' /data/bin/SnowApp\nsha256sum /data/bin/SnowApp"
        ]
      },
      {
        "key": "vendor_1",
        "parts": [
          "test ! -L /data/bin/watchdog.sh\ntest -f /data/bin/watchdog.sh\nstat -c '%s %h' /data/bin/watchdog.sh\nsha256sum /data/bin/watchdog.sh"
        ]
      },
      {
        "key": "vendor_2",
        "parts": [
          "test ! -L /data/etc/init.d/start.sh\ntest -f /data/etc/init.d/start.sh\nstat -c '%s %h' /data/etc/init.d/start.sh\nsha256sum /data/etc/init.d/start.sh"
        ]
      },
      {
        "key": "vendor_3",
        "parts": [
          "test ! -L /etc/init.d/S12_launcher_init\ntest -f /etc/init.d/S12_launcher_init\nstat -c '%s %h' /etc/init.d/S12_launcher_init\nsha256sum /etc/init.d/S12_launcher_init"
        ]
      },
      {
        "key": "vendor_4",
        "parts": [
          "test ! -L /etc/init.d/S50_px3se_init\ntest -f /etc/init.d/S50_px3se_init\nstat -c '%s %h' /etc/init.d/S50_px3se_init\nsha256sum /etc/init.d/S50_px3se_init"
        ]
      },
      {
        "key": "vendor_5",
        "parts": [
          "test ! -L /lib/ld-2.23.so\ntest -f /lib/ld-2.23.so\nstat -c '%s %h' /lib/ld-2.23.so\nsha256sum /lib/ld-2.23.so"
        ]
      },
      {
        "key": "vendor_6",
        "parts": [
          "test ! -L /lib/libc-2.23.so\ntest -f /lib/libc-2.23.so\nstat -c '%s %h' /lib/libc-2.23.so\nsha256sum /lib/libc-2.23.so"
        ]
      },
      {
        "key": "vendor_7",
        "parts": [
          "test ! -L /usr/lib/libstdc++.so.6.0.20\ntest -f /usr/lib/libstdc++.so.6.0.20\nstat -c '%s %h' /usr/lib/libstdc++.so.6.0.20\nsha256sum /usr/lib/libstdc++.so.6.0.20"
        ]
      },
      {
        "key": "vendor_8",
        "parts": [
          "test ! -L /usr/lib/libQt5Core.so.5.9.4\ntest -f /usr/lib/libQt5Core.so.5.9.4\nstat -c '%s %h' /usr/lib/libQt5Core.so.5.9.4\nsha256sum /usr/lib/libQt5Core.so.5.9.4"
        ]
      },
      {
        "key": "staged_0",
        "parts": [
          "test ! -L /data/.esphome-cgs1/program\ntest -f /data/.esphome-cgs1/program\nstat -c '%s %h' /data/.esphome-cgs1/program\nsha256sum /data/.esphome-cgs1/program"
        ]
      },
      {
        "key": "staged_1",
        "parts": [
          "test ! -L /data/.esphome-cgs1/pm_qt_bridge.so\ntest -f /data/.esphome-cgs1/pm_qt_bridge.so\nstat -c '%s %h' /data/.esphome-cgs1/pm_qt_bridge.so\nsha256sum /data/.esphome-cgs1/pm_qt_bridge.so"
        ]
      },
      {
        "key": "staged_2",
        "parts": [
          "test ! -L /data/.esphome-cgs1/launch.sh\ntest -f /data/.esphome-cgs1/launch.sh\nstat -c '%s %h' /data/.esphome-cgs1/launch.sh\nsha256sum /data/.esphome-cgs1/launch.sh"
        ]
      },
      {
        "key": "staged_3",
        "parts": [
          "test ! -L /data/.esphome-cgs1/SnowApp-with-PM\ntest -f /data/.esphome-cgs1/SnowApp-with-PM\nstat -c '%s %h' /data/.esphome-cgs1/SnowApp-with-PM\nsha256sum /data/.esphome-cgs1/SnowApp-with-PM"
        ]
      },
      {
        "key": "staged_4",
        "parts": [
          "test ! -L /data/.esphome-cgs1/startup-hook.sh\ntest -f /data/.esphome-cgs1/startup-hook.sh\nstat -c '%s %h' /data/.esphome-cgs1/startup-hook.sh\nsha256sum /data/.esphome-cgs1/startup-hook.sh"
        ]
      },
      {
        "key": "staged_5",
        "parts": [
          "test ! -L /data/.esphome-cgs1/stock-start.sh.original\ntest -f /data/.esphome-cgs1/stock-start.sh.original\nstat -c '%s %h' /data/.esphome-cgs1/stock-start.sh.original\nsha256sum /data/.esphome-cgs1/stock-start.sh.original"
        ]
      },
      {
        "key": "staged_6",
        "parts": [
          "test ! -L /data/.esphome-cgs1/stock-watchdog.sh.original\ntest -f /data/.esphome-cgs1/stock-watchdog.sh.original\nstat -c '%s %h' /data/.esphome-cgs1/stock-watchdog.sh.original\nsha256sum /data/.esphome-cgs1/stock-watchdog.sh.original"
        ]
      },
      {
        "key": "staged_7",
        "parts": [
          "test ! -L /data/.esphome-cgs1/start.sh.candidate\ntest -f /data/.esphome-cgs1/start.sh.candidate\nstat -c '%s %h' /data/.esphome-cgs1/start.sh.candidate\nsha256sum /data/.esphome-cgs1/start.sh.candidate"
        ]
      },
      {
        "key": "staged_8",
        "parts": [
          "test ! -L /data/.esphome-cgs1/watchdog.sh.candidate\ntest -f /data/.esphome-cgs1/watchdog.sh.candidate\nstat -c '%s %h' /data/.esphome-cgs1/watchdog.sh.candidate\nsha256sum /data/.esphome-cgs1/watchdog.sh.candidate"
        ]
      },
      {
        "key": "root",
        "parts": [
          "test ! -L /data/.esphome-cgs1\ntest -d /data/.esphome-cgs1\nstat -c '%d %i %a %u' /data/.esphome-cgs1\ntest ! -L /data/.esphome-cgs1/install.intent\ntest -f /data/.esphome-cgs1/install.intent\n[ \"$(stat -c '%s %a %u %h' /data/.esphome-cgs1/install.intent)\" = '98 600 0 1' ]\ncat /data/.esphome-cgs1/install.intent"
        ]
      },
      {
        "key": "parents",
        "parts": [
          "test ! -L /data/bin\ntest ! -L /data/etc\ntest ! -L /data/etc/init.d\nstat -c '%d' /data/bin /data/etc/init.d"
        ]
      },
      {
        "key": "disabled",
        "parts": [
          "test ! -L /data/.esphome-cgs1/disabled\ntest -f /data/.esphome-cgs1/disabled\nstat -c '%s %a %u %h' /data/.esphome-cgs1/disabled\nsha256sum /data/.esphome-cgs1/disabled"
        ]
      },
      {
        "key": "pm-helper.disabled",
        "parts": [
          "test ! -L /data/.esphome-cgs1/pm-helper.disabled\ntest -f /data/.esphome-cgs1/pm-helper.disabled\nstat -c '%s %a %u %h' /data/.esphome-cgs1/pm-helper.disabled\nsha256sum /data/.esphome-cgs1/pm-helper.disabled"
        ]
      },
      {
        "key": "absent_stores",
        "parts": [
          "# CGS1_INITIAL_ABSENT_STORES\nentries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)\nprintf '%s\\n' \"$entries\" | while IFS= read -r entry; do\n    case \"$entry\" in (full-releases|wifi|prefs|full-state) exit 1;; esac\ndone\nentries=$(LC_ALL=C ls -A1 /tmp)\nprintf '%s\\n' \"$entries\" | while IFS= read -r entry; do\n    case \"$entry\" in (qingping-cgs1-esphome.lock) exit 1;; esac\ndone"
        ]
      },
      {
        "key": "memory",
        "parts": [
          "# CGS1_INITIAL_MEMORY\nawk '$1 == \"MemTotal:\" || $1 == \"MemFree:\" { print }' /proc/meminfo"
        ]
      },
      {
        "key": "intent_file",
        "parts": [
          "test ! -L /data/.esphome-cgs1/initial-trial.intent\ntest -f /data/.esphome-cgs1/initial-trial.intent\nstat -c '%s %h' /data/.esphome-cgs1/initial-trial.intent\nsha256sum /data/.esphome-cgs1/initial-trial.intent"
        ]
      },
      {
        "key": "intent_mode",
        "parts": [
          "observed_value=$(stat -c '%a %u' /data/.esphome-cgs1/initial-trial.intent)\n[ \"$observed_value\" = '600 0' ]\n"
        ]
      },
      {
        "key": "nand_entries",
        "parts": [
          "LC_ALL=C ls -A1 /data/.esphome-cgs1"
        ]
      },
      {
        "key": "commit_marker",
        "parts": [
          "# CGS1_INITIAL_COMMIT_MARKER\ntest ! -L /data/.esphome-cgs1/.commit-disabled.lock\ntest -d /data/.esphome-cgs1/.commit-disabled.lock\nobserved_value=$(stat -c '%a %u' /data/.esphome-cgs1/.commit-disabled.lock)\n[ \"$observed_value\" = '700 0' ]\ntest ! -L /data/.esphome-cgs1/.commit-disabled.lock/owner\ntest -f /data/.esphome-cgs1/.commit-disabled.lock/owner\nobserved_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/.commit-disabled.lock/owner)\n[ \"$observed_value\" = '82 600 0 1' ]\ncat /data/.esphome-cgs1/.commit-disabled.lock/owner"
        ]
      },
      {
        "key": "ram_identity",
        "parts": [
          "test ! -L /tmp\ntest ! -L /tmp/qingping-initial-trial-",
          {
            "field": "ram_job_id"
          },
          "\ntest -d /tmp/qingping-initial-trial-",
          {
            "field": "ram_job_id"
          },
          "\nstat -c '%d %i %a %u' /tmp/qingping-initial-trial-",
          {
            "field": "ram_job_id"
          },
          "\nstat -f -c '%t' /tmp/qingping-initial-trial-",
          {
            "field": "ram_job_id"
          }
        ]
      },
      {
        "key": "ram_entries",
        "parts": [
          "LC_ALL=C ls -A1 /tmp/qingping-initial-trial-",
          {
            "field": "ram_job_id"
          }
        ]
      },
      {
        "key": "prefs_guard",
        "parts": [
          "test ! -L /tmp/qingping-initial-trial-",
          {
            "field": "ram_job_id"
          },
          "/prefs\ntest -d /tmp/qingping-initial-trial-",
          {
            "field": "ram_job_id"
          },
          "/prefs\nobserved_value=$(stat -c '%a %u %d' /tmp/qingping-initial-trial-",
          {
            "field": "ram_job_id"
          },
          "/prefs)\n[ \"$observed_value\" = '700 0 ",
          {
            "field": "ram_device"
          },
          "' ]\n"
        ]
      },
      {
        "key": "prefs_entries",
        "parts": [
          "LC_ALL=C ls -A1 /tmp/qingping-initial-trial-",
          {
            "field": "ram_job_id"
          },
          "/prefs"
        ]
      },
      {
        "key": "prefs_file",
        "parts": [
          "test ! -L /tmp/qingping-initial-trial-",
          {
            "field": "ram_job_id"
          },
          "/prefs/",
          {
            "field": "node_name"
          },
          ".prefs\ntest -f /tmp/qingping-initial-trial-",
          {
            "field": "ram_job_id"
          },
          "/prefs/",
          {
            "field": "node_name"
          },
          ".prefs\nstat -c '%s %a %u %h %d' /tmp/qingping-initial-trial-",
          {
            "field": "ram_job_id"
          },
          "/prefs/",
          {
            "field": "node_name"
          },
          ".prefs"
        ]
      },
      {
        "key": "identity_uid",
        "parts": [
          "id -u"
        ]
      },
      {
        "key": "identity_wlan",
        "parts": [
          "cat /sys/class/net/wlan0/address"
        ]
      },
      {
        "key": "identity_version",
        "parts": [
          "cat /data/etc/os-release"
        ]
      },
      {
        "key": "identity_architecture",
        "parts": [
          "uname -m"
        ]
      },
      {
        "key": "identity_co2",
        "parts": [
          "awk '\nBEGIN { section=0; count=0 }\n/^[ \\t]*\\[/ { section=($0 ~ /^[ \\t]*\\[sensors\\][ \\t]*\\r?$/) }\nsection && /^[ \\t]*co2_type[ \\t]*=/ {\n    value=$0; sub(/^[^=]*=[ \\t]*/, \"\", value); sub(/[ \\t\\r]*$/, \"\", value)\n    print value; count++\n}\nEND { if (count != 1) exit 1 }\n' /data/etc/setting.ini"
        ]
      },
      {
        "key": "identity_boot",
        "parts": [
          "cat /proc/sys/kernel/random/boot_id"
        ]
      },
      {
        "key": "child_after",
        "parts": [
          "count=0\nfor file in /proc/[0-9]*/stat; do\n count=$((count+1)); [ \"$count\" -le 4096 ] || exit 1\n task=${file%/stat}; child=${task#/proc/}\n row=$(sed 's/.*) //' \"$file\" 2>/dev/null | awk '{print $1, $2, $20}')\n set -- $row\n if [ \"$#\" -ne 3 ]; then [ ! -d \"$task\" ] && continue; exit 1; fi\n case \"$2:$3\" in (*[!0-9:]*|:*|*:) exit 1;; esac\n if [ \"$2\" = '",
          {
            "field": "guardian_pid"
          },
          "' ]; then printf '%s %s %s\\n' \"$child\" \"$3\" \"$1\"; fi\ndone"
        ]
      }
    ]
  }
};
