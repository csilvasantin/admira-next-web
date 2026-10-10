/* demo.js · página admiranext.com/marcablanca
   Pinta las maquetas de las 4 plataformas y las viste con MarcaBlanca.aplicar() en su ámbito.
   Las marcas salen del catálogo único (/marcablanca/api/marcas): las cuatro fijas del selector, las
   guardadas después (chips «Del catálogo») y la PROPUESTA de «Tu marca · URL» (propuesta.js), que
   entra por window.MarcaBlancaDemo.mostrar(). */
(function () {
  'use strict';
  var MB = window.MarcaBlanca;
  var PLATAFORMAS = [
    { id: 'studio', nombre: 'Admira.Studio', verbo: 'crea', dominio: 'admira.studio', ruta: '/crear' },
    { id: 'store', nombre: 'Admira.store', verbo: 'distribuye', dominio: 'admira.store', ruta: '/gemelos' },
    { id: 'app', nombre: 'Admira.biz', verbo: 'comercializa', dominio: 'admira.biz', ruta: '/' },
    { id: 'yokup', nombre: 'Admira.app', verbo: 'mantiene', dominio: 'admira.app', ruta: '/incidencias' }
  ];
  var CLIENTES = ['lumbre', 'brumelle', 'frescaria', 'admira'];
  var ID_VALIDO = /^[a-z0-9][a-z0-9-]{0,40}$/;
  var MODOS = { marca: 'Modo de la marca', nativo: 'Nativo de cada web', claro: 'Claro', oscuro: 'Oscuro' };

  var MQ = window.MarcaBlancaMaquetas;
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }


  /* ── Estado de la página ───────────────────────────────────────────────── */
  var q = new URLSearchParams(location.search);
  try {
    var ql = q.get('lang') || '';
    if (/^en/i.test(ql)) document.documentElement.lang = 'en';
    else if (/^es/i.test(ql)) document.documentElement.lang = 'es';
  } catch (eLang) {}
  function idioma() { return /^en/i.test(document.documentElement.lang || '') ? 'en' : 'es'; }
  function tr(es, en) { return idioma() === 'en' ? en : es; }
  var estadoPagina = {
    marca: ID_VALIDO.test(q.get('marca') || '') ? q.get('marca') : 'lumbre',
    modo: MODOS[q.get('modo')] ? q.get('modo') : 'marca',
    propuesta: false
  };

  /* ── Competidores directos nunca se mezclan ─────────────────────────────
   * Abierta con ?marca=<id>, la página no ofrece a su rival en ningún selector: el catálogo
   * (/marcablanca/api/marcas) llega ya sin él tanto a los chips «Del catálogo» como al panel
   * prospect, que lo pide por su cuenta (este script corre antes que su módulo). */
  var RIVALES = { jti: ['altadis'], altadis: ['jti'] };
  var rivales = RIVALES[(q.get('marca') || '').toLowerCase()] || [];
  if (rivales.length && window.fetch) {
    var fetchOriginal = window.fetch.bind(window);
    window.fetch = function (entrada, opciones) {
      var promesa = fetchOriginal(entrada, opciones);
      var ruta = '';
      try { ruta = new URL(typeof entrada === 'string' ? entrada : (entrada && entrada.url) || '', location.href).pathname; } catch (e) { return promesa; }
      if (!/^\/marcablanca\/api\/marcas\/?$/.test(ruta)) return promesa;
      return promesa.then(function (r) {
        if (!r.ok) return r;
        return r.clone().json().then(function (cuerpo) {
          ['clientes', 'marcas'].forEach(function (k) {
            if (Array.isArray(cuerpo[k])) cuerpo[k] = cuerpo[k].filter(function (c) { return !c || rivales.indexOf(c.id) === -1; });
          });
          return new Response(JSON.stringify(cuerpo), { status: r.status, statusText: r.statusText, headers: r.headers });
        }).catch(function () { return r; });
      });
    };
  }

  function url(p, id) { return (id === 'admira' ? '' : id + '.') + p.dominio + p.ruta; }

  function pintarMaquetas(m) {
    var cont = document.getElementById('maquetas');
    cont.setAttribute('aria-busy', 'true');
    var trabajos = PLATAFORMAS.map(function (p) {
      var art = cont.querySelector('[data-plataforma="' + p.id + '"]');
      art.querySelector('.mk-url').textContent = url(p, m.id);
      var scope = art.querySelector('.mk-scope');
      scope.innerHTML = MQ.pintar(p.id, m);
      return MB.aplicar(m.id, { objetivo: scope, plataforma: p.id, modo: estadoPagina.modo }).then(function (r) {
        art.querySelector('.mk-modo').textContent = r.modo;
      });
    });
    return Promise.all(trabajos).then(function () { cont.removeAttribute('aria-busy'); cont.setAttribute('data-listo', m.id); });
  }

  function pintarFicha(m) {
    var ficha = document.getElementById('ficha');
    var modoFicha = estadoPagina.modo === 'claro' || estadoPagina.modo === 'oscuro' ? estadoPagina.modo : 'marca';
    return MB.variables(m.id, { modo: modoFicha }).then(function (v) {
      var modo = (m.colores[modoFicha] ? modoFicha : m.modo);
      var pal = m.colores[modo] || {};
      var sw = Object.keys(pal).map(function (k) {
        return '<div class="sw"><i style="background:' + esc(pal[k]) + '"></i><b>' + esc(k) + '</b><code>' + esc(pal[k]) + '</code></div>';
      }).join('');
      var t = m.tipografia, r = m.radios, s = m.sombras, tono = m.tono;
      document.getElementById('fichaNombre').textContent = m.nombre;
      ficha.innerHTML =
        '<div class="fx-col fx-wide"><h3>' + tr('Colores · modo ', 'Colors · mode ') + esc(modo) + '</h3><div class="sws">' + sw + '</div></div>' +
        '<div class="fx-col"><h3>' + tr('Tipografía', 'Typography') + '</h3>' +
          '<div class="fx-type" style="font-family:' + esc(t.titulos) + ';font-weight:' + esc(t.pesoTitulos) + ';text-transform:' + esc(t.transformTitulos || 'none') + ';letter-spacing:' + esc(t.trackingTitulos || 'normal') + '">' + esc(m.demo.titular) + '</div>' +
          '<div class="fx-body" style="font-family:' + esc(t.texto) + '">' + esc(m.descripcion) + '</div>' +
          '<dl class="fx-dl"><dt>' + tr('Títulos', 'Headings') + '</dt><dd>' + esc(t.titulos.split(',')[0].replace(/'/g, '')) + ' · ' + esc(t.pesoTitulos) + '</dd><dt>' + tr('Texto', 'Text') + '</dt><dd>' + esc(t.texto.split(',')[0].replace(/'/g, '')) + '</dd>' +
          '<dt>' + tr('Radios', 'Radii') + '</dt><dd>' + esc(r.sm) + ' · ' + esc(r.md) + ' · ' + esc(r.lg) + ' · ' + tr('botón', 'button') + ' ' + esc(r.boton) + '</dd><dt>' + tr('Sombras', 'Shadows') + '</dt><dd>' + (s.md === 'none' ? tr('ninguna (plano)', 'none (flat)') : tr('suaves, 3 niveles', 'soft, 3 levels')) + '</dd>' +
          '<dt>' + tr('Modo', 'Mode') + '</dt><dd>' + esc(m.modo) + tr(' por defecto · ', ' by default · ') + Object.keys(m.colores).join(tr(' y ', ' and ')) + '</dd></dl></div>' +
        '<div class="fx-col"><h3>' + tr('Logo, favicon y tono', 'Logo, favicon and tone') + '</h3>' +
          '<div class="fx-logo"><span class="mb-logo" data-mb-logo></span><img src="' + esc(m.favicon) + '" alt="favicon ' + esc(m.nombre) + '" width="40" height="40"></div>' +
          '<p class="fx-voz">' + esc(tono.voz) + '</p>' +
          '<div class="fx-words"><span>' + tr('Sí:', 'Yes:') + '</span> ' + tono.si.map(function (w) { return '<em>' + esc(w) + '</em>'; }).join(' ') + '</div>' +
          '<div class="fx-words no"><span>' + tr('No:', 'No:') + '</span> ' + tono.no.map(function (w) { return '<em>' + esc(w) + '</em>'; }).join(' ') + '</div>' +
          '<ul class="fx-frases"><li><b>CTA</b> «' + esc(tono.frases.cta) + '»</li><li><b>' + tr('Vacío', 'Empty') + '</b> «' + esc(tono.frases.vacio) + '»</li><li><b>' + tr('Error', 'Error') + '</b> «' + esc(tono.frases.error) + '»</li></ul>' +
          (estadoPagina.propuesta ? '<span class="fx-json">propuesta sin guardar · «Descargar JSON» arriba</span>' :
            '<a class="fx-json" href="/marcablanca/api/marcas/' + esc(m.id) + '" target="_blank" rel="noopener">api/marcas/' + esc(m.id) + ' ↗</a>') + '</div>';
      var comp = document.getElementById('componentes');
      comp.innerHTML =
        '<div class="cp-row"><span class="mb-btn mb-btn--primario" data-mb-frase="cta">CTA</span><span class="mb-btn mb-btn--secundario">Secundario</span>' +
        '<span class="mb-btn mb-btn--acento">Acento</span><span class="mb-btn mb-btn--borde">Borde</span><span class="mb-btn mb-btn--fantasma">Fantasma</span></div>' +
        '<div class="cp-row"><span class="mb-estado mb-estado--ok">En vivo</span><span class="mb-estado mb-estado--aviso">En curso</span><span class="mb-estado mb-estado--error">Caída</span>' +
        '<span class="mb-estado mb-estado--info">Programada</span><span class="mb-chip mb-chip--on">Filtro activo</span><span class="mb-chip">Filtro</span></div>' +
        '<div class="cp-grid"><div class="mb-card"><div class="mb-eyebrow">Tarjeta</div><h4 class="mb-titulo">' + esc(m.demo.producto) + '</h4><p>' + esc(m.tono.frases.exito) + '</p></div>' +
        '<div class="mb-card mb-card--alt"><div class="mb-eyebrow">Formulario</div><input class="mb-input" placeholder="Buscar tienda…" aria-label="Buscar tienda"><select class="mb-select" aria-label="Prioridad"><option>Prioridad alta</option></select></div></div>';
      return Promise.all([
        MB.aplicar(m.id, { objetivo: ficha, modo: modoFicha }),
        MB.aplicar(m.id, { objetivo: comp, modo: modoFicha })
      ]);
    });
  }

  function marcarBotones() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-elegir]'), function (b) {
      b.setAttribute('aria-pressed', String(!estadoPagina.propuesta && b.getAttribute('data-elegir') === estadoPagina.marca));
    });
    var url = document.querySelector('.sel--url');
    if (url) url.setAttribute('data-activa', String(estadoPagina.propuesta));
    Array.prototype.forEach.call(document.querySelectorAll('[data-modo]'), function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-modo') === estadoPagina.modo));
    });
  }

  function render(empujar) {
    marcarBotones();
    if (empujar && !estadoPagina.propuesta) {
      var u = new URL(location.href);
      u.searchParams.set('marca', estadoPagina.marca);
      u.searchParams.delete('web');
      if (estadoPagina.modo === 'marca') u.searchParams.delete('modo'); else u.searchParams.set('modo', estadoPagina.modo);
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    }
    return MB.cargar(estadoPagina.marca).then(function (m) {
      document.getElementById('resumenNombre').textContent = m.nombre;
      document.getElementById('resumenSector').textContent = m.sector;
      document.getElementById('resumenDesc').textContent = m.descripcion;
      var sello = document.getElementById('resumenSello');
      var propuesta = estadoPagina.propuesta || (m.catalogo && m.catalogo.propuesta);
      sello.hidden = !m.ejemplo && !propuesta;
      sello.textContent = propuesta ? tr('Propuesta automática · no es la marca oficial', 'Automatic proposal · not the official brand') : tr('Cliente de ejemplo · marca ficticia', 'Example client · fictional brand');
      return Promise.all([pintarMaquetas(m), pintarFicha(m)]);
    }).catch(function (e) {
      // Un ?marca= que no existe (o que ya no está en el catálogo) vuelve al ejemplo de siempre.
      if (!estadoPagina.propuesta && estadoPagina.marca !== 'lumbre') { estadoPagina.marca = 'lumbre'; return render(true); }
      document.getElementById('maquetas').setAttribute('data-error', String(e && e.message || e));
    });
  }

  /* ── Marcas guardadas en el catálogo después (no son las cuatro fijas) ──── */
  function pintarCatalogo() {
    var cont = document.getElementById('catalogoExtra');
    if (!cont || !MB.listar) return;
    MB.listar().then(function (lista) {
      var extra = lista.filter(function (c) { return CLIENTES.indexOf(c.id) === -1; });
      if (!extra.length) { cont.hidden = true; return; }
      cont.hidden = false;
      cont.innerHTML = '<span class="cat-tit">' + tr('Del catálogo', 'From the catalog') + '</span>' + extra.map(function (c) {
        var tipo = c.catalogo && c.catalogo.propuesta ? 'propuesta' : (c.ejemplo ? 'ejemplo' : 'real');
        return '<button type="button" class="cat-chip" data-elegir="' + esc(c.id) + '" aria-pressed="false"><b>' + esc(c.nombre) + '</b><small>' + esc(tipo) + '</small></button>';
      }).join('');
      Array.prototype.forEach.call(cont.querySelectorAll('[data-elegir]'), function (b) {
        b.addEventListener('click', function () { estadoPagina.marca = b.getAttribute('data-elegir'); estadoPagina.propuesta = false; render(true); });
      });
      marcarBotones();
    }).catch(function () { cont.hidden = true; });
  }

  function iniciar() {
    // Logos del selector: cada botón se viste con su propia marca.
    Array.prototype.forEach.call(document.querySelectorAll('[data-elegir]'), function (b) {
      MB.aplicar(b.getAttribute('data-elegir'), { objetivo: b.querySelector('.sel-logo'), modo: 'oscuro' });
      b.addEventListener('click', function () { estadoPagina.marca = b.getAttribute('data-elegir'); estadoPagina.propuesta = false; render(true); });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-modo]'), function (b) {
      b.addEventListener('click', function () { estadoPagina.modo = b.getAttribute('data-modo'); render(true); });
    });
    pintarCatalogo();
    render(false);
  }

  /* API para propuesta.js: enseña en las maquetas una marca ya registrada (MB.registrar). */
  window.MarcaBlancaDemo = {
    mostrar: function (id, o) {
      estadoPagina.marca = id;
      estadoPagina.propuesta = Boolean(o && o.propuesta);
      return render(Boolean(o && o.empujar));
    },
    catalogo: function () { if (MB.refrescar) MB.refrescar(); pintarCatalogo(); },
    estado: function () { return { marca: estadoPagina.marca, modo: estadoPagina.modo, propuesta: estadoPagina.propuesta }; }
  };
  window.addEventListener('admira:languagechange', function (ev) {
    var l = ev && ev.detail && ev.detail.lang;
    if (l === 'en' || l === 'es') document.documentElement.lang = l;
    if (window.MarcaBlanca) render(false);
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
