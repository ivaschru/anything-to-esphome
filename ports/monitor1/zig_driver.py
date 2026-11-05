#!/usr/bin/env python3
"""Cross-compile ESPHome without accidentally linking macOS Homebrew OpenSSL.

ESPHome selects crypto paths from the *build computer*. Only those known native
OpenSSL flags are replaced here; the generated project and shared environment
remain untouched. Target headers/libraries must have been built beforehand.
"""
import os
from pathlib import Path
import sys

base = Path(__file__).resolve().parent
mode, *arguments = sys.argv[1:]
if mode not in ("cc", "c++"):
    raise SystemExit("Expected cc or c++")
native_crypto = {
    prefix + root + suffix
    for prefix, suffix in (("-I", "/include"), ("-L", "/lib"))
    for root in ("/opt/homebrew/opt/openssl", "/usr/local/opt/openssl")
}
arguments = [argument for argument in arguments if argument not in native_crypto]
target = base / "build/openssl-arm"
source = base / "build/openssl-3.5.9"
extra = [f"-I{target}/include", f"-I{source}/include", f"-L{target}"]
if "-c" not in arguments and "-E" not in arguments and "-S" not in arguments:
    # Native host debug information is large and unnecessary on the monitor.
    # Stripping at link time avoids the unsupported macOS zig-objcopy path.
    extra.append("-Wl,--strip-debug")
os.execv(sys.executable, [sys.executable, "-m", "ziglang", mode,
                        "-target", "arm-linux-gnueabihf.2.23", "-mcpu=cortex_a7",
                        *extra, *arguments])
