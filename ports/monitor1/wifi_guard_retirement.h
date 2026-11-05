#pragma once

// Ordering policy for a completed Wi-Fi transaction. This class has no file,
// socket, credential or device operations and is NOT production authority.
// The concrete adapter must bind every observation to the same sealed plan,
// full/native lease, expected live guardian births and canonical Store lock.
//
// Both guardians retain their rollback/commit snapshot before old ACK/binding
// files disappear. The sensitive journal is retired LAST. Only their later
// RETIRED acknowledgements permit native to begin another transaction. The
// committed private network record is NEVER deleted by this lifecycle.
namespace cgs1_wifi_retirement {
enum class Marker {MISSING,MATCH,CONFLICT,UNREADABLE};
enum class Files {ONE_BOUND_FILE,ALL_CLEAR,CONFLICT,UNREADABLE};
enum class Journal {EXACT_PRESENT,RETIRED,CONFLICT,UNREADABLE};
enum class Write {ACK,REFUSED,UNCERTAIN};
enum class Result {WAITING,COMPLETE,REFUSED,UNCERTAIN,CONSUMED};
enum class Phase {BEGIN,WAIT_RETIRING,PRUNE,JOURNAL_LAST,WAIT_RETIRED,DONE,FAILED};

template<class Backend>class Retirement {
 public:
  explicit Retirement(Backend&backend):backend_(backend){}
  Result step() {
    if(phase_==Phase::DONE)return Result::COMPLETE;
    if(phase_==Phase::FAILED)return Result::CONSUMED;
    // This includes the independent retirement deadline; waiting for ACKs
    // cannot extend either the full/native lease or this operation's budget.
    if(!backend_.scope_alive())return fail_(Result::REFUSED);
    if(phase_==Phase::BEGIN) {
      const auto marker=backend_.marker();
      if(marker==Marker::CONFLICT || marker==Marker::UNREADABLE)return fail_(Result::REFUSED);
      if(marker==Marker::MISSING) {
        if(backend_.journal()!=Journal::EXACT_PRESENT || backend_.next_old_file()!=Files::ONE_BOUND_FILE)
          return fail_(Result::REFUSED);
        if(!backend_.both_committed() || !write_guard_())return fail_(Result::REFUSED);
        const auto result=written_(backend_.publish_intent());
        if(result!=Result::WAITING)return result;
      }
      // An existing intent is accepted only after the adapter independently
      // verifies its exact bound snapshot. It is never a success boolean.
      if(backend_.marker()!=Marker::MATCH)return fail_(Result::REFUSED);
      phase_=Phase::WAIT_RETIRING;return Result::WAITING;
    }
    if(backend_.marker()!=Marker::MATCH)return fail_(Result::REFUSED);
    if(phase_==Phase::WAIT_RETIRING) {
      if(!backend_.both_retiring())return Result::WAITING;
      phase_=Phase::PRUNE;return Result::WAITING;
    }
    if(phase_==Phase::PRUNE) {
      // The adapter exposes only one of a fixed finite set of OLD ACK/binding
      // inodes. It must reject replacement/foreign files instead of guessing.
      const auto files=backend_.next_old_file();
      if(files==Files::CONFLICT || files==Files::UNREADABLE)return fail_(Result::REFUSED);
      if(files==Files::ALL_CLEAR){phase_=Phase::JOURNAL_LAST;return Result::WAITING;}
      if(backend_.journal()!=Journal::EXACT_PRESENT)return fail_(Result::REFUSED);
      if(++prune_attempts_>7 || !backend_.both_retiring() || !write_guard_())return fail_(Result::REFUSED);
      return written_(backend_.prune_one_bound_file());
    }
    if(phase_==Phase::JOURNAL_LAST) {
      if(backend_.next_old_file()!=Files::ALL_CLEAR || !backend_.both_retiring())return fail_(Result::REFUSED);
      const auto journal=backend_.journal();
      if(journal==Journal::CONFLICT || journal==Journal::UNREADABLE)return fail_(Result::REFUSED);
      if(journal==Journal::EXACT_PRESENT) {
        if(!write_guard_())return fail_(Result::REFUSED);
        const auto result=written_(backend_.retire_exact_journal());
        if(result!=Result::WAITING)return result;
      }
      if(backend_.journal()!=Journal::RETIRED)return fail_(Result::REFUSED);
      phase_=Phase::WAIT_RETIRED;return Result::WAITING;
    }
    if(phase_==Phase::WAIT_RETIRED) {
      if(backend_.next_old_file()!=Files::ALL_CLEAR || backend_.journal()!=Journal::RETIRED)return fail_(Result::REFUSED);
      if(!backend_.both_retired())return Result::WAITING;
      // The source policy is done. Real admission of the next transaction
      // still requires its own fresh Store baseline/dual ARMED/BOUND checks.
      if(!write_guard_())return fail_(Result::REFUSED);
      phase_=Phase::DONE;return Result::COMPLETE;
    }
    return fail_(Result::REFUSED);
  }
  Phase phase()const{return phase_;}
  // Preserve the phase that refused a step. FAILED alone loses the useful
  // distinction between intent publication, pruning and final acknowledgments.
  // This is observation only; it neither retries nor changes any write gate.
  Phase failed_from()const{return failed_from_;}
 private:
  Backend&backend_;Phase phase_{Phase::BEGIN},failed_from_{Phase::BEGIN};unsigned prune_attempts_{0};
  bool write_guard_(){return backend_.scope_alive() && backend_.exact_committed_decision_locked();}
  Result fail_(Result result){failed_from_=phase_;phase_=Phase::FAILED;return result;}
  Result written_(Write result) {
    if(result==Write::ACK)return Result::WAITING;
    // A lost local write ACK consumes this actor. A new actor must inspect
    // actual bound inodes; this state machine never blindly repeats a write.
    return fail_(result==Write::UNCERTAIN?Result::UNCERTAIN:Result::REFUSED);
  }
};
} // namespace cgs1_wifi_retirement
