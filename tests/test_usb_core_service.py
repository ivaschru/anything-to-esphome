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

    spec = importlib.util.spec_from_file_location("monitor1_core_service", ROOT / "custom_components/qingping_esphome/monitor1.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)


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
