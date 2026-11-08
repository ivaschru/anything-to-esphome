# Qingping ESPHome

Public home for three distinct device families: Lite/CGDN1, Monitor 1/CGS1,
and Monitor 2. Firmware profiles and their installation transports remain
separate even though the HACS wizard is shared.

- Monitor 1's new HACS jobs use the integrated admin Core adapter without
  requiring a Supervisor USB app. Preserve old app jobs/keys/history in place.
  Child workers verify creator-selected private cwd and per-job profile/toolset
  pins; no HTTP host/path/environment or shared5037 fallback is admitted.
  The Core integration never inherits credentials into tools or SDK children.
  Full native UI/physical initial-install qualification stay independent.

- `monitor1-core-probe.yml` checks the unmodified official Core 2026.11.0
  images on disposable native amd64/aarch64 CI runners. Override the image
  entrypoint: no running HA, host /config, USB/device mapping, credentials,
  Docker socket or Mac VM. Keep one CPU/2GiB and private scratch; publish
  only the allowlisted capability JSON, never the synthetic ELF or SDK.
  Missing tools and SDK results are separate. A synthetic ARM32 compile
  never enables a HACS backend, installer, full UI or hardware readiness.

- `apps/monitor1_usb` provides read-only computer WebUSB/server USB preparation
  and a separately reviewed experimental native server USB bridge installer.
  Computer macOS/Linux ADB writes are experimental; browser-only WebUSB
  writes and fresh full native UI qualification are unfinished. Generate
  both fixed contracts from preflight_adb.py and rebuild
  the offline Tango bundle with tools/monitor1-usb; preserve exact lock/MIT
  notices and the source check in CI. No generic shell/setup/push/activation
  endpoint, LAN ADB, host networking or full-access privilege is permitted.
  Require the actual Supervisor ingress peer/user and owner-bound page nonce;
  use native admin ingress on HA2026.11+. Never log headers/raw exceptions or
  persist browser authorization keys. Selection/cleanup stay bounded; a late
  USB handle must close instead of being adopted. Read-only rediscovery is
  separate from permanently consumed install/launch/prune/reboot receipts.
  Do not promote this probe or its synthetic/container tests into hardware
  qualification or change CGS1 installation_ready/source_only from them.
  New HACS USB jobs run in the integrated Core wizard. The legacy app retains
  its own actual Supervisor ingress guards; never fake those headers or silently
  migrate/adopt old jobs. No Supervisor app is automatically installed/started.
  The capture action reads only the nine generated preflight files, verifies
  local byte counts/SHA and rechecks source/identity after copying. Keep the
  archive private, fixed-member USTAR with 0600 files/0700 directories, never
  a public firmware asset or full-NAND claim. Server temporary copies vanish
  and the global USB lease covers delivery. Browser RECV stays bounded and
  memory-only; it must not invent native get-devpath or native-plan authority.

- BrowserNativeChannel is a live read/API WebUSB transport primitive, not a
  writer or native get-devpath substitute. Keep the original synchronous
  picker, RAM-only credentials, one actual selected handle and an unpredictable
  channel nonce. Reports cannot reopen/adopt a connection. Recheck fixed
  stock/identity/boot before handoff; only the fixed device tcp:6053 socket is
  available one at a time, with bounded IO and independent owned cleanup.
  A new read socket needs positively acknowledged old-socket closure; a lost
  open/close ACK retires the channel. No writer permission follows. No generic
  shell/push/launch or HTTP transport adoption. A future Core relay must bound
  encrypted stream traffic and join its separate browser plan/consumed intent
  before any writer can use this primitive. Run test_usb_native_channel.mjs;
  synthetic transports do not qualify physical USB, installation or firmware.
  BrowserApiRelay is likewise unwired: one kernel-owned loopback listener,
  one active USB stream, fixed 240s/16-open/8MiB budgets and independent owned
  teardown. It never accepts a remote host/port/key or parses Noise payloads.
  A lost open/close ACK fences the channel before another local connection;
  normal acknowledged closure permits read reconnect only. Test its actual
  loopback byte pumps with test_usb_browser_relay.py. Parent/browser framing,
  typed plan authority and writer admission are still separate missing work.
  BrowserChannel/BrowserChannelPeer provide finite API-only frames: server-made
  consumed request IDs, two pending read/write frames, 64KiB canonical chunks,
  no generic command or retry. A cancelled pure read survives only until the
  positively acknowledged API-close; its one late answer never satisfies a
  later request. Cancellation/unknown delivery of a byte write fences the
  channel. Preserve actual loopback/framing and concurrent read/close EOF
  tests. The admin adapter now provides owner/page-nonce-bound ephemeral
  registration/poll/answer/retire only. Mirror page authorization solely from
  successful private worker responses; check it before frame-body reads. Frame
  IO bypasses the worker reservation, while the parent grants only two finite
  poll/answer/close requests alongside a pending ordinary operation, never a
  second writer or transport registration. Reports remain context_only and
  writer_enabled=false; no plan authority follows from JSON. GUI installation,
  browser staging and writer admission remain unwired. Run all USB tests
  on the actual HA SDK and Node peer/control/parent tests before changing this
  exception. Preserve ordinary native operation serialization.
  BrowserStageFileSink is used only by the fixed StageSession/NativeChannel
  adapter and finite private Core stage frames. No public initiating HTTP route
  or GUI writer exposes it. The private caller must consume its write intent, recheck live scope/ext4 and
  create the exact root with both opt-outs BEFORE constructing it. Descriptor
  hashes are byte context, not proof of those prerequisites. Only the nine
  canonical staging roles under the fixed disabled root, ordered private 0600
  writes, <=64KiB chunks, <=16MiB file and <=32MiB total are admitted. Hash the
  full bounded file before opening SYNC. Use the pinned adbSyncPushV1 with an
  owned AdbSyncSocket; never AdbSync.write's Android mkdir workaround, SND2,
  compression, caller paths, chmod or execution. A wire OKAY is not a remote
  SHA/metadata check. Lost ACK or close retires the transport without retry.
  Run test_usb_stage_files.mjs and, after exact npm ci, the actual Tango
  test_usb_stage_sync_v1.mjs in usb-companion CI. Synthetic wire/ACKs do not
  qualify the monitor filesystem, create an install route or authorize a
  vendor commit, trial, launch or boot change.
  browser_stage.py is a private journal/packet engine, not an HTTP writer.
  Its internal actor handoff consumes an owner/plan/channel intent before returning
  the nine private bodies once, rehashes the same no-follow private FD, and
  records only exact remote file/source/opt-out/AFTER-effects plus closed-
  transport proof. An issued/lost packet is write-unverified, never zero-write
  or replay authority. Hold the shared native-install kernel flock from packet
  preparation until exact terminal proof and acknowledged transport closure.
  Native initial/PM/full-trial/permanent writers fence uncertain browser history
  under that same lock; a crash-released FD is no retry permission. Orphan or
  malformed completion is not empty history. Computer exports refuse consumed
  browser jobs. Internal stage context/packet/record operations never start ADB
  and stay on the private actor pipe; HTTP rejects them before body reads and
  never forwards their credential-bearing MIME. Actor shutdown closes only its
  own host FD, preserving all history. The actual channel/frame coordinator is
  uses the private Core coordinator: JSON scope alone cannot grant device authority.
  The fixed stage-admission peer read returns only fresh factory
  evidence and measured ext4 free blocks; no allocation or root is created.
  Run test_usb_browser_stage.py and the registry/NativeChannel/peer admission
  tests. These fixtures are not device readback or an enabled browser installer.
  BrowserStageSession now composes the fixed disabled-root engine, but is
  exposed only through finite private channel/frame methods, not a public
  initiating HTTP route. It creates both opt-outs
  before file writes, precreates once, independently rechecks remote SHA/UID/
  nlink/mode after SYNC, verifies original sources and records AFTER-effects
  only after all writes. A positive result requires the actual owned close ACK.
  The frozen initial guardian permits only its exact payload/flags/intent in
  /data/.esphome-cgs1: NEVER add browser journal files there or relax that gate.
  Browser-only metadata belongs in the separate fixed private
  /data/.esphome-cgs1-stage sidecar (no executables), preserved on interruption.
  Marker guards hash exact bytes/newlines and preserve failed substitution
  status. Preserve original source53/C++ guards without a firmware rebuild.
  Run test_usb_stage_session.mjs and the explicit Linux/root rewritten-only
  test_monitor1_browser_stage_root.py fixture; never execute its production
  commands locally. Root fixture QA does not qualify an untouched monitor.
  Fixed source/remote digest observations accept the exact one- or two-space
  text delimiter from sha256sum, with the full expected digest/path and stat
  lines unchanged. Do not trim arbitrary fields or reject ordinary BusyBox/GNU
  output. Run test_usb_file_observation.mjs and the two-space probe/capture/
  channel/session regressions; rebuild the offline bundle after shared edits.
  The GUI may now use a fresh original-click channel for browser-review:
  the private actor rehashes its owned detached plan, then Core requests only
  the peer's fixed scope-check and compares exact original channel/target/boot
  before and after IO. No USB path, caller target, shell or writer is admitted.
  A successful read grants no cached write authority. The ordinary operation
  holds its reservation while finite frame IO progresses independently. Manual
  close callers share one cleanup/registry ACK; a normal pending poll must not
  turn acknowledged close into a failure. Lost close ACK remains unverified.
  Run test_usb_browser_review.py, positive real-HA HTTP review and shared DOM/
  peer/control tests; a synthetic frame answer is not physical USB proof.

