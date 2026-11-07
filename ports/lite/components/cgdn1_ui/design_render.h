#pragma once
// Shared native-size drawing primitives for the agreed 160x128 design.
// Stock outline digits are NEVER reduced. Compact layouts use ordinary glyphs.
#include "ui_painter.h"
#include "esphome/components/cgdn1_display/stock_icons.h"
namespace esphome::cgdn1_ui {

inline bool classic_number(Painter &p,font::Font *font,const std::string &s,int x,int y,int align=0,int available=156) {
  // Pack real glyph INK with a five-pixel gap, instead of the font's tabular
  // advances. This preserves the same native 56px height for 24.8, 43 and
  // clocks, including 23:59; no shrinking or resampling is involved.
  if(font->get_bpp()!=1)return false;
  int width=-5,top=10000;
  for(unsigned char c:s) {
    const auto *g=font->find_glyph(c);if(!g || c>=128)return false;
    width+=g->width+5;top=std::min(top,g->offset_y);
  }
  if(width>available || width<0)return false;
  if(align==0)x-=width/2;else if(align==1)x-=width;
  for(unsigned char c:s) {
    const auto *g=font->find_glyph(c);
    for(int yy=0;yy<g->height;++yy)for(int xx=0;xx<g->width;++xx) {
      const int bit=yy*g->width+xx;
      if(g->data[bit/8] & (0x80>>(bit%8)))p.display().draw_pixel_at(x+p.x_offset()+xx,y+g->offset_y-top+yy);
    }
    x+=g->width+5;
  }
  return true;
}

inline int outline_width(const std::string &s) {
  int width=-5;
  for(char c:s) {
    if(c>='0'&&c<='9') width+=cgdn1_display::HUGE_DIGITS[c-'0']->width+5;
    else if(c=='.'||c==':'||c=='-')width+=15;
    else return 10000;
  } return std::max(0,width);
}
inline bool outline(Painter &p,const std::string &s,int x,int y,int align=0,int available=148) {
  const int width=outline_width(s); if(width>available)return false;
  if(align==0)x-=width/2;else if(align==1)x-=width;
  auto &d=p.display();
  for(char c:s) {
    if(c>='0'&&c<='9') {
      const auto &icon=*cgdn1_display::HUGE_DIGITS[c-'0'];
      const int stride=(icon.width+7)/8;
      for(int yy=0;yy<icon.height;++yy)for(int xx=0;xx<icon.width;++xx)
        if(icon.data[yy*stride+xx/8] & (0x80>>(xx%8)))d.draw_pixel_at(x+p.x_offset()+xx,y+yy);
      x+=icon.width+5;
    } else {
      if(c==':') {d.rectangle(x+3+p.x_offset(),y+17,4,4);d.rectangle(x+3+p.x_offset(),y+35,4,4);}
      else if(c=='.') d.rectangle(x+3+p.x_offset(),y+50,4,4);
      else d.filled_rectangle(x+1+p.x_offset(),y+27,8,3);
      x+=15;
    }
  } return true;
}
}  // namespace esphome::cgdn1_ui
