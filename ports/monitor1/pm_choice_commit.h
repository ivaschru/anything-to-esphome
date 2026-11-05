#pragma once

namespace cgs1_pm {
// Transaction ordering at the controller/storage boundary. The caller first
// acknowledges the guarded hardware transition and its RAM journal, then
// commits the user's durable desire. A failure in either step returns false;
// FullPmRuntime immediately ends the session so the independent guardian owns
// recovery. This helper never retries, publishes a state or rolls hardware back.
class ChoiceCommit {
 public:
  bool attach(bool (*writer)(bool)) {
    if(!writer || writer_)return false;
    writer_=writer;return true;
  }
  template<class Apply> bool change(bool enabled,Apply apply) const {
    if(!apply(enabled))return false;
    return !writer_ || writer_(enabled);
  }
 private:
  bool (*writer_)(bool){nullptr};
};
}  // namespace cgs1_pm
