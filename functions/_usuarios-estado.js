/*
 * Directorio honesto y accionable (FLT-1577 · HandON admiranext.com, Morfeo · MacMini,
 * 4-sep-2026, encargo de Carlos).
 *
 * Tres cosas que el directorio no decía y que hacen falta para GESTIONAR personas:
 *
 *  1) EL ESTADO REAL. «activo» significaba «no suspendido», y así dos editores dados
 *     de alta el 13 de agosto figuraban activos sin haber entrado jamás. Quien nunca
 *     ha entrado está PENDIENTE de primer acceso: no es lo mismo que activo, igual
 *     que en el censo de carbono «sin latido» no es «ausente».
 *
 *  2) LA LISTA BLANCA DE admira.live. El universo AdmiraNeXT tiene hoy otra puerta
 *     (admira.live, yokup.com) con su propia lista de correos en el worker
 *     admira-whitelist. Las dos listas ya divergen y nadie lo veía: aquí se cruzan y
 *     se dicen las diferencias, sin tocar la otra lista (eso es otra decisión).
 *
 *  3) LA INVITACIÓN. Dar de alta no avisa a nadie: la persona no sabe que existe,
 *     ni por dónde entrar, ni a qué. El texto de invitación sale ya escrito, con el
 *     enlace y sus proyectos, para copiarlo y mandarlo por Telegram o WhatsApp.
 *     (Correo real desde el sitio exige un proveedor que hoy no hay; queda anotado.)
 */

export const WHITELIST_API = 'https://admira-whitelist.csilvasantin.workers.dev';
export const ENTRADA = 'https://www.admiranext.com/webmaster';

export const ROL_LABEL = { admin: 'Administrador', editor: 'Editor', viewer: 'Lector' };

const email = (value) => String(value || '').trim().toLowerCase();

/** activo · pendiente (nunca ha entrado) · suspendido. Mandamiento 2: el estado dice la verdad. */
export function estadoUsuario(user) {
  if (!user) return 'pendiente';
  if (user.status === 'suspended') return 'suspendido';
  return user.last_login_at ? 'activo' : 'pendiente';
}

/** Lee la lista blanca de admira.live sin tumbar el directorio si no responde. */
export async function leerListaBlanca(env = {}) {
  const fetchImpl = typeof env.WHITELIST_FETCH === 'function' ? env.WHITELIST_FETCH : fetch;
  try {
    const response = await fetchImpl(WHITELIST_API + '/list', { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) throw new Error(`admira-whitelist HTTP ${response.status}`);
    const payload = await response.json();
    if (!payload || !Array.isArray(payload.emails)) throw new Error('lista blanca inválida');
    return {
      emails: [...new Set(payload.emails.map(email).filter(Boolean))].sort(),
      superusers: [...new Set((payload.superusers || []).map(email).filter(Boolean))].sort(),
      complete: true, warning: '',
    };
  } catch (error) {
    return { emails: [], superusers: [], complete: false, warning: String(error && error.message || error) };
  }
}

/**
 * Cruza el directorio con la lista blanca. Devuelve, por correo, si está en la
 * lista y si es superusuario allí; y las dos divergencias que importan: quién
 * entra en admira.live sin figurar aquí, y quién figura aquí sin poder entrar allí.
 */
export function cruzarListaBlanca(users, lista) {
  const enLista = new Set((lista && lista.emails) || []);
  const superusuarios = new Set((lista && lista.superusers) || []);
  const directorio = new Set((users || []).map((u) => email(u.email)));
  const porEmail = {};
  for (const u of users || []) {
    const e = email(u.email);
    porEmail[e] = { en_lista_blanca: enLista.has(e), superusuario: superusuarios.has(e) };
  }
  const complete = !lista || lista.complete !== false;
  return {
    por_email: porEmail,
    solo_en_lista_blanca: complete ? [...enLista].filter((e) => !directorio.has(e)).sort() : [],
    solo_en_directorio: complete ? [...directorio].filter((e) => !enLista.has(e)).sort() : [],
  };
}

/** Texto listo para pegar en Telegram/WhatsApp: quién eres, por dónde entras y a qué. */
export function textoInvitacion(user, projectKeys, catalog, entrada = ENTRADA) {
  const nombre = String(user.display_name || '').trim() || String(user.email || '').split('@')[0];
  const keys = projectKeys || [];
  const nombres = keys.includes('*')
    ? ['todos los proyectos de AdmiraNeXT']
    : (catalog || []).filter((p) => keys.includes(p.key)).map((p) => p.name);
  const proyectos = nombres.length ? nombres.join(', ') : 'sin proyectos asignados todavía';
  return [
    `Hola ${nombre}, ya tienes acceso a AdmiraNeXT como ${(ROL_LABEL[user.role] || user.role || 'lector').toLowerCase()}.`,
    `Entra con tu cuenta de Google ${user.email} en ${entrada}`,
    `Proyectos: ${proyectos}.`,
    'Si al entrar algo no encaja, responde a este mensaje.',
  ].join('\n');
}
