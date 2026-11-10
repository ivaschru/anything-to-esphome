#pragma once
#include <cstring>

#include "esphome/components/text/text.h"
#include "esphome/core/component.h"
#include "esphome/core/log.h"
#include "esphome/core/preferences.h"
#include "source_cache.h"

namespace esphome::cgdn1_ha_sources {
class SourceText : public text::Text, public Component {
 public:
  float get_setup_priority() const override { return setup_priority::HARDWARE; }
  void setup() override {
    // Use the same stable entity preference identity as built-in template
    // controls, plus a platform/version discriminator. No foreign prefs or
    // stock settings are edited. Empty bindings are explicitly restorable.
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wdeprecated-declarations"
    pref_ = global_preferences->make_preference<Stored>(get_preference_hash() ^ 0xc6d15a01u);
#pragma GCC diagnostic pop
    Stored stored{};
    std::string value;
    if (pref_.load(&stored)) {
      size_t length = 0;
      while (length < stored.size() && stored[length] != '\0') ++length;
      std::string candidate(stored.data(), length);
      if (cgdn1_ha::SourceCache::valid_entity(candidate)) value = std::move(candidate);
    }
    publish_state(value);
  }

 protected:
  void control(const std::string& value) override {
    // A native API client can bypass HA form validation. Reject before both
    // persistence and publication, so a bad request cannot change the source
    // now or poison the next boot. Never echo arbitrary input into logs.
    if (!cgdn1_ha::SourceCache::valid_entity(value)) {
      ESP_LOGW("cgdn1.source", "Rejected invalid display source entity id");
      return;
    }
    if (has_state() && state == value) return;
    Stored stored{};
    std::memcpy(stored.data(), value.data(), value.size());
    if (!pref_.save(&stored)) {
      ESP_LOGW("cgdn1.source", "Unable to save display source");
      return;
    }
    publish_state(value);
  }

 private:
  // One bounded NVS blob per source, using the stable native text identity.
  // Never persist imported readings: only the user-selected sensor entity ID.
  // A full 255-character slot is valid without a trailing NUL.
  using Stored = std::array<char, 255>;
  static_assert(sizeof(Stored) == 255);
  ESPPreferenceObject pref_;
};
}  // namespace esphome::cgdn1_ha_sources
