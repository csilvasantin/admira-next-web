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
  html=html.replace('/assets/presentation-generator.js"','/assets/presentation-generator-20260721-11.js?v=20260902-1"');
  html=html.replace('</head>','<link rel="stylesheet" href="/assets/presentation-generator-quadratic.css?v=1"></head>');
  html=html.replace('</head>','<link rel="stylesheet" href="/assets/presentation-media-library.css?v=20260724-1"></head>');
  html=html.replace('</body>','<script src="/assets/presentation-generator-quadratic.js?v=1"></script><script src="/assets/presentation-media-library.js?v=20260724-1"></script></body>');
  return new Response(html,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-robots-tag':'noindex, nofollow'}});
}
