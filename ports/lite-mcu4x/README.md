# Lite 4.2.x – external MCU receiver

This is a real ESPHome 2026.9.1 UART component, not an installable sensor
firmware. It defaults to passive RX19 / 115200 8N1. The MCU owns sensors,
display and input; none of the direct-I²C Lite power/display/touch GPIO is
reused. In particular TX18 must never become the direct-I²C power latch.

The shared CG/TLV parser accepts bounded fragmented CR/LF/CRLF lines,
rejects malformed/oversized input and resynchronizes only after a delimiter.
Telemetry accepts report command 0x32; command 0x31 is not a sensor sample.
Known duplicate/wrong-length fields invalidate the complete sample. Unknown
keys and ACKs never refresh measurements. Each raw field expires separately,
including across millis() rollover; no received payload is logged.

The reference MCU 0354 (101241 bytes, SHA-256
`13a8f13ba284da1483bee5f3d7f4dcf7e4d014c1274ed0fdae280def834765fb`)
emits T/RH as signed16/unsigned16, CO₂/PM as unsigned16, battery/charge as
unsigned8 and voltage as unsigned16. These are wire counts, not qualified
physical units or stock heat compensation. Four-byte ESP32 RAM loads do not
prove four-byte TLVs. A different MCU layout must fail explicitly.

The component also retains separate finite research poll modes with exact
TX18/RX19 and fixed empty-poll/ACK strings. There is no arbitrary command,
setting/calibration encoder or MCU updater. These modes never qualify a
production polling lifecycle, fan-off behavior or another hardware revision.

`receiver-check.yaml` is compile-only: **do not install its BIN**. It has no
qualified startup, power/input/display ownership, exact target join or stock
return. Default 30-second field expiry is diagnostic and may be shorter than
normal PM intervals. A usable full port still needs exact startup/ACK,
measurement scales/invalid values, power and display/input evidence.

```sh
python -m unittest discover -s tests -p 'test_mcu4x*.py' -v
python -m esphome compile ports/lite-mcu4x/receiver-check.yaml
```

Host sanitizer and actual SDK tests establish software behavior only. Private
vendor app/MCU bytes, captures, household identities and trial profiles are
not copied into this repository. The factory installer remains unavailable.
