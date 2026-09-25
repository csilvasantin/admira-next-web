"""Piezas comunes del compositor de cápsulas (vídeo 9:16 + 16:9, portada, lomo, revista).

Sale de la muestra que Carlos aprobó (Jobs, /workspace/capsulas/muestra, 26-sep-2026):
mismas fuentes, misma paleta crema/oro y mismas utilidades de texto; lo que allí era
fijo para «El héroe de las mil caras» aquí lo pone el guion de cada cápsula.
"""
import io, json, os
from functools import lru_cache

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

F = os.environ.get("CAPSULAS_FUENTES", "/usr/share/fonts/truetype/sand-box/")
SERIF = F + "google/DM Serif Display/DMSerifDisplay-Regular.ttf"
SERIF_I = F + "google/DM Serif Display/DMSerifDisplay-Italic.ttf"
SC = F + "google/Cormorant SC/CormorantSC-SemiBold.ttf"
SANS = F + "custom/Source Sans Pro/SourceSansPro-Semibold.ttf"
SANS_B = F + "custom/Source Sans Pro/SourceSansPro-Bold.ttf"
SANS_R = F + "custom/Source Sans Pro/SourceSansPro-Regular.ttf"

CREAM = (246, 236, 219)
ESPRESSO = (27, 18, 12)

# Color por TEMA (las etiquetas tech/business/creativity que la cápsula ya trae, como
# en _capsule-brief.mjs). top/bottom: degradado de fondo; acento: palabra dicha, autor
# y filetes; tinte: velo de color sobre el clip en 16:9 (claro, no negro).
TEMAS = {
    "business":   {"nombre": "Negocio",     "top": (18, 44, 52),  "bottom": (40, 26, 18), "acento": (231, 178, 84),  "brillo": (214, 120, 58), "motivo": "arcos"},
    "tech":       {"nombre": "Tecnología",  "top": (16, 34, 66),  "bottom": (10, 16, 32), "acento": (126, 206, 236), "brillo": (70, 130, 220), "motivo": "reticula"},
    "creativity": {"nombre": "Creatividad", "top": (64, 22, 58),  "bottom": (34, 12, 36), "acento": (246, 150, 112), "brillo": (226, 86, 120), "motivo": "circulos"},
}


def tema(g):
    return TEMAS.get(g.get("tema"), TEMAS["business"])


def carga_guion(path):
    with open(path, encoding="utf-8") as fh:
        g = json.load(fh)
    g["_dir"] = os.path.dirname(os.path.abspath(path))
    return g


def ruta(g, p):
    return p if not p or os.path.isabs(p) else os.path.join(g["_dir"], p)


@lru_cache(None)
def font(p, s):
    return ImageFont.truetype(p, int(s))


def ease(x):
    x = max(0., min(1., x)); return x * x * (3 - 2 * x)


def fade(t, a, b, fi=0.3, fo=0.3):
    if t < a or t > b: return 0.
    return min(ease((t - a) / fi) if fi else 1, ease((b - t) / fo) if fo else 1)


