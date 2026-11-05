# CGS1 Linux DRM display platform. See display.py and the device-specific guard.

# The native host builder does not add a release optimization level. Use one
# explicit profile in the GUI and its numerical oracle tests. Fast-math and
# fused multiply-add would change the original ARM rounding; neither is an
# acceptable shortcut for this temperature/humidity reconstruction.
NATIVE_COMPILE_FLAGS = ("-O2", "-fno-fast-math", "-ffp-contract=off")
