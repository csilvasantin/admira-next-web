/**
 * Apaga la URL pública huérfana /marcablanca/vista/ (norma 31 / #5552).
 * r20 movió la demo a /pruebas/marcablanca/vista/; la edge seguía
 * sirviendo el HTML viejo (age ~13 min) con JS/CSS ya en 404.
 */
export async function onRequest() {
  const cuerpo = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Vista previa no disponible</title>
</head>
<body style="font-family:system-ui,sans-serif;max-width:36rem;margin:3rem auto;padding:0 1rem;line-height:1.45">
<h1>Esta vista ya no es pública</h1>
<p>La demo de marca blanca vive en <a href="/pruebas/marcablanca/vista/">/pruebas/marcablanca/vista/</a> (hace falta iniciar sesión).</p>
</body>
</html>`;
  return new Response(cuerpo, {
    status: 410,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, nofollow',
    },
  });
}
