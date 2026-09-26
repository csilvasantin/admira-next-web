#!/usr/bin/env python3
"""Cápsulas «¿Sabías que?» (#4415 · nota #4417): 20 s, 16:9 y 9:16 con los MISMOS tiempos al
fotograma, para tres pantallas de cartelería en sincronía detrás del mostrador (H · V · H).

    $CAPSULAS_PY_VOZ sabias.py voz     <carpeta>            # voz.wav + tiempos.json (Piper, local)
    $CAPSULAS_PY     sabias.py render  <9x16|16x9> <carpeta> <salida.mp4>
    $CAPSULAS_PY     sabias.py montaje <carpeta>            # tres-pantallas.mp4 (H · V · H)

La carpeta lleva guion.json (gancho, cifra, idea, locución por tramo, cierre, fuente, QR y
portada). Plantillas de Walt (/workspace/capsulas/sabias-que/plantillas): firma 0-3 s (la tele
se enciende y sale el «¿?»), entrada propia del tipo, gancho, cifra grande, idea, y cierre de
14 a 20 s con la portada en primer plano, la frase de cierre, el QR y la fuente. Se entiende
sin sonido: subtítulos quemados de al menos el 6 % del alto y la cifra ocupa un tercio de la
pantalla; la voz es un extra y calla en el cierre. Mismo compositor que render.py (comun.py:
fuentes, capas de texto, QR), sin gastar en xAI.
"""
import json, os, re, subprocess, sys, wave

AQUI = os.path.dirname(os.path.abspath(__file__))
FPS = 25
DUR = 20.0
T_CIERRE = 14.0
VOZ_INI, VOZ_FIN = 3.6, 13.9          # la voz arranca con el libro ya abierto y calla antes del cierre
HUECO = 0.15

# Plantillas de Walt: color del tipo, fondo y texto de la cifra.
TIPOS = {
    "literaria":  {"color": (0x4F, 0x6B, 0x3A), "detalle": (0x8A, 0x5A, 0x3B), "fondo": (0x16, 0x1D, 0x12), "cifra": (0xF2, 0xE6, 0xCF), "tinte": (0xA9, 0xC4, 0x8E)},
    "efemerides": {"color": (0xE8, 0xA3, 0x3D), "detalle": (0xE8, 0xA3, 0x3D), "fondo": (0x1A, 0x14, 0x10), "cifra": (0xE8, 0xA3, 0x3D), "tinte": (0xE8, 0xA3, 0x3D)},
    "musical":    {"color": (0xC8, 0x30, 0x2E), "detalle": (0xC8, 0x30, 0x2E), "fondo": (0x11, 0x11, 0x11), "cifra": (0xF5, 0xF0, 0xE6), "tinte": (0xE8, 0x5A, 0x55)},
}
TIPOS["efemerides-santo"] = TIPOS["efemerides"]
BLANCO = (0xF5, 0xF0, 0xE6)
NEGRO = (0x11, 0x11, 0x11)


