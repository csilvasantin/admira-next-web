/* Rutas a pie de Luka entre Xperiencias (paseo del recorrido Demo).
   Pide la ruta peatonal a OSRM (routing.openstreetmap.de, perfil foot) sólo con los centros
   de las zonas, nunca con la ubicación real de Luka. Sin respuesta en 4 s: línea recta (y no se vuelve a pedir esa ruta). */
(function (G) {
  'use strict';
  var BASE = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot/', cache = new Map(), pending = new Map();
  function key(a, b) {return [a.lat, a.lng, b.lat, b.lng].map(function (n) {return n.toFixed(5);}).join(',');}
  function valid(path) {
    return Array.isArray(path) && path.length >= 2 && path.length <= 2000 && path.every(function (p) {
      return Array.isArray(p) && isFinite(p[0]) && isFinite(p[1]) && Math.abs(p[1]) <= 90 && Math.abs(p[0]) <= 180;
    });
  }
  function fetchRoute(a, b) {
    var k = key(a, b);
    if (cache.has(k) || pending.has(k) || typeof G.fetch !== 'function') return pending.get(k) || Promise.resolve(cache.get(k) || null);
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null, t = ctrl && G.setTimeout(function () {ctrl.abort();}, 4000);
    var url = BASE + a.lng + ',' + a.lat + ';' + b.lng + ',' + b.lat + '?overview=full&geometries=geojson';
    var job = G.fetch(url, ctrl ? {signal: ctrl.signal} : {}).then(function (r) {return r.ok ? r.json() : null;}).then(function (data) {
      var coords = data && data.code === 'Ok' && data.routes && data.routes[0] && data.routes[0].geometry && data.routes[0].geometry.coordinates;
      if (!valid(coords)) return null;
      // La ruta empieza y acaba en el centro exacto de cada Xperiencia.
      var path = [{lat: a.lat, lng: a.lng}].concat(coords.map(function (p) {return {lat: p[1], lng: p[0]};}), [{lat: b.lat, lng: b.lng}]);
      cache.set(k, path);
      return path;
    }).catch(function () {return null;}).then(function (path) {if (t) G.clearTimeout(t);pending.delete(k);if (!path) cache.set(k, null);return path;});
    pending.set(k, job);
    return job;
  }
  G.AdmiraMapaRutas = {
    // Ruta ya descargada (o null): el paseo nunca espera a la red.
    get: function (a, b) {var path = cache.get(key(a, b));if (!path) fetchRoute(a, b);return path || null;},
    prefetch: function (stops, loop) {
      for (var i = 0; i < stops.length; i++) {
        var next = stops[i + 1] || (loop ? stops[0] : null);
        if (next && next !== stops[i]) fetchRoute(stops[i], next);
      }
    }
  };
})(window);
