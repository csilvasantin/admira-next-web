// /admirito playlist #musica #1980 (Carlos, 18-oct-2026): encadena una detrás de otra las piezas que llevan
// TODOS esos hashtags. Pixeria y admira.studio comparten un solo Stock (stock.admira.store): una lectura del
// índice público basta para los dos. Se carga solo cuando alguien usa el comando (suite/admirito.mjs).

export const STOCK_INDEX_URL = 'https://stock.admira.store/stock/index.json';
const STOCK_ASSETS = 'https://stock.admira.store/';
// Una imagen dura lo mismo que en el previo de playlist de Pixeria (stock.html, playPreview).
export const IMAGEN_MS = 5000;
export const MAX_HASHTAGS = 8;
const CACHE_MS = 60000; // el índice se sirve con max-age=60
const TIPOS = Object.freeze({ video: 'video', animation: 'video', image: 'imagen', audio: 'audio', music: 'audio', locucion: 'audio' });

// Copia de LECTURA de pixer-worker src/stock-catalogo.mjs (TAG_CANON y tagKey): las mismas equivalencias con
// las que Pixeria guarda y compara etiquetas, para que #musica, #música y #music traigan lo mismo.
const TAG_CANON = Object.freeze({
  tecnologia: 'tecnología', musica: 'música', inspiracion: 'inspiración', innovacion: 'innovación', robotica: 'robótica',
  cancion: 'canción', ingenieria: 'ingeniería', 'digital twin': 'digital-twin', adaptacion: 'adaptación',
  cafeteria: 'cafetería', opinion: 'opinión',
  tech: 'tecnología', technology: 'tecnología', music: 'música', muscia: 'música', business: 'negocio', creativity: 'creatividad',
  ai: 'ia', gaming: 'videojuego', robotics: 'robótica',
  videojuegos: 'videojuego', historias: 'historia', bebida: 'bebidas', canciones: 'canción', robot: 'robots', comics: 'comic',
  curiosidad: 'curiosidades', oferta: 'ofertas', artistas: 'artista', pelicula: 'películas', peliculas: 'películas',
  personaje: 'personajes', herramienta: 'herramientas',
});
const clean = (t) => String(t == null ? '' : t).toLowerCase().trim().replace(/^[#·.\s]+|[#·.\s]+$/g, '');
const fold = (t) => clean(t).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[_\-\s]+/g, ' ').trim();
/** Clave para comparar: la de Pixeria, y además sin espacios («años 80» y #años80 son la misma). */
export function tagKey(t) {
  const f = fold(t);
  return (TAG_CANON[f] ? fold(TAG_CANON[f]) : f).replace(/ /g, '');
}

// DÉCADAS. En el Stock no hay ninguna pieza con «1980»: los 80 están como «años 80», «80s», «1980s», «ochentas»,
// «80smusic» o el año suelto («1986»). Un año redondo (#1980), #80s, #años80 o #ochentas valen por la década;
// cualquier otro año (#1986) busca solo ese año.
const DECADA_PALABRA = Object.freeze({ cincuenta: 1950, sesenta: 1960, setenta: 1970, ochenta: 1980, noventa: 1990 });
const siglo = (dd) => (+dd >= 50 ? 1900 : 2000) + +dd;
export function decadaDe(hashtag) {
  const k = tagKey(hashtag);
  let m;
  if ((m = /^(19[5-9]0|20[0-2]0)s?$/.exec(k))) return +m[1];
  if ((m = /^(?:anos?)?([5-9]0|[0-2]0)s$/.exec(k)) || (m = /^anos?([5-9]0|[0-2]0)$/.exec(k))) return siglo(m[1]);
  if ((m = /^(?:los)?(cincuenta|sesenta|setenta|ochenta|noventa)s?$/.exec(k))) return DECADA_PALABRA[m[1]];
  return null;
}
function enDecada(key, decada) {
  const s = String(decada), cc = s.slice(0, 2), d = s.slice(2, 3);
  if (new RegExp('^' + cc + d + '\\d$').test(key)) return true; // 1980…1989
  if (new RegExp('(?<!\\d)(?:' + cc + ')?' + d + '0s?(?!\\d)').test(key)) return true; // 80, 80s, 1980s, anos80, 80smusic
  const palabra = Object.keys(DECADA_PALABRA).find((p) => DECADA_PALABRA[p] === decada);
  return !!palabra && key.includes(palabra);
}
export function criterio(hashtag) {
  const key = tagKey(hashtag), decada = decadaDe(hashtag);
  return { hashtag, decada, coincide: decada ? (t) => enDecada(tagKey(t), decada) : (t) => tagKey(t) === key };
}

/** «#musica #1980» → qué pide el usuario. Sin hashtags es la ayuda; parar/stop cierra el reproductor. */
export function parsear(args) {
  const words = (Array.isArray(args) ? args : String(args || '').split(/\s+/)).map((w) => String(w).trim()).filter(Boolean);
  if (!words.length || (words.length === 1 && /^(help|ayuda|\?)$/i.test(words[0]))) return { accion: 'ayuda' };
  if (words.length === 1 && /^(parar|stop|cerrar|close)$/i.test(words[0])) return { accion: 'parar' };
  const hashtags = [];
  for (const w of words) {
    if (!/^#?[\p{L}\p{N}][\p{L}\p{N}_-]{0,63}$/u.test(w)) return { accion: 'ayuda', error: 'hashtag', palabra: w };
    const h = '#' + w.replace(/^#/, '');
    if (!hashtags.some((x) => tagKey(x) === tagKey(h))) hashtags.push(h);
  }
  if (hashtags.length > MAX_HASHTAGS) return { accion: 'ayuda', error: 'demasiados' };
  return { accion: 'buscar', hashtags };
}

/** Solo lo que se puede reproducir: vídeo, imagen o audio con su fichero en el Stock (no enlaces a YouTube). */
export function esJugable(item) {
  return !!item && Object.hasOwn(TIPOS, item.type) && /^(video|audio|image)\//.test(String(item.mime || ''))
    && String(item.url || '').startsWith(STOCK_ASSETS);
}

/** Las piezas que llevan todos los hashtags, en el orden del índice (el de Pixeria). Una pieza o un fichero repetido cuenta una vez. */
export function construir(items, hashtags) {
  const criterios = hashtags.map(criterio), ids = new Set(), urls = new Set(), jugables = [];
  for (const item of Array.isArray(items) ? items : []) {
    const url = esJugable(item) && String(item.url).replace(/\?.*$/, '');
    if (!url || ids.has(item.id) || urls.has(url)) continue;
    ids.add(item.id); urls.add(url); jugables.push(item);
  }
  const lleva = (item, c) => (Array.isArray(item.tags) ? item.tags : []).some(c.coincide);
  const piezas = [];
  for (const item of jugables) {
    if (!criterios.every((c) => lleva(item, c))) continue;
    piezas.push({ id: item.id, num: item.num, titulo: String(item.title || item.prompt || item.id).trim(), tipo: TIPOS[item.type],
      url: item.url, poster: typeof item.thumbnail === 'string' && item.thumbnail.startsWith(STOCK_ASSETS) ? item.thumbnail : '' });
  }
  const porSeparado = Object.fromEntries(criterios.map((c) => [c.hashtag, jugables.filter((item) => lleva(item, c)).length]));
  return { piezas, porSeparado, decadas: criterios.filter((c) => c.decada).map((c) => [c.hashtag, c.decada]) };
}

let cache = null;
export async function cargarStock(fetchImpl, ahora = Date.now()) {
  if (cache && ahora - cache.at < CACHE_MS) return cache.items;
  const res = await fetchImpl(STOCK_INDEX_URL, { credentials: 'omit' });
  if (!res || !res.ok) throw Error('HTTP ' + (res ? res.status : '?'));
  const data = await res.json();
  if (!data || !Array.isArray(data.items)) throw Error('índice sin items');
  cache = { at: ahora, items: data.items };
  return data.items;
}
export function olvidarStock() { cache = null; }

// ─── Reproductor: tarjeta flotante encima de la página (no la desplaza) ───
const CSS = '.adm-pl{position:fixed;top:72px;right:16px;width:min(420px,calc(100vw - 32px));z-index:2147483000;background:#111;color:#fff;'
  + 'border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.45);font:13px/1.4 system-ui,-apple-system,sans-serif;overflow:hidden}'
  + '.adm-pl-head,.adm-pl-foot{display:flex;align-items:center;gap:8px;padding:8px 10px}'
  + '.adm-pl-tit{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
  + '.adm-pl button{background:#2a2a2a;color:#fff;border:1px solid #444;border-radius:8px;padding:4px 10px;font:inherit;cursor:pointer}'
  + '.adm-pl button:disabled{opacity:.4;cursor:default}.adm-pl-foot span{flex:1}'
  + '.adm-pl-media{background:#000;display:flex;align-items:center;justify-content:center;min-height:160px}'
  + '.adm-pl-media video,.adm-pl-media img{display:block;width:100%;max-height:min(60vh,520px);object-fit:contain}'
  + '.adm-pl-media audio{width:92%;margin:10px auto}.adm-pl-cover{font-size:56px;padding:18px;text-align:center}'
  + '.adm-pl-cover img{max-height:200px;width:auto;margin:0 auto}';
const MUTE_KEY = 'admirito_playlist_muted';

export function reproducir(piezas, env, { titulo = '', en = false } = {}) {
  const doc = env.document, T = (es, eng) => (en ? eng : es);
  if (env.__admiritoPlaylist) env.__admiritoPlaylist.cerrar();
  if (!doc.getElementById?.('adm-pl-css')) {
    const style = doc.createElement('style'); style.id = 'adm-pl-css'; style.textContent = CSS; (doc.head || doc.body).appendChild(style);
  }
  const el = (tag, props = {}) => { const n = doc.createElement(tag); Object.assign(n, props); return n; };
  let muted = false; try { muted = env.localStorage?.getItem(MUTE_KEY) === '1'; } catch (_) {}
  let idx = 0, timer = null, abierto = true;
  const caja = el('section', { className: 'adm-pl' });
  caja.setAttribute('role', 'region'); caja.setAttribute('aria-label', 'Playlist ' + titulo);
  const head = el('div', { className: 'adm-pl-head' }), tit = el('span', { className: 'adm-pl-tit' });
  const bMute = el('button', { type: 'button' }), bCerrar = el('button', { type: 'button', textContent: '✕' });
  bCerrar.setAttribute('aria-label', T('Cerrar la playlist', 'Close the playlist'));
  const media = el('div', { className: 'adm-pl-media' }), foot = el('div', { className: 'adm-pl-foot' });
  const bPrev = el('button', { type: 'button', textContent: T('‹ anterior', '‹ previous') });
  const bNext = el('button', { type: 'button', textContent: T('siguiente ›', 'next ›') });
  head.appendChild(tit); head.appendChild(bMute); head.appendChild(bCerrar);
  foot.appendChild(bPrev); foot.appendChild(el('span')); foot.appendChild(bNext);
  caja.appendChild(head); caja.appendChild(media); caja.appendChild(foot);
  const limpiar = () => { if (timer) { env.clearTimeout(timer); timer = null; } };
  const pintaMute = () => { bMute.textContent = muted ? '🔇' : '🔊'; bMute.setAttribute('aria-label', muted ? T('Activar sonido', 'Unmute') : T('Silenciar', 'Mute')); };
  const ir = (i) => { if (!abierto || i < 0 || i >= piezas.length) return; idx = i; pinta(); };
  const siguiente = () => { if (idx + 1 < piezas.length) ir(idx + 1); else { limpiar(); tit.textContent = T('✓ Fin · ', '✓ End · ') + titulo + ' · ' + piezas.length; } };
  function pinta() {
    limpiar();
    const p = piezas[idx];
    tit.textContent = '▶ ' + (idx + 1) + '/' + piezas.length + ' · ' + p.titulo.slice(0, 80);
    tit.title = p.titulo;
    bPrev.disabled = idx === 0; bNext.disabled = idx + 1 >= piezas.length;
    while (media.firstChild) media.removeChild(media.firstChild);
    let m = null;
    if (p.tipo === 'imagen') {
      const img = el('img', { src: p.url, alt: p.titulo });
      img.addEventListener('error', () => { limpiar(); timer = env.setTimeout(siguiente, 800); });
      media.appendChild(img); timer = env.setTimeout(siguiente, IMAGEN_MS);
    } else if (p.tipo === 'audio') {
      const cover = el('div', { className: 'adm-pl-cover' });
      if (p.poster) cover.appendChild(el('img', { src: p.poster, alt: '' })); else cover.textContent = '🎵';
      m = el('audio', { src: p.url, controls: true, autoplay: true });
      media.appendChild(cover); media.appendChild(m);
    } else {
      m = el('video', { src: p.url, controls: true, autoplay: true, playsInline: true });
      if (p.poster) m.poster = p.poster;
      media.appendChild(m);
    }
    if (m) {
      m.muted = muted;
      m.addEventListener('ended', siguiente);
      m.addEventListener('error', () => { limpiar(); timer = env.setTimeout(siguiente, 800); });
      // Si el navegador no deja sonar sin un clic, sigue en silencio y el botón 🔇 lo dice.
      const intento = m.play?.();
      if (intento?.catch) intento.catch(() => { if (!abierto || m.muted) return; muted = true; m.muted = true; pintaMute(); m.play?.()?.catch?.(() => {}); });
    }
  }
  const cerrar = () => {
    if (!abierto) return; abierto = false; limpiar();
    if (caja.remove) caja.remove(); else caja.parentNode?.removeChild(caja);
    if (env.__admiritoPlaylist === control) env.__admiritoPlaylist = null;
  };
  bCerrar.addEventListener('click', cerrar);
  bPrev.addEventListener('click', () => ir(idx - 1));
  bNext.addEventListener('click', () => ir(idx + 1));
  bMute.addEventListener('click', () => {
    muted = !muted; try { env.localStorage?.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (_) {}
    const m = media.querySelector?.('video,audio'); if (m) m.muted = muted; pintaMute();
  });
  caja.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrar(); });
  const control = { caja, cerrar, siguiente, anterior: () => ir(idx - 1), indice: () => idx, abierto: () => abierto };
  pintaMute(); doc.body.appendChild(caja); pinta();
  env.__admiritoPlaylist = control;
  return control;
}

const TIPO_TXT = { video: ['vídeo', 'video'], imagen: ['imagen', 'image'], audio: ['audio', 'audio'] };
const DECADA_TXT = (d, en) => en ? 'the ' + String(d).slice(2) + 's' : 'los años ' + String(d).slice(2);
const enumera = (xs, en) => xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + (en ? ' and ' : ' y ') + xs[xs.length - 1];
function resumen(piezas, en) {
  const n = { video: 0, imagen: 0, audio: 0 }; for (const p of piezas) n[p.tipo]++;
  const nombres = en ? { video: ['video', 'videos'], imagen: ['image', 'images'], audio: ['audio', 'audios'] } : { video: ['vídeo', 'vídeos'], imagen: ['imagen', 'imágenes'], audio: ['audio', 'audios'] };
  return Object.keys(n).filter((k) => n[k]).map((k) => n[k] + ' ' + nombres[k][n[k] === 1 ? 0 : 1]).join(', ');
}
export function ayuda(en) {
  return en
    ? '/admirito playlist #hashtag [#hashtag…] — plays, one after another, the Pixeria and admira.studio pieces tagged with all those hashtags.\n'
      + 'Example: /admirito playlist #musica #1980 · #1980 means the 80s (also #80s, #años80, #ochentas); #1986, that year only.\n'
      + '/admirito playlist stop — closes the player.'
    : '/admirito playlist #hashtag [#hashtag…] — encadena, una detrás de otra, las piezas de Pixeria y admira.studio que llevan todos esos hashtags.\n'
      + 'Ejemplo: /admirito playlist #musica #1980 · #1980 vale por los 80 (también #80s, #años80, #ochentas); #1986, solo ese año.\n'
      + '/admirito playlist parar — cierra el reproductor.';
}

/** El verbo: /playlist y /admirito playlist. write(log, texto, error) es el del espacio de Admirito. */
export async function ejecutar(args, log, { environment: env, write, en = false }) {
  const T = (es, eng) => (en ? eng : es), pedido = parsear(args);
  if (pedido.accion === 'parar') {
    const abierto = !!env.__admiritoPlaylist; env.__admiritoPlaylist?.cerrar();
    write(log, abierto ? T('Playlist cerrada.', 'Playlist closed.') : T('No hay ninguna playlist sonando.', 'No playlist is playing.'));
    return { ok: true, cerrada: abierto };
  }
  if (pedido.accion === 'ayuda') {
    const error = pedido.error === 'hashtag' ? T('«' + pedido.palabra + '» no es un hashtag.', '«' + pedido.palabra + '» is not a hashtag.')
      : pedido.error === 'demasiados' ? T('Como mucho ' + MAX_HASHTAGS + ' hashtags.', 'At most ' + MAX_HASHTAGS + ' hashtags.') : '';
    write(log, (error ? error + '\n' : '') + ayuda(en), !!error);
    return error ? { ok: false, error } : { ok: true, ayuda: true };
  }
  const titulo = pedido.hashtags.join(' ');
  write(log, T('Buscando en el Stock de Pixeria y admira.studio: ', 'Searching the Pixeria and admira.studio Stock: ') + titulo + '…');
  let items;
  try { items = await cargarStock(env.fetch.bind(env)); } catch (e) {
    const error = T('No se pudo leer el Stock (stock.admira.store): ', 'Could not read the Stock (stock.admira.store): ') + (e && e.message || e);
    write(log, error, true); return { ok: false, error };
  }
  const { piezas, porSeparado, decadas } = construir(items, pedido.hashtags);
  for (const [h, d] of decadas) write(log, T(h + ' cuenta como ' + DECADA_TXT(d, false) + ' (años ' + String(d).slice(2) + ', ' + String(d).slice(2) + 's, ' + d + 's, ' + d + '-' + (d + 9) + ').',
    h + ' counts as ' + DECADA_TXT(d, true) + ' (años ' + String(d).slice(2) + ', ' + String(d).slice(2) + 's, ' + d + 's, ' + d + '-' + (d + 9) + ').'));
  if (!piezas.length) {
    const sep = Object.entries(porSeparado).map(([h, n]) => h + ' ' + n).join(' · ');
    const error = pedido.hashtags.length > 1
      ? T('Ninguna pieza de Pixeria ni admira.studio lleva a la vez ' + enumera(pedido.hashtags, false) + '. Por separado: ' + sep + '.',
        'No Pixeria or admira.studio piece carries all of ' + enumera(pedido.hashtags, true) + '. Separately: ' + sep + '.')
      : T('Ninguna pieza de Pixeria ni admira.studio lleva ' + titulo + '.', 'No Pixeria or admira.studio piece carries ' + titulo + '.');
    write(log, error, true); return { ok: false, error, porSeparado };
  }
  write(log, '🎵 Playlist ' + titulo + ' · ' + piezas.length + T(piezas.length === 1 ? ' pieza: ' : ' piezas: ', piezas.length === 1 ? ' piece: ' : ' pieces: ') + resumen(piezas, en) + '.');
  const lista = piezas.slice(0, 8).map((p, i) => String(i + 1).padStart(2, ' ') + '. ' + p.titulo.slice(0, 70) + ' · ' + TIPO_TXT[p.tipo][en ? 1 : 0]);
  if (piezas.length > 8) lista.push(T('… y ' + (piezas.length - 8) + ' más.', '… and ' + (piezas.length - 8) + ' more.'));
  write(log, lista.join('\n') + '\n' + T('/admirito playlist parar la cierra.', '/admirito playlist stop closes it.'));
  reproducir(piezas, env, { titulo, en });
  const detalle = { hashtags: pedido.hashtags, ids: piezas.map((p) => p.id) };
  if (env.CustomEvent) env.dispatchEvent?.(new env.CustomEvent('admira:playlist', { detail: detalle }));
  return { ok: true, ...detalle, piezas: piezas.length };
}
