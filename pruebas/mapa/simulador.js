(function (G, d) {
  'use strict';

  // Zonas sintéticas de la demostración; no son mediciones de Luka.
  var zones = [
    {id:'gracia',name:'Gràcia',tag:'retail',es:'Comercio',en:'Retail',lat:41.4043,lon:2.1582,radius:450},
    {id:'eixample',name:'Eixample',tag:'tecnologia',es:'Tecnología',en:'Technology',lat:41.389,lon:2.1645,radius:450}
  ];
  var outside = {id:'exterior',name:'',tag:'creatividad',es:'Creatividad',en:'Creativity',lat:41.389,lon:2.178};
  function valid(point) {
    return point && Number.isFinite(point.lat) && Math.abs(point.lat) <= 90 && Number.isFinite(point.lng) && Math.abs(point.lng) <= 180;
  }
  function distance(a, b) {
    var rad = Math.PI / 180, x = (b.lat-a.lat)*rad, y = (b.lon-a.lng)*rad;
    var h = Math.sin(x/2)**2 + Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(y/2)**2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
  }
  function zoneFor(point) {
    if (!valid(point)) return null;
    return zones.find(function (zone) {return distance(point,zone) <= zone.radius;}) || outside;
  }
  function playerURL(zone, identity) {
    if (zones.indexOf(zone) < 0 && zone !== outside) throw new Error('zona_invalida');
    if (!/^virtual-mapa-[a-z0-9-]{8,64}$/.test(identity)) throw new Error('identidad_invalida');
    var url = new URL('https://admira.tv/canal.html');
    var params = {embed:'mupi',fit:'screen',screen:identity,circuit:identity,playerType:'virtual',mode:'local',modeLock:'1',sincro:'0',tag:zone.tag,muted:'1',stream:'1',medio:'all',category:'all',audience:'all',age:'all',slot:'all'};
    Object.keys(params).forEach(function (key) {url.searchParams.set(key,params[key]);});
    return url.href;
  }

  function create(options) {
    var map = options.map, L = options.L;
    var byId = function (id) {return d.getElementById(id);};
    var T = function (es,en) {return /^en/i.test(d.documentElement.lang || '') ? en : es;};
    var root = byId('simulador-player'), controls = byId('simulador-controles'), host = byId('simulador-video');
    var identity = 'virtual-mapa-' + (G.crypto && G.crypto.randomUUID ? G.crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
    var active = false, layer = null, marker = null, current = null, position = null, frame = null, timer = null, connection = 'loading';
    function zoneName(zone) {return zone.name || T('Fuera de las zonas','Outside the zones');}
    function label(zone) {return T(zone.es,zone.en);}
    function statusText() {
      return connection === 'connected' ? T('Player conectado','Player connected') : connection === 'waiting' ? T('Sin confirmación del player. Puedes abrirlo aparte.','No confirmation from the player. You can open it separately.') : T('Conectando con admira.tv…','Connecting to admira.tv…');
    }
    function renderText() {
      if (!active) return;
      byId('simulador-zona').textContent = zoneName(current);
      byId('simulador-contenido').textContent = label(current);
      byId('simulador-coordenadas').textContent = position.lat.toFixed(5) + ', ' + position.lng.toFixed(5);
      byId('simulador-estado').textContent = statusText();
      byId('simulador-arrastre').textContent = T('Arrastra el marcador o toca el mapa.','Drag the marker or tap the map.');
      byId('simulador-badge').textContent = T('SIMULACIÓN','SIMULATION');
      byId('simulador-abrir').textContent = T('Abrir player','Open player');
      byId('simulador-cerrar').textContent = T('Cerrar simulador','Close simulator');
      zones.concat([outside]).forEach(function (zone) {
        var button = byId('simulador-ir-' + zone.id);
        button.textContent = zoneName(zone) + ' · ' + label(zone);
        button.setAttribute('aria-pressed',String(zone === current));
      });
      if (frame) frame.title = 'admira.tv · ' + label(current) + ' · ' + T('simulación','simulation');
    }
    function loadPlayer(zone) {
      clearTimeout(timer);
      if (frame) frame.removeAttribute('src');
      connection = 'loading';
      frame = d.createElement('iframe');
      frame.title = 'admira.tv · ' + label(zone) + ' · ' + T('simulación','simulation');
      frame.setAttribute('allow','autoplay; fullscreen; geolocation \'none\'; camera \'none\'; microphone \'none\'');
      frame.setAttribute('sandbox','allow-scripts allow-same-origin');
      frame.setAttribute('referrerpolicy','no-referrer');
      frame.setAttribute('allowfullscreen','');
      frame.src = playerURL(zone,identity);
      host.replaceChildren(frame);
      byId('simulador-abrir').href = frame.src;
      timer = setTimeout(function () {if (!active) return;connection = 'waiting';renderText();},20000);
    }
    function move(point, commit) {
      if (!active || !valid(point)) return;
      position = {lat:point.lat,lng:point.lng};
      if (marker) marker.setLatLng(position);
      byId('simulador-coordenadas').textContent = position.lat.toFixed(5) + ', ' + position.lng.toFixed(5);
      if (!commit) {
        byId('simulador-arrastre').textContent = T('Suelta para aplicar la ubicación.','Drop to apply the location.');
        return;
      }
      var next = zoneFor(position);
      if (next !== current) {current = next;loadPlayer(current);}
      renderText();
    }
    function clickMap(event) {if (active && event.latlng) move(event.latlng,true);}
    function stop() {
      active = false;
      clearTimeout(timer);
      if (frame) frame.removeAttribute('src');
      host.replaceChildren();
      frame = null;
      if (layer) map.removeLayer(layer);
      if (map.off) map.off('click',clickMap);
      layer = null;marker = null;current = null;position = null;
      root.hidden = true;controls.hidden = true;
      byId('simular-player').setAttribute('aria-pressed','false');
      byId('mapa').classList.remove('is-simulating');
    }
    function start() {
      if (active) return;
      active = true;
      root.hidden = false;controls.hidden = false;
      byId('simular-player').setAttribute('aria-pressed','true');
      byId('mapa').classList.add('is-simulating');
      layer = L.layerGroup().addTo(map);
      zones.forEach(function (zone) {
        L.circle([zone.lat,zone.lon],{radius:zone.radius,color:'#bc85ec',weight:1,fillOpacity:0.06,interactive:false}).addTo(layer)
          .bindTooltip(zone.name,{permanent:true,direction:'top',offset:[0,-45],className:'mapa-sim-zone'});
      });
      var icon = L.divIcon({className:'mapa-sim-marker',html:'<span aria-hidden="true">▶</span><span>' + T('Simulador','Simulator') + '</span>',iconSize:[110,36],iconAnchor:[18,18]});
      marker = L.marker([zones[0].lat,zones[0].lon],{icon:icon,draggable:true,autoPan:true,alt:T('Simulador de ubicación','Location simulator'),title:T('Arrastra para simular otra ubicación','Drag to simulate a new location')}).addTo(layer);
      marker.on('drag',function () {move(marker.getLatLng(),false);});
      marker.on('dragend',function () {move(marker.getLatLng(),true);});
      map.on('click',clickMap);
      move({lat:zones[0].lat,lng:zones[0].lon},true);
      map.setView([41.3966,2.164],14,{animate:false});
    }
    zones.concat([outside]).forEach(function (zone) {
      byId('simulador-ir-' + zone.id).addEventListener('click',function () {
        move({lat:zone.lat,lng:zone.lon},true);
        map.panTo([zone.lat,zone.lon],{animate:false});
      });
    });
    byId('simulador-cerrar').addEventListener('click',stop);
    G.addEventListener('message',function (event) {
      if (!active || !frame || event.source !== frame.contentWindow || event.origin !== 'https://admira.tv') return;
      var data = event.data;
      if (!data || data.source !== 'admira-tv-canal' || data.event !== 'media-state' || !data.id) return;
      connection = 'connected';clearTimeout(timer);renderText();
    });
    return {start:start,stop:stop,renderText:renderText,isActive:function () {return active;},move:function (point) {move(point,true);}};
  }

  G.AdmiraMapaSimulador = {create:create,zoneFor:zoneFor,playerURL:playerURL,zones:zones,outside:outside};
})(window,document);
