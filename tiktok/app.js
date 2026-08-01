(function () {
  'use strict';

  const core = window.TikTokCore;
  if (!core) return;

  const $ = (selector) => document.querySelector(selector);
  const form = $('#generatorForm');
  const stage = $('#phoneStage');
  const sceneCopy = $('.scene-copy');
  const sceneLabel = $('#sceneLabel');
  const sceneHeadline = $('#sceneHeadline');
  const sceneBody = $('#sceneBody');
  const proofChip = $('#proofChip');
  const progress = $('#videoProgress');
  const timecode = $('#timecode');
  const playPause = $('#playPause');
  const exportVideo = $('#exportVideo');
  const exportStatus = $('#exportStatus');
  const storyboard = $('#storyboard');
  const scriptText = $('#scriptText');
  const wordCount = $('#wordCount');
  const paceStatus = $('#paceStatus');
  const voiceButton = $('#toggleSound');
  const previewTitle = $('#previewTitle');
  const modeInputs = Array.from(document.querySelectorAll('input[name="productionMode"]'));
  const motionTransport = $('#motionTransport');
  const grokStudio = $('#grokStudio');
  const grokPrompt = $('#grokPrompt');
  const grokResolution = $('#grokResolution');
  const generateGrokButton = $('#generateGrokVideo');
  const grokJob = $('#grokJob');
  const grokJobLabel = $('#grokJobLabel');
  const grokJobPercent = $('#grokJobPercent');
  const grokJobDetail = $('#grokJobDetail');
  const grokProgress = $('#grokProgress');
  const grokVideo = $('#grokVideo');
  const grokResultActions = $('#grokResultActions');
  const openGrokVideo = $('#openGrokVideo');
  const copyGrokUrl = $('#copyGrokUrl');
  const grokAccess = $('#grokAccess');
  const pixeriaBridge = $('#pixeriaBridge');
  const pixeriaLabel = $('#pixeriaLabel');
  const pixeriaDetail = $('#pixeriaDetail');
  const openPixeriaAsset = $('#openPixeriaAsset');
  const retryPixeria = $('#retryPixeria');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const STORAGE_KEY = 'admiranext:tiktok15:brief:v1';
  const GROK_JOB_KEY = 'admiranext:tiktok15:grok-job:v1';

  let variation = 0;
  let plan = null;
  let playing = !reduceMotion.matches;
  let startedAt = performance.now();
  let pausedAt = 0;
  let renderedSceneId = '';
  let animationFrame = 0;
  let grokPollTimer = 0;
  let grokPolling = false;
  let grokVideoUrl = '';
  let grokRequestId = '';

  const example = {
    task: 'Encontrar las acciones importantes dentro de un PDF largo',
    solution: 'Súbelo a NotebookLM y pregunta: ¿cuáles son las tres acciones?',
    result: 'Un documento largo convertido en un plan claro',
    presenter: 'fusion',
    tone: 'energetic',
    audience: 'Personas que quieren ahorrar tiempo',
    cta: 'Guárdalo y pruébalo hoy'
  };

  function readForm() {
    const data = new FormData(form);
    return Object.fromEntries(data.entries());
  }

  function writeForm(data) {
    Object.entries(data || {}).forEach(([key, value]) => {
      const field = form.elements.namedItem(key);
      if (field && typeof value === 'string') field.value = value;
    });
  }

  function saveDraft() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(readForm())); } catch (_) { /* Device-local persistence is optional. */ }
  }

  function loadDraft() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved && typeof saved === 'object') writeForm(saved);
    } catch (_) { /* Ignore malformed local data. */ }
  }

  function formatTime(seconds) {
    const safe = Math.max(0, Math.min(15, seconds));
    return `00:${safe.toFixed(1).padStart(4, '0')}`;
  }

  function setScene(scene, immediate) {
    if (!scene || scene.id === renderedSceneId) return;
    const update = () => {
      sceneLabel.textContent = scene.label;
      sceneHeadline.textContent = scene.headline;
      sceneBody.textContent = scene.body;
      proofChip.textContent = scene.id === 'result' ? plan.presenter.name.toUpperCase() + ' · LISTO' : plan.presenter.name.toUpperCase() + ' · 15S';
      renderedSceneId = scene.id;
      sceneCopy.classList.remove('changing');
    };
    if (immediate || reduceMotion.matches) return update();
    sceneCopy.classList.add('changing');
    window.setTimeout(update, 160);
  }

  function tick(now) {
    if (plan && playing) {
      const elapsed = ((now - startedAt) / 1000) % plan.duration;
      pausedAt = elapsed;
      progress.style.width = `${(elapsed / plan.duration) * 100}%`;
      timecode.textContent = formatTime(elapsed);
      setScene(core.sceneAt(plan, elapsed));
    }
    animationFrame = requestAnimationFrame(tick);
  }

  function restart() {
    renderedSceneId = '';
    pausedAt = 0;
    startedAt = performance.now();
    playing = !reduceMotion.matches;
    playPause.textContent = playing ? 'Pausar' : 'Reproducir';
    progress.style.width = '0%';
    timecode.textContent = '00:00.0';
    if (plan) setScene(plan.scenes[0], true);
  }

  function createStoryCard(scene, index) {
    const article = document.createElement('article');
    article.className = 'story-card';
    const header = document.createElement('header');
    const number = document.createElement('span');
    number.textContent = `0${index + 1}`;
    const duration = document.createElement('span');
    duration.textContent = `${scene.from}–${scene.to}s`;
    header.append(number, duration);
    const title = document.createElement('h3');
    title.textContent = scene.headline;
    const body = document.createElement('p');
    body.textContent = scene.body;
    const footer = document.createElement('footer');
    footer.textContent = scene.direction;
    article.append(header, title, body, footer);
    return article;
  }

  function renderPlan(nextPlan) {
    plan = nextPlan;
    document.body.dataset.presenter = plan.presenter.key;
    scriptText.textContent = plan.script;
    wordCount.textContent = String(plan.pace.words);
    paceStatus.textContent = plan.pace.label;
    paceStatus.style.color = plan.pace.level === 'too-fast' ? '#ff7a30' : '';
    storyboard.replaceChildren(...plan.scenes.map(createStoryCard));
    proofChip.textContent = plan.presenter.name.toUpperCase() + ' · 15S';
    grokPrompt.value = plan.grokPrompt;
    saveDraft();
    restart();
  }

  function generate() {
    renderPlan(core.buildPlan(readForm(), variation));
  }

  function copyText(text, button, idleText) {
    const done = () => {
      button.textContent = 'Copiado';
      window.setTimeout(() => { button.textContent = idleText; }, 1500);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    } else fallbackCopy(text, done);
  }

  function fallbackCopy(text, done) {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    try { document.execCommand('copy'); done(); } finally { area.remove(); }
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function downloadPlan() {
    const payload = JSON.stringify(plan, null, 2);
    downloadBlob(new Blob([payload], { type: 'application/json' }), `${core.fileSlug(plan.brief.task)}-plan.json`);
  }

  function speakPlan() {
    if (!('speechSynthesis' in window)) {
      exportStatus.textContent = 'La voz de prueba no está disponible en este navegador.';
      return;
    }
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
      voiceButton.setAttribute('aria-pressed', 'false');
      return;
    }
    const utterance = new SpeechSynthesisUtterance(plan.script);
    utterance.lang = 'es-ES';
    utterance.rate = 1.12;
    utterance.pitch = plan.presenter.key === 'chispa' ? 1.14 : 1;
    utterance.onend = () => voiceButton.setAttribute('aria-pressed', 'false');
    utterance.onerror = () => voiceButton.setAttribute('aria-pressed', 'false');
    voiceButton.setAttribute('aria-pressed', 'true');
    speechSynthesis.speak(utterance);
  }

  function selectedProductionMode() {
    return modeInputs.find((input) => input.checked)?.value || 'motion';
  }

  function setProductionMode(mode) {
    const grokMode = mode === 'grok';
    document.body.dataset.productionMode = grokMode ? 'grok' : 'motion';
    grokStudio.hidden = !grokMode;
    motionTransport.hidden = grokMode;
    $('.timecode').hidden = grokMode;
    previewTitle.textContent = grokMode ? 'Vídeo puro con Grok' : 'Pieza generada';
    if(grokMode){
      playing = false;
      playPause.textContent = 'Reproducir';
      stage.hidden = Boolean(grokVideoUrl);
      grokVideo.hidden = !grokVideoUrl;
    }else{
      stage.hidden = false;
      grokVideo.hidden = true;
      if(!reduceMotion.matches && !playing){
        playing = true;
        startedAt = performance.now() - pausedAt * 1000;
        playPause.textContent = 'Pausar';
      }
    }
  }

  function setGrokJob(label, percent, detail) {
    const safePercent = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
    grokJob.hidden = false;
    grokJobLabel.textContent = label;
    grokJobPercent.textContent = `${safePercent}%`;
    grokProgress.style.width = `${safePercent}%`;
    grokJobDetail.textContent = detail;
  }

  function saveGrokJob(job) {
    try{ localStorage.setItem(GROK_JOB_KEY, JSON.stringify(job)); }catch(_){ /* Resuming is optional. */ }
  }

  function loadGrokJob() {
    try{
      const job = JSON.parse(localStorage.getItem(GROK_JOB_KEY) || 'null');
      if(!job || typeof job.requestId !== 'string' || Date.now() - Number(job.startedAt || 0) > 6 * 60 * 60 * 1000) return null;
      return job;
    }catch(_){ return null; }
  }

  function clearGrokJob() {
    try{ localStorage.removeItem(GROK_JOB_KEY); }catch(_){ /* Best effort. */ }
  }

  function setPixeriaState(status, payload = {}) {
    pixeriaBridge.dataset.status = status;
    openPixeriaAsset.hidden = true;
    retryPixeria.hidden = true;
    if(status === 'uploading'){
      pixeriaLabel.textContent = 'Pixeria · copiando el MP4';
      pixeriaDetail.textContent = 'El enlace interno está transfiriendo el vídeo al Stock de Pixeria.';
    }else if(status === 'published'){
      pixeriaLabel.textContent = 'Pixeria · publicado en Stock';
      pixeriaDetail.textContent = `Asset ${payload.id || ''} disponible para reutilizar y distribuir.`;
      openPixeriaAsset.href = payload.stockUrl || 'https://www.pixeria.com/stock.html';
      openPixeriaAsset.hidden = false;
    }else if(status === 'failed'){
      pixeriaLabel.textContent = 'Pixeria · envío pendiente';
      pixeriaDetail.textContent = payload.error || 'El vídeo está a salvo, pero Pixeria no pudo copiarlo todavía.';
      retryPixeria.hidden = false;
    }else{
      pixeriaBridge.dataset.status = 'ready';
      pixeriaLabel.textContent = 'Pixeria · envío automático activado';
      pixeriaDetail.textContent = 'Al terminar, el MP4 se copiará al Stock de Pixeria sin pasar por tu navegador.';
    }
  }

  async function readApiResponse(response) {
    const type = response.headers.get('content-type') || '';
    if(!type.includes('application/json')){
      if(response.status === 401 || response.status === 403) throw Object.assign(new Error('Inicia sesión en el Generador de Presentaciones para usar Grok.'), {auth:true});
      throw new Error('El servicio de Grok no devolvió una respuesta válida.');
    }
    const payload = await response.json();
    if(!response.ok) throw Object.assign(new Error(payload?.error || 'No se pudo completar la solicitud de Grok.'), {status:response.status, auth:response.status === 401 || response.status === 403});
    return payload;
  }

  function showGrokError(error) {
    const auth = Boolean(error?.auth);
    generateGrokButton.disabled = false;
    grokAccess.hidden = !auth;
    setGrokJob('No se pudo iniciar', 0, String(error?.message || 'No se pudo conectar con Grok.'));
  }

  function showGrokVideo(payload) {
    const durableUrl = payload.pixeria?.assetUrl || payload.video.url;
    grokVideoUrl = durableUrl;
    if(grokVideo.src !== durableUrl) grokVideo.src = durableUrl;
    openGrokVideo.href = grokVideoUrl;
    grokResultActions.hidden = false;
    stage.hidden = true;
    grokVideo.hidden = false;
  }

  function finishGrokVideo(payload) {
    grokRequestId = payload.requestId || grokRequestId;
    showGrokVideo(payload);
    const publication = payload.pixeria || {status:'failed', error:'Pixeria no devolvió el estado de la publicación.'};
    setPixeriaState(publication.status, publication);
    if(publication.status === 'uploading' || publication.status === 'pending'){
      generateGrokButton.disabled = true;
      setGrokJob('Copiando a Pixeria', 96, 'Grok ya terminó. Estamos guardando el MP4 en el Stock de Pixeria…');
      scheduleGrokPoll(grokRequestId, 5000);
      return;
    }
    generateGrokButton.disabled = false;
    grokAccess.hidden = true;
    if(publication.status === 'published'){
      setGrokJob('Vídeo publicado', 100, 'Grok ha terminado y Pixeria ya tiene una copia permanente en su Stock.');
      clearGrokJob();
    }else{
      setGrokJob('Vídeo listo · Pixeria pendiente', 100, 'Puedes revisar el MP4 y reintentar su envío a Pixeria sin volver a generar el vídeo.');
    }
  }

  function scheduleGrokPoll(requestId, delay = 5000) {
    window.clearTimeout(grokPollTimer);
    grokPollTimer = window.setTimeout(() => { void pollGrokVideo(requestId); }, delay);
  }

  async function pollGrokVideo(requestId) {
    if(grokPolling) return;
    grokPolling = true;
    try{
      const response = await fetch(`/presentaciones/api/grok-video?id=${encodeURIComponent(requestId)}`, {headers:{accept:'application/json'}, credentials:'same-origin'});
      const payload = await readApiResponse(response);
      if(payload.status === 'done' && payload.video?.url){
        finishGrokVideo(payload);
        return;
      }
      if(payload.status === 'failed' || payload.status === 'expired'){
        generateGrokButton.disabled = false;
        setGrokJob('Generación interrumpida', payload.progress || 0, payload.error || 'Grok no pudo completar el vídeo.');
        clearGrokJob();
        return;
      }
      const progressValue = payload.progress || 0;
      setGrokJob('Grok está generando', progressValue, 'La creación es asíncrona y puede tardar varios minutos. Esta pantalla se actualizará automáticamente.');
      scheduleGrokPoll(requestId);
    }catch(error){
      if(error?.status === 429){
        setGrokJob('Grok sigue trabajando', Number(grokJobPercent.textContent.replace('%','')) || 0, 'Límite temporal de consulta. Reintentaremos automáticamente.');
        scheduleGrokPoll(requestId, 10000);
      }else showGrokError(error);
    }finally{
      grokPolling = false;
    }
  }

  async function startGrokVideo() {
    const prompt = core.clean(grokPrompt.value, 3200);
    if(prompt.length < 40){
      setGrokJob('Falta dirección visual', 0, 'Describe con algo más de detalle qué debe aparecer en el vídeo puro.');
      return;
    }
    generateGrokButton.disabled = true;
    grokResultActions.hidden = true;
    grokAccess.hidden = true;
    grokVideoUrl = '';
    grokRequestId = '';
    setPixeriaState('ready');
    grokVideo.removeAttribute('src');
    grokVideo.load();
    grokVideo.hidden = true;
    stage.hidden = false;
    setGrokJob('Enviando a Grok', 4, 'Crearemos una secuencia original de 15 segundos en formato 9:16.');
    const clientRequestId = crypto.randomUUID();
    try{
      const response = await fetch('/presentaciones/api/grok-video', {
        method:'POST',
        credentials:'same-origin',
        headers:{'content-type':'application/json', accept:'application/json'},
        body:JSON.stringify({prompt, resolution:grokResolution.value, clientRequestId})
      });
      const payload = await readApiResponse(response);
      grokRequestId = payload.requestId;
      saveGrokJob({requestId:payload.requestId, startedAt:Date.now(), prompt, resolution:grokResolution.value});
      setGrokJob('Solicitud aceptada', 8, 'Grok ha recibido el encargo. Esperando los primeros fotogramas…');
      scheduleGrokPoll(payload.requestId, 2500);
    }catch(error){ showGrokError(error); }
  }

  async function retryPixeriaPublication() {
    if(!grokRequestId) return;
    retryPixeria.disabled = true;
    setPixeriaState('uploading');
    setGrokJob('Reintentando Pixeria', 96, 'Volvemos a copiar el MP4 ya generado; no se consumirán nuevos créditos de vídeo.');
    try{
      const response = await fetch('/presentaciones/api/grok-video', {
        method:'PUT',
        credentials:'same-origin',
        headers:{'content-type':'application/json', accept:'application/json'},
        body:JSON.stringify({requestId:grokRequestId})
      });
      const payload = await readApiResponse(response);
      if(payload.status === 'done' && payload.video?.url) finishGrokVideo(payload);
      else scheduleGrokPoll(grokRequestId, 5000);
    }catch(error){
      setPixeriaState('failed', {error:String(error?.message || 'Pixeria no respondió.')});
      setGrokJob('Vídeo listo · Pixeria pendiente', 100, 'El MP4 permanece disponible. Puedes volver a intentarlo más tarde.');
    }finally{ retryPixeria.disabled = false; }
  }

  function roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function wrapLines(ctx, text, maxWidth, maxLines) {
    const words = core.clean(text).split(/\s+/);
    const lines = [];
    let current = '';
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width <= maxWidth || !current) current = test;
      else {
        lines.push(current);
        current = word;
        if (lines.length === maxLines - 1) break;
      }
    }
    if (current && lines.length < maxLines) lines.push(current);
    if (lines.join(' ').split(/\s+/).length < words.length) lines[lines.length - 1] = lines[lines.length - 1].replace(/[.…]+$/, '') + '…';
    return lines;
  }

  function paletteFor(key) {
    return {
      fusion: ['#65e9f4', '#ff7a30'],
      pix: ['#ff7a30', '#65e9f4'],
      chispa: ['#ff4fa3', '#7c4dff'],
      nexo: ['#3df08a', '#4a86ff']
    }[key] || ['#65e9f4', '#ff7a30'];
  }

  function drawPix(ctx, x, y, scale, accent, secondary, bob) {
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.scale(scale, scale);
    ctx.fillStyle = accent;
    ctx.fillRect(-3, -112, 6, 30);
    ctx.beginPath();
    ctx.arc(0, -116, 10, 0, Math.PI * 2);
    ctx.fillStyle = secondary;
    ctx.shadowColor = secondary;
    ctx.shadowBlur = 22;
    ctx.fill();
    ctx.shadowBlur = 0;
    roundedRect(ctx, -63, -84, 126, 91, 31);
    ctx.fillStyle = '#b9edf0';
    ctx.fill();
    ctx.lineWidth = 7;
    ctx.strokeStyle = '#172730';
    ctx.stroke();
    ctx.fillStyle = '#06252b';
    ctx.beginPath(); ctx.ellipse(-25, -39, 9, 16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(25, -39, 9, 16, 0, 0, Math.PI * 2); ctx.fill();
    roundedRect(ctx, -82, 4, 164, 98, 35);
    ctx.fillStyle = accent;
    ctx.fill();
    ctx.strokeStyle = '#172730';
    ctx.stroke();
    ctx.fillStyle = '#08252a';
    ctx.font = '900 23px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PIX', 0, 63);
    ctx.beginPath();
    ctx.arc(54, 72, 14, 0, Math.PI * 2);
    ctx.fillStyle = secondary;
    ctx.fill();
    ctx.strokeStyle = '#172730';
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.restore();
  }

  function drawFrame(ctx, planData, seconds) {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    const [accent, secondary] = paletteFor(planData.presenter.key);
    const scene = core.sceneAt(planData, seconds);
    const local = (seconds - scene.from) / Math.max(0.01, scene.to - scene.from);
    const ease = 1 - Math.pow(1 - Math.min(1, local * 2.4), 3);

    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#0b1924');
    gradient.addColorStop(0.58, '#05090d');
    gradient.addColorStop(1, '#0c151c');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    const offset = (seconds * 24) % 70;
    for (let y = -70 + offset; y < height + 70; y += 70) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
    for (let x = 0; x < width; x += 70) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
    ctx.restore();

    ctx.save();
    ctx.translate(width - 120, 360);
    ctx.rotate(Math.PI / 4 + seconds * 0.025);
    ctx.globalAlpha = 0.27;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.strokeRect(-220, -220, 440, 440);
    ctx.restore();

    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '800 18px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('ZONA SEGURA', 74, 86);
    ctx.fillText('@ADmiraNeXT', 74, height - 80);

    ctx.save();
    ctx.globalAlpha = ease;
    ctx.translate(0, (1 - ease) * 34);
    ctx.font = '900 23px ui-monospace, monospace';
    const labelWidth = Math.min(width - 148, ctx.measureText(scene.label).width + 48);
    roundedRect(ctx, 74, 210, labelWidth, 64, 8);
    ctx.fillStyle = 'rgba(5,9,13,0.78)';
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.fillText(scene.label, 98, 251);

    ctx.fillStyle = '#eef8fa';
    ctx.font = '900 78px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    const headlineLines = wrapLines(ctx, scene.headline, width - 148, 4);
    headlineLines.forEach((line, index) => ctx.fillText(line, 74, 385 + index * 78));
    ctx.fillStyle = '#c8d9de';
    ctx.font = '500 31px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    const bodyY = 385 + headlineLines.length * 78 + 28;
    wrapLines(ctx, scene.body, width - 250, 4).forEach((line, index) => ctx.fillText(line, 74, bodyY + index * 43));
    ctx.restore();

    drawPix(ctx, width - 245, height - 410, 1.5, accent, secondary, Math.sin(seconds * 3.2) * 8);

    ctx.font = '900 20px ui-monospace, monospace';
    const proof = `${planData.presenter.name.toUpperCase()} · LISTO`;
    const proofWidth = ctx.measureText(proof).width + 42;
    roundedRect(ctx, width - proofWidth - 74, height - 112, proofWidth, 52, 7);
    ctx.fillStyle = 'rgba(5,9,13,0.78)';
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.fillText(proof, width - proofWidth - 53, height - 79);

    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(0, height - 10, width, 10);
    ctx.fillStyle = accent;
    ctx.fillRect(0, height - 10, width * Math.min(1, seconds / planData.duration), 10);
  }

  function supportedMime() {
    const types = [
      'video/mp4;codecs=h264,aac',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm'
    ];
    return types.find((type) => MediaRecorder.isTypeSupported(type)) || '';
  }

  async function exportClip() {
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
      exportStatus.textContent = 'Este navegador no puede codificar vídeo. El plan JSON y el guion siguen disponibles.';
      return;
    }
    if ('speechSynthesis' in window && speechSynthesis.speaking) speechSynthesis.cancel();
    exportVideo.disabled = true;
    exportStatus.textContent = 'Preparando el lienzo vertical…';

    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d', { alpha: false });
    const stream = canvas.captureStream(30);
    let audioContext = null;
    let oscillator = null;
    let toneGain = null;

    try {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (AudioCtor) {
        audioContext = new AudioCtor();
        await audioContext.resume();
        const destination = audioContext.createMediaStreamDestination();
        oscillator = audioContext.createOscillator();
        toneGain = audioContext.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = 92;
        toneGain.gain.value = 0.018;
        oscillator.connect(toneGain).connect(destination);
        oscillator.start();
        destination.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
      }

      const mimeType = supportedMime();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 6500000 } : { videoBitsPerSecond: 6500000 });
      const chunks = [];
      recorder.ondataavailable = (event) => { if (event.data && event.data.size) chunks.push(event.data); };
      const completed = new Promise((resolve, reject) => {
        recorder.onstop = resolve;
        recorder.onerror = () => reject(recorder.error || new Error('No se pudo codificar el vídeo.'));
      });
      const exportStart = performance.now();
      let active = true;

      function renderExport(now) {
        if (!active) return;
        const elapsed = Math.min(plan.duration, (now - exportStart) / 1000);
        if (oscillator && audioContext) {
          const frequency = elapsed < 3 ? 132 : elapsed < 11 ? 92 : 176;
          oscillator.frequency.setTargetAtTime(frequency, audioContext.currentTime, 0.08);
          toneGain.gain.setTargetAtTime(elapsed > 14.6 ? 0 : 0.018, audioContext.currentTime, 0.08);
        }
        drawFrame(ctx, plan, elapsed);
        exportStatus.textContent = `Generando vídeo… ${Math.min(100, Math.round((elapsed / plan.duration) * 100))}%`;
        if (elapsed >= plan.duration) {
          active = false;
          window.setTimeout(() => recorder.stop(), 180);
        } else requestAnimationFrame(renderExport);
      }

      recorder.start(1000);
      requestAnimationFrame(renderExport);
      await completed;
      const finalType = recorder.mimeType || mimeType || 'video/webm';
      const extension = finalType.includes('mp4') ? 'mp4' : 'webm';
      const blob = new Blob(chunks, { type: finalType });
      downloadBlob(blob, `${core.fileSlug(plan.brief.task)}-15s.${extension}`);
      exportStatus.textContent = `Vídeo descargado en ${extension.toUpperCase()}. Incluye animación, subtítulos y base sonora; la locución queda en el guion.`;
    } catch (error) {
      exportStatus.textContent = error && error.message ? error.message : 'No se pudo generar el vídeo en este navegador.';
    } finally {
      stream.getTracks().forEach((track) => track.stop());
      if (oscillator) { try { oscillator.stop(); } catch (_) { /* Already stopped. */ } }
      if (audioContext) { try { await audioContext.close(); } catch (_) { /* Best effort. */ } }
      exportVideo.disabled = false;
    }
  }

  form.addEventListener('submit', (event) => { event.preventDefault(); variation = 0; generate(); });
  form.addEventListener('input', saveDraft);
  $('#variationButton').addEventListener('click', () => { variation = (variation + 1) % 3; generate(); });
  $('#loadExample').addEventListener('click', () => { writeForm(example); variation = 0; generate(); });
  $('#restartPreview').addEventListener('click', restart);
  playPause.addEventListener('click', () => {
    playing = !playing;
    if (playing) startedAt = performance.now() - pausedAt * 1000;
    playPause.textContent = playing ? 'Pausar' : 'Reproducir';
  });
  $('#copyScript').addEventListener('click', (event) => copyText(plan.script, event.currentTarget, 'Copiar guion'));
  $('#downloadPlan').addEventListener('click', downloadPlan);
  voiceButton.addEventListener('click', speakPlan);
  exportVideo.addEventListener('click', exportClip);
  modeInputs.forEach((input) => input.addEventListener('change', () => setProductionMode(selectedProductionMode())));
  generateGrokButton.addEventListener('click', () => { void startGrokVideo(); });
  retryPixeria.addEventListener('click', () => { void retryPixeriaPublication(); });
  copyGrokUrl.addEventListener('click', () => copyText(grokVideoUrl, copyGrokUrl, 'Copiar URL'));
  reduceMotion.addEventListener('change', restart);
  window.addEventListener('beforeunload', () => {
    cancelAnimationFrame(animationFrame);
    window.clearTimeout(grokPollTimer);
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  });

  loadDraft();
  generate();
  setProductionMode(selectedProductionMode());
  const pendingGrokJob = loadGrokJob();
  if(pendingGrokJob){
    grokRequestId = pendingGrokJob.requestId;
    const grokMode = modeInputs.find((input) => input.value === 'grok');
    if(grokMode) grokMode.checked = true;
    if(typeof pendingGrokJob.prompt === 'string') grokPrompt.value = pendingGrokJob.prompt;
    if(['480p','720p','1080p'].includes(pendingGrokJob.resolution)) grokResolution.value = pendingGrokJob.resolution;
    setProductionMode('grok');
    generateGrokButton.disabled = true;
    setGrokJob('Recuperando generación', 8, 'Retomando el seguimiento del vídeo iniciado anteriormente…');
    scheduleGrokPoll(pendingGrokJob.requestId, 500);
  }
  animationFrame = requestAnimationFrame(tick);
})();
