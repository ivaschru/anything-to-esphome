#pragma once
// Pure interaction and transaction logic. No GPIO, Wi-Fi, NVS or ESPHome calls
// belong here: host tests can prove that browsing never applies a setting and
// that an unsuccessful credential trial never authorizes a persistent write.
#include <algorithm>
#include <array>
#include <cctype>
#include <cstdint>
#include <cstring>
#include <string>

namespace esphome::cgdn1_ui {
enum class Screen : uint8_t { READING, MENU, SETTING, NETWORKS, NETWORK_ACTIONS, PASSWORD, CONNECTING, WIFI_ERROR, WIFI_OK };
enum class Gesture : uint8_t { LEFT, RIGHT, CENTRE, SWIPE_LEFT, SWIPE_RIGHT, OTHER };
enum class Action : uint8_t { NONE, OPEN_SETTING, APPLY_SETTING, SCAN, CONNECT, EDIT_PASSWORD, TRY_PASSWORD, CANCEL_CONNECT };
enum class Setting : uint8_t { BRIGHTNESS, PM, BLE, NIGHT, WIFI, BACK };

// Erase the temporary password on cancel, timeout, successful submission and
// destruction. Volatile stores stop the compiler removing the explicit wipe.
inline void erase_secret(char *p, size_t n) {
  volatile char *out = p;
  while (n--) *out++ = 0;
}
inline bool valid_password(const char *p, bool secured) {
  const size_t n = std::strlen(p);
  if (!secured && n == 0) return true;
  if (n >= 8 && n <= 63) return true;
  if (n != 64) return false;
  for (size_t i = 0; i < n; i++) if (!std::isxdigit(static_cast<unsigned char>(p[i]))) return false;
  return true;
}

class Model {
 public:
  static constexpr uint32_t MENU_TIMEOUT = 120000;
  Screen screen{Screen::READING};
  int page{0}, info{0}, menu{0}, draft_value{0}, network{0}, network_count{0}, choice{0};
  int keyboard_group{0}, character{0};
  uint32_t activity{0};
  bool password_secured{true}, password_invalid{false};
  std::array<char, 65> password{};

  ~Model() { clear_password(); }
  bool active() const { return screen != Screen::READING; }
  void clear_password() { erase_secret(password.data(), password.size()); password_invalid = false; }
  void begin_password(bool secured) {
    clear_password(); password_secured = secured; keyboard_group = character = 0; screen = Screen::PASSWORD;
  }
  void close() { clear_password(); screen = Screen::READING; }
  bool expire(uint32_t now) {
    // A network trial has its own bounded rollback timer; UI inactivity must
    // not hide the outcome or discard the transaction's recovery state.
    if (active() && screen != Screen::CONNECTING && uint32_t(now - activity) >= MENU_TIMEOUT) {
      close(); return true;
    }
    return false;
  }
  static const char *characters(int group) {
    static const char *const sets[] = {
      "abcdefghijklmnopqrstuvwxyz", "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "0123456789",
      " !\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~", "", "", ""
    };
    return sets[group % 7];
  }
  static int cycle(int value, int delta, int count) { return count > 0 ? (value + delta + count) % count : 0; }

