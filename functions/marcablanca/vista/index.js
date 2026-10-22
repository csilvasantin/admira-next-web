/*
 * GET /marcablanca/vista/ · la demo pública del encargo #5552 ya no vive aquí (norma 31, #5566).
 * Avisa y lleva a la misma vista con sesión, en /pruebas/marcablanca/vista/.
 * No pinta maquetas ni acepta «Pide tu propuesta».
 */
const HTML = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>La vista previa está en pruebas</title>
<meta name="robots" content="noindex, nofollow">
</head>
<body>
<main>
  <h1>Esta vista ya no está en la web pública.</h1>
  <p>Entra con tu sesión de Google y ábrela en pruebas.</p>
  <p><a href="/pruebas/marcablanca/vista/">Abrir la vista previa</a></p>
</main>
</body>
</html>
`;

export function onRequest(context) {
  const method = context?.request?.method || 'GET';
  const comunes = {
    'cache-control': 'no-store',
    'x-robots-tag': 'noindex, nofollow',
    'x-content-type-options': 'nosniff'
  };
  if (method !== 'GET' && method !== 'HEAD') {
    return new Response('Esta vista ya no está en la web pública.\n', {
      status: 405,
      headers: {...comunes, allow: 'GET, HEAD', 'content-type': 'text/plain; charset=utf-8'}
    });
  }
  return new Response(method === 'HEAD' ? null : HTML, {
    status: 200,
    headers: {...comunes, 'content-type': 'text/html; charset=utf-8'}
  });
}
