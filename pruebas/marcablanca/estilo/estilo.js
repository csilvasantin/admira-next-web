/*
 * /marcablanca/estilo?marca=<id> · LIBRO DE ESTILO de cualquier marca del catálogo único de marca blanca.
 * Lee /marcablanca/api/marcas/<id> (semillas del repo + marcas guardadas) y pinta: logo, zona de protección,
 * tamaños mínimos, versiones, colores con HEX/RGB y contraste, tipografía, tono, usos correctos e
 * incorrectos y ejemplos en las cinco patas (studio, store, tv, app, biz).
 * Sólo enseña la marca pedida: nunca lista otras marcas dentro del libro de una marca.
 */
import {contraste, esHex} from '/marcablanca/marca.js';

const $libro = document.getElementById('libro');
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rgb = (h) => { const x = String(h).replace('#', ''); const n = x.length === 3 ? x.split('').map((c) => c + c).join('') : x; return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16)); };
const idPedido = () => (new URLSearchParams(location.search).get('marca') || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 60);

function aplicarLangDeUrl(){
  const q = new URLSearchParams(location.search).get('lang') || '';
  if (/^en/i.test(q)) document.documentElement.lang = 'en';
  else if (/^es/i.test(q)) document.documentElement.lang = 'es';
}
aplicarLangDeUrl();
const idioma = () => /^en/i.test(document.documentElement.lang || '') ? 'en' : 'es';
const t = (es, en) => idioma() === 'en' ? en : es;

function patas(){
  const en = idioma() === 'en';
  return [
    {id:'studio', nombre:'Admira.Studio', verbo: en ? 'creates' : 'crea', dominio:'admira.studio'},
    {id:'store', nombre:'Admira.store', verbo: en ? 'distributes' : 'distribuye', dominio:'admira.store'},
    {id:'tv', nombre:'Admira.tv', verbo: en ? 'broadcasts' : 'emite', dominio:null},
    {id:'app', nombre:'Admira.biz', verbo: en ? 'sells' : 'comercializa', dominio:'admira.biz'},
    {id:'biz', nombre:'Admira.app', verbo: en ? 'maintains' : 'mantiene', dominio:'admira.app'},
  ];
}

async function leerJson(url){ const r = await fetch(url, {headers:{accept:'application/json'}}); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }

