export function onRequestGet(context){
  const url = new URL(context.request.url);
  url.pathname = url.pathname.replace(/\/Ideas\/?$/, '/ideas');
  return Response.redirect(url.toString(), 308);
}
