#pragma once
// Local drafts and navigation contain no hardware/HA writes. The adapter
// reads live entity state on OPEN, and applies exactly once on explicit SAVE.
// This keeps remote changes visible and makes cancel/timeout side-effect free.
#include "ui_model.h"
#include <functional>
#include <vector>
#include <cmath>
namespace esphome::cgdn1_ui {
enum class Key : uint8_t { BRIGHTNESS, DISPLAY, IDLE, DELAY, DESIGN, MOTION,
  NIGHT, NIGHT_START, NIGHT_END, PM, LED, PM_STANDARD, BLE, TEMP_OFFSET, RH_OFFSET,
  HEAT_MODEL, BT_COMP, HEAT6, HEAT1, LAG, OLED_TIME, BT_HEAT, BT_TIME, PATTERN, COUNT };
enum class ValueKind : uint8_t { NUMBER, BOOLEAN, CHOICE, TIME };
struct ValueBinding {
  const char *title{""}, *unit{""};
  ValueKind kind{ValueKind::NUMBER};
  std::function<float()> read;
  std::function<void(float)> write;
  std::function<float()> minimum, maximum, step;
  std::function<std::string(int)> label;
};
enum class MenuKind : uint8_t { VALUE, GROUP, BACK, WIFI, INFO, RESTART, SLOT };
struct MenuEntry { MenuKind kind; const char *title; int target; };
struct MenuGroup { const char *title; int parent; std::vector<MenuEntry> items; };
inline const std::vector<MenuGroup> &menu_groups() {
  using M=MenuKind; using K=Key;
  static const std::vector<MenuGroup> groups = {
    {"Настройки",0,{{M::GROUP,"Экран",1},{M::GROUP,"Ночной режим",2},{M::GROUP,"Датчики",3},{M::GROUP,"Подключения",4},{M::GROUP,"Расширенные",5},{M::GROUP,"Система",7},{M::BACK,"Назад",0}}},
    {"Экран",0,{{M::VALUE,"Яркость",int(K::BRIGHTNESS)},{M::VALUE,"Дисплей",int(K::DISPLAY)},{M::VALUE,"Заставка",int(K::IDLE)},{M::VALUE,"Задержка",int(K::DELAY)},{M::VALUE,"Дизайн",int(K::DESIGN)},{M::VALUE,"Переходы",int(K::MOTION)},{M::BACK,"Назад",0}}},
    {"Ночной режим",0,{{M::VALUE,"Включён",int(K::NIGHT)},{M::VALUE,"Начало",int(K::NIGHT_START)},{M::VALUE,"Окончание",int(K::NIGHT_END)},{M::BACK,"Назад",0}}},
    {"Датчики",0,{{M::VALUE,"Сенсор PM",int(K::PM)},{M::VALUE,"Индикатор LED",int(K::LED)},{M::VALUE,"Пороги PM",int(K::PM_STANDARD)},{M::BACK,"Назад",0}}},
    {"Подключения",0,{{M::WIFI,"Wi-Fi",0},{M::VALUE,"Bluetooth",int(K::BLE)},{M::INFO,"Home Assistant",0},{M::INFO,"Время и дата",1},{M::BACK,"Назад",0}}},
    {"Расширенные",0,{{M::VALUE,"Поправка T",int(K::TEMP_OFFSET)},{M::VALUE,"Поправка RH",int(K::RH_OFFSET)},{M::VALUE,"Модель нагрева",int(K::HEAT_MODEL)},{M::VALUE,"Компенс. BT",int(K::BT_COMP)},{M::GROUP,"Параметры нагрева",6},{M::BACK,"Назад",0}}},
    {"Параметры нагрева",5,{{M::VALUE,"Нагрев, ярк. 6",int(K::HEAT6)},{M::VALUE,"Нагрев, ярк. 1",int(K::HEAT1)},{M::VALUE,"Лаг дисплея",int(K::LAG)},{M::VALUE,"Время OLED",int(K::OLED_TIME)},{M::VALUE,"Нагрев BT",int(K::BT_HEAT)},{M::VALUE,"Время BT",int(K::BT_TIME)},{M::BACK,"Назад",0}}},
    {"Система",0,{{M::INFO,"Об устройстве",2},{M::VALUE,"Тест дисплея",int(K::PATTERN)},{M::RESTART,"Перезапуск",0},{M::SLOT,"Другой слот",0},{M::BACK,"Назад",0}}}
  }; return groups;
}
inline int navigation_delta(Gesture g) {
  // Taps follow the visible left/right order; swipes retain the stock drag
  // convention. Do not invert hardware coordinates or decoder thresholds.
  return g==Gesture::LEFT || g==Gesture::SWIPE_RIGHT ? -1 :
         g==Gesture::RIGHT || g==Gesture::SWIPE_LEFT ? 1 : 0;
}
class SettingsMenu {
 public:
  enum class View { CLOSED, LIST, EDIT, INFO, CONFIRM };
  View view{View::CLOSED}; int group{0}, row{0}, key{0}, info{0};
  int part{0}, phase{0}, choice{0}; float draft{0}; bool slot{false};
  uint32_t activity{0};
  ValueBinding values[int(Key::COUNT)];
  std::function<void()> restart, other_slot;
  const MenuEntry &entry() const { return menu_groups()[group].items[row]; }
  bool active() const { return view!=View::CLOSED; }
  void open(uint32_t now) { group=row=0; view=View::LIST; activity=now; }
  void close() { view=View::CLOSED; phase=choice=0; }
  void expire(uint32_t now) { if(active() && uint32_t(now-activity)>=120000) close(); }
  bool gesture(Gesture g,uint32_t now) {
    activity=now; const int d=navigation_delta(g); const bool centre=g==Gesture::CENTRE;
    const bool swipe=g==Gesture::SWIPE_LEFT || g==Gesture::SWIPE_RIGHT;
    if(view==View::EDIT) {
      auto &b=values[key];
      if(swipe) { view=View::LIST; return false; }
      if(d) {
        if(b.kind==ValueKind::TIME) {
          int h=int(draft)/60,m=int(draft)%60;
          if(!part) h=(h+d+24)%24; else m=(m+d+60)%60;
          draft=h*60+m;
        } else {
          const float step=b.step();
          // Integer ticks avoid accumulated float drift for 0.05/0.1 steps.
          const int ticks=int(std::lround((draft-b.minimum())/step))+d;
          draft=std::clamp(b.minimum()+ticks*step,b.minimum(),b.maximum());
        }
      } else if(centre) {
        if(b.kind==ValueKind::TIME && part++==0) return false;
        view=View::LIST; b.write(draft);
      } return false;
    }
    if(view==View::CONFIRM) {
      if(swipe || (centre && choice==0)) { view=View::LIST; phase=choice=0; }
      else if(d) choice=1-choice;
      else if(centre) {
        if(slot && phase==1) { phase=2; choice=0; }
        else { close(); if(slot) { if(other_slot) other_slot(); } else if(restart) restart(); }
      } return false;
    }
    if(view==View::INFO) { if(centre||swipe) view=View::LIST; return false; }
    if(view!=View::LIST) return false;
    const auto &items=menu_groups()[group].items;
    if(d) row=(row+d+int(items.size()))%int(items.size());
    else if(centre) {
      const auto selected=entry();
      if(selected.kind==MenuKind::VALUE) {
        key=selected.target; auto &b=values[key];
        if(!b.read || !b.write) return false;
        draft=b.read(); if(!std::isfinite(draft)) draft=b.minimum(); part=0; view=View::EDIT;
      } else if(selected.kind==MenuKind::GROUP) { group=selected.target; row=0; }
      else if(selected.kind==MenuKind::BACK) {
        if(group==0) close(); else { group=menu_groups()[group].parent; row=0; }
      } else if(selected.kind==MenuKind::WIFI) return true;
      else if(selected.kind==MenuKind::INFO) { info=selected.target; view=View::INFO; }
      else { slot=selected.kind==MenuKind::SLOT; phase=1; choice=0; view=View::CONFIRM; }
    } return false;
  }
};
}  // namespace esphome::cgdn1_ui
