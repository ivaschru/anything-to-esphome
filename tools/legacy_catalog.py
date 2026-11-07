#!/usr/bin/env python3
"""Keep pre-0.2.2 readers usable without advancing their frozen firmware feed.

This compatibility asset is not the new catalog. Every HACS release copies the
same last legacy index, whose immutable URLs remain on v0.2.1. Future firmware
publishing never changes it or creates a HACS version. Remove only after an
explicit migration policy; a failed download must not invent an empty catalog.
"""
import hashlib
from pathlib import Path
from urllib.request import urlopen

URL='https://github.com/ivaschru/qingping-esphome/releases/download/v0.2.1/firmware-catalog.json'
SHA='74ee04dd17142ab4e0d1835427714e8ac2ed02e7d179ee7f8c22fe094662125e'

def main():
    with urlopen(URL,timeout=30) as response:raw=response.read(65537)
    if hashlib.sha256(raw).hexdigest()!=SHA:raise ValueError('Legacy catalog differs')
    output=Path(__file__).resolve().parents[1]/'.build/legacy-feed/firmware-catalog.json'
    output.parent.mkdir(parents=True,exist_ok=True)
    with output.open('xb') as stream:stream.write(raw)
    print(output)

if __name__=='__main__':main()
