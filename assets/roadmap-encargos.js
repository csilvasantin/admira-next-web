/* /roadmap/encargos — ordenar cada tabla al pulsar una cabecera (asc ⇄ desc)
 * y abrir el detalle de la persona al pulsar su fila.
 * Solo se reordena el <tbody>: la fila Total vive en <tfoot> y se queda abajo.
 * El color de la fila sale de Trabajando ahora (admira.live/api/flota/trabajando),
 * releído cada 15 s. Quien tiene una misión in_progress lleva «en curso» y un título corto.
 * Si no, y está trabajando (verde, con Carlos, o con una tarea abierta), lleva «tarea».
 * El chip no enseña el FLT ni el número: eso, el título entero y la hora de inicio van en el tooltip.
 * Una misión FLT solo sale en su asignado. Quien la tiene en curso no queda en gris.
 * Un texto HECHO, o un encargo cerrado, no cuenta como tarea.
 * Las dos cuentan en En curso. El detalle sale de Misiones
 * (api.yokup.com/fleet/missions), releídas cada 30 s. */
import { agruparMisiones, claveFila, clavesEnCurso, consultaMisiones, ESTADO_TEXTO } from './misiones-vivas.js?v=20261022-reloj-1';
import { chipDe, claveTrabajando, contarEnCurso, duenoPorMision, estadoVisible, formatoReloj, normalizarTarjetas, resumenTitulo, tarjetaPara, tooltipChip, TRABAJANDO_API } from './trabajando-vivo.js?v=20261023-misiones-1';

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
    if (titulo) titulo.textContent = 'Misiones de ' + nombre;
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
    var chip = tr.querySelector('.enc-curso, .enc-tarea');
    if (chip && chip.title) partes.push(chip.title);
    else if (tr.querySelector('.enc-curso')) partes.push('Misión en curso');
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

  function ponerChip(tr, tipo, texto, desde, tooltip) {
    quitarChips(tr);
    var td = tr.cells[0];
    if (!td || (tipo !== 'mision' && tipo !== 'tarea')) return;
    var s = document.createElement('span');
    s.className = tipo === 'mision' ? 'enc-curso' : 'enc-tarea';
    var b = document.createElement('b');
    b.textContent = tipo === 'mision' ? 'en curso' : 'tarea';
    s.appendChild(b);
    if (texto) {
      s.appendChild(document.createTextNode(' · '));
      var n = document.createElement('span');
      n.className = 'enc-chip-txt';
      n.textContent = texto;
      s.appendChild(n);
    }
    if (desde) anadirReloj(s, desde);
    s.title = tooltip || ((tipo === 'mision' ? 'Misión' : 'Tarea') + (texto ? ' · ' + texto : ''));
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

  function misionPorId(id) {
    if (!vivas || !id) return null;
    var want = String(id).toUpperCase();
    var claves = Object.keys(vivas);
    for (var i = 0; i < claves.length; i++) {
      var lista = vivas[claves[i]] || [];
      for (var j = 0; j < lista.length; j++) {
        if (String(lista[j].id || '').toUpperCase() === want) return lista[j];
      }
    }
    return null;
  }

  function tituloDeTarea(bruto) {
    var texto = String(bruto || '').replace(/\s+/g, ' ').trim();
    if (resumenTitulo(texto)) return texto;
    var flt = texto.match(/\bFLT-\d+\b/i);
    var hallada = flt ? misionPorId(flt[0]) : null;
    return hallada && hallada.titulo ? hallada.titulo : texto;
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
      var activa = misionActiva(clave);
      var mision = !!activa;
      var vis = estadoVisible(tarjeta, mision);
      if (vis) {
        ponerEstado(tr, vis);
        if (n[vis.estado] != null) n[vis.estado]++;
      } else if (trab) {
        quitarEstado(tr);
        tr.classList.remove('enc-activo');
        componerTitulo(tr);
      }
      var chip = chipDe(mision, tarjeta);
      var tituloChip = chip.tipo === 'mision' && activa ? String(activa.titulo || '') : tituloDeTarea(chip.texto);
      var texto = resumenTitulo(tituloChip);
      var desde = 0;
      if (chip.tipo === 'mision' && activa) desde = Number(activa.inicio) || 0;
      else if (chip.tipo === 'tarea' && tarjeta) desde = Number(tarjeta.inicio) || 0;
      if (chip.tipo && !desde) {
        var marca = (chip.tipo === 'mision' ? 'm:' : 't:') + (activa && activa.id ? activa.id : clave + ':' + (chip.texto || tituloChip || 'trabajo'));
        desde = Number(guardados[marca]) || Date.now();
        persistir[marca] = desde;
      }
      var numeroTip = chip.tipo === 'mision' && activa ? String(activa.numero || '') : '';
      if (chip.tipo === 'tarea') {
        var crudo = String(chip.texto || '');
        var halladoNum = crudo.match(/\bencargos?\s+#?\d+\b|#\d+\b/i);
        if (halladoNum) numeroTip = halladoNum[0].replace(/\s+/g, ' ');
        else if (tarjeta && tarjeta.encargo && !/^FLT-\d+$/i.test(String(tarjeta.encargo))) numeroTip = String(tarjeta.encargo);
      }
      var tip = chip.tipo ? tooltipChip({
        id: chip.tipo === 'mision' && activa ? activa.id : (tarjeta && tarjeta.encargo) || '',
        numero: numeroTip,
        titulo: tituloChip,
        inicio: desde,
      }) : '';
      if (vivas || trab) ponerChip(tr, chip.tipo, texto, desde, tip);
      entradas.push({ mision: mision, tarjeta: tarjeta });
    });
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
  var leyendoTrab = false;
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
  setInterval(function () { if (!document.hidden) leer(); }, 30000);
  setInterval(function () { if (!document.hidden) leerTrabajando(); }, 15000);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) return;
    leer();
    leerTrabajando();
  });
  setInterval(function () {
    var ahora = Date.now();
    Array.prototype.forEach.call(document.querySelectorAll('table.enc .enc-reloj'), function (el) {
      el.textContent = '⏱ ' + formatoReloj(Number(el.getAttribute('data-desde')), ahora);
    });
  }, 1000);
})();
