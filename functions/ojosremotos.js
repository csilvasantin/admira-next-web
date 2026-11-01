// /ojosremotos — Ojos remotos (ojosIA): zona protegida (01-11-2026). Ver ./_zona-protegida.js.
// La página no contiene fotos: el navegador las pide directamente a los nodos por Tailscale (solo tailnet) con token.
import { servirProtegida } from './_zona-protegida.js';
export const onRequest = (context) => servirProtegida(context, '/ojosremotos');