- Native GUI installation composes the original stage/commit/bounded-trial
  engine and separate next-boot armer in a fixed private SDK child. Consume
  the exact owner/plan intent before spawn; require stopped trial, completed
  local ADB/forward cleanup and original device AFTER-effects proof before
  arming. Unknown durable history blocks new writes across restart. Never
  reboot, auto-rollback, replay a lost request or adopt a serialized PID.
  The separate read-only observer distinguishes same-boot idle arming from
  another boot with exact processes and fresh authenticated wire updates.
  Bind positive reconciliation to its original intent and proof bytes; keep
  cached history distinct from live health and preserve the original result.
  Native/guardian remain host-side; no full UI or HACS readiness follows.
  Explicit owner-only profile/original exports recheck private fixed files;
  no key in normal status, form state, browser storage, logs or public assets.
  Keep profile download opaque with fixed attachment name, MIME and bounds.
  Run all test_usb_*.py plus tests/test_usb_probe.mjs; synthetic browser and
  engine mocks do not qualify physical initial installation.

- Full UI review is read-only: fresh native USB/boot and bridge bytes, exact
  Noise identity/pair pins, then only status/inspect_start. Explain the known
  PM-extension prerequisite separately from unknown/busy state. Keep positive
  observations distinct from readiness/launch authority; both stay false.
  API close and acknowledged own-forward cleanup are independent and bounded.
  Never expose a generic action/host/path or enable a loader from a read.
  The same review is exported for computer USB. Test the API, USB lifetime,
  owner/lease/proof DTO and EN/RU/lost-state UI; no hardware QA follows.
  The separate full_runtime_launch_trial action selects a fixed 60s mode,
  never a network-selected duration. Its immutable FD plan V2 carries the
  bound to both existing device guardians; stricter compiled limits win.
  Permanent V1 bytes remain unchanged, old readers refuse V2, and no boot
  mode is enabled by a trial. Keep actual stock/PM/DRM/image/RAM admission.
  Run test_full_runtime_limit_plan.cpp on Linux; no host fixture qualifies
  the initial UI transition or lifts its PM-extension prerequisite.
  The separate owner-reviewed first-screen step consumes full-ui-trial intent
  before the fixed SDK child, uploads only the matched native/guardian pair
  and observes two live guardian generations plus physical core readiness and
  exact stock return. Unknown replies never repeat uploads/launch or enable
  permanent startup. Only an explicit core_display_repair_pending response
  permits bounded advancement of that same existing device admission state;
  a read-only status cannot advance the repair. API close and own-forward
  cleanup stay independent. Old source jobs retain their bytes/history and
  refuse this capability. Keep server/computer routes on the same coordinator,
  export its exact checked helper bodies, and make full-trial-status local
  only. The GUI restores status, not a writer; language keeps form state.
  Retain the trial's exact live Linux boot in its private proof for a later
  independent permanent step; never expose it as current public health.
  Run test_usb_full_ui*.py, test_usb_computer.py and test_usb_install.mjs.
  The separate permanent step requires a successful original trial AND human
  confirmation of screen/touch and persistent startup. Bind the consumed intent
  to exact owner/plan/source/trial bytes and that same private Linux boot before
  the fixed SDK child. Recheck actual USB, bridge bytes, returned pair and
  private-ext4 capacity before copying. Install the pair, enable boot, reset
  only that completed session and start once; no reboot/upload/prune/retry.
  Anchor the new device-generated boot job before observing the exact native
  pair, physical core readiness and two guardian generations. Unknown enable
  ACK stops; lost start ACK permits reads only. Cleanup is independent, and an
  uncertain permanent child fences every other device writer across restart.
  Computer full-activation-status is local receipt reading without USB or
  engines. GUI language changes preserve both separate confirmations; status
  cannot recreate a writer. Keep first-install qualification, PM-extension
  transition, browser writer and HA enrollment distinct from this operation.
  The initial PM next-boot guard/SDK child is a separate reviewed
  server/computer step. Its parent consumes an owner/plan/source
  intent before the fixed child. Reuse the original observer's fresh current
  bridge/stock scope and closed API/owned forward before any flag command.
  Create the exact RAM attempted marker FIRST to inhibit every stock restart
  in this boot, then back up and remove only pm-helper.disabled for next boot.
  Preserve owner lock, backup and AFTER-effects record forever; lost ACK may
  only read that record, never resume/retry or signal/reboot. Unknown PM
  history fences every other device writer. Run test_usb_pm_extension*.py and
  test_monitor1_pm_extension_guard.py on the explicit Linux/root rewritten
  tmpfs fixture. No production-path script, ARM ELF or hardware executes in
  a host test; tmpfs substitution never relaxes production ext4 admission.
  A stock wrapper mismatch alone is only a private candidate. After API/forward
  cleanup, the original exact disabled-stock observer must positively verify
  that same boot before the GUI may explain its initial PM prerequisite.
  After the PM step, computer trials require its bound completion, another
  boot and actual Full UI preflight; never weaken/reuse the old bridge-only
  observer whose PM opt-out is intentionally absent. Keep pm-status local-only.

- Native HA enrollment is a separate explicit Core-only step after the bound
  permanent Full UI receipt. Consume its owner/plan/source intent before the
  fixed read-only SDK child. Read only wlan0's current IPv4 over exact native
  USB; require the current boot, compiled pair, physical readiness and two
  fresh guardian generations, then independently repeat encrypted LAN checks.
  No caller host/port/key, scanner, monitor mutation or arbitrary command.
  Internal key-bearing MIME/operations stay on the private parent/actor pipe;
  HTTP refuses them before body IO and never forwards that MIME. Native HA's
  user/encryption_key flow is the sole entry writer; stop on migration,
  overwrite/password/unknown forms and pre-existing conflicts. Native HA owns
  same-MAC races; read back the exact entry and never force undo/replay it.
  Lost replies/status may inspect entries only, without USB/flow/receipt writes.
  Preserve consumed intents and original profiles across restart. Computer
  exports/legacy app still use manual native ESPHome addition; do not pretend
  their local activation receipt is a Core-owned USB job. Run all test_usb_*.py
  on both HA SDKs, including the actual ESPHome handler's step contract and
  positive admin HTTP key-isolation tests, plus Node USB/Core/i18n tests.
  Host tests remain separate from fresh-device hardware qualification.

- Computer export is an explicit owner-only bounded private bundle, not a
  public release asset. Include only pinned source/program/helper/profile
  bodies and the local entry/instructions, never an SDK/cache/old plan/history.
  Refuse consumed HA installations. The macOS/Linux CLI performs a NEW native
  capture with actual local get-devpath before planning; never relabel browser
  metadata. Reuse original engines/receipts, exact review and no-replay; do not
  reboot or silently configure a VM/compiler/remote ADB. Keep exported 0700/
  0600 metadata, opaque browser download and a 64MiB cap. Physical QA and a
  browser-only writer remain independent. Run tests/test_usb_computer.py.
  Keep the user walkthrough in apps/monitor1_usb/README.ru.md aligned with
  actual button/CLI names and the English reference. Separate build location,
  USB transport, bridge-only installation and unfinished Full UI qualification.
  Computer `local-status` reads fixed local receipts before engine imports,
  ADB discovery or server-environment changes. It recovers only a bound plan
  digest/historical result, never live health, zero-write proof or retry
  authority. Preserve partial history; all other commands still need USB serial.
  Run test_usb_local_status.py and the full USB suite after changing this path.

- Companion profile preparation creates an owner-bound private job and an
  immutable intent before generating a Noise key. Keep fixed USTAR input
  validation, fresh native/browser capture and live-recheck-required semantics.
  HTTP returns only redacted status/list metadata. Lost replies/reloads may
  read the same job, never POST again, rekey or auto-resume a partial intent.
  Preserve private 0600/0700 inputs and the eight-job limit without pruning
  keys/recovery/history. No compiler or GUI device writer is enabled by this
  profile step. Run tests/test_usb_preparation.py and the imported Node test.
