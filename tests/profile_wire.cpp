// Compile the actual production helper with real mbedTLS/ArduinoJson; only the
// physical device interfaces and RNG are synthetic. No monitor or live key.
#include "ports/lite/components/cgdn1_ui/update_profile.h"
#include <iostream>
int main(int argc,char **){
 JsonDocument document;
 auto root=document.to<JsonObject>();
 esphome::qf_update_profile::respond(root,argc>1?"bad":"1234567890abcdef1234567890abcdef","test-ota-password","2026.11.07-ui25-profile1",2,1);
 std::string wire;serializeJson(document,wire);std::cout<<wire;
}
