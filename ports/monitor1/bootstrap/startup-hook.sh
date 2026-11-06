
# BEGIN CGS1 ESPHome stock bridge (local addition, 2026-11-01)
# Never block or replace the stock launcher; the bridge owns its own child.
if [ -x /data/.esphome-cgs1/launch.sh ]; then
    /bin/sh /data/.esphome-cgs1/launch.sh start </dev/null >/dev/null 2>&1 &
fi
# END CGS1 ESPHome stock bridge
