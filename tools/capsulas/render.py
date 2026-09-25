#!/usr/bin/env python3
"""Vídeo de una cápsula en 9:16 o 16:9, compuesto encima del clip de Grok (o del fondo del tema).

    python3 render.py <9x16|16x9> <carpeta-con-guion.json> <salida.mp4>

Necesita en la carpeta guion.json (guion.py) y voz.wav + palabras.json (voz.py).
Estructura (#4398): título y autor al inicio · subtítulos grandes sincronizados con la
voz, con la palabra que se dice en el color del tema · 3 a 5 ideas clave en escenas ·
cierre AdmiraNeXT con QR a la cápsula completa.

16:9 (#4406, Carlos 26-sep): la pantalla del Xpacio puede estar en horizontal. Los
laterales ya no quedan oscuros y vacíos: el fondo es el propio clip ampliado, difuminado
y teñido con el color del tema (no negro), el clip vertical va en un panel a la derecha
y la columna de texto ocupa la izquierda con cuerpos pensados para una tele vista a
varios metros (subtítulos de 80 px, títulos de más de 100 px en 1080p).
"""
import json, os, subprocess, sys
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comun import *  # noqa: E402,F401

MODE, CARPETA, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
g = carga_guion(os.path.join(CARPETA, "guion.json"))
T = tema(g); AC = T["acento"]
voz = json.load(open(os.path.join(CARPETA, "palabras.json"), encoding="utf-8"))
PAL = voz["palabras"]
FPS = 24
W, H = (1080, 1920) if MODE == "9x16" else (1920, 1080)
VERT = MODE == "9x16"
ROMANOS = ["I", "II", "III", "IV", "V"]

IDEAS = g["ideas"][:5]
if len(IDEAS) < 3: sys.exit("el guion necesita al menos 3 ideas")
VOZ_FIN = max([p["e"] for p in PAL] or [voz["duracion"]])
T_IDEAS = max(VOZ_FIN + 0.45, 4.0)
IDEA_LEN = 2.9                      # algo más que en la muestra: se lee de lejos
T_CLOSE = T_IDEAS + len(IDEAS) * IDEA_LEN
DUR = T_CLOSE + 3.0
NF = int(DUR * FPS)
LIBRO, AUTOR = g["libro"], g.get("autor", "")
CABECERA = f"{LIBRO}  ·  {AUTOR}" if AUTOR else LIBRO


# ---------- subtítulos: frases cortas cortadas en las pausas de la voz ----------
# Una línea no acaba en «y», «de», «que»…: se lee mal y parece cortada.
ENLACES = {"y", "e", "o", "u", "de", "del", "que", "el", "la", "los", "las", "un", "una", "en", "a", "al", "con", "por", "para", "se", "su", "sus", "lo", "no", "ni", "como", "sin"}


def trozos(pal, maximo):
    out, cur = [], []
    for i, p in enumerate(pal):
        cur.append(p)
        pausa = i + 1 < len(pal) and pal[i + 1]["s"] - p["e"] > 0.35
        colgada = p["w"].lower().strip("«»\"'") in ENLACES and len(cur) < maximo + 2 and i + 1 < len(pal)
        if colgada: continue
        if len(cur) >= maximo or (len(cur) >= 3 and (p["w"][-1] in ".,:;!?…" or pausa)):
            out.append(cur); cur = []
    if cur:
        if out and len(cur) < 3 and len(out[-1]) + len(cur) <= maximo + 2: out[-1] += cur
        else: out.append(cur)
    subs = []
    for k, c in enumerate(out):
        ini = c[0]["s"] - 0.06
        fin = out[k + 1][0]["s"] - 0.06 if k + 1 < len(out) else min(c[-1]["e"] + 0.6, T_IDEAS - 0.05)
        subs.append((ini, fin, [(p["w"], p["s"]) for p in c]))
    return subs


SUBS = trozos(PAL, 7 if VERT else 8)


def sub_img(ci, active, size, maxw, align):
    words = [w for w, _ in SUBS[ci][2]]
    fnt = font(SANS_B, size)
    lines = wrap_balanced(words, fnt, maxw)
    colors = [AC + (255,) if i == active else CREAM + (255,) for i in range(len(words))]
    return text_layer([" ".join(l) for l in lines], fnt, CREAM, colors=colors, shadow=12, align=align)


