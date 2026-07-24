(function () {
  'use strict';

  const kernel = window.AdmiraCreditsKernel;
  if (!kernel) throw new Error('No se pudo cargar el motor de créditos.');

  const STORAGE_KEY = 'admiranext-credits-v2';
  const LEGACY_STORAGE_KEY = 'admiranext-credits-v1';
  const STORAGE_VERSION = 2;
  const canvas = document.getElementById('credits-canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const fields = {
    projectTitle: document.getElementById('project-title'),
    projectKicker: document.getElementById('project-kicker'),
    credits: document.getElementById('credits-input'),
    finalMessage: document.getElementById('final-message'),
    format: document.getElementById('format'),
    theme: document.getElementById('theme'),
    duration: document.getElementById('duration')
  };
  const durationOutput = document.getElementById('duration-output');
  const timecode = document.getElementById('timecode');
  const playPauseButton = document.getElementById('play-pause');
  const stagePlayButton = document.getElementById('stage-play');
  const exportHtmlButton = document.getElementById('export-html');
  const exportVideoButton = document.getElementById('export-video');
  const exportCancelButton = document.getElementById('export-cancel');
  const exportProgress = document.getElementById('export-progress');
  const exportProgressBar = document.getElementById('export-progress-bar');
  const exportProgressLabel = document.getElementById('export-progress-label');
  const liveStatus = document.getElementById('live-status');
  const storageStatus = document.getElementById('storage-status');
  const diagnosticsList = document.getElementById('diagnostics-list');
  const adjustDurationButton = document.getElementById('adjust-duration');
  const transcript = document.getElementById('credits-transcript');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const defaults = rawData();

  const state = {
    playing: false,
    exporting: false,
    exportCancelled: false,
    cancelExport: null,
    elapsed: 0,
    startedAt: 0,
    animationFrame: 0,
    exportFrame: 0,
    saveTimer: 0,
    lastAnalysis: null
  };

  function rawData() {
    return {
      projectTitle: fields.projectTitle.value,
      projectKicker: fields.projectKicker.value,
      credits: fields.credits.value,
      finalMessage: fields.finalMessage.value,
      format: fields.format.value,
      theme: fields.theme.value,
      duration: Number(fields.duration.value)
    };
  }

  function readData() {
    return kernel.normalizeData(rawData());
  }

  function setCanvasFormat(formatKey) {
    const format = kernel.FORMATS[formatKey] || kernel.FORMATS.wide;
    if (canvas.width !== format.width || canvas.height !== format.height) {
      canvas.width = format.width;
      canvas.height = format.height;
    }
    canvas.style.aspectRatio = `${format.width} / ${format.height}`;
  }

  function renderAt(elapsed, data) {
    const normalized = kernel.normalizeData(data || rawData());
    setCanvasFormat(normalized.format);
    return kernel.renderAt(ctx, data || rawData(), elapsed);
  }

  function formatTime(seconds) {
    const rounded = Math.max(0, Math.floor(seconds));
    return `${String(Math.floor(rounded / 60)).padStart(2, '0')}:${String(rounded % 60).padStart(2, '0')}`;
  }

  function updateTransport(elapsed, duration) {
    timecode.textContent = `${formatTime(elapsed)} / ${formatTime(duration)}`;
    playPauseButton.innerHTML = state.playing
      ? '<span aria-hidden="true">Ⅱ</span> Pausar'
      : '<span aria-hidden="true">▶</span> Reproducir';
    playPauseButton.setAttribute('aria-pressed', String(state.playing));
    playPauseButton.disabled = reduceMotion.matches;
    stagePlayButton.hidden = state.playing || elapsed > 0 || reduceMotion.matches;
  }

  function stopPlayback(resetToEnd) {
    state.playing = false;
    cancelAnimationFrame(state.animationFrame);
    if (resetToEnd) state.elapsed = readData().duration;
    const timeline = renderAt(state.elapsed);
    updateTransport(timeline.elapsed, timeline.duration);
  }

  function animationTick(now) {
    if (!state.playing || state.exporting) return;
    state.elapsed = (now - state.startedAt) / 1000;
    const timeline = renderAt(state.elapsed);
    updateTransport(timeline.elapsed, timeline.duration);
    if (state.elapsed >= timeline.duration) {
      stopPlayback(true);
      liveStatus.textContent = 'Reproducción terminada.';
      return;
    }
    state.animationFrame = requestAnimationFrame(animationTick);
  }

  function togglePlayback() {
    if (state.exporting) return;
    if (reduceMotion.matches) {
      stopPlayback(false);
      liveStatus.textContent = 'Movimiento reducido activo: se mantiene una vista estática.';
      return;
    }
    if (state.playing) {
      state.elapsed = (performance.now() - state.startedAt) / 1000;
      stopPlayback(false);
      liveStatus.textContent = 'Pausa.';
      return;
    }
    const duration = readData().duration;
    if (state.elapsed >= duration) state.elapsed = 0;
    state.playing = true;
    state.startedAt = performance.now() - state.elapsed * 1000;
    updateTransport(state.elapsed, duration);
    liveStatus.textContent = 'Reproduciendo créditos.';
    state.animationFrame = requestAnimationFrame(animationTick);
  }

  function restart() {
    state.elapsed = 0;
    if (state.playing) state.startedAt = performance.now();
    const data = readData();
    const posterTime = reduceMotion.matches ? Math.min(0.9, data.duration * 0.06) : 0;
    const timeline = renderAt(posterTime, data);
    updateTransport(0, timeline.duration);
    liveStatus.textContent = reduceMotion.matches ? 'Vista estática al inicio.' : 'Créditos al inicio.';
  }

  function safeStorage(action, key, value) {
    try {
      if (action === 'get') return { ok: true, value: localStorage.getItem(key) };
      if (action === 'set') localStorage.setItem(key, value);
      if (action === 'remove') localStorage.removeItem(key);
      return { ok: true, value: null };
    } catch (error) {
      return { ok: false, error };
    }
  }

  function storageMessage(message, failure) {
    storageStatus.textContent = message;
    storageStatus.dataset.state = failure ? 'error' : 'ok';
  }

  function saveNow() {
    const payload = JSON.stringify({ version: STORAGE_VERSION, data: rawData() });
    const result = safeStorage('set', STORAGE_KEY, payload);
    if (result.ok) storageMessage('Guardado local automático activo.', false);
    else storageMessage('No se puede guardar en este navegador; puedes seguir editando.', true);
  }

  function scheduleSave() {
    clearTimeout(state.saveTimer);
    state.saveTimer = window.setTimeout(saveNow, 250);
  }

  function validStoredData(data) {
    if (!data || typeof data !== 'object') return null;
    const normalized = kernel.normalizeData(data);
    return Object.assign({}, normalized, { credits: typeof data.credits === 'string' ? data.credits.slice(0, kernel.LIMITS.maxCharacters) : '' });
  }

  function loadSaved() {
    const current = safeStorage('get', STORAGE_KEY);
    const legacy = current.ok && !current.value ? safeStorage('get', LEGACY_STORAGE_KEY) : { ok: true, value: null };
    if (!current.ok || !legacy.ok) {
      storageMessage('El almacenamiento local no está disponible; el editor funciona sin guardado.', true);
      return;
    }
    const raw = current.value || legacy.value;
    if (!raw) {
      storageMessage('Tus cambios se guardan solo en este navegador.', false);
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version !== undefined && parsed.version !== STORAGE_VERSION) throw new Error('Versión de borrador desconocida');
      const stored = parsed && parsed.version === STORAGE_VERSION ? parsed.data : parsed;
      const data = validStoredData(stored);
      if (!data) throw new Error('Datos no válidos');
      Object.keys(fields).forEach((key) => {
        if (data[key] !== undefined) fields[key].value = data[key];
      });
      if (!current.value) {
        safeStorage('set', STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, data }));
        safeStorage('remove', LEGACY_STORAGE_KEY);
      }
      storageMessage('Borrador local recuperado.', false);
    } catch (error) {
      safeStorage('remove', STORAGE_KEY);
      safeStorage('remove', LEGACY_STORAGE_KEY);
      storageMessage('El borrador local estaba dañado y se ha descartado.', true);
    }
  }

  function clearStoredData() {
    clearTimeout(state.saveTimer);
    safeStorage('remove', STORAGE_KEY);
    safeStorage('remove', LEGACY_STORAGE_KEY);
    Object.keys(fields).forEach((key) => { fields[key].value = defaults[key]; });
    refresh({ save: false });
    storageMessage('Datos locales borrados. El formulario vuelve al ejemplo inicial.', false);
    liveStatus.textContent = 'Datos locales borrados.';
  }

  function renderDiagnostics(analysis) {
    diagnosticsList.replaceChildren();
    analysis.diagnostics.forEach((diagnostic) => {
      const item = document.createElement('li');
      item.dataset.level = diagnostic.level;
      item.textContent = `${diagnostic.line ? `Línea ${diagnostic.line}: ` : ''}${diagnostic.message}`;
      diagnosticsList.appendChild(item);
    });
    if (!analysis.diagnostics.length) {
      const item = document.createElement('li');
      item.dataset.level = 'ok';
      item.textContent = 'Contenido legible y duración proporcionada.';
      diagnosticsList.appendChild(item);
    }
    adjustDurationButton.hidden = analysis.data.duration >= analysis.recommendedDuration;
    adjustDurationButton.textContent = `Ajustar a ${analysis.recommendedDuration} s`;
  }

  function renderTranscript(analysis) {
    transcript.replaceChildren();
    const heading = document.createElement('h3');
    heading.textContent = analysis.data.projectTitle;
    transcript.appendChild(heading);
    analysis.rows.forEach((row) => {
      if (row.type === 'space') return;
      const element = document.createElement(row.type === 'section' ? 'h4' : 'p');
      element.textContent = row.type === 'pair' ? `${row.role}: ${row.name}` : row.text;
      transcript.appendChild(element);
    });
    const ending = document.createElement('p');
    ending.textContent = analysis.data.finalMessage;
    transcript.appendChild(ending);
  }

  function refresh(options) {
    stopPlayback(false);
    state.elapsed = 0;
    const analysis = kernel.analyze(rawData());
    state.lastAnalysis = analysis;
    durationOutput.value = `${analysis.data.duration} s`;
    const posterTime = Math.min(0.9, analysis.data.duration * 0.06);
    const timeline = renderAt(posterTime, rawData());
    updateTransport(0, timeline.duration);
    renderDiagnostics(analysis);
    renderTranscript(analysis);
    if (!options || options.save !== false) scheduleSave();
  }

  function slugify(text) {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'creditos';
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function recorderOptions() {
    const candidates = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4;codecs=avc1'
    ];
    const mimeType = typeof MediaRecorder.isTypeSupported === 'function'
      ? candidates.find((type) => MediaRecorder.isTypeSupported(type))
      : '';
    return mimeType ? { mimeType, videoBitsPerSecond: 10_000_000 } : { videoBitsPerSecond: 10_000_000 };
  }

  function extensionForMime(mimeType) {
    if (/mp4/i.test(mimeType)) return 'mp4';
    if (/ogg/i.test(mimeType)) return 'ogv';
    return 'webm';
  }

  function setExportProgress(percent, label) {
    const value = Math.max(0, Math.min(100, Math.round(percent)));
    exportProgressBar.style.width = `${value}%`;
    exportProgressBar.setAttribute('aria-valuenow', String(value));
    exportProgressLabel.textContent = label;
  }

  function setExportUi(active) {
    state.exporting = active;
    exportVideoButton.disabled = active;
    exportHtmlButton.disabled = active;
    exportProgress.hidden = !active;
    exportCancelButton.hidden = !active;
  }

  function abortError() {
    try { return new DOMException('Exportación cancelada.', 'AbortError'); }
    catch (_) { const error = new Error('Exportación cancelada.'); error.name = 'AbortError'; return error; }
  }

  function cancelVideoExport() {
    if (!state.exporting) return;
    state.exportCancelled = true;
    liveStatus.textContent = 'Cancelando exportación…';
    if (state.cancelExport) state.cancelExport(abortError());
  }

  async function exportVideo() {
    if (state.exporting) return;
    if (!canvas.captureStream || typeof MediaRecorder === 'undefined') {
      liveStatus.textContent = 'Este navegador no permite exportar vídeo. Usa HTML autónomo como alternativa.';
      return;
    }

    stopPlayback(false);
    setExportUi(true);
    state.exportCancelled = false;
    state.elapsed = 0;
    setExportProgress(0, 'Preparando vídeo…');
    liveStatus.textContent = 'Renderizando vídeo en tiempo real…';

    const data = readData();
    let stream = null;
    let recorder = null;
    let stopped = null;
    const chunks = [];

    try {
      setCanvasFormat(data.format);
      renderAt(0, data);
      stream = canvas.captureStream(30);
      recorder = new MediaRecorder(stream, recorderOptions());
      stopped = new Promise((resolve, reject) => {
        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size) chunks.push(event.data);
        };
        recorder.onerror = () => reject(recorder.error || new Error('MediaRecorder informó de un error.'));
        recorder.onstop = () => resolve('stopped');
      });

      const start = performance.now();
      const frames = new Promise((resolve, reject) => {
        let settled = false;
        const finish = (callback, value) => {
          if (settled) return;
          settled = true;
          state.cancelExport = null;
          callback(value);
        };
        state.cancelExport = (error) => {
          cancelAnimationFrame(state.exportFrame);
          finish(reject, error);
        };
        if (state.exportCancelled) {
          state.cancelExport(abortError());
          return;
        }
        function exportFrame(now) {
          if (state.exportCancelled) {
            finish(reject, abortError());
            return;
          }
          const elapsed = Math.min(data.duration, (now - start) / 1000);
          renderAt(elapsed, data);
          const percent = (elapsed / data.duration) * 100;
          setExportProgress(percent, `Renderizando vídeo… ${Math.round(percent)}%`);
          updateTransport(elapsed, data.duration);
          if (elapsed >= data.duration) {
            finish(resolve, 'frames');
            return;
          }
          state.exportFrame = requestAnimationFrame(exportFrame);
        }
        state.exportFrame = requestAnimationFrame(exportFrame);
      });

      recorder.start(1000);
      const outcome = await Promise.race([frames, stopped]);
      if (outcome === 'stopped') throw new Error('La grabación terminó antes de completar todos los fotogramas.');
      if (recorder.state === 'inactive') throw new Error('La grabación se detuvo antes de guardar el vídeo.');
      recorder.stop();
      await stopped;
      if (!chunks.length || !chunks.some((chunk) => chunk.size > 0)) throw new Error('El navegador no produjo datos de vídeo.');
      const type = recorder.mimeType || chunks[0].type || 'video/webm';
      const blob = new Blob(chunks, { type });
      if (!blob.size) throw new Error('El vídeo generado está vacío.');
      downloadBlob(blob, `${slugify(data.projectTitle)}-creditos.${extensionForMime(type)}`);
      liveStatus.textContent = 'Vídeo exportado correctamente.';
    } catch (error) {
      liveStatus.textContent = error && error.name === 'AbortError'
        ? 'Exportación cancelada. No se ha descargado ningún archivo.'
        : `No se pudo exportar el vídeo: ${error && error.message ? error.message : 'error desconocido'}`;
    } finally {
      state.cancelExport = null;
      cancelAnimationFrame(state.exportFrame);
      if (recorder && recorder.state && recorder.state !== 'inactive') {
        try { recorder.stop(); } catch (_) { /* cleanup best effort */ }
      }
      if (stream) stream.getTracks().forEach((track) => {
        try { track.stop(); } catch (_) { /* cleanup best effort */ }
      });
      setExportUi(false);
      state.exportCancelled = false;
      state.elapsed = data.duration;
      renderAt(state.elapsed, data);
      updateTransport(state.elapsed, data.duration);
    }
  }

  function htmlDocument(data) {
    const payload = JSON.stringify(kernel.normalizeData(data)).replace(/</g, '\\u003c');
    const factory = window.AdmiraCreditsKernelFactory.toString();
    const title = data.projectTitle.replace(/[<>&"']/g, '');
    return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><title>${title} · Créditos</title>
<style>*{box-sizing:border-box}html,body{width:100%;height:100%;margin:0;background:#000;overflow:hidden}body{display:grid;place-items:center}canvas{width:100%;height:100%;object-fit:contain}.sr{position:fixed;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}</style></head>
<body><canvas aria-label="Créditos animados"></canvas><section class="sr" aria-label="Transcripción de créditos"></section>
<script>(function(){'use strict';const K=(${factory})();const DATA=${payload};const canvas=document.querySelector('canvas');const ctx=canvas.getContext('2d',{alpha:false});const format=K.FORMATS[DATA.format];canvas.width=format.width;canvas.height=format.height;const transcript=document.querySelector('section');const parsed=K.parseCredits(DATA.credits);transcript.textContent=[DATA.projectTitle].concat(parsed.rows.filter(r=>r.type!=='space').map(r=>r.type==='pair'?r.role+': '+r.name:r.text),DATA.finalMessage).join('. ');const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;if(reduced){K.renderAt(ctx,DATA,Math.min(.9,DATA.duration*.06));return}const start=performance.now();function tick(now){K.renderAt(ctx,DATA,((now-start)/1000)%DATA.duration);requestAnimationFrame(tick)}requestAnimationFrame(tick)})();<\/script></body></html>`;
  }

  function exportHtml() {
    const data = readData();
    downloadBlob(new Blob([htmlDocument(data)], { type: 'text/html;charset=utf-8' }), `${slugify(data.projectTitle)}-creditos.html`);
    liveStatus.textContent = 'HTML autónomo exportado con el mismo motor de la previsualización.';
  }

  function loadExample() {
    fields.projectTitle.value = 'Humans × Machines';
    fields.projectKicker.value = 'AN ADMIRANEXT EXPERIENCE';
    fields.credits.value = `[A STORY BY]
Idea original | Carlos Silva
Creative direction | AdmiraNeXT

[DESIGN & TECHNOLOGY]
Physical AI | Humans + Robots
Connected spaces | XpaceOS
Orchestration | Admira

[SPECIAL THANKS]
To the people who keep asking
what comes next`;
    fields.finalMessage.value = 'KEEP MOVING';
    fields.theme.value = 'electric';
    fields.duration.value = '20';
    refresh();
    liveStatus.textContent = 'Ejemplo cargado. Puedes editar cualquier campo.';
  }

  Object.values(fields).forEach((field) => field.addEventListener('input', refresh));
  document.getElementById('credits-form').addEventListener('submit', (event) => event.preventDefault());
  document.getElementById('load-example').addEventListener('click', loadExample);
  document.getElementById('clear-data').addEventListener('click', clearStoredData);
  adjustDurationButton.addEventListener('click', () => {
    fields.duration.value = String(state.lastAnalysis.recommendedDuration);
    refresh();
    liveStatus.textContent = 'Duración ajustada para mejorar la legibilidad.';
  });
  playPauseButton.addEventListener('click', togglePlayback);
  stagePlayButton.addEventListener('click', togglePlayback);
  canvas.addEventListener('click', togglePlayback);
  document.getElementById('restart').addEventListener('click', restart);
  document.getElementById('fullscreen').addEventListener('click', () => {
    const stage = document.getElementById('stage-wrap');
    if (document.fullscreenElement) document.exitFullscreen();
    else stage.requestFullscreen().catch(() => { liveStatus.textContent = 'El navegador no permitió abrir la pantalla completa.'; });
  });
  exportHtmlButton.addEventListener('click', exportHtml);
  exportVideoButton.addEventListener('click', exportVideo);
  exportCancelButton.addEventListener('click', cancelVideoExport);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.exporting) cancelVideoExport();
    else if (document.hidden && state.playing) togglePlayback();
  });
  window.addEventListener('keydown', (event) => {
    const target = event.target instanceof Element ? event.target : document.activeElement;
    const interactive = target && target.closest('input, textarea, select, button, a, [contenteditable="true"], [role="button"]');
    if (event.code === 'Space' && !interactive && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      togglePlayback();
    }
  });
  const handleMotionPreference = () => {
    stopPlayback(false);
    refresh({ save: false });
    liveStatus.textContent = reduceMotion.matches ? 'Movimiento reducido activo: vista estática.' : 'Animación disponible.';
  };
  if (typeof reduceMotion.addEventListener === 'function') reduceMotion.addEventListener('change', handleMotionPreference);
  else if (typeof reduceMotion.addListener === 'function') reduceMotion.addListener(handleMotionPreference);

  window.AdmiraCreditsAppTestHooks = Object.freeze({
    htmlDocument,
    extensionForMime,
    recorderOptions,
    safeStorage,
    exportVideo,
    cancelVideoExport,
    getState: () => ({ playing: state.playing, exporting: state.exporting, elapsed: state.elapsed })
  });

  loadSaved();
  refresh({ save: false });
})();
