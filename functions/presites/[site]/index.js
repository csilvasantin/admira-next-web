import {esc, normalizePresite, presiteKey} from '../_presite.js';

function safeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function option(value, current, label) {
  return `<option value="${esc(value)}"${value === current ? ' selected' : ''}>${esc(label)}</option>`;
}

export async function onRequestGet({params, env}) {
  const stored = env.PRESENTATION_IDEAS && await env.PRESENTATION_IDEAS.get(presiteKey(params.site), {type: 'json'});
  if (!stored) return new Response('Presite no encontrado', {status: 404});
  const site = normalizePresite(stored, stored);
  const beats = site.storyboard.map((beat, index) => `<details class="ps-block" ${index === 0 ? 'open' : ''}>
    <summary><span>${String(index + 1).padStart(2, '0')}</span>${esc(beat.title)}</summary>
    <div class="ps-block-fields">
      <input name="cue" value="${esc(beat.cue)}" aria-label="Señal del beat ${index + 1}">
      <input name="title" value="${esc(beat.title)}" aria-label="Título del beat ${index + 1}">
      <textarea name="body" aria-label="Contenido del beat ${index + 1}">${esc(beat.body)}</textarea>
      <label class="ps-inline-label">Peso en el montaje · <input name="duration" type="number" min="5" max="50" value="${esc(beat.duration)}"></label>
      <input type="hidden" name="id" value="${esc(beat.id)}">
    </div>
  </details>`).join('');
  const html = `<!doctype html>
  <html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${esc(site.displayName)} · Storyboard Presites</title><link rel="icon" href="/favicon.ico"><link rel="stylesheet" href="/assets/presites-workspace.css?v=20260723-2"></head>
  <body><div class="ps-shell">
    <header class="ps-topbar"><a class="ps-brand" href="/presites/"><i></i><span>ADmiraNeXT · Presites</span><small>Storyboard</small></a><div class="ps-top-actions"><span class="ps-badge" id="presiteState">${site.status === 'review-ready' ? 'Revisión preparada' : 'Borrador'}</span><a class="ps-top-link hide-mobile" href="/presites/${esc(site.slug)}/export">Exportar intro</a><a class="ps-top-link" href="/presites/">Biblioteca</a></div></header>
    <main class="ps-wrap">
      <section class="ps-hero ps-hero-intro"><div><p class="ps-kicker">Title sequence lab · ${esc(site.quality.toUpperCase())}</p><h1>${esc(site.displayName)}</h1><p class="ps-lead">Monta los cinco beats de la secuencia, ensaya el ritmo y comprueba la salida antes de llevarla al destino real.</p></div><aside class="ps-hero-aside"><b>El espectador conserva el control</b><p>Skip está visible desde el primer fotograma. Esc salta, Enter entra, el sonido empieza apagado y el movimiento reducido muestra una portada estática.</p></aside></section>
      <div class="ps-workspace">
        <section class="ps-panel">
          <form id="presiteStudio">
            <div class="ps-section-heading"><span>01</span><div><h2>Dirección de la intro</h2><p class="sub">Ajustes globales y destino.</p></div></div>
            <div class="ps-form-grid" id="presiteSettings">
              <div class="ps-field"><label for="studioLanguage">Idioma</label><select id="studioLanguage" name="language">${option('es', site.language, 'Castellano')}${option('ca', site.language, 'Català')}${option('en', site.language, 'English')}</select></div>
              <div class="ps-field"><label for="studioQuality">Nivel</label><select id="studioQuality" name="quality">${option('good', site.quality, 'Good · ADmira')}${option('better', site.quality, 'Better · dirección original')}${option('best', site.quality, 'Best · cinematográfico')}</select></div>
              <div class="ps-field"><label for="studioStyle">Estética</label><select id="studioStyle" name="style">${option('arcade', site.experience.style, 'Arcade boot')}${option('vhs', site.experience.style, 'VHS broadcast')}${option('synthwave', site.experience.style, 'Synthwave odyssey')}</select></div>
              <div class="ps-field"><label for="studioDuration">Duración · segundos</label><input id="studioDuration" name="duration" type="number" min="8" max="45" value="${esc(site.experience.duration)}"></div>
              <div class="ps-field"><label for="studioDestinationType">Destino</label><select id="studioDestinationType" name="destinationType">${option('presentation', site.destination.type, 'Presentación')}${option('site', site.destination.type, 'Site')}${option('app', site.destination.type, 'App')}</select></div>
              <div class="ps-field"><label for="studioDestinationUrl">URL segura</label><input id="studioDestinationUrl" name="destinationUrl" value="${esc(site.destination.url)}"></div>
              <div class="ps-field full ps-check-field"><label><input type="checkbox" name="autoAdvance" value="true"${site.experience.autoAdvance ? ' checked' : ''}><span>Entrar automáticamente al terminar</span></label></div>
            </div>
            <div class="ps-section-heading"><span>02</span><div><h2>Storyboard de cinco beats</h2><p class="sub">Señal, título, texto y peso de cada momento.</p></div></div>
            <div id="presiteStoryboard" class="ps-blocks">${beats}</div>
          </form>
          <div class="ps-status" id="studioStatus" role="status"></div>
          <div class="ps-actions"><button class="ps-button" id="loadVersions" type="button">Versiones</button><a class="ps-button" href="/presites/${esc(site.slug)}/export">Exportar</a><button class="ps-button warn" id="simulatePublish" type="button">Preparar revisión</button><button class="ps-button primary" id="saveStoryboard" type="button">Guardar montaje</button></div>
          <div class="ps-version-list" id="versionList" hidden></div>
        </section>
        <section class="ps-panel ps-preview-shell ps-cinema-preview">
          <div class="ps-preview-head"><span>Preview guardado · ${esc(site.experience.duration)} s</span><div class="ps-devices" aria-label="Tamaño del preview"><button type="button" data-device="desktop" aria-pressed="true" aria-label="Preview en escritorio">▱</button><button type="button" data-device="tablet" aria-pressed="false" aria-label="Preview en tableta">▯</button><button type="button" data-device="mobile" aria-pressed="false" aria-label="Preview en móvil">▯</button></div>
          </div>
          <div class="ps-preview-stage"><iframe class="ps-preview-frame" id="presitePreview" src="/presites/${esc(site.slug)}/preview" title="Preview audiovisual de ${esc(site.displayName)}" sandbox="allow-scripts"></iframe></div>
        </section>
      </div>
    </main>
  </div><script>window.__PRESITE__=${safeJson(site)};</script><script src="/assets/presites-studio.js?v=20260723-2"></script></body></html>`;
  return new Response(html, {headers: {'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow'}});
}
