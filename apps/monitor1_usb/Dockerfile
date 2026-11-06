FROM ghcr.io/home-assistant/base:3.24

# Private builds run only after an explicit owner action, sequentially on one
# CPU. The pinned SDK is created inside that job; no Docker socket, extra VM,
# host networking, full-access mode or GPIO/UART access is required.
RUN apk add --no-cache python3 py3-pip android-tools git perl make
COPY rootfs/ /app/
CMD ["python3", "/app/server.py"]
