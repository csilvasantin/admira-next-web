/*
 * LIBRO DE ESTILO («Style Book») DE CADA PRESENTACIÓN — entregable que se genera SIEMPRE.
 * (Carlos, 16-oct-2026 13:24: «todas las presentaciones deberían tener un libro de estilo como el
 * METAESTILO de la serie de 9 vídeos, para que vayamos mejorando y cualquiera lo pueda continuar».)
 *
 * Modelo (deliberadamente simple):
 *   - Lo que se GUARDA es poco: `stylebook:<slug>` = { revision, overrides, history }.
 *   - Lo que se MUESTRA se calcula SIEMPRE al leer a partir de los datos vivos de la presentación
 *     (marca, colores, láminas, medios, idiomas…) + los valores por defecto de la serie (SERIES).
 *     Así las secciones automáticas nunca se quedan viejas cuando alguien cambia una lámina o sube un vídeo.
 *   - Una persona o un agente puede REEMPLAZAR una sección entera (override, etiqueta [MAN]); con
 *     reset vuelve a la versión automática. Cada edición sube `revision` y queda en el historial.
 *   - Va dentro de las versiones de la presentación (_versions.js guarda también `stylebook`).
 *
 * Etiquetas de fiabilidad (heredadas del METAESTILO de la serie):
 *   [DAT] dato guardado de la presentación · [SER] valor por defecto de la serie de vídeos
 *   (recuperado del código o medido allí) · [CAL] calculado aquí (p. ej. contraste) · [INF] criterio
 *   editorial inferido · [MAN] sección editada a mano.
 */

export const STYLEBOOK_SCHEMA = 1;
export const STYLEBOOK_KEY = slug => `stylebook:${slug}`;
export const SERIES_ID = 'metaestilo-admira-9-videos@2026-10-16';
export const MAX_HISTORY = 100;
export const MAX_SECTION_CHARS = 20000;

/** Secciones fijas, en orden. `editable:false` = siempre generada. */
export const SECTIONS = [
  { id: 'proposito', n: 1, title: 'Propósito y audiencia' },
  { id: 'voz', n: 2, title: 'Voz y tono' },
  { id: 'estructura', n: 3, title: 'Estructura narrativa y de láminas' },
  { id: 'paleta', n: 4, title: 'Paleta' },
  { id: 'tipografia', n: 5, title: 'Tipografía' },
  { id: 'composicion', n: 6, title: 'Composición y maquetación' },
  { id: 'animacion', n: 7, title: 'Animación y ritmo' },
  { id: 'medios', n: 8, title: 'Uso de medios (vídeo, imagen, audio)' },
  { id: 'marca', n: 9, title: 'Logo y marca' },
  { id: 'reglas', n: 10, title: 'Reglas de contenido y legales' },
  { id: 'checklist', n: 11, title: 'Lista de comprobación final' },
  { id: 'medido-inferido', n: 12, title: 'Lo medido vs. lo inferido', editable: false },
  { id: 'historial', n: 13, title: 'Historial de cambios', editable: false },
  { id: 'continuar', n: 14, title: 'Cómo continuarlo' }
];
const BY_ID = new Map(SECTIONS.map(s => [s.id, s]));

