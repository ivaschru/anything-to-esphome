#pragma once
#include <array>
#include <functional>
#include <limits>
#include <string>
#include <vector>

#include "drm_backend.h"
#include "cgs1_backlight.h"
#include "cgs1_ui_language.h"
#include "wifi_input.h"
#include "esphome/components/display/display_buffer.h"
#include "esphome/components/font/font.h"
#include "esphome/components/sensor/sensor.h"

namespace esphome::cgs1_panel {
enum class WifiStage {IDLE,PREPARING,ASSOCIATING,DHCP,VERIFYING,READY,SAVING,SAVED,RETURNING,FAILED};
enum class WifiFailure {NONE,NETWORK,AUTHENTICATION,DHCP,TIMEOUT,PROTECTION,UNKNOWN};
struct WifiNetwork {std::string ssid,label;bool supported{true};};
// The 720px design is a single, fixed physical viewport. All geometry below
// is measured from design/prototype.html, rather than a desktop window scaled
// onto the LCD. Hardware ownership stays entirely in the guarded backend.
class Panel : public display::DisplayBuffer {
 public:
  void set_full_display_authority(FullDisplayAuthority value){drm_.set_full_display_authority(value);}
  void setup() override;
  void loop() override;
  void update() override;
  void on_shutdown() override { wifi_password_.clear(); drm_.close_panel(); }
  float get_setup_priority() const override { return setup_priority::HARDWARE; }
  display::DisplayType get_display_type() override { return display::DISPLAY_TYPE_COLOR; }
  void set_font_small(font::Font* value) { small_ = value; }
  void set_font_label(font::Font* value) { label_ = value; }
  void set_font_body(font::Font* value) { body_ = value; }
  void set_font_title(font::Font* value) { title_ = value; }
  void set_font_value(font::Font* value) { value_ = value; }
  void set_font_big(font::Font* value) { big_ = value; }
  void set_font_detail(font::Font* value) { detail_ = value; }
  void set_font_saver(font::Font* value) { saver_ = value; }
  void set_font_temperature(font::Font* value) { temperature_ = value; }
  void set_co2_sensor(sensor::Sensor* value) { sensors_[0] = value; }
  void set_temperature_sensor(sensor::Sensor* v) { sensors_[1] = v; }
  void set_humidity_sensor(sensor::Sensor* v) { sensors_[2] = v; }
  void set_pm25_sensor(sensor::Sensor* v) { sensors_[3] = v; }
  void set_voc_sensor(sensor::Sensor* v) { sensors_[4] = v; }
  // Read-only QA/diagnostic access: these values are never published into the
  // physical measurement sensors supplied to the panel.
  float displayed_value(size_t metric) const {
    return metric < values_.size() ? values_[metric] : std::numeric_limits<float>::quiet_NaN();
  }
  bool displays_ha_value(size_t metric) const { return metric < ha_selected_.size() && ha_selected_[metric]; }
  void set_raw_temperature(bool v) { raw_temperature_ = v; }
  void set_headless(bool v) { headless_ = v; }
  bool review_page(int index);
  bool review_interactions();
  bool interface_is_english() const { return english_; }
  bool home_visible() const { return page_ == HOME && !sleeping_; }
  // Read-only startup proof for the independent process lease. A selected
  // page alone is not proof that DRM/input setup actually completed.
  bool ready() const { return ready_; }
  bool review_touch(int x, int y, int phase);
  bool screen_is_on() const { return !(sleeping_ && mode_ == OFF); }
  int effective_brightness() const {
    const int requested=sleeping_ && (mode_ == NIGHT || night_) ? night_brightness_ : brightness_;
    return cgs1_backlight::effective(screen_is_on(),requested);
  }
  // HA and local touch use the same setters and callbacks. A touch writes
  // through the ESPHome entity, so preferences and API states cannot diverge.
  void set_interface_language(const std::string& option);
  void set_language_action(std::function<void(const std::string&)> action) { language_action_=std::move(action); }
  void set_saver_mode(const std::string& mode);
  void set_idle_seconds(float seconds);
  void set_brightness_percent(float percent);
  void set_night_brightness_percent(float percent);
  void set_night_mode(bool enabled) { night_ = enabled; }
  void set_saver_action(std::function<void(const std::string&)> v) { saver_action_ = std::move(v); }
  void set_brightness_action(std::function<void(float)> v) { brightness_action_ = std::move(v); }
  void set_night_brightness_action(std::function<void(float)> v) { night_brightness_action_ = std::move(v); }
  void set_idle_action(std::function<void(float)> v) { idle_action_ = std::move(v); }
  void set_night_action(std::function<void(bool)> v) { night_action_ = std::move(v); }
  void set_ha_mode(bool enabled) { ha_mode_ = enabled; }
  void set_ha_action(std::function<void(bool)> v) { ha_action_ = std::move(v); }
  // Physical sensor entities remain independent. The UI can select a bounded,
  // fresh HA value per metric without ever publishing it as a local reading.
  void set_ha_value(int metric, float value);
  void set_ha_binding(int metric, bool configured);
  void set_pm_state(bool enabled, bool warming = false) {
    pm_enabled_ = enabled;
    pm_warming_ = warming;
  }
  void set_pm_action(std::function<void(bool)> v) { pm_action_ = std::move(v); }
  // Snapshot/callbacks are UI plumbing, never write authority. The native
  // backend still owns sealed plans/guardians and consumes network intents.
  void set_wifi_actions(std::function<void()> scan,
      std::function<bool(const std::string&,const char*,size_t)> submit,
      std::function<bool()> confirm,std::function<bool()> cancel) {
    wifi_scan_=std::move(scan);wifi_submit_=std::move(submit);
    wifi_confirm_=std::move(confirm);wifi_cancel_=std::move(cancel);
  }
  void set_wifi_networks(std::vector<WifiNetwork> networks,bool scanning=false);
  void set_wifi_state(WifiStage stage,WifiFailure failure=WifiFailure::NONE,
      const std::string&address="",unsigned remaining_seconds=0,bool retry_safe=false);

