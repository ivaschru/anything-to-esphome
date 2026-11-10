#include "ports/lite/components/cgdn1_ui/display_wake.h"
#include <cassert>
using esphome::cgdn1_ui::DisplayWake;
int main() {
 DisplayWake p; assert(p.visible(0)); p.set_night(true); assert(!p.visible(1));
 p.wake(100); assert(p.visible(100)); assert(p.visible(30099)); assert(!p.visible(30100));
 p.activity(30101); assert(p.visible(30101)); p.set_night(true); assert(p.visible(30102));
 p.request(false); assert(!p.visible(30103)); p.wake(30104); assert(p.visible(30104));
 p.set_night(false); assert(!p.visible(30105)); // manual OFF survived temporary night wake
 p.request(true); assert(p.visible(30106)); p.set_night(true); assert(!p.visible(30107));
 p.wake(0xfffffff0u); assert(p.visible(30)); assert(!p.visible(30000));
 p.set_night(false); assert(p.visible(30001));
}
