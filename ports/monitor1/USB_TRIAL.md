# Experimental Monitor 1 USB trial

This engineering entry point applies only to a **fresh stock CGS1**, after
capture, a matched candidate build, disabled staging and disabled script
commit in [INITIAL_INSTALL.md](INITIAL_INSTALL.md). It does not upgrade an
existing installation or complete permanent activation.

Two USB locations are requested: the computer or the Home Assistant server,
using one installation engine and the same checks/receipts. This adapter
currently uses local ADB. Browser WebUSB and an HA OS USB companion still
need integration; neither is advertised as working. Lite's Bluetooth
transports stay separate. Subsequent ordinary updates use the network.

## Exact build and explicit trial

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

Source tests and an ARM/glibc link do not qualify vendor-kernel protections,
a fresh unit, PM/native return or cold boot. Permanent activation and the
two USB integration surfaces still need their own implementation/checks.
Monitor 2 and CGS1 Bluetooth support do not follow from this trial.
