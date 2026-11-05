#pragma once

// Secret-bearing state is fixed-capacity and separate from ESPHome
// preferences/HA exports/history. No growing std::string retains old freed
// password fragments while typing. This model has no socket, device or file IO.
#include <array>
#include <cstddef>
#include <string>

namespace esphome::cgs1_panel {
class WifiPassword {
 public:
  WifiPassword()=default;WifiPassword(const WifiPassword&)=delete;WifiPassword&operator=(const WifiPassword&)=delete;
  ~WifiPassword(){clear();}
  bool append(char character) {
    const auto c=static_cast<unsigned char>(character);
    if(c<32 || c>126 || size_>=63)return false;
    bytes_[size_++]=character;bytes_[size_]=0;return true;
  }
  void backspace(){if(size_){bytes_[--size_]=0;}}
  void clear() {
    volatile char*data=bytes_.data();for(size_t i=0;i<bytes_.size();++i)data[i]=0;
    size_=0;visible_=false;
  }
  size_t size()const{return size_;}bool valid_length()const{return size_>=8 && size_<=63;}
  bool visible()const{return visible_;}void toggle_visible(){visible_=!visible_;}
  template<class Callback>bool submit(Callback&&callback) {
    if(!valid_length())return false;
    // Borrow lasts only for this call. The network adapter must derive the
    // binary request synchronously, before returning. true means accepted
    // for processing, never connection/commit success. Busy/refused keeps
    // input for an intentional edit; an accepted request erases it at once.
    if(!callback(bytes_.data(),size_))return false;
    clear();return true;
  }
  template<class Visitor>void draw(Visitor&&visitor)const {
    // The display callback prints one character at a time, so showing text
    // does not allocate an unmanaged string copy. Do not use this as a getter
    // in diagnostics/API/capture. Headless QA uses invented fixture input only.
    for(size_t i=0;i<size_;++i)visitor(visible_?bytes_[i]:'*');
  }
 private:
  std::array<char,64>bytes_{};size_t size_{0};bool visible_{false};
};

enum class WifiKeys {LETTERS,NUMBERS,SYMBOLS};
struct WifiKeypad {
  WifiKeys mode{WifiKeys::LETTERS};bool uppercase{false};
  const char*row(unsigned index)const {
    if(index>=3)return "";
    static constexpr const char*LOWER[]={"qwertyuiop","asdfghjkl","zxcvbnm"};
    static constexpr const char*UPPER[]={"QWERTYUIOP","ASDFGHJKL","ZXCVBNM"};
    static constexpr const char*NUMBERS[]={"1234567890","-/:;()$&@\"",".,?!'`~=^_"};
    static constexpr const char*SYMBOLS[]={"[]{}#%*+\\|","<>:;()/=?!","!\"#$%&'*+,"};
    return mode==WifiKeys::LETTERS?(uppercase?UPPER[index]:LOWER[index]):
      mode==WifiKeys::NUMBERS?NUMBERS[index]:SYMBOLS[index];
  }
  void next_mode(){mode=mode==WifiKeys::LETTERS?WifiKeys::NUMBERS:mode==WifiKeys::NUMBERS?WifiKeys::SYMBOLS:WifiKeys::LETTERS;}
};
} // namespace esphome::cgs1_panel
