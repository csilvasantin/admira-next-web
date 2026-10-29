#!/usr/bin/env python3
"""Puente local del Saros Z70 para el mapa de pruebas.

Escucha solo en 127.0.0.1. El mapa (HTTPS) no puede mandarle órdenes: hace
falta abrir el mapa en este mismo origen, por ejemplo
http://127.0.0.1:8765/pruebas/mapa/?casa=1

Contrato:
  GET  /health
  GET  /pose   -> {x, y, heading, state, battery}
  GET  /rooms  -> {rooms: [{name}]}
  POST /goto   {"x": mm, "y": mm}  -> app_goto_target
  POST /stop                        -> stop_goto_target

Las credenciales salen de la bóveda (ROBOROCK_USERNAME, ROBOROCK_PASSWORD)
con vault-get.sh. No se imprimen ni se guardan en el repo. La sesión queda
en ~/.cache/admiranext-roborock/session.json (0600).

Requiere python-roborock==7.13.0. Sin las claves, el proceso arranca y
/goto, /stop y /pose responden 503 boveda_sin_credenciales.
"""

from __future__ import annotations

import json
import os
import stat
import subprocess
import threading
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HOST = "127.0.0.1"
DEFAULT_PORT = 8765
MAX_BODY = 4096
MM_LIMIT = 100_000
MAP_CACHE_S = 15
ERROR_CODES = frozenset({"boveda_sin_credenciales", "robot_no_conectado"})
VAULT_SCRIPT = Path.home() / "Claude/admira-vault/vault-get.sh"
SESSION_PATH = Path.home() / ".cache/admiranext-roborock/session.json"
REPO_ROOT = Path(__file__).resolve().parents[3]

MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".woff2": "font/woff2",
    ".ico": "image/x-icon",
    ".txt": "text/plain; charset=utf-8",
    ".md": "text/plain; charset=utf-8",
}


class Unavailable(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code if code in ERROR_CODES else "robot_no_conectado"


class BadRequest(Exception):
    pass


class MemoryRobot:
    """Robot de prueba. No habla con la red ni con la bóveda."""

    def __init__(self) -> None:
        self.x = 0
        self.y = 0
        self.heading = 0
        self.state = "idle"
        self.battery = 100
        self.calls: list[str] = []

    def pose(self) -> dict:
        self.calls.append("pose")
        return {
            "x": self.x,
            "y": self.y,
            "heading": self.heading,
            "state": self.state,
            "battery": self.battery,
        }

    def rooms(self) -> dict:
        self.calls.append("rooms")
        return {"rooms": [{"name": "Cocina"}, {"name": "Terraza"}, {"name": "Pasillo"}]}

    def goto(self, x: int, y: int) -> dict:
        self.calls.append("goto")
        self.x = x
        self.y = y
        self.state = "goto"
        return {"ok": True}

    def stop(self) -> dict:
        self.calls.append("stop")
        self.state = "idle"
        return {"ok": True}

    def health(self) -> tuple[int, dict]:
        return 200, {"ok": True, "mode": "memory"}


def public_code(exc: BaseException) -> str:
    if isinstance(exc, Unavailable):
        return exc.code
    return "robot_no_conectado"


def vault_get(name: str, script: Path = VAULT_SCRIPT) -> str:
    if name not in {"ROBOROCK_USERNAME", "ROBOROCK_PASSWORD"} or not script.is_file():
        raise Unavailable("boveda_sin_credenciales")
    try:
        proc = subprocess.run(
            [str(script), name],
            check=False,
            capture_output=True,
            text=True,
            timeout=20,
        )
    except (OSError, subprocess.TimeoutExpired):
        raise Unavailable("boveda_sin_credenciales") from None
    value = proc.stdout.strip() if proc.returncode == 0 else ""
    if not value or "\n" in value or "\r" in value:
        raise Unavailable("boveda_sin_credenciales")
    return value


def save_session(payload: dict, path: Path = SESSION_PATH) -> None:
    path.parent.mkdir(mode=0o700, exist_ok=True)
    os.chmod(path.parent, 0o700)
    raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    try:
        os.write(fd, raw)
    finally:
        os.close(fd)
    os.chmod(path, 0o600)


def load_session(path: Path = SESSION_PATH) -> dict | None:
    try:
        mode = path.stat().st_mode
        if stat.S_IMODE(mode) & 0o077:
            return None
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError):
        return None
    if not isinstance(data, dict) or not isinstance(data.get("user"), dict):
        return None
    username = data.get("username")
    if not isinstance(username, str) or not username:
        return None
    return data