async function cargarMarcaPublica(id){
  try { return await leerJson(`/marcablanca/api/marcas/${encodeURIComponent(id)}`); }
  catch (_) {
    const m = await leerJson(`/marcablanca/clientes/${encodeURIComponent(id)}.json`);
    return JSON.parse(JSON.stringify(m).replace(/"\.\.\/(logos|fuentes|escenas)\//g, '"/marcablanca/$1/'));
  }
}
/* ZONA /pruebas (norma 31): las escenas nuevas de #5549 (JTI, Starbucks, Altadis) viven en /pruebas/marcablanca/clientes y /escenas. */
async function cargarMarca(id){
  const m = await cargarMarcaPublica(id);
  if (!m?.fondos?.escena) {
    try {
      const p = await leerJson(`/pruebas/marcablanca/clientes/${encodeURIComponent(id)}.json`);
      if (p?.fondos) m.fondos = Object.assign({}, m.fondos || {}, p.fondos);
    } catch (_) { /* sin escena de pruebas */ }
  }
  return m;
}

/** El SVG del catálogo se incrusta; un PNG (logo oscuro) lleva filtro para la variante negativa o monocroma. */
async function baseLogo(m){
  const l = m.logo || {};
  if (l.svg && /^\/marcablanca\/logos\/[a-z0-9-]+\.svg$/.test(l.svg)) {
    try {
      const txt = await (await fetch(l.svg)).text();
      const doc = new DOMParser().parseFromString(txt, 'image/svg+xml');
      const svg = doc.documentElement;
      if (svg && svg.nodeName.toLowerCase() === 'svg') {
        svg.querySelectorAll('script,foreignObject').forEach((n) => n.remove());
        svg.querySelectorAll('*').forEach((n) => [...n.attributes].forEach((a) => { if (/^on/i.test(a.name) || /javascript:/i.test(a.value)) n.removeAttribute(a.name); }));
        svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', l.alt || m.nombre);
        return {tipo:'svg', svg, alt: l.alt || m.nombre};
      }
    } catch (_) { /* cae a <img> */ }
  }
  const src = l.imagen || l.svg;
  return src ? {tipo:'img', src, alt: l.alt || m.nombre} : {tipo:'texto', nombre: m.nombre};
}

function teñir(nodo, tinta){
  if (!tinta) return;
  nodo.setAttribute('color', tinta);
  nodo.querySelectorAll('*').forEach((n) => {
    for (const attr of ['fill', 'stroke']) {
      const v = n.getAttribute(attr);
      if (!v || v === 'none' || /^url\(/i.test(v)) continue;
      n.setAttribute(attr, tinta);
    }
  });
}

/** tinta = una sola tinta (variante negativa o monocroma). filtro = PNG oscuro sobre fondo oscuro o plano. */
function logoHtml(base, {tinta, filtro} = {}){
  if (base.tipo === 'svg') {
    const svg = base.svg.cloneNode(true);
    teñir(svg, tinta || '');
    return `<span class="logo">${svg.outerHTML}</span>`;
  }
  if (base.tipo === 'img') {
    const cls = filtro === 'negativo' ? ' logo-neg' : filtro === 'mono' ? ' logo-mono' : '';
    return `<span class="logo${cls}"><img src="${esc(base.src)}" alt="${esc(base.alt)}"></span>`;
  }
  return `<span class="logo" style="font:800 28px var(--ft);color:${esc(tinta || 'inherit')}">${esc(base.nombre)}</span>`;
}

/** La tinta plana que más se lee sobre ese fondo: clara (negativa) u oscura (monocroma). */
function tintaSobre(fondo){
  if (!esHex(fondo)) return '#161616';
  return contraste('#FFFFFF', fondo) >= contraste('#161616', fondo) ? '#FFFFFF' : '#161616';
}
function filtroDe(tinta){ return String(tinta).toUpperCase() === '#FFFFFF' ? 'negativo' : 'mono'; }

function aplicarVariables(m){
  const c = m.colores?.claro || {}, o = m.colores?.oscuro || c, tipo = m.tipografia || {}, r = m.radios || {}, s = m.sombras || {};
  const v = {'--p':c.primario,'--pt':c.primarioTexto,'--s':c.secundario,'--st':c.secundarioTexto,'--a':c.acento,'--at':c.acentoTexto,'--f':c.fondo,'--fa':c.fondoAlt,'--sup':c.superficie,'--b':c.borde,'--t':c.texto,'--ts':c.textoSuave,'--tt':c.textoTenue,
    '--of':o.fondo,'--ofa':o.superficie,'--ot':o.texto,'--ots':o.textoSuave,'--ob':o.borde,'--op':o.primario,
    '--ft':tipo.titulos,'--fx':tipo.texto,'--fe':tipo.etiquetas,'--pw':tipo.pesoTitulos,'--tr':tipo.transformTitulos,'--tk':tipo.trackingTitulos,
    '--r-sm':r.sm,'--r-md':r.md,'--r-lg':r.lg,'--r-b':r.boton,'--sh-md':s.md};
  for (const [k, val] of Object.entries(v)) if (val != null && val !== '') document.documentElement.style.setProperty(k, String(val));
  for (const f of tipo.fuentes || []) {
    if (!f?.familia || !f?.url) continue;
    try { const ff = new FontFace(f.familia, `url(${f.url})`, {weight: String(f.peso || '400'), display:'swap'}); document.fonts.add(ff); ff.load().catch(() => {}); } catch (_) {}
  }
  if (m.favicon) { const ln = document.querySelector('link[rel=icon]'); if (ln) { ln.href = m.favicon; ln.removeAttribute('type'); } }
  document.title = `${t('Libro de estilo', 'Style book')} · ${m.nombre}`;
  const tc = document.querySelector('meta[name=theme-color]'); if (tc && c.primario) tc.content = c.primario;
}

/** Escena ilustrada de la piel (fondos.escena): vector propio de /marcablanca/escenas/, como portada del libro. */
function escenaHtml(m){
  const e = m.fondos?.escena;
  if (!e || typeof e.svg !== 'string' || !/^(?:\/pruebas)?\/marcablanca\/escenas\/[a-z0-9-]+\.svg$/.test(e.svg)) return '';
  return `<figure class="escena"><img src="${esc(e.svg)}" alt="${esc(e.alt || m.nombre)}" width="1600" height="900" loading="eager" decoding="async"><figcaption>${t('Escena de la piel', 'Skin scene')} · ${esc(e.alt || '')} · ${t('ilustración vectorial original', 'original vector illustration')}</figcaption></figure>`;
}

function avisoWcag(hex, fondo){
  if (!esHex(hex) || !esHex(fondo)) return '';
  const ratio = contraste(hex, fondo);
  if (ratio >= 4.5) return '';
  const n = ratio.toFixed(2);
  const grande = ratio >= 3;
  return `<p class="wcag">${t(
    `Aviso WCAG: ${n}:1 no alcanza 4.5:1 para texto normal.${grande ? ' Sí llega a 3:1, el mínimo de texto grande y de componentes.' : ' Tampoco llega a 3:1.'}`,
    `WCAG warning: ${n}:1 is below 4.5:1 for normal text.${grande ? ' It does meet 3:1, the minimum for large text and UI components.' : ' It also misses 3:1.'}`
  )}</p>`;
}
function muestra(nombre, hex, sobre, fondo, grande, avisar = true){
  if (!esHex(hex)) return '';
  const [r, g, b] = rgb(hex);
  const ct = esHex(fondo) ? contraste(hex, fondo).toFixed(2) : '—';
  return `<div class="muestra${grande ? ' grande' : ''}"><div class="c" style="background:${hex};color:${esHex(sobre) ? sobre : '#fff'}">${esc(nombre)}</div>
    <dl><dt>HEX</dt><dd>${hex.toUpperCase()}</dd><dt>RGB</dt><dd>${r}, ${g}, ${b}</dd><dt>${t('Contraste', 'Contrast')}</dt><dd>${ct}:1 ${t('sobre fondo', 'on the background')}</dd></dl>${avisar ? avisoWcag(hex, fondo) : ''}</div>`;
}
function nombres(){
  if (idioma() === 'en') return {primario:'Primary',secundario:'Secondary',acento:'Accent',fondo:'Background',fondoAlt:'Alt. background',superficie:'Surface',superficieAlt:'Alt. surface',borde:'Border',texto:'Text',textoSuave:'Soft text',textoTenue:'Faint text',primarioTexto:'Text on primary',secundarioTexto:'Text on secondary',acentoTexto:'Text on accent',ok:'OK',aviso:'Warning',error:'Error',info:'Info'};
  return {primario:'Primario',secundario:'Secundario',acento:'Acento',fondo:'Fondo',fondoAlt:'Fondo alt.',superficie:'Superficie',superficieAlt:'Superficie alt.',borde:'Borde',texto:'Texto',textoSuave:'Texto suave',textoTenue:'Texto tenue',primarioTexto:'Texto s/ primario',secundarioTexto:'Texto s/ secundario',acentoTexto:'Texto s/ acento',ok:'OK',aviso:'Aviso',error:'Error',info:'Info'};
}
function paleta(p){
  const NOMBRES = nombres();
  const tinta = (k) => (k.endsWith('Texto') ? p[k.replace('Texto', '')] : (['fondo','fondoAlt','superficie','superficieAlt','borde'].includes(k) ? p.texto : '#FFFFFF'));
  const esTinta = (k) => /Texto$/.test(k) || ['primario','secundario','acento','texto','textoSuave','textoTenue'].includes(k);
  return `<div class="paleta">${Object.keys(NOMBRES).filter((k) => esHex(p[k])).map((k) => muestra(NOMBRES[k], p[k], k.endsWith('Texto') ? p[k.replace('Texto', '')] : tinta(k), p.fondo, false, esTinta(k))).join('')}</div>`;
}

async function pintar(m){
  aplicarVariables(m);
  const base = await baseLogo(m);
  const c = m.colores?.claro || {}, o = m.colores?.oscuro || {}, tipo = m.tipografia || {}, tono = m.tono || {}, d = m.demo || {};
  const NOMBRES = nombres();
  const L = logoHtml(base);
  const negativo = logoHtml(base, {tinta:'#FFFFFF', filtro:'negativo'});
  const mono = logoHtml(base, {tinta:'#161616', filtro:'mono'});
  const tintaPrim = tintaSobre(c.primario);
  const sobrePrim = logoHtml(base, {tinta: tintaPrim, filtro: filtroDe(tintaPrim)});
  const familia = (s) => esc(String(s || '').split(',')[0].replace(/['"]/g, '').trim() || '—');
  const tiendas = (d.tiendas || []).slice(0, 3), inc = (d.incidencias || []).slice(0, 3);
  const enlacePata = (p) => p.dominio ? `<a href="https://www.${p.dominio}/?marca=${encodeURIComponent(m.id)}" target="_blank" rel="noopener">${t('Ver en', 'See on')} ${esc(p.dominio)} →</a>` : `<span class="nota">${t('maqueta de referencia', 'reference mock')}</span>`;
  const pantallas = {
    studio: `<div class="pant"><div class="mini-logo">${L}</div><div class="cartel"><small>${esc(d.producto || t('Campaña', 'Campaign'))}</small><h4>${esc(d.titular || m.nombre)}</h4><span class="cta">${esc(d.cta || tono.frases?.cta || t('Descúbrelo', 'Discover it'))}</span></div></div>`,
    store: `<div class="pant"><div class="mini-logo">${L}</div>${tiendas.map((s, i) => `<div class="fila"><span>${esc(s.nombre)}</span><span>${esc((d.piezas || [])[i] || '')}</span></div>`).join('')}<div style="margin-top:auto"><span class="boton" style="padding:6px 12px;font-size:12px">${t('Distribuir', 'Distribute')}</span></div></div>`,
    tv: `<div class="pant"><div class="tv"><div class="mini-logo" style="color:#fff">${negativo}</div><h4>${esc(d.titular || m.nombre)}</h4><span class="estado" style="align-self:flex-start">${esc(d.cta || t('Descúbrelo', 'Discover it'))}</span></div><small style="color:var(--ts)">${esc(d.tipoEspacio || '')} · ${t('pantalla 16:9', '16:9 screen')}</small></div>`,
    app: `<div class="pant osc"><div class="mini-logo" style="color:var(--ot)">${negativo}</div><b style="font-family:var(--ft)">${esc(d.circuito || '')}</b><div class="kpi"><div><b>${esc(d.puntos ?? '')}</b>${t('puntos', 'sites')}</div><div><b>${esc(d.superficies ?? '')}</b>${t('superficies', 'surfaces')}</div><div><b>${esc(d.imprDia || '')}</b>${t('impr./día', 'impr./day')}</div><div><b>${esc(d.cpm || '')}</b>CPM</div></div></div>`,
    biz: `<div class="pant"><div class="mini-logo">${L}</div>${inc.map((x) => `<div class="fila"><span>${esc(x.id)} · ${esc(x.equipo)}</span><span class="estado ${esc(x.estado)}">${esc(x.estado)}</span></div>`).join('')}<small style="color:var(--ts);margin-top:auto">${esc(tono.frases?.exito || '')}</small></div>`,
  };
  const marco = (px, logo) => `<figure><div class="marco" style="height:${px}px">${logo}</div><figcaption>${px} px${px === 24 ? t(' · mínimo', ' · minimum') : ''}</figcaption></figure>`;
  $libro.innerHTML = `<div class="libro">
  <nav class="barra"><span><a href="/pruebas/marcablanca/">${t('Marca blanca', 'White label')}</a> / <a href="/pruebas/marcablanca/estilo/">${t('Libro de estilo', 'Style book')}</a> / <b>${esc(m.nombre)}</b></span>
    <span><a href="/marcablanca/presentacion?marca=${encodeURIComponent(m.id)}">${t('Presentación', 'Presentation')}</a> · <a href="/marcablanca/api/marcas/${encodeURIComponent(m.id)}">JSON</a></span></nav>
  <header class="portada">
    <div><div class="kicker">${t('Libro de estilo · marca blanca', 'Style book · white label')}</div><h1>${esc(m.nombre)}</h1><p>${esc(m.descripcion || '')}</p>
      <div class="chips"><span class="chip">${esc(m.sector || '')}</span>${['primario','secundario','acento'].filter((k) => esHex(c[k])).map((k) => `<span class="chip"><i style="background:${c[k]}"></i>${NOMBRES[k]} ${c[k].toUpperCase()}</span>`).join('')}</div></div>
    <div class="cara positivo">${L}</div>
  </header>
${escenaHtml(m)}

  <section class="bloque" id="logo"><div class="cab"><span class="n">01</span><h2>${t('Logo y zona de protección', 'Logo and clear space')}</h2><span class="nota">${esc(m.logo?.alt || '')}</span></div>
    <div class="rejilla r2">
      <div class="proteccion"><div class="zona" style="padding:28px">${L}</div><span class="x" style="top:12px">x</span></div>
      <div><p>${t('La zona de protección es el espacio mínimo libre alrededor del logo: <b>x = 25 % de la altura del logo</b> por cada lado (línea discontinua). Dentro no entra texto, otro logo ni el borde de la pieza.', 'The clear space is the minimum empty room around the logo: <b>x = 25% of the logo height</b> on every side (dashed line). No text, other logo or piece edge enters it.')}</p>
        <p><b>${t('Tamaño mínimo:', 'Minimum size:')}</b> ${t('24 px de alto en pantalla y 10 mm en impreso.', '24 px tall on screen and 10 mm in print.')}</p>
        <div class="minimos">${marco(64, L)}${marco(40, L)}${marco(24, L)}</div></div>
    </div>
    <div class="modo-t">${t('Versiones', 'Versions')}</div>
    <div class="rejilla r4 versiones">
      <figure><div class="cara" style="background:#FFFFFF;color:${esc(c.texto || '#111')}">${L}</div><figcaption>${t('Positivo · sobre blanco', 'Positive · on white')}</figcaption></figure>
      <figure><div class="cara" style="background:${esc(o.fondo || '#111')};color:#FFFFFF">${negativo}</div><figcaption>${t('Variante negativa · sobre fondo oscuro', 'Negative variant · on a dark background')}</figcaption></figure>
      <figure><div class="cara" style="background:${esc(c.primario)};color:${esc(tintaPrim)}">${sobrePrim}</div><figcaption>${t('Sobre primario', 'On primary')} ${esc((c.primario || '').toUpperCase())}</figcaption></figure>
      <figure><div class="cara" style="background:#FFFFFF;color:#161616">${mono}</div><figcaption>${t('Variante monocroma · una sola tinta', 'Monochrome variant · one ink')}</figcaption></figure>
    </div>
  </section>

  <section class="bloque" id="colores"><div class="cab"><span class="n">02</span><h2>${t('Colores', 'Colors')}</h2><span class="nota">${t('HEX · RGB · contraste WCAG sobre el fondo', 'HEX · RGB · WCAG contrast on the background')}</span></div>
    <div class="rejilla r3">${muestra(NOMBRES.primario, c.primario, c.primarioTexto, c.fondo, true)}${muestra(NOMBRES.secundario, c.secundario, c.secundarioTexto, c.fondo, true)}${muestra(NOMBRES.acento, c.acento, c.acentoTexto, c.fondo, true)}</div>
    <div class="modo-t">${t('Paleta completa · modo claro', 'Full palette · light mode')}</div>${paleta(c)}
    <div class="modo-t">${t('Paleta completa · modo oscuro', 'Full palette · dark mode')}</div>${paleta(o)}
  </section>

  <section class="bloque" id="tipografia"><div class="cab"><span class="n">03</span><h2>${t('Tipografía', 'Typography')}</h2><span class="nota">${t('peso de titulares', 'heading weight')} ${esc(tipo.pesoTitulos || '')} · tracking ${esc(tipo.trackingTitulos || '0')}</span></div>
    <div class="rejilla r3">
      <div class="ficha"><h3>${t('Titulares', 'Headings')} · ${familia(tipo.titulos)}</h3><div class="especimen">Aa</div><p class="tipo-fam">${esc(tipo.titulos)}</p></div>
      <div class="ficha"><h3>${t('Texto', 'Text')} · ${familia(tipo.texto)}</h3><div class="especimen" style="font-family:var(--fx);font-weight:400;text-transform:none;letter-spacing:0">Aa</div><p class="tipo-fam">${esc(tipo.texto)}</p></div>
      <div class="ficha"><h3>${t('Etiquetas', 'Labels')} · ${familia(tipo.etiquetas)}</h3><div class="especimen" style="font-family:var(--fe);font-weight:700;font-size:40px;text-transform:uppercase;letter-spacing:.12em">ABC</div><p class="tipo-fam">${esc(tipo.etiquetas)}</p></div>
    </div>
    <div class="escala" style="margin-top:18px">
      <p style="font-family:var(--ft);font-weight:var(--pw);letter-spacing:var(--tk);text-transform:var(--tr);font-size:40px;line-height:1.05">H1 · ${esc(d.titular || m.nombre)}</p>
      <p style="font-family:var(--ft);font-weight:var(--pw);letter-spacing:var(--tk);text-transform:var(--tr);font-size:26px">H2 · ${esc(d.producto || t('Campaña de temporada', 'Seasonal campaign'))}</p>
      <p style="font-size:16px">${t('Cuerpo', 'Body')} · ${esc(tono.voz || '')}</p>
      <p style="font-family:var(--fe);font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--ts)">${t('Etiqueta', 'Label')} · ${esc(d.tipoEspacio || m.sector || '')}</p>
      <p><span class="boton">${esc(tono.frases?.cta || t('Descúbrelo', 'Discover it'))}</span> <span class="boton sec">${t('Secundario', 'Secondary')}</span> <span class="boton ac">${t('Acento', 'Accent')}</span></p>
    </div>
  </section>

  <section class="bloque" id="tono"><div class="cab"><span class="n">04</span><h2>${t('Tono', 'Tone')}</h2><span class="nota">${t('tratamiento:', 'address:')} ${esc(tono.tratamiento || 'tú')}</span></div>
    <div class="rejilla r4">
      <div class="ficha"><h3>${t('Voz', 'Voice')}</h3><p>${esc(tono.voz || '')}</p></div>
      <div class="ficha"><h3>${t('Llamada a la acción', 'Call to action')}</h3><p>«${esc(tono.frases?.cta || '')}»</p></div>
      <div class="ficha"><h3>${t('Vacío · éxito', 'Empty · success')}</h3><p>«${esc(tono.frases?.vacio || '')}» · «${esc(tono.frases?.exito || '')}»</p></div>
      <div class="ficha"><h3>${t('Error', 'Error')}</h3><p>«${esc(tono.frases?.error || '')}»</p></div>
    </div>
    ${(tono.si?.length || tono.no?.length) ? `<div class="rejilla r2" style="margin-top:12px"><div class="ficha"><h3>${t('Sí', 'Yes')}</h3><p>${(tono.si || []).map(esc).join(' · ')}</p></div><div class="ficha"><h3>${t('No', 'No')}</h3><p>${(tono.no || []).map(esc).join(' · ')}</p></div></div>` : ''}
  </section>

  <section class="bloque si-no" id="usos"><div class="cab"><span class="n">05</span><h2>${t('Usos correctos e incorrectos', 'Correct and incorrect uses')}</h2></div>
    <div class="rejilla r4">
      <div class="ficha"><div class="lienzo" style="background:#fff;color:${esc(c.texto)}">${L}</div><div class="pie"><span class="ok">✓</span>${t('Proporción original, con su zona de protección.', 'Original proportion, with its clear space.')}</div></div>
      <div class="ficha"><div class="lienzo" style="background:${esc(o.fondo)};color:#fff">${negativo}</div><div class="pie"><span class="ok">✓</span>${t('Variante negativa sobre el fondo oscuro de la marca.', 'Negative variant on the brand’s dark background.')}</div></div>
      <div class="ficha"><div class="lienzo" style="background:${esc(c.primario)};color:${esc(tintaPrim)}">${sobrePrim}</div><div class="pie"><span class="ok">✓</span>${t('Sobre el primario, en la tinta que contrasta.', 'On the primary, in the ink that contrasts.')}</div></div>
      <div class="ficha"><div class="lienzo" style="background:#fff;color:#161616">${mono}</div><div class="pie"><span class="ok">✓</span>${t('Variante monocroma: una sola tinta, sin el color original.', 'Monochrome variant: one ink, without the original color.')}</div></div>
      <div class="ficha"><div class="lienzo tachado">${L.replace('class="logo"', 'class="logo" style="transform:scaleX(1.6)"')}</div><div class="pie"><span class="ko">✕</span>${t('No deformar ni estirar el logo.', 'Do not distort or stretch the logo.')}</div></div>
      <div class="ficha"><div class="lienzo tachado">${L.replace('class="logo"', 'class="logo" style="transform:rotate(-14deg)"')}</div><div class="pie"><span class="ko">✕</span>${t('No girarlo ni inclinarlo.', 'Do not rotate or tilt it.')}</div></div>
      <div class="ficha"><div class="lienzo tachado" style="background:${esc(c.borde)};color:${esc(c.fondoAlt)}">${L}</div><div class="pie"><span class="ko">✕</span>${t('No usarlo con poco contraste.', 'Do not use it with poor contrast.')}</div></div>
      <div class="ficha"><div class="lienzo tachado">${L.replace('class="logo"', 'class="logo" style="filter:drop-shadow(4px 4px 3px rgba(0,0,0,.55)) hue-rotate(160deg) saturate(3);color:#7A5AF8"')}</div><div class="pie"><span class="ko">✕</span>${t('No cambiar sus colores ni añadir sombras o efectos.', 'Do not change its colors or add shadows or effects.')}</div></div>
    </div>
  </section>

  <section class="bloque patas" id="patas"><div class="cab"><span class="n">06</span><h2>${t('Ejemplos en las cinco patas', 'Examples on the five pillars')}</h2><span class="nota">studio · store · tv · app · biz</span></div>
    <div class="rejilla r5">${patas().map((p) => `<div class="pata">${pantallas[p.id]}<div class="pie"><b>${esc(p.nombre)}</b> ${esc(p.verbo)}<br>${enlacePata(p)}</div></div>`).join('')}</div>
  </section>
  <footer class="pie-libro">${t('Libro de estilo generado desde el catálogo único de marca blanca de AdmiraNeXT', 'Style book generated from the AdmiraNeXT white-label catalog')} · ${t('marca', 'brand')} <code>${esc(m.id)}</code></footer>
  </div>`;
  document.documentElement.setAttribute('data-libro-marca', m.id);
}

async function indice(){
  const cat = await leerJson('/marcablanca/api/marcas').catch(() => ({clientes:[]}));
  const lista = (cat.clientes || []).filter((x) => x?.id);
  $libro.innerHTML = `<div class="libro"><nav class="barra"><span><a href="/pruebas/marcablanca/">${t('Marca blanca', 'White label')}</a> / <b>${t('Libro de estilo', 'Style book')}</b></span></nav>
    <header class="portada" style="grid-template-columns:1fr"><div><div class="kicker">${t('Libro de estilo · marca blanca', 'Style book · white label')}</div><h1>${t('Elige una marca', 'Choose a brand')}</h1><p>${t('Cada marca del catálogo tiene su libro de estilo: logo, zona de protección, colores, tipografía, tono, usos y ejemplos en las cinco patas.', 'Each brand in the catalog has its style book: logo, clear space, colors, typography, tone, uses and examples on the five pillars.')}</p></div></header>
    <div class="indice">${lista.map((x) => `<a href="/pruebas/marcablanca/estilo/?marca=${encodeURIComponent(x.id)}"><b>${esc(x.nombre || x.id)}</b><small>${esc(x.sector || x.catalogo?.tipo || '')}</small></a>`).join('')}</div></div>`;
}

let marcaViva = null;
let enIndice = false;
async function pintarSegunIdioma(){
  if (enIndice) return indice();
  if (marcaViva) return pintar(marcaViva);
}
window.addEventListener('admira:languagechange', (ev) => {
  const l = ev && ev.detail && ev.detail.lang;
  if (l === 'en' || l === 'es') document.documentElement.lang = l;
  pintarSegunIdioma();
});

(async () => {
  const id = idPedido();
  try {
    if (!id) { enIndice = true; return await indice(); }
    marcaViva = await cargarMarca(id);
    await pintar(marcaViva);
  } catch (e) {
    console.error('libro', e);
    $libro.innerHTML = `<p class="cargando">${t('No encuentro la marca', 'I cannot find the brand')} «${esc(id)}» ${t('en el catálogo.', 'in the catalog.')} <a href="/pruebas/marcablanca/estilo/">${t('Ver todas', 'See all')}</a></p>`;
  }
})();
