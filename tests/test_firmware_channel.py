"""Independent firmware publication, including actual atomic Git fixture IO.

No GitHub token, HTTP mutation, HA call or physical monitor is used. The bare
remote is a temporary directory; the immutable tag and CAS conflict are real.
"""
import copy
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import test_firmware_catalog_build as fixtures

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('channel',ROOT/'tools/publish_firmware.py')
channel=importlib.util.module_from_spec(spec);spec.loader.exec_module(channel)


def pair(number=2,version='quiet-two',revision=3):
    helper=fixtures.FirmwarePublisherTests();binary,manifest=helper.pair(version,number)
    metadata=helper.metadata(version,revision);metadata['lite'].update(public_version=number,minimum_integration='0.2.1')
    return metadata,binary,manifest


class ChannelTests(unittest.TestCase):
    def test_exact_rehosting_does_not_manufacture_an_ota(self):
        meta,binary,manifest=pair()
        old=channel.legacy.build('v0.2.1',meta,binary,manifest)
        result=channel.next_catalog('lite',meta,binary,manifest,old)
        release=channel.catalog.parse_catalog(result)['lite']
        self.assertEqual((release.public_version,release.revision,release.version),(2,3,'quiet-two'))
        self.assertEqual(release.image.sha256,old['releases']['lite']['image']['sha256'])
        self.assertEqual(release.minimum_integration,'0.2.2')
        self.assertIn('/firmware-lite-v2/',release.image.url)
        self.assertFalse(release.supports_install('0.2.1'))
        self.assertTrue(release.supports_install('0.2.2'))

    def test_firmware_three_does_not_bump_or_package_the_plugin(self):
        before=(ROOT/'custom_components/qingping_esphome/manifest.json').read_bytes()
        meta,binary,manifest=pair();old=channel.next_catalog('lite',meta,binary,manifest)
        meta,binary,manifest=pair(3,'quiet-three',4)
        new=channel.next_catalog('lite',meta,binary,manifest,old)
        release=channel.catalog.parse_catalog(new)['lite']
        self.assertEqual(release.display_version,'3')
        self.assertTrue(release.supports_install('0.2.2'))
        self.assertIn(('quiet-two',3),release.adoption_versions)
        self.assertEqual((ROOT/'custom_components/qingping_esphome/manifest.json').read_bytes(),before)
        workflow=(ROOT/'.github/workflows/firmware.yml').read_text()
        self.assertNotIn('run: python tools/package_release.py',workflow)
        self.assertNotIn('gh release create', '\n'.join(x for x in workflow.splitlines() if not x.lstrip().startswith('#')))

    def test_url_tag_profile_number_and_origin_are_bound(self):
        meta,binary,manifest=pair();good=channel.next_catalog('lite',meta,binary,manifest)
        for target in ('https://raw.githubusercontent.com/ivaschru/qingping-esphome/main/lite-template.bin',
                       'https://raw.githubusercontent.com/ivaschru/qingping-esphome/firmware-catalog/lite-template.bin',
                       'https://raw.githubusercontent.com/ivaschru/qingping-esphome/firmware-monitor1-s8-v2/lite-template.bin',
                       'https://raw.githubusercontent.com/ivaschru/qingping-esphome/firmware-lite-v3/lite-template.bin',
                       'https://raw.githubusercontent.com/other/repo/firmware-lite-v2/lite-template.bin',
                       'https://raw.githubusercontent.com/ivaschru/qingping-esphome/firmware-lite-v2/lite-template.bin?secret=bad'):
            value=copy.deepcopy(good);value['releases']['lite']['image']['url']=target
            with self.subTest(url=target),self.assertRaises(channel.catalog.FirmwareError):channel.catalog.parse_catalog(value)

    def test_original_manifest_must_not_change_during_rehosting(self):
        meta,binary,manifest=pair();old=channel.legacy.build('v0.2.1',meta,binary,manifest)
        changed=json.loads(manifest);changed['new_metadata']='different'
        with self.assertRaises(ValueError):channel.next_catalog('lite',meta,binary,json.dumps(changed).encode(),old)

    def test_unqualified_profiles_and_non_monotonic_firmware_refused(self):
        meta,binary,manifest=pair();old=channel.next_catalog('lite',meta,binary,manifest)
        for profile in ('monitor1-s8','lite-mcu421','monitor2'):
            with self.assertRaises(ValueError):channel.next_catalog(profile,meta,binary,manifest,old)
        meta,binary,manifest=pair(2,'changed-but-still-two',4)
        with self.assertRaises(ValueError):channel.next_catalog('lite',meta,binary,manifest,old)


class GitChannelTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name)/'work';self.remote=Path(self.tmp.name)/'remote.git'
        self.root.mkdir();self.git_external('init','--bare',str(self.remote));self.git_external('init',str(self.root))
        channel.git(self.root,'config','user.name','Fixture');channel.git(self.root,'config','user.email','fixture@example.invalid')
        channel.git(self.root,'remote','add','origin',str(self.remote))
        (self.root/'source.txt').write_text('Synthetic source; never a firmware input')
        channel.git(self.root,'add','source.txt');channel.git(self.root,'commit','-m','Synthetic source')
        self.source=channel.git(self.root,'rev-parse','HEAD').decode().strip()
        self.meta,self.binary,self.manifest=pair();self.index=channel.next_catalog('lite',self.meta,self.binary,self.manifest)

    def git_external(self,*args):subprocess.run(['git',*args],stdout=subprocess.PIPE,stderr=subprocess.PIPE,check=True)
    def publish(self,head=None,**kw):
        return channel.publish(self.root,'lite',kw.get('binary',self.binary),kw.get('manifest',self.manifest),kw.get('index',self.index),head,self.source,self.root/kw.get('intent','intent.json'))

    def test_real_first_publication_and_idempotent_reconciliation(self):
        result=self.publish();self.assertEqual(result['state'],'published')
        self.assertEqual(channel.remote_ref(self.root,channel.BRANCH),result['catalog_head'])
        self.assertEqual(channel.read_object(self.root,result['tag_head'],'lite-template.bin'),self.binary)
        self.assertEqual(json.loads(channel.read_object(self.root,result['tag_head'],'release.json'))['source_commit'],self.source)
        again=self.publish(result['catalog_head'])
        self.assertEqual(again['state'],'already_published')
        self.assertEqual(again['catalog_head'],result['catalog_head'])

    def test_stale_publisher_cannot_publish_a_tag_or_replace_the_catalog(self):
        result=self.publish();meta,binary,manifest=pair(3,'three',4)
        index=channel.next_catalog('lite',meta,binary,manifest,self.index)
        with self.assertRaises(RuntimeError):self.publish(binary=binary,manifest=manifest,index=index,intent='stale.json')
        self.assertIsNone(channel.remote_ref(self.root,'refs/tags/firmware-lite-v3'))
        self.assertEqual(channel.remote_ref(self.root,channel.BRANCH),result['catalog_head'])
        self.assertFalse((self.root/'stale.json').exists())

    def test_existing_tag_never_replaced_by_different_bytes(self):
        result=self.publish();meta,binary,manifest=pair(2,'different-two',3)
        index=channel.next_catalog('lite',meta,binary,manifest)
        with self.assertRaises(ValueError):self.publish(result['catalog_head'],binary=binary,manifest=manifest,index=index,intent='different.json')
        self.assertEqual(channel.remote_ref(self.root,'refs/tags/firmware-lite-v2'),result['tag_head'])

    def test_atomic_push_refuses_a_racing_catalog_update(self):
        result=self.publish();head=result['catalog_head']
        meta,binary,manifest=pair(3,'three',4);index=channel.next_catalog('lite',meta,binary,manifest,self.index)
        original=channel.save_intent
        def race(path,value):
            original(path,value)
            competing=channel.commit(self.root,{'firmware-catalog.json':channel.encoded(self.index)},head,'Concurrent publisher')
            channel.git(self.root,'push','origin',competing+':'+channel.BRANCH)
        with patch.object(channel,'save_intent',side_effect=race),self.assertRaises(RuntimeError):
            self.publish(head,binary=binary,manifest=manifest,index=index,intent='race.json')
        # --atomic means neither our new tag nor our catalog generation landed.
        self.assertIsNone(channel.remote_ref(self.root,'refs/tags/firmware-lite-v3'))
        self.assertTrue((self.root/'race.json').exists())

if __name__=='__main__':unittest.main()
