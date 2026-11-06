# Experimental Monitor 1 USB trial

These engineering entry points apply only to a **fresh stock CGS1** with a
capture and matched private candidate/plan from [INITIAL_INSTALL.md](INITIAL_INSTALL.md).
The individual trial requires completed disabled staging and script commit;
the prepared sequence below composes those existing steps. Neither upgrades
an existing installation or completes permanent activation.

Two USB locations are requested: the computer or the Home Assistant server,
using one installation engine and the same checks/receipts. This adapter
currently uses local ADB. Browser WebUSB and an HA OS USB companion still
need integration; neither is advertised as working. Lite's Bluetooth
transports stay separate. Subsequent ordinary updates use the network.

## Prepared stage, commit and trial in one sequence

`stage_commit_trial_adb.py` joins the existing three operations for a fresh,
already prepared private plan. It verifies the matched initial guardian and
private profile before the first staging write. There is no additional
guardian, retry policy or aggregate write intent: each actual operation keeps
its existing durable receipt, live scope checks and independent device timer.

```sh
ports/monitor1/.venv/bin/python ports/monitor1/stage_commit_trial_adb.py \
  --serial "$USB_SERIAL" \
  --plan-directory "$PRIVATE_PLAN_DIRECTORY" \
  --expected-plan-sha256 "$PLAN_SHA256" \
  --candidate "$PRIVATE_CANDIDATE_DIRECTORY" \
  --profile "$PRIVATE_PROFILE" \
  --stage-commit-trial
```

Any previous operation receipt, interrupted `.next` update or receipt link
refuses the sequence before USB work. A failed/unknown step stops the sequence
without running the next writer or an automatic rollback. Do not invoke it
after executing any of the individual stages. Use the same command with
`--status`, without candidate/profile/write flags, for read-only reconciliation.
Status selects the current disabled collector after a script commit instead
of incorrectly expecting factory scripts. It never resumes a write.
A later explicit rollback selects a current disabled-scope observation
instead of presenting an older trial receipt as the latest device state.

The successful outcome is `disabled_sequence_trial_observed`, with installed,
activated and installation_ready still false. Permanent activation, the two
GUI USB transports and fresh-device qualification remain unfinished. This is
a local ADB engineering entry, not an enabled companion HTTP/GUI write route.

## Exact build and explicit trial

The next-boot arming entry below is separate from the trial. Do not call it
instead of, or during, an incomplete/ambiguous trial.

Build a committed source containing initial_bridge_trial_main.cpp through
[BUILD_CANDIDATE.md](BUILD_CANDIDATE.md). The result now records a separate
initial-trial-guardian-program under result.json.initial_trial_guardian,
outside the three ordinary runtime artifacts. Rebuild an old candidate;
never add a guardian spec to its immutable manifest by hand.

The shell variables below stand for your actual selected serial and existing
private plan, candidate and profile. No key is passed through argv or env.
Do not substitute a compile fixture for a physical USB capture.

```sh
ports/monitor1/.venv/bin/python ports/monitor1/trial_initial_bridge_adb.py \
  --serial "$USB_SERIAL" \
  --plan-directory "$PRIVATE_PLAN_DIRECTORY" \
  --expected-plan-sha256 "$PLAN_SHA256" \
  --candidate "$PRIVATE_CANDIDATE_DIRECTORY" \
  --profile "$PRIVATE_PROFILE" \
  --trial
```

An exclusive fsynced host receipt consumes the attempt before any RAM write
or upload. The actual guardian validates its self-image, committed-disabled
scope and stock session, claims one device intent, and owns one kernel child.
Both persistent opt-outs stay set. The existing fixed 60/5/5-second stop loop
does no ADB, API, hashing or blocking output. Host disconnection cannot extend
it. The host independently checks child image/socket ownership and Noise
identity and requires at least two fresh physical sensor update sets.
An early clean exit is not a successful trial.

Only exact normal reap, recent samples and unchanged stock/vendor/flags
record bounded_trial_stopped_observed. installed, activated and
installation_ready remain false. This is experimental observation, not
vendor-kernel qualification or permanent installation.

## Ambiguous result

Use the same serial, plan directory and expected digest with --status,
omitting --candidate/--profile/--trial. It reads the original receipt and exact
original USB/device/boot/root/flags. It never relaunches, deletes receipts or
intents, adopts a PID, prunes history or activates the installation. Lost ACK
does not authorize repeating --trial. Preserve unknown/changed ADB mappings
and recovery material. Host cleanup signals only its own local ADB process;
the device guardian owns its child.

