/* /roadmap/encargos — sección «Misiones» (antes «Encargos»; #7059, 22-10-2026).
 * 1) Ordenar cada tabla (Consejeros | Agentes) al pulsar una cabecera (asc ⇄ desc).
 *    Solo reordena el <tbody>: la fila Total vive en <tfoot> y se queda abajo.
 * 2) Latido en vivo: al cargar y cada 60 s relee admira.live/api/flota/trabajando (pública, CORS *)
 *    y marca .activo a quien está en «verde» (trabaja ahora en una misión). Si no
 *    responde, se queda lo que pintó el servidor: nunca se inventa actividad. */
(function () {
  'use strict';
  var tablas = Array.prototype.slice.call(document.querySelectorAll('table.enc'));
  if (!tablas.length) return;

  tablas.forEach(function (tabla) {
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
          var x = a.cells[i].textContent.trim(), y = b2.cells[i].textContent.trim();
          var r = num ? (Number(x) - Number(y)) : x.localeCompare(y, 'es');
          if (r === 0) r = a.cells[0].textContent.localeCompare(b2.cells[0].textContent, 'es');
          return asc ? r : -r;
        }).forEach(function (r) { tb.appendChild(r); });
      });
    });
  });

  var API = 'https://www.admira.live/api/flota/trabajando';
  var CONSEJO = { wozniak: 1, jobs: 1, lucas: 1, disney: 1, musk: 1, huang: 1 };
  var ALIAS = { woz: 'wozniak', steve: 'jobs', elon: 'musk', jensen: 'huang', walt: 'disney', george: 'lucas' };
  function clave(n) {
    var k = String(n || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
    return ALIAS[k] || k;
  }
  var aviso = document.getElementById('enc-latido');
  function pintar(tarjetas) {
    var vivos = {}, filas = Array.prototype.slice.call(document.querySelectorAll('table.enc tbody tr[data-persona]'));
    var conFila = {};
    filas.forEach(function (tr) { conFila[tr.getAttribute('data-persona')] = 1; });
    var resto = false;
    tarjetas.forEach(function (t) {
      if (!t || t.estado !== 'verde' || !t.agente) return;
      var k = clave(t.agente);
      vivos[k] = 1;
      if (t.consejero !== true && !CONSEJO[k] && !conFila[k]) resto = true;
    });
    var n = 0;
    filas.forEach(function (tr) {
      var k = tr.getAttribute('data-persona');
      var on = k === 'resto de agentes' ? resto : !!vivos[k];
      tr.classList.toggle('activo', on);
      if (on) { tr.title = 'Trabajando ahora en una misión'; n++; } else tr.removeAttribute('title');
    });
    if (aviso) aviso.textContent = n ? n + (n === 1 ? ' persona late' : ' personas laten') + ' ahora: trabajan en una misión' : 'Ahora mismo nadie de la tabla trabaja en una misión';
  }
  function leer() {
    if (typeof fetch !== 'function') return;
    fetch(API, { headers: { accept: 'application/json' }, cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (d && Array.isArray(d.tarjetas)) pintar(d.tarjetas); })
      .catch(function () { /* sin red: se queda lo del servidor */ });
  }
  leer();
  setInterval(function () { if (!document.hidden) leer(); }, 60000);
})();
