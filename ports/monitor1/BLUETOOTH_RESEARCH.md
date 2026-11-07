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
Qingping board schematic. The archive-0267 wrapper's ARM control flow attempts
an rfkill0 write before inspecting its first argument, as detailed below.
Do not execute a vendor wrapper as a supposedly read-only help/version probe:
the only rfkill entry observed on the running devices identifies as WLAN.

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

### Static inspection of a factory-image copy

A further source was found through the technical links in the 4PDA topic:
[a CGS1 recovery report dated 4 June 2025](https://4pda.to/forum/index.php?showtopic=1095525&view=findpost&p=137394294)
links a [public archive mirror](https://cloud.mail.ru/public/HoLh/x8YZY3bXr).
On 7 November, its `snow-update.zip` was downloaded (82,610,566 bytes,
SHA-256 `76ab3408175768ea8421f7fe3cbf82e889f634df899f577d0a109b20f74c61e3`).
The nested `Snow4.1.8_0267.zip` has SHA-256
`9f9d1319b833d9ddd041e84eb52c8aec924010351f8c51bb8e757765bd7aa76f`.
This is a forum-published copy, not an independently authenticated vendor
release or an installation recommendation. No archive executable was run,
no image was mounted, and no monitor was contacted.

`resource.img` contains a 93,457-byte device tree at offset `0x2400`, SHA-256
`c967b534def089f996168f735cf2c0bde50cf986a70c05398ef0170d2bdd0942`.
A bounded FDT parser and an independent `dtc` read both accepted it; `dtc`
reported warnings, so this is parsing evidence rather than clean validation.
Its compatible strings are `rockchip,px3se-sdk` / `rockchip,rk3128`. All three
serial nodes at `0x20060000`, `0x20064000` and `0x20068000` are enabled;
the enabled FIQ debugger uses serial-id 1. The WLAN node names `rtl8723ds`,
but there is no Bluetooth node. WLAN power GPIOs are not a verified
BT_DIS#/BT_REG_ON mapping.

Read-only SquashFS inspection found `rkrtkbt ttyS0 &` commented out in
`S50_px3se_init`. The `rkrtkbt` ARM executable contains the generic rfkill0
write, default ttyS0 attachment and bluetoothd command strings; it was not
executed. The kernel image contains Linux 3.10.104, HCI UART and HCI socket
diagnostic strings. These do not establish a usable controller or safe UART
ownership. Vendor images and executables are not distributed here.

The 4,444-byte archive `rkrtkbt` has SHA-256
`9725473dbb9a347463bc04f28b04ae917b6e969d57d92fc962928bbc17fb68a6`.
Offline LLVM ARM disassembly places `main` at `0x107e0`. Its call to `system`
at `0x1081c` receives the string at `0x10988`, which writes `1` to
`/sys/class/rfkill/rfkill0/state`. The first `argv[1]` null test is later,
at `0x10838` / `0x1083c`; no help/version option parser precedes that call.
A non-null argument is then inserted into the `hciattach_rtk` command;
the no-argument branch selects `ttyS0`. ELF load segments independently
resolve these string addresses. This establishes static call order, not
a successful rfkill write, working HCI or the behavior of a different binary.
The installed 0287 wrapper has not been compared byte-for-byte with this ELF.

The complete 6,850-path listing of this rootfs contains `usr/bin/hciattach`
and `usr/sbin/rtk_hciattach`, but no basename `hciattach_rtk`. Keep the names
distinct: this archive does not establish that the wrapper's attachment
command can resolve, or that another helper is a safe substitute. The result
is scoped to this image's listing, not the complete live PATH of every CGS1.
No helper was executed or renamed to test the recipe.

The image is labelled 0267, while the inventoried devices run 0287. It has
not been matched byte-for-byte to their current device trees or qualified
for either PCB revision. It adds a reproducible factory-image source, but
still supplies no proven Bluetooth net continuity or attach procedure.

#### Recovery contains an unqualified Bluetooth configuration

Continuing the same archive inspection found a **different** DTB inside
`recovery.img`: offset `0x53c800`, 92,259 bytes, SHA-256
`94875f7fc57ab54207dfa5823fa199fdc350cf29ba262db98d45199f3c356383`.
It is within the Android second section's RSCE resource; independent `dtc`
reading succeeded with warnings. This tree has an enabled
`wireless-bluetooth` / `bluetooth-platdata` node and `keep_bt_power_on`.
Resolving its provider phandle gives gpio3 lines 21, 26 and 22 for the
power, wake and host-wake IRQ properties respectively, all active-high.
These are **recovery configuration values, not verified CGS1 board pins**.

The same power/wake/IRQ assignment (GPIO3 C5 / D2 / C6) is present in
[Rockchip's generic PX3SE reference DTS](https://github.com/rockchip-linux/kernel/blob/6c04d006ae881944d32c19e68b992d0bd5ab4fde/arch/arm/boot/dts/px3se-sdk.dts#L98-L110)
and its `px3se-android-sdk.dts`. The reference's UART0 RTS configuration is
commented out; it does not establish the CGS1 UART. Matching these defaults
does not establish their physical continuity on a Snow PCB.

The recovery tree has 583 nodes versus 594 in the normal resource tree.
Their differences also cover PM/CO2/SCD40, audio, display, battery and
regulator configuration. Do not transplant this recovery tree or boot it as
a Bluetooth experiment on a working monitor. The normal-tree observation
above remains scoped to `resource.img`; it is not an assertion that every
DTB in the archive lacks Bluetooth configuration.

This provides concrete reference values for further source/board tracing,
but no controller has been attached and no GPIO has been changed. The
revision-specific UART and BT power route still need verification before
any live attach, driver or power action.

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