- Companion private builds consume an owner-bound build intent before spawn,
  fetch only the exact reviewed public source commit and use the canonical
  build_candidate controller. Never accept source refs, commands, paths or
  environment from HTTP. One CPU/nice10, one global flock, 6GiB initial free,
  512MiB stop floor and a two-hour bound apply. Incomplete durable history
  blocks new builds even after restart; never adopt a serialized PID or retry.
  Retire only a creator-owned unreaped process group (Linux WNOWAIT). Keys,
  vendor inputs, logs and programs stay private; status is allowlisted and
  built_not_installed never changes readiness or enables a USB writer.
  CI checks the actual multiarch image SDK with public requirements and a
  synthetic ARM32 program, never private firmware/vendor Qt or hardware QA.
  New default source pins apply only to new builds. Preserve the exact
  historical intent/report/plan/computer-bundle source binding, keys, bytes
  and consumed history through the finite explicit reviewed-source set.
  Membership is not equality: reject cross-source joins even when both
  revisions are reviewed. A historical pending job is read-only/unverified,
  never a worker restart. The standalone loader cannot import a policy module
  before bundle verification; test its fixed set against the server's set.
  Run test_usb_source_binding.py and all test_usb_*.py after these changes.

- Companion offline plans recheck the built source closure before running
  canonical bootstrap_patches/prepare_install in that job's private SDK. Keep
  this native-capture-only; never fabricate get-devpath evidence for a browser
  archive. BrowserPlans has a separate detached schema2 with typed WebUSB
  target, exact profile/source/capture/bootstrap/payload and packaged-producer
  hashes. Its offline SDK child reuses only the frozen canonical read-only
  candidate/ELF/bootstrap auditors. Require a new owner-bound intent before
  this child, retain partial history, and never restart it after upgrade.
  A historical producer hash is readable, not permission to execute new code.
  Check original inputs and source both before preparation and on status.
  The Core-only browser-plan route needs no ADB service or live USB while
  building. Its distinct browser_plan_prepared state never reveals the native
  install control. A lost POST gets only status reconciliation; keep EN/RU
  forms/results and preserve native serialization. This is not browser writer
  admission: a future fresh live handle and separate consumed write intent
  must join this detached plan immediately before device IO. Run
  test_usb_browser_plan.py and test_usb_browser_plan.mjs, including the actual
  shared app DOM flow. Synthetic producer stubs never qualify ELF/hardware. Bind profile,
  target and payload hashes, fsync private files before completion, and retain
  partial/consumed plan history. Status/readback grants no USB write or replay.
  The displayed free-space request is not measured device capacity. Check
  tests/test_usb_plan.py and the bundled Node one-start/status-only contract.

- The experimental first bridge now has an executable composition:
  `initial_bridge_trial_main.cpp` plus `trial_initial_bridge_adb.py`. Keep
  creator-owned intent/fork, nonblocking child identity before gate release,
  the independent 60/5/5 stop loop, exact kernel image/socket ownership,
  authenticated fresh wire samples and normal reap. Host O_EXCL receipt is
  consumed before RAM writes; no failed/lost-ACK replay. A local cleanup may
  signal only its own ADB subprocess. Never expose a generic shell, adopt a
  device PID, remove history or infer permanent activation from trial success.
  Build the initial guardian separately and bind its actual candidate result;
  do not retrofit old manifests. See ports/monitor1/USB_TRIAL.md. The owner
  requested computer USB and HA-server USB as two transports of one engine;
  The native companion composes these engines experimentally; computer
  WebUSB writing and fresh hardware QA remain unfinished.
  Local ADB reap failures are recorded separately and must not skip exact
  owned-forward cleanup or mask the trial's consumed outcome. Never retry a
  launch because host cleanup is unverified or log raw subprocess errors.
  `stage_commit_trial_adb.py` composes the existing prepared-plan operations,
  checking trial prerequisites before staging. Keep every step's original
  receipt/collector; prior or partial history refuses the whole sequence.
  The engine itself adds no automatic resume/rollback or permanent activation.
  Its separate companion coordinator is explicitly reviewed and unqualified;
  a bounded sequence result never promotes installation_ready.
  `arm_bridge_next_boot_adb.py` is a separate unqualified bridge-only step
  after a terminal trial. It durably saves an empty recovery flag before
  unlinking only the bridge opt-out; PM stays disabled. No launch/reboot/PID
  adoption or hardware readiness follows. Disarm is explicit and same-boot
  idle only, preserves recovery/history, and never retries an ambiguous write.
  Require the matching on-device AFTER-effects completion record before a
  terminal claim/disarm; flag readback or USB timeout alone cannot exclude a
  late old writer. Preserve partial records and refuse further writes.
  `verify_bridge_boot_adb.py` only observes a distinct current boot: re-read
  process births/parents/images and listener ownership, then two fresh Noise
  wire generations. PID files/old trial samples grant no signal/launch or
  readiness authority. Retire pending reads and only the acknowledged exact
  owned host forward; keep ambiguous mappings and sanitize API/ADB errors.