  Action gesture(Gesture g, uint32_t now) {
    activity = now;
    const bool centre = g == Gesture::CENTRE;
    const int direction = g == Gesture::LEFT || g == Gesture::SWIPE_LEFT ? 1 :
                          g == Gesture::RIGHT || g == Gesture::SWIPE_RIGHT ? -1 : 0;
    if (screen == Screen::PASSWORD) {
      // Swipes choose a character set/action; end taps choose a character.
      // Centre adds exactly one character or explicitly applies the action.
      // Long-touch is deliberately not a shortcut: it remains the stock HA
      // event and cannot unexpectedly save credentials or reset networking.
      if (g == Gesture::SWIPE_LEFT || g == Gesture::SWIPE_RIGHT) {
        keyboard_group = cycle(keyboard_group, direction, 7); character = 0;
      } else if (direction && keyboard_group < 4) {
        character = cycle(character, -direction, std::strlen(characters(keyboard_group)));
      } else if (centre) {
        const size_t n = std::strlen(password.data());
        if (keyboard_group < 4 && n < 64) {
          password[n] = characters(keyboard_group)[character]; password[n + 1] = 0;
        } else if (keyboard_group == 4 && n) {
          password[n - 1] = 0;
        } else if (keyboard_group == 5) {
          password_invalid = !valid_password(password.data(), password_secured);
          if (!password_invalid) return Action::TRY_PASSWORD;
        } else if (keyboard_group == 6) {
          clear_password(); screen = Screen::NETWORK_ACTIONS; choice = 0;
        }
      }
      return Action::NONE;
    }
    if (screen == Screen::READING) {
      if (direction) { page = cycle(page, direction, 5); info = 0; }
      else if (centre && page == 4) info = cycle(info, 1, 3);
      else if (centre) { screen = Screen::MENU; menu = 0; }
    } else if (screen == Screen::MENU) {
      if (direction) menu = cycle(menu, direction, 6);
      else if (centre && menu == int(Setting::BACK)) close();
      else if (centre && menu == int(Setting::WIFI)) { screen = Screen::NETWORKS; network = 0; return Action::SCAN; }
      else if (centre) { screen = Screen::SETTING; return Action::OPEN_SETTING; }
    } else if (screen == Screen::SETTING) {
      if (g == Gesture::SWIPE_LEFT || g == Gesture::SWIPE_RIGHT) { screen = Screen::MENU; return Action::NONE; }
      if (direction) draft_value = menu == int(Setting::BRIGHTNESS) ? std::clamp(draft_value - direction, 1, 6) : !draft_value;
      else if (centre) { screen = Screen::MENU; return Action::APPLY_SETTING; }
    } else if (screen == Screen::NETWORKS) {
      if (direction) network = cycle(network, direction, network_count + 2);
      else if (centre && network == network_count) return Action::SCAN;
      else if (centre && network == network_count + 1) { screen = Screen::MENU; menu = int(Setting::WIFI); }
      else if (centre && network < network_count) { screen = Screen::NETWORK_ACTIONS; choice = 0; }
    } else if (screen == Screen::NETWORK_ACTIONS || screen == Screen::WIFI_ERROR) {
      if (direction) choice = cycle(choice, direction, 3);
      else if (centre && choice == 2) { screen = Screen::NETWORKS; choice = 0; }
      else if (centre) {
        const bool edit = screen == Screen::WIFI_ERROR ? choice == 0 : choice == 1;
        return edit ? Action::EDIT_PASSWORD : Action::CONNECT;
      }
    } else if (screen == Screen::CONNECTING && centre) {
      screen = Screen::NETWORK_ACTIONS; choice = 0; return Action::CANCEL_CONNECT;
    } else if (screen == Screen::WIFI_OK && centre) {
      screen = Screen::NETWORKS;
    }
    return Action::NONE;
  }
};

enum class TrialAction : uint8_t { NONE, COMMIT, ROLLBACK };
class NetworkTrial {
 public:
  static constexpr uint32_t TIMEOUT = 30000, STABLE = 5000;
  void begin(uint32_t now) { active_ = true; started_ = now; matching_ = false; }
  bool active() const { return active_; }
  TrialAction cancel() { const bool was = active_; active_ = false; return was ? TrialAction::ROLLBACK : TrialAction::NONE; }
  TrialAction tick(uint32_t now, bool matching_ssid_with_ip, bool ota_active = false) {
    if (!active_ || ota_active) return TrialAction::NONE;
    if (matching_ssid_with_ip) {
      if (!matching_) { matching_ = true; stable_since_ = now; }
      if (uint32_t(now - stable_since_) >= STABLE) { active_ = false; return TrialAction::COMMIT; }
    } else matching_ = false;
    if (uint32_t(now - started_) >= TIMEOUT) { active_ = false; return TrialAction::ROLLBACK; }
    return TrialAction::NONE;
  }
 private:
  bool active_{false}, matching_{false};
  uint32_t started_{0}, stable_since_{0};
};
}  // namespace esphome::cgdn1_ui
