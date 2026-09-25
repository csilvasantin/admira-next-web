#!/usr/bin/env python3
"""Publica en el Stock de Pixeria las DOS versiones del vídeo de una cápsula.

    python3 publicar.py <carpeta> [--publicar]

Sin --publicar es un ensayo: enseña qué se mandaría y no toca el Stock.
Contrato que ya lee el visor de Xpaces (pixeria assets/xpaces/capsulas.mjs, mediaFor/
orientation, 26-sep-2026): el vídeo se enlaza a su cápsula con externalRef
«capsula:<id>» (y el mismo título), y la orientación va en la etiqueta
'vertical' / 'horizontal'. El Stock solo guarda 4 etiquetas: tema, capsula, orientación
y 'best' lo añade él por la calidad.
Deja <carpeta>/publicados.json con los ids para no republicar en la siguiente vuelta.
"""
import base64, json, os, sys, urllib.request

API = os.environ.get("STOCK_API", "https://api.admira.store")
MOTOR = "AdmiraNeXT · cápsula compuesta (Grok + composición)"


def payload(g, fichero, orient):
    with open(fichero, "rb") as fh: b64 = base64.b64encode(fh.read()).decode()
    return {
        "type": "video",
        "motor": MOTOR,
        "mime": "video/mp4",
        "base64": b64,
        "title": g["titulo"],
        "comment": f"{g.get('kicker', 'CÁPSULA')} · {g['libro']}" + (f" · {g['autor']}" if g.get("autor") else "")
                   + f" · versión {'vertical 9:16' if orient == 'vertical' else 'horizontal 16:9'} con título, subtítulos, ideas clave y QR.",
        "prompt": g.get("locucion", "")[:1000],
        "tags": [g.get("tema", "business"), "capsula", orient],
        "quality": "best",
        "externalRef": f"capsula:{g['id']}",
    }


def main():
    carpeta = sys.argv[1]; real = "--publicar" in sys.argv
    g = json.load(open(os.path.join(carpeta, "guion.json"), encoding="utf-8"))
    hechos_p = os.path.join(carpeta, "publicados.json")
    hechos = json.load(open(hechos_p)) if os.path.exists(hechos_p) else {}
    for orient, nombre in (("vertical", "capsula-9x16.mp4"), ("horizontal", "capsula-16x9.mp4")):
        f = os.path.join(carpeta, nombre)
        if not os.path.exists(f): sys.exit(f"falta {f}: renderiza antes")
        if orient in hechos: print(f"{orient}: ya publicado → {hechos[orient]['id']}"); continue
        p = payload(g, f, orient)
        resumen = {k: v for k, v in p.items() if k != "base64"} | {"MB": round(len(p["base64"]) * 3 / 4 / 1e6, 2)}
        if not real:
            print(f"[ensayo] {orient}:", json.dumps(resumen, ensure_ascii=False)); continue
        req = urllib.request.Request(f"{API}/stock/publish", data=json.dumps(p).encode(), method="POST",
                                     headers={"content-type": "application/json", "origin": "https://www.pixeria.com", "user-agent": "Mozilla/5.0 admiranext-capsulas"})
        with urllib.request.urlopen(req, timeout=300) as r: d = json.load(r)
        if not d.get("ok"): sys.exit(f"{orient}: el Stock rechazó la publicación: {d}")
        hechos[orient] = {"id": d["id"], "url": d["url"], "createdAt": d.get("createdAt")}
        json.dump(hechos, open(hechos_p, "w"), indent=1)
        print(f"{orient}: publicado → {d['id']} {d['url']}")


if __name__ == "__main__":
    main()
