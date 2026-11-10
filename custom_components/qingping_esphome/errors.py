"""Stable public error codes; private exception details never enter the panel.

The browser localizes codes in place when its language changes. English is
also provided for older clients and for tools that do not use the panel.
"""
MESSAGES = {
    "firmware_update_busy": "A firmware operation is already running. Wait for it to finish.",
    "ha_bluetooth_unavailable": "Home Assistant has no connectable Bluetooth adapter or proxy. Configure one, or use this device's Bluetooth.",
    "ha_bluetooth_not_found": "Home Assistant cannot reach this monitor. Enable pairing mode near an adapter or active proxy and search again.",
    "ha_bluetooth_busy": "Bluetooth discovery or this monitor is already in use. Wait for the current operation to finish.",
    "ha_bluetooth_failed": "Home Assistant Bluetooth setup did not finish. Check the session and monitor before starting a new setup.",
    "ha_bluetooth_selection_expired": "The Home Assistant Bluetooth selection expired or belongs to another user. Select the monitor again.",
    "ha_bluetooth_setup_started": "Bluetooth setup has already started for this session. Check its status; it has not been repeated.",
    "ha_bluetooth_setup_incomplete": "Home Assistant has not confirmed Bluetooth setup. Check the session before continuing.",
    "selected_changed": "The selected monitor changed.",
    "ble_packet_length": "The settings do not fit in the stock Bluetooth packet.",
    "ble_rejected": "The monitor rejected setup. No new firmware was sent; check pairing mode.",
    "ble_ack_timeout": "Setup was not acknowledged. Check the session before retrying.",
    "operation_failed": "The operation did not finish. Check the session before retrying.",
    "unauthorized": "Home Assistant administrator access is required.",
    "not_loaded": "The integration is not running.",
    "invalid_request": "The request could not be accepted. Check the installation session.",
    "already_sent": "The firmware command was already sent. Check its result before continuing.",
    "session_missing": "The session expired or belongs to another user.",
    "hardware_unverified": "This hardware revision has not been verified.",
    "usb_required": "Connect the monitor to USB power.",
    "wifi_length": "The SSID must be 1–32 bytes and the password at most 63 bytes.",
    "wifi_characters": "Quotes, backslashes and line breaks are not supported by stock Bluetooth setup.",
    "template_missing": "The firmware template is missing. Install the complete release ZIP.",
    "template_invalid": "Firmware validation failed. Install the complete, matching release ZIP.",
    "invalid_mac": "The monitor MAC address is invalid.",
    "too_many_sessions": "Several installations are already open. Finish or close a session first.",
    "session_exists": "This monitor already has a session. Check its result first.",
    "url_too_long": "The firmware URL exceeds the stock firmware limit.",
    "outcome_unknown": "The command result is unknown. Do not retry installation automatically.",
    "stock_changed": "The stock firmware version changed.",
    "mac_changed": "A different monitor MAC address replied.",
    "stock_ota_error": "The stock OTA reported an error. Check the monitor before retrying.",
    "ota_timeout": "No final OTA response. Check the monitor; the command has not been resent.",
    "native_unconfirmed": "ESPHome has not confirmed the result. The firmware has not been resent.",
    "profile_unavailable": "The installer for this hardware profile is not ready.",
    "identity_unsupported": "This model or stock firmware has not been verified. Settings have not changed.",
    "profile_mcu421": "Lite 4.2.1 uses a separate MCU. A raw UART receiver is built, but startup, measurement scales, power and display are not qualified. No installation image is available. Settings have not changed.",
}


class InstallerError(ValueError):
    """A translatable message, never a container for request data or secrets."""

    def __init__(self, code):
        self.code = code if code in MESSAGES else "operation_failed"
        super().__init__(MESSAGES[self.code])
