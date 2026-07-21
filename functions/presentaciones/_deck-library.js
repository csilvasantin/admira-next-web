const SOURCE_URL='https://docs.google.com/presentation/d/1PHJLGEq-uV4-U7OhxVsLRM41O6XA5xfDnNLWhlg2odo/edit';

const slideIds=['g29351b17195b6e79_0','g5077aaed3cc82d4d_0','g3d533a9979_0_17','g3d533a9979_0_30','g3d4e0c6ff7_2_354','g6eb12235c5_3_20','g3d4e0c6ff7_2_343','g4cecfed029_0_1','g284fc9ef4b0_0_6','g284fc9ef4b0_0_0','g2c3a93c3b4d_0_0','g3d4e0c6ff7_2_537','g3d4e0c6ff7_2_609','g3d4e0c6ff7_2_150','g3d4e0c6ff7_2_161','g11141b58d40_0_0','g11141b58d40_0_11','g3a003309f2e_0_7','g3f0402a7482_1_0','g3d4e0c6ff7_2_241','g3d4e0c6ff7_2_365','g3d4a4537a8_0_0','g1254c4b82f9_0_0','g3d4e0c6ff7_2_451','g3d4e0c6ff7_5_76','g3d4e0c6ff7_2_558','g11667e4c8be_0_0','g4cecfed029_1_25','g4cecfed029_1_40','g4cecfed029_1_30','g54d8fd45335419c9_0','g84f5bf3705e7a46_35','g6b50fd9020_1_15','g94943f65b5_0_0','geb14b0d4ed_0_1','g94943f65b5_0_59','g94943f65b5_0_44','g7964b44992_1_228','g94943f65b5_0_8','g7964b44992_2_4','gc8a18dfa2e_0_259','g3237339b6af_0_0'];
const titles={
  es:['Admira','Quiénes somos','Un equipo de más de 140 personas','Presencia en 60 países','Todo el customer journey','Un lugar para pensar','El bosque · Think Tank','El laboratorio · Innovación','Admira X','Admira U','Qué hacemos','Conectamos cosas','Hard Rock Cafe Karaoke','Espacios que se transforman','Experiencias inmersivas','Interacción física y digital','Experiencias en el móvil','Xtanco 2.0','Xtanco 2.0 · La experiencia','Robótica social','Cómo lo hacemos','Una plataforma para gobernarlo todo','Visión en tiempo real','Retail conectado · Mango','Operación global','Retail conectado · Desigual','Un punto de servicio conectado','Innovación','Historias que conectan','Retail que entiende el contexto','Producto inteligente','Mobiliario inteligente con IA','Experiencias de nueva generación','Avatar digital','Asistentes virtuales','Estudio de creación','Interfaces conversacionales','Avatares en el espacio físico','Modelos','Personas digitales','Humanos y avatares','De SaaS a XaaS'],
  ca:['Admira','Qui som','Un equip de més de 140 persones','Presència en 60 països','Tot el customer journey','Un lloc per pensar','El bosc · Think Tank','El laboratori · Innovació','Admira X','Admira U','Què fem','Connectem coses','Hard Rock Cafe Karaoke','Espais que es transformen','Experiències immersives','Interacció física i digital','Experiències al mòbil','Xtanco 2.0','Xtanco 2.0 · L’experiència','Robòtica social','Com ho fem','Una plataforma per governar-ho tot','Visió en temps real','Retail connectat · Mango','Operació global','Retail connectat · Desigual','Un punt de servei connectat','Innovació','Històries que connecten','Retail que entén el context','Producte intel·ligent','Mobiliari intel·ligent amb IA','Experiències de nova generació','Avatar digital','Assistents virtuals','Estudi de creació','Interfícies conversacionals','Avatars a l’espai físic','Models','Persones digitals','Humans i avatars','De SaaS a XaaS'],
  en:['Admira','Who we are','A team of more than 140 people','Presence in 60 countries','The entire customer journey','A place to think','The forest · Think Tank','The lab · Innovation','Admira X','Admira U','What we do','Connecting things','Hard Rock Cafe Karaoke','Spaces that transform','Immersive experiences','Physical and digital interaction','Mobile experiences','Xtanco 2.0','Xtanco 2.0 · The experience','Social robotics','How we do it','One platform to govern it all','Real-time vision','Connected retail · Mango','Global operations','Connected retail · Desigual','A connected service point','Innovation','Stories that connect','Retail that understands context','Intelligent product','AI-powered smart furniture','Next-generation experiences','Digital avatar','Virtual assistants','Creation studio','Conversational interfaces','Avatars in physical space','Models','Digital people','Humans and avatars','From SaaS to XaaS']
};
const details={
  es:{
    2:'Una empresa de transformación digital con más de 150.000 puntos conectados.',
    5:'Presencia en todo el customer journey.',
    11:'Experiencias conectadas a internet, desde circuitos publicitarios hasta redes empresariales de decenas de miles de puntos.',
    21:'A través de nuestra plataforma agéntica de Internet of Things.',
    28:'La capacidad de responder a las necesidades presentes y futuras de los clientes.'
  },
  ca:{
    2:'Una empresa de transformació digital amb més de 150.000 punts connectats.',
    5:'Presència en tot el customer journey.',
    11:'Experiències connectades a internet, des de circuits publicitaris fins a xarxes empresarials de desenes de milers de punts.',
    21:"A través de la nostra plataforma agèntica d'Internet of Things.",
    28:'La capacitat de respondre a les necessitats presents i futures dels clients.'
  },
  en:{
    2:'A digital transformation company with more than 150,000 connected points.',
    5:'Present throughout the customer journey.',
    11:'Internet-connected experiences, from advertising networks to enterprise networks with tens of thousands of points.',
    21:'Through our agentic Internet of Things platform.',
    28:'The ability to respond to present and future customer needs.'
  }
};
const fullSlides=Array.from({length:42},(_,index)=>index+1),shortSlides=[1,2,3,4,5,7,8,9,10,11,21];
const bestPhases=[{to:10,file:'team'},{to:20,file:'experience'},{to:27,file:'platform'},{to:33,file:'world'},{to:42,file:'avatar'}];

