#!/usr/bin/env python3
"""Portada, lomo y revista tipográficos de una cápsula (sin la portada con copyright de Blinkist).

    python3 covers.py <carpeta-con-guion.json>

Escribe en la carpeta: portada.png (1200x1800, 2:3 de libro), lomo.png (180x1800, mismo
alto que la portada) y revista.png (1200x1600). Color y motivo según el tema de la
cápsula (arcos = negocio, retícula = tecnología, círculos = creatividad). Listos para
texturizar las estanterías y el revistero del motor de Pixeria: ver README.
"""
import os, subprocess, sys
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comun import *  # noqa: E402,F401

CARPETA = sys.argv[1]
g = carga_guion(os.path.join(CARPETA, "guion.json"))
T = tema(g); AC = T["acento"]
LIBRO, AUTOR = g["libro"], g.get("autor", "")
principal, subtitulo = partir_titulo(LIBRO)
KICK = g.get("kicker", "CÁPSULA LITERARIA")


def fondo(w, h):
    return vgrad_rgb(w, h, T["top"], tuple(int(c * 0.7 + e * 0.3) for c, e in zip(T["bottom"], ESPRESSO)), ESPRESSO).convert("RGBA")


# ---------- PORTADA 1200x1800 ----------
W, H = 1200, 1800
im = fondo(W, H)
motivo(im, 600, 700, 0.9, g)
d = ImageDraw.Draw(im)
ctext(d, 600, 110, KICK, font(SANS_B, 34), AC, track=9)
d.line((470, 170, 730, 170), fill=AC + (160,), width=1)
lines, s = titulo_en_lineas(principal, SERIF, 1040, 150, 3, 70)
y = 1110
for l in lines:
    ctext(d, 600, y, l, font(SERIF, s), CREAM); y += int(s * 1.05)
if subtitulo:
    sl, ss = titulo_en_lineas(subtitulo, SERIF_I, 1000, 58, 2, 34)
    y += 10
    for l in sl: ctext(d, 600, y, l, font(SERIF_I, ss), CREAM); y += int(ss * 1.15)
if AUTOR:
    fa = font(SC, fit(SC, [AUTOR.upper()], 1000, 70)); ctext(d, 600, max(y + 30, 1480), AUTOR.upper(), fa, AC, track=6)
seal(d, 600, 1690, 70, AC, font(SERIF_I, 22))
grain(im.convert("RGB"), 7).save(os.path.join(CARPETA, "portada.png"))

# ---------- LOMO 180x1800 ----------
W2, H2 = 180, 1800
sp = fondo(W2, H2)
d = ImageDraw.Draw(sp)
d.line((14, 0, 14, H2), fill=AC + (150,), width=2); d.line((W2 - 14, 0, W2 - 14, H2), fill=AC + (150,), width=2)
mini = Image.new("RGBA", (W2, 300), (0, 0, 0, 0)); motivo(mini, 90, 150, 0.16, g); sp.alpha_composite(mini, (0, 20))
# Texto girado: se lee de arriba abajo, como en los lomos españoles e ingleses.
LARGO = 1330
t2 = AUTOR.upper()
fa = font(SC, fit(SC, [t2], 460, 44, 28)) if AUTOR else None
w2 = fa.getlength(t2) if AUTOR else 0; gap = 50 if AUTOR else 0
ft = font(SERIF, fit(SERIF, [principal], LARGO - gap - w2, 66, 26)); w1 = ft.getlength(principal)
txt = Image.new("RGBA", (LARGO + 70, W2), (0, 0, 0, 0)); dt = ImageDraw.Draw(txt)
x0 = (txt.width - (w1 + gap + w2)) / 2
dt.text((x0, W2 / 2 - ft.size * 0.62), principal, font=ft, fill=CREAM)
if AUTOR:
    dt.ellipse((x0 + w1 + gap / 2 - 5, W2 / 2 - 5, x0 + w1 + gap / 2 + 5, W2 / 2 + 5), fill=AC)
    dt.text((x0 + w1 + gap, W2 / 2 - fa.size * 0.66), t2, font=fa, fill=AC)
