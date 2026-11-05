#pragma once

// Small API envelopes for the pinned ESPHome JsonBuilder. Its generic builder
// truncates oversized documents rather than returning an error. Never place
// the entire 8192-byte log (or arbitrary raw control bytes) in one response.
// Snapshot coordinates fence the client-side multi-page assembly; they grant
// no write/recovery authority and select no caller-supplied filesystem path.
#include "supervisor_full_diagnostics.h"
#include "supervisor_full_state_metadata.h"
#include <ArduinoJson.h>

namespace cgs1_supervisor {
inline void diagnostic_snapshot_json(const FullDiagnosticFile &file,JsonObject root) {
  root["bytes"]=file.bytes;root["inode"]=file.inode;root["device"]=file.device;
  root["mtime_seconds"]=file.mtime_seconds;root["mtime_nanoseconds"]=file.mtime_nanoseconds;
  root["ctime_seconds"]=file.ctime_seconds;root["ctime_nanoseconds"]=file.ctime_nanoseconds;
}
inline void diagnostic_metadata_json(const FullDiagnostics &snapshot,JsonObject root) {
  root["transport"]="hex_pages_v1";
  auto files=root["files"].to<JsonArray>();
  for(const auto &item:snapshot.files) {
    auto file=files.add<JsonObject>();file["name"]=item.name;file["present"]=item.present;
    file["truncated"]=item.truncated;file["error"]=item.error;
    file["tail_bytes"]=item.text.size();file["tail_offset"]=item.bytes-item.text.size();
    file["page_count"]=(item.text.size()+FullDiagnostics::PAGE_BYTES-1)/FullDiagnostics::PAGE_BYTES;
    diagnostic_snapshot_json(item,file["snapshot"].to<JsonObject>());
  }
}
inline void diagnostic_page_json(const FullDiagnostics &snapshot,const FullDiagnosticPage &page,JsonObject root) {
  root["transport"]="hex_pages_v1";root["file_index"]=page.file_index;
  root["page_index"]=page.page_index;root["page_count"]=page.page_count;
  root["tail_offset"]=page.tail_offset;root["hex_data"]=page.hex_data;
  diagnostic_snapshot_json(snapshot.files[page.file_index],root["snapshot"].to<JsonObject>());
}
inline void diagnostic_state_metadata_json(const FullStateMetadata &snapshot,JsonObject root) {
  auto files=root["own_state_metadata"].to<JsonArray>();
  for(const auto &item:snapshot.files) {
    auto file=files.add<JsonObject>();file["name"]=item.name;
    file["directory_present"]=item.directory_present;file["directory_private"]=item.directory_private;
    file["directory_errno"]=item.directory_errno;file["filesystem_type"]=item.filesystem_type;
    file["file_present"]=item.file_present;file["file_errno"]=item.file_errno;
    file["file_private_regular"]=item.file_private_regular;file["file_symlink"]=item.file_symlink;
    file["file_bytes"]=item.file_bytes;file["file_inode"]=item.file_inode;file["file_device"]=item.file_device;
    file["file_links"]=item.file_links;file["file_mode"]=item.file_mode;file["file_uid"]=item.file_uid;
  }
}
}  // namespace cgs1_supervisor
