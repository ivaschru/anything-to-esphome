#!/usr/bin/env python3
"""Render actual reading/menu methods with the exact build's generated glyphs.

The host supplies only binary framebuffer, clock and connectivity facades.
Source method extraction fails closed on changed declarations. Nothing connects
or sends device commands; these frames are not photographs of an OLED.
"""
from pathlib import Path
import re
import subprocess
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'.build/ui-preview'
OUT.mkdir(parents=True,exist_ok=True)
s=(ROOT/'ports/lite/components/cgdn1_ui/cgdn1_ui.h').read_text()
def method(name):
    match=re.search(r'^  (?:static )?[^\n]+\b'+re.escape(name)+r'\([^\n]*\)[^{\n]*\{',s,re.M)
    if not match:raise ValueError('Changed render declaration: '+name)
    start=match.start();i=match.end();depth=1
    while depth:
        if s[i]=='{':depth+=1
        elif s[i]=='}':depth-=1
        i+=1
    return s[start:i]
main=(ROOT/'.build/lite-app/src/main.cpp').read_text()
fontcode=''
fontmap={'ui_status':'status_font_','ui_small':'small_','ui_title':'title_','ui_medium':'medium_','ui_large':'large_','ui_number':'number_','ui_summary':'summary_'}
init=''
for name,var in fontmap.items():
    match=re.search(r'new\('+name+r'\) font::Font\((font_glyph_id(_\d+)?), ([^;]+)\);',main)
    if not match:raise ValueError('Missing generated font '+name)
    gid,n,args=match.groups();n=n or ""
    for regex in [r'  static constexpr uint8_t uint8_t_id'+n+r'\[\] PROGMEM = [^\n]+;',r'  static const font::Glyph '+gid+r'\[\] = [^\n]+;']:
        fontcode+=re.search(regex,main).group().replace('PROGMEM','')+'\n'
    init+=f'static font::Font f_{n}({gid},{args});{var}=&f_{n};\n'
fake=r'''
#pragma once
#include <algorithm>
#include <vector>
#include <string>
#include <cstdio>
#include <cstring>
#include <cmath>
#include <cstdint>
namespace esphome {
inline uint32_t millis(){return 400000;}
namespace display {
constexpr bool COLOR_OFF=false,COLOR_ON=true;
struct Display {
 bool pixels[128][160]{};
 void draw_pixel_at(int x,int y,bool on=true){if(x>=0&&x<160&&y>=0&&y<128)pixels[y][x]=on;}
 void horizontal_line(int x,int y,int w){for(int i=0;i<w;++i)draw_pixel_at(x+i,y);}
 void filled_rectangle(int x,int y,int w,int h){for(int j=0;j<h;++j)for(int i=0;i<w;++i)draw_pixel_at(x+i,y+j);}
 void rectangle(int x,int y,int w,int h){horizontal_line(x,y,w);horizontal_line(x,y+h-1,w);for(int j=0;j<h;++j){draw_pixel_at(x,y+j);draw_pixel_at(x+w-1,y+j);}}
 void line(int x,int y,int xx,int yy){int dx=std::abs(xx-x),sx=x<xx?1:-1,dy=-std::abs(yy-y),sy=y<yy?1:-1,e=dx+dy;for(;;){draw_pixel_at(x,y);if(x==xx&&y==yy)break;int e2=2*e;if(e2>=dy){e+=dy;x+=sx;}if(e2<=dx){e+=dx;y+=sy;}}}
 void save(const std::string &name){FILE*f=fopen(name.c_str(),"wb");fprintf(f,"P1\n160 128\n");for(auto &row:pixels){for(bool b:row)fprintf(f,"%d ",b?0:1);fprintf(f,"\n");}fclose(f);}
};}
namespace font {
struct Glyph { uint32_t code_point;const uint8_t*data;int advance,offset_x,offset_y,width,height;};
class Font {
 const Glyph*data_;int count_;
 public:
 Font(const Glyph*g,int n,int,int,int,int,int,int):data_(g),count_(n){}
 int get_bpp() const{return 1;}
 const Glyph*find_glyph(uint32_t c)const{for(int i=0;i<count_;++i)if(data_[i].code_point==c)return data_+i;return nullptr;}
 void print(int x,int y,display::Display*d,bool on,const char*text,bool){
  const char*p=text;while(*p){uint8_t c=*p++;uint32_t cp=c;int n=c<128?0:(c&0xe0)==0xc0?1:2;if(n){cp=c&((1<<(6-n))-1);while(n--)cp=(cp<<6)|(uint8_t(*p++)&63);}const auto*g=find_glyph(cp);if(!g)continue;
  for(int yy=0;yy<g->height;++yy)for(int xx=0;xx<g->width;++xx){int bit=yy*g->width+xx;if(g->data[bit/8]&(0x80>>(bit%8)))d->draw_pixel_at(x+g->offset_x+xx,y+g->offset_y+yy,on);}x+=g->advance;
 }}
};}
struct ESPTime {int day_of_week=7;bool valid=true;bool is_valid()const{return valid;}std::string strftime(const char*f){return std::strstr(f,"%d")?"07.11.26":"12:48";}};
namespace wifi {struct Wifi {bool connected=true;bool is_connected(){return connected;}int wifi_rssi(){return -57;}};inline Wifi instance;inline Wifi*global_wifi_component=&instance;}
namespace api {struct Client {const char*get_name(){return "Home Assistant";}};struct Api {std::vector<Client*>active_clients(){static Client c;return {&c};}};inline Api instance;inline Api*global_api_server=&instance;}
namespace cgdn1_led {enum Sensor {SENSOR_NONE,SENSOR_CO2,SENSOR_TEMP,SENSOR_HUMI,SENSOR_PM25};}
}
'''
for name in ('esphome/components/display/display.h','esphome/components/font/font.h'):
    p=OUT/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text('#pragma once\n#include "fake.h"\n')
