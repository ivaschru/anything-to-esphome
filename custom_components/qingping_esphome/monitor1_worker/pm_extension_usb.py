"""Fixed SDK next-boot PM adapter; caller must consume its bound intent first.

Not connected to HTTP/CLI yet. The original bridge observer independently
checks native USB, original install/arm receipts, exact processes and fresh
Noise readings, and closes its client/owned forward before any flag write.
"""
import re
import time
from pm_extension_guard import command, completion_check


def checked_proof(value, nonce, boot):
    fields = {'state', 'nonce', 'boot_id', 'device_request_sent', 'arming_acknowledged', 'completion_observed',
              'api_disconnect', 'forward_cleanup', 'installed', 'installation_ready', 'replay_allowed'}
    if (not isinstance(nonce, str) or not re.fullmatch(r'[a-f0-9]{32}', nonce) or nonce == '0' * 32 or
            not isinstance(value, dict) or set(value) != fields or value['nonce'] != nonce or value['boot_id'] != boot or
            value['state'] not in ('pm_extension_unverified', 'pm_extension_armed_waiting_reboot') or
            (boot is not None and (not isinstance(boot, str) or not re.fullmatch(r'[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}', boot))) or
            any(type(value[k]) is not bool for k in ('device_request_sent', 'arming_acknowledged', 'completion_observed')) or
            any(value[k] is not False for k in ('installed', 'installation_ready', 'replay_allowed')) or
            value['api_disconnect'] not in ('not_connected', 'completed', 'unverified') or
            value['forward_cleanup'] not in ('not_created', 'removed', 'absent', 'ambiguous_forward_preserved', 'cleanup_unverified_preserved')):
        raise ValueError('Bound private PM-extension receipt required')
    if (value['state'] == 'pm_extension_armed_waiting_reboot' and not (
            isinstance(boot, str) and re.fullmatch(r'[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}', boot) and
            value['device_request_sent'] and value['completion_observed'] and value['api_disconnect'] == 'completed' and
            value['forward_cleanup'] in ('removed', 'absent'))):
        raise ValueError('Complete PM-extension AFTER-effects proof required')
    if value['arming_acknowledged'] and not value['device_request_sent']:
        raise ValueError('PM-extension ACK cannot precede its consumed request')
    return value


async def arm_next_boot(adb, directory, digest, profile_path, observer, nonce):
    """One request, then a separate read even after a lost transport ACK.

    No stock process is signalled, no helper is loaded in this boot, and no
    automatic restart/reboot occurs. The private RAM inhibition marker is
    consumed before clearing the persistent opt-out. Unknown completion is
    preserved forever; a new host or absent result cannot resume the command.
    """
    directory, plan, baseline, receipt, _ = observer.basis(directory, digest, profile_path)
    result = {'state': 'pm_extension_unverified', 'nonce': nonce, 'boot_id': None, 'device_request_sent': False,
              'arming_acknowledged': False, 'completion_observed': False, 'api_disconnect': 'not_connected',
              'forward_cleanup': 'not_created', 'installed': False, 'installation_ready': False, 'replay_allowed': False}
    # This exact original observer only reads. Its API client and acknowledged
    # loopback forward are independently retired before its positive result.
    observed = await observer.verify(adb, directory, digest, profile_path)
    result.update(api_disconnect=observed.get('api_disconnect', 'unverified'),
                  forward_cleanup=observed.get('forward_cleanup', 'cleanup_unverified_preserved'))
    if (observed.get('stage') != 'post_boot_bridge_observed' or observed.get('runtime_observed') is not True or
            observed.get('plan_id') != plan['plan_id'] or observed.get('plan_sha256') != digest or
            result['api_disconnect'] != 'completed' or result['forward_cleanup'] not in ('removed', 'absent') or
            any(observed.get(k) is not False for k in ('installed', 'activated', 'installation_ready'))):
        return result
    frame = observed['scope']
    result['boot_id'] = frame['boot_id']
    adb.deadline = time.monotonic() + 120
    try:
        # Repeat the actual kernel/file collector after closing the API. Never
        # obtain a fresh PID from a saved report or treat a changed birth as
        # the same previous scope. No mutation has been issued at this point.
        if observer.scope(adb, directory, plan, digest, baseline, receipt) != frame:
            return result
        script, _ = command(observer, plan, digest, baseline, receipt, frame, nonce)
        proof_read = completion_check(observer, plan, digest, baseline, frame, nonce)
        result['device_request_sent'] = True  # Consumed before any remote effects.
        try:
            adb.read(script)
            result['arming_acknowledged'] = True
        except Exception:
            pass  # Never issue the same writer again; only read AFTER-effects.
        try:
            adb.read(proof_read)
            # The native binding must still select this physical device. The
            # proof's shell already rechecked the exact boot and fixed WLAN.
            if adb.serial != plan['target']['usb_serial'] or adb.usb() != plan['target']['usb_transport']:
                return result
            result.update(state='pm_extension_armed_waiting_reboot', completion_observed=True)
        except Exception:
            pass
    except Exception:
        pass
    finally:
        adb.deadline = None
    return result