- Bootstrap launchers and startup-hook.sh match the existing StockInspection
  fingerprints. `bootstrap_patches.py` reproduces both complete installed
  script digests from the exact private factory originals; no vendor scripts
  are distributed. Keep bytes/process names coupled to those gates. Syntax
  checks use sh -n, never execution of production-path scripts on a host.
  `preflight_adb.py` is an initial-install read-only USB capture, not an apply
  route: explicit WLAN/CO2, boot/transport and before/after fixed-file pins,
  private output, no INI/credential dump or arbitrary command. Old adbd needs
  the final shell completion sentinel as well as the host exit code. Existing
  installs are refused; do not use this tool to upgrade or prune them. These
  steps still need guarded write/CAS/activation and physical verification.
  `prepare_install.py` only assembles a private offline plan, rehashing capture,
  source/ELF/helper/patched scripts and exact profile binding. Keep live CAS
  required, installation_ready=false and the unconsumed intent; its requested
  free-space budget is not measured capacity. Do not manufacture a USB capture
  to promote a compile fixture into a target or installation result.
  `stage_install_adb.py` is experimental and not hardware qualified: explicit
  --stage creates only a new disabled own root, consumes/fsyncs one host intent
  before writing, checks actual ext4 headroom, pushes each file once and leaves
  vendor scripts unchanged. --status only reconciles; lost ACK never permits
  retry or receipt removal. No launch/preload/signal/boot/full activation. Keep
  this route outside HACS until independent staging/commit/rollback QA exists.
  Disabled vendor transitions live in the pure `disabled_commit_policy.py`:
  factory-only forward, separate exact partial rollback, both opt-outs, plan/
  inode/boot/USB/source/process fencing, one issue and independent readback.
  `review_disabled_install.py` is read-only and hardware unqualified. Require
  the actual successful stage receipt, complete fixed source/vendor hashes,
  unique live stock/watchdog scope and actual absent own code/PM mapping.
  Failed maps/userspace-exe inspection is never absence; generic argv/INI/env
  stay on-device. No writer/activation authority follows from a review or host
  fixture. HACS/source_only and all existing runtime gates remain unchanged.
  `commit_disabled_install.py` is an unqualified separate adapter: exact
  --commit-disabled/--rollback-disabled, direction-specific consumed/fsynced
  intent and permanent private marker, fresh whole-scope collector and inline
  checks, fixed copy/sh-n/SHA/sync/atomic rename, independent readback. Keep
  both opt-outs and recovery sources, no activation. Lost ACK never retries
  or auto-rolls back; rollback needs a matching prior own commit/remote marker.
  Preserve command-substitution exit status explicitly; PID output followed by
  a failed scan is not success. CI exercises only rewritten temporary paths as
  real Linux/root; never run production-path replacement commands on a host.
  `initial_bridge_trial_policy.py` is pure policy, not an executable guardian
  or activation route. Preserve both opt-outs, absent autostart/Wi-Fi/prefs
  stores and private RAM scope. A future device timer must own/reap only its
  kernel child with parent-death TERM and child-only OOM protection; never
  adopt a PID or reuse the retrying launcher. Fixed deadline, one TERM/KILL,
  recent exact authenticated wire updates and clean reap are independent
  gates. Source RAM floors and fixtures are not measured hardware proof.
  `initial_trial_child.h` is only a standalone guardian's child primitive:
  fork gate, own-child OOM/PDEATHSIG, exclusive wait/reap, fixed 60/5/5s.
  No CLI/production integration or ELF/scope/intent admission exists there.
  Keep callbacks out of ordinary device flows; future exec admission must
  exclude credential changes and set-id/file capabilities that clear PDEATHSIG.
  Test it only as the explicit Linux/root synthetic fixture. Never disable
  assertions in that executable fixture or replace hardware QA with its result.
  `initial_trial_admission.h` returns only read fds: exact private ext4 root,
  fixed ARM program/hash/metadata and observed no-capability report; a
  separate initial-only empty tmpfs reader checks identity/budget. Never
  repair/strip attrs or treat unsupported/hidden metadata as exec permission.
  These fds do not establish the named root, live stock scope or trial intent;
  keep LSM visibility and post-exec PDEATHSIG as explicit hardware gates.
  RAM free space is not MemAvailable. No runtime filesystem override exists.
  The child primitive sets/reads back child-only no_new_privs before entry;
  policy requires its ACK. Keep parent OOM/NNP unchanged. Hosted fd-exec of
  the synthetic fixture proves only that helper on that kernel/libc, never
  a monitor ELF, vendor glibc 2.23 or complete guardian protection.
  review_initial_trial.py is a read-only host join: terminal commit receipt/
  owner marker, full fresh scope, positive absence listings, TCP4/6, empty RAM
  scratch and conservative MemFree. It never creates/starts a job and reports
  image_fd_admitted=false; policy binds RAM inode/device and needs the actual
  device fd reader before start. No cache/swap credit or fabricated guardian.
  initial_trial_intent.h is a separate own-root writer primitive, not a
  launch tool. Keep fixed O_EXCL filename, consumed-before-write attempt,
  exact boot/root/creator binding, file+directory fsync/readback and no
  adoption/retry/unlink. One parent-process fork grant is consumed before
  fork; existing/partial markers never become new authority through a nonce.
  Its tmpfs fixture does not qualify device NAND, named scope or firmware.
  initial_trial_exec.h is an inert admitted child-entry building block, not
  a launcher. Keep fixed RAM cwd/preferences, exact argv/environment, null
  stdio and complete child-only inherited-fd closure before fexecve. Require
  the actual protected child and recheck image/RAM readers. It does not join
  live device scope or consume intent; no standalone guardian/HACS activation.
  Native hosted exec tests run only their own private fixture ELF, never ARM
  firmware or a monitor. Preserve the production ARM/ext4 admission boundary.
  initial_trial_filesystem.h is the read-only filesystem scope:
  fixed no-follow /data/root walks, exact payload/flags/plan+commit markers,
  complete positive listings and persistent inode/metadata/byte checks.
  Unknown files, partial markers and history are preserved/refused, never
  cleaned or ignored. A new trial marker needs one explicit acknowledgement
  of the actual creator-owned intent bound to this root/plan/bridge; no flag,
  reopened actor or serialized proof can bypass the initial listing. Recheck
  every original pin before rebasing only the known directory metadata delta.
  The intent must outlive the reader; claimed checks belong to the creator,
  not its fork child. Acknowledgement never grants a fork or launch.
  It does not collect stock/vendor/device/boot/resources or authorize launch.
  initial_trial_resources.h is pre-start read-only kernel resource evidence:
  fixed procfs fd reads, unique MemTotal/MemFree in KiB, no cache/swap credit,
  and both complete TCP tables refusing API/OTA local ports in every state.
  Missing/malformed/oversized/stale reads return only refusal, never a cached
  positive. Export no socket tables/peer addresses. The one-second observation
  window is checked after IO; it is not a hard syscall timeout, RAM guarantee
  or port reservation. Running-child/resource ownership still needs its join.
  initial_trial_device.h is read-only identity evidence: exact physical WLAN,
  boot, CO2 type, armv7l and stock version; fixed ext4/procfs/sysfs fd reads,
  bounded INI filtering and persistent refusal on replacement/failed reads.
  Keep kernel sysfs class-link allowance separate from no-follow data/proc
  ancestors and final files. No raw INI/password export, runtime root/CPU
  override, USB proof, process/launch authority or hardware qualification.
  initial_trial_stock.h is pre-start read-only procfs evidence: unique exact
  stock/watchdog birth/parent, actual exe inode vs admitted SnowApp/fixed RO
  BusyBox, complete scans/cmdline/maps and no known NAND/RAM executable/mapping.
  Never treat an unreadable live userspace exe or failed maps read as absent.
  No PID adoption, signal, runtime proc/path override or trial authority.
  Keep observation IO off the future independent stop-deadline loop; the
  post-read freshness limit is not a syscall timeout or hardware proof.
  initial_trial_ram_scope.h binds the fixed named pre-existing empty tmpfs
  job and positively lists /tmp for the boot-launcher lock's absence. Keep
  root-owned sticky /tmp, exact job inode/metadata and complete bounded reads;
  preserve unrelated entries, refuse unknown job contents/history and never
  create/repair/prune a directory. Its read fd grants no fork/exec authority.
  initial_trial_scope.h joins the actual fixed readers from one exact
  binding, deriving image/RAM fds from its verified named roots. Two resource
  reads bracket complete scope rechecks; clear all evidence on failure and
  never revive a refusal. The five-second frame is post-read freshness, not
  an IO timeout or timer. Only the actual creator's matching plan/root/bridge/
  boot/RAM record can be acknowledged; the intent must outlive the scope.
  Inert entry preparation is not host USB/plan authentication, guardian
  self-image admission, fork permission, launch or hardware qualification.
  initial_trial_self.h is a separate read-only actual guardian image reader:
  fixed named private tmpfs program, exact size/SHA/ARM/capability report and
  actual /proc self birth/exe inode/path. A copied binary or reported PID never
  grants a relationship. Refusal is permanent, inherited fork objects fail,
  and the stock scanner can join only the live reader for its actual caller;
  default scans still refuse every own executable. No child/fork permission.
  Native hosted
  self-exec is a separate compile-time fixture type, never a production path,
  filesystem, architecture or PID override. Keep reads off the stop timer.
  initial_trial_vendor.h reads the nine fixed committed-disabled vendor pins
  through no-follow root-owned directory/file fds. Keep the host/device pin
  contract test, complete hash/metadata/named-inode rechecks and persistent
  refusal. Factory scripts, symlink ancestors and writable vendor paths are
  not admitted. Only a compile-time non-ext4 fixture can substitute synthetic
  pins/root; no production override, write, exec, shell or repair exists.
  Its verified stock read fd only joins the separate stock-session reader;
  file evidence is not a complete guardian or launch authority. Unknown
  vendor layout remains a qualification blocker.

- `build_candidate.py` is an experimental private CGS1 build controller,
  not installation authority. It archives one committed source revision,
  creates its own pinned SDK and matches actual PM/guardian/native/bridge
  digests. Keep the explicit 0600 profile, separate S8/SCD40, required release
  manifests and installation_ready=false. Never copy dirty deployments or
  replace missing trial artifacts with fake ones. `stock-bridge-release.yaml`
  uses the ordinary FullRuntime gates without the legacy engineering trial
  API. Hardware QA and the HACS USB/ADB pipeline are still separate work.
  Keep publication of verified runtime sources and upgrades of existing
  installs separate from the unfinished initial USB/HACS route. Its missing
  activation code is not a reason to withhold the runtime source. A first
  trial is experimental before ordinary availability; changing a readiness
  flag cannot supply the missing implementation or its hardware evidence.

- `ports/monitor1/build_pm_helper.py` is build-only. It requires an explicit
  independently verified stock QtCore SHA and the isolated CGS1 environment;
  outputs/logs stay private in a fresh ignored build directory. Public Qt
  headers are pinned; vendor Qt libraries and rebuilt helpers are not release
  assets. Preserve ARM/glibc/input checks, including EABI5 hard-float PCS on
  both the stock Qt input and all generated ET_DYN/ET_EXEC artifacts. A
  missing float flag is base PCS, not an unspecified hard-float success.
  Run test_monitor1_build.py after changes; its synthetic parser fixtures
  are static admission coverage, never loader/hardware proof. Never install
  the mock/test .so or infer loader authority from a successful build.
  See PM_HELPER_BUILD.md.

- Browser first-trial RAM preparation has pure generated creation/readback
  commands under `generate_initial_ram_commands.py`. They are not wired to a
  device writer. Bind the original consumed packet, patched committed scope,
  source fingerprints and new fresh preparation; never reuse the trial nonce
  as the old commit nonce. Derive MemFree from the canonical minimum and bound
  tmpfs multiplication before ARM32 arithmetic. Create only new 0700 jobs and
  an exclusive empty 0600 guardian file; collisions preserve history. Eventual
  execution requires the sealed length/SHA RAM stream, not raw shell lines or
  long OPEN packets. Independent metadata/hash/inode readback and actual FD
  admission remain required. The pure readback parser brackets file stat/SHA
  with two exact root observations and preserves all three original inodes
  across precreate/upload; fresh matching bytes at a replacement inode refuse.
  These context-only DTOs are not live handle/lease or image-FD authority.
  Run generate_initial_ram_commands.py --check,
  test_usb_initial_ram_commands.mjs, test_usb_initial_ram_observation.mjs and
  the Linux/root allocation-tail fixture;
  syntax/parity/temporary-root tests do not qualify a physical installation.
  InitialRamCommandStream now describes one sealed creation after the fixed
  harmless probe; it is still unwired and cannot upload/chmod/launch a guardian.
  Share internal stdin mechanics only through module-owned finite assemblers;
  never expose the helper, an assembler or a shell body via a frame/HTTP API.
  Preserve DisabledCommandStream's brand, three-step order and no-replay state.
  Rebuild the offline bundle and run both wrappers plus actual pinned Tango
  512-byte fragmentation/ACK/CLSE tests after shared transport changes.
  BrowserInitialRamSession composes fresh preparation, one sealed creation,
  independent precreate readback, one guardian SYNC and inode/SHA readback.
  It stays unwired: metadata never acquires the original channel/consumed lease.
  Preserve two complete source checks around each RAM observation phase,
  bounded pending-read cancellation and a shared close promise. A positive
  result keeps the transport but grants no chmod/exec, device FD admission,
  terminal trial proof or completion. Run test_usb_initial_ram_session.mjs.

