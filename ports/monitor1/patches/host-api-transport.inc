// Local host-only lifecycle extension; compiled out unless explicitly enabled.
// It does not change authentication, service registration or entity identity.
#ifdef USE_CGS1_TRANSPORT_GATE
#ifndef USE_HOST
#error "CGS1 transport handoff requires the host platform"
#endif
#ifdef USE_API_OUTGOING_CONNECTION
#error "CGS1 transport handoff does not support outgoing API connections"
#endif

bool APIServer::cgs1_open_listener_() {
  if (this->socket_ != nullptr)
    return false;
  auto listener = socket::socket_ip_loop_monitored(SOCK_STREAM, 0);
  if (listener == nullptr)
    return false;
  const int enable = 1;
  if (listener->setsockopt(SOL_SOCKET, SO_REUSEADDR, &enable, sizeof(enable)) != 0)
    ESP_LOGW(TAG, "CGS1 API reuseaddr: errno %d", errno);
  if (listener->setblocking(false) != 0)
    return false;
  struct sockaddr_storage address {};
  const socklen_t bytes = socket::set_sockaddr_any(reinterpret_cast<sockaddr *>(&address), sizeof(address), this->port_);
  if (!bytes || listener->bind(reinterpret_cast<sockaddr *>(&address), bytes) != 0 ||
      listener->listen(this->listen_backlog_) != 0) {
    ESP_LOGW(TAG, "CGS1 API reopen failed: errno %d", errno);
    return false;
  }
  this->socket_ = listener.release();
  return true;
}

bool APIServer::cgs1_pause_transport() {
  // Main-loop only, AFTER the API action callback returned. Removing a client
  // while executing that client's callback would invalidate its active stack.
  if (this->cgs1_transport_paused_)
    return true;
  if (this->shutting_down_ || this->is_failed())
    return false;
  this->cgs1_transport_paused_ = true;
  this->destroy_socket_();
  while (this->api_connection_count_) {
    this->clients_[0]->on_fatal_error();
    this->remove_client_(0);
  }
  return true;
}

bool APIServer::cgs1_resume_transport() {
  if (!this->cgs1_transport_paused_)
    return this->socket_ != nullptr;
  if (this->shutting_down_ || this->is_failed() || !this->cgs1_open_listener_())
    return false;
  // Do NOT call setup(): logger/provisioning callbacks and preferences must
  // remain registered exactly once. Keep the original PSK/context unchanged.
  this->last_connected_ = App.get_loop_component_start_time();
  this->cgs1_transport_paused_ = false;
  return true;
}
#endif  // USE_CGS1_TRANSPORT_GATE
