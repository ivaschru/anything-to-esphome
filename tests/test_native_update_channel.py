"""Native manifests share the actual atomic Git publication transaction."""
import json
import unittest
import test_firmware_channel as fixture
from test_native_update_stream import build, ROOT

channel=fixture.channel

class NativePublicationTests(unittest.TestCase):
    setUp=fixture.GitChannelTests.setUp
    git_external=fixture.GitChannelTests.git_external
    publish=fixture.GitChannelTests.publish

    def set_native(self):
        manifest=json.loads(self.manifest)
        manifest['native_update']={'format':'qingping-native-update-v1','patches':build.patch_table(ROOT,self.binary)}
        self.manifest=json.dumps(manifest).encode()
        self.index=channel.next_catalog('lite',self.meta,self.binary,self.manifest)

    def test_native_manifest_and_public_app_are_one_atomic_release(self):
        self.set_native(); result=self.publish()
        native=channel.read_object(self.root,result['catalog_head'],'native-lite.json')
        self.assertEqual(native,channel.read_object(self.root,result['tag_head'],'native-lite.json'))
        data=json.loads(native)
        self.assertEqual(data['patches'],build.patch_table(ROOT,self.binary))
        self.assertEqual(data['profile'],'lite');self.assertEqual(data['source_stock_version'],'4.5.8')
        self.assertEqual(data['url'],self.index['releases']['lite']['image']['url'])
        self.assertEqual(self.publish(result['catalog_head'])['state'],'already_published')

    def test_native_offsets_must_be_reproduced_not_trusted(self):
        self.set_native(); manifest=json.loads(self.manifest)
        manifest['native_update']['patches'][0][0]+=1
        with self.assertRaises(ValueError):
            channel.native_manifest('lite',self.index['releases']['lite'],self.binary,json.dumps(manifest).encode())

    def test_native_staging_does_not_advertise_the_candidate_in_the_ordinary_index(self):
        old=self.publish();parent=old['catalog_head'];before=self.index
        meta,binary,raw=fixture.pair(3,'native-three',4)
        manifest=json.loads(raw);manifest['native_update']={'format':'qingping-native-update-v1','patches':build.patch_table(ROOT,binary)}
        raw=json.dumps(manifest).encode();index=channel.next_catalog('lite',meta,binary,raw,before)
        stage=channel.publish(self.root,'lite',binary,raw,index,parent,self.source,self.root/'stage.json',stage_native=True)
        self.assertEqual(stage['state'],'staged_native')
        self.assertEqual(json.loads(channel.read_object(self.root,stage['catalog_head'],'firmware-catalog.json')),before)
        self.assertEqual(json.loads(channel.read_object(self.root,stage['catalog_head'],'native-lite.json'))['public_version'],3)
        promoted=channel.publish(self.root,'lite',binary,raw,index,stage['catalog_head'],self.source,self.root/'promote.json')
        self.assertEqual(promoted['tag_head'],stage['tag_head'])
        self.assertEqual(json.loads(channel.read_object(self.root,promoted['catalog_head'],'firmware-catalog.json')),index)

    def test_next_profile_publication_preserves_other_endpoint_bytes(self):
        self.set_native(); result=self.publish(); parent=result['catalog_head']
        other=b'{"fixture":"unrelated exact profile endpoint"}\n'
        files=channel.native_catalog_files(self.root,parent)
        files.update({'firmware-catalog.json':channel.encoded(self.index),'native-lite-434.json':other})
        head=channel.commit(self.root,files,parent,'Synthetic other endpoint')
        channel.git(self.root,'push','origin',head+':'+channel.BRANCH)
        meta,binary,raw=fixture.pair(3,'native-three',4)
        manifest=json.loads(raw);manifest['native_update']={'format':'qingping-native-update-v1','patches':build.patch_table(ROOT,binary)}
        raw=json.dumps(manifest).encode();index=channel.next_catalog('lite',meta,binary,raw,self.index)
        new=self.publish(head,binary=binary,manifest=raw,index=index,intent='second.json')
        self.assertEqual(channel.read_object(self.root,new['catalog_head'],'native-lite-434.json'),other)

    def test_source_archive_in_nested_git_directory_preserves_both_endpoints(self):
        # A clean source archive may live under .build in the shared checkout.
        # Git ls-tree normally filters to cwd; fixed catalog paths are always
        # repository-root paths, independent of the publisher's working folder.
        self.set_native(); first=self.publish(); parent=first['catalog_head']
        other=b'{"fixture":"unrelated exact hardware endpoint"}\n'
        files=channel.native_catalog_files(self.root,parent)
        files.update({'firmware-catalog.json':channel.encoded(self.index),'native-lite-434.json':other})
        head=channel.commit(self.root,files,parent,'Second endpoint before nested publication')
        channel.git(self.root,'push','origin',head+':'+channel.BRANCH)
        meta,binary,raw=fixture.pair(3,'native-three',4)
        manifest=json.loads(raw);manifest['native_update']={'format':'qingping-native-update-v1','patches':build.patch_table(ROOT,binary)}
        raw=json.dumps(manifest).encode();index=channel.next_catalog('lite',meta,binary,raw,self.index)
        nested=self.root/'.build'/'clean-source';nested.mkdir(parents=True)
        result=channel.publish(nested,'lite',binary,raw,index,head,self.source,nested/'intent.json')
        self.assertEqual(channel.read_object(nested,result['catalog_head'],'native-lite-434.json'),other)
        self.assertEqual(json.loads(channel.read_object(nested,result['catalog_head'],'native-lite.json'))['public_version'],3)

if __name__=='__main__':unittest.main()
