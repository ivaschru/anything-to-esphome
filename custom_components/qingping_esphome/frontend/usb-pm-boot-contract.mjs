// Generated canonical PM text; no live writer, receipt or transport authority.
export const pmBootContract = {
  "schema_version": 1,
  "maximum_body_bytes": 65536,
  "source_commit": "53d97b9609e8e0fcdfc5d003101f620098dbc734",
  "native_source_sha256": {
    "arm_bridge_next_boot_adb.py": "ab3dee1e5761f160e4c0905e1253d0fe29b06064a8b8b65a91177b33ecc934a1",
    "bootstrap_patches.py": "12bc6fb3fadfe6c0101130914c3dafe7db243669b8a000e83806ff0afd66f959",
    "commit_disabled_install.py": "b78470c8fe3f6275d2eca07067ec56beb858f11d8037b435be08f9f6781b4408",
    "disabled_commit_policy.py": "ad8b50cd9c112f37b40bb1f3a77ba2ca598bf307deb1817ea1fdda4c492f2ab7",
    "preflight_adb.py": "128cf367baeee28bcfb4156256548fdded689a42d50662e77580fdd71ab19b47",
    "review_disabled_install.py": "174d4e23e1aaf4c386ab7afcf280a7b99b169ca877130ad1f556295a28850d1a",
    "review_initial_trial.py": "d9f2f022edbbe190d8c8b0ccbb87071f9c6dfcb53320f8e53232264ac71cc0b4",
    "stage_install_adb.py": "7546caa212b3b44b1a3d8717e550b7bfd5f0893a342c80c6e847cfd2be56b8eb",
    "trial_initial_bridge_adb.py": "4f29bb503dd2d792a42aa2a642505edd2ccf84a3eb35ae7a8964b39006aaf032",
    "verify_bridge_boot_adb.py": "2c7029ed1781289f406051138f538461c441fab498becd39d3b3ea468cdb6114"
  },
  "guard_sha256": "61dd3056c0325cecf6202501a0fc63a8c5222f29089681cb8cd9f42ba5939b79",
  "templates": {
    "arm": [
      "umask 077\ntest ! -L /data\ntest ! -L /data/.esphome-cgs1\ntest -d /data/.esphome-cgs1\nobserved_value=$(stat -c '%d %i %a %u' /data/.esphome-cgs1)\n[ \"$observed_value\" = '",
      {
        "field": "root_device"
      },
      " ",
      {
        "field": "root_inode"
      },
      " 700 0' ]\nobserved_value=$(stat -f -c '%t' /data/.esphome-cgs1)\n[ \"$observed_value\" = ef53 ]\ntest ! -L /data/.esphome-cgs1/install.intent\ntest -f /data/.esphome-cgs1/install.intent\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/install.intent)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/install.intent | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "install_marker_sha256"
      },
      " ]\nobserved_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/install.intent)\n[ \"$observed_value\" = '98 600 0 1' ]\n# CGS1_BRIDGE_COMPLETION arm\ntest ! -L /data/.esphome-cgs1/bridge-next-boot.complete\ntest -f /data/.esphome-cgs1/bridge-next-boot.complete\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/bridge-next-boot.complete)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/bridge-next-boot.complete | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "arm_completion_sha256"
      },
      " ]\nobserved_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/bridge-next-boot.complete)\n[ \"$observed_value\" = '135 600 0 1' ]\nobserved_value=$(cat /data/.esphome-cgs1/bridge-next-boot.complete)\n[ \"$observed_value\" = 'arm ",
      {
        "field": "nonce"
      },
      " ",
      {
        "field": "plan_id"
      },
      " ",
      {
        "field": "plan_sha256"
      },
      "' ]\nentries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)\nprintf '%s\\n' \"$entries\" | while IFS= read -r entry; do\n case \"$entry\" in (disabled) exit 1;; esac\ndone\nobserved_value=$(cat /sys/class/net/wlan0/address)\n[ \"$observed_value\" = ",
      {
        "field": "wlan_mac"
      },
      " ]\nobserved_value=$(cat /data/etc/os-release)\n[ \"$observed_value\" = CLEARGRASS_VERSION=4.1.8_0287 ]\nobserved_value=$(cat /proc/sys/kernel/random/boot_id)\n[ \"$observed_value\" = ",
      {
        "field": "boot_id"
      },
      " ]\nobserved_value=$(awk '\nBEGIN { section=0; count=0 }\n/^[ \\t]*\\[/ { section=($0 ~ /^[ \\t]*\\[sensors\\][ \\t]*\\r?$/) }\nsection && /^[ \\t]*co2_type[ \\t]*=/ {\n    value=$0; sub(/^[^=]*=[ \\t]*/, \"\", value); sub(/[ \\t\\r]*$/, \"\", value)\n    print value; count++\n}\nEND { if (count != 1) exit 1 }\n' /data/etc/setting.ini)\n",
      "[ \"$observed_value\" = ",
      {
        "field": "co2_type"
      },
      " ]",
      "\ntest ! -L /data/.esphome-cgs1/program\ntest -f /data/.esphome-cgs1/program\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/program)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/program | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "staged_sha_0"
      },
      " ]\ntest ! -L /data/.esphome-cgs1/pm_qt_bridge.so\ntest -f /data/.esphome-cgs1/pm_qt_bridge.so\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/pm_qt_bridge.so)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/pm_qt_bridge.so | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "staged_sha_1"
      },
      " ]\ntest ! -L /data/.esphome-cgs1/launch.sh\ntest -f /data/.esphome-cgs1/launch.sh\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/launch.sh)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/launch.sh | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "staged_sha_2"
      },
      " ]\ntest ! -L /data/.esphome-cgs1/SnowApp-with-PM\ntest -f /data/.esphome-cgs1/SnowApp-with-PM\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/SnowApp-with-PM)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/SnowApp-with-PM | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "staged_sha_3"
      },
      " ]\ntest ! -L /data/.esphome-cgs1/startup-hook.sh\ntest -f /data/.esphome-cgs1/startup-hook.sh\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/startup-hook.sh)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/startup-hook.sh | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "staged_sha_4"
      },
      " ]\ntest ! -L /data/.esphome-cgs1/stock-start.sh.original\ntest -f /data/.esphome-cgs1/stock-start.sh.original\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/stock-start.sh.original)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/stock-start.sh.original | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "staged_sha_5"
      },
      " ]\ntest ! -L /data/.esphome-cgs1/stock-watchdog.sh.original\ntest -f /data/.esphome-cgs1/stock-watchdog.sh.original\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/stock-watchdog.sh.original)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/stock-watchdog.sh.original | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "staged_sha_6"
      },
      " ]\ntest ! -L /data/.esphome-cgs1/start.sh.candidate\ntest -f /data/.esphome-cgs1/start.sh.candidate\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/start.sh.candidate)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/start.sh.candidate | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "staged_sha_7"
      },
      " ]\ntest ! -L /data/.esphome-cgs1/watchdog.sh.candidate\ntest -f /data/.esphome-cgs1/watchdog.sh.candidate\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/watchdog.sh.candidate)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/watchdog.sh.candidate | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "staged_sha_8"
      },
      " ]\ntest ! -L /data/bin/SnowApp\ntest -f /data/bin/SnowApp\nobserved_value=$(stat -c '%h %u' /data/bin/SnowApp)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/bin/SnowApp | awk '{print $1}')\n[ \"$observed_value\" = a39016531620a874668ee322f0e976f48e47943742c54c8a7291b9e830c91abb ]\ntest ! -L /data/bin/watchdog.sh\ntest -f /data/bin/watchdog.sh\nobserved_value=$(stat -c '%h %u' /data/bin/watchdog.sh)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/bin/watchdog.sh | awk '{print $1}')\n[ \"$observed_value\" = 1d74ef0946734e1ddf9e76301012f9ed66d7b38d9d7a0239a5d0e80acabf2cce ]\ntest ! -L /data/etc/init.d/start.sh\ntest -f /data/etc/init.d/start.sh\nobserved_value=$(stat -c '%h %u' /data/etc/init.d/start.sh)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/etc/init.d/start.sh | awk '{print $1}')\n[ \"$observed_value\" = f104f873dd3ce4544d5f3e3f90a4056bffc811bcaae037e347306e1084e7f1d1 ]\ntest ! -L /etc/init.d/S12_launcher_init\ntest -f /etc/init.d/S12_launcher_init\nobserved_value=$(stat -c '%h %u' /etc/init.d/S12_launcher_init)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /etc/init.d/S12_launcher_init | awk '{print $1}')\n[ \"$observed_value\" = 533cac6f65b3ccf8d3404216c688877ad03a8b03af64edaade9bd6dc3aad1c35 ]\ntest ! -L /etc/init.d/S50_px3se_init\ntest -f /etc/init.d/S50_px3se_init\nobserved_value=$(stat -c '%h %u' /etc/init.d/S50_px3se_init)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /etc/init.d/S50_px3se_init | awk '{print $1}')\n[ \"$observed_value\" = d818606f68bc1428ef96c5257df751a843cc9a6770dc25a2487a940c6bcb2492 ]\ntest ! -L /lib/ld-2.23.so\ntest -f /lib/ld-2.23.so\nobserved_value=$(stat -c '%h %u' /lib/ld-2.23.so)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /lib/ld-2.23.so | awk '{print $1}')\n[ \"$observed_value\" = 6da48efda9ff440998747a66131e8ebdc6a57a15bb19dcfd7895a031368dd50a ]\ntest ! -L /lib/libc-2.23.so\ntest -f /lib/libc-2.23.so\nobserved_value=$(stat -c '%h %u' /lib/libc-2.23.so)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /lib/libc-2.23.so | awk '{print $1}')\n[ \"$observed_value\" = 6479e377cd35c6e90e9aba990ac5137b195ca765544ad0c561f7f5945ea7133e ]\ntest ! -L /usr/lib/libQt5Core.so.5.9.4\ntest -f /usr/lib/libQt5Core.so.5.9.4\nobserved_value=$(stat -c '%h %u' /usr/lib/libQt5Core.so.5.9.4)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /usr/lib/libQt5Core.so.5.9.4 | awk '{print $1}')\n[ \"$observed_value\" = b43e1cc628e625a422cfcf98aad38c9542b98cea28196ac4fd14931fd5ccf88d ]\ntest ! -L /usr/lib/libstdc++.so.6.0.20\ntest -f /usr/lib/libstdc++.so.6.0.20\nobserved_value=$(stat -c '%h %u' /usr/lib/libstdc++.so.6.0.20)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /usr/lib/libstdc++.so.6.0.20 | awk '{print $1}')\n[ \"$observed_value\" = 93cc1352b59a0d3a39a8f9d311332f84115e3c5ee71afd846302b942071675c4 ]\nobserved_value=$(# CGS1_BOOT_LOCK\ntest ! -L /tmp\nobserved_value=$(stat -c '%a %u' /tmp)\n[ \"$observed_value\" = '1777 0' ]\ntest ! -L /tmp/qingping-cgs1-esphome.lock\ntest -d /tmp/qingping-cgs1-esphome.lock\nobserved_value=$(stat -c '%a %u' /tmp/qingping-cgs1-esphome.lock)\n[ \"$observed_value\" = '700 0' ]\nobserved_value=$(stat -f -c '%t' /tmp/qingping-cgs1-esphome.lock)\n[ \"$observed_value\" = 1021994 ]\nentries=$(LC_ALL=C ls -A1 /tmp/qingping-cgs1-esphome.lock)\n[ \"$entries\" = \"$(printf 'child.pid\\nsupervisor.pid')\" ]\ntest ! -L /tmp/qingping-cgs1-esphome.lock/supervisor.pid\ntest -f /tmp/qingping-cgs1-esphome.lock/supervisor.pid\nobserved_value=$(stat -c '%a %u %h' /tmp/qingping-cgs1-esphome.lock/supervisor.pid)\n[ \"$observed_value\" = '600 0 1' ]\nvalue=$(cat /tmp/qingping-cgs1-esphome.lock/supervisor.pid)\ncase \"$value\" in (''|*[!0-9]*) exit 1;; esac\n[ \"${#value}\" -le 10 ]\nprintf '%s\\n' \"$value\"\ntest ! -L /tmp/qingping-cgs1-esphome.lock/child.pid\ntest -f /tmp/qingping-cgs1-esphome.lock/child.pid\nobserved_value=$(stat -c '%a %u %h' /tmp/qingping-cgs1-esphome.lock/child.pid)\n[ \"$observed_value\" = '600 0 1' ]\nvalue=$(cat /tmp/qingping-cgs1-esphome.lock/child.pid)\ncase \"$value\" in (''|*[!0-9]*) exit 1;; esac\n[ \"${#value}\" -le 10 ]\nprintf '%s\\n' \"$value\"\n)\n[ \"$observed_value\" = '",
      {
        "field": "supervisor_pid"
      },
      "\n",
      {
        "field": "child_pid"
      },
      "' ]\nentries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)\nprintf '%s\\n' \"$entries\" | while IFS= read -r entry; do\n case \"$entry\" in (full-releases|wifi|full-state) exit 1;; esac\ndone\nobserved_value=$(cat /tmp/qingping-cgs1-esphome.lock/supervisor.pid)\n[ \"$observed_value\" = ",
      {
        "field": "supervisor_pid"
      },
      " ]\nobserved_value=$(cat /tmp/qingping-cgs1-esphome.lock/child.pid)\n[ \"$observed_value\" = ",
      {
        "field": "child_pid"
      },
      " ]\nobserved_value=$(count=0\nfor link in /proc/[0-9]*/exe; do\n    count=$((count+1))\n    [ \"$count\" -le 4096 ] || exit 1\n    pid=${link#/proc/}; pid=${pid%/exe}\n    case \"$pid\" in (''|*[!0-9]*) exit 1;; esac\n    if executable=$(readlink \"$link\" 2>/dev/null); then\n        :\n    else\n        # Kernel threads and exited tasks legitimately have no executable.\n        # An unreadable live userspace exe is NOT evidence of its absence.\n        [ -d \"/proc/$pid\" ] || continue\n        metadata=$(sed 's/.*) //' \"/proc/$pid/stat\" 2>/dev/null | awk '{print $1, $7}')\n        set -- $metadata\n        if [ \"$#\" -ne 2 ]; then\n            [ ! -d \"/proc/$pid\" ] && continue\n            exit 1\n        fi\n        case \"$2\" in (''|*[!0-9]*) exit 1;; esac\n        case \"$1\" in (Z|X|x) continue;; esac\n        [ \"$(($2 & 2097152))\" -ne 0 ] || exit 1\n        continue\n    fi\n    case \"$executable\" in\n        (/data/.esphome-cgs1/*|/tmp/qingping-full-*/*|/tmp/qingping-initial-*/*)\ncase \"$pid:$executable\" in\n(",
      {
        "field": "child_pid"
      },
      ":/data/.esphome-cgs1/program) :;;\n(*) exit 1;;\nesac;;\n        (/data/bin/SnowApp) printf '%s\\n' \"$pid\";;\n    esac\ndone)\n[ \"$observed_value\" = ",
      {
        "field": "stock_pid"
      },
      " ]\nobserved_value=$(readlink /proc/",
      {
        "field": "child_pid"
      },
      "/exe)\n[ \"$observed_value\" = /data/.esphome-cgs1/program ]\nobserved_value=$(stat -c '%u' /proc/",
      {
        "field": "child_pid"
      },
      ")\n[ \"$observed_value\" = 0 ]\nobserved_value=$(sed 's/.*) //' /proc/",
      {
        "field": "child_pid"
      },
      "/stat | awk '{print $20}')\n[ \"$observed_value\" = ",
      {
        "field": "child_birth"
      },
      " ]\nprocess_state=$(sed 's/.*) //' /proc/",
      {
        "field": "child_pid"
      },
      "/stat | awk '{print $1}')\ncase \"$process_state\" in R|S|D|I) :;; *) exit 1;; esac\nobserved_value=$(readlink /proc/",
      {
        "field": "supervisor_pid"
      },
      "/exe)\n[ \"$observed_value\" = /bin/busybox ]\nobserved_value=$(stat -c '%u' /proc/",
      {
        "field": "supervisor_pid"
      },
      ")\n[ \"$observed_value\" = 0 ]\nobserved_value=$(sed 's/.*) //' /proc/",
      {
        "field": "supervisor_pid"
      },
      "/stat | awk '{print $20}')\n[ \"$observed_value\" = ",
      {
        "field": "supervisor_birth"
      },
      " ]\nprocess_state=$(sed 's/.*) //' /proc/",
      {
        "field": "supervisor_pid"
      },
      "/stat | awk '{print $1}')\ncase \"$process_state\" in R|S|D|I) :;; *) exit 1;; esac\nobserved_value=$(readlink /proc/",
      {
        "field": "stock_pid"
      },
      "/exe)\n[ \"$observed_value\" = /data/bin/SnowApp ]\nobserved_value=$(stat -c '%u' /proc/",
      {
        "field": "stock_pid"
      },
      ")\n[ \"$observed_value\" = 0 ]\nobserved_value=$(sed 's/.*) //' /proc/",
      {
        "field": "stock_pid"
      },
      "/stat | awk '{print $20}')\n[ \"$observed_value\" = ",
      {
        "field": "stock_birth"
      },
      " ]\nprocess_state=$(sed 's/.*) //' /proc/",
      {
        "field": "stock_pid"
      },
      "/stat | awk '{print $1}')\ncase \"$process_state\" in R|S|D|I) :;; *) exit 1;; esac\nobserved_value=$(readlink /proc/",
      {
        "field": "watchdog_pid"
      },
      "/exe)\n[ \"$observed_value\" = /bin/busybox ]\nobserved_value=$(stat -c '%u' /proc/",
      {
        "field": "watchdog_pid"
      },
      ")\n[ \"$observed_value\" = 0 ]\nobserved_value=$(sed 's/.*) //' /proc/",
      {
        "field": "watchdog_pid"
      },
      "/stat | awk '{print $20}')\n[ \"$observed_value\" = ",
      {
        "field": "watchdog_birth"
      },
      " ]\nprocess_state=$(sed 's/.*) //' /proc/",
      {
        "field": "watchdog_pid"
      },
      "/stat | awk '{print $1}')\ncase \"$process_state\" in R|S|D|I) :;; *) exit 1;; esac\nobserved_value=$(sed 's/.*) //' /proc/",
      {
        "field": "stock_pid"
      },
      "/stat | awk '{print $2}')\n[ \"$observed_value\" = ",
      {
        "field": "watchdog_pid"
      },
      " ]\nobserved_value=$(sed 's/.*) //' /proc/",
      {
        "field": "child_pid"
      },
      "/stat | awk '{print $2}')\n[ \"$observed_value\" = ",
      {
        "field": "supervisor_pid"
      },
      " ]\narguments=$(tr '\\000' '\\n' < /proc/",
      {
        "field": "supervisor_pid"
      },
      "/cmdline)\n[ \"$arguments\" = \"$(printf '/bin/sh\\n/data/.esphome-cgs1/launch.sh\\nsupervise')\" ]\narguments=$(tr '\\000' '\\n' < /proc/",
      {
        "field": "watchdog_pid"
      },
      "/cmdline)\n[ \"$arguments\" = \"$(printf '/bin/sh\\n/data/bin/watchdog.sh')\" ]\ntest -r /proc/",
      {
        "field": "stock_pid"
      },
      "/maps\nif grep -F -q /data/.esphome-cgs1/ /proc/",
      {
        "field": "stock_pid"
      },
      "/maps; then exit 1; else result=$?; [ \"$result\" -eq 1 ]; fi\ntest -r /proc/",
      {
        "field": "stock_pid"
      },
      "/maps\nif grep -F -q /tmp/qingping-full- /proc/",
      {
        "field": "stock_pid"
      },
      "/maps; then exit 1; else result=$?; [ \"$result\" -eq 1 ]; fi\ntest -r /proc/",
      {
        "field": "stock_pid"
      },
      "/maps\nif grep -F -q /tmp/qingping-initial- /proc/",
      {
        "field": "stock_pid"
      },
      "/maps; then exit 1; else result=$?; [ \"$result\" -eq 1 ]; fi\ntest ! -L /tmp\ntest -d /tmp\nobserved_value=$(stat -c '%a %u' /tmp)\n[ \"$observed_value\" = '1777 0' ]\nobserved_value=$(stat -f -c '%t' /tmp)\n[ \"$observed_value\" = 1021994 ]\nentries=$(LC_ALL=C ls -A1 /tmp)\nprintf '%s\\n' \"$entries\" | while IFS= read -r entry; do\n case \"$entry\" in (qingping-pm-helper.attempted) exit 1;; esac\ndone\ntest ! -L /data/.esphome-cgs1/pm-helper.disabled\ntest -f /data/.esphome-cgs1/pm-helper.disabled\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/pm-helper.disabled)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/pm-helper.disabled | awk '{print $1}')\n[ \"$observed_value\" = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 ]\nobserved_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/pm-helper.disabled)\n[ \"$observed_value\" = '0 600 0 1' ]\nentries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)\nprintf '%s\\n' \"$entries\" | while IFS= read -r entry; do\n case \"$entry\" in (pm-helper.disabled.before-initial-enable) exit 1;; esac\ndone\nentries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)\nprintf '%s\\n' \"$entries\" | while IFS= read -r entry; do\n case \"$entry\" in (.initial-pm-enable.lock) exit 1;; esac\ndone\nentries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)\nprintf '%s\\n' \"$entries\" | while IFS= read -r entry; do\n case \"$entry\" in (initial-pm-enable.complete) exit 1;; esac\ndone\nmkdir /data/.esphome-cgs1/.initial-pm-enable.lock\nset -C\nprintf '%s\\n' 'initial-pm-enable ",
      {
        "field": "pm_nonce"
      },
      " ",
      {
        "field": "plan_id"
      },
      " ",
      {
        "field": "plan_sha256"
      },
      " ",
      {
        "field": "boot_id"
      },
      "' > /data/.esphome-cgs1/.initial-pm-enable.lock/owner\nsync\ntest ! -L /data\ntest ! -L /data/.esphome-cgs1\ntest -d /data/.esphome-cgs1\nobserved_value=$(stat -c '%d %i %a %u' /data/.esphome-cgs1)\n[ \"$observed_value\" = '",
      {
        "field": "root_device"
      },
      " ",
      {
        "field": "root_inode"
      },
      " 700 0' ]\nobserved_value=$(stat -f -c '%t' /data/.esphome-cgs1)\n[ \"$observed_value\" = ef53 ]\ntest ! -L /data/.esphome-cgs1/install.intent\ntest -f /data/.esphome-cgs1/install.intent\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/install.intent)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/install.intent | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "install_marker_sha256"
      },
      " ]\nobserved_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/install.intent)\n[ \"$observed_value\" = '98 600 0 1' ]\n# CGS1_BRIDGE_COMPLETION arm\ntest ! -L /data/.esphome-cgs1/bridge-next-boot.complete\ntest -f /data/.esphome-cgs1/bridge-next-boot.complete\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/bridge-next-boot.complete)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/bridge-next-boot.complete | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "arm_completion_sha256"
      },
      " ]\nobserved_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/bridge-next-boot.complete)\n[ \"$observed_value\" = '135 600 0 1' ]\nobserved_value=$(cat /data/.esphome-cgs1/bridge-next-boot.complete)\n[ \"$observed_value\" = 'arm ",
      {
        "field": "nonce"
      },
      " ",
      {
        "field": "plan_id"
      },
      " ",
      {
        "field": "plan_sha256"
      },
      "' ]\nentries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)\nprintf '%s\\n' \"$entries\" | while IFS= read -r entry; do\n case \"$entry\" in (disabled) exit 1;; esac\ndone\nobserved_value=$(cat /sys/class/net/wlan0/address)\n[ \"$observed_value\" = ",
      {
        "field": "wlan_mac"
      },
      " ]\nobserved_value=$(cat /data/etc/os-release)\n[ \"$observed_value\" = CLEARGRASS_VERSION=4.1.8_0287 ]\nobserved_value=$(cat /proc/sys/kernel/random/boot_id)\n[ \"$observed_value\" = ",
      {
        "field": "boot_id"
      },
      " ]\nobserved_value=$(awk '\nBEGIN { section=0; count=0 }\n/^[ \\t]*\\[/ { section=($0 ~ /^[ \\t]*\\[sensors\\][ \\t]*\\r?$/) }\nsection && /^[ \\t]*co2_type[ \\t]*=/ {\n    value=$0; sub(/^[^=]*=[ \\t]*/, \"\", value); sub(/[ \\t\\r]*$/, \"\", value)\n    print value; count++\n}\nEND { if (count != 1) exit 1 }\n' /data/etc/setting.ini)\n",
      "[ \"$observed_value\" = ",
      {
        "field": "co2_type"
      },
      " ]",
      "\ntest ! -L /data/.esphome-cgs1/program\ntest -f /data/.esphome-cgs1/program\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/program)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/program | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "staged_sha_0"
      },
      " ]\ntest ! -L /data/.esphome-cgs1/pm_qt_bridge.so\ntest -f /data/.esphome-cgs1/pm_qt_bridge.so\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/pm_qt_bridge.so)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/pm_qt_bridge.so | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "staged_sha_1"
      },
      " ]\ntest ! -L /data/.esphome-cgs1/launch.sh\ntest -f /data/.esphome-cgs1/launch.sh\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/launch.sh)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/launch.sh | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "staged_sha_2"
      },
      " ]\ntest ! -L /data/.esphome-cgs1/SnowApp-with-PM\ntest -f /data/.esphome-cgs1/SnowApp-with-PM\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/SnowApp-with-PM)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/SnowApp-with-PM | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "staged_sha_3"
      },
      " ]\ntest ! -L /data/.esphome-cgs1/startup-hook.sh\ntest -f /data/.esphome-cgs1/startup-hook.sh\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/startup-hook.sh)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/startup-hook.sh | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "staged_sha_4"
      },
      " ]\ntest ! -L /data/.esphome-cgs1/stock-start.sh.original\ntest -f /data/.esphome-cgs1/stock-start.sh.original\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/stock-start.sh.original)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/stock-start.sh.original | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "staged_sha_5"
      },
      " ]\ntest ! -L /data/.esphome-cgs1/stock-watchdog.sh.original\ntest -f /data/.esphome-cgs1/stock-watchdog.sh.original\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/stock-watchdog.sh.original)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/stock-watchdog.sh.original | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "staged_sha_6"
      },
      " ]\ntest ! -L /data/.esphome-cgs1/start.sh.candidate\ntest -f /data/.esphome-cgs1/start.sh.candidate\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/start.sh.candidate)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/start.sh.candidate | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "staged_sha_7"
      },
      " ]\ntest ! -L /data/.esphome-cgs1/watchdog.sh.candidate\ntest -f /data/.esphome-cgs1/watchdog.sh.candidate\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/watchdog.sh.candidate)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/watchdog.sh.candidate | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "staged_sha_8"
      },
      " ]\ntest ! -L /data/bin/SnowApp\ntest -f /data/bin/SnowApp\nobserved_value=$(stat -c '%h %u' /data/bin/SnowApp)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/bin/SnowApp | awk '{print $1}')\n[ \"$observed_value\" = a39016531620a874668ee322f0e976f48e47943742c54c8a7291b9e830c91abb ]\ntest ! -L /data/bin/watchdog.sh\ntest -f /data/bin/watchdog.sh\nobserved_value=$(stat -c '%h %u' /data/bin/watchdog.sh)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/bin/watchdog.sh | awk '{print $1}')\n[ \"$observed_value\" = 1d74ef0946734e1ddf9e76301012f9ed66d7b38d9d7a0239a5d0e80acabf2cce ]\ntest ! -L /data/etc/init.d/start.sh\ntest -f /data/etc/init.d/start.sh\nobserved_value=$(stat -c '%h %u' /data/etc/init.d/start.sh)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/etc/init.d/start.sh | awk '{print $1}')\n[ \"$observed_value\" = f104f873dd3ce4544d5f3e3f90a4056bffc811bcaae037e347306e1084e7f1d1 ]\ntest ! -L /etc/init.d/S12_launcher_init\ntest -f /etc/init.d/S12_launcher_init\nobserved_value=$(stat -c '%h %u' /etc/init.d/S12_launcher_init)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /etc/init.d/S12_launcher_init | awk '{print $1}')\n[ \"$observed_value\" = 533cac6f65b3ccf8d3404216c688877ad03a8b03af64edaade9bd6dc3aad1c35 ]\ntest ! -L /etc/init.d/S50_px3se_init\ntest -f /etc/init.d/S50_px3se_init\nobserved_value=$(stat -c '%h %u' /etc/init.d/S50_px3se_init)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /etc/init.d/S50_px3se_init | awk '{print $1}')\n[ \"$observed_value\" = d818606f68bc1428ef96c5257df751a843cc9a6770dc25a2487a940c6bcb2492 ]\ntest ! -L /lib/ld-2.23.so\ntest -f /lib/ld-2.23.so\nobserved_value=$(stat -c '%h %u' /lib/ld-2.23.so)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /lib/ld-2.23.so | awk '{print $1}')\n[ \"$observed_value\" = 6da48efda9ff440998747a66131e8ebdc6a57a15bb19dcfd7895a031368dd50a ]\ntest ! -L /lib/libc-2.23.so\ntest -f /lib/libc-2.23.so\nobserved_value=$(stat -c '%h %u' /lib/libc-2.23.so)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /lib/libc-2.23.so | awk '{print $1}')\n[ \"$observed_value\" = 6479e377cd35c6e90e9aba990ac5137b195ca765544ad0c561f7f5945ea7133e ]\ntest ! -L /usr/lib/libQt5Core.so.5.9.4\ntest -f /usr/lib/libQt5Core.so.5.9.4\nobserved_value=$(stat -c '%h %u' /usr/lib/libQt5Core.so.5.9.4)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /usr/lib/libQt5Core.so.5.9.4 | awk '{print $1}')\n[ \"$observed_value\" = b43e1cc628e625a422cfcf98aad38c9542b98cea28196ac4fd14931fd5ccf88d ]\ntest ! -L /usr/lib/libstdc++.so.6.0.20\ntest -f /usr/lib/libstdc++.so.6.0.20\nobserved_value=$(stat -c '%h %u' /usr/lib/libstdc++.so.6.0.20)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /usr/lib/libstdc++.so.6.0.20 | awk '{print $1}')\n[ \"$observed_value\" = 93cc1352b59a0d3a39a8f9d311332f84115e3c5ee71afd846302b942071675c4 ]\nobserved_value=$(# CGS1_BOOT_LOCK\ntest ! -L /tmp\nobserved_value=$(stat -c '%a %u' /tmp)\n[ \"$observed_value\" = '1777 0' ]\ntest ! -L /tmp/qingping-cgs1-esphome.lock\ntest -d /tmp/qingping-cgs1-esphome.lock\nobserved_value=$(stat -c '%a %u' /tmp/qingping-cgs1-esphome.lock)\n[ \"$observed_value\" = '700 0' ]\nobserved_value=$(stat -f -c '%t' /tmp/qingping-cgs1-esphome.lock)\n[ \"$observed_value\" = 1021994 ]\nentries=$(LC_ALL=C ls -A1 /tmp/qingping-cgs1-esphome.lock)\n[ \"$entries\" = \"$(printf 'child.pid\\nsupervisor.pid')\" ]\ntest ! -L /tmp/qingping-cgs1-esphome.lock/supervisor.pid\ntest -f /tmp/qingping-cgs1-esphome.lock/supervisor.pid\nobserved_value=$(stat -c '%a %u %h' /tmp/qingping-cgs1-esphome.lock/supervisor.pid)\n[ \"$observed_value\" = '600 0 1' ]\nvalue=$(cat /tmp/qingping-cgs1-esphome.lock/supervisor.pid)\ncase \"$value\" in (''|*[!0-9]*) exit 1;; esac\n[ \"${#value}\" -le 10 ]\nprintf '%s\\n' \"$value\"\ntest ! -L /tmp/qingping-cgs1-esphome.lock/child.pid\ntest -f /tmp/qingping-cgs1-esphome.lock/child.pid\nobserved_value=$(stat -c '%a %u %h' /tmp/qingping-cgs1-esphome.lock/child.pid)\n[ \"$observed_value\" = '600 0 1' ]\nvalue=$(cat /tmp/qingping-cgs1-esphome.lock/child.pid)\ncase \"$value\" in (''|*[!0-9]*) exit 1;; esac\n[ \"${#value}\" -le 10 ]\nprintf '%s\\n' \"$value\"\n)\n[ \"$observed_value\" = '",
      {
        "field": "supervisor_pid"
      },
      "\n",
      {
        "field": "child_pid"
      },
      "' ]\nentries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)\nprintf '%s\\n' \"$entries\" | while IFS= read -r entry; do\n case \"$entry\" in (full-releases|wifi|full-state) exit 1;; esac\ndone\nobserved_value=$(cat /tmp/qingping-cgs1-esphome.lock/supervisor.pid)\n[ \"$observed_value\" = ",
      {
        "field": "supervisor_pid"
      },
      " ]\nobserved_value=$(cat /tmp/qingping-cgs1-esphome.lock/child.pid)\n[ \"$observed_value\" = ",
      {
        "field": "child_pid"
      },
      " ]\nobserved_value=$(count=0\nfor link in /proc/[0-9]*/exe; do\n    count=$((count+1))\n    [ \"$count\" -le 4096 ] || exit 1\n    pid=${link#/proc/}; pid=${pid%/exe}\n    case \"$pid\" in (''|*[!0-9]*) exit 1;; esac\n    if executable=$(readlink \"$link\" 2>/dev/null); then\n        :\n    else\n        # Kernel threads and exited tasks legitimately have no executable.\n        # An unreadable live userspace exe is NOT evidence of its absence.\n        [ -d \"/proc/$pid\" ] || continue\n        metadata=$(sed 's/.*) //' \"/proc/$pid/stat\" 2>/dev/null | awk '{print $1, $7}')\n        set -- $metadata\n        if [ \"$#\" -ne 2 ]; then\n            [ ! -d \"/proc/$pid\" ] && continue\n            exit 1\n        fi\n        case \"$2\" in (''|*[!0-9]*) exit 1;; esac\n        case \"$1\" in (Z|X|x) continue;; esac\n        [ \"$(($2 & 2097152))\" -ne 0 ] || exit 1\n        continue\n    fi\n    case \"$executable\" in\n        (/data/.esphome-cgs1/*|/tmp/qingping-full-*/*|/tmp/qingping-initial-*/*)\ncase \"$pid:$executable\" in\n(",
      {
        "field": "child_pid"
      },
      ":/data/.esphome-cgs1/program) :;;\n(*) exit 1;;\nesac;;\n        (/data/bin/SnowApp) printf '%s\\n' \"$pid\";;\n    esac\ndone)\n[ \"$observed_value\" = ",
      {
        "field": "stock_pid"
      },
      " ]\nobserved_value=$(readlink /proc/",
      {
        "field": "child_pid"
      },
      "/exe)\n[ \"$observed_value\" = /data/.esphome-cgs1/program ]\nobserved_value=$(stat -c '%u' /proc/",
      {
        "field": "child_pid"
      },
      ")\n[ \"$observed_value\" = 0 ]\nobserved_value=$(sed 's/.*) //' /proc/",
      {
        "field": "child_pid"
      },
      "/stat | awk '{print $20}')\n[ \"$observed_value\" = ",
      {
        "field": "child_birth"
      },
      " ]\nprocess_state=$(sed 's/.*) //' /proc/",
      {
        "field": "child_pid"
      },
      "/stat | awk '{print $1}')\ncase \"$process_state\" in R|S|D|I) :;; *) exit 1;; esac\nobserved_value=$(readlink /proc/",
      {
        "field": "supervisor_pid"
      },
      "/exe)\n[ \"$observed_value\" = /bin/busybox ]\nobserved_value=$(stat -c '%u' /proc/",
      {
        "field": "supervisor_pid"
      },
      ")\n[ \"$observed_value\" = 0 ]\nobserved_value=$(sed 's/.*) //' /proc/",
      {
        "field": "supervisor_pid"
      },
      "/stat | awk '{print $20}')\n[ \"$observed_value\" = ",
      {
        "field": "supervisor_birth"
      },
      " ]\nprocess_state=$(sed 's/.*) //' /proc/",
      {
        "field": "supervisor_pid"
      },
      "/stat | awk '{print $1}')\ncase \"$process_state\" in R|S|D|I) :;; *) exit 1;; esac\nobserved_value=$(readlink /proc/",
      {
        "field": "stock_pid"
      },
      "/exe)\n[ \"$observed_value\" = /data/bin/SnowApp ]\nobserved_value=$(stat -c '%u' /proc/",
      {
        "field": "stock_pid"
      },
      ")\n[ \"$observed_value\" = 0 ]\nobserved_value=$(sed 's/.*) //' /proc/",
      {
        "field": "stock_pid"
      },
      "/stat | awk '{print $20}')\n[ \"$observed_value\" = ",
      {
        "field": "stock_birth"
      },
      " ]\nprocess_state=$(sed 's/.*) //' /proc/",
      {
        "field": "stock_pid"
      },
      "/stat | awk '{print $1}')\ncase \"$process_state\" in R|S|D|I) :;; *) exit 1;; esac\nobserved_value=$(readlink /proc/",
      {
        "field": "watchdog_pid"
      },
      "/exe)\n[ \"$observed_value\" = /bin/busybox ]\nobserved_value=$(stat -c '%u' /proc/",
      {
        "field": "watchdog_pid"
      },
      ")\n[ \"$observed_value\" = 0 ]\nobserved_value=$(sed 's/.*) //' /proc/",
      {
        "field": "watchdog_pid"
      },
      "/stat | awk '{print $20}')\n[ \"$observed_value\" = ",
      {
        "field": "watchdog_birth"
      },
      " ]\nprocess_state=$(sed 's/.*) //' /proc/",
      {
        "field": "watchdog_pid"
      },
      "/stat | awk '{print $1}')\ncase \"$process_state\" in R|S|D|I) :;; *) exit 1;; esac\nobserved_value=$(sed 's/.*) //' /proc/",
      {
        "field": "stock_pid"
      },
      "/stat | awk '{print $2}')\n[ \"$observed_value\" = ",
      {
        "field": "watchdog_pid"
      },
      " ]\nobserved_value=$(sed 's/.*) //' /proc/",
      {
        "field": "child_pid"
      },
      "/stat | awk '{print $2}')\n[ \"$observed_value\" = ",
      {
        "field": "supervisor_pid"
      },
      " ]\narguments=$(tr '\\000' '\\n' < /proc/",
      {
        "field": "supervisor_pid"
      },
      "/cmdline)\n[ \"$arguments\" = \"$(printf '/bin/sh\\n/data/.esphome-cgs1/launch.sh\\nsupervise')\" ]\narguments=$(tr '\\000' '\\n' < /proc/",
      {
        "field": "watchdog_pid"
      },
      "/cmdline)\n[ \"$arguments\" = \"$(printf '/bin/sh\\n/data/bin/watchdog.sh')\" ]\ntest -r /proc/",
      {
        "field": "stock_pid"
      },
      "/maps\nif grep -F -q /data/.esphome-cgs1/ /proc/",
      {
        "field": "stock_pid"
      },
      "/maps; then exit 1; else result=$?; [ \"$result\" -eq 1 ]; fi\ntest -r /proc/",
      {
        "field": "stock_pid"
      },
      "/maps\nif grep -F -q /tmp/qingping-full- /proc/",
      {
        "field": "stock_pid"
      },
      "/maps; then exit 1; else result=$?; [ \"$result\" -eq 1 ]; fi\ntest -r /proc/",
      {
        "field": "stock_pid"
      },
      "/maps\nif grep -F -q /tmp/qingping-initial- /proc/",
      {
        "field": "stock_pid"
      },
      "/maps; then exit 1; else result=$?; [ \"$result\" -eq 1 ]; fi\ntest ! -L /data/.esphome-cgs1/.initial-pm-enable.lock\ntest -d /data/.esphome-cgs1/.initial-pm-enable.lock\nobserved_value=$(stat -c '%a %u' /data/.esphome-cgs1/.initial-pm-enable.lock)\n[ \"$observed_value\" = '700 0' ]\ntest ! -L /data/.esphome-cgs1/.initial-pm-enable.lock/owner\ntest -f /data/.esphome-cgs1/.initial-pm-enable.lock/owner\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/.initial-pm-enable.lock/owner)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/.initial-pm-enable.lock/owner | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "pm_owner_sha256"
      },
      " ]\nobserved_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/.initial-pm-enable.lock/owner)\n[ \"$observed_value\" = '186 600 0 1' ]\ntest ! -L /data/.esphome-cgs1/pm-helper.disabled\ntest -f /data/.esphome-cgs1/pm-helper.disabled\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/pm-helper.disabled)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/pm-helper.disabled | awk '{print $1}')\n[ \"$observed_value\" = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 ]\nobserved_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/pm-helper.disabled)\n[ \"$observed_value\" = '0 600 0 1' ]\nentries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)\nprintf '%s\\n' \"$entries\" | while IFS= read -r entry; do\n case \"$entry\" in (pm-helper.disabled.before-initial-enable) exit 1;; esac\ndone\nentries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)\nprintf '%s\\n' \"$entries\" | while IFS= read -r entry; do\n case \"$entry\" in (initial-pm-enable.complete) exit 1;; esac\ndone\ntest ! -L /tmp\ntest -d /tmp\nobserved_value=$(stat -c '%a %u' /tmp)\n[ \"$observed_value\" = '1777 0' ]\nobserved_value=$(stat -f -c '%t' /tmp)\n[ \"$observed_value\" = 1021994 ]\nentries=$(LC_ALL=C ls -A1 /tmp)\nprintf '%s\\n' \"$entries\" | while IFS= read -r entry; do\n case \"$entry\" in (qingping-pm-helper.attempted) exit 1;; esac\ndone\n: > /tmp/qingping-pm-helper.attempted\nsync\ntest ! -L /data\ntest ! -L /data/.esphome-cgs1\ntest -d /data/.esphome-cgs1\nobserved_value=$(stat -c '%d %i %a %u' /data/.esphome-cgs1)\n[ \"$observed_value\" = '",
      {
        "field": "root_device"
      },
      " ",
      {
        "field": "root_inode"
      },
      " 700 0' ]\nobserved_value=$(stat -f -c '%t' /data/.esphome-cgs1)\n[ \"$observed_value\" = ef53 ]\ntest ! -L /data/.esphome-cgs1/install.intent\ntest -f /data/.esphome-cgs1/install.intent\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/install.intent)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/install.intent | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "install_marker_sha256"
      },
      " ]\nobserved_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/install.intent)\n[ \"$observed_value\" = '98 600 0 1' ]\n# CGS1_BRIDGE_COMPLETION arm\ntest ! -L /data/.esphome-cgs1/bridge-next-boot.complete\ntest -f /data/.esphome-cgs1/bridge-next-boot.complete\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/bridge-next-boot.complete)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/bridge-next-boot.complete | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "arm_completion_sha256"
      },
      " ]\nobserved_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/bridge-next-boot.complete)\n[ \"$observed_value\" = '135 600 0 1' ]\nobserved_value=$(cat /data/.esphome-cgs1/bridge-next-boot.complete)\n[ \"$observed_value\" = 'arm ",
      {
        "field": "nonce"
      },
      " ",
      {
        "field": "plan_id"
      },
      " ",
      {
        "field": "plan_sha256"
      },
      "' ]\nentries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)\nprintf '%s\\n' \"$entries\" | while IFS= read -r entry; do\n case \"$entry\" in (disabled) exit 1;; esac\ndone\nobserved_value=$(cat /sys/class/net/wlan0/address)\n[ \"$observed_value\" = ",
      {
        "field": "wlan_mac"
      },
      " ]\nobserved_value=$(cat /data/etc/os-release)\n[ \"$observed_value\" = CLEARGRASS_VERSION=4.1.8_0287 ]\nobserved_value=$(cat /proc/sys/kernel/random/boot_id)\n[ \"$observed_value\" = ",
      {
        "field": "boot_id"
      },
      " ]\nobserved_value=$(awk '\nBEGIN { section=0; count=0 }\n/^[ \\t]*\\[/ { section=($0 ~ /^[ \\t]*\\[sensors\\][ \\t]*\\r?$/) }\nsection && /^[ \\t]*co2_type[ \\t]*=/ {\n    value=$0; sub(/^[^=]*=[ \\t]*/, \"\", value); sub(/[ \\t\\r]*$/, \"\", value)\n    print value; count++\n}\nEND { if (count != 1) exit 1 }\n' /data/etc/setting.ini)\n",
      "[ \"$observed_value\" = ",
      {
        "field": "co2_type"
      },
      " ]",
      "\ntest ! -L /data/.esphome-cgs1/program\ntest -f /data/.esphome-cgs1/program\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/program)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/program | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "staged_sha_0"
      },
      " ]\ntest ! -L /data/.esphome-cgs1/pm_qt_bridge.so\ntest -f /data/.esphome-cgs1/pm_qt_bridge.so\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/pm_qt_bridge.so)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/pm_qt_bridge.so | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "staged_sha_1"
      },
      " ]\ntest ! -L /data/.esphome-cgs1/launch.sh\ntest -f /data/.esphome-cgs1/launch.sh\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/launch.sh)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/launch.sh | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "staged_sha_2"
      },
      " ]\ntest ! -L /data/.esphome-cgs1/SnowApp-with-PM\ntest -f /data/.esphome-cgs1/SnowApp-with-PM\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/SnowApp-with-PM)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/SnowApp-with-PM | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "staged_sha_3"
      },
      " ]\ntest ! -L /data/.esphome-cgs1/startup-hook.sh\ntest -f /data/.esphome-cgs1/startup-hook.sh\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/startup-hook.sh)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/startup-hook.sh | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "staged_sha_4"
      },
      " ]\ntest ! -L /data/.esphome-cgs1/stock-start.sh.original\ntest -f /data/.esphome-cgs1/stock-start.sh.original\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/stock-start.sh.original)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/stock-start.sh.original | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "staged_sha_5"
      },
      " ]\ntest ! -L /data/.esphome-cgs1/stock-watchdog.sh.original\ntest -f /data/.esphome-cgs1/stock-watchdog.sh.original\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/stock-watchdog.sh.original)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/stock-watchdog.sh.original | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "staged_sha_6"
      },
      " ]\ntest ! -L /data/.esphome-cgs1/start.sh.candidate\ntest -f /data/.esphome-cgs1/start.sh.candidate\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/start.sh.candidate)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/start.sh.candidate | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "staged_sha_7"
      },
      " ]\ntest ! -L /data/.esphome-cgs1/watchdog.sh.candidate\ntest -f /data/.esphome-cgs1/watchdog.sh.candidate\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/watchdog.sh.candidate)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/watchdog.sh.candidate | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "staged_sha_8"
      },
      " ]\ntest ! -L /data/bin/SnowApp\ntest -f /data/bin/SnowApp\nobserved_value=$(stat -c '%h %u' /data/bin/SnowApp)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/bin/SnowApp | awk '{print $1}')\n[ \"$observed_value\" = a39016531620a874668ee322f0e976f48e47943742c54c8a7291b9e830c91abb ]\ntest ! -L /data/bin/watchdog.sh\ntest -f /data/bin/watchdog.sh\nobserved_value=$(stat -c '%h %u' /data/bin/watchdog.sh)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/bin/watchdog.sh | awk '{print $1}')\n[ \"$observed_value\" = 1d74ef0946734e1ddf9e76301012f9ed66d7b38d9d7a0239a5d0e80acabf2cce ]\ntest ! -L /data/etc/init.d/start.sh\ntest -f /data/etc/init.d/start.sh\nobserved_value=$(stat -c '%h %u' /data/etc/init.d/start.sh)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/etc/init.d/start.sh | awk '{print $1}')\n[ \"$observed_value\" = f104f873dd3ce4544d5f3e3f90a4056bffc811bcaae037e347306e1084e7f1d1 ]\ntest ! -L /etc/init.d/S12_launcher_init\ntest -f /etc/init.d/S12_launcher_init\nobserved_value=$(stat -c '%h %u' /etc/init.d/S12_launcher_init)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /etc/init.d/S12_launcher_init | awk '{print $1}')\n[ \"$observed_value\" = 533cac6f65b3ccf8d3404216c688877ad03a8b03af64edaade9bd6dc3aad1c35 ]\ntest ! -L /etc/init.d/S50_px3se_init\ntest -f /etc/init.d/S50_px3se_init\nobserved_value=$(stat -c '%h %u' /etc/init.d/S50_px3se_init)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /etc/init.d/S50_px3se_init | awk '{print $1}')\n[ \"$observed_value\" = d818606f68bc1428ef96c5257df751a843cc9a6770dc25a2487a940c6bcb2492 ]\ntest ! -L /lib/ld-2.23.so\ntest -f /lib/ld-2.23.so\nobserved_value=$(stat -c '%h %u' /lib/ld-2.23.so)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /lib/ld-2.23.so | awk '{print $1}')\n[ \"$observed_value\" = 6da48efda9ff440998747a66131e8ebdc6a57a15bb19dcfd7895a031368dd50a ]\ntest ! -L /lib/libc-2.23.so\ntest -f /lib/libc-2.23.so\nobserved_value=$(stat -c '%h %u' /lib/libc-2.23.so)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /lib/libc-2.23.so | awk '{print $1}')\n[ \"$observed_value\" = 6479e377cd35c6e90e9aba990ac5137b195ca765544ad0c561f7f5945ea7133e ]\ntest ! -L /usr/lib/libQt5Core.so.5.9.4\ntest -f /usr/lib/libQt5Core.so.5.9.4\nobserved_value=$(stat -c '%h %u' /usr/lib/libQt5Core.so.5.9.4)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /usr/lib/libQt5Core.so.5.9.4 | awk '{print $1}')\n[ \"$observed_value\" = b43e1cc628e625a422cfcf98aad38c9542b98cea28196ac4fd14931fd5ccf88d ]\ntest ! -L /usr/lib/libstdc++.so.6.0.20\ntest -f /usr/lib/libstdc++.so.6.0.20\nobserved_value=$(stat -c '%h %u' /usr/lib/libstdc++.so.6.0.20)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /usr/lib/libstdc++.so.6.0.20 | awk '{print $1}')\n[ \"$observed_value\" = 93cc1352b59a0d3a39a8f9d311332f84115e3c5ee71afd846302b942071675c4 ]\nobserved_value=$(# CGS1_BOOT_LOCK\ntest ! -L /tmp\nobserved_value=$(stat -c '%a %u' /tmp)\n[ \"$observed_value\" = '1777 0' ]\ntest ! -L /tmp/qingping-cgs1-esphome.lock\ntest -d /tmp/qingping-cgs1-esphome.lock\nobserved_value=$(stat -c '%a %u' /tmp/qingping-cgs1-esphome.lock)\n[ \"$observed_value\" = '700 0' ]\nobserved_value=$(stat -f -c '%t' /tmp/qingping-cgs1-esphome.lock)\n[ \"$observed_value\" = 1021994 ]\nentries=$(LC_ALL=C ls -A1 /tmp/qingping-cgs1-esphome.lock)\n[ \"$entries\" = \"$(printf 'child.pid\\nsupervisor.pid')\" ]\ntest ! -L /tmp/qingping-cgs1-esphome.lock/supervisor.pid\ntest -f /tmp/qingping-cgs1-esphome.lock/supervisor.pid\nobserved_value=$(stat -c '%a %u %h' /tmp/qingping-cgs1-esphome.lock/supervisor.pid)\n[ \"$observed_value\" = '600 0 1' ]\nvalue=$(cat /tmp/qingping-cgs1-esphome.lock/supervisor.pid)\ncase \"$value\" in (''|*[!0-9]*) exit 1;; esac\n[ \"${#value}\" -le 10 ]\nprintf '%s\\n' \"$value\"\ntest ! -L /tmp/qingping-cgs1-esphome.lock/child.pid\ntest -f /tmp/qingping-cgs1-esphome.lock/child.pid\nobserved_value=$(stat -c '%a %u %h' /tmp/qingping-cgs1-esphome.lock/child.pid)\n[ \"$observed_value\" = '600 0 1' ]\nvalue=$(cat /tmp/qingping-cgs1-esphome.lock/child.pid)\ncase \"$value\" in (''|*[!0-9]*) exit 1;; esac\n[ \"${#value}\" -le 10 ]\nprintf '%s\\n' \"$value\"\n)\n[ \"$observed_value\" = '",
      {
        "field": "supervisor_pid"
      },
      "\n",
      {
        "field": "child_pid"
      },
      "' ]\nentries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)\nprintf '%s\\n' \"$entries\" | while IFS= read -r entry; do\n case \"$entry\" in (full-releases|wifi|full-state) exit 1;; esac\ndone\nobserved_value=$(cat /tmp/qingping-cgs1-esphome.lock/supervisor.pid)\n[ \"$observed_value\" = ",
      {
        "field": "supervisor_pid"
      },
      " ]\nobserved_value=$(cat /tmp/qingping-cgs1-esphome.lock/child.pid)\n[ \"$observed_value\" = ",
      {
        "field": "child_pid"
      },
      " ]\nobserved_value=$(count=0\nfor link in /proc/[0-9]*/exe; do\n    count=$((count+1))\n    [ \"$count\" -le 4096 ] || exit 1\n    pid=${link#/proc/}; pid=${pid%/exe}\n    case \"$pid\" in (''|*[!0-9]*) exit 1;; esac\n    if executable=$(readlink \"$link\" 2>/dev/null); then\n        :\n    else\n        # Kernel threads and exited tasks legitimately have no executable.\n        # An unreadable live userspace exe is NOT evidence of its absence.\n        [ -d \"/proc/$pid\" ] || continue\n        metadata=$(sed 's/.*) //' \"/proc/$pid/stat\" 2>/dev/null | awk '{print $1, $7}')\n        set -- $metadata\n        if [ \"$#\" -ne 2 ]; then\n            [ ! -d \"/proc/$pid\" ] && continue\n            exit 1\n        fi\n        case \"$2\" in (''|*[!0-9]*) exit 1;; esac\n        case \"$1\" in (Z|X|x) continue;; esac\n        [ \"$(($2 & 2097152))\" -ne 0 ] || exit 1\n        continue\n    fi\n    case \"$executable\" in\n        (/data/.esphome-cgs1/*|/tmp/qingping-full-*/*|/tmp/qingping-initial-*/*)\ncase \"$pid:$executable\" in\n(",
      {
        "field": "child_pid"
      },
      ":/data/.esphome-cgs1/program) :;;\n(*) exit 1;;\nesac;;\n        (/data/bin/SnowApp) printf '%s\\n' \"$pid\";;\n    esac\ndone)\n[ \"$observed_value\" = ",
      {
        "field": "stock_pid"
      },
      " ]\nobserved_value=$(readlink /proc/",
      {
        "field": "child_pid"
      },
      "/exe)\n[ \"$observed_value\" = /data/.esphome-cgs1/program ]\nobserved_value=$(stat -c '%u' /proc/",
      {
        "field": "child_pid"
      },
      ")\n[ \"$observed_value\" = 0 ]\nobserved_value=$(sed 's/.*) //' /proc/",
      {
        "field": "child_pid"
      },
      "/stat | awk '{print $20}')\n[ \"$observed_value\" = ",
      {
        "field": "child_birth"
      },
      " ]\nprocess_state=$(sed 's/.*) //' /proc/",
      {
        "field": "child_pid"
      },
      "/stat | awk '{print $1}')\ncase \"$process_state\" in R|S|D|I) :;; *) exit 1;; esac\nobserved_value=$(readlink /proc/",
      {
        "field": "supervisor_pid"
      },
      "/exe)\n[ \"$observed_value\" = /bin/busybox ]\nobserved_value=$(stat -c '%u' /proc/",
      {
        "field": "supervisor_pid"
      },
      ")\n[ \"$observed_value\" = 0 ]\nobserved_value=$(sed 's/.*) //' /proc/",
      {
        "field": "supervisor_pid"
      },
      "/stat | awk '{print $20}')\n[ \"$observed_value\" = ",
      {
        "field": "supervisor_birth"
      },
      " ]\nprocess_state=$(sed 's/.*) //' /proc/",
      {
        "field": "supervisor_pid"
      },
      "/stat | awk '{print $1}')\ncase \"$process_state\" in R|S|D|I) :;; *) exit 1;; esac\nobserved_value=$(readlink /proc/",
      {
        "field": "stock_pid"
      },
      "/exe)\n[ \"$observed_value\" = /data/bin/SnowApp ]\nobserved_value=$(stat -c '%u' /proc/",
      {
        "field": "stock_pid"
      },
      ")\n[ \"$observed_value\" = 0 ]\nobserved_value=$(sed 's/.*) //' /proc/",
      {
        "field": "stock_pid"
      },
      "/stat | awk '{print $20}')\n[ \"$observed_value\" = ",
      {
        "field": "stock_birth"
      },
      " ]\nprocess_state=$(sed 's/.*) //' /proc/",
      {
        "field": "stock_pid"
      },
      "/stat | awk '{print $1}')\ncase \"$process_state\" in R|S|D|I) :;; *) exit 1;; esac\nobserved_value=$(readlink /proc/",
      {
        "field": "watchdog_pid"
      },
      "/exe)\n[ \"$observed_value\" = /bin/busybox ]\nobserved_value=$(stat -c '%u' /proc/",
      {
        "field": "watchdog_pid"
      },
      ")\n[ \"$observed_value\" = 0 ]\nobserved_value=$(sed 's/.*) //' /proc/",
      {
        "field": "watchdog_pid"
      },
      "/stat | awk '{print $20}')\n[ \"$observed_value\" = ",
      {
        "field": "watchdog_birth"
      },
      " ]\nprocess_state=$(sed 's/.*) //' /proc/",
      {
        "field": "watchdog_pid"
      },
      "/stat | awk '{print $1}')\ncase \"$process_state\" in R|S|D|I) :;; *) exit 1;; esac\nobserved_value=$(sed 's/.*) //' /proc/",
      {
        "field": "stock_pid"
      },
      "/stat | awk '{print $2}')\n[ \"$observed_value\" = ",
      {
        "field": "watchdog_pid"
      },
      " ]\nobserved_value=$(sed 's/.*) //' /proc/",
      {
        "field": "child_pid"
      },
      "/stat | awk '{print $2}')\n[ \"$observed_value\" = ",
      {
        "field": "supervisor_pid"
      },
      " ]\narguments=$(tr '\\000' '\\n' < /proc/",
      {
        "field": "supervisor_pid"
      },
      "/cmdline)\n[ \"$arguments\" = \"$(printf '/bin/sh\\n/data/.esphome-cgs1/launch.sh\\nsupervise')\" ]\narguments=$(tr '\\000' '\\n' < /proc/",
      {
        "field": "watchdog_pid"
      },
      "/cmdline)\n[ \"$arguments\" = \"$(printf '/bin/sh\\n/data/bin/watchdog.sh')\" ]\ntest -r /proc/",
      {
        "field": "stock_pid"
      },
      "/maps\nif grep -F -q /data/.esphome-cgs1/ /proc/",
      {
        "field": "stock_pid"
      },
      "/maps; then exit 1; else result=$?; [ \"$result\" -eq 1 ]; fi\ntest -r /proc/",
      {
        "field": "stock_pid"
      },
      "/maps\nif grep -F -q /tmp/qingping-full- /proc/",
      {
        "field": "stock_pid"
      },
      "/maps; then exit 1; else result=$?; [ \"$result\" -eq 1 ]; fi\ntest -r /proc/",
      {
        "field": "stock_pid"
      },
      "/maps\nif grep -F -q /tmp/qingping-initial- /proc/",
      {
        "field": "stock_pid"
      },
      "/maps; then exit 1; else result=$?; [ \"$result\" -eq 1 ]; fi\ntest ! -L /data/.esphome-cgs1/.initial-pm-enable.lock\ntest -d /data/.esphome-cgs1/.initial-pm-enable.lock\nobserved_value=$(stat -c '%a %u' /data/.esphome-cgs1/.initial-pm-enable.lock)\n[ \"$observed_value\" = '700 0' ]\ntest ! -L /data/.esphome-cgs1/.initial-pm-enable.lock/owner\ntest -f /data/.esphome-cgs1/.initial-pm-enable.lock/owner\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/.initial-pm-enable.lock/owner)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/.initial-pm-enable.lock/owner | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "pm_owner_sha256"
      },
      " ]\nobserved_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/.initial-pm-enable.lock/owner)\n[ \"$observed_value\" = '186 600 0 1' ]\ntest ! -L /tmp\ntest -d /tmp\nobserved_value=$(stat -c '%a %u' /tmp)\n[ \"$observed_value\" = '1777 0' ]\nobserved_value=$(stat -f -c '%t' /tmp)\n[ \"$observed_value\" = 1021994 ]\ntest ! -L /tmp/qingping-pm-helper.attempted\ntest -f /tmp/qingping-pm-helper.attempted\nobserved_value=$(stat -c '%h %u' /tmp/qingping-pm-helper.attempted)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /tmp/qingping-pm-helper.attempted | awk '{print $1}')\n[ \"$observed_value\" = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 ]\nobserved_value=$(stat -c '%s %a %u %h' /tmp/qingping-pm-helper.attempted)\n[ \"$observed_value\" = '0 600 0 1' ]\ntest ! -L /data/.esphome-cgs1/pm-helper.disabled\ntest -f /data/.esphome-cgs1/pm-helper.disabled\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/pm-helper.disabled)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/pm-helper.disabled | awk '{print $1}')\n[ \"$observed_value\" = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 ]\nobserved_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/pm-helper.disabled)\n[ \"$observed_value\" = '0 600 0 1' ]\nentries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)\nprintf '%s\\n' \"$entries\" | while IFS= read -r entry; do\n case \"$entry\" in (pm-helper.disabled.before-initial-enable) exit 1;; esac\ndone\nentries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)\nprintf '%s\\n' \"$entries\" | while IFS= read -r entry; do\n case \"$entry\" in (initial-pm-enable.complete) exit 1;; esac\ndone\n: > /data/.esphome-cgs1/pm-helper.disabled.before-initial-enable\nsync\ntest ! -L /data\ntest ! -L /data/.esphome-cgs1\ntest -d /data/.esphome-cgs1\nobserved_value=$(stat -c '%d %i %a %u' /data/.esphome-cgs1)\n[ \"$observed_value\" = '",
      {
        "field": "root_device"
      },
      " ",
      {
        "field": "root_inode"
      },
      " 700 0' ]\nobserved_value=$(stat -f -c '%t' /data/.esphome-cgs1)\n[ \"$observed_value\" = ef53 ]\ntest ! -L /data/.esphome-cgs1/install.intent\ntest -f /data/.esphome-cgs1/install.intent\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/install.intent)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/install.intent | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "install_marker_sha256"
      },
      " ]\nobserved_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/install.intent)\n[ \"$observed_value\" = '98 600 0 1' ]\n# CGS1_BRIDGE_COMPLETION arm\ntest ! -L /data/.esphome-cgs1/bridge-next-boot.complete\ntest -f /data/.esphome-cgs1/bridge-next-boot.complete\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/bridge-next-boot.complete)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/bridge-next-boot.complete | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "arm_completion_sha256"
      },
      " ]\nobserved_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/bridge-next-boot.complete)\n[ \"$observed_value\" = '135 600 0 1' ]\nobserved_value=$(cat /data/.esphome-cgs1/bridge-next-boot.complete)\n[ \"$observed_value\" = 'arm ",
      {
        "field": "nonce"
      },
      " ",
      {
        "field": "plan_id"
      },
      " ",
      {
        "field": "plan_sha256"
      },
      "' ]\nentries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)\nprintf '%s\\n' \"$entries\" | while IFS= read -r entry; do\n case \"$entry\" in (disabled) exit 1;; esac\ndone\nobserved_value=$(cat /sys/class/net/wlan0/address)\n[ \"$observed_value\" = ",
      {
        "field": "wlan_mac"
      },
      " ]\nobserved_value=$(cat /data/etc/os-release)\n[ \"$observed_value\" = CLEARGRASS_VERSION=4.1.8_0287 ]\nobserved_value=$(cat /proc/sys/kernel/random/boot_id)\n[ \"$observed_value\" = ",
      {
        "field": "boot_id"
      },
      " ]\nobserved_value=$(awk '\nBEGIN { section=0; count=0 }\n/^[ \\t]*\\[/ { section=($0 ~ /^[ \\t]*\\[sensors\\][ \\t]*\\r?$/) }\nsection && /^[ \\t]*co2_type[ \\t]*=/ {\n    value=$0; sub(/^[^=]*=[ \\t]*/, \"\", value); sub(/[ \\t\\r]*$/, \"\", value)\n    print value; count++\n}\nEND { if (count != 1) exit 1 }\n' /data/etc/setting.ini)\n",
      "[ \"$observed_value\" = ",
      {
        "field": "co2_type"
      },
      " ]",
      "\ntest ! -L /data/.esphome-cgs1/program\ntest -f /data/.esphome-cgs1/program\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/program)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/program | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "staged_sha_0"
      },
      " ]\ntest ! -L /data/.esphome-cgs1/pm_qt_bridge.so\ntest -f /data/.esphome-cgs1/pm_qt_bridge.so\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/pm_qt_bridge.so)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/pm_qt_bridge.so | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "staged_sha_1"
      },
      " ]\ntest ! -L /data/.esphome-cgs1/launch.sh\ntest -f /data/.esphome-cgs1/launch.sh\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/launch.sh)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/launch.sh | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "staged_sha_2"
      },
      " ]\ntest ! -L /data/.esphome-cgs1/SnowApp-with-PM\ntest -f /data/.esphome-cgs1/SnowApp-with-PM\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/SnowApp-with-PM)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/SnowApp-with-PM | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "staged_sha_3"
      },
      " ]\ntest ! -L /data/.esphome-cgs1/startup-hook.sh\ntest -f /data/.esphome-cgs1/startup-hook.sh\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/startup-hook.sh)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/startup-hook.sh | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "staged_sha_4"
      },
      " ]\ntest ! -L /data/.esphome-cgs1/stock-start.sh.original\ntest -f /data/.esphome-cgs1/stock-start.sh.original\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/stock-start.sh.original)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/stock-start.sh.original | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "staged_sha_5"
      },
      " ]\ntest ! -L /data/.esphome-cgs1/stock-watchdog.sh.original\ntest -f /data/.esphome-cgs1/stock-watchdog.sh.original\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/stock-watchdog.sh.original)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/stock-watchdog.sh.original | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "staged_sha_6"
      },
      " ]\ntest ! -L /data/.esphome-cgs1/start.sh.candidate\ntest -f /data/.esphome-cgs1/start.sh.candidate\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/start.sh.candidate)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/start.sh.candidate | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "staged_sha_7"
      },
      " ]\ntest ! -L /data/.esphome-cgs1/watchdog.sh.candidate\ntest -f /data/.esphome-cgs1/watchdog.sh.candidate\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/watchdog.sh.candidate)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/watchdog.sh.candidate | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "staged_sha_8"
      },
      " ]\ntest ! -L /data/bin/SnowApp\ntest -f /data/bin/SnowApp\nobserved_value=$(stat -c '%h %u' /data/bin/SnowApp)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/bin/SnowApp | awk '{print $1}')\n[ \"$observed_value\" = a39016531620a874668ee322f0e976f48e47943742c54c8a7291b9e830c91abb ]\ntest ! -L /data/bin/watchdog.sh\ntest -f /data/bin/watchdog.sh\nobserved_value=$(stat -c '%h %u' /data/bin/watchdog.sh)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/bin/watchdog.sh | awk '{print $1}')\n[ \"$observed_value\" = 1d74ef0946734e1ddf9e76301012f9ed66d7b38d9d7a0239a5d0e80acabf2cce ]\ntest ! -L /data/etc/init.d/start.sh\ntest -f /data/etc/init.d/start.sh\nobserved_value=$(stat -c '%h %u' /data/etc/init.d/start.sh)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/etc/init.d/start.sh | awk '{print $1}')\n[ \"$observed_value\" = f104f873dd3ce4544d5f3e3f90a4056bffc811bcaae037e347306e1084e7f1d1 ]\ntest ! -L /etc/init.d/S12_launcher_init\ntest -f /etc/init.d/S12_launcher_init\nobserved_value=$(stat -c '%h %u' /etc/init.d/S12_launcher_init)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /etc/init.d/S12_launcher_init | awk '{print $1}')\n[ \"$observed_value\" = 533cac6f65b3ccf8d3404216c688877ad03a8b03af64edaade9bd6dc3aad1c35 ]\ntest ! -L /etc/init.d/S50_px3se_init\ntest -f /etc/init.d/S50_px3se_init\nobserved_value=$(stat -c '%h %u' /etc/init.d/S50_px3se_init)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /etc/init.d/S50_px3se_init | awk '{print $1}')\n[ \"$observed_value\" = d818606f68bc1428ef96c5257df751a843cc9a6770dc25a2487a940c6bcb2492 ]\ntest ! -L /lib/ld-2.23.so\ntest -f /lib/ld-2.23.so\nobserved_value=$(stat -c '%h %u' /lib/ld-2.23.so)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /lib/ld-2.23.so | awk '{print $1}')\n[ \"$observed_value\" = 6da48efda9ff440998747a66131e8ebdc6a57a15bb19dcfd7895a031368dd50a ]\ntest ! -L /lib/libc-2.23.so\ntest -f /lib/libc-2.23.so\nobserved_value=$(stat -c '%h %u' /lib/libc-2.23.so)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /lib/libc-2.23.so | awk '{print $1}')\n[ \"$observed_value\" = 6479e377cd35c6e90e9aba990ac5137b195ca765544ad0c561f7f5945ea7133e ]\ntest ! -L /usr/lib/libQt5Core.so.5.9.4\ntest -f /usr/lib/libQt5Core.so.5.9.4\nobserved_value=$(stat -c '%h %u' /usr/lib/libQt5Core.so.5.9.4)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /usr/lib/libQt5Core.so.5.9.4 | awk '{print $1}')\n[ \"$observed_value\" = b43e1cc628e625a422cfcf98aad38c9542b98cea28196ac4fd14931fd5ccf88d ]\ntest ! -L /usr/lib/libstdc++.so.6.0.20\ntest -f /usr/lib/libstdc++.so.6.0.20\nobserved_value=$(stat -c '%h %u' /usr/lib/libstdc++.so.6.0.20)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /usr/lib/libstdc++.so.6.0.20 | awk '{print $1}')\n[ \"$observed_value\" = 93cc1352b59a0d3a39a8f9d311332f84115e3c5ee71afd846302b942071675c4 ]\nobserved_value=$(# CGS1_BOOT_LOCK\ntest ! -L /tmp\nobserved_value=$(stat -c '%a %u' /tmp)\n[ \"$observed_value\" = '1777 0' ]\ntest ! -L /tmp/qingping-cgs1-esphome.lock\ntest -d /tmp/qingping-cgs1-esphome.lock\nobserved_value=$(stat -c '%a %u' /tmp/qingping-cgs1-esphome.lock)\n[ \"$observed_value\" = '700 0' ]\nobserved_value=$(stat -f -c '%t' /tmp/qingping-cgs1-esphome.lock)\n[ \"$observed_value\" = 1021994 ]\nentries=$(LC_ALL=C ls -A1 /tmp/qingping-cgs1-esphome.lock)\n[ \"$entries\" = \"$(printf 'child.pid\\nsupervisor.pid')\" ]\ntest ! -L /tmp/qingping-cgs1-esphome.lock/supervisor.pid\ntest -f /tmp/qingping-cgs1-esphome.lock/supervisor.pid\nobserved_value=$(stat -c '%a %u %h' /tmp/qingping-cgs1-esphome.lock/supervisor.pid)\n[ \"$observed_value\" = '600 0 1' ]\nvalue=$(cat /tmp/qingping-cgs1-esphome.lock/supervisor.pid)\ncase \"$value\" in (''|*[!0-9]*) exit 1;; esac\n[ \"${#value}\" -le 10 ]\nprintf '%s\\n' \"$value\"\ntest ! -L /tmp/qingping-cgs1-esphome.lock/child.pid\ntest -f /tmp/qingping-cgs1-esphome.lock/child.pid\nobserved_value=$(stat -c '%a %u %h' /tmp/qingping-cgs1-esphome.lock/child.pid)\n[ \"$observed_value\" = '600 0 1' ]\nvalue=$(cat /tmp/qingping-cgs1-esphome.lock/child.pid)\ncase \"$value\" in (''|*[!0-9]*) exit 1;; esac\n[ \"${#value}\" -le 10 ]\nprintf '%s\\n' \"$value\"\n)\n[ \"$observed_value\" = '",
      {
        "field": "supervisor_pid"
      },
      "\n",
      {
        "field": "child_pid"
      },
      "' ]\nentries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)\nprintf '%s\\n' \"$entries\" | while IFS= read -r entry; do\n case \"$entry\" in (full-releases|wifi|full-state) exit 1;; esac\ndone\nobserved_value=$(cat /tmp/qingping-cgs1-esphome.lock/supervisor.pid)\n[ \"$observed_value\" = ",
      {
        "field": "supervisor_pid"
      },
      " ]\nobserved_value=$(cat /tmp/qingping-cgs1-esphome.lock/child.pid)\n[ \"$observed_value\" = ",
      {
        "field": "child_pid"
      },
      " ]\nobserved_value=$(count=0\nfor link in /proc/[0-9]*/exe; do\n    count=$((count+1))\n    [ \"$count\" -le 4096 ] || exit 1\n    pid=${link#/proc/}; pid=${pid%/exe}\n    case \"$pid\" in (''|*[!0-9]*) exit 1;; esac\n    if executable=$(readlink \"$link\" 2>/dev/null); then\n        :\n    else\n        # Kernel threads and exited tasks legitimately have no executable.\n        # An unreadable live userspace exe is NOT evidence of its absence.\n        [ -d \"/proc/$pid\" ] || continue\n        metadata=$(sed 's/.*) //' \"/proc/$pid/stat\" 2>/dev/null | awk '{print $1, $7}')\n        set -- $metadata\n        if [ \"$#\" -ne 2 ]; then\n            [ ! -d \"/proc/$pid\" ] && continue\n            exit 1\n        fi\n        case \"$2\" in (''|*[!0-9]*) exit 1;; esac\n        case \"$1\" in (Z|X|x) continue;; esac\n        [ \"$(($2 & 2097152))\" -ne 0 ] || exit 1\n        continue\n    fi\n    case \"$executable\" in\n        (/data/.esphome-cgs1/*|/tmp/qingping-full-*/*|/tmp/qingping-initial-*/*)\ncase \"$pid:$executable\" in\n(",
      {
        "field": "child_pid"
      },
      ":/data/.esphome-cgs1/program) :;;\n(*) exit 1;;\nesac;;\n        (/data/bin/SnowApp) printf '%s\\n' \"$pid\";;\n    esac\ndone)\n[ \"$observed_value\" = ",
      {
        "field": "stock_pid"
      },
      " ]\nobserved_value=$(readlink /proc/",
      {
        "field": "child_pid"
      },
      "/exe)\n[ \"$observed_value\" = /data/.esphome-cgs1/program ]\nobserved_value=$(stat -c '%u' /proc/",
      {
        "field": "child_pid"
      },
      ")\n[ \"$observed_value\" = 0 ]\nobserved_value=$(sed 's/.*) //' /proc/",
      {
        "field": "child_pid"
      },
      "/stat | awk '{print $20}')\n[ \"$observed_value\" = ",
      {
        "field": "child_birth"
      },
      " ]\nprocess_state=$(sed 's/.*) //' /proc/",
      {
        "field": "child_pid"
      },
      "/stat | awk '{print $1}')\ncase \"$process_state\" in R|S|D|I) :;; *) exit 1;; esac\nobserved_value=$(readlink /proc/",
      {
        "field": "supervisor_pid"
      },
      "/exe)\n[ \"$observed_value\" = /bin/busybox ]\nobserved_value=$(stat -c '%u' /proc/",
      {
        "field": "supervisor_pid"
      },
      ")\n[ \"$observed_value\" = 0 ]\nobserved_value=$(sed 's/.*) //' /proc/",
      {
        "field": "supervisor_pid"
      },
      "/stat | awk '{print $20}')\n[ \"$observed_value\" = ",
      {
        "field": "supervisor_birth"
      },
      " ]\nprocess_state=$(sed 's/.*) //' /proc/",
      {
        "field": "supervisor_pid"
      },
      "/stat | awk '{print $1}')\ncase \"$process_state\" in R|S|D|I) :;; *) exit 1;; esac\nobserved_value=$(readlink /proc/",
      {
        "field": "stock_pid"
      },
      "/exe)\n[ \"$observed_value\" = /data/bin/SnowApp ]\nobserved_value=$(stat -c '%u' /proc/",
      {
        "field": "stock_pid"
      },
      ")\n[ \"$observed_value\" = 0 ]\nobserved_value=$(sed 's/.*) //' /proc/",
      {
        "field": "stock_pid"
      },
      "/stat | awk '{print $20}')\n[ \"$observed_value\" = ",
      {
        "field": "stock_birth"
      },
      " ]\nprocess_state=$(sed 's/.*) //' /proc/",
      {
        "field": "stock_pid"
      },
      "/stat | awk '{print $1}')\ncase \"$process_state\" in R|S|D|I) :;; *) exit 1;; esac\nobserved_value=$(readlink /proc/",
      {
        "field": "watchdog_pid"
      },
      "/exe)\n[ \"$observed_value\" = /bin/busybox ]\nobserved_value=$(stat -c '%u' /proc/",
      {
        "field": "watchdog_pid"
      },
      ")\n[ \"$observed_value\" = 0 ]\nobserved_value=$(sed 's/.*) //' /proc/",
      {
        "field": "watchdog_pid"
      },
      "/stat | awk '{print $20}')\n[ \"$observed_value\" = ",
      {
        "field": "watchdog_birth"
      },
      " ]\nprocess_state=$(sed 's/.*) //' /proc/",
      {
        "field": "watchdog_pid"
      },
      "/stat | awk '{print $1}')\ncase \"$process_state\" in R|S|D|I) :;; *) exit 1;; esac\nobserved_value=$(sed 's/.*) //' /proc/",
      {
        "field": "stock_pid"
      },
      "/stat | awk '{print $2}')\n[ \"$observed_value\" = ",
      {
        "field": "watchdog_pid"
      },
      " ]\nobserved_value=$(sed 's/.*) //' /proc/",
      {
        "field": "child_pid"
      },
      "/stat | awk '{print $2}')\n[ \"$observed_value\" = ",
      {
        "field": "supervisor_pid"
      },
      " ]\narguments=$(tr '\\000' '\\n' < /proc/",
      {
        "field": "supervisor_pid"
      },
      "/cmdline)\n[ \"$arguments\" = \"$(printf '/bin/sh\\n/data/.esphome-cgs1/launch.sh\\nsupervise')\" ]\narguments=$(tr '\\000' '\\n' < /proc/",
      {
        "field": "watchdog_pid"
      },
      "/cmdline)\n[ \"$arguments\" = \"$(printf '/bin/sh\\n/data/bin/watchdog.sh')\" ]\ntest -r /proc/",
      {
        "field": "stock_pid"
      },
      "/maps\nif grep -F -q /data/.esphome-cgs1/ /proc/",
      {
        "field": "stock_pid"
      },
      "/maps; then exit 1; else result=$?; [ \"$result\" -eq 1 ]; fi\ntest -r /proc/",
      {
        "field": "stock_pid"
      },
      "/maps\nif grep -F -q /tmp/qingping-full- /proc/",
      {
        "field": "stock_pid"
      },
      "/maps; then exit 1; else result=$?; [ \"$result\" -eq 1 ]; fi\ntest -r /proc/",
      {
        "field": "stock_pid"
      },
      "/maps\nif grep -F -q /tmp/qingping-initial- /proc/",
      {
        "field": "stock_pid"
      },
      "/maps; then exit 1; else result=$?; [ \"$result\" -eq 1 ]; fi\ntest ! -L /data/.esphome-cgs1/.initial-pm-enable.lock\ntest -d /data/.esphome-cgs1/.initial-pm-enable.lock\nobserved_value=$(stat -c '%a %u' /data/.esphome-cgs1/.initial-pm-enable.lock)\n[ \"$observed_value\" = '700 0' ]\ntest ! -L /data/.esphome-cgs1/.initial-pm-enable.lock/owner\ntest -f /data/.esphome-cgs1/.initial-pm-enable.lock/owner\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/.initial-pm-enable.lock/owner)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/.initial-pm-enable.lock/owner | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "pm_owner_sha256"
      },
      " ]\nobserved_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/.initial-pm-enable.lock/owner)\n[ \"$observed_value\" = '186 600 0 1' ]\ntest ! -L /tmp\ntest -d /tmp\nobserved_value=$(stat -c '%a %u' /tmp)\n[ \"$observed_value\" = '1777 0' ]\nobserved_value=$(stat -f -c '%t' /tmp)\n[ \"$observed_value\" = 1021994 ]\ntest ! -L /tmp/qingping-pm-helper.attempted\ntest -f /tmp/qingping-pm-helper.attempted\nobserved_value=$(stat -c '%h %u' /tmp/qingping-pm-helper.attempted)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /tmp/qingping-pm-helper.attempted | awk '{print $1}')\n[ \"$observed_value\" = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 ]\nobserved_value=$(stat -c '%s %a %u %h' /tmp/qingping-pm-helper.attempted)\n[ \"$observed_value\" = '0 600 0 1' ]\ntest ! -L /data/.esphome-cgs1/pm-helper.disabled\ntest -f /data/.esphome-cgs1/pm-helper.disabled\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/pm-helper.disabled)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/pm-helper.disabled | awk '{print $1}')\n[ \"$observed_value\" = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 ]\nobserved_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/pm-helper.disabled)\n[ \"$observed_value\" = '0 600 0 1' ]\ntest ! -L /data/.esphome-cgs1/pm-helper.disabled.before-initial-enable\ntest -f /data/.esphome-cgs1/pm-helper.disabled.before-initial-enable\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/pm-helper.disabled.before-initial-enable)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/pm-helper.disabled.before-initial-enable | awk '{print $1}')\n[ \"$observed_value\" = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 ]\nobserved_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/pm-helper.disabled.before-initial-enable)\n[ \"$observed_value\" = '0 600 0 1' ]\nentries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)\nprintf '%s\\n' \"$entries\" | while IFS= read -r entry; do\n case \"$entry\" in (initial-pm-enable.complete) exit 1;; esac\ndone\nrm /data/.esphome-cgs1/pm-helper.disabled\nsync\nentries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)\nprintf '%s\\n' \"$entries\" | while IFS= read -r entry; do\n case \"$entry\" in (initial-pm-enable.complete) exit 1;; esac\ndone\nprintf '%s\\n' 'initial-pm-enable ",
      {
        "field": "pm_nonce"
      },
      " ",
      {
        "field": "plan_id"
      },
      " ",
      {
        "field": "plan_sha256"
      },
      " ",
      {
        "field": "boot_id"
      },
      "' > /data/.esphome-cgs1/initial-pm-enable.complete\nsync\n"
    ],
    "complete": [
      "test ! -L /data\ntest ! -L /data/.esphome-cgs1\ntest -d /data/.esphome-cgs1\nobserved_value=$(stat -c '%d %i %a %u' /data/.esphome-cgs1)\n[ \"$observed_value\" = '",
      {
        "field": "root_device"
      },
      " ",
      {
        "field": "root_inode"
      },
      " 700 0' ]\nobserved_value=$(cat /proc/sys/kernel/random/boot_id)\n[ \"$observed_value\" = ",
      {
        "field": "boot_id"
      },
      " ]\nobserved_value=$(cat /sys/class/net/wlan0/address)\n[ \"$observed_value\" = ",
      {
        "field": "wlan_mac"
      },
      " ]\nobserved_value=$(cat /data/etc/os-release)\n[ \"$observed_value\" = CLEARGRASS_VERSION=4.1.8_0287 ]\nobserved_value=$(awk '\nBEGIN { section=0; count=0 }\n/^[ \\t]*\\[/ { section=($0 ~ /^[ \\t]*\\[sensors\\][ \\t]*\\r?$/) }\nsection && /^[ \\t]*co2_type[ \\t]*=/ {\n    value=$0; sub(/^[^=]*=[ \\t]*/, \"\", value); sub(/[ \\t\\r]*$/, \"\", value)\n    print value; count++\n}\nEND { if (count != 1) exit 1 }\n' /data/etc/setting.ini)\n",
      "[ \"$observed_value\" = ",
      {
        "field": "co2_type"
      },
      " ]",
      "\ntest ! -L /data/.esphome-cgs1/install.intent\ntest -f /data/.esphome-cgs1/install.intent\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/install.intent)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/install.intent | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "install_marker_sha256"
      },
      " ]\ntest ! -L /data/.esphome-cgs1/.initial-pm-enable.lock/owner\ntest -f /data/.esphome-cgs1/.initial-pm-enable.lock/owner\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/.initial-pm-enable.lock/owner)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/.initial-pm-enable.lock/owner | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "pm_owner_sha256"
      },
      " ]\nobserved_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/.initial-pm-enable.lock/owner)\n[ \"$observed_value\" = '186 600 0 1' ]\ntest ! -L /data/.esphome-cgs1/initial-pm-enable.complete\ntest -f /data/.esphome-cgs1/initial-pm-enable.complete\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/initial-pm-enable.complete)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/initial-pm-enable.complete | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "pm_owner_sha256"
      },
      " ]\nobserved_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/initial-pm-enable.complete)\n[ \"$observed_value\" = '186 600 0 1' ]\ntest ! -L /data/.esphome-cgs1/.initial-pm-enable.lock\ntest -d /data/.esphome-cgs1/.initial-pm-enable.lock\nobserved_value=$(stat -c '%a %u' /data/.esphome-cgs1/.initial-pm-enable.lock)\n[ \"$observed_value\" = '700 0' ]\nentries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)\nprintf '%s\\n' \"$entries\" | while IFS= read -r entry; do\n case \"$entry\" in (pm-helper.disabled) exit 1;; esac\ndone\nentries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)\nprintf '%s\\n' \"$entries\" | while IFS= read -r entry; do\n case \"$entry\" in (disabled) exit 1;; esac\ndone\ntest ! -L /data/.esphome-cgs1/pm-helper.disabled.before-initial-enable\ntest -f /data/.esphome-cgs1/pm-helper.disabled.before-initial-enable\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/pm-helper.disabled.before-initial-enable)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/pm-helper.disabled.before-initial-enable | awk '{print $1}')\n[ \"$observed_value\" = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 ]\nobserved_value=$(stat -c '%s %a %u %h' /data/.esphome-cgs1/pm-helper.disabled.before-initial-enable)\n[ \"$observed_value\" = '0 600 0 1' ]\ntest ! -L /tmp/qingping-pm-helper.attempted\ntest -f /tmp/qingping-pm-helper.attempted\nobserved_value=$(stat -c '%h %u' /tmp/qingping-pm-helper.attempted)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /tmp/qingping-pm-helper.attempted | awk '{print $1}')\n[ \"$observed_value\" = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 ]\nobserved_value=$(stat -c '%s %a %u %h' /tmp/qingping-pm-helper.attempted)\n[ \"$observed_value\" = '0 600 0 1' ]\ntest ! -L /tmp\ntest -d /tmp\nobserved_value=$(stat -c '%a %u' /tmp)\n[ \"$observed_value\" = '1777 0' ]\nobserved_value=$(stat -f -c '%t' /tmp)\n[ \"$observed_value\" = 1021994 ]\nobserved_value=$(stat -f -c '%t' /data/.esphome-cgs1)\n[ \"$observed_value\" = ef53 ]\ntest ! -L /data/.esphome-cgs1/program\ntest -f /data/.esphome-cgs1/program\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/program)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/program | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "staged_sha_0"
      },
      " ]\ntest ! -L /data/.esphome-cgs1/pm_qt_bridge.so\ntest -f /data/.esphome-cgs1/pm_qt_bridge.so\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/pm_qt_bridge.so)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/pm_qt_bridge.so | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "staged_sha_1"
      },
      " ]\ntest ! -L /data/.esphome-cgs1/launch.sh\ntest -f /data/.esphome-cgs1/launch.sh\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/launch.sh)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/launch.sh | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "staged_sha_2"
      },
      " ]\ntest ! -L /data/.esphome-cgs1/SnowApp-with-PM\ntest -f /data/.esphome-cgs1/SnowApp-with-PM\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/SnowApp-with-PM)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/SnowApp-with-PM | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "staged_sha_3"
      },
      " ]\ntest ! -L /data/.esphome-cgs1/startup-hook.sh\ntest -f /data/.esphome-cgs1/startup-hook.sh\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/startup-hook.sh)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/startup-hook.sh | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "staged_sha_4"
      },
      " ]\ntest ! -L /data/.esphome-cgs1/stock-start.sh.original\ntest -f /data/.esphome-cgs1/stock-start.sh.original\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/stock-start.sh.original)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/stock-start.sh.original | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "staged_sha_5"
      },
      " ]\ntest ! -L /data/.esphome-cgs1/stock-watchdog.sh.original\ntest -f /data/.esphome-cgs1/stock-watchdog.sh.original\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/stock-watchdog.sh.original)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/stock-watchdog.sh.original | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "staged_sha_6"
      },
      " ]\ntest ! -L /data/.esphome-cgs1/start.sh.candidate\ntest -f /data/.esphome-cgs1/start.sh.candidate\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/start.sh.candidate)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/start.sh.candidate | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "staged_sha_7"
      },
      " ]\ntest ! -L /data/.esphome-cgs1/watchdog.sh.candidate\ntest -f /data/.esphome-cgs1/watchdog.sh.candidate\nobserved_value=$(stat -c '%h %u' /data/.esphome-cgs1/watchdog.sh.candidate)\n[ \"$observed_value\" = '1 0' ]\nobserved_value=$(sha256sum /data/.esphome-cgs1/watchdog.sh.candidate | awk '{print $1}')\n[ \"$observed_value\" = ",
      {
        "field": "staged_sha_8"
      },
      " ]\n"
    ]
  }
};
