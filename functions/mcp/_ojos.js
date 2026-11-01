/*
 * Tools ojos_* del MCP de admiranext.com — Ojos remotos / ojosIA (Carlos, 01-11-2026:
 * «hagamos el MCP y el Help de admiranext.com/ojosremotos»).
 *
 * Arquitectura: las cámaras viven en los nodos `ojos-nodo.py` (admira-vault/ojosia) del Mac Mini
 * (Link 2) y del Mac Studio (Luna Ultra, Studio Display), solo accesibles por Tailscale. Este
 * worker de Cloudflare NO está en la tailnet, así que hace de relevo opcional:
 *   - OJOS_NODO_MM_URL / OJOS_NODO_MS_URL  (vars)    → URL pública del nodo (túnel/Funnel), sin definir = sin relevo
 *   - OJOS_NODO_MM_TOKEN / OJOS_NODO_MS_TOKEN (secrets) → Bearer del nodo, nunca en el repo
 *   - OJOS_MOVER = "on" (var)                         → interruptor del movimiento; por defecto APAGADO
 * Sin esas variables, list_cameras y help funcionan y el resto responde «nodo no configurado»
 * sin hacer ninguna petición. El movimiento exige además rol admin y he_mirado:true.
 */

export const OJOS_CAMS = {
  link:   { nombre: 'Insta360 Link 2', nodo: 'mm', ordenador: 'Mac Mini', conexion: 'USB (webcam UVC)', mueve: true, zoom: true, comando: 'ojos foto link', prioridad: 'respaldo' },
  luna:   { nombre: 'Insta360 Luna Ultra', nodo: 'ms', ordenador: 'Mac Studio / Mac Mini por su Wi-Fi', conexion: 'Wi-Fi propia de la cámara (un solo cliente)', mueve: true, zoom: false, comando: 'luna_gimbal.py test|center|move H V SEG', prioridad: 'respaldo', aviso: 'Un solo cliente: cierra Luna Ultra Desktop antes. Gimbal por velocidad (-100..100), sin posición absoluta. Se pliega/apaga si se toca.' },
  studio: { nombre: 'Studio Display (cámara fija)', nodo: 'ms', ordenador: 'Mac Studio', conexion: 'USB-C (fija)', mueve: false, zoom: false, comando: 'ojos foto studio', prioridad: 'fija' }
};
const NODOS = { mm: 'MM', ms: 'MS' };
const LIM = 100, SEG_MAX = 5;

export const OJOS_HELP = `# Ojos remotos (ojosIA) · MCP

Dar ojos a consejeros y agentes. Página: https://www.admiranext.com/ojosremotos (con sesión). Ayuda humana: https://www.admiranext.com/help/#ojosremotos · Guía: https://www.admiranext.com/mcp/OJOS.md

Orden de preferencia de cámaras: 1) iPhone Pro con Camo Studio · 2) Samsung Fold · 3) Insta360 (Link 2 / Luna Ultra) solo de respaldo.

Tools:
- ojos_list_cameras {} — cámaras, nodo, si mueven y si el relevo está configurado.
- ojos_get_snapshot {cam} — foto JPEG actual (mira SIEMPRE antes de mover).
- ojos_move_gimbal {cam, h, v, seg?, he_mirado:true} — Luna: velocidad h/v en -100..100 durante seg (≤5 s) y para sola. Link 2: grados relativos dpan/dtilt (h/v, -100..100). Solo admin y con OJOS_MOVER=on.
- ojos_stop_gimbal {cam} — para el gimbal (velocidad 0).
- ojos_center_gimbal {cam, he_mirado:true} — recentra (Luna: en el lado actual; Link 2: pan 0 tilt 0).

Reglas: nunca pulses el botón rojo de grabar; nunca escribas por BLE ni inventes bytes; mira antes dónde apunta; la Luna solo admite un cliente (cierra Luna Ultra Desktop); imagen negra = cámara plegada o apagada (pídeselo a una persona, no muevas a ciegas).`;

const camProps = { cam: { type: 'string', enum: Object.keys(OJOS_CAMS), description: 'link · luna · studio' } };
export const OJOS_TOOLS = [
  { name: 'ojos_list_cameras', description: 'Ojos remotos: lista las cámaras (Link 2, Luna Ultra, Studio Display), su nodo, si mueven y si el relevo del nodo está configurado. Solo lectura.', inputSchema: { type: 'object', properties: {} } },
  { name: 'ojos_get_snapshot', description: 'Ojos remotos: foto JPEG actual de una cámara (vía su nodo). Úsala SIEMPRE antes de mover. Solo lectura.', inputSchema: { type: 'object', properties: camProps, required: ['cam'] } },
  { name: 'ojos_move_gimbal', description: 'Ojos remotos: mueve el gimbal. h (horizontal) y v (vertical) enteros en -100..100; en la Luna son velocidad durante seg (≤5 s, luego para sola); en la Link 2 son grados relativos. Exige he_mirado:true, rol admin y OJOS_MOVER=on.', inputSchema: { type: 'object', properties: { ...camProps, h: { type: 'integer', minimum: -LIM, maximum: LIM }, v: { type: 'integer', minimum: -LIM, maximum: LIM }, seg: { type: 'number', minimum: 0.1, maximum: SEG_MAX, description: 'solo Luna; por defecto 1' }, he_mirado: { type: 'boolean', description: 'true: has visto una foto reciente y sabes hacia dónde apunta' } }, required: ['cam', 'h', 'v', 'he_mirado'] } },
  { name: 'ojos_stop_gimbal', description: 'Ojos remotos: para el gimbal (velocidad 0). Siempre permitido a editor/admin cuando el relevo está configurado.', inputSchema: { type: 'object', properties: camProps, required: ['cam'] } },
  { name: 'ojos_center_gimbal', description: 'Ojos remotos: recentra el gimbal (Luna: en el lado actual; Link 2: pan 0, tilt 0). Exige he_mirado:true, rol admin y OJOS_MOVER=on.', inputSchema: { type: 'object', properties: { ...camProps, he_mirado: { type: 'boolean' } }, required: ['cam', 'he_mirado'] } }
];
export const OJOS_READ_ONLY = ['ojos_list_cameras', 'ojos_get_snapshot'];

