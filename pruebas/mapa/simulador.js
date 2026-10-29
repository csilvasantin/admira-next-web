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
  function decisionFor(point, config) {
    if (!valid(point)) return null;
    var c=config || {zones:zones,outside:outside}, zone=zoneFor(point,c);
    var matches=c.zones.filter(function (item) {return distance(point,item)<=item.radius;});
    var nearest=null;
    c.zones.forEach(function (item) {
      var gap=Math.max(0,distance(point,item)-item.radius);
      if (!nearest || gap<nearest.metres) nearest={zone:item,metres:gap};
    });
    return {zone:zone,matches:matches,priority:c.zones.findIndex(function (item) {return item.id===zone.id;})+1,
      margin:zone.id==='exterior'?null:Math.max(0,zone.radius-distance(point,zone)),nearest:nearest};
  }
  // Manual, Samsung and browser fixes share the same winning-zone rule.
  // Measured positions must fit their whole accuracy circle in that zone.
  function resolveFix(point,time,accuracy,config,now) {
    if (!valid(point)) return {status:'missing'};
    if (!Number.isFinite(time) || time>now+60000 || now-time>300000) return {status:'stale',point:point,time:time};
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
  function resolveReading(device, config, now) {
    if (!device || device.equipo !== 'luka' || device.tipo !== 'smarttag2' || device.fuente !== 'smartthings-find') return {status:'missing'};
    if (device.es_prueba === true || /mock|demo|fixture|prueba|sint[eé]t|ejemplo|\btest\b|sample/i.test([device.fuente,device.nombre].join(' '))) return {status:'test'};
    var stamp=device.ultimo_aviso || device.ts;
    return resolveFix({lat:device.lat,lng:device.lon},typeof stamp==='string'?Date.parse(stamp):NaN,device.precision_m,config,now);
  }
  function resolveBrowserReading(fix,config,now) {
    var c=fix&&fix.coords;
    return resolveFix({lat:c&&c.latitude,lng:c&&c.longitude},fix&&fix.timestamp,c&&c.accuracy,config,now);
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
    // One preloaded admira.tv player per Xperiencia (players-xperiencias.js); Luka only switches which one shows.
    var bank = G.AdmiraMapaXperiencias.create({host:host,playerURL:playerURL,title:function (zone) {
      return 'admira.tv · ' + label(zone) + ' · ' + (source==='manual'?T('simulación','simulation'):source==='browser'?T('mi dispositivo','my device'):'Luka');
    }});
    var active = false, dragging = false, source = 'manual', latestLuka = null, feedError = false, reading = null, layer = null, marker = null, current = null, currentKey = '', position = null, frame = null, timer = null, connection = 'loading', buttons = new Map(), browserState=null, deviceLayer=null, deviceMarker=null, deviceHalo=null;
    var history=[], lastHistoryKey='', lastHistoryState=null, historyOpen=false;
    var tourStatus='idle',tourStops=[],tourIndex=-1,tourTimer=null,tourTicket=0,tourDue=0,tourRemaining=12000,tourReason='',tourLoop=false;
    var browserSource=G.AdmiraMapaUbicacionDispositivo?G.AdmiraMapaUbicacionDispositivo.create({onChange:function (state) {if (state.status==='stopped') {if (active&&source==='browser') stop();}else updateBrowser(state);}}):null;
    var editor = G.AdmiraMapaZonas ? G.AdmiraMapaZonas.create({map:map,L:L,onInteraction:function () {stopTour('config');renderTour();},onChange:function (change) {stopTour('config');if (active) {if (source==='luka') updateLuka(latestLuka,feedError,'config');else if (source==='browser') updateBrowser(browserState,'config');else {var first=config().zones[0];move(change&&change.preset==='offices'?{lat:first.lat,lng:first.lon}:position,true,'config');}if (change&&change.preset==='offices') fitZones();}}}) : null;
    function config() {return editor ? editor.getConfig() : {zones:zones,outside:outside};}
    function fitZones() {
      var points=config().zones.map(function (zone) {return [zone.lat,zone.lon];}), width=map.getSize?map.getSize().x:0;
      if (points.length && map.fitBounds) map.fitBounds(points,{paddingTopLeft:[55,55],paddingBottomRight:[width>600?Math.min(330,Math.round(width*.45)+30):55,55],maxZoom:17,animate:false});
      else {var first=config().zones[0]||outside;map.setView([first.lat,first.lon],14,{animate:false});}
    }
    function allZones() {var c=config();return c.zones.concat([{id:'exterior',name:'',tag:c.outside.tag,lat:outside.lat,lon:outside.lon}]);}
    function zoneName(zone) {return zone.name || T('Fuera de las zonas','Outside the zones');}
    function label(zone) {var original=zones.concat([outside]).find(function (z) {return z.tag===zone.tag;}) || zone;return editor ? editor.label(zone.tag) : T(original.es || zone.tag,original.en || zone.tag);}
    function touring() {return tourStatus==='running'||tourStatus==='paused';}
    function renderTour() {
      var focused=d.activeElement, startButton=byId('simulador-recorrer'), pauseButton=byId('simulador-recorrido-pausa'), stopButton=byId('simulador-recorrido-detener');
      var available=active&&source==='manual', target=tourStops[tourIndex], editing=editor&&editor.isEditing&&editor.isEditing();
      byId('simulador-recorrer').textContent=tourStatus==='complete'?T('Repetir recorrido Demo','Repeat Demo tour'):T('Iniciar recorrido Demo','Start Demo tour');
      byId('simulador-recorrer').disabled=!available||!config().zones.length||touring()||!!editing;
      byId('simulador-recorrido-pausa').textContent=tourStatus==='paused'?T('Reanudar recorrido','Resume tour'):T('Pausar recorrido','Pause tour');
      byId('simulador-recorrido-pausa').hidden=!available||!touring();
      byId('simulador-recorrido-detener').textContent=T('Detener recorrido','Stop tour');
      byId('simulador-recorrido-detener').hidden=!available||!touring();
      byId('simulador-recorrido-ayuda').textContent=T('Demo · visita el centro de cada zona durante 12 s, con la misma decisión que al soltar Luka. Respeta la prioridad de solapamientos y sólo controla este player virtual.','Demo · visits each zone centre for 12 s, using the same decision as dropping Luka. Overlap priority applies; only this virtual player is controlled.');
      var text=!available?T('Disponible en Simular player.','Available in Simulate player.'):editing?T('Termina la edición para iniciar un recorrido.','Finish editing before starting a tour.'):!config().zones.length?T('Añade una zona para iniciar el recorrido.','Add a zone to start the tour.'):tourStatus==='idle'?T('Recorrido preparado; se inicia sólo al pulsar el botón.','Tour ready; starts only when you press the button.'):tourStatus==='stopped'?T('Recorrido detenido.','Tour stopped.'):tourStatus==='complete'?T('Recorrido completado.','Tour completed.'):tourStatus==='paused'?T('Recorrido en pausa.','Tour paused.'):T('Recorrido Demo en marcha.','Demo tour running.');
      if (target && tourStatus!=='idle'&&tourStatus!=='stopped') {
        text+=' '+(tourIndex+1)+' / '+tourStops.length+' · '+target.name+'.';
        if (current&&current.id!==target.id) text+=' '+T('Gana ','Winner: ')+zoneName(current)+T(' por prioridad.',' by priority.');
      }
      var reasons={manual:T('Movimiento manual.','Manual movement.'),config:T('Edición o importación de zonas.','Zone editing or import.'),hidden:T('La página ha quedado oculta.','The page was hidden.'),source:T('Cambio o cierre del modo.','Mode changed or closed.'),user:T('Parada solicitada.','Stopped by user.')};
      if (tourStatus==='stopped'&&available&&reasons[tourReason]) text+=' '+reasons[tourReason];
      byId('simulador-recorrido-estado').textContent=text;
      // Keep keyboard focus usable when its tour control becomes disabled or
      // hidden. Polling never takes focus from another control or hidden page.
      var nextFocus=available&&focused===startButton&&startButton.disabled&&touring()?pauseButton:
        available&&(focused===pauseButton||focused===stopButton)&&focused.hidden&&!startButton.disabled?startButton:null;
      if (nextFocus&&!d.hidden&&nextFocus.focus) nextFocus.focus({preventScroll:true});
    }
    function stopTour(reason) {
      if (tourStatus==='idle'||tourStatus==='stopped') return;
      clearTimeout(tourTimer);tourTimer=null;++tourTicket;tourStatus='stopped';tourReason=reason||'user';renderText();
    }
    function armTour(delay) {
      clearTimeout(tourTimer);var ticket=++tourTicket;tourDue=Date.now()+delay;
      tourTimer=setTimeout(function () {
        if (ticket!==tourTicket||!active||source!=='manual'||tourStatus!=='running') return;
        tourTimer=null;
        if (d.hidden) {stopTour('hidden');return;}
        // /demo luka keeps walking; the button tour ends after the last office.
        if (tourIndex>=tourStops.length-1) {if (!tourLoop) {tourStatus='complete';renderText();return;}tourIndex=-1;}
        ++tourIndex;visitTourStop();
      },delay);
    }
    function visitTourStop() {
      var target=tourStops[tourIndex];
      move({lat:target.lat,lng:target.lon},true,'tour');
      tourRemaining=12000;armTour(tourRemaining);
    }
    function startTour() {
      if (!active||source!=='manual'||d.hidden||touring()||(editor&&editor.isEditing&&editor.isEditing())) return;
      tourStops=config().zones.map(function (zone) {return {id:zone.id,name:zone.name,lat:zone.lat,lon:zone.lon};});
      if (!tourStops.length) return;
      tourStatus='running';tourReason='';tourIndex=0;fitZones();visitTourStop();
    }
    function pauseTour() {
      if (!active||source!=='manual'||!touring()) return;
      if (d.hidden) {stopTour('hidden');return;}
      if (tourStatus==='running') {tourRemaining=Math.max(0,tourDue-Date.now());clearTimeout(tourTimer);tourTimer=null;++tourTicket;tourStatus='paused';}
      else {tourStatus='running';armTour(tourRemaining);}
      renderText();
    }
    function statusText() {
      return connection === 'connected' ? T('Player conectado','Player connected') : connection === 'waiting' ? T('Sin confirmación del player. Puedes abrirlo aparte.','No confirmation from the player. You can open it separately.') : T('Conectando con admira.tv…','Connecting to admira.tv…');
    }
    function readingReason(status,origin) {
      var reasons={missing:T('Esperando coordenadas de Luka desde Samsung. El puente aún no aporta una lectura válida.','Waiting for Luka coordinates from Samsung. The bridge has not supplied a valid reading yet.'),test:T('La lectura es de prueba y no activa el player real.','A test reading cannot activate the real player.'),stale:T('La ubicación debe tener menos de cinco minutos y una fecha válida.','The location must be less than five minutes old and have a valid time.'),accuracy:T('Precisión no disponible. No se puede confirmar la oficina.','Accuracy unavailable. The office cannot be confirmed.'),ambiguous:T('El margen de precisión cruza un límite. Esperando una ubicación más precisa.','The accuracy area crosses a boundary. Waiting for a more precise location.'),network:T('No se puede actualizar la ubicación. Player detenido hasta recuperar la consulta.','The location cannot be refreshed. Player stopped until updates recover.')};
      if (origin==='browser') Object.assign(reasons,{missing:T('Esperando una posición de este dispositivo.','Waiting for this device’s location.'),locating:T('Esperando el permiso y la primera ubicación del navegador.','Waiting for browser permission and the first location.'),denied:T('Permiso de ubicación denegado. Detén este modo antes de volver a activarlo con permiso.','Location permission denied. Stop this mode before enabling it again with permission.'),timeout:T('No llega una ubicación a tiempo. Esperando una nueva medición.','Location request timed out. Waiting for a new measurement.'),unavailable:T('Ubicación no disponible. Esperando una nueva medición.','Location unavailable. Waiting for a new measurement.'),unsupported:T('Este navegador no ofrece ubicación. Prueba desde el navegador del móvil.','This browser does not offer location. Try your phone browser.'),insecure:T('La ubicación requiere una conexión HTTPS segura.','Location requires a secure HTTPS connection.'),policy:T('La política del navegador impide acceder a la ubicación.','Browser policy blocks location access.'),hidden:T('Vuelve a esta página y activa la ubicación de nuevo.','Return to this page and enable location again.')});
      return reasons[status] || T('Esperando una ubicación válida.','Waiting for a valid location.');
    }
    function readingText() {
      var detail=reading&&Number.isFinite(reading.time)?new Date(reading.time).toLocaleString(/^en/i.test(d.documentElement.lang||'')?'en-GB':'es-ES')+(Number.isFinite(reading.accuracy)?' · ± '+reading.accuracy+' m':'')+' · ':'';
      return detail+(reading&&reading.status==='ready'?T('Oficina decidida con el mismo criterio que el arrastre.','Office selected with the same rule as dragging.'):readingReason(reading?reading.status:'missing',source));
    }
    function sourceName(origin) {
      return origin==='manual'?T('Manual · simulado','Manual · simulated'):origin==='browser'?T('Mi dispositivo','My device'):T('Luka · puente Samsung','Luka · Samsung bridge');
    }
    function historyReason(item) {
      if (item.status==='stopped') return T('Se ha detenido este modo.','This mode was stopped.');
      if (item.status!=='ready') return readingReason(item.status,item.source);
      if (item.source==='manual'&&item.reason==='confirmed') return T('Ubicación manual aplicada.','Manual location applied.');
      var reasons={tour:T('Paso del recorrido Demo.','Demo tour step.'),start:T('Inicio del simulador manual.','Manual simulator started.'),config:T('La configuración de zonas o contenido ha cambiado.','Zone or content settings changed.'),confirmed:T('Ubicación confirmada; se aplica el contenido de la zona.','Location confirmed; zone content applied.'),outside:T('La ubicación ha salido de las zonas.','Location moved outside the zones.'),office:T('La ubicación ha cambiado de oficina.','Location moved to another office.')};
      return reasons[item.reason] || reasons.confirmed;
    }
    function renderHistory() {
      var section=byId('simulador-historial');
      if (!lastHistoryState) {section.hidden=true;return;}
      section.hidden=false;
      byId('simulador-historial-toggle').textContent=T('Historial de cambios','Change history')+' ('+history.length+')';
      byId('simulador-historial-toggle').setAttribute('aria-expanded',String(historyOpen));
      byId('simulador-historial-body').hidden=!historyOpen;
      byId('simulador-historial-ayuda').textContent=T('Últimos 20 cambios · hora local · más reciente primero. Sólo en esta página: se borran al recargar y no se exportan con las zonas. No incluye coordenadas.','Last 20 changes · local time · newest first. Only on this page: cleared on reload and not exported with zones. No coordinates included.');
      byId('simulador-historial-vaciar').textContent=T('Vaciar historial','Clear history');
      byId('simulador-historial-vaciar').disabled=!history.length;
      byId('simulador-historial-vacio').hidden=!!history.length;
      byId('simulador-historial-vacio').textContent=T('El próximo cambio aparecerá aquí.','The next change will appear here.');
      var list=byId('simulador-historial-lista');list.replaceChildren();
      history.forEach(function (item) {
        var row=d.createElement('li'), meta=d.createElement('div'), time=d.createElement('time'), origin=d.createElement('span'), title=d.createElement('strong'), reason=d.createElement('p');
        time.setAttribute('datetime',new Date(item.time).toISOString());
        time.textContent=new Date(item.time).toLocaleTimeString(/^en/i.test(d.documentElement.lang||'')?'en-GB':'es-ES',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
        origin.textContent=sourceName(item.source);meta.appendChild(time);meta.appendChild(origin);
        title.textContent=item.status==='ready'?zoneName(item.zone)+' · '+label(item.zone):item.status==='stopped'?T('Player detenido','Player stopped'):T('Player en espera','Player waiting');
        reason.textContent=historyReason(item);row.setAttribute('data-source',item.source);row.setAttribute('data-status',item.status);
        row.appendChild(meta);row.appendChild(title);row.appendChild(reason);list.appendChild(row);
      });
    }
    function recordChange(status,reason) {
      // History describes player decisions, not measurements. Keep no raw fix,
      // coordinates, precision, address, credentials or media identifiers.
      var zone=status==='ready'&&current?{id:current.id,name:current.name||'',tag:current.tag}:null;
      var key=JSON.stringify([source,status,zone&&zone.id,zone&&zone.tag]);
      if (key===lastHistoryKey) return;
      if (!reason && status==='ready') reason=!lastHistoryState&&source==='manual'?'start':!lastHistoryState||lastHistoryState.source!==source||lastHistoryState.status!=='ready'?'confirmed':zone.id==='exterior'?'outside':'office';
      var item={time:Date.now(),source:source,status:status,zone:zone,reason:reason||status};
      lastHistoryKey=key;lastHistoryState=item;history.unshift(item);history=history.slice(0,20);renderHistory();
    }
    function renderDecision() {
      var output=byId('simulador-decision');
      output.setAttribute('aria-live',dragging?'off':'polite');
      var decision=position && (source==='manual' || reading&&reading.status==='ready')?decisionFor(position,config()):null;
      output.hidden=!decision;if (!decision) {output.textContent='';return;}
      function metres(value) {return value<1?T('menos de 1 m','less than 1 m'):Math.round(value)+' m';}
      var target=decision.zone, text='', margin=source!=='manual'?reading.accuracy:0;
      if (target.id==='exterior') {
        text=T('Fuera de las zonas.','Outside the zones.');
        if (decision.nearest) text+=' '+T('La más cercana: ','Nearest: ')+zoneName(decision.nearest.zone)+', '+(source!=='manual'?metres(Math.max(0,decision.nearest.metres-margin))+T(' desde el margen de precisión.',' from the accuracy area.'):T('a ','at ')+metres(decision.nearest.metres)+'.');
      } else {
        if (decision.matches.length>1) text=T('Coinciden: ','Matching zones: ')+decision.matches.map(zoneName).join(', ')+'. '+T('Gana ','Winner: ')+zoneName(target)+T(' por prioridad ',' at priority ')+decision.priority+'.';
        else text=T('Dentro de ','Inside ')+zoneName(target)+'.';
        var remaining=Math.max(0,decision.margin-margin);
        text+=' '+(source!=='manual'?T('Margen de precisión hasta el límite: ','Accuracy margin to the boundary: '):T('Distancia al límite: ','Distance to the boundary: '))+metres(remaining)+'.';
        if (source==='manual'&&remaining<=10) text+=' '+T('Cerca del límite.','Near the boundary.');
      }
      output.textContent=(dragging?T('Al soltar: ','On drop: ')+zoneName(target)+' · '+label(target)+'. ':'')+text;
    }
    function renderText() {
      renderHistory();
      renderTour();
      if (!active) return;
      byId('simulador-zona').textContent = current?zoneName(current):T('Sin oficina confirmada','No confirmed office');
      byId('simulador-contenido').textContent = current?label(current):T('Esperando ubicación','Waiting for location');
      byId('simulador-coordenadas').textContent = position?position.lat.toFixed(5) + ', ' + position.lng.toFixed(5):'—';
      byId('simulador-coordenadas').setAttribute('aria-label',source==='manual'?T('Coordenadas simuladas','Simulated coordinates'):source==='browser'?T('Coordenadas de este dispositivo','This device’s coordinates'):T('Últimas coordenadas recibidas de Luka','Last received Luka coordinates'));
      byId('simulador-estado').textContent = frame?statusText():T('Player en espera','Player waiting');
      byId('simulador-arrastre').textContent = source==='manual'?(touring()?T('Recorrido Demo · puedes pausarlo o arrastrar para tomar el control.','Demo tour · pause it or drag to take control.'):dragging?T('Suelta para aplicar la ubicación.','Drop to apply the location.'):T('Arrastra el marcador o toca el mapa.','Drag the marker or tap the map.')):source==='browser'?T('Mi dispositivo · ubicación del navegador. No es el SmartTag2 de Luka.','My device · browser location. This is not Luka’s SmartTag2.'):T('Siguiendo Luka · actualización cada 60 segundos.','Following Luka · updates every 60 seconds.');
      byId('simulador-lectura').textContent = source!=='manual'?readingText():T('Arrastre manual · no modifica la ubicación real de Luka.','Manual drag · does not change Luka’s real location.');
      byId('simulador-badge').textContent = source==='manual'?(touring()?T('DEMO · RECORRIDO','DEMO · TOUR'):T('SIMULACIÓN','SIMULATION')):source==='browser'?T('MI UBICACIÓN','MY LOCATION'):T('SEGUIR LUKA','FOLLOW LUKA');
      root.setAttribute('aria-label',source==='manual'?T('Player de ubicación simulada','Simulated location player'):source==='browser'?T('Player según ubicación de este dispositivo','Player following this device’s location'):T('Player según ubicación de Luka','Player following Luka location'));
      byId('simulador-abrir').textContent = T('Abrir player','Open player');
      byId('simulador-abrir').hidden = !frame;
      byId('simulador-zonas').setAttribute('aria-label',T('Zonas y contenido','Zones and content'));
      byId('simulador-cerrar').textContent = source==='manual'?T('Cerrar simulador','Close simulator'):source==='browser'?T('Detener mi ubicación','Stop my location'):T('Dejar de seguir','Stop following');
      renderDecision();
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
      if (frame) frame.title = 'admira.tv · ' + label(current) + ' · ' + (source==='manual'?T('simulación','simulation'):source==='browser'?T('mi dispositivo','my device'):'Luka');
      if (editor) editor.renderText();
    }
    function loadPlayer(zone) {
      clearTimeout(timer);
      bank.sync(config());
      frame = bank.show(zone);
      byId('simulador-abrir').href = frame.src;
      // A preloaded player that already reported media is connected the moment Luka arrives.
      connection = bank.isReady(frame) ? 'connected' : 'loading';
      if (connection !== 'connected') timer = setTimeout(function () {if (!active) return;connection = 'waiting';renderText();},20000);
    }
    function applyZone(next,reason) {
      var key=next.id+'|'+next.tag;
      current=next;
      // Edited zones get their player before Luka reaches them.
      if (bank.size()) bank.sync(config());
      if (key !== currentKey) {currentKey=key;loadPlayer(current);}
      recordChange('ready',reason);
    }
    function clearPlayer() {
      clearTimeout(timer);
      bank.clear();frame=null;current=null;currentKey='';
    }
    function updateLuka(device,error,reason) {
      if (!active || source!=='luka') return;
      latestLuka=device;feedError=!!error;
      reading=feedError?{status:'network'}:resolveReading(device,config(),Date.now());
      position=reading.point || null;
      if (reading.status==='ready') applyZone(reading.zone,reason);else {clearPlayer();recordChange(reading.status,reason);}
      renderText();
    }
    function updateBrowser(state,reason) {
      if (!active || source!=='browser') return;
      browserState=state || {status:'unsupported'};
      reading=browserState.status==='position'?resolveBrowserReading(browserState.position,config(),Date.now()):{status:browserState.status};
      position=reading.point || null;
      if (reading.status==='ready') applyZone(reading.zone,reason);else {clearPlayer();recordChange(reading.status,reason);}
      if (deviceLayer) {
        // Only the current valid-time fix is drawn; errors/staleness clear it.
        if (position && reading.status!=='stale') {
          if (!deviceMarker) {
            var icon=L.divIcon({className:'mapa-sim-marker mapa-device-location',html:'<span aria-hidden="true">◉</span><span>'+T('Mi dispositivo','My device')+'</span>',iconSize:[145,36],iconAnchor:[18,18]});
            deviceMarker=L.marker([position.lat,position.lng],{icon:icon,draggable:false,alt:T('Mi dispositivo','My device')}).addTo(deviceLayer);
            deviceHalo=L.circle([position.lat,position.lng],{radius:0,color:'#63e6d5',weight:1,fillOpacity:.12,interactive:false}).addTo(deviceLayer);
          }
          deviceMarker.setLatLng(position);deviceHalo.setLatLng(position).setRadius(Number.isFinite(reading.accuracy)?reading.accuracy:0);
        } else {deviceLayer.clearLayers();deviceMarker=null;deviceHalo=null;}
      }
      renderText();
    }
    function move(point, commit, reason) {
      if (source!=='manual') return;
      if (!active || !valid(point)) return;
      if (reason!=='tour') stopTour('manual');
      position = {lat:point.lat,lng:point.lng};
      if (marker) marker.setLatLng(position);
      byId('simulador-coordenadas').textContent = position.lat.toFixed(5) + ', ' + position.lng.toFixed(5);
      if (!commit) {
        dragging=true;
        byId('simulador-arrastre').textContent = T('Suelta para aplicar la ubicación.','Drop to apply the location.');
        renderDecision();
        return;
      }
      dragging=false;
      applyZone(zoneFor(position,config()),reason);
      renderText();
      // Only dropped positions leave the page (luka-remoto.js, when its switch is on).
      if (options.onManualPosition) options.onManualPosition({lat:position.lat,lng:position.lng});
    }
    function clickMap(event) {if (active && source==='manual' && event.latlng) move(event.latlng,true);}
    function stop() {
      stopTour('source');
      if (active) recordChange('stopped');
      active = false;
      if (browserSource) browserSource.stop();
      browserState=null;deviceLayer=null;deviceMarker=null;deviceHalo=null;
      byId('ubicacion-activar').disabled=false;byId('ubicacion-detener').hidden=true;
      dragging = false;
      clearTimeout(timer);
      bank.clear();
      frame = null;
      if (layer) map.removeLayer(layer);
      if (map.off) map.off('click',clickMap);
      if (editor) editor.deactivate();
      layer = null;marker = null;current = null;currentKey = '';position = null;
      root.hidden = true;controls.hidden = true;
      byId('simular-player').setAttribute('aria-pressed','false');
      byId('seguir-luka').setAttribute('aria-pressed','false');
      byId('mapa').classList.remove('is-simulating');
      if (options.onStateChange) options.onStateChange();
    }
    function start(mode) {
      if (active) return;
      source=mode==='luka'?'luka':mode==='browser'?'browser':'manual';
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
      if (source==='browser') {
        byId('ubicacion-activar').disabled=true;byId('ubicacion-detener').hidden=false;
        deviceLayer=L.layerGroup().addTo(layer);fitZones();updateBrowser({status:'locating'});
        if (browserSource) browserSource.start();else updateBrowser({status:'unsupported'});
        if (options.onStateChange) options.onStateChange();return;
      }
      if (source==='luka') {updateLuka(null,false);if (options.onStateChange) options.onStateChange();return;}
      var icon = L.divIcon({className:'mapa-sim-marker',html:'<span aria-hidden="true">◉</span><span>Luka · manual</span>',iconSize:[125,36],iconAnchor:[18,18]});
      var first=config().zones[0] || outside;
      marker = L.marker([first.lat,first.lon],{icon:icon,draggable:true,autoPan:true,alt:'Luka · manual',title:T('Arrastra Luka para probar otra oficina','Drag Luka to try another office')}).addTo(layer);
      marker.on('drag',function () {move(marker.getLatLng(),false);});
      marker.on('dragend',function () {move(marker.getLatLng(),true);});
      map.on('click',clickMap);
      move({lat:first.lat,lng:first.lon},true);
      fitZones();
      if (options.onStateChange) options.onStateChange();
    }
    byId('simulador-cerrar').addEventListener('click',stop);
    byId('simulador-recorrer').addEventListener('click',function () {tourLoop=false;startTour();});
    byId('simulador-recorrido-pausa').addEventListener('click',pauseTour);
    byId('simulador-recorrido-detener').addEventListener('click',function () {stopTour('user');renderText();});
    d.addEventListener('visibilitychange',function () {if (d.hidden) {stopTour('hidden');renderText();}});
    G.addEventListener('pagehide',function () {stopTour('hidden');});
    byId('simulador-historial-toggle').addEventListener('click',function () {historyOpen=!historyOpen;renderHistory();});
    byId('simulador-historial-vaciar').addEventListener('click',function () {history=[];renderHistory();});
    G.addEventListener('message',function (event) {
      if (!active || event.origin !== 'https://admira.tv') return;
      var data = event.data;
      if (!data || data.source !== 'admira-tv-canal' || data.event !== 'media-state' || !data.id) return;
      var sender = bank.markReady(event.source, data.id);
      if (!sender || sender !== frame) return;
      connection = 'connected';clearTimeout(timer);renderText();
    });
    return {start:start,stop:stop,renderText:renderText,updateLuka:updateLuka,isBrowser:function () {return active&&source==='browser';},isFollowing:function () {return active&&source==='luka';},isActive:function () {return active;},move:function (point) {move(point,true);},startLoopTour:function () {tourLoop=true;startTour();return touring();}};
  }

  G.AdmiraMapaSimulador = {create:create,zoneFor:zoneFor,decisionFor:decisionFor,resolveReading:resolveReading,resolveBrowserReading:resolveBrowserReading,playerURL:playerURL,zones:zones,outside:outside};
})(window,document);