(OUT/'fake.h').write_text(fake)
p=OUT/'esphome/components/cgdn1_display/stock_icons.h';p.parent.mkdir(parents=True,exist_ok=True);p.write_text('#include \"'+str(ROOT/'ports/lite/components/cgdn1_display/stock_icons.h')+'\"\n')
entities=(ROOT/'ports/lite/components/cgdn1_ui/settings_entities.h').read_text()
label=entities[entities.index('  std::string label('):entities.index('\n};',entities.index('  std::string label('))]
choices=entities[entities.index('inline const char *choice_label'):entities.index('class SettingsEntities')]
readings = s[s.index('struct Readings {'):s.index('\n};',s.index('struct Readings {'))+3]
code='''#include <array>
#include "fake.h"
#include "ports/lite/components/cgdn1_ui/settings_menu.h"
#include "ports/lite/components/cgdn1_ui/design_render.h"
#include "ports/lite/components/cgdn1_display/display_sources.h"
namespace esphome::cgdn1_ui {
'''+choices+'''
struct Settings : SettingsMenu {
 float states[int(Key::COUNT)]{};
 float get(Key k,float=0)const{return states[int(k)];}
'''+label+'''
};
'''+readings+'''
class Fixture {public:
 Settings settings_;struct Battery{float state=82;} battery;Battery*battery_=&battery;
 struct PM{bool on=false;bool ready(){return on;}bool enabled(){return on;}uint32_t warmup_remaining_ms(){return 30000;}}pm;PM*pm_=&pm;
 bool pm_seen_=true;uint32_t pm_ms_=millis();cgdn1_led::Sensor shown_sensor_;float shown_value_;
 font::Font *status_font_,*small_,*title_,*medium_,*large_,*number_,*summary_;
 void render_info_(Painter&p,const Readings&){p.text(80,50,small_,"Сведения",0);}
'''
for name in ('ha_connected_','render_status_','hero_','render_reading_','render_saver_','render_settings_','number','draw_number_'):
    code+=method(name)+'\n'
