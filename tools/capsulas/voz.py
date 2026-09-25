#!/usr/bin/env python3
"""Voz y tiempos palabra a palabra de una cápsula.

    $CAPSULAS_PY_VOZ voz.py <carpeta-con-guion.json>

Escribe en la carpeta:
  voz.wav        la locución (del clip de Grok si tiene voz; si no, sintetizada en local con Piper)
  palabras.json  [{"w", "s", "e"}] con los tiempos de cada palabra (faster-whisper)

Del clip se QUITA la cabecera «Para carbono…» que el motor antiguo leía en voz alta
(se silencia ese tramo y no sale en subtítulos). Las palabras se alinean con el texto
del guion para que los subtítulos salgan bien escritos (nombres propios, tildes).
Tiempos: whisper para la voz del clip; para la voz de Piper salen del propio audio.
Necesita faster-whisper y piper-tts (ver README); no gasta nada en xAI.
"""
import difflib, json, os, re, subprocess, sys, unicodedata, wave

VOZ_PIPER = os.environ.get("CAPSULAS_PIPER_VOZ", os.path.expanduser("~/.local/share/piper/es_ES-davefx-medium.onnx"))
WHISPER = os.environ.get("CAPSULAS_WHISPER", "small")


def norm(w):
    return "".join(c for c in unicodedata.normalize("NFD", w.lower()) if unicodedata.category(c) != "Mn" and c.isalnum())


def transcribe(wav):
    from faster_whisper import WhisperModel
    model = WhisperModel(WHISPER, device="cpu", compute_type="int8")
    segs, _ = model.transcribe(wav, language="es", word_timestamps=True, vad_filter=False)
    return [{"w": w.word.strip(), "s": round(w.start, 3), "e": round(w.end, 3)} for s in segs for w in (s.words or []) if w.word.strip()]


def alinea(palabras, referencia):
    """Sustituye la ortografía de whisper por la del guion donde las palabras casan."""
    ref = referencia.split()
    a, b = [norm(p["w"]) for p in palabras], [norm(r) for r in ref]
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    out = [dict(p) for p in palabras]
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal" or (tag == "replace" and i2 - i1 == j2 - j1):
            for k in range(i2 - i1): out[i1 + k]["w"] = ref[j1 + k]
    return out


def sin_cabecera(palabras):
    """Quita «Para carbono» (y variantes que oye whisper) del principio."""
    n = [norm(p["w"]) for p in palabras[:3]]
    if len(n) >= 2 and n[0] == "para" and n[1].startswith("carbon"): return palabras[2:], palabras[1]["e"]
    return palabras, 0.0


def duracion(wav):
    with wave.open(wav) as w: return w.getnframes() / w.getframerate()


def piper(texto, destino, delante=0.9):
    """Sintetiza cláusula a cláusula y devuelve los tiempos de cada palabra.

    Whisper no transcribe bien la voz sintética (con nombres en inglés llegó a devolver
    14 de 40 palabras), y aquí el texto ya se sabe: los límites de cada cláusula salen
    del propio audio y, dentro de ella, cada palabra ocupa según sus letras."""
    import array
    from piper import PiperVoice
    voz = PiperVoice.load(VOZ_PIPER)
    clausulas = [c for c in re.findall(r"[^,:;.!?…]+[,:;.!?…]*", texto) if c.strip()]
    sr = None; muestras = array.array("h"); palabras = []
    for c in clausulas:
        trozos = list(voz.synthesize(c.strip()))
        if not trozos: continue
        sr = sr or trozos[0].sample_rate
        if not muestras: muestras.extend([0] * int(delante * sr))
        ini = len(muestras) / sr
        for t in trozos: muestras.extend(array.array("h", t.audio_int16_bytes))
        fin = len(muestras) / sr
        # piper deja algo de silencio al final: la voz útil es ~el 92 % del trozo
        util = ini + (fin - ini) * 0.92
        ws = c.split(); peso = [len(w) + 2 for w in ws]; total = sum(peso); t0 = ini
        for w, pz in zip(ws, peso):
            t1 = t0 + (util - ini) * pz / total
            palabras.append({"w": w, "s": round(t0, 3), "e": round(t1, 3)}); t0 = t1
        if c.rstrip()[-1:] in ".:;!?…": muestras.extend([0] * int(0.18 * sr))
    muestras.extend([0] * int(0.3 * sr))
    with wave.open(destino, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes(muestras.tobytes())
    return palabras


def main():
    carpeta = sys.argv[1]
    g = json.load(open(os.path.join(carpeta, "guion.json"), encoding="utf-8"))
    wav = os.path.join(carpeta, "voz.wav"); bruto = os.path.join(carpeta, "voz-bruta.wav")
    palabras, origen = [], None
    if g.get("clip"):
        clip = g["clip"] if os.path.isabs(g["clip"]) else os.path.join(carpeta, g["clip"])
        r = subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", clip, "-vn", "-ac", "1", "-ar", "48000", bruto])
        if r.returncode == 0:
            palabras = transcribe(bruto)
            palabras, fin_cab = sin_cabecera(palabras)
            if len(palabras) >= 5:
                origen = "clip"
                # El tramo de la cabecera se silencia; el resto de la voz queda tal cual.
                filtro = f"volume=enable='lt(t,{fin_cab + 0.05:.2f})':volume=0" if fin_cab else "anull"
                subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", bruto, "-af", filtro, wav], check=True)
    if not origen:
        # Sin clip, o clip mudo: voz local, con casi un segundo de aire delante para
        # que el título se lea antes de que empiece a hablar.
        palabras = piper(g["locucion"], bruto)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", bruto, "-ar", "48000", "-ac", "1", wav], check=True)
        origen = "piper"
    else:
        palabras = alinea(palabras, g["locucion"])
    json.dump({"origen": origen, "duracion": round(duracion(wav), 3), "palabras": palabras},
              open(os.path.join(carpeta, "palabras.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    if os.path.exists(bruto): os.remove(bruto)
    print("ok voz", origen, len(palabras), "palabras ·", " ".join(p["w"] for p in palabras)[:120])


if __name__ == "__main__":
    main()
