#pragma once

// A stock QProcess child can briefly inherit the open DRM descriptor before
// exec/exit. Waiting is not permission to use, close or signal that descriptor.
// Always obtain a NEW complete inventory, and retain the exact stock birth.
// Persistent unknown owners, incomplete reads, clock faults or changed stock
// still refuse the handoff. The fixed 750 ms / sixteen-read bound stays far below
// the existing guardian lease; no hardware action or launch is retried here.
#include <cstdint>
#include <string>

namespace cgs1_net_trial {
template<class Read, class Identity, class Clock, class Pause>
std::string settle_display_handoff(Read read, Identity current, Clock clock, Pause pause) {
  const uint64_t began=clock();
  if(!began)return "display_settle_clock_unavailable";
  // Sixteen reads paced at 50 ms can use the full 750 ms observation
  // window. Five fast reads used only ~80 ms of waiting and could reject a
  // naturally exiting child long before the deadline. A complete late read
  // still fails below; this never extends the permission deadline.
  for(unsigned attempt=0;attempt<16;++attempt) {
    const uint64_t now=clock();
    if(now<began || now-began>750)return "display_settle_deadline";
    if(!current())return "stock_changed_during_display_inspection";
    const auto objection=read();
    const uint64_t finished=clock();
    if(finished<now || finished-began>750)return "display_settle_deadline";
    // Revalidate the same GUI after the read as well: a clean inventory of a
    // replacement GUI does not authorize the original sealed plan.
    if(!current())return "stock_changed_during_display_inspection";
    if(objection!="unexpected_drm_owner_blocks_trial" || attempt==15)return objection;
    pause();
  }
  return "unexpected_drm_owner_blocks_trial";
}
}  // namespace cgs1_net_trial
