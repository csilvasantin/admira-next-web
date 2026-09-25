#!/usr/bin/env python3
"""Guion de una cápsula a partir de su ficha del Stock.

    python3 guion.py <id-capsula> <carpeta> [--clip auto-xxxx|fichero.mp4|ninguno] [--forzar]

Escribe <carpeta>/guion.json. Sirve para CUALQUIER cápsula del Stock (literaria o no):
si el texto trae «Fuente: <libro>, de <autor>» es literaria; si no, es de conocimiento.
Si el guion ya existe NO se pisa (se pudo retocar a mano: titulares de las ideas,
título en español del libro…) salvo con --forzar.
"""
import json, os, re, sys, unicodedata, urllib.request

API = os.environ.get("STOCK_API", "https://api.admira.store")
INDICE = os.environ.get("STOCK_INDEX", "https://pub-bf043a4daa3b43b7a0b769617729d074.r2.dev/stock/index.json")
UA = {"User-Agent": "Mozilla/5.0 admiranext-capsulas"}


def get(url, binario=False):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        data = r.read()
    return data if binario else data.decode("utf-8")


def sin_acentos(t):
    return "".join(c for c in unicodedata.normalize("NFD", str(t or "")) if unicodedata.category(c) != "Mn").lower().strip()


# ---- mismo criterio que _capsule-brief.mjs (textoParaVoz / ideaPrincipal) ----
CABECERA = re.compile(r"^(?:para\s+carbono|para\s+silicio|aplicaci[oó]n|presentaci[oó]n)\s*:?\s*$", re.I)


def bloques(texto):
    out, actual = {}, None
    for bruta in str(texto or "").splitlines():
        linea = re.sub(r"^[#>\-*\s]+", "", bruta).strip()
        if CABECERA.match(linea):
            actual = sin_acentos(linea).replace("para ", "").rstrip(":").strip(); out[actual] = []; continue
        if not linea: continue
        if re.match(r"^fuente\s*:", linea, re.I): out.setdefault("fuente", []).append(linea); continue
        out.setdefault(actual or "texto", []).append(linea)
    return {k: " ".join(v).strip() for k, v in out.items()}


def frases(t):
    """Mismo criterio que partirFrases() de _capsule-brief.mjs: no rompe «EE. UU.»."""
    out = []
    for trozo in re.split(r"(?<=[.!?…])\s+", t.strip()):
        if out and (re.match(r"[a-záéíóúñü0-9(«\"]", trozo) or (re.search(r"\b[A-ZÁÉÍÓÚ]{1,3}\.$", out[-1]) and re.match(r"[A-ZÁÉÍÓÚ]{1,3}\.", trozo))):
            out[-1] += " " + trozo
        else:
            out.append(trozo)
    return [f for f in out if len(f.strip()) > 12]


def n_palabras(t):
    return len(str(t).split())


def recorta_en_pausa(frase, maxp):
    ws = frase.split(); dentro = ws[:maxp]
    for i in range(len(dentro) - 1, min(12, len(dentro) - 1) - 1, -1):
        if re.search(r"[:;,]$", dentro[i]): return re.sub(r"[:;,]$", ".", " ".join(dentro[:i + 1]))
    return " ".join(dentro) + "…"


def idea_principal(texto, maxp=40):
    fs = frases(texto)
    if not fs: return recorta_en_pausa(texto, maxp) if texto else ""
    elegida = fs[0]
    for sig in fs[1:]:
        if n_palabras(elegida) >= 15 or n_palabras(elegida) + n_palabras(sig) > maxp: break
        elegida += " " + sig
    return recorta_en_pausa(elegida, maxp) if n_palabras(elegida) > maxp else elegida



def ideas_automaticas(b, voz):
    """3 ideas a partir del propio texto. Es un punto de partida: se pueden reescribir en guion.json."""
    cands = [f for f in frases(b.get("carbono", "") or b.get("texto", "")) if f.strip() not in voz]
    pasos = re.findall(r"\d\)\s*([^;]+)", b.get("silicio", ""))
    apl = frases(b.get("aplicacion", ""))
    orden = cands[:1] + pasos[:1] + apl[:1] + cands[1:] + pasos[1:]
    ideas = []
    for f in orden:
        f = re.sub(r"^\d+\)\s*", "", f.strip()).rstrip(".")
        partes = [p.strip() for p in re.split(r"[:;,]\s+", f) if p.strip()]
        if not partes: continue
        if n_palabras(partes[0]) <= 9:
            head, resto = partes[0], ", ".join(partes[1:])
        else:  # cláusula larga: titular con las primeras palabras y el resto debajo, sin repetir
            ws = partes[0].split(); head = " ".join(ws[:6]) + "…"; resto = "…" + " ".join(ws[6:] + [", ".join(partes[1:])]).strip(", ")
        sub = " ".join(resto.split()[:14]) + ("…" if n_palabras(resto) > 14 else "") if n_palabras(resto) >= 3 else ""
        if head and head.lower() not in [i["head"].lower() for i in ideas]:
            ideas.append({"head": head[0].upper() + head[1:], "sub": sub})
        if len(ideas) == 3: break
    return ideas


