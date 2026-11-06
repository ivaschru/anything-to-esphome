// Check the actual optional SDK MD5 class against RFC 1321 vectors. This
// checksum is still protected by Noise OTA and separate SHA-256 image checks;
// changing its implementation must not change any wire digest or lazy/reset
// behavior. No device/network/credential access is present in this test.
#include "esphome/components/md5/md5.h"
#include <array>
#include <cassert>
#include <iostream>
#include <string>
static std::string hex(esphome::md5::MD5Digest &d){std::array<uint8_t,16>b{};d.get_bytes(b.data());std::string h;for(auto v:b){h+="0123456789abcdef"[v>>4];h+="0123456789abcdef"[v&15];}return h;}
int main(){
  const std::pair<std::string,std::string> vectors[]={
    {"","d41d8cd98f00b204e9800998ecf8427e"},{"a","0cc175b9c0f1b6a831c399e269772661"},
    {"abc","900150983cd24fb0d6963f7d28e17f72"},{"message digest","f96b697d7cb7938d525a2f31aaf161d0"},
    {"abcdefghijklmnopqrstuvwxyz","c3fcd3d76192e4007dfb496cca67e13b"},
    {"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789","d174ab98d277d9f5a5611c2c9f419d9f"},
    {"12345678901234567890123456789012345678901234567890123456789012345678901234567890","57edf4a22be3c955ac49da2e2107b67a"},
    {std::string(1000000,'a'),"7707d6ae4e027c70eea2a935c2296f21"}};
  unsigned checks=0;
  for(const auto &v:vectors){esphome::md5::MD5Digest d;for(size_t i=0;i<v.first.size();i+=17)d.add(v.first.data()+i,std::min<size_t>(17,v.first.size()-i));d.calculate();assert(hex(d)==v.second);d.calculate();assert(hex(d)==v.second);d.init();d.add("abc",3);d.calculate();assert(hex(d)=="900150983cd24fb0d6963f7d28e17f72");++checks;}
  std::cout<<"compact SDK MD5 vectors "<<checks<<" passed\n";
}