def pick_saros(devices: list) -> object | None:
    """Elige el Saros Z70 (v1, modelo a179). No registra el identificador."""
    vacuums = [device for device in devices if getattr(device, "v1_properties", None) is not None]
    wanted = []
    for device in vacuums:
        product = getattr(device, "product", None)
        model = str(getattr(product, "model", "") or "").lower()
        name = str(getattr(device, "name", "") or "").lower()
        blob = f"{model} {name}"
        if any(token in blob for token in ("saros", "z70", "a179")):
            wanted.append(device)
    if len(wanted) == 1:
        return wanted[0]
    if not wanted and len(vacuums) == 1:
        return vacuums[0]
    return None


def _plain_state(value: object) -> str:
    name = getattr(value, "name", None)
    text = name if isinstance(name, str) else ""
    if not text:
        text = value if isinstance(value, str) else ""
    text = text.strip().lower().replace(" ", "_")
    if not text or len(text) > 40 or not text.replace("_", "").isalnum():
        return "unknown"
    return text


class SarosRobot:
    """Robot real. connect() es perezoso y solo lo llama main()."""

    def __init__(self, vault_script: Path = VAULT_SCRIPT, session_path: Path = SESSION_PATH) -> None:
        self._vault = vault_script
        self._session = session_path
        self._device = None
        self._error = "boveda_sin_credenciales"
        self._map_at = 0.0
        self._cached: tuple[int, int, int] | None = None
        self._loop = None
        self._thread: threading.Thread | None = None

    def _ensure_loop(self) -> None:
        if self._loop is not None:
            return
        import asyncio

        self._loop = asyncio.new_event_loop()
        self._thread = threading.Thread(target=self._loop.run_forever, name="roborock-bridge", daemon=True)
        self._thread.start()

    def _call(self, coro, timeout: float = 45):
        import asyncio

        self._ensure_loop()
        future = asyncio.run_coroutine_threadsafe(coro, self._loop)
        try:
            return future.result(timeout)
        except Unavailable:
            raise
        except Exception:
            raise Unavailable(self._error or "robot_no_conectado") from None

    def connect(self) -> None:
        try:
            self._call(self._connect())
        except Unavailable as exc:
            self._error = exc.code
            self._device = None

    async def _connect(self) -> None:
        cached = load_session(self._session)
        username = None
        user = None
        base_url = None
        if cached:
            try:
                from roborock.data import UserData

                username = cached["username"]
                base_url = cached.get("base_url") if isinstance(cached.get("base_url"), str) else None
                user = UserData.from_dict(cached["user"])
            except Exception:
                user = None
        if user is None or not username:
            username = vault_get("ROBOROCK_USERNAME", self._vault)
            password = vault_get("ROBOROCK_PASSWORD", self._vault)
            try:
                from roborock.web_api import RoborockApiClient

                client = RoborockApiClient(username)
                user = await client.pass_login(password)
                base_url = getattr(client, "base_url", None) or base_url
            except Unavailable:
                raise
            except Exception:
                raise Unavailable("boveda_sin_credenciales") from None
            finally:
                password = ""
            save_session(
                {"username": username, "base_url": base_url, "user": user.as_dict()},
                self._session,
            )
        try:
            from roborock.devices.device_manager import UserParams, create_device_manager

            manager = await create_device_manager(UserParams(username=username, user_data=user, base_url=base_url))
            devices = await manager.get_devices()
        except Unavailable:
            raise
        except Exception:
            raise Unavailable("robot_no_conectado") from None
        device = pick_saros(list(devices or []))
        if device is None:
            raise Unavailable("robot_no_conectado")
        self._device = device
        self._error = ""

    def _require(self):
        if self._device is None:
            raise Unavailable(self._error or "robot_no_conectado")
        return self._device

    def health(self) -> tuple[int, dict]:
        if self._device is None:
            return 503, {"ok": False, "error": self._error or "robot_no_conectado"}
        return 200, {"ok": True}

    def pose(self) -> dict:
        return self._call(self._pose())

    async def _pose(self) -> dict:
        device = self._require()
        props = device.v1_properties
        now = time.monotonic()
        if self._cached is None or now - self._map_at >= MAP_CACHE_S:
            await props.map_content.refresh()
            data = getattr(props.map_content, "map_data", None)
            pos = getattr(data, "vacuum_position", None) if data is not None else None
            px, py = getattr(pos, "x", None), getattr(pos, "y", None)
            if type(px) not in (int, float) or type(py) not in (int, float):
                raise Unavailable("robot_no_conectado")
            heading = getattr(pos, "a", 0) or 0
            if type(heading) not in (int, float):
                heading = 0
            self._cached = (int(px), int(py), int(heading))
            self._map_at = now
        x, y, heading = self._cached
        state, battery = "unknown", None
        try:
            await props.status.refresh()
            state = _plain_state(getattr(props.status, "state", None))
            level = getattr(props.status, "battery", None)
            if type(level) is int and 0 <= level <= 100:
                battery = level
        except Exception:
            pass
        return {"x": x, "y": y, "heading": heading, "state": state, "battery": battery}

    def rooms(self) -> dict:
        return self._call(self._rooms())

    async def _rooms(self) -> dict:
        self._require()
        # Los nombres de la app. El plano en mm aún no está calibrado con estas salas.
        return {"rooms": [{"name": "Cocina"}, {"name": "Terraza"}, {"name": "Pasillo"}]}

    def goto(self, x: int, y: int) -> dict:
        return self._call(self._goto(x, y))

    async def _goto(self, x: int, y: int) -> dict:
        from roborock import RoborockCommand

        device = self._require()
        await device.v1_properties.command.send(RoborockCommand.APP_GOTO_TARGET, [int(x), int(y)])
        return {"ok": True}

    def stop(self) -> dict:
        return self._call(self._stop())

    async def _stop(self) -> dict:
        from roborock import RoborockCommand

        device = self._require()
        await device.v1_properties.command.send(RoborockCommand.STOP_GOTO_TARGET)
        return {"ok": True}


