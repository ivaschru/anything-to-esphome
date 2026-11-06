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