- CGS1 Bluetooth remains unavailable. Read BLUETOOTH_RESEARCH.md before
  hardware work: WLAN rfkill0 and the stock rkrtkbt wrapper are not safe BT
  probes. Require revision-specific UART/BT_REG_ON wiring first; don't attach
  to an apparently free tty or reuse the FIQ console. A real host tracker/GATT
  backend and lifecycle proof are also needed before exposing a proxy toggle.
  The pinned third-party btproxy ARMv7/Noise build is only a candidate: no
  target HCI/runtime proof. Its default recovery can power-cycle the adapter;
  stall-timeout=0 disables that branch, not initial controller setup writes.
  Do not collide with the existing API port/identity or distribute its private
  build as CGS1 firmware. Chip pinout never substitutes for PCB continuity.
  Do not accept generated pin maps as wiring proof: the reviewed RTL8723DS-CG
  datasheet assigns pin24 to PCM_CLK/GPIO3, not a presumed UART RTS.

- Monitor 1 power/offline Wi-Fi/recovery now have portable source and host
  tests. Power is read-only kernel capacity/voltage/status, never a guessed
  percentage. Keep sealed UNASSOCIATED_MANUAL distinct from saved replay,
  both guardians, private Store/CAS and no-SELECT rollback. No password API.
  The tiny recovery has inventory AND exact old-program prune; protect an
  explicitly bound working pair, preserve user files, verify local backups,
  and consume each release intent before deletion. Its compact SDK MD5
  backend is opt-in only; Noise/OTA and SHA-256 stay enabled. Normal profiles
  retain EVP. Production core startup settle is 60s with the same 180s total
  bound and strict DRM gates. See ports/monitor1/POWER_WIFI_RECOVERY.md.
  Separate existing private S8/SCD40 deployments passed power exports,
  normal return, software auto boot and HA readback. Preserve the distinction
  between that runtime proof and the still-unqualified public initial route;
  no fresh installation or absent-AP/battery-transition proof follows.
  These sources do not enable the still-missing universal CGS1 installer or
  establish physical absent-AP, battery-transition, BLE or Monitor 2 proof.
  The planner fixture needs actual Linux/root Store ownership; CI runs its
  explicit hosted-runner root step. Never remove that production check to
  make a non-root local test pass or invoke sudo from the test wrapper.

- Monitor 1 native UI language is one restored `Interface language` select
  (`English` / `Русский`, default Russian), shared by local touch and HA.
  Translate only known display labels, never control options or user input;
  language changes must not clear/retry Wi-Fi forms or change entity IDs.
  Visible native brightness uses the common 2% floor (day 2–100/night 2–10)
  with local boot migration of old preferences. Only explicit screen-off
  uses zero. Preserve exact raw DRM/stock-recovery restoration semantics.
  The ordinary stock-side bridge includes storage-telemetry.yaml for a fixed
  read-only audit; no prune action is exposed. Keep its root include closure
  complete in SDK builds.
  See ports/monitor1/UI_LANGUAGE_BACKLIGHT.md and the pure C++ regressions.

- Monitor 1 runtime diagnostics keep the same read-only `Runtime mode` and
  `Core sensors ready` exports in the native and internal bridge identities.
  Readiness uses only the existing fresh physical CO2/T/RH/TVOC values, never
  HA display feeds or another hardware read. PM OFF/warm-up is independent.
  Preserve the historical Stock response age entity as unavailable in full
  mode; do not relabel native samples or change existing HA entity names.
  Run tests/test_monitor1_runtime_diagnostics.py after this wiring changes;
  host fixtures are not a deployment or hardware qualification.

- The wizard defaults to English and offers Russian in `frontend/i18n.mjs`.
  Store only the language preference in localStorage. Translate text nodes in
  place: never rebuild the form, repeat setup, disconnect BLE or restart a
  session when switching languages. Keep UI/backend error code coverage in
  `tests/test_i18n.mjs`; unknown errors must not expose arbitrary details.
- `show_sidebar` is an integration option, default true. Changing it updates
  the existing HA panel in place and preserves Manager/broker/session state.
  Network option changes retain their normal reload behavior. Preserve all
  unrelated options when any options-flow step saves its mapping.
  The installer page uses that same native admin options flow via
  `frontend/sidebar-settings.mjs`, never a browser-local preference or a
  duplicate endpoint/Store. Close read-only forms; reconcile an ambiguous
  submit by reading, never resubmit automatically. Preserve the live wizard
  DOM/BLE session, show pending/failure feedback, and keep the direct route.
  The control belongs in the compact header's Page settings disclosure beside
  language, not a separate wizard card. Keep native keyboard expanded state,
  Escape/outside dismissal, mobile bounds and listener cleanup on disconnect.
- Register one SERVICE device (`installer`) with a stable identifier and
  `homeassistant://qingping_esphome` configuration URL. It is an installer
  shortcut, never a physical monitor or an ESPHome device. Keep admin checks
  and direct routing when hiding navigation. README.md is English by default;
  README.ru.md is its Russian counterpart, with reciprocal language links.
  The panel footer keeps the source-code link and a separate developer credit
  to https://ivasch.ru/ with the owner's name; localize both label and name in
  place, keeping both external links independent of installation state.

- Stock 4.2.1 is an external-MCU variant under `ports/lite-mcu421/`, not an
  additional allowed version of the direct-I2C 4.5.8 image. Its catalog entry
  is `in_development`, with no firmware asset. Do not enable installation
  before startup/ACK, power pins and measurement semantics are established.
  `protocol.h` is receive-only research code, not an ESPHome UART driver.
  Run the ASan/UBSan C++ test and `node tests/test_compatibility.mjs` after
  changing this protocol/profile boundary; CI runs both without hardware.
  Frontend admission uses the backend catalog and must keep requestDevice in
  the original click activation, before any network wait. Invalidate the old
  identity/form before each new selection; backend admission is independent.

- The owner installs and updates this integration manually. An error report
  authorizes diagnosis/package fixes, not installation, configuration or a
  restart of their HA. Read-only HA diagnostics are explicitly allowed;
  mutations and direct/manual fixes require a new direct request.
- Native HA firmware updates live in `update.py`, `firmware_catalog.py`,
  `firmware_update.py` and `native_ota.py`. Keep one standard UpdateEntity per
  verified installer record, exact MAC association, administrator-only install
  and six-hour public catalog checks. Never auto-install during discovery.
  Only the qualified direct-I2C Lite has an executable update backend; public
  metadata cannot enable MCU/CGS1/Monitor2 or adopt a private firmware version.
  Preserve original keys and Wi-Fi/AP slots in the private atomic Store, never
  ConfigEntry options/state/logs. Old v1 records require the explicit HA profile
  form; its old random AP password is unrecoverable, so replacement needs the
  form's acknowledgement. New installs retain the complete profile.
  Fresh encrypted identity/settings/USB preflight and a durable consumed intent
  precede exactly one encrypted APP transfer. ACK loss/restart/unload never
  authorizes resend. Pending attempts may only reconcile by read-only checks;
  repeated physical sources and unchanged settings are required for verified.
  No bootloader/NVS write, plaintext fallback, automatic rollback or reset of
  consumed history. UI notification failure cannot undo a committed journal.
  Run test_firmware*.py with the real supported HA SDK and independent Noise
  loopback responder; these are not hardware OTA qualification.
- Firmware-only publication is independent of HACS: `firmware/releases.json`
  owns qualified per-profile counters, `.github/workflows/firmware.yml` builds
  and `tools/publish_firmware.py --profile lite` previews the exact pair.
  `--publish` creates an immutable `firmware-lite-vN` data tag and atomically
  advances the `firmware-catalog` branch with a CAS lease. No GitHub Release,
  HACS ZIP/version change, HA action or OTA belongs in that workflow. HACS
  also inspects non-latest Releases, so make_latest=false is not isolation.
  Keep exact public placeholders/manifest/source provenance and monotonic
  counters/history. Never overwrite a firmware tag or replay a lost push;
  inspect remote refs and public bytes first. The data tag is the sole narrow
  exception allowing public template BIN in a Git tree, never in main/private.
  HACS-only release CI retains its embedded qualified template and the frozen
  pre-0.2.2 compatibility catalog, without publishing a new firmware version.
  Keep old release assets readable; new readers support both URL generations.
  See docs/FIRMWARE_CHANNEL.md; run test_firmware*.py, including the real bare
  Git atomic-push/CAS fixtures. Compilation/CI is not physical OTA proof.