txt = txt.rotate(-90, expand=True)
sp.alpha_composite(txt, (0, int(300 + (1600 - 300 - txt.height) / 2)))
d = ImageDraw.Draw(sp)
seal(d, 90, 1705, 62, AC, font(SERIF_I, 17))
grain(sp.convert("RGB"), 6).save(os.path.join(CARPETA, "lomo.png"))

# ---------- REVISTA 1200x1600 ----------
W3, H3 = 1200, 1600
clip = ruta(g, g.get("clip"))
src = None
if clip:
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", "9", "-i", clip, "-frames:v", "1", "-vf", "scale=1080:1920", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
    if len(raw) == 1080 * 1920 * 3: src = Image.frombytes("RGB", (1080, 1920), raw)
if src is None: src = arte(g, 1080, 1920)
bg = cover_crop(src, W3, H3, 1.05, 0.5, 0.45).convert("RGBA")
ys = np.linspace(0, 1, H3); a = np.interp(ys, [0, 0.2, 0.34, 0.55, 0.68, 1], [0.9, 0.55, 0.0, 0.0, 0.75, 0.96])
gr = np.zeros((H3, W3, 4), np.uint8); gr[..., :3] = T["bottom"]; gr[..., 3] = (a * 255).astype(np.uint8)[:, None]
bg.alpha_composite(Image.fromarray(gr, "RGBA"))
d = ImageDraw.Draw(bg)
ctext(d, 600, 28, "Cápsula", font(SERIF, 210), CREAM)
d.line((70, 285, 1130, 285), fill=AC, width=2)
d.text((70, 298), "Nº " + str(g.get("numero", "01")).zfill(2) + " · " + g.get("fecha_revista", "SEPTIEMBRE 2026"), font=font(SANS_B, 28), fill=AC)
fr = font(SANS_B, 28); s = ("REVISTA LITERARIA" if g.get("literaria", True) else "CONOCIMIENTO") + " · ADMIRANEXT"
d.text((1130 - fr.getlength(s), 298), s, font=fr, fill=AC)
lines, hs = titulo_en_lineas(principal, SERIF, 1060, 110, 2, 60)
tag = g.get("tagline") or subtitulo
tl = wrap_balanced(tag.split(), font(SERIF_I, 38), 1060) if tag else []
alto = len(lines) * int(hs * 1.0) + 115 + len(tl) * 46
y0 = H3 - 70 - alto
ideas = [i["head"] for i in g["ideas"][:3]]
fi = font(SANS, 30)
filas = [[" ".join(l) for l in wrap_greedy(t.split(), fi, 280)][:2] for t in ideas]   # cada idea en 1-2 líneas, sin cortar
alto_filas = [26 + 38 * len(f) for f in filas]
panel_h = 30 + sum(alto_filas)


def heads(dd, c):
    y = y0
    for l in lines: dd.text((70, y), l, font=font(SERIF, hs), fill=c or CREAM); y += int(hs * 1.0)
    if AUTOR: dd.text((74, y + 40), AUTOR.upper(), font=font(SC, 52), fill=c or AC)
    y += 115
    for l in tl: dd.text((74, y), " ".join(l), font=font(SERIF_I, 38), fill=c or CREAM); y += 46
    yy = 395
    for k, f in enumerate(filas):
        dd.text((812, yy - 4), ["I", "II", "III"][k], font=font(SC, 40), fill=c or AC)
        for j, l in enumerate(f): dd.text((874, yy + j * 38), l, font=fi, fill=c or CREAM)
        yy += alto_filas[k]


pan = Image.new("RGBA", (W3, H3), (0, 0, 0, 0))
ImageDraw.Draw(pan).rounded_rectangle((790, 375, 1170, 375 + panel_h), 18, fill=T["bottom"] + (165,))
bg.alpha_composite(pan.filter(ImageFilter.GaussianBlur(2)))
sh = Image.new("RGBA", (W3, H3), (0, 0, 0, 0)); heads(ImageDraw.Draw(sh), (0, 0, 0, 230)); sh = sh.filter(ImageFilter.GaussianBlur(7))
bg.alpha_composite(sh); bg.alpha_composite(sh); heads(ImageDraw.Draw(bg), None)
seal(ImageDraw.Draw(bg), 1070, 1510, 70, AC, font(SERIF_I, 21))
grain(bg.convert("RGB"), 4).save(os.path.join(CARPETA, "revista.png"))
print("ok portada, lomo y revista en", CARPETA)
