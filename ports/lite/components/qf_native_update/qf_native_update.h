#pragma once
#include "esphome/components/update/update_entity.h"
#include "esphome/components/http_request/http_request.h"
#include "esphome/components/sha256/sha256.h"
#include "esphome/core/component.h"
#include "stream.h"
#include <atomic>
#include <functional>

namespace esphome::qf_native_update {
struct Release {
  uint32_t revision{0}, version{0}, size{0};
  std::string sha256, url, summary, release_url;
  std::vector<Patch> patches;
};
class NativeUpdate : public update::UpdateEntity, public PollingComponent {
 public:
  void set_request_parent(http_request::HttpRequestComponent *p) { request_ = p; }
  void set_identity(const std::string &profile, uint32_t revision, uint32_t version) {
    profile_ = profile; revision_ = revision; version_ = version;
  }
  // Only the generated public wrapper supplies these runtime values. They are
  // never exposed as entities, logs, HTTP parameters or manifest input.
  void set_credentials(const std::string &ota, const std::string &stock, const std::string &feed) {
    ota_password_ = ota; stock_ = stock; feed_ = feed;
  }
  void set_ui(std::function<bool()> ready, std::function<void()> begin,
              std::function<void(float)> progress, std::function<void(bool)> finish) {
    ui_ready_ = std::move(ready); ui_begin_ = std::move(begin);
    ui_progress_ = std::move(progress); ui_finish_ = std::move(finish);
  }
  void setup() override;
  void update() override { check(); }
  void check() override;
  void perform(bool force) override;
  float get_setup_priority() const override { return setup_priority::AFTER_WIFI; }
 protected:
  bool fetch_(Release &release);
  bool capture_(Values &values);
  bool flash_(const Release &release, const Values &values);
  bool usb_() const;
  bool record_(uint32_t target, uint8_t phase);
  void fail_(const LogString *reason);
  http_request::HttpRequestComponent *request_{nullptr};
  std::string profile_, ota_password_, stock_, feed_;
  uint32_t revision_{0}, version_{0}, attempt_{0};
  bool blocked_{false}; std::atomic<bool> busy_{false};
  std::function<bool()> ui_ready_;
  std::function<void()> ui_begin_;
  std::function<void(float)> ui_progress_;
  std::function<void(bool)> ui_finish_;
  Release available_;
};
}  // namespace esphome::qf_native_update