- The owner chose to retain the three advertised-name Bluetooth prefixes for
  now (2026-11-06). Do not expand to acceptAllDevices without a new decision.
  An empty filtered picker does not prove that all nearby BLE is invisible.
- Lite setup offers browser Bluetooth and HA Bluetooth as explicit transports.
  HA uses the shared Bluetooth APIs and connectable BLEDevice resolution, so
  local adapters and active GATT proxies share one path; never start a private
  scanner or imply that passive-only proxies can connect. Browser mode keeps
  requestDevice in its original click and needs Chrome/HTTPS. HA mode needs
  neither Web Bluetooth nor a browser radio. Keep the same three name prefixes.
  Selection is a bounded, owner-scoped identity read with immediate disconnect;
  before provisioning reconnect and recheck model/version/hardware/factory MAC.
  Reserve setup before awaiting, never replay writes, and gate arm until setup
  has completed. A disconnected WebSocket never arms OTA; unload cancels owned
  tasks and releases connections. This route is source-tested, not yet hardware
  qualified. Run tests/test_ha_bluetooth.py with the real HA SDK plus that SDK's
  Bluetooth/USB manifest requirements, and node tests/test_ha_transport.mjs.
- A loaded installer/panel needs no duplicate config entry. Explain its zero
  device count: physical monitors belong to ESPHome. Follow Marketplace's
  actual restart requirement rather than prescribing restart unconditionally.
- Normal setup must not ask for IP/ports HA can determine. Use HA's network
  helper and default ports; manual IP is a fallback, ports live in options.
  Preserve explicitly configured old/manual entries on upgrades.

- Keep this repository free of device credentials, home/room names, real MAC
  addresses, private deployment YAML, firmware backups and generated ELF/BIN.
  Only a reproducible template containing documented public placeholders may
  be published as a firmware asset. Personalization happens inside HA.
- Never advertise an unverified hardware variant as supported. Monitor 2 is
  currently unverified. CGS1 S8 and SCD40 are distinct profiles; SCD30 is not
  automatically admitted by either one.
- The HACS installer is administrator-only. Every installation is tied to the
  selected model/MAC, USB acknowledgement, a fresh transport and a single
  consumed OTA intent. A timeout is not permission to resend an OTA command.
- Firmware downloads containing private settings are served only to the
  selected LAN peer, expire, and never become public GitHub artifacts.
- Keep substantive comments for protocol boundaries, authorization, privacy,
  timeouts and recovery. Do not obscure necessary installation choices.
- Run `python -m unittest discover -s tests` for pure protocol/image checks,
  `python -m compileall -q custom_components tools`, and `node --check` on
  frontend modules. Record what was actually tested; do not substitute these
  checks for a hardware installation.
- Update this file when architecture or build/release commands change, and
  CHANGELOG.md for changes in behavior. Preserve third-party notices.
- Build the Lite template with `python tools/build_lite.py` in an ESPHome
  2026.9.1 environment; package with `python tools/package_release.py`.
  The output ZIP, binary AND its matching manifest are release artifacts,
  ignored by Git. Never retain a manifest from another timestamped build.
- Variable-length firmware slots must be read through the volatile runtime
  loader before Wi-Fi setup. Literal replacement alone is unsafe because a
  compiler can constant-fold the old strlen. Node names remain exactly 31
  bytes because ESPHome pre_setup has a separate compiled length.
- The HA frontend uses HA HTTPS/WebSocket authentication. Stock MQTT uses
  port 1886 and a dedicated LAN HTTP listener uses port 1887 by default;
  do not expose either port on a public interface/router forward.
- Monitor 1 has an experimental build-only candidate controller; separate
  SCD40 and S8 source compiles passed with matching artifact pins.
  This does not enable the universal installer. Do not remove missing-manifest
  checks or copy private release pins to make full YAML compile. Monitor 2
  remains disabled until hardware verification.
- Normal HACS installs must have a non-prerelease tag with the ZIP asset.
  Keep hide_default_branch=true: zip_release cannot install a source branch
  without its own release asset. Hyphenated beta/rc tags remain prereleases;
  numeric stable tags must not inherit an unconditional --prerelease flag.

- Lite firmware 2 is the qualified direct-I2C quiet profile, not a universal
  Lite image. GPIO13 LOW between bounded SCD4x transactions; 1ms settle/gaps,
  20kHz bus, 15s CO2 polling. Fresh-source readiness, 90s stale/NaN and IO/CRC/
  25ms window guards latch HIGH. GPIO18/23/board shutdown are unchanged.
  Run test_pm_quiet_policy.py and test_pm_polling_policy.py (ASan/UBSan).
  Public manifest binds the coordinated driver/rail closure via tools/pm_policy.py;
  never reuse a polling-only template for version2. Version1 remains historical.
- The agreed Lite design uses grouped typed-entity settings, transactional
  drafts, two independent Cancel-default slot confirmations, native-size
  outline/classic digits, fixed status, and finite 240ms page transitions.
  Outline assets are never reduced. Use the bundled OFL font licenses.
  Night is fully black; only centre wakes manual-off, consuming the gesture.
  API/Wi-Fi absence must not reboot standalone sensors. Unknown clocks are
  explicit. Preserve the optional per-device HA display feed and original
  stock provenance through fixed slots/sealed metadata; minimum HACS0.2.1.
  Stock4.3.4 provenance is admitted only for qualified existing native devices,
  not a wider factory Bluetooth installer. External-MCU images remain separate.
  Run test_lite_menu.py and render_lite_ui.py after a real SDK build; inspect
  those actual-method/generated-glyph frames before claiming visual QA.

- Installer-only releases use `python tools/prepare_release_template.py` to
  retain v0.1.3 legacy pins and reuse newer immutable pairs only with matching
  committed release_source_sha256 from firmware_source.py. Dirty or missing source and a failed asset
  read refuse; clean changed source uses the ordinary pinned compiler. Never
  overwrite existing output, substitute a private build or separate a binary
  from its matching manifest. Build/package from a clean committed snapshot.

- AutoAdoption inventories only HA-owned connected ESPHome runtimes. Reuse
  their Noise key and fixed requesting-client-only profile action; no scanner,
  rekey, reset, OTA or HA-client disconnect on discovery. AES-GCM envelopes
  bind fresh challenges and exact MAC; no plain Wi-Fi/AP/OTA values in entities,
  action responses or logs. Preserve pending/consumed history, refuse private
  firmware and refresh the current profile before OTA. Future versions need
  validated compatible public catalog identity. Legacy firmware needs a one-time
  upgrade, never guessed secrets. Unload retires only owned reads/timers.
  Run test_device_profile.py and test_firmware_update_ha.py with the HA SDK;
  check_profile_wire.py uses actual build SDK mbedTLS. Host proof is not QA.

- Firmware numbering follows docs/FIRMWARE_VERSIONING.md: full ESPHome only
  for Lite/Monitor 1/Monitor 2, independent integer versions per exact hardware
  profile, with a
  separate monotonically increasing OTA revision and independent HACS version.
  No reduced stock-interface product is offered. Monitor 1's bridge remains
  internal to its SHA-bound full runtime/recovery bundle. Lite's
  other OTA slot is not a stock add-on or permanent factory retention. Do not
  turn this agreed release contract into an unsupported version/backend claim.

- `public_version` is the per-profile integer shown on the device and HA;
  catalog `version` remains the exact legacy UI/build identity and `revision`
  remains monotonic OTA order. Never compare a public label with a wire build
  ID or manufacture OTA from a rename. Lite template/API/HA numbers must match;
  Monitor 1 release-versions.json independently pins S8/SCD40 full bundles and
  the builder injects the same project version into native/internal bridge.
  Missing fan shutdown may be a documented v1 limitation; missing core sensor
  freshness/scales or lifecycle is not equivalent to that optional feature.

