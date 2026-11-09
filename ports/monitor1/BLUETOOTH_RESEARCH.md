# Bluetooth on CGS1: evidence and remaining blockers

Source review updated on 9 November 2026; hardware observations below remain
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

### Published driver transport and coexistence mailbox

A further source review on 7 November inspected
[the published wsyco driver at `14cedf3a`](https://github.com/wsyco/RTL8723DS_BT_Linux/tree/14cedf3a9fec1aa8c500fa52f3e3acc433cbcf08).
Its README's H5 example names `ttyUSB0`, but
[`hci_ldisc.c`](https://github.com/wsyco/RTL8723DS_BT_Linux/blob/14cedf3a9fec1aa8c500fa52f3e3acc433cbcf08/bluetooth_uart_driver/hci_ldisc.c#L527-L554)
registers `HCI_UART` with a tty parent. The example's device name is not
evidence of USB HCI on CGS1 or a Bluetooth route through its charging port.

The driver's
[`rtk_vendor_cmd_to_fw`](https://github.com/wsyco/RTL8723DS_BT_Linux/blob/14cedf3a9fec1aa8c500fa52f3e3acc433cbcf08/bluetooth_uart_driver/rtk_coex.c#L414-L476)
queues commands through an existing `btrtl_coex.hdev` and its HCI command
queue. That path uses an already established HCI device; it does not create
a Bluetooth transport through WLAN by itself.

There is a separate
[`H2C_BT_MP_OPER` WLAN firmware mailbox](https://github.com/wsyco/RTL8723DS_BT_Linux/blob/14cedf3a9fec1aa8c500fa52f3e3acc433cbcf08/hal/hal_btcoex.c#L558-L588).
Its reviewed operations include version/register/coexistence/AFH queries and
BLE scan type/parameter metadata (`0x2e` / `0x2d`). The
[scan metadata getters](https://github.com/wsyco/RTL8723DS_BT_Linux/blob/14cedf3a9fec1aa8c500fa52f3e3acc433cbcf08/hal/hal_btcoex.c#L2005-L2066)
also return their initialized zero value on failure or unsupported operation;
zero alone cannot prove successful communication, absent Bluetooth or an
actual scan state. `IsHwMailboxExist` is only a chip-type condition, not a
hardware liveness measurement.

The reviewed paths do not provide an advertisement/GATT transport. This is
an inference limited to this published implementation, not proof that every
other firmware route is impossible. These sources have not been matched to
the installed CGS1 driver bytes or ABI. No mailbox/IOCTL, attach, module,
GPIO or rfkill operation was executed; the revision-specific hardware route
remains unverified.

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

### Offline kernel checks establish compiled H4/H5 support

On 9 November, software-only inspection went beyond diagnostic strings in the
saved normal-boot `kernel.img` from the same 0267 archive. The image is
16,575,852 bytes, SHA-256
`2a061e5bc97a8fc5be48a4e7e657bc248e43501632ae90e5821bcb2c5d420ed5`.
Its `KRNL` header declares an uncompressed 16,575,840-byte kernel payload;
the remaining container bytes are an eight-byte header and four-byte trailer.
No kernel or vendor program was executed.

The reviewed pure kallsyms parser from
[`marin-m/vmlinux-to-elf` at `6aa8039a`](https://github.com/marin-m/vmlinux-to-elf/tree/6aa8039ae67ccc7f49d019d6b18d016f0cc4af80)
recovered 95,641 symbols. A separate local decoder independently checked all
names/types/addresses, all 374 name markers and the token-table bounds;
deliberately invalid count, token-index and marker inputs were refused.
The external GPL-3.0-or-later tool and vendor-derived symbol tables stay
outside this product's source and release assets.

Static ARM instruction decoding then verified these actual call edges:

- `hci_uart_init` calls `tty_register_ldisc`, `h4_init`, `h5_init` and
  `rtk_btcoex_init`.
- `h4_init` and `h5_init` each call `hci_uart_register_proto`.
- Their literal-pool pointers resolve to protocol descriptors with IDs 0
  and 2 respectively. All six callbacks in each descriptor match that
  protocol's open/close/flush/receive/enqueue/dequeue symbols.

This cross-check matters: `_stext` starts after the payload's boot header,
so treating `_stext` as the payload base decodes unrelated instructions.
The accepted mapping was checked against both branch targets and descriptor
pointers, rather than inferred from a plausible disassembly alone.

The saved rootfs also contains a 55,968-byte ARM32 `rtk_hciattach`, SHA-256
`1eee42abd998b845dbdc040b4fe6b35f5c3f2f72b47db1c8ada6982e13b42332`,
with Realtek H5 initialization diagnostics and an RTL8723DS firmware/config
entry. Both `rtl8723d_config` and `rtl8723ds_config` pass bounded structural
record parsing. File presence and strings do not select the correct helper,
baud rate, flow control, tty or board power pin; no helper was run.

**Conclusion:** this saved kernel contains an H4/H5 registration path, not
merely Bluetooth-related strings. It does not prove that initialization
succeeded, that the installed 0287 kernel is identical, or that a controller
is connected to an available UART. No embedded kernel configuration was
recovered, and no live device operation was performed.

Software tests can therefore remove specific uncertainties before physical
tracing. Existing UART/DT/pinmux ownership inventories should be reused, not
repeated as a new experiment. An exact installed-kernel comparison or matching
board-source evidence would be useful additional software evidence. A raw
TTY attach, rfkill write or vendor `--help` execution is not a read-only test
and does not follow from this result.

### Installed-kernel management API verified

On 9 November, a fixed software probe was actually run on one S8 CGS1 with
stock 4.1.8_0287. The running kernel accepted HCI CONTROL binding and all three
global management reads: version, supported commands and controller indices.
It returned API version 1 / revision 3, 38 commands, 21 events and **zero
registered controllers**. Three requests received three matching successful
responses. The socket was closed; no UART, GPIO, rfkill, controller command,
scan, module loading or controller-firmware download was used.

The original native UI/guardian pair, preferences and fresh sensor values were
independently verified after restoration. This is installed-kernel CONTROL
API evidence, beyond the archive analysis above. It is not an advertisement,
GATT, MONITOR/L2CAP qualification or a working proxy, and zero registered
controllers does not prove that Bluetooth hardware is absent.

The generic, non-default helper is
[`bluetooth_kernel_probe.h`](bluetooth_kernel_probe.h). It refuses an absent
base module, has only the three fixed global READ opcodes, validates lengths,
uses a 1.2-second deadline and caches one attempt per process. Its caller must
perform the existing exact appliance/quiet-stock admission first. It is not
enabled in ordinary profiles and supplies no proxy switch. The portable parser
test uses synthetic frames only and opens no host Bluetooth socket in CI.
The ABI basis is the original Linux v3.10
[`mgmt.h`](https://github.com/torvalds/linux/blob/v3.10/include/net/bluetooth/mgmt.h)
and
[`hci_sock.c`](https://github.com/torvalds/linux/blob/v3.10/net/bluetooth/hci_sock.c).

The first upload attempt failed locally because its uploader used an older
`aioesphomeapi` without `NoiseHandshake`; no image was transferred in that
attempt. The corrected process used the existing isolated CGS1 SDK and tested
the exact Noise constructor with synthetic data before another device mutation.
The shared Python environment was not upgraded. Keep uploader dependency
checks before changing device mode; never repeat an uncertain upload blindly.

### Storage during experiments

An OTA update stages one `program.ota.new`, validates it and renames it over
`program`; it does not create an archive of every bridge build. Interrupted
staging is separate from historical durable native/guardian pairs. Audit those
pairs before experiments, protect the working version and a deliberately kept
previous version, verify local backups, then use only the guarded exact-inode
cleanup for independently identified obsolete files. Preserve preferences,
logs and evidence. Do not equate a build directory on the development computer
with files actually installed on a monitor.

In this maintenance cycle, four obsolete program files from two audited older
pairs were removed and both retained pairs' hashes/inodes were unchanged. The
post-cleanup filesystem measurement was about 46.4 MiB available. Returning to
the original UI used a fresh RAM session, with no new durable release and no
additional Linux reboot. This is one device's measured result, not a universal
capacity guarantee or permission to delete an unaudited file.

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
the complete source/configuration has not been matched byte-for-byte to CGS1.
The three CONTROL queries above have now been verified on an installed kernel;
MONITOR, actual HCI transport, scanning and active GATT remain separate checks.

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
from revision-matched evidence. Software analysis can contribute a matching
board description, actual driver configuration and ownership evidence;
a matching schematic or physical board tracing may still be needed where
software cannot resolve the route. Confirm that the route
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
obtained and software evidence cannot resolve the route, exact-revision PCB
photography and continuity tracing with the board unpowered remain options.
Do not replace missing evidence with a trial attachment to a live sensor
UART. This is not a claim that software investigation is exhausted or that
no CGS1 board could ever support Bluetooth.
