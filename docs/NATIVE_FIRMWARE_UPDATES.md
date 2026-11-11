# Firmware updates without Qingping HACS

The `lite` (original 4.5.8 / HW0001) firmware 5 and `lite-434` (original
4.3.4 / HW0001) firmware 4 add a **native ESPHome firmware update entity**.
Home Assistant's ordinary ESPHome integration displays it in **Settings →
System → Updates**. Neither Qingping HACS nor ESPHome Device Builder is needed
for this path after the one-time upgrade to a firmware containing the updater.
This does not add an update backend to Monitor 1, external-MCU Lite or Monitor 2.

## Use

Keep the existing ESPHome integration and its device encryption key. The device
checks its own profile's public manifest one minute after boot and every six
hours. A manual entity refresh requests a check. Checking never installs.
An administrator chooses **Install** in HA and connects the monitor to USB.
The device shows the same progress screen as its encrypted local OTA transport.
Missing Internet/catalog access leaves sensors and the last running firmware
operational; no reboot, automatic installation or downgrade is scheduled.

Older installed firmware needs one initial upgrade using the existing encrypted
APP updater. Replacing HACS alone cannot add executable code to an old device.
No manual key/profile export is needed for subsequent native updates. Existing
HACS versions may retain their older firmware entity; the source-side HACS
handoff suppresses its duplicate offer after authenticated native capability
discovery, without deleting historical records or user entity preferences.

## Preserving the device

The GitHub image remains a public **template**, never a boot-ready personalized
download. The device takes its current node name, Noise key, active Wi-Fi/AP,
OTA password, original-stock provenance and optional HA display-feed entity
from its own runtime. It replaces only the established fixed slots while
streaming into the inactive APP partition, with bounded memory.

The original complete download SHA-256, ESP32 segment layout, every original
marker byte, fixed node-name length and all field bounds must match. App XOR
checksum and appended SHA-256 are rebuilt for the personalized image. Only
after complete original-byte verification and another USB check does the IDF
APP backend validate and activate the new image. The running APP, partition
table, bootloader and existing preference namespaces are not rewritten.
Settings retain their existing ESPHome IDs and persistence. The stream is
byte-equivalent to the existing Python personalizer, without the stock-only
CRC transport trailer used by Qingping's original installer.

The updater's reference markers are XOR encoded and read through volatile
loads. This prevents the initial HA personalizer from accidentally replacing
the updater's own reference copy. Encoded markers are public data, not a way
of protecting secrets. Keys are never sent to GitHub or written into the
update journal, manifest, entity state or diagnostic logs.

## Authorization, failures and recovery

Only a native INSTALL request starts a transfer. Standard HA `update.install`
is administrator-only. The ESPHome Noise connection authenticates the calling
controller; a device cannot independently identify an HA user. HTTPS server
certificate verification is enabled; plaintext, redirects and caller-selected
URLs are refused. Profile, hardware/provenance and both increasing counters
must match. A credential editor/network trial cannot be interrupted by OTA.

A small value-free `qf_native/attempt` NVS record stores a monotonically
increasing attempt number, target internal revision, profile and phase. This
is the only new preference namespace. It is committed and read back before
the first flash operation; write failure prevents the transfer and never
erases NVS. A known pre-activation abort permits a new explicit install click.
A reset/lost outcome in the old firmware fences replay. Booting the exact
target reconciles activation; it does not claim external sensor health QA.
An unresolved attempt requires review through the existing encrypted recovery
route, not a reset/retry/automatic rollback button.

## Publishing

The existing independent firmware-only publisher now puts `native-lite.json`
or `native-lite-434.json` in the same atomic Git transaction as its immutable
`firmware-<profile>-vN` public image/manifest tag and CAS catalog update. Both
Lite and Monitor 1 publishers preserve the other native endpoint byte for byte.
The native manifest binds its exact profile-local version, SHA, size and patch
offset table; publication reproduces that table from the original app bytes.

Native URLs are fixed to
`https://raw.githubusercontent.com/ivaschru/qingping-esphome/firmware-catalog/native-<profile>.json`.
An image URL is derived locally from its immutable profile/version tag, never
accepted as an arbitrary manifest-selected destination.

Keep this original repository name in native manifests after the rename to
`anything-to-esphome`: installed Lite firmware compares the complete URL, not
just the host or final GitHub destination. The ordinary HACS index can use the
new name. Both URLs must deliver the same immutable bytes without a redirect.

The initial post-rename Lite6/lite-434v5 native sidecars used the new name.
Their immutable tags and app bytes are preserved. The dedicated
`--repair-native-url --publish` action corrects only the live native endpoint
through a separate consumed intent and catalog CAS. It verifies the original
tag, complete patch/SHA/version contract and known URL-alias-only change;
the ordinary index and every other endpoint are retained. An already repaired
endpoint reconciles read-only. Do not overwrite a tag, rebuild under the same
version or weaken firmware URL checks to repair this publication error.

For first-time hardware qualification, `--stage-native` creates that same
immutable tag/native endpoint but retains the previous ordinary HACS index.
Only the explicitly installed private qualification firmware can consume the
new route at this stage. After physical review, `--publish` promotes the same
unchanged app/tag pair in a separate CAS transaction. Both actions have their
own consumed intent; lost replies require readback, never an automatic replay.

## Verification boundary

Run `python -m unittest discover -s tests -p 'test_native_update*.py' -v`, the
firmware/HA suites, both pinned ESPHome builds and profile-wire checks. The
C++ stream tests use ASan/UBSan, arbitrary chunk boundaries and compare actual
public app bytes against the canonical Python personalizer. Git fixtures
exercise real atomic publication/CAS and preservation of the other endpoint.
These software checks do not substitute for a physical native OTA followed by
fresh identity, retained settings and repeated physical CO₂/raw T/raw RH checks.

## Unpromoted qualification candidates

The immutable firmware-lite-v3 and firmware-lite-434-v2 tags were staged for
first native qualification, but were not promoted into the ordinary firmware
index. The physical test found certificate-verification MPI allocation failure
on the non-PSRAM ESP32. TLS verification stayed enabled and no native INSTALL
was sent. Keep these historical tags unchanged; they are not qualified releases.
The qualified releases use dynamic TLS buffers, retain 16 KiB incoming record
support and reduce the outgoing buffer to 1 KiB. Native state is also published
at setup so installed firmware remains visible during catalog failures.

The downloader continues the SAME verified HTTP stream after IDF's transient
`-ESP_ERR_HTTP_EAGAIN` (observed after 622592 bytes on the qualification device).
It permits two consecutive waits, at most 45 seconds idle and 300 seconds total.
A positive chunk resets only the idle budget; no HTTP request, image hash,
flash position or INSTALL is replayed. Other errors still abort before activation.
The diagnostic entity reports bounded phase/read/received numbers without secrets.
Earlier staged Lite 3/4 and lite-434 2/3 remain unpromoted immutable artifacts.