def fuente(b):
    m = re.match(r"fuente\s*:\s*(.+?),\s+de\s+(.+?)\s*(?:\(|\.\s*$|$)", b.get("fuente", ""), re.I)
    return (m.group(1).strip(), m.group(2).strip()) if m else ("", "")


def tema_de(tags):
    alias = {"tech": ["tech", "tecnologia", "technology", "ia", "ai", "software", "producto"],
             "creativity": ["creativity", "creatividad", "creative", "diseno", "design", "arte"],
             "business": ["business", "negocio", "negocios", "empresa", "ventas", "estrategia", "liderazgo"]}
    ts = [sin_acentos(t) for t in tags or []]
    for k, a in alias.items():
        if any(t in a for t in ts): return k
    return "business"


CONSEJEROS = {"stevejobs": "Steve Jobs", "stevewozniak": "Steve Wozniak", "waltdisney": "Walt Disney", "georgelucas": "George Lucas"}


def clip_del_indice(items, meta):
    """El vídeo que el motor ya generó para esta cápsula: mismo título, id auto-…, más reciente."""
    t = sin_acentos(meta.get("title"))
    vs = [x for x in items if x.get("type") == "video" and str(x.get("id", "")).startswith("auto-") and sin_acentos(x.get("title")) == t]
    vs.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
    return vs[0] if vs else None


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) < 2: sys.exit(__doc__)
    cid, carpeta = args[0], args[1]
    clip_arg = sys.argv[sys.argv.index("--clip") + 1] if "--clip" in sys.argv else None
    os.makedirs(carpeta, exist_ok=True)
    destino = os.path.join(carpeta, "guion.json")
    if os.path.exists(destino) and "--forzar" not in sys.argv:
        print("guion ya existe (retocado a mano o de una vuelta anterior):", destino); return

    items = json.loads(get(INDICE))["items"]
    meta = next((x for x in items if x.get("id") == cid), None)
    if not meta or meta.get("type") not in ("capsula", "guion"): sys.exit(f"{cid}: no es una cápsula del Stock")
    texto = get(f"{API}/stock/asset/{cid}")
    b = bloques(texto)
    libro, autor = fuente(b)
    voz = idea_principal(b.get("carbono") or b.get("texto", ""))
    tags = meta.get("tags") or []
    consejero = next((CONSEJEROS[t] for t in tags if t in CONSEJEROS), "")

    clip, clip_id = None, None
    if clip_arg and clip_arg != "ninguno":
        if os.path.exists(clip_arg): clip = os.path.abspath(clip_arg)
        else: clip_id = clip_arg
    elif not clip_arg:
        c = clip_del_indice(items, meta); clip_id = c["id"] if c else None
    if clip_id:
        c = next((x for x in items if x.get("id") == clip_id), None)
        if not c: sys.exit(f"{clip_id}: no está en el índice del Stock")
        clip = os.path.join(carpeta, "clip.mp4")
        if not os.path.exists(clip):
            with open(clip, "wb") as fh: fh.write(get(c["url"], binario=True))

    titulo = (meta.get("title") or "").strip()
    g = {
        "id": cid,
        "titulo": titulo,
        "literaria": bool(libro),
        "kicker": "CÁPSULA LITERARIA" if libro else "CÁPSULA DE CONOCIMIENTO",
        # Lo que se ve en grande: el libro si es literaria; si no, el titular de la cápsula.
        "libro": libro or titulo.split(":")[0].strip(),
        "autor": autor or consejero,
        "tagline": titulo.split(":", 1)[1].strip() if ":" in titulo else "",
        "consejero": consejero,
        "tema": tema_de(tags),
        "locucion": voz,
        "ideas": ideas_automaticas(b, voz),
        "clip": os.path.relpath(clip, carpeta) if clip else None,
        "clip_id": clip_id,
        # El QR lleva a la cápsula completa (texto público del Stock).
        "qr": f"{API}/stock/asset/{cid}",
    }
    with open(destino, "w", encoding="utf-8") as fh: json.dump(g, fh, ensure_ascii=False, indent=1)
    print("ok", destino, "· clip:", clip_id or clip or "ninguno (fondo del tema + voz local)")


if __name__ == "__main__":
    main()
