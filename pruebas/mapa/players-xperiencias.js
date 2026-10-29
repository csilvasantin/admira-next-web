/*
 * Un player virtual por Xperiencia (Carlos, 29-oct-2026 · misión DCL-fb1c7a60).
 *
 * Cada oficina por la que pasa Luka (y «fuera de las zonas») tiene su propio canal de admira.tv,
 * con su pantalla virtual fija (virtual-mapa-xperiencia-<zona>) y su tema, que es su playlist.
 * Se cargan todos a la vez y siguen reproduciendo en silencio aunque no se vean: cuando Luka
 * llega solo cambia cuál se ve, con el contenido ya descargado y sonando.
 *
 * Mover un iframe en el DOM lo recarga, así que nunca se reordenan: el visible lleva
 * data-activo="1" y la hoja de estilos apila el resto, transparentes y sin eventos.
 */
(function (G, d) {
  'use strict';
  var PREFIX = 'virtual-mapa-xperiencia-';

  function screenFor(zone) {return PREFIX + zone.id;}
  function zonesOf(config) {return config.zones.concat([{id:'exterior',name:'',tag:config.outside.tag}]);}

  function create(options) {
    var host = options.host, frames = new Map(), ready = new Set(), active = null;
    function key(zone) {return zone.id + '|' + zone.tag;}
    function hide(frame) {
      frame.setAttribute('data-activo','0');frame.setAttribute('aria-hidden','true');frame.setAttribute('tabindex','-1');
    }
    function make(zone) {
      var frame = d.createElement('iframe');
      frame.setAttribute('allow','autoplay; fullscreen; geolocation \'none\'; camera \'none\'; microphone \'none\'');
      frame.setAttribute('sandbox','allow-scripts allow-same-origin');
      frame.setAttribute('referrerpolicy','no-referrer');
      frame.setAttribute('allowfullscreen','');
      frame.setAttribute('loading','eager');
      frame.setAttribute('data-xperiencia', zone.id);
      hide(frame);
      frame.title = options.title(zone);
      frame.src = options.playerURL(zone, screenFor(zone));
      host.appendChild(frame);
      return frame;
    }
    function drop(frame) {
      frame.removeAttribute('src');frame.remove();ready.delete(frame);
      if (active === frame) active = null;
    }
    // One player per zone plus the outside content, created once and kept running.
    function sync(config) {
      var keep = new Set();
      zonesOf(config).forEach(function (zone) {
        var k = key(zone);keep.add(k);
        if (!frames.has(k)) frames.set(k, make(zone));
      });
      frames.forEach(function (frame, k) {if (!keep.has(k)) {drop(frame);frames.delete(k);}});
    }
    function show(zone) {
      var k = key(zone), frame = frames.get(k);
      if (!frame) {frame = make(zone);frames.set(k, frame);}
      if (active && active !== frame) hide(active);
      frame.setAttribute('data-activo','1');frame.removeAttribute('aria-hidden');frame.removeAttribute('tabindex');
      frame.title = options.title(zone);
      active = frame;
      return frame;
    }
    function clear() {
      frames.forEach(drop);frames.clear();ready.clear();active = null;host.replaceChildren();
    }
    function frameFor(source) {
      var found = null;
      frames.forEach(function (frame) {if (frame.contentWindow === source) found = frame;});
      return found;
    }
    // admira.tv says a player is showing media; a ready player switches in without waiting.
    function markReady(source, id) {
      var frame = frameFor(source);
      if (!frame) return null;
      ready.add(frame);
      if (typeof id === 'string' && id.length <= 160) frame.setAttribute('data-media-id', id);
      return frame;
    }
    return {
      sync:sync, show:show, clear:clear, frameFor:frameFor, markReady:markReady,
      active:function () {return active;},
      isReady:function (frame) {return ready.has(frame);},
      size:function () {return frames.size;},
      readyCount:function () {return ready.size;}
    };
  }

  G.AdmiraMapaXperiencias = {create:create, screenFor:screenFor, prefix:PREFIX};
})(window, document);