/** Acepta id («paleta»), número («4», «04») o prefijo de título. Devuelve la sección o null. */
export function resolveSection(value) {
  const raw = String(value == null ? '' : value).trim().toLowerCase();
  if (!raw) return null;
  if (BY_ID.has(raw)) return BY_ID.get(raw);
  const n = /^0*(\d{1,2})$/.exec(raw);
  if (n) return SECTIONS.find(s => s.n === Number(n[1])) || null;
  const plain = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return SECTIONS.find(s => s.title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').startsWith(plain)) || null;
}

/**
 * Valores por defecto: METAESTILO de la serie «admira» de 9 vídeos de 20 s
 * (/workspace/metaestilo/METAESTILO.md, 16-oct-2026). Cada valor viene del código original o se midió
 * en los MP4 publicados; las reglas de uso son criterio editorial.
 */
export const SERIES = {
  id: SERIES_ID,
  titulo: 'Serie «admira» · 9 vídeos de 20 s (admira.studio · admira.store · admira.app)',
  formato: { duracion: '20,000 s (600 fotogramas)', resolucion: '1920×1080', fps: '30 constantes', video: 'H.264 High, yuv420p, crf 17, +faststart', audio: 'AAC-LC 48 kHz estéreo, 160 kb/s (con señal: volumedetect ≠ −91 dB)' },
  tiempos: [
    ['0,0–3,0 s', 'Entrada: logo real sobre tarjeta blanca + título «admira.<dominio> · <Tema>» + filete verde'],
    ['2,9–7,6 s', 'Beat 1 (pastilla verde)'], ['7,6–12,3 s', 'Beat 2 (pastilla azul)'], ['12,3–17,0 s', 'Beat 3 (pastilla turquesa)'],
    ['17,0–20,0 s', 'Salida: logo a escala 1,0 + frase de cierre; último fotograma pleno, sin fundido a negro']
  ],
  paleta: [
    ['Fondo base (degradado vertical)', '#0D1321 → #1A243A', 'viñeta −35 % y grano gaussiano σ=1,6'],
    ['Verde Admira (logo)', '#689840', 'medido en el PNG del logo'],
    ['Verde de marca / filete', '#6A9A3F', 'acción primaria'],
    ['Verde oscuro (beat 1, chips activos)', '#4E7C2A', ''],
    ['Azul (beat 2, enlaces)', '#2468BE', 'información'],
    ['Turquesa (beat 3)', '#168080', 'resultado / cierre de flujo'],
    ['Estado OK', '#2EA054', ''], ['Ámbar «en curso»', '#E8A014', ''], ['Rojo error', '#D03838', ''],
    ['Barra de título de ventana', '#1E2842', ''], ['Cuerpo de ventana', '#F5F8FC', ''],
    ['Texto principal (INK)', '#1C2438', ''], ['Texto secundario (GREY)', '#647086', ''], ['Borde de tarjeta (LINE)', '#D6DEEB', '']
  ],
  tipografia: [
    ['Título de entrada', '76 px (mín. 40)'], ['Frase de salida', '62 px (mín. 36)'], ['Pastilla de beat', '52 px'], ['Subtítulo de beat', '46 px (mín. 28)'], ['Título de ventana', '26 px'], ['Etiquetas de UI', '22–34 px («Datos de ejemplo» ≈16–18 px)']
  ],
  fuente: 'DejaVu Sans Bold (secundaria: DejaVu Sans; serif solo en un póster)',
  animacion: [
    'Todo entra con fundido (smoothstep) y casi todo con un desplazamiento de 8–12 px hacia arriba; nada rebota ni se pasa de escala.',
    'Entradas: pastilla 0,4 s; subtítulo 0,5 s (retrasado 0,3 s); elementos de UI 0,3–0,6 s escalonados 0,2–0,4 s.',
    'Fundidos cruzados: 0,4 s entre beats, 0,6 s entrada→beat 1; fundido desde negro inicial 0,4 s; sin fundido final a negro.',
    'Cursor: aparece en 0,3 s; clic = encogerse al 90 % + anillo verde que se expande en 0,45 s.'
  ],
  composicion: [
    'Eje central; el logo en el tercio superior-medio y el texto a ~73 % de la altura; la mitad inferior queda libre.',
    'Una sola idea por beat: 1 pastilla + 1 ventana + 1 frase. Margen ≥ 100 px; ningún texto fuera del encuadre.',
    'Ventana de app 1680×730 px (radio 22) con barra de título de 56 px y el dominio centrado; tarjetas blancas de radio 14–18.'
  ],
  tono: [
    'Tuteo («tu idea», «tu punto»), presente, frases cortas (subtítulo ≤ 70 caracteres, una oración).',
    'Sin signos de exclamación, sin emojis, sin mayúsculas sostenidas; separadores «·» y «—».',
    'Pastilla = «N · Verbo + objeto» (≤ 32 caracteres); cartela de entrada = «admira.<dominio> · <Verbo infinitivo> <objeto>»; cierre = «admira.<dominio> — <promesa en minúscula, sin punto>».',
    'Ejemplos inventados con nombres genéricos («Cartel de temporada», «Tienda Centro/Norte/Sur»); nada de IA «infalible».'
  ],
  logo: [
    'Usar el logo real sin redibujarlo ni recolorearlo (PNG RGBA 601×601, verde #689840 sobre transparente).',
    'Siempre sobre tarjeta blanca redondeada con sombra (margen 64 px, radio 44 px); nunca el logo verde directo sobre fondo azul oscuro.'
  ]
};

/* ───────────────────────── utilidades ───────────────────────── */

const HEX = /^#[0-9a-f]{6}$/i;
const hex = v => (HEX.test(String(v || '')) ? String(v).toUpperCase() : '');
const cell = v => String(v == null ? '' : v).replace(/\r?\n/g, ' ').replace(/\|/g, '/').trim();
const list = v => (Array.isArray(v) ? v : []);
const FONT_STACKS = {
  serif: 'Georgia, «Times New Roman», serif',
  mono: 'ui-monospace, «SF Mono», Menlo, monospace',
  rounded: '«Arial Rounded MT Bold», Nunito, sans-serif',
  grotesk: 'Inter, -apple-system, «Segoe UI», Roboto, Arial, sans-serif'
};

export function luminance(color) {
  const h = hex(color); if (!h) return null;
  const channel = i => { const c = parseInt(h.slice(1 + i * 2, 3 + i * 2), 16) / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}
export function contrastRatio(a, b) {
  const la = luminance(a), lb = luminance(b);
  if (la == null || lb == null) return null;
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}
const ratioText = r => (r == null ? 'n/d' : `${String(r).replace('.', ',')}:1`);
const verdict = r => (r == null ? 'sin datos' : r >= 7 ? 'AAA' : r >= 4.5 ? 'AA' : r >= 3 ? 'solo texto grande' : 'insuficiente');

function madrid(iso) {
  const d = new Date(iso || '');
  if (!Number.isFinite(d.getTime())) return '';
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Madrid' }).format(d) + ' (Madrid)';
}
const mb = bytes => (Number(bytes) > 0 ? `${(Number(bytes) / 1048576).toFixed(1).replace('.', ',')} MB` : '—');
/** Une líneas: descarta null/false/undefined (condicionales omitidos), conserva '' como línea en blanco y colapsa blancos dobles. */
const L = lines => lines.filter(l => l !== null && l !== undefined && l !== false).reduce((acc, l) => {
  const prev = acc.length ? acc[acc.length - 1] : '';
  if (l === '' && (acc.length === 0 || prev === '')) return acc;
  // una tabla necesita una línea en blanco antes (si no, muchos visores la funden con el párrafo anterior)
  if (/^\s*\|/.test(l) && prev !== '' && !/^\s*\|/.test(prev.split('\n').pop())) acc.push('');
  // dos párrafos que empiezan en negrita seguidos = dos párrafos, no uno
  if (/^\*\*/.test(l) && /^\*\*/.test(prev)) acc.push('');
  acc.push(l); return acc;
}, []).join('\n').trim();
const rows = (head, body) => [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...body.map(r => `| ${r.map(cell).join(' | ')} |`)].join('\n');

/** Texto en el idioma de la presentación (es). */
function slidesOf(ideas) {
  const sk = list(ideas && ideas.skeleton).filter(i => i && i.enabled !== false);
  return sk;
}
function totalMinutes(sk) { return sk.reduce((s, i) => s + (Number(i.minutes) > 0 ? Number(i.minutes) : 0), 0); }

export function stylebookUrls(slug, site = '') {
  const base = `${site}/presentaciones/${slug}`;
  return { page: `${base}/estilo`, markdown: `${base}/api/stylebook?format=md`, api: `${base}/api/stylebook` };
}

/* ───────────────────── secciones automáticas ───────────────────── */

/**
 * ctx = { slug, presentation, ideas, library, generation, versions, site }
 * (todos opcionales salvo slug: una presentación antigua puede no tener alguno).
 */
function autoBodies(ctx) {
  const slug = ctx.slug;
  const p = ctx.presentation || {};
  const ideas = ctx.ideas || {};
  const theme = p.theme || {};
  const insp = p.inspiration || ideas.inspiration || null;
  const sk = slidesOf(ideas);
  const slideMedia = list(p.slideMedia);
  const assets = list(ctx.library && ctx.library.assets);
  const languages = list(p.languages).length ? list(p.languages) : list(ideas.languages);
  const outputs = list(p.outputs);
  const name = p.displayName || ideas.displayName || slug;
  const prospect = p.prospect && p.prospect.activo !== false && (p.prospect.marca || p.prospect.cliente) ? p.prospect : null;
  const urls = stylebookUrls(slug, ctx.site || '');
  const primary = hex(theme.primary), accent = hex(theme.accent), bg = hex(theme.background), surface = hex(theme.surface), ink = hex(theme.text);
  const cText = contrastRatio(ink, bg), cPrim = contrastRatio(primary, bg), cAcc = contrastRatio(accent, bg), cSurf = contrastRatio(ink, surface);
  const mode = theme.mode === 'dark' ? 'oscuro' : 'claro';
  const out = {};

  out.proposito = L([
    `**Presentación:** ${name} (\`${slug}\`) [DAT]`,
    '',
    p.website ? `**Web de referencia:** ${p.website} [DAT]` : null,
    p.website ? '' : null,
    prospect ? `**Modo prospect:** marca «${prospect.nombre || prospect.cliente?.nombre || prospect.marca}» (catálogo /marcablanca, propuesta **no oficial**) [DAT]` : null,
    '',
    `- **Problema que resolvemos:** ${p.problem || ideas.hero?.summary || '— (sin rellenar: completar en Ideas)'} [DAT]`,
    `- **Audiencia:** ${p.audience || '— (sin rellenar)'} [DAT]`,
    `- **Objetivo de la reunión:** ${ideas.objective || '— (sin rellenar)'} [DAT]`,
    ideas.hero?.title ? `- **Título principal:** ${ideas.hero.title} [DAT]` : null,
    ideas.hero?.summary ? `- **Resumen:** ${ideas.hero.summary} [DAT]` : null,
    `- **Idiomas:** ${languages.map(l => l.toUpperCase()).join(' · ') || 'ES'} (castellano e inglés como mínimo) [DAT]`,
    `- **Entregables pedidos:** ${outputs.length ? outputs.join(' · ') : 'website · documents'} + libro de estilo (siempre) [DAT]`,
    '',
    '_Qué debe lograr:_ que quien reciba o continúe esta presentación entienda **para quién es, qué decide y qué se espera después**, sin tener que preguntar.'
  ]);

  out.voz = L([
    `**Idioma base:** castellano; versiones: ${languages.map(l => l.toUpperCase()).join(' · ') || 'ES'}. ${list(ideas.translationPending).length ? `⚠ Traducción pendiente de revisar en: ${ideas.translationPending.join(', ').toUpperCase()} [DAT].` : 'Sin traducciones pendientes marcadas [DAT].'}`,
    '',
    'Reglas heredadas de la serie [SER]:',
    ...SERIES.tono.map(t => `- ${t}`),
    '',
    list(ideas.terminology).length
      ? `**Terminología aprobada** [DAT]:\n${rows(['ES', 'CA', 'EN'], ideas.terminology.map(t => [t.es, t.ca, t.en]))}`
      : '**Terminología aprobada:** ninguna definida (si el cliente exige términos fijos, guardarlos en la revisión terminológica) [DAT].',
    '',
    '_Criterio [INF]:_ la voz de una presentación comercial puede ser algo más formal que la de los vídeos, pero conserva tuteo/usted coherente en todo el deck y no mezcla registros.'
  ]);

  const act = sk.some(i => i.act);
  const min = totalMinutes(sk);
  out.estructura = L([
    `**Estructura:** ${ideas.structure === 'admiranext' ? 'AdmiraNeXT · 3 actos × (portada + capítulos a, b, c) — admira.studio · admira.store · admira.app' : (ideas.narrativeSource === 'template' ? 'molde genérico de 8 pasos (problema → piloto)' : `guion ${ideas.narrativeSource || 'propio'}`)} [DAT]`,
    `**Láminas:** portada + objetivo + ${sk.length} del esqueleto + cierre = ${sk.length + 3}${min ? ` · ${min} min declarados` : ''} [DAT]`,
    '',
    rows(['#', 'id', act ? 'Acto' : 'Tipo', 'Título', 'Mensaje', 'Min'], [
      ['—', 'cover', '', ideas.hero?.title || name, ideas.hero?.summary || '', ''],
      ['—', 'objective', '', ideas.labels?.objective || 'El objetivo', ideas.objective || '', ''],
      ...sk.map((i, k) => [k + 1, i.id, act ? [i.act, i.role === 'cover' ? 'portada' : i.chapter ? `cap. ${i.chapter}` : ''].filter(Boolean).join(' · ') : '', i.title, i.message, i.minutes != null ? i.minutes : '']),
      ['—', 'closing', '', ideas.closing?.title || '', ideas.closing?.action || '', '']
    ]),
    '',
    'Reglas [INF]:',
    '- Una idea por lámina: título corto + un mensaje de una frase + detalle opcional.',
    '- Empezar por negocio, no por tecnología; cerrar con una decisión concreta (piloto, responsables, métricas).',
    '- Si se añade o quita una lámina, hacerlo con `update_slide` / `delete_slide` (o Ideas) y anotarlo en el historial.',
    ideas.structure === 'admiranext' ? '- Patrón 3 actos: cada acto abre con su portada y desarrolla a, b, c con ~5 min cada capítulo.' : null
  ]);

  const palRows = [
    ['Primario', primary || '—', 'theme.primary', cPrim != null ? `${ratioText(cPrim)} sobre fondo (${verdict(cPrim)})` : ''],
    ['Acento', accent || '—', 'theme.accent', cAcc != null ? `${ratioText(cAcc)} sobre fondo (${verdict(cAcc)})` : ''],
    ['Fondo', bg || '—', 'theme.background', ''],
    ['Superficie', surface || '—', 'theme.surface', ''],
    ['Texto', ink || '—', 'theme.text', `${ratioText(cText)} sobre fondo (${verdict(cText)}); ${ratioText(cSurf)} sobre superficie`]
  ];
  out.paleta = L([
    `**Modo:** ${mode} [DAT] · **Perfil visual:** ${theme.profile || '—'} [DAT]`,
    '',
    '**Paleta de la presentación** [DAT] + contraste calculado [CAL]:',
    rows(['Rol', 'Hex', 'Campo', 'Contraste'], palRows),
    insp && list(insp.palette).length ? `\n**Paleta detectada en la web de inspiración** (${insp.host || insp.url || ''}) [DAT]: ${insp.palette.map(hex).filter(Boolean).map(c => `\`${c}\``).join(' · ')}` : '',
    cText != null && cText < 4.5 ? '\n⚠ **El texto no llega a AA (4,5:1) sobre el fondo**: revisar `theme.text` / `theme.background` antes de presentar.' : null,
    (cPrim != null && cPrim < 3) || (cAcc != null && cAcc < 3) ? '⚠ El color primario o el acento tienen contraste < 3:1 con el fondo: no usarlos como único portador de información.' : null,
    '',
    '**Paleta de la serie de vídeos** (referencia para piezas animadas de esta presentación) [SER]:',
    rows(['Uso', 'Hex', 'Nota'], SERIES.paleta),
    '',
    'Regla de uso [INF]: verde = marca y acción primaria; azul = información/enlace; turquesa = resultado/cierre; ámbar = en curso; rojo = fallo. Con marca de cliente (prospect) manda la paleta del cliente, no la de Admira.'
  ]);

  out.tipografia = L([
    `**Familia de la sala/site:** ${FONT_STACKS[theme.fontStyle] || FONT_STACKS.grotesk} (estilo «${theme.fontStyle || 'grotesk'}») [DAT]`,
    insp && insp.sourceFont && insp.sourceFont !== 'inherit' ? `**Fuente detectada en la web de inspiración:** ${insp.sourceFont} [DAT]` : null,
    '',
    '**Piezas de vídeo de la serie** [SER]: ' + SERIES.fuente + '. Tamaños:',
    rows(['Rol', 'Tamaño'], SERIES.tipografia),
    '',
    '_Criterio [INF]:_ máximo dos pesos por lámina; ningún texto por debajo de 24 px equivalentes en proyección; si un texto no cabe, se acorta (no se reduce por debajo del mínimo).'
  ]);

  out.composicion = L([
    `**Maquetación del site** [DAT]: layout ${theme.layout || 'editorial'} · densidad ${theme.density || 'balanced'} · radio ${theme.radius != null ? theme.radius : 10} px (${theme.radiusStyle || 'soft'}) · ${theme.heroDevice === 'pocket' ? 'portada con dispositivo retro «pocket»' : 'portada sin dispositivo'}.`,
    `**Sala de presentación:** ${sk.length + 3} láminas; pie configurable (\`footer\`) y numeración; navegación por teclado, modo presentador y mando remoto [DAT].`,
    '',
    'Composición de los vídeos de la serie [SER]:',
    ...SERIES.composicion.map(t => `- ${t}`),
    '',
    'Reglas [INF]: un solo punto focal por lámina; el medio (vídeo/imagen) ocupa el protagonismo y el texto se apoya debajo/encima en banda oscura legible; márgenes constantes entre láminas.'
  ]);

  const anim = [...new Set(slideMedia.map(m => m.animation).filter(Boolean))];
  out.animacion = L([
    `**Entrada de medios en la sala** [DAT]: ${anim.length ? anim.join(' · ') : 'sin animaciones declaradas'}${slideMedia.some(m => m.durationMs) ? ` (duración ${[...new Set(slideMedia.map(m => m.durationMs).filter(Boolean))].join('/')} ms)` : ''}. Vídeos con autoplay: ${slideMedia.filter(m => m.type === 'video' && m.autoplay).length}/${slideMedia.filter(m => m.type === 'video').length}.`,
    '',
    'Ritmo de los vídeos de la serie [SER]:',
    rows(['Tramo', 'Qué ocurre'], SERIES.tiempos),
    '',
    ...SERIES.animacion.map(t => `- ${t}`),
    '',
    '_Ritmo de la sala [INF]:_ ~5 min por capítulo y un vídeo de ≤ 20–30 s como apertura del capítulo; nunca dos animaciones simultáneas compitiendo por la atención.'
  ]);

  const vids = slideMedia.filter(m => m.type === 'video');
  const slideTitle = id => (sk.find(i => i.id === id) || {}).title || id;
  const mediaRows = slideMedia.map(m => {
    const a = assets.find(x => x.url === m.src) || {};
    return [m.slide, slideTitle(m.slide), m.type, a.name || (m.src || '').split('/').pop(), a.size ? mb(a.size) : '—', m.caption || '', m.rights ? `${m.rights.status}${m.rights.usable === false ? ' ✗' : ''}` : '—'];
  });
  const orphan = assets.filter(a => !list(a.assignedSlides).length);
  out.medios = L([
    `**Inventario** [DAT]: ${slideMedia.length} medios asignados a láminas (${vids.length} vídeo, ${slideMedia.filter(m => m.type === 'image').length} imagen, ${slideMedia.filter(m => m.type === 'audio').length} audio, ${slideMedia.filter(m => m.type === 'animation').length} animación) · ${assets.length} recursos en la biblioteca privada${orphan.length ? ` · ⚠ ${orphan.length} sin asignar` : ''}.`,
    mediaRows.length ? '\n' + rows(['Lámina', 'Título', 'Tipo', 'Fichero', 'Tamaño', 'Pie', 'Derechos'], mediaRows) : '\n_Aún no hay medios asignados a láminas._',
    '',
    '**Reglas de la biblioteca** [DAT]: PNG, JPEG, WebP, GIF, MP3, WAV, M4A, MP4, WebM; ≤ 40 MB por fichero (imagen ≤ 10 MB, audio ≤ 25 MB); solo recursos aceptados por Carlos (`acceptedByCarlos:true` + nota de quién y cuándo); un medio principal por lámina; cada medio con pie (`caption`) y texto alternativo (`fallback`).',
    '',
    '**Formato técnico de los vídeos** [SER] (la sala no guarda la resolución ni la duración reales: **medir con ffprobe antes de dar por bueno un clip** y anotarlo en la sección 12):',
    ...Object.entries({ Duración: SERIES.formato.duracion, Resolución: SERIES.formato.resolucion, 'Fotogramas': SERIES.formato.fps, Vídeo: SERIES.formato.video, Audio: SERIES.formato.audio }).map(([k, v]) => `- ${k}: ${v}`),
    '',
    'Reglas [INF]: vídeos de producto ≤ 30 s, sin voz en off obligatoria (los subtítulos cuentan la historia), sin autoplay con sonido; un vídeo por lámina de capítulo; el pie dice qué se ve y cuánto dura («Crear contenidos · 20 s»).'
  ]);

  out.marca = L([
    p.brand?.logoUrl ? `**Logo guardado** [DAT]: \`${p.brand.logoUrl}\` · origen ${p.brand.sourceUrl || '—'} · capturado ${madrid(p.brand.capturedAt) || '—'} · texto alternativo «${p.brand.alt || ''}».` : '**Logo:** ⚠ no hay logo guardado para esta presentación [DAT].',
    prospect ? `**Marca blanca / prospect:** la presentación va vestida con la marca «${prospect.nombre || prospect.marca}» como **propuesta no oficial**; nunca presentarla como marca oficial del cliente [DAT].` : '**Marca:** identidad de Admira/AdmiraNeXT (sin marca de tercero) [DAT].',
    '',
    'Reglas [SER+INF]:',
    ...SERIES.logo.map(t => `- ${t}`),
    '- **Sin logos ni marcas de terceros ni de clientes** en piezas genéricas (marca blanca). Los nombres de plataformas solo como chip de texto y solo si Carlos lo pide.',
    '- No nombrar motores/proveedores de IA, tiendas de apps ni sistemas operativos en piezas de cara al cliente.',
    '- Logo de cliente solo con permiso y desde su web oficial (el generador lo captura de la web indicada).'
  ]);

  const reglas = [
    '1. **Nunca mezclar clientes.** Una presentación = un cliente = un slug. En particular **JTI y Altadis no aparecen nunca juntos** (ni en texto, ni en imágenes, ni en ejemplos) y ningún cliente real aparece en una pieza de otro.',
    '2. **Datos de ejemplo marcados.** Toda cifra, estado, nombre o lista inventada lleva el rótulo «Datos de ejemplo». Sin números reales de circuito, SLA o audiencia si no están medidos.',
    '3. **Lo deducido, como hipótesis.** Lo que sale de análisis automático (web pública + IA) se marca como hipótesis y se cita su fuente; no se afirma capacidad que el producto no tenga ni precisión de la IA.',
    '4. **Medios con derechos.** Solo medios aceptados por Carlos o con licencia declarada; sin personas reales identificables (audiencia = datos agregados y anónimos).',
    '5. **Textos completos dentro del encuadre.** Nada cortado ni desbordado; revisar lámina a lámina en ES y EN.',
    '6. **Nada sale sin autorización.** No publicar, compartir ni enviar la presentación o sus enlaces sin permiso de Carlos; la contraseña va aparte del enlace.',
    prospect ? '7. **Propuesta no oficial:** el contenido sobre la marca del destinatario es una hipótesis comercial; validar identidad y datos antes de reunión.' : null,
    list(p.sourceTraceability?.sources || p.sourceTraceability).length ? '8. **Trazabilidad:** las fuentes declaradas por lámina deben conservarse (ver editor de fuentes).' : ''
  ].filter(Boolean);
  out.reglas = reglas.join('\n');

  const pwd = Boolean(p.passwordVerifier || ctx.passwordSet);
  const checks = [
    [Boolean(p.problem && p.audience && ideas.objective), 'Problema, audiencia y objetivo rellenados'],
    [languages.includes('es') && languages.includes('en'), 'Castellano e inglés presentes'],
    [!list(ideas.translationPending).length, 'Traducciones revisadas (sin «pendiente»)'],
    [sk.every(i => i.title && i.message), 'Todas las láminas con título y mensaje'],
    [Boolean(p.brand?.logoUrl), 'Logo guardado'],
    [cText == null || cText >= 4.5, 'Contraste texto/fondo ≥ 4,5:1 (AA)'],
    [slideMedia.every(m => !m.rights || m.rights.usable !== false), 'Todos los medios con derechos utilizables'],
    [!orphan.length, 'Sin recursos huérfanos en la biblioteca'],
    [pwd || ctx.passwordSet === undefined, 'Contraseña de sala configurada']
  ];
  out.checklist = L([
    '**Comprobaciones automáticas** (se recalculan al leer) [CAL]:',
    ...checks.map(([ok, label]) => `- [${ok ? 'x' : ' '}] ${label}`),
    '',
    '**Comprobaciones manuales** antes de entregar [INF]:',
    '- [ ] He abierto la sala en ES y EN y he pasado todas las láminas (nada cortado ni desbordado).',
    '- [ ] He reproducido cada vídeo hasta el final (con sonido si lo lleva) y medido formato/duración con ffprobe.',
    '- [ ] No hay logos/marcas de terceros, ni JTI y Altadis juntos, ni datos reales sin fuente.',
    '- [ ] «Datos de ejemplo» visible donde hay datos inventados.',
    '- [ ] Enlace + contraseña entregados por canal autorizado y registrada la entrega.',
    '- [ ] Este libro de estilo está al día (sección 13 anotada) y enlazado desde el encargo.'
  ]);

  const meas = [
    `Datos guardados de la presentación (colores, láminas, idiomas, medios, logo): **${[primary, accent, bg, surface, ink].filter(Boolean).length}/5 colores**, **${sk.length + 3} láminas**, **${slideMedia.length} medios**, **${assets.length} recursos** [DAT].`,
    cText != null ? `Contraste texto/fondo ${ratioText(cText)} (${verdict(cText)}) y texto/superficie ${ratioText(cSurf)}; primario/fondo ${ratioText(cPrim)}; acento/fondo ${ratioText(cAcc)} [CAL].` : 'Contraste: no calculable (faltan colores válidos).',
    assets.length ? `Tamaño de los ficheros de la biblioteca: ${assets.map(a => `${a.name} ${mb(a.size)}`).join(' · ')} [DAT].` : '',
    insp ? `Identidad analizada de ${insp.host || insp.url} el ${madrid(insp.analyzedAt) || '—'} [DAT].` : null,
    ctx.measurements && ctx.measurements.length
      ? 'Formato técnico de los vídeos, composición y animación de la serie: recuperados del código/medidos en los 9 MP4 originales [SER]; los clips de esta presentación tienen las mediciones registradas más abajo.'
      : 'Formato técnico de los vídeos, composición y animación de la serie: recuperados del código/medidos en los 9 MP4 originales [SER]; **no** re-medidos en los clips de esta presentación (registrar la medición con `update_stylebook {measured:[…]}`).'
  ].filter(Boolean);
  const measured = list(ctx.measurements);
  out['medido-inferido'] = L([
    '**Medido / dato guardado:**',
    ...meas.map(t => `- ${t}`),
    measured.length ? '' : null,
    measured.length ? '**Mediciones registradas** (ffprobe, capturas, auditorías; las anota quien mide con `update_stylebook {measured:[{item,value,method}]}`) [MED]:' : null,
    measured.length ? rows(['Qué', 'Valor', 'Cómo', 'Quién · cuándo'], measured.map(m => [m.item, m.value, m.method || '', `${m.by || ''} · ${madrid(m.at)}`])) : null,
    '',
    '**Inferido / criterio editorial:**',
    '- Reglas de uso del color, límites de longitud de textos, patrón de tono y ritmo de sala (etiquetas [INF]).',
    '- Cualquier valor «de la serie» aplicado a una pieza que no se ha vuelto a medir.',
    '',
    'Norma: al medir algo nuevo (ffprobe, capturas, auditoría visual) **moverlo de inferido a medido** y anotarlo en el historial.'
  ]);

  return out;
}

/* ───────────────────── documento y render ───────────────────── */

export function newStylebookDoc(slug, { actor = {}, reason = 'creado con la presentación', now = new Date().toISOString() } = {}) {
  return { schemaVersion: STYLEBOOK_SCHEMA, client: slug, series: SERIES_ID, revision: 1, createdAt: now, updatedAt: now, overrides: {}, history: [{ revision: 1, at: now, kind: 'create', by: actorName(actor), via: actor.via || '', reason: String(reason).slice(0, 240), sections: [] }] };
}
export function actorName(actor = {}) {
  return String(actor.tokenLabel || actor.email || actor.name || 'sistema').slice(0, 120);
}
function normalizeDoc(slug, doc) {
  if (!doc || typeof doc !== 'object') return newStylebookDoc(slug, { reason: 'calculado al leer (sin registro guardado)' });
  return { ...doc, overrides: doc.overrides && typeof doc.overrides === 'object' ? doc.overrides : {}, history: list(doc.history) };
}

function historyBody(doc, ctx) {
  const p = ctx.presentation || {};
  const events = [
    ...list(doc.history).map(h => ({ at: h.at, who: h.by, text: `r${h.revision} · ${({ create: 'creado', edit: 'editado', reset: 'sección restablecida', regenerate: 'presentación regenerada' })[h.kind] || h.kind}${h.sections && h.sections.length ? ` (${h.sections.join(', ')})` : ''}: ${h.reason}${h.via ? ` [${h.via}]` : ''}` })),
    ...list(ctx.versions).slice(0, 8).map(v => ({ at: v.createdAt, who: '', text: `versión de la presentación «${v.reason}» (${v.id})` }))
  ].filter(e => e.at).sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 40);
  return L([
    `**Revisión actual del libro:** r${doc.revision} · creado ${madrid(doc.createdAt)} · última edición ${madrid(doc.updatedAt)}.`,
    p.updatedAt ? `**Última actualización de la presentación:** ${madrid(p.updatedAt)}.` : null,
    '',
    rows(['Cuándo', 'Quién', 'Qué'], events.map(e => [madrid(e.at), e.who, e.text])),
    '',
    '_Las secciones automáticas se recalculan al leer; sus cambios se ven en las versiones de la presentación (`list_versions`). Cada edición manual del libro queda aquí con su motivo._'
  ]);
}

