#!/usr/bin/env python3
"""Exercise this exact staged exporter with real SDK crypto, synthetic data only."""
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
    build=ROOT/'.build/lite434-app/build'
    commands=json.loads((build/'compile_commands.json').read_text())
    command=next(c['command'] for c in commands if c['file'].endswith('/main.cpp'))
    includes=[Path(a[2:]) for a in shlex.split(command) if a.startswith('-I')]
    mbed=next(p.parent for p in includes if str(p).endswith('/mbedtls/mbedtls/include'))
    arduino=next(p for p in includes if str(p).endswith('/managed_components/bblanchon__arduinojson/src'))
    host=ROOT/'.build/lite434-host-mbedtls'
    subprocess.run(['cmake','-S',str(mbed),'-B',str(host),'-DENABLE_PROGRAMS=OFF','-DENABLE_TESTING=OFF','-DCMAKE_BUILD_TYPE=Release'],check=True)
    subprocess.run(['cmake','--build',str(host),'-j2','--target','mbedcrypto'],check=True)
    # Compile the header copied to the actual ESPHome build, not another copy
    # or a Python-only reimplementation of its sealed response.
    fixture=ROOT/'.build/lite434-wire.cpp'
    text=(ROOT/'tests/profile_wire.cpp').read_text()
    text=text.replace('ports/lite/components/cgdn1_ui/update_profile.h','.build/lite434-app/src/esphome/components/cgdn1_ui/update_profile.h')
    text=text.replace('"2026.11.07-ui25-profile1",2,1,"4.5.8"','"2026.11.08-ui25-434v1",4,1,"4.3.4"')
    fixture.write_text(text)
    binary=ROOT/'.build/lite434-wire'
    subprocess.run(['c++','-std=c++20','-Wall','-Wextra','-Werror','-I'+str(ROOT/'tests/profile_host'),'-I'+str(ROOT),'-I'+str(arduino),'-I'+str(mbed/'include'),str(fixture),str(host/'library/libmbedcrypto.a'),'-o',str(binary)],check=True)
    package=types.ModuleType('qf434_wire');package.__path__=[str(ROOT/'custom_components/qingping_esphome')];sys.modules[package.__name__]=package
    decoder=importlib.import_module(package.__name__+'.device_profile')
    wire=subprocess.check_output([str(binary)])
    value=decoder.decode_profile(wire,base64.b64encode(b'K'*32).decode(),'00AABBCCDDEE','qingping-00aabbccddee-000000000','1234567890abcdef1234567890abcdef')
    assert (value.profile,value.revision,value.public_version,value.source_stock_version)==('lite-434',4,1,'4.3.4')
    assert value.values['ssid']=='test-сеть' and value.values['ota_password']=='test-ota-password'
    assert b'test-ota-password' not in wire
    assert json.loads(subprocess.check_output([str(binary),'invalid']))=={'error':'device_profile_unavailable'}
    print('Actual 4.3.4 exporter / SDK mbedTLS / Python profile roundtrip passed')

if __name__=='__main__':main()
