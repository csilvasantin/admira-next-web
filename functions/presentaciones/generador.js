export async function onRequestGet(context){
  const source=new URL('/presentaciones/generador.html',context.request.url);
  const asset=await context.env.ASSETS.fetch(source);
  if(!asset.ok)return new Response('Generador no disponible',{status:503});
  let html=await asset.text();
  html=html.replace('/assets/presentation-generator.js"','/assets/presentation-generator-20260721-11.js?v=20260724-carlos-rights-approval"');
  html=html.replace('</head>','<link rel="stylesheet" href="/assets/presentation-generator-quadratic.css?v=1"></head>');
  html=html.replace('</body>','<script src="/assets/presentation-generator-quadratic.js?v=1"></script></body>');
  return new Response(html,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-robots-tag':'noindex, nofollow'}});
}
