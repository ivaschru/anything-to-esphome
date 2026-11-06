// Pure locale contract: no display, network or preferences are opened here.
#include "cgs1_ui_language.h"
#include <cassert>
#include <string>
#include <vector>
#include <cstdio>
// printf formats must preserve argument order/types after translation. A bad
// status/countdown translation could otherwise interpret the wrong varargs.
std::vector<std::string> formats(const char *text) {
  std::vector<std::string> out;
  for(const char *p=text;*p;++p)if(*p=='%') {
    const char *start=p++;
    if(*p=='%')continue;
    while(*p && !std::strchr("diuoxXfFeEgGcs",*p))++p;
    assert(*p);out.emplace_back(start,p-start+1);
  }
  return out;
}
int main() {
  using namespace cgs1_ui_language;
  bool english=false;
  assert(parse("English",english) && english);
  assert(!parse("english",english) && english);
  assert(!parse("",english) && english);
  assert(parse("Русский",english) && !english);
  for(size_t i=0;i<std::size(LABELS);++i) {
    const auto &label=LABELS[i];
    assert(std::strlen(label.ru) && std::strlen(label.en));
    assert(std::strcmp(text(false,label.ru),label.ru)==0);
    assert(std::strcmp(text(true,label.ru),label.en)==0);
    assert(formats(label.ru)==formats(label.en));
    for(size_t j=i+1;j<std::size(LABELS);++j)assert(std::strcmp(label.ru,LABELS[j].ru)!=0);
  }
  assert(std::strcmp(text(true,"Настройки"),"Settings")==0);
  assert(std::strcmp(text(true,"Ночной режим"),"Night mode")==0);
  assert(std::strcmp(text(true,"unknown-label"),"unknown-label")==0);
  // This function must not be applied to user input by the renderer; unknown
  // bytes are passed through, never interpreted as format/control tokens.
  assert(std::strcmp(text(true,"%s fixture SSID"),"%s fixture SSID")==0);
  char countdown[32];std::snprintf(countdown,sizeof countdown,text(true,"Осталось %u с"),42u);
  assert(std::string(countdown)=="42 s remaining");
}
