#pragma once

// A session nonce namespaces *uncommitted* checkpoint files only. The committed
// filenames and record formats stay stable across boots/releases. A sealed
// guardian plan supplies a fresh nonzero 64-bit nonce for every full session;
// it is not a secret or a substitute for directory ownership/flock/CAS.
//
// PID + local counter alone can collide with a preserved pre-rename crash file
// after a reboot reuses the PID. Adding the already admitted session nonce
// avoids that collision without deleting forensic remnants or retrying an
// ambiguous transaction. A deliberately occupied exact new filename still
// fails O_EXCL; no path-repair or directory sweep is permitted.
namespace cgs1_checkpoint {
inline bool valid_epoch(const char *value) {
  if (!value) return false;
  bool nonzero = false;
  for (unsigned i = 0; i < 16; ++i) {
    const char ch = value[i];
    if (!((ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'f'))) return false;
    nonzero = nonzero || ch != '0';
  }
  return value[16] == '\0' && nonzero;
}
}  // namespace cgs1_checkpoint
