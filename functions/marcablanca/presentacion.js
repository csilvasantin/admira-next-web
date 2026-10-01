/*
 * /marcablanca/presentacion · demo pública del modo PROSPECT del generador de presentaciones.
 *
 * Pinta UNA presentación de ejemplo con el MISMO render que las presentaciones reales
 * (functions/presentaciones/[client]/presentacion.js), vestida con la marca elegida:
 *   GET  ?marca=<id del catálogo único>      → semillas (lumbre, brumelle, frescaria…) o marcas guardadas
 *                                             en el catálogo (/marcablanca/api/marcas). Por defecto Lumbre Café.
 *   GET  ?marca=admira                      → la misma presentación sin prospect (Admira)
 *   POST marca=<JSON de cliente>            → «nueva marca» generada en el navegador (no se guarda)
 * No hay KV ni clave: el contenido es fijo y ficticio, y nada de lo que llega se almacena.
 */
import {onRequestGet as renderDeck} from '../presentaciones/[client]/presentacion.js';
import {catalogBrand} from '../presentaciones/_prospect.js';
import {normalizarMarca} from '../../marcablanca/marca.js';

const SLUG='demo-prospect';
const MAX_POST=320*1024;

function block(id,title,message,detail){return {id,title,message,detail,enabled:true}}

export function demoIdeas(nombre,corto){
  const es={
    hero:{eyebrow:`Propuesta privada · ${nombre}`,title:`${corto}: cada local puede aprender.`,summary:`Una propuesta para conectar contenido, pantallas, operación y medición en los locales de ${nombre}, con su marca de principio a fin.`},
    objective:`Acordar con ${nombre} un piloto de cuatro semanas en tres locales, con responsables y tres métricas de éxito.`,
    skeleton:[
      block('problema','El problema que merece resolverse',`Las pantallas de ${corto} emiten, pero nadie sabe qué venden.`,'Contenido genérico, cambios manuales y ninguna medición: cada campaña empieza de cero.'),
      block('crear','Crear',`Admira.Studio convierte el brief de ${corto} en piezas listas para cada pantalla.`,'Plantillas con la marca, variantes por formato y aprobación en un solo flujo.'),
      block('activar','Distribuir',`Admira.store lleva cada pieza al local, la superficie y el momento correctos.`,'Un gemelo digital de cada tienda y el despacho confirmado por la propia pantalla.'),
      block('medir','Comercializar y medir',`Admira.app convierte el circuito de ${corto} en un soporte que se planifica y se vende.`,'Circuitos, audiencias, CPM y pujas en vivo sobre el mapa de locales.'),
      block('mantener','Mantener','Yokup detecta, diagnostica y resuelve las incidencias antes de que las vea el cliente.','Pantallas, hilo musical, climatización y red en una sola bandeja, con IA y técnico asignado.'),
      block('piloto','El primer piloto','Empezar pequeño, medir de verdad y escalar lo que funciona.','Tres locales, cuatro semanas y un cuadro compartido de métricas.')
    ],
    closing:{title:`Elijamos los tres primeros locales de ${corto}.`,action:'Definir ubicaciones, responsables, señales disponibles y tres métricas de éxito.'},
    labels:{objective:'El objetivo',next:'Siguiente paso'}
  };
  const en={
    hero:{eyebrow:`Private proposal · ${nombre}`,title:`${corto}: every store can learn.`,summary:`A proposal to connect content, screens, operations and measurement across ${nombre}'s stores, in its own brand from start to finish.`},
    objective:`Agree with ${nombre} on a four-week pilot in three stores, with owners and three success metrics.`,
    skeleton:[
      {...es.skeleton[0],title:'The problem worth solving',message:`${corto}'s screens are on air, but nobody knows what they sell.`,detail:'Generic content, manual changes and no measurement: every campaign starts from scratch.'},
      {...es.skeleton[1],title:'Create',message:`Admira.Studio turns ${corto}'s brief into pieces ready for every screen.`,detail:'Branded templates, format variants and approval in a single flow.'},
      {...es.skeleton[2],title:'Distribute',message:'Admira.store takes every piece to the right store, surface and moment.',detail:'A digital twin of every store, with delivery confirmed by the screen itself.'},
      {...es.skeleton[3],title:'Sell and measure',message:`Admira.app turns ${corto}'s network into media that can be planned and sold.`,detail:'Circuits, audiences, CPM and live bids on the store map.'},
      {...es.skeleton[4],title:'Maintain',message:'Yokup detects, diagnoses and fixes incidents before customers notice.',detail:'Screens, background music, HVAC and network in one inbox, with AI and an assigned technician.'},
      {...es.skeleton[5],title:'The first pilot',message:'Start small, measure for real and scale what works.',detail:'Three stores, four weeks and a shared metrics board.'}
    ],
    closing:{title:`Let's pick ${corto}'s first three stores.`,action:'Define locations, owners, available signals and three success metrics.'},
    labels:{objective:'The goal',next:'Next step'}
  };
  return {schemaVersion:2,client:SLUG,displayName:nombre,languages:['es','en'],...es,translations:{en},embeds:[],narrativeSource:'demo',notes:'Demo pública del modo prospect de marca blanca.',updatedAt:'2026-10-01T12:00:00.000Z'};
}

