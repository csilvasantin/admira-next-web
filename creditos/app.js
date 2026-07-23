(function () {
  'use strict';

  const FORMATS = {
    wide: { width: 1920, height: 1080, label: '16-9' },
    vertical: { width: 1080, height: 1920, label: '9-16' },
    square: { width: 1080, height: 1080, label: '1-1' }
  };

  const THEMES = {
    signal: {
      background: '#020503',
      backgroundGlow: '#12331c',
      foreground: '#effff3',
      muted: '#98ae9e',
      accent: '#9bff68',
      grid: 'rgba(155,255,104,0.055)'
    },
    electric: {
      background: '#02070a',
      backgroundGlow: '#073342',
      foreground: '#f0fbff',
      muted: '#8fa8b1',
      accent: '#66e4ff',
      grid: 'rgba(102,228,255,0.05)'
    },
    warm: {
      background: '#0b0503',
      backgroundGlow: '#4b210d',
      foreground: '#fff8ed',
      muted: '#b6a69a',
      accent: '#ffad5c',
      grid: 'rgba(255,173,92,0.05)'
    },
    mono: {
      background: '#000000',
      backgroundGlow: '#1b1b1b',
      foreground: '#ffffff',
      muted: '#a1a1a1',
      accent: '#ffffff',
      grid: 'rgba(255,255,255,0.035)'
    }
  };

  const STORAGE_KEY = 'admiranext-credits-v1';
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
  const exportVideoButton = document.getElementById('export-video');
  const exportProgress = document.getElementById('export-progress');
  const exportProgressBar = document.getElementById('export-progress-bar');
  const exportProgressLabel = document.getElementById('export-progress-label');
  const liveStatus = document.getElementById('live-status');

  const state = {
    playing: false,
    exporting: false,
    elapsed: 0,
    startedAt: 0,
    animationFrame: 0
  };

  function readData() {
    return {
      projectTitle: fields.projectTitle.value.trim() || 'Sin título',
      projectKicker: fields.projectKicker.value.trim(),
      credits: fields.credits.value,
      finalMessage: fields.finalMessage.value.trim() || 'GRACIAS',
      format: FORMATS[fields.format.value] ? fields.format.value : 'wide',
      theme: THEMES[fields.theme.value] ? fields.theme.value : 'signal',
      duration: Number(fields.duration.value) || 18
    };
  }

  function parseCredits(source) {
    return source
      .split(/\r?\n/)
      .map((line) => line.trim())
      .map((line) => {
        if (!line || line === '---') return { type: 'space' };
        const section = line.match(/^\[(.+)]$/);
        if (section) return { type: 'section', text: section[1].trim() };
        const separator = line.indexOf('|');
        if (separator > -1) {
          return {
            type: 'pair',
            role: line.slice(0, separator).trim(),
            name: line.slice(separator + 1).trim()
          };
        }
        return { type: 'single', text: line };
      });
  }

  function setCanvasFormat(formatKey) {
    const format = FORMATS[formatKey];
    if (canvas.width !== format.width || canvas.height !== format.height) {
      canvas.width = format.width;
      canvas.height = format.height;
    }
    canvas.style.aspectRatio = `${format.width} / ${format.height}`;
  }

  function fontSizeFor(width, base) {
    return Math.round(base * Math.min(1, width / 1920) * (width < 1200 ? 1.34 : 1));
  }

  function getLayout(data) {
    const format = FORMATS[data.format];
    const unit = Math.min(format.width, format.height);
    const sectionSize = Math.max(22, fontSizeFor(format.width, 32));
    const textSize = Math.max(26, fontSizeFor(format.width, 38));
    const lineGap = Math.round(textSize * 1.55);
    const sectionGap = Math.round(sectionSize * 2.5);
    const side = Math.round(unit * 0.11);
    const rows = parseCredits(data.credits);
    let contentHeight = Math.round(format.height * 0.42);

    rows.forEach((row) => {
      if (row.type === 'section') contentHeight += sectionGap;
      else if (row.type === 'space') contentHeight += Math.round(lineGap * 0.65);
      else contentHeight += lineGap;
    });
    contentHeight += Math.round(format.height * 0.4);

    return { format, rows, sectionSize, textSize, lineGap, sectionGap, side, contentHeight };
  }

  function roundedRect(context, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + width, y, x + width, y + height, r);
    context.arcTo(x + width, y + height, x, y + height, r);
    context.arcTo(x, y + height, x, y, r);
    context.arcTo(x, y, x + width, y, r);
    context.closePath();
  }

  function drawBackground(theme, format, time) {
    ctx.fillStyle = theme.background;
    ctx.fillRect(0, 0, format.width, format.height);

    const glow = ctx.createRadialGradient(
      format.width * (0.72 + Math.sin(time * 0.0002) * 0.03),
      format.height * 0.24,
      0,
      format.width * 0.66,
      format.height * 0.28,
      Math.max(format.width, format.height) * 0.72
    );
    glow.addColorStop(0, theme.backgroundGlow);
    glow.addColorStop(0.46, theme.background);
    glow.addColorStop(1, theme.background);
    ctx.globalAlpha = 0.68;
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, format.width, format.height);
    ctx.globalAlpha = 1;

    const grid = Math.max(46, Math.round(Math.min(format.width, format.height) / 18));
    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= format.width; x += grid) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, format.height);
    }
    for (let y = 0; y <= format.height; y += grid) {
      ctx.moveTo(0, y);
      ctx.lineTo(format.width, y);
    }
    ctx.stroke();

    const vignette = ctx.createRadialGradient(
      format.width / 2,
      format.height / 2,
      Math.min(format.width, format.height) * 0.2,
      format.width / 2,
      format.height / 2,
      Math.max(format.width, format.height) * 0.72
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.72)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, format.width, format.height);
  }

  function setFont(size, weight, mono) {
    const family = mono
      ? '"JetBrains Mono", "SFMono-Regular", Consolas, monospace'
      : 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.font = `${weight} ${size}px ${family}`;
  }

  function fitText(text, maxWidth, startSize, weight, mono) {
    let size = startSize;
    setFont(size, weight, mono);
    while (size > 18 && ctx.measureText(text).width > maxWidth) {
      size -= 2;
      setFont(size, weight, mono);
    }
    return size;
  }

  function drawBrand(theme, format, alpha) {
    const unit = Math.min(format.width, format.height);
    const pad = Math.round(unit * 0.055);
    const mark = Math.round(unit * 0.036);
    ctx.globalAlpha = alpha * 0.82;
    ctx.fillStyle = theme.accent;
    ctx.fillRect(pad, pad, mark, mark);
    ctx.fillStyle = theme.background;
    setFont(Math.max(14, Math.round(mark * 0.34)), 900, true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('AN', pad + mark / 2, pad + mark / 2);
    ctx.fillStyle = theme.foreground;
    setFont(Math.max(14, Math.round(mark * 0.32)), 800, true);
    ctx.textAlign = 'left';
    ctx.fillText('ADmiraNeXT', pad + mark * 1.45, pad + mark / 2);
    ctx.globalAlpha = 1;
  }

  function drawIntro(data, layout, theme, progress) {
    const { format } = layout;
    const ease = 1 - Math.pow(1 - Math.min(1, progress * 1.5), 3);
    const fade = progress < 0.72 ? ease : Math.max(0, (1 - progress) / 0.28);
    const centerX = format.width / 2;
    const centerY = format.height / 2;
    const maxWidth = format.width * 0.76;
    const titleSize = fitText(
      data.projectTitle,
      maxWidth,
      Math.round(Math.min(format.width, format.height) * 0.092),
      850,
      false
    );

    ctx.globalAlpha = fade;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = theme.accent;
    setFont(Math.max(18, Math.round(titleSize * 0.24)), 700, true);
    ctx.letterSpacing = '0.16em';
    ctx.fillText(data.projectKicker.toUpperCase(), centerX, centerY - titleSize * 1.05);
    ctx.letterSpacing = '0px';

    ctx.fillStyle = theme.foreground;
    setFont(titleSize, 850, false);
    ctx.fillText(data.projectTitle, centerX, centerY + (1 - ease) * 42);

    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = Math.max(2, titleSize * 0.025);
    ctx.beginPath();
    ctx.moveTo(centerX - maxWidth * 0.09 * ease, centerY + titleSize * 0.92);
    ctx.lineTo(centerX + maxWidth * 0.09 * ease, centerY + titleSize * 0.92);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawWrappedCentered(text, x, y, maxWidth, lineHeight, theme, size) {
    const words = text.split(/\s+/);
    const lines = [];
    let line = '';
    setFont(size, 500, false);
    words.forEach((word) => {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    });
    if (line) lines.push(line);
    ctx.fillStyle = theme.foreground;
    ctx.textAlign = 'center';
    lines.forEach((item, index) => ctx.fillText(item, x, y + index * lineHeight));
    return lines.length * lineHeight;
  }

  function drawCredits(data, layout, theme, progress) {
    const { format, rows, sectionSize, textSize, lineGap, sectionGap, side, contentHeight } = layout;
    const startY = format.height + Math.round(format.height * 0.12);
    const endY = -contentHeight;
    let y = startY + (endY - startY) * progress;
    const centerX = format.width / 2;
    const usableWidth = format.width - side * 2;
    const isNarrow = data.format === 'vertical';

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, format.width, format.height);
    ctx.clip();

    ctx.globalAlpha = Math.min(1, progress * 8, (1 - progress) * 8);
    ctx.textBaseline = 'middle';

    const labelSize = Math.max(16, Math.round(sectionSize * 0.72));
    ctx.fillStyle = theme.accent;
    setFont(labelSize, 700, true);
    ctx.textAlign = 'center';
    ctx.fillText('FINAL CREDITS', centerX, y);
    y += Math.round(format.height * 0.13);

    ctx.fillStyle = theme.foreground;
    const headingSize = fitText(data.projectTitle, usableWidth, Math.round(textSize * 1.72), 850, false);
    setFont(headingSize, 850, false);
    ctx.fillText(data.projectTitle, centerX, y);
    y += Math.round(format.height * 0.15);

    rows.forEach((row) => {
      if (row.type === 'space') {
        y += Math.round(lineGap * 0.65);
        return;
      }

      if (row.type === 'section') {
        y += Math.round(sectionGap * 0.42);
        ctx.fillStyle = theme.accent;
        setFont(sectionSize, 750, true);
        ctx.textAlign = 'center';
        ctx.fillText(row.text.toUpperCase(), centerX, y);
        ctx.fillStyle = theme.foreground;
        y += Math.round(sectionGap * 0.58);
        return;
      }

      if (row.type === 'pair' && !isNarrow) {
        setFont(textSize, 450, false);
        ctx.fillStyle = theme.muted;
        ctx.textAlign = 'right';
        ctx.fillText(row.role, centerX - Math.round(textSize * 0.8), y);
        ctx.fillStyle = theme.foreground;
        ctx.textAlign = 'left';
        setFont(textSize, 650, false);
        ctx.fillText(row.name, centerX + Math.round(textSize * 0.8), y);
        y += lineGap;
        return;
      }

      if (row.type === 'pair') {
        const narrowRole = Math.max(18, Math.round(textSize * 0.68));
        ctx.fillStyle = theme.muted;
        setFont(narrowRole, 550, true);
        ctx.textAlign = 'center';
        ctx.fillText(row.role.toUpperCase(), centerX, y);
        y += Math.round(lineGap * 0.55);
        ctx.fillStyle = theme.foreground;
        setFont(textSize, 650, false);
        ctx.fillText(row.name, centerX, y);
        y += Math.round(lineGap * 1.25);
        return;
      }

      const used = drawWrappedCentered(
        row.text,
        centerX,
        y,
        usableWidth * 0.82,
        lineGap,
        theme,
        textSize
      );
      y += used;
    });

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawOutro(data, layout, theme, progress) {
    const { format } = layout;
    const smooth = progress * progress * (3 - 2 * progress);
    const alpha = Math.min(1, progress * 3);
    const centerX = format.width / 2;
    const centerY = format.height / 2;
    const unit = Math.min(format.width, format.height);
    const finalSize = fitText(
      data.finalMessage,
      format.width * 0.78,
      Math.round(unit * 0.16),
      900,
      false
    );

    ctx.globalAlpha = alpha;
    ctx.fillStyle = theme.accent;
    setFont(Math.max(18, Math.round(finalSize * 0.18)), 700, true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('THE END / THE BEGINNING', centerX, centerY - finalSize * 0.95);

    ctx.fillStyle = theme.foreground;
    setFont(finalSize, 900, false);
    ctx.fillText(data.finalMessage, centerX, centerY + (1 - smooth) * 36);

    const pillWidth = Math.round(unit * 0.28);
    const pillHeight = Math.max(42, Math.round(unit * 0.05));
    const pillY = centerY + finalSize * 1.05;
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = Math.max(2, Math.round(unit * 0.002));
    roundedRect(ctx, centerX - pillWidth / 2, pillY, pillWidth, pillHeight, pillHeight / 2);
    ctx.stroke();
    ctx.fillStyle = theme.accent;
    setFont(Math.max(14, Math.round(pillHeight * 0.3)), 700, true);
    ctx.fillText('ADMIRANEXT.COM', centerX, pillY + pillHeight / 2);
    ctx.globalAlpha = 1;
  }

  function renderAt(elapsedSeconds, dataOverride) {
    const data = dataOverride || readData();
    setCanvasFormat(data.format);
    const layout = getLayout(data);
    const theme = THEMES[data.theme];
    const duration = data.duration;
    const introDuration = Math.min(2.4, Math.max(1.4, duration * 0.14));
    const outroDuration = Math.min(3.2, Math.max(2.1, duration * 0.18));
    const scrollDuration = Math.max(1, duration - introDuration - outroDuration);
    const elapsed = Math.max(0, Math.min(duration, elapsedSeconds));

    drawBackground(theme, layout.format, elapsed * 1000);
    drawBrand(theme, layout.format, elapsed > duration - outroDuration ? 0 : 1);

    if (elapsed < introDuration) {
      drawIntro(data, layout, theme, elapsed / introDuration);
    } else if (elapsed < introDuration + scrollDuration) {
      drawCredits(data, layout, theme, (elapsed - introDuration) / scrollDuration);
    } else {
      drawOutro(data, layout, theme, (elapsed - introDuration - scrollDuration) / outroDuration);
    }
    return { elapsed, duration };
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
    stagePlayButton.hidden = state.playing || elapsed > 0;
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
    const timeline = renderAt(state.playing ? 0 : Math.min(0.9, data.duration * 0.06), data);
    updateTransport(0, timeline.duration);
    liveStatus.textContent = 'Créditos al inicio.';
  }

  function save() {
    const data = readData();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return data;
  }

  function loadSaved() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!data) return;
      Object.keys(fields).forEach((key) => {
        if (data[key] !== undefined) fields[key].value = data[key];
      });
    } catch (error) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  function refresh() {
    stopPlayback(false);
    state.elapsed = 0;
    const data = save();
    durationOutput.value = `${data.duration} s`;
    const timeline = renderAt(Math.min(0.9, data.duration * 0.06), data);
    updateTransport(0, timeline.duration);
  }

  function slugify(text) {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || 'creditos';
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

  function mediaRecorderOptions() {
    const candidates = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm'
    ];
    const mimeType = candidates.find((type) => MediaRecorder.isTypeSupported(type));
    return mimeType ? { mimeType, videoBitsPerSecond: 10_000_000 } : { videoBitsPerSecond: 10_000_000 };
  }

  async function exportVideo() {
    if (state.exporting) return;
    if (!canvas.captureStream || typeof MediaRecorder === 'undefined') {
      liveStatus.textContent = 'Este navegador no permite exportar vídeo. Usa Chrome, Edge o Firefox reciente.';
      return;
    }

    stopPlayback(false);
    state.exporting = true;
    state.elapsed = 0;
    exportVideoButton.disabled = true;
    exportProgress.hidden = false;
    exportProgressBar.style.width = '0%';
    exportProgressLabel.textContent = 'Preparando vídeo…';
    liveStatus.textContent = 'Renderizando vídeo en tiempo real…';

    const data = readData();
    setCanvasFormat(data.format);
    renderAt(0, data);
    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, mediaRecorderOptions());
    const chunks = [];
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size) chunks.push(event.data);
    };

    const finished = new Promise((resolve, reject) => {
      recorder.onerror = () => reject(recorder.error || new Error('Error de MediaRecorder'));
      recorder.onstop = resolve;
    });

    const start = performance.now();
    recorder.start(1000);

    await new Promise((resolve) => {
      function exportFrame(now) {
        const elapsed = Math.min(data.duration, (now - start) / 1000);
        renderAt(elapsed, data);
        const percent = Math.min(100, (elapsed / data.duration) * 100);
        exportProgressBar.style.width = `${percent}%`;
        exportProgressLabel.textContent = `Renderizando vídeo… ${Math.round(percent)}%`;
        updateTransport(elapsed, data.duration);
        if (elapsed >= data.duration) {
          recorder.stop();
          resolve();
          return;
        }
        requestAnimationFrame(exportFrame);
      }
      requestAnimationFrame(exportFrame);
    });

    try {
      await finished;
      const type = recorder.mimeType || 'video/webm';
      downloadBlob(new Blob(chunks, { type }), `${slugify(data.projectTitle)}-creditos.webm`);
      liveStatus.textContent = 'Vídeo exportado correctamente.';
    } catch (error) {
      liveStatus.textContent = `No se pudo exportar el vídeo: ${error.message}`;
    } finally {
      stream.getTracks().forEach((track) => track.stop());
      state.exporting = false;
      exportVideoButton.disabled = false;
      exportProgress.hidden = true;
      state.elapsed = data.duration;
      renderAt(state.elapsed, data);
      updateTransport(state.elapsed, data.duration);
    }
  }

  function htmlDocument(data) {
    const payload = JSON.stringify(data).replace(/</g, '\\u003c');
    const renderer = [
      `const DATA=${payload};`,
      `const THEMES=${JSON.stringify(THEMES)};`,
      `const FORMATS=${JSON.stringify(FORMATS)};`,
      `const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');`,
      `const f=FORMATS[DATA.format],t=THEMES[DATA.theme];canvas.width=f.width;canvas.height=f.height;`,
      `const rows=DATA.credits.split(/\\r?\\n/).map(v=>v.trim()).map(v=>!v||v==='---'?{type:'space'}:/^\\[(.+)]$/.test(v)?{type:'section',text:v.slice(1,-1)}:v.includes('|')?{type:'pair',role:v.split('|')[0].trim(),name:v.split('|').slice(1).join('|').trim()}:{type:'single',text:v});`,
      `const unit=Math.min(f.width,f.height),side=unit*.11,text=Math.max(28,unit*.038),line=text*1.65;let content=f.height*.42;rows.forEach(r=>content+=r.type==='section'?line*2:r.type==='space'?line*.65:line);content+=f.height*.4;`,
      `function font(size,weight=500,mono=false){ctx.font=weight+' '+size+'px '+(mono?'monospace':'Arial, sans-serif')}`,
      `function bg(){ctx.fillStyle=t.background;ctx.fillRect(0,0,f.width,f.height);const g=ctx.createRadialGradient(f.width*.72,f.height*.24,0,f.width*.66,f.height*.28,Math.max(f.width,f.height)*.72);g.addColorStop(0,t.backgroundGlow);g.addColorStop(.52,t.background);g.addColorStop(1,t.background);ctx.fillStyle=g;ctx.fillRect(0,0,f.width,f.height)}`,
      `function frame(sec){bg();const intro=Math.min(2.4,Math.max(1.4,DATA.duration*.14)),outro=Math.min(3.2,Math.max(2.1,DATA.duration*.18)),scroll=DATA.duration-intro-outro,cx=f.width/2,cy=f.height/2;ctx.textAlign='center';ctx.textBaseline='middle';if(sec<intro){const p=sec/intro,a=p<.72?Math.min(1,p*1.5):(1-p)/.28;ctx.globalAlpha=Math.max(0,a);ctx.fillStyle=t.accent;font(text*.75,700,true);ctx.fillText(DATA.projectKicker.toUpperCase(),cx,cy-text*2);ctx.fillStyle=t.foreground;font(unit*.09,800);ctx.fillText(DATA.projectTitle,cx,cy)}else if(sec<intro+scroll){const p=(sec-intro)/scroll;let y=f.height*1.12+(-content-f.height*1.12)*p;ctx.globalAlpha=Math.min(1,p*8,(1-p)*8);ctx.fillStyle=t.accent;font(text*.75,700,true);ctx.fillText('FINAL CREDITS',cx,y);y+=f.height*.13;ctx.fillStyle=t.foreground;font(text*1.7,800);ctx.fillText(DATA.projectTitle,cx,y);y+=f.height*.15;rows.forEach(r=>{if(r.type==='space'){y+=line*.65;return}if(r.type==='section'){y+=line*.5;ctx.fillStyle=t.accent;font(text*.75,700,true);ctx.fillText(r.text.toUpperCase(),cx,y);y+=line*1.5;return}ctx.fillStyle=t.foreground;font(text,600);ctx.fillText(r.type==='pair'?r.role+'  ·  '+r.name:r.text,cx,y);y+=line})}else{const p=(sec-intro-scroll)/outro;ctx.globalAlpha=Math.min(1,p*3);ctx.fillStyle=t.accent;font(text*.72,700,true);ctx.fillText('THE END / THE BEGINNING',cx,cy-unit*.13);ctx.fillStyle=t.foreground;font(unit*.15,900);ctx.fillText(DATA.finalMessage,cx,cy)}}`,
      `let start=performance.now();function tick(now){const sec=((now-start)/1000)%DATA.duration;frame(sec);requestAnimationFrame(tick)}requestAnimationFrame(tick);`
    ].join('');

    return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${data.projectTitle.replace(/[<>&"']/g, '')} · Créditos</title>
<style>*{box-sizing:border-box}html,body{width:100%;height:100%;margin:0;background:#000;overflow:hidden}body{display:grid;place-items:center}canvas{width:100%;height:100%;object-fit:contain}</style></head>
<body><canvas aria-label="Créditos animados"></canvas><script>${renderer}<\/script></body></html>`;
  }

  function exportHtml() {
    const data = readData();
    downloadBlob(
      new Blob([htmlDocument(data)], { type: 'text/html;charset=utf-8' }),
      `${slugify(data.projectTitle)}-creditos.html`
    );
    liveStatus.textContent = 'HTML autónomo exportado.';
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

  Object.values(fields).forEach((field) => {
    field.addEventListener(field.type === 'range' || field.tagName === 'SELECT' ? 'input' : 'input', refresh);
  });
  document.getElementById('credits-form').addEventListener('submit', (event) => event.preventDefault());
  document.getElementById('load-example').addEventListener('click', loadExample);
  playPauseButton.addEventListener('click', togglePlayback);
  stagePlayButton.addEventListener('click', togglePlayback);
  canvas.addEventListener('click', togglePlayback);
  document.getElementById('restart').addEventListener('click', restart);
  document.getElementById('fullscreen').addEventListener('click', () => {
    const stage = document.getElementById('stage-wrap');
    if (document.fullscreenElement) document.exitFullscreen();
    else stage.requestFullscreen().catch(() => {
      liveStatus.textContent = 'El navegador no permitió abrir la pantalla completa.';
    });
  });
  document.getElementById('export-html').addEventListener('click', exportHtml);
  exportVideoButton.addEventListener('click', exportVideo);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.playing && !state.exporting) togglePlayback();
  });
  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) {
      event.preventDefault();
      togglePlayback();
    }
  });

  loadSaved();
  refresh();
})();
