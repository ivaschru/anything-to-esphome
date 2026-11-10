"""Authenticated owner-only delivery of the complete private factory backup.

Backup bytes contain Wi-Fi/device secrets. No public route, persistent delivery
URL, arbitrary path or raw engine log is exposed. Files are read into a bounded
private archive only after the same HA administrator/owner checks as status.
"""
import io
from pathlib import Path
import re
import tarfile

from aiohttp import web
from homeassistant.components.http import HomeAssistantView
from homeassistant.components.http.const import KEY_HASS, KEY_HASS_USER


def backup_archive(root):
    root = Path(root)
    # The original engine owns names below captures. Admit complete stock
    # flash/eFuse files only; no profile, session, log or unrelated capture.
    candidates = []
    for path in (root / "upstream/captures/plugs").glob("*/sonoff-backup/*"):
        if (path.is_symlink() or not path.is_file()
                or path.name not in {"flash.bin", "efuse.bin", "efuse.json", "efuse-summary.json"}):
            continue
        if path.stat().st_size > 8 * 1024 * 1024:
            raise ValueError("Backup exceeds bound")
        candidates.append(path)
    if (not any(p.name == "flash.bin" and p.stat().st_size == 4 * 1024 * 1024 for p in candidates)
            or not any(p.name == "efuse.bin" and p.stat().st_size > 0 for p in candidates)):
        raise FileNotFoundError("Complete factory backup unavailable")
    if len(candidates) > 16 or sum(p.stat().st_size for p in candidates) > 12 * 1024 * 1024:
        raise ValueError("Backup exceeds bound")
    result = io.BytesIO()
    with tarfile.open(fileobj=result, mode="w", format=tarfile.USTAR_FORMAT) as archive:
        for index, path in enumerate(sorted(candidates)):
            data = path.read_bytes()
            info = tarfile.TarInfo(f"backup-{index + 1}-{path.name}")
            info.size, info.mode, info.mtime = len(data), 0o600, 0
            archive.addfile(info, io.BytesIO(data))
    return result.getvalue()


class SonoffBackupView(HomeAssistantView):
    url = "/api/qingping_esphome/sonoff/{job}/backup"
    name = "api:qingping_esphome:sonoff_backup"
    requires_auth = True

    async def get(self, request, job):
        user = request.get(KEY_HASS_USER)
        if not user or not user.is_admin or not re.fullmatch(r"[a-f0-9]{32}", job):
            raise web.HTTPForbidden()
        hass = request.app[KEY_HASS]
        manager = hass.data.get("qingping_esphome")
        sonoff = getattr(manager, "sonoff", None)
        record = sonoff.records.get(job) if sonoff else None
        if not record or record.get("owner") != user.id:
            raise web.HTTPNotFound()
        try:
            data = await hass.async_add_executor_job(backup_archive, sonoff.root / job)
        except (OSError, ValueError):
            raise web.HTTPNotFound() from None
        return web.Response(body=data, content_type="application/x-tar", headers={
            "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
            "Content-Disposition": 'attachment; filename="sonoff-s60tpf-private-backup.tar"'})
