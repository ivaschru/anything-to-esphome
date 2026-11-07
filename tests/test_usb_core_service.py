"""Real stdio child and HA admin adapter; no ADB server, USB or compiler.

These tests require the supported HA SDK and run in its CI job. The local
pure-Python USB suite skips them when HA is absent, without substituting a
made-up API. Child tests execute the generated package that HACS will ship.
"""
import asyncio
import importlib.util
import json
from pathlib import Path
import tempfile
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock

ROOT = Path(__file__).resolve().parents[1]
HAS_HA = importlib.util.find_spec("homeassistant") is not None
module = None
if HAS_HA:
    from aiohttp import web
    from aiohttp.test_utils import TestClient, TestServer
    from homeassistant.components.http.const import KEY_HASS, KEY_HASS_USER

    spec = importlib.util.spec_from_file_location("qingping_core_contract.monitor1", ROOT / "custom_components/qingping_esphome/monitor1.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.__package__ = "qingping_core_contract"
    helper_spec = importlib.util.spec_from_file_location("qingping_core_contract.monitor1_enrollment", ROOT / "custom_components/qingping_esphome/monitor1_enrollment.py")
    enrollment = importlib.util.module_from_spec(helper_spec)
    helper_spec.loader.exec_module(enrollment)
    sys.modules[helper_spec.name] = enrollment

    for stem in ("monitor1_browser_relay", "monitor1_browser_channel", "monitor1_browser_registry", "monitor1_browser_review"):
        part_spec = importlib.util.spec_from_file_location("qingping_core_contract." + stem, ROOT / "custom_components/qingping_esphome" / (stem + ".py"))
        part = importlib.util.module_from_spec(part_spec)
        sys.modules[part_spec.name] = part
        part_spec.loader.exec_module(part)



@unittest.skipUnless(HAS_HA, "requires the real Home Assistant SDK")
class CoreServiceTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name).resolve()
        (self.root / ".storage").mkdir()
        async def executor(function, *args):
            return await asyncio.to_thread(function, *args)
        self.hass = SimpleNamespace(config=SimpleNamespace(path=lambda *parts: str(self.root.joinpath(*parts))),
                                    async_add_executor_job=executor, data={})
        self.service = module.Monitor1(self.hass)

    async def asyncTearDown(self):
        await self.service.stop()
        if self.service.process is not None:
            await asyncio.wait_for(self.service.process.wait(), 10)

    async def test_packaged_actor_handles_actual_owner_frames_without_hardware(self):
        async with self.service.reserve():
            ok, mime, body = await self.service.call("a"*32, None, "page", None)
            self.assertTrue(ok)
            nonce = json.loads(body)["nonce"]
        async with self.service.reserve():
            ok, _, body = await self.service.call("a"*32, nonce, "jobs", None)
            self.assertTrue(ok)
            self.assertEqual(json.loads(body), {"jobs": []})
        async with self.service.reserve():
            ok, _, body = await self.service.call("b"*32, nonce, "devices", None)
            self.assertFalse(ok)
            self.assertEqual(json.loads(body), {"error_code": "usb_unauthorized"})
        self.assertEqual(list((self.service.root / "adb").iterdir()), [], "Page/status never start ADB or create keys")
        self.assertEqual(list((self.service.root / "toolsets").iterdir()), [], "Page/status never download tools")

    async def test_admin_check_precedes_body_read_or_process_start(self):
        content = SimpleNamespace(readexactly=AsyncMock(side_effect=AssertionError("body must not be read")))
        request = {"hass_user": SimpleNamespace(is_admin=False, id="a"*32)}
        request = type("Request", (dict,), {"content": content})(request)
        response = await module.Monitor1View().post(request, "page")
        self.assertEqual(response.status, 403)
        content.readexactly.assert_not_called()
        self.assertIsNone(self.service.process)

    async def http_client(self, *, admin=True, loaded=True):
        """Exercise a real request with HA's typed application key.

        HA's authentication middleware owns authentication in production. This
        fixture injects its resolved user, without inventing another token or
        starting HA/USB. Crucially, no legacy string ``app['hass']`` is set:
        the supported SDK's actual AppKey must reach the packaged actor.
        """
        @web.middleware
        async def resolved_user(request, handler):
            request[KEY_HASS_USER] = SimpleNamespace(is_admin=admin, id="a" * 32)
            return await handler(request)

        app = web.Application(middlewares=[resolved_user])
        app[KEY_HASS] = self.hass
        if loaded:
            self.hass.data[module.DOMAIN] = SimpleNamespace(monitor1=self.service)
        view = module.Monitor1View()

        async def post(request):
            return await view.post(request, request.match_info["operation"])

        app.router.add_post(view.url, post)
        client = TestClient(TestServer(app))
        await client.start_server()
        self.addAsyncCleanup(client.close)
        return client

    async def test_admin_http_page_and_jobs_reach_packaged_actor(self):
        client = await self.http_client()
        response = await client.post("/api/qingping_esphome/monitor1/page", data=b"null", headers={"Content-Type": "application/json"})
        self.assertEqual(response.status, 200, await response.text())
        self.assertEqual(response.headers["Cache-Control"], "no-store")
        nonce = (await response.json())["nonce"]
        response = await client.post("/api/qingping_esphome/monitor1/jobs", data=b"null",
            headers={"Content-Type": "application/json", "X-Qingping-Nonce": nonce})
        self.assertEqual(response.status, 200, await response.text())
        self.assertEqual(await response.json(), {"jobs": []})
        # The positive HTTP route may start its private stdio actor only.
        self.assertEqual(list((self.service.root / "adb").iterdir()), [])
        self.assertEqual(list((self.service.root / "toolsets").iterdir()), [])

    async def test_http_cannot_request_internal_key_operations_or_receive_private_mime(self):
        client = await self.http_client()
        response = await client.post("/api/qingping_esphome/monitor1/internal-enrollment-prepare", data=b"{}",
            headers={"Content-Type":"application/json", "X-Qingping-Nonce":"a"*64})
        self.assertEqual(response.status,403)
        self.assertIsNone(self.service.process)
        self.service.call = AsyncMock(return_value=(True,module.INTERNAL_MIME,b"SYNTHETIC_PRIVATE_PAYLOAD"))
        response = await client.post("/api/qingping_esphome/monitor1/jobs", data=b"null",
            headers={"Content-Type":"application/json", "X-Qingping-Nonce":"a"*64})
        self.assertEqual(response.status,403)
        self.assertNotIn("SYNTHETIC_PRIVATE_PAYLOAD",await response.text())

    async def test_native_enrollment_and_lost_ack_status_keep_key_on_private_pipe(self):
        from test_usb_ha_enrollment_core import DATA, entry
        from unittest.mock import patch
        items=[]
        self.hass.config_entries=SimpleNamespace(async_entries=lambda domain:items)
        public={"job_id":DATA["job_id"],"state":"unverified","entry_id":None,"enrollment_available":False,
            "replay_allowed":False,"installation_ready":False}
        async def exchange(user,nonce,operation,data):
            if operation in ("internal-enrollment-prepare","internal-enrollment-package"):
                return True,module.INTERNAL_MIME,json.dumps(DATA).encode()
            if operation=="internal-enrollment-record":
                return True,"application/json",json.dumps({**public,"state":data["state"],"entry_id":data["entry_id"]}).encode()
            if operation=="internal-enrollment-status":return True,"application/json",json.dumps(public).encode()
            self.fail(operation)
        self.service.exchange=AsyncMock(side_effect=exchange)
        with patch.object(enrollment,"enroll",AsyncMock(return_value=("created","ENTRY_1"))) as native:
            async with self.service.reserve():
                result=await self.service.call("a"*32,"b"*64,"enroll",{"job_id":DATA["job_id"],"expected_plan_sha256":"d"*64,"reviewed":True})
            self.assertEqual(json.loads(result[2])["state"],"created")
            self.assertNotIn(DATA["noise_psk"].encode(),result[2])
            items.append(entry())
            async with self.service.reserve():
                result=await self.service.call("a"*32,"b"*64,"jobs/"+DATA["job_id"]+"/enroll",None)
            self.assertEqual(json.loads(result[2])["state"],"already_configured")
            self.assertNotIn(DATA["noise_psk"].encode(),result[2]);self.assertEqual(native.await_count,1)
            # Status never rewrites a receipt or opens USB/a new native flow.
            self.assertEqual(self.service.exchange.call_args_list[-1].args[2],"internal-enrollment-package")

    async def test_browser_frames_require_a_real_page_before_reading_or_starting_actor(self):
        client = await self.http_client()
        response = await client.post("/api/qingping_esphome/monitor1/browser/open",data=b"not json",
            headers={"Content-Type":"application/json","X-Qingping-Nonce":"a"*64})
        self.assertEqual(response.status,403);self.assertIsNone(self.service.process)

    async def test_browser_api_frame_delivery_uses_actual_owner_nonce_without_pipe_reservation(self):
        client = await self.http_client()
        page = await client.post("/api/qingping_esphome/monitor1/page",data=b"null",headers={"Content-Type":"application/json"})
        nonce = (await page.json())["nonce"]
        headers={"Content-Type":"application/json","X-Qingping-Nonce":nonce}
        evidence={"kind":"browser_webusb","channel":"22222222-2222-2222-2222-222222222222","serial":"synthetic-usb",
            "wlan_mac":"02:00:00:00:00:01","boot_id":"33333333-3333-3333-3333-333333333333","co2_type":3,
            "stock_version":"4.1.8_0287","native_get_devpath":False}
        response=await client.post("/api/qingping_esphome/monitor1/browser/open",json={"evidence":evidence},headers=headers)
        self.assertEqual(response.status,200,await response.text())
        registered=await response.json();self.assertFalse(registered["writer_enabled"])
        identity=registered["channel_id"]
        capability=self.service.browser_registry.capability("a"*32,nonce,identity)
        async with self.service.reserve():
            opening=asyncio.create_task(capability.open_api())
            response=await client.post("/api/qingping_esphome/monitor1/browser/poll",json={"channel_id":identity},headers=headers)
            self.assertEqual(response.status,200,await response.text());request=(await response.json())["request"]
            self.assertEqual(request["operation"],"api-open")
            response=await client.post("/api/qingping_esphome/monitor1/browser/answer",json={"channel_id":identity,"frame":{"id":request["id"],"ok":True,"data":None}},headers=headers)
            self.assertEqual(response.status,200,await response.text());stream=await opening
            closing=asyncio.create_task(stream.close())
            response=await client.post("/api/qingping_esphome/monitor1/browser/poll",json={"channel_id":identity},headers=headers)
            request=(await response.json())["request"];self.assertEqual(request["operation"],"api-close")
            response=await client.post("/api/qingping_esphome/monitor1/browser/answer",json={"channel_id":identity,"frame":{"id":request["id"],"ok":True,"data":None}},headers=headers)
            self.assertEqual(response.status,200);await closing
        wrong={**headers,"X-Qingping-Nonce":"b"*64}
        response=await client.post("/api/qingping_esphome/monitor1/browser/poll",json={"channel_id":identity},headers=wrong)
        self.assertEqual(response.status,403)
        self.assertEqual(list((self.service.root / "adb").iterdir()),[])
        self.assertEqual(list((self.service.root / "toolsets").iterdir()),[])

    async def test_browser_scope_review_reaches_private_plan_and_live_peer_through_admin_http(self):
        client = await self.http_client()
        page = await client.post("/api/qingping_esphome/monitor1/page", data=b"null", headers={"Content-Type": "application/json"})
        nonce = (await page.json())["nonce"]
        headers = {"Content-Type": "application/json", "X-Qingping-Nonce": nonce}
        evidence = {"kind": "browser_webusb", "channel": "22222222-2222-2222-2222-222222222222", "serial": "synthetic-usb",
            "wlan_mac": "02:00:00:00:00:01", "boot_id": "33333333-3333-3333-3333-333333333333", "co2_type": 3,
            "stock_version": "4.1.8_0287", "native_get_devpath": False}
        response = await client.post("/api/qingping_esphome/monitor1/browser/open", json={"evidence": evidence}, headers=headers)
        identity = (await response.json())["channel_id"]
        context = {"schema_version": 1, "job_id": "c" * 32, "plan_sha256": "d" * 64,
            "source_commit": "53d97b9609e8e0fcdfc5d003101f620098dbc734", "writer_enabled": False,
            "target": {"kind": "browser_webusb", "usb_serial": evidence["serial"], **{key: evidence[key] for key in
                       ("wlan_mac", "boot_id", "co2_type", "stock_version")}}}
        # The private producer itself is tested by BrowserPlanTests; retain
        # actual HTTP, reservation, channel framing and owner/page checks here.
        self.service.exchange = AsyncMock(return_value=(True, "application/json", json.dumps(context).encode()))
        data = {"job_id": context["job_id"], "expected_plan_sha256": context["plan_sha256"], "channel_id": identity}
        reviewing = asyncio.ensure_future(client.post("/api/qingping_esphome/monitor1/browser-review", json=data, headers=headers))
        self.addAsyncCleanup(self.cancel_pending, reviewing)
        response = await asyncio.wait_for(client.post("/api/qingping_esphome/monitor1/browser/poll", json={"channel_id": identity}, headers=headers), 2)
        request = (await response.json())["request"]
        self.assertEqual(request["operation"], "scope-check")
        self.assertTrue(self.service.lock.locked(), "Frame delivery must bypass only the existing ordinary reservation")
        response = await client.post("/api/qingping_esphome/monitor1/browser/answer",
            json={"channel_id": identity, "frame": {"id": request["id"], "ok": True, "data": evidence}}, headers=headers)
        self.assertEqual(response.status, 200)
        result = await asyncio.wait_for(reviewing, 2)
        self.assertEqual(result.status, 200, await result.text())
        value = await result.json()
        self.assertEqual(value["state"], "browser_scope_verified")
        self.assertFalse(value["writer_enabled"] or value["native_get_devpath"] or value["installed"])
        self.assertEqual(value["device_writes"], 0)
        self.assertEqual(self.service.exchange.call_args.args[2], "internal-browser-plan-context")
        # No browser request can directly call the private producer, even with
        # a valid admin/page nonce. A target/command cannot be injected either.
        before = self.service.exchange.await_count
        response = await client.post("/api/qingping_esphome/monitor1/internal-browser-plan-context", json=data, headers=headers)
        self.assertEqual(response.status, 403)
        response = await client.post("/api/qingping_esphome/monitor1/browser-review", json={**data, "target": context["target"]}, headers=headers)
        self.assertEqual(response.status, 403)
        self.assertEqual(self.service.exchange.await_count, before)
        self.assertEqual(list((self.service.root / "adb").iterdir()), [])
        self.assertEqual(list((self.service.root / "toolsets").iterdir()), [])

    async def cancel_pending(self, task):
        if not task.done():
            task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

    async def test_unloaded_http_service_returns_controlled_unavailable(self):
        client = await self.http_client(loaded=False)
        response = await client.post("/api/qingping_esphome/monitor1/page", data=b"null",
                                     headers={"Content-Type": "application/json"})
        self.assertEqual(response.status, 503)
        self.assertEqual(await response.json(), {"error_code": "usb_core_unavailable"})
        self.assertIsNone(self.service.process)

    async def test_nonadmin_http_request_never_starts_actor(self):
        client = await self.http_client(admin=False)
        response = await client.post("/api/qingping_esphome/monitor1/page", data=b"not JSON",
                                     headers={"Content-Type": "application/json"})
        self.assertEqual(response.status, 403)
        self.assertEqual(await response.json(), {"error_code": "usb_unauthorized"})
        self.assertIsNone(self.service.process)

    async def test_cancellation_drains_original_frame_before_releasing_reservation(self):
        entered, finish = asyncio.Event(), asyncio.Event()
        async def exchange(*args):
            entered.set()
            await finish.wait()
            return True, "application/json", b"{}"
        self.service.exchange = exchange
        async def perform():
            async with self.service.reserve():
                return await self.service.call("a"*32, "b"*64, "install", {})
        request = asyncio.create_task(perform())
        await entered.wait()
        request.cancel()
        await asyncio.sleep(0)
        self.assertTrue(self.service.lock.locked())
        request.cancel()  # Repeated HTTP cancellation must still drain once.
        await asyncio.sleep(0)
        self.assertTrue(self.service.lock.locked())
        with self.assertRaisesRegex(module.CoreRefusal, "usb_busy"):
            async with self.service.reserve():
                pass
        finish.set()
        with self.assertRaises(asyncio.CancelledError):
            await request
        self.assertFalse(self.service.lock.locked())

    async def test_worker_exit_does_not_spawn_a_replacement_or_replay(self):
        async with self.service.reserve():
            await self.service.call("a"*32, None, "page", None)
        original = self.service.process
        original.stdin.close()
        await asyncio.wait_for(original.wait(), 10)
        async with self.service.reserve():
            with self.assertRaisesRegex(module.CoreRefusal, "usb_core_unverified"):
                await self.service.call("a"*32, None, "page", None)
        self.assertIs(self.service.process, original)