- HACS packages Monitor 1's shared engines deterministically with
  `python tools/monitor1-usb/package_core.py`; CI --check rejects drift and
  unknown packaged files. Edit apps/monitor1_usb/rootfs, never its generated
  monitor1_worker/frontend/monitor1 copies. Preserve the offline Tango notices.
  The authenticated admin HTTP adapter sends actual user IDs to one private
  stdio actor, never forged Supervisor headers or a new HTTP listener/token.
  Use the supported HA SDK KEY_HASS/KEY_HASS_USER constants. Positive real
  aiohttp page/jobs tests must use its typed AppKey without a string alias;
  a worker-only or rejected-user test cannot validate the admin HTTP route.
  Authenticate/reserve before body reads; drain an interrupted pipe response
  before releasing its reservation. An exited/uncertain actor is not restarted
  to replay work. Unload closes stdin after current bounded operations, never
  kills a device writer; the actor's kernel flock blocks replacement adoption.
  Tools are exact signed Alpine3.24 APK closures for tested x86_64/aarch64,
  fetched/hashed/verified/extracted privately, without apk add/scripts or Core
  interpreter/library mutation. Unsupported platforms refuse server tools.
  Page/status never download tools or start ADB; explicit preparation and USB
  actions are independent. Only the actual foreground child owns the loopback
  socket: join procfs fd/listener inode, reject a bind race, never PID adoption,
  LAN ADB or shared5037. Keep per-job toolset/profile pins across upgrades.
  Use the same offline wizard in a same-origin frame with exact source/origin/
  random channel checks and HA fetchWithAuth in the parent; no HA token enters
  the iframe/browser storage/URLs. Requests are consumed once, language changes
  preserve forms, and disconnect removes the listener. Run test_usb_*.py with
  the real HA SDK, test_monitor1_core_frontend.mjs, and package_core.py --check.
  Core software tests do not qualify untouched-device installation, full UI,
  unsupported platforms, BLE hardware or Monitor2. Owner updates HA manually.

- Monitor 1 runtime releases use `tools/publish_monitor1.py --profile both
  --source-commit <exact SHA>` (dry-run; `--publish` is explicit). Immutable
  per-profile data tags contain only a public source archive, release.json and
  build instructions. Preserve `runtime_releases` separately from installable
  catalog `releases`; no fictitious BIN/backend or HACS release. Source-built
  v1 is not generic ELF distribution, fresh hardware QA or initial-install
  readiness. Never publish private candidate outputs, QtCore or profiles.
  Run tests/test_monitor1_publication.py for reproducibility, tag immutability
  and the actual atomic two-tag/catalog CAS, plus existing firmware tests.

- Private monitor1_browser_stage joins the rehashed actor plan/context, fresh
  registry stage-admission and retained lease/consumed packet before its fixed
  NativeChannel/StageSession transfer. Rehash every bounded private payload
  before the first stage frame. Only canonical roles, sequential <=64KiB
  chunks and exact remote proof are admitted. Channel source/identity reads
  remain fixed; pinned Tango SYNC-v1 has no Android mkdir workaround.
  Before terminal actor record require both actual USB-close proof and the
  separate channel-close ACK on the original owner/page/nonce/deadline. Lost
  packet/root/chunk/close/proof or cancellation preserves unknown history,
  never repeats prepare, recreates a root or releases the retained lease.
  The original transport close result also retires stage buffers/timers; do
  not form a promise cycle by awaiting sink close inside transport close.
  Peer close callers share the same actual ACK. This private composition has
  no public initiator or installation UI yet. Vendor commit, launch, boot,
  Full UI and HA enrollment stay independent missing browser adapters. Run
  test_usb_native_stage.mjs (real peer + selected-channel composition) and
  test_usb_browser_stage_transfer.py (real async registry/channel + synthetic
  actor) plus all USB/Node regressions. Host fixtures do not qualify hardware.

- browser_disabled_commit_policy reuses only the admitted frozen SDK's pure
  disabled-CAS state machine with an explicit immutable WebUsbBinding in the
  fifth target position. Never manufacture a usb: string or pass this binding
  through a native loader. Its separate transport validator retains original
  channel/nonce/target/boot; the nontransport scope validator remains verbatim
  canonical source53 (tested for drift). Root/inode/flags/source/vendor/session/
  space checks, separate rollback and one-outstanding issue/readback semantics
  stay identical. A pure snapshot is not a live handle, consumed commit intent
  or permission to run remote commands. The fixed browser collector and private SDK assessment are connected;
  the command adapter and consumed commit writer remain separate work. Run the browser pure
  policy tests, including the original interruption cases under this binding.

- Later browser phases may use NativeChannel.selectForReview in the original
  picker click. Its opening read checks only fixed root/model/WLAN/boot identity
  twice; it claims no original-file or absent-installation verification. Normal
  select remains factory-only. Initial stage admission/prepare still repeats
  its complete factory/absence/space checks, even on this review transport.
  Every later phase needs its own fresh fixed collector and independently
  consumed intent before writes; identity context cannot renew an old session.
  No public UI uses this reconnect yet. Test existing-root/changed-source
  refusal, invalid identity, picker activation and no native path/adoption.

- usb-disabled-scope is a fixed read-only staged collector through the actual
  selected NativeChannel/private finite disabled-scope frame. Generate its
  process scan/bootstrap/source closure with generate_disabled_contract.py;
  CI --check rejects stale bytes. Recheck target/boot, root inode/mode/entries,
  exact stage intent/AFTER-effects, both empty opt-outs, all staged/vendor
  bytes, same-filesystem parents, unique stock/watchdog birth/exe/UID/argv,
  positive absent PM mapping and ext4 headroom. Repeat the whole stable scope
  independently after reads. A failed proc/maps scan is never absence.
  Optional commit_nonce only compares the private journal's known owner lock;
  it never creates/adopts one. Only known factory/patched scripts are readable
  variants. No arbitrary paths/commands, lock/write/launch/signal or public
  initiator is exposed. Returned JSON is context, not a commit/rollback intent;
  the private SDK policy join is read-only and the replacement adapter
  remains separate.
  Run test_usb_disabled_scope.mjs, including actual peer/NativeChannel joins,
  malformed/drift/failure cases, plus USB suites and rebuilt bundle checks.

- internal-browser-disabled-context is private metadata from an exactly owned
  terminal stage: rehash original plan/profile/source/proof and never include
  key/payload bodies or create another intent. Generated disabled-contract.json
  records required reader fingerprints, not proof of executed SDK policy.
  Private Core disabled review joins this metadata to the original current
  owner/page/channel/deadline, validates the fixed collector's exact DTO and
  requires close ACK before a redacted scope-observed result. A failed maps/
  process read is not absence. The separate openBrowserReviewControl uses
  selectForReview in its original picker click; default opening stays
  factory-only. No public initiating route/GUI or commit writer is connected.
  The fixed private internal-browser-disabled-assess child uses the existing
  admitted job SDK and rehashes source53 plus all four reader fingerprints
  before importing canonical policy. Public archive files keep their ordinary
  source metadata contract (usually 0644), distinct from private 0600 payloads.
  Canonical input bytes carry only the exact current registry channel/nonce,
  plan and strict scope on stdin. No arbitrary path/executable, native toolset
  lookup, inherited credential/ADB environment, log, output file or intent.
  Only construct BrowserVendorTransaction: never issue/ack or execute a remote
  command. Rehash the same original stage/profile/source after its bounded
  result; Core compares the exact input SHA and original live capability/
  deadline before close ACK. sdk_policy_checked is pure admission only:
  commit_admissible_for_review grants no cached writer permission, physical
  installation qualification or readiness. Known partial variants get a
  negative forward assessment, never automatic rollback or completion.
  Run terminal-context actor, async disabled-review/expiry/close tests and
  review-control/shared UI tests, both HA USB SDK suites and package checks.
  Add test_usb_browser_policy_assessment.py for source drift/symlinks, public
  source modes, clean argv/environment, exact input/result binding, stale
  analysis, constructor-only semantics and no child retry. Synthetic source/
  runner fixtures never count as an actual admitted candidate or device.


- Fixed browser disabled-commit command assembly is pure and unwired.
  generate_disabled_commands.py imports the unchanged source53 canonical
  inline_guard/replacement_command and splits only typed hex/numeric/MAC/UUID
  leaves into generated templates. Preserve all command bytes/ordering rather
  than manually reimplementing the process/source/flag/CAS guards. The separate
  disabled-write-contract.json records six required producer fingerprints;
  a future private SDK/journal join must verify them before write admission.
  usb-disabled-commands.mjs accepts only claim/watchdog/start and the exact
  expected predecessor's vendor hashes, both opt-outs and complete fixed
  observation. No caller command/path, rollback, launch or generic shell
  operation exists. Its returned text is NOT a live capability, consumed
  intent, write/ACK/retry or hardware qualification. The private consumed journal/retained lease is now present; finite
  selected-channel execution and private Core readback composition are now
  connected; public initiating UI/later lifecycle adapters remain unfinished.
  Keep set -eu/umask 077 in each eventual owned shell session. Guarded bodies
  exceed a 4KiB OPEN packet. Tango2.6.2 rejects any packet larger than the
  actual negotiated maxPayloadSize; never infer the monitor's current limit
  from a template. The future adapter must bound and stream the complete
  prevalidated body to one fixed owned sh stdin, rather than put an arbitrary
  long command into the OPEN service. Do not split the guards or
  persist another script in the frozen guardian's private tree.
  Run generate_disabled_commands.py --check and test_usb_disabled_commands.mjs:
  actual public canonical builder vectors, exact byte equality, sh -n only,
  typed injection/refusal/phase cases. Never execute those production paths
  locally or treat syntax/rewritten root fixtures as monitor QA.