export function demoConfig(cliente){
  return {schemaVersion:12,slug:SLUG,displayName:cliente?.nombre||'Admira',website:'',outputs:['website'],languages:['es','en'],
    theme:{primary:'#12233e',accent:'#ffb000',mode:'dark',fontStyle:'grotesk',radius:10,radiusStyle:'soft',density:'balanced',layout:'editorial',profile:'structured',heroDevice:'none'},
    footer:{showBrand:true,text:cliente?`${cliente.nombre} × ADmiraNeXT`:'ADmiraNeXT',showSlideNumber:true},
    prospect:cliente?{activo:true,marca:cliente.id,origen:cliente.origen?.tipo==='nueva'?'nueva':'catalogo',nombre:cliente.nombre,cliente}:null};
}

async function render(context,cliente){
  const nombre=cliente?.nombre||'Admira',corto=cliente?.nombreCorto||nombre.split(' ')[0];
  const store={[`presentation:${SLUG}`]:demoConfig(cliente),[`ideas:${SLUG}`]:demoIdeas(nombre,corto)};
  const url=new URL(context.request.url);url.search='?audience=1';
  const response=await renderDeck({
    params:{client:SLUG},request:new Request(url.toString()),data:{},
    env:{ASSETS:context.env.ASSETS,PRESENTATION_IDEAS:{get:async key=>store[key]?JSON.parse(JSON.stringify(store[key])):null}},
    next:()=>new Response('No encontrado',{status:404})
  });
  const html=(await response.text()).replace('<title>',`<meta name="description" content="Demo del modo prospect: la misma presentación vestida con la marca del destinatario."><title>`);
  return new Response(html,{status:response.status,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-robots-tag':'noindex, nofollow','x-content-type-options':'nosniff'}});
}

export async function onRequestGet(context){
  const pedido=String(new URL(context.request.url).searchParams.get('marca')||'lumbre').toLowerCase();
  if(pedido==='admira')return render(context,null);
  const cliente=await catalogBrand(context.env,context.request,pedido)||await catalogBrand(context.env,context.request,'lumbre');
  if(!cliente)return new Response('Marca no disponible',{status:503});
  return render(context,cliente);
}

export async function onRequestPost(context){
  if(Number(context.request.headers.get('content-length')||0)>MAX_POST)return new Response('Petición demasiado grande',{status:413});
  let form;try{form=await context.request.formData()}catch(_){return new Response('Formulario no válido',{status:400})}
  let marca;try{marca=JSON.parse(String(form.get('marca')||''))}catch(_){return new Response('La marca no es JSON válido',{status:400})}
  return render(context,normalizarMarca(marca));
}
