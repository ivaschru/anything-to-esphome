#include "cgs1_panel.h"

#include <arpa/inet.h>
#include <fcntl.h>
#include <net/if.h>
#include <sys/ioctl.h>
#include <sys/socket.h>

#include <cmath>
#include <ctime>

#include "esphome/core/hal.h"
#include "esphome/core/log.h"

namespace esphome::cgs1_panel {
namespace {
// Semantic design tokens from the approved dark mockup (720px viewport).
const Color BG(0x101418), CARD(0x1b2228), TEXT(0xf1f6f8), MUTED(0xa6b6bf), ACCENT(0x26a88b), INK(0x88cfbf),
    SOFT(0x163935), LINE(0x344149), WARN(0xefc177);
const char* const LABELS[] = {"CO₂", "Температура", "Влажность", "PM2.5", "TVOC"};
const char* const UNITS[] = {"ppm", "°C", "%", "мкг/м³", "ppm"};
const char* const MODES[] = {"CO₂ + температура", "Только CO₂", "Часы + показатели", "Ночной режим",
                             "Выключенный экран"};
std::string ip_address() {
  char address[INET_ADDRSTRLEN] = "Нет IPv4";
  int fd = socket(AF_INET, SOCK_DGRAM, 0);
  ifreq request{};
  std::snprintf(request.ifr_name, IFNAMSIZ, "wlan0");
  if (fd >= 0) {
    fcntl(fd, F_SETFD, FD_CLOEXEC);
    if (!ioctl(fd, SIOCGIFADDR, &request))
      inet_ntop(AF_INET, &reinterpret_cast<sockaddr_in*>(&request.ifr_addr)->sin_addr, address,
                sizeof(address));
    close(fd);
  }
  return address;
}
std::string clock_text(time_t stamp = std::time(nullptr)) {
  if (stamp < 1700000000) return "–:–";
  tm local{};
  localtime_r(&stamp, &local);
  char text[16];
  std::strftime(text, sizeof(text), "%H:%M", &local);
  return text;
}
}  // namespace
void Panel::setup() {
  frame_.resize(720 * 720);
  ha_values_.fill(NAN);
  last_touch_ = millis();
  const char* prefs = std::getenv("ESPHOME_PREFDIR");
  capture_ = headless_ || (prefs && access((std::string(prefs) + "/../capture-ui").c_str(), F_OK) == 0);
  if (!small_ || !label_ || !body_ || !title_ || !value_ || !big_ || !detail_ || !saver_ || !temperature_ ||
      !drm_.open_panel(headless_)) {
    ESP_LOGE("cgs1.ui", "Panel preflight failed; returning to guardian");
    std::exit(2);
  }
  ready_ = true;
  update();
}
void Panel::draw_absolute_pixel_internal(int x, int y, Color color) {
  if (x >= 0 && x < 720 && y >= 0 && y < 720)
    frame_[size_t(y) * 720 + x] = (uint32_t(color.r) << 16) | (uint32_t(color.g) << 8) | color.b;
}
void Panel::card_(int x, int y, int w, int h, Color color, int radius) {
  radius = std::min({radius, w / 2, h / 2});
  filled_rectangle(x + radius, y, w - 2 * radius, h, color);
  filled_rectangle(x, y + radius, w, h - 2 * radius, color);
  for (int cx : {x + radius, x + w - radius - 1})
    for (int cy : {y + radius, y + h - radius - 1}) filled_circle(cx, cy, radius, color);
}
int Panel::width_(font::Font* font, const std::string& text) const {
  int width, offset, baseline, height;
  font->measure(text.c_str(), &width, &offset, &baseline, &height);
  return width;
}
void Panel::pair_(int center, int baseline, font::Font* number, const std::string& text, font::Font* unit,
                  const char* suffix, Color ink) {
  const int w = width_(number, text), uw = width_(unit, suffix), left = center - (w + 7 + uw) / 2;
  print(left, baseline, number, ink, display::TextAlign::BASELINE_LEFT, text.c_str());
  print(left + w + 7, baseline, unit, MUTED, display::TextAlign::BASELINE_LEFT, suffix);
}
void Panel::icon_(int x, int y, Icon icon, Color color, int size) {
  // Consistent 24-unit outline symbols, following the Lucide family already
  // used in the approved mockup. Drawing vectors avoids emoji/font fallback.
  auto l = [&](int a, int b, int c, int d) {
    line(x + a * size / 24, y + b * size / 24, x + c * size / 24, y + d * size / 24, color);
  };
  auto box = [&](int a, int b, int w, int h) {
    rectangle(x + a * size / 24, y + b * size / 24, w * size / 24, h * size / 24, color);
  };
  switch (icon) {
    case GRID:
      box(3, 3, 7, 7);
      box(14, 3, 7, 4);
      box(14, 11, 7, 10);
      box(3, 14, 7, 7);
      break;
    case BACK:
      l(15, 5, 8, 12);
      l(8, 12, 15, 19);
      break;
    case NEXT:
      l(9, 5, 16, 12);
      l(16, 12, 9, 19);
      break;
    case SLIDERS:
      l(3, 6, 7, 6);
      l(12, 6, 21, 6);
      circle(x + 9 * size / 24, y + 6 * size / 24, 2 * size / 24, color);
      l(3, 18, 14, 18);
      l(19, 18, 21, 18);
      circle(x + 16 * size / 24, y + 18 * size / 24, 2 * size / 24, color);
      break;
    case MOON:
      circle(x + 12 * size / 24, y + 12 * size / 24, 9 * size / 24, color);
      filled_circle(x + 17 * size / 24, y + 7 * size / 24, 9 * size / 24, BG);
      break;
    case SUN:
      circle(x + 12 * size / 24, y + 12 * size / 24, 4 * size / 24, color);
      for (int i = 0; i < 8; ++i) {
        double a = i * 3.14159265 / 4;
        l(12 + int(7 * std::cos(a)), 12 + int(7 * std::sin(a)), 12 + int(10 * std::cos(a)),
          12 + int(10 * std::sin(a)));
      }
      break;
    case HOUSE:
      l(3, 10, 12, 3);
      l(12, 3, 21, 10);
      l(5, 9, 5, 21);
      l(5, 21, 19, 21);
      l(19, 21, 19, 9);
      box(9, 14, 6, 7);
      break;
    case WIFI:
      l(2, 8, 7, 5);
      l(7, 5, 17, 5);
      l(17, 5, 22, 8);
      l(6, 12, 10, 10);
      l(10, 10, 14, 10);
      l(14, 10, 18, 12);
      l(10, 16, 14, 16);
      filled_circle(x + size / 2, y + 20 * size / 24, std::max(1, size / 24), color);
      break;
    case INFO:
      circle(x + size / 2, y + size / 2, 9 * size / 24, color);
      l(12, 11, 12, 17);
      filled_circle(x + size / 2, y + 7 * size / 24, 1, color);
      break;
    case RADIO:
      circle(x + size / 2, y + size / 2, 2 * size / 24, color);
      l(6, 6, 4, 12);
      l(4, 12, 6, 18);
      l(18, 6, 20, 12);
      l(20, 12, 18, 18);
      break;
    case CHECK:
      l(4, 12, 9, 17);
      l(9, 17, 20, 6);
      break;
  }
}
std::string Panel::formatted_(int i) const {
  if (i < 0 || i >= 5 || !std::isfinite(values_[i])) return "—";
  char text[40];
  std::snprintf(text, sizeof(text),
                i == 4                       ? "%.3f"
                : i == 0 || i == 2 || i == 3 ? "%.0f"
                                             : "%.1f",
                double(values_[i]));
  return text;
}
const char* Panel::source_(int i) const {
  if (ha_selected_[i]) return tr_("Сводный показатель HA");
  return raw_temperature_ && (i == 1 || i == 2) ? tr_("Без коррекции") : tr_("Местный сенсор");
}
const char* Panel::tag_(int i) const {
  if (i == 3 && !pm_enabled_ && !ha_selected_[i]) return tr_("Выключен");
  if (i == 3 && pm_warming_ && !ha_selected_[i]) return tr_("Прогрев");
  if (!std::isfinite(values_[i])) return tr_("Нет данных");
  return ha_selected_[i] ? "HA" : tr_("Сенсор");
}
bool Panel::ha_fallback_() const {
  for (int i = 0; i < 5; ++i)
    if (ha_mode_ && ha_bound_[i] && !ha_selected_[i]) return true;
  return fixture_ha_lost_;
}
void Panel::set_ha_binding(int i, bool configured) {
  if (i < 0 || i >= 5) return;
  ha_bound_[i] = configured;
  ha_values_[i] = NAN;
  ha_received_[i] = 0;
}
void Panel::set_ha_value(int i, float value) {
  if (i < 0 || i >= 5) return;
  ha_values_[i] = value;
  ha_received_[i] = millis();
}
void Panel::set_saver_mode(const std::string& mode) {
  for (int i = 0; i < 5; ++i)
    if (mode == MODES[i]) {
      mode_ = static_cast<Saver>(i);
      return;
    }
}
void Panel::set_idle_seconds(float seconds) {
  if (std::isfinite(seconds)) idle_ms_ = uint32_t(std::clamp(seconds, 5.0f, 600.0f) * 1000);
}
void Panel::set_brightness_percent(float percent) {
  if (std::isfinite(percent)) brightness_ = cgs1_backlight::day_raw(percent);
}
void Panel::set_night_brightness_percent(float percent) {
  if (std::isfinite(percent)) night_brightness_ = cgs1_backlight::night_raw(percent);
}
void Panel::loop() {
  if (!ready_) return;
  TouchTracker::Event event;
  for (int count = 0; count < 16 && drm_.poll_touch(event); ++count) gesture_(event);
  const auto idle=(page_==WIFI_PASSWORD || page_==WIFI_SSID)?std::max(idle_ms_,60000U):idle_ms_;
  if (!sleeping_ && !(page_==WIFI_PROGRESS && wifi_busy_()) && uint32_t(millis() - last_touch_) >= idle) {
    wifi_password_.clear();
    sleeping_ = true;
    update();
  }
}
void Panel::slider_(int x, bool night) {
  float fraction = std::clamp(float(x - 59) / 603, 0.0f, 1.0f);
  if (night) {
    float v = std::round((2.0f + fraction * 8.0f) * 10) / 10;
    if (night_brightness_action_)
      night_brightness_action_(v);
    else
      set_night_brightness_percent(v);
  } else {
    float v = std::round(2 + fraction * 98);
    if (brightness_action_)
      brightness_action_(v);
    else
      set_brightness_percent(v);
  }
  update();
}
void Panel::gesture_(const TouchTracker::Event& event) {
  last_touch_ = millis();
  if (event.phase == TouchTracker::Phase::DOWN) {
    dragging_ = false;
    ignore_gesture_ = sleeping_;
    if (sleeping_) {
      sleeping_ = false;
      page_ = HOME;
      update();
      return;
    }
    if ((page_ == DISPLAY || page_ == NIGHT_SETTINGS) && event.y >= 202 && event.y <= 258) {
      dragging_ = true;
      slider_(event.x, page_ == NIGHT_SETTINGS);
      return;
    }
    touch_(event.x, event.y);
  } else if (event.phase == TouchTracker::Phase::MOVE && dragging_ && !ignore_gesture_)
    slider_(event.x, page_ == NIGHT_SETTINGS);
  else if (event.phase == TouchTracker::Phase::UP) {
    dragging_ = false;
    ignore_gesture_ = false;
  }
}
void Panel::touch_(int x, int y) {
  last_touch_ = millis();
  if (sleeping_) {
    sleeping_ = false;
    page_ = HOME;
    update();
    return;
  }
  if (y >= 641) {
    wifi_password_.clear(); // Leaving a form never retains a passphrase.
    if (x < 247)
      page_ = HOME;
    else if (x < 473)
      sleeping_ = true;
    else
      page_ = SETTINGS;
    update();
    return;
  }
  if (page_ != HOME && y >= 72 && y < 130 && x < 100) {
    if(page_==WIFI_LIST || page_==WIFI_SSID || page_==WIFI_PASSWORD || page_==WIFI_PROGRESS) {
      wifi_back_();update();return;
    }
    page_ = page_ == DETAIL ? HOME : page_ == NIGHT_SETTINGS ? DISPLAY : page_ == SETTINGS ? HOME : SETTINGS;
    update();
    return;
  }
  if (x < 36 || x >= 684) return;
  if(wifi_touch_(x,y)){update();return;}
  if (page_ == HOME) {
    if (y >= 72 && y < 343) {
      metric_ = 0;
      page_ = DETAIL;
    } else if (y >= 357 && y < 631) {
      metric_ = 1 + (y >= 501 ? 2 : 0) + (x >= 360 ? 1 : 0);
      page_ = DETAIL;
    }
  } else if (page_ == SETTINGS && y >= 151 && y < 641) {
    int row = (y - 151) / 84;
    if ((y - 151) % 84 < 74) {
      const Page targets[] = {DISPLAY, SOURCES, SENSORS, NETWORK, ABOUT, LANGUAGE};
      page_ = targets[std::clamp(row, 0, 5)];
    }
  } else if (page_ == LANGUAGE && y >= 151 && y < 309) {
    const int row=(y-151)/84;
    if((y-151)%84<74 && row<2) {
      const std::string option=row==0?"English":"Русский";
      if(language_action_)language_action_(option);else set_interface_language(option);
    }
  } else if (page_ == DISPLAY) {
    if (y >= 294 && y < 368) {
      auto next = MODES[(int(mode_) + 1) % 5];
      if (saver_action_)
        saver_action_(next);
      else
        set_saver_mode(next);
    } else if (y >= 378 && y < 452) {
      const int delays[] = {10, 30, 60, 180};
      int n = 10;
      for (int i = 0; i < 4; ++i)
        if (idle_ms_ == uint32_t(delays[i] * 1000)) n = delays[(i + 1) % 4];
      if (idle_action_)
        idle_action_(n);
      else
        set_idle_seconds(n);
    } else if (y >= 462 && y < 554) {
      if (x >= 568) {
        if (night_action_)
          night_action_(!night_);
        else
          night_ = !night_;
      } else
        page_ = NIGHT_SETTINGS;
    } else if (y >= 564 && y < 630)
      sleeping_ = true;
  } else if (page_ == NIGHT_SETTINGS && y >= 294 && y < 368) {
    if (night_action_)
      night_action_(!night_);
    else
      night_ = !night_;
  } else if (page_ == DETAIL && y >= 359 && y < 414)
    period_ = std::clamp((x - 36) / 216, 0, 2);
  else if (page_ == SOURCES && y >= 204 && y < 258) {
    bool enabled = x >= 360;
    if (ha_action_)
      ha_action_(enabled);
    else
      ha_mode_ = enabled;
  } else if (page_ == SENSORS && y >= 151 && y < 243 && pm_action_)
    pm_action_(!pm_enabled_);
  update();
}
void Panel::update() {
  if (!ready_) return;
  const uint32_t started = micros();
  uint8_t sources = 0;
  for (int i = 0; i < 5; ++i) {
    ha_selected_[i] = ha_mode_ && ha_bound_[i] && std::isfinite(ha_values_[i]) &&
                      uint32_t(millis() - ha_received_[i]) < 180000 && !fixture_ha_lost_;
    values_[i] = ha_selected_[i]                           ? ha_values_[i]
                 : sensors_[i] && sensors_[i]->has_state() ? sensors_[i]->state
                                                           : NAN;
    if (i == 3 && !ha_selected_[i] && (!pm_enabled_ || pm_warming_)) values_[i] = NAN;
    if (ha_selected_[i]) sources |= 1 << i;
  }
  if (fixture_sensor_lost_) values_[0] = NAN;
  if (!next_history_ || int32_t(millis() - next_history_) >= 0) {
    next_history_ = millis() + 60000;
    history_[history_next_] = {millis(), values_, sources};
    history_next_ = (history_next_ + 1) % history_.size();
    history_count_ = std::min(history_count_ + 1, history_.size());
  }
  drm_.set_brightness(effective_brightness());
  render_();
  const uint32_t rendered = micros();
  drm_.present(frame_.data());
  const uint32_t presented = micros();
  // PM OFF is intentional, not a permanently incomplete frame. Capture the
  // first real four-sensor screen too; otherwise a PM-OFF trial could retain
  // its startup dashes until the next page/saver transition.
  bool values_ready = true;
  for(size_t i=0;i<values_.size();++i)
    if(!(i==3 && !pm_enabled_ && !ha_selected_[i]) && !std::isfinite(values_[i])) values_ready=false;
  if (capture_ && (captured_page_ != page_ || captured_metric_ != metric_ ||
                   captured_sleeping_ != sleeping_ || captured_english_ != english_ || captured_values_ready_ != values_ready)) {
    write_capture_();
    captured_page_ = page_;
    captured_metric_ = metric_;
    captured_sleeping_ = sleeping_;
    captured_english_ = english_;
    captured_values_ready_ = values_ready;
  }
  // First three frames only, in an explicit RAM capture/render fixture. This
  // separates CPU rendering, DRM scanout and optional PPM writing instead of
  // mistaking ESPHome's combined slow-operation warning for one of them.
  if(capture_ && profiled_frames_<3) {
    ++profiled_frames_;
    std::printf("CGS1_UI perf frame=%lu render_us=%lu scanout_us=%lu capture_us=%lu\n",
      static_cast<unsigned long>(profiled_frames_),static_cast<unsigned long>(rendered-started),
      static_cast<unsigned long>(presented-rendered),static_cast<unsigned long>(micros()-presented));
    std::fflush(stdout);
  }
}
void Panel::status_() {
  print(36, 32, label_, TEXT, display::TextAlign::CENTER_LEFT, tr_("Спальня"));
  auto clock = headless_ ? std::string("23:48") : clock_text();
  print(684, 32, label_, MUTED, display::TextAlign::CENTER_RIGHT, clock.c_str());
  icon_(592, 23, WIFI, MUTED, 18);
  if (std::any_of(ha_selected_.begin(), ha_selected_.end(), [](bool x) { return x; }))
    print(567, 32, small_, INK, display::TextAlign::CENTER_RIGHT, "HA");
}
void Panel::header_(const char* title) {
  status_();
  icon_(50, 88, BACK, TEXT, 26);
  print(101, 100, title_, TEXT, display::TextAlign::CENTER_LEFT, tr_(title));
}
void Panel::navigation_() {
  horizontal_line(0, 641, 720, LINE);
  const char* titles[] = {tr_("Сенсоры"), tr_("Заставка"), tr_("Настройки")};
  const Icon symbols[] = {GRID, MOON, SLIDERS};
  for (int i = 0; i < 3; ++i) {
    const Color c =
        ((i == 0 && (page_ == HOME || page_ == DETAIL)) || (i == 2 && page_ != HOME && page_ != DETAIL))
            ? INK
            : MUTED;
    int center = 134 + i * 226;
    icon_(center - 9, 658, symbols[i], c, 18);
    print(center, 692, small_, c, display::TextAlign::CENTER, titles[i]);
  }
}
void Panel::home_() {
  status_();
  int offset = ha_fallback_() ? 32 : 0;
  if (offset) {
    icon_(36, 77, HOUSE, WARN, 20);
    print(68, 86, small_, WARN, display::TextAlign::CENTER_LEFT, tr_("Нет связи с HA · местные показания"));
  }
  const std::string top = std::string("CO₂   ") + tag_(0);
  print(360, 103 + offset, label_, ha_selected_[0] ? INK : TEXT, display::TextAlign::CENTER, top.c_str());
  pair_(360, 306 + offset / 2, big_, formatted_(0), body_, "ppm", TEXT);
  for (int i = 1; i < 5; ++i) {
    int x = (i % 2) ? 36 : 367, y = (i <= 2 ? 357 : 501) + offset / 3;
    int h = 130 - offset / 3;
    card_(x, y, 317, h, CARD);
    print(x + 22, y + 22, label_, TEXT, tr_(LABELS[i]));
    print(x + 295, y + 26, small_, ha_selected_[i] ? INK : MUTED, display::TextAlign::TOP_RIGHT, tag_(i));
    const auto text = formatted_(i);
    print(x + 22, y + 99, value_, TEXT, display::TextAlign::BASELINE_LEFT, text.c_str());
    print(x + 29 + width_(value_, text), y + 99, label_, MUTED, display::TextAlign::BASELINE_LEFT, tr_(UNITS[i]));
  }
}
void Panel::draw_detail_() {
  pair_(360, 279, detail_, formatted_(metric_), body_, tr_(UNITS[metric_]), TEXT);
  std::string label = source_(metric_);
  if (metric_ == 4) label += tr_(" · оценка TVOC");
  int label_width = width_(label_, label);
  icon_(360 - label_width / 2 - 35, 314, ha_selected_[metric_] ? HOUSE : RADIO, MUTED, 22);
  print(376, 326, label_, MUTED, display::TextAlign::CENTER, label.c_str());
  card_(36, 359, 648, 53, CARD, 14);
  const char* periods[] = {tr_("1 ч"), tr_("8 ч"), tr_("24 ч")};
  for (int i = 0; i < 3; ++i) {
    if (i == period_) card_(41 + i * 215, 364, 207, 43, SOFT, 11);
    print(145 + i * 215, 386, body_, i == period_ ? INK : MUTED, display::TextAlign::CENTER, periods[i]);
  }
  static constexpr uint32_t windows[] = {3600000, 28800000, 86400000};
  const uint32_t window = windows[period_], now = millis();
  float lo = INFINITY, hi = -INFINITY;
  int valid = 0;
  const size_t first = (history_next_ + history_.size() - history_count_) % history_.size();
  for (size_t i = 0; i < history_count_; ++i) {
    const auto& s = history_[(first + i) % history_.size()];
    if (uint32_t(now - s.at) <= window && std::isfinite(s.values[metric_])) {
      lo = std::min(lo, s.values[metric_]);
      hi = std::max(hi, s.values[metric_]);
      ++valid;
    }
  }
  for (int y : {445, 502, 560}) horizontal_line(90, y, 577, LINE);
  if (!valid) {
    print(360, 501, small_, MUTED, display::TextAlign::CENTER, tr_("История ещё накапливается"));
    return;
  }
  const float span = std::max(hi - lo, metric_ == 4 ? 0.01f : 1.0f), bottom = lo - (span - (hi - lo)) / 2;
  for (int i = 0; i < 3; ++i) {
    char text[32];
    std::snprintf(text, sizeof(text),
                  metric_ == 4   ? "%.2f"
                  : metric_ == 1 ? "%.1f"
                                 : "%.0f",
                  double(bottom + span * (2 - i) / 2));
    print(36, 445 + i * 57, small_, MUTED, display::TextAlign::CENTER_LEFT, text);
  }
  bool previous = false;
  int px = 0, py = 0;
  uint8_t source = 0;
  uint32_t at = 0;
  for (size_t i = 0; i < history_count_; ++i) {
    const auto& s = history_[(first + i) % history_.size()];
    uint32_t age = now - s.at;
    float v = s.values[metric_];
    if (age > window || !std::isfinite(v)) {
      previous = false;
      continue;
    }
    int x = 667 - int(double(age) * 577 / window), y = 560 - int((v - bottom) * 115 / span);
    bool same = (source & (1 << metric_)) == (s.sources & (1 << metric_));
    if (previous && same && uint32_t(s.at - at) <= 90000)
      line(px, py, x, y, INK);
    else
      filled_circle(x, y, 2, INK);
    px = x;
    py = y;
    source = s.sources;
    at = s.at;
    previous = true;
  }
  time_t wall = std::time(nullptr);
  auto left = clock_text(wall - window / 1000), middle = clock_text(wall - window / 2000),
       right = clock_text(wall);
  print(90, 580, small_, MUTED, left.c_str());
  print(380, 580, small_, MUTED, display::TextAlign::TOP_CENTER, middle.c_str());
  print(667, 580, small_, MUTED, display::TextAlign::TOP_RIGHT, right.c_str());
  printf(36, 614, label_, MUTED, metric_ == 4 ? tr_("Мин. %.3f") : tr_("Мин. %.1f"), double(lo));
  printf(684, 614, label_, MUTED, display::TextAlign::TOP_RIGHT, metric_ == 4 ? tr_("Макс. %.3f") : tr_("Макс. %.1f"),
         double(hi));
}
void Panel::row_(int y, const char* title, const char* value, const char* sub, int h, int symbol,
                 bool chevron) {
  card_(36, y, 648, h, CARD);
  int x = 58;
  if (symbol >= 0) {
    icon_(58, y + (h - 26) / 2, static_cast<Icon>(symbol), TEXT);
    x = 101;
  }
  const bool multiline = std::strlen(sub) > 0;
  // Two-line scan results use a shorter card than settings. Keep both lines
  // inside its rounded bounds rather than reusing the 91-pixel row offsets.
  print(x, y + (multiline ? (h < 84 ? 9 : 16) : h / 2), body_, TEXT,
        multiline ? display::TextAlign::TOP_LEFT : display::TextAlign::CENTER_LEFT, title);
  if (multiline) print(x, y + (h < 84 ? 42 : 53), small_, MUTED, sub);
  if (*value) print(662, y + h / 2, label_, MUTED, display::TextAlign::CENTER_RIGHT, value);
  if (chevron) icon_(640, y + (h - 22) / 2, NEXT, MUTED, 22);
}
void Panel::toggle_(int x, int y, bool enabled) {
  card_(x, y, 50, 31, enabled ? ACCENT : LINE, 15);
  filled_circle(x + (enabled ? 35 : 15), y + 15, 11, TEXT);
}
void Panel::settings_() {
  const char* titles[] = {tr_("Экран и заставка"), tr_("Источники показаний"), tr_("Сенсоры"), "Wi-Fi", tr_("Об устройстве"), tr_("Язык интерфейса")};
  const Icon icons[] = {SUN, HOUSE, SLIDERS, WIFI, INFO, INFO};
  // Sixth row ends exactly above the fixed footer; old hit regions stay put.
  for (int i = 0; i < 6; ++i) row_(151 + i * 84, titles[i], "", "", i==5?70:73, icons[i], true);
}
void Panel::language_() {
  // Autonyms stay recognizable in either locale; no HA connection is needed.
  row_(151,"English");row_(235,"Русский");
  icon_(628,english_?174:258,CHECK,INK);
  print(36,349,small_,MUTED,tr_("Выбор сохраняется на устройстве"));
  print(36,383,small_,MUTED,tr_("Также доступен в Home Assistant"));
}
void Panel::set_interface_language(const std::string &option) {
  bool next=english_;
  if(!cgs1_ui_language::parse(option,next) || next==english_)return;
  english_=next;
  // Rendering alone is safe during Wi-Fi work: do not clear forms, rebuild
  // settings, reset timeouts or resubmit any transaction when locale changes.
  if(ready_)update();
}
void Panel::display_() {
  bool night = page_ == NIGHT_SETTINGS;
  card_(36, 151, 648, 128, CARD);
  print(58, 174, body_, TEXT, night ? tr_("Ночная яркость") : tr_("Яркость"));
  if (night)
    printf(662, 174, body_, TEXT, display::TextAlign::TOP_RIGHT, "%.1f%%", double(night_brightness_) / 10);
  else
    printf(662, 174, body_, TEXT, display::TextAlign::TOP_RIGHT, "%d%%", brightness_ / 10);
  float fraction = night ? float(night_brightness_ - cgs1_backlight::MIN_RAW) / 80
                         : float(brightness_ - cgs1_backlight::MIN_RAW) / 980;
  int point = 59 + int(603 * std::clamp(fraction, 0.0f, 1.0f));
  card_(59, 225, 603, 7, LINE, 3);
  card_(59, 225, std::max(7, point - 59), 7, ACCENT, 3);
  filled_circle(point, 228, 8, ACCENT);
  if (night) {
    row_(294, tr_("Ночной режим"));
    toggle_(612, 315, night_);
    print(36, 401, small_, MUTED, tr_("Эта яркость действует в ночной заставке"));
    print(36, 433, small_, MUTED, tr_("и при включённом ночном режиме"));
    return;
  }
  row_(294, tr_("Заставка"), tr_(MODES[int(mode_)]));
  char delay[32];
  std::snprintf(delay, sizeof(delay), idle_ms_ % 60000 ? tr_("%d с") : tr_("%d мин"),
                int(idle_ms_ % 60000 ? idle_ms_ / 1000 : idle_ms_ / 60000));
  row_(378, tr_("Включать через"), delay);
  row_(462, tr_("Ночной режим"), "", tr_("Приглушённые цифры и подсветка"), 91);
  toggle_(612, 492, night_);
  card_(36, 564, 648, 65, SOFT, 14);
  print(360, 596, body_, INK, display::TextAlign::CENTER, tr_("Посмотреть заставку"));
}
void Panel::sources_() {
  card_(36, 151, 648, 128, CARD);
  print(58, 170, small_, MUTED, tr_("На экране"));
  card_(58, 204, 604, 53, BG, 14);
  card_(63 + (ha_mode_ ? 302 : 0), 209, 294, 43, SOFT, 11);
  print(211, 230, body_, ha_mode_ ? MUTED : INK, display::TextAlign::CENTER, tr_("Сенсоры"));
  print(513, 230, body_, ha_mode_ ? INK : MUTED, display::TextAlign::CENTER, tr_("HA + резерв"));
  for (int i = 0; i < 5; ++i)
    row_(294 + i * 56, tr_(LABELS[i]), ha_selected_[i] ? tr_("Сводный HA") : tr_("Сенсор"), "", 48);
  print(36, 581, small_, MUTED, tr_("Источники HA – в настройках устройства HA"));
  print(36, 607, small_, MUTED, tr_("При потере связи – местный сенсор"));
}
void Panel::draw_sensors_() {
  row_(151, tr_("Модуль PM2.5"), "",
       !pm_enabled_  ? tr_("Выключен · показания недоступны")
       : pm_warming_ ? tr_("Прогрев · ожидаем свежие показания")
                     : tr_("Включён · свежие показания"),
       91);
  toggle_(612, 181, pm_enabled_);
  if (!pm_action_) print(36, 610, small_, MUTED, tr_("Управление PM в этом тесте ещё не подключено"));
  row_(253, tr_("Температура"), "°C", tr_("Компенсация нагрева корпуса"), 91);
  row_(355, "CO₂", "ppm");
  row_(439, "TVOC", "ppm", tr_("Оценка сенсора"), 91);
  print(36, 546, small_, MUTED, tr_("Отключение PM не отключает CO₂,"));
  print(36, 573, small_, MUTED, tr_("температуру, влажность и TVOC"));
}
void Panel::network_() {
  card_(36, 151, 648, 243, CARD);
  icon_(58, 177, WIFI, TEXT);
  print(101, 170, body_, TEXT, "Wi-Fi");
  auto address = ip_address();
  bool connected = address != "Нет IPv4";
  print(101, 209, small_, MUTED, connected ? tr_("Подключено") : tr_("Нет IPv4-подключения"));
  print(58, 276, label_, MUTED, tr_("IP-адрес"));
  print(662, 276, label_, TEXT, display::TextAlign::TOP_RIGHT, connected ? address.c_str() : tr_("Нет IPv4"));
  horizontal_line(58, 315, 604, LINE);
  print(58, 339, label_, MUTED, "Home Assistant");
  print(662, 339, label_, TEXT, display::TextAlign::TOP_RIGHT,
        std::any_of(ha_selected_.begin(), ha_selected_.end(), [](bool x) { return x; }) ? tr_("Есть данные")
                                                                                        : tr_("Нет данных HA"));
  // Do not display a fake success or accept credentials before a tested Linux
  // Wi-Fi transaction/recovery backend is connected to this page.
  if(wifi_submit_)row_(426,tr_("Изменить сеть"),"",tr_("Выбор сети и пароль"),74,WIFI,true);
  else print(36, 426, small_, MUTED, tr_("Смена сети будет доступна в полной версии"));
}
bool Panel::wifi_busy_()const {
  return wifi_stage_!=WifiStage::IDLE && wifi_stage_!=WifiStage::SAVED && wifi_stage_!=WifiStage::FAILED;
}
void Panel::set_wifi_networks(std::vector<WifiNetwork>networks,bool scanning) {
  // The backend provides bounded, display-safe labels and exact SSID bytes.
  // Copy one completed scan snapshot, never retarget a pressed row mid-scan.
  if(networks.size()>4)networks.resize(4);
  networks.erase(std::remove_if(networks.begin(),networks.end(),[](const auto&n){return n.ssid.empty() || n.ssid.size()>32 || n.label.size()>128;}),networks.end());
  wifi_networks_=std::move(networks);wifi_scanning_=scanning;
  if(page_==WIFI_LIST)update();
}
void Panel::set_wifi_state(WifiStage stage,WifiFailure failure,const std::string&address,unsigned remaining,bool retry_safe) {
  wifi_stage_=stage;wifi_failure_=failure;wifi_address_=address.size()<=15?address:"";
  wifi_remaining_=std::min(remaining,120U);
  wifi_can_start_=stage==WifiStage::IDLE || ((stage==WifiStage::FAILED || stage==WifiStage::SAVED) && retry_safe);
  if(page_==WIFI_PROGRESS)update();
}
std::string Panel::fit_(font::Font*font,std::string text,int maximum)const {
  if(width_(font,text)<=maximum)return text;
  while(!text.empty() && width_(font,text+"…")>maximum) {
    size_t at=text.size()-1;
    while(at && (static_cast<unsigned char>(text[at])&0xc0)==0x80)--at;
    text.resize(at);
  }
  return text+"…";
}
void Panel::wifi_back_() {
  wifi_password_.clear();wifi_input_error_=false;
  if(page_==WIFI_PASSWORD || page_==WIFI_SSID)page_=WIFI_LIST;
  else if(page_==WIFI_PROGRESS && wifi_busy_()) {
    if(wifi_stage_!=WifiStage::SAVING && wifi_stage_!=WifiStage::RETURNING && wifi_cancel_) {
      const auto previous=wifi_stage_;wifi_stage_=WifiStage::RETURNING;
      if(!wifi_cancel_())wifi_stage_=previous;
    }
  }else page_=NETWORK;
}
bool Panel::wifi_touch_(int x,int y) {
  if(page_==NETWORK && wifi_submit_ && y>=426 && y<500) {
    wifi_password_.clear();wifi_input_error_=false;
    if(wifi_busy_() || !wifi_can_start_)page_=WIFI_PROGRESS;
    else {page_=WIFI_LIST;if(wifi_scan_){wifi_scanning_=true;wifi_scan_();}}
    return true;
  }
  if(page_==WIFI_LIST) {
    if(!wifi_scanning_ && y>=151 && y<487 && (y-151)%84<74) {
      const auto index=size_t((y-151)/84);
      if(index<wifi_networks_.size() && wifi_networks_[index].supported) {
        wifi_ssid_=wifi_networks_[index].ssid;wifi_password_.clear();wifi_keys_={};page_=WIFI_PASSWORD;
      }
    }else if(y>=497 && y<555 && wifi_scan_ && !wifi_scanning_) {wifi_scanning_=true;wifi_scan_();}
    else if(y>=565 && y<623 && !wifi_scanning_) {wifi_ssid_edit_.clear();wifi_keys_={};page_=WIFI_SSID;}
    return true;
  }
  if(page_==WIFI_SSID || page_==WIFI_PASSWORD) {
    const bool password=page_==WIFI_PASSWORD;
    if(password && x>=524 && x<668 && y>=194 && y<238){wifi_password_.toggle_visible();return true;}
    for(unsigned row=0;row<3;++row)if(y>=317+int(row)*64 && y<373+int(row)*64) {
      const char*keys=wifi_keys_.row(row);const int count=int(std::strlen(keys));
      const int left=(720-(count*56+(count-1)*8))/2;
      if(x>=left && (x-left)%64<56 && (x-left)/64<count) {
        const char character=keys[(x-left)/64];wifi_input_error_=false;
        if(password)wifi_password_.append(character);else if(wifi_ssid_edit_.size()<32)wifi_ssid_edit_+=character;
      }
      return true;
    }
    if(y>=509 && y<565) {
      if(x<132)wifi_keys_.next_mode();
      else if(x>=140 && x<212)wifi_keys_.uppercase=!wifi_keys_.uppercase;
      else if(x>=220 && x<416) {if(password)wifi_password_.append(' ');else if(wifi_ssid_edit_.size()<32)wifi_ssid_edit_+=' ';}
      else if(x>=424 && x<552) {if(password)wifi_password_.backspace();else if(!wifi_ssid_edit_.empty())wifi_ssid_edit_.pop_back();}
      else if(x>=560) {
        if(!password && !wifi_ssid_edit_.empty()) {wifi_ssid_=wifi_ssid_edit_;wifi_password_.clear();wifi_keys_={};page_=WIFI_PASSWORD;}
        else if(password) {
          const auto previous=wifi_stage_;wifi_stage_=WifiStage::PREPARING;
          const bool accepted=wifi_password_.submit([&](const char*text,size_t size){return wifi_submit_ && wifi_submit_(wifi_ssid_,text,size);});
          wifi_input_error_=!accepted;
          if(accepted){wifi_can_start_=false;page_=WIFI_PROGRESS;}
          else wifi_stage_=previous;
        }
      }
    }
    return true;
  }
  if(page_==WIFI_PROGRESS) {
    if(y>=469 && y<535 && wifi_stage_==WifiStage::READY && wifi_confirm_) {
      wifi_stage_=WifiStage::SAVING;if(!wifi_confirm_())wifi_stage_=WifiStage::READY;
    }
    else if(y>=549 && y<615) {
      if(wifi_stage_==WifiStage::SAVED)page_=HOME;
      else if(!wifi_busy_() && wifi_can_start_){page_=WIFI_LIST;if(wifi_scan_){wifi_scanning_=true;wifi_scan_();}}
      else if(wifi_busy_() && wifi_stage_!=WifiStage::SAVING && wifi_stage_!=WifiStage::RETURNING && wifi_cancel_) {
        const auto previous=wifi_stage_;wifi_stage_=WifiStage::RETURNING;if(!wifi_cancel_())wifi_stage_=previous;
      }
    }
    return true;
  }
  return false;
}
void Panel::wifi_list_() {
  if(wifi_scanning_)print(36,170,body_,MUTED,tr_("Ищем сети…"));
  else if(wifi_networks_.empty())print(36,170,body_,MUTED,tr_("Сети пока не найдены"));
  else for(size_t i=0;i<wifi_networks_.size();++i) {
    const auto&item=wifi_networks_[i];const auto label=fit_(body_,item.label.empty()?item.ssid:item.label,510);
    row_(151+int(i)*84,label.c_str(),"",item.supported?"WPA2":tr_("Не поддерживается"),74,WIFI,item.supported);
  }
  row_(497,tr_("Обновить список"),"",wifi_scanning_?tr_("Поиск…"):"",58,-1,false);
  row_(565,tr_("Другая сеть"),tr_("Вручную"),"",58,-1,false);
}
void Panel::wifi_editor_() {
  const bool password=page_==WIFI_PASSWORD;const auto ssid=fit_(label_,wifi_ssid_,648);
  print(36,151,label_,MUTED,password?ssid.c_str():tr_("Название сети"));card_(36,182,648,70,CARD,16);
  if(password) {
    int cursor=58;size_t at=0;const auto begin=wifi_password_.size()>14?wifi_password_.size()-14:0;
    if(begin){print(cursor,202,label_,TEXT,"…");cursor+=24;}
    wifi_password_.draw([&](char character){if(at++<begin)return;char unit[]{character,0};
      print(cursor,202,label_,TEXT,unit);cursor+=width_(label_,std::string(unit));unit[0]=0;});
    card_(524,194,144,44,SOFT,10);print(596,205,small_,INK,display::TextAlign::TOP_CENTER,wifi_password_.visible()?tr_("Скрыть"):tr_("Показать"));
  }else {const auto text=fit_(label_,wifi_ssid_edit_,604);print(58,202,label_,TEXT,text.c_str());}
  print(36,274,small_,wifi_input_error_?WARN:MUTED,
    wifi_input_error_?tr_("Проверьте пароль или дождитесь завершения операции"):password?tr_("От 8 до 63 символов"):tr_("До 32 символов"));
  for(unsigned row=0;row<3;++row) {
    const char*keys=wifi_keys_.row(row);const int count=int(std::strlen(keys));const int left=(720-(count*56+(count-1)*8))/2;
    for(int column=0;column<count;++column){const int x=left+column*64,y=317+int(row)*64;card_(x,y,56,56,CARD,10);
      char text[]{keys[column],0};print(x+28,y+14,body_,TEXT,display::TextAlign::TOP_CENTER,text);}
  }
  const int positions[]={36,140,220,424,560},widths[]={96,72,196,128,124};
  const char*labels[]={wifi_keys_.mode==WifiKeys::LETTERS?"?123":wifi_keys_.mode==WifiKeys::NUMBERS?"#+=":"abc","aA",tr_("Пробел"),tr_("Удалить"),password?tr_("Готово"):tr_("Далее")};
  for(unsigned i=0;i<5;++i){const bool valid=password?wifi_password_.valid_length() && bool(wifi_submit_):!wifi_ssid_edit_.empty();
    card_(positions[i],509,widths[i],56,i==4 && valid?ACCENT:CARD,10);
    print(positions[i]+widths[i]/2,526,small_,i==4 && !valid?MUTED:TEXT,display::TextAlign::TOP_CENTER,labels[i]);}
}
void Panel::wifi_progress_() {
  const auto name=fit_(body_,wifi_ssid_,604);print(36,163,body_,TEXT,name.c_str());
  const char*title=tr_("Подключение");const char*detail=tr_("Проверяем исходное состояние");
  switch(wifi_stage_) {
    case WifiStage::ASSOCIATING:title=tr_("Подключаемся к сети…");detail=tr_("Проверяем пароль");break;
    case WifiStage::DHCP:title=tr_("Получаем IP-адрес…");detail=tr_("Ожидаем ответ DHCP");break;
    case WifiStage::VERIFYING:title=tr_("Проверяем связь…");detail=tr_("Подключение ещё не сохранено");break;
    case WifiStage::READY:title=tr_("Подключение доступно");detail=tr_("Сохранить эту сеть?");break;
    case WifiStage::SAVING:title=tr_("Сохраняем сеть…");detail=tr_("Подождите подтверждения");break;
    case WifiStage::SAVED:title=tr_("Сеть сохранена");detail=tr_("Можно вернуться к показаниям");break;
    case WifiStage::RETURNING:title=tr_("Отменяем подключение…");detail=tr_("Возвращаем прежнюю сеть");break;
    case WifiStage::FAILED:title=tr_("Подключение не завершено");
      detail=wifi_failure_==WifiFailure::AUTHENTICATION?tr_("Проверьте пароль"):wifi_failure_==WifiFailure::DHCP?tr_("Не получен IP-адрес"):
        wifi_failure_==WifiFailure::NETWORK?tr_("Сеть не найдена"):wifi_failure_==WifiFailure::TIMEOUT?tr_("Время ожидания истекло"):
        wifi_failure_==WifiFailure::PROTECTION?tr_("Не удалось безопасно завершить операцию"):tr_("Проверьте подключение");break;
    default:break;
  }
  print(36,241,title_,wifi_stage_==WifiStage::FAILED?WARN:TEXT,title);print(36,302,label_,MUTED,detail);
  if(!wifi_address_.empty())print(36,351,body_,TEXT,wifi_address_.c_str());
  if(wifi_remaining_ && wifi_busy_())printf(36,403,small_,MUTED,tr_("Осталось %u с"),wifi_remaining_);
  if(wifi_stage_==WifiStage::READY)row_(469,tr_("Сохранить сеть"),"","",66,CHECK,false);
  if(wifi_stage_==WifiStage::FAILED && !wifi_can_start_) {
    print(36,555,small_,MUTED,tr_("Ожидаем подтверждения возврата"));
    print(36,581,small_,MUTED,tr_("прежней сети"));
  } else if(wifi_stage_!=WifiStage::SAVING && wifi_stage_!=WifiStage::RETURNING)
    row_(549,wifi_stage_==WifiStage::SAVED?tr_("К показаниям"):wifi_busy_()?tr_("Отменить"):tr_("Выбрать другую сеть"),"","",66,-1,false);
}
void Panel::about_() {
  print(36, 170, value_, TEXT, "Qingping");
  print(36, 226, value_, TEXT, "Air Monitor 1");
  const char* labels[] = {tr_("Прошивка"), tr_("Интерфейс"), "Wi-Fi", tr_("IP-адрес")};
  auto address = ip_address();
  const char* values[] = {"ESPHome", tr_("Версия разработки"),
                          address != "Нет IPv4" ? tr_("Подключён") : tr_("Нет подключения"), address != "Нет IPv4" ? address.c_str() : tr_("Нет IPv4")};
  for (int i = 0; i < 4; ++i) {
    int y = 324 + i * 65;
    print(36, y, label_, MUTED, labels[i]);
    print(684, y, label_, TEXT, display::TextAlign::TOP_RIGHT, values[i]);
    horizontal_line(36, y + 43, 648, LINE);
  }
}
void Panel::draw_saver_() {
  if (mode_ == OFF) {
    fill(Color(0));
    return;
  }
  bool dim = mode_ == NIGHT || night_;
  Color ink = dim ? Color(0xa1adb4) : TEXT, muted = dim ? Color(0x8c9aa3) : MUTED;
  if (dim) fill(Color(0x080c10));
  if (mode_ == CLOCK) {
    auto clock = headless_ ? std::string("23:48") : clock_text();
    print(360, 322, saver_, ink, display::TextAlign::BASELINE_CENTER, clock.c_str());
    time_t now = std::time(nullptr);
    tm local{};
    localtime_r(&now, &local);
    const char* days[] = {tr_("Воскресенье"), tr_("Понедельник"), tr_("Вторник"), tr_("Среда"), tr_("Четверг"), tr_("Пятница"), tr_("Суббота")};
    const char* months[] = {tr_("января"), tr_("февраля"), tr_("марта"),    tr_("апреля"),  tr_("мая"),    tr_("июня"),
                            tr_("июля"),   tr_("августа"), tr_("сентября"), tr_("октября"), tr_("ноября"), tr_("декабря")};
    if (now > 1700000000)
      printf(360, 378, body_, muted, display::TextAlign::CENTER, "%s, %d %s", days[local.tm_wday],
             local.tm_mday, months[local.tm_mon]);
    const char* sub[] = {"CO₂ · ppm", tr_("Температура"), tr_("Влажность")};
    for (int i = 0; i < 3; ++i) {
      int x = 137 + i * 223;
      std::string text = formatted_(i) + (i == 1 ? "°" : i == 2 ? "%" : "");
      print(x, 474, title_, ink, display::TextAlign::CENTER, text.c_str());
      print(x, 519, small_, muted, display::TextAlign::CENTER, sub[i]);
    }
  } else {
    bool only = mode_ == CO2_ONLY;
    print(360, only ? 171 : 127, small_, muted, display::TextAlign::CENTER,
          ha_selected_[0] ? "CO₂ · HA" : "CO₂");
    print(360, only ? 409 : 365, saver_, ink, display::TextAlign::BASELINE_CENTER, formatted_(0).c_str());
    print(360, only ? 446 : 402, label_, muted, display::TextAlign::CENTER, "ppm");
    if (!only) pair_(360, 520, temperature_, formatted_(1), label_, "°C", ink);
    print(360, only ? 555 : 592, body_, muted, display::TextAlign::CENTER,
          dim               ? tr_("Ночной режим")
          : ha_selected_[0] ? tr_("Сводные показатели HA")
                            : tr_("Спальня"));
  }
}
void Panel::operation_() {
  // Only the isolated render fixture selects these views until the startup
  // and OTA controllers supply actual progress. Never imply a live OTA here.
  if (fixture_operation_ == 1) {
    print(360, 280, temperature_, TEXT, display::TextAlign::CENTER, "Qingping");
    print(360, 368, title_, MUTED, display::TextAlign::CENTER, "ESPHome");
    print(360, 446, small_, MUTED, display::TextAlign::CENTER, tr_("Запуск сенсоров…"));
  } else {
    print(360, 246, temperature_, TEXT, display::TextAlign::CENTER, tr_("Обновление"));
    print(360, 330, title_, MUTED, display::TextAlign::CENTER, "ESPHome");
    pair_(360, 468, detail_, "64", body_, "%", TEXT);
    card_(108, 519, 504, 13, LINE, 6);
    card_(108, 519, 322, 13, ACCENT, 6);
    print(360, 578, small_, MUTED, display::TextAlign::CENTER, tr_("Не отключайте питание"));
  }
}
void Panel::render_() {
  fill(BG);
  if (fixture_operation_) {
    operation_();
    return;
  }
  if (sleeping_) {
    draw_saver_();
    return;
  }
  const char* title = page_ == DETAIL           ? LABELS[metric_]
                      : page_ == SETTINGS       ? tr_("Настройки")
                      : page_ == LANGUAGE       ? tr_("Язык интерфейса")
                      : page_ == DISPLAY        ? tr_("Экран и заставка")
                      : page_ == NIGHT_SETTINGS ? tr_("Ночной режим")
                      : page_ == SOURCES        ? tr_("Источники")
                      : page_ == SENSORS        ? tr_("Сенсоры")
                      : page_ == NETWORK        ? "Wi-Fi"
                      : page_ == WIFI_LIST      ? tr_("Выбор сети")
                      : page_ == WIFI_SSID       ? tr_("Другая сеть")
                      : page_ == WIFI_PASSWORD   ? tr_("Пароль Wi-Fi")
                      : page_ == WIFI_PROGRESS   ? tr_("Подключение")
                                                : tr_("Об устройстве");
  if (page_ != HOME) header_(title);
  // Clip all scrolling/content pages above the fixed bottom navigation. No
  // label or future graph can draw across the navigation's hit regions.
  start_clipping(0, 65, 720, 641);
  switch (page_) {
    case HOME:
      home_();
      break;
    case DETAIL:
      draw_detail_();
      break;
    case SETTINGS:
      settings_();
      break;
    case DISPLAY:
    case NIGHT_SETTINGS:
      display_();
      break;
    case SOURCES:
      sources_();
      break;
    case SENSORS:
      draw_sensors_();
      break;
    case NETWORK:
      network_();
      break;
    case WIFI_LIST:wifi_list_();break;
    case WIFI_SSID:
    case WIFI_PASSWORD:wifi_editor_();break;
    case WIFI_PROGRESS:wifi_progress_();break;
    case LANGUAGE:language_();break;
    case ABOUT:
      about_();
      break;
  }
  end_clipping();
  if (page_ == HOME) status_();
  navigation_();
}
bool Panel::review_touch(int x, int y, int phase) {
  if (!headless_ || x < 0 || x >= 720 || y < 0 || y >= 720 || phase < 0 || phase > 2) return false;
  // The API action exposing this hook exists only in the isolated macOS QA
  // fixture. The runtime check additionally refuses physical panel control.
  const TouchTracker::Phase phases[] = {TouchTracker::Phase::DOWN, TouchTracker::Phase::MOVE,
                                       TouchTracker::Phase::UP};
  gesture_({phases[phase], x, y});
  update();
  write_capture_();
  return true;
}
bool Panel::review_page(int index) {
  if (!headless_ || index < 0 || index > 35) return false;
  sleeping_ = false;
  page_ = HOME;
  fixture_operation_ = 0;
  fixture_ha_lost_ = false;
  fixture_sensor_lost_ = false;
  pm_enabled_ = true;
  pm_warming_ = false;
  wifi_password_.clear();wifi_keys_={};wifi_input_error_=false;wifi_stage_=WifiStage::IDLE;
  wifi_failure_=WifiFailure::NONE;wifi_can_start_=true;wifi_scanning_=false;wifi_remaining_=0;wifi_address_.clear();
  if (index >= 1 && index <= 5) {
    page_ = DETAIL;
    metric_ = index - 1;
  } else if (index >= 6 && index <= 11) {
    const Page pages[] = {SETTINGS, DISPLAY, SOURCES, NETWORK, ABOUT, SENSORS};
    page_ = pages[index - 6];
  } else if (index >= 12 && index <= 16) {
    sleeping_ = true;
    mode_ = static_cast<Saver>(index - 12);
  } else if (index == 17)
    page_ = NIGHT_SETTINGS;
  else if (index == 18)
    fixture_ha_lost_ = true;
  else if (index == 19)
    pm_enabled_ = false;
  else if (index == 20)
    fixture_sensor_lost_ = true;
  else if (index == 21)
    pm_warming_ = true;
  else if (index >= 22 && index <=23)
    fixture_operation_ = index - 21;
  else if(index==35)page_=LANGUAGE;
  else if(index>=24) {
    // Invented fixture SSIDs/input only; this hook refuses physical panels.
    set_wifi_actions([]{},[](const std::string&,const char*,size_t){return true;},[]{return true;},[]{return true;});
    wifi_networks_={{"Fixture Wi-Fi","Домашняя сеть",true},{"Fixture Guest","Гостевая сеть",true},{"Fixture Other","Другая сеть",false}};
    wifi_ssid_="Fixture Wi-Fi";page_=WIFI_LIST;
    if(index==25){page_=WIFI_SSID;wifi_ssid_edit_="My Network";}
    if((index>=26 && index<=28) || index>=33) {
      page_=WIFI_PASSWORD;for(char c:std::string(index==34?"short":"fixture-password"))wifi_password_.append(c);
      if(index==27)wifi_keys_.mode=WifiKeys::NUMBERS;
      if(index==28)wifi_keys_.mode=WifiKeys::SYMBOLS;
      if(index==33)wifi_password_.toggle_visible();
      if(index==34)wifi_input_error_=true;
    }
    if(index>=29 && index<=32) {
      page_=WIFI_PROGRESS;const WifiStage stages[]={WifiStage::DHCP,WifiStage::READY,WifiStage::FAILED,WifiStage::SAVED};
      wifi_stage_=stages[index-29];wifi_failure_=WifiFailure::DHCP;wifi_remaining_=42;
      wifi_address_=index==30 || index==32?"192.0.2.36":"";wifi_can_start_=index==31;
    }
  }
  update();
  write_capture_();
  return true;
}
bool Panel::review_interactions() {
  if (!headless_) return false;
  review_page(16);
  touch_(650, 680);
  if (sleeping_ || page_ != HOME) return false;
  touch_(650, 680);
  if (page_ != SETTINGS) return false;
  touch_(70, 180);
  if (page_ != DISPLAY) return false;
  mode_ = SUMMARY;
  for (int i = 0; i < 5; ++i) {
    touch_(300, 330);
    if (int(mode_) != (i + 1) % 5) return false;
  }
  // Use real ordered gesture events: a drag changes brightness, lifting ends
  // it, and motion after waking cannot leak into a hidden control.
  gesture_({TouchTracker::Phase::DOWN, 59, 228});
  if (brightness_ != cgs1_backlight::MIN_RAW) return false;
  gesture_({TouchTracker::Phase::MOVE, 662, 228});
  if (brightness_ != 1000) return false;
  gesture_({TouchTracker::Phase::UP, 662, 228});
  touch_(300, 414);
  if (idle_ms_ != 30000) return false;
  touch_(638, 506);
  if (!night_) return false;
  touch_(300, 506);
  if (page_ != NIGHT_SETTINGS) return false;
  gesture_({TouchTracker::Phase::DOWN, 59, 228});
  if (night_brightness_ != cgs1_backlight::MIN_RAW) return false;
  gesture_({TouchTracker::Phase::MOVE, 662, 228});
  if (night_brightness_ != 100) return false;
  gesture_({TouchTracker::Phase::UP, 662, 228});
  touch_(61, 100);
  if (page_ != DISPLAY) return false;
  touch_(300, 596);
  if (!sleeping_) return false;
  gesture_({TouchTracker::Phase::DOWN, 662, 228});
  gesture_({TouchTracker::Phase::MOVE, 59, 228});
  if (sleeping_ || page_ != HOME || brightness_ != 1000) return false;
  gesture_({TouchTracker::Phase::UP, 59, 228});
  touch_(400, 680);
  if (!sleeping_) return false;
  touch_(400, 680);
  if (sleeping_ || page_ != HOME) return false;
  touch_(680, 580);
  if (page_ != DETAIL || metric_ != 4) return false;
  touch_(580, 386);
  if (period_ != 2) return false;
  touch_(61, 100);
  if (page_ != HOME) return false;
  mode_ = SUMMARY;
  night_ = false;
  // Local touch must recover a legacy black preference without HA. Explicit
  // OFF still writes zero; the first DOWN wakes even at the outer pixel edge
  // and the protected effective brightness is visible before another action.
  mode_=OFF;sleeping_=true;brightness_=10;night_brightness_=1;
  if(effective_brightness()!=0)return false;
  gesture_({TouchTracker::Phase::DOWN,1,1});
  if(sleeping_ || page_!=HOME || effective_brightness()!=cgs1_backlight::MIN_RAW)return false;
  gesture_({TouchTracker::Phase::UP,1,1});
  mode_=SUMMARY;
  brightness_ = 180;
  night_brightness_ = cgs1_backlight::MIN_RAW;
  period_ = 0;
  // Real production touch paths with a synthetic local backend; no socket or
  // credentials reach a device. Repeated taps must not duplicate submission.
  unsigned submissions=0,confirmations=0,cancellations=0;
  set_wifi_actions([]{},[&](const std::string&ssid,const char*,size_t size){++submissions;return ssid=="fixture" && size==8;},
    [&]{++confirmations;return true;},[&]{++cancellations;return true;});
  wifi_stage_=WifiStage::IDLE;wifi_can_start_=true;wifi_scanning_=false;
  wifi_networks_={{"fixture","Fixture",true}};page_=WIFI_LIST;
  touch_(100,180);if(page_!=WIFI_PASSWORD)return false;
  for(unsigned n=0;n<8;++n)touch_(72,345);
  if(wifi_password_.size()!=8)return false;
  touch_(596,215);if(!wifi_password_.visible())return false;
  touch_(622,537);if(page_!=WIFI_PROGRESS || wifi_password_.size()!=0 || submissions!=1)return false;
  touch_(622,537);if(submissions!=1)return false;
  set_wifi_state(WifiStage::READY,WifiFailure::NONE,"192.0.2.36",30);
  touch_(300,500);if(wifi_stage_!=WifiStage::SAVING)return false;
  touch_(300,500);touch_(300,580);touch_(61,100);
  if(confirmations!=1 || cancellations!=0 || wifi_stage_!=WifiStage::SAVING)return false;
  set_wifi_state(WifiStage::DHCP,WifiFailure::NONE,"",30);
  touch_(300,580);touch_(300,580);touch_(61,100);
  if(cancellations!=1 || wifi_stage_!=WifiStage::RETURNING)return false;
  // Form dismissal wipes visible text; a refused synchronous admission keeps
  // the password for deliberate editing but never enables another transaction.
  set_wifi_state(WifiStage::IDLE);page_=WIFI_PASSWORD;
  for(unsigned n=0;n<8;++n)touch_(72,345);
  touch_(596,215);touch_(650,680);
  if(wifi_password_.size() || wifi_password_.visible() || page_!=SETTINGS)return false;
  set_wifi_actions([]{},[](const std::string&,const char*,size_t){return false;},{},{});
  page_=WIFI_PASSWORD;
  for(unsigned n=0;n<8;++n)touch_(72,345);
  touch_(622,537);
  if(page_!=WIFI_PASSWORD || !wifi_input_error_ || wifi_password_.size()!=8)return false;
  touch_(61,100);if(wifi_password_.size() || page_!=WIFI_LIST)return false;
  // Language uses one setting path in either direction and preserves forms.
  const auto previous_language=english_;unsigned language_changes=0;
  set_language_action([&](const std::string&value){++language_changes;set_interface_language(value);});
  page_=SETTINGS;touch_(120,601);if(page_!=LANGUAGE)return false;
  touch_(120,180);if(!english_ || language_changes!=1)return false;
  touch_(120,264);if(english_ || language_changes!=2)return false;
  page_=WIFI_PASSWORD;wifi_ssid_="Температура";wifi_password_.append('x');
  const size_t password_size=wifi_password_.size();const auto old_stage=wifi_stage_;
  set_interface_language("English");
  if(!english_ || page_!=WIFI_PASSWORD || wifi_ssid_!="Температура" || wifi_password_.size()!=password_size || wifi_stage_!=old_stage)return false;
  set_interface_language("invalid");if(!english_)return false;
  set_interface_language(previous_language?"English":"Русский");set_language_action({});wifi_password_.clear();
  // Restore the normal fixture state before rendering the requested page.
  set_wifi_actions({}, {}, {}, {});wifi_stage_=WifiStage::IDLE;wifi_can_start_=true;page_=HOME;
  return true;
}
void Panel::write_capture_() {
  // A real-device debug capture must never retain typed credentials, even
  // when the user deliberately toggles visibility. Only explicit headless
  // synthetic QA renders are allowed to capture the password form.
  if(!headless_ && (page_==WIFI_PASSWORD || page_==WIFI_SSID))return;
  const char* prefs = std::getenv("ESPHOME_PREFDIR");
  if (!prefs) return;
  const std::string path = std::string(prefs) + "/../ui-frame.ppm";
  FILE* file = std::fopen((path + ".new").c_str(), "wb");
  if (!file) return;
  std::fprintf(file, "P6\n720 720\n255\n");
  std::array<unsigned char, 2160> row{};
  for (int y = 0; y < 720; ++y) {
    for (int x = 0; x < 720; ++x) {
      uint32_t p = frame_[y * 720 + x];
      row[x * 3] = p >> 16;
      row[x * 3 + 1] = p >> 8;
      row[x * 3 + 2] = p;
    }
    std::fwrite(row.data(), 1, row.size(), file);
  }
  if (!std::fclose(file)) std::rename((path + ".new").c_str(), path.c_str());
}
}  // namespace esphome::cgs1_panel
