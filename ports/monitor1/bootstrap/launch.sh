#!/bin/sh
# CGS1 stock bridge supervisor. This owns only /data/.esphome-cgs1 and its
# private RAM lock. It never kills SnowApp, miio_client, Wi-Fi or the watchdog.
# Three failed application launches per boot are the limit; no reboot loop.
set -eu
base=/data/.esphome-cgs1
lock=/tmp/qingping-cgs1-esphome.lock
umask 077

stop_child() {
    [ -f "$lock/child.pid" ] || return 0
    pid=$(cat "$lock/child.pid")
    case "$pid" in ''|*[!0-9]*) echo "Invalid own child PID" >&2; return 1;; esac
    [ -d "/proc/$pid" ] || return 0
    executable=$(readlink "/proc/$pid/exe")
    [ "$executable" = "$base/program" ] || {
        echo "PID no longer belongs to this bridge; refusing to signal" >&2
        return 1
    }
    kill -TERM "$pid"
}

case "${1:-start}" in
    stop)
        # Persistent opt-out: the next stock boot also leaves ESPHome stopped.
        : > "$base/disabled"
        stop_child
        ;;
    enable)
        rm -f "$base/disabled"
        exec /bin/sh "$base/launch.sh" start
        ;;
    start)
        [ ! -f "$base/disabled" ] || exit 0
        [ -x "$base/program" ] || exit 1
        # Atomic lock prevents duplicate API listeners. A stale lock after a
        # supervisor failure is intentionally conservative; reboot clears /tmp.
        mkdir "$lock" 2>/dev/null || exit 0
        trap '' HUP
        /bin/sh "$base/launch.sh" supervise </dev/null >/tmp/qingping-cgs1-supervisor.log 2>&1 &
        echo "$!" > "$lock/supervisor.pid"
        ;;
    supervise)
        trap '' HUP
        trap 'rm -f "$lock/child.pid" "$lock/supervisor.pid"; rmdir "$lock" 2>/dev/null || true' EXIT
        mkdir -p "$base/prefs"
        chmod 700 "$base" "$base/prefs"
        cd "$base"
        for delay in 10 30 60; do
            [ ! -f "$base/disabled" ] || exit 0
            # Preferences stay private and persistent; logs stay in RAM to
            # avoid continuous NAND writes. OTA re-exec keeps this child PID.
            ESPHOME_PREFDIR="$base/prefs" nice -n 10 ./program </dev/null >/tmp/qingping-cgs1-program.log 2>&1 &
            echo "$!" > "$lock/child.pid"
            wait "$!" || true
            [ ! -f "$base/disabled" ] || exit 0
            sleep "$delay"
        done
        : > "$base/disabled"
        echo "Bridge stopped after three exits; stock remains active" >&2
        ;;
    *)
        echo "Usage: launch.sh start|stop|enable" >&2
        exit 2
        ;;
esac
