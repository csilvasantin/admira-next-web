/* The page registers its verbs before admira-frame.js; the canonical frame
   supplies /marca and /idioma through experto-admiranext.js. */
window.ADMIRA_FRAME_VERBS = (window.ADMIRA_FRAME_VERBS || []).concat([
  {id:'demo',uso:'mapa|luka|off',ayuda:'Abre el mapa con datos sintéticos; luka recorre las oficinas con el player; off vuelve a datos reales',ayudaEn:'Open the map with synthetic data; luka walks the offices with the player; off returns to real data',run:function(args,ctx){
    var modo = String(args[0] || 'mapa').toLowerCase();
    if (modo === 'luka') {
      if (window.AdmiraMapaDemoLuka && window.AdmiraMapaDemoLuka()) ctx.imprimir('DEMO LUKA · Luka recorre las cinco oficinas; el player cambia de contenido en cada una.');
      else ctx.error('No se ha podido arrancar la demo de Luka.');
      return;
    }
    if (!/^(mapa|map|off|real)$/.test(modo)) {ctx.error('Uso: /demo mapa | /demo luka | /demo off');return;}
    var demo = modo === 'mapa' || modo === 'map';
    document.getElementById(demo ? 'modo-demo' : 'modo-real').click();
    ctx.imprimir(demo ? 'DEMO · Datos sintéticos; ninguna ubicación real.' : 'Consultando ubicaciones reales…');
  }},
  {id:'refrescar',aliases:['actualizar'],ayuda:'Vuelve a consultar las últimas ubicaciones',ayudaEn:'Reload the latest locations',run:function(args,ctx){document.getElementById('refrescar').click();ctx.imprimir('Actualizando mapa…');}},
  {id:'centrar',ayuda:'Encuadra todos los equipos con coordenadas',ayudaEn:'Fit all devices with coordinates',run:function(args,ctx){document.getElementById('centrar').click();ctx.imprimir('Centrando equipos…');}}
]);
