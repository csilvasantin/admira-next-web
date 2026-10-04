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

const PATAS = [
  {id:'studio', nombre:'Admira.Studio', verbo:'crea', dominio:'admira.studio'},
  {id:'store', nombre:'Admira.store', verbo:'distribuye', dominio:'admira.store'},
  {id:'tv', nombre:'Admira.tv', verbo:'emite', dominio:null},
  {id:'app', nombre:'Admira.app', verbo:'comercializa', dominio:'admira.app'},
  {id:'biz', nombre:'Admira.biz', verbo:'mantiene y factura', dominio:null},
];

async function leerJson(url){ const r = await fetch(url, {headers:{accept:'application/json'}}); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }

async function cargarMarca(id){
  try { return await leerJson(`/marcablanca/api/marcas/${encodeURIComponent(id)}`); }
  catch (_) {
    const m = await leerJson(`/marcablanca/clientes/${encodeURIComponent(id)}.json`);
    return JSON.parse(JSON.stringify(m).replace(/"\.\.\/(logos|fuentes)\//g, '"/marcablanca/$1/'));
  }
}

/** El SVG del catálogo se incrusta (currentColor sigue al texto); cualquier otro logo va como <img>. */
async function logoHtml(m){
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
        return `<span class="logo">${svg.outerHTML}</span>`;
      }
    } catch (_) { /* cae a <img> */ }
  }
  const src = l.imagen || l.svg;
  return src ? `<span class="logo"><img src="${esc(src)}" alt="${esc(l.alt || m.nombre)}"></span>` : `<span class="logo" style="font:800 28px var(--ft)">${esc(m.nombre)}</span>`;
}

function aplicarVariables(m){
  const c = m.colores?.claro || {}, o = m.colores?.oscuro || c, t = m.tipografia || {}, r = m.radios || {}, s = m.sombras || {};
  const v = {'--p':c.primario,'--pt':c.primarioTexto,'--s':c.secundario,'--st':c.secundarioTexto,'--a':c.acento,'--at':c.acentoTexto,'--f':c.fondo,'--fa':c.fondoAlt,'--sup':c.superficie,'--b':c.borde,'--t':c.texto,'--ts':c.textoSuave,'--tt':c.textoTenue,
    '--of':o.fondo,'--ofa':o.superficie,'--ot':o.texto,'--ots':o.textoSuave,'--ob':o.borde,'--op':o.primario,
    '--ft':t.titulos,'--fx':t.texto,'--fe':t.etiquetas,'--pw':t.pesoTitulos,'--tr':t.transformTitulos,'--tk':t.trackingTitulos,
    '--r-sm':r.sm,'--r-md':r.md,'--r-lg':r.lg,'--r-b':r.boton,'--sh-md':s.md};
  for (const [k, val] of Object.entries(v)) if (val != null && val !== '') document.documentElement.style.setProperty(k, String(val));
  for (const f of t.fuentes || []) {
    if (!f?.familia || !f?.url) continue;
    try { const ff = new FontFace(f.familia, `url(${f.url})`, {weight: String(f.peso || '400'), display:'swap'}); document.fonts.add(ff); ff.load().catch(() => {}); } catch (_) {}
  }
  if (m.favicon) { const ln = document.querySelector('link[rel=icon]'); if (ln) { ln.href = m.favicon; ln.removeAttribute('type'); } }
  document.title = `Libro de estilo · ${m.nombre}`;
  const tc = document.querySelector('meta[name=theme-color]'); if (tc && c.primario) tc.content = c.primario;
}

