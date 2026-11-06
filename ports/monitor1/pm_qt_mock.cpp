// Isolated QtCore event-loop fixture. No display, network, sensors or vendor
// process interaction; the optional helper can be exercised against objectName.
#include <QtCore/QCoreApplication>
#include <QtCore/QObject>
#include <QtCore/QTimer>
#include <cstring>
#include <unistd.h>
extern "C" { QObject *cgs1_test_target = nullptr; }
int main(int argc, char **argv) {
  QCoreApplication application(argc, argv);
  QObject target;
  target.setObjectName("ON");
  cgs1_test_target = &target;
  if (argc > 1 && std::strcmp(argv[1], "--blocked-gui-test") == 0) {
    // Deliberately stall only this fixture's loop. The helper worker continues
    // serving and must cancel a queued mutation when its three seconds expire.
    QTimer::singleShot(1500, []() { ::sleep(5); });
  }
  return application.exec();
}