function continuarBody(doc, ctx) {
  const slug = ctx.slug;
  const u = stylebookUrls(slug, ctx.site || 'https://www.admiranext.com');
  const base = `https://www.admiranext.com/presentaciones/${slug}`;
  return L([
    '**Para retomar esta presentación (persona o agente):**',
    '',
    `1. Lee este libro entero: \`get_stylebook {client:"${slug}"}\` (MCP) o ${u.page} (con sesión de Admira). Markdown: ${u.markdown}.`,
    `2. Mira el estado vivo: \`get_presentation {client:"${slug}"}\`, \`list_media {client:"${slug}"}\`, \`generation_status {client:"${slug}"}\` y \`list_versions {client:"${slug}"}\`.`,
    `3. Edita contenido con \`update_slide\` / Ideas (${base}/ideas); medios con \`upload_media\` / \`assign_media\`. Para mejorar la presentación entera usa \`create_presentation\` con \`overwrite:true\` (nunca otro slug).`,
    `4. Si cambias una **norma de estilo** (voz, paleta, composición…), guárdala aquí: \`update_stylebook {client:"${slug}", section:"paleta", body:"…", reason:"qué y por qué", baseRevision:${doc.revision}}\`. \`reset:true\` devuelve la sección a la versión automática.`,
    '5. Antes de entregar, recorre la sección 11 y anota en el historial qué se midió (ffprobe, capturas) para mover cosas de «inferido» a «medido».',
    '6. Para **pasar este libro como referencia** a otro agente o a una presentación nueva, dale la URL del markdown (o `get_stylebook`) y pídele que cree la suya con el mismo estilo; `get_stylebook {template:true}` devuelve la plantilla base de la serie.',
    '',
    '**Permisos:** el libro es interno (editor/admin y tokens MCP de editor); la contraseña del cliente no lo abre.',
    '',
    `**Plantilla de origen:** ${SERIES.titulo} — METAESTILO del 16-oct-2026 (id \`${SERIES_ID}\`).`
  ]);
}

