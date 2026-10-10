/* Visor 600×600. Una tarjeta. Flechas y Enter. /marca y /idioma. Sin vídeo. */
(function () {
  'use strict';

  var PALETA = {
    frescaria: { nombre: 'Frescaria Supermercados', texto: '#EEF2FF', acento: '#3DDC97' },
    lumbre: { nombre: 'Lumbre Café', texto: '#F7ECDF', acento: '#E0703A' },
    brumelle: { nombre: 'BRUMELLE', texto: '#F6F1E8', acento: '#E7C27A' }
  };

  var estado = { ahora: null, siguiente: null, promo: null };
  var carta = 'ahora';
  var botones = [];

  function esDemo() {
    return document.body.dataset.demo === 'frescaria';
  }

  function pintarMarca(id, nombre) {
    var pal = PALETA[id] || null;
    var raiz = document.documentElement;
    raiz.style.setProperty('--visor-texto', (pal && pal.texto) || '#F4F7FF');
    raiz.style.setProperty('--visor-acento', (pal && pal.acento) || '#9EB6FF');
    raiz.style.background = '#000';
    var nodo = document.getElementById('marca');
    if (nodo) nodo.textContent = nombre || (pal && pal.nombre) || '';
  }

  function poner(idCarta, es, en, detalleEs, detalleEn) {
    estado[idCarta] = { es: es, en: en, detalleEs: detalleEs, detalleEn: detalleEn };
  }

  function mostrar(id) {
    carta = id;
    var dato = estado[id] || { es: 'Esperando contenido', en: 'Waiting for content', detalleEs: '', detalleEn: '' };
    var titulo = document.getElementById('titulo');
    var detalle = document.getElementById('detalle');
    var kicker = document.getElementById('kicker');
    titulo.querySelector('[data-l="es"]').textContent = dato.es;
    titulo.querySelector('[data-l="en"]').textContent = dato.en;
    titulo.classList.toggle('vacio', dato.es === 'Esperando contenido');
    detalle.querySelector('[data-l="es"]').textContent = dato.detalleEs;
    detalle.querySelector('[data-l="en"]').textContent = dato.detalleEn;
    var etiquetas = {
      ahora: ['Ahora en pantalla', 'Now on screen'],
      siguiente: ['Siguiente', 'Next'],
      promo: ['Promo', 'Promo']
    };
    kicker.querySelector('[data-l="es"]').textContent = etiquetas[id][0];
    kicker.querySelector('[data-l="en"]').textContent = etiquetas[id][1];
    botones.forEach(function (b) {
      var activo = b.dataset.carta === id;
      b.classList.toggle('focused', activo);
      if (activo) b.focus();
    });
  }

  function nota(es, en) {
    var nodo = document.getElementById('aviso');
    if (!nodo) return;
    var a = nodo.querySelector('[data-l="es"]');
    var b = nodo.querySelector('[data-l="en"]');
    if (a && b) {
      a.textContent = es || '';
      b.textContent = en || es || '';
    } else nodo.textContent = es || '';
    nodo.classList.toggle('hay', !!(es || en));
  }

  function aviso(texto) {
    nota(texto, texto);
  }

  function pieza(item) {
    if (!item) return null;
    var tipo = String(item.assetType || item.type || '').toLowerCase();
    if (tipo === 'video' || tipo === 'animation') return null;
    var titulo = String(item.title || item.es || 'Pieza').trim();
    return { es: titulo, en: titulo, detalleEs: String(item.sub || ''), detalleEn: String(item.sub || '') };
  }

  function cargarDemo() {
    return fetch('/pruebas/visor/demo.json', { cache: 'force-cache' }).then(function (r) { return r.json(); }).then(function (d) {
      poner('ahora', d.ahora.es, d.ahora.en, d.ahora.detalleEs, d.ahora.detalleEn);
      poner('siguiente', d.siguiente.es, d.siguiente.en, d.siguiente.detalleEs, d.siguiente.detalleEn);
      poner('promo', d.promo.es, d.promo.en, d.promo.detalleEs, d.promo.detalleEn);
      pintarMarca(d.marca, d.nombre);
      mostrar('ahora');
    });
  }

  async function cargarVivo() {
    var q = new URLSearchParams(location.search);
    var screen = q.get('screen') || 'virtual-frescaria';
    var notas = [];
    var items = [];
    try {
      var pr = await fetch('https://admira.tv/api/playlist?screen=' + encodeURIComponent(screen), { cache: 'no-store' });
      if (!pr.ok) notas.push('playlist ' + pr.status);
      else {
        var pd = await pr.json();
        items = (pd.draft && pd.draft.items) || [];
      }
    } catch (e) {
      notas.push('playlist sin CORS para este origen');
    }
    var utiles = items.map(pieza).filter(Boolean);
    if (utiles[0]) poner('ahora', utiles[0].es, utiles[0].en, utiles[0].detalleEs, utiles[0].detalleEn);
    else poner('ahora', 'Esperando contenido', 'Waiting for content', 'Pantalla ' + screen, 'Screen ' + screen);
    if (utiles[1]) poner('siguiente', utiles[1].es, utiles[1].en, utiles[1].detalleEs, utiles[1].detalleEn);
    else poner('siguiente', 'Sin siguiente', 'No next piece', '', '');

    try {
      var sr = await fetch('https://stock.admira.store/stock/index.json', { cache: 'no-store' });
      if (!sr.ok) notas.push('stock ' + sr.status);
      else {
        var sd = await sr.json();
        var lista = sd.items || [];
        var pequena = lista.find(function (it) {
          return String(it.mime || '').indexOf('image/') === 0 && Number(it.ancho) > 0 && Number(it.ancho) <= 600 && Number(it.alto) > 0 && Number(it.alto) <= 600;
        });
        var alguna = lista.find(function (it) { return String(it.mime || '').indexOf('image/') === 0 && it.title; });
        if (pequena) {
          poner('promo', pequena.title, pequena.title, pequena.ancho + '×' + pequena.alto, pequena.ancho + '×' + pequena.alto);
        } else if (alguna) {
          poner('promo', alguna.title, alguna.title, 'Sin imagen: pasa de 600 px o no declara tamaño.', 'No image: over 600 px or size unknown.');
        } else {
          poner('promo', 'Sin promo', 'No promo', '', '');
        }
      }
    } catch (e) {
      notas.push('stock no disponible');
      poner('promo', 'Sin promo', 'No promo', '', '');
    }
    aviso(notas.join(' · '));
    var marca = q.get('marca');
    if (marca) aplicarMarca(marca);
    mostrar('ahora');
  }

  function aplicarMarca(id) {
    id = String(id || '').trim().toLowerCase();
    if (!id || id === 'off' || id === 'admira' || id === 'none') {
      pintarMarca('', '');
      return;
    }
    if (PALETA[id]) {
      pintarMarca(id, PALETA[id].nombre);
      return;
    }
    fetch('/marcablanca/api/marcas/' + encodeURIComponent(id), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (m) {
        if (!m) return;
        var osc = (m.colores && (m.colores.oscuro || m.colores.claro)) || {};
        PALETA[id] = { nombre: m.nombre || id, texto: osc.texto || '#F4F7FF', acento: osc.acento || '#9EB6FF' };
        pintarMarca(id, PALETA[id].nombre);
      })
      .catch(function () {});
  }

  function irDemo() {
    if (esDemo()) return;
    location.assign('/pruebas/visor/demo/' + location.search);
  }

  function interpretar(texto) {
    var t = String(texto || '').trim();
    if (/^\/(ayuda|help)\s*$/i.test(t)) {
      nota('/marca · /idioma · /demo', '/brand · /language · /demo');
      return;
    }
    if (/^\/demo\b/i.test(t)) {
      irDemo();
      return;
    }
    var m = t.match(/^\/(marca|brand|idioma|language)\s*(.*)$/i);
    if (!m) return;
    var verbo = m[1].toLowerCase();
    var arg = (m[2] || '').trim();
    if (verbo === 'idioma' || verbo === 'language') {
      var lang = /^en/i.test(arg) ? 'en' : 'es';
      if (typeof window.setLanguage === 'function') window.setLanguage(lang);
    } else {
      aplicarMarca(arg || 'frescaria');
    }
  }

  function indiceDe(el) {
    return botones.indexOf(el);
  }

  var buffer = '';

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { buffer = ''; return; }
    if (e.key === 'Enter' && buffer) {
      interpretar(buffer);
      buffer = '';
      e.preventDefault();
      return;
    }
    if (e.key === '/' && !buffer) {
      buffer = '/';
      e.preventDefault();
      return;
    }
    if (buffer && e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      buffer += e.key;
      e.preventDefault();
      return;
    }
    if (buffer) return;
    var lista = botones.slice();
    var gafas = document.getElementById('btnGafas');
    if (gafas && !gafas.hidden) lista.push(gafas);
    var actual = lista.indexOf(document.activeElement);
    if (actual < 0) actual = botones.findIndex(function (b) { return b.dataset.carta === carta; });
    if (actual < 0) actual = 0;
    function ir(el) {
      if (el && el.dataset && el.dataset.carta) mostrar(el.dataset.carta);
      else if (el) el.focus();
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      ir(lista[(actual + 1) % lista.length]);
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      ir(lista[(actual - 1 + lista.length) % lista.length]);
      e.preventDefault();
    } else if (e.key === 'Enter' && document.activeElement && document.activeElement.dataset.carta) {
      mostrar(document.activeElement.dataset.carta);
      e.preventDefault();
    }
  });

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-carta]');
    if (b) mostrar(b.dataset.carta);
  });

  window.addEventListener('admira:marca', function (ev) {
    var d = ev.detail || {};
    if (!d || !d.id) pintarMarca('', '');
    else aplicarMarca(d.id);
  });

  botones = Array.prototype.slice.call(document.querySelectorAll('[data-carta]'));
  var btnGafas = document.getElementById('btnGafas');
  if (btnGafas && typeof navigator.install === 'function') {
    btnGafas.hidden = false;
    document.body.classList.add('con-instalar');
    btnGafas.addEventListener('click', function () {
      var url = location.href;
      try {
        Promise.resolve(navigator.install(url, { name: 'Admira Visor' })).catch(function () {
          nota('No se pudo añadir a las gafas.', 'Could not add to the glasses.');
        });
      } catch (err) {
        nota('No se pudo añadir a las gafas.', 'Could not add to the glasses.');
      }
    });
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/pruebas/visor/sw.js', { scope: '/pruebas/visor/' }).catch(function () {});
  }
  function enfocarPrimero() {
    var b = document.getElementById('btnAhora') || botones[0];
    if (!b) return;
    botones.forEach(function (x) { x.classList.toggle('focused', x === b); });
    b.focus();
  }
  enfocarPrimero();
  var params = new URLSearchParams(location.search);
  if (params.get('demo') && !esDemo()) irDemo();
  else if (esDemo()) {
    cargarDemo().then(function () {
      if (params.get('marca')) aplicarMarca(params.get('marca'));
    });
  } else {
    cargarVivo();
    if (params.get('marca')) aplicarMarca(params.get('marca'));
  }
})();
