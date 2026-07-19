export async function onRequestGet(context){
  const source=new URL('/presentaciones/generador.html',context.request.url);
  const asset=await context.env.ASSETS.fetch(source);
  if(!asset.ok)return new Response('Generador no disponible',{status:503});
  let html=await asset.text();
  html=html.replace('/assets/presentation-generator.js"','/assets/presentation-generator.js?v=20260719-3"');
  return new Response(html,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-robots-tag':'noindex, nofollow'}});
}
