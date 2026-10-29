#!/usr/bin/env python3
"""Pruebas del puente local. No llaman a la bóveda ni a la red."""

import importlib.util
import json
import os
import stat
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "roborock_bridge",
    ROOT / "pruebas/mapa/bridge/roborock_bridge.py",
)
bridge = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(bridge)


class Device:
    def __init__(self, name, model, v1=True):
        self.name = name
        self.v1_properties = object() if v1 else None
        self.product = type("Product", (), {"model": model})()


class Leaky(bridge.MemoryRobot):
    def goto(self, x, y):
        raise RuntimeError("secret-password-value")


class Closed(bridge.MemoryRobot):
    def goto(self, x, y):
        raise bridge.Unavailable("boveda_sin_credenciales")

    def start(self):
        raise bridge.Unavailable("boveda_sin_credenciales")

    def charge(self):
        raise bridge.Unavailable("boveda_sin_credenciales")

    def health(self):
        return 503, {"ok": False, "error": "boveda_sin_credenciales"}


def start(robot, static_root=None):
    server = bridge.bind(robot, static_root=static_root)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server


def call(server, method, path, body=None, origin=None):
    url = f"http://127.0.0.1:{server.server_address[1]}{path}"
    data = None if body is None else body if isinstance(body, bytes) else body.encode("utf-8")
    request = urllib.request.Request(url, data=data, method=method)
    if body is not None:
        request.add_header("Content-Type", "application/json")
    if origin:
        request.add_header("Origin", origin)
    try:
        with urllib.request.urlopen(request, timeout=5) as response:
            return response.status, response.read(), dict(response.headers)
    except urllib.error.HTTPError as exc:
        try:
            return exc.code, exc.read(), dict(exc.headers)
        finally:
            exc.close()


