// Idle-only host listener handoff. Transfer/authentication/backend code is
// unchanged; an in-progress handshake or upload must finish before pause.
#ifdef USE_CGS1_TRANSPORT_GATE
#ifndef USE_HOST
#error "CGS1 transport handoff requires the host platform"
#endif

bool ESPHomeOTAComponent::cgs1_open_listener_() {
  if (this->server_ != nullptr)
    return false;
  auto listener = socket::socket_ip_loop_monitored(SOCK_STREAM, 0);
  if (listener == nullptr)
    return false;
  const int enable = 1;
  if (listener->setsockopt(SOL_SOCKET, SO_REUSEADDR, &enable, sizeof(enable)) != 0)
    this->log_socket_error_(LOG_STR("CGS1 reuseaddr"));
  if (listener->setblocking(false) != 0)
    return false;
  struct sockaddr_storage address {};
  const socklen_t bytes = socket::set_sockaddr_any(reinterpret_cast<sockaddr *>(&address), sizeof(address), this->port_);
  if (!bytes || listener->bind(reinterpret_cast<sockaddr *>(&address), bytes) != 0 || listener->listen(1) != 0) {
    this->log_socket_error_(LOG_STR("CGS1 reopen"));
    return false;
  }
  this->server_ = listener.release();
  return true;
}

bool ESPHomeOTAComponent::cgs1_pause_transport() {
  if (this->cgs1_transport_paused_)
    return true;
  if (this->is_failed() || this->client_ != nullptr || this->backend_ != nullptr || this->ota_state_ != OTAState::IDLE)
    return false;
  this->cgs1_transport_paused_ = true;
  delete this->server_;
  this->server_ = nullptr;
  return true;
}

bool ESPHomeOTAComponent::cgs1_resume_transport() {
  if (!this->cgs1_transport_paused_)
    return this->server_ != nullptr;
  if (this->is_failed() || !this->cgs1_open_listener_())
    return false;
  // A failed bind leaves this component paused/retryable, never mark_failed.
  this->cgs1_transport_paused_ = false;
  this->enable_loop();
  return true;
}
#endif  // USE_CGS1_TRANSPORT_GATE
