/** Pure complete-line decoding of frozen START/CHILD/END records.
 * Birth ticks stay decimal strings: JSON numbers must not round uint64 values.
 * A reported stamp is evidence only. It never adopts a PID, admits an image
 * FD, grants a signal/fork or proves the independent device timer/API/stock
 * conditions. The future reader must retain its original stream and order.
 */
import {initialGuardianContract as abi} from './usb-initial-guardian-contract.mjs';
const fail=()=>{throw {code:'usb_browser_scope_unverified'};};
function decimal(value,min,max) {
 if(typeof value!=='string' || !/^(0|[1-9][0-9]*)$/.test(value) || value.length>20)fail();
 const n=BigInt(value);if(n<min || n>max)fail();return value;
}
const birth=v=>decimal(v,1n,(1n<<64n)-1n);
const pid=v=>Number(decimal(v,2n,2147483647n));
function expectedStamp(value) {
 if(!Array.isArray(value) || value.length!==2 || !Number.isInteger(value[0]) || value[0]<2 || value[0]>2147483647)fail();
 birth(value[1]);return value;
}
export function initialGuardianRecord(line,nonce,expectedGuardian=null) {
 if(typeof line!=='string' || line.length>512 || /[^\x01-\x7f]/.test(line) ||
    typeof nonce!=='string' || !/^[a-f0-9]{32}$/.test(nonce))fail();
 if(line.endsWith('\r\n'))line=line.slice(0,-2);
 else if(line.endsWith('\n'))line=line.slice(0,-1);
 else fail(); // A truncated stdout prefix cannot become a complete record.
 const f=line.split(' ');if(f.some(v=>!v.length) || f[1]!==nonce)fail();
 if(f[0]===abi.markers.start || f[0]===abi.markers.child) {
  if(f.length!==4 || f[0]===abi.markers.start && expectedGuardian!==null)fail();
  const stamp=Object.freeze([pid(f[2]),birth(f[3])]);
  if(expectedGuardian!==null && expectedStamp(expectedGuardian)[0]===stamp[0])fail();
  return Object.freeze({kind:f[0]===abi.markers.start?'start':'child',nonce,stamp});
 }
 if(f[0]!==abi.markers.end || f.length!==12 || expectedGuardian===null)fail();
 const guardian=Object.freeze([pid(f[2]),birth(f[3])]),child=Object.freeze([pid(f[4]),birth(f[5])]);
 const expected=expectedStamp(expectedGuardian);
 if(guardian[0]!==expected[0] || guardian[1]!==expected[1] || guardian[0]===child[0] ||
    f.slice(7,11).join(' ')!=='1 1 1 0' || !['0','15'].includes(f[11]))fail();
 const elapsed=Number(decimal(f[6],60000n,71000n));
 return Object.freeze({kind:'end',nonce,guardian,child,elapsed_ms:elapsed,reaped:true,
  protection_ack:true,term_sent:true,forced:false,wait_status:Number(f[11])});
}