- browser_commit.py is a private exactly-once metadata journal, not an active
  device writer. It reuses the terminal owned stage, SDK pure assessment and
  all six source fingerprints, acquires native-install flock and checks every
  prior writer before fsyncing its new 0600 intent. Return one metadata packet
  only after consumption. Losing that packet preserves both lease and durable
  uncertainty; no retry, automatic rollback or reset follows. Actor shutdown
  releases only its host FD; unknown/orphan commit history fences all native/
  browser coordinators and computer exports across restart. A new actor cannot
  adopt the old lease to record a result. Producer drift refuses old history.
  Terminal record needs exactly claim/watchdog/start ACKs, three independently
  collected whole-scope snapshots with the exact successive vendor hashes,
  invariant original root/stock/watchdog/source/flags/target and acknowledged
  actual transport closure. Only known nonce/free-space/script transitions may
  differ. SDK analysis/input hashes and journal proof are not live-handle
  permission; the future Core coordinator must retain/recheck its original
  capability and separate channel close ACK before private actor record.
  internal-browser-commit-* is pipe-only and never initializes ADB; HTTP rejects
  it before body IO. No public initiator is enabled. The private command-stream
  composition is described below. Run test_usb_browser_commit.py for real fsync/flock, lost packet,
  orphan/partial/changed proof and producer, lease non-adoption, actor guards
  and redaction, plus both HA USB suites and HTTP-before-body tests. Synthetic
  scope/SDK fixtures are explicit and never claimed as a monitor commit.


- Browser disabled commit now has a private selected-channel composition:
  fixed stdin probe -> fresh staged collector -> consumed actor packet ->
  separate prepare/claim/watchdog/start/complete frames -> repeated full scope
  -> actual USB close -> independent channel-close ACK -> actor record.
  No public HTTP/UI action starts this sequence. Keep the original owner/page/
  channel/nonce/deadline and reject other API/stage phases once its probe is
  reserved. Rehash the actor producer before the first write frame; only exact
  known snapshot prefixes and final transport proof can release the lease.
  A failed/lost packet, step, scope or close never retries or auto-rolls back.
  Monitor initial-install qualification and later trial/boot/UI stages remain
  separate; installed/readiness stay false after committed-disabled.

- usb-disabled-stream uses only a tiny typed exec:/bin/sh -c bootstrap. Before
  interpreting the body, receive its bounded exact ASCII byte count into RAM
  and verify SHA-256. Never stream executable shell lines directly: truncated
  stdin can otherwise turn a destination into another syntactically valid path.
  No script file is persisted. Its typed OPEN contains only fixed code/size/
  digest/marker; command bodies use bounded WRTE with actual Tango fragmentation
  and concurrent output draining. Never close duplex stdin early. Require exact
  completion text, EOF and owned remote socket close, then live identity/scope.
  Unsupported raw exec has no PTY/shell-v2 fallback; the harmless fixed probe
  must pass before consuming a write intent. Actual device support is not
  inferred from a compile or emulator. Preserve bounded lifetime/cleanup,
  late-open retirement, shared close result and no-replay phase counters.
  Run test_usb_disabled_stream.mjs, test_usb_native_commit.mjs and actual pinned
  test_usb_disabled_stream_tango.mjs (512-byte emulator window). The bootstrap
  fixture executes only synthetic temporary effects and checks truncation/hash/
  NUL/extra-stdin refusal; production guard scripts are never executed locally.
  Run both HA USB suites, test_usb_browser_commit_transfer.py, full pure tests,
  source generators and the rebuilt offline bundle/package checks.

- internal-browser-initial-trial-context is a private artifact-only read after
  an exactly owned terminal browser commit. Rehash the original schema2 plan,
  candidate result/profile/source, separate initial-trial-guardian-program and
  terminal commit proof; never add another role to the frozen nine-file NAND
  tree, rewrite an old plan or fabricate a native commit receipt/get-devpath.
  generate_initial_trial_contract.py pins the required frozen source53 reader
  and C++ guardian inputs. Import only after actual source verification in the
  job's existing SDK; call only canonical guardian_artifact, not trial/Adb or
  a native loader. Compare the exact canonical stdin/result bytes and recheck
  original files after the child. No new intent, lease, RAM allocation, upload,
  launch, boot change or public HTTP/UI initiator follows. Artifact checking
  is distinct from the device's actual image-FD/capability admission, which
  stays false in this DTO. The bounded browser trial lifecycle is still missing.
  Run test_usb_browser_initial_trial.py, the source generator/package checks
  and both HA USB suites. Synthetic programs/ELF headers test byte/ABI gates
  only and must never be described as a physical guardian or monitor trial.

- The private first-trial preparation review now joins that exact artifact
  context with the original selected channel/owner/page/deadline. Its finite
  initial-trial-preparation frame performs two complete committed-disabled
  reads plus canonical positive store/process/TCP4/TCP6 checks and conservative
  MemFree. Preserve original terminal root/inode and stock/watchdog births;
  only measured free capacity may change. Rehash the same guardian/proof after
  IO and require independent channel-close ACK before a redacted result. Never
  treat a failed read as absence, use cached/buffer/swap RAM, renew a deadline
  or accept a partial script state. Required scripts are generated from the
  unchanged canonical source. No public initiator, RAM path/allocation, upload,
  trial intent, image FD or execution grant exists; ram_scope_checked and
  image_fd_admitted stay false. Keep this prerequisite separate from the
  future creator-owned bounded guardian lifecycle. Run the real selected peer
  and delivered-bundle test_usb_initial_trial_scope.mjs and actual async registry
  test_usb_browser_initial_review.py, all USB/Node tests and source/package
  checks. An emulated collector is not a monitor trial or hardware admission.

- browser_initial_journal is the consumed host packet half of that future
  trial, with no public initiator or device/RAM execution. Under the shared
  native-install flock recheck the terminal browser commit, exact SDK guardian
  and strict shared preparation DTO/original scope; fsync one 0600 O_EXCL intent
  before reading/delivering the private guardian bytes. Return only one opaque
  internal pipe packet with distinct typed trial/RAM/guardian nonces. Rehash
  the context after reading. Packet loss, artifact drift or actor exit keeps
  durable unknown history and no replay; native/browser writers and computer
  exports fence even orphan trial history after restart. A status never starts
  another SDK, exposes the body or adopts a lease. No terminal verifier/record
  API exists yet: a file named complete must refuse, never release a fence or
  claim a stopped/installed result. Preserve image_fd_admitted=false. A future
  original-capability coordinator still needs fixed RAM transfer, unchanged
  timed guardian, actual image admission, authenticated API/stop/return proof
  and independent close before any completion path is implemented. HTTP denies
  every internal operation before body IO and rejects its private MIME. Run
  test_usb_browser_initial_journal.py for real fsync/flock/lost packet/orphan/
  changed producer/body/restart/actor/export cases, shared preparation/HTTP
  regressions and both HA USB suites. All programs/SDK/device data in these
  fixtures are explicitly synthetic; no RAM write or monitor QA follows.

- BrowserInitialGuardianSink is only an unwired fixed one-file SYNC-v1
  primitive for /tmp/qingping-initial-guardian-<bound id>/program. The future
  private coordinator must first own the consumed journal/lease, recheck the
  original selected capability/deadline, create/verify both private tmpfs jobs
  and exclusively precreate the new destination. Descriptor JSON is not that
  proof. Buffer at most 16MiB with ordered <=64KiB chunks; hash the entire file
  before one pinned adbSyncPushV1 SEND/DATA/DONE, 0600, mtime0. No caller path,
  Android mkdir workaround, SND2, chmod, exec, overwrite/resume or signal API.
  Independently verify remote SHA/UID/nlink/root/mode afterward; wire OKAY is
  not remote verification or image-FD admission. Success keeps the original
  transport for that later readback/guardian lifecycle. Failure retires its own
  connection without retry; late opens close without adoption, close callers
  retain one actual result and no timer extends the original capability. This
  source primitive adds no NativeChannel/Core frame or public writer yet.
  Run test_usb_initial_guardian_file.mjs and actual pinned Tango
  test_usb_initial_guardian_sync_v1.mjs, plus existing stage SYNC/Node tests.
  The shared daemon fixture records only bytes and never opens a named path
  or executes a program. Do not rebuild firmware or claim hardware QA from it.
