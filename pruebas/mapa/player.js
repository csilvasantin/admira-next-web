/*
 * Player por ubicación en un móvil (Carlos, 29-oct-2026 · misión DCL-fb1c7a60).
 *
 * El GPS de este dispositivo elige la zona y admira.tv reproduce su tema. Usa las
 * reglas del simulador: una zona gana solo cuando todo el círculo de precisión cae
 * a un lado del límite; si la lectura es ambigua, vieja o sin precisión, sigue el
 * contenido que ya suena. Las zonas son las publicadas desde el editor del mapa
 * (/api/ubicacion/zonas); sin ellas, las cinco oficinas de ejemplo.
 *
 * A admira.tv solo le llega el tema y una identidad estable de este navegador.
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
    var identity = S.stableIdentity('movil');
    var config = Z.officePreset, origin = 'example', rev = 0, zonesState = 'loading';
    var zone = null, frame = null, frameURL = '', started = false, gps = {status:'off'}, lastPosition = null, since = null, lock = null;
    var source = G.AdmiraMapaUbicacionDispositivo.create({onChange:onLocation});

    function show(next) {
      if (!sameZone(zone, next)) since = now();
      zone = next;
      var url = S.playerURL(next, identity);
      if (url !== frameURL) {
        frameURL = url;
        if (!frame) {
          frame = d.createElement('iframe');
          frame.setAttribute('allow','autoplay; fullscreen; geolocation \'none\'; camera \'none\'; microphone \'none\'');
          frame.setAttribute('sandbox','allow-scripts allow-same-origin');
          frame.setAttribute('referrerpolicy','no-referrer');
          frame.setAttribute('allowfullscreen','');
          byId('mp-pantalla').replaceChildren(frame);
        }
        frame.title = 'admira.tv · ' + Z.themeName(next.tag, T);
        frame.src = url;
      }
      render();
    }
    function apply() {
      if (!started) return render();
      var reading = lastPosition ? S.resolveBrowserReading(lastPosition, config, now()) : null;
      if (reading) gps = {status:reading.status, accuracy:lastPosition.coords.accuracy};
      show(decide(zone || exterior(config), reading));
    }
    function onLocation(state) {
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
          config = valid;origin = 'published';rev = data.rev;
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
    function start() {
      if (started) return;
      started = true;
      show(zone || exterior(config));
      gps = {status:'locating'};
      source.start();keepAwake();render();
    }
    function stop() {
      if (!started) return;
      started = false;source.stop();lastPosition = null;gps = {status:'off'};
      if (lock) {var held = lock;lock = null;held.release().catch(function () {});}
      render();
    }
    function gpsText() {
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
      var tone = {ready:'ok',locating:'wait',ambiguous:'wait',stale:'wait',timeout:'wait',paused:'wait',accuracy:'wait'}[gps.status] || (gps.status === 'off' ? 'off' : 'bad');
      byId('mp-zona').textContent = !zone ? '—' : zone.id === 'exterior' ? T('Fuera de zona','Outside the zones') : zone.name;
      byId('mp-tema').textContent = zone ? Z.themeName(zone.tag, T) : '';
      byId('mp-gps').textContent = gpsText();
      byId('mp-gps').setAttribute('data-tono', tone);
      byId('mp-desde').textContent = since && zone ? T('desde las ','since ') + new Date(since).toLocaleTimeString(T('es-ES','en-GB'), {hour:'2-digit',minute:'2-digit'}) : '';
      byId('mp-zonas').textContent = origin === 'published'
        ? T('Zonas publicadas · rev ','Published zones · rev ') + rev + ' · ' + config.zones.length
        : (zonesState === 'session' ? T('Sin sesión: ','Not signed in: ') : zonesState === 'error' ? T('Sin conexión con el mapa: ','Map unreachable: ') : '') + T('zonas de ejemplo (cinco oficinas)','example zones (five offices)');
      byId('mp-encendida').hidden = !lock;
      byId('mp-inicio').hidden = started;
      byId('mp-detener').hidden = !started;
    }

    [['mp-titulo','Player por ubicación','Location player'],
     ['mp-intro','El contenido cambia según la zona en la que esté este móvil. Camina entre las zonas y mira cómo cambia.','Content changes with the zone this phone is in. Walk between zones and watch it change.'],
     ['mp-nota','Usa el GPS de este dispositivo solo mientras la página está abierta. La posición no se guarda ni se envía: a admira.tv solo le llega el tema de la zona.','It uses this device’s GPS only while the page is open. The position is not saved or sent: admira.tv only receives the zone’s theme.'],
     ['mp-empezar','Empezar','Start'],['mp-detener','Detener','Stop'],['mp-mapa','Mapa','Map'],['mp-encendida','Pantalla encendida','Screen kept on']
    ].forEach(function (item) {byId(item[0]).textContent = T(item[1], item[2]);});
    byId('mp-empezar').addEventListener('click', start);
    byId('mp-detener').addEventListener('click', stop);
    d.addEventListener('visibilitychange', function () {
      // The location module pauses itself while hidden; resume what the user started.
      if (!d.hidden && started) {source.start();keepAwake();}
    });
    render();
    return {start:start,stop:stop,loadZones:loadZones,state:function () {return {zone:zone,gps:gps,origin:origin,rev:rev,frameURL:frameURL,identity:identity,started:started,zonesState:zonesState,awake:!!lock};}};
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
