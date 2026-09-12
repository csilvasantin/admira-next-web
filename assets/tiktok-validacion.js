// Validación del máster y elección del póster (Yokup #3199, 12-sep-2026).
//
// Regla de Carlos: el previo de un vídeo NUNCA puede ser un fotograma negro o
// sin información, y ningún máster se publica sin pasar una validación. Nació
// del «Langostino cocido» de Alcampo: el máster era correcto, pero su fotograma
// 0 era el relleno #020508 con el que se siembra el canvas antes de
// captureStream() (luma ≈ 20) y el previo del catálogo enseñaba justo ése.
//
// Este fichero es un script sin dependencias: en el navegador deja el API en
// window.AdmiraValidacionVideo y en node --test se importa y se lee de
// globalThis. Las funciones de decisión son PURAS (reciben muestras
// {t, luma, var}) para poder testearlas; el muestreo del <video> vive en
// muestrearVideo() y se prueba a mano en el creador.
(function (root) {
  'use strict';

  const LUMA_NEGRO = 16;        // luma media (0..255) por debajo de la cual no hay información
  const VARIANZA_NEGRO = 25;    // varianza por debajo de la cual el fotograma es plano
  const NEGRO_MAX_RATIO = 0.7;  // > 70 % de fotogramas negros → inválido
  const DURACION_MIN = 10;      // segundos
  const MUESTRAS_MIN = 12;
  const MARGEN_EXTREMOS = 0.8;  // segundos que se evitan al principio y al final para el póster
  const POSTER_W = 540, POSTER_H = 960;

  // Luma media y varianza de un ImageData (Rec.601 sobre RGB).
  function lumaDeImageData(data) {
    let s = 0, s2 = 0, n = 0;
    for (let i = 0; i < data.length; i += 4) {
      const y = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      s += y; s2 += y * y; n++;
    }
    if (!n) return { luma: 0, var: 0 };
    const m = s / n;
    return { luma: m, var: Math.max(0, s2 / n - m * m) };
  }

  function esNegra(m) {
    if (!m) return true;
    const luma = +m.luma, varianza = +(m.var != null ? m.var : 0);
    return !(luma >= LUMA_NEGRO) || (luma < LUMA_NEGRO + 8 && varianza < VARIANZA_NEGRO);
  }

  // Decisión pura: ¿se publica este máster?
  function evaluarMuestras(muestras, opts) {
    const o = opts || {};
    const lista = Array.isArray(muestras) ? muestras : [];
    const total = lista.length;
    const negros = lista.filter(esNegra).length;
    const duracion = (o.duracion != null && isFinite(+o.duracion)) ? +o.duracion : null;
    if (o.tienePista === false || total === 0) return { ok: false, negros, muestras: total, duracion, motivo: 'sin pista de vídeo' };
    if (duracion != null && duracion < DURACION_MIN) return { ok: false, negros, muestras: total, duracion, motivo: 'duración ' + duracion.toFixed(1) + ' s < ' + DURACION_MIN + ' s' };
    if (negros / total > NEGRO_MAX_RATIO) return { ok: false, negros, muestras: total, duracion, motivo: 'Vídeo inválido: ' + negros + '/' + total + ' fotogramas negros' };
    return { ok: true, negros, muestras: total, duracion, motivo: null };
  }

  // Índice del fotograma más representativo: luma 40..220, máxima varianza,
  // evitando los 0,8 s de cada extremo mientras haya alternativa. -1 si no hay.
  function elegirPoster(muestras, opts) {
    const o = opts || {};
    const lista = Array.isArray(muestras) ? muestras : [];
    if (!lista.length) return -1;
    const dur = (o.duracion != null && isFinite(+o.duracion)) ? +o.duracion : (lista[lista.length - 1].t != null ? lista[lista.length - 1].t : null);
    const dentro = (m) => m.t == null || dur == null || (m.t >= MARGEN_EXTREMOS && m.t <= dur - MARGEN_EXTREMOS);
    const candidatas = (pred) => lista.map((m, i) => ({ m, i })).filter((c) => !esNegra(c.m) && pred(c.m));
    const tiers = [
      candidatas((m) => dentro(m) && m.luma >= 40 && m.luma <= 220),
      candidatas((m) => m.luma >= 40 && m.luma <= 220),
      candidatas(dentro),
      candidatas(() => true),
    ];
    for (const tier of tiers) {
      if (!tier.length) continue;
      tier.sort((a, b) => ((+b.m.var || 0) - (+a.m.var || 0)) || (a.i - b.i));
      return tier[0].i;
    }
    return -1;
  }

  // Instantes de muestreo repartidos por el vídeo (≥12), sin caer en t=0.
  function instantesDeMuestreo(duracion, n) {
    const total = Math.max(MUESTRAS_MIN, n || MUESTRAS_MIN);
    const dur = (duracion != null && isFinite(+duracion) && +duracion > 0) ? +duracion : 15;
    const out = [];
    for (let i = 0; i < total; i++) out.push(+(((i + 0.5) / total) * dur).toFixed(3));
    return out;
  }

  // Duración real de un blob de MediaRecorder: el webm sale sin Duration y el
  // <video> dice Infinity; el truco estándar es pedir un seek al infinito y
  // esperar durationchange. Si no se resuelve, se usa la esperada.
  function duracionReal(video, esperada, timeoutMs) {
    return new Promise((resolve) => {
      let hecho = false;
      const fin = (d) => { if (hecho) return; hecho = true; resolve((d != null && isFinite(d) && d > 0) ? d : (esperada || null)); };
      if (isFinite(video.duration) && video.duration > 0) return fin(video.duration);
      const onChange = () => { if (isFinite(video.duration) && video.duration > 0) { video.removeEventListener('durationchange', onChange); fin(video.duration); } };
      video.addEventListener('durationchange', onChange);
      try { video.currentTime = 1e101; } catch (_) { /* algunos navegadores no lo admiten */ }
      setTimeout(() => { video.removeEventListener('durationchange', onChange); fin(null); }, timeoutMs || 2500);
    });
  }

  function seekA(video, t, timeoutMs) {
    return new Promise((resolve) => {
      let hecho = false;
      const fin = () => { if (hecho) return; hecho = true; video.removeEventListener('seeked', fin); resolve(); };
      video.addEventListener('seeked', fin);
      try { video.currentTime = t; } catch (_) { fin(); }
      setTimeout(fin, timeoutMs || 2500);
    });
  }

  // Muestrea un vídeo (blob o URL) en un <video> oculto: ≥12 fotogramas
  // repartidos, luma y varianza de cada uno sobre un canvas pequeño, y el
  // póster (JPEG 540×960, data URL) del más representativo.
  // Devuelve { muestras, duracion, tienePista, validacion, poster, posterT }.
  async function muestrearVideo(fuente, opts) {
    const o = opts || {};
    const doc = o.document || root.document;
    const video = doc.createElement('video');
    video.muted = true; video.playsInline = true; video.preload = 'auto';
    if (typeof fuente !== 'string' || !/^blob:/.test(fuente)) video.crossOrigin = 'anonymous';
    video.style.cssText = 'position:fixed;left:-9999px;top:0;width:54px;height:96px;opacity:0;pointer-events:none';
    const src = (typeof fuente === 'string') ? fuente : URL.createObjectURL(fuente);
    const propio = typeof fuente !== 'string';
    doc.body.appendChild(video);
    const analisis = doc.createElement('canvas'); analisis.width = 54; analisis.height = 96;
    const actx = analisis.getContext('2d', { willReadFrequently: true });
    try {
      await new Promise((resolve, reject) => {
        video.addEventListener('loadedmetadata', resolve, { once: true });
        video.addEventListener('error', () => reject(new Error('no se pudo decodificar el vídeo')), { once: true });
        video.src = src;
        setTimeout(() => reject(new Error('el vídeo no cargó a tiempo')), o.timeoutMs || 15000);
      });
      const tienePista = !!(video.videoWidth && video.videoHeight);
      const duracion = await duracionReal(video, o.duracionEsperada, 2500);
      const muestras = [];
      if (tienePista) {
        for (const t of instantesDeMuestreo(duracion, o.muestras)) {
          await seekA(video, t, 2500);
          try {
            actx.drawImage(video, 0, 0, analisis.width, analisis.height);
            const m = lumaDeImageData(actx.getImageData(0, 0, analisis.width, analisis.height).data);
            muestras.push({ t, luma: m.luma, var: m.var });
          } catch (e) { muestras.push({ t, luma: 0, var: 0, error: String(e && e.message || e) }); }
        }
      }
      const validacion = evaluarMuestras(muestras, { duracion, tienePista });
      let poster = null, posterT = null;
      const i = elegirPoster(muestras, { duracion });
      if (i >= 0 && tienePista) {
        posterT = muestras[i].t;
        await seekA(video, posterT, 2500);
        // Tamaño del póster: el de siempre (540×960) o el que pida quien llama
        // (másteres horizontales 16:9 → 960×540, FLT-100372).
        const c = doc.createElement('canvas');
        c.width = (o.posterW > 0 && o.posterH > 0) ? Math.round(o.posterW) : POSTER_W;
        c.height = (o.posterW > 0 && o.posterH > 0) ? Math.round(o.posterH) : POSTER_H;
        const cx = c.getContext('2d');
        cx.fillStyle = '#000'; cx.fillRect(0, 0, c.width, c.height);
        const escala = Math.max(c.width / video.videoWidth, c.height / video.videoHeight);
        const w = video.videoWidth * escala, h = video.videoHeight * escala;
        cx.drawImage(video, (c.width - w) / 2, (c.height - h) / 2, w, h);
        try { poster = c.toDataURL('image/jpeg', o.calidad || 0.82); } catch (_) { poster = null; }
      }
      return { muestras, duracion, tienePista, validacion, poster, posterT };
    } finally {
      try { video.pause(); video.removeAttribute('src'); video.load(); } catch (_) { /* limpieza */ }
      video.remove();
      if (propio) { try { URL.revokeObjectURL(src); } catch (_) { /* nada */ } }
    }
  }

  const api = {
    LUMA_NEGRO, VARIANZA_NEGRO, NEGRO_MAX_RATIO, DURACION_MIN, MUESTRAS_MIN, MARGEN_EXTREMOS, POSTER_W, POSTER_H,
    lumaDeImageData, esNegra, evaluarMuestras, elegirPoster, instantesDeMuestreo, muestrearVideo, duracionReal,
  };
  root.AdmiraValidacionVideo = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
