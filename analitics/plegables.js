/* analitics/plegables.js — carga diferida de los bloques plegables de /analitics.
 *
 * FLT-101380 (2-oct-2026). Encargo de Carlos: «no se cargan los datos de la visita con
 * más detalle ni del Silicio más allá del navegador hasta que no se desplieguen las
 * ventanas que los contienen; igual con el rendimiento por site».
 *
 * Este fichero no pinta nada: guarda, por cada parte (detalle, http, sites), si su bloque
 * está abierto, para qué combinación de filtros se cargó y en qué estado está. panel.js le
 * da la URL, la clave de filtros y las funciones que pintan. Reglas:
 *   - Una parte sólo se pide al abrir su bloque, o cuando alguien la pide expresamente
 *     (el verbo /json del Experto). Nunca en la carga inicial ni con el bloque plegado.
 *   - Se pide una sola vez por clave de filtros (periodo · site · Carbono/Silicio · ronda
 *     de refresco). Plegar y volver a abrir con la misma clave no vuelve a pedir nada.
 *   - Al cambiar la clave, las partes abiertas (y visibles) se recargan; las plegadas
 *     quedan «desactualizadas» y se recargan al abrirlas.
 *   - Una respuesta que llega tarde (la clave cambió mientras volaba) se descarta.
 * No se recuerda el estado abierto/plegado entre visitas: la página nace plegada y, por
 * tanto, la carga inicial nunca pide estas partes.
 */
(function (global) {
  'use strict';
  function crear(opciones) {
    var o = opciones, partes = {};
    function parte(nombre) {
      return partes[nombre] || (partes[nombre] = {nombre: nombre, abierta: false, clave: null, datos: null, error: null, estado: 'sin-cargar', vuelo: null});
    }
    function avisar(p) { if (o.estado) o.estado(p.nombre, p); }
    function cargar(nombre, forzar) {
      var p = parte(nombre), clave = o.clave();
      if (!forzar && p.clave === clave) {
        if (p.estado === 'ok') return Promise.resolve(p.datos);
        if (p.estado === 'cargando' && p.vuelo) return p.vuelo;
      }
      p.clave = clave; p.estado = 'cargando'; p.error = null; avisar(p);
      var vuelo = Promise.resolve().then(function () { return o.pedir(nombre); }).then(function (datos) {
        if (p.vuelo !== vuelo) return p.vuelo; // llegó tarde: ya se pidió otra clave
        p.vuelo = null; p.datos = datos; p.estado = 'ok'; avisar(p);
        return datos;
      }, function (error) {
        if (p.vuelo !== vuelo) return p.vuelo;
        p.vuelo = null; p.estado = 'error'; p.error = (error && error.message) || String(error); avisar(p);
        throw error;
      });
      p.vuelo = vuelo;
      return vuelo;
    }
    function silencio(promesa) { if (promesa && promesa.catch) promesa.catch(function () {}); return promesa; }
    function visible(nombre) { return !o.visible || o.visible(nombre); }
    return {
      parte: parte,
      cargar: cargar,
      abrir: function (nombre) {
        var p = parte(nombre); p.abierta = true; avisar(p);
        return visible(nombre) ? silencio(cargar(nombre)) : Promise.resolve(null);
      },
      plegar: function (nombre) { var p = parte(nombre); p.abierta = false; avisar(p); },
      // Llamar cada vez que cambian los filtros o hay una ronda de refresco.
      filtrosCambiados: function () {
        var clave = o.clave();
        Object.keys(partes).forEach(function (nombre) {
          var p = partes[nombre];
          if (p.abierta && visible(nombre)) silencio(cargar(nombre));
          else if (p.clave !== null && p.clave !== clave && p.estado !== 'desactualizada') {
            p.vuelo = null; p.estado = 'desactualizada'; avisar(p);
          }
        });
      },
      // Lo que hay cargado ahora para la clave vigente (para /json y /estado).
      vigentes: function () {
        var clave = o.clave(), r = {};
        Object.keys(partes).forEach(function (n) { var p = partes[n]; r[n] = p.estado === 'ok' && p.clave === clave ? p.datos : null; });
        return r;
      }
    };
  }
  global.AnaliticsPlegables = {crear: crear};
})(typeof window !== 'undefined' ? window : globalThis);