/** Cuerpos finales por sección: override manual si existe, si no el automático. */
export function buildSections(slug, doc, ctx) {
  const c = { ...ctx, slug, measurements: doc.measurements };
  const auto = autoBodies(c);
  auto.historial = historyBody(doc, c);
  auto.continuar = continuarBody(doc, c);
  return SECTIONS.map(s => {
    const ov = doc.overrides[s.id];
    const manual = Boolean(ov && typeof ov.body === 'string' && ov.body.trim() && s.editable !== false);
    return { ...s, editable: s.editable !== false, manual, body: manual ? ov.body : auto[s.id], auto: auto[s.id], override: manual ? { by: ov.by || '', at: ov.at || '', reason: ov.reason || '' } : null };
  });
}

export function renderStylebookMarkdown(slug, doc, ctx) {
  const d = normalizeDoc(slug, doc);
  const c = { ...ctx, slug };
  const sections = buildSections(slug, d, c);
  const p = c.presentation || {};
  const u = stylebookUrls(slug, c.site || 'https://www.admiranext.com');
  const head = [
    `# Libro de estilo · ${p.displayName || (c.ideas && c.ideas.displayName) || slug}`,
    '',
    `Libro de estilo versionado de la presentación \`${slug}\`. Se genera con **cada** presentación (entregable fijo, además de website y documents) y parte del METAESTILO de la serie de 9 vídeos (\`${SERIES_ID}\`). Pensado para que **cualquier persona o agente pueda continuar el trabajo** con el mismo criterio.`,
    '',
    `| Campo | Valor |`, `| --- | --- |`,
    `| Presentación | \`${slug}\` |`,
    `| Revisión del libro | r${d.revision} · ${madrid(d.updatedAt)} |`,
    `| Libro (web interna) | ${u.page} |`,
    `| Libro (markdown) | ${u.markdown} |`,
    `| Sala | https://www.admiranext.com/presentaciones/${slug}/presentacion |`,
    `| Leer / editar por MCP | \`get_stylebook\` · \`update_stylebook\` |`,
    '',
    '**Leyenda de fiabilidad:** **[DAT]** dato guardado de la presentación · **[SER]** valor por defecto de la serie de vídeos (código original o medido) · **[CAL]** calculado al leer · **[INF]** inferido / criterio editorial · **[MAN]** sección editada a mano (sustituye a la automática).',
    '',
    '---'
  ];
  const body = sections.map(s => `\n## ${s.n}. ${s.title}${s.manual ? ' [MAN]' : ''}\n\n${s.manual && s.override ? `> Edición manual de ${s.override.by || 'alguien'}${s.override.at ? ` · ${madrid(s.override.at)}` : ''}${s.override.reason ? ` · ${s.override.reason}` : ''}. \`reset:true\` recupera la versión automática.\n\n` : ''}${s.body.trim()}\n`);
  return head.join('\n') + '\n' + body.join('') + '\n';
}

export function stylebookView(slug, doc, ctx) {
  const d = normalizeDoc(slug, doc);
  const sections = buildSections(slug, d, ctx);
  return {
    ok: true, client: slug, schemaVersion: STYLEBOOK_SCHEMA, series: SERIES_ID, revision: d.revision, createdAt: d.createdAt, updatedAt: d.updatedAt,
    stored: Boolean(doc), urls: stylebookUrls(slug, (ctx && ctx.site) || 'https://www.admiranext.com'),
    sections: sections.map(s => ({ id: s.id, n: s.n, title: s.title, editable: s.editable, manual: s.manual, override: s.override, body: s.body })),
    history: d.history.slice(-20).reverse()
  };
}

/* ───────────────────── edición ───────────────────── */

/** Parte un markdown completo por sus «## N. Título» → { id: cuerpo }. Ignora el encabezado y lo que no case. */
export function parseStylebookMarkdown(markdown) {
  const text = String(markdown == null ? '' : markdown).replace(/\r\n?/g, '\n');
  const parts = {};
  const re = /^##\s+(\d{1,2})\.\s+.*$/gm;
  const marks = [];
  let m;
  while ((m = re.exec(text))) marks.push({ n: Number(m[1]), start: m.index, end: m.index + m[0].length });
  marks.forEach((mk, i) => {
    const sec = SECTIONS.find(s => s.n === mk.n);
    if (!sec) return;
    let body = text.slice(mk.end, i + 1 < marks.length ? marks[i + 1].start : text.length).trim();
    body = body.replace(/^>\s*Edición manual[^\n]*\n*/i, '').replace(/\n+---\s*$/, '').trim();
    parts[sec.id] = body;
  });
  return parts;
}

const norm = s => String(s || '').replace(/\s+/g, ' ').trim();

/**
 * Aplica una edición al doc. input = { section?, body?, reset?, markdown?, reason, baseRevision? }.
 * Devuelve { doc, changed:[ids], kind }. Lanza Error con .status para 400/409.
 */
export function applyStylebookEdit(slug, doc, input, ctx, actor = {}, now = new Date().toISOString()) {
  const fail = (message, status = 400) => Object.assign(new Error(message), { status });
  const d = JSON.parse(JSON.stringify(normalizeDoc(slug, doc)));
  const reason = String(input.reason || '').trim().slice(0, 240);
  if (!reason) throw fail('Indica reason: qué cambias y por qué (queda en el historial).');
  if (input.baseRevision != null && Number(input.baseRevision) !== Number(d.revision)) throw fail(`El libro cambió mientras lo editabas (revisión actual r${d.revision}, tú partías de r${input.baseRevision}). Léelo de nuevo y reaplica el cambio.`, 409);
  const autoNow = autoBodies({ ...ctx, slug, measurements: d.measurements });
  const changed = [];
  let kind = 'edit';
  const wantsText = input.markdown != null || String(input.section || '').trim() !== '';
  if (input.measured !== undefined) {
    if (!Array.isArray(input.measured) || !input.measured.length || input.measured.length > 30) throw fail('measured debe ser una lista de 1 a 30 mediciones {item, value, method?}.');
    const kept = list(d.measurements);
    for (const m of input.measured) {
      const item = String((m && m.item) || '').trim().slice(0, 160), value = String((m && m.value) || '').trim().slice(0, 400);
      if (!item || !value) throw fail('Cada medición necesita item y value.');
      const at = kept.findIndex(x => x.item.toLowerCase() === item.toLowerCase());
      const entry = { item, value, method: String((m && m.method) || '').trim().slice(0, 200), by: actorName(actor), at: now };
      if (at >= 0) kept[at] = entry; else kept.push(entry);
    }
    d.measurements = kept.slice(-100);
    changed.push('medido-inferido');
  }
  if (!wantsText && input.measured === undefined) throw fail('Indica section (+ body o reset:true), markdown completo o measured.');
  const set = (sec, body) => {
    if (sec.editable === false) throw fail(`La sección «${sec.title}» se genera siempre y no se edita.`);
    const clean = String(body == null ? '' : body).replace(/\r\n?/g, '\n').trim();
    if (clean.length > MAX_SECTION_CHARS) throw fail(`La sección supera ${MAX_SECTION_CHARS} caracteres.`);
    if (!clean || norm(clean) === norm(autoNow[sec.id])) { if (d.overrides[sec.id]) { delete d.overrides[sec.id]; changed.push(sec.id); } return; }
    if (norm((d.overrides[sec.id] || {}).body) === norm(clean)) return;
    d.overrides[sec.id] = { body: clean, by: actorName(actor), via: actor.via || '', at: now, reason };
    changed.push(sec.id);
  };
  if (input.markdown != null) {
    const parts = parseStylebookMarkdown(input.markdown);
    if (!Object.keys(parts).length) throw fail('No encuentro secciones «## N. Título» en el markdown. Parte del que devuelve get_stylebook.');
    const current = Object.fromEntries(buildSections(slug, d, ctx).map(s => [s.id, s.body]));
    for (const [id, body] of Object.entries(parts)) {
      const sec = BY_ID.get(id);
      if (sec.editable === false || norm(body) === norm(current[id])) continue;
      set(sec, body);
    }
  } else if (wantsText) {
    const sec = resolveSection(input.section);
    if (!sec) throw fail(`Sección no válida. Usa una de: ${SECTIONS.map(s => `${s.id} (${s.n})`).join(', ')}.`);
    if (input.reset === true) {
      if (sec.editable === false) throw fail(`La sección «${sec.title}» no se edita.`);
      if (d.overrides[sec.id]) { delete d.overrides[sec.id]; changed.push(sec.id); }
      kind = 'reset';
    } else {
      if (typeof input.body !== 'string') throw fail('Indica body (markdown de la sección) o reset:true.');
      set(sec, input.body);
    }
  }
  if (!changed.length) return { doc: d, changed, kind, unchanged: true };
  d.revision = Number(d.revision || 0) + 1;
  d.updatedAt = now;
  d.history = [...list(d.history), { revision: d.revision, at: now, kind, by: actorName(actor), via: actor.via || '', reason, sections: changed }].slice(-MAX_HISTORY);
  return { doc: d, changed, kind };
}

/* ───────────────────── persistencia ───────────────────── */

export async function loadStylebookContext(env, slug) {
  const kv = env.PRESENTATION_IDEAS;
  const [presentation, ideas, library, generation, versionsIndex, doc] = await Promise.all([
    kv.get(`presentation:${slug}`, { type: 'json' }), kv.get(`ideas:${slug}`, { type: 'json' }), kv.get(`media-library:${slug}`, { type: 'json' }),
    kv.get(`generation:${slug}`, { type: 'json' }), kv.get(`versions:${slug}`, { type: 'json' }), kv.get(STYLEBOOK_KEY(slug), { type: 'json' })
  ]);
  return { doc, ctx: { slug, presentation, ideas, library, generation, versions: list(versionsIndex && versionsIndex.versions), site: 'https://www.admiranext.com' } };
}

/**
 * Alta / regeneración: crea el registro si no existe; si existe lo conserva (ediciones manuales
 * incluidas) y anota la regeneración. NUNCA lanza: el libro de estilo no puede tumbar un alta.
 */
export async function ensureStylebook(env, slug, { actor = {}, reason, existed = false, now = new Date().toISOString() } = {}) {
  try {
    if (!env || !env.PRESENTATION_IDEAS) return null;
    const prev = await env.PRESENTATION_IDEAS.get(STYLEBOOK_KEY(slug), { type: 'json' });
    let doc;
    if (!prev) doc = newStylebookDoc(slug, { actor, reason: reason || (existed ? 'libro creado al regenerar una presentación existente' : 'creado con la presentación'), now });
    else {
      doc = normalizeDoc(slug, prev);
      doc.revision = Number(doc.revision || 0) + 1; doc.updatedAt = now;
      doc.history = [...list(doc.history), { revision: doc.revision, at: now, kind: 'regenerate', by: actorName(actor), via: actor.via || '', reason: reason || 'presentación regenerada (se conservan las secciones editadas a mano)', sections: [] }].slice(-MAX_HISTORY);
    }
    await env.PRESENTATION_IDEAS.put(STYLEBOOK_KEY(slug), JSON.stringify(doc));
    return doc;
  } catch (_) { return null; }
}

export function stylebookSummary(slug, doc) {
  return { url: stylebookUrls(slug).page, markdownUrl: stylebookUrls(slug).markdown, apiUrl: stylebookUrls(slug).api, revision: doc ? doc.revision : 1, series: SERIES_ID };
}

/** Plantilla base (vacía de datos de cliente) con los valores de la serie, para get_stylebook {template:true}. */
export function renderTemplateMarkdown() {
  const ctx = {
    slug: '<slug>', site: 'https://www.admiranext.com',
    presentation: { displayName: '<Nombre del cliente>', website: 'https://<web-del-cliente>', problem: '<problema>', audience: '<audiencia>', languages: ['es', 'en'], outputs: ['website', 'documents'], theme: { primary: '#6A9A3F', accent: '#2468BE', background: '#0D1321', surface: '#F5F8FC', text: '#1C2438', mode: 'dark', fontStyle: 'grotesk', layout: 'editorial', density: 'balanced', radius: 14 } },
    ideas: { objective: '<objetivo de la reunión>', skeleton: [], closing: {}, hero: { title: '<título>' } }
  };
  return renderStylebookMarkdown('<slug>', newStylebookDoc('<slug>', { reason: 'plantilla base' }), ctx)
    .replace(/\n\|\s*Revisión del libro[^\n]*/, '\n| Revisión del libro | plantilla |');
}
