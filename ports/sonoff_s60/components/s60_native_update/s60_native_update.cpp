#include "s60_native_update.h"
#include "verified_stream.h"
#include "journal.h"
#include "read_budget.h"
#include <esp_http_client.h>
#include "esphome/components/api/api_server.h"
#include "esphome/components/json/json_util.h"
#include "esphome/components/md5/md5.h"
#include "esphome/components/network/util.h"
#include "esphome/components/ota/ota_backend_factory.h"
#include "esphome/components/wifi/wifi_component.h"
#include "esphome/core/application.h"
#include "esphome/core/log.h"
#include <driver/gpio.h>
#include <esp_ota_ops.h>
#include <esp_heap_caps.h>
#include <nvs.h>
#include <mbedtls/platform_util.h>

namespace esphome::s60_native_update {
static constexpr char TAG[] = "sonoff.update";
static constexpr char RAW[] = "https://raw.githubusercontent.com/ivaschru/anything-to-esphome/";
// This namespace contains NO credentials. A pending attempt survives a lost
// reply/reboot and fences automatic/manual replay in the old firmware. Sequence
// never resets; a known pre-activation abort is terminal and permits a NEW click.
// Secrets stay solely in the same personalized app slots as previous releases.

bool NativeUpdate::record_(uint32_t target, uint8_t phase) {
  nvs_handle_t handle;
  if (nvs_open("s60_native", NVS_READWRITE, &handle) != ESP_OK) return false;
  Journal value{}; value.sequence = attempt_; value.target = target;
  value.phase = phase; value.profile = 3;
  auto result = nvs_set_blob(handle, "attempt", &value, sizeof(value));
  if (result == ESP_OK) result = nvs_commit(handle);
  Journal read{}; size_t size = sizeof(read);
  if (result == ESP_OK) result = nvs_get_blob(handle, "attempt", &read, &size);
  nvs_close(handle);
  return result == ESP_OK && size == sizeof(read) && memcmp(&read, &value, size) == 0;
}

bool NativeUpdate::powered_() const {
  // S60TPF is a mains-powered plug, not a battery appliance. There is no
  // qualified supply-sense GPIO. The explicit HA INSTALL authorizes its
  // software restart; do not reuse CGDN1 USB GPIO34 or invent a power reading.
  return true;
}

void NativeUpdate::setup() {
  update_info_.current_version = std::to_string(version_);
  update_info_.title = "Sonoff S60TPF firmware";
  // Publish the installed version even before Internet access succeeds. Without
  // has_state, the native API deliberately omits current_version and HA cannot
  // offer an explicit refresh of an unavailable entity after a transient error.
  publish_state();
  nvs_handle_t handle; Journal value{}; size_t size = sizeof(value);
  auto result = nvs_open("s60_native", NVS_READONLY, &handle);
  if (result == ESP_OK) {
    result = nvs_get_blob(handle, "attempt", &value, &size); nvs_close(handle);
    if (result == ESP_OK) {
      attempt_ = value.sequence;
      const auto recovery = review_journal(value, size, 3, revision_);
      blocked_ = recovery == Recovery::BLOCKED;
      if (recovery == Recovery::TARGET_BOOTED) {
        // Booting the exact target reconciles activation only. It is not a
        // claim that physical sensors/settings have passed external health QA.
        blocked_ = value.target != revision_ || !record_(revision_, 3);
      }
    } else if (result != ESP_ERR_NVS_NOT_FOUND) blocked_ = true;
  } else if (result != ESP_ERR_NVS_NOT_FOUND) blocked_ = true;
  if (blocked_) status_set_error(LOG_STR("Previous firmware attempt requires review"));
  // Delay the first check to leave startup/source readiness undisturbed. This
  // timer/check never calls perform(), and failures never schedule an install.
  set_timeout(60000, [this]() { check(); });
}

std::string NativeUpdate::diagnostic() const {
  // Public operational numbers only: no network names, keys, app bytes or
  // journal reset/action. This remains useful when a TLS check is refused.
  return "check=" + std::to_string(last_check_) + " heap_before=" + std::to_string(heap_before_) +
         " largest_before=" + std::to_string(largest_before_) + " heap_after=" + std::to_string(heap_after_) +
         " pending_review=" + std::to_string(blocked_) +
         " install_phase=" + std::to_string(install_phase_) + " install_code=" + std::to_string(install_code_) + " read=" + std::to_string(install_read_) + " received=" + std::to_string(install_received_);
}

bool NativeUpdate::fetch_(Release &out) {
  const auto url = std::string(RAW) + "firmware-catalog/native-" + profile_ + ".json";
  auto response = request_->get(url);
  if (!response) return false;
  const size_t size = response->content_length;
  if (response->status_code != 200 || size < 128 || size > 16384) { response->end(); return false; }
  std::string body(size, '\0');
  const auto result = http_request::http_read_fully(response.get(), reinterpret_cast<uint8_t *>(body.data()),
                                                  size, size, request_->get_timeout());
  response->end();
  if (result.status != http_request::HttpReadStatus::OK) return false;
  return json::parse_json(body, [&](JsonObject root) {
    if (root["format"] != "anything-native-update-v1" || root["profile"] != profile_ ||
        root["hardware"] != "SN-ESP32C3-S60-01" || root["source_stock_version"] != stock_ ||
        !root["revision"].is<uint32_t>() || !root["public_version"].is<uint32_t>() || !root["size"].is<uint32_t>()) return false;
    Release release;
    release.revision = root["revision"]; release.version = root["public_version"]; release.size = root["size"];
    if (!release.revision || release.revision > 1000000 || !release.version || release.version > 1000000 ||
        release.size < 64 || release.size >= 0x1f0000 || !root["sha256"].is<const char *>()) return false;
    release.sha256 = root["sha256"].as<std::string>();
    if (release.sha256.size() != 64) return false;
    for (char c : release.sha256) if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f'))) return false;
    const auto tag = "firmware-" + profile_ + "-v" + std::to_string(release.version);
    release.url = std::string(RAW) + tag + "/" + profile_ + "-template.bin";
    release.release_url = "https://github.com/ivaschru/anything-to-esphome/tree/" + tag;
    // No caller/manifest-selected host, redirect, downgrade or alternative
    // layout. A profile owns one immutable tag/path for each public integer.
    if (root["url"] != release.url || !root["patches"].is<JsonArray>()) return false;
    auto patches = root["patches"].as<JsonArray>();
    if (patches.size() < SLOT_COUNT || patches.size() > 128) return false;
    uint32_t end = 24; std::array<unsigned, SLOT_COUNT> counts{};
    for (JsonVariant entry : patches) {
      if (!entry.is<JsonArray>() || entry.size() != 2 || !entry[0].is<uint32_t>() || !entry[1].is<uint8_t>()) return false;
      uint32_t at = entry[0]; uint8_t slot = entry[1];
      if (slot >= SLOT_COUNT || at < end || at >= release.size || marker_size(slot) > release.size - at) return false;
      end = at + marker_size(slot); ++counts[slot]; release.patches.push_back({at, slot});
    }
    for (auto n : counts) if (!n) return false;
    if (root["summary"].is<const char *>()) release.summary = root["summary"].as<std::string>();
    if (release.summary.size() > 1024) return false;
    out = std::move(release); return true;
  });
}

void NativeUpdate::check() {
  if (!network::is_connected() || busy_.exchange(true)) return;
  // TLS/JSON run outside the sensor/UI loop. Only the completed value-free
  // public result crosses back via defer; credentials are never read here.
  const auto started = xTaskCreate([](void *context) {
    auto *self = static_cast<NativeUpdate *>(context);
    const auto heap = heap_caps_get_free_size(MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT);
    const auto largest = heap_caps_get_largest_free_block(MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT);
    auto release = std::make_shared<Release>();
    const bool ok = self->fetch_(*release);
    const auto after = heap_caps_get_free_size(MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT);
    self->defer([self, release, ok, heap, largest, after]() {
      self->heap_before_ = heap; self->largest_before_ = largest; self->heap_after_ = after;
      self->last_check_ = ok ? 1 : 2;
      ESP_LOGD(TAG, "Catalog check=%u internal_heap=%u largest=%u after=%u", self->last_check_,
               self->heap_before_, self->largest_before_, self->heap_after_);
      if (ok) {
        self->available_ = *release;
        const bool newer = newer_release(release->revision, release->version, self->revision_, self->version_);
        self->update_info_.latest_version = std::to_string(newer ? release->version : self->version_);
        self->update_info_.summary = release->summary;
        self->update_info_.release_url = release->release_url;
        self->state_ = newer ? update::UPDATE_STATE_AVAILABLE : update::UPDATE_STATE_NO_UPDATE;
        if (!self->blocked_) { self->status_clear_warning(); self->status_clear_error(); }
        self->publish_state();
      } else self->status_set_warning("Cannot verify firmware catalog");
      self->busy_ = false;
    });
    // FreeRTOS task deletion does not unwind the C++ stack. Release the task's
    // shared_ptr explicitly; the deferred main-loop callback keeps its own copy.
    release.reset();
    vTaskDelete(nullptr);
  }, "s60_update_check", 8192, this, 1, nullptr);
  if (started != pdPASS) { busy_ = false; status_set_warning("Insufficient memory for firmware check"); }
}

bool NativeUpdate::capture_(Values &values) {
  auto *server = api::global_api_server; auto *wifi = wifi::global_wifi_component;
  if (!server || !wifi || !server->get_noise_ctx().has_psk() || ota_password_.empty() ||
      stock_ != "1.2.0") return false;
  noise::psk_t psk{}; server->get_noise_ctx().load_psk(psk);
  if (noise::NoiseContext::is_all_zeros(psk)) return false;
  const auto station = wifi->get_sta(); const auto ap = wifi->get_ap();
  values = {feed_, stock_, station.get_ssid().str(), station.get_password().str(), App.get_name().str(),
            ap.get_ssid().str(), ap.get_password().str(), ota_password_, std::string(reinterpret_cast<char *>(psk.data()), psk.size())};
  mbedtls_platform_zeroize(psk.data(), psk.size());
  if (values[2].empty() || values[5].empty() || values[6].size() < 8) return false;
  // The pure stream constructor also validates all lengths, NULs, exact name
  // length and replaced markers, before the first flash write is admitted.
  ImageStream<sha256::SHA256> probe(available_.size, available_.patches, values);
  uint8_t unused = 0; return probe.push(&unused, 0);
}

void NativeUpdate::fail_(const LogString *reason) {
  status_set_error(reason); state_ = update::UPDATE_STATE_AVAILABLE;
  update_info_.has_progress = false; publish_state(); busy_ = false;
}

void NativeUpdate::perform(bool force) {
  // Native HA update.install is admin-only. Noise authenticates its controller;
  // no user-supplied URL/key/raw firmware service is exposed by this component.
  if (force || busy_.exchange(true)) return;
  Values values;
  if (blocked_ || !powered_() || !ui_ready_ || !ui_ready_() || !network::is_connected() || state_ != update::UPDATE_STATE_AVAILABLE ||
      available_.revision <= revision_ || available_.version <= version_ || !capture_(values)) {
    for (auto &value : values) if (!value.empty()) mbedtls_platform_zeroize(value.data(), value.size());
    fail_(LOG_STR("Firmware install requires a verified S60TPF profile")); return;
  }
  state_ = update::UPDATE_STATE_INSTALLING; update_info_.has_progress = true; update_info_.progress = 0; publish_state();
  if (ui_begin_) ui_begin_();
  const bool done = flash_(available_, values);
  for (auto &value : values) if (!value.empty()) mbedtls_platform_zeroize(value.data(), value.size());
  if (ui_finish_) ui_finish_(done);
  if (done) { delay(10); App.safe_reboot(); }
  else fail_(blocked_ ? LOG_STR("Previous firmware attempt requires review") : LOG_STR("Firmware transfer was not activated"));
}

bool NativeUpdate::flash_(const Release &release, const Values &values) {
  install_phase_ = 1; install_code_ = 0;
  auto response = request_->get(release.url);
  if (!response) return false;
  install_phase_ = 2; install_code_ = response->status_code;
  if (response->status_code != 200 || response->content_length != release.size || !powered_()) { response->end(); return false; }
  install_phase_ = 3; install_code_ = 0;
  const auto *running = esp_ota_get_running_partition(); const auto *target = esp_ota_get_next_update_partition(nullptr);
  // Both stock S60TPF app slots must be the exact known layout; no bootloader,
  // partition table, stock config or arbitrary flash-range writer exists here.
  if (!running || !target || running == target || target->size != 0x1f0000 || running->size != 0x1f0000 ||
      !((running->address == 0x20000 && target->address == 0x210000) ||
        (running->address == 0x210000 && target->address == 0x20000)) || attempt_ == UINT32_MAX) { response->end(); return false; }
  install_phase_ = 4;
  ++attempt_;
  if (!record_(release.revision, 1)) { response->end(); blocked_ = true; return false; }
  blocked_ = true;
  auto backend = ota::make_ota_backend();
  install_phase_ = 5; install_code_ = backend->begin(release.size);
  if (install_code_ != ota::OTA_RESPONSE_OK) {
    response->end(); blocked_ = !record_(release.revision, 2); return false;
  }
  install_phase_ = 6;
  VerifiedImageStream<sha256::SHA256> stream(release.size, release.patches, values);
  md5::MD5Digest modified; modified.init();
  uint8_t buffer[2048]; uint32_t last = millis(), start = last, progress_at = last;
  static_assert(ReadWaitBudget::IDF_HTTP_EAGAIN == -ESP_ERR_HTTP_EAGAIN);
  ReadWaitBudget wait(start);
  size_t received = 0; bool good = true;
  while (received < release.size) {
    int count = response->read(buffer, std::min(sizeof(buffer), size_t(release.size - received)));
    install_read_ = count; install_received_ = received;
    App.feed_wdt(); yield();
    if (!powered_()) { install_code_ = 610; good = false; break; }
    if (millis() - start > 300000) { install_code_ = 611; good = false; break; }
    // A socket timeout with no payload is not EOF in IDF. Resume only this
    // still-open stream, within bounded idle/total/consecutive limits. Neither
    // the original SHA nor the personalized image/write position is reset.
    if (count == -ESP_ERR_HTTP_EAGAIN && wait.can_wait(count, millis())) {
      ESP_LOGW(TAG, "Waiting for firmware data at %u bytes", uint32_t(received));
      continue;
    }
    if (count > 0) wait.data(millis());
    const auto result = http_request::http_read_loop_result(count, last, request_->get_timeout(), response->is_read_complete());
    if (result == http_request::HttpReadLoopResult::RETRY) continue;
    if (result != http_request::HttpReadLoopResult::DATA || count > int(sizeof(buffer))) { install_code_ = 620 + int(result); good = false; break; }
    install_code_ = 601;
    if (!stream.push(buffer, count)) { good = false; break; }
    modified.add(buffer, count);
    install_code_ = backend->write(buffer, count);
    if (install_code_ != ota::OTA_RESPONSE_OK) { good = false; break; }
    received += count;
    if (millis() - progress_at > 1000) {
      progress_at = millis(); update_info_.progress = received * 100.0f / release.size; publish_state();
      if (ui_progress_) ui_progress_(update_info_.progress);
    }
  }
  response->end(); mbedtls_platform_zeroize(buffer, sizeof(buffer));
  install_phase_ = good ? 7 : 6;
  good &= received == release.size && stream.verified(release.sha256.c_str()) && powered_();
  if (!good) {
    backend->abort(); blocked_ = !record_(release.revision, 2); return false;
  }
  install_phase_ = 8;
  modified.calculate(); char md5[33]; modified.get_hex(md5); backend->set_update_md5(md5);
  // ONLY end() activates the inactive app. A lost/failed activation leaves the
  // durable pending record intact; never auto-retry, roll back, erase or reset.
  install_phase_ = 9; install_code_ = backend->end();
  if (install_code_ != ota::OTA_RESPONSE_OK) { backend->abort(); return false; }
  install_phase_ = 10;
  return true;
}
}  // namespace esphome::s60_native_update