def origin_allowed(origin: str | None) -> bool:
    if not origin:
        return True
    parsed = urllib.parse.urlparse(origin)
    return parsed.scheme == "http" and parsed.hostname in {"127.0.0.1", "localhost"}


def parse_xy(raw: bytes) -> tuple[int, int]:
    if len(raw) > MAX_BODY:
        raise BadRequest()
    try:
        data = json.loads(raw.decode("utf-8"))
    except (UnicodeError, json.JSONDecodeError):
        raise BadRequest() from None
    if not isinstance(data, dict):
        raise BadRequest()
    x, y = data.get("x"), data.get("y")
    if type(x) is not int or type(y) is not int:
        raise BadRequest()
    if abs(x) > MM_LIMIT or abs(y) > MM_LIMIT:
        raise BadRequest()
    return x, y


def safe_file(root: Path, url_path: str) -> Path | None:
    raw = urllib.parse.unquote(url_path.split("?", 1)[0])
    if raw.endswith("/"):
        raw += "index.html"
    if not raw.startswith("/") or raw.startswith("//") or "\\" in raw or "\x00" in raw:
        return None
    parts = Path(raw[1:]).parts
    if not parts or any(part in {"", ".", ".."} or part.startswith(".") for part in parts):
        return None
    blocked = {"admira-vault", "session.json", "id_rsa", "credentials", ".env"}
    if any(part in blocked or part.endswith(".pem") for part in parts):
        return None
    base = root.resolve()
    candidate = (base / Path(*parts)).resolve()
    try:
        candidate.relative_to(base)
    except ValueError:
        return None
    if not candidate.is_file():
        return None
    return candidate


