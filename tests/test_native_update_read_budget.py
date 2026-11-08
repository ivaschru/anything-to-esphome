"""Exercise IDF timeout continuation with real stream bytes and bounded clocks."""
import subprocess
import unittest
from test_native_update_stream import NativeStreamTests,CPP,values,canonical,ROOT

class ReadBudgetTests(NativeStreamTests):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        # Exercise the production budget in the actual verified C++ personalizer.
        # EAGAIN receives no bytes, so it must not advance/rewind either digest.
        source=cls.folder/'stream.cpp'
        code=CPP.replace('#include "verified_stream.h"','#include "verified_stream.h"\n#include "read_budget.h"\n#include <cassert>')
        code=code.replace('  for(size_t i=0;i<bytes.size();i+=chunk)', '''  ReadWaitBudget budget(0);
  assert(!budget.can_wait(-1,1));
  assert(budget.can_wait(-0x7007,15000));
  assert(budget.can_wait(-0x7007,30000));
  assert(!budget.can_wait(-0x7007,30001));
  budget.data(30002);
  assert(budget.can_wait(-0x7007,30003));
  assert(!budget.can_wait(-0x7007,75002));
  budget.data(299999);assert(!budget.can_wait(-0x7007,300000));
  ReadWaitBudget wrap(0xfffffff0);assert(wrap.can_wait(-0x7007,4));
  assert(!wrap.can_wait(-0x7007,uint32_t(0xfffffff0u+45000u)));
  for(size_t i=0;i<bytes.size();i+=chunk)''')
        source.write_text(code)
        import shlex
        flags=shlex.split(subprocess.check_output(['pkg-config','--cflags','--libs','openssl'],text=True))
        subprocess.run(['c++','-std=c++17','-Wall','-Wextra','-Werror','-fsanitize=address,undefined','-fno-omit-frame-pointer','-I'+str(ROOT/'ports/lite/components/qf_native_update'),str(source),*flags,'-o',str(cls.exe)],check=True,capture_output=True)

if __name__=='__main__':unittest.main()
