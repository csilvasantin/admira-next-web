(function () {
  'use strict';

  const core = window.TikTokCore;
  if (!core) return;

  const $ = (selector) => document.querySelector(selector);
  const form = $('#generatorForm');
  const adIdeaForm = $('#adIdeaForm');
  const adIdeaStatus = $('#adIdeaStatus');
  const adIdeaCount = $('#adIdeaCount');
  const adLibrary = $('#adLibrary');
  const adIdeaList = $('#adIdeaList');
  const adDate = $('#adDate');
  const adIdeaInput = $('#adIdea');
  const developAdButton = $('#developAdIdea');
  const adIdeaAccess = $('#adIdeaAccess');
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
  const prepareMeta = $('#prepareMeta');
  const metaVideo = $('#metaVideo');
  const metaStatus = $('#metaStatus');
  const pixeriaBridge = $('#pixeriaBridge');
  const pixeriaLabel = $('#pixeriaLabel');
  const pixeriaDetail = $('#pixeriaDetail');
  const openPixeriaAsset = $('#openPixeriaAsset');
  const retryPixeria = $('#retryPixeria');
  const preRollEnabled = $('#preRollEnabled');
  const preRollTitle = $('#preRollTitle');
  const postRollEnabled = $('#postRollEnabled');
  const postRollCta = $('#postRollCta');
  const referenceVideo = $('#referenceVideo');
  const referenceModeInputs = Array.from(document.querySelectorAll('input[name="referenceMode"]'));
  const referenceLocal = $('#referenceLocal');
  const referenceUrlRow = $('#referenceUrlRow');
  const referenceUrl = $('#referenceUrl');
  const loadReferenceUrl = $('#loadReferenceUrl');
  const referencePreview = $('#referencePreview');
  const referenceSourceLink = $('#referenceSourceLink');
  const analyzeReference = $('#analyzeReference');
  const clearReference = $('#clearReference');
  const referenceStatus = $('#referenceStatus');
  const referenceProfileView = $('#referenceProfile');
  const packageOutput = $('#packageOutput');
  const packageStatus = $('#packageStatus');
  const packageProgress = $('#packageProgress');
  const composeGrokPackage = $('#composeGrokPackage');
  const openPackageAsset = $('#openPackageAsset');
  const downloadGrokPackage = $('#downloadGrokPackage');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const STORAGE_KEY = 'admiranext:tiktok15:brief:v1';
  const AD_IDEAS_KEY = 'admiranext:tiktok15:ad-ideas:v1';
  const GROK_JOB_KEY = 'admiranext:tiktok15:grok-job:v1';
  const REFERENCE_PROFILE_KEY = 'admiranext:tiktok:reference-profile:v1';

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
  let referenceObjectUrl = '';
  let referenceProfile = null;
  let referenceSource = null;
  let packageBlobUrl = '';
  let packageId = '';
  let adIdeas = [];

  const example = {
    task: 'Encontrar las acciones importantes dentro de un PDF largo',
    solution: 'Súbelo a NotebookLM y pregunta: ¿cuáles son las tres acciones?',
    result: 'Un documento largo convertido en un plan claro',
    presenter: 'fusion',
    tone: 'energetic',
    audience: 'Personas que quieren ahorrar tiempo',
    cta: 'Guárdalo y pruébalo hoy'
  };

  const objectiveLabels = {
    leads: 'Contactos',
    visits: 'Visitas',
    sales: 'Ventas',
    launch: 'Lanzamiento',
    awareness: 'Marca'
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

  function todayValue() {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function loadAdIdeas() {
    try {
      const saved = JSON.parse(localStorage.getItem(AD_IDEAS_KEY) || '[]');
      adIdeas = Array.isArray(saved) ? saved.filter((item) => item && typeof item.idea === 'string').slice(0, 24) : [];
    } catch (_) { adIdeas = []; }
  }

  function saveAdIdeas() {
    try { localStorage.setItem(AD_IDEAS_KEY, JSON.stringify(adIdeas)); } catch (_) { /* Device-local persistence is optional. */ }
  }

  function formatAdDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return 'Sin fecha';
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  }

  function openAdIdea(ad, grokMode) {
    writeForm(core.buildBriefFromAd(ad));
    variation = 0;
    generate();
    if (grokMode) {
      const grokInput = modeInputs.find((input) => input.value === 'grok');
      if (grokInput) grokInput.checked = true;
      setProductionMode('grok');
      adIdeaStatus.textContent = 'Dirección preparada. Revisa el prompt y pulsa “Generar con Grok” cuando quieras iniciar el vídeo.';
    } else {
      const motionInput = modeInputs.find((input) => input.value === 'motion');
      if (motionInput) motionInput.checked = true;
      setProductionMode('motion');
      adIdeaStatus.textContent = 'Anuncio abierto en el taller para ajustar el brief y revisar el guion.';
    }
    adIdeaStatus.classList.add('is-success');
    $('#workspace').scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
  }

  function createAdCard(ad) {
    const article = document.createElement('article');
    article.className = 'ad-card';
    const meta = document.createElement('div');
    meta.className = 'ad-card-meta';
    const brand = document.createElement('span');
    brand.textContent = core.clean(ad.brand, 28) || 'SIN MARCA';
    const date = document.createElement('span');
    date.textContent = formatAdDate(ad.date);
    meta.append(brand, date);
    const title = document.createElement('h3');
    title.textContent = ad.idea;
    const description = document.createElement('p');
    description.textContent = `${objectiveLabels[ad.objective] || 'Anuncio'} · ${core.clean(ad.audience, 80) || 'Público por definir'}`;
    const actions = document.createElement('div');
    actions.className = 'ad-card-actions';
    const open = document.createElement('button');
    open.type = 'button';
    open.textContent = 'Abrir guion';
    open.addEventListener('click', () => openAdIdea(ad, false));
    const grok = document.createElement('button');
    grok.type = 'button';
    grok.textContent = 'Preparar Grok';
    grok.addEventListener('click', () => openAdIdea(ad, true));
    actions.append(open, grok);
    article.append(meta, title, description, actions);
    return article;
  }

  function renderAdIdeas() {
    adIdeaCount.textContent = `${adIdeas.length} ${adIdeas.length === 1 ? 'anuncio' : 'anuncios'}`;
    adLibrary.hidden = adIdeas.length === 0;
    adIdeaList.replaceChildren(...adIdeas.slice(0, 3).map(createAdCard));
  }

  function setAdIdeaMessage(message, state = '') {
    adIdeaStatus.textContent = message;
    adIdeaStatus.classList.toggle('is-success', state === 'success');
    adIdeaStatus.classList.toggle('is-error', state === 'error');
  }

  function syncAdIdeaAgentMode(updateMessage = false) {
    const hasHeadline = core.clean(adIdeaInput.value, 200).length > 0;
    developAdButton.textContent = hasHeadline ? '✨ Desarrollar idea' : '✨ Crear idea';
    developAdButton.title = hasHeadline ? 'Desarrollar el titular con el director creativo' : 'Crear una idea completa desde cero';
    if(updateMessage){
      setAdIdeaMessage(hasHeadline
        ? 'Pulsa “Desarrollar idea” y completaremos el anuncio respetando este titular.'
        : 'Pulsa “Crear idea” para que el director creativo genere el anuncio completo desde cero.');
    }
    return hasHeadline;
  }

  async function developAdIdea() {
    const headline = core.clean(adIdeaInput.value, 200);
    const hasHeadline = headline.length > 0;
    developAdButton.disabled = true;
    developAdButton.textContent = hasHeadline ? 'Desarrollando…' : 'Creando…';
    adIdeaAccess.hidden = true;
    setAdIdeaMessage(hasHeadline
      ? 'El director creativo está convirtiendo el titular en una campaña completa…'
      : 'El director creativo está inventando una campaña completa desde cero…');
    try {
      const response = await fetch('/presentaciones/api/ad-idea', {
        method:'POST',
        credentials:'same-origin',
        headers:{'content-type':'application/json', accept:'application/json'},
        body:JSON.stringify({headline})
      });
      const type = response.headers.get('content-type') || '';
      if(!type.includes('application/json')){
        const error = new Error('Inicia sesión en el Generador de Presentaciones para desarrollar ideas.');
        error.auth = response.status === 401 || response.status === 403;
        throw error;
      }
      const payload = await response.json();
      if(!response.ok){
        const error = new Error(payload?.error || 'No se pudo desarrollar la idea.');
        error.auth = response.status === 401 || response.status === 403;
        throw error;
      }
      if(!payload?.ad || typeof payload.ad !== 'object') throw new Error('La idea desarrollada quedó incompleta.');
      Object.entries(payload.ad).forEach(([key, value]) => {
        const field = adIdeaForm.elements.namedItem(key);
        if(field && typeof value === 'string') field.value = value;
      });
      if(!adDate.value) adDate.value = todayValue();
      const createdFromScratch = payload.mode === 'create' || !hasHeadline;
      setAdIdeaMessage(createdFromScratch
        ? 'Idea creada desde cero. Revisa el concepto y pulsa “Crear anuncio” para obtener el guion y el storyboard.'
        : 'Idea desarrollada. Revisa el enfoque y pulsa “Crear anuncio” para obtener el guion y el storyboard.', 'success');
      $('#adDetail').focus();
    } catch(error) {
      adIdeaAccess.hidden = !error?.auth;
      setAdIdeaMessage(String(error?.message || 'No se pudo desarrollar la idea.'), 'error');
    } finally {
      developAdButton.disabled = false;
      syncAdIdeaAgentMode(false);
    }
  }

  function createAdIdea(event) {
    event.preventDefault();
    const raw = Object.fromEntries(new FormData(adIdeaForm).entries());
    if(!core.clean(raw.idea, 200)){
      setAdIdeaMessage('Primero pulsa “Crear idea”, o escribe un titular y pulsa “Desarrollar idea”.', 'error');
      developAdButton.focus();
      return;
    }
    const ad = {
      id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `ad-${Date.now()}`,
      createdAt: new Date().toISOString(),
      idea: core.clean(raw.idea, 200),
      detail: core.clean(raw.detail, 1400),
      brand: core.clean(raw.brand, 90),
      objective: raw.objective,
      audience: core.clean(raw.audience, 110),
      date: raw.date
    };
    adIdeas = [ad, ...adIdeas].slice(0, 24);
    saveAdIdeas();
    renderAdIdeas();
    openAdIdea(ad, false);
    adIdeaStatus.textContent = 'Anuncio creado: ya tienes brief, guion y storyboard. Puedes ajustarlos o preparar el vídeo con Grok.';
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

  function syncGrokPrompt() {
    if(!plan) return;
    const style = referenceProfile?.promptFragment ? `\n\n${referenceProfile.promptFragment}` : '';
    grokPrompt.value = core.clean(`${plan.grokPrompt}${style}`, 3200);
  }

  function renderReferenceProfile() {
    if(!referenceProfile){
      referenceProfileView.hidden = true;
      referenceProfileView.textContent = '';
      return;
    }
    referenceProfileView.textContent = `Dirección aplicada · ${referenceProfile.summary} Cámara: ${referenceProfile.camera} Ritmo: ${referenceProfile.rhythm}`;
    referenceProfileView.hidden = false;
    clearReference.hidden = false;
  }

  function saveReferenceProfile() {
    try{
      if(referenceProfile) localStorage.setItem(REFERENCE_PROFILE_KEY, JSON.stringify({profile:referenceProfile, source:referenceSource}));
      else localStorage.removeItem(REFERENCE_PROFILE_KEY);
    }catch(_){ /* Optional device-local persistence. */ }
  }

  function selectedReferenceMode() {
    return referenceModeInputs.find(input => input.checked)?.value || 'none';
  }

  function renderReferenceMode(mode) {
    referenceLocal.hidden = mode !== 'local';
    referenceUrlRow.hidden = mode !== 'url';
  }

  function loadReferenceProfile() {
    try{
      const saved = JSON.parse(localStorage.getItem(REFERENCE_PROFILE_KEY) || 'null');
      if(saved?.profile && typeof saved.profile.promptFragment === 'string' && typeof saved.profile.summary === 'string'){
        referenceProfile = saved.profile;
        referenceSource = saved.source && typeof saved.source.mode === 'string' ? saved.source : null;
      }
    }catch(_){ referenceProfile = null; referenceSource = null; }
    const restoredMode = referenceSource?.mode === 'local' ? 'local' : (referenceSource ? 'url' : 'none');
    const restoredInput = referenceModeInputs.find(input => input.value === restoredMode);
    if(restoredInput) restoredInput.checked = true;
    renderReferenceMode(restoredMode);
    if(referenceSource?.url){
      referenceUrl.value = referenceSource.url;
      referenceSourceLink.href = referenceSource.url;
      referenceSourceLink.hidden = false;
    }
    renderReferenceProfile();
    if(referenceProfile) setReferenceMessage('Guía visual recuperada de este dispositivo y aplicada al prompt.', 'success');
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
    syncGrokPrompt();
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

  async function readApiResponse(response, fallback = 'No se pudo completar la solicitud de Grok.') {
    const type = response.headers.get('content-type') || '';
    if(!type.includes('application/json')){
      if(response.status === 401 || response.status === 403) throw Object.assign(new Error('Inicia sesión en el Generador de Presentaciones para usar Grok.'), {auth:true});
      throw Object.assign(new Error(fallback), {status:response.status});
    }
    const payload = await response.json();
    const detail = payload?.error || payload?.message || payload?.errors?.[0]?.message || fallback;
    if(!response.ok) throw Object.assign(new Error(detail), {status:response.status, auth:response.status === 401 || response.status === 403});
    return payload;
  }

  function setReferenceMessage(message, state = '') {
    referenceStatus.textContent = message;
    referenceStatus.classList.toggle('is-error', state === 'error');
    referenceStatus.classList.toggle('is-success', state === 'success');
  }

  function waitForMedia(element, eventName) {
    return new Promise((resolve, reject) => {
      const done = () => { cleanup(); resolve(); };
      const failed = () => { cleanup(); reject(new Error('No pudimos leer el vídeo de referencia.')); };
      const cleanup = () => {
        element.removeEventListener(eventName, done);
        element.removeEventListener('error', failed);
      };
      element.addEventListener(eventName, done, {once:true});
      element.addEventListener('error', failed, {once:true});
    });
  }

  function resetReferenceMedia() {
    referenceVideo.value = '';
    referencePreview.removeAttribute('src');
    referencePreview.load();
    referencePreview.hidden = true;
    if(referenceObjectUrl) URL.revokeObjectURL(referenceObjectUrl);
    referenceObjectUrl = '';
    referenceSourceLink.hidden = true;
    referenceSourceLink.removeAttribute('href');
    analyzeReference.disabled = true;
  }

  function youtubeVideoId(value) {
    try{
      const url = new URL(value);
      if(url.protocol !== 'https:' || url.username || url.password) return '';
      const host = url.hostname.toLowerCase();
      let id = '';
      if(host === 'youtu.be') id = url.pathname.split('/').filter(Boolean)[0] || '';
      else if(host === 'youtube.com' || host.endsWith('.youtube.com')){
        if(url.pathname === '/watch') id = url.searchParams.get('v') || '';
        else id = url.pathname.match(/^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})(?:\/|$)/)?.[1] || '';
      }
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : '';
    }catch(_){ return ''; }
  }

  function pixeriaReference(value) {
    try{
      const url = new URL(value);
      if(url.protocol !== 'https:' || url.username || url.password) return null;
      const host = url.hostname.toLowerCase();
      let id = '';
      if(host === 'api.admira.store') id = url.pathname.match(/^\/stock\/asset\/([^/]+)$/)?.[1] || '';
      else if(host === 'pixeria.com' || host === 'www.pixeria.com') id = url.searchParams.get('highlight') || '';
      if(!/^(?:\d{10,16}-[a-z0-9]{4,16}|auto-[a-f0-9]{20})$/i.test(id)) return null;
      return {id, assetUrl:`https://api.admira.store/stock/asset/${encodeURIComponent(id)}`};
    }catch(_){ return null; }
  }

  async function prepareVideoReference(sourceUrl, source, shouldReset = true) {
    if(shouldReset) resetReferenceMedia();
    referenceSource = source;
    referencePreview.src = sourceUrl;
    referencePreview.hidden = false;
    referenceSourceLink.href = source.url || sourceUrl;
    referenceSourceLink.hidden = false;
    clearReference.hidden = false;
    setReferenceMessage('Leyendo duración y formato…');
    try{
      if(referencePreview.readyState < 1) await waitForMedia(referencePreview, 'loadedmetadata');
      if(!Number.isFinite(referencePreview.duration) || referencePreview.duration <= 0 || referencePreview.duration > 30 * 60){
        throw new Error('La referencia debe durar menos de 30 minutos.');
      }
      analyzeReference.disabled = false;
      setReferenceMessage(`${source.label} lista · ${referencePreview.duration.toFixed(1)}s. Analízala para aplicar su lenguaje visual.`);
    }catch(error){
      analyzeReference.disabled = true;
      setReferenceMessage(error.message || 'No pudimos leer el vídeo de referencia.', 'error');
    }
  }

  async function selectReferenceVideo() {
    const file = referenceVideo.files?.[0];
    if(!file) return;
    const allowed = ['video/mp4', 'video/webm', 'video/quicktime'];
    if(!allowed.includes(file.type) || file.size > 200 * 1024 * 1024){
      referenceVideo.value = '';
      setReferenceMessage('Usa un MP4, WebM o MOV de hasta 200 MB.', 'error');
      return;
    }
    resetReferenceMedia();
    referenceObjectUrl = URL.createObjectURL(file);
    await prepareVideoReference(referenceObjectUrl, {mode:'local', label:'Archivo local', name:core.clean(file.name, 120)}, false);
  }

  async function loadReferenceFromUrl() {
    const value = core.clean(referenceUrl.value, 800);
    const youtubeId = youtubeVideoId(value);
    const pixeria = pixeriaReference(value);
    referenceProfile = null;
    saveReferenceProfile();
    renderReferenceProfile();
    syncGrokPrompt();
    if(youtubeId){
      resetReferenceMedia();
      referenceSource = {mode:'youtube', label:'YouTube', url:value, videoId:youtubeId};
      referenceSourceLink.href = value;
      referenceSourceLink.hidden = false;
      clearReference.hidden = false;
      analyzeReference.disabled = false;
      setReferenceMessage('URL de YouTube lista. Analízala para convertir sus fotogramas representativos en dirección visual.');
      return;
    }
    if(pixeria){
      await prepareVideoReference(pixeria.assetUrl, {mode:'pixeria', label:'Vídeo de Pixeria', url:value, id:pixeria.id, assetUrl:pixeria.assetUrl});
      return;
    }
    resetReferenceMedia();
    referenceSource = null;
    clearReference.hidden = false;
    setReferenceMessage('Usa una URL válida de YouTube o un enlace de asset/Stock de Pixeria.', 'error');
  }

  async function captureReferenceFrames() {
    const canvas = document.createElement('canvas');
    canvas.width = 360;
    canvas.height = 640;
    const ctx = canvas.getContext('2d', {alpha:false});
    const duration = referencePreview.duration;
    const frames = [];
    for(const fraction of [0.08, 0.35, 0.65, 0.92]){
      referencePreview.currentTime = Math.max(0, Math.min(duration - 0.05, duration * fraction));
      await waitForMedia(referencePreview, 'seeked');
      const scale = Math.max(canvas.width / referencePreview.videoWidth, canvas.height / referencePreview.videoHeight);
      const width = referencePreview.videoWidth * scale;
      const height = referencePreview.videoHeight * scale;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(referencePreview, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
      frames.push(canvas.toDataURL('image/jpeg', 0.72));
    }
    return frames;
  }

  async function analyzeReferenceVideo() {
    if(!referenceSource || analyzeReference.disabled) return;
    analyzeReference.disabled = true;
    setReferenceMessage(referenceSource.mode === 'youtube' ? 'Recuperando fotogramas representativos de YouTube…' : 'Extrayendo cuatro momentos del vídeo en este dispositivo…');
    try{
      const requestBody = referenceSource.mode === 'youtube'
        ? {sourceUrl:referenceSource.url}
        : {frames:await captureReferenceFrames()};
      setReferenceMessage('Grok está leyendo cámara, ritmo, luz y paleta…');
      const response = await fetch('/presentaciones/api/video-reference', {
        method:'POST', credentials:'same-origin',
        headers:{'content-type':'application/json', accept:'application/json'},
        body:JSON.stringify(requestBody)
      });
      const payload = await readApiResponse(response);
      referenceProfile = payload.profile;
      saveReferenceProfile();
      renderReferenceProfile();
      syncGrokPrompt();
      setReferenceMessage('Referencia analizada y aplicada a la dirección visual de Grok.', 'success');
    }catch(error){ setReferenceMessage(error.message || 'No pudimos analizar la referencia.', 'error'); }
    finally{ analyzeReference.disabled = false; }
  }

  function clearReferenceVideo(resetMode = true) {
    resetReferenceMedia();
    referenceUrl.value = '';
    referenceSource = null;
    referenceProfile = null;
    saveReferenceProfile();
    renderReferenceProfile();
    syncGrokPrompt();
    clearReference.hidden = true;
    if(resetMode){
      const none = referenceModeInputs.find(input => input.value === 'none');
      if(none) none.checked = true;
      renderReferenceMode('none');
      setReferenceMessage('Sin referencia · el anuncio se generará solo a partir del brief.');
    }
  }

  function changeReferenceMode() {
    const mode = selectedReferenceMode();
    clearReferenceVideo(false);
    renderReferenceMode(mode);
    if(mode === 'none') setReferenceMessage('Sin referencia · el anuncio se generará solo a partir del brief.');
    else if(mode === 'local') setReferenceMessage('Selecciona un MP4, WebM o MOV local de hasta 200 MB. El archivo no se subirá: solo enviaremos cuatro fotogramas al analizarlo.');
    else setReferenceMessage('Pega una URL de YouTube o un enlace del Stock de Pixeria.');
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

  /* ── Motor gratuito: Meta AI asistido ──────────────────────────────────────
     Meta AI (Vibes / Movie Gen) hace hasta 16 s en 1080p con audio y es gratis,
     pero no expone API de video. Asi que el estudio hace su parte —el prompt— y
     el usuario trae el MP4. A partir de ahi NO hay camino especial: se usa el
     mismo grokVideoUrl, el mismo montaje de 25 s y la misma publicacion en
     Pixeria, para que solo exista una tuberia que mantener.
     El blob: local ademas es same-origin, asi que no ensucia el canvas del
     montaje como podria hacerlo una URL remota. */
  const META_URL = 'https://www.meta.ai/';

  // Vibes genera vertical y corto, que es justo lo que pide el montaje; pero el
  // prompt de arriba esta escrito para Grok, donde el formato va aparte (el
  // selector de resolucion). Al pasarlo a Meta AI se le adjunta el formato que
  // el propio estudio exige —9:16 y 15 s, el hueco entre las dos cortinillas—
  // para que lo que vuelva encaje sin retocar. No se toca el prompt original.
  const META_FORMATO = 'Formato: vídeo vertical 9:16, 15 segundos, sin texto sobreimpreso.';

  async function prepararMeta(){
    const prompt = (grokPrompt.value || '').trim();
    if(!prompt){
      metaStatus.textContent = 'Escribe antes el prompt: es lo que se copia.';
      return;
    }
    const paraMeta = prompt + '\n\n' + META_FORMATO;
    let copiado = false;
    try{ await navigator.clipboard.writeText(paraMeta); copiado = true; }catch(_){ copiado = false; }
    metaStatus.textContent = copiado
      ? 'Prompt copiado. Pegalo en Meta AI, genera el video y traelo con el boton de al lado.'
      : 'No he podido copiar solo: selecciona el prompt de arriba y copialo a mano.';
    window.open(META_URL, '_blank', 'noopener');
  }

  function traerVideoMeta(file){
    if(!file) return;
    if(!/^video\//.test(file.type || '')){
      metaStatus.textContent = 'Ese fichero no es un video.';
      return;
    }
    if(grokVideoUrl.startsWith('blob:')) URL.revokeObjectURL(grokVideoUrl);
    grokVideoUrl = URL.createObjectURL(file);
    grokVideo.src = grokVideoUrl;
    openGrokVideo.href = grokVideoUrl;
    grokResultActions.hidden = false;
    stage.hidden = true;
    grokVideo.hidden = false;
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    metaStatus.textContent = 'Video de Meta AI cargado (' + mb + ' MB). Ya puedes montar los 25 s y publicar en Pixeria.';
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
      packageOutput.hidden = false;
      composeGrokPackage.disabled = false;
      packageStatus.textContent = 'El máster principal está listo. Añadiremos preroll y postroll y publicaremos la pieza final en Pixeria.';
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
    packageOutput.hidden = true;
    packageOutput.classList.remove('is-published');
    openPackageAsset.hidden = true;
    downloadGrokPackage.hidden = true;
    packageId = '';
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

  function drawVideoCover(ctx, video) {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    const sourceWidth = video.videoWidth || 1080;
    const sourceHeight = video.videoHeight || 1920;
    const scale = Math.max(width / sourceWidth, height / sourceHeight);
    const drawWidth = sourceWidth * scale;
    const drawHeight = sourceHeight * scale;
    ctx.fillStyle = '#020508';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(video, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
  }

  function drawRollFrame(ctx, kind, seconds, text) {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    const outgoing = kind === 'post';
    const accent = outgoing ? '#bd86ff' : '#65e9f4';
    const secondary = outgoing ? '#65e9f4' : '#ff7a30';
    const local = Math.max(0, Math.min(1, seconds / 5));
    const pulse = 0.5 + Math.sin(seconds * 3.2) * 0.5;
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#081722');
    gradient.addColorStop(0.58, '#05090d');
    gradient.addColorStop(1, outgoing ? '#170c22' : '#102029');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.globalAlpha = 0.1 + pulse * 0.08;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    const offset = (seconds * 46) % 90;
    for(let y = -90 + offset; y < height + 90; y += 90){ ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
    for(let x = 0; x < width; x += 90){ ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
    ctx.restore();
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate(seconds * (outgoing ? -0.08 : 0.08));
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 5;
    ctx.strokeRect(-360 - local * 30, -360 - local * 30, 720 + local * 60, 720 + local * 60);
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.fillStyle = secondary;
    ctx.font = '900 24px ui-monospace, monospace';
    ctx.fillText(outgoing ? 'POSTROLL · 05S' : 'PREROLL · 05S', width / 2, 330);
    ctx.fillStyle = '#eef8fa';
    ctx.font = '900 78px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    const lines = wrapLines(ctx, text, width - 180, 4);
    const firstY = height / 2 - ((lines.length - 1) * 48);
    lines.forEach((line, index) => ctx.fillText(line, width / 2, firstY + index * 94));
    ctx.fillStyle = accent;
    ctx.font = '900 23px ui-monospace, monospace';
    ctx.fillText(outgoing ? '@ADmiraNeXT · PIXERIA' : 'ADmiraNeXT · CREATIVE STUDIO', width / 2, height - 260);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(74, height - 165, width - 148, 5);
    ctx.fillStyle = accent;
    ctx.fillRect(74, height - 165, (width - 148) * local, 5);
  }

  async function retryPackagePublication() {
    if(!packageId) return;
    composeGrokPackage.disabled = true;
    packageStatus.textContent = 'Reintentando la publicación del master final en Pixeria…';
    try{
      const response = await fetch('/presentaciones/api/video-package', {
        method:'PUT', credentials:'same-origin',
        headers:{'content-type':'application/json', accept:'application/json'},
        body:JSON.stringify({id:packageId})
      });
      const payload = await readApiResponse(response, 'No se pudo reintentar la publicación del máster final en Pixeria.');
      if(payload.pixeria?.status !== 'published') throw new Error(payload.pixeria?.error || 'Pixeria todavía no ha podido guardar el master.');
      finishPackagePublication(payload);
    }catch(error){
      packageStatus.textContent = error.message || 'Pixeria no respondió. Puedes volver a intentarlo.';
      composeGrokPackage.textContent = 'Reintentar Pixeria';
      composeGrokPackage.disabled = false;
    }
  }

  function finishPackagePublication(payload) {
    packageId = payload.id || packageId;
    packageOutput.classList.add('is-published');
    packageStatus.textContent = `Master final de ${payload.duration || 25} segundos publicado en Pixeria${payload.pixeria?.id ? ` · ${payload.pixeria.id}` : ''}.`;
    openPackageAsset.href = payload.pixeria?.stockUrl || 'https://www.pixeria.com/stock.html';
    openPackageAsset.hidden = false;
    composeGrokPackage.textContent = 'Publicado en Pixeria';
    composeGrokPackage.disabled = true;
    packageProgress.hidden = false;
    packageProgress.firstElementChild.style.width = '100%';
  }

  async function composeAndPublishGrokPackage() {
    if(packageId && composeGrokPackage.textContent.includes('Reintentar')) return retryPackagePublication();
    if(!grokVideoUrl || !window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream){
      packageStatus.textContent = 'Este navegador no puede montar el vídeo final. Prueba con Chrome, Edge o Safari actualizado.';
      return;
    }
    composeGrokPackage.disabled = true;
    openPackageAsset.hidden = true;
    packageProgress.hidden = false;
    packageProgress.firstElementChild.style.width = '0%';
    packageStatus.textContent = 'Preparando el master vertical…';
    const before = preRollEnabled.checked ? 5 : 0;
    const after = postRollEnabled.checked ? 5 : 0;
    const totalDuration = before + 15 + after;
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d', {alpha:false});
    // Seed the canvas before captureStream(). Chrome can otherwise anchor the
    // first encoded video timestamp when the 15s source begins playing and
    // silently drop the whole preroll interval.
    if(before){
      drawRollFrame(ctx, 'pre', 0, core.clean(preRollTitle.value, 90) || 'ADmiraNeXT presenta');
    }else{
      ctx.fillStyle = '#020508';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    const stream = canvas.captureStream(30);
    let capturedVideoStream = null;
    let recorder = null;
    let packageAudioContext = null;
    let packageAudioClock = null;
    try{
      if(grokVideo.readyState < 2) await waitForMedia(grokVideo, 'loadeddata');
      grokVideo.currentTime = 0;
      await grokVideo.play();
      grokVideo.pause();
      if(typeof grokVideo.captureStream === 'function'){
        capturedVideoStream = grokVideo.captureStream();
        const capturedAudioTracks = capturedVideoStream.getAudioTracks();
        const AudioCtor = window.AudioContext || window.webkitAudioContext;
        if(AudioCtor){
          // MediaRecorder can discard canvas frames produced before the first
          // audio timestamp and truncate again when the source video's audio
          // ends. A silent, continuous Web Audio clock keeps the muxer's
          // timeline alive for preroll + main video + postroll.
          packageAudioContext = new AudioCtor();
          await packageAudioContext.resume();
          const destination = packageAudioContext.createMediaStreamDestination();
          packageAudioClock = packageAudioContext.createOscillator();
          const silentGain = packageAudioContext.createGain();
          silentGain.gain.value = 0;
          packageAudioClock.connect(silentGain).connect(destination);
          packageAudioClock.start();
          if(capturedAudioTracks.length){
            const sourceStream = new MediaStream(capturedAudioTracks);
            packageAudioContext.createMediaStreamSource(sourceStream).connect(destination);
          }
          destination.stream.getAudioTracks().forEach(track => stream.addTrack(track));
        }else{
          capturedAudioTracks.forEach(track => stream.addTrack(track));
        }
      }
      const mimeType = supportedMime();
      recorder = new MediaRecorder(stream, mimeType ? {mimeType, videoBitsPerSecond:6500000} : {videoBitsPerSecond:6500000});
      const chunks = [];
      recorder.ondataavailable = event => { if(event.data?.size) chunks.push(event.data); };
      const completed = new Promise((resolve, reject) => {
        recorder.onstop = resolve;
        recorder.onerror = () => reject(recorder.error || new Error('No se pudo codificar el master final.'));
      });
      const started = performance.now();
      let mainStarted = false;
      let active = true;
      function render(now){
        if(!active) return;
        const elapsed = Math.min(totalDuration, (now - started) / 1000);
        if(elapsed < before){
          drawRollFrame(ctx, 'pre', elapsed, core.clean(preRollTitle.value, 90) || 'ADmiraNeXT presenta');
        }else if(elapsed < before + 15){
          if(!mainStarted){
            mainStarted = true;
            grokVideo.currentTime = 0;
            void grokVideo.play().catch(() => {});
          }
          drawVideoCover(ctx, grokVideo);
        }else{
          if(!grokVideo.paused) grokVideo.pause();
          drawRollFrame(ctx, 'post', elapsed - before - 15, core.clean(postRollCta.value, 90) || plan.brief.cta || 'Descúbrelo hoy');
        }
        const percent = Math.round((elapsed / totalDuration) * 90);
        packageProgress.firstElementChild.style.width = `${percent}%`;
        packageStatus.textContent = `Montando ${totalDuration}s · ${percent}%`;
        if(elapsed >= totalDuration){
          active = false;
          window.setTimeout(() => recorder.stop(), 180);
        }else requestAnimationFrame(render);
      }
      recorder.start(1000);
      requestAnimationFrame(render);
      await completed;
      const finalType = recorder.mimeType || mimeType || 'video/webm';
      const extension = finalType.includes('mp4') ? 'mp4' : 'webm';
      const blob = new Blob(chunks, {type:finalType});
      if(blob.size < 1024) throw new Error('El master final quedó vacío. Vuelve a intentarlo.');
      if(packageBlobUrl) URL.revokeObjectURL(packageBlobUrl);
      packageBlobUrl = URL.createObjectURL(blob);
      downloadGrokPackage.href = packageBlobUrl;
      downloadGrokPackage.download = `${core.fileSlug(plan.brief.task)}-${totalDuration}s.${extension}`;
      downloadGrokPackage.hidden = false;
      packageStatus.textContent = 'Montaje terminado. Subiendo el master final y publicándolo en Pixeria…';
      packageProgress.firstElementChild.style.width = '94%';
      const clientRequestId = crypto.randomUUID();
      const response = await fetch('/presentaciones/api/video-package', {
        method:'POST', credentials:'same-origin',
        headers:{
          'content-type':finalType,
          accept:'application/json',
          'x-client-request-id':clientRequestId,
          'x-package-title':encodeURIComponent(`${plan.brief.task} · ${totalDuration}s`)
        },
        body:blob
      });
      const payload = await readApiResponse(response, 'No se pudo guardar el máster final de 25 segundos.');
      packageId = payload.id || '';
      if(payload.pixeria?.status === 'published') finishPackagePublication(payload);
      else{
        packageStatus.textContent = payload.pixeria?.error || 'El master está guardado en ADmiraNeXT, pero Pixeria todavía no lo ha incorporado.';
        composeGrokPackage.textContent = 'Reintentar Pixeria';
        composeGrokPackage.disabled = false;
      }
    }catch(error){
      packageStatus.textContent = error.message || 'No se pudo montar el master final.';
      composeGrokPackage.textContent = 'Volver a montar 25s';
      composeGrokPackage.disabled = false;
    }finally{
      if(!grokVideo.paused) grokVideo.pause();
      stream.getTracks().forEach(track => track.stop());
      capturedVideoStream?.getTracks().forEach(track => track.stop());
      if(packageAudioClock){ try{ packageAudioClock.stop(); }catch(_){ /* Already stopped. */ } }
      if(packageAudioContext){ try{ await packageAudioContext.close(); }catch(_){ /* Best effort. */ } }
    }
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

  adIdeaForm.addEventListener('submit', createAdIdea);
  adIdeaForm.addEventListener('input', (event) => {
    adIdeaAccess.hidden = true;
    if(event.target === adIdeaInput) syncAdIdeaAgentMode(true);
  });
  developAdButton.addEventListener('click', () => { void developAdIdea(); });
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
  referenceVideo.addEventListener('change', () => { void selectReferenceVideo(); });
  referenceModeInputs.forEach(input => input.addEventListener('change', changeReferenceMode));
  loadReferenceUrl.addEventListener('click', () => { void loadReferenceFromUrl(); });
  referenceUrl.addEventListener('keydown', event => {
    if(event.key === 'Enter'){ event.preventDefault(); void loadReferenceFromUrl(); }
  });
  analyzeReference.addEventListener('click', () => { void analyzeReferenceVideo(); });
  clearReference.addEventListener('click', () => clearReferenceVideo(true));
  composeGrokPackage.addEventListener('click', () => { void composeAndPublishGrokPackage(); });
  copyGrokUrl.addEventListener('click', () => copyText(grokVideoUrl, copyGrokUrl, 'Copiar URL'));
  prepareMeta.addEventListener('click', prepararMeta);
  metaVideo.addEventListener('change', (e) => traerVideoMeta(e.target.files && e.target.files[0]));
  reduceMotion.addEventListener('change', restart);
  window.addEventListener('beforeunload', () => {
    cancelAnimationFrame(animationFrame);
    window.clearTimeout(grokPollTimer);
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    if(referenceObjectUrl) URL.revokeObjectURL(referenceObjectUrl);
    if(packageBlobUrl) URL.revokeObjectURL(packageBlobUrl);
  });

  adDate.value = todayValue();
  syncAdIdeaAgentMode(false);
  loadAdIdeas();
  renderAdIdeas();
  loadDraft();
  loadReferenceProfile();
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
