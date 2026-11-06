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

**Copying these files is not a complete installation.** An initial installer
also needs independently verified stock files, a private recoverable backup,
the matched Qt helper, exact startup/watchdog patches, identity/CAS checks,
bounded activation and a verified stock fallback. None is bypassed by the
presence of a compiled candidate or a launcher source file.

The inspected stock startup applies a recursive `chmod` to `/data/*`. The
existing installation uses a hidden private directory and a reviewed hook;
do not move it into that glob or expose credential-bearing binaries. A new
installer must reproduce the approved startup bytes or use a separately
reviewed source revision and fingerprint. A hash is not the missing source;
do not guess a similar-looking startup patch or broaden the runtime whitelist.

Vendor startup/watchdog programs, private device backups and generated ELF
files are not distributed here. These scripts have not been newly installed
or run by the public build controller. Their source hashes and shell syntax
are checked separately from hardware installation/boot QA.
