/* /roadmap/encargos — ordenar cada tabla al pulsar una cabecera (asc ⇄ desc)
 * y abrir el detalle de la persona al pulsar su fila.
 * Solo se reordena el <tbody>: la fila Total vive en <tfoot> y se queda abajo.
 * El color de la fila sale de Trabajando ahora (admira.live/api/flota/trabajando),
 * releído cada 15 s. La pastilla «en curso» y el detalle salen de Misiones
 * (api.yokup.com/fleet/missions), releídas cada 30 s. */
import { agruparMisiones, claveFila, clavesEnCurso, consultaMisiones, ESTADO_TEXTO } from './misiones-vivas.js?v=20261022-misiones-1';
import { claveTrabajando, normalizarTarjetas, TRABAJANDO_API } from './trabajando-vivo.js?v=20261022-colores-1';

(function () {
  'use strict';
  var ESTADO = ESTADO_TEXTO;
  var panel = document.getElementById('enc-detalle');
  var titulo = document.getElementById('enc-detalle-titulo');
  var vacio = document.getElementById('enc-detalle-vacio');
  var cuerpo = document.querySelector('#enc-detalle-tabla tbody');
  var datosEl = document.getElementById('enc-datos');
  var datos = {};
  try { datos = JSON.parse((datosEl && datosEl.textContent) || '{}'); } catch (e) { datos = {}; }
  var abierta = null;
  var vivas = null;
  var aviso = document.getElementById('enc-vivo');
  var avisoTrab = document.getElementById('enc-trab');
  var ESTADOS_FILA = ['verde', 'amarillo', 'rojo', 'gris'];

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function cerrar() {
    if (abierta) {
      abierta.classList.remove('enc-abierta');
      abierta.setAttribute('aria-expanded', 'false');
      abierta = null;
    }
    if (panel) panel.hidden = true;
  }

  function rellenar(tr, scroll) {
    var id = tr.getAttribute('data-persona');
    var nombre = tr.getAttribute('data-orden') || id;
    var lista = vivas ? (vivas[claveFila(id)] || []) : (datos[id] || []);
    if (titulo) titulo.textContent = (vivas ? 'Misiones de ' : 'Encargos de ') + nombre;
    if (cuerpo) {
      cuerpo.innerHTML = lista.map(function (e) {
        var curso = e.estado === 'in_progress' ? ' class="enc-activo"' : '';
        var estado = ESTADO[e.estado] || e.estado;
        var num = /^\d+$/.test(String(e.numero)) ? '#' + e.numero : e.numero;
        return '<tr' + curso + '><td>' + esc(num) + '</td><td>' + esc(e.titulo) + '</td><td>' + esc(estado) + '</td><td>' + esc(e.desde) + '</td></tr>';
      }).join('');
    }
    var tabla = document.getElementById('enc-detalle-tabla');
    if (tabla) {
      tabla.hidden = !lista.length;
      if (tabla.parentElement) tabla.parentElement.hidden = !lista.length;
    }
    if (vacio) {
      vacio.hidden = !!lista.length;
      vacio.textContent = lista.length ? '' : (vivas
        ? 'Misiones no tiene ahora ninguna misión en curso ni abierta de ' + nombre + '.'
        : 'Este parte no trae el detalle de los encargos de ' + nombre + '.');
    }
    panel.hidden = false;
    if (scroll) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function abrir(tr) {
    if (!panel || !tr || !tr.hasAttribute('data-persona')) return;
    if (abierta === tr) { cerrar(); return; }
    if (abierta) {
      abierta.classList.remove('enc-abierta');
      abierta.setAttribute('aria-expanded', 'false');
    }
    abierta = tr;
    tr.classList.add('enc-abierta');
    tr.setAttribute('aria-expanded', 'true');
    rellenar(tr, true);
  }

  document.querySelectorAll('table.enc[data-ordenable]').forEach(function (tabla) {
    var ths = Array.prototype.slice.call(tabla.querySelectorAll('thead th'));
    ths.forEach(function (th, i) {
      var b = th.querySelector('button') || th;
      b.addEventListener('click', function () {
        var asc = th.getAttribute('aria-sort') !== 'ascending';
        ths.forEach(function (h) { h.setAttribute('aria-sort', 'none'); });
        th.setAttribute('aria-sort', asc ? 'ascending' : 'descending');
        var num = th.getAttribute('data-t') === 'n';
        var tb = tabla.tBodies[0];
        Array.prototype.slice.call(tb.rows).sort(function (a, b2) {
          var x = i === 0 ? (a.getAttribute('data-orden') || a.cells[i].textContent.trim()) : a.cells[i].textContent.trim();
          var y = i === 0 ? (b2.getAttribute('data-orden') || b2.cells[i].textContent.trim()) : b2.cells[i].textContent.trim();
          var r = num ? (Number(x) - Number(y)) : x.localeCompare(y, 'es');
          if (r === 0) r = (a.getAttribute('data-orden') || '').localeCompare(b2.getAttribute('data-orden') || '', 'es');
          return asc ? r : -r;
        }).forEach(function (r) { tb.appendChild(r); });
      });
    });
    var tb = tabla.tBodies[0];
    if (!tb) return;
    tb.addEventListener('click', function (ev) {
      var tr = ev.target.closest('tr');
      if (tr && tb.contains(tr)) abrir(tr);
    });
    tb.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      var tr = ev.target.closest('tr');
      if (!tr || !tb.contains(tr)) return;
      ev.preventDefault();
      abrir(tr);
    });
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') cerrar();
  });

  function componerTitulo(tr) {
    var partes = [];
    var est = tr.querySelector('.enc-est');
    if (est) {
      var motivo = est.getAttribute('data-motivo');
      partes.push(est.textContent + (motivo ? ' · ' + motivo : ''));
    }
    if (tr.querySelector('.enc-curso')) partes.push('Tiene una misión en curso');
    if (partes.length) tr.title = partes.join(' · ');
    else tr.removeAttribute('title');
  }

  function quitarEstado(tr) {
    ESTADOS_FILA.forEach(function (e) { tr.classList.remove('enc-est-' + e); });
    tr.removeAttribute('data-estado');
    var td0 = tr.cells[0];
    var s = td0 && td0.querySelector('.enc-est');
    if (s) s.remove();
  }

  function ponerEstado(tr, t) {
    quitarEstado(tr);
    tr.classList.remove('enc-activo');
    tr.classList.add('enc-est-' + t.estado);
    tr.setAttribute('data-estado', t.estado);
    var td = tr.cells[0];
    if (!td) return;
    var s = document.createElement('span');
    s.className = 'enc-est';
    if (t.motivo) s.setAttribute('data-motivo', t.motivo);
    var punto = document.createElement('i');
    punto.setAttribute('aria-hidden', 'true');
    s.appendChild(punto);
    s.appendChild(document.createTextNode(t.etiqueta));
    var chip = td.querySelector('.enc-curso');
    if (chip) td.insertBefore(s, chip);
    else td.appendChild(s);
    componerTitulo(tr);
  }

  function marca(tr, on) {
    var td = tr.cells[0];
    if (!td) return;
    var badge = td.querySelector('.enc-curso');
    if (on && !badge) {
      var s = document.createElement('span');
      s.className = 'enc-curso';
      s.textContent = 'en curso';
      td.appendChild(s);
    } else if (!on && badge) badge.remove();
    componerTitulo(tr);
  }

  function aplicar(por) {
    vivas = por;
    var curso = {};
    clavesEnCurso(por).forEach(function (k) { curso[k] = 1; });
    var n = 0;
    Array.prototype.forEach.call(document.querySelectorAll('table.enc[data-ordenable] tbody tr[data-persona]'), function (tr) {
      var on = !!curso[claveFila(tr.getAttribute('data-persona'))];
      marca(tr, on);
      if (on) n++;
    });
    if (aviso) {
      var cuando = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Madrid' });
      aviso.textContent = n
        ? n + (n === 1 ? ' persona' : ' personas') + ' con una misión en curso · Misiones · ' + cuando
        : 'Nadie de la tabla tiene una misión en curso · Misiones · ' + cuando;
    }
    if (abierta && abierta.isConnected) rellenar(abierta, false);
  }

  async function leerEstado(estado) {
    var out = [], offset = 0, total = Infinity;
    for (var i = 0; i < 8 && out.length < total; i++) {
      var r = await fetch(consultaMisiones(estado, offset), { cache: 'no-store', headers: { accept: 'application/json' } });
      if (!r.ok) throw new Error('misiones ' + r.status);
      var d = await r.json();
      var batch = d && Array.isArray(d.missions) ? d.missions : [];
      var t = Number(d && d.total);
      total = Number.isFinite(t) ? t : batch.length;
      out = out.concat(batch);
      if (!batch.length || out.length >= total) break;
      offset += batch.length;
    }
    return out;
  }

  var leyendo = false;
  function leer() {
    if (leyendo || typeof fetch !== 'function') return;
    leyendo = true;
    Promise.all([leerEstado('in_progress'), leerEstado('open')])
      .then(function (partes) { aplicar(agruparMisiones(partes[0].concat(partes[1]))); })
      .catch(function () {
        if (aviso && !vivas) aviso.textContent = 'No se pudo leer Misiones (api.yokup.com/fleet/missions). Se reintenta solo.';
      })
      .then(function () { leyendo = false; });
  }

  var trab = null;
  var leyendoTrab = false;
  function aplicarTrabajando(por) {
    trab = por;
    var n = { verde: 0, amarillo: 0, rojo: 0, gris: 0 };
    Array.prototype.forEach.call(document.querySelectorAll('table.enc[data-ordenable] tbody tr[data-persona]'), function (tr) {
      var t = por[claveTrabajando(tr.getAttribute('data-persona'))];
      if (!t) {
        quitarEstado(tr);
        tr.classList.remove('enc-activo');
        componerTitulo(tr);
        return;
      }
      ponerEstado(tr, t);
      n[t.estado]++;
    });
    if (avisoTrab) {
      var cuando = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Madrid' });
      avisoTrab.textContent = n.verde + ' trabajando · ' + n.amarillo + ' hace poco · ' + n.rojo + ' >1 h · ' + n.gris + ' en espera · Trabajando ahora · ' + cuando;
    }
  }

  function leerTrabajando() {
    if (leyendoTrab || typeof fetch !== 'function') return;
    leyendoTrab = true;
    fetch(TRABAJANDO_API, { cache: 'no-store', headers: { accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error('trabajando ' + r.status); return r.json(); })
      .then(function (d) { aplicarTrabajando(normalizarTarjetas(d)); })
      .catch(function () {
        if (avisoTrab && !trab) avisoTrab.textContent = 'No se pudo leer Trabajando ahora (admira.live/api/flota/trabajando). Se reintenta solo.';
      })
      .then(function () { leyendoTrab = false; });
  }

  leer();
  leerTrabajando();
  setInterval(function () { if (!document.hidden) leer(); }, 30000);
  setInterval(function () { if (!document.hidden) leerTrabajando(); }, 15000);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) return;
    leer();
    leerTrabajando();
  });
})();
