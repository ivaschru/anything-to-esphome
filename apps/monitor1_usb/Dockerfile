FROM ghcr.io/home-assistant/base:3.24

# This image is a read-only USB probe, not a firmware builder. No ESPHome SDK,
# host networking, full-access mode, GPIO/UART or privileged capabilities.
RUN apk add --no-cache python3 android-tools
COPY rootfs/ /app/
CMD ["python3", "/app/server.py"]
