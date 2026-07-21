const SOURCE_URL='https://docs.google.com/presentation/d/1PHJLGEq-uV4-U7OhxVsLRM41O6XA5xfDnNLWhlg2odo/edit';

const sourceSlides={
  1:{objectId:'g29351b17195b6e79_0',title:'Admira'},
  2:{objectId:'g5077aaed3cc82d4d_0',title:'Quiénes somos'},
  3:{objectId:'g3d533a9979_0_17',title:'Un equipo de más de 140 personas'},
  4:{objectId:'g3d533a9979_0_30',title:'Presencia en 60 países'},
  5:{objectId:'g3d4e0c6ff7_2_354',title:'Presencia en todo el customer journey'},
  7:{objectId:'g3d4e0c6ff7_2_343',title:'El bosque · Think Tank'},
  8:{objectId:'g4cecfed029_0_1',title:'El laboratorio · Innovación'},
  9:{objectId:'g284fc9ef4b0_0_6',title:'Admira X'},
  10:{objectId:'g284fc9ef4b0_0_0',title:'Admira U'},
  11:{objectId:'g2c3a93c3b4d_0_0',title:'Qué hacemos'},
  21:{objectId:'g3d4e0c6ff7_2_365',title:'Cómo lo hacemos'},
  28:{objectId:'g4cecfed029_1_25',title:'Innovación'},
  29:{objectId:'g4cecfed029_1_40',title:'Analytics'},
  42:{objectId:'g3237339b6af_0_0',title:'De SaaS a XaaS'}
};

const packs={
  'admira-2026-corporate':{
    id:'admira-2026-corporate',title:'Admira 2026 · Quiénes somos',shortTitle:'Quiénes somos',description:'Identidad, escala, propósito, capacidades y forma de trabajo de Admira.',languages:['es'],recommendedPosition:'before',sourceUrl:SOURCE_URL,slides:[1,2,3,4,5,7,8,9,10,11,21]
  },
  'admira-2026-vision-xaas':{
    id:'admira-2026-vision-xaas',title:'Admira 2026 · Visión XaaS',shortTitle:'Visión y próximos pasos',description:'Innovación, analítica y evolución de SaaS a XaaS como cierre estratégico.',languages:['es'],recommendedPosition:'after',sourceUrl:SOURCE_URL,slides:[28,29,42]
  }
};

function cleanId(value){return String(value||'').trim().toLowerCase()}
function safeClient(value){return String(value||'').toLowerCase().replace(/[^a-z0-9-]/g,'')}
function slideFile(number){return `slide-${String(number).padStart(2,'0')}.webp`}

export function getDeckPack(value,client=''){
  const pack=packs[cleanId(value)];if(!pack)return null;
  const safe=safeClient(client);
  return {...pack,slides:pack.slides.map((number,index)=>({
    index:index+1,sourceSlide:number,...sourceSlides[number],collection:'admira-2026',file:slideFile(number),
    url:safe?`/presentaciones/${safe}/deck/admira-2026/${slideFile(number)}`:''
  }))};
}

export function listDeckPacks(){
  return Object.values(packs).map(pack=>({id:pack.id,title:pack.title,shortTitle:pack.shortTitle,description:pack.description,languages:pack.languages,recommendedPosition:pack.recommendedPosition,slideCount:pack.slides.length,sourceUrl:pack.sourceUrl}));
}

export function normalizeSequence(value={}){
  const before=getDeckPack(value?.before)?.id||null,after=getDeckPack(value?.after)?.id||null;
  return {before,after};
}

export function isDeckAsset(collection,file){
  if(collection!=='admira-2026'||!/^slide-\d{2}\.webp$/.test(String(file||'')))return false;
  return Object.keys(sourceSlides).some(number=>slideFile(number)===file);
}

export const DEFAULT_BEFORE_DECK='admira-2026-corporate';