_sub_cache = {}
def sub_cached(ci, active, size, maxw, align="center"):
    k = (ci, active, size, maxw, align)
    if k not in _sub_cache: _sub_cache[k] = sub_img(ci, active, size, maxw, align)
    return _sub_cache[k]


# ---------- fuentes de imagen: clip (o fondo del tema) y fotogramas para las ideas ----------
CLIP = ruta(g, g.get("clip"))
SW, SH = (W, H) if VERT else (540, 960)          # en 16:9 el clip va en un panel de 540x960
ARTE = None if CLIP else arte(g, 1080, 1920, 0.5)


def fotogramas(n):
    if not CLIP:
        # Sin clip: encuadres distintos del fondo del tema para que cada idea cambie de plano.
        return [cover_crop(ARTE, 1080, 1920, 1.25 + 0.1 * k, 0.5 + [-0.12, 0.12, 0.0, -0.08, 0.1][k % 5], 0.42 + 0.06 * (k % 3)) for k in range(n)]
    d = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", CLIP], capture_output=True, text=True).stdout or 15)
    out = []
    for k in range(n):
        t = d * (0.18 + 0.72 * k / max(1, n - 1))
        raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.2f}", "-i", CLIP, "-frames:v", "1", "-vf", "scale=1080:1920:flags=lanczos", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
        out.append(Image.frombytes("RGB", (1080, 1920), raw) if len(raw) == 1080 * 1920 * 3 else (out[-1] if out else Image.new("RGB", (1080, 1920), T["top"])))
    return out


STILLS = fotogramas(len(IDEAS) + 1)

