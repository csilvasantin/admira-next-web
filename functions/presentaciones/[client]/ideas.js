export async function onRequestGet(context){
  const source=new URL('/assets/presentation-ideas-template.html',context.request.url);
  const asset=await context.env.ASSETS.fetch(source);
  if (!asset.ok) return new Response('Editor no disponible',{status:503});
  const html=(await asset.text()).replace('/assets/presentation-ideas-editor.js"','/assets/presentation-ideas-editor.js?v=20260719-1"');
  return new Response(html,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-robots-tag':'noindex, nofollow'}});
}
