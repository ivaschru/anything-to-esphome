#pragma once
#include <array>
#include <cstring>

#include "esphome/components/api/api_connection.h"
#include "esphome/components/api/api_server.h"
#include "esphome/components/cgs1_panel/cgs1_panel.h"
#include "esphome/core/hal.h"
#include "ha_source_cache.h"

namespace cgs1_ha {
// Runtime-configurable native API imports, without rebuilding the firmware.
// Two stable subscriptions per metric (state + unit), at most ten total.
// Rebinding changes a fixed buffer, never appends unbounded subscriptions.
class SourcesRuntime {
 public:
  bool configure(size_t index, const std::string& entity) {
    if (!cache_.configure(index, entity)) return false;
    if (!entity.empty()) {
      std::memcpy(ids_[index].data(), entity.c_str(), entity.size() + 1);
      if (!registered_[index]) {
        auto* server = esphome::api::global_api_server;
        if (!server) return false;
        server->get_home_assistant_state(
            ids_[index].data(), nullptr, [this, index](esphome::StringRef state) {
              cache_.state(index, std::string(state.c_str(), state.size()), esphome::millis());
            });
        server->get_home_assistant_state(
            ids_[index].data(), "unit_of_measurement", [this, index](esphome::StringRef unit) {
              cache_.unit(index, std::string(unit.c_str(), unit.size()), esphome::millis());
            });
        registered_[index] = true;
      }
    }
    // An empty binding disables the cache but leaves its previous stable
    // string valid for the API registry. A reconnect may ask that old entity
    // once; the callback ignores it. There are no persistent HA listeners.
    next_request_ = 0;
    return true;
  }
  void set_enabled(bool enabled) {
    enabled_ = enabled;
    next_request_ = 0;
  }
  void loop(esphome::cgs1_panel::Panel& panel) {
    const uint32_t now = esphome::millis();
    for (size_t i = 0; i < SourceCache::COUNT; ++i) {
      panel.set_ha_binding(i, cache_.configured(i));
      panel.set_ha_value(i, enabled_ ? cache_.value(i, now) : NAN);
    }
    if (!enabled_ || (next_request_ && int32_t(now - next_request_) < 0)) return;
    next_request_ = now + 30000;
    auto* server = esphome::api::global_api_server;
    if (!server) return;
    for (const auto& connection : server->active_clients()) {
      if (!connection->is_authenticated()) continue;
      for (size_t i = 0; i < SourceCache::COUNT; ++i) {
        if (!cache_.configured(i)) continue;
        for (const char* attribute : {"", "unit_of_measurement"}) {
          esphome::api::SubscribeHomeAssistantStateResponse request;
          request.entity_id = esphome::StringRef(ids_[i].data());
          request.attribute = esphome::StringRef(attribute);
          request.once = true;
          // Generic API clients can ignore these read requests. Only an
          // authenticated HA client that supplies states updates the cache.
          // This protocol asks for values; it never calls a HA service.
          const bool sent = connection->send_message(request);
          (void)sent;  // A full socket buffer simply leaves local fallback.
        }
      }
    }
  }
  std::string diagnostic() const {
    std::string result;
    const char* names[] = {"CO₂", "T", "RH", "PM", "TVOC"};
    for (size_t i = 0; i < SourceCache::COUNT; ++i) {
      if (i) result += "; ";
      result += names[i];
      result += ": ";
      result += SourceCache::description(cache_.status(i, esphome::millis()));
    }
    return result;
  }
  size_t subscription_count() const {
    const auto *server = esphome::api::global_api_server;
    return server ? server->get_state_subs().size() : 0;
  }

 private:
  SourceCache cache_;
  std::array<std::array<char, 256>, SourceCache::COUNT> ids_{};
  std::array<bool, SourceCache::COUNT> registered_{};
  uint32_t next_request_{0};
  bool enabled_{false};
};
inline SourcesRuntime sources;
}  // namespace cgs1_ha
