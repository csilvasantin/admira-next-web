/* La subida a YouTube tiene dos formas conocidas de salir mal —la cuota diaria y
 * el permiso caducado— y ninguna de las dos se arregla reintentando. Se prueba
 * que se distinguen, porque confundirlas quema las pocas subidas que quedan. */
const test = require('node:test');
const assert = require('node:assert/strict');

let yt;
test.before(async () => { yt = await import('../functions/presentaciones/api/_youtube-subida.mjs'); });

test('la cuota da para unas seis subidas al día, y se sabe cuántas quedan', () => {
  assert.equal(yt.subidasRestantes(0), 6, '10.000 unidades a 1.600 por subida');
  assert.equal(yt.subidasRestantes(9600), 0, 'seis gastadas, no queda ninguna');
  assert.equal(yt.puedeSubir(9600), false);
  assert.equal(yt.puedeSubir(8000), true);
  // Que la cuenta venga negativa o rara no debe abrir la puerta.
  assert.equal(yt.subidasRestantes(999999), 0);
  assert.equal(yt.subidasRestantes(-5), 6);
});

test('el vídeo se sube PRIVADO salvo que se diga otra cosa', () => {
  // Una pieza generada sola que aparece en público sin que nadie la haya visto
  // es un disgusto; pasarla a pública es un clic, deshacerlo no lo es.
  assert.equal(yt.cuerpoInsert({titulo: 'Algo'}).status.privacyStatus, 'private');
  assert.equal(yt.cuerpoInsert({titulo: 'Algo', visibilidad: 'public'}).status.privacyStatus, 'public');
  assert.equal(yt.cuerpoInsert({titulo: 'Algo', visibilidad: 'lo-que-sea'}).status.privacyStatus, 'private');
});

test('el título se ajusta al límite de YouTube y sin título no se sube', () => {
  const c = yt.cuerpoInsert({titulo: 'a'.repeat(400), descripcion: 'b'.repeat(9000)});
  assert.equal(c.snippet.title.length, 100);
  assert.ok(c.snippet.description.length <= 5000);
  assert.throws(() => yt.cuerpoInsert({titulo: '   '}), /sin título/);
});

test('una etiqueta con < o > tumbaría el lote entero: se limpia', () => {
  const c = yt.cuerpoInsert({titulo: 'X', etiquetas: ['<script>', 'tech', '']});
  assert.ok(!c.snippet.tags.some((t) => /[<>]/.test(t)));
  assert.ok(c.snippet.tags.includes('tech'));
});

test('la cuota agotada se distingue: reintentar solo quema lo que queda', () => {
  const cuota = yt.motivoDelFallo(403, {error: {errors: [{reason: 'quotaExceeded'}]}});
  assert.equal(cuota.cuotaAgotada, true);
  assert.match(cuota.mensaje, /cuota/i);
  // Un 403 que NO es de cuota no debe leerse como tal.
  assert.equal(yt.motivoDelFallo(403, {error: {errors: [{reason: 'forbidden'}]}}).cuotaAgotada, false);
  assert.match(yt.motivoDelFallo(401, {}).mensaje, /autorizar/i);
});

test('un permiso revocado dice que hay que volver a autorizar, no «error 400»', async () => {
  const buscar = async () => new Response(JSON.stringify({error: 'invalid_grant'}), {status: 400});
  await assert.rejects(
    () => yt.tokenDeAcceso({clientId: 'c', clientSecret: 's', refreshToken: 'r'}, buscar),
    /volver a autorizar/i);
});

test('sin credencial se dice que falta el consentimiento, no se llama a Google', async () => {
  let llamado = false;
  const buscar = async () => { llamado = true; return new Response('{}'); };
  await assert.rejects(() => yt.tokenDeAcceso({clientId: 'c'}, buscar), /consentimiento/i);
  assert.equal(llamado, false);
});

test('con el refresh bueno se obtiene el token de acceso', async () => {
  const buscar = async (url, init) => {
    assert.equal(url, yt.URL_TOKEN);
    assert.match(String(init.body), /grant_type=refresh_token/);
    return new Response(JSON.stringify({access_token: 'ya29.deprueba'}), {status: 200});
  };
  assert.equal(await yt.tokenDeAcceso({clientId: 'c', clientSecret: 's', refreshToken: 'r'}, buscar), 'ya29.deprueba');
});
