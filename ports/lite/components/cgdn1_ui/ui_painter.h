#pragma once
// Place by actual monochrome glyph ink, not by a font's ascender or line box.
// This matches the review mockups and keeps small Cyrillic labels on the final
// 160x128 grid. Font data remains ESPHome's normal flash-resident 1-bpp data.
#include "esphome/components/display/display.h"
#include "esphome/components/font/font.h"
#include <algorithm>
#include <string>

namespace esphome::cgdn1_ui {
struct Ink { int x{0}, y{0}, width{0}, height{0}; };
inline uint32_t codepoint(const char *&p) {
  const auto c = static_cast<uint8_t>(*p++);
  if (c < 128) return c;
  int n = (c & 0xE0) == 0xC0 ? 1 : (c & 0xF0) == 0xE0 ? 2 : (c & 0xF8) == 0xF0 ? 3 : 0;
  if (!n) return '?';
  uint32_t out = c & ((1u << (6 - n)) - 1);
  while (n--) {
    if (!*p || (static_cast<uint8_t>(*p) & 0xC0) != 0x80) return '?';
    out = (out << 6) | (static_cast<uint8_t>(*p++) & 0x3F);
  }
  return out;
}
inline Ink ink(font::Font *font, const std::string &text) {
  int pen = 0, left = 10000, top = 10000, right = -10000, bottom = -10000;
  const char *p = text.c_str();
  while (*p) {
    const auto *g = font->find_glyph(codepoint(p));
    if (!g) g = font->find_glyph('?');
    if (!g) continue;
    if (g->width && g->height) {
      left = std::min(left, pen + g->offset_x); top = std::min(top, g->offset_y);
      right = std::max(right, pen + g->offset_x + g->width); bottom = std::max(bottom, g->offset_y + g->height);
    }
    pen += g->advance;
  }
  return left == 10000 ? Ink{} : Ink{left, top, right - left, bottom - top};
}
inline void pop_utf8(std::string &text) {
  if (text.empty()) return;
  size_t n = text.size() - 1;
  while (n && (static_cast<uint8_t>(text[n]) & 0xC0) == 0x80) n--;
  text.resize(n);
}
inline std::string fit_text(font::Font *font, std::string text, int width) {
  // SSIDs and optional messages may contain glyphs absent from the compact
  // atlas. Normalize only their presentation, preserving the original network
  // bytes for connection. The actual font renderer then agrees with measuring.
  std::string supported;
  const char *p = text.c_str();
  while (*p) {
    const char *start = p;
    const uint32_t cp = codepoint(p);
    if (font->find_glyph(cp)) supported.append(start, p - start);
    else supported += '?';
  }
  text = std::move(supported);
  if (ink(font, text).width <= width) return text;
  while (!text.empty()) {
    pop_utf8(text);
    if (ink(font, text + "…").width <= width) return text + "…";
  }
  return "";
}
class Painter {
 public:
  explicit Painter(display::Display &display) : display_(display) {}
  // align: -1 left, 0 centre, +1 right. Fitting never shrinks the native font.
  void text(int x, int y, font::Font *font, const std::string &value, int align = -1,
            bool inverted = false, int available = 148) {
    const std::string fitted = fit_text(font, value, available);
    const Ink box = ink(font, fitted);
    if (align == 0) x -= box.width / 2;
    else if (align == 1) x -= box.width;
    font->print(x - box.x, y - box.y, &display_, inverted ? display::COLOR_OFF : display::COLOR_ON,
                fitted.c_str(), inverted ? display::COLOR_ON : display::COLOR_OFF);
  }
  void rule(int y) { display_.horizontal_line(10, y, 140); }
  void selected(int y) { display_.filled_rectangle(8, y - 3, 144, 18); }
  void bar(int y, int percent) {
    display_.rectangle(10, y, 140, 5);
    display_.filled_rectangle(10, y, std::clamp(percent, 0, 100) * 140 / 100, 5);
  }
  void dots(int page) {
    for (int i = 0; i < 5; i++) {
      const int x = 60 + 9 * i;
      if (i == page) display_.filled_rectangle(x, 7, 6, 3);
      else display_.draw_pixel_at(x + 2, 8);
    }
  }
 private:
  display::Display &display_;
};
}  // namespace esphome::cgdn1_ui
