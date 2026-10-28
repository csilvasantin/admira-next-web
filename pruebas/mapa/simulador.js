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
  function zoneFor(point, config) {
    if (!valid(point)) return null;
    return (config ? config.zones : zones).find(function (zone) {return distance(point,zone) <= zone.radius;}) || (config ? {id:'exterior',name:'',tag:config.outside.tag,lat:outside.lat,lon:outside.lon} : outside);
  }
  // Both sources use zoneFor. A real fix must also locate its entire accuracy
  // circle in one winning zone; a point alone cannot distinguish nearby offices.
  function resolveReading(device, config, now) {
    if (!device || device.equipo !== 'luka' || device.tipo !== 'smarttag2' || device.fuente !== 'smartthings-find') return {status:'missing'};
    if (device.es_prueba === true || /mock|demo|fixture|prueba|sint[eé]t|ejemplo|\btest\b|sample/i.test([device.fuente,device.nombre].join(' '))) return {status:'test'};
    var point={lat:device.lat,lng:device.lon};
    if (!valid(point)) return {status:'missing'};
    var stamp=device.ultimo_aviso || device.ts, time=typeof stamp==='string'?Date.parse(stamp):NaN;
    if (!Number.isFinite(time) || time>now+60000 || now-time>300000) return {status:'stale',point:point,time:time};
    var accuracy=device.precision_m;
    if (!Number.isFinite(accuracy)||accuracy<0) return {status:'accuracy',point:point,time:time};
    var result={status:'ready',point:point,time:time,accuracy:accuracy,zone:zoneFor(point,config)};
    for (var zone of config.zones) {
      var metres=distance(point,zone);
      if (metres-accuracy<=zone.radius) {
        if (metres+accuracy>zone.radius) return {status:'ambiguous',point:point,time:time,accuracy:accuracy};
        return result;
      }
    }
    return result;
  }
  function playerURL(zone, identity) {
    if (!zone || typeof zone.id !== 'string' || !/^[a-z][a-z0-9-]{0,47}$/.test(zone.id) || typeof zone.tag !== 'string' || !/^[a-z0-9][a-z0-9-]{0,47}$/.test(zone.tag)) throw new Error('zona_invalida');
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
    var active = false, source = 'manual', latestLuka = null, feedError = false, reading = null, layer = null, marker = null, current = null, currentKey = '', position = null, frame = null, timer = null, connection = 'loading', buttons = new Map();
    var editor = G.AdmiraMapaZonas ? G.AdmiraMapaZonas.create({map:map,L:L,onChange:function () {if (active) {if (source==='luka') updateLuka(latestLuka,feedError);else move(position,true);}}}) : null;
    function config() {return editor ? editor.getConfig() : {zones:zones,outside:outside};}
    function allZones() {var c=config();return c.zones.concat([{id:'exterior',name:'',tag:c.outside.tag,lat:outside.lat,lon:outside.lon}]);}
    function zoneName(zone) {return zone.name || T('Fuera de las zonas','Outside the zones');}
    function label(zone) {var original=zones.concat([outside]).find(function (z) {return z.tag===zone.tag;}) || zone;return editor ? editor.label(zone.tag) : T(original.es || zone.tag,original.en || zone.tag);}
    function statusText() {
      return connection === 'connected' ? T('Player conectado','Player connected') : connection === 'waiting' ? T('Sin confirmación del player. Puedes abrirlo aparte.','No confirmation from the player. You can open it separately.') : T('Conectando con admira.tv…','Connecting to admira.tv…');
    }
    function readingText() {
      var reasons={missing:T('Esperando coordenadas de Luka desde Samsung. El puente aún no aporta una lectura válida.','Waiting for Luka coordinates from Samsung. The bridge has not supplied a valid reading yet.'),test:T('La lectura es de prueba y no activa el player real.','A test reading cannot activate the real player.'),stale:T('La ubicación debe tener menos de cinco minutos y una fecha válida.','The location must be less than five minutes old and have a valid time.'),accuracy:T('Precisión no disponible. No se puede confirmar la oficina.','Accuracy unavailable. The office cannot be confirmed.'),ambiguous:T('El margen de precisión cruza un límite. Esperando una ubicación más precisa.','The accuracy area crosses a boundary. Waiting for a more precise location.'),network:T('No se puede actualizar la ubicación. Player detenido hasta recuperar la consulta.','The location cannot be refreshed. Player stopped until updates recover.')};
      var detail=reading&&Number.isFinite(reading.time)?new Date(reading.time).toLocaleString(/^en/i.test(d.documentElement.lang||'')?'en-GB':'es-ES')+(Number.isFinite(reading.accuracy)?' · ± '+reading.accuracy+' m':'')+' · ':'';
      return detail+(reading&&reading.status==='ready'?T('Oficina decidida con el mismo criterio que el arrastre.','Office selected with the same rule as dragging.'):reasons[reading?reading.status:'missing']);
    }
    function renderText() {
      if (!active) return;
      byId('simulador-zona').textContent = current?zoneName(current):T('Sin oficina confirmada','No confirmed office');
      byId('simulador-contenido').textContent = current?label(current):T('Esperando ubicación','Waiting for location');
      byId('simulador-coordenadas').textContent = position?position.lat.toFixed(5) + ', ' + position.lng.toFixed(5):'—';
      byId('simulador-coordenadas').setAttribute('aria-label',source==='manual'?T('Coordenadas simuladas','Simulated coordinates'):T('Últimas coordenadas recibidas de Luka','Last received Luka coordinates'));
      byId('simulador-estado').textContent = frame?statusText():T('Player en espera','Player waiting');
      byId('simulador-arrastre').textContent = source==='manual'?T('Arrastra el marcador o toca el mapa.','Drag the marker or tap the map.'):T('Siguiendo Luka · actualización cada 60 segundos.','Following Luka · updates every 60 seconds.');
      byId('simulador-lectura').textContent = source==='luka'?readingText():T('Arrastre manual · no modifica la ubicación real de Luka.','Manual drag · does not change Luka’s real location.');
      byId('simulador-badge').textContent = source==='manual'?T('SIMULACIÓN','SIMULATION'):T('SEGUIR LUKA','FOLLOW LUKA');
      root.setAttribute('aria-label',source==='manual'?T('Player de ubicación simulada','Simulated location player'):T('Player según ubicación de Luka','Player following Luka location'));
      byId('simulador-abrir').textContent = T('Abrir player','Open player');
      byId('simulador-abrir').hidden = !frame;
      byId('simulador-zonas').setAttribute('aria-label',T('Zonas y contenido','Zones and content'));
      byId('simulador-cerrar').textContent = source==='manual'?T('Cerrar simulador','Close simulator'):T('Dejar de seguir','Stop following');
      var items=allZones(), ids=items.map(function (zone) {return zone.id;});
      buttons.forEach(function (button,id) {if (ids.indexOf(id)<0) {button.remove();buttons.delete(id);}});
      items.forEach(function (zone) {
        var button = buttons.get(zone.id);
        if (!button) {
          button=d.createElement('button');button.type='button';button.id='simulador-ir-'+zone.id;
          button.addEventListener('click',function () {if (source!=='manual') return;var next=allZones().find(function (z) {return z.id===zone.id;});if (!next) return;move({lat:next.lat,lng:next.lon},true);map.panTo([next.lat,next.lon],{animate:false});});
          buttons.set(zone.id,button);
        }
        button.textContent = zoneName(zone) + ' · ' + label(zone);
        button.disabled=source!=='manual';
        button.setAttribute('aria-pressed',String(!!current && zone.id === current.id));
      });
      var zoneControls=byId('simulador-zonas'), ordered=items.map(function (zone) {return buttons.get(zone.id);});
      if (ordered.length!==zoneControls.children.length || ordered.some(function (button,index) {return zoneControls.children[index]!==button;})) zoneControls.replaceChildren.apply(zoneControls,ordered);
      if (frame) frame.title = 'admira.tv · ' + label(current) + ' · ' + (source==='manual'?T('simulación','simulation'):'Luka');
      if (editor) editor.renderText();
    }
    function loadPlayer(zone) {
      clearTimeout(timer);
      if (frame) frame.removeAttribute('src');
      connection = 'loading';
      frame = d.createElement('iframe');
      frame.title = 'admira.tv · ' + label(zone) + ' · ' + (source==='manual'?T('simulación','simulation'):'Luka');
      frame.setAttribute('allow','autoplay; fullscreen; geolocation \'none\'; camera \'none\'; microphone \'none\'');
      frame.setAttribute('sandbox','allow-scripts allow-same-origin');
      frame.setAttribute('referrerpolicy','no-referrer');
      frame.setAttribute('allowfullscreen','');
      frame.src = playerURL(zone,identity);
      host.replaceChildren(frame);
      byId('simulador-abrir').href = frame.src;
      timer = setTimeout(function () {if (!active) return;connection = 'waiting';renderText();},20000);
    }
    function applyZone(next) {
      var key=next.id+'|'+next.tag;
      current=next;
      if (key !== currentKey) {currentKey=key;loadPlayer(current);}
    }
    function clearPlayer() {
      clearTimeout(timer);
      if (frame) frame.removeAttribute('src');
      host.replaceChildren();frame=null;current=null;currentKey='';
    }
    function updateLuka(device,error) {
      if (!active || source!=='luka') return;
      latestLuka=device;feedError=!!error;
      reading=feedError?{status:'network'}:resolveReading(device,config(),Date.now());
      position=reading.point || null;
      if (reading.status==='ready') applyZone(reading.zone);else clearPlayer();
      renderText();
    }
    function move(point, commit) {
      if (source!=='manual') return;
      if (!active || !valid(point)) return;
      position = {lat:point.lat,lng:point.lng};
      if (marker) marker.setLatLng(position);
      byId('simulador-coordenadas').textContent = position.lat.toFixed(5) + ', ' + position.lng.toFixed(5);
      if (!commit) {
        byId('simulador-arrastre').textContent = T('Suelta para aplicar la ubicación.','Drop to apply the location.');
        return;
      }
      applyZone(zoneFor(position,config()));
      renderText();
    }
    function clickMap(event) {if (active && source==='manual' && event.latlng) move(event.latlng,true);}
    function stop() {
      active = false;
      clearTimeout(timer);
      if (frame) frame.removeAttribute('src');
      host.replaceChildren();
      frame = null;
      if (layer) map.removeLayer(layer);
      if (map.off) map.off('click',clickMap);
      if (editor) editor.deactivate();
      layer = null;marker = null;current = null;currentKey = '';position = null;
      root.hidden = true;controls.hidden = true;
      byId('simular-player').setAttribute('aria-pressed','false');
      byId('seguir-luka').setAttribute('aria-pressed','false');
      byId('mapa').classList.remove('is-simulating');
    }
    function start(mode) {
      if (active) return;
      source=mode==='luka'?'luka':'manual';
      active = true;
      root.hidden = false;controls.hidden = false;
      byId('simular-player').setAttribute('aria-pressed',String(source==='manual'));
      byId('seguir-luka').setAttribute('aria-pressed',String(source==='luka'));
      byId('mapa').classList.add('is-simulating');
      layer = L.layerGroup().addTo(map);
      if (editor) editor.activate(layer,function () {return position;});
      else zones.forEach(function (zone) {
        L.circle([zone.lat,zone.lon],{radius:zone.radius,color:'#bc85ec',weight:1,fillOpacity:0.06,interactive:false}).addTo(layer)
          .bindTooltip(zone.name,{permanent:true,direction:'top',offset:[0,-45],className:'mapa-sim-zone'});
      });
      if (source==='luka') {updateLuka(null,false);return;}
      var icon = L.divIcon({className:'mapa-sim-marker',html:'<span aria-hidden="true">▶</span><span>' + T('Simulador','Simulator') + '</span>',iconSize:[110,36],iconAnchor:[18,18]});
      var first=config().zones[0] || outside;
      marker = L.marker([first.lat,first.lon],{icon:icon,draggable:true,autoPan:true,alt:T('Simulador de ubicación','Location simulator'),title:T('Arrastra para simular otra ubicación','Drag to simulate a new location')}).addTo(layer);
      marker.on('drag',function () {move(marker.getLatLng(),false);});
      marker.on('dragend',function () {move(marker.getLatLng(),true);});
      map.on('click',clickMap);
      move({lat:first.lat,lng:first.lon},true);
      map.setView([first.lat,first.lon],14,{animate:false});
    }
    byId('simulador-cerrar').addEventListener('click',stop);
    G.addEventListener('message',function (event) {
      if (!active || !frame || event.source !== frame.contentWindow || event.origin !== 'https://admira.tv') return;
      var data = event.data;
      if (!data || data.source !== 'admira-tv-canal' || data.event !== 'media-state' || !data.id) return;
      connection = 'connected';clearTimeout(timer);renderText();
    });
    return {start:start,stop:stop,renderText:renderText,updateLuka:updateLuka,isFollowing:function () {return active&&source==='luka';},isActive:function () {return active;},move:function (point) {move(point,true);}};
  }

  G.AdmiraMapaSimulador = {create:create,zoneFor:zoneFor,resolveReading:resolveReading,playerURL:playerURL,zones:zones,outside:outside};
})(window,document);
