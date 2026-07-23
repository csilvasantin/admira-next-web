(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AdmiraRoomDeviceLab = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function bucket(value,limits,labels) {
    var number=Number(value);
    if(!Number.isFinite(number))return 'unknown';
    for(var index=0;index<limits.length;index+=1)if(number<limits[index])return labels[index];
    return labels[labels.length-1];
  }
  function codec(video,type) {
    if(!video||typeof video.canPlayType!=='function')return 'unknown';
    var result=video.canPlayType(type);
    return result==='probably'?'probably':result==='maybe'?'maybe':'no';
  }
  function probe(environment) {
    var windowObject=environment&&environment.window||null;
    var documentObject=environment&&environment.document||null;
    var navigatorObject=environment&&environment.navigator||null;
    var width=windowObject&&windowObject.innerWidth;
    if(!windowObject||!documentObject||!navigatorObject||!Number.isFinite(Number(width))||Number(width)<=0){
      return {
        schemaVersion:1,level:'unavailable',device:null,
        reason:'El entorno no expone viewport, document y navigator suficientes; no se infiere un dispositivo.',
        privacy:'Sin sondeo, red, almacenamiento ni envío.'
      };
    }
    var video=typeof documentObject.createElement==='function'?documentObject.createElement('video'):null;
    var device=Number(width)>0&&Number(width)<720?'mobile':'laptop';
    return {
      schemaVersion:1,level:'capability',device:device,
      codecs:{
        h264:codec(video,'video/mp4; codecs="avc1.42E01E"'),
        vp9:codec(video,'video/webm; codecs="vp9"'),
        av1:codec(video,'video/mp4; codecs="av01.0.05M.08"')
      },
      autoplay:{requiresGesture:true,userActivation:Boolean(navigatorObject&&navigatorObject.userActivation&&navigatorObject.userActivation.isActive)},
      performance:{
        memory:bucket(navigatorObject&&navigatorObject.deviceMemory,[4,8],['low','medium','high']),
        cores:bucket(navigatorObject&&navigatorObject.hardwareConcurrency,[4,8],['low','medium','high']),
        reducedMotion:Boolean(windowObject&&typeof windowObject.matchMedia==='function'&&windowObject.matchMedia('(prefers-reduced-motion: reduce)').matches)
      },
      legibility:{
        viewport:bucket(width,[720,1280,1920],['compact','standard','wide','ultrawide']),
        density:bucket(windowObject&&windowObject.devicePixelRatio,[1.5,2.5],['standard','high','very-high'])
      },
      privacy:'Datos agregados en memoria; sin user-agent, resolución exacta, red, almacenamiento ni envío.'
    };
  }
  function checklistStatus(lab,probeValue) {
    var summary=lab&&lab.summary;
    if(!summary)return 'Ensayo pendiente: no existe matriz para móvil, portátil, proyector y videowall.';
    var local=probeValue&&probeValue.level==='capability'?' Capacidad local detectada en '+probeValue.device+'; no es una medición.':'';
    if(Number(summary.measured)===Number(summary.total)&&Number(summary.failed)===0){
      return 'Ensayo medido: '+summary.measured+' combinaciones con evidencia y ningún fallo.'+local;
    }
    return 'Ensayo parcial: '+Number(summary.measured||0)+' medidas, '+Number(summary.capability||0)+' por capacidades, '+
      Number(summary.inferred||0)+' inferidas y '+Number(summary.unavailable||0)+' no disponibles.'+local;
  }
  return {probe:probe,checklistStatus:checklistStatus};
});
