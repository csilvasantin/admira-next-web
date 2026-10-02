/*
 * Atajo de create_presentation: `marca` (id del catálogo) o `prospectUrl` (web del cliente).
 * Reutiliza el modo prospect (PR #23). Una URL se analiza con el análisis de /marcablanca
 * (PR #27) y la marca se guarda en PRESENTATION_IDEAS (`marca:<id>`) como propuesta no oficial;
 * el logo data: va a R2 PRESENTATION_MEDIA (`marcas/<id>/logo.*`).
 * El análisis corre dentro del alta, no en la llamada MCP: create_presentation sigue
 * devolviendo jobId al momento.
 */
import {analizarMarca} from '../marcablanca/api/analizar.js';
import {guardarMarca} from '../marcablanca/_catalogo.js';
import {idMarca} from '../../marcablanca/marca.js';
import {assertPublicHttps} from './_inspiration.js';

function urlProspect(value){
  const cleaned = String(value || '').trim();
  if (!cleaned) return '';
  const candidate = /^https?:\/\//i.test(cleaned)
    ? cleaned.replace(/^http:\/\//i, 'https://')
    : (/^[a-z][a-z0-9+.-]*:/i.test(cleaned) ? cleaned : `https://${cleaned.replace(/^\/+/, '')}`);
  try {
    const url = assertPublicHttps(candidate);
    if (url.pathname === '/' && !url.search && !url.hash) return url.origin;
    return url.toString();
  }
  catch (_) { throw new Error('prospectUrl debe ser una URL https:// pública de la web del cliente.'); }
}

export function leerAtajoMarca(raw = {}){
  const marcaBruta = raw?.marca;
  const urlBruta = raw?.prospectUrl;
  const marcaPresente = marcaBruta != null && String(marcaBruta).trim() !== '';
  const urlPresente = urlBruta != null && String(urlBruta).trim() !== '';
  if (marcaPresente && typeof marcaBruta !== 'string') throw new Error('marca debe ser el id del catálogo (GET /marcablanca/api/marcas).');
  if (urlPresente && typeof urlBruta !== 'string') throw new Error('prospectUrl debe ser la URL https:// de la web del cliente.');
  const marca = marcaPresente ? idMarca(marcaBruta) : '';
  if (marcaPresente && !marca) throw new Error('marca debe ser el id del catálogo (minúsculas, números y guiones): el de GET /marcablanca/api/marcas.');
  if (marca === 'nueva' || marca === 'actual') throw new Error('marca es un id del catálogo. Para vestir el deck con la web del cliente usa prospectUrl.');
  const prospectUrl = urlPresente ? urlProspect(urlBruta) : '';
  if (marca && prospectUrl) throw new Error('Indica marca o prospectUrl, no las dos.');
  return {marca, prospectUrl};
}

/**
 * Si no hay atajo, `aplicado` es false y el alta sigue como hasta ahora.
 * `marca` → prospect de catálogo. `prospectUrl` → analizar, guardar propuesta y prospect de esa marca.
 */
export async function aplicarAtajoMarca({raw, env, request, autor, analizar = analizarMarca, guardar = guardarMarca} = {}){
  const {marca, prospectUrl} = leerAtajoMarca(raw);
  if (!marca && !prospectUrl) return {aplicado:false, prospectRaw:undefined, website:'', catalogo:null};
  if (marca) return {aplicado:true, prospectRaw:{activo:true, marca}, website:'', catalogo:null};
  const analisis = await analizar(prospectUrl);
  const propuesta = analisis?.propuesta;
  if (!propuesta || typeof propuesta !== 'object') throw new Error('El análisis de la web no ha devuelto una marca.');
  const web = analisis?.analisis?.finalUrl || analisis?.analisis?.url || analisis?.datos?.web || prospectUrl;
  const guardada = await guardar(env, request, {
    marca:propuesta,
    origen:'url',
    web,
    propuesta:true,
    autor:autor || undefined,
    actualizar:true
  });
  return {
    aplicado:true,
    prospectRaw:{activo:true, marca:guardada.id},
    website:/^https:\/\//i.test(web) ? web : prospectUrl,
    catalogo:{guardada:true, id:guardada.id, creada:Boolean(guardada.creada), propuesta:true, url:`/marcablanca/?marca=${guardada.id}`}
  };
}
