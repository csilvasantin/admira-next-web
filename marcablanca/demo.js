/* demo.js · página admiranext.com/marcablanca
   Pinta las maquetas de las 4 plataformas y las viste con MarcaBlanca.aplicar() en su ámbito. */
(function () {
  'use strict';
  var MB = window.MarcaBlanca;
  var PLATAFORMAS = [
    { id: 'studio', nombre: 'Admira.Studio', verbo: 'crea', dominio: 'admira.studio', ruta: '/crear' },
    { id: 'store', nombre: 'Admira.store', verbo: 'distribuye', dominio: 'admira.store', ruta: '/gemelos' },
    { id: 'app', nombre: 'Admira.app', verbo: 'comercializa', dominio: 'admira.app', ruta: '/' },
    { id: 'yokup', nombre: 'yokup.com', verbo: 'mantiene', dominio: 'yokup.com', ruta: '/incidencias' }
  ];
  var CLIENTES = ['lumbre', 'brumelle', 'frescaria', 'admira'];
  var MODOS = { marca: 'Modo de la marca', nativo: 'Nativo de cada web', claro: 'Claro', oscuro: 'Oscuro' };

  var MQ = window.MarcaBlancaMaquetas;
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }


  /* ── Estado de la página ───────────────────────────────────────────────── */
  var q = new URLSearchParams(location.search);
  var estadoPagina = {
    marca: CLIENTES.indexOf(q.get('marca')) !== -1 ? q.get('marca') : 'lumbre',
    modo: MODOS[q.get('modo')] ? q.get('modo') : 'marca'
  };

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
        '<div class="fx-col fx-wide"><h3>Colores · modo ' + esc(modo) + '</h3><div class="sws">' + sw + '</div></div>' +
        '<div class="fx-col"><h3>Tipografía</h3>' +
          '<div class="fx-type" style="font-family:' + esc(t.titulos) + ';font-weight:' + esc(t.pesoTitulos) + ';text-transform:' + esc(t.transformTitulos || 'none') + ';letter-spacing:' + esc(t.trackingTitulos || 'normal') + '">' + esc(m.demo.titular) + '</div>' +
          '<div class="fx-body" style="font-family:' + esc(t.texto) + '">' + esc(m.descripcion) + '</div>' +
          '<dl class="fx-dl"><dt>Títulos</dt><dd>' + esc(t.titulos.split(',')[0].replace(/'/g, '')) + ' · ' + esc(t.pesoTitulos) + '</dd><dt>Texto</dt><dd>' + esc(t.texto.split(',')[0].replace(/'/g, '')) + '</dd>' +
          '<dt>Radios</dt><dd>' + esc(r.sm) + ' · ' + esc(r.md) + ' · ' + esc(r.lg) + ' · botón ' + esc(r.boton) + '</dd><dt>Sombras</dt><dd>' + (s.md === 'none' ? 'ninguna (plano)' : 'suaves, 3 niveles') + '</dd>' +
          '<dt>Modo</dt><dd>' + esc(m.modo) + ' por defecto · ' + Object.keys(m.colores).join(' y ') + '</dd></dl></div>' +
        '<div class="fx-col"><h3>Logo, favicon y tono</h3>' +
          '<div class="fx-logo"><span class="mb-logo" data-mb-logo></span><img src="' + esc(m.favicon) + '" alt="favicon de ' + esc(m.nombre) + '" width="40" height="40"></div>' +
          '<p class="fx-voz">' + esc(tono.voz) + '</p>' +
          '<div class="fx-words"><span>Sí:</span> ' + tono.si.map(function (w) { return '<em>' + esc(w) + '</em>'; }).join(' ') + '</div>' +
          '<div class="fx-words no"><span>No:</span> ' + tono.no.map(function (w) { return '<em>' + esc(w) + '</em>'; }).join(' ') + '</div>' +
          '<ul class="fx-frases"><li><b>CTA</b> «' + esc(tono.frases.cta) + '»</li><li><b>Vacío</b> «' + esc(tono.frases.vacio) + '»</li><li><b>Error</b> «' + esc(tono.frases.error) + '»</li></ul>' +
          '<a class="fx-json" href="clientes/' + esc(m.id) + '.json" target="_blank" rel="noopener">clientes/' + esc(m.id) + '.json ↗</a></div>';
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
      b.setAttribute('aria-pressed', String(b.getAttribute('data-elegir') === estadoPagina.marca));
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-modo]'), function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-modo') === estadoPagina.modo));
    });
  }

  function render(empujar) {
    marcarBotones();
    if (empujar) {
      var u = new URL(location.href);
      u.searchParams.set('marca', estadoPagina.marca);
      if (estadoPagina.modo === 'marca') u.searchParams.delete('modo'); else u.searchParams.set('modo', estadoPagina.modo);
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    }
    return MB.cargar(estadoPagina.marca).then(function (m) {
      document.getElementById('resumenNombre').textContent = m.nombre;
      document.getElementById('resumenSector').textContent = m.sector;
      document.getElementById('resumenDesc').textContent = m.descripcion;
      document.getElementById('resumenSello').hidden = !m.ejemplo;
      return Promise.all([pintarMaquetas(m), pintarFicha(m)]);
    }).catch(function (e) {
      document.getElementById('maquetas').setAttribute('data-error', String(e && e.message || e));
    });
  }

  function iniciar() {
    // Logos del selector: cada botón se viste con su propia marca.
    Array.prototype.forEach.call(document.querySelectorAll('[data-elegir]'), function (b) {
      MB.aplicar(b.getAttribute('data-elegir'), { objetivo: b.querySelector('.sel-logo'), modo: 'oscuro' });
      b.addEventListener('click', function () { estadoPagina.marca = b.getAttribute('data-elegir'); render(true); });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-modo]'), function (b) {
      b.addEventListener('click', function () { estadoPagina.modo = b.getAttribute('data-modo'); render(true); });
    });
    render(false);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
