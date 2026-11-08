"""Compare the real C++ streaming personalizer with the existing Python one.

Only temporary synthetic apps/public templates are inputs. The executable has
no HTTP/OTA/device access. ASan/UBSan cover chunk boundaries and corrupt layout.
"""
import hashlib
import importlib.util
import json
from pathlib import Path
import shlex
import struct
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("native_build", ROOT / "tools/native_update_build.py")
build = importlib.util.module_from_spec(spec); spec.loader.exec_module(build)
image = build.image_module(ROOT)

CPP = r'''
#include "verified_stream.h"
#include <openssl/evp.h>
#include <fstream>
#include <iterator>
#include <iostream>
struct Digest {
  EVP_MD_CTX *ctx = EVP_MD_CTX_new(); uint8_t result[32]{};
  ~Digest() { EVP_MD_CTX_free(ctx); }
  void init() { EVP_DigestInit_ex(ctx, EVP_sha256(), nullptr); }
  void add(const uint8_t *p, size_t n) { EVP_DigestUpdate(ctx,p,n); }
  void calculate() { EVP_DigestFinal_ex(ctx,result,nullptr); }
  void get_bytes(uint8_t *out) { memcpy(out,result,32); }
  bool equals_hex(const char *expected) {
    static const char *digits="0123456789abcdef";
    std::string hex;for(auto b:result){hex+=digits[b>>4];hex+=digits[b&15];}
    return hex==expected;
  }
};
int main(int argc, char **argv) {
  if(argc!=7) return 9;
  using namespace esphome::qf_native_update;
  std::ifstream input(argv[1],std::ios::binary);
  std::vector<uint8_t> bytes((std::istreambuf_iterator<char>(input)),{});
  std::ifstream table(argv[2]); std::vector<Patch> patches;
  unsigned offset,slot; while(table>>offset>>slot) patches.push_back({offset,uint8_t(slot)});
  Values values; std::ifstream config(argv[3],std::ios::binary);
  for(auto &v:values) { uint32_t n=0; config.read(reinterpret_cast<char*>(&n),4); v.resize(n); config.read(v.data(),n); }
  const size_t chunk=std::stoul(argv[4]);
  VerifiedImageStream<Digest> stream(bytes.size(),patches,values);
  for(size_t i=0;i<bytes.size();i+=chunk) if(!stream.push(bytes.data()+i,std::min(chunk,bytes.size()-i))) return 2;
  if(!stream.verified(argv[6]))return 3;
  if(stream.verified(argv[6]))return 4; // a finalized stream cannot be reused
  std::ofstream out(argv[5],std::ios::binary);out.write(reinterpret_cast<char*>(bytes.data()),bytes.size());
}
'''

def synthetic():
    # Two real ESP32 segments exercise segment-header/checksum padding paths.
    blocks = [b"test-public-ui\0" + b"\0".join(list(image.SLOTS.values())[:5]),
              b"\0".join(list(image.SLOTS.values())[5:]) + b"\x13\x37"]
    header = bytearray(24); header[0] = 0xe9; header[1] = len(blocks); header[23] = 1
    data = bytes(header); checksum = 0xef
    for block in blocks:
        data += struct.pack("<II", 0x3f400020, len(block)) + block
        for b in block: checksum ^= b
    data += b"\0" * (15 - len(data) % 16) + bytes([checksum])
    return data + hashlib.sha256(data).digest()

def values():
    return {key: b"x" * 32 if key == "noise_psk" else b"q" * 31 if key == "name"
            else b"sensor.fixture" if key == "display_feed_entity" else b"4.5.8" if key == "source_stock_version"
            else b"example-password" for key in image.SLOTS}

def canonical(binary, conf):
    return image.personalize(binary,{k:v if k == "noise_psk" else v.decode() for k,v in conf.items()},
                             hashlib.sha256(binary).hexdigest())[:-4]

class NativeStreamTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory(); cls.folder = Path(cls.tmp.name)
        source = cls.folder / "stream.cpp"; source.write_text(CPP)
        flags = shlex.split(subprocess.check_output(["pkg-config", "--cflags", "--libs", "openssl"], text=True))
        cls.exe = cls.folder / "stream"
        subprocess.run(["c++", "-std=c++17", "-Wall", "-Wextra", "-Werror", "-fsanitize=address,undefined",
                        "-fno-omit-frame-pointer", "-I"+str(ROOT / "ports/lite/components/qf_native_update"),
                        str(source), *flags, "-o", str(cls.exe)], check=True, capture_output=True)
    @classmethod
    def tearDownClass(cls): cls.tmp.cleanup()
    def run_stream(self, binary, patches=None, config=None, chunk=37, expected=None):
        folder = self.folder
        (folder / "input.bin").write_bytes(binary)
        patches = build.patch_table(ROOT, binary) if patches is None else patches
        (folder / "patches.txt").write_text("\n".join(f"{offset} {slot}" for offset,slot in patches))
        conf = values() if config is None else config
        (folder / "values.bin").write_bytes(b"".join(struct.pack("<I",len(v))+v for v in conf.values()))
        result = subprocess.run([str(self.exe),str(folder / "input.bin"),str(folder / "patches.txt"),
                                 str(folder / "values.bin"),str(chunk),str(folder / "output.bin"),
                                 hashlib.sha256(binary).hexdigest() if expected is None else expected],capture_output=True)
        self.assertNotIn(b"Sanitizer", result.stderr)
        return result.returncode, (folder / "output.bin").read_bytes() if result.returncode == 0 else None
    def test_decoder_is_generated_and_not_personalized_itself(self):
        self.assertEqual((ROOT / "ports/lite/components/qf_native_update/slot_markers.h").read_text(),build.marker_header(ROOT))
        text = (ROOT / "ports/lite/components/qf_native_update/slot_markers.h").read_bytes()
        for marker in image.SLOTS.values(): self.assertNotIn(marker,text)
    def test_all_chunk_boundaries_match_canonical_personalizer(self):
        binary=synthetic(); conf=values()
        expected=canonical(binary,conf)
        for n in (1,2,3,7,23,24,31,32,33,63,64,65,97,1024,2048):
            with self.subTest(chunk=n):
                code,actual=self.run_stream(binary,config=conf,chunk=n)
                self.assertEqual(code,0); self.assertEqual(actual,expected); image.layout(actual)
    def test_corrupt_layout_markers_checksum_and_extra_bytes_refused(self):
        binary=synthetic(); patches=build.patch_table(ROOT,binary)
        for at in (0,1,12,23,28,patches[0][0],image.layout(binary)[1]):
            bad=bytearray(binary);bad[at]^=255
            with self.subTest(offset=at): self.assertNotEqual(self.run_stream(bad,patches=patches)[0],0)
        self.assertNotEqual(self.run_stream(binary+b'x',patches=patches)[0],0)
        self.assertNotEqual(self.run_stream(binary[:-1],patches=patches)[0],0)
    def test_missing_overlapping_outside_and_unsorted_patch_tables_refused(self):
        binary=synthetic(); patches=build.patch_table(ROOT,binary)
        variants=[patches[1:],patches[::-1],[[24,patches[0][1]],*patches[1:]],
                  [[patches[0][0],255],*patches[1:]], [patches[0],patches[0],*patches[1:]]]
        for bad in variants: self.assertNotEqual(self.run_stream(binary,patches=bad)[0],0)
    def test_truncated_and_placeholder_private_values_refused(self):
        binary=synthetic()
        for key in image.SLOTS:
            conf=values();conf[key]=image.SLOTS[key]
            with self.subTest(key=key): self.assertNotEqual(self.run_stream(binary,config=conf)[0],0)
        for key,v in (("name",b"short"),("noise_psk",b"short"),("ssid",b"a\0b"),("ota_password",b"z"*64)):
            conf=values();conf[key]=v;self.assertNotEqual(self.run_stream(binary,config=conf)[0],0)
    def test_full_original_digest_required_including_the_trailer(self):
        binary=synthetic();expected=hashlib.sha256(binary).hexdigest();patches=build.patch_table(ROOT,binary)
        self.assertNotEqual(self.run_stream(binary,expected="0"*64)[0],0)
        bad=bytearray(binary);bad[-1]^=1
        self.assertNotEqual(self.run_stream(bad,patches=patches,expected=expected)[0],0)
    def test_actual_public_build_matches_if_available(self):
        binary_path=ROOT / "custom_components/qingping_esphome/firmware/lite-template.bin"
        if not binary_path.is_file(): self.skipTest("Public SDK build not present")
        binary=binary_path.read_bytes();conf=values()
        code,actual=self.run_stream(binary,config=conf,chunk=2048)
        self.assertEqual(code,0)
        self.assertEqual(actual,canonical(binary,conf))

if __name__ == "__main__": unittest.main()
