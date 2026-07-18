const PRESETS = [
  {
    key:'ghostbusters',
    film:'Cazafantasmas',
    originalTitle:'Ghostbusters',
    year:1984,
    aliases:['cazafantasmas','ghostbusters'],
    direction:'Energía paranormal lúdica, ciencia de garaje y una ciudad nocturna atravesada por destellos de ectoplasma.',
    traits:['paranormal','urbano','lúdico','analógico'],
    theme:{
      primary:'#281544',accent:'#73ff83',secondary:'#ff5f8f',background:'#090713',surface:'#171128',text:'#f7f1ff',
      mode:'dark',fontStyle:'rounded',radius:22,radiusStyle:'rounded',density:'balanced',layout:'editorial',profile:'friendly',texture:'ectoplasm'
    }
  },
  {
    key:'back-to-the-future',
    film:'Regreso al Futuro',
    originalTitle:'Back to the Future',
    year:1985,
    aliases:['regreso al futuro','back to the future','regreso futuro'],
    direction:'Optimismo tecnológico, velocidad, precisión mecánica y estelas de luz que conectan presente y futuro.',
    traits:['cinético','tecnológico','optimista','neón'],
    theme:{
      primary:'#062a4d',accent:'#ff6a1a',secondary:'#22d3ee',background:'#030c18',surface:'#0b1a2a',text:'#f4fbff',
      mode:'dark',fontStyle:'grotesk',radius:5,radiusStyle:'sharp',density:'compact',layout:'centered',profile:'immersive',texture:'light-trails'
    }
  },
  {
    key:'alien',
    film:'Alien',
    originalTitle:'Alien',
    year:1979,
    aliases:['alien','alien el octavo pasajero','alien the eighth passenger'],
    direction:'Tensión espacial contenida, precisión industrial, silencio, grandes vacíos y señales técnicas en verde ácido.',
    traits:['industrial','espacial','minimal','tensión'],
    theme:{
      primary:'#071410',accent:'#b4ff35',secondary:'#6c8f7b',background:'#020403',surface:'#0a100d',text:'#e9eee8',
      mode:'dark',fontStyle:'mono',radius:0,radiusStyle:'sharp',density:'airy',layout:'editorial',profile:'minimal',texture:'scanlines'
    }
  }
];

const PRESENTATION_STYLES = {
  classic:{
    key:'classic',tier:'good',label:'Clásica',description:'Clara, profesional y centrada en el cliente.',
    theme:{primary:'#172b55',accent:'#f5a623',secondary:'#4a86ff',background:'#f4f6f8',surface:'#ffffff',text:'#142238',mode:'light',fontStyle:'grotesk',radius:10,radiusStyle:'soft',density:'balanced',layout:'editorial',profile:'structured',texture:'none'}
  },
  admira:{
    key:'admira',tier:'better',label:'Admira',description:'Sistema oscuro, tecnológico y cuadrático de AdmiraNeXT.',
    theme:{primary:'#071a2f',accent:'#3df08a',secondary:'#4a86ff',background:'#070a10',surface:'#0d1522',text:'#eef4fc',mode:'dark',fontStyle:'grotesk',radius:8,radiusStyle:'sharp',density:'balanced',layout:'editorial',profile:'editorial',texture:'quadratic'}
  },
  movie:{
    key:'movie',tier:'best',label:'De película',description:'Dirección cinematográfica inmersiva gobernada por Mood.',
    theme:{primary:'#12233e',accent:'#ffb000',secondary:'#4a86ff',background:'#07101b',surface:'#111827',text:'#f8fbff',mode:'dark',fontStyle:'grotesk',radius:10,radiusStyle:'soft',density:'balanced',layout:'editorial',profile:'immersive',texture:'cinematic'}
  }
};

