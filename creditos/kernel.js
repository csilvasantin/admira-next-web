(function (root, factory) {
  'use strict';
  root.AdmiraCreditsKernelFactory = factory;
  root.AdmiraCreditsKernel = factory();
})(typeof window !== 'undefined' ? window : globalThis, function createAdmiraCreditsKernel() {
  'use strict';

  const FORMATS = {
    wide: { width: 1920, height: 1080, label: '16-9' },
    vertical: { width: 1080, height: 1920, label: '9-16' },
    square: { width: 1080, height: 1080, label: '1-1' }
  };
  const THEMES = {
    signal: { background: '#020503', backgroundGlow: '#12331c', foreground: '#effff3', muted: '#98ae9e', accent: '#9bff68', grid: 'rgba(155,255,104,0.055)' },
    electric: { background: '#02070a', backgroundGlow: '#073342', foreground: '#f0fbff', muted: '#8fa8b1', accent: '#66e4ff', grid: 'rgba(102,228,255,0.05)' },
    warm: { background: '#0b0503', backgroundGlow: '#4b210d', foreground: '#fff8ed', muted: '#b6a69a', accent: '#ffad5c', grid: 'rgba(255,173,92,0.05)' },
    mono: { background: '#000000', backgroundGlow: '#1b1b1b', foreground: '#ffffff', muted: '#a1a1a1', accent: '#ffffff', grid: 'rgba(255,255,255,0.035)' }
  };
  const LIMITS = { maxCharacters: 12000, maxLines: 120, minDuration: 8, maxDuration: 90 };

  function boundedText(value, fallback, max) {
    const text = typeof value === 'string' ? value.trim() : '';
    return (text || fallback).slice(0, max);
  }

  function normalizeData(value) {
    const data = value && typeof value === 'object' ? value : {};
    const duration = Math.round(Number(data.duration));
    return {
      projectTitle: boundedText(data.projectTitle, 'Sin título', 80),
      projectKicker: boundedText(data.projectKicker, '', 100),
      credits: typeof data.credits === 'string' ? data.credits.slice(0, LIMITS.maxCharacters) : '',
      finalMessage: boundedText(data.finalMessage, 'GRACIAS', 90),
      format: FORMATS[data.format] ? data.format : 'wide',
      theme: THEMES[data.theme] ? data.theme : 'signal',
      duration: Math.min(LIMITS.maxDuration, Math.max(LIMITS.minDuration, Number.isFinite(duration) ? duration : 18))
    };
  }

  function parseCredits(source) {
    const diagnostics = [];
    const original = String(source || '');
    const sourceLines = original.slice(0, LIMITS.maxCharacters).split(/\r?\n/);
    const rows = sourceLines.slice(0, LIMITS.maxLines).map((raw, index) => {
      const lineNumber = index + 1;
      const line = raw.trim();
      if (!line || line === '---') return { type: 'space', line: lineNumber };
      const section = line.match(/^\[(.*)]$/);
      if (section) {
        const text = section[1].trim();
        if (!text) diagnostics.push({ line: lineNumber, level: 'warning', code: 'empty-section', message: 'La sección está vacía.' });
        return { type: 'section', text: text || 'SECCIÓN', line: lineNumber };
      }
      if (line.startsWith('[') || line.endsWith(']')) {
        diagnostics.push({ line: lineNumber, level: 'warning', code: 'section-syntax', message: 'Revisa los corchetes de la sección.' });
      }
      const separator = line.indexOf('|');
      if (separator > -1) {
        const role = line.slice(0, separator).trim();
        const name = line.slice(separator + 1).trim();
        if (!role || !name) diagnostics.push({ line: lineNumber, level: 'warning', code: 'empty-pair-side', message: 'Rol y nombre deben tener contenido.' });
        return { type: 'pair', role: role || '—', name: name || '—', line: lineNumber };
      }
      return { type: 'single', text: line, line: lineNumber };
    });
    if (sourceLines.length > LIMITS.maxLines) {
      diagnostics.push({ line: LIMITS.maxLines + 1, level: 'error', code: 'too-many-lines', message: `Máximo ${LIMITS.maxLines} líneas; el resto no se renderiza.` });
    }
    if (original.length > LIMITS.maxCharacters) {
      diagnostics.push({ line: 0, level: 'error', code: 'too-many-characters', message: `Máximo ${LIMITS.maxCharacters} caracteres; el resto no se renderiza.` });
    }
    if (!rows.some((row) => row.type !== 'space')) {
      diagnostics.push({ line: 0, level: 'warning', code: 'empty-credits', message: 'Añade al menos un crédito útil.' });
    }
    return { rows, diagnostics };
  }

  function estimateLineUnits(rows, formatKey) {
    const narrow = formatKey === 'vertical';
    return rows.reduce((total, row) => {
      if (row.type === 'space') return total + 0.55;
      if (row.type === 'section') return total + 1.7;
      if (row.type === 'pair') return total + (narrow ? 1.8 : 1);
      return total + Math.max(1, Math.ceil(String(row.text || '').length / (narrow ? 34 : 62)));
    }, 0);
  }

  function analyze(value) {
    const data = normalizeData(value);
    const parsed = parseCredits(value && value.credits);
    const usefulRows = parsed.rows.filter((row) => row.type !== 'space').length;
    const lineUnits = estimateLineUnits(parsed.rows, data.format);
    const recommendedDuration = Math.min(LIMITS.maxDuration, Math.max(LIMITS.minDuration, Math.ceil(5.5 + lineUnits * 0.72)));
    const diagnostics = parsed.diagnostics.slice();
    if (usefulRows > 0 && data.duration < recommendedDuration) {
      diagnostics.push({ line: 0, level: 'warning', code: 'duration-short', message: `Para leer ${usefulRows} créditos se recomiendan al menos ${recommendedDuration} s.` });
    }
    return { data, rows: parsed.rows, diagnostics, usefulRows, lineUnits, recommendedDuration };
  }

  function fontSizeFor(width, base) {
    return Math.round(base * Math.min(1, width / 1920) * (width < 1200 ? 1.34 : 1));
  }
  function font(ctx, size, weight, mono) {
    const family = mono ? '"JetBrains Mono", "SFMono-Regular", Consolas, monospace' : 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.font = `${weight} ${size}px ${family}`;
  }
  function fitText(ctx, text, maxWidth, startSize, weight, mono, minSize) {
    let size = startSize;
    font(ctx, size, weight, mono);
    while (size > minSize && ctx.measureText(text).width > maxWidth) {
      size -= 2;
      font(ctx, size, weight, mono);
    }
    return size;
  }
  function breakToken(ctx, token, maxWidth) {
    const pieces = [];
    let piece = '';
    Array.from(token).forEach((character) => {
      const candidate = piece + character;
      if (piece && ctx.measureText(candidate).width > maxWidth) {
        pieces.push(piece);
        piece = character;
      } else piece = candidate;
    });
    if (piece) pieces.push(piece);
    return pieces;
  }
  function wrapLines(ctx, text, maxWidth) {
    const lines = [];
    let line = '';
    String(text || '').split(/\s+/).filter(Boolean).forEach((word) => {
      const parts = ctx.measureText(word).width > maxWidth ? breakToken(ctx, word, maxWidth) : [word];
      parts.forEach((part) => {
        const candidate = line ? `${line} ${part}` : part;
        if (line && ctx.measureText(candidate).width > maxWidth) {
          lines.push(line);
          line = part;
        } else line = candidate;
      });
    });
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  }

  function getLayout(ctx, value) {
    const analysis = analyze(value);
    const data = analysis.data;
    const format = FORMATS[data.format];
    const unit = Math.min(format.width, format.height);
    const sectionSize = Math.max(22, fontSizeFor(format.width, 32));
    const textSize = Math.max(26, fontSizeFor(format.width, 38));
    const lineGap = Math.round(textSize * 1.55);
    const sectionGap = Math.round(sectionSize * 2.5);
    const side = Math.round(unit * 0.11);
    const usableWidth = format.width - side * 2;
    const rows = analysis.rows.map((row) => {
      if (row.type === 'single') {
        font(ctx, textSize, 500, false);
        return Object.assign({}, row, { lines: wrapLines(ctx, row.text, usableWidth * 0.82) });
      }
      if (row.type === 'pair' && data.format === 'vertical') {
        font(ctx, textSize, 650, false);
        return Object.assign({}, row, {
          roleLines: wrapLines(ctx, row.role, usableWidth * 0.82),
          nameLines: wrapLines(ctx, row.name, usableWidth * 0.82)
        });
      }
      return row;
    });
    let contentHeight = Math.round(format.height * 0.42);
    rows.forEach((row) => {
      if (row.type === 'section') contentHeight += sectionGap;
      else if (row.type === 'space') contentHeight += Math.round(lineGap * 0.65);
      else if (row.type === 'pair' && data.format === 'vertical') contentHeight += Math.round(lineGap * (0.55 + row.roleLines.length * 0.62 + row.nameLines.length));
      else if (row.type === 'single') contentHeight += lineGap * row.lines.length;
      else contentHeight += lineGap;
    });
    contentHeight += Math.round(format.height * 0.4);
    return Object.assign({}, analysis, { format, rows, sectionSize, textSize, lineGap, sectionGap, side, usableWidth, contentHeight });
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
  function drawBackground(ctx, theme, format, time) {
    ctx.fillStyle = theme.background;
    ctx.fillRect(0, 0, format.width, format.height);
    const glow = ctx.createRadialGradient(format.width * (0.72 + Math.sin(time * 0.0002) * 0.03), format.height * 0.24, 0, format.width * 0.66, format.height * 0.28, Math.max(format.width, format.height) * 0.72);
    glow.addColorStop(0, theme.backgroundGlow); glow.addColorStop(0.46, theme.background); glow.addColorStop(1, theme.background);
    ctx.globalAlpha = 0.68; ctx.fillStyle = glow; ctx.fillRect(0, 0, format.width, format.height); ctx.globalAlpha = 1;
    const grid = Math.max(46, Math.round(Math.min(format.width, format.height) / 18));
    ctx.strokeStyle = theme.grid; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = 0; x <= format.width; x += grid) { ctx.moveTo(x, 0); ctx.lineTo(x, format.height); }
    for (let y = 0; y <= format.height; y += grid) { ctx.moveTo(0, y); ctx.lineTo(format.width, y); }
    ctx.stroke();
    const vignette = ctx.createRadialGradient(format.width / 2, format.height / 2, Math.min(format.width, format.height) * 0.2, format.width / 2, format.height / 2, Math.max(format.width, format.height) * 0.72);
    vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(1, 'rgba(0,0,0,0.72)');
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, format.width, format.height);
  }
  function drawBrand(ctx, theme, format, alpha) {
    const unit = Math.min(format.width, format.height), pad = Math.round(unit * 0.055), mark = Math.round(unit * 0.036);
    ctx.globalAlpha = alpha * 0.82; ctx.fillStyle = theme.accent; ctx.fillRect(pad, pad, mark, mark);
    ctx.fillStyle = theme.background; font(ctx, Math.max(14, Math.round(mark * 0.34)), 900, true); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('AN', pad + mark / 2, pad + mark / 2);
    ctx.fillStyle = theme.foreground; font(ctx, Math.max(14, Math.round(mark * 0.32)), 800, true); ctx.textAlign = 'left'; ctx.fillText('ADmiraNeXT', pad + mark * 1.45, pad + mark / 2); ctx.globalAlpha = 1;
  }
  function drawIntro(ctx, data, layout, theme, progress) {
    const format = layout.format, ease = 1 - Math.pow(1 - Math.min(1, progress * 1.5), 3), fade = progress < 0.72 ? ease : Math.max(0, (1 - progress) / 0.28);
    const centerX = format.width / 2, centerY = format.height / 2, maxWidth = format.width * 0.76;
    const titleSize = fitText(ctx, data.projectTitle, maxWidth, Math.round(Math.min(format.width, format.height) * 0.092), 850, false, 18);
    ctx.globalAlpha = fade; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = theme.accent;
    const kickerSize = fitText(ctx, data.projectKicker.toUpperCase(), maxWidth, Math.max(18, Math.round(titleSize * 0.24)), 700, true, 14);
    font(ctx, kickerSize, 700, true); ctx.fillText(data.projectKicker.toUpperCase(), centerX, centerY - titleSize * 1.05);
    ctx.fillStyle = theme.foreground; font(ctx, titleSize, 850, false); ctx.fillText(data.projectTitle, centerX, centerY + (1 - ease) * 42);
    ctx.strokeStyle = theme.accent; ctx.lineWidth = Math.max(2, titleSize * 0.025); ctx.beginPath(); ctx.moveTo(centerX - maxWidth * 0.09 * ease, centerY + titleSize * 0.92); ctx.lineTo(centerX + maxWidth * 0.09 * ease, centerY + titleSize * 0.92); ctx.stroke(); ctx.globalAlpha = 1;
  }
  function drawLineGroup(ctx, lines, x, y, lineHeight) {
    lines.forEach((item, index) => ctx.fillText(item, x, y + index * lineHeight));
    return lines.length * lineHeight;
  }
  function drawCredits(ctx, data, layout, theme, progress) {
    const { format, rows, sectionSize, textSize, lineGap, sectionGap, usableWidth, contentHeight } = layout;
    let y = format.height + Math.round(format.height * 0.12) + (-contentHeight - format.height - Math.round(format.height * 0.12)) * progress;
    const centerX = format.width / 2;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, format.width, format.height); ctx.clip();
    ctx.globalAlpha = Math.min(1, progress * 8, (1 - progress) * 8); ctx.textBaseline = 'middle';
    ctx.fillStyle = theme.accent; font(ctx, Math.max(16, Math.round(sectionSize * 0.72)), 700, true); ctx.textAlign = 'center'; ctx.fillText('FINAL CREDITS', centerX, y); y += Math.round(format.height * 0.13);
    ctx.fillStyle = theme.foreground; const headingSize = fitText(ctx, data.projectTitle, usableWidth, Math.round(textSize * 1.72), 850, false, 18); font(ctx, headingSize, 850, false); ctx.fillText(data.projectTitle, centerX, y); y += Math.round(format.height * 0.15);
    rows.forEach((row) => {
      if (row.type === 'space') { y += Math.round(lineGap * 0.65); return; }
      if (row.type === 'section') {
        y += Math.round(sectionGap * 0.42); ctx.fillStyle = theme.accent;
        const size = fitText(ctx, row.text.toUpperCase(), usableWidth * 0.9, sectionSize, 750, true, 14); font(ctx, size, 750, true); ctx.textAlign = 'center'; ctx.fillText(row.text.toUpperCase(), centerX, y);
        ctx.fillStyle = theme.foreground; y += Math.round(sectionGap * 0.58); return;
      }
      if (row.type === 'pair' && data.format !== 'vertical') {
        const column = usableWidth * 0.43;
        const roleSize = fitText(ctx, row.role, column, textSize, 450, false, 16); font(ctx, roleSize, 450, false); ctx.fillStyle = theme.muted; ctx.textAlign = 'right'; ctx.fillText(row.role, centerX - Math.round(textSize * 0.8), y);
        const nameSize = fitText(ctx, row.name, column, textSize, 650, false, 16); font(ctx, nameSize, 650, false); ctx.fillStyle = theme.foreground; ctx.textAlign = 'left'; ctx.fillText(row.name, centerX + Math.round(textSize * 0.8), y); y += lineGap; return;
      }
      if (row.type === 'pair') {
        ctx.fillStyle = theme.muted; font(ctx, Math.max(18, Math.round(textSize * 0.68)), 550, true); ctx.textAlign = 'center';
        y += drawLineGroup(ctx, row.roleLines.map((line) => line.toUpperCase()), centerX, y, Math.round(lineGap * 0.62));
        y += Math.round(lineGap * 0.18); ctx.fillStyle = theme.foreground; font(ctx, textSize, 650, false);
        y += drawLineGroup(ctx, row.nameLines, centerX, y, lineGap); return;
      }
      ctx.fillStyle = theme.foreground; font(ctx, textSize, 500, false); ctx.textAlign = 'center'; y += drawLineGroup(ctx, row.lines, centerX, y, lineGap);
    });
    ctx.globalAlpha = 1; ctx.restore();
  }
  function drawOutro(ctx, data, layout, theme, progress) {
    const format = layout.format, smooth = progress * progress * (3 - 2 * progress), centerX = format.width / 2, centerY = format.height / 2, unit = Math.min(format.width, format.height);
    const finalSize = fitText(ctx, data.finalMessage, format.width * 0.78, Math.round(unit * 0.16), 900, false, 18);
    ctx.globalAlpha = Math.min(1, progress * 3); ctx.fillStyle = theme.accent; font(ctx, Math.max(18, Math.round(finalSize * 0.18)), 700, true); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('THE END / THE BEGINNING', centerX, centerY - finalSize * 0.95);
    ctx.fillStyle = theme.foreground; font(ctx, finalSize, 900, false); ctx.fillText(data.finalMessage, centerX, centerY + (1 - smooth) * 36);
    const pillWidth = Math.round(unit * 0.28), pillHeight = Math.max(42, Math.round(unit * 0.05)), pillY = centerY + finalSize * 1.05;
    ctx.strokeStyle = theme.accent; ctx.lineWidth = Math.max(2, Math.round(unit * 0.002)); roundedRect(ctx, centerX - pillWidth / 2, pillY, pillWidth, pillHeight, pillHeight / 2); ctx.stroke();
    ctx.fillStyle = theme.accent; font(ctx, Math.max(14, Math.round(pillHeight * 0.3)), 700, true); ctx.fillText('ADMIRANEXT.COM', centerX, pillY + pillHeight / 2); ctx.globalAlpha = 1;
  }

  function renderAt(ctx, value, elapsedSeconds) {
    const layout = getLayout(ctx, value), data = layout.data, format = layout.format, theme = THEMES[data.theme];
    const introDuration = Math.min(2.4, Math.max(1.4, data.duration * 0.14));
    const outroDuration = Math.min(3.2, Math.max(2.1, data.duration * 0.18));
    const scrollDuration = Math.max(1, data.duration - introDuration - outroDuration);
    const elapsed = Math.max(0, Math.min(data.duration, Number(elapsedSeconds) || 0));
    drawBackground(ctx, theme, format, elapsed * 1000); drawBrand(ctx, theme, format, elapsed > data.duration - outroDuration ? 0 : 1);
    if (elapsed < introDuration) drawIntro(ctx, data, layout, theme, elapsed / introDuration);
    else if (elapsed < introDuration + scrollDuration) drawCredits(ctx, data, layout, theme, (elapsed - introDuration) / scrollDuration);
    else drawOutro(ctx, data, layout, theme, (elapsed - introDuration - scrollDuration) / outroDuration);
    return { elapsed, duration: data.duration, data, analysis: layout };
  }

  return { FORMATS, THEMES, LIMITS, normalizeData, parseCredits, analyze, getLayout, renderAt };
});
