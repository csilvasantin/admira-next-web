/* /roadmap/encargos — ordenar la tabla al pulsar una cabecera (asc ⇄ desc).
 * Solo reordena el <tbody>: la fila Total vive en <tfoot> y se queda abajo. */
(function () {
  'use strict';
  var tabla = document.getElementById('enc-tabla');
  if (!tabla) return;
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
})();
