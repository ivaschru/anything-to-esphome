"""Real Git source/tag/CAS tests; no private program, profile or device access."""
import copy
import importlib.util
import io
import json
from pathlib import Path
import sys
import tarfile
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
with patch.object(sys, 'path', [str(ROOT/'tools'), *sys.path]):
    spec = importlib.util.spec_from_file_location('monitor1_publication', ROOT/'tools/publish_monitor1.py')
    publisher = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(publisher)
git = publisher.channel.git


class RuntimePublicationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)/'source'
        self.remote = Path(self.temp.name)/'remote.git'
        self.root.mkdir()
        git(self.root, 'init', '--bare', str(self.remote))
        git(self.root, 'init')
        git(self.root, 'config', 'user.name', 'Fixture')
        git(self.root, 'config', 'user.email', 'fixture@example.invalid')
        git(self.root, 'remote', 'add', 'origin', str(self.remote))
        port = self.root/'ports/monitor1'
        port.mkdir(parents=True)
        (port/'release-versions.json').write_bytes((ROOT/'ports/monitor1/release-versions.json').read_bytes())
        (port/'runtime.cpp').write_text('// Synthetic source, not a sensor program\n')
        (self.root/'LICENSE').write_text('Synthetic license fixture')
        self.source = self.commit()
        self.package = publisher.public_source(self.root, self.source)
        self.values = [publisher.manifest(self.root, self.source, profile, self.package) for profile in publisher.PROFILES]
        self.previous = {'format':publisher.channel.catalog.CATALOG_FORMAT, 'releases':{}}

    def commit(self):
        git(self.root, 'add', 'ports', 'LICENSE')
        git(self.root, 'commit', '-m', 'Synthetic public source')
        return git(self.root, 'rev-parse', 'HEAD').decode().strip()

    def publish(self, head=None, previous=None, values=None, intent='intent.json'):
        return publisher.publish(self.root, values or self.values, self.package, head,
                                 previous or self.previous, self.source, self.root/intent)

    def test_source_archive_is_reproducible_and_ignores_dirty_and_untracked_inputs(self):
        (self.root/'ports/monitor1/runtime.cpp').write_text('DIRTY NOT PUBLISHED')
        (self.root/'ports/monitor1/secrets.yaml').write_text('PRIVATE FIXTURE NOT PUBLISHED')
        package = publisher.public_source(self.root, self.source)
        self.assertEqual(package, self.package)
        with tarfile.open(fileobj=io.BytesIO(package), mode='r:gz') as source:
            self.assertEqual(source.extractfile('ports/monitor1/runtime.cpp').read(), b'// Synthetic source, not a sensor program\n')
            self.assertNotIn('ports/monitor1/secrets.yaml',source.getnames())

    def test_tracked_generated_and_symlink_payloads_are_refused(self):
        for name in ('secrets.yaml','program.elf','library.so','archive.zip','build/result.json'):
            p = self.root/'ports/monitor1'/name
            p.parent.mkdir(exist_ok=True)
            p.write_text('synthetic private-looking fixture')
            source = self.commit()
            with self.subTest(name=name), self.assertRaises(ValueError):
                publisher.public_source(self.root, source)
            p.unlink()
        p = self.root/'ports/monitor1/link'
        p.symlink_to('runtime.cpp')
        source = self.commit()
        with self.assertRaises(ValueError):publisher.public_source(self.root,source)

    def test_distinct_hardware_and_explicit_delivery_never_enable_an_ota(self):
        self.assertEqual([v['hardware']['co2_type'] for v in self.values],[2,3])
        value = publisher.next_index(self.previous,self.values)
        self.assertEqual(publisher.channel.catalog.parse_catalog(value),{})
        for item in value['runtime_releases'].values():
            self.assertFalse(item['qualification']['automatic_update_ready'])
            self.assertFalse(item['qualification']['initial_installation_ready'])
            self.assertNotIn('image',item)
        with self.assertRaises(ValueError):publisher.manifest(self.root,self.source,'lite-mcu421',self.package)

    def test_atomic_two_profile_publication_and_idempotent_readback(self):
        result = self.publish()
        self.assertEqual(result['state'],'published')
        for ref, head in result['refs'].items():
            self.assertEqual(publisher.channel.remote_ref(self.root,ref),head)
            self.assertEqual(publisher.channel.read_object(self.root,head,'monitor1-runtime-source.tar.gz'),self.package)
        previous = json.loads(publisher.channel.read_object(self.root,result['catalog_head'],'firmware-catalog.json'))
        again = self.publish(result['catalog_head'],previous)
        self.assertEqual(again['state'],'already_published')
        self.assertEqual(again['catalog_head'],result['catalog_head'])

    def test_existing_versions_and_tags_cannot_be_relabelled(self):
        result = self.publish()
        old = publisher.next_index(self.previous,self.values)
        changed = copy.deepcopy(self.values)
        changed[0]['source_commit'] = '1'*40
        with self.assertRaises(ValueError):publisher.next_index(old,changed)
        with self.assertRaises(ValueError):self.publish(result['catalog_head'],values=changed,intent='changed.json')
        self.assertFalse((self.root/'changed.json').exists())

    def test_catalog_race_leaves_no_partial_tags(self):
        original = publisher.channel.save_intent
        def race(path,value):
            original(path,value)
            competing=publisher.channel.commit(self.root,{'firmware-catalog.json':publisher.encoded(self.previous)},None,'Competing index')
            git(self.root,'push','origin',competing+':'+publisher.channel.BRANCH)
        with patch.object(publisher.channel,'save_intent',side_effect=race),self.assertRaises(RuntimeError):
            self.publish()
        for profile in publisher.PROFILES:
            self.assertIsNone(publisher.channel.remote_ref(self.root,'refs/tags/firmware-'+profile+'-v1'))
        self.assertTrue((self.root/'intent.json').exists())


if __name__ == '__main__':unittest.main()