function nodoDe(env, cam){
  const k = NODOS[OJOS_CAMS[cam].nodo];
  const url = String((env && env[`OJOS_NODO_${k}_URL`]) || '').replace(/\/$/, '');
  const token = String((env && env[`OJOS_NODO_${k}_TOKEN`]) || '');
  return url && token && /^https:\/\//.test(url) ? { url, token } : null;
}
function camDe(a){
  const cam = String(a.cam || '').toLowerCase();
  if (!OJOS_CAMS[cam]) throw new Error(`Cámara desconocida «${a.cam}». Usa: ${Object.keys(OJOS_CAMS).join(', ')}.`);
  return cam;
}
function entero(v, campo){
  const n = Number(v);
  if (!Number.isInteger(n) || n < -LIM || n > LIM) throw new Error(`${campo} debe ser un entero entre -${LIM} y ${LIM}.`);
  return n;
}
function puedeMover(ctx, a, cam){
  if (!OJOS_CAMS[cam].mueve) throw new Error(`${OJOS_CAMS[cam].nombre} es fija: solo foto.`);
  if (String(ctx.env && ctx.env.OJOS_MOVER || '').toLowerCase() !== 'on') throw new Error('Movimiento por MCP desactivado (OJOS_MOVER no es "on"). Decisión de Carlos.');
  if (ctx.access.level !== 'admin') throw new Error('Mover cámaras requiere rol admin en /usuarios.');
  if (a.he_mirado !== true) throw new Error('Mira antes de mover: llama a ojos_get_snapshot y pasa he_mirado:true.');
}
async function relevo(ctx, cam, path, body){
  const n = nodoDe(ctx.env, cam);
  if (!n) throw new Error(`Nodo de ${OJOS_CAMS[cam].ordenador} no configurado en el MCP (faltan OJOS_NODO_${NODOS[OJOS_CAMS[cam].nodo]}_URL/_TOKEN). Usa /ojosremotos desde la tailnet o \`${OJOS_CAMS[cam].comando}\` en el ordenador.`);
  const init = { method: body ? 'POST' : 'GET', headers: { authorization: `Bearer ${n.token}`, ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) };
  const r = await ctx.fetchImpl(n.url + path, init);
  if (!r.ok) { let m = r.status; try { m = (await r.json()).error || m; } catch (_) {} throw new Error(`El nodo respondió ${m}`); }
  return r;
}
function b64(buf){ let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); }

export async function callOjosTool(ctx, name, a = {}){
  switch (name) {
    case 'ojos_list_cameras':
      return { camaras: Object.entries(OJOS_CAMS).map(([id, c]) => ({ id, ...c, relevo: !!nodoDe(ctx.env, id) })), preferencia: ['iPhone Pro (Camo Studio)', 'Samsung Fold', 'Insta360 (respaldo)'], mover_por_mcp: String(ctx.env && ctx.env.OJOS_MOVER || '').toLowerCase() === 'on', pagina: 'https://www.admiranext.com/ojosremotos', ayuda: 'https://www.admiranext.com/help/#ojosremotos' };
    case 'ojos_get_snapshot': {
      const cam = camDe(a);
      const r = await relevo(ctx, cam, `/foto/${cam}`);
      const buf = await r.arrayBuffer();
      if (!buf.byteLength) throw new Error('Foto vacía: ¿cámara plegada, apagada u ocupada por otro cliente?');
      return { __image: { data: b64(buf), mimeType: r.headers?.get?.('content-type') || 'image/jpeg' }, cam, bytes: buf.byteLength, tomada: new Date().toISOString() };
    }
    case 'ojos_move_gimbal': {
      const cam = camDe(a); puedeMover(ctx, a, cam);
      const h = entero(a.h, 'h'), v = entero(a.v, 'v');
      let body;
      if (cam === 'luna') {
        const seg = a.seg == null ? 1 : Number(a.seg);
        if (!(seg > 0 && seg <= SEG_MAX)) throw new Error(`seg debe estar entre 0.1 y ${SEG_MAX}.`);
        body = { h, v, seg };
      } else body = { dpan: h, dtilt: v };
      const r = await relevo(ctx, cam, `/ptz/${cam}`, body);
      return { ok: true, cam, enviado: body, nodo: await r.json().catch(() => ({})), siguiente: 'Llama a ojos_get_snapshot para comprobar.' };
    }
    case 'ojos_stop_gimbal': {
      const cam = camDe(a);
      if (!OJOS_CAMS[cam].mueve) return { ok: true, cam, nota: 'Cámara fija: nada que parar.' };
      const body = cam === 'luna' ? { h: 0, v: 0, seg: 0.1 } : { dpan: 0, dtilt: 0 };
      await relevo(ctx, cam, `/ptz/${cam}`, body);
      return { ok: true, cam, enviado: body };
    }
    case 'ojos_center_gimbal': {
      const cam = camDe(a); puedeMover(ctx, a, cam);
      const body = cam === 'luna' ? { centrar: true } : { pan: 0, tilt: 0 };
      await relevo(ctx, cam, `/ptz/${cam}`, body);
      return { ok: true, cam, enviado: body, siguiente: 'Llama a ojos_get_snapshot para comprobar.' };
    }
  }
  throw new Error(`Tool desconocida: ${name}`);
}