function clean(value,max=180){return String(value==null?'':value).replace(/\s+/g,' ').trim().slice(0,max);}
function fold(value){return clean(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();}
function clonePreset(preset){return {schemaVersion:1,key:preset.key,film:preset.film,originalTitle:preset.originalTitle,year:preset.year,source:'preset',direction:preset.direction,traits:[...preset.traits],theme:{...preset.theme}};}
function randomPreset(){
  let index=Date.now()%PRESETS.length;
  try{const values=new Uint32Array(1);globalThis.crypto.getRandomValues(values);index=values[0]%PRESETS.length;}catch(_){}
  return PRESETS[index];
}

export function listMoodPresets(){return PRESETS.map(clonePreset);}

export function listPresentationStyles(){return Object.values(PRESENTATION_STYLES).map(style=>({...style,theme:{...style.theme}}));}

export function normalizePresentationStyle(value,fallback='movie'){
  const normalized=fold(typeof value==='object'&&value?value.key||value.tier||value.label:value);
  const aliases={classic:'classic',clasica:'classic',clasico:'classic',good:'classic',admira:'admira',better:'admira',movie:'movie',pelicula:'movie','de pelicula':'movie',best:'movie'};
  return aliases[normalized]||aliases[fold(fallback)]||'movie';
}

export function normalizeMood(value,{randomWhenEmpty=false}={}){
  const raw=typeof value==='object'&&value?value.film||value.title||value.key:value;
  const film=clean(raw,120);
  if(!film)return randomWhenEmpty?clonePreset(randomPreset()):null;
  const normalized=fold(film);
  const preset=PRESETS.find(item=>item.key===normalized||item.aliases.some(alias=>fold(alias)===normalized));
  if(preset)return clonePreset(preset);
  const key='custom-'+normalized.replace(/\s+/g,'-').slice(0,56).replace(/^-|-$/g,'');
  return {
    schemaVersion:1,key:key||'custom',film,originalTitle:film,year:null,source:'custom',
    direction:`Interpretar la atmósfera cinematográfica de ${film} como una dirección de arte contemporánea para presentaciones.`,
    traits:['cinematográfico','personalizado'],theme:null
  };
}

export function themeFromMood(mood,overrides={}){
  const fallback={primary:'#12233e',accent:'#ffb000',secondary:'#4a86ff',background:'#07101b',surface:'#111827',text:'#f8fbff',mode:'dark',fontStyle:'grotesk',radius:10,radiusStyle:'soft',density:'balanced',layout:'editorial',profile:'structured',texture:'none'};
  const base=mood?.theme&&typeof mood.theme==='object'?mood.theme:{};
  return {...fallback,...base,...overrides};
}

export function themeFromPresentationStyle(style,mood,overrides={}){
  const key=normalizePresentationStyle(style);
  const styleTheme=PRESENTATION_STYLES[key].theme;
  const moodTheme=key==='movie'&&mood?.theme&&typeof mood.theme==='object'?mood.theme:{};
  return {...styleTheme,...moodTheme,...overrides};
}

export function moodProductionBrief(mood,displayName='la presentación'){
  if(!mood)return '';
  const title=clean(mood.film,120)||'la referencia indicada';
  const direction=clean(mood.direction,500);
  const traits=(Array.isArray(mood.traits)?mood.traits:[]).map(item=>clean(item,50)).filter(Boolean).join(', ');
  return `\nMOOD CINEMATOGRÁFICO\n- Película de referencia: ${title}.\n- Dirección: ${direction}\n- Rasgos: ${traits||'cinematográfico, coherente'}.\n- Aplicar el mood a paleta, tipografía, composición, ritmo, textura, transiciones y tratamiento de imagen de ${displayName}.\n- Conservar intactos el relato, las afirmaciones, los datos, el orden narrativo y la identidad AdmiraNeXT × cliente.\n- Evocar la atmósfera; no copiar carteles, logotipos, personajes, fotogramas, utilería ni otros elementos protegidos de la película.\n`;
}

export function presentationStyleBrief(style,mood,displayName='la presentación'){
  const key=normalizePresentationStyle(style);
  const meta=PRESENTATION_STYLES[key];
  const direction=key==='classic'
    ?'- Dirección Clásica: luminosa, sobria, profesional, legible y centrada en el cliente. Jerarquía editorial limpia, geometría contenida y movimiento mínimo.'
    :key==='admira'
      ?'- Dirección Admira: interfaz oscura y tecnológica de AdmiraNeXT, composición cuadrática, retícula visible, acentos verde y azul, precisión operativa y movimiento funcional.'
      :'- Dirección De película: inmersiva, narrativa y sensorial. El Mood elegido gobierna la atmósfera sin alterar el contenido.';
  const moodBrief=key==='movie'?moodProductionBrief(mood,displayName):'';
  return `\nTIPO DE PRESENTACIÓN · ${meta.tier.toUpperCase()} / ${meta.label.toUpperCase()}\n${direction}\n- Esta dirección es transversal: aplicarla al website de presentación y al portal del proyecto, PDF, PowerPoint, documentos de trabajo, infografía, audio y vídeo.\n- En documentos de trabajo, trasladarla a portada, jerarquías, tablas, destacados, ritmo de página, tratamiento de imagen y llamadas a la acción; no limitarla a una nota para NotebookLM.\n- Mantener idénticos el relato, las afirmaciones, los datos, el orden narrativo y la identidad AdmiraNeXT × cliente al cambiar de tipo.\n${moodBrief}`;
}
