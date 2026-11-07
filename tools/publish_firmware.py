#!/usr/bin/env python3
"""Publish one qualified profile without a HACS Release or integration version.

Dry-run is the default. The immutable firmware tag holds public placeholders,
its original manifest and source provenance. A separate catalog branch moves
with a compare-and-swap. Both refs are pushed atomically; a network error never
causes automatic resend, tag replacement or rollback. --status only reads.
"""
from __future__ import annotations
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
from urllib.request import urlopen

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('qf_legacy_publisher',Path(__file__).with_name('build_firmware_catalog.py'))
legacy=importlib.util.module_from_spec(spec);spec.loader.exec_module(legacy)
catalog=legacy.catalog
BRANCH='refs/heads/'+catalog.CATALOG_BRANCH
CHANNEL_MINIMUM='0.2.2'


def encoded(value):return (json.dumps(value,indent=2,sort_keys=True)+'\n').encode()
def sha(data):return hashlib.sha256(data).hexdigest()


def next_catalog(profile,metadata,binary,manifest_bytes,previous=None):
    """Reuse audited admission/order/history rules, then select the data channel.

    Rehosting the exact current pair bootstraps the channel without pretending
    it is a new device firmware. An altered manifest under the same app version
    is refused too. Other profile entries are preserved byte-for-byte as values.
    Only Lite currently has a qualified compiler/personalizer/update backend.
    """
    if profile!='lite' or set(metadata)!={profile}:raise ValueError('Unqualified publisher profile')
    info=metadata[profile];version=info.get('public_version');tag=catalog.firmware_tag(profile,version)
    value=legacy.build('v0.0.0',metadata,binary,manifest_bytes,previous)
    entry=dict(value['releases'][profile]);old=(previous or {}).get('releases',{}).get(profile)
    if old and old['image']['sha256']==sha(binary) and old['manifest']['sha256']!=sha(manifest_bytes):
        raise ValueError('Same firmware cannot replace its original manifest')
    prefix=f'https://raw.githubusercontent.com/{catalog.REPOSITORY}/{tag}/'
    for name,data in (('image',binary),('manifest',manifest_bytes)):
        filename='lite-template.'+('bin' if name=='image' else 'json')
        entry[name]={'url':prefix+filename,'sha256':sha(data),'size':len(data)}
    # Old readers do not know this transport, even when device bytes are the
    # already-qualified Lite 2. Do not change the firmware-source metadata to
    # express a catalog-transport floor: that would force a fake firmware build.
    entry['minimum_integration']='.'.join(map(str,max(tuple(map(int,entry['minimum_integration'].split('.'))),tuple(map(int,CHANNEL_MINIMUM.split('.'))))))
    entry['release_url']=f'https://github.com/{catalog.REPOSITORY}/tree/{tag}'
    # Source-built Linux runtime releases share the index but have no ESP32
    # image/backend. A later Lite release must preserve that separate section,
    # rather than silently withdrawing already published runtime kits.
    if previous and 'runtime_releases' in previous:
        value['runtime_releases']=previous['runtime_releases']
    value['releases'][profile]=entry;catalog.parse_catalog(value)
    if len(encoded(value))>catalog.MAX_INDEX_BYTES:raise ValueError('Oversized next catalog')
    return value