def make_handler(robot, static_root: Path | None = None):
    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def log_message(self, fmt: str, *args) -> None:
            return

        def do_GET(self) -> None:
            self._route("GET")

        def do_POST(self) -> None:
            self._route("POST")

        def do_OPTIONS(self) -> None:
            self._route("OPTIONS")

        def _origin(self) -> str | None:
            value = self.headers.get("Origin")
            return value.strip() if isinstance(value, str) and value.strip() else None

        def _read(self) -> bytes:
            header = self.headers.get("Content-Length")
            if header is None:
                return b""
            try:
                size = int(header)
            except ValueError:
                raise BadRequest() from None
            if size < 0 or size > MAX_BODY:
                raise BadRequest()
            return self.rfile.read(size)

        def _send(self, status: int, payload: dict, origin: str | None, extra: dict | None = None) -> None:
            raw = b"" if status == 204 else json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            if status != 204:
                self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(raw)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            if origin and origin_allowed(origin):
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Vary", "Origin")
            if extra:
                for key, value in extra.items():
                    self.send_header(key, value)
            self.end_headers()
            self.wfile.write(raw)

        def _file(self, path: str) -> bool:
            if static_root is None:
                return False
            found = safe_file(static_root, path)
            if found is None:
                return False
            raw = found.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", MIME.get(found.suffix.lower(), "application/octet-stream"))
            self.send_header("Content-Length", str(len(raw)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(raw)
            return True

        def _route(self, method: str) -> None:
            origin = self._origin()
            path = urllib.parse.urlsplit(self.path).path
            if not origin_allowed(origin):
                self._send(403, {"error": "origen_no_permitido"}, None)
                return
            if method == "OPTIONS":
                self._send(204, {}, origin, {"Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "content-type"})
                return
            try:
                if path == "/health" and method == "GET":
                    status, payload = robot.health()
                    self._send(status, payload, origin)
                    return
                if path == "/pose" and method == "GET":
                    self._send(200, robot.pose(), origin)
                    return
                if path == "/rooms" and method == "GET":
                    self._send(200, robot.rooms(), origin)
                    return
                if path == "/goto" and method == "POST":
                    x, y = parse_xy(self._read())
                    self._send(200, robot.goto(x, y), origin)
                    return
                if path == "/stop" and method == "POST":
                    self._read()
                    self._send(200, robot.stop(), origin)
                    return
            except BadRequest:
                self._send(400, {"error": "cuerpo_invalido"}, origin)
                return
            except Exception as exc:
                self._send(503, {"error": public_code(exc)}, origin)
                return
            if method == "GET" and self._file(path):
                return
            self._send(404, {"error": "no_encontrado"}, origin)

    return Handler


def bind(robot, host: str = HOST, port: int = 0, static_root: Path | None = None) -> ThreadingHTTPServer:
    if host not in {"127.0.0.1", "localhost"}:
        raise ValueError("solo_local")
    return ThreadingHTTPServer((host, port), make_handler(robot, static_root))


def main() -> None:
    port = int(os.environ.get("ROBOROCK_BRIDGE_PORT", str(DEFAULT_PORT)))
    robot = SarosRobot()
    robot.connect()
    server = bind(robot, port=port, static_root=REPO_ROOT)
    # Una línea de estado. El código de error no incluye secretos.
    state = "listo" if robot.health()[0] == 200 else robot.health()[1].get("error", "robot_no_conectado")
    bound = server.server_address[1]
    import sys

    sys.stderr.write(f"puente {state} en http://127.0.0.1:{bound}/\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()


if __name__ == "__main__":
    main()
