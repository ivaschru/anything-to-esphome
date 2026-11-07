#include "ports/lite/components/cgdn1_ui/settings_menu.h"
#include <cassert>
using namespace esphome::cgdn1_ui;
int main(){
 SettingsMenu m;int writes=0,restarts=0,boots=0;float live=3;
 auto &b=m.values[int(Key::BRIGHTNESS)];b.read=[&]{return live;};b.write=[&](float v){live=v;++writes;};
 b.minimum=[]{return 1.f;};b.maximum=[]{return 6.f;};b.step=[]{return 1.f;};
 m.open(0);m.gesture(Gesture::CENTRE,1);m.gesture(Gesture::CENTRE,2);
 assert(m.view==SettingsMenu::View::EDIT&&m.draft==3);
 m.gesture(Gesture::LEFT,3);assert(m.draft==2&&live==3&&writes==0);
 m.gesture(Gesture::SWIPE_LEFT,4);assert(live==3&&writes==0);
 live=5;m.gesture(Gesture::CENTRE,5);assert(m.draft==5);
 m.gesture(Gesture::RIGHT,6);m.gesture(Gesture::RIGHT,7);assert(m.draft==6);
 m.gesture(Gesture::CENTRE,8);assert(live==6&&writes==1);
 m.gesture(Gesture::CENTRE,9);m.gesture(Gesture::LEFT,10);m.expire(120011);
 assert(!m.active()&&live==6&&writes==1);
 // Back/forward taps and swipes are distinct, without raw decoder inversion.
 assert(navigation_delta(Gesture::LEFT)==-1&&navigation_delta(Gesture::RIGHT)==1);
 assert(navigation_delta(Gesture::SWIPE_LEFT)==1&&navigation_delta(Gesture::SWIPE_RIGHT)==-1);
 m.restart=[&]{++restarts;};m.other_slot=[&]{++boots;};
 m.open(0);m.group=7;m.row=3;m.gesture(Gesture::CENTRE,1);
 assert(m.phase==1&&m.choice==0);m.gesture(Gesture::CENTRE,2);assert(boots==0&&m.view==SettingsMenu::View::LIST);
 m.gesture(Gesture::CENTRE,3);m.gesture(Gesture::RIGHT,4);m.gesture(Gesture::CENTRE,5);
 assert(m.phase==2&&m.choice==0);m.gesture(Gesture::CENTRE,6);assert(boots==0);
 m.gesture(Gesture::CENTRE,7);m.gesture(Gesture::RIGHT,8);m.gesture(Gesture::CENTRE,9);
 m.gesture(Gesture::RIGHT,10);m.gesture(Gesture::CENTRE,11);assert(boots==1&&!m.active()&&restarts==0);
 // Time edits wrap each field independently; centre must pass minutes before SAVE.
 auto &t=m.values[int(Key::NIGHT_START)];float minutes=23*60+59;t.kind=ValueKind::TIME;
 t.read=[&]{return minutes;};t.write=[&](float v){minutes=v;++writes;};
 t.minimum=[]{return 0.f;};m.open(0);m.group=2;m.row=1;m.gesture(Gesture::CENTRE,1);
 m.gesture(Gesture::RIGHT,2);assert(m.draft==59&&minutes==1439);
 m.gesture(Gesture::CENTRE,3);m.gesture(Gesture::RIGHT,4);assert(m.draft==0&&minutes==1439);
 m.gesture(Gesture::CENTRE,5);assert(minutes==0&&writes==2);
}
