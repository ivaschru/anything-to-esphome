"""Real HA/ESPHome SDK: the normal update entity works without our integration."""
import importlib.util
from types import SimpleNamespace
import unittest
from unittest.mock import Mock

HAS_HA=importlib.util.find_spec('homeassistant') is not None

@unittest.skipUnless(HAS_HA,'Optional Home Assistant SDK not installed')
class NativeHAContracts(unittest.IsolatedAsyncioTestCase):
    async def test_standard_entity_versions_progress_check_and_install(self):
        from aioesphomeapi import APIVersion, DeviceInfo, UpdateInfo, UpdateState, UpdateCommand
        from homeassistant.components.esphome.update import ESPHomeUpdateEntity
        client=Mock()
        state=UpdateState(key=7,current_version='2',latest_version='3',in_progress=False,
                          title='Qingping firmware',release_summary='Profile release',has_progress=True,progress=42)
        data=SimpleNamespace(device_info=DeviceInfo(name='fixture',mac_address='00:11:22:33:44:55'),
                             api_version=APIVersion(1,12),client=client,available=True,
                             expected_disconnect=False,child_device_ids=set(),state={UpdateState:{(0,7):state}})
        info=UpdateInfo(key=7,object_id='firmware',name='Firmware',device_class='firmware')
        entity=ESPHomeUpdateEntity(data,info,UpdateState)
        entity._update_state_from_entry_data()
        self.assertEqual((entity.installed_version,entity.latest_version),('2','3'))
        self.assertEqual(entity.update_percentage,42)
        self.assertTrue(entity.version_is_newer('3','2'))
        self.assertFalse(entity.version_is_newer('2','3'))
        await entity.async_update()
        client.update_command.assert_called_once_with(key=7,command=UpdateCommand.CHECK,device_id=0)
        client.update_command.reset_mock()
        await entity.async_install(None,False)
        client.update_command.assert_called_once_with(key=7,command=UpdateCommand.INSTALL,device_id=0)

    async def test_real_ha_registers_update_install_as_admin_only(self):
        from homeassistant.components.update.services import async_setup_services
        from homeassistant.components.update.const import DATA_COMPONENT, UpdateService
        component=Mock()
        async_setup_services(SimpleNamespace(data={DATA_COMPONENT:component}))
        install=[call for call in component.async_register_entity_service.call_args_list if call.args[0]==UpdateService.INSTALL]
        self.assertEqual(len(install),1);self.assertIs(install[0].kwargs['admin_only'],True)

if __name__=='__main__':unittest.main()