Local ADB retirement and exact owned-forward cleanup are independent. If
the bounded local TERM/KILL waits fail, the private receipt records
`local_adb_cleanup=cleanup_unverified` and still reconciles the acknowledged
serial/endpoint-owned forward. The original consumed trial outcome remains;
an uncertain cleanup never authorizes a new launch. Changed or unknown
forward mappings are preserved. Raw subprocess errors are not stored.

Source tests and an ARM/glibc link do not qualify vendor-kernel protections,
a fresh unit, PM/native return or cold boot. Permanent activation and the
two USB integration surfaces still need their own implementation/checks.
Monitor 2 and CGS1 Bluetooth support do not follow from this trial.

## Bridge-only autostart for the next boot

`arm_bridge_next_boot_adb.py` is an experimental source step after a successful
bounded trial. It requires the exact terminal trial/commit receipts, current
USB/boot/root/vendor/program/stock scope, no remaining own RAM process and
no full/Wi-Fi/persistent preferences store. It verifies executable modes as
well as bytes. This is not a command for an existing ordinary installation.

```sh
ports/monitor1/.venv/bin/python ports/monitor1/arm_bridge_next_boot_adb.py \
  --serial "$USB_SERIAL" \
  --plan-directory "$PRIVATE_PLAN_DIRECTORY" \
  --expected-plan-sha256 "$PLAN_SHA256" \
  --arm-next-boot
```

A durable exclusive host receipt precedes the write. The command first
creates and syncs the private empty `disabled.before-next-boot` recovery flag,
then rechecks the full scope and removes only the verified empty bridge
`disabled` opt-out. `pm-helper.disabled` stays present. It does not launch
the bridge, preload the helper, touch sensors/Wi-Fi, signal a PID or reboot.
The already committed stock hook can start the bridge on a later normal boot.

An interruption before unlink leaves the bridge disabled; after unlink its
next-boot autostart may be armed. Lost ACK never authorizes resending the
write. A matching on-device completion record, written after the last flag
effect, is required before disarm or a terminal state claim. A timeout or
flag read alone cannot prove that an old writer will not change it later.
Unknown completion stays read-only; history and recovery are preserved.
Use the same command with `--status` for independent readback. A
common prepared-sequence `--status` also delegates to this newer state. A
separate `--disarm-before-boot` can restore the empty bridge opt-out while
the original boot is still idle; it keeps the recovery flag and all receipts.
It refuses after a boot change or when code is running, rather than adopting
or killing a device process. No automatic rollback or retry is provided.

The successful source outcome is `bridge_autostart_armed_next_boot_unverified`.
`installed`, `activated` and `installation_ready` remain false. After an actual
boot, status requires separate authenticated runtime verification and never
reuses old process identities. The new arming/disarm writes and first boot
have not been run on a physical monitor. A full installation still needs
runtime/PM/native activation, GUI integration and fresh-device qualification.

## Read an already booted bridge without starting it

`verify_bridge_boot_adb.py` is a separate read-only engineering observer for
the ordinary boot after bridge-only arming. It never performs that boot or
starts/stops/repairs a program. Keep the original private plan and exact
API profile; disarm/partial history refuses observation. The old boot must
have changed. Use a fresh fixed-name report in an existing private ignored
directory; an older report is preserved rather than overwritten.

```sh
ports/monitor1/.venv/bin/python ports/monitor1/verify_bridge_boot_adb.py \
  --serial "$USB_SERIAL" \
  --plan-directory "$PRIVATE_PLAN_DIRECTORY" \
  --expected-plan-sha256 "$PLAN_SHA256" \
  --profile "$PRIVATE_PROFILE" \
  --report "$PRIVATE_OBSERVATION_DIRECTORY/bridge-boot-observation.json"
```

It reads current kernel process births, parent relationships and actual
images, fixed root/vendor/program/flag pins, the private boot lock and
API/OTA socket ownership. PID files are only hints cross-checked against
the live kernel; they grant no signal or launch authority. The stock app
must still be running without the PM helper. A separate loopback-only,
no-rebind ADB forward carries the existing authenticated Noise API. Exact
node/MAC and two different fresh generations of CO2/T/RH/stock tVOC plus
stock response age are required. A changed process/boot or stale final
sample invalidates the observation, without adopting a replacement PID.

Only local observation files and that own host forward can change. The
forward is removed only after an acknowledged creation and an exact current
serial/endpoint ownership check; ambiguous or changed mappings are preserved.
Fixed phase/cleanup fields are saved instead of raw ADB/API errors or keys.
The source outcome `post_boot_bridge_observed` describes that current read,
not cold-power testing, full/native/PM activation or hardware qualification.
All installation/readiness flags remain false. This observer has not been
run on a physical monitor and does not enable either GUI installation route.