function muestra(nombre, hex, sobre, fondo, grande){
  if (!esHex(hex)) return '';
  const [r, g, b] = rgb(hex);
  const ct = esHex(fondo) ? contraste(hex, fondo).toFixed(2) : '—';
  return `<div class="muestra${grande ? ' grande' : ''}"><div class="c" style="background:${hex};color:${esHex(sobre) ? sobre : '#fff'}">${esc(nombre)}</div>
    <dl><dt>HEX</dt><dd>${hex.toUpperCase()}</dd><dt>RGB</dt><dd>${r}, ${g}, ${b}</dd><dt>Contraste</dt><dd>${ct}:1 sobre fondo</dd></dl></div>`;
}
const NOMBRES = {primario:'Primario',secundario:'Secundario',acento:'Acento',fondo:'Fondo',fondoAlt:'Fondo alt.',superficie:'Superficie',superficieAlt:'Superficie alt.',borde:'Borde',texto:'Texto',textoSuave:'Texto suave',textoTenue:'Texto tenue',primarioTexto:'Texto s/ primario',secundarioTexto:'Texto s/ secundario',acentoTexto:'Texto s/ acento',ok:'OK',aviso:'Aviso',error:'Error',info:'Info'};
function paleta(p){
  const tinta = (k) => (k.endsWith('Texto') ? p[k.replace('Texto', '')] : (['fondo','fondoAlt','superficie','superficieAlt','borde'].includes(k) ? p.texto : '#FFFFFF'));
  return `<div class="paleta">${Object.keys(NOMBRES).filter((k) => esHex(p[k])).map((k) => muestra(NOMBRES[k], p[k], k.endsWith('Texto') ? p[k.replace('Texto', '')] : tinta(k), p.fondo)).join('')}</div>`;
}

