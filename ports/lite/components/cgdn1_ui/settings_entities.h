#pragma once
// SDK adapters deliberately call typed entities, never preferences directly.
// Local edits and HA therefore share validation, restore, callbacks and state.
#include "settings_menu.h"
#include "esphome/components/number/number.h"
#include "esphome/components/select/select.h"
#include "esphome/components/switch/switch.h"
#include "esphome/components/datetime/time_entity.h"
#include "esphome/components/button/button.h"
#include <cstdio>
namespace esphome::cgdn1_ui {
inline const char *choice_label(Key key,int index) {
  static const char *const idle[]={"Выбранный сенсор","CO₂ + температура","Часы + дата","Часы + CO₂ + T","Часы","Крупный CO₂","Сводка"};
  static const char *const design[]={"Qingping","Классический"};
  static const char *const motion[]={"Плавный сдвиг","Без анимации"};
  static const char *const pm[]={"Китай","США","ЕС"};
  static const char *const pattern[]={"Выключен","Ориентация","Шахматная сетка","Белая заливка"};
  if(key==Key::IDLE && index>=0 && index<7) return idle[index];
  if(key==Key::DESIGN && index>=0 && index<2) return design[index];
  if(key==Key::MOTION && index>=0 && index<2) return motion[index];
  if(key==Key::PM_STANDARD && index>=0 && index<3) return pm[index];
  if(key==Key::PATTERN && index>=0 && index<4) return pattern[index];
  return nullptr;
}
class SettingsEntities : public SettingsMenu {
 public:
  void bind_number(int key,number::Number *n) {
    auto &b=values[key]; b.kind=ValueKind::NUMBER;
    b.unit=key==int(Key::BRIGHTNESS)?"/ 6":key==int(Key::DELAY)||key==int(Key::LAG)||key==int(Key::OLED_TIME)||key==int(Key::BT_TIME)?"с":key==int(Key::RH_OFFSET)?"%":"°C";
    b.read=[n]{return n->state;}; b.minimum=[n]{return n->traits.get_min_value();};
    b.maximum=[n]{return n->traits.get_max_value();}; b.step=[n]{return n->traits.get_step();};
    b.write=[n](float value){ auto call=n->make_call(); call.set_value(value); call.perform(); };
  }
  void bind_switch(int key,switch_::Switch *s) {
    auto &b=values[key]; b.kind=ValueKind::BOOLEAN;
    b.read=[s]{return float(s->state);}; b.minimum=[]{return 0.f;}; b.maximum=[]{return 1.f;}; b.step=[]{return 1.f;};
    b.write=[s](float value){if(value>=0.5f)s->turn_on();else s->turn_off();};
  }
  void bind_select(int key,select::Select *s) {
    auto &b=values[key]; b.kind=ValueKind::CHOICE;
    b.read=[s]{return float(s->active_index().value_or(0));}; b.minimum=[]{return 0.f;};
    b.maximum=[s]{return float(s->size()-1);}; b.step=[]{return 1.f;};
    b.label=[s,key](int index){const auto *label=choice_label(Key(key),index); return label?std::string(label):s->at(index).value_or("—");};
    b.write=[s](float value){auto call=s->make_call(); call.set_index(size_t(value)); call.perform();};
  }
  void bind_time(int key,datetime::TimeEntity *t) {
    auto &b=values[key]; b.kind=ValueKind::TIME;
    b.read=[t]{return float(t->hour*60+t->minute);}; b.minimum=[]{return 0.f;}; b.maximum=[]{return 1439.f;}; b.step=[]{return 1.f;};
    b.write=[t](float value){auto call=t->make_call(); call.set_time(int(value)/60,int(value)%60,0);call.perform();};
  }
  float get(Key key,float fallback=0) const {const auto &b=values[int(key)]; return b.read?b.read():fallback;}
  std::string label(int key,float value) const {
    const auto &b=values[key];
    if(b.kind==ValueKind::BOOLEAN)return value>=0.5f?"Вкл.":"Выкл.";
    if(b.kind==ValueKind::CHOICE)return b.label?b.label(int(value)):"—";
    char out[32];
    if(b.kind==ValueKind::TIME)std::snprintf(out,sizeof(out),"%02d:%02d",int(value)/60,int(value)%60);
    else {const float step=b.step?b.step():1;std::snprintf(out,sizeof(out),step<0.1f?"%.2f":step<1?"%.1f":"%.0f",double(value));}
    return out;
  }
};
}  // namespace esphome::cgdn1_ui
