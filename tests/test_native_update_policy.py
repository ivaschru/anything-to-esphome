"""Execute the production lost-attempt and downgrade policies without hardware."""
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]

class NativePolicyTests(unittest.TestCase):
    def test_recovery_and_version_order(self):
        code=r'''
#include "journal.h"
#include <cassert>
using namespace esphome::qf_native_update;
int main() {
  Journal r; r.sequence=7;r.target=5;r.profile=2;r.phase=1;
  assert(review_journal(r,sizeof(r),2,4)==Recovery::BLOCKED); // lost old boot
  assert(review_journal(r,sizeof(r),2,5)==Recovery::TARGET_BOOTED);
  assert(review_journal(r,sizeof(r),2,6)==Recovery::BLOCKED); // unrelated image
  assert(review_journal(r,sizeof(r)-1,2,5)==Recovery::BLOCKED);
  assert(review_journal(r,sizeof(r),1,5)==Recovery::BLOCKED);
  r.phase=2;assert(review_journal(r,sizeof(r),2,4)==Recovery::READY); // known abort
  r.phase=3;assert(review_journal(r,sizeof(r),2,4)==Recovery::BLOCKED); // downgrade
  assert(review_journal(r,sizeof(r),2,5)==Recovery::READY);
  r.phase=0;assert(review_journal(r,sizeof(r),2,5)==Recovery::BLOCKED);
  r.phase=3;r.sequence=0;assert(review_journal(r,sizeof(r),2,5)==Recovery::BLOCKED);
  r.sequence=7;r.magic=0;assert(review_journal(r,sizeof(r),2,5)==Recovery::BLOCKED);
  assert(newer_release(5,2,4,1));
  assert(!newer_release(4,2,4,1));assert(!newer_release(5,1,4,1));
  assert(!newer_release(1000001,2,4,1));assert(!newer_release(5,1000001,4,1));
}
'''
        with tempfile.TemporaryDirectory() as d:
            source=Path(d)/'test.cpp';source.write_text(code);exe=Path(d)/'test'
            subprocess.run(['c++','-std=c++17','-Wall','-Wextra','-Werror','-fsanitize=address,undefined',
                            '-I'+str(ROOT/'ports/lite/components/qf_native_update'),str(source),'-o',str(exe)],check=True,capture_output=True)
            subprocess.run([str(exe)],check=True,capture_output=True)

if __name__=='__main__':unittest.main()
