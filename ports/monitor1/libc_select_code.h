#pragma once

// Static library code, never process memory. Upstream Linux v3.10 ARM can
// report a stale thread_info->syscall on the untraced fast path. Therefore a
// reported zero is NOT silently reinterpreted as select. This diagnostic
// supplies a bounded, independently reviewable glibc select code prefix and
// says whether the kernel-reported PC maps into that exact file symbol.
// None of these diagnostic facts grants signal or memory-read authority.
#include "libc_vendor_binary.h"
#include <array>
#include <cstring>
#include <sstream>
#if defined(__linux__)
#include <sys/sysmacros.h>
#endif

namespace cgs1_libc_select {
struct Code {
  bool verified{false};uint32_t value{0},size{0},offset{0};
  std::string hex,error;
};
inline Code select_code(const std::vector<unsigned char>&b) {
  Code out;
  const auto span=[&](uint64_t at,uint64_t length){return at<=b.size() && length<=b.size()-at;};
  if(!span(0,52)){out.error="libc_elf_header_short";return out;}
  const auto u16=[&](size_t at){return uint32_t(b[at])|(uint32_t(b[at+1])<<8);};
  const auto u32=[&](size_t at){return uint32_t(b[at])|(uint32_t(b[at+1])<<8)|
      (uint32_t(b[at+2])<<16)|(uint32_t(b[at+3])<<24);};
  if(b[0]!=0x7f || b[1]!='E' || b[2]!='L' || b[3]!='F' || b[4]!=1 || b[5]!=1 || b[6]!=1 ||
      u16(16)!=3 || u16(18)!=40 || u16(40)!=52 || u16(46)!=40 || !u16(48) || u16(48)>512 ||
      !span(u32(32),uint64_t(u16(48))*40)) {
    out.error="libc_elf32_arm_sections_required";return out;
  }
  const uint32_t table=u32(32),count=u16(48);bool found=false;
  for(uint32_t n=0;n<count;++n) {
    const size_t sh=table+size_t(n)*40;
    if(u32(sh+4)!=11)continue; // SHT_DYNSYM only, never arbitrary file strings.
    const auto offset=u32(sh+16),length=u32(sh+20),link=u32(sh+24),entry=u32(sh+36);
    if(entry!=16 || length%16 || length/16>20000 || !span(offset,length) || link>=count) {
      out.error="libc_dynsym_bounds";return out;
    }
    const size_t str=table+size_t(link)*40;
    const auto strings=u32(str+16),string_bytes=u32(str+20);
    if(u32(str+4)!=3 || !span(strings,string_bytes)) {out.error="libc_dynstr_bounds";return out;}
    for(uint32_t i=0;i<length;i+=16) {
      const size_t sym=offset+i;const auto name=u32(sym);
      if(name>=string_bytes) {out.error="libc_symbol_name_bounds";return out;}
      // The one accepted public symbol includes its NUL. No caller-selected
      // name, scan of writable data, constructor execution or dlopen exists.
      if(string_bytes-name<7 || std::memcmp(b.data()+strings+name,"select",7))continue;
      const auto section=u16(sym+14),value=u32(sym+4),size=u32(sym+8);
      if(found || (b[sym+12]&15)!=2 || section>=count || !section || !size || size>4096) {
        out.error="libc_select_symbol_refused";return out;
      }
      const size_t text=table+size_t(section)*40;
      const auto base=u32(text+12),bytes=u32(text+20),file=u32(text+16);
      const uint32_t address=value&~uint32_t(1); // Thumb bit is public ELF metadata.
      if(u32(text+4)!=1 || (u32(text+8)&6)!=6 || !span(file,bytes) || address<base ||
          uint64_t(address)-base+size>bytes || uint64_t(file)+address-base>UINT32_MAX) {
        out.error="libc_select_executable_text_required";return out;
      }
      out.value=value;out.size=size;out.offset=file+address-base;found=true;
    }
  }
  if(!found){out.error="libc_select_symbol_missing";return out;}
  constexpr char HEX[]="0123456789abcdef";
  for(uint32_t n=0;n<std::min(out.size,uint32_t(256));++n) {
    const auto byte=b[out.offset+n];out.hex+=HEX[byte>>4];out.hex+=HEX[byte&15];
  }
  out.verified=true;return out;
}

inline bool hex64(const std::string&s,uint64_t&out) {
  if(s.empty() || s.size()>16)return false;
  out=0;
  for(unsigned char c:s) {
    unsigned v;if(c>='0' && c<='9')v=c-'0';else if(c>='a' && c<='f')v=c-'a'+10;else return false;
    out=(out<<4)|v;
  }
  return true;
}
inline bool mapped_pc(const std::string&maps,uint32_t pc,const Code&code,uint64_t device,uint64_t inode,
    uint32_t*relative_file_pc=nullptr) {
#if defined(__linux__)
  if(!code.verified || maps.empty() || maps.size()>65536 || !pc || !inode)return false;
  std::istringstream lines(maps);std::string line;unsigned matches=0;uint32_t selected=0;
  while(std::getline(lines,line)) {
    std::istringstream fields(line);std::string range,mode,offset,dev,ino,path,extra;
    if(!(fields>>range>>mode>>offset>>dev>>ino))return false;
    if(!(fields>>path))continue;
    if(path!="/lib/libc-2.23.so")continue;
    if(fields>>extra)return false; // Includes "(deleted)" and unknown paths.
    const auto dash=range.find('-'),colon=dev.find(':');uint64_t start=0,end=0,off=0,major_number=0,minor_number=0;
    if(dash==std::string::npos || colon==std::string::npos ||
        !hex64(range.substr(0,dash),start) || !hex64(range.substr(dash+1),end) ||
        !hex64(offset,off) || !hex64(dev.substr(0,colon),major_number) ||
        !hex64(dev.substr(colon+1),minor_number) || start>=end || end>0xc0000000u)return false;
    uint64_t parsed_inode=0;
    if(ino.empty() || ino.size()>20)return false;
    for(unsigned char c:ino) {
      if(c<'0' || c>'9' || parsed_inode>(UINT64_MAX-uint64_t(c-'0'))/10)return false;
      parsed_inode=parsed_inode*10+c-'0';
    }
    if(pc<start || pc>=end)continue;
    if(mode!="r-xp" || major_number!=uint64_t(major(device)) || minor_number!=uint64_t(minor(device)) ||
        parsed_inode!=inode || off>UINT64_MAX-(pc-start))return false;
    const auto file_pc=off+pc-start;
    if(file_pc<=code.offset || file_pc>=uint64_t(code.offset)+code.size)return false;
    ++matches;selected=uint32_t(file_pc);
  }
  if(matches!=1)return false;
  if(relative_file_pc)*relative_file_pc=selected;
  return true;
#else
  (void)maps;(void)pc;(void)code;(void)device;(void)inode;(void)relative_file_pc;return false;
#endif
}

inline bool reviewed_newselect_call(const std::string&library_sha,const Code&code,
    uint32_t file_pc,const std::string&wchan) {
  // These are PUBLIC MACHINE CODE bytes captured from the immutable vendor
  // library, not a key or process-memory dump. Both ARM paths set r7=142
  // immediately before SVC 0. Require the EXACT saved return PC after that
  // instruction, not merely any PC somewhere inside select. The caller also
  // has to prove the live inode/mapping, owner, kernel snapshot and quiet
  // signal metadata. This helper alone grants neither memory nor signals.
  constexpr char SHA[]="6479e377cd35c6e90e9aba990ac5137b195ca765544ad0c561f7f5945ea7133e";
  constexpr char CODE[]=
    "e4cf01e307c040e30cc09fe700003ce390002de908409de50500001a8e70a0e3000000ef"
    "9000bde8010a70e31eff2f319242fdea1f402de93a4f00eb00c0a0e10f00bde88e70a0e3"
    "000000ef0070a0e10c00a0e1624f00eb0700a0e11040bde89000bde8010a70e31eff2f318342fdea";
  return code.verified && library_sha==SHA && code.value==0xc6410 && code.offset==0xc6410 &&
    code.size==112 && code.hex==CODE && (file_pc==0xc6434 || file_pc==0xc645c) &&
    (wchan=="poll_schedule_timeout" || wchan=="poll_schedule_timeout\n" ||
     wchan=="do_select" || wchan=="do_select\n");
}
} // namespace cgs1_libc_select
