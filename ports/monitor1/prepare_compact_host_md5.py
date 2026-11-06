#!/usr/bin/env python3
"""Optional compact MD5 backend for the temporary storage-recovery profile.

OpenSSL EVP provider registration pulls megabytes into a static host image.
The recovery profile uses OpenSSL's existing low-level MD5 implementation for
the SDK's unchanged OTA checksum. Noise/libsodium and SHA-256 verification are
independent and unchanged. Normal profiles keep their original EVP code.
This script checks both exact originals before any write; it touches only the
isolated CGS1 SDK. It never connects to a device or reads a credential.
"""
from pathlib import Path
import argparse, difflib, hashlib, importlib.metadata, importlib.util, json, sys
HERE=Path(__file__).resolve().parent
PINS={'md5.h':'1575e66673d2ac218d2eea3f9389be8f4faeaafdacdf087b0ecd4a1d99d64d2a',
      'md5.cpp':'a0e5a5000695c314af4aa1cdbfd0fb59903b8c23fdcbbd324825d65b19f705e0'}
def sha(b):return hashlib.sha256(b).hexdigest()
def once(s,a,b):
    if s.count(a)!=1:raise RuntimeError('SDK anchor changed')
    return s.replace(a,b,1)
def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--apply',action='store_true');args=parser.parse_args()
    if Path(sys.prefix).resolve()!=(HERE/'.venv').resolve() or importlib.metadata.version('esphome')!='2026.10.1':raise RuntimeError('Pinned isolated CGS1 SDK required')
    root=Path(next(iter(importlib.util.find_spec('esphome').submodule_search_locations))).resolve()
    if not root.is_relative_to(HERE/'.venv'):raise RuntimeError('Foreign SDK refused')
    folder=root/'components/md5';backup=HERE/'build/sdk-compact-md5-original';originals={};updates={}
    for name,pin in PINS.items():
        current=(folder/name).read_bytes();old=backup/name
        original=current if sha(current)==pin else old.read_bytes() if old.is_file() and sha(old.read_bytes())==pin else None
        if original is None:raise RuntimeError('Unknown SDK source: '+name)
        s=original.decode()
        if name=='md5.h':
            s=once(s,'#include <openssl/evp.h>','#if defined(CGS1_COMPACT_HOST_MD5)\n#include <openssl/md5.h>\n#else\n#include <openssl/evp.h>\n#endif')
            s=once(s,'  EVP_MD_CTX *ctx_{nullptr};','''#if defined(CGS1_COMPACT_HOST_MD5)
  MD5_CTX compact_ctx_{};
  bool initialized_{false};
#else
  EVP_MD_CTX *ctx_{nullptr};
#endif''')
        else:
            s=once(s,'#ifdef USE_HOST\nMD5Digest::~MD5Digest()', '''#if defined(USE_HOST) && defined(CGS1_COMPACT_HOST_MD5)
// This optional recovery build uses the same OpenSSL MD5 algorithm without
// static EVP/provider registration. Preserve lazy initialization and repeated
// calculate() behavior; the ordinary host implementation below is untouched.
MD5Digest::~MD5Digest() = default;
void MD5Digest::init() {
  MD5_Init(&this->compact_ctx_);
  this->initialized_ = true;
  this->calculated_ = false;
  memset(this->digest_, 0, 16);
}
void MD5Digest::add(const uint8_t *data, size_t len) {
  if (!this->initialized_) this->init();
  MD5_Update(&this->compact_ctx_, data, len);
}
void MD5Digest::calculate() {
  if (!this->initialized_) this->init();
  if (!this->calculated_) {
    MD5_Final(this->digest_, &this->compact_ctx_);
    this->calculated_ = true;
  }
}
#elif defined(USE_HOST)
MD5Digest::~MD5Digest()''')
        update=s.encode()
        if current not in (original,update):raise RuntimeError('Additional SDK changes: '+name)
        originals[name]=original;updates[name]=update
    diff=''.join(''.join(difflib.unified_diff(originals[n].decode().splitlines(True),updates[n].decode().splitlines(True),fromfile='a/components/md5/'+n,tofile='b/components/md5/'+n)) for n in PINS)
    (HERE/'patches/esphome-host-compact-md5.patch').write_text(diff)
    report={'sdk_version':'2026.10.1','macro':'CGS1_COMPACT_HOST_MD5','original_sha256':PINS,'patched_sha256':{n:sha(v) for n,v in updates.items()},'applied':args.apply}
    if args.apply:
        for n,b in originals.items():
            backup.mkdir(parents=True,exist_ok=True);p=backup/n
            if not p.exists():p.write_bytes(b)
            if p.read_bytes()!=b:raise RuntimeError('Backup mismatch')
        for n,b in updates.items():
            p=folder/n;temp=p.with_name(n+'.compact-new')
            if temp.exists():raise RuntimeError('Existing temporary SDK change')
            temp.write_bytes(b);temp.replace(p)
        if any(sha((folder/n).read_bytes())!=sha(b) for n,b in updates.items()):raise RuntimeError('SDK readback mismatch')
    (HERE/'patches/esphome-host-compact-md5.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report))
if __name__=='__main__':main()
