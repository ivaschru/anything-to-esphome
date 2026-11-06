# Bootstrap source boundaries

These two neutral source files match the exact fingerprints already compiled
into `StockInspection` in `network_preflight.h`:

| Installed path | SHA-256 |
| --- | --- |
| `/data/.esphome-cgs1/launch.sh` | `0e3b041b629cf24f1be8327df858913bd7f6f37164013b52cb1d9ef232ad4117` |
| `/data/.esphome-cgs1/SnowApp-with-PM` | `c1a1700e5172e7a9f415b947ad9b3e852e2d3ec2ca770315894a3b9e7866530a` |

The bridge supervisor owns only its program/lock/preferences, permits three
launch failures per boot and has a persistent opt-out. It never stops vendor
acquisition, networking or the watchdog. The optional PM wrapper permits one
extended SnowApp launch per boot; any exit persistently disables the extension
and returns immediately to the original application. Its process name is part
of the watchdog compatibility mechanism. Do not casually rename it.

The exact 298-byte `startup-hook.sh` fragment has also been recovered from
the original installation source. It is appended verbatim to the verified
factory startup; it is not a replacement vendor script. Its SHA-256 is
`42ffeb1329a9185431ba2f7006d0e64ac87214967ab6e0c30f276bb63665314e`.
The watchdog recipe replaces exactly one original SnowApp launch line with
the wrapper path. [bootstrap_patches.py](../bootstrap_patches.py) accepts only
the exact factory inputs and verifies both complete output digests:

| Script | Factory SHA-256 | Installed SHA-256 |
| --- | --- | --- |
| startup | `c38d532b44f02922aa850c247f0ddd227265c7873a35a20e9ac71ac21b9627e6` | `f104f873dd3ce4544d5f3e3f90a4056bffc811bcaae037e347306e1084e7f1d1` |
| watchdog | `07b61bb67ff58a97e0f92de5b8bf0a94ca106e27ba3afa50f322817b8896dad7` | `1d74ef0946734e1ddf9e76301012f9ed66d7b38d9d7a0239a5d0e80acabf2cce` |

Both transformations were checked against the retained verified factory
backup. Complete output bytes match the fingerprints of the earlier actual
installation. This is source reconstruction proof, not a new device install.

**Copying these files is not a complete installation.** The
[initial-install preparation](../INITIAL_INSTALL.md) now has fixed-file
read-only capture and local exact patch generation. It still needs a matched
Qt helper, device write/CAS/backup handling, bounded activation and a verified
stock fallback. Compiling or preparing a patch does not bypass those stages.

The inspected stock startup applies a recursive `chmod` to `/data/*`. The
existing installation uses a hidden private directory and the reviewed hook;
do not move it into that glob or expose credential-bearing binaries. The
preparer reproduces the approved startup bytes without changing the runtime
whitelist. Other factory/installed revisions require separate review; never
silently substitute a similar-looking patch or broaden the gate.

Vendor startup/watchdog programs, private device backups and generated ELF
files are not distributed here. These scripts have not been newly installed
or run by the public build controller. Their source hashes and shell syntax
are checked separately from hardware installation/boot QA.
