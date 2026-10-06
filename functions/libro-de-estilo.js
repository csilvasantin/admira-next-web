// /libro-de-estilo (Style Book) — zona protegida (06-10-2026). Ver ./_zona-protegida.js.
import { servirProtegida } from './_zona-protegida.js';
export const onRequest = (context) => servirProtegida(context, '/libro-de-estilo');
