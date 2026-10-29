(function (G, d) {
  'use strict';
  // No acquisition at construction, load, import or reload. Only start() asks
  // the browser, after the explicit activation button in mapa.js.
  function create(options) {
    var active=false, watch=null, interval=null, generation=0, latest=null, lastStamp=-Infinity;
    function emit(value) {latest=value;options.onChange(value);}
    function stop() {
      active=false;++generation;
      if (watch!==null) G.navigator.geolocation.clearWatch(watch);
      watch=null;G.clearInterval(interval);interval=null;latest=null;lastStamp=-Infinity;
    }
    function start() {
      if (active) return;
      var policy=d.permissionsPolicy || d.featurePolicy;
      if (!G.isSecureContext) {emit({status:'insecure'});return;}
      if (policy && typeof policy.allowsFeature==='function' && !policy.allowsFeature('geolocation')) {emit({status:'policy'});return;}
      if (!G.navigator || !G.navigator.geolocation) {emit({status:'unsupported'});return;}
      if (d.hidden) {emit({status:'hidden'});return;}
      active=true;var ticket=++generation;emit({status:'locating'});
      try {
        var id=G.navigator.geolocation.watchPosition(function (fix) {
          if (!active || ticket!==generation) return;
          var stamp=fix&&fix.timestamp;
          // Replayed/cached or out-of-order callbacks are not new measurements.
          if (Number.isFinite(stamp) && stamp<=lastStamp) return;
          if (Number.isFinite(stamp) && stamp<=Date.now()+60000) lastStamp=stamp;
          var c=fix&&fix.coords;
          emit({status:'position',position:{timestamp:stamp,coords:{latitude:c&&c.latitude,longitude:c&&c.longitude,accuracy:c&&c.accuracy}}});
        },function (error) {
          if (!active || ticket!==generation) return;
          var status=error&&error.code===1?'denied':error&&error.code===3?'timeout':'unavailable';
          if (status==='denied') stop();
          emit({status:status});
        },{enableHighAccuracy:true,maximumAge:0,timeout:15000});
        // Also safe for a synchronous callback/denial in an embedded browser.
        if (!active || ticket!==generation) {G.navigator.geolocation.clearWatch(id);return;}
        watch=id;
        interval=G.setInterval(function () {if (active && latest) options.onChange(latest);},15000);
      } catch (_) {stop();emit({status:'unavailable'});}
    }
    function leave() {if (active || latest) {stop();options.onChange({status:'stopped'});}}
    G.addEventListener('pagehide',leave);
    d.addEventListener('visibilitychange',function () {if (d.hidden) leave();});
    return {start:start,stop:stop};
  }
  G.AdmiraMapaUbicacionDispositivo={create:create};
})(window,document);
