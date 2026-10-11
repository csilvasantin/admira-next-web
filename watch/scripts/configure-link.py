#!/usr/bin/env python3
"""Receive a dedicated signed visor URL on stdin; never version or log the token."""
import base64
import json
import os
import plistlib
import sys
from pathlib import Path
from urllib.parse import urlparse, parse_qs
url = sys.stdin.read().strip()
parsed = urlparse(url)
if parsed.scheme != 'https' or parsed.path != '/pruebas/visor/' or parsed.username or parsed.password:
    raise SystemExit('Se requiere un enlace HTTPS firmado de /pruebas/visor/.')
tokens = parse_qs(parsed.query).get('t', [])
if len(tokens) != 1:
    raise SystemExit('Se requiere exactamente un token de dispositivo.')
try:
    payload = tokens[0].split('.')[0]
    expiry = json.loads(base64.urlsafe_b64decode(payload + '=' * (-len(payload) % 4)))['exp']
except Exception:
    raise SystemExit('Formato de enlace no válido.')
path = Path(__file__).resolve().parents[1] / 'Config' / 'Device.plist'
path.parent.mkdir(exist_ok=True)
with path.open('wb') as file:
    plistlib.dump({'VisorURL': url, 'LinkExpires': expiry}, file)
os.chmod(path, 0o600)
print('Configuración privada guardada; no incluida en Git.')
