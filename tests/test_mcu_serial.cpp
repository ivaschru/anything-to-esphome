#include "../ports/lite-mcu4x/components/cgdn1_mcu/serial_transport.h"

#include <cassert>
#include <iostream>
#include <string>
#include <vector>

using namespace qingping::mcu4x;

std::vector<SerialEvent> send(SerialReceiver &receiver, const std::string &bytes) {
  std::vector<SerialEvent> events;
  for (const unsigned char byte : bytes) {
    const auto event = receiver.feed(byte);
    if (event != SerialEvent::NONE) events.push_back(event);
  }
  return events;
}

int main() {
  // Independent known-answer CG/CO2 fixture, not bytes from a private device.
  const std::string frame = "hex_string 434731070008040020030000f100";
  SerialReceiver receiver;
  assert(send(receiver, frame.substr(0, 9)).empty());
  assert(receiver.has_partial_line());
  assert(send(receiver, frame.substr(9) + "\r\n") == std::vector{SerialEvent::FRAME});
  assert(!receiver.has_partial_line());
  assert(receiver.frame().count == 1 && receiver.frame().command == 0x31);
  assert(receiver.frame().bytes[receiver.frame().tlvs[0].offset] == 0x20);

  assert(send(receiver, "get_down\rok\r\n\n") ==
         (std::vector{SerialEvent::POLL, SerialEvent::OK}));
  assert(receiver.frame().length == 0);
  // An unrelated line or acknowledgement is never an implicit sensor update.
  assert(send(receiver, "result \"ready\"\r") == std::vector{SerialEvent::UNKNOWN});
  assert(send(receiver, "hex_string 434731070008040020030000f101\n") ==
         std::vector{SerialEvent::INVALID});
  assert(receiver.frame_error() == Error::CHECKSUM && receiver.frame().length == 0);

  // Framing must be independent of UART read chunk size. Every possible split
  // of a legal packet still produces exactly one frame after the delimiter.
  for (size_t split = 0; split <= frame.size(); ++split) {
    SerialReceiver fresh;
    assert(send(fresh, frame.substr(0, split)).empty());
    assert(send(fresh, frame.substr(split) + "\r") == std::vector{SerialEvent::FRAME});
  }

  // Once the line is invalid, even a valid-looking suffix remains discarded.
  // Only the following complete line can be admitted; this covers UART noise,
  // embedded NUL and overflow without copying private packets into a log.
  SerialReceiver damaged;
  assert(send(damaged, std::string("bad\0", 4)) == std::vector{SerialEvent::INVALID});
  assert(send(damaged, frame + "\r").empty());
  assert(send(damaged, frame + "\r") == std::vector{SerialEvent::FRAME});
  assert(send(damaged, std::string(SerialReceiver::MAX_LINE + 100, 'a')) ==
         std::vector{SerialEvent::LINE_TOO_LONG});
  assert(send(damaged, frame + "\r").empty());
  assert(send(damaged, "get_down\r") == std::vector{SerialEvent::POLL});

  SerialReceiver timed_out;
  send(timed_out, frame.substr(0, 15));
  timed_out.abandon_partial_line();
  assert(send(timed_out, frame + "\r").empty());
  assert(send(timed_out, frame + "\r") == std::vector{SerialEvent::FRAME});
  // Empty timeouts must not poison the first actual packet after idle.
  timed_out.abandon_partial_line();
  assert(send(timed_out, frame + "\n") == std::vector{SerialEvent::FRAME});
  std::cout << "MCU serial chunking, framing, bounds and noise recovery passed\n";
}
