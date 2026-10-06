// Commercial projects have their own ACL namespace; a software-project grant
// (for example starbucks or xpaceos) never grants access to a customer circuit.
export const SEEDS = [{"id": "cafebreria", "circuit": "cafebreria", "label": "Cafebrería", "es": "Cafebrería · Proyecto independiente", "en": "Cafebrería · Independent project", "aliases": ["cafebreria barcelona"], "featured": true}, {"id": "starbucks", "circuit": "alsea_starbucks", "label": "Starbucks", "es": "Starbucks España (Alsea)", "en": "Starbucks Spain (Alsea)", "aliases": ["sbux", "alsea", "alsea starbucks", "starbucks espana", "starbucks spain"], "featured": true}, {"id": "starbucks-mexico", "circuit": "alsea_mexico", "label": "Starbucks México", "es": "Starbucks México (Alsea)", "en": "Starbucks Mexico (Alsea)", "aliases": ["starbucks mx", "sbux mx", "alsea mexico", "alsea mx"], "featured": true}, {"id": "alcampo", "circuit": "alcampo", "label": "Alcampo", "es": "Alcampo · supermercados", "en": "Alcampo · supermarkets", "aliases": ["auchan"], "featured": true}, {"id": "canalkiosk", "circuit": "kioskos", "label": "CanalKiosk", "es": "CanalKiosk · kioskos de prensa", "en": "CanalKiosk · press kiosks", "aliases": ["canal kiosk", "kioskos", "kiosko", "kioscos", "kiosco", "kiosk", "kiosks"], "featured": true}, {"id": "jti", "circuit": "jti_xtanco", "label": "JTI Xtanco", "es": "JTI Xtanco España", "en": "JTI Xtanco Spain", "aliases": ["jti xtanco", "xtanco"], "featured": true}, {"id": "estancos", "circuit": "estancos", "label": "Estancos", "es": "Xtanco Nacional · estancos", "en": "National Xtanco · tobacconists", "aliases": ["estanco", "xtanco nacional", "tobacconists"]}, {"id": "decathlon", "circuit": "decathlon", "label": "Decathlon", "es": "Decathlon España", "en": "Decathlon Spain", "aliases": []}, {"id": "bbva", "circuit": "bbva", "label": "BBVA", "es": "BBVA España", "en": "BBVA Spain", "aliases": []}, {"id": "caixabank", "circuit": "caixabank", "label": "CaixaBank", "es": "La Caixa / CaixaBank", "en": "La Caixa / CaixaBank", "aliases": ["la caixa", "caixa"]}, {"id": "banorte", "circuit": "banorte_mx", "label": "Banorte", "es": "Banorte México", "en": "Banorte Mexico", "aliases": ["banorte mx"]}, {"id": "elcorteingles", "circuit": "elcorteingles", "label": "El Corte Inglés", "es": "El Corte Inglés", "en": "El Corte Inglés", "aliases": ["el corte ingles", "corte ingles", "eci"]}, {"id": "correos", "circuit": "correos", "label": "Correos", "es": "Correos España", "en": "Correos Spain", "aliases": []}, {"id": "multiopticas", "circuit": "multiopticas", "label": "MultiÓpticas", "es": "MultiÓpticas España", "en": "MultiÓpticas Spain", "aliases": ["multi opticas"]}, {"id": "palacio", "circuit": "palacio", "label": "El Palacio de Hierro", "es": "El Palacio de Hierro · México", "en": "El Palacio de Hierro · Mexico", "aliases": ["palacio de hierro", "el palacio de hierro"]}, {"id": "liverpool", "circuit": "liverpool_mx", "label": "Liverpool", "es": "Liverpool · México", "en": "Liverpool · Mexico", "aliases": ["liverpool mx"]}, {"id": "desigual", "circuit": "desigual", "label": "Desigual", "es": "Desigual", "en": "Desigual", "aliases": []}, {"id": "mango", "circuit": "mango", "label": "Mango", "es": "Mango", "en": "Mango", "aliases": []}, {"id": "admiraxperience", "circuit": "admiraxperience", "label": "AdmiraXperience", "es": "AdmiraXperience", "en": "AdmiraXperience", "aliases": ["admira xperience", "xperience"]}, {"id": "metro", "circuit": "metro_bcn", "label": "Metro BCN", "es": "Metro de Barcelona", "en": "Barcelona Metro", "aliases": ["metro bcn", "metro barcelona"]}, {"id": "altadis", "circuit": "altadis_bcn", "label": "Altadis", "es": "Altadis · estancos Barcelona", "en": "Altadis · Barcelona tobacconists", "aliases": ["altadis bcn", "imperial", "estancos altadis"]}];
export const ROOT = 'commercial-projects';
export const aclKey = id => `commercial:${id}`;
// Clientes del enlace «Conecta con AdmiraNext» (token de LECTURA de 10 min, ligado al origen).
// admira.biz y clearchannel.tv sirven el mismo backoffice que admira.app (proyecto Pages
// clearchannel-tv): sin ellos el enlace respondía 403 y el backoffice de admira.biz no podía
// listar proyectos y locales para montar circuitos de demo (06-10-2026).
export const CLIENT_ORIGINS = new Set(['https://www.xpaceos.com','https://xpaceos.com','https://www.admira.store','https://admira.store','https://www.admira.app','https://admira.app','https://www.admira.biz','https://admira.biz','https://www.clearchannel.tv','https://clearchannel.tv']);
export const DEMOS = [
 {id:'demo-xtanco',project_id:'estancos',name:'Xtanco · demo',demo:true,xpace_url:'https://www.xpaceos.com/admira-xp/?autostart=xtanco&project=estancos&quality=better'},
 {id:'demo-cafebreria',project_id:'cafebreria',name:'Cafebrería · demo',demo:true,xpace_url:'https://www.xpaceos.com/admira-xp/?autostart=cafeteria&project=cafebreria&quality=better'},
 {id:'demo-starbucks',project_id:'starbucks',name:'Starbucks · demo pública',demo:true,xpace_url:'https://www.xpaceos.com/admira-xp/?autostart=cafeteria&loc=alsea-sbux-021&project=starbucks&quality=better'},
 // Altadis (2-oct-2026): 9 estancos reales OSM de Gràcia, circuito altadis_bcn publicado en admira.app y en el KV de puntos.
 // Mismos ID/URL que admiranext_xpace_venues (AUTH_DB), para que demo y cuenta abran el mismo gemelo.
 {id:"altadis-bcn-001",project_id:'altadis',name:"Estanco Gràcia 1 · Carrer Gran de Gràcia s/n · 08012 Barcelona",demo:true,xpace_url:"https://www.xpaceos.com/admira-xp/?autostart=xtanco&loc=altadis-bcn-001&quality=better&project=altadis&circuit=altadis_bcn"},
 {id:"altadis-bcn-002",project_id:'altadis',name:"Moe's Expenedoria · Plaça de la Vila de Gràcia s/n · 08012 Barcelona",demo:true,xpace_url:"https://www.xpaceos.com/admira-xp/?autostart=xtanco&loc=altadis-bcn-002&quality=better&project=altadis&circuit=altadis_bcn"},
 {id:"altadis-bcn-003",project_id:'altadis',name:"Estanco Gràcia 3 · Carrer del Torrent de l'Olla s/n · 08008 Barcelona",demo:true,xpace_url:"https://www.xpaceos.com/admira-xp/?autostart=xtanco&loc=altadis-bcn-003&quality=better&project=altadis&circuit=altadis_bcn"},
 {id:"altadis-bcn-004",project_id:'altadis',name:"Estanco Gràcia 4 · Carrer de Santa Teresa s/n · 08008 Barcelona",demo:true,xpace_url:"https://www.xpaceos.com/admira-xp/?autostart=xtanco&loc=altadis-bcn-004&quality=better&project=altadis&circuit=altadis_bcn"},
 {id:"altadis-bcn-005",project_id:'altadis',name:"Estanco Gràcia 5 · Via Augusta s/n · 08012 Barcelona",demo:true,xpace_url:"https://www.xpaceos.com/admira-xp/?autostart=xtanco&loc=altadis-bcn-005&quality=better&project=altadis&circuit=altadis_bcn"},
 {id:"altadis-bcn-006",project_id:'altadis',name:"Estanco nº 003 · Plaça de Gal·la Placídia 26 · 08006 Barcelona",demo:true,xpace_url:"https://www.xpaceos.com/admira-xp/?autostart=xtanco&loc=altadis-bcn-006&quality=better&project=altadis&circuit=altadis_bcn"},
 {id:"altadis-bcn-007",project_id:'altadis',name:"Estanco Gràcia 7 · Carrer de Terol s/n · 08012 Barcelona",demo:true,xpace_url:"https://www.xpaceos.com/admira-xp/?autostart=xtanco&loc=altadis-bcn-007&quality=better&project=altadis&circuit=altadis_bcn"},
 {id:"altadis-bcn-008",project_id:'altadis',name:"Estanco Gràcia 8 · Travessera de Gràcia 194 · 08012 Barcelona",demo:true,xpace_url:"https://www.xpaceos.com/admira-xp/?autostart=xtanco&loc=altadis-bcn-008&quality=better&project=altadis&circuit=altadis_bcn"},
 {id:"altadis-bcn-009",project_id:'altadis',name:"Estanco Gràcia 9 · Carrer de Torrijos s/n · 08012 Barcelona",demo:true,xpace_url:"https://www.xpaceos.com/admira-xp/?autostart=xtanco&loc=altadis-bcn-009&quality=better&project=altadis&circuit=altadis_bcn"}
];
const ready = new WeakMap();
export async function ensureRegistry(env) {
 if(!env.AUTH_DB) throw Error('AUTH_DB no configurado');
 if(!ready.has(env.AUTH_DB)) ready.set(env.AUTH_DB, (async()=>{
  await env.AUTH_DB.prepare(`CREATE TABLE IF NOT EXISTS admiranext_commercial_projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, circuit TEXT NOT NULL, updated_at INTEGER NOT NULL, updated_by TEXT NOT NULL)`).run();
  await env.AUTH_DB.prepare(`CREATE TABLE IF NOT EXISTS admiranext_xpace_venues (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES admiranext_commercial_projects(id), name TEXT NOT NULL, xpace_url TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, updated_at INTEGER NOT NULL, updated_by TEXT NOT NULL)`).run();
  await env.AUTH_DB.prepare(`CREATE TABLE IF NOT EXISTS admiranext_xpace_links (state TEXT PRIMARY KEY, challenge TEXT NOT NULL, origin TEXT NOT NULL, expires_at INTEGER NOT NULL, user_email TEXT, session_version INTEGER)`).run();
  await env.AUTH_DB.prepare(`CREATE TABLE IF NOT EXISTS admiranext_xpace_audit (id TEXT PRIMARY KEY, actor_email TEXT NOT NULL, target_id TEXT NOT NULL, action TEXT NOT NULL, detail TEXT NOT NULL, created_at INTEGER NOT NULL)`).run();
  await env.AUTH_DB.prepare(`CREATE TABLE IF NOT EXISTS admiranext_xpace_access (token_hash TEXT PRIMARY KEY, user_email TEXT NOT NULL, session_version INTEGER NOT NULL, origin TEXT NOT NULL, expires_at INTEGER NOT NULL)`).run();
  await env.AUTH_DB.batch(SEEDS.map(p=>env.AUTH_DB.prepare(`INSERT INTO admiranext_commercial_projects VALUES(?,?,?,?,?) ON CONFLICT(id) DO NOTHING`).bind(p.id,p.label,p.circuit,Date.now(),'backoffice-migration-20261001')));
  // Only this venue has an explicit, previously verified backoffice association.
  await env.AUTH_DB.prepare(`INSERT INTO admiranext_xpace_venues VALUES(?,?,?,?,1,?,?) ON CONFLICT(id) DO NOTHING`).bind('alsea-sbux-021','starbucks','Paseo de Gracia 103 · Barcelona','https://www.xpaceos.com/admira-xp/?autostart=cafeteria&loc=alsea-sbux-021&project=starbucks&quality=better',Date.now(),'backoffice-migration-20261001').run();
 })().catch(error=>{ready.delete(env.AUTH_DB);throw error;}));
 await ready.get(env.AUTH_DB);
}
export async function projects(env) {
 if(!env.AUTH_DB) return SEEDS.map(p=>({id:p.id,name:p.label,circuit:p.circuit}));
 await ensureRegistry(env);
 return (await env.AUTH_DB.prepare('SELECT id,name,circuit FROM admiranext_commercial_projects ORDER BY name').all()).results;
}
export async function commercialCatalog(env) {
 return [{key:ROOT,name:'Proyectos comerciales · locales / Commercial projects · venues',parent_key:'',source:'admiranext',order:20000},...(await projects(env)).map((p,i)=>({key:aclKey(p.id),name:p.name,parent_key:ROOT,source:'admiranext',order:20001+i}))];
}
export function safeConnection(value) {
 try {
  const u=new URL(value,'https://www.admiranext.com');
  if(u.origin!=='https://www.admiranext.com'||u.pathname!=='/xpace/connect'||!CLIENT_ORIGINS.has(u.searchParams.get('origin'))||!/^[a-zA-Z0-9_-]{32,128}$/.test(u.searchParams.get('state')||'')||[...u.searchParams.keys()].some(k=>!['origin','state'].includes(k))) return null;
  return u.pathname+u.search;
 }catch{return null;}
}
export function validateVenue(body,knownProjects) {
 const id=String(body.id||''), project_id=String(body.project_id||''), name=String(body.name||'').trim(), enabled=body.enabled;
 if(!/^[a-z0-9][a-z0-9_-]{1,79}$/.test(id)||!knownProjects.some(p=>p.id===project_id)||name.length<2||name.length>160||typeof enabled!=='boolean') throw Error('ID, proyecto, nombre o estado inválido');
 const u=new URL(body.xpace_url);
 if(!['https://www.xpaceos.com','https://www.admira.store'].includes(u.origin)||u.username||u.password||u.pathname!=='/admira-xp/'||u.hash||u.href.length>1500) throw Error('La URL debe ser un Xpacio HTTPS de XpaceOS o admira.store');
 const allowed=new Set(['autostart','loc','project','circuit','quality','visual','lang','langlock']);
 if([...u.searchParams.keys()].some(k=>!allowed.has(k))) throw Error('Parámetros de Xpacio no permitidos');
 if(!['xtanco','cafeteria'].includes(u.searchParams.get('autostart'))) throw Error('Falta una escena compatible');
 if(u.searchParams.get('project') && u.searchParams.get('project')!==project_id) throw Error('El proyecto de la URL no coincide');
 if(u.searchParams.get('loc')==='alsea-sbux-021'&&project_id!=='starbucks')throw Error('Este local pertenece a Starbucks');
 const p=knownProjects.find(p=>p.id===project_id);
 u.searchParams.set('project',project_id);u.searchParams.set('circuit',p.circuit);
 return {id,project_id,name,xpace_url:u.href,enabled:enabled?1:0};
}

export async function auditRegistry(env,actor,target,action,detail){await ensureRegistry(env);await env.AUTH_DB.prepare('INSERT INTO admiranext_xpace_audit VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),actor,target,action,JSON.stringify(detail),Date.now()).run();}
