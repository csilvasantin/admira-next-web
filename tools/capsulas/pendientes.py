#!/usr/bin/env python3
"""Cápsulas del Stock a las que les falta alguna de las dos versiones (9:16 y 16:9).

    python3 pendientes.py [--desde AAAA-MM-DD] [--espera-min 30]

Imprime un id de cápsula por línea. Es lo que recorre capsula.sh --pendientes para que
TODA cápsula nueva, literaria o no, salga en las dos orientaciones sin que nadie lo pida
(norma de Carlos, 26-sep-2026). Lee el índice público del Stock; no escribe nada.
"""
import datetime, json, os, sys, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from guion import INDICE, UA, sin_acentos, clip_del_indice  # noqa: E402


def orient(x):
    tags = [sin_acentos(t) for t in x.get("tags") or []]
    if any(t in ("vertical", "9:16", "9x16") for t in tags): return "vertical"
    if any(t in ("horizontal", "16:9", "16x9") for t in tags): return "horizontal"
    return None


def orient_propia(c):
    tags = {sin_acentos(t) for t in c.get("tags") or []}
    return ({"vertical"} if tags & {"vertical", "9:16", "9x16"} else set()) | \
           ({"horizontal"} if tags & {"horizontal", "16:9", "16x9"} else set())


def main():
    desde = sys.argv[sys.argv.index("--desde") + 1] if "--desde" in sys.argv else "2026-09-26"
    espera = float(sys.argv[sys.argv.index("--espera-min") + 1]) if "--espera-min" in sys.argv else 30
    with urllib.request.urlopen(urllib.request.Request(INDICE, headers=UA), timeout=60) as r:
        items = json.load(r)["items"]
    for c in items:
        if c.get("type") not in ("capsula", "guion") or str(c.get("createdAt", "")) < desde: continue
        # Cápsulas que ya nacen en las dos orientaciones (las sonoras de vinilo de Xpaces,
        # que el visor compone en 16:9 y 9:16 a partir de su JSON): no son texto con ideas y
        # el guion las rechaza, así que sin este salto fallaban en cada vuelta (FLT-101096).
        if orient_propia(c) >= {"vertical", "horizontal"}: continue
        vids = [x for x in items if x.get("type") == "video" and x.get("externalRef") == f"capsula:{c['id']}"]
        tiene = {orient(v) for v in vids}
        if {"vertical", "horizontal"} <= tiene: continue
        # El motor tarda unos minutos en dejar el clip de Grok. Mientras sea reciente se
        # espera a la siguiente vuelta; pasado ese margen se compone sin clip (fondo del
        # tema + voz local) para que ninguna cápsula se quede sin sus dos versiones.
        if not clip_del_indice(items, c):
            nacida = datetime.datetime.fromisoformat(c["createdAt"].replace("Z", "+00:00"))
            if datetime.datetime.now(datetime.timezone.utc) - nacida < datetime.timedelta(minutes=espera): continue
        print(c["id"])


if __name__ == "__main__":
    main()