async function pintar(m){
  aplicarVariables(m);
  const L = await logoHtml(m);
  const c = m.colores?.claro || {}, o = m.colores?.oscuro || {}, t = m.tipografia || {}, tono = m.tono || {}, d = m.demo || {};
  const familia = (s) => esc(String(s || '').split(',')[0].replace(/['"]/g, '').trim() || '—');
  const tiendas = (d.tiendas || []).slice(0, 3), inc = (d.incidencias || []).slice(0, 3);
  const enlacePata = (p) => p.dominio ? `<a href="https://www.${p.dominio}/?marca=${encodeURIComponent(m.id)}" target="_blank" rel="noopener">Ver en ${esc(p.dominio)} →</a>` : '<span class="nota">maqueta de referencia</span>';
  const pantallas = {
    studio: `<div class="pant"><div class="mini-logo">${L}</div><div class="cartel"><small>${esc(d.producto || 'Campaña')}</small><h4>${esc(d.titular || m.nombre)}</h4><span class="cta">${esc(d.cta || tono.frases?.cta || 'Descúbrelo')}</span></div></div>`,
    store: `<div class="pant"><div class="mini-logo">${L}</div>${tiendas.map((s, i) => `<div class="fila"><span>${esc(s.nombre)}</span><span>${esc((d.piezas || [])[i] || '')}</span></div>`).join('')}<div style="margin-top:auto"><span class="boton" style="padding:6px 12px;font-size:12px">Distribuir</span></div></div>`,
    tv: `<div class="pant"><div class="tv"><div class="mini-logo" style="color:var(--st)">${L}</div><h4>${esc(d.titular || m.nombre)}</h4><span class="estado" style="align-self:flex-start">${esc(d.cta || 'Descúbrelo')}</span></div><small style="color:var(--ts)">${esc(d.tipoEspacio || '')} · pantalla 16:9</small></div>`,
    app: `<div class="pant osc"><div class="mini-logo" style="color:var(--ot)">${L}</div><b style="font-family:var(--ft)">${esc(d.circuito || '')}</b><div class="kpi"><div><b>${esc(d.puntos ?? '')}</b>puntos</div><div><b>${esc(d.superficies ?? '')}</b>superficies</div><div><b>${esc(d.imprDia || '')}</b>impr./día</div><div><b>${esc(d.cpm || '')}</b>CPM</div></div></div>`,
    biz: `<div class="pant"><div class="mini-logo">${L}</div>${inc.map((x) => `<div class="fila"><span>${esc(x.id)} · ${esc(x.equipo)}</span><span class="estado ${esc(x.estado)}">${esc(x.estado)}</span></div>`).join('')}<small style="color:var(--ts);margin-top:auto">${esc(tono.frases?.exito || '')}</small></div>`,
  };
  $libro.innerHTML = `<div class="libro">
  <nav class="barra"><span><a href="/marcablanca/">Marca blanca</a> / <a href="/marcablanca/estilo">Libro de estilo</a> / <b>${esc(m.nombre)}</b></span>
    <span><a href="/marcablanca/presentacion?marca=${encodeURIComponent(m.id)}">Presentación</a> · <a href="/marcablanca/api/marcas/${encodeURIComponent(m.id)}">JSON</a></span></nav>
  <header class="portada">
    <div><div class="kicker">Libro de estilo · marca blanca</div><h1>${esc(m.nombre)}</h1><p>${esc(m.descripcion || '')}</p>
      <div class="chips"><span class="chip">${esc(m.sector || '')}</span>${['primario','secundario','acento'].filter((k) => esHex(c[k])).map((k) => `<span class="chip"><i style="background:${c[k]}"></i>${NOMBRES[k]} ${c[k].toUpperCase()}</span>`).join('')}</div></div>
    <div class="cara positivo">${L}</div>
  </header>

  <section class="bloque" id="logo"><div class="cab"><span class="n">01</span><h2>Logo y zona de protección</h2><span class="nota">${esc(m.logo?.alt || '')}</span></div>
    <div class="rejilla r2">
      <div class="proteccion"><div class="zona" style="padding:28px">${L}</div><span class="x" style="top:12px">x</span></div>
      <div><p>La zona de protección es el espacio mínimo libre alrededor del logo: <b>x = 25 % de la altura del logo</b> por cada lado (línea discontinua). Dentro no entra texto, otro logo ni el borde de la pieza.</p>
        <p><b>Tamaño mínimo:</b> 24 px de alto en pantalla y 10 mm en impreso.</p>
        <div class="minimos"><figure><div style="height:64px">${L.replace('class="logo"', 'class="logo" style="height:64px"')}</div>64 px</figure><figure><div style="height:40px">${L.replace('class="logo"', 'class="logo" style="height:40px"')}</div>40 px</figure><figure><div style="height:24px">${L.replace('class="logo"', 'class="logo" style="height:24px"')}</div>24 px · mínimo</figure></div></div>
    </div>
    <div class="modo-t">Versiones</div>
    <div class="rejilla r4 versiones">
      <figure><div class="cara" style="background:#FFFFFF;color:${esc(c.texto || '#111')}">${L}</div><figcaption>Positivo · sobre blanco</figcaption></figure>
      <figure><div class="cara" style="background:${esc(o.fondo || '#111')};color:${esc(o.texto || '#fff')}">${L}</div><figcaption>Negativo · sobre fondo oscuro</figcaption></figure>
      <figure><div class="cara" style="background:${esc(c.primario)};color:${esc(c.primarioTexto)}">${L}</div><figcaption>Sobre primario ${esc((c.primario || '').toUpperCase())}</figcaption></figure>
      <figure><div class="cara" style="background:${esc(c.fondoAlt || '#f5f5f5')};color:${esc(c.texto || '#111')}">${L}</div><figcaption>Sobre fondo alternativo</figcaption></figure>
    </div>
  </section>

  <section class="bloque" id="colores"><div class="cab"><span class="n">02</span><h2>Colores</h2><span class="nota">HEX · RGB · contraste WCAG sobre el fondo</span></div>
    <div class="rejilla r3">${muestra('Primario', c.primario, c.primarioTexto, c.fondo, true)}${muestra('Secundario', c.secundario, c.secundarioTexto, c.fondo, true)}${muestra('Acento', c.acento, c.acentoTexto, c.fondo, true)}</div>
    <div class="modo-t">Paleta completa · modo claro</div>${paleta(c)}
    <div class="modo-t">Paleta completa · modo oscuro</div>${paleta(o)}
  </section>

  <section class="bloque" id="tipografia"><div class="cab"><span class="n">03</span><h2>Tipografía</h2><span class="nota">peso de titulares ${esc(t.pesoTitulos || '')} · tracking ${esc(t.trackingTitulos || '0')}</span></div>
    <div class="rejilla r3">
      <div class="ficha"><h3>Titulares · ${familia(t.titulos)}</h3><div class="especimen">Aa</div><p class="tipo-fam">${esc(t.titulos)}</p></div>
      <div class="ficha"><h3>Texto · ${familia(t.texto)}</h3><div class="especimen" style="font-family:var(--fx);font-weight:400;text-transform:none;letter-spacing:0">Aa</div><p class="tipo-fam">${esc(t.texto)}</p></div>
      <div class="ficha"><h3>Etiquetas · ${familia(t.etiquetas)}</h3><div class="especimen" style="font-family:var(--fe);font-weight:700;font-size:40px;text-transform:uppercase;letter-spacing:.12em">ABC</div><p class="tipo-fam">${esc(t.etiquetas)}</p></div>
    </div>
    <div class="escala" style="margin-top:18px">
      <p style="font-family:var(--ft);font-weight:var(--pw);letter-spacing:var(--tk);text-transform:var(--tr);font-size:40px;line-height:1.05">H1 · ${esc(d.titular || m.nombre)}</p>
      <p style="font-family:var(--ft);font-weight:var(--pw);letter-spacing:var(--tk);text-transform:var(--tr);font-size:26px">H2 · ${esc(d.producto || 'Campaña de temporada')}</p>
      <p style="font-size:16px">Cuerpo · ${esc(tono.voz || '')}</p>
      <p style="font-family:var(--fe);font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--ts)">Etiqueta · ${esc(d.tipoEspacio || m.sector || '')}</p>
      <p><span class="boton">${esc(tono.frases?.cta || 'Descúbrelo')}</span> <span class="boton sec">Secundario</span> <span class="boton ac">Acento</span></p>
    </div>
  </section>

  <section class="bloque" id="tono"><div class="cab"><span class="n">04</span><h2>Tono</h2><span class="nota">tratamiento: ${esc(tono.tratamiento || 'tú')}</span></div>
    <div class="rejilla r4">
      <div class="ficha"><h3>Voz</h3><p>${esc(tono.voz || '')}</p></div>
      <div class="ficha"><h3>Llamada a la acción</h3><p>«${esc(tono.frases?.cta || '')}»</p></div>
      <div class="ficha"><h3>Vacío · éxito</h3><p>«${esc(tono.frases?.vacio || '')}» · «${esc(tono.frases?.exito || '')}»</p></div>
      <div class="ficha"><h3>Error</h3><p>«${esc(tono.frases?.error || '')}»</p></div>
    </div>
    ${(tono.si?.length || tono.no?.length) ? `<div class="rejilla r2" style="margin-top:12px"><div class="ficha"><h3>Sí</h3><p>${(tono.si || []).map(esc).join(' · ')}</p></div><div class="ficha"><h3>No</h3><p>${(tono.no || []).map(esc).join(' · ')}</p></div></div>` : ''}
  </section>

  <section class="bloque si-no" id="usos"><div class="cab"><span class="n">05</span><h2>Usos correctos e incorrectos</h2></div>
    <div class="rejilla r4">
      <div class="ficha"><div class="lienzo" style="background:#fff;color:${esc(c.texto)}">${L}</div><div class="pie"><span class="ok">✓</span>Proporción original, con su zona de protección.</div></div>
      <div class="ficha"><div class="lienzo" style="background:${esc(o.fondo)};color:${esc(o.texto)}">${L}</div><div class="pie"><span class="ok">✓</span>Versión en negativo sobre el fondo oscuro de la marca.</div></div>
      <div class="ficha"><div class="lienzo" style="background:${esc(c.primario)};color:${esc(c.primarioTexto)}">${L}</div><div class="pie"><span class="ok">✓</span>Sobre el primario, con el color de texto de la paleta.</div></div>
      <div class="ficha"><div class="lienzo"><span style="font:800 13px var(--fe);letter-spacing:.1em;color:var(--ts)">ZONA LIBRE</span></div><div class="pie"><span class="ok">✓</span>Fondos limpios y sin elementos dentro de la zona de protección.</div></div>
      <div class="ficha"><div class="lienzo tachado">${L.replace('class="logo"', 'class="logo" style="transform:scaleX(1.6)"')}</div><div class="pie"><span class="ko">✕</span>No deformar ni estirar el logo.</div></div>
      <div class="ficha"><div class="lienzo tachado">${L.replace('class="logo"', 'class="logo" style="transform:rotate(-14deg)"')}</div><div class="pie"><span class="ko">✕</span>No girarlo ni inclinarlo.</div></div>
      <div class="ficha"><div class="lienzo tachado" style="background:${esc(c.borde)};color:${esc(c.fondoAlt)}">${L}</div><div class="pie"><span class="ko">✕</span>No usarlo con poco contraste.</div></div>
      <div class="ficha"><div class="lienzo tachado">${L.replace('class="logo"', 'class="logo" style="filter:drop-shadow(4px 4px 3px rgba(0,0,0,.55)) hue-rotate(160deg) saturate(3);color:#7A5AF8"')}</div><div class="pie"><span class="ko">✕</span>No cambiar sus colores ni añadir sombras o efectos.</div></div>
    </div>
  </section>

  <section class="bloque patas" id="patas"><div class="cab"><span class="n">06</span><h2>Ejemplos en las cinco patas</h2><span class="nota">studio · store · tv · app · biz</span></div>
    <div class="rejilla r5">${PATAS.map((p) => `<div class="pata">${pantallas[p.id]}<div class="pie"><b>${esc(p.nombre)}</b> ${esc(p.verbo)}<br>${enlacePata(p)}</div></div>`).join('')}</div>
  </section>
  <footer class="pie-libro">Libro de estilo generado desde el catálogo único de marca blanca de AdmiraNeXT · marca <code>${esc(m.id)}</code></footer>
  </div>`;
  document.documentElement.setAttribute('data-libro-marca', m.id);
}

async function indice(){
  const cat = await leerJson('/marcablanca/api/marcas').catch(() => ({clientes:[]}));
  const lista = (cat.clientes || []).filter((x) => x?.id);
  $libro.innerHTML = `<div class="libro"><nav class="barra"><span><a href="/marcablanca/">Marca blanca</a> / <b>Libro de estilo</b></span></nav>
    <header class="portada" style="grid-template-columns:1fr"><div><div class="kicker">Libro de estilo · marca blanca</div><h1>Elige una marca</h1><p>Cada marca del catálogo tiene su libro de estilo: logo, zona de protección, colores, tipografía, tono, usos y ejemplos en las cinco patas.</p></div></header>
    <div class="indice">${lista.map((x) => `<a href="/marcablanca/estilo?marca=${encodeURIComponent(x.id)}"><b>${esc(x.nombre || x.id)}</b><small>${esc(x.sector || x.catalogo?.tipo || '')}</small></a>`).join('')}</div></div>`;
}

(async () => {
  const id = idPedido();
  try {
    if (!id) return await indice();
    await pintar(await cargarMarca(id));
  } catch (e) {
    $libro.innerHTML = `<p class="cargando">No encuentro la marca «${esc(id)}» en el catálogo. <a href="/marcablanca/estilo">Ver todas</a></p>`;
  }
})();