code+='void fonts(){\n'+fontcode+init+'}\n};}\n'
code+=r'''
int main(int argc,char**argv){using namespace esphome;using namespace cgdn1_ui;Fixture f;f.fonts();Readings in;in.co2=780;in.temperature=24.8;in.humidity=43;in.pm1=4;in.pm25=11;in.pm10=13;in.summary={780,24.8};
 for(int i=0;i<int(Key::COUNT);++i){auto &b=f.settings_.values[i];b.read=[&,i]{return f.settings_.states[i];};b.step=[]{return 1.f;};b.minimum=[]{return 0.f;};}
 f.settings_.states[int(Key::BRIGHTNESS)]=6;
 for(int k:{1,6,9,10,12,16,24}){f.settings_.values[k].kind=ValueKind::BOOLEAN;f.settings_.states[k]=k!=9;}
 for(int k:{2,4,5,11,15,23}){f.settings_.values[k].kind=ValueKind::CHOICE;f.settings_.values[k].label=[k](int index){const char*s=choice_label(Key(k),index);return s?std::string(s):"Measured";};}
 for(int k:{7,8}){f.settings_.values[k].kind=ValueKind::TIME;f.settings_.states[k]=k==7?1320:420;}
 for(int design=0;design<2;++design){f.settings_.states[int(Key::DESIGN)]=design;
  for(int page=0;page<4;++page){display::Display d;Painter p(d);f.render_status_(p,in,page);f.render_reading_(p,in,page);d.save(std::string(argv[1])+"/reading-"+std::to_string(design)+"-"+std::to_string(page)+".pbm");}
  for(int layout=1;layout<7;++layout){display::Display d;Painter p(d);f.settings_.states[int(Key::IDLE)]=layout;f.render_status_(p,in,0);f.render_saver_(p,in);d.save(std::string(argv[1])+"/saver-"+std::to_string(design)+"-"+std::to_string(layout)+".pbm");}
 }
 in.ha_sources.fill(true);
 for(int page=0;page<4;++page){display::Display d;Painter p(d);f.render_status_(p,in,page);f.render_reading_(p,in,page);d.save(std::string(argv[1])+"/ha-reading-"+std::to_string(page)+".pbm");}
 in.ha_sources.fill(false);
 f.settings_.open(0);
 for(int group=0;group<8;++group){display::Display d;Painter p(d);f.settings_.group=group;f.settings_.row=0;f.render_settings_(p,in);d.save(std::string(argv[1])+"/menu-"+std::to_string(group)+".pbm");}
 f.settings_.group=1;f.settings_.row=0;f.settings_.key=0;f.settings_.draft=6;f.settings_.view=SettingsMenu::View::EDIT;
 {display::Display d;Painter p(d);f.render_settings_(p,in);d.save(std::string(argv[1])+"/editor-brightness.pbm");}
 f.settings_.row=4;f.settings_.key=4;f.settings_.draft=1;
 {display::Display d;Painter p(d);f.render_settings_(p,in);d.save(std::string(argv[1])+"/editor-design.pbm");}
 for(int phase=1;phase<=2;++phase){display::Display d;Painter p(d);f.settings_.view=SettingsMenu::View::CONFIRM;f.settings_.slot=true;f.settings_.phase=phase;f.render_settings_(p,in);d.save(std::string(argv[1])+"/confirm-"+std::to_string(phase)+".pbm");}
}
'''
(OUT/'render.cpp').write_text(code)
subprocess.run(['c++','-std=c++17','-I'+str(OUT),'-I'+str(ROOT),str(OUT/'render.cpp'),'-o',str(OUT/'render')],check=True)
subprocess.run([str(OUT/'render'),str(OUT)],check=True)
from PIL import Image,ImageDraw
paths=sorted(OUT.glob('*.pbm'));image=Image.new('RGB',(5*340,((len(paths)+4)//5)*300),'#222')
draw=ImageDraw.Draw(image)
for i,path in enumerate(paths):
    x=(i%5)*340;y=(i//5)*300
    frame=Image.open(path);frame.save(path.with_suffix('.png'))
    image.paste(frame.resize((320,256)),(x+10,y+25));draw.text((x+10,y+6),path.stem,fill='white')
image.save(OUT/'overview.png');print(OUT/'overview.png')
