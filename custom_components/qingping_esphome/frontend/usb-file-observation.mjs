/** Exact file identity with the two observed sha256sum text delimiters.
 * GNU/BusyBox text output may have the mode-marker space in addition to the
 * separator. Permit one/two spaces only; keep digest, full path, stat fields
 * and line count exact. Never trim/split arbitrary fields into a valid pin.
 */
export function digestLineMatches(line,sha,path) {
  if(typeof line!=='string' || typeof sha!=='string' || !/^[a-f0-9]{64}$/.test(sha) ||
    typeof path!=='string' || !/^\/[A-Za-z0-9._/+-]+$/.test(path) ||
    path.split('/').slice(1).some(part=>!part || part==='.' || part==='..')) return false;
  return line===sha+' '+path || line===sha+'  '+path;
}
export function sourceFileObservationMatches(text,file) {
  if(typeof text!=='string' || !file || !Number.isInteger(file.size) || file.size<1 || file.size>8*1024*1024) return false;
  const lines=text.split('\n');
  return lines.length===2 && lines[0]===`${file.size} 1` && digestLineMatches(lines[1],file.sha256,file.path);
}
