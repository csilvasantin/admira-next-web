(function (G) {
  'use strict';
  // Esquema de la casa, el mismo orden que el mapa. No es el plano en milímetros.
  var ROOMS = [
    {id:'cocina',name:'Cocina',lat:41.3997038,lon:2.1559172},
    {id:'terraza',name:'Terraza',lat:41.3993419,lon:2.1563962},
    {id:'pasillo',name:'Pasillo',lat:41.3993419,lon:2.1559172},
    {id:'sneaker-store',name:'Sneaker Store',lat:41.39898,lon:2.1559172},
    {id:'la-nave',name:'La Nave',lat:41.39898,lon:2.1563962}
  ];

  function t(es, en) {
    var doc = G.document && G.document.documentElement;
    var lang = doc && doc.getAttribute ? doc.getAttribute('lang') : '';
    return /^en/i.test(lang || '') ? en : es;
  }

  function bounds(rooms) {
    var lats = rooms.map(function (r) {return r.lat;});
    var lons = rooms.map(function (r) {return r.lon;});
    return {minLat:Math.min.apply(null,lats),maxLat:Math.max.apply(null,lats),minLon:Math.min.apply(null,lons),maxLon:Math.max.apply(null,lons)};
  }

  function project(lat, lon, box) {
    var pad = 16;
    var h = box.maxLat - box.minLat || 1;
    var w = box.maxLon - box.minLon || 1;
    return {
      x: pad + ((lon - box.minLon) / w) * (100 - pad * 2),
      y: pad + ((box.maxLat - lat) / h) * (100 - pad * 2)
    };
  }

  function create(options) {
    var rooms = (options && options.rooms) || ROOMS;
    var driver = options.driver;
    var box = bounds(rooms);
    var home = rooms[2] || rooms[0];
    var pose = {lat:home.lat,lng:home.lon,heading:0,remaining:0};
    var status = 'idle';
    var targetId = null;
    var cameraBroken = false;
    var listeners = [];
    function emit() {listeners.forEach(function (fn) {fn(api.view());});}
    driver.onPose(function (p) {
      pose = {lat:p.lat,lng:p.lng,heading:p.heading || 0,remaining:p.remaining || 0};
      emit();
    });
    driver.onArrive(function (p) {
      pose = {lat:p.lat,lng:p.lng,heading:p.heading || 0,remaining:0};
      status = 'arrived';
      emit();
    });
    function room(id) {
      for (var i = 0; i < rooms.length; i += 1) if (rooms[i].id === id) return rooms[i];
      return null;
    }
    var api = {
      rooms: function () {return rooms;},
      project: function (lat, lon) {return project(lat, lon, box);},
      goToRoom: function (id) {
        var dest = room(id);
        if (!dest) return false;
        targetId = id;
        status = 'driving';
        driver.goTo({lat:dest.lat,lng:dest.lon},{from:{lat:pose.lat,lng:pose.lng}});
        emit();
        return true;
      },
      stop: function () {
        driver.stop();
        if (status === 'driving') status = 'stopped';
        emit();
      },
      failCamera: function () {cameraBroken = true; emit();},
      onChange: function (fn) {listeners.push(fn);},
      view: function () {
        var url = driver.cameraURL ? driver.cameraURL() : null;
        var signal = !!(url && !cameraBroken);
        var dest = room(targetId);
        return {
          status: status,
          roomId: targetId,
          roomName: dest ? dest.name : '',
          pose: {lat:pose.lat,lng:pose.lng,heading:pose.heading,remaining:pose.remaining},
          camera: {signal: signal, url: signal ? url : null}
        };
      }
    };
    return api;
  }

  function statusMessage(view) {
    if (view.status === 'driving') return t('Yendo a ','Going to ') + view.roomName;
    if (view.status === 'stopped') return t('Robot parado','Robot stopped');
    if (view.status === 'arrived') return t('En ','At ') + view.roomName;
    return t('Elige una sala','Pick a room');
  }

  function cameraMessage(view) {
    return view.camera.signal ? t('Cámara en directo','Live camera') : t('No hay señal de cámara','No camera signal');
  }

  function mount(root, options) {
    var doc = root.ownerDocument || G.document;
    var robotApi = (G.AdmiraMapaRobot && G.AdmiraMapaRobot.createSimDriver) || null;
    var driver = (options && options.driver) || (robotApi ? robotApi.call(G.AdmiraMapaRobot) : null);
    if (!driver) return null;
    var api = create({driver: driver});
    var svg = root.querySelector('#limpieza-mapa');
    var estado = root.querySelector('#limpieza-estado');
    var senal = root.querySelector('#limpieza-senal');
    var video = root.querySelector('#limpieza-video');
    var ns = 'http://www.w3.org/2000/svg';
    if (svg) {
      api.rooms().forEach(function (room) {
        var p = api.project(room.lat, room.lon);
        var dot = doc.createElementNS(ns, 'circle');
        dot.setAttribute('cx', String(p.x));
        dot.setAttribute('cy', String(p.y));
        dot.setAttribute('r', '4.2');
        dot.setAttribute('fill', 'none');
        dot.setAttribute('stroke', '#63e6d5');
        dot.setAttribute('stroke-width', '0.6');
        svg.appendChild(dot);
        var label = doc.createElementNS(ns, 'text');
        label.setAttribute('x', String(p.x));
        label.setAttribute('y', String(p.y - 6));
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('fill', '#eef6ff');
        label.setAttribute('font-size', '3.2');
        label.textContent = room.name;
        svg.appendChild(label);
      });
      var mark = doc.createElementNS(ns, 'circle');
      mark.setAttribute('id', 'limpieza-robot');
      mark.setAttribute('r', '2.2');
      mark.setAttribute('fill', '#ffbd69');
      svg.appendChild(mark);
    }
    function paint() {
      var view = api.view();
      if (estado) estado.textContent = statusMessage(view);
      if (senal) {
        senal.textContent = cameraMessage(view);
        senal.className = 'limpieza-aviso';
        senal.setAttribute('data-senal', view.camera.signal ? 'si' : 'no');
        senal.hidden = false;
      }
      if (video) {
        if (view.camera.signal) {
          if (video.getAttribute('src') !== view.camera.url) video.setAttribute('src', view.camera.url);
          video.hidden = false;
        } else {
          video.removeAttribute('src');
          video.hidden = true;
        }
      }
      var spot = svg && svg.querySelector('#limpieza-robot');
      if (spot) {
        var at = api.project(view.pose.lat, view.pose.lng);
        spot.setAttribute('cx', String(at.x));
        spot.setAttribute('cy', String(at.y));
      }
      root.querySelectorAll('[data-sala]').forEach(function (button) {
        button.setAttribute('aria-pressed', button.getAttribute('data-sala') === view.roomId && view.status === 'driving' ? 'true' : 'false');
      });
    }
    root.querySelectorAll('[data-sala]').forEach(function (button) {
      button.addEventListener('click', function () {api.goToRoom(button.getAttribute('data-sala')); paint();});
    });
    var stop = root.querySelector('#limpieza-parar');
    if (stop) stop.addEventListener('click', function () {api.stop(); paint();});
    if (video) video.addEventListener('error', function () {api.failCamera(); paint();});
    api.onChange(paint);
    if (G.addEventListener) G.addEventListener('admira:languagechange', paint);
    paint();
    return api;
  }

  G.AdmiraLimpieza = {rooms:ROOMS, create:create, statusMessage:statusMessage, cameraMessage:cameraMessage, mount:mount, t:t};
  if (G.document && G.document.getElementById && G.document.getElementById('limpieza')) {
    if (G.document.readyState === 'loading') G.document.addEventListener('DOMContentLoaded', function () {mount(G.document.getElementById('limpieza'));});
    else mount(G.document.getElementById('limpieza'));
  }
})(typeof window !== 'undefined' ? window : globalThis);
