#pragma once

// Read-only preparation for DHCP ownership, not a network-control backend.
// Export only typed flags/birth identities and fixed-path metadata. Never
// export cmdline/environment, hostname/client options, config bytes or unknown
// script hashes. In particular, the vendor launcher contains killall udhcpc;
// this inspector must NEVER execute that launcher, even with --help.
#include "network_preflight.h"
#include "network_ipv4_inspect.h"
#include "supervisor_wifi_private_root.h"
#include <sys/stat.h>
#include <fcntl.h>
#include <unistd.h>
#if defined(__linux__)
#include <sys/vfs.h>
#include <sys/statvfs.h>
#endif

namespace cgs1_dhcp {
// These categories describe syntax, not user-provided strings. In particular,
// the shape report never echoes an unrecognised option, hostname or script.
// A private value occupying an unexpected position remains just POSITIONAL.
enum class Shape : unsigned {ENTRY,APPLET,SWITCH,VALUE_OPTION,INTERFACE_WLAN0,
  INTERFACE_OTHER,SCRIPT_VALUE,PRIVATE_VALUE,SHORT_UNKNOWN,LONG_UNKNOWN,
  CLUSTER_OR_ATTACHED,POSITIONAL,TERMINATOR,EMPTY};
struct Token {unsigned index{0};Shape kind{Shape::POSITIONAL};int known_option{0};};
inline bool value_option(char option) {
  return std::string("isxptTArVH").find(option)!=std::string::npos;
}
inline bool switch_option(char option) {
  return std::string("bfRnqvoCB").find(option)!=std::string::npos;
}
inline std::vector<Token> argument_shape(const std::vector<std::string>&argv) {
  std::vector<Token> out;char pending=0;
  for(size_t n=0;n<argv.size() && n<64;++n) {
    const auto&word=argv[n];Token token;token.index=unsigned(n);
    if(n==0)token.kind=Shape::ENTRY;
    else if(n==1 && word=="udhcpc")token.kind=Shape::APPLET;
    else if(pending) {
      token.kind=pending=='i'?(word=="wlan0"?Shape::INTERFACE_WLAN0:Shape::INTERFACE_OTHER):
        pending=='s'?Shape::SCRIPT_VALUE:Shape::PRIVATE_VALUE;
      pending=0;
    }else if(word.empty())token.kind=Shape::EMPTY;
    else if(word=="--")token.kind=Shape::TERMINATOR;
    else if(word.size()>2 && word[0]=='-' && word[1]=='-')token.kind=Shape::LONG_UNKNOWN;
    else if(word.size()==2 && word[0]=='-') {
      const char c=word[1];
      if(value_option(c)){token.kind=Shape::VALUE_OPTION;token.known_option=int(c);pending=c;}
      else if(switch_option(c)){token.kind=Shape::SWITCH;token.known_option=int(c);}
      else token.kind=Shape::SHORT_UNKNOWN;
    }else if(word.size()>2 && word[0]=='-')token.kind=Shape::CLUSTER_OR_ATTACHED;
    else token.kind=Shape::POSITIONAL;
    out.push_back(token);
  }
  return out;
}
enum class ArgumentFailure : unsigned {NONE,NOT_APPLET,ARGUMENT_LIMIT,
  DUPLICATE_INTERFACE,MISSING_VALUE,DUPLICATE_SCRIPT,UNKNOWN_SYNTAX,
  INTERFACE_MISSING,CONFLICTING_MODE,INTERFACE_AFTER_OPERAND};
struct Arguments {
  bool applet{false},recognized{false},wlan0{false},background{false},foreground{false},release{false},extra_options{false};
  int script{-1}; // -1 compiled default; -2 unrecognized path, never exported.
  int unsupported_short_option{0}; // ASCII letter only, never an arbitrary argument.
  ArgumentFailure failure{ArgumentFailure::NOT_APPLET};unsigned failure_index{0};
  unsigned operands{0};bool options_after_operand{false};
};
inline Arguments arguments(const std::vector<std::string>&argv) {
  Arguments result;if(argv.empty())return result;
  size_t at=1;
  const auto name=[](const std::string&s){const auto p=s.rfind('/');return p==std::string::npos?s:s.substr(p+1);};
  if(name(argv[0])=="busybox") {
    if(argv.size()<2 || argv[1]!="udhcpc")return result;
    at=2;
  }else if(name(argv[0])!="udhcpc")return result;
  result.applet=true;if(argv.size()>64){result.failure=ArgumentFailure::ARGUMENT_LIMIT;return result;}
  result.failure=ArgumentFailure::NONE;
  result.recognized=true;bool interface=false,script=false;
  for(;at<argv.size();++at) {
    const auto&arg=argv[at];
    // Exact upstream 1_25_0 dhcpc.c ignores non-option operands: getopt32
    // permits 0..unbounded and dhcpc never examines optind. This is ONLY
    // diagnostic syntax compatibility, not proof that flags after an operand
    // were applied by the vendor libc/build/environment. Record that ambiguity
    // and require -i before any operand so interface attribution does not rely
    // on GNU permutation. Never read/export a live environment to resolve it.
    if(arg=="--") {result.operands+=unsigned(argv.size()-at-1);break;}
    if(arg.empty() || arg[0]!='-' || arg=="-"){++result.operands;continue;}
    if(result.operands)result.options_after_operand=true;
    if(arg=="-i") {
      if(result.operands){result.failure=ArgumentFailure::INTERFACE_AFTER_OPERAND;result.recognized=false;break;}
      if(interface || at+1>=argv.size()){
        result.failure=interface?ArgumentFailure::DUPLICATE_INTERFACE:ArgumentFailure::MISSING_VALUE;
        result.recognized=false;break;
      }
      interface=true;result.wlan0=argv[++at]=="wlan0";
    }else if(arg=="-s") {
      if(script || at+1>=argv.size()){
        result.failure=script?ArgumentFailure::DUPLICATE_SCRIPT:ArgumentFailure::MISSING_VALUE;
        result.recognized=false;break;
      }
      script=true;result.script=-2;const auto&value=argv[++at];
      static constexpr const char*paths[]{"/usr/share/udhcpc/default.script","/etc/udhcpc/default.script",
        "/data/etc/wifi/udhcpc.script","/data/etc/wifi/udhcpc_wlan0.script"};
      for(unsigned n=0;n<4;++n)if(value==paths[n])result.script=int(n);
    }else if(arg=="-b")result.background=true;
    else if(arg=="-f")result.foreground=true;
    else if(arg=="-R")result.release=true;
    else if(arg=="-x" || arg=="-p" || arg=="-t" || arg=="-T" || arg=="-A" || arg=="-r" || arg=="-V" || arg=="-H") {
      // Values can contain private client identity. Consume, never retain or
      // export them; this flag summary is NOT approval to signal the client.
      if(at+1>=argv.size()){result.failure=ArgumentFailure::MISSING_VALUE;result.recognized=false;break;}
      ++at;result.extra_options=true;
    }else if(arg=="-n" || arg=="-q" || arg=="-v" || arg=="-o" || arg=="-C" || arg=="-B")result.extra_options=true;
    else {
      if(arg.size()==2 && arg[0]=='-' && ((arg[1]>='a' && arg[1]<='z') || (arg[1]>='A' && arg[1]<='Z')))
        result.unsupported_short_option=int(static_cast<unsigned char>(arg[1]));
      result.failure=ArgumentFailure::UNKNOWN_SYNTAX;result.recognized=false;break;
    }
  }
  if(!result.recognized)result.failure_index=unsigned(at);
  else if(!interface){result.recognized=false;result.failure=ArgumentFailure::INTERFACE_MISSING;}
  else if(result.background && result.foreground){result.recognized=false;result.failure=ArgumentFailure::CONFLICTING_MODE;}
  return result;
}
struct Node {int error{0},owner{-1},mode{-1};uint64_t device{0},inode{0};bool directory{false},symlink{false};};
struct Client {cgs1_net_trial::ProcessIdentity process;Arguments flags;};
struct Rejected {
  long pid{0};uint64_t start{0};unsigned stage{0};int short_option{0};unsigned arguments{0};
  ArgumentFailure failure{ArgumentFailure::NONE};unsigned failure_index{0};std::vector<Token>shape;
};
struct Executable {bool verified{false},filesystem_read_only{false};std::string path,sha256,busybox_version;uint64_t bytes{0};};
struct Inspection {
  bool supported{false},scan_complete{false},canonical_parent_available{false},vendor_launcher_matches{false};
  unsigned unreadable{0},without_user_executable{0},other_clients{0};std::vector<Client>clients;std::array<Node,3>parents;
  std::array<unsigned,7>failure_stages{};std::vector<Rejected>rejected;Executable executable;
  cgs1_ipv4::View ipv4;
  std::string error;
};
inline Executable resolve_executable(const std::string&fixture_root) {
  Executable out;
#if defined(__linux__)
  const auto fixed=fixture_root=="/"?"/sbin/udhcpc":fixture_root+"/sbin/udhcpc";
  char path[PATH_MAX];if(!::realpath(fixed.c_str(),path))return out;
  std::string resolved=path,relative=resolved;
  if(fixture_root!="/") {
    if(resolved.rfind(fixture_root+"/",0)!=0)return out;
    relative=resolved.substr(fixture_root.size());
  }
  if(relative.rfind("/bin/",0)!=0 && relative.rfind("/sbin/",0)!=0 &&
      relative.rfind("/usr/bin/",0)!=0 && relative.rfind("/usr/sbin/",0)!=0)return out;
  for(unsigned char c:relative)if(!((c>='a' && c<='z') || (c>='A' && c<='Z') ||
      (c>='0' && c<='9') || c=='/' || c=='_' || c=='-' || c=='.' || c=='+'))return out;
  const int fd=::open(resolved.c_str(),O_RDONLY|O_NOFOLLOW|O_NONBLOCK|O_CLOEXEC);struct stat st{},after{};
  if(fd<0)return out;
  struct statfs fs{};struct statvfs vfs{};
  const bool immutable=(!::fstatfs(fd,&fs) && fs.f_type==0x73717368u) || (!::fstatvfs(fd,&vfs) && (vfs.f_flag&ST_RDONLY));
  bool okay=!::fstat(fd,&st) && S_ISREG(st.st_mode) && st.st_uid==0 && !(st.st_mode&0022) &&
    st.st_size>=52 && st.st_size<=2*1024*1024 && (fixture_root!="/" || immutable);
  std::vector<unsigned char>bytes(okay?size_t(st.st_size):0);
  okay=okay && ::pread(fd,bytes.data(),bytes.size(),0)==ssize_t(bytes.size()) && !::fstat(fd,&after) &&
    st.st_dev==after.st_dev && st.st_ino==after.st_ino && st.st_size==after.st_size &&
    st.st_mtim.tv_sec==after.st_mtim.tv_sec && st.st_mtim.tv_nsec==after.st_mtim.tv_nsec &&
    st.st_ctim.tv_sec==after.st_ctim.tv_sec && st.st_ctim.tv_nsec==after.st_ctim.tv_nsec;
  ::close(fd);
  if(!okay || bytes[0]!=0x7f || bytes[1]!='E' || bytes[2]!='L' || bytes[3]!='F' || bytes[4]!=1 || bytes[5]!=1 || bytes[6]!=1 ||
      (bytes[16]!=2 && bytes[16]!=3) || bytes[17] || bytes[18]!=40 || bytes[19])return out;
  unsigned char digest[32]{};unsigned size=0;
  if(EVP_Digest(bytes.data(),bytes.size(),digest,&size,EVP_sha256(),nullptr)!=1 || size!=32)return out;
  constexpr char digits[]="0123456789abcdef";
  for(unsigned char n:digest){out.sha256+=digits[n>>4];out.sha256+=digits[n&15];}
  // Export only the version number after this known public BusyBox marker,
  // never arbitrary binary strings, default config, payload or key material.
  const std::string contents(reinterpret_cast<const char*>(bytes.data()),bytes.size()),marker="BusyBox v";
  const auto at=contents.find(marker);
  if(at!=std::string::npos)for(size_t n=at+marker.size();n<contents.size() && out.busybox_version.size()<20;++n) {
    const char c=contents[n];if((c>='0' && c<='9') || c=='.')out.busybox_version+=c;else break;
  }
  if(!out.busybox_version.empty() && (out.busybox_version[0]<'0' || out.busybox_version[0]>'9'))out.busybox_version.clear();
  out.path=relative;out.bytes=bytes.size();out.filesystem_read_only=immutable;out.verified=true;
#else
  (void)fixture_root;
#endif
  return out;
}
inline bool read_arguments(const std::string&path,std::vector<std::string>&out) {
  out.clear();
  const auto data=cgs1_net_trial::read_small(path,4096);
  if(data.empty() || data.back()!='\0')return false;
  // setproctitle/BusyBox can leave NUL padding within the original argv area.
  // Ignore ONLY trailing padding; an empty interior argument stays an error.
  const auto last=data.find_last_not_of('\0');if(last==std::string::npos)return false;
  size_t at=0;
  while(at<=last) {
    const auto end=data.find('\0',at);
    if(end==std::string::npos || end==at || out.size()>=64)return false;
    out.push_back(data.substr(at,end-at));at=end+1;
  }
  return true;
}
enum class Prefix {DHCP,OTHER,UNREADABLE};
inline Prefix client_prefix(const std::string&path) {
  const int fd=::open(path.c_str(),O_RDONLY|O_NOFOLLOW|O_NONBLOCK|O_CLOEXEC);
  if(fd<0)return Prefix::UNREADABLE;
  // Read one byte at a time only until argv0 (and BusyBox applet argv1). A
  // large shell -c payload is never prefetched to decide whether it is DHCP.
  const auto word=[&](size_t maximum,std::string&out) {
    for(size_t n=0;n<maximum;++n) {
      char c=0;ssize_t count;
      do {count=::read(fd,&c,1);}while(count<0 && errno==EINTR);
      if(count!=1)return false;
      if(!c)return true;
      out+=c;
    }
    return false;
  };
  std::string first,second;Prefix result=Prefix::UNREADABLE;
  if(word(256,first)) {
    const auto slash=first.rfind('/');const auto name=slash==std::string::npos?first:first.substr(slash+1);
    if(name=="udhcpc")result=Prefix::DHCP;
    else if(name!="busybox")result=Prefix::OTHER;
    else if(word(32,second))result=second=="udhcpc"?Prefix::DHCP:Prefix::OTHER;
  }
  ::close(fd);return result;
}
inline Node node_at(int parent,const char*name) {
  Node n;struct stat s{};
  if(::fstatat(parent,name,&s,AT_SYMLINK_NOFOLLOW)){n.error=errno;return n;}
  n.owner=int(s.st_uid);n.mode=int(s.st_mode&07777);n.device=uint64_t(s.st_dev);n.inode=uint64_t(s.st_ino);
  n.directory=S_ISDIR(s.st_mode);n.symlink=S_ISLNK(s.st_mode);return n;
}
inline bool known_vendor_launcher(int root) {
#if defined(__linux__)
  // Only an EXACT known 537-byte source may be attested. A replacement file,
  // symlink, FIFO or unknown bytes never become downloadable data/key hashes.
  int parent=::fcntl(root,F_DUPFD_CLOEXEC,3);if(parent<0)return false;
  for(const char*name:{"data","etc","wifi"}) {
    const int next=::openat(parent,name,O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);::close(parent);parent=next;
    struct stat s{};if(parent<0 || ::fstat(parent,&s) || !S_ISDIR(s.st_mode) || s.st_uid!=0){if(parent>=0)::close(parent);return false;}
  }
  const int file=::openat(parent,"udhcpc_wlan0",O_RDONLY|O_NONBLOCK|O_NOFOLLOW|O_CLOEXEC);
  struct stat before{},after{},named{};std::string data(537,'\0');
  bool okay=file>=0 && !::fstat(file,&before) && S_ISREG(before.st_mode) && before.st_uid==0 && before.st_nlink==1 && before.st_size==537;
  if(okay)okay=::pread(file,data.data(),data.size(),0)==ssize_t(data.size()) && !::fstat(file,&after) &&
    !::fstatat(parent,"udhcpc_wlan0",&named,AT_SYMLINK_NOFOLLOW) &&
    before.st_dev==after.st_dev && before.st_ino==after.st_ino && before.st_size==after.st_size &&
    before.st_mtim.tv_sec==after.st_mtim.tv_sec && before.st_mtim.tv_nsec==after.st_mtim.tv_nsec &&
    before.st_ctim.tv_sec==after.st_ctim.tv_sec && before.st_ctim.tv_nsec==after.st_ctim.tv_nsec &&
    after.st_dev==named.st_dev && after.st_ino==named.st_ino;
  if(okay) {
    unsigned char digest[32]{};unsigned size=0;std::string hex;constexpr char digits[]="0123456789abcdef";
    okay=EVP_Digest(data.data(),data.size(),digest,&size,EVP_sha256(),nullptr)==1 && size==32;
    if(okay)for(unsigned char value:digest){hex+=digits[value>>4];hex+=digits[value&15];}
    okay=okay && hex=="329bf2a3f4c4a8f2f34ad4080b1aa764493b74181ef88beba88e77b104e03cc1";
  }
  if(file>=0)::close(file);
  ::close(parent);return okay;
#else
  (void)root;return false;
#endif
}
inline Inspection inspect(const std::string&fixture_root="/",const std::string&proc="/proc") {
  Inspection result;
#if defined(__linux__)
  result.supported=true;
  const int root=::open(fixture_root.c_str(),O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);
  if(root<0){result.error="metadata_root_unavailable";return result;}
  result.parents[0]=node_at(root,".");result.parents[1]=node_at(root,"data");
  const int data=::openat(root,"data",O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);
  if(data>=0){result.parents[2]=node_at(data,".esphome-cgs1");::close(data);}
  else result.parents[2].error=errno;
  result.vendor_launcher_matches=known_vendor_launcher(root);::close(root);
  result.executable=resolve_executable(fixture_root);
  if(fixture_root=="/" && proc=="/proc") {
    cgs1_supervisor::RunnerWifiPrivateRoot parent;result.canonical_parent_available=parent.open() && parent.current();
    result.ipv4=cgs1_ipv4::inspect();
  }
  DIR*directory=::opendir(proc.c_str());if(!directory){result.error="proc_inventory_unavailable";return result;}
  unsigned count=0;bool bounded=true;
  const auto reject=[&](const cgs1_net_trial::ProcessIdentity&p,unsigned stage,const Arguments*flags=nullptr,
      const std::vector<std::string>*argv=nullptr) {
    ++result.unreadable;++result.failure_stages[stage];
    if(result.rejected.size()<8) {
      Rejected r;r.pid=p.pid;r.start=p.start;r.stage=stage;
      if(flags){r.short_option=flags->unsupported_short_option;r.failure=flags->failure;r.failure_index=flags->failure_index;}
      if(argv){r.arguments=unsigned(argv->size());r.shape=argument_shape(*argv);}
      result.rejected.push_back(std::move(r));
    }
  };
  while(const auto*entry=::readdir(directory)) {
    const std::string name=entry->d_name;
    if(name.empty() || name.find_first_not_of("0123456789")!=std::string::npos)continue;
    if(++count>1024){bounded=false;break;}
    const auto pid=std::strtol(name.c_str(),nullptr,10);if(pid<=1 || pid>INT_MAX)continue;
    cgs1_net_trial::ProcessIdentity p;p.pid=pid;
    const auto base=proc+"/"+name;
    // Kernel tasks (including early start_tick=0) have no user executable.
    // Keep the strict shared userspace birth parser, and on its failure
    // distinguish a missing user exe from an unknown userspace process.
    char executable[PATH_MAX];const auto length=::readlink((base+"/exe").c_str(),executable,sizeof(executable));
    const bool no_user_executable=length<0 && errno==ENOENT;
    if(!cgs1_net_trial::parse_process_stat(cgs1_net_trial::read_small(base+"/stat"),p) || p.pid!=pid) {
      if(no_user_executable){++result.without_user_executable;continue;}
      struct stat alive{};if(!::lstat((proc+"/"+name).c_str(),&alive))reject(p,0);continue;
    }
    if(p.state=='Z' || p.state=='X')continue;
    if(no_user_executable){++result.without_user_executable;continue;}
    if(length<=0 || size_t(length)>=sizeof(executable)){reject(p,1);continue;}
    p.executable.assign(executable,size_t(length));
    if(p.executable!="/bin/busybox" && p.executable!="/bin/udhcpc" && p.executable!="/sbin/udhcpc" &&
        p.executable!="/usr/sbin/udhcpc" && p.executable!="/usr/bin/udhcpc" &&
        (!result.executable.verified || p.executable!=result.executable.path))continue;
    struct stat owner{};
    if(::lstat(base.c_str(),&owner) || owner.st_uid!=0){reject(p,2);continue;}
    const auto prefix=client_prefix(base+"/cmdline");
    if(prefix==Prefix::OTHER)continue;
    // Native takeover intentionally STOPs the root BusyBox wrapper/watchdog.
    // Their /bin/sh prefix proves they are not DHCP BEFORE liveness becomes
    // relevant. Rejecting every stopped BusyBox here made a healthy single
    // udhcpc inventory incomplete only in native mode. A stopped/unknown true
    // DHCP candidate still fails the SAME stage-2 gate; root ownership,
    // bounded prefix-only reads, full argv validation and final birth checks
    // remain unchanged. No signal, launcher execution or retry is introduced.
    if(!p.running()){reject(p,2);continue;}
    if(prefix!=Prefix::DHCP){reject(p,3);continue;}
    std::vector<std::string>argv;
    if(!read_arguments(base+"/cmdline",argv)){reject(p,4);continue;}
    const auto flags=arguments(argv);
    if(!flags.recognized){reject(p,5,&flags,&argv);continue;}
    if(::lstat((proc+"/"+name).c_str(),&owner) || owner.st_uid!=0 || !p.running() || !cgs1_net_trial::same_process(p,proc)) {reject(p,6);continue;}
    if(!flags.wlan0){++result.other_clients;continue;}
    if(result.clients.size()>=4){bounded=false;break;}
    result.clients.push_back({p,flags});
  }
  ::closedir(directory);result.scan_complete=bounded && !result.unreadable;
  if(!bounded)result.error="bounded_dhcp_inventory_exceeded";
#else
  (void)fixture_root;(void)proc;result.error="verified_linux_required";
#endif
  return result;
}
} // namespace cgs1_dhcp