def text_layer(lines, fnt, fill, spacing=1.12, align="center", shadow=10, colors=None):
    """RGBA con las líneas y sombra difusa. colors: un color por palabra (subtítulo con la palabra dicha)."""
    asc, desc = fnt.getmetrics(); lh = int((asc + desc) * spacing)
    widths = [fnt.getlength(l) for l in lines]
    tw = int(max(widths)) + 2 * shadow + 40; th = lh * len(lines) + 2 * shadow + 40
    img = Image.new("RGBA", (tw, th), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    sh = Image.new("RGBA", (tw, th), (0, 0, 0, 0)); ds = ImageDraw.Draw(sh)
    wi = 0
    for i, l in enumerate(lines):
        x0 = (tw - widths[i]) / 2 if align == "center" else shadow + 20
        y = shadow + 20 + i * lh
        if colors is None:
            ds.text((x0 + 3, y + 4), l, font=fnt, fill=(0, 0, 0, 235)); d.text((x0, y), l, font=fnt, fill=fill)
        else:
            x = x0
            for w in l.split(" "):
                ds.text((x + 3, y + 4), w, font=fnt, fill=(0, 0, 0, 235))
                d.text((x, y), w, font=fnt, fill=colors[wi]); wi += 1
                x += fnt.getlength(w + " ")
    if shadow:
        sh = sh.filter(ImageFilter.GaussianBlur(shadow / 2.2)); sh = Image.alpha_composite(sh, sh)
    return Image.alpha_composite(sh, img)


def with_alpha(im, a):
    if a >= 0.999: return im
    r, g, b, al = im.split(); al = al.point(lambda v: int(v * a)); return Image.merge("RGBA", (r, g, b, al))


def paste(base, im, cx, cy, a=1.0, anchor="c"):
    """anchor c = centro; l = borde izquierdo en cx y centrado en cy; t = centrado en cx y borde superior en cy;
    lt = esquina superior izquierda en (cx, cy)."""
    if a <= 0.003: return
    im = with_alpha(im, a)
    x = int(cx - im.width / 2) if anchor in ("c", "t") else int(cx)
    y = int(cy) if anchor in ("t", "lt") else int(cy - im.height / 2)
    l, t_ = max(0, -x), max(0, -y)
    r, b = min(im.width, base.width - x), min(im.height, base.height - y)
    if r <= l or b <= t_: return
    base.alpha_composite(im.crop((l, t_, r, b)), (x + l, y + t_))


def fit(path, lines, maxw, start, minimo=20):
    s = start
    while s > minimo and max(font(path, s).getlength(l) for l in lines) > maxw: s -= 2
    return s


def wrap_greedy(words, fnt, maxw):
    lines, cur = [], []
    for w in words:
        if cur and fnt.getlength(" ".join(cur + [w])) > maxw: lines.append(cur); cur = [w]
        else: cur.append(w)
    if cur: lines.append(cur)
    return lines


def wrap_balanced(words, fnt, maxw, max_lines=3):
    """Reparte en el menor número de líneas posible y, con ese número, lo más parejas posible."""
    if fnt.getlength(" ".join(words)) <= maxw: return [words]
    greedy = wrap_greedy(words, fnt, maxw)
    if len(greedy) != 2 or len(words) < 2: return greedy[:max_lines] if len(greedy) > max_lines else greedy
    best = None
    for k in range(1, len(words)):
        m = max(fnt.getlength(" ".join(words[:k])), fnt.getlength(" ".join(words[k:])))
        if best is None or m < best[0]: best = (m, k)
    return [words[:best[1]], words[best[1]:]] if best[0] <= maxw else greedy


def titulo_en_lineas(texto, path, maxw, start, max_lines=2, minimo=40):
    """El mayor cuerpo con el que el texto cabe en max_lines líneas de maxw."""
    words = texto.split()
    s = start
    while s > minimo:
        lines = wrap_balanced(words, font(path, s), maxw, max_lines=9)
        if len(lines) <= max_lines: return [" ".join(l) for l in lines], s
        s -= 4
    return [" ".join(l) for l in wrap_greedy(words, font(path, minimo), maxw)], minimo


def gradient(w, h, stops, color=ESPRESSO):
    ys = np.linspace(0, 1, h); a = np.interp(ys, [s[0] for s in stops], [s[1] for s in stops])
    arr = np.zeros((h, w, 4), np.uint8); arr[..., :3] = color; arr[..., 3] = (a * 255).astype(np.uint8)[:, None]
    return Image.fromarray(arr, "RGBA")


def hgradient(w, h, stops, color=ESPRESSO):
    xs = np.linspace(0, 1, w); a = np.interp(xs, [s[0] for s in stops], [s[1] for s in stops])
    arr = np.zeros((h, w, 4), np.uint8); arr[..., :3] = color; arr[..., 3] = (a * 255).astype(np.uint8)[None, :]
    return Image.fromarray(arr, "RGBA")


def vgrad_rgb(w, h, c1, c2, c3=None):
    y = np.linspace(0, 1, h)[:, None, None]
    if c3 is None: arr = np.array(c1) * (1 - y) + np.array(c2) * y
    else: arr = np.where(y < 0.5, np.array(c1) * (1 - 2 * y) + np.array(c2) * 2 * y, np.array(c2) * (2 - 2 * y) + np.array(c3) * (2 * y - 1))
    return Image.fromarray(np.repeat(arr, w, axis=1).astype(np.uint8), "RGB")


def glow(size, cx, cy, r, color, strength=1.0):
    w, h = size; yy, xx = np.mgrid[0:h, 0:w]; d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / r
    a = np.clip(np.exp(-d * d * 1.6) * strength, 0, 1)
    im = np.zeros((h, w, 4), np.uint8); im[..., :3] = color; im[..., 3] = (a * 255).astype(np.uint8)
    return Image.fromarray(im, "RGBA")


def grain(im, amt=10, seed=7):
    n = np.random.default_rng(seed).normal(0, amt, (im.height, im.width, 1))
    return Image.fromarray(np.clip(np.array(im).astype(float) + n, 0, 255).astype(np.uint8))


def rounded_card(w, h, r, fill):
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0)); ImageDraw.Draw(im).rounded_rectangle((0, 0, w - 1, h - 1), r, fill=fill); return im


