import assert from 'node:assert/strict';
import {digestLineMatches,sourceFileObservationMatches} from '../custom_components/qingping_esphome/frontend/usb-file-observation.mjs';
const file={path:'/usr/lib/synthetic.so.1',sha256:'a'.repeat(64),size:123};
for(const separator of [' ','  ']) {
 assert(digestLineMatches(file.sha256+separator+file.path,file.sha256,file.path));
 assert(sourceFileObservationMatches('123 1\n'+file.sha256+separator+file.path,file));
}
for(const line of [file.sha256+'   '+file.path,file.sha256+'\t'+file.path,file.sha256+' *'+file.path,
 'b'.repeat(64)+' '+file.path,file.sha256+' '+file.path+'.other',file.sha256+' '+file.path+'\nextra',file.sha256+' '+file.path+'\0'])
 assert.equal(digestLineMatches(line,file.sha256,file.path),false);
for(const text of ['124 1\n'+file.sha256+' '+file.path,'123 2\n'+file.sha256+' '+file.path,
 '123 1\nextra\n'+file.sha256+' '+file.path,'123 1 \n'+file.sha256+' '+file.path])
 assert.equal(sourceFileObservationMatches(text,file),false);
assert.equal(digestLineMatches('a'.repeat(64)+' /../escape','a'.repeat(64),'/../escape'),false);
assert(digestLineMatches('a'.repeat(64)+'  /usr/lib/libstdc++.so.6.0.20','a'.repeat(64),'/usr/lib/libstdc++.so.6.0.20'));
console.log('SHA observations: standard/legacy delimiters only, exact bytes/path/stat/line count and malformed refusal passed');
