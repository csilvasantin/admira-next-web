/*
 * Player por ubicación en un móvil (Carlos, 29-oct-2026 · misión DCL-fb1c7a60).
 *
 * El GPS de este dispositivo elige la zona y admira.tv reproduce su tema. Usa las
 * reglas del simulador: una zona gana solo cuando todo el círculo de precisión cae
 * a un lado del límite; si la lectura es ambigua, vieja o sin precisión, sigue el
 * contenido que ya suena. Las zonas son las publicadas desde el editor del mapa
 * (/api/ubicacion/zonas); sin ellas, las cinco oficinas de ejemplo.
 *
 * A admira.tv solo le llega el tema y la pantalla virtual de cada Xperiencia
 * (virtual-mapa-xperiencia-<zona>), con un player precargado por oficina.
 * La posición no sale del dispositivo ni se guarda.
 */
(function (G, d) {
  'use strict';
  var ZONES_REFRESH_MS = 60000;

  // A confirmed reading moves the player; anything else keeps what is playing.
  function decide(current, reading) {
    return reading && reading.status === 'ready' && reading.zone ? reading.zone : current;
  }
  function exterior(config) {return {id:'exterior',name:'',tag:config.outside.tag};}
  function sameZone(a, b) {return !!a && !!b && a.id === b.id && a.tag === b.tag && a.name === b.name;}

  function create(options) {
    options = options || {};
    var S = G.AdmiraMapaSimulador, Z = G.AdmiraMapaZonas;
    var byId = function (id) {return d.getElementById(id);};
    var T = function (es,en) {return /^en/i.test(d.documentElement.lang || '') ? en : es;};
    var now = options.now || function () {return Date.now();};
    var config = Z.officePreset, origin = 'example', rev = 0, zonesState = 'loading';
    var zone = null, frameURL = '', started = false, gps = {status:'off'}, lastPosition = null, since = null, lock = null;
    // mode: 'gps' follows this phone; 'luka' follows the Luka moved in the map simulator.
    var mode = 'gps', luka = null, lukaState = 'waiting', lukaTimer = null, polling = false;
    var device = G.AdmiraMapaUbicacionDispositivo.create({onChange:onLocation});

    // One preloaded admira.tv player per Xperiencia (players-xperiencias.js), loaded with the page.
    var bank = G.AdmiraMapaXperiencias.create({host:byId('mp-pantalla'), playerURL:S.playerURL, title:function (z) {return 'admira.tv · ' + Z.themeName(z.tag, T);}});
    bank.sync(config);

    function show(next) {
      if (!sameZone(zone, next)) since = now();
      zone = next;
      bank.sync(config);
      frameURL = bank.show(next).src;
      render();
    }
    function apply() {
      if (!started) return render();
      // The simulated Luka is an exact point, like the manual marker on the map.
      if (mode === 'luka') return luka ? show(S.zoneFor({lat:luka.lat,lng:luka.lon}, config)) : render();
      var reading = lastPosition ? S.resolveBrowserReading(lastPosition, config, now()) : null;
      if (reading) gps = {status:reading.status, accuracy:lastPosition.coords.accuracy};
      show(decide(zone || exterior(config), reading));
    }
    async function pollLuka() {
      if (!started || mode !== 'luka' || polling || d.hidden) return;
      polling = true;
      try {
        var response = await G.fetch('/api/ubicacion/simulacion', {method:'GET',cache:'no-store',credentials:'same-origin',headers:{Accept:'application/json'}});
        if (response.status === 401) {lukaState = 'session';return;}
        var data = await response.json();
        if (!response.ok || !data || data.ok !== true) throw new Error('simulacion');
        var next = data.luka;
        if (next && Number.isFinite(next.lat) && Number.isFinite(next.lon)) {luka = next;lukaState = 'ok';}
        else {luka = null;lukaState = 'waiting';}
      } catch (_) {lukaState = 'error';}
      finally {polling = false;if (started && mode === 'luka') apply();}
    }
    function onLocation(state) {
      if (mode !== 'gps') return;
      if (state.status === 'stopped') {gps = {status:'paused'};return render();}
      if (state.status !== 'position') {gps = {status:state.status};return render();}
      lastPosition = state.position;
      apply();
    }
    async function loadZones() {
      try {
        var response = await G.fetch('/api/ubicacion/zonas', {method:'GET',cache:'no-store',credentials:'same-origin',headers:{Accept:'application/json'}});
        if (response.status === 401) {zonesState = 'session';return render();}
        var data = await response.json();
        if (!response.ok || !data || data.ok !== true) throw new Error('zonas');
        var valid = data.zonas && Z.validate(data.zonas);
        zonesState = 'ok';
        if (valid && (origin !== 'published' || data.rev !== rev)) {
          config = valid;origin = 'published';rev = data.rev;bank.sync(config);
          // A zone edited or removed on the desk applies here on the next reading.
          if (zone) zone = config.zones.find(function (z) {return z.id === zone.id;}) || exterior(config);
          return apply();
        }
      } catch (_) {zonesState = 'error';}
      render();
    }
    async function keepAwake() {
      if (!started || d.hidden || lock || !G.navigator || !G.navigator.wakeLock) return;
      try {
        lock = await G.navigator.wakeLock.request('screen');
        lock.addEventListener('release', function () {lock = null;render();});
      } catch (_) {lock = null;}
      render();
    }
    function follow(next) {
      mode = next === 'luka' ? 'luka' : 'gps';
      if (mode === 'luka') {
        device.stop();lastPosition = null;gps = {status:'off'};lukaState = 'waiting';
        G.clearInterval(lukaTimer);lukaTimer = G.setInterval(pollLuka, 2000);pollLuka();
      } else {
        G.clearInterval(lukaTimer);lukaTimer = null;luka = null;
        gps = {status:'locating'};device.start();
      }
      render();
    }
    function start(kind) {
      if (started) return;
      started = true;
      show(zone || exterior(config));
      follow(kind);keepAwake();
    }
    function stop() {
      if (!started) return;
      started = false;device.stop();G.clearInterval(lukaTimer);lukaTimer = null;lastPosition = null;luka = null;gps = {status:'off'};
      if (lock) {var held = lock;lock = null;held.release().catch(function () {});}
      render();
    }
    function lukaText() {
      if (lukaState === 'session') return T('Sin sesión: entra con Google para seguir a Luka','Not signed in: sign in with Google to follow Luka');
      if (lukaState === 'error') return T('Sin conexión con el mapa; reintentando','Map unreachable; retrying');
      if (!luka) return T('Esperando a Luka: muévelo en el mapa con «Mover también el móvil»','Waiting for Luka: move it on the map with “Also move the phone”');
      var seconds = Math.max(0, Math.round((now() - Date.parse(luka.ts)) / 1000));
      var ago = seconds < 60 ? seconds + ' s' : Math.round(seconds / 60) + ' min';
      return T('Luka del simulador · movido hace ','Simulated Luka · moved ') + ago + T('',' ago');
    }
    function gpsText() {
      if (mode === 'luka' && started) return lukaText();
      var metres = Number.isFinite(gps.accuracy) ? ' · ±' + Math.round(gps.accuracy) + ' m' : '';
      switch (gps.status) {
        case 'ready': return T('Ubicación confirmada','Location confirmed') + metres;
        case 'ambiguous': return T('Cerca de un límite: sigue el contenido','Near a boundary: content stays') + metres;
        case 'stale': return T('Lectura antigua: sigue el contenido','Old reading: content stays');
        case 'accuracy': return T('Sin precisión: sigue el contenido','No accuracy: content stays');
        case 'locating': return T('Buscando ubicación…','Finding location…');
        case 'denied': return T('Permiso de ubicación denegado en este navegador','Location permission denied in this browser');
        case 'timeout': return T('El GPS no responde; sigo intentándolo','GPS is not responding; still trying');
        case 'paused': return T('En pausa con la página oculta','Paused while the page is hidden');
        case 'insecure': case 'policy': case 'unsupported': case 'unavailable': return T('Este navegador no da la ubicación','This browser does not provide location');
        default: return T('GPS apagado','GPS off');
      }
    }
    function render() {
      var tone = mode === 'luka' && started ? ({ok:'ok',waiting:'wait'}[lukaState] || 'bad')
        : {ready:'ok',locating:'wait',ambiguous:'wait',stale:'wait',timeout:'wait',paused:'wait',accuracy:'wait'}[gps.status] || (gps.status === 'off' ? 'off' : 'bad');
      byId('mp-zona').textContent = !zone ? '—' : zone.id === 'exterior' ? T('Fuera de zona','Outside the zones') : zone.name;
      byId('mp-tema').textContent = zone ? Z.themeName(zone.tag, T) : '';
      byId('mp-gps').textContent = gpsText();
      byId('mp-gps').setAttribute('data-tono', tone);
      byId('mp-desde').textContent = since && zone ? T('desde las ','since ') + new Date(since).toLocaleTimeString(T('es-ES','en-GB'), {hour:'2-digit',minute:'2-digit'}) : '';
      byId('mp-zonas').textContent = origin === 'published'
        ? T('Zonas publicadas · rev ','Published zones · rev ') + rev + ' · ' + config.zones.length
        : (zonesState === 'session' ? T('Sin sesión: ','Not signed in: ') : zonesState === 'error' ? T('Sin conexión con el mapa: ','Map unreachable: ') : '') + T('zonas de ejemplo (cinco oficinas)','example zones (five offices)');
      byId('mp-zonas').textContent += T(' · players listos ',' · players ready ') + bank.readyCount() + '/' + bank.size();
      byId('mp-encendida').hidden = !lock;
      byId('mp-inicio').hidden = started;
      byId('mp-detener').hidden = !started;
      byId('mp-fuente').hidden = !started;
      byId('mp-fuente').textContent = mode === 'luka' ? T('Usar GPS','Use GPS') : T('Seguir a Luka','Follow Luka');
    }

    [['mp-titulo','Player por ubicación','Location player'],
     ['mp-intro','El contenido cambia según la zona en la que esté este móvil. Camina entre las zonas y mira cómo cambia.','Content changes with the zone this phone is in. Walk between zones and watch it change.'],
     ['mp-nota','Usa el GPS de este dispositivo solo mientras la página está abierta. La posición no se guarda ni se envía: a admira.tv solo le llega el tema de la zona.','It uses this device’s GPS only while the page is open. The position is not saved or sent: admira.tv only receives the zone’s theme.'],
     ['mp-empezar','Empezar con el GPS del móvil','Start with this phone’s GPS'],['mp-empezar-luka','Seguir a Luka del mapa','Follow Luka from the map'],
     ['mp-luka-nota','Con «Seguir a Luka», el contenido cambia cuando alguien mueve a Luka en el simulador del mapa con «Mover también el móvil». No usa el GPS.','With “Follow Luka”, content changes when someone moves Luka in the map simulator with “Also move the phone”. GPS is not used.'],
     ['mp-detener','Detener','Stop'],['mp-mapa','Mapa','Map'],['mp-encendida','Pantalla encendida','Screen kept on']
    ].forEach(function (item) {byId(item[0]).textContent = T(item[1], item[2]);});
    byId('mp-empezar').addEventListener('click', function () {start('gps');});
    byId('mp-empezar-luka').addEventListener('click', function () {start('luka');});
    byId('mp-fuente').addEventListener('click', function () {if (started) follow(mode === 'luka' ? 'gps' : 'luka');});
    byId('mp-detener').addEventListener('click', stop);
    G.addEventListener('message', function (event) {
      var data = event.data;
      if (event.origin !== 'https://admira.tv' || !data || data.source !== 'admira-tv-canal' || data.event !== 'media-state' || !data.id) return;
      if (bank.markReady(event.source, data.id)) render();
    });
    d.addEventListener('visibilitychange', function () {
      // The location module pauses itself while hidden; resume what the user started.
      if (d.hidden || !started) return;
      if (mode === 'gps') device.start();else pollLuka();
      keepAwake();
    });
    render();
    return {start:start,stop:stop,follow:follow,pollLuka:pollLuka,loadZones:loadZones,state:function () {return {zone:zone,gps:gps,mode:mode,luka:luka,lukaState:lukaState,origin:origin,rev:rev,frameURL:frameURL,players:bank.size(),ready:bank.readyCount(),started:started,zonesState:zonesState,awake:!!lock};}};
  }

  G.AdmiraMapaPlayer = {create:create,decide:decide};
  if (d.documentElement.getAttribute && d.documentElement.getAttribute('data-mapa-player') === 'auto') {
    // Same language the user chose with /idioma on the map (admira-frame.js keys).
    try {if (G.localStorage.getItem('admiranext_lang') === 'en') d.documentElement.lang = 'en';} catch (_) {}
    var bar = d.querySelector('.mp-barra');
    var fitBar = function () {d.documentElement.style.setProperty('--mp-barra', bar.offsetHeight + 'px');};
    fitBar();G.addEventListener('resize', fitBar);
    var player = create();
    player.loadZones();
    G.setInterval(function () {if (!d.hidden) player.loadZones();}, ZONES_REFRESH_MS);
    var full = d.getElementById('mp-completa'), root = d.documentElement;
    full.hidden = !root.requestFullscreen;
    full.addEventListener('click', function () {
      if (d.fullscreenElement) d.exitFullscreen().catch(function () {});
      else root.requestFullscreen().catch(function () {});
    });
  }
})(window, document);