const packs={
  'admira-2026-corporate':{id:'admira-2026-corporate',title:'Admira 2026 · Quiénes somos',shortTitle:'Quiénes somos',description:'Presentación corporativa de Admira antes de la propuesta del cliente.',languages:['es','ca','en'],recommendedPosition:'before',sourceUrl:SOURCE_URL,fullSlides,shortSlides,defaultLength:'full',defaultQuality:'good'},
  'admira-2026-vision-xaas':{id:'admira-2026-vision-xaas',title:'Admira 2026 · Visión XaaS',shortTitle:'Visión y próximos pasos',description:'Innovación, analítica y evolución de SaaS a XaaS como cierre estratégico.',languages:['es','ca','en'],recommendedPosition:'after',sourceUrl:SOURCE_URL,fullSlides:[28,29,42],shortSlides:[28,29,42],defaultLength:'short',defaultQuality:'good'}
};

function cleanId(value){return String(value||'').trim().toLowerCase()}
function safeClient(value){return String(value||'').toLowerCase().replace(/[^a-z0-9-]/g,'')}
function lengthOption(value,fallback='full'){return ['full','short'].includes(value)?value:fallback}
function qualityOption(value,fallback='good'){return ['good','better','best'].includes(value)?value:fallback}
function slideFile(number,language){return `${language}-slide-${String(number).padStart(2,'0')}.webp`}
function assetUrl(client,file){return client?`/presentaciones/${client}/deck/admira-2026/${file}`:''}
function bestFile(number){return `best-${bestPhases.find(phase=>number<=phase.to)?.file||'avatar'}.webp`}

export function getDeckPack(value,client='',options={}){
  const pack=packs[cleanId(value)];if(!pack)return null;
  const safe=safeClient(client),length=lengthOption(options.length,pack.defaultLength),quality=qualityOption(options.quality,pack.defaultQuality),numbers=length==='short'?pack.shortSlides:pack.fullSlides;
  return {...pack,length,quality,slides:numbers.map((number,index)=>({
    index:index+1,sourceSlide:number,objectId:slideIds[number-1],collection:'admira-2026',titles:{es:titles.es[number-1],ca:titles.ca[number-1],en:titles.en[number-1]},details:{es:details.es[number]||'',ca:details.ca[number]||'',en:details.en[number]||''},
    urls:{es:assetUrl(safe,slideFile(number,'es')),ca:assetUrl(safe,slideFile(number,'ca')),en:assetUrl(safe,slideFile(number,'en'))},bestUrl:assetUrl(safe,bestFile(number))
  }))};
}

export function listDeckPacks(){return Object.values(packs).map(pack=>({id:pack.id,title:pack.title,shortTitle:pack.shortTitle,description:pack.description,languages:pack.languages,recommendedPosition:pack.recommendedPosition,slideCount:pack.fullSlides.length,shortSlideCount:pack.shortSlides.length,sourceUrl:pack.sourceUrl,lengths:pack.recommendedPosition==='before'?['full','short']:['short'],qualities:pack.recommendedPosition==='before'?['good','better','best']:['good'],defaultLength:pack.defaultLength,defaultQuality:pack.defaultQuality}))}

export function normalizeSequence(value={}){
  const before=getDeckPack(value?.before)?.id||null,after=getDeckPack(value?.after)?.id||null;
  return {before,beforeLength:lengthOption(value?.beforeLength,'full'),beforeQuality:qualityOption(value?.beforeQuality,'good'),after};
}

export function isDeckAsset(collection,file){
  if(collection!=='admira-2026')return false;
  if(/^(?:es|ca|en)-slide-(?:0[1-9]|[1-3]\d|4[0-2])\.webp$/.test(String(file||'')))return true;
  return /^best-(?:team|world|experience|platform|avatar)\.webp$/.test(String(file||''));
}

export const DEFAULT_BEFORE_DECK='admira-2026-corporate';
export const DEFAULT_BEFORE_LENGTH='full';
export const DEFAULT_BEFORE_QUALITY='good';
