// The shared Expert command opens this authenticated staging route. The
// presentation remains owned by the existing generator; no duplicate room.
export async function onRequestGet({request, env}) {
  const headers = {'cache-control':'private, no-store', 'x-robots-tag':'noindex, nofollow'};
  if (!env.PRESENTATION_IDEAS) return new Response('El generador no está disponible.', {status:503, headers});
  const presentation = await env.PRESENTATION_IDEAS.get('presentation:alsea-starbucks', {type:'json'});
  if (!presentation) {
    return new Response('<!doctype html><html lang="es"><meta charset="utf-8"><title>Alsea · presentación pendiente</title><main><h1>La presentación de Alsea aún no está guardada</h1><p>Créala o recupérala en el generador antes de lanzar el recorrido. No se han iniciado demos ni publicado contenidos.</p><a href="/presentaciones/galeria">Abrir el catálogo del generador</a></main></html>', {status:404, headers:{...headers,'content-type':'text/html; charset=utf-8'}});
  }
  const lang = new URL(request.url).searchParams.get('lang') === 'en' ? 'en' : 'es';
  const destination = new URL('/presentaciones/alsea-starbucks/presentacion', request.url);
  destination.searchParams.set('lang', lang);
  return new Response(null, {status:302, headers:{...headers, location:destination.href}});
}
