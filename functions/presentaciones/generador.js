export async function onRequestGet(context){
  const requested=new URL(context.request.url);
  if(/^\/presentaciones\/generador(?:\.html)?\/?$/i.test(requested.pathname)){
    requested.pathname='/presentaciones/';
    return Response.redirect(requested.toString(),308);
  }
  const source=new URL('/presentaciones/generador.html',context.request.url);
  const asset=await context.env.ASSETS.fetch(source);
  if(!asset.ok)return new Response('Generador no disponible',{status:503});
  let html=await asset.text();
  // El HTML ya apunta al bundle real, así que esta línea NO hace nada en la ruta
  // viva: se queda como red para una copia antigua del HTML que aún referencie el
  // nombre genérico (que no existe en /assets y daría 404). La clave es la MISMA
  // que la del HTML a propósito — cuando eran dos, el mismo fichero de 51 KB se
  // podía servir bajo dos URLs distintas y la consola del generador enseñaba una
  // versión que no era la que corría. (NeoMBP16 · MacBook Pro 16, 4-ago-2026.)
  html=html.replace('/assets/presentation-generator.js"','/assets/presentation-generator-20260721-11.js?v=20261007-store-biz-editor-1"');
  // BARRA DE LA INTRANET (Carlos, 3-oct-2026: «que Presentaciones lleve también la barra
  // de la intranet»). El HTML trae la cabecera del grupo (<body data-yk-frame="cabecera">,
  // la de /proyectos/) y declara sus data-yk-slot; el script cuadrático rellena ▤ y
  // registra los verbos de ⌘, y admira-frame.js (MODO CABECERA) monta
  // [☰] ADmiraNeXT · Proyectos · … · Presentaciones … ● Acceso privado [▤] [⌘].
  // Hasta el 3-oct era el modo barra («GENERADOR»), desde el 2-oct (tras el PR #28).
  html=html.replace('</head>','<link rel="stylesheet" href="/assets/presentation-generator-quadratic.css?v=20261003-cabecera"></head>');
  html=html.replace('</head>','<link rel="stylesheet" href="/assets/presentation-media-library.css?v=20260724-1"></head>');
  html=html.replace('</body>','<script src="/assets/presentation-generator-quadratic.js?v=20261003-cabecera"></script><script src="/assets/admira-frame.js?v=20261004-5053" defer></script><script src="/assets/presentation-media-library.js?v=20260724-1"></script></body>');
  // PROSPECT (01-10-2026): interruptor y selector de marca del destinatario (marca blanca).
  html=html.replace('</head>','<link rel="stylesheet" href="/marcablanca/marcablanca.css?v=20261001-prospect"><link rel="stylesheet" href="/assets/presentation-prospect.css?v=20261003-switch"></head>');
  html=html.replace('</body>','<script type="module" src="/assets/presentation-prospect.js?v=20261010-censo"></script></body>');
  // PROPUESTA AUTOMÁTICA (02-10-2026 · FLT-101369): marca → estudio → presentación → plataforma desde una
  // marca, web o idea. Mismo lanzador que /marcablanca, misma API (POST /presentaciones/api/propuesta).
  html=html.replace('</head>','<link rel="stylesheet" href="/marcablanca/propuesta-automatica.css?v=20261002-propuesta"></head>');
  html=html.replace('<form id="generator">','<section class="panel" id="propuestaAutomatica"><h2>Propuesta automática</h2><p class="sub">De una marca, su web o una idea a la propuesta completa: estudio de la compañía, presentación con su marca y las 5 patas (studio, store, tv, app, biz). Solo ante una oportunidad concreta.</p><div data-lanzar-propuesta="generador"></div></section><form id="generator">');
  html=html.replace('</body>','<script type="module" src="/marcablanca/lanzar-propuesta.js?v=20261002-propuesta"></script></body>');
  // El CSS del armazón, el ÚLTIMO del <head>: después de todos los estilos de la página.
  html=html.replace('</head>','<link rel="stylesheet" href="/assets/admira-frame.css?v=20261004-5053"></head>');
  return new Response(html,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-robots-tag':'noindex, nofollow'}});
}