 protected:
  int get_width_internal() override { return 720; }
  int get_height_internal() override { return 720; }
  void draw_absolute_pixel_internal(int x, int y, Color color) override;

 private:
  enum Page { HOME, DETAIL, SETTINGS, DISPLAY, SOURCES, SENSORS, NETWORK, ABOUT, NIGHT_SETTINGS,
              WIFI_LIST,WIFI_SSID,WIFI_PASSWORD,WIFI_PROGRESS, LANGUAGE };
  enum Saver { SUMMARY, CO2_ONLY, CLOCK, NIGHT, OFF };
  enum Icon { GRID, MOON, SLIDERS, BACK, NEXT, SUN, HOUSE, WIFI, INFO, RADIO, CHECK };
  struct Sample {
    uint32_t at;
    std::array<float, 5> values;
    uint8_t sources;
  };
  DrmBackend drm_;
  std::vector<uint32_t> frame_;
  font::Font *small_{}, *label_{}, *body_{}, *title_{}, *value_{}, *big_{}, *detail_{}, *saver_{},
      *temperature_{};
  // Saver mode uses a different name to avoid colliding with its font.
  std::array<sensor::Sensor*, 5> sensors_{};
  std::array<float, 5> values_{}, ha_values_{};
  std::array<uint32_t, 5> ha_received_{};
  std::array<bool, 5> ha_bound_{}, ha_selected_{};
  // One real sample per minute retains a complete day in 35KB. Missing
  // samples and source changes break the trace instead of joining unlike
  // sensors or drawing the synthetic history from the design proposal.
  std::array<Sample, 1441> history_{};
  size_t history_next_{0}, history_count_{0};
  uint32_t next_history_{0}, last_touch_{0}, idle_ms_{10000};
  uint32_t profiled_frames_{0};
  Page page_{HOME};
  Saver mode_{SUMMARY};
  int metric_{0}, brightness_{100}, night_brightness_{cgs1_backlight::MIN_RAW}, period_{0};
  bool sleeping_{false}, ready_{false}, raw_temperature_{true}, capture_{false}, headless_{false};
  bool night_{false}, ha_mode_{false}, pm_enabled_{true}, pm_warming_{false};
  bool dragging_{false}, ignore_gesture_{false}, fixture_ha_lost_{false}, fixture_sensor_lost_{false};
  int fixture_operation_{0};
  bool english_{false},captured_english_{false};
  std::function<void(const std::string&)> language_action_;
  const char *tr_(const char *label) const { return cgs1_ui_language::text(english_,label); }
  std::function<void(const std::string&)> saver_action_;
  std::function<void(float)> brightness_action_, night_brightness_action_, idle_action_;
  std::function<void(bool)> night_action_, ha_action_, pm_action_;
  WifiPassword wifi_password_;WifiKeypad wifi_keys_;
  std::vector<WifiNetwork>wifi_networks_;
  std::string wifi_ssid_,wifi_ssid_edit_,wifi_address_;
  WifiStage wifi_stage_{WifiStage::IDLE};WifiFailure wifi_failure_{WifiFailure::NONE};
  bool wifi_scanning_{false},wifi_input_error_{false},wifi_can_start_{true};unsigned wifi_remaining_{0};
  std::function<void()>wifi_scan_;
  std::function<bool(const std::string&,const char*,size_t)>wifi_submit_;
  std::function<bool()>wifi_confirm_,wifi_cancel_;
  Page captured_page_{ABOUT};
  int captured_metric_{-1};
  bool captured_sleeping_{false}, captured_values_ready_{false};
  void touch_(int x, int y);
  void gesture_(const TouchTracker::Event& event);
  void slider_(int x, bool night);
  void render_();
  void status_();
  void header_(const char* title);
  void navigation_();
  void home_();
  void draw_detail_();
  void settings_();
  void language_();
  void display_();
  void draw_saver_();
  void sources_();
  void draw_sensors_();
  void network_();
  void wifi_list_();void wifi_editor_();void wifi_progress_();
  bool wifi_touch_(int x,int y);void wifi_back_();
  bool wifi_busy_()const;std::string fit_(font::Font*font,std::string text,int maximum)const;
  void about_();
  void operation_();
  void row_(int y, const char* title, const char* value = "", const char* sub = "", int height = 73,
            int icon = -1, bool chevron = false);
  void toggle_(int x, int y, bool enabled);
  void icon_(int x, int y, Icon icon, Color color, int size = 26);
  void card_(int x, int y, int width, int height, Color color, int radius = 22);
  int width_(font::Font* font, const std::string& text) const;
  void pair_(int center, int baseline, font::Font* number, const std::string& text, font::Font* unit,
             const char* suffix, Color ink);
  std::string formatted_(int index) const;
  const char* source_(int index) const;
  const char* tag_(int index) const;
  bool ha_fallback_() const;
  void write_capture_();
};
}  // namespace esphome::cgs1_panel
