#!/usr/bin/env python3
"""Cross-language check of the actual device exporter, after a public build.

Use the exact build's downloaded mbedTLS and ArduinoJson, never a different
system crypto implementation. Compile the production header with synthetic
HA/device data, then decrypt its result through the production HA decoder.
Only this disposable host fixture runs; no firmware/device is executed.
"""
from pathlib import Path
import base64
import importlib
import json
import shlex
import subprocess
import sys
import types

ROOT=Path(__file__).resolve().parents[1]

def main():
    build=ROOT/".build/lite-app/build"
    commands=json.loads((build/"compile_commands.json").read_text())
    command=next(c["command"] for c in commands if c["file"].endswith("/main.cpp"))
    includes=[Path(a[2:]) for a in shlex.split(command) if a.startswith("-I")]
    mbed=next(p.parent for p in includes if str(p).endswith("/mbedtls/mbedtls/include"))
    arduino=next(p for p in includes if str(p).endswith("/managed_components/bblanchon__arduinojson/src"))
    host=ROOT/".build/host-mbedtls"
    subprocess.run(["cmake","-S",str(mbed),"-B",str(host),"-DENABLE_PROGRAMS=OFF","-DENABLE_TESTING=OFF","-DCMAKE_BUILD_TYPE=Release"],check=True)
    subprocess.run(["cmake","--build",str(host),"-j2","--target","mbedcrypto"],check=True)
    binary=ROOT/".build/profile-wire-fixture"
    subprocess.run(["c++","-std=c++20","-Wall","-Wextra","-Werror","-I"+str(ROOT/"tests/profile_host"),"-I"+str(ROOT),"-I"+str(arduino),"-I"+str(mbed/"include"),str(ROOT/"tests/profile_wire.cpp"),str(host/"library/libmbedcrypto.a"),"-o",str(binary)],check=True)
    package=types.ModuleType("qf_wire_check");package.__path__=[str(ROOT/"custom_components/qingping_esphome")]
    sys.modules[package.__name__]=package
    module=importlib.import_module(package.__name__+".device_profile")
    wire=subprocess.check_output([str(binary)])
    decoded=module.decode_profile(wire,base64.b64encode(b"K"*32).decode(),"00AABBCCDDEE","qingping-00aabbccddee-000000000","1234567890abcdef1234567890abcdef")
    assert decoded.values["ssid"]=="test-сеть"
    assert decoded.values["wifi_password"]=='test-quote"-backslash\\-password'
    assert decoded.values["ota_password"]=="test-ota-password"
    assert decoded.revision==2
    assert decoded.public_version==1
    assert b"test-ota-password" not in wire
    rejected=json.loads(subprocess.check_output([str(binary),"invalid"]))
    assert rejected=={"error":"device_profile_unavailable"}
    print("Production C++ exporter / real mbedTLS / Python AES-GCM interoperability passed; synthetic data only")

if __name__=="__main__":main()
