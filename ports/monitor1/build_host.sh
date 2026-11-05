#!/bin/sh
set -eu
# Build only. This script never invokes ADB, uploads a binary or restarts a
# device. Full build output can contain compiled secrets; keep the build tree
# and logs private, and distribute only the parameterized YAML/source files.
base=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
export CC="$base/zig-cc"
export CXX="$base/zig-cxx"
export AR="$base/zig-ar"
export RANLIB="$base/zig-ranlib"
export PATH="$base/.venv/bin:$PATH"
# This SDK default covers a new profile that has not yet inherited an explicit
# YAML limit. Existing profiles also set compile_process_limit: 1 themselves.
export ESPHOME_DEFAULT_COMPILE_PROCESS_LIMIT=1
# An explicit second configuration is useful for bounded direct-driver trials.
# The default remains the installed stock-preserving bridge. Neither mode
# uploads or runs its result, so a successful compile cannot claim device QA.
[ "$#" -le 1 ] || { echo "Usage: build_host.sh [configuration.yaml]" >&2; exit 2; }
# Keep interactive Mac applications responsive during this host-side build.
# The YAML profiles separately limit compilation to one worker; nice lowers
# scheduling priority but does not claim to impose a memory or CPU hard cap.
# This applies only to this build and its children, never to other assignments.
exec nice -n 10 "$base/.venv/bin/esphome" compile "${1:-$base/stock-bridge.yaml}"
