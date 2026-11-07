# Bluetooth on CGS1: evidence and remaining blockers

Source review updated on 7 November 2026; hardware observations below remain
from 6 November. A CGS1 Bluetooth proxy is **not implemented
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

### Chip pinout and additional board sources

The [Realtek RTL8723DS-CG Rev. 0.92 datasheet hosted by Radxa](https://dl.radxa.com/rockpis/docs/hw/datasheets/RTL8723DS-CG_DataSheet_0.92_20170804.pdf),
dated 24 July 2017, separates the Bluetooth UART from WLAN SDIO. Its package
pinout lists UART_IN 25, UART_CTS 26 and UART_OUT 27. BT_DIS# is pin 43/GPIO11;
holding it low disables Bluetooth and its UART. WL_DIS# is a separate pin
4/GPIO9. These are **chip pins, not CGS1 SoC GPIO numbers or tty mappings**.
The UART chapter describes four-wire flow control, but this pinout does not
label a separate RTS pin; do not infer one. No vendor PDF is bundled here.

On 7 November, Google web search for CGS1/RTL8723DS/UART/PCB returned an AI
Overview that called chip pin 24 UART_RTS and asserted board BT_TX/BT_RX
test points. These are not accepted wiring evidence. The manufacturer
[Rev. 0.92 datasheet copy at LCSC](https://datasheet.lcsc.com/datasheet/pdf/c494e1c39d5f0a62747ce0c16bf5d494.pdf?productCode=C2762334),
section 6.5, table 5 (printed page 9 / PDF page 15), identifies pin 24 as
PCM_CLK, shared with GPIO3. No source inspected in that search established
CGS1 BT test-point locations or a safe SoC UART/power mapping. This limited
search does not prove that a schematic is globally absent.

A follow-up Yandex web search on 7 November made the FCCID.io rendered
photo viewer accessible. The earlier document-reader failure therefore no
longer describes all available photo coverage. The FCC.report mirror was not
revisited; its earlier safety-check failure remains a separate access limit.

Liutyi's board and wireless close-ups confirm the chip marking on that S8
board. They do not show enough continuous routing to establish the destination
of the Bluetooth UART or BT_DIS#. An unreadable route is not proof of an
unconnected pin, and the pictured revision is not evidence for every CGS1.

The [FCC internal-photo filing](https://fccid.io/2AQ3FCGS1/Internal-Photos/Internal-photos-4025935),
exhibit 4025935 for FCC ID 2AQ3F-CGS1, was published on 1 October 2018 and has
nine pages. Its rendered viewer was inspected, including both sides of the
main board on the last page. The related SCH and Block Diagram entries are
still labelled **Metadata only**. These photographs do not establish readable
Bluetooth UART/power net continuity to the SoC, and do not qualify the wiring
of another board revision.

Direct retrieval of the PDF resource returned HTTP 403, so no original PDF
bytes were retained or independently hashed locally. This review used the
browser's rendered pages; it is not a preserved-original audit. Search AI
summaries and a generic chip datasheet are not a CGS1 board schematic, and
limited search coverage cannot establish that no schematic exists anywhere.
The public 4PDA CGS1/CGS2 topic was readable, but its Bluetooth topic search
required a human verification step; it did not supply a verified wiring map.

## A real Linux software candidate

[yuzi-co/btproxy](https://github.com/yuzi-co/btproxy/tree/9d65f68756dbeb03561b6d2914a9c4f30c78356d)
is an MIT-licensed independent implementation of the ESPHome API. At the
checked commit it has Noise transport, advertisement delivery and active
GATT/read/write/notify code. Its Linux kernel backend uses HCI management,
monitor and L2CAP sockets without requiring bluetoothd or D-Bus. These are
source capabilities; its upstream deployment claims do not qualify CGS1.

On 6 November 2026, this exact source was cross-compiled with Go 1.27.3,
`CGO_ENABLED=0 GOOS=linux GOARCH=arm GOARM=7`, producing static ARM EABI5 ELFs:

| Build | Bytes | SHA-256 |
| --- | ---: | --- |
| Default | 4,849,824 | `7bf55fcb35f404bd7eb1a57f52a41d24b54ab43766615c256d20c75e41dc7cec` |
| `-tags nobluez` | 4,194,464 | `4e2ad8b494b8e34ddc4d5a3a28f85b35b6751f490bbfc3f788b54a07450d58d4` |

Five host Noise tests passed, including a reference handshake vector, a
session, wrong-key refusals and a plaintext-client refusal. They used a
synthetic adapter and loopback sockets only. Neither ARM program was run on
a monitor. Static linking removes a glibc dependency; it does not establish
Go runtime compatibility with the stock Linux 3.10 kernel, Bluetooth socket
support, usable HCI, physical advertisements or working active GATT.

The [checked kernel adapter source](https://github.com/yuzi-co/btproxy/blob/9d65f68756dbeb03561b6d2914a9c4f30c78356d/internal/ble/kernel/adapter.go)
falls back to active scanning when advertisement-monitor registration returns
UnknownCommand. A newer advertisement-monitor API is therefore not by itself
a reason to reject all older kernels. Rockchip's `release-3.10` reference
sources contain HCI control/monitor sockets and the basic management commands;
they have not been matched to the exact CGS1 kernel binary/configuration.

### Candidate integration boundaries

Do not deploy the candidate's defaults blindly. Initial setup sends controller
configuration, bond-loading and SetPowered commands. Its recovery supervisor
can also power-cycle the adapter after silence or failing commands; disabling
USB reset alone does not disable those power cycles. At this exact commit,
`stall-timeout=0` returns before that recovery branch, including its timeout
and setup-failure calls. It **does not make initial setup read-only** or prove
safe coexistence on CGS1. Any future adapter must review controller ownership,
all startup/recovery writes, bounded shutdown and sensor/WLAN coexistence.

The existing monitor API already owns TCP 6053. A sidecar needs an explicitly
designed endpoint and HA identity, private key delivery and real shared
enable/disable lifecycle. It must not collide with or impersonate the current
device. No public install command, release binary or proxy toggle is supplied.

[yinzara/esphome-linux](https://github.com/yinzara/esphome-linux) is another
source lead, but its inspected README describes scanning only and no
authentication/encryption. It is not equivalent to an authenticated active
proxy and is not a deployment alternative for this monitor.

## What would permit the next hardware step

First establish the **exact board revision, BT UART and BT_REG_ON wiring**
from a matching schematic or physical board tracing. Confirm that the route
does not overlap the sensor ports or live FIQ console. Then review the
matching vendor H5/firmware configuration and define a bounded attach/restore
procedure before touching the running device.

Only a proven controller route justifies running and qualifying a host
backend on CGS1. The candidate above avoids assuming the whole protocol must
be written from scratch; it still needs authenticated proxy transport,
advertisement delivery, active GATT
connections, subscription/disconnection handling and recovery. Enable/disable
must control that real backend and release its resources. A configuration
switch backed only by a boolean or passive scan would misrepresent support.

For now, keep the CGS1 proxy unavailable. The concrete blocker is the
revision-specific physical controller route, followed by target-kernel and
backend lifecycle qualification. If no matching public schematic can be
obtained, the next evidence is exact-revision PCB photography and continuity
tracing with the board unpowered, not a trial attachment to a live sensor
UART. This is not a claim that no CGS1 board could ever support Bluetooth.
