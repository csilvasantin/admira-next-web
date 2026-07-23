export async function onRequestGet(context){
  const source=new URL('/presites/generador/index.html',context.request.url);
  const asset=await context.env.ASSETS.fetch(source);
  if(!asset.ok)return new Response('Generador de Presites no disponible',{status:503});
  return new Response(asset.body,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-robots-tag':'noindex, nofollow'}});
}
