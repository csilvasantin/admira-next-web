(function (G) {
  'use strict';
  // Players reales por sala de la app del Saros Z70. Vacíos a propósito:
  // Carlos aún no ha dicho qué player corresponde a cada sala. No inventar ids.
  var REAL = {cocina: null, terraza: null, pasillo: null};
  function playerFor(id) {
    if (!Object.prototype.hasOwnProperty.call(REAL, id)) return null;
    var value = REAL[id];
    return typeof value === 'string' && value ? value : null;
  }
  G.AdmiraSalasReales = {playerFor: playerFor, salas: Object.keys(REAL)};
})(typeof window !== 'undefined' ? window : globalThis);
