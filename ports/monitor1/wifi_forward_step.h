#pragma once
namespace cgs1_wifi_forward {
// Claims live on the transaction authority, not merely a temporary button or
// helper object. Recreating a helper cannot replay a consumed network action.
enum class Step : unsigned {SELECT,REFRESH,RESTORE,COMMIT};
}
