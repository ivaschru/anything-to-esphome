#pragma once

// Read-only observation, NOT a signal capability. The exact vendor renew
// branch can deconfig even from BOUND when its timeout is zero. Observe only
// the reviewed state/listen integers and a kernel-reported select timeval.
// No PID/address/path is accepted by the API, no signal or packet is sent.
#include "busybox_vendor_binary.h"
#include "dhcp_owner_inspect.h"
#include "libc_select_code.h"
#include <sstream>

namespace cgs1_dhcp_wait {
inline constexpr const char *REVIEWED_SHA=
  "8bfb43427294638a75b09da8e4ec627e81324d55aee17066968608a1b0d2988f";
inline constexpr size_t REVIEWED_BYTES=638068;
struct Inspection {
  bool verified{false},base_timeout_verified{false};int state{-1},syscall_number{-1};
  bool status_available{false},signals_quiet{false},kernel_snapshot_available{false};
  bool usr1_handler{false},usr2_handler{false},term_handler{false};
  bool libc_code_available{false},kernel_pc_in_libc_select{false};
  bool legacy_libc_select_call_verified{false};
  bool wchan_do_select{false},wchan_poll_timeout{false};
  std::string libc_sha256,libc_select_hex,libc_code_error;
  uint32_t libc_select_value{0},libc_select_size{0},libc_select_offset{0};
  cgs1_net_trial::ProcessIdentity owner;
  std::string error;
};
namespace detail {
struct KernelSelect {std::array<uint32_t,6>args{};uint32_t sp{0},pc{0};};
inline bool hex_word(const std::string&s,uint32_t&out) {
  if(s.size()<3 || s.size()>10 || s[0]!='0' || s[1]!='x')return false;
  out=0;
  for(size_t n=2;n<s.size();++n) {
    const unsigned char c=s[n];unsigned v;
    if(c>='0' && c<='9')v=c-'0';else if(c>='a' && c<='f')v=c-'a'+10;else return false;
    out=(out<<4)|v;
  }
  return true;
}
inline bool parse_select(const std::string&text,KernelSelect&out) {
  // Linux v3.10 proc_pid_syscall emits nr, six argument registers, SP, PC.
  // ARM EABI __NR__newselect=142 has nfds/readfds/writefds/exceptfds/timeval.
  // Unknown/running/-1/pselect/OABI formats are not treated as this contract.
  if(text.empty() || text.size()>256 || text.back()!='\n')return false;
  std::istringstream input(text);std::array<std::string,9>words;std::string extra;
  for(auto&w:words)if(!(input>>w))return false;
  if(input>>extra || words[0]!="142")return false;
  KernelSelect selected;
  for(unsigned n=0;n<6;++n)if(!hex_word(words[n+1],selected.args[n]))return false;
  if(!hex_word(words[7],selected.sp) || !hex_word(words[8],selected.pc) ||
      !selected.args[0] || selected.args[0]>1024 || selected.args[2] || selected.args[3] ||
      selected.sp<0x10000 || selected.sp>0xc0000000u-4096 || (selected.sp&3) ||
      selected.pc<0x10000 || selected.pc>=0xc0000000u)return false;
  // Both pointers must be aligned locals near the CURRENT kernel-reported
  // stack, not heap/configuration strings. The selected timeval is only eight
  // bytes; there is no memory scan or caller-supplied address in production.
  const auto local=[&](uint32_t address,uint32_t length){
    return !(address&3) && address>=selected.sp && address-selected.sp<=4096-length;
  };
  if(!local(selected.args[1],128) || !local(selected.args[4],8) ||
      selected.args[1]==selected.args[4])return false;
  out=selected;return true;
}
inline bool same_select(const KernelSelect&a,const KernelSelect&b) {
  return a.args==b.args && a.sp==b.sp && a.pc==b.pc;
}
inline bool parse_observed_select(const std::string&text,KernelSelect&out,bool exact_legacy_call=false) {
  if(parse_select(text,out))return true;
  // Only the separate exact immutable-library/SVC-return/waiter witness may
  // select this decoder for an old ARM kernel's stale zero. The generic parser
  // STILL refuses zero. Replace the label solely for decoding the same six
  // argument registers; keep the actual reported zero in public metadata.
  if(!exact_legacy_call || text.rfind("0 ",0)!=0)return false;
  return parse_select("142 "+text.substr(2),out);
}
inline bool reported_handler(const std::string&text,unsigned signal) {
  // Diagnostic ONLY: expose three selected boolean facts, never a raw signal
  // mask. This helper does not participate in or weaken quiet_signals().
  if(text.empty() || text.size()>8192 || signal<1 || signal>64)return false;
  std::istringstream input(text);std::string row;bool found=false,present=false;
  while(std::getline(input,row))if(row.rfind("SigCgt:",0)==0) {
    if(found)return false;
    found=true;std::istringstream value(row.substr(7));std::string hex,extra;
    if(!(value>>hex) || hex.empty() || hex.size()>16 || value>>extra)return false;
    uint64_t number=0;
    for(unsigned char c:hex) {
      unsigned digit;if(c>='0' && c<='9')digit=c-'0';else if(c>='a' && c<='f')digit=c-'a'+10;else return false;
      number=(number<<4)|digit;
    }
    present=number&(uint64_t(1)<<(signal-1));
  }
  return found && present;
}
inline int known_syscall(const std::string&text) {
  // Only public known ABI categories. Unknown register contents/number strings
  // never leave this observer; classification itself grants no memory read.
  if(text.rfind("142 ",0)==0)return 142;
  if(text.rfind("335 ",0)==0)return 335;
  if(text.rfind("82 ",0)==0)return 82;
  if(text.rfind("0 ",0)==0)return 0;
  return -1;
}
inline bool quiet_signals(const std::string&text) {
  if(text.empty() || text.size()>8192)return false;
  std::istringstream input(text);std::string row;unsigned seen=0;
  uint64_t pending=0,shared=0,blocked=0,ignored=0,caught=0;
  while(std::getline(input,row)) {
    const auto colon=row.find(':');if(colon==std::string::npos)continue;
    const auto key=row.substr(0,colon);unsigned flag=0;uint64_t*target=nullptr;
    if(key=="Threads") {
      if(seen&1)return false;
      seen|=1;std::istringstream value(row.substr(colon+1));std::string count,extra;
      if(!(value>>count) || count!="1" || value>>extra)return false;
      continue;
    }
    if(key=="SigPnd"){flag=2;target=&pending;}
    else if(key=="ShdPnd"){flag=4;target=&shared;}
    else if(key=="SigBlk"){flag=8;target=&blocked;}
    else if(key=="SigIgn"){flag=16;target=&ignored;}
    else if(key=="SigCgt"){flag=32;target=&caught;}
    else continue;
    if(seen&flag)return false;
    seen|=flag;std::istringstream value(row.substr(colon+1));std::string hex,extra;
    if(!(value>>hex) || hex.empty() || hex.size()>16 || value>>extra)return false;
    uint64_t number=0;
    for(unsigned char c:hex) {
      unsigned v;if(c>='0' && c<='9')v=c-'0';else if(c>='a' && c<='f')v=c-'a'+10;else return false;
      number=(number<<4)|v;
    }
    *target=number;
  }
  constexpr uint64_t HANDLERS=(uint64_t(1)<<9)|(uint64_t(1)<<11)|(uint64_t(1)<<14);
  return seen==63 && !pending && !shared && !(blocked&HANDLERS) &&
    !(ignored&HANDLERS) && (caught&HANDLERS)==HANDLERS;
}
#if defined(__linux__)
struct Descriptor {
  int fd{-1};explicit Descriptor(int n):fd(n){}~Descriptor(){if(fd>=0)::close(fd);}
  Descriptor(const Descriptor&)=delete;Descriptor&operator=(const Descriptor&)=delete;
};
inline std::string proc_text(int directory,const char*name,size_t maximum) {
  Descriptor file(::openat(directory,name,O_RDONLY|O_NONBLOCK|O_NOFOLLOW|O_CLOEXEC));
  struct stat st{};struct statfs fs{};
  if(file.fd<0 || ::fstat(file.fd,&st) || !S_ISREG(st.st_mode) || st.st_uid!=0 ||
      ::fstatfs(file.fd,&fs) || fs.f_type!=0x9fa0)return {};
  std::string text;char buffer[512];
  while(text.size()<=maximum) {
    const auto count=::read(file.fd,buffer,std::min(sizeof(buffer),maximum+1-text.size()));
    if(count<0 && errno==EINTR)continue;
    if(count<0)return {};
    if(!count)return text;
    text.append(buffer,size_t(count));
  }
  return {};
}
inline bool read_values(int memory,const KernelSelect&selected,uint32_t&state,uint32_t&listen,uint32_t&seconds) {
  uint8_t words[16]{};
  // ARM glibc defaults off_t to signed 32-bit, while an ordinary userspace
  // stack may be above 0x80000000. Passing that pointer through off_t makes
  // it negative before pread. Use the explicit large-file ABI even though the
  // target process is 32-bit; the allowed ranges below are unchanged.
  static_assert(sizeof(off64_t)==8,"The proc memory reader requires explicit 64-bit offsets");
  auto exact=[&](void*to,size_t size,uint64_t offset){
    ssize_t n;do{n=::pread64(memory,to,size,off64_t(offset));}while(n<0 && errno==EINTR);
    return n==ssize_t(size);
  };
  // Only two fixed 32-bit public state words and the eight-byte select timer
  // chosen by a verified kernel snapshot. Nothing adjacent is read/exported.
  if(!exact(words,4,0xbb7a0) || !exact(words+4,4,0xbb7a4) ||
      !exact(words+8,8,selected.args[4]))return false;
  const auto le=[](const uint8_t*p){return uint32_t(p[0])|(uint32_t(p[1])<<8)|(uint32_t(p[2])<<16)|(uint32_t(p[3])<<24);};
  state=le(words);listen=le(words+4);seconds=le(words+8);
  // This is a positive SELECT INPUT timeout, not the remaining wall-clock
  // lease lifetime: Linux updates the user's timeval only on syscall return.
  // At the reviewed BusyBox select site r5 holds the BASE timeout. Linux's
  // six-register snapshot includes it as args[5]. Exact libc code/return-PC
  // identity is mandatory below, so an unrelated syscall's sixth argument
  // cannot substitute. AAPCS32 preserves r5 across calls; the reviewed select
  // wrapper does not repurpose it at either SVC. Reject zero/oversized base
  // and an input exceeding that base, including subtraction-wrap anomalies.
  const auto base=selected.args[5];
  return state<=6 && listen<=2 && base>0 && base<=86400 && seconds>0 &&
    seconds<=base && le(words+12)==0;
}
#endif
} // namespace detail

inline Inspection inspect() {
  Inspection out;
#if defined(__linux__)
  const auto before=cgs1_dhcp::inspect();
  if(!before.scan_complete || before.clients.size()!=1 || !before.executable.verified ||
      !before.executable.filesystem_read_only || before.executable.sha256!=REVIEWED_SHA ||
      !before.vendor_launcher_matches || before.clients[0].process.executable!="/bin/busybox") {
    out.error="dhcp_wait_reviewed_live_owner_required";return out;
  }
  const auto owner=before.clients[0].process;
  const auto image=cgs1_dhcp_vendor::read_busybox();
  if(!image.verified || image.sha256!=REVIEWED_SHA || image.bytes.size()!=REVIEWED_BYTES) {
    out.error="dhcp_wait_exact_image_required";return out;
  }
  const auto root="/proc/"+std::to_string(owner.pid);
  detail::Descriptor proc(::open(root.c_str(),O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC));
  struct stat st{},exe{};struct statfs fs{};
  if(proc.fd<0 || ::fstat(proc.fd,&st) || st.st_uid!=0 || !S_ISDIR(st.st_mode) ||
      ::fstatfs(proc.fd,&fs) || fs.f_type!=0x9fa0 || ::fstatat(proc.fd,"exe",&exe,0) ||
      uint64_t(exe.st_dev)!=image.file_device || uint64_t(exe.st_ino)!=image.file_inode) {
    out.error="dhcp_wait_proc_executable_required";return out;
  }
  detail::KernelSelect first,last;
  const auto status=detail::proc_text(proc.fd,"status",8192);
  const auto syscall=detail::proc_text(proc.fd,"syscall",256);
  out.status_available=!status.empty();out.signals_quiet=detail::quiet_signals(status);
  out.usr1_handler=detail::reported_handler(status,10);out.usr2_handler=detail::reported_handler(status,12);
  out.term_handler=detail::reported_handler(status,15);
  out.kernel_snapshot_available=!syscall.empty();out.syscall_number=detail::known_syscall(syscall);
  if(!out.signals_quiet){out.error="dhcp_wait_signal_metadata_refused";return out;}
  bool legacy_call_proven=false;std::string selected_wchan;
  if(out.syscall_number==0 || out.syscall_number==142) {
    // Diagnostic-only static code review for old ARM syscall accounting.
    // The generic parser still rejects zero. A separate exact code/SVC return
    // and kernel waiter witness can establish the argument decoder, but is
    // never a signal capability and does not extend the memory read ranges.
    const auto library=cgs1_libc_vendor::read_libc();
    const auto code=cgs1_libc_select::select_code(library.bytes);
    out.libc_code_error=library.verified?code.error:library.error;
    if(library.verified && code.verified) {
      out.libc_code_available=true;out.libc_sha256=library.sha256;
      out.libc_select_hex=code.hex;out.libc_select_value=code.value;
      out.libc_select_size=code.size;out.libc_select_offset=code.offset;
      std::istringstream input(syscall);std::array<std::string,9>words;std::string extra;
      bool shape=true;for(auto&word:words)if(!(input>>word))shape=false;
      uint32_t pc=0;
      const auto maps=detail::proc_text(proc.fd,"maps",65536);
      const auto wchan=detail::proc_text(proc.fd,"wchan",128);uint32_t file_pc=0;
      if(shape && !(input>>extra) && detail::hex_word(words[8],pc) &&
          cgs1_libc_select::mapped_pc(maps,pc,code,library.file_device,library.file_inode,&file_pc) &&
          detail::proc_text(proc.fd,"syscall",256)==syscall &&
          detail::proc_text(proc.fd,"maps",65536)==maps && cgs1_net_trial::same_process(owner)) {
        out.kernel_pc_in_libc_select=true;
        out.wchan_do_select=wchan=="do_select" || wchan=="do_select\n";
        out.wchan_poll_timeout=wchan=="poll_schedule_timeout" || wchan=="poll_schedule_timeout\n";
        legacy_call_proven=cgs1_libc_select::reviewed_newselect_call(library.sha256,code,file_pc,wchan);
        selected_wchan=wchan;out.legacy_libc_select_call_verified=legacy_call_proven;
      }
    }
  }
  // The same exact wrapper identity is required even when the old kernel
  // reports 142 correctly: reading BusyBox's preserved r5 depends on that
  // wrapper leaving this callee-saved register unchanged at SVC.
  if(!legacy_call_proven || !detail::parse_observed_select(syscall,first,legacy_call_proven)) {
    out.error="dhcp_wait_kernel_select_snapshot_refused";return out;
  }
  detail::Descriptor memory(::openat(proc.fd,"mem",O_RDONLY|O_CLOEXEC|O_NOFOLLOW));
  if(memory.fd<0 || ::fstat(memory.fd,&st) || !S_ISREG(st.st_mode) || st.st_uid!=0 ||
      ::fstatfs(memory.fd,&fs) || fs.f_type!=0x9fa0) {
    out.error="dhcp_wait_state_timer_unavailable";return out;
  }
  uint32_t state=0,listen=0,seconds=0,state2=0,listen2=0,seconds2=0;
  if(!detail::read_values(memory.fd,first,state,listen,seconds) ||
      !detail::parse_observed_select(detail::proc_text(proc.fd,"syscall",256),last,legacy_call_proven) || !detail::same_select(first,last) ||
      !detail::read_values(memory.fd,last,state2,listen2,seconds2) || state!=state2 || listen!=listen2 || seconds!=seconds2 ||
      !detail::quiet_signals(detail::proc_text(proc.fd,"status",8192)) ||
      (legacy_call_proven && detail::proc_text(proc.fd,"wchan",128)!=selected_wchan)) {
    out.error="dhcp_wait_changed_or_nonpositive_state_timer";return out;
  }
  out.state=int(state);
  const auto after=cgs1_dhcp::inspect();struct stat final_exe{};
  if(!after.scan_complete || after.clients.size()!=1 || !after.executable.verified ||
      after.executable.sha256!=REVIEWED_SHA || after.clients[0].process.pid!=owner.pid ||
      after.clients[0].process.start!=owner.start || after.clients[0].process.executable!=owner.executable ||
      !cgs1_net_trial::same_process(owner) || ::fstatat(proc.fd,"exe",&final_exe,0) ||
      final_exe.st_dev!=exe.st_dev || final_exe.st_ino!=exe.st_ino ||
      cgs1_net_trial::process_identity(owner.pid).state!='S' || state!=2 || listen!=0) {
    out.error="dhcp_wait_bound_owner_or_listen_refused";return out;
  }
  out.owner=owner;out.base_timeout_verified=true;out.verified=true;
#else
  out.error="dhcp_wait_verified_linux_required";
#endif
  return out;
}
} // namespace cgs1_dhcp_wait
