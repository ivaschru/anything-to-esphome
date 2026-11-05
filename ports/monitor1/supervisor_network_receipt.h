#pragma once

// Narrow type boundary for the generic PM/display effects adapter. It cannot
// accept a caller boolean or a fixture callback as network recovery evidence.
// Only the final concrete production receipt can construct this base type;
// only the actual recovery helper can construct that concrete receipt.
namespace cgs1_net_trial {struct StockInspection;}
namespace cgs1_supervisor {
class RunnerWifiRecoveryReceipt;
class NetworkRecoveryReceipt {
 public:
  virtual ~NetworkRecoveryReceipt()=default;
  virtual bool verify_for(int runtime,const cgs1_net_trial::StockInspection&stock)const=0;
  NetworkRecoveryReceipt(const NetworkRecoveryReceipt&)=delete;
  NetworkRecoveryReceipt&operator=(const NetworkRecoveryReceipt&)=delete;
 private:
  NetworkRecoveryReceipt()=default;
  friend class RunnerWifiRecoveryReceipt;
};
} // namespace cgs1_supervisor