if CLIP:
    dec = subprocess.Popen(["ffmpeg", "-v", "error", "-i", CLIP, "-vf", f"scale={SW}:{SH}:flags=lanczos,fps={FPS}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
last = None
def next_src(t):
    global last
    if not CLIP:
        return kenburns(ARTE, SW, SH, t / max(1, T_IDEAS), 1.02, 1.12, 0.0, -0.03)
    raw = dec.stdout.read(SW * SH * 3)
    if len(raw) == SW * SH * 3: last = Image.frombytes("RGB", (SW, SH), raw)
    return last


def idea_bg(t, w, h):
    """Fondo de ideas y cierre: fotogramas con Ken Burns y fundido entre ellos."""
    n = len(IDEAS)
    k = min(n - 1, int((t - T_IDEAS) // IDEA_LEN)) if t < T_CLOSE else n
    def still(j):
        if j < n:
            prog = (t - (T_IDEAS + j * IDEA_LEN)) / IDEA_LEN
            return kenburns(STILLS[j], w, h, max(0, min(1.3, prog)), dx=[0.02, -0.015, 0, 0.015, -0.02][j], dy=[-0.01, 0.0, -0.02, 0.01, 0][j])
        return blur_fill(STILLS[n], w, h, 0.5, T["bottom"])
    cur = still(k)
    start = T_IDEAS + k * IDEA_LEN if k < n else T_CLOSE
    if t - start < 0.35 and k > 0:
        cur = Image.blend(still(k - 1), cur, ease((t - start) / 0.35))
    return cur


def dots(L, i, cx, cy, n, step=40, r=9):
    d = ImageDraw.Draw(L)
    for k in range(n):
        x = cx + (k - (n - 1) / 2) * step
        d.ellipse((x - r, cy - r, x + r, cy + r), fill=AC + (255,) if k == i else CREAM + (110,))


# ---------- capas fijas ----------
KICK_TXT = g.get("kicker", "CÁPSULA LITERARIA")
if VERT:
    G_BOTTOM = gradient(W, H, [(0, 0.55), (0.13, 0.0), (0.52, 0.0), (0.72, 0.55), (1, 0.92)], T["bottom"])
    G_IDEA = gradient(W, H, [(0, 0.35), (0.4, 0.25), (0.62, 0.75), (1, 0.95)], T["bottom"])
    tl, ts = titulo_en_lineas(LIBRO, SERIF, 940, 132, 3)
    TITLE = text_layer(tl, font(SERIF, ts), CREAM, spacing=1.0, shadow=16)
    AUTHOR = text_layer([AUTOR.upper()], font(SC, fit(SC, [AUTOR.upper()], 940, 64)), AC, shadow=10) if AUTOR else None
    KICK = text_layer([" ".join(KICK_TXT)], font(SANS_B, 34), AC, shadow=8)
    import numpy as np
    yy, xx = np.mgrid[0:H, 0:W]; rr = np.sqrt(((xx - W / 2) / 620) ** 2 + ((yy - 760) / 400) ** 2)
    HALO = np.zeros((H, W, 4), np.uint8); HALO[..., :3] = T["bottom"]; HALO[..., 3] = (np.clip(1 - rr, 0, 1) ** 1.2 * 175).astype(np.uint8)
    HALO = Image.fromarray(HALO, "RGBA")
    _h, _s = una_linea(CABECERA, SERIF_I, 980, 44, 36); HEADER = text_layer([_h], font(SERIF_I, _s), CREAM, shadow=10)
    TITLE_H = TITLE.height
else:
    COL_X, COL_W = 100, 1080                       # columna de texto
    PX, PY = W - SW - 90, (H - SH) // 2            # panel del clip
    G_COL = hgradient(W, H, [(0, 0.82), (0.45, 0.62), (0.62, 0.25), (0.75, 0.0), (1, 0.12)], T["bottom"])
    GLOW = glow((W, H), 380, 260, 700, T["brillo"], 0.28)
    KICK = text_layer([f"{KICK_TXT}  ·  {T['nombre'].upper()}"], font(SANS_B, 38), AC, shadow=8, align="left")
    tl, ts = titulo_en_lineas(LIBRO, SERIF, COL_W, 132, 2, 72)
    TITLE = text_layer(tl, font(SERIF, ts), CREAM, spacing=1.0, shadow=16, align="left")
    AUTHOR = text_layer([AUTOR.upper()], font(SC, fit(SC, [AUTOR.upper()], COL_W, 66)), AC, shadow=10, align="left") if AUTOR else None
    _h, _s = una_linea(CABECERA, SERIF_I, COL_W, 54, 44); HEADER = text_layer([_h], font(SERIF_I, _s), CREAM, shadow=10, align="left")
    MASK = rounded_mask(SW, SH, 30)
    SHADOW = Image.new("RGBA", (SW + 120, SH + 120), (0, 0, 0, 0))
    ImageDraw.Draw(SHADOW).rounded_rectangle((60, 70, SW + 60, SH + 70), 30, fill=(0, 0, 0, 150))
    SHADOW = SHADOW.filter(ImageFilter.GaussianBlur(24))
    BORDER = Image.new("RGBA", (SW + 8, SH + 8), (0, 0, 0, 0))
    ImageDraw.Draw(BORDER).rounded_rectangle((0, 0, SW + 7, SH + 7), 34, outline=AC + (200,), width=3)

QR = qr_img(g["qr"], 420 if VERT else 440)


def closing_layer():
    L = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    etiqueta = "Cápsula literaria" if g.get("literaria", True) else "Cápsula de conocimiento"
    if VERT:
        paste(L, text_layer([etiqueta], font(SERIF, fit(SERIF, [etiqueta], 960, 96)), CREAM, shadow=14), W / 2, 470)
        paste(L, text_layer(["AdmiraNeXT"], font(SERIF_I, 80), AC, shadow=10), W / 2, 580)
        card = rounded_card(500, 500, 36, CREAM + (255,)); card.alpha_composite(QR, (40, 40))
        paste(L, card, W / 2, 980)
        paste(L, text_layer(["Escanea y léela entera"], font(SANS, 50), CREAM, shadow=10), W / 2, 1300)
        paste(L, HEADER, W / 2, 1560)
    else:
        paste(L, text_layer([etiqueta], font(SERIF, fit(SERIF, [etiqueta], 1060, 124)), CREAM, shadow=14, align="left"), COL_X - 30, 360, anchor="l")
        paste(L, text_layer(["AdmiraNeXT"], font(SERIF_I, 104), AC, shadow=10, align="left"), COL_X - 30, 500, anchor="l")
        paste(L, HEADER, COL_X - 30, 660, anchor="l")
        paste(L, text_layer(["Escanea y léela entera"], font(SANS, 56), CREAM, shadow=10, align="left"), COL_X - 30, 800, anchor="l")
        card = rounded_card(520, 520, 36, CREAM + (255,)); card.alpha_composite(QR, (40, 40))
        paste(L, card, PX + SW / 2, H / 2)
    return L


CLOSE = closing_layer()

_idea_cache = {}
def idea_layers(i):
    if i in _idea_cache: return _idea_cache[i]
    head, sub = IDEAS[i]["head"], IDEAS[i].get("sub", "")
    if VERT:
        hl, hs = titulo_en_lineas(head, SERIF, 960, 104, 3, 56)
        r = (text_layer([f"IDEA {ROMANOS[i]}"], font(SC, 62), AC, shadow=10),
             text_layer(hl, font(SERIF, hs), CREAM, spacing=1.05, shadow=16),
             text_layer([" ".join(l) for l in wrap_balanced(sub.split(), font(SANS, 56), 940)], font(SANS, 56), CREAM, shadow=12) if sub else None)
    else:
        hl, hs = titulo_en_lineas(head, SERIF, COL_W, 108, 2, 64)
        r = (text_layer([f"IDEA {ROMANOS[i]}"], font(SC, 66), AC, shadow=8, align="left"),
             text_layer(hl, font(SERIF, hs), CREAM, spacing=1.05, shadow=14, align="left"),
             text_layer([" ".join(l) for l in wrap_balanced(sub.split(), font(SANS, 60), COL_W)], font(SANS, 60), CREAM, shadow=10, align="left") if sub else None)
    _idea_cache[i] = r
    return r


def ambiente_16x9(src):
    """Fondo a toda pantalla con el propio clip: ampliado, difuminado y TEÑIDO del tema (claro, no negro)."""
    small = cover_crop(src, 192, 108, 1.0, 0.5, 0.42).filter(ImageFilter.GaussianBlur(2.2))
    big = small.resize((W, H), Image.BICUBIC)
    big = Image.blend(big, Image.new("RGB", (W, H), T["top"]), 0.30).convert("RGBA")
    big.alpha_composite(GLOW); big.alpha_composite(G_COL)
    return big


enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
    "-i", os.path.join(CARPETA, "voz.wav"), "-map", "0:v", "-map", "1:a", "-af", "apad", "-t", f"{DUR:.2f}",
    "-c:v", "libx264", "-preset", "slow", "-crf", "21", "-maxrate", "4200k", "-bufsize", "8400k",
    "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.1", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", OUT], stdin=subprocess.PIPE)

n_ideas = len(IDEAS)
for n in range(NF):
    t = n / FPS
    src = next_src(t)
    sub_alpha = []
    for ci, (s, e, ws) in enumerate(SUBS):
        if s <= t < e:
            act = max([i for i, (_, wt) in enumerate(ws) if wt <= t + 0.02] or [0])
            sub_alpha.append((ci, act, fade(t, s, e, 0.08, 0.08 if ci < len(SUBS) - 1 else 0.25)))
    in_ideas = T_IDEAS <= t < T_CLOSE
    if in_ideas:
        i = min(n_ideas - 1, int((t - T_IDEAS) // IDEA_LEN)); s0 = T_IDEAS + i * IDEA_LEN
        lab, head, sub = idea_layers(i)
        a1 = fade(t, s0, s0 + IDEA_LEN, 0.25, 0.25); a2 = fade(t, s0 + 0.3, s0 + IDEA_LEN, 0.3, 0.25)
        up = 24 * (1 - ease((t - s0) / 0.5))

    if VERT:
        if t < T_IDEAS: bg = src.copy()
        else:
            bg = idea_bg(t, W, H)
            if t < T_IDEAS + 0.35: bg = Image.blend(src, bg, ease((t - T_IDEAS) / 0.35))
        fr = bg.convert("RGBA")
        if t < T_IDEAS + 0.3:
            fr.alpha_composite(with_alpha(G_BOTTOM, 1 - ease((t - T_IDEAS) / 0.3)) if t > T_IDEAS else G_BOTTOM)
        a = fade(t, 0.0, 3.4, 0.5, 0.5)
        if a:
            rise = 30 * (1 - ease(t / 0.8)); top = 760 - TITLE_H / 2
            fr.alpha_composite(with_alpha(HALO, a))
            paste(fr, KICK, W / 2, top - 40 + rise, a); paste(fr, TITLE, W / 2, 760 + rise, a)
            if AUTHOR: paste(fr, AUTHOR, W / 2, top + TITLE_H + 40 + rise, a)
        a = fade(t, 3.2, T_IDEAS, 0.5, 0.3)
        if a: paste(fr, HEADER, W / 2, 150, a)
        for ci, act, a in sub_alpha: paste(fr, sub_cached(ci, act, 76, 920), W / 2, 1540, a)
        if in_ideas:
            fr.alpha_composite(with_alpha(G_IDEA, ease((t - T_IDEAS) / 0.4)))
            paste(fr, lab, W / 2, 1110 + up, a1); paste(fr, head, W / 2, 1180 + up, a1, "t")
            if sub: paste(fr, sub, W / 2, 1180 + head.height + 10 + up, a2, "t")
            ov = Image.new("RGBA", (W, H), (0, 0, 0, 0)); dots(ov, i, W / 2, 1780, n_ideas); fr.alpha_composite(with_alpha(ov, a1))
            paste(fr, HEADER, W / 2, 150, fade(t, T_IDEAS - 0.3, T_CLOSE, 0.01, 0.3))
    else:
        panel = src if t < T_IDEAS else idea_bg(t, SW, SH)
        if T_IDEAS <= t < T_IDEAS + 0.35: panel = Image.blend(src, panel, ease((t - T_IDEAS) / 0.35))
        fr = ambiente_16x9(panel)
        pa = 1 - ease((t - T_CLOSE + 0.1) / 0.45) if t >= T_CLOSE - 0.1 else 1
        if pa > 0.01:
            p = panel.convert("RGBA"); p.putalpha(MASK)
            fr.alpha_composite(with_alpha(SHADOW, pa), (PX - 60, PY - 60))
            paste(fr, p, PX, PY + SH / 2, pa, "l"); paste(fr, BORDER, PX - 4, PY + SH / 2, pa, "l")
        # columna izquierda: título mientras habla la voz
        a = fade(t, 0.0, T_IDEAS, 0.6, 0.35)
        if a:
            ttop = 175
            paste(fr, KICK, COL_X - 30, 120, a, "l")
            paste(fr, TITLE, COL_X - 30, ttop + TITLE.height / 2, a, "l")
            if AUTHOR: paste(fr, AUTHOR, COL_X - 30, ttop + TITLE.height + 30, a, "l")
        for ci, act, a in sub_alpha: paste(fr, sub_cached(ci, act, 80, COL_W, "left"), COL_X - 30, 880, a, "l")
        if in_ideas:
            ha = fade(t, T_IDEAS - 0.2, T_CLOSE, 0.3, 0.3)
            paste(fr, KICK, COL_X - 30, 120, ha, "l"); paste(fr, HEADER, COL_X - 30, 200, ha, "l")
            paste(fr, lab, COL_X - 30, 330 + up, a1, "l"); paste(fr, head, COL_X - 30, 370 + up, a1, "lt")
            if sub: paste(fr, sub, COL_X - 30, 370 + head.height - 10 + up, a2, "lt")
            # los puntos de avance van junto al rótulo IDEA, lejos del texto
            ov = Image.new("RGBA", (W, H), (0, 0, 0, 0)); dots(ov, i, COL_X + lab.width - 10 + (n_ideas - 1) * 22, 330, n_ideas, 44, 10)
            fr.alpha_composite(with_alpha(ov, a1))
    if t >= T_CLOSE - 0.1:
        fr.alpha_composite(with_alpha(CLOSE, ease((t - T_CLOSE + 0.1) / 0.45)))
    enc.stdin.write(fr.convert("RGB").tobytes())

enc.stdin.close(); enc.wait()
if CLIP: dec.kill()
print("ok", OUT, f"{DUR:.1f}s")