def rounded_mask(w, h, r):
    m = Image.new("L", (w, h), 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, w - 1, h - 1), r, fill=255); return m


def qr_img(url, px, dark="#1b120c", light="#f6ecdb"):
    import segno
    buf = io.BytesIO(); segno.make(url, error="m").save(buf, kind="png", scale=10, border=2, dark=dark, light=light)
    buf.seek(0); return Image.open(buf).convert("RGBA").resize((px, px), Image.NEAREST)


def cover_crop(img, w, h, zoom=1.0, cx=0.5, cy=0.5):
    sw, sh = img.size; scale = max(w / sw, h / sh) * zoom
    nw, nh = max(w, int(sw * scale)), max(h, int(sh * scale))
    big = img.resize((nw, nh), Image.BILINEAR)
    x = int(min(max(0, cx * nw - w / 2), nw - w)); y = int(min(max(0, cy * nh - h / 2), nh - h))
    return big.crop((x, y, x + w, y + h))


def kenburns(img, w, h, prog, z0=1.04, z1=1.14, dx=0.0, dy=-0.02):
    return cover_crop(img, w, h, z0 + (z1 - z0) * prog, 0.5 + dx * prog, 0.5 + dy * prog)


def blur_fill(img, w, h, dark=0.45, tint=ESPRESSO, radius=3):
    sw, sh = img.size; scale = max(w / sw, h / sh)
    small = img.resize((max(1, int(sw * scale / 10)), max(1, int(sh * scale / 10))), Image.BILINEAR).filter(ImageFilter.GaussianBlur(radius))
    big = small.resize((int(sw * scale), int(sh * scale)), Image.BILINEAR)
    big = big.crop(((big.width - w) // 2, (big.height - h) // 2, (big.width - w) // 2 + w, (big.height - h) // 2 + h))
    return Image.blend(big, Image.new("RGB", (w, h), tint), dark)


def ctext(d, cx, y, s, fnt, fill, track=0):
    if track:
        tw = sum(fnt.getlength(c) for c in s) + track * (len(s) - 1); x = cx - tw / 2
        for c in s: d.text((x, y), c, font=fnt, fill=fill); x += fnt.getlength(c) + track
    else: d.text((cx - fnt.getlength(s) / 2, y), s, font=fnt, fill=fill)


def seal(d, cx, cy, r, color, fnt_small):
    d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=color, width=3)
    d.ellipse((cx - r + 8, cy - r + 8, cx + r - 8, cy + r - 8), outline=color, width=1)
    ctext(d, cx, cy - fnt_small.size * 0.62, "AdmiraNeXT", fnt_small, color)


# ---------- motivo gráfico por tema (portada, lomo y fondo de las cápsulas sin clip) ----------
def arch(d, cx, base_y, w, h, color, width):
    r = w / 2; d.arc((cx - r, base_y - h, cx + r, base_y - h + w), 180, 360, fill=color, width=width)
    d.line((cx - r, base_y - h + r, cx - r, base_y), fill=color, width=width); d.line((cx + r, base_y - h + r, cx + r, base_y), fill=color, width=width)


def motivo(im, cx, cy, escala, g, fuerte=True):
    """Dibuja el motivo del tema centrado en (cx, cy). escala 1 = el de la portada 1200x1800."""
    T = tema(g); ac = T["acento"]; d = ImageDraw.Draw(im); m = T["motivo"]; s = escala
    im.alpha_composite(glow(im.size, cx, cy, 520 * s, T["brillo"], 0.55)); im.alpha_composite(glow(im.size, cx, cy, 200 * s, ac, 0.95))
    d = ImageDraw.Draw(im)
    if m == "arcos":
        base = cy + 330 * s
        for k, (ww, hh) in enumerate([(360, 620), (470, 760), (580, 900), (690, 1040)]):
            arch(d, cx, base, ww * s, hh * s, ac + (int(230 - k * 50),), max(1, int((4 if k == 0 else 2) * s)))
        d.line((cx - 450 * s, base, cx + 450 * s, base), fill=ac + (200,), width=max(1, int(2 * s)))
    elif m == "reticula":
        for k in range(5):
            r = (150 + k * 95) * s
            d.rounded_rectangle((cx - r, cy - r, cx + r, cy + r), int(24 * s), outline=ac + (int(230 - k * 42),), width=max(1, int((4 if k == 0 else 2) * s)))
        for k in range(-4, 5):
            a = int(90 - abs(k) * 16)
            d.line((cx + k * 95 * s, cy - 560 * s, cx + k * 95 * s, cy + 560 * s), fill=ac + (max(20, a),), width=1)
            d.line((cx - 560 * s, cy + k * 95 * s, cx + 560 * s, cy + k * 95 * s), fill=ac + (max(20, a),), width=1)
    else:  # circulos
        for k, (dx, dy, r) in enumerate([(-120, -60, 250), (130, -20, 300), (0, 150, 340), (-40, -200, 180)]):
            d.ellipse((cx + (dx - r) * s, cy + (dy - r) * s, cx + (dx + r) * s, cy + (dy + r) * s), outline=ac + (int(230 - k * 40),), width=max(1, int((4 if k == 0 else 2) * s)))
    d.ellipse((cx - 70 * s, cy - 70 * s, cx + 70 * s, cy + 70 * s), fill=(255, 226, 160, 255) if m != "reticula" else (220, 244, 255, 255))
    im.alpha_composite(glow(im.size, cx, cy, 110 * s, (255, 240, 200), 0.9))


def arte(g, w, h, cy=0.40):
    """Fondo tipográfico-abstracto del tema, sin texto: para cápsulas que no tienen clip."""
    T = tema(g)
    im = vgrad_rgb(w, h, T["top"], tuple(int(c * 0.7 + e * 0.3) for c, e in zip(T["bottom"], ESPRESSO)), T["bottom"]).convert("RGBA")
    motivo(im, w / 2, h * cy, min(w / 1200, h / 1800) * 1.25, g)
    return grain(im.convert("RGB"), 5)


def una_linea(texto, path, maxw, start, minimo):
    """El texto en una línea a un cuerpo legible: si no cabe ni al mínimo, se acorta con «…»."""
    s = fit(path, [texto], maxw, start, minimo)
    f = font(path, s)
    while f.getlength(texto) > maxw and " " in texto: texto = texto.rsplit(" ", 1)[0].rstrip(",:;·") + "…"
    return texto, s


def partir_titulo(libro):
    """«Co-Intelligence: Living and Working with AI» → («Co-Intelligence», «Living and Working with AI»)."""
    if ":" in libro:
        a, b = libro.split(":", 1); return a.strip(), b.strip()
    return libro.strip(), ""
