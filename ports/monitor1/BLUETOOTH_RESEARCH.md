# Bluetooth on CGS1: evidence and remaining blockers

Status checked on 6 November 2026. A CGS1 Bluetooth proxy is **not implemented
or enabled**. Loading a Wi-Fi module, finding Bluetooth firmware on disk, or
compiling a scanner is not proof of a working Home Assistant proxy.

## What was observed

Read-only inventories of two stock 4.1.8_0287 devices found the RTL8723DS
Wi-Fi SDIO function, vendor Bluetooth tools/firmware and kernel modules, but
no HCI controller. The sole rfkill entry identifies itself as **WLAN**.
The SCD40 inventory completed with 174 items and no partial-result flag.

The S8 device uses UART0 for CO2 and UART2 for PM. The inspected SCD40 device
reads CO2 through a kernel interface, so its UART ownership differs. On both,
the active FIQ debugger uses serial-id 1. An existing or apparently idle tty
does not establish that the Bluetooth pins are wired to it.

The inspected device tree has no wireless-bluetooth node. It does contain
Wi-Fi and serial nodes; neither supplies a verified BT_REG_ON mapping.
Stock's commented `rkrtkbt ttyS0` line is generic BSP configuration, not a
Qingping board schematic. Static inspection also found that the wrapper's
control flow writes rfkill0 even when asked for help. Do not execute it as a
supposedly read-only probe: it targets the only observed WLAN rfkill entry.

The full UI and both guardians were restored after the SCD40 inventory.
No UART attachment, GPIO/rfkill write, driver load, device-tree edit or
Bluetooth firmware download to the controller was performed.

## External sources and their limits

[Radxa's Realtek driver README](https://github.com/radxa/rtkbt) maps
**RTL8723DS Bluetooth to UART**, using the H5 transport, and requires correct
physical UART wiring. Its generic examples do not identify a CGS1 tty or
power pin. The working Wi-Fi SDIO function cannot substitute for that wiring
evidence. Other Realtek models in the same document use different interfaces.

[Oleksandr Liutyi's original CGS1 teardown](https://wiki.liutyi.info/display/CO2/Qingping+CGS1+inside),
edited in August 2021, identifies an RTL8723DS on a
`Snow_PB_MB_P12_20210331` board with an S8 sensor. It does not provide a
Bluetooth UART/power schematic. Its board and sensor identification must not
be assumed to cover every SCD40 revision.

The inspected ESPHome 2026.10.1 source also lacks a host-platform Bluetooth
tracker/GATT implementation for the standard proxy. Making Linux expose HCI
would therefore be a prerequisite, not a complete proxy implementation.

## What would permit the next hardware step

First establish the **exact board revision, BT UART and BT_REG_ON wiring**
from a matching schematic or physical board tracing. Confirm that the route
does not overlap the sensor ports or live FIQ console. Then review the
matching vendor H5/firmware configuration and define a bounded attach/restore
procedure before touching the running device.

Only a proven controller route justifies implementing and testing a host
backend: authenticated proxy transport, advertisement delivery, active GATT
connections, subscription/disconnection handling and recovery. Enable/disable
must control that real backend and release its resources. A configuration
switch backed only by a boolean or passive scan would misrepresent support.

For now, keep the CGS1 proxy unavailable. This is a specific missing hardware
and host-backend proof, not a claim that no CGS1 board could ever support it.