def git(root,*args,data=None,ok=(0,)):
    result=subprocess.run(['git',*args],cwd=root,input=data,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    if result.returncode not in ok:raise RuntimeError('Git operation failed; inspect refs before another write')
    return result.stdout


def remote_ref(root,ref):
    raw=git(root,'ls-remote','--exit-code','origin',ref,ok=(0,2)).decode().strip()
    if not raw:return None
    lines=raw.splitlines()
    if len(lines)!=1 or lines[0].split()[1]!=ref:raise RuntimeError('Ambiguous remote ref')
    value=lines[0].split()[0]
    if len(value)!=40 or any(c not in '0123456789abcdef' for c in value):raise RuntimeError('Invalid remote object')
    return value


def read_object(root,commit,path):return git(root,'show',commit+':'+path)

def fetch_object(root,commit):git(root,'fetch','--no-tags','origin',commit)


def previous_catalog(root):
    head=remote_ref(root,BRANCH)
    if head:
        fetch_object(root,head)
        raw=read_object(root,head,'firmware-catalog.json')
    else:
        # Explicit first-publication migration only. A timeout, invalid index
        # or an existing unreadable branch is never interpreted as an empty
        # catalog, nor does it select an older release as a runtime fallback.
        with urlopen(catalog.LEGACY_CATALOG_URL,timeout=30) as response:raw=response.read(catalog.MAX_INDEX_BYTES+1)
    if len(raw)>catalog.MAX_INDEX_BYTES:raise ValueError('Oversized previous catalog')
    value=json.loads(raw);catalog.parse_catalog(value)
    return head,value


def tree(root,files):
    entries=[]
    for path,data in sorted(files.items()):
        # All callers supply fixed top-level paths, never archive/member input.
        if '/' in path or not path or '\t' in path or '\n' in path:raise ValueError('Unsafe publication path')
        blob=git(root,'hash-object','-w','--stdin',data=data).decode().strip()
        entries.append(f'100644 blob {blob}\t{path}\n')
    return git(root,'mktree',data=''.join(entries).encode()).decode().strip()


def commit(root,files,parent,message):
    arguments=['commit-tree',tree(root,files)]
    if parent:arguments+=['-p',parent]
    return git(root,*arguments,data=(message+'\n').encode()).decode().strip()


def save_intent(path,value):
    path.parent.mkdir(parents=True,exist_ok=True)
    fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
    with os.fdopen(fd,'wb') as stream:stream.write(encoded(value));stream.flush();os.fsync(stream.fileno())
    dfd=os.open(path.parent,os.O_RDONLY)
    try:os.fsync(dfd)
    finally:os.close(dfd)


def publish(root,profile,binary,manifest_bytes,index,expected_head,source_commit,intent):
    """Create-only tag plus catalog CAS, sharing one atomic remote transaction.

    Existing identical tags are reconciled, never recreated. A stale catalog
    ref or a consumed local intent refuses before the push. Tests exercise the
    actual Git transport against private bare fixture repositories.
    """
    entry=index['releases'][profile];tag=catalog.firmware_tag(profile,entry['public_version']);ref='refs/tags/'+tag
    if remote_ref(root,BRANCH)!=expected_head:raise RuntimeError('Catalog changed; prepare a new plan')
    existing=remote_ref(root,ref)
    files={'lite-template.bin':binary,'lite-template.json':manifest_bytes}
    if existing:
        fetch_object(root,existing)
        if any(read_object(root,existing,name)!=data for name,data in files.items()):raise ValueError('Immutable firmware tag differs')
        provenance=json.loads(read_object(root,existing,'release.json'))
        if provenance['profile']!=profile or provenance['public_version']!=entry['public_version']:
            raise ValueError('Immutable firmware identity differs')
        tag_head=existing
    else:
        provenance={'profile':profile,'public_version':entry['public_version'],'source_commit':source_commit,
                    'image_sha256':sha(binary),'manifest_sha256':sha(manifest_bytes)}
        files['release.json']=encoded(provenance)
        files['README.md']=(f'# {profile} firmware {entry["public_version"]}\n\nPublic-placeholder application and original manifest.\nSource: https://github.com/{catalog.REPOSITORY}/tree/{source_commit}\n\nPersonalize locally through Qingping ESPHome; never boot this template directly.\n').encode()
        tag_head=commit(root,files,source_commit,'Publish '+tag+' public assets')
    if expected_head and json.loads(read_object(root,expected_head,'firmware-catalog.json'))==index:
        if not existing:raise RuntimeError('Catalog points to a missing firmware tag')
        return {'state':'already_published','tag':tag,'catalog_head':expected_head}
    next_head=commit(root,{'firmware-catalog.json':encoded(index)},expected_head,'Index '+tag)
    value={'tag':tag,'tag_head':tag_head,'expected_catalog_head':expected_head,'catalog_head':next_head,
           'image_sha256':sha(binary),'source_commit':source_commit,'state':'consumed_before_atomic_push'}
    save_intent(intent,value)
    # No force on the tag. A published tag cannot be silently replaced by a
    # source/HACS-only change. The catalog lease also protects initial creation.
    git(root,'push','--atomic',f'--force-with-lease={BRANCH}:{expected_head or ""}',
        'origin',f'{tag_head}:{ref}',f'{next_head}:{BRANCH}')
    if remote_ref(root,ref)!=tag_head or remote_ref(root,BRANCH)!=next_head:
        raise RuntimeError('Publication reply requires read-only reconciliation')
    return {**value,'state':'published'}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--profile',required=True,choices=('lite',))
    parser.add_argument('--publish',action='store_true')
    parser.add_argument('--status',action='store_true')
    parser.add_argument('--source-commit',help='Exact reviewed source SHA; defaults to the Actions commit/HEAD')
    args=parser.parse_args()
    if args.status:
        print(json.dumps({'catalog_head':remote_ref(ROOT,BRANCH),'catalog_url':catalog.CATALOG_URL}));return
    metadata=json.loads((ROOT/'firmware/releases.json').read_text())
    folder=ROOT/'custom_components/qingping_esphome/firmware'
    binary=(folder/'lite-template.bin').read_bytes();manifest_bytes=(folder/'lite-template.json').read_bytes()
    manifest=json.loads(manifest_bytes)
    # Bind publication to exact reviewed inputs, not a convenient local build.
    # `ROOT` may be an isolated archive inside a shared dirty checkout; verify
    # the explicit commit's files instead of accidentally using its parent's HEAD.
    from firmware_source import source_digest,RECIPE_PATHS
    from pm_policy import POLICY,digest as pm_digest
    source=args.source_commit or os.environ.get('GITHUB_SHA') or git(ROOT,'rev-parse','HEAD').decode().strip()
    if len(source)!=40 or any(c not in '0123456789abcdef' for c in source):raise ValueError('Exact source SHA required')
    paths=[p.relative_to(ROOT).as_posix() for p in (ROOT/'ports/lite').rglob('*') if p.is_file() and '__pycache__' not in p.parts and '.esphome' not in p.parts and p.suffix!='.pyc' and p.name!='secrets.yaml']
    paths+=list(RECIPE_PATHS)+['tools/publish_firmware.py','tools/build_firmware_catalog.py','custom_components/qingping_esphome/firmware_catalog.py']
    for name in set(paths):
        if read_object(ROOT,source,name)!=(ROOT/name).read_bytes():raise ValueError('Uncommitted publication source')
    if (manifest.get('release_source_sha256')!=source_digest(ROOT) or manifest.get('pm_policy')!=POLICY
            or manifest.get('pm_source_sha256')!=pm_digest(ROOT)):
        raise ValueError('Public build does not match its committed source/policy')
    head,previous=previous_catalog(ROOT)
    index=next_catalog(args.profile,metadata,binary,manifest_bytes,previous)
    tag=catalog.firmware_tag(args.profile,index['releases'][args.profile]['public_version'])
    if args.publish:
        result=publish(ROOT,args.profile,binary,manifest_bytes,index,head,source,ROOT/'.build/firmware-publication'/tag/'intent.json')
    else:result={'state':'dry_run','tag':tag,'source_commit':source,'expected_catalog_head':head,'catalog':index}
    print(json.dumps(result,indent=2))


if __name__=='__main__':
    try:main()
    except Exception as error:
        # No signed CDN URL, Git remote auth configuration or raw network
        # response reaches public Actions logs. Known local policy text only.
        reason=str(error) if type(error) in (ValueError,RuntimeError) else type(error).__name__
        print('Firmware publication refused: '+reason,file=sys.stderr);raise SystemExit(1) from None
