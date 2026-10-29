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
  // Same pool as the admira.tv channel (its INDEX): the picked pieces are always in its catalogue.
  var STOCK = 'https://api.admira.store/stock/list?limit=300';
  var PIECES = 3;
  var ALIAS = {technology:'tecnologia',tech:'tecnologia',business:'negocio',creativity:'creatividad',music:'musica'};

  function screenFor(zone) {return PREFIX + zone.id;}
  function zonesOf(config) {return config.zones.concat([{id:'exterior',name:'',tag:config.outside.tag}]);}
  function canon(tag) {
    var t = String(tag || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
    return ALIAS[t] || t;
  }
  // Three DIFFERENT pieces per topic (Carlos, 29-oct-2026). An adaptation (16:9, 9:16, subtitled…)
  // shares a par-<id> tag or its externalRef with the piece it comes from, so pieces that share any
  // key form one family, even through a third version. Each family is represented by its newest
  // landscape version (the player is a 16:9 screen); landscape families first, newest first.
  function pickIds(items, tag, n) {
    var want = canon(tag), byKey = new Map(), families = [];
    var newest = function (a, b) {return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));};
    (Array.isArray(items) ? items : []).filter(function (it) {
      return it && typeof it.id === 'string' && /^[A-Za-z0-9-]{1,80}$/.test(it.id) && /^(video|animation|image)$/.test(it.type) &&
        typeof it.url === 'string' && it.url && it.quality !== 'bad' && Array.isArray(it.tags) && it.tags.map(canon).indexOf(want) >= 0;
    }).forEach(function (it) {
      var keys = [it.id, it.externalRef].concat(it.tags.map(canon).filter(function (t) {return t.indexOf('par-') === 0;})
        .map(function (t) {return t.slice(4);})).filter(Boolean);
      var found = [];
      keys.forEach(function (k) {var f = byKey.get(k);if (f && found.indexOf(f) < 0) found.push(f);});
      var family = found[0] || {members:[]};
      if (!found.length) families.push(family);
      found.slice(1).forEach(function (other) {
        other.members.forEach(function (m) {family.members.push(m);});
        byKey.forEach(function (f, k) {if (f === other) byKey.set(k, family);});
        families.splice(families.indexOf(other), 1);
      });
      family.members.push(it);
      keys.forEach(function (k) {byKey.set(k, family);});
    });
    var reps = families.map(function (family) {
      var members = family.members.slice().sort(newest);
      var rep = members.filter(function (m) {return m.orientacion !== 'vertical';})[0] || members[0];
      return {id:rep.id, createdAt:members[0].createdAt, wide:rep.orientacion !== 'vertical'};
    }).sort(newest);
    return reps.filter(function (r) {return r.wide;}).concat(reps.filter(function (r) {return !r.wide;}))
      .map(function (r) {return r.id;}).slice(0, n || PIECES);
  }
  // One catalogue request per page. On failure there are no pinned pieces and each channel
  // plays the newest pieces of its tag (max=3).
  function loadStock(fetchImpl) {
    return fetchImpl(STOCK, {method:'GET', credentials:'omit', cache:'no-store'}).then(function (response) {
      if (!response.ok) throw new Error('stock');
      return response.json();
    }).then(function (data) {return Array.isArray(data && data.items) ? data.items : [];}).catch(function () {return [];});
  }

  function create(options) {
    var host = options.host, frames = new Map(), ready = new Set(), active = null, stock = [], picks = new Map();
    function idsFor(zone) {
      var t = canon(zone.tag);
      if (!picks.has(t)) picks.set(t, pickIds(stock, t));
      return picks.get(t);
    }
    function key(zone) {return zone.id + '|' + zone.tag + '|' + idsFor(zone).join('+');}
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
      frame.src = options.playerURL(zone, screenFor(zone), idsFor(zone));
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
    // A new catalogue changes the key of the players whose pieces change: those reload once.
    function setStock(items) {stock = Array.isArray(items) ? items : [];picks.clear();}
    return {
      sync:sync, show:show, clear:clear, frameFor:frameFor, markReady:markReady, setStock:setStock,
      pieces:function (zone) {return idsFor(zone).slice();},
      active:function () {return active;},
      isReady:function (frame) {return ready.has(frame);},
      size:function () {return frames.size;},
      readyCount:function () {return ready.size;}
    };
  }

  G.AdmiraMapaXperiencias = {create:create, screenFor:screenFor, prefix:PREFIX, pickIds:pickIds, loadStock:loadStock, stock:STOCK};
})(window, document);