# ---------------------------------------------------------------- voz (venv con piper)
def voz(carpeta):
    """Un tramo por fase (gancho, cifra, idea). Se acelera lo justo para que quepa entre
    VOZ_INI y VOZ_FIN; los cambios de fase del vídeo siguen a la voz y quedan en tiempos.json,
    que leen las DOS orientaciones: así la sincronía entre pantallas es al fotograma."""
    import array
    from piper import PiperVoice
    from piper.config import SynthesisConfig
    g = json.load(open(os.path.join(carpeta, "guion.json"), encoding="utf-8"))
    v = PiperVoice.load(os.environ.get("CAPSULAS_PIPER_VOZ", os.path.expanduser("~/.local/share/piper/es_ES-davefx-medium.onnx")))
    orden = ["gancho", "cifra", "idea"]

    def sintetiza(texto, ls):
        """Cláusula a cláusula: (muestras sin silencio en los bordes, [(palabra, s, e)] relativos)."""
        sr, m, pal = None, array.array("h"), []
        for c in [c for c in re.findall(r"[^,:;.!?…]+[,:;.!?…]*", texto) if c.strip()]:
            trozos = list(v.synthesize(c.strip(), syn_config=SynthesisConfig(length_scale=ls)))
            sr = sr or trozos[0].sample_rate
            a = array.array("h"); [a.extend(array.array("h", t.audio_int16_bytes)) for t in trozos]
            i0 = next((i for i, x in enumerate(a) if abs(x) > 500), 0)
            i1 = len(a) - next((i for i, x in enumerate(reversed(a)) if abs(x) > 500), 0)
            a = a[max(0, i0 - int(0.02 * sr)):min(len(a), i1 + int(0.04 * sr))]
            if m: m.extend([0] * int((0.16 if pal and pal[-1][0][-1:] in ",:;" else 0.22) * sr))
            ini = len(m) / sr; m.extend(a); fin = len(m) / sr
            ws = c.split(); peso = [len(w) + 2 for w in ws]; tot = sum(peso); t0 = ini
            for w, p in zip(ws, peso):
                t1 = t0 + (fin - ini) * p / tot; pal.append((w, round(t0, 3), round(t1, 3))); t0 = t1
        return sr, m, pal

    ls = 1.0
    while True:
        tr = {k: sintetiza(g["locucion"][k], ls) for k in orden}
        total = sum(len(m) / sr for sr, m, _ in tr.values()) + HUECO * (len(orden) - 1)
        if total <= VOZ_FIN - VOZ_INI or ls <= 0.7: break
        ls = round(ls - 0.02, 2)
    sr = tr["gancho"][0]
    # Cada tramo arranca lo más cerca posible de la tabla de Walt (gancho 3,6 · cifra 8 · idea 11)
    # sin pisar el anterior, y si el último se pasa de VOZ_FIN se adelantan hacia atrás: con una
    # locución corta el gancho no dura un segundo y la idea no se queda seis.
    dur = [len(tr[k][1]) / sr for k in orden]
    tarde = [0.0] * len(orden); tarde[-1] = VOZ_FIN - dur[-1]          # arranque más tardío posible
    for i in range(len(orden) - 2, -1, -1): tarde[i] = tarde[i + 1] - HUECO - dur[i]
    ini = []
    for i, obj in enumerate([VOZ_INI, 8.0, 11.0]):
        ini.append(max(ini[-1] + dur[i - 1] + HUECO, min(obj, tarde[i])) if ini else obj)
    out = array.array("h"); tiempos = {"length_scale": ls, "tramos": {}}
    for k, t0 in zip(orden, ini):
        _, m, pal = tr[k]
        out.extend([0] * (int(round(t0 * sr)) - len(out))); t0 = len(out) / sr
        out.extend(m)
        tiempos["tramos"][k] = {"s": round(t0, 3), "e": round(len(out) / sr, 3), "palabras": [{"w": w, "s": round(t0 + s, 3), "e": round(t0 + e, 3)} for w, s, e in pal]}
    out.extend([0] * (int(DUR * sr) - len(out)))
    bruto = os.path.join(carpeta, "voz-bruta.wav")
    with wave.open(bruto, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes(out[:int(DUR * sr)].tobytes())
    # Firma sonora corta (chasquido y zumbido de tele al encenderse) debajo de la voz: sintética, sin licencias.
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", bruto,
        "-f", "lavfi", "-i", "anoisesrc=d=0.06:c=white:a=0.5,afade=t=out:st=0.02:d=0.04,adelay=600|600",
        "-f", "lavfi", "-i", "sine=f=15625:d=1.6,volume=0.02,afade=t=in:d=0.2,afade=t=out:st=1.1:d=0.5,adelay=800|800",
        "-f", "lavfi", "-i", "sine=f=110:d=1.2,volume=0.10,afade=t=in:d=0.1,afade=t=out:st=0.6:d=0.6,adelay=1300|1300",
        "-filter_complex", "[0:a]aresample=48000[v];[1:a]aresample=48000[a];[2:a]aresample=48000[b];[3:a]aresample=48000[c];[v][a][b][c]amix=inputs=4:normalize=0,atrim=0:20",
        "-ar", "48000", "-ac", "1", os.path.join(carpeta, "voz.wav")], check=True)
    os.remove(bruto)
    fases = {"firma": 0.0, "entrada": 3.0, "gancho": 4.5,
             "cifra": round(tiempos["tramos"]["cifra"]["s"] - 0.1, 2),
             "idea": round(tiempos["tramos"]["idea"]["s"] - 0.1, 2), "cierre": T_CIERRE, "sello": DUR - 0.5, "fin": DUR}
    tiempos["fases"] = fases
    json.dump(tiempos, open(os.path.join(carpeta, "tiempos.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("ok voz · length_scale", ls, "· fases", fases)


# ---------------------------------------------------------------- render
def render(modo, carpeta, salida):
    from PIL import Image, ImageDraw, ImageFilter
    import numpy as np
    sys.path.insert(0, AQUI)
    from comun import carga_guion, ruta, font, ease, fade, text_layer, with_alpha, paste, fit, wrap_balanced, wrap_greedy, glow, grain, rounded_card, qr_img

    g = carga_guion(os.path.join(carpeta, "guion.json"))
    TI = json.load(open(os.path.join(carpeta, "tiempos.json"), encoding="utf-8"))
    F_ = TI["fases"]
    TIPO = {"efemerides-santo": "efemerides"}.get(g.get("tipo", "literaria"), g.get("tipo", "literaria"))
    TP = TIPOS[TIPO]; TINTE = TP["tinte"]
    VERDE, MADERA, FONDO, CIFRA = TP["color"], TP["detalle"], TP["fondo"], TP["cifra"]
    FD = os.environ.get("CAPSULAS_FUENTES", "/usr/share/fonts/truetype/sand-box/")
    BEBAS = FD + "google/Bebas Neue/BebasNeue-Regular.ttf"
    INTER = FD + "google/Inter/Inter-VariableFont_opsz,wght.ttf"
    VERT = modo == "9x16"
    W, H = (1080, 1920) if VERT else (1920, 1080)
    NF = int(DUR * FPS)

    def inter(size, peso="Bold"):
        f = font(INTER, size)
        try: f.set_variation_by_name(peso)
        except Exception: pass
        return f

    # ---------- fondo del contenido: oscuro del tipo con un halo del color (contraste alto) ----------
    base = Image.new("RGB", (W, H), FONDO).convert("RGBA")
    base.alpha_composite(glow((W, H), W * (0.5 if VERT else 0.3), H * (0.25 if VERT else 0.45), (900 if VERT else 1000), VERDE, 0.55))
    FONDO_IMG = grain(base.convert("RGB"), 4).convert("RGBA")

    # ---------- firma: tele retro que se enciende y «¿?» enorme ----------
    TVW, TVH = (960, 820) if VERT else (1180, 860)
    TX, TY = (W - TVW) // 2, (H - TVH) // 2 - (60 if VERT else 20)
    SX0, SY0, SX1, SY1 = TX + 70, TY + 70, TX + TVW - (70 if VERT else 250), TY + TVH - 70     # pantalla
    tv = Image.new("RGBA", (W, H), NEGRO + (255,)); d = ImageDraw.Draw(tv)
    d.rounded_rectangle((TX, TY, TX + TVW, TY + TVH), 60, fill=(0x3A, 0x2A, 0x1E, 255), outline=(0x5A, 0x42, 0x2E, 255), width=6)
    d.rounded_rectangle((TX + 18, TY + 18, TX + TVW - 18, TY + TVH - 18), 48, outline=(0x24, 0x19, 0x11, 255), width=4)
    if not VERT:   # panel de mandos a la derecha
        for k in range(2):
            cx, cy = TX + TVW - 125, TY + 220 + k * 190
            d.ellipse((cx - 55, cy - 55, cx + 55, cy + 55), fill=(0x1E, 0x16, 0x10, 255), outline=(0x8A, 0x6A, 0x4A, 255), width=4)
            d.line((cx, cy - 40, cx, cy - 10), fill=(0xC8, 0xB0, 0x90, 255), width=6)
        for k in range(6): d.line((TX + TVW - 175, TY + 560 + k * 30, TX + TVW - 75, TY + 560 + k * 30), fill=(0x1E, 0x16, 0x10, 255), width=8)
    else:
        for k in range(3):
            cx = TX + TVW / 2 + (k - 1) * 120; cy = TY + TVH + 50
            d.ellipse((cx - 30, cy - 30, cx + 30, cy + 30), fill=(0x1E, 0x16, 0x10, 255), outline=(0x8A, 0x6A, 0x4A, 255), width=3)
    d.line((TX + 160, TY + TVH, TX + 110, TY + TVH + (140 if VERT else 110)), fill=(0x3A, 0x2A, 0x1E, 255), width=16)
    d.line((TX + TVW - 160, TY + TVH, TX + TVW - 110, TY + TVH + (140 if VERT else 110)), fill=(0x3A, 0x2A, 0x1E, 255), width=16)
    SW_, SH_ = SX1 - SX0, SY1 - SY0
    smask = Image.new("L", (SW_, SH_), 0); ImageDraw.Draw(smask).rounded_rectangle((0, 0, SW_ - 1, SH_ - 1), 70, fill=255)
    yy, xx = np.mgrid[0:SH_, 0:SW_]
    vin = np.clip(1 - (((xx - SW_ / 2) / (SW_ * 0.62)) ** 2 + ((yy - SH_ / 2) / (SH_ * 0.62)) ** 2), 0, 1)
    scan = (np.sin(yy * np.pi / 2.0) * 0.5 + 0.5) * 0.18
    INTERROG = text_layer(["¿?"], font(BEBAS, int(SH_ * 0.78)), BLANCO, spacing=1.0, shadow=0)

    def pantalla_tele(t):
        """Contenido de la pantalla de la tele en t (apagada → chispazo → línea → imagen con parpadeo)."""
        scr = Image.new("RGBA", (SW_, SH_), (0x14, 0x16, 0x15, 255))
        dd = ImageDraw.Draw(scr)
        if t < 0.6:        # apagada, con un reflejo
            dd.ellipse((SW_ * 0.08, SH_ * 0.06, SW_ * 0.5, SH_ * 0.3), fill=(255, 255, 255, 10))
        elif t < 0.85:     # chispazo en el centro
            r = 6 + 60 * ease((t - 0.6) / 0.25)
            scr.alpha_composite(glow((SW_, SH_), SW_ / 2, SH_ / 2, r * 3, (255, 255, 255), 1.0))
        elif t < 1.35:     # la línea horizontal se abre
            k = ease((t - 0.85) / 0.5); hh = max(4, SH_ * k)
            dd.rectangle((0, SH_ / 2 - hh / 2, SW_, SH_ / 2 + hh / 2), fill=(0xE8, 0xE6, 0xE0, 255))
            scr.alpha_composite(glow((SW_, SH_), SW_ / 2, SH_ / 2, SW_ * 0.5, (255, 255, 255), 0.6 * (1 - k)))
        else:              # imagen: negro #111 con el «¿?» y un leve parpadeo
            scr = Image.new("RGBA", (SW_, SH_), NEGRO + (255,))
            fl = 1.0 if t > 2.0 else (0.55 if int(t * 25) % 5 == 0 else 1.0) * min(1, (t - 1.35) / 0.25)
            paste(scr, INTERROG, SW_ / 2, SH_ / 2 + SH_ * 0.02, fl)
        a = np.array(scr).astype(float)
        a[..., :3] *= (0.55 + 0.45 * vin)[..., None]; a[..., :3] *= (1 - scan)[..., None]
        scr = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGBA"); scr.putalpha(smask)
        return scr

    def firma(t):
        fr = tv.copy(); fr.alpha_composite(pantalla_tele(t), (SX0, SY0))
        if t > 1.35: fr.alpha_composite(glow((W, H), (SX0 + SX1) / 2, (SY0 + SY1) / 2, SW_ * 0.7, (200, 210, 220), 0.10))
        if t > 2.35:       # zoom hacia la pantalla: la pantalla real se convierte en la tele
            k = ease((t - 2.35) / 0.65)
            cx, cy = (SX0 + SX1) / 2, (SY0 + SY1) / 2
            s = 1 + k * (max(W / SW_, H / SH_) * 1.25 - 1)
            cw, ch = W / s, H / s
            fr = fr.crop((int(cx - cw / 2), int(cy - ch / 2), int(cx + cw / 2), int(cy + ch / 2))).resize((W, H), Image.BILINEAR)
            if k > 0.6: fr = Image.blend(fr.convert("RGB"), NEGRO_IMG, (k - 0.6) / 0.4).convert("RGBA")
        return fr
    NEGRO_IMG = Image.new("RGB", (W, H), NEGRO)

    # ---------- entrada literaria: un libro se abre de cara a cámara y sus páginas descubren el gancho ----------
    BW, BH = (980, 700) if VERT else (1400, 760)          # libro abierto (doble página)
    BX, BY = (W - BW) // 2, ((H - BH) // 2 - 200) if VERT else ((H - BH) // 2 - 40)
    PAGINA = (0xF2, 0xE6, 0xCF)
    TINTA = (0x22, 0x2A, 0x1C)
    ganchos = TI["tramos"]["gancho"]["palabras"]
    G_SIZE = 108 if VERT else 88                          # ≥ 6 % del alto al alejarse; es el subtítulo del gancho
    g_font = font(BEBAS, G_SIZE + 22)

    def libro(t):
        """Libro en t desde la entrada (0..): tapa que gira y doble página crema."""
        L = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(L)
        k = ease(t / 0.7)
        half = BW // 2
        # sombra
        sh = Image.new("RGBA", (W, H), (0, 0, 0, 0)); ImageDraw.Draw(sh).rounded_rectangle((BX - 10, BY + 30, BX + BW + 10, BY + BH + 50), 30, fill=(0, 0, 0, 170))
        L.alpha_composite(sh.filter(ImageFilter.GaussianBlur(26)))
        d = ImageDraw.Draw(L)
        # tapa de atrás (madera) y páginas derecha
        d.rounded_rectangle((BX + half - 10, BY - 14, BX + BW + 14, BY + BH + 14), 18, fill=MADERA + (255,))
        d.rectangle((BX + half, BY, BX + BW, BY + BH), fill=PAGINA + (255,))
        if k < 0.5:        # tapa cerrada girando sobre el lomo: se estrecha hacia el lomo
            cw = int(half * (1 - k / 0.5))
            d.rounded_rectangle((BX + half, BY - 14, BX + half + max(8, cw) + 14, BY + BH + 14), 18, fill=VERDE + (255,), outline=MADERA + (255,), width=6)
            if cw > 120:
                fq = font(BEBAS, int(BH * 0.42)); tw = fq.getlength("¿?")
                d.text((BX + half + (cw + 14) / 2 - tw / 2, BY + BH * 0.22), "¿?", font=fq, fill=PAGINA + (255,))
        else:              # tapa ya en el lado izquierdo, con las páginas izquierdas encima
            cw = int(half * ((k - 0.5) / 0.5))
            d.rounded_rectangle((BX + half - max(8, cw) - 14, BY - 14, BX + half + 10, BY + BH + 14), 18, fill=MADERA + (255,))
            if cw > 20: d.rectangle((BX + half - cw, BY, BX + half, BY + BH), fill=PAGINA + (255,))
        d.line((BX + half, BY, BX + half, BY + BH), fill=(0xB8, 0xA8, 0x88, 255), width=4)
        # sombra suave del pliegue
        if k >= 0.5:
            L.alpha_composite(glow((W, H), BX + half, BY + BH / 2, 80, (0x80, 0x6A, 0x50), 0.35))
        return L

    def texto_gancho(t_abs):
        """El gancho escrito en la doble página, palabra dicha en el color del tipo (sirve de subtítulo)."""
        ws = [p["w"] for p in ganchos]
        lines = wrap_balanced(ws, g_font, BW - 140, 4)
        if len(lines) > 4 or max(g_font.getlength(" ".join(l)) for l in lines) > BW - 140:
            lines = wrap_greedy(ws, g_font, BW - 140)
        activa = max([i for i, p in enumerate(ganchos) if p["s"] <= t_abs + 0.02] or [-1])
        cols = [(VERDE if i == activa else TINTA) + ((255,) if i <= activa or t_abs >= ganchos[-1]["e"] else (70,)) for i in range(len(ws))]
        return text_layer([" ".join(l) for l in lines], g_font, TINTA, colors=cols, shadow=0, spacing=1.0)

    # ---------- entradas de efemérides y musical: objeto a un lado, el gancho escrito al otro ----------
    OBJ_C, OBJ_S = ((W / 2, 640), 600) if VERT else ((470, 560), 620)
    GAN_C, GAN_W = ((W / 2, 1360), 960) if VERT else ((940, 560), 880)

    def calendario(t):
        """Taco de calendario: la hoja del día anterior se levanta y queda la fecha del día en ámbar."""
        L = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        cw, ch = int(OBJ_S * 0.82), OBJ_S
        a = ease(t / 0.3); cx, cy = OBJ_C; x0, y0 = int(cx - cw / 2), int(cy - ch / 2)
        sh = Image.new("RGBA", (W, H), (0, 0, 0, 0)); ImageDraw.Draw(sh).rounded_rectangle((x0, y0 + 24, x0 + cw, y0 + ch + 30), 30, fill=(0, 0, 0, 170))
        L.alpha_composite(sh.filter(ImageFilter.GaussianBlur(24))); d = ImageDraw.Draw(L)
        dia, mes = (g.get("entrada") or "26 SEP").split(" ", 1)
        # hoja de hoy (debajo): negro cálido con la fecha en ámbar
        d.rounded_rectangle((x0, y0, x0 + cw, y0 + ch), 30, fill=(0x2A, 0x20, 0x18, 255), outline=VERDE + (255,), width=6)
        d.rectangle((x0 + 6, y0 + 70, x0 + cw - 6, y0 + 78), fill=VERDE + (255,))
        for k in range(2):
            rx = x0 + cw * (0.3 + 0.4 * k); d.rounded_rectangle((rx - 14, y0 - 30, rx + 14, y0 + 40), 10, fill=(0x6A, 0x5A, 0x4A, 255))
        fd = font(BEBAS, int(ch * 0.56)); fm = font(BEBAS, int(ch * 0.2))
        d.text((cx - fd.getlength(dia) / 2, y0 + ch * 0.17), dia, font=fd, fill=VERDE + (255,))
        d.text((cx - fm.getlength(mes) / 2, y0 + ch * 0.7), mes, font=fm, fill=VERDE + (255,))
        # hoja de ayer (encima): se levanta por la bisagra de arriba
        k = ease((t - 0.25) / 0.55)
        if k < 1:
            hh = int((ch - 78) * (1 - k))
            if hh > 4:
                hoja = Image.new("RGBA", (cw - 12, ch - 78), (0xF2, 0xE6, 0xCF, 255)); dh = ImageDraw.Draw(hoja)
                ayer = str(int(dia) - 1) if dia.isdigit() else ""
                dh.text(((cw - 12) / 2 - fd.getlength(ayer) / 2, ch * 0.17 - 78), ayer, font=fd, fill=(0x3A, 0x30, 0x26, 255))
                dh.text(((cw - 12) / 2 - fm.getlength(mes) / 2, ch * 0.7 - 78), mes, font=fm, fill=(0x3A, 0x30, 0x26, 255))
                hoja = hoja.resize((cw - 12, hh), Image.BILINEAR)
                L.alpha_composite(hoja, (x0 + 6, y0 + 78))
        return with_alpha(L, a)

    DISCO_D = OBJ_S
    _disco = Image.new("RGBA", (DISCO_D, DISCO_D), (0, 0, 0, 0)); dd = ImageDraw.Draw(_disco)
    dd.ellipse((0, 0, DISCO_D - 1, DISCO_D - 1), fill=(0x0C, 0x0C, 0x0C, 255))
    for r in range(int(DISCO_D * 0.19), DISCO_D // 2 - 8, 7):
        c = DISCO_D / 2; dd.ellipse((c - r, c - r, c + r, c + r), outline=(0x26, 0x26, 0x26, 255) if r % 14 else (0x1A, 0x1A, 0x1A, 255), width=1)
    brillo = Image.new("RGBA", (DISCO_D, DISCO_D), (0, 0, 0, 0)); db = ImageDraw.Draw(brillo)
    db.pieslice((0, 0, DISCO_D - 1, DISCO_D - 1), 200, 235, fill=(255, 255, 255, 34)); db.pieslice((0, 0, DISCO_D - 1, DISCO_D - 1), 20, 55, fill=(255, 255, 255, 26))
    _disco.alpha_composite(brillo.filter(ImageFilter.GaussianBlur(10)))
    EL = int(DISCO_D * 0.36)
    _etiqueta = Image.new("RGBA", (EL, EL), (0, 0, 0, 0)); de = ImageDraw.Draw(_etiqueta)
    de.ellipse((0, 0, EL - 1, EL - 1), fill=VERDE + (255,))
    fq = font(BEBAS, int(EL * 0.62)); de.text((EL / 2 - fq.getlength("¿?") / 2, EL * 0.14), "¿?", font=fq, fill=BLANCO + (255,))
    de.ellipse((EL / 2 - 8, EL / 2 - 8 + EL * 0.36, EL / 2 + 8, EL / 2 + 8 + EL * 0.36), fill=(0x11, 0x11, 0x11, 255))

    def vinilo(t):
        """Un vinilo entra y empieza a girar; la etiqueta central es el «¿?»."""
        L = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        k = ease(t / 0.6); cx, cy = OBJ_C
        if VERT: cy = cy + (1 - k) * (H - cy + DISCO_D)          # entra desde abajo
        else: cx = cx - (1 - k) * (cx + DISCO_D)                  # entra desde la izquierda
        ang = -(max(0.0, t - 0.3) * 200 + 60 * max(0.0, t - 0.3) ** 2) % 360   # arranca y coge 33 rpm
        disco = _disco.copy()
        et = _etiqueta.rotate(ang, resample=Image.BICUBIC)
        disco.alpha_composite(et, ((DISCO_D - EL) // 2, (DISCO_D - EL) // 2))
        sh = Image.new("RGBA", (W, H), (0, 0, 0, 0)); ImageDraw.Draw(sh).ellipse((cx - DISCO_D / 2, cy - DISCO_D / 2 + 20, cx + DISCO_D / 2, cy + DISCO_D / 2 + 26), fill=(0, 0, 0, 160))
        L.alpha_composite(sh.filter(ImageFilter.GaussianBlur(22)))
        L.alpha_composite(glow((W, H), cx, cy, DISCO_D * 0.75, VERDE, 0.35))
        paste(L, disco, cx, cy)
        return L

    gan_font = font(BEBAS, 130 if VERT else 120)
    def texto_gancho_fondo(t_abs):
        """El gancho sobre el fondo oscuro, en claro, con la palabra dicha en el color del tipo."""
        ws = [p["w"] for p in ganchos]
        lines = wrap_balanced(ws, gan_font, GAN_W, 4)
        if max(gan_font.getlength(" ".join(l)) for l in lines) > GAN_W: lines = wrap_greedy(ws, gan_font, GAN_W)
        activa = max([i for i, p in enumerate(ganchos) if p["s"] <= t_abs + 0.02] or [-1])
        cols = [(TINTE if i == activa else BLANCO) + ((255,) if i <= activa or t_abs >= ganchos[-1]["e"] else (60,)) for i in range(len(ws))]
        return text_layer([" ".join(l) for l in lines], gan_font, BLANCO, colors=cols, shadow=12, spacing=1.0, align="center" if VERT else "left")

    # ---------- subtítulos (≥ 6 % del alto) ----------
    SUB_SIZE = int(H * 0.062) + 2
    sub_font = inter(SUB_SIZE, "Bold")
    SUB_MAXW = W - (120 if VERT else 260)
    ENLACES = {"y", "e", "o", "u", "de", "del", "que", "el", "la", "los", "las", "un", "una", "en", "a", "al", "con", "por", "para", "se", "su", "lo", "no"}

    def trozos(pal, maximo):
        out, cur = [], []
        for i, p in enumerate(pal):
            cur.append(p)
            colgada = p["w"].lower() in ENLACES and i + 1 < len(pal) and len(cur) < maximo + 1
            if colgada: continue
            if len(cur) >= maximo or (len(cur) >= 2 and p["w"][-1] in ".,:;!?…"):
                out.append(cur); cur = []
        if cur:
            if out and len(cur) < 2: out[-1] += cur
            else: out.append(cur)
        res = []
        for k, c in enumerate(out):
            fin = out[k + 1][0]["s"] - 0.05 if k + 1 < len(out) else c[-1]["e"] + 0.35
            res.append((c[0]["s"] - 0.08, fin, c))
        return res

    SUBS = []
    for k in ("cifra", "idea"):
        SUBS += trozos(TI["tramos"][k]["palabras"], 5 if VERT else 6)
    _sc = {}
    def sub_layer(ci, activa):
        if (ci, activa) not in _sc:
            ws = [p["w"] for p in SUBS[ci][2]]
            lines = wrap_balanced(ws, sub_font, SUB_MAXW, 2)
            cols = [((0xFF, 0xD9, 0x8A) + (255,)) if i == activa else (BLANCO + (255,)) for i in range(len(ws))]
            _sc[(ci, activa)] = text_layer([" ".join(l) for l in lines], sub_font, BLANCO, colors=cols, shadow=10, spacing=1.08)
        return _sc[(ci, activa)]
    SUB_Y = 1580 if VERT else 900
    banda = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(banda).rectangle((0, SUB_Y - (190 if VERT else 120), W, SUB_Y + (190 if VERT else 120)), fill=(0, 0, 0, 150))
    banda = banda.filter(ImageFilter.GaussianBlur(20))

    # ---------- piezas de contenido ----------
    PORTADA = Image.open(ruta(g, g["portada"])).convert("RGBA")
    def portada(h):
        im = PORTADA.resize((int(PORTADA.width * h / PORTADA.height), int(h)), Image.LANCZOS)
        c = Image.new("RGBA", (im.width + 80, im.height + 80), (0, 0, 0, 0))
        ImageDraw.Draw(c).rounded_rectangle((40, 52, im.width + 40, im.height + 52), 10, fill=(0, 0, 0, 190))
        c = c.filter(ImageFilter.GaussianBlur(18)); c.alpha_composite(im, (40, 40))
        ImageDraw.Draw(c).rectangle((40, 40, 40 + 14, 40 + im.height), fill=(255, 255, 255, 28))   # brillo del lomo
        return c

    # cifra: ≥ 1/3 de la pantalla
    if VERT:
        CIF_SIZE = fit(BEBAS, [g["cifra"]], 1000, 900)
        CIF = text_layer([g["cifra"]], font(BEBAS, CIF_SIZE), CIFRA, spacing=0.95, shadow=18)
        pie_f = inter(54, "SemiBold"); pie_l = wrap_balanced(g["cifra_pie"].split(), pie_f, 960, 2)
        PIE = text_layer([" ".join(l) for l in pie_l], pie_f, BLANCO, shadow=10)
        POR_CIFRA = portada(420)
    else:
        CIF_SIZE = fit(BEBAS, [g["cifra"]], 900, 640)
        CIF = text_layer([g["cifra"]], font(BEBAS, CIF_SIZE), CIFRA, spacing=0.95, shadow=18, align="left")
        pie_f = inter(48, "SemiBold"); pie_l = wrap_balanced(g["cifra_pie"].split(), pie_f, 860, 2)
        PIE = text_layer([" ".join(l) for l in pie_l], pie_f, BLANCO, shadow=10, align="left")
        POR_CIFRA = portada(650)
    CIF_MINI = text_layer([g["cifra"]], font(BEBAS, 220 if VERT else 240), CIFRA, shadow=12, align="center" if VERT else "left")
    kick_f = font(BEBAS, 76 if VERT else 70)
    KICK = text_layer(["¿SABÍAS QUE…?"], kick_f, TINTE, shadow=8, align="center" if VERT else "left")
    # idea: una flecha de la cifra al destino (sin datos nuevos: sale del guion)
    destino = g.get("idea_destino", "STAR WARS")
    DEST = text_layer([destino], font(BEBAS, fit(BEBAS, [destino], 960 if VERT else 820, 260)), BLANCO, shadow=14, align="center" if VERT else "left")

    # cierre
    todo = " ".join(g["cierre"])
    m = re.search(r"Pídelo en barra[^.]*\.?", todo)
    grande = (m.group(0) if m else "Pídelo en barra.").upper()
    resto = re.sub(r"\s+", " ", todo.replace(m.group(0), "") if m else todo).strip()
    HAS_QR = bool(g.get("qr"))
    tw_ = 980 if VERT else 640
    fg = font(BEBAS, fit(BEBAS, [grande], 980, 200) if VERT else 190)
    lg = [[grande]] if VERT else wrap_balanced(grande.split(), fg, tw_, 2)
    C1 = text_layer([" ".join(l) for l in lg], fg, CIFRA, shadow=14, align="center" if VERT else "left", spacing=0.95)
    fr_ = inter(50 if VERT else 46, "SemiBold")
    lr = []
    for frase in re.findall(r"[^.]+\.?", resto):
        if frase.strip(): lr += [" ".join(l) for l in wrap_balanced(frase.split(), fr_, tw_, 3)]
    C2 = text_layer(lr, fr_, BLANCO, shadow=10, align="center" if VERT else "left") if lr else None
    fs_ = inter(52 if VERT else 46, "Bold")
    SANTO = text_layer([" ".join(l) for l in wrap_balanced(g["santo"].split(), fs_, tw_, 2)], fs_, BLANCO, shadow=10, align="center" if VERT else "left") if g.get("santo") else None
    bloque = [x for x in (SANTO, C1, C2) if x is not None]
    if VERT:
        QR_PX = 560 if HAS_QR else 0
        y = 60; POS_TXT = []
        for x in bloque: POS_TXT.append((x, W / 2, y)); y += x.height - 20
        tope = (H - 130 - QR_PX - 30) if HAS_QR else H - 150
        POR_CIERRE_H = min(820, tope - y - 90)
        POS_POR = (W / 2, (y + tope) / 2)
        POS_QR = (W / 2, H - 130 - QR_PX / 2)
    else:
        QR_PX = 520 if HAS_QR else 0
        alto = sum(x.height - 20 for x in bloque); y = max(40, min((H - 60 - alto) / 2 - 20, H - 150 - alto)); POS_TXT = []   # por encima de la fuente
        for x in bloque: POS_TXT.append((x, 50, y)); y += x.height - 20
        POR_CIERRE_H = 720 if HAS_QR else 820
        POS_POR = (1080, 500) if HAS_QR else (1330, 500)
        POS_QR = (1640, 470)
    POR_CIERRE = portada(POR_CIERRE_H)
    if HAS_QR:
        qr = qr_img(g["qr"], QR_PX - 60, dark="#111111", light="#ffffff")
        QR = rounded_card(QR_PX, QR_PX, 28, (255, 255, 255, 255)); QR.alpha_composite(qr, (30, 30))
    QR_TXT = text_layer(["Escanéame"], inter(40 if VERT else 36, "SemiBold"), BLANCO, shadow=8)

    fuente_f = inter(26 if VERT else 24, "Regular")
    fl = wrap_greedy(g["fuente"].split(), fuente_f, 860 if VERT else 1150)
    FUENTE = with_alpha(text_layer([" ".join(l) for l in fl], fuente_f, BLANCO, shadow=4, align="left", spacing=1.1), 0.7)
    SELLO = text_layer(["¿?"], font(BEBAS, 120), BLANCO, shadow=8)

    # Posiciones (una tabla por orientación; mismos tiempos en las dos).
    if VERT:
        P = dict(kick=(W / 2, 150), cif=(W / 2, 450), pie=(W / 2, 800), por_cif=(W / 2, 1110),
                 mini=(W / 2, 250), dest=(W / 2, 760), flecha=(W / 2, 470),
                 c1=(W / 2, 180), c2=(W / 2, 320), por_cierre=(W / 2, 390 + POR_CIERRE_H / 2 + 40),
                 qr=(W / 2, 1440), qr_txt=None, fuente=(40, H - 40), sello=(W - 90, H - 90))
    else:
        P = dict(kick=(90, 120), cif=(80, 420), pie=(80, 730), por_cif=(1500, 440),
                 mini=(80, 250), dest=(80, 620), flecha=(260, 400),
                 c1=(70, 380), c2=(80, 640), por_cierre=(1010, 500),
                 qr=(1600, 470), qr_txt=(1600, 800), fuente=(70, H - 30), sello=(W - 110, 110))

    def fuente_pos(fr, a):
        x, y = P["fuente"]; paste(fr, FUENTE, x - 20, y - FUENTE.height + 20, a, "lt")

    # ---------- bucle de fotogramas ----------
    audio = os.path.join(carpeta, "voz.wav")
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
        "-i", audio, "-map", "0:v", "-map", "1:a", "-t", f"{DUR:.2f}",
        "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.1",
        "-g", str(FPS * 2), "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", salida], stdin=subprocess.PIPE)

    t_ent, t_gan, t_cif, t_ide, t_cie, t_sel = F_["entrada"], F_["gancho"], F_["cifra"], F_["idea"], F_["cierre"], F_["sello"]
    for n in range(NF):
        t = n / FPS
        if t < t_ent:
            fr = firma(t)
        else:
            fr = FONDO_IMG.copy()
            # libro + gancho: de la entrada hasta la cifra
            if t < t_cif + 0.4:
                a = 1 - ease((t - t_cif) / 0.4) if t > t_cif else 1
                if TIPO == "literaria":
                    fr.alpha_composite(with_alpha(libro(t - t_ent), a))
                    if t - t_ent > 0.55:
                        paste(fr, texto_gancho(t), BX + BW / 2, BY + BH / 2, a * ease((t - t_ent - 0.55) / 0.3))
                else:
                    fr.alpha_composite(with_alpha((calendario if TIPO == "efemerides" else vinilo)(t - t_ent), a))
                    if t - t_ent > 0.55:
                        paste(fr, texto_gancho_fondo(t), GAN_C[0] - (0 if VERT else 20), GAN_C[1], a * ease((t - t_ent - 0.55) / 0.3), "c" if VERT else "l")
                paste(fr, KICK, *P["kick"], a * ease((t - t_ent) / 0.4), "c" if VERT else "l")
                if t < t_ent + 0.35: fr = Image.blend(NEGRO_IMG, fr.convert("RGB"), ease((t - t_ent) / 0.35)).convert("RGBA")
            # cifra
            if t_cif <= t < t_ide + 0.4:
                a_in = ease((t - t_cif) / 0.35)
                if t < t_ide:
                    esc = 0.7 + 0.3 * ease((t - t_cif) / 0.45)
                    c = CIF if esc >= 0.999 else CIF.resize((int(CIF.width * esc), int(CIF.height * esc)), Image.BILINEAR)
                    paste(fr, c, *P["cif"], a_in, "c" if VERT else "l")
                    paste(fr, PIE, *P["pie"], ease((t - t_cif - 0.4) / 0.35), "c" if VERT else "l")
                    paste(fr, POR_CIFRA, P["por_cif"][0], P["por_cif"][1] + 30 * (1 - ease((t - t_cif - 0.3) / 0.5)), ease((t - t_cif - 0.3) / 0.4))
                else:
                    paste(fr, CIF, *P["cif"], 1 - ease((t - t_ide) / 0.4), "c" if VERT else "l")
                    paste(fr, POR_CIFRA, *P["por_cif"], 1)
            # idea: la cifra encoge arriba, flecha y destino; la portada se queda
            if t_ide <= t < t_cie + 0.4:
                a = ease((t - t_ide) / 0.4) * (1 - ease((t - t_cie) / 0.4) if t > t_cie else 1)
                paste(fr, CIF_MINI, *P["mini"], a, "c" if VERT else "l")
                dd = ImageDraw.Draw(fr); fx, fy = P["flecha"]
                if VERT:
                    ln = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d2 = ImageDraw.Draw(ln)
                    d2.line((fx, fy - 60, fx, fy + 70), fill=TINTE + (255,), width=12)
                    d2.polygon([(fx - 40, fy + 60), (fx + 40, fy + 60), (fx, fy + 110)], fill=TINTE + (255,))
                else:
                    ln = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d2 = ImageDraw.Draw(ln)
                    d2.line((fx - 150, fy, fx - 150, fy + 40), fill=TINTE + (255,), width=12)
                    d2.polygon([(fx - 190, fy + 30), (fx - 110, fy + 30), (fx - 150, fy + 75)], fill=TINTE + (255,))
                fr.alpha_composite(with_alpha(ln, a))
                paste(fr, DEST, *P["dest"], a * ease((t - t_ide - 0.2) / 0.35), "c" if VERT else "l")
                if t < t_cie: paste(fr, POR_CIFRA, *P["por_cif"], 1)
                else: paste(fr, POR_CIFRA, *P["por_cif"], 1 - ease((t - t_cie) / 0.3))
            # subtítulos (voz de cifra e idea; el gancho va escrito en el libro)
            vis = [(ci, s, e, c) for ci, (s, e, c) in enumerate(SUBS) if s <= t < e]
            if vis or (SUBS and SUBS[0][0] - 0.2 <= t < SUBS[-1][1] + 0.2):
                ab = min(1, ease((t - SUBS[0][0] + 0.2) / 0.3)) * (1 - ease((t - SUBS[-1][1]) / 0.2) if t > SUBS[-1][1] else 1)
                fr.alpha_composite(with_alpha(banda, ab))
            for ci, s, e, c in vis:
                act = max([i for i, p in enumerate(c) if p["s"] <= t + 0.02] or [0])
                paste(fr, sub_layer(ci, act), W / 2, SUB_Y, fade(t, s, e, 0.06, 0.06))
            # cierre
            if t >= t_cie:
                a = ease((t - t_cie) / 0.45)
                por_up = 40 * (1 - ease((t - t_cie) / 0.6))
                for k, (x, px, py) in enumerate(POS_TXT):
                    paste(fr, x, px, py, ease((t - t_cie - 0.15 * k) / 0.45), "t" if VERT else "lt")
                paste(fr, POR_CIERRE, POS_POR[0], POS_POR[1] + por_up, a)
                if HAS_QR:
                    paste(fr, QR, *POS_QR, ease((t - t_cie - 0.2) / 0.4))
                    if not VERT: paste(fr, QR_TXT, POS_QR[0], POS_QR[1] + QR_PX / 2 + 50, ease((t - t_cie - 0.4) / 0.4))
            # fuente: del segundo 8 al final, abajo a la izquierda
            if t >= 8.0: fuente_pos(fr, ease((t - 8.0) / 0.4))
            # sello final: «¿?» pequeño en la esquina
            if t >= t_sel: paste(fr, SELLO, *P["sello"], ease((t - t_sel) / 0.2))
        enc.stdin.write(fr.convert("RGB").tobytes())
    enc.stdin.close(); enc.wait()
    print("ok", salida, f"{DUR:.1f}s", f"{W}x{H}", "QR", f"{QR_PX} px" if HAS_QR else "no")


# ---------------------------------------------------------------- montaje H · V · H
def montaje(carpeta):
    """Las tres pantallas juntas, como detrás del mostrador: horizontal, vertical (centro) y
    horizontal, a la misma escala de píxel (paneles iguales, uno girado), sincronizadas al
    fotograma porque salen de los mismos tiempos. El audio es el de una sola pantalla."""
    h = os.path.join(carpeta, "capsula-16x9.mp4"); v = os.path.join(carpeta, "capsula-9x16.mp4")
    out = os.path.join(carpeta, "tres-pantallas.mp4")
    # Escala 0.5: H 960x540, V 540x960. Marco negro de 14 px por pantalla y 40 px entre pantallas.
    b, gap = 14, 40
    Wc = 2 * (960 + 2 * b) + (540 + 2 * b) + 2 * gap + 2 * 40
    Hc = 960 + 2 * b + 2 * 40
    Wc += Wc % 2; Hc += Hc % 2
    x1 = 40; x2 = x1 + 960 + 2 * b + gap; x3 = x2 + 540 + 2 * b + gap
    yH = (Hc - (540 + 2 * b)) // 2; yV = 40
    fc = (f"color=c=0x1c1814:s={Wc}x{Hc}:r={FPS}:d={DUR}[pared];"
          f"[0:v]scale=960:540,pad={960 + 2 * b}:{540 + 2 * b}:{b}:{b}:black,split[h1][h2];"
          f"[1:v]scale=540:960,pad={540 + 2 * b}:{960 + 2 * b}:{b}:{b}:black[v];"
          f"[pared][h1]overlay={x1}:{yH}[a];[a][v]overlay={x2}:{yV}[b];[b][h2]overlay={x3}:{yH},format=yuv420p[o]")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", h, "-i", v, "-filter_complex", fc, "-map", "[o]", "-map", "0:a",
                    "-t", f"{DUR}", "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out], check=True)
    print("ok", out, f"{Wc}x{Hc}")


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "voz": voz(sys.argv[2])
    elif cmd == "render": render(sys.argv[2], sys.argv[3], sys.argv[4])
    elif cmd == "montaje": montaje(sys.argv[2])
    else: sys.exit(__doc__)
