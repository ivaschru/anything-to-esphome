#include "full_release_store.h"
#include <cassert>
#include <filesystem>

// Same file/ownership checks as production. Only the test's temp directories
// and ext4 magic differ; neither the synthetic ELF nor a device is executed.
struct FixtureLayout {
  static constexpr auto NAMES=cgs1_net_trial::FullStagingLayout::NAMES;
  static bool accepts_job(const std::string &job){return cgs1_net_trial::FullStagingLayout::accepts_job(job);}
  static std::string create(const std::string &job) {
    const auto name="stage-"+job;
    return ::mkdir(name.c_str(),0700)?"":name;
  }
};
using Stage=cgs1_net_trial::BasicStaging<FixtureLayout>;
using Store=cgs1_supervisor::BasicFullReleaseStore<0x01021994>;
using Body=std::array<unsigned char,53>;

static Body image(unsigned char marker) {
  Body body{};
  body[0]=0x7f;body[1]='E';body[2]='L';body[3]='F';
  body[4]=1;body[5]=1;body[6]=1;body[16]=2;body[18]=40;
  body[20]=1;body[37]=4;body[40]=52;body.back()=marker;
  return body;
}
template<size_t Size> static std::string hex(const std::array<unsigned char,Size> &data) {
  static constexpr char digits[]="0123456789abcdef";
  std::string result;
  for(auto byte:data){result+=digits[byte>>4];result+=digits[byte&15];}
  return result;
}
static Stage::Artifact pin(const Body &body) {
  cgs1_supervisor::Digest hash{};
  assert(SHA256(body.data(),body.size(),hash.data()));
  return {static_cast<uint32_t>(body.size()),hex(hash)};
}
static Store::Manifest manifest(const std::array<Stage::Artifact,2> &pins) {
  return {{{pins[0].size,pins[0].sha256},{pins[1].size,pins[1].sha256}}};
}
static void upload(Stage &stage,const std::string &job,int index,const Body &body) {
  const auto wire=hex(body);
  assert(stage.begin(job,index));
  assert(stage.append(job,index,0,wire.data(),wire.size()));
  assert(stage.seal(job,index));
}

int main() {
  char directory[]="/dev/shm/cgs1-release-fixture-XXXXXX";
  assert(::mkdtemp(directory));
  const int parent=::open(directory,O_RDONLY|O_DIRECTORY|O_CLOEXEC);
  assert(parent>=0);
  {
    const auto guardian=image(1),prior=image(2),next=image(3);
    const std::array<Stage::Artifact,2> old_pins{pin(prior),pin(guardian)},next_pins{pin(next),pin(guardian)};
    Stage old_stage(old_pins),next_stage(next_pins);
    Store old_store(manifest(old_pins)),next_store(manifest(next_pins));
    const std::string old_job="1111111111111111",next_job="2222222222222222";
    assert(old_store.open(parent,true) && next_store.open(parent));
    upload(old_stage,old_job,0,prior);upload(old_stage,old_job,1,guardian);
    assert(old_store.install_staged(old_stage,old_job));
    assert(old_store.set_enabled(true) && old_stage.discard(old_job));

    upload(next_stage,next_job,0,next);
    assert(!next_store.install_staged(next_stage,next_job));
    assert(!next_store.verify() && old_store.enabled());
    upload(next_stage,next_job,1,guardian);
    assert(!next_store.install_staged(next_stage,old_job));
    // A sealed image for the next build must not be admitted by the bridge
    // for the current build even when the guardian digest is unchanged.
    assert(!old_store.install_staged(next_stage,next_job));
    assert(next_store.install_staged(next_stage,next_job));
    assert(next_stage.discard(next_job) && next_store.verify());
    assert(old_store.verify() && old_store.enabled() && !next_store.enabled());
  }
  assert(!::close(parent));
  std::filesystem::remove_all(directory);
}
