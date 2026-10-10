/* Visor 600×600. La tarjeta Ahora enseña la foto y recorre la playlist. Sin vídeo. */
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
  var lista = [];
  var indice = 0;
  var reloj = 0;
  var marcaFijada = false;
  var generacion = 0;

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

  function syncFoto() {
    var foto = document.getElementById('foto');
    var clip = document.getElementById('clip');
    var pos = document.getElementById('pos');
    var piezaActual = lista[indice];
    var verImg = carta === 'ahora' && piezaActual && piezaActual.tipo === 'image' && piezaActual.url;
    var verVid = carta === 'ahora' && piezaActual && piezaActual.tipo === 'video' && piezaActual.url;
    var gen = generacion;
    document.body.classList.toggle('con-foto', !!(verImg || verVid));
    document.body.classList.toggle('con-video', !!verVid);
    if (foto) {
      if (verImg) {
        if (foto.getAttribute('src') !== piezaActual.url) foto.src = piezaActual.url;
        foto.alt = piezaActual.es;
        foto.hidden = false;
      } else {
        foto.hidden = true;
        foto.removeAttribute('src');
      }
    }
    if (clip) {
      clip.onended = null;
      clip.onerror = null;
      if (verVid) {
        clip.muted = true;
        clip.defaultMuted = true;
        clip.playsInline = true;
        clip.autoplay = true;
        if (clip.getAttribute('src') !== piezaActual.url) {
          clip.src = piezaActual.url;
          clip.load();
        }
        clip.hidden = false;
        clip.onended = function () {
          if (gen !== generacion || lista[indice] !== piezaActual) return;
          pararReloj();
          ensenar(indice + 1);
        };
        clip.onerror = function () {
          if (gen !== generacion) return;
          clip.hidden = true;
          document.body.classList.remove('con-foto');
          document.body.classList.remove('con-video');
        };
        var juego = clip.play();
        if (juego && juego.catch) juego.catch(function () {});
      } else {
        try { clip.pause(); } catch (e) {}
        clip.hidden = true;
        clip.removeAttribute('src');
      }
    }
    if (pos) pos.textContent = ((verImg || verVid) && lista.length) ? ((indice + 1) + '/' + lista.length) : '';
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
    detalle.classList.toggle('suave', dato.es === 'Esperando contenido');
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
    syncFoto();
  }

  function nota(es, en) {
    var nodo = document.getElementById('nota');
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

  function nombreLegible(pd, screen) {
    var slug = String(screen || '').trim().toLowerCase();
    var draft = (pd && pd.draft) || {};
    var pl = draft.playlist;
    var fuentes = [];
    if (pl && typeof pl === 'object') fuentes.push(pl.name, pl.title, pl.nombre, pl.label);
    fuentes.push(draft.name, draft.title, draft.nombre, draft.label);
    for (var i = 0; i < fuentes.length; i++) {
      var n = String(fuentes[i] || '').trim();
      if (!n || n.toLowerCase() === slug) continue;
      if (!/\s/.test(n) && /virtual-|screen-|pantalla-/.test(n.toLowerCase())) continue;
      return n;
    }
    return '';
  }

  function duracion(item) {
    var n = Number(item && item.seconds);
    if (!isFinite(n) || n < 3 || n > 180) return 10;
    return n;
  }

  function medioDe(item) {
    var asset = String((item && item.asset) || '');
    if (asset.indexOf('https://stock.admira.store/') !== 0) return null;
    if (asset.indexOf('..') >= 0 || asset.indexOf('@') >= 0) return null;
    var tipo = String(item.assetType || item.type || '').toLowerCase();
    if (tipo === 'animation') return null;
    if (tipo === 'video') return { tipo: 'video', url: '/pruebas/visor/vid?src=' + encodeURIComponent(asset) };
    if (tipo && tipo !== 'image') return null;
    return { tipo: 'image', url: '/pruebas/visor/img?src=' + encodeURIComponent(asset) };
  }

  function pieza(item) {
    if (!item) return null;
    var medio = medioDe(item);
    if (!medio) return null;
    var titulo = String(item.title || item.es || 'Pieza').trim();
    return {
      es: titulo,
      en: titulo,
      detalleEs: String(item.sub || ''),
      detalleEn: String(item.sub || ''),
      tipo: medio.tipo,
      url: medio.url,
      segundos: duracion(item)
    };
  }

  function pararReloj() {
    if (reloj) clearTimeout(reloj);
    reloj = 0;
  }

  function ensenar(i) {
    generacion += 1;
    if (!lista.length) {
      pararReloj();
      indice = 0;
      poner('ahora', 'Esperando contenido', 'Waiting for content', 'Pantalla sin asignar', 'Unassigned screen');
      poner('siguiente', 'Sin siguiente', 'No next piece', '', '');
      poner('promo', 'Sin promo', 'No promo', '', '');
      mostrar('ahora');
      return;
    }
    indice = ((i % lista.length) + lista.length) % lista.length;
    var actual = lista[indice];
    var sig = lista[(indice + 1) % lista.length];
    poner('ahora', actual.es, actual.en, actual.detalleEs, actual.detalleEn);
    if (lista.length > 1) poner('siguiente', sig.es, sig.en, sig.detalleEs, sig.detalleEn);
    else poner('siguiente', 'Sin siguiente', 'No next piece', '', '');
    poner('promo', lista.length + ' piezas', lista.length + ' pieces', '', '');
    if (!marcaFijada) pintarMarca('', '');
    mostrar('ahora');
    pararReloj();
    var espera = actual.tipo === 'video' ? (actual.segundos + 2) * 1000 : actual.segundos * 1000;
    reloj = setTimeout(function () { ensenar(indice + 1); }, espera);
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
    var legible = '';
    try {
      var pr = await fetch('https://admira.tv/api/playlist?screen=' + encodeURIComponent(screen), { cache: 'no-store' });
      if (!pr.ok) notas.push('playlist ' + pr.status);
      else {
        var pd = await pr.json();
        items = (pd.draft && pd.draft.items) || [];
        legible = nombreLegible(pd, screen);
      }
    } catch (e) {
      notas.push('playlist sin CORS para este origen');
    }
    lista = items.map(pieza).filter(Boolean);
    aviso(notas.join(' · '));
    if (q.get('marca')) aplicarMarca(q.get('marca'));
    if (!lista.length) {
      poner('ahora', 'Esperando contenido', 'Waiting for content', legible || 'Pantalla sin asignar', legible || 'Unassigned screen');
      poner('siguiente', 'Sin siguiente', 'No next piece', '', '');
      poner('promo', 'Sin promo', 'No promo', '', '');
      mostrar('ahora');
      return;
    }
    ensenar(0);
  }

  function aplicarMarca(id) {
    id = String(id || '').trim().toLowerCase();
    if (!id || id === 'off' || id === 'admira' || id === 'none') {
      marcaFijada = false;
      pintarMarca('', '');
      return;
    }
    marcaFijada = true;
    if (PALETA[id]) {
      pintarMarca(id, PALETA[id].nombre);
      return;
    }
    fetch('/marcablanca/api/marcas/' + encodeURIComponent(id), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (m) {
        if (!m || !marcaFijada) return;
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

  var buffer = '';

  function actuar(el) {
    if (el && el.dataset && el.dataset.carta === 'siguiente' && lista.length) {
      ensenar(indice + 1);
      return;
    }
    if (el && el.dataset && el.dataset.carta) mostrar(el.dataset.carta);
    else if (el) el.focus();
  }

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
    var listaFoco = botones.slice();
    var gafas = document.getElementById('btnGafas');
    if (gafas && !gafas.hidden) listaFoco.push(gafas);
    var actual = listaFoco.indexOf(document.activeElement);
    if (actual < 0) actual = botones.findIndex(function (b) { return b.dataset.carta === carta; });
    if (actual < 0) actual = 0;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      actuar(listaFoco[(actual + 1) % listaFoco.length]);
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      actuar(listaFoco[(actual - 1 + listaFoco.length) % listaFoco.length]);
      e.preventDefault();
    } else if (e.key === 'Enter' && document.activeElement && document.activeElement.dataset.carta) {
      actuar(document.activeElement);
      e.preventDefault();
    }
  });

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-carta]');
    if (b) actuar(b);
  });

  window.addEventListener('admira:marca', function (ev) {
    var d = ev.detail || {};
    if (!d || !d.id) {
      marcaFijada = false;
      pintarMarca('', '');
    } else aplicarMarca(d.id);
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
  }
})();
