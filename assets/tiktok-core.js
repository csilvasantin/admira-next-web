(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TikTokCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const PRESENTER = {
    fusion: {
      name: 'Pix Fusion',
      opening: ['Atajo detectado', 'Mira este atajo', 'Quince segundos. Una solución'],
      close: 'Menos clics. Más hecho.',
      proof: 'PROBADO · 15S',
      character: 'Pix combina el gancho de Chispa con el rigor de Nexo.'
    },
    pix: {
      name: 'Pix',
      opening: ['Menos clics', 'Hazlo más fácil', 'Siguiente paso útil'],
      close: 'Menos clics. Más hecho.',
      proof: 'PIX · PROBADO',
      character: 'Pix es directo, compacto y orientado a una acción útil.'
    },
    chispa: {
      name: 'Chispa',
      opening: ['Atajo detectado', 'Te ahorro unos clics', 'Misión rápida'],
      close: 'Atajo guardado.',
      proof: 'ATAJO · LISTO',
      character: 'Chispa aporta energía, complicidad y ritmo de descubrimiento.'
    },
    nexo: {
      name: 'Nexo',
      opening: ['Te lo traduzco en 15', 'Del ruido a la utilidad', 'Dato, acción, resultado'],
      close: 'Ahora ya sabes qué hacer.',
      proof: 'FUENTE · REVISADA',
      character: 'Nexo prioriza claridad, autoridad y contexto verificable.'
    }
  };

  function clean(value, maxLength) {
    const text = String(value || '')
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!maxLength || text.length <= maxLength) return text;
    return text.slice(0, Math.max(1, maxLength - 1)).replace(/[\s,;:.!?-]+$/g, '') + '…';
  }

  function withoutTrailingPunctuation(value) {
    return clean(value).replace(/[.!?;:,]+$/g, '');
  }

  function lowerFirst(value) {
    const text = clean(value);
    if (!text) return text;
    return text.charAt(0).toLocaleLowerCase('es') + text.slice(1);
  }

  function countWords(value) {
    const text = clean(value);
    return text ? text.split(/\s+/).length : 0;
  }

  function compactPhrase(value, limit) {
    const text = clean(value);
    const words = text.split(/\s+/);
    if (words.length <= limit) return text;
    return words.slice(0, limit).join(' ').replace(/[,:;.-]+$/g, '') + '…';
  }

  function sentence(value) {
    const text = clean(value);
    if (!text) return '';
    return /[.!?]$/.test(text) ? text : text + '.';
  }

  function makeHook(task, opening, tone, variant) {
    const shortTask = compactPhrase(withoutTrailingPunctuation(task), 10);
    if (tone === 'expert') return `${opening}: ${lowerFirst(shortTask)}.`;
    if (tone === 'minimal') return `${opening}. ${shortTask}.`;
    if (tone === 'playful' || variant === 1) return `${opening}: ¿todavía haces esto a mano?`;
    if (variant === 2) return `¿${shortTask.charAt(0).toLocaleUpperCase('es') + shortTask.slice(1)}? ${opening}.`;
    return `${opening}: ${lowerFirst(shortTask)}.`;
  }

  function paceFor(words) {
    if (words <= 26) return { label: 'Pausado', level: 'slow', words };
    if (words <= 42) return { label: 'Óptimo', level: 'good', words };
    if (words <= 48) return { label: 'Rápido', level: 'fast', words };
    return { label: 'Revisar', level: 'too-fast', words };
  }

  function buildBriefFromAd(input) {
    const data = input || {};
    const idea = clean(data.idea, 180) || 'Presentar una oferta útil de forma clara';
    const brand = clean(data.brand, 90) || 'la marca';
    const detail = clean(data.detail, 220);
    const audience = clean(data.audience, 110) || 'Personas que pueden beneficiarse de la oferta';
    const objective = ['leads', 'visits', 'sales', 'launch', 'awareness'].includes(data.objective) ? data.objective : 'leads';
    const outcomes = {
      leads: { result: 'Más personas interesadas solicitando información', cta: 'Pide información hoy' },
      visits: { result: `Más visitas a ${brand}`, cta: 'Ven a conocernos hoy' },
      sales: { result: 'Una propuesta clara que facilita la decisión', cta: 'Descúbrelo hoy' },
      launch: { result: 'Un lanzamiento fácil de entender y recordar', cta: 'Descúbrelo antes que nadie' },
      awareness: { result: `${brand} en la mente del público adecuado`, cta: 'Conoce la historia completa' }
    };
    const outcome = outcomes[objective];

    return {
      task: idea,
      solution: detail || `Muestra cómo ${brand} convierte esta idea en una experiencia sencilla y creíble`,
      result: outcome.result,
      presenter: 'fusion',
      tone: objective === 'awareness' ? 'minimal' : 'energetic',
      audience,
      cta: outcome.cta
    };
  }

  function buildPlan(input, variation) {
    const data = input || {};
    const variant = Math.abs(Number(variation) || 0) % 3;
    const presenterKey = PRESENTER[data.presenter] ? data.presenter : 'fusion';
    const presenter = PRESENTER[presenterKey];
    const task = clean(data.task, 180) || 'Resolver una tarea repetitiva';
    const solution = clean(data.solution, 220) || 'Usa una herramienta y completa el siguiente paso';
    const result = clean(data.result, 150) || 'La tarea terminada con menos fricción';
    const audience = clean(data.audience, 110) || 'Personas que quieren ahorrar tiempo';
    const cta = withoutTrailingPunctuation(clean(data.cta, 90) || 'Guárdalo y pruébalo hoy');
    const tone = clean(data.tone, 20) || 'energetic';
    const sourceUrl = clean(data.sourceUrl, 1600);
    const sourceTitle = clean(data.sourceTitle, 180);
    const sourceSummary = clean(data.sourceSummary, 600);
    const sourceKeyPoints = (Array.isArray(data.sourceKeyPoints) ? data.sourceKeyPoints : [])
      .map(item => clean(item, 240)).filter(Boolean).slice(0, 5);
    const source = sourceUrl ? {
      kind:clean(data.sourceKind, 30) || 'web',
      url:sourceUrl,
      title:sourceTitle,
      summary:sourceSummary,
      keyPoints:sourceKeyPoints
    } : null;
    const opening = presenter.opening[variant];
    const hook = makeHook(task, opening, tone, variant);
    const action = sentence(compactPhrase(solution, 18));
    const payoff = sentence(`${compactPhrase(result, 10)}. ${cta}`.replace('..', '.'));
    const close = presenter.close;
    const script = clean(`${hook} ${action} ${payoff} ${close}`);
    const pace = paceFor(countWords(script));

    const scenes = [
      {
        id: 'hook',
        from: 0,
        to: 3,
        label: opening.toLocaleUpperCase('es'),
        headline: compactPhrase(task, 11),
        body: audience,
        direction: 'Entrada inmediata. Problema cotidiano, texto grande y personaje en silueta.'
      },
      {
        id: 'action',
        from: 3,
        to: 11,
        label: 'DOS PASOS · MÁXIMO',
        headline: compactPhrase(solution, 14),
        body: 'Captura o demostración centrada en una única acción verificable.',
        direction: 'Mostrar la herramienta, resaltar el gesto y mantener máximo tres capas visuales.'
      },
      {
        id: 'result',
        from: 11,
        to: 15,
        label: presenter.proof,
        headline: compactPhrase(result, 10),
        body: `${cta}. ${close}`,
        direction: 'Resultado visible, sello de prueba y cierre de marca sin añadir una idea nueva.'
      }
    ];

    const sourceDirection = source ? [
      `This video summarizes the supplied source titled: ${sourceTitle || task}.`,
      sourceSummary ? `Factual source summary: ${clean(sourceSummary, 360)}.` : '',
      sourceKeyPoints.length ? `Key source points: ${sourceKeyPoints.slice(0, 3).map(item => clean(item, 160)).join(' | ')}.` : '',
      'Preserve the meaning of these facts and do not add claims that are absent from the source.'
    ].filter(Boolean).join(' ') : '';
    const grokPrompt = clean([
      'Create one original, cinematic vertical social video in a 9:16 aspect ratio, exactly 15 seconds long.',
      sourceDirection,
      `The visual story begins with the problem: ${task}.`,
      `It then reveals the solution through clear physical action: ${solution}.`,
      `Finish with the visible result: ${result}.`,
      `The intended audience is ${audience}.`,
      `Use ${presenter.name} as a friendly compact geometric robot guide, expressive through motion and staging rather than dialogue or typography.`,
      'Make it one coherent continuous sequence with confident camera movement, premium futuristic production design, strong depth, and a precise dark technical palette with cyan light and one warm orange accent.',
      'PURE VIDEO CONTRACT: no visible text, no captions, no subtitles, no letters, no numbers, no logos, no watermarks, no social-network interface, and no trademarked products. Do not imitate a named artist, film, studio, campaign, character, or existing artwork. Avoid identifiable real people. Keep the action legible without words and suitable for commercial human review.'
    ].join(' '), 3000);

    return {
      version: 'admiranext-tiktok-plan-v1',
      generatedAt: new Date().toISOString(),
      duration: 15,
      format: { width: 1080, height: 1920, aspectRatio: '9:16', fps: 30 },
      variation: variant,
      presenter: { key: presenterKey, name: presenter.name, direction: presenter.character },
      brief: { task, solution, result, audience, cta, tone },
      source,
      script,
      pace,
      scenes,
      productionPrompt: `Vídeo vertical 9:16 de 15 segundos para ${audience}. Presentador ${presenter.name}. Tono ${tone}. ${presenter.character} Tres escenas exactas: problema de 0 a 3 segundos; demostración de 3 a 11; resultado y llamada a la acción de 11 a 15. Estética ADmiraNeXT: fondo oscuro cuadrático, señal cian, tipografía monoespaciada, alto contraste, subtítulos grandes, zonas seguras y movimiento preciso. Sin logos ajenos inventados, sin afirmaciones no verificadas.`,
      grokPrompt,
      voiceDirection: 'Voz cercana, clara y energética. Entre 145 y 165 palabras por minuto. Pausa breve tras el gancho y antes del resultado.'
    };
  }

  function sceneAt(plan, seconds) {
    const time = Math.max(0, Math.min(plan.duration, Number(seconds) || 0));
    return plan.scenes.find((scene) => time >= scene.from && time < scene.to) || plan.scenes[plan.scenes.length - 1];
  }

  function fileSlug(value) {
    return clean(value, 55)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'tiktok-15s';
  }

  return { PRESENTER, buildBriefFromAd, buildPlan, clean, countWords, paceFor, sceneAt, fileSlug };
});
