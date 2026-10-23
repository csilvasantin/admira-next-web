/* /roadmap/encargos — ordenar cada tabla al pulsar una cabecera (asc ⇄ desc)
 * y abrir el detalle de la persona al pulsar su fila.
 * Solo se reordena el <tbody>: la fila Total vive en <tfoot> y se queda abajo.
 * El color de la fila sale de Trabajando ahora (admira.live/api/flota/trabajando),
 * releído cada 15 s. Quien tiene una misión in_progress lleva «en curso · misión».
 * Si no, las misiones open salen como «N misiones» y suben la columna Abiertos:
 * una tarea verde no las tapa. Si no hay ninguna, y está trabajando, lleva «tarea».
 * Una misión FLT solo sale en su asignado. Quien la tiene en curso no queda en gris.
 * Un latido «trabajando» fresco (aunque admira.live lo pinte gris por falta de tokens)
 * cuenta como trabajando. Las misiones status=open no pasan a en curso: eso lo decide Yokup.
 * Un texto HECHO, o un encargo cerrado, no cuenta como tarea.
 * Las dos cuentan en En curso. El detalle sale de Misiones
 * (api.yokup.com/fleet/missions), releídas cada 30 s. */
import { agruparMisiones, claveFila, clavesEnCurso, consultaMisiones, cuentaAbiertos, ESTADO_TEXTO, misionesSinCurso } from './misiones-vivas.js?v=20261023-latido-2';
import { chipDe, claveTrabajando, conPresencia, contarEnCurso, duenoPorMision, estaOcupado, estadoVisible, formatoDesde, formatoIdle, formatoReloj, normalizarTarjetas, tarjetaPara, TRABAJANDO_API } from './trabajando-vivo.js?v=20261023-latido-2';

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

  function numeroCelda(td) {
    if (!td) return '';
    var t = '';
    for (var i = 0; i < td.childNodes.length; i++) {
      if (td.childNodes[i].nodeType === 3) t += td.childNodes[i].textContent;
    }
    t = t.replace(/\s+/g, ' ').trim();
    return t || td.textContent.trim();
  }

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
          var x = i === 0 ? (a.getAttribute('data-orden') || a.cells[i].textContent.trim()) : numeroCelda(a.cells[i]);
          var y = i === 0 ? (b2.getAttribute('data-orden') || b2.cells[i].textContent.trim()) : numeroCelda(b2.cells[i]);
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
    var curso = tr.querySelector('.enc-curso');
    if (curso) partes.push(curso.getAttribute('data-tipo') === 'abierta' ? 'Misiones abiertas' : 'Misión en curso');
    var tareaChip = tr.querySelector('.enc-tarea');
    if (tareaChip) partes.push(tareaChip.title || tareaChip.textContent);
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
    var chip = td.querySelector('.enc-curso, .enc-tarea');
    if (chip) td.insertBefore(s, chip);
    else td.appendChild(s);
    componerTitulo(tr);
  }

  var RELOJ_CLAVE = 'admiranext-encargos-reloj';

  function leerRelojes() {
    try {
      var raw = localStorage.getItem(RELOJ_CLAVE);
      if (raw) {
        var o = JSON.parse(raw);
        if (o && typeof o === 'object') return o;
      }
    } catch (e) { /* sin almacén: el mapa en memoria basta esta sesión */ }
    return relojMemoria;
  }

  function guardarRelojes(o) {
    relojMemoria = o;
    try { localStorage.setItem(RELOJ_CLAVE, JSON.stringify(o)); } catch (e) {}
  }

  function quitarChips(tr) {
    var td = tr.cells[0];
    if (!td) return;
    Array.prototype.forEach.call(td.querySelectorAll('.enc-curso, .enc-tarea'), function (n) { n.remove(); });
  }

  function anadirReloj(padre, desde) {
    padre.appendChild(document.createTextNode(' · '));
    var t = document.createElement('time');
    t.className = 'enc-reloj';
    t.setAttribute('data-desde', String(desde));
    t.dateTime = new Date(desde).toISOString();
    t.textContent = '⏱ ' + formatoReloj(desde, Date.now());
    padre.appendChild(t);
  }

  function ponerChip(tr, tipo, texto, desde, nAbiertas) {
    quitarChips(tr);
    var td = tr.cells[0];
    if (!td || (tipo !== 'mision' && tipo !== 'tarea' && tipo !== 'abierta')) return;
    var s = document.createElement('span');
    s.className = tipo === 'tarea' ? 'enc-tarea' : 'enc-curso';
    if (tipo === 'abierta') s.setAttribute('data-tipo', 'abierta');
    var b = document.createElement('b');
    var cuantas = Number(nAbiertas) || 0;
    b.textContent = tipo === 'mision' ? 'en curso' : tipo === 'abierta' ? (cuantas > 1 ? cuantas + ' misiones' : 'misión') : 'tarea';
    s.appendChild(b);
    if (texto) {
      s.appendChild(document.createTextNode(' · '));
      var n = document.createElement('span');
      n.className = 'enc-chip-txt';
      n.textContent = texto;
      s.appendChild(n);
    }
    if (desde) anadirReloj(s, desde);
    s.title = (tipo === 'tarea' ? 'Tarea' : 'Misión') + (texto ? ' · ' + texto : '') + (desde ? ' · ⏱ ' + formatoReloj(desde, Date.now()) : '');
    td.appendChild(s);
    componerTitulo(tr);
  }

  function textoEnCurso(cuenta) {
    var cuando = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Madrid' });
    return 'En curso ' + cuenta.total
      + ' · ' + cuenta.misiones + (cuenta.misiones === 1 ? ' misión' : ' misiones')
      + ' · ' + cuenta.tareas + (cuenta.tareas === 1 ? ' tarea' : ' tareas')
      + ' · ' + cuando;
  }

  function misionActiva(clave) {
    var lista = vivas && vivas[clave];
    if (!lista) return null;
    for (var i = 0; i < lista.length; i++) if (lista[i].enCurso) return lista[i];
    return null;
  }

  function textoMision(m) {
    var id = String(m.id || m.numero || '').trim();
    var titulo = String(m.titulo || '').replace(/\s+/g, ' ').trim();
    return titulo ? (id ? id + ' · ' + titulo : titulo) : id;
  }

  function quitarIdle(tr) {
    var td = tr.cells[tr.cells.length - 1];
    if (!td) return;
    var prev = td.querySelector('.enc-idle');
    if (prev) prev.remove();
  }

  function ponerIdle(tr, ms) {
    quitarIdle(tr);
    var td = tr.cells[tr.cells.length - 1];
    if (!td) return;
    var s = document.createElement('span');
    s.className = 'enc-idle';
    if (ms) {
      s.setAttribute('data-desde', String(ms));
      s.title = formatoDesde(ms, Date.now());
    }
    s.textContent = formatoIdle(ms, Date.now());
    td.appendChild(s);
  }

  function textoRefs(lista) {
    return lista.map(function (m) { return String(m.numero || m.id || '').trim(); }).filter(Boolean).join(' · ');
  }

  function aplicarAbiertos(tr, lista) {
    var td = tr.cells[1];
    if (!td) return;
    if (!td.hasAttribute('data-base')) td.setAttribute('data-base', td.textContent.trim());
    var base = Number(td.getAttribute('data-base'));
    if (!Number.isFinite(base) || base < 0) base = 0;
    td.textContent = String(Math.max(base, cuentaAbiertos(lista)));
  }

  function refrescarTotales() {
    Array.prototype.forEach.call(document.querySelectorAll('table.enc[data-ordenable]'), function (tabla) {
      var tb = tabla.tBodies[0];
      var pie = tabla.tFoot && tabla.tFoot.rows[0];
      if (!tb || !pie || !pie.cells[1]) return;
      var suma = 0;
      Array.prototype.forEach.call(tb.rows, function (tr) {
        var n = Number(tr.cells[1] && tr.cells[1].textContent);
        if (Number.isFinite(n)) suma += n;
      });
      pie.cells[1].textContent = String(suma);
    });
  }

  function pintarFilas() {
    var indice = duenoPorMision(vivas || {});
    var curso = {};
    if (vivas) clavesEnCurso(vivas).forEach(function (k) { curso[k] = 1; });
    var guardados = leerRelojes();
    var persistir = {};
    var entradas = [];
    var n = { verde: 0, amarillo: 0, rojo: 0, gris: 0 };
    /* Agentes y consejeros: las dos tablas .enc[data-ordenable]. */
    Array.prototype.forEach.call(document.querySelectorAll('table.enc[data-ordenable] tbody tr[data-persona]'), function (tr) {
      var id = tr.getAttribute('data-persona');
      var clave = claveFila(id);
      var base = trab && trab[claveTrabajando(id)];
      var tarjeta = tarjetaPara(clave, base, indice);
      tarjeta = conPresencia(tarjeta, presencia && presencia[clave]);
      var lista = (vivas && vivas[clave]) || [];
      var sinCurso = misionesSinCurso(lista);
      var activa = misionActiva(clave);
      var mision = !!activa;
      var ocupado = estaOcupado(mision, tarjeta);
      if (vivas) aplicarAbiertos(tr, lista);
      var vis = estadoVisible(tarjeta, mision);
      if (vis && !ocupado) vis = Object.assign({}, vis, { etiqueta: '' });
      if (vis) {
        ponerEstado(tr, vis);
        if (n[vis.estado] != null) n[vis.estado]++;
      } else if (trab) {
        quitarEstado(tr);
        tr.classList.remove('enc-activo');
        componerTitulo(tr);
      }
      var chip = chipDe(mision, tarjeta, sinCurso.length);
      var texto = chip.tipo === 'mision' && activa ? textoMision(activa) : chip.tipo === 'abierta' ? textoRefs(sinCurso) : chip.texto;
      var desde = 0;
      if (chip.tipo === 'mision' && activa) desde = Number(activa.inicio) || 0;
      else if (chip.tipo === 'abierta') {
        sinCurso.forEach(function (m) {
          var t0 = Number(m.inicio) || 0;
          if (t0 && (!desde || t0 < desde)) desde = t0;
        });
      } else if (chip.tipo === 'tarea' && tarjeta) desde = Number(tarjeta.inicio) || 0;
      if (chip.tipo && !desde) {
        var marca = (chip.tipo === 'mision' ? 'm:' : chip.tipo === 'abierta' ? 'a:' : 't:') + (activa && activa.id ? activa.id : clave + ':' + (texto || 'trabajo'));
        desde = Number(guardados[marca]) || Date.now();
        persistir[marca] = desde;
      }
      if (vivas || trab) ponerChip(tr, chip.tipo, texto, desde, sinCurso.length);
      if ((vivas || trab) && !ocupado) ponerIdle(tr, tarjeta && tarjeta.actividad);
      else quitarIdle(tr);
      entradas.push({ mision: mision, tarjeta: tarjeta, abiertas: sinCurso.length });
    });
    if (vivas) refrescarTotales();
    if (vivas || trab) guardarRelojes(persistir);
    var cuenta = contarEnCurso(entradas);
    if (trab) {
      ESTADOS_FILA.forEach(function (k) {
        var el = document.getElementById('enc-n-' + k);
        if (el) el.textContent = String(n[k]);
      });
    }
    if (aviso && vivas && trab) aviso.textContent = textoEnCurso(cuenta);
    else if (aviso && vivas && falloTrab) aviso.textContent = textoEnCurso(cuenta) + ' · Trabajando ahora no se pudo leer';
    else if (aviso && trab && falloMisiones) aviso.textContent = textoEnCurso(cuenta) + ' · Misiones no se pudo leer';
    /* Los cuatro recuentos viven en la leyenda: esta línea no se repite. */
    if (avisoTrab && trab) avisoTrab.textContent = '';
  }

  function aplicar(por) {
    vivas = por;
    falloMisiones = false;
    pintarFilas();
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

  var relojMemoria = {};
  var leyendo = false;
  var falloMisiones = false;
  var falloTrab = false;
  function leer() {
    if (leyendo || typeof fetch !== 'function') return;
    leyendo = true;
    Promise.all([leerEstado('in_progress'), leerEstado('open')])
      .then(function (partes) { aplicar(agruparMisiones(partes[0].concat(partes[1]))); })
      .catch(function () {
        falloMisiones = !vivas;
        if (aviso && !vivas) aviso.textContent = 'No se pudo leer Misiones (api.yokup.com/fleet/missions). Se reintenta solo.';
        pintarFilas();
      })
      .then(function () { leyendo = false; });
  }

  var trab = null;
  var presencia = null;
  var leyendoTrab = false;
  var leyendoPres = false;
  function leerPresencia() {
    if (leyendoPres || typeof fetch !== 'function') return;
    leyendoPres = true;
    fetch('/roadmap/presencia', { cache: 'no-store', credentials: 'same-origin', headers: { accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error('presencia ' + r.status); return r.json(); })
      .then(function (d) { presencia = (d && d.por) || {}; pintarFilas(); })
      .catch(function () { /* Trabajando ahora sigue pintando la fila */ })
      .then(function () { leyendoPres = false; });
  }
  function aplicarTrabajando(por) {
    trab = por;
    falloTrab = false;
    pintarFilas();
  }

  function leerTrabajando() {
    if (leyendoTrab || typeof fetch !== 'function') return;
    leyendoTrab = true;
    fetch(TRABAJANDO_API, { cache: 'no-store', headers: { accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error('trabajando ' + r.status); return r.json(); })
      .then(function (d) { aplicarTrabajando(normalizarTarjetas(d)); })
      .catch(function () {
        falloTrab = !trab;
        if (avisoTrab && !trab) avisoTrab.textContent = 'No se pudo leer Trabajando ahora (admira.live/api/flota/trabajando). Se reintenta solo.';
        pintarFilas();
      })
      .then(function () { leyendoTrab = false; });
  }

  leer();
  leerTrabajando();
  leerPresencia();
  setInterval(function () { if (!document.hidden) leer(); }, 30000);
  setInterval(function () { if (!document.hidden) leerTrabajando(); }, 15000);
  setInterval(function () { if (!document.hidden) leerPresencia(); }, 15000);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) return;
    leer();
    leerTrabajando();
    leerPresencia();
  });
  setInterval(function () {
    var ahora = Date.now();
    Array.prototype.forEach.call(document.querySelectorAll('table.enc .enc-reloj'), function (el) {
      el.textContent = '⏱ ' + formatoReloj(Number(el.getAttribute('data-desde')), ahora);
    });
  }, 1000);
  setInterval(function () {
    var ahora = Date.now();
    Array.prototype.forEach.call(document.querySelectorAll('table.enc .enc-idle'), function (el) {
      el.textContent = formatoIdle(Number(el.getAttribute('data-desde')), ahora);
      var ms = Number(el.getAttribute('data-desde'));
      if (ms) el.title = formatoDesde(ms, ahora);
    });
  }, 60000);
})();
