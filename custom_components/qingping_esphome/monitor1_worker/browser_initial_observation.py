"""Pure first-trial preparation DTO; no process, filesystem or USB authority.

Both the private actor and Core use these exact field/type/scope checks. The
observed RAM lower bound never admits a RAM directory or executable image FD.
The actual selected transport and future consumed trial retain those duties.
"""
if __package__:
    from .browser_disabled_observation import validate_scope, ObservationRefusal
else:
    from browser_disabled_observation import validate_scope, ObservationRefusal

MIN_START_RAM = 32 * 1024**2


def validate_preparation(value, meta, reader, committed=None):
    fields = {'kind', 'scope', 'ram_available_bytes', 'memory_basis', 'persistent_stores_absent',
              'ram_processes_absent', 'api_ota_listeners_free', 'ram_scope_checked', 'image_fd_admitted',
              'execution_authority', 'device_writes'}
    if (not isinstance(value, dict) or set(value) != fields or value['kind'] != 'browser_initial_trial_preparation' or
            value['memory_basis'] != 'MemFree_lower_bound' or type(value['ram_available_bytes']) is not int or
            not MIN_START_RAM <= value['ram_available_bytes'] <= 2**40 or
            any(value[k] is not True for k in ('persistent_stores_absent', 'ram_processes_absent', 'api_ota_listeners_free')) or
            any(value[k] is not False for k in ('ram_scope_checked', 'image_fd_admitted', 'execution_authority')) or
            type(value['device_writes']) is not int or value['device_writes'] != 0 or not isinstance(meta, dict) or
            not isinstance(meta.get('commit_nonce'), str)):
        raise ObservationRefusal
    validate_scope(value['scope'], meta, reader)
    vendors = dict(value['scope']['vendor_hashes'])
    if any(vendors.get(path) != pin['sha256'] for path, pin in reader['patched'].items()):
        raise ObservationRefusal
    if committed is not None:
        validate_scope(committed, meta, reader)
        # Capacity may fluctuate; original root/inode, source, flags and process
        # births may not. No fresh matching bytes can adopt a recreated root.
        stable = lambda scope: {k: v for k, v in scope.items() if k != 'data_available_bytes'}
        if stable(value['scope']) != stable(committed):
            raise ObservationRefusal
