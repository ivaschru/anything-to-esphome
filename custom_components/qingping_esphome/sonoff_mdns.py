"""One bounded directed mDNS request for the optional manual-address fallback.

This is not a subnet/port sweep. It sends only the fixed eWeLink PTR question
to the exact RFC1918 address selected by an administrator. Every response is
bounded, checked as a DNS response and decoded without following pointer loops.
An address/ID is still just discovery: account ownership + AES preflight follow.
"""
import asyncio
import socket
import struct

from .sonoff_policy import SonoffError, lan_address

QUESTION = (b"\x00\x00\x00\x00\x00\x01\x00\x00\x00\x00\x00\x00"
            b"\x08_ewelink\x04_tcp\x05local\x00\x00\x0c\x80\x01")


def name_at(data, offset, visited=None):
    visited = set() if visited is None else set(visited)
    if offset in visited or len(visited) >= 16:
        raise ValueError("DNS pointer loop")
    visited.add(offset)
    parts, end = [], None
    for _ in range(64):
        if offset >= len(data):
            raise ValueError("Truncated DNS name")
        length = data[offset]
        if length == 0:
            return ".".join(parts), end or offset + 1
        if length & 0xC0 == 0xC0:
            if offset + 1 >= len(data):
                raise ValueError("Truncated DNS pointer")
            other = ((length & 0x3F) << 8) | data[offset + 1]
            suffix, _ = name_at(data, other, visited)
            parts.append(suffix)
            return ".".join(parts), offset + 2
        if length > 63 or offset + 1 + length > len(data):
            raise ValueError("Invalid DNS label")
        parts.append(data[offset + 1:offset + 1 + length].decode("ascii"))
        offset += 1 + length
    raise ValueError("DNS name too long")


def txt_response(data):
    if not 12 <= len(data) <= 16384:
        raise ValueError("Invalid DNS packet size")
    _, flags, questions, answers, authorities, additional = struct.unpack_from("!6H", data)
    if not flags & 0x8000 or questions > 16 or answers + authorities + additional > 128:
        raise ValueError("Not a bounded DNS response")
    cursor, result = 12, []
    for _ in range(questions):
        _, cursor = name_at(data, cursor)
        cursor += 4
    for _ in range(answers + authorities + additional):
        name, cursor = name_at(data, cursor)
        if cursor + 10 > len(data):
            raise ValueError("Truncated DNS record")
        kind, _, _, length = struct.unpack_from("!HHIH", data, cursor)
        cursor += 10
        end = cursor + length
        if end > len(data):
            raise ValueError("Truncated DNS data")
        if kind == 16 and name.lower().endswith("._ewelink._tcp.local"):
            fields, at = {}, cursor
            while at < end:
                size = data[at]
                at += 1
                if at + size > end:
                    raise ValueError("Truncated TXT field")
                text = data[at:at + size].decode("ascii")
                key, equals, value = text.partition("=")
                if equals:
                    if key in fields:
                        raise ValueError("Duplicate TXT field")
                    fields[key] = value
                at += size
            if len(fields.get("id", "")) == 10:
                result.append(fields)
        cursor = end
    return result


async def probe_target(host, device_id, *, timeout=6):
    host = lan_address(host)
    loop = asyncio.get_running_loop()
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setblocking(False)
    sock.bind(("0.0.0.0", 0))
    try:
        deadline = loop.time() + timeout
        for _ in range(3):
            await loop.sock_sendto(sock, QUESTION, (host, 5353))
            until = min(deadline, loop.time() + 2)
            while loop.time() < until:
                try:
                    async with asyncio.timeout(until - loop.time()):
                        packet, peer = await loop.sock_recvfrom(sock, 16385)
                except TimeoutError:
                    break
                if peer[0] != host:
                    continue
                try:
                    for fields in txt_response(packet):
                        if fields["id"] == device_id:
                            return {"host": host, "fields": fields}
                except (ValueError, UnicodeError, struct.error):
                    continue
    finally:
        sock.close()
    raise SonoffError("sonoff_unavailable")
