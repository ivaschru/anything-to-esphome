// Optional CGS1 PM control extension, loaded only into the verified SnowApp.
// All vendor QObject/property access happens in its GUI thread, through posted
// events. No GPIO/PWM writes, UART readers, calibration or screen replacement.
// The local socket is private to root inside a 0700 directory; ESPHome exposes
// the user-facing control through its authenticated encrypted native API.
#include <QtCore/QCoreApplication>
#include <QtCore/QEvent>
#include <QtCore/QMetaProperty>
#include <QtCore/QObject>
#include <QtCore/QSharedPointer>
#include <QtCore/QVariant>
#include <dlfcn.h>
#include <pthread.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/un.h>
#include <unistd.h>
#include <cerrno>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <ctime>

namespace {
#ifdef CGS1_PM_BRIDGE_TEST
const char *const SOCKET_PATH = "/tmp/qingping-qt-bridge-test/control.sock";
#else
const char *const SOCKET_PATH = "/data/.esphome-cgs1/pm-control.sock";
#endif

struct Request {
  pthread_mutex_t mutex;
  pthread_cond_t condition;
  int references{2};  // socket worker + Qt-owned event; timeout cannot free early
  int desired{-1};    // -1 reads, 0 disables, 1 enables; nothing else is accepted
  bool done{false}, cancelled{false}, okay{false}, enabled{false};
  explicit Request(int value) : desired(value) {
    pthread_mutex_init(&mutex, nullptr);
    pthread_condattr_t attributes;
    pthread_condattr_init(&attributes);
    pthread_condattr_setclock(&attributes, CLOCK_MONOTONIC);
    pthread_cond_init(&condition, &attributes);
    pthread_condattr_destroy(&attributes);
  }
  ~Request() { pthread_cond_destroy(&condition); pthread_mutex_destroy(&mutex); }
};
void release(Request *request) {
  if (__sync_sub_and_fetch(&request->references, 1) == 0) delete request;
}

class RequestEvent : public QEvent {
 public:
  Request *request;
  RequestEvent(QEvent::Type type, Request *value) : QEvent(type), request(value) {}
  ~RequestEvent() override { release(request); }
};

class MainThreadBridge : public QObject {
 public:
  QEvent::Type request_type;
  explicit MainThreadBridge(QEvent::Type type) : request_type(type) {}
 protected:
  bool event(QEvent *event) override {
    if (event->type() != request_type) return QObject::event(event);
    Request *request = static_cast<RequestEvent *>(event)->request;
    pthread_mutex_lock(&request->mutex);
    // A timed-out operation must not mutate the PM state later. The same lock
    // covers application and acknowledgement so timeout has a defined outcome.
    if (!request->cancelled) apply(request);
    request->done = true;
    pthread_cond_signal(&request->condition);
    pthread_mutex_unlock(&request->mutex);
    return true;
  }
 private:
  static void apply(Request *request) {
#ifdef CGS1_PM_BRIDGE_TEST
    // The isolated QtCore test uses the existing objectName meta-property.
    // It exercises cross-thread dispatch/write/readback without vendor code.
    auto **holder = static_cast<QObject **>(dlsym(RTLD_DEFAULT, "cgs1_test_target"));
    QObject *target = holder ? *holder : nullptr;
    const char *property_name = "objectName";
    const char *expected_class = "QObject";
#else
    // Exported singleton symbol is present in the exact backed-up SnowApp.
    // QSharedPointer layout comes from matching Qt 5.9.4 headers, not offsets
    // guessed from the MCU or another Qingping model/revision.
    auto *holder = static_cast<QSharedPointer<QObject> *>(
        dlsym(RTLD_DEFAULT, "_ZN17AirDataController10m_instanceE"));
    QObject *target = holder ? holder->data() : nullptr;
    const char *property_name = "isPM25Enabled";
    const char *expected_class = "AirDataController";
#endif
    if (!target || std::strcmp(target->metaObject()->className(), expected_class) != 0) return;
    const int index = target->metaObject()->indexOfProperty(property_name);
    if (index < 0) return;
    const QMetaProperty property = target->metaObject()->property(index);
    if (!property.isReadable() || !property.isWritable()) return;
#ifndef CGS1_PM_BRIDGE_TEST
    if (property.type() != QVariant::Bool) return;
#endif
    if (request->desired >= 0) {
#ifdef CGS1_PM_BRIDGE_TEST
      const QVariant wanted(QString(request->desired ? "ON" : "OFF"));
#else
      const QVariant wanted(request->desired == 1);
#endif
      if (!property.write(target, wanted)) return;
    }
    const QVariant current = property.read(target);
    if (!current.isValid()) return;
#ifdef CGS1_PM_BRIDGE_TEST
    request->enabled = current.toString() == QString("ON");
#else
    request->enabled = current.toBool();
#endif
    request->okay = request->desired < 0 || request->enabled == (request->desired == 1);
  }
};

bool prepare_socket_path(int server, const sockaddr_un &address) {
  struct stat metadata{};
  if (::lstat(SOCKET_PATH, &metadata) == 0) {
    if (!S_ISSOCK(metadata.st_mode) || metadata.st_uid != 0) return false;
    // Do not displace another live helper. Only a stale root-owned socket at
    // this exact private pathname can be removed after a process restart.
    int probe = ::socket(AF_UNIX, SOCK_STREAM, 0);
    if (probe < 0) return false;
    int connected = ::connect(probe, reinterpret_cast<const sockaddr *>(&address), sizeof(address));
    const int error = errno;
    ::close(probe);
    if (connected == 0 || error != ECONNREFUSED) return false;
    if (::unlink(SOCKET_PATH) != 0) return false;
  } else if (errno != ENOENT) return false;
  if (::bind(server, reinterpret_cast<const sockaddr *>(&address), sizeof(address)) != 0) return false;
  if (::chmod(SOCKET_PATH, 0600) != 0 || ::listen(server, 2) != 0) return false;
  return true;
}

void *serve(void *) {
  // Constructor returns immediately. App startup is never held waiting for an
  // event loop, a socket, ESPHome, Wi-Fi or Home Assistant.
  for (int attempt = 0; attempt < 120; ++attempt) {
    if (QCoreApplication::instance() && !QCoreApplication::startingUp()) break;
    ::usleep(500000);
  }
  if (!QCoreApplication::instance() || QCoreApplication::startingUp()) return nullptr;
  const int event_number = QEvent::registerEventType();
  if (event_number < 0) return nullptr;
  auto *bridge = new MainThreadBridge(static_cast<QEvent::Type>(event_number));
  // Created in this worker, parentless, then moved from its current owning
  // thread to the app thread. Qt owns each event once postEvent is called.
  bridge->moveToThread(QCoreApplication::instance()->thread());
  const int server = ::socket(AF_UNIX, SOCK_STREAM | SOCK_CLOEXEC, 0);
  if (server < 0) { bridge->deleteLater(); return nullptr; }
  sockaddr_un address{};
  address.sun_family = AF_UNIX;
  std::strncpy(address.sun_path, SOCKET_PATH, sizeof(address.sun_path) - 1);
  if (!prepare_socket_path(server, address)) {
    ::close(server); bridge->deleteLater(); return nullptr;
  }
  for (;;) {
    const int client = ::accept4(server, nullptr, nullptr, SOCK_CLOEXEC);
    if (client < 0) { if (errno == EINTR) continue; break; }
    struct ucred peer{};
    socklen_t peer_size = sizeof(peer);
    timeval timeout{1, 0};
    ::setsockopt(client, SOL_SOCKET, SO_RCVTIMEO, &timeout, sizeof(timeout));
    ::setsockopt(client, SOL_SOCKET, SO_SNDTIMEO, &timeout, sizeof(timeout));
    bool authorized = ::getsockopt(client, SOL_SOCKET, SO_PEERCRED, &peer, &peer_size) == 0 && peer.uid == 0;
    char command[9]{};
    size_t used = 0;
    if (authorized) {
      while (used < sizeof(command) - 1 && (used == 0 || command[used - 1] != '\n')) {
        ssize_t n = ::recv(client, command + used, 1, 0);
        if (n != 1) break;
        used += n;
      }
    }
    int desired = -2;
    if (std::strcmp(command, "GET\n") == 0) desired = -1;
    if (std::strcmp(command, "OFF\n") == 0) desired = 0;
    if (std::strcmp(command, "ON\n") == 0) desired = 1;
    const char *reply = "ERR\n";
    if (authorized && desired >= -1) {
      auto *request = new Request(desired);
      pthread_mutex_lock(&request->mutex);
      QCoreApplication::postEvent(bridge, new RequestEvent(bridge->request_type, request));
      timespec deadline{};
      ::clock_gettime(CLOCK_MONOTONIC, &deadline);
      deadline.tv_sec += 3;
      while (!request->done) {
        if (pthread_cond_timedwait(&request->condition, &request->mutex, &deadline) == ETIMEDOUT) break;
      }
      if (!request->done) request->cancelled = true;
      else if (request->okay) reply = request->enabled ? "OK 1\n" : "OK 0\n";
      pthread_mutex_unlock(&request->mutex);
      release(request);
    }
    ::send(client, reply, std::strlen(reply), MSG_NOSIGNAL);
    ::close(client);
  }
  ::close(server);
  bridge->deleteLater();
  return nullptr;
}

__attribute__((constructor)) void initialize() {
  const char *enabled = std::getenv("CGS1_PM_BRIDGE");
  if (!enabled || std::strcmp(enabled, "1") != 0) return;
  // Prevent SnowApp's later QProcess/shell children inheriting this preload.
  // The wrapper sets these variables only for the selected application child.
  ::unsetenv("CGS1_PM_BRIDGE");
  ::unsetenv("LD_PRELOAD");
  char executable[256]{};
  const ssize_t length = ::readlink("/proc/self/exe", executable, sizeof(executable) - 1);
  if (length <= 0) return;
#ifdef CGS1_PM_BRIDGE_TEST
  if (std::strcmp(executable, "/tmp/qingping-qt-bridge-test/pm_qt_mock") != 0) return;
#else
  if (std::strcmp(executable, "/data/bin/SnowApp") != 0) return;
#endif
  pthread_t thread;
  if (pthread_create(&thread, nullptr, serve, nullptr) == 0) pthread_detach(thread);
}
}  // namespace