class BridgeTest(unittest.TestCase):
    def test_goto_stop_and_pose_use_integers(self):
        robot = bridge.MemoryRobot()
        server = start(robot)
        self.addCleanup(server.shutdown)
        status, raw, _ = call(server, "POST", "/goto", b'{"x":1200,"y":-40}')
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(raw)["ok"], True)
        status, raw, _ = call(server, "GET", "/pose")
        pose = json.loads(raw)
        self.assertEqual(pose["x"], 1200)
        self.assertEqual(pose["y"], -40)
        self.assertEqual(pose["state"], "goto")
        status, raw, _ = call(server, "POST", "/stop", b"")
        self.assertEqual(status, 200)
        _, raw, _ = call(server, "GET", "/pose")
        stopped = json.loads(raw)
        self.assertEqual(stopped["x"], 1200)
        self.assertEqual(stopped["state"], "idle")
        _, rooms, _ = call(server, "GET", "/rooms")
        self.assertEqual(
            [item["name"] for item in json.loads(rooms)["rooms"]],
            ["Cocina", "Terraza", "Pasillo"],
        )

    def test_rejects_float_bool_and_out_of_range(self):
        robot = bridge.MemoryRobot()
        server = start(robot)
        self.addCleanup(server.shutdown)
        for body in (b'{"x":1.5,"y":2}', b'{"x":true,"y":1}', b'{"x":100001,"y":0}', b'{"x":"12","y":0}', b"[]"):
            status, raw, _ = call(server, "POST", "/goto", body)
            self.assertEqual(status, 400, body)
            self.assertEqual(json.loads(raw)["error"], "cuerpo_invalido")
        self.assertEqual(robot.calls, [])

    def test_errors_hide_the_exception_text(self):
        server = start(Leaky())
        self.addCleanup(server.shutdown)
        status, raw, _ = call(server, "POST", "/goto", b'{"x":1,"y":2}')
        self.assertEqual(status, 503)
        self.assertEqual(json.loads(raw), {"error": "robot_no_conectado"})
        self.assertNotIn(b"secret-password-value", raw)

    def test_missing_vault_code_only(self):
        server = start(Closed())
        self.addCleanup(server.shutdown)
        status, raw, _ = call(server, "POST", "/goto", b'{"x":1,"y":2}')
        self.assertEqual(status, 503)
        self.assertEqual(json.loads(raw), {"error": "boveda_sin_credenciales"})
        health, body, _ = call(server, "GET", "/health")
        self.assertEqual(health, 503)
        self.assertEqual(json.loads(body)["error"], "boveda_sin_credenciales")

    def test_public_origin_cannot_command(self):
        robot = bridge.MemoryRobot()
        server = start(robot)
        self.addCleanup(server.shutdown)
        for origin in (
            "https://evil.example",
            "https://www.admiranext.com.evil.example",
            "http://www.admiranext.com",
            "https://www.admiranext.com:8443",
        ):
            status, raw, headers = call(server, "POST", "/start", b"{}", origin=origin)
            self.assertEqual(status, 403, origin)
            self.assertEqual(json.loads(raw)["error"], "origen_no_permitido")
            self.assertNotIn("Access-Control-Allow-Origin", headers)
        self.assertNotIn("app_start", robot.calls)
        local, _, local_headers = call(server, "GET", "/health", origin="http://127.0.0.1:8765")
        self.assertEqual(local, 200)
        self.assertEqual(local_headers.get("Access-Control-Allow-Origin"), "http://127.0.0.1:8765")

    def test_admiranext_on_this_mac_can_start_and_charge(self):
        robot = bridge.MemoryRobot()
        server = start(robot)
        self.addCleanup(server.shutdown)
        preflight, _, pre_headers = call(server, "OPTIONS", "/start", origin="https://www.admiranext.com")
        self.assertEqual(preflight, 204)
        self.assertEqual(pre_headers.get("Access-Control-Allow-Origin"), "https://www.admiranext.com")
        self.assertEqual(pre_headers.get("Access-Control-Allow-Private-Network"), "true")
        status, raw, headers = call(server, "POST", "/start", b"{}", origin="https://www.admiranext.com")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(raw)["command"], "app_start")
        self.assertEqual(json.loads(raw)["state"], "cleaning")
        self.assertEqual(headers.get("Access-Control-Allow-Origin"), "https://www.admiranext.com")
        self.assertEqual(headers.get("Access-Control-Allow-Private-Network"), "true")
        status, raw, headers = call(server, "POST", "/charge", b"{}", origin="https://admiranext.com")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(raw)["command"], "app_charge")
        self.assertEqual(json.loads(raw)["state"], "charging")
        self.assertEqual(headers.get("Access-Control-Allow-Origin"), "https://admiranext.com")
        self.assertEqual(robot.calls, ["app_start", "app_charge"])

    def test_start_and_charge_without_device_do_not_send(self):
        robot = bridge.SarosRobot(credentials_path=Path("/no/existe/roborock.json"))
        server = start(robot)
        self.addCleanup(server.shutdown)
        for path in ("/start", "/charge"):
            status, raw, _ = call(server, "POST", path, b"{}")
            self.assertEqual(status, 503, path)
            self.assertEqual(json.loads(raw), {"error": "boveda_sin_credenciales"})
            self.assertNotIn(b"password", raw)
            self.assertNotIn(b"username", raw)

    def test_closed_start_and_charge_stay_503(self):
        server = start(Closed())
        self.addCleanup(server.shutdown)
        for path in ("/start", "/charge"):
            status, raw, _ = call(server, "POST", path, b"{}")
            self.assertEqual(status, 503, path)
            self.assertEqual(json.loads(raw), {"error": "boveda_sin_credenciales"})

    def test_static_stays_inside_the_repo(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            page = root / "pruebas" / "mapa"
            page.mkdir(parents=True)
            (page / "index.html").write_text("<p>casa</p>", encoding="utf-8")
            secret = root / "session.json"
            secret.write_text("no-servir", encoding="utf-8")
            hidden = root / ".git"
            hidden.mkdir()
            (hidden / "config").write_text("no-servir", encoding="utf-8")
            outside = Path(tmp).parent / "fuera-del-puente.txt"
            server = start(bridge.MemoryRobot(), static_root=root)
            self.addCleanup(server.shutdown)
            status, raw, _ = call(server, "GET", "/pruebas/mapa/")
            self.assertEqual(status, 200)
            self.assertIn(b"casa", raw)
            for path in ("/session.json", "/.git/config", "/../" + outside.name):
                code, _, _ = call(server, "GET", path)
                self.assertEqual(code, 404, path)

    def test_session_file_is_private_and_ignored_if_loose(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "cache" / "session.json"
            bridge.save_session({"username": "persona@example", "user": {"token": "fixture-token"}}, path)
            self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)
            self.assertEqual(stat.S_IMODE(path.parent.stat().st_mode), 0o700)
            loaded = bridge.load_session(path)
            self.assertEqual(loaded["username"], "persona@example")
            os.chmod(path, 0o644)
            self.assertIsNone(bridge.load_session(path))

    def test_local_credentials_require_mode_600_outside_the_repo(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            path = folder / "roborock.json"
            payload = {"username": " persona@example ", "password": "clave=de prueba"}
            path.write_text(json.dumps(payload), encoding="utf-8")
            os.chmod(path, 0o644)
            with self.assertRaises(bridge.Unavailable) as loose:
                bridge.load_local_credentials(path, repo_root=folder / "repo")
            self.assertEqual(loose.exception.code, "boveda_sin_credenciales")
            self.assertNotIn("clave", str(loose.exception))
            os.chmod(path, 0o600)
            username, password = bridge.load_local_credentials(path, repo_root=folder / "repo")
            self.assertEqual(username, "persona@example")
            self.assertEqual(password, "clave=de prueba")
            link = folder / "enlace.json"
            link.symlink_to(path)
            with self.assertRaises(bridge.Unavailable) as linked:
                bridge.load_local_credentials(link, repo_root=folder / "repo")
            self.assertEqual(linked.exception.code, "boveda_sin_credenciales")
            repo = folder / "repo"
            repo.mkdir()
            inside = repo / "roborock.json"
            inside.write_text(path.read_text(encoding="utf-8"), encoding="utf-8")
            os.chmod(inside, 0o600)
            with self.assertRaises(bridge.Unavailable) as leaked:
                bridge.load_local_credentials(inside, repo_root=repo)
            self.assertEqual(leaked.exception.code, "boveda_sin_credenciales")

    def test_vault_without_script_fails_closed(self):
        with self.assertRaises(bridge.Unavailable) as caught:
            bridge.vault_get("ROBOROCK_PASSWORD", Path("/no/existe/vault-get.sh"))
        self.assertEqual(caught.exception.code, "boveda_sin_credenciales")
        self.assertNotIn("password", str(caught.exception).lower())

    def test_pick_saros_prefers_the_named_vacuum(self):
        other = Device("Otro", "roborock.vacuum.s5")
        saros = Device("Saros Z70", "roborock.vacuum.a179")
        self.assertIs(bridge.pick_saros([other, saros]), saros)
        self.assertIsNone(bridge.pick_saros([other, Device("Segundo", "roborock.vacuum.s7")]))
        self.assertIs(bridge.pick_saros([other]), other)
        self.assertIsNone(bridge.pick_saros([Device("Nube", "roborock.vacuum.a179", v1=False)]))


if __name__ == "__main__":
    unittest.main()
