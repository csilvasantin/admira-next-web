/*!
 * marcablanca.js · v1.2.0 · Galaxia Admira (Studio crea · Store distribuye · App comercializa · Yokup mantiene)
 * Cargador de la marca blanca común. Lee la marca del CATÁLOGO ÚNICO (/marcablanca/api/marcas/<id>,
 * semillas + marcas guardadas) y, si la API no responde, de clientes/<cliente>.json; y viste la web
 * con los tokens --mb-*.
 *
 *   <link rel="stylesheet" href="https://www.admiranext.com/marcablanca/marcablanca.css">
 *   <script src="https://www.admiranext.com/marcablanca/marcablanca.js"
 *           data-mb-plataforma="studio" data-mb-modo="nativo" defer></script>
 *
 * Qué marca se aplica (por orden): ?marca=<cliente> · data-mb-marca · la última ?marca de esta
 * pestaña · el dominio (clientes/index.json → dominios, o <cliente>.<dominio-de-plataforma>) ·
 * la marca por defecto (admira). Documentación: /marcablanca/README.md
 */
(function (w, d) {
  'use strict';
  if (w.MarcaBlanca && w.MarcaBlanca.version) return;

  var VERSION = '1.3.0';
  var script = d.currentScript;
  var BASE = new URL('/marcablanca/', (script && script.src) || w.location.href).href; // /pruebas: el catálogo es el público
  var NATIVO = { studio: 'oscuro', store: 'oscuro', app: 'oscuro', yokup: 'claro' };
  var DOMINIO_PLATAFORMA = { 'admira.studio': 'studio', 'admira.store': 'store', 'admira.app': 'app', 'yokup.com': 'yokup' };
  var ID_VALIDO = /^[a-z0-9][a-z0-9-]{0,40}$/;
  var API = BASE + 'api/marcas';
  var cacheJson = {};
  var cacheMarca = {};
  var cacheIndice = null;
  var cacheSvg = {};
  var fuentesCargadas = {};
  var contadorSvg = 0;

  function dato(nombre) {
    var v = script && script.getAttribute('data-mb-' + nombre);
    if (v == null) v = d.documentElement.getAttribute('data-mb-' + nombre);
    return v;
  }
  function kebab(s) { return String(s).replace(/[A-Z]/g, function (m) { return '-' + m.toLowerCase(); }); }
  function esObjeto(o) { return o && typeof o === 'object' && !Array.isArray(o); }
  function fusionar(a, b) {
    var r = {}, k;
    for (k in a) if (Object.prototype.hasOwnProperty.call(a, k)) r[k] = a[k];
    for (k in b) if (Object.prototype.hasOwnProperty.call(b, k)) r[k] = (esObjeto(r[k]) && esObjeto(b[k])) ? fusionar(r[k], b[k]) : b[k];
    return r;
  }
  function json(url) {
    if (!cacheJson[url]) {
      cacheJson[url] = fetch(url, { credentials: 'omit' }).then(function (r) {
        if (!r.ok) throw new Error('marcablanca: ' + r.status + ' en ' + url);
        return r.json();
      });
    }
    return cacheJson[url];
  }
  function absoluta(rel, desde) { try { return new URL(rel, desde).href; } catch (e) { return rel; } }

  function resolverUrls(m, desde) {
    if (m.logo && m.logo.svg) m.logo = fusionar(m.logo, { svg: absoluta(m.logo.svg, desde) });
    if (m.logo && m.logo.imagen) m.logo = fusionar(m.logo, { imagen: absoluta(m.logo.imagen, desde) });
    if (m.favicon) m.favicon = absoluta(m.favicon, desde);
    // Escena ilustrada de la piel (fondos.escena.svg): misma resolución que el logo.
    if (m.fondos && m.fondos.escena && m.fondos.escena.svg) m.fondos = fusionar(m.fondos, { escena: fusionar(m.fondos.escena, { svg: absoluta(m.fondos.escena.svg, desde) }) });
    if (m.tipografia && m.tipografia.fuentes) {
      m.tipografia = fusionar(m.tipografia, { fuentes: m.tipografia.fuentes.map(function (f) { return fusionar(f, { url: absoluta(f.url, desde) }); }) });
    }
    if (m.plataformas) {
      var p = {};
      Object.keys(m.plataformas).forEach(function (k) { p[k] = resolverUrls(fusionar({}, m.plataformas[k]), desde); });
      m.plataformas = p;
    }
    return m;
  }

  // Catálogo único: primero la API (semillas + marcas guardadas); si no responde (web estática,
  // red caída), los JSON estáticos de clientes/, que son la semilla y el respaldo.
  function cargarIndice() {
    if (!cacheIndice) cacheIndice = json(API).catch(function () { return json(BASE + 'clientes/index.json'); });
    return cacheIndice;
  }

  function cargar(id) {
    if (!ID_VALIDO.test(id || '')) return Promise.reject(new Error('marcablanca: cliente no válido «' + id + '»'));
    if (!cacheMarca[id]) {
      var desdeApi = API + '/' + id, desdeFichero = BASE + 'clientes/' + id + '.json';
      cacheMarca[id] = json(desdeApi).then(function (m) { return { m: m, desde: desdeApi }; }, function () {
        return json(desdeFichero).then(function (m) { return { m: m, desde: desdeFichero }; });
      });
      cacheMarca[id].catch(function () { delete cacheMarca[id]; });
    }
    return cacheMarca[id].then(function (r) { return resolverUrls(fusionar({}, r.m), r.desde); });
  }

  function marcaPorDominio(indice, host) {
    host = String(host || '').toLowerCase().replace(/^www\./, '');
    var mapa = indice.dominios || {};
    if (mapa[host]) return mapa[host];
    if (mapa['www.' + host]) return mapa['www.' + host];
    var partes = host.split('.');
    if (partes.length >= 3) {
      var resto = partes.slice(1).join('.');
      var ids = (indice.clientes || []).map(function (c) { return c.id; });
      if (DOMINIO_PLATAFORMA[resto] && ids.indexOf(partes[0]) !== -1) return partes[0];
    }
    return null;
  }

  function resolverId() {
    var q = null;
    try { q = new URLSearchParams(w.location.search).get('marca'); } catch (e) {}
    if (q && ID_VALIDO.test(q)) { try { w.sessionStorage.setItem('mb:marca', q); } catch (e) {} return Promise.resolve(q); }
    var attr = dato('marca');
    if (attr && ID_VALIDO.test(attr)) return Promise.resolve(attr);
    var guardada = null;
    try { guardada = w.sessionStorage.getItem('mb:marca'); } catch (e) {}
    if (guardada && ID_VALIDO.test(guardada)) return Promise.resolve(guardada);
    return cargarIndice().then(function (indice) {
      return marcaPorDominio(indice, w.location.hostname) || indice.porDefecto || 'admira';
    }, function () { return 'admira'; });
  }

  function plataformaPorDominio() {
    var host = w.location.hostname.toLowerCase().replace(/^www\./, '');
    for (var dom in DOMINIO_PLATAFORMA) if (host === dom || host.slice(-dom.length - 1) === '.' + dom) return DOMINIO_PLATAFORMA[dom];
    return null;
  }

  function resolverModo(m, plataforma, pedido, base) {
    var disponibles = Object.keys(m.colores || {});
    var modo = pedido || 'marca';
    if (modo === 'auto') modo = (w.matchMedia && w.matchMedia('(prefers-color-scheme: dark)').matches) ? 'oscuro' : 'claro';
    if (modo === 'nativo') {
      var sobre = base && base.plataformas && base.plataformas[plataforma];
      modo = (sobre && sobre.modo) || NATIVO[plataforma] || m.modo;
    }
    if (modo === 'marca') modo = m.modo;
    if (disponibles.indexOf(modo) === -1) modo = disponibles.indexOf(m.modo) !== -1 ? m.modo : disponibles[0];
    return modo;
  }

  /** Devuelve el mapa { '--mb-…': valor } de una marca ya fusionada con su plataforma. */
  function variables(m, modo) {
    var v = {};
    var paleta = (m.colores && m.colores[modo]) || {};
    Object.keys(paleta).forEach(function (k) { v['--mb-' + kebab(k)] = paleta[k]; });
    var t = m.tipografia || {};
    if (t.titulos) v['--mb-fuente-titulos'] = t.titulos;
    if (t.texto) v['--mb-fuente-texto'] = t.texto;
    if (t.mono) v['--mb-fuente-mono'] = t.mono;
    v['--mb-fuente-etiquetas'] = t.etiquetas || t.texto || 'inherit';
    if (t.pesoTitulos) v['--mb-peso-titulos'] = String(t.pesoTitulos);
    v['--mb-titulos-transform'] = t.transformTitulos || 'none';
    v['--mb-titulos-tracking'] = t.trackingTitulos || 'normal';
    var r = m.radios || {};
    Object.keys(r).forEach(function (k) { v['--mb-radio-' + kebab(k)] = r[k]; });
    var s = m.sombras || {};
    Object.keys(s).forEach(function (k) { v['--mb-sombra-' + kebab(k)] = s[k]; });
    // --mb-escena: la ilustración propia de la piel como imagen CSS (home, fondo de página). Solo
    // URLs http(s) o de la misma web, sin comillas ni paréntesis: nunca se inyecta CSS.
    var escena = m.fondos && m.fondos.escena && m.fondos.escena.svg;
    if (typeof escena === 'string' && /^(https?:\/\/|\/)[^"'()\s\\]+$/.test(escena)) v['--mb-escena'] = 'url("' + escena + '")';
    return v;
  }

  function cargarFuentes(m) {
    var lista = (m.tipografia && m.tipografia.fuentes) || [];
    if (!('FontFace' in w) || !d.fonts) return Promise.resolve();
    return Promise.all(lista.map(function (f) {
      var clave = f.familia + '|' + f.url;
      if (!fuentesCargadas[clave]) {
        var ff = new FontFace(f.familia, 'url(' + JSON.stringify(f.url) + ') format("woff2")', { weight: f.peso || '400 700', style: f.estilo || 'normal', display: 'swap' });
        d.fonts.add(ff);
        fuentesCargadas[clave] = ff.load().catch(function () {});
      }
      return fuentesCargadas[clave];
    }));
  }

  function textoSvg(url) {
    if (!cacheSvg[url]) cacheSvg[url] = fetch(url, { credentials: 'omit' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); });
    return cacheSvg[url];
  }

  function svgSeguro(texto) {
    var doc = new DOMParser().parseFromString(texto, 'image/svg+xml');
    var svg = doc.documentElement;
    if (!svg || svg.nodeName.toLowerCase() !== 'svg') return null;
    Array.prototype.forEach.call(svg.querySelectorAll('script,foreignObject'), function (n) { n.parentNode.removeChild(n); });
    var sufijo = '-mb' + (++contadorSvg);
    Array.prototype.forEach.call(svg.querySelectorAll('*'), function (n) {
      Array.prototype.slice.call(n.attributes).forEach(function (a) {
        if (/^on/i.test(a.name) || /^\s*javascript:/i.test(a.value)) n.removeAttribute(a.name);
      });
    });
    // ids únicos: el mismo logo puede aparecer varias veces en la página
    Array.prototype.forEach.call(svg.querySelectorAll('[id]'), function (n) {
      var viejo = n.id, nuevo = viejo + sufijo;
      n.id = nuevo;
      Array.prototype.forEach.call(svg.querySelectorAll('*'), function (o) {
        ['fill', 'stroke', 'href', 'xlink:href', 'clip-path', 'mask', 'filter'].forEach(function (at) {
          var val = o.getAttribute(at);
          if (val && val.indexOf('#' + viejo) !== -1) o.setAttribute(at, val.split('#' + viejo).join('#' + nuevo));
        });
      });
    });
    return d.importNode(svg, true);
  }

  function pintarLogos(objetivo, m) {
    var nodos = Array.prototype.slice.call(objetivo.querySelectorAll('[data-mb-logo]'));
    if (objetivo.hasAttribute && objetivo.hasAttribute('data-mb-logo')) nodos.unshift(objetivo);
    if (!nodos.length || !m.logo) return Promise.resolve();
    // Logo de mapa de bits o de fuera (p. ej. el de un prospect): va como <img>, nunca incrustado.
    if (!m.logo.svg && m.logo.imagen) {
      nodos.forEach(function (n) {
        var img = d.createElement('img');
        img.src = m.logo.imagen; img.alt = m.logo.alt || m.nombre; img.className = 'mb-logo-img'; img.decoding = 'async';
        n.innerHTML = ''; n.appendChild(img);
      });
      return Promise.resolve();
    }
    if (!m.logo.svg) return Promise.resolve();
    return textoSvg(m.logo.svg).then(function (txt) {
      nodos.forEach(function (n) {
        var svg = svgSeguro(txt);
        if (!svg) return;
        svg.setAttribute('aria-label', m.logo.alt || m.nombre);
        svg.setAttribute('role', 'img');
        svg.classList.add('mb-logo-svg');
        n.innerHTML = '';
        n.appendChild(svg);
      });
    }).catch(function () {
      nodos.forEach(function (n) { n.textContent = m.nombre; });
    });
  }

  function pintarTextos(objetivo, m) {
    Array.prototype.forEach.call(objetivo.querySelectorAll('[data-mb-nombre]'), function (n) { n.textContent = m.nombre; });
    var frases = (m.tono && m.tono.frases) || {};
    Array.prototype.forEach.call(objetivo.querySelectorAll('[data-mb-frase]'), function (n) {
      var f = frases[n.getAttribute('data-mb-frase')];
      if (f) n.textContent = f;
    });
  }

  function ponerFavicon(url) {
    if (!url) return;
    var link = d.querySelector('link[rel~="icon"][data-mb-favicon]');
    if (!link) {
      Array.prototype.forEach.call(d.querySelectorAll('link[rel~="icon"]'), function (l) { l.setAttribute('data-mb-favicon-original', l.href); l.parentNode.removeChild(l); });
      link = d.createElement('link');
      link.rel = 'icon';
      link.setAttribute('data-mb-favicon', '');
      d.head.appendChild(link);
    }
    link.type = 'image/svg+xml';
    link.href = url;
  }

  function ponerThemeColor(color) {
    if (!color) return;
    var meta = d.querySelector('meta[name="theme-color"]');
    if (!meta) { meta = d.createElement('meta'); meta.name = 'theme-color'; d.head.appendChild(meta); }
    meta.content = color;
  }

  /**
   * Aplica una marca.
   * @param {string} id  cliente (p. ej. «lumbre»)
   * @param {object} [o] { objetivo: Element (por defecto <html>), plataforma: 'studio'|'store'|'app'|'yokup',
   *                       modo: 'marca'|'nativo'|'claro'|'oscuro'|'auto', favicon: bool, logos: bool }
   */
  function aplicar(id, o) {
    o = o || {};
    var objetivo = o.objetivo || d.documentElement;
    var esRaiz = objetivo === d.documentElement;
    var plataforma = o.plataforma || null;
    return cargar(id).then(function (base) {
      var m = (plataforma && base.plataformas && base.plataformas[plataforma]) ? fusionar(base, base.plataformas[plataforma]) : base;
      var modo = resolverModo(m, plataforma, o.modo, base);
      var vars = variables(m, modo);
      for (var i = objetivo.style.length - 1; i >= 0; i--) {
        var prop = objetivo.style[i];
        if (prop.indexOf('--mb-') === 0) objetivo.style.removeProperty(prop);
      }
      Object.keys(vars).forEach(function (k) { objetivo.style.setProperty(k, vars[k]); });
      objetivo.style.colorScheme = modo === 'oscuro' ? 'dark' : 'light';
      objetivo.setAttribute('data-mb-marca', m.id);
      objetivo.setAttribute('data-mb-modo', modo);
      if (plataforma) objetivo.setAttribute('data-mb-plataforma', plataforma);
      if (m.ejemplo) objetivo.setAttribute('data-mb-ejemplo', ''); else objetivo.removeAttribute('data-mb-ejemplo');
      if (vars['--mb-escena']) objetivo.setAttribute('data-mb-escena', ''); else objetivo.removeAttribute('data-mb-escena');
      if (esRaiz && o.favicon !== false) { ponerFavicon(m.favicon); ponerThemeColor(vars['--mb-fondo']); }
      pintarTextos(objetivo, m);
      return Promise.all([cargarFuentes(m), o.logos === false ? null : pintarLogos(objetivo, m)]).then(function () {
        var detalle = { marca: m, id: m.id, modo: modo, plataforma: plataforma, variables: vars };
        try { objetivo.dispatchEvent(new CustomEvent('marcablanca:aplicada', { detail: detalle, bubbles: true })); } catch (e) {}
        if (esRaiz) api.actual = detalle;
        return detalle;
      });
    });
  }

  var api = {
    version: VERSION,
    base: BASE,
    nativo: NATIVO,
    actual: null,
    aplicar: aplicar,
    cargar: cargar,
    cargarIndice: cargarIndice,
    resolverId: resolverId,
    variables: function (id, o) {
      o = o || {};
      return cargar(id).then(function (base) {
        var m = (o.plataforma && base.plataformas && base.plataformas[o.plataforma]) ? fusionar(base, base.plataformas[o.plataforma]) : base;
        return variables(m, resolverModo(m, o.plataforma, o.modo, base));
      });
    },
    api: API,
    listar: function () { return cargarIndice().then(function (i) { return i.clientes || []; }); },
    /**
     * Registra una marca que no está en el catálogo (p. ej. la «nueva marca» de un prospect o la
     * propuesta de «Tu marca · URL», generadas con marca.js). A partir de ahí aplicar(id) y cargar(id)
     * la usan como a las demás. Volver a registrar el mismo id la sustituye (retoques en vivo).
     */
    registrar: function (marca) {
      if (!marca || !ID_VALIDO.test(marca.id || '')) throw new Error('marcablanca: marca sin id válido');
      cacheMarca[marca.id] = Promise.resolve({ m: JSON.parse(JSON.stringify(marca)), desde: BASE + 'clientes/' + marca.id + '.json' });
      return marca.id;
    },
    /** Olvida lo leído del catálogo (p. ej. tras guardar una marca nueva). */
    refrescar: function (id) { if (id) delete cacheMarca[id]; else cacheMarca = {}; cacheIndice = null; cacheJson = {}; }
  };
  w.MarcaBlanca = api;

  function leerIdioma(ev) {
    var det = ev && ev.detail && ev.detail.lang;
    if (det === 'en' || det === 'es') return det;
    try {
      var q = new URLSearchParams(w.location.search).get('lang') || '';
      if (/^en/i.test(q)) return 'en';
      if (/^es/i.test(q)) return 'es';
    } catch (e0) {}
    var actual = d.documentElement && d.documentElement.getAttribute && d.documentElement.getAttribute('lang');
    return /^en/i.test(actual || '') ? 'en' : 'es';
  }
  function aplicarIdiomaPagina(ev) {
    var l = leerIdioma(ev);
    try { if (d.documentElement && d.documentElement.setAttribute) d.documentElement.setAttribute('lang', l); } catch (e1) {}
    api.idioma = l;
  }
  aplicarIdiomaPagina(null);
  if (typeof w.addEventListener === 'function') w.addEventListener('admira:languagechange', aplicarIdiomaPagina);

  function arrancar() {
    if (dato('auto') === 'false') return;
    var plataforma = dato('plataforma') || plataformaPorDominio();
    var modo = null;
    try { modo = new URLSearchParams(w.location.search).get('modo'); } catch (e) {}
    modo = modo || dato('modo') || 'marca';
    resolverId().then(function (id) {
      return aplicar(id, { plataforma: plataforma, modo: modo }).catch(function (err) {
        if (id !== 'admira') return aplicar('admira', { plataforma: plataforma, modo: modo });
        throw err;
      });
    }).catch(function (err) { if (w.console) console.warn(err); });
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', arrancar); else arrancar();
})(window, document);
