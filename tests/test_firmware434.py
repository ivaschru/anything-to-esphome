"""4.3.4 release isolation: compiled rail policy and real sealed-profile decoder."""
import copy
import json
import secrets
import unittest
from pathlib import Path

import test_firmware_channel as channel_tests
from test_device_profile import profile, sealed, KEY, MAC, NAME, AESGCM
from test_pm_polling_policy import run_component

ROOT=Path(__file__).resolve().parents[1]
channel=channel_tests.channel
VERSION='2026.11.08-ui25-434v1'


def pair():
    meta,binary,raw=channel_tests.pair(1,VERSION,4)
    info=meta['lite'];info['minimum_integration']='0.2.9'
    manifest=json.loads(raw)
    manifest.update(profile='lite-434',hardware='0001',source_stock_version='4.3.4',
                    fan_shutdown=False,pm_policy='lite-434-polling-only-v1')
    return {'lite-434':info},binary,json.dumps(manifest).encode()


class HardwareReleaseTests(unittest.TestCase):
    def test_polling_off_never_cuts_rail_even_during_restore_and_warmup(self):
        result=run_component(ROOT/'ports/lite-434/cgdn1_pm.h')
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)

    def test_independent_one_preserves_two_and_runtime_kits(self):
        old=channel.next_catalog('lite',*channel_tests.pair())
        old['runtime_releases']={'monitor1-s8':{'public_version':1}}
        new=channel.next_catalog('lite-434',*pair(),old)
        self.assertEqual(new['releases'],old['releases'])
        self.assertEqual(new['runtime_releases'],old['runtime_releases'])
        # An old reader ignores the extension and still validates its old map.
        parsed=channel.catalog.parse_catalog(new)
        self.assertEqual(parsed['lite'].display_version,'2')
        own=parsed['lite-434']
        self.assertEqual((own.display_version,own.revision),('1',4))
        self.assertFalse(own.supports_install('0.2.8'))
        self.assertTrue(own.supports_install('0.2.9'))
        self.assertIn('/firmware-lite-434-v1/lite-434-template.bin',own.image.url)
        self.assertEqual(channel.next_catalog('lite-434',*pair(),new),new)
        # Later releases on the older channel must not withdraw the new profile.
        later=channel.next_catalog('lite',*channel_tests.pair(3,'quiet-three',4),new)
        self.assertEqual(later['hardware_releases'],new['hardware_releases'])

    def test_no_cross_profile_asset_or_wrong_stock_or_fan_claim(self):
        old=channel.next_catalog('lite',*channel_tests.pair())
        meta,binary,raw=pair()
        for key,value in [('profile','lite'),('source_stock_version','4.5.8'),('fan_shutdown',True),('pm_policy','quiet-scd4x-window-v1')]:
            bad=json.loads(raw);bad[key]=value
            with self.subTest(key=key),self.assertRaises(ValueError):
                channel.next_catalog('lite-434',meta,binary,json.dumps(bad).encode(),old)
        new=channel.next_catalog('lite-434',meta,binary,raw,old)
        new['hardware_releases']['lite-434']['image']['url']=old['releases']['lite']['image']['url']
        with self.assertRaises(ValueError):channel.catalog.parse_catalog(new)

    def test_legacy_provenance_selects_profile_without_renaming_installed_version(self):
        record={'profile':'lite','hardware':'0001','source_stock_version':'4.3.4','public_version':2}
        before=copy.deepcopy(record)
        self.assertEqual(channel.catalog.device_release_profile(record),'lite-434')
        self.assertEqual(record,before)
        for stock in ('4.5.8','4.2.1',None):
            self.assertEqual(channel.catalog.device_release_profile({**record,'source_stock_version':stock}),'lite')


@unittest.skipIf(AESGCM is None,'cryptography required')
class SealedHardwareProfileTests(unittest.TestCase):
    def test_separate_current_profile_and_stock_binding(self):
        c=secrets.token_hex(16)
        changes={'profile':'lite-434','source_stock_version':'4.3.4','version':VERSION,'revision':4,'public_version':1}
        result=profile.decode_profile(sealed(c,changes=changes),KEY,MAC,NAME,c)
        self.assertEqual((result.profile,result.source_stock_version,result.public_version),('lite-434','4.3.4',1))
        for bad in ({'source_stock_version':'4.5.8'},{'profile':'lite'},{'version':'private-434'},{'revision':3}):
            with self.subTest(bad=bad),self.assertRaises(profile.ProfileError):
                profile.decode_profile(sealed(c,changes={**changes,**bad}),KEY,MAC,NAME,c)
        # A validated history from another profile cannot admit this version.
        wire=sealed(c,changes={**changes,'version':'future-434','revision':5})
        with self.assertRaises(profile.ProfileError):
            profile.decode_profile(wire,KEY,MAC,NAME,c,public_versions={'future-434':5})
        self.assertEqual(profile.decode_profile(wire,KEY,MAC,NAME,c,hardware_versions={'future-434':5}).revision,5)


class HardwareGitPublicationTests(channel_tests.GitChannelTests):
    # Reuse the real bare-Git fixture, but only select the independent profile.
    # Inherited generic transport tests target Lite and stay on its fixture;
    # this additional test verifies both map placement and actual asset names.
    def test_434_atomic_tag_and_catalog_reconciliation(self):
        meta,binary,manifest=pair()
        index=channel.next_catalog('lite-434',meta,binary,manifest,self.index)
        result=channel.publish(self.root,'lite-434',binary,manifest,index,None,self.source,self.root/'434-intent.json')
        self.assertEqual(result['state'],'published')
        self.assertEqual(result['tag'],'firmware-lite-434-v1')
        self.assertEqual(channel.read_object(self.root,result['tag_head'],'lite-434-template.bin'),binary)
        again=channel.publish(self.root,'lite-434',binary,manifest,index,result['catalog_head'],self.source,self.root/'434-intent.json')
        self.assertEqual(again['state'],'already_published')

if __name__=='__main__':unittest.main()
